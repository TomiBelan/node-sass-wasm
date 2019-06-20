#!/bin/bash
# Copyright 2019 Google LLC
#
# Use of this source code is governed by an MIT-style
# license that can be found in the LICENSE file or at
# https://opensource.org/licenses/MIT.

set -e

npm install

if ! [ -d test ]; then
  dir=$(mktemp -d)
  git clone https://github.com/sass/node-sass "$dir/node-sass"
  cp -r "$dir/node-sass/test" .
fi

node patchtest.js test/api.js test/api.patched.js

sed -r '
  s/function\(error, result\) \{/& try {/
  s/done\(\);/& } catch (err) { done(err); }/
' test/spec.js > test/spec.patched.js

node_modules/.bin/mocha ${RUN_TESTS:-test/api.patched.js test/spec.patched.js}
