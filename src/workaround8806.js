// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

// Workaround for https://github.com/emscripten-core/emscripten/issues/8806

if (!LibraryManager.library['$getStringOrSymbol']) {
  throw Error("emval.js didn't run yet");
}

mergeInto(LibraryManager.library, {
  $getStringOrSymbol__deps: ['$emval_symbols'],
  $getStringOrSymbol: function(address) {
    var symbol = emval_symbols[address];
    if (symbol === undefined) {
      return UTF8ToString(address);
    } else {
      return symbol;
    }
  },
});
