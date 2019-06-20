// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

#include <optional>
#include <string>
#include <vector>

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <sass/context.h>

#include "functions.h"
#include "importers.h"

namespace node_sass {

using ::emscripten::val;
using ::std::make_unique;
using ::std::nullopt;
using ::std::optional;
using ::std::string;
using ::std::unique_ptr;
using ::std::vector;

class OptionsError : public std::invalid_argument {
 public:
  using invalid_argument::invalid_argument;
};

optional<string> getString(val options, const string& key) {
  val value = options[key];
  if (value.isUndefined() || value.isNull()) {
    return nullopt;
  } else if (value.isString()) {
    return value.as<string>();
  } else {
    throw OptionsError("options." + key + " is not a string or null");
  }
}

optional<int> getInt(val options, const string& key) {
  val value = options[key];
  if (value.isUndefined() || value.isNull()) {
    return nullopt;
  } else if (value.isNumber()) {
    return value.as<int>();
  } else {
    throw OptionsError("options." + key + " is not a number or null");
  }
}

val sassRender(val options, val externalHelper) {
  try {
    optional<string> data = getString(options, "data");
    optional<string> file = getString(options, "file");
    optional<string> outFile = getString(options, "outFile");
    optional<string> sourceMap = getString(options, "sourceMap");
    optional<string> sourceMapRoot = getString(options, "sourceMapRoot");
    optional<string> linefeed = getString(options, "linefeed");
    optional<string> indent = getString(options, "indent");
    optional<string> outputStyle = getString(options, "outputStyle");
    optional<int> precision = getInt(options, "precision");
    int importersLength = getInt(options, "importersLength").value_or(0);
    bool indentedSyntax = options["indentedSyntax"].as<bool>();
    bool sourceComments = options["sourceComments"].as<bool>();
    bool omitSourceMapUrl = options["omitSourceMapUrl"].as<bool>();
    bool sourceMapEmbed = options["sourceMapEmbed"].as<bool>();
    bool sourceMapContents = options["sourceMapContents"].as<bool>();

    vector<string> includePaths;
    if (val arr = options["includePaths"]; !arr.isUndefined() && !arr.isNull()) {
      if (!arr.isArray()) throw OptionsError("options.includePaths is not an array or null");
      int length = arr["length"].as<int>();
      for (int i = 0; i < length; i++) {
        val element = arr[i];
        if (!element.isString()) throw OptionsError("options.includePaths[" + std::to_string(i) + "] is not a string");
        includePaths.push_back(element.as<string>());
      }
    }

    vector<unique_ptr<ImporterData>> importers;
    for (int i = 0; i < importersLength; i++) {
      importers.push_back(make_unique<ImporterData>(externalHelper, i));
    }

    vector<string> functionSignatures;
    vector<unique_ptr<FunctionData>> functions;
    if (val arr = options["functionSignatures"]; !arr.isUndefined() && !arr.isNull()) {
      if (!arr.isArray()) throw OptionsError("options.functionSignatures is not an array or null");
      int length = arr["length"].as<int>();
      for (int i = 0; i < length; i++) {
        val element = arr[i];
        if (!element.isString()) throw OptionsError("options.functionSignatures[" + std::to_string(i) + "] is not a string");
        functionSignatures.push_back(element.as<string>());
        functions.push_back(make_unique<FunctionData>(externalHelper, i));
      }
    }

    auto extractOptions = [&](Sass_Context* ctx) {
      Sass_Options* sass_options = sass_context_get_options(ctx);

      if (outFile) sass_option_set_output_path(sass_options, outFile->c_str());
      if (sourceMap) sass_option_set_source_map_file(sass_options, sourceMap->c_str());
      if (sourceMapRoot) sass_option_set_source_map_root(sass_options, sourceMapRoot->c_str());
      if (linefeed) sass_option_set_linefeed(sass_options, linefeed->c_str());
      if (indent) sass_option_set_indent(sass_options, indent->c_str());
      for (const string& path : includePaths) sass_option_push_include_path(sass_options, path.c_str());
      if (outputStyle == "nested") sass_option_set_output_style(sass_options, SASS_STYLE_NESTED);
      if (outputStyle == "expanded") sass_option_set_output_style(sass_options, SASS_STYLE_EXPANDED);
      if (outputStyle == "compact") sass_option_set_output_style(sass_options, SASS_STYLE_COMPACT);
      if (outputStyle == "compressed") sass_option_set_output_style(sass_options, SASS_STYLE_COMPRESSED);
      sass_option_set_is_indented_syntax_src(sass_options, indentedSyntax);
      sass_option_set_source_comments(sass_options, sourceComments);
      sass_option_set_omit_source_map_url(sass_options, omitSourceMapUrl);
      sass_option_set_source_map_embed(sass_options, sourceMapEmbed);
      sass_option_set_source_map_contents(sass_options, sourceMapContents);
      sass_option_set_precision(sass_options, precision.value_or(5));  // libsass default is 10 but node-sass default is 5.

      if (importersLength) {
        Sass_Importer_List c_importers = sass_make_importer_list(importersLength);
        for (int i = 0; i < importersLength; i++) {
          sass_importer_set_list_entry(c_importers, i, sass_make_importer(runImporter, importersLength - i - 1, importers[i].get()));
        }
        sass_option_set_c_importers(sass_options, c_importers);
      }

      if (!functions.empty()) {
        int functionsLength = functionSignatures.size();
        Sass_Function_List c_functions = sass_make_function_list(functionsLength);
        for (int i = 0; i < functionsLength; i++) {
          sass_function_set_list_entry(c_functions, i, sass_make_function(functionSignatures[i].c_str(), runFunction, functions[i].get()));
        }
        sass_option_set_c_functions(sass_options, c_functions);
      }
    };

    auto createResult = [&](Sass_Context* ctx) {
      val result = val::object();

      if (sass_context_get_error_status(ctx) != 0) {
        result.set("error", sass_context_get_error_json(ctx));
      } else {
        result.set("css", sass_context_get_output_string(ctx));

        const char* map = sass_context_get_source_map_string(ctx);
        if (map) result.set("map", map);

        vector<string> included_files_vector;
        char** included_files = sass_context_get_included_files(ctx);
        for (int i = 0; included_files && included_files[i]; i++) {
          included_files_vector.push_back(included_files[i]);
        }
        result.set("includedFiles", val::array(included_files_vector));
      }

      return result;
    };

    if (data) {
      Sass_Data_Context* dctx = sass_make_data_context(data->data());
      extractOptions(sass_data_context_get_context(dctx));
      if (file) sass_option_set_input_path(sass_data_context_get_options(dctx), file->c_str());

      sass_compile_data_context(dctx);
      val result = createResult(sass_data_context_get_context(dctx));

      sass_delete_data_context(dctx);
      return result;
    } else if (file) {
      Sass_File_Context* fctx = sass_make_file_context(file->c_str());
      extractOptions(sass_file_context_get_context(fctx));

      sass_compile_file_context(fctx);
      val result = createResult(sass_file_context_get_context(fctx));

      sass_delete_file_context(fctx);
      return result;
    } else {
      throw OptionsError("At least one of options.data or options.file must be set");
    }
  } catch (OptionsError& e) {
    val result = val::object();
    result.set("optionsError", e.what());
    return result;
  }
}

string sassVersion() {
  return libsass_version();
}

EMSCRIPTEN_BINDINGS(sass_bindings) {
  emscripten::function("sassRender", &sassRender);
  emscripten::function("sassVersion", &sassVersion);
}

}  // namespace node_sass
