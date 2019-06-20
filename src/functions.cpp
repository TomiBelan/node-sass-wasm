// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

#include "functions.h"

#include <sass/values.h>

namespace node_sass {

using ::emscripten::val;
using ::std::string;

class ConversionError : public std::invalid_argument {
 public:
  using invalid_argument::invalid_argument;
};

static val cppToJs(const Sass_Value* value) {
  switch (sass_value_get_tag(value)) {
    case SASS_BOOLEAN: {
      val result = val::object();
      result.set("_type", "boolean");
      result.set("_value", sass_boolean_get_value(value));
      return result;
    }

    case SASS_NUMBER: {
      val result = val::object();
      result.set("_type", "number");
      result.set("_value", sass_number_get_value(value));
      result.set("_unit", sass_number_get_unit(value));
      return result;
    }

    case SASS_COLOR: {
      val result = val::object();
      result.set("_type", "color");
      result.set("_r", sass_color_get_r(value));
      result.set("_g", sass_color_get_g(value));
      result.set("_b", sass_color_get_b(value));
      result.set("_a", sass_color_get_a(value));
      return result;
    }

    case SASS_STRING: {
      val result = val::object();
      result.set("_type", "string");
      result.set("_value", sass_string_get_value(value));
      result.set("_quoted", sass_string_is_quoted(value));
      return result;
    }

    case SASS_LIST: {
      int length = sass_list_get_length(value);
      val values = val::array();
      for (int i = 0; i < length; i++) {
        values.call<void>("push", cppToJs(sass_list_get_value(value, i)));
      }
      val result = val::object();
      result.set("_type", "list");
      result.set("_values", values);
      result.set("_separator", sass_list_get_separator(value) == SASS_COMMA);
      result.set("_isBracketed", sass_list_get_is_bracketed(value));
      return result;
    }

    case SASS_MAP: {
      int length = sass_map_get_length(value);
      val keys = val::array(), values = val::array();
      for (int i = 0; i < length; i++) {
        keys.call<void>("push", cppToJs(sass_map_get_key(value, i)));
        values.call<void>("push", cppToJs(sass_map_get_value(value, i)));
      }
      val result = val::object();
      result.set("_type", "map");
      result.set("_keys", keys);
      result.set("_values", values);
      return result;
    }

    case SASS_NULL: {
      return val::null();
    }

    case SASS_ERROR: {
      val result = val::object();
      result.set("_type", "error");
      result.set("_message", sass_error_get_message(value));
      return result;
    }

    case SASS_WARNING: {
      val result = val::object();
      result.set("_type", "warning");
      result.set("_message", sass_warning_get_message(value));
      return result;
    }

    default: {
      val result = val::object();
      result.set("_type", "error");
      result.set("_message", "Unsupported Sass_Value type");
      return result;
    }
  }
}

static Sass_Value* jsToCpp(val value) {
  if (value.isNull() || value.isUndefined()) return sass_make_null();

  val errorVal = value["__error"];
  if (!errorVal.isUndefined() && !errorVal.isNull()) {
    if (!errorVal.isString()) throw ConversionError("Error message is not a string");
    return sass_make_error(errorVal.as<string>().c_str());
  }

  val typeVal = value["_type"];
  if (!typeVal.isString()) {
    if (value.isNumber()) throw ConversionError("Found a raw JavaScript number instead of types.Number");
    if (value.isString()) throw ConversionError("Found a raw JavaScript string instead of types.String");
    if (value.isArray()) throw ConversionError("Found a raw JavaScript array instead of types.List");
    if (value.isTrue() || value.isFalse()) throw ConversionError("Found a raw JavaScript boolean instead of types.Boolean");
    throw ConversionError("Found a raw JavaScript value instead of an instance of a sass type");
  }

  string type = typeVal.as<string>();

  auto readString = [&](string what) {
    val field = value[what];
    if (!field.isString()) throw ConversionError(type + "." + what + " is missing or not a string");
    return field.as<string>();
  };
  auto readBool = [&](string what) {
    val field = value[what];
    if (!field.isTrue() && !field.isFalse()) throw ConversionError(type + "." + what + " is missing or not a bool");
    return field.as<bool>();
  };
  auto readNumber = [&](string what) {
    val field = value[what];
    if (!field.isNumber()) throw ConversionError(type + "." + what + " is missing or not a number");
    return field.as<double>();
  };
  auto readArray = [&](string what) {
    val field = value[what];
    if (!field.isArray()) throw ConversionError(type + "." + what + " is missing or not an array");
    return field;
  };

  if (type == "boolean") {
    return sass_make_boolean(readBool("_value"));
  } else if (type == "number") {
    return sass_make_number(readNumber("_value"), readString("_unit").c_str());
  } else if (type == "color") {
    return sass_make_color(readNumber("_r"), readNumber("_g"), readNumber("_b"), readNumber("_a"));
  } else if (type == "string") {
    return readBool("_quoted") ? sass_make_qstring(readString("_value").c_str()) : sass_make_string(readString("_value").c_str());
  } else if (type == "list") {
    val values = readArray("_values");
    int length = values["length"].as<int>();
    Sass_Value* result = sass_make_list(length, readBool("_separator") ? SASS_COMMA : SASS_SPACE, readBool("_isBracketed"));
    try {
      for (int i = 0; i < length; i++) {
        sass_list_set_value(result, i, jsToCpp(values[i]));
      }
    } catch (ConversionError&) {
      sass_delete_value(result);
      throw;
    }
    return result;
  } else if (type == "map") {
    val keys = readArray("_keys");
    val values = readArray("_values");
    int length = values["length"].as<int>();
    Sass_Value* result = sass_make_map(length);
    try {
      for (int i = 0; i < length; i++) {
        sass_map_set_key(result, i, jsToCpp(keys[i]));
        sass_map_set_value(result, i, jsToCpp(values[i]));
      }
    } catch (ConversionError&) {
      sass_delete_value(result);
      throw;
    }
    return result;
  } else if (type == "error") {
    return sass_make_error(readString("_message").c_str());
  } else if (type == "warning") {
    return sass_make_warning(readString("_message").c_str());
  } else {
    throw ConversionError("Unrecognized value of _type");
  }
}

Sass_Value* runFunction(const Sass_Value* s_args, Sass_Function_Entry cb, Sass_Compiler* comp) {
  FunctionData* functionData = static_cast<FunctionData*>(sass_function_get_cookie(cb));
  val externalHelper = functionData->externalHelper;
  int index = functionData->index;

  val helperInput = val::object();
  helperInput.set("type", "function");
  helperInput.set("index", index);
  helperInput.set("args", cppToJs(s_args));

  val helperOutput = externalHelper(helperInput);

  val helperOutputDecoded = val::global("JSON").call<val>("parse", helperOutput);
  Sass_Value* result;
  try {
    result = jsToCpp(helperOutputDecoded);
  } catch (ConversionError& e) {
    result = sass_make_error((string("Internal error deserializing sass value: ") + e.what()).c_str());
  }
  return result;
}

}  // namespace node_sass
