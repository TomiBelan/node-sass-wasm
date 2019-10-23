# Copyright 2019 Google LLC
#
# Use of this source code is governed by an MIT-style
# license that can be found in the LICENSE file or at
# https://opensource.org/licenses/MIT.

all: dist/binding.js dist/version.js

LIBSASS_VERSION ?= 3.5.5
# It also works with 3.6.0 but sass-spec isn't compatible with 3.6.0 yet.

LIBSASS_DIRECTORY ?= libsass

CXXFLAGS = -Wall -O3 -std=c++17 -I $(LIBSASS_DIRECTORY)/include $(EXTRA_CXXFLAGS)

EMCC_OPTIONS = \
	--js-opts 2 \
	--llvm-lto 1 \
	-Wno-almost-asm \
	-s ENVIRONMENT=node \
	-s NODERAWFS=1 \
	-s ASSERTIONS=0 \
	-s STANDALONE_WASM=0 \
	-s WASM_OBJECT_FILES=0 \
	-s DISABLE_EXCEPTION_CATCHING=0 \
	-s NODEJS_CATCH_EXIT=0 \
	-s WASM_ASYNC_COMPILATION=0 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MALLOC=dlmalloc \
	--bind \
	--js-library src/workaround8806.js
# `--js-library workaround8806.js` must be AFTER `--bind` to override it!

#EMCC_OPTIONS += -s DYNAMIC_EXECUTION=0 --profiling
#EMCC_OPTIONS += --closure 1

BINDING_SOURCES = dist/entrypoint.o dist/functions.o dist/importers.o $(LIBSASS_DIRECTORY)/lib/libsass.a

# Build webassembly version with JS loader glue code
dist/binding.js: $(BINDING_SOURCES) src/workaround8806.js Makefile
	emcc -O3 -o $@ $(BINDING_SOURCES) -s WASM=1 $(EMCC_OPTIONS)

# Build a more compatible and portable pure asmjs version
dist/binding.asm.js: $(BINDING_SOURCES) src/workaround8806.js Makefile
	emcc -O3 -o $@ $(BINDING_SOURCES) -s WASM=0 $(EMCC_OPTIONS)

dist/version.js: dist/binding.js
	node -e "console.log('exports.libsass = \"' + require('./dist/binding').sassVersion() + '\"')" > $@

dist/%.o: src/%.cpp | dist libsass
	$(CXX) $(CXXFLAGS) -c -o $@ $<

dist/entrypoint.o: src/functions.h src/importers.h
dist/functions.o: src/functions.h
dist/importers.o: src/importers.h

$(LIBSASS_DIRECTORY)/lib/libsass.a: libsass
	$(MAKE) -C $(LIBSASS_DIRECTORY) lib/libsass.a

$(LIBSASS_DIRECTORY):
	git -c advice.detachedHead=false clone https://github.com/sass/libsass -b $(LIBSASS_VERSION) $(LIBSASS_DIRECTORY)

dist:
	mkdir dist

clean:
	-rm -rf dist
	[ -d $(LIBSASS_DIRECTORY) ] && $(MAKE) -C $(LIBSASS_DIRECTORY) clean

veryclean:
	-rm -rf dist libsass

.PHONY: all clean veryclean
.DELETE_ON_ERROR:
