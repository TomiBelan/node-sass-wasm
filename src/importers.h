// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

#pragma once

#include <emscripten/val.h>
#include <sass/functions.h>

namespace node_sass {

struct ImporterData {
  ImporterData(emscripten::val externalHelper, int index) : externalHelper(externalHelper), index(index) {}
  emscripten::val externalHelper;
  int index;
};

Sass_Import_List runImporter(const char* cur_path, Sass_Importer_Entry cb, Sass_Compiler* comp);

}  // namespace node_sass
