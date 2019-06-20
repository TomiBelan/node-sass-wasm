// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

#include "importers.h"

#include <optional>

#include <sass/context.h>

namespace node_sass {

using ::emscripten::val;
using ::std::nullopt;
using ::std::optional;
using ::std::string;

static Sass_Import_Entry makeError(const string& what) {
  Sass_Import_Entry import = sass_make_import_entry(nullptr, nullptr, nullptr);
  sass_import_set_error(import, what.c_str(), -1, -1);
  return import;
}

static Sass_Import_Entry makeImport(string debugName, val value) {
  if (value.isNull() || value.isUndefined() || value.typeOf().as<string>() != "object") {
    return makeError("Importer error: " + debugName + " must be an object");
  }

  #define READ_STRING_FIELD(out_var, field_name) \
      optional<string> out_var; \
      { \
        val field = value[field_name]; \
        if (field.isString()) { \
          out_var = field.as<string>(); \
        } else if (!field.isUndefined() && !field.isNull()) { \
          return makeError("Importer error: " + debugName + "." + (field_name) + " must be a string if it's set"); \
        } \
      }

  READ_STRING_FIELD(error, "__error");
  READ_STRING_FIELD(file, "file");
  READ_STRING_FIELD(contents, "contents");
  READ_STRING_FIELD(map, "map");

  if (error) return makeError(*error);

  // Note well: sass_make_import_entry takes ownership of "source" and "srcmap" but makes a copy of "path".
  return sass_make_import_entry(
      file ? file->c_str() : nullptr,
      contents ? strdup(contents->c_str()) : nullptr,
      map ? strdup(map->c_str()) : nullptr);
}

Sass_Import_List runImporter(const char* cur_path, Sass_Importer_Entry cb, Sass_Compiler* comp) {
  ImporterData* importerData = static_cast<ImporterData*>(sass_importer_get_cookie(cb));
  val externalHelper = importerData->externalHelper;
  int index = importerData->index;

  Sass_Import* previous = sass_compiler_get_last_import(comp);
  const char* prev_path = sass_import_get_abs_path(previous);

  val helperInput = val::object();
  helperInput.set("type", "importer");
  helperInput.set("index", index);
  helperInput.set("file", cur_path);
  helperInput.set("prev", prev_path);

  val helperOutput = externalHelper(helperInput);

  val helperOutputDecoded = val::global("JSON").call<val>("parse", helperOutput);
  if (helperOutputDecoded.isArray()) {
    int length = helperOutputDecoded["length"].as<int>();
    Sass_Import_List imports = sass_make_import_list(length);
    for (int i = 0; i < length; i++) imports[i] = makeImport("imports[" + std::to_string(i) + "]", helperOutputDecoded[i]);
    return imports;
  } else if (!helperOutputDecoded.isNull() && !helperOutputDecoded.isUndefined() && !helperOutputDecoded.isFalse()) {
    Sass_Import_List imports = sass_make_import_list(1);
    imports[0] = makeImport("result", helperOutputDecoded);
    return imports;
  } else {
    return nullptr;
  }
}

}  // namespace node_sass
