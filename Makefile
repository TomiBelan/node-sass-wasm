# Copyright 2019 Google LLC
#
# Use of this source code is governed by an MIT-style
# license that can be found in the LICENSE file or at
# https://opensource.org/licenses/MIT.

all: dist/binding.js dist/version.js

LIBSASS_VERSION = 3.5.5
# It also works with 3.6.0 but sass-spec isn't compatible with 3.6.0 yet.

CXXFLAGS = -Wall -O2 -std=c++17 -I libsass/include $(EXTRA_CXXFLAGS)

EMCC_OPTIONS = \
	-s ENVIRONMENT=node \
	-s NODERAWFS=1 \
	-s DISABLE_EXCEPTION_CATCHING=0 \
	-s NODEJS_CATCH_EXIT=0 \
	-s WASM_ASYNC_COMPILATION=0 \
	-s ALLOW_MEMORY_GROWTH=1 \
	--bind \
	--js-library src/workaround8806.js
# `--js-library workaround8806.js` must be AFTER `--bind` to override it!

#EMCC_OPTIONS += -s DYNAMIC_EXECUTION=0 --profiling
#EMCC_OPTIONS += --closure 1

BINDING_SOURCES = dist/entrypoint.o dist/functions.o dist/importers.o libsass/lib/libsass.a

dist/binding.js: $(BINDING_SOURCES) src/workaround8806.js Makefile
	emcc -O2 -o $@ $(BINDING_SOURCES) $(EMCC_OPTIONS)

dist/version.js: dist/binding.js dist/binding.wasm
	node -e 'console.log("exports.libsass = %j;", require("./dist/binding").sassVersion())' > $@

dist/%.o: src/%.cpp | dist libsass
	$(CXX) $(CXXFLAGS) -c -o $@ $<

dist/entrypoint.o: src/functions.h src/importers.h
dist/functions.o: src/functions.h
dist/importers.o: src/importers.h

libsass/lib/libsass.a: libsass
	$(MAKE) -C libsass lib/libsass.a

libsass:
	git -c advice.detachedHead=false clone https://github.com/sass/libsass -b $(LIBSASS_VERSION)

dist:
	mkdir dist

clean:
	-rm -rf dist
	[ -d libsass ] && $(MAKE) -C libsass clean

veryclean:
	-rm -rf dist libsass

.PHONY: all clean veryclean
.DELETE_ON_ERROR:
