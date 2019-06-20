// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

fs = require('fs');

if (!process.argv[2] || !process.argv[3]) throw Error('Usage: patchtest.js input.js output.js');

content = fs.readFileSync(process.argv[2], 'utf8');
old = content;

content = content.replace("path = require('path'),", "path = require('path'),\n  util = require('util'),");
content = content.replace("sass = require(sassPath),", "sass = require(sassPath),\n  render = util.promisify(sass.render),");

content = content.replace(/describe/,
`function catchError(promise) {
  return promise.then(
      function (success) { throw Error("Unexpected success: " + util.inspect(success)); },
      function (error) { return error; });
}

describe`)

content = content.replace("function(err, data) {\n        assert.equal(err, null);\n", "function(error, result) {");
content = content.replace("data.css", "result.css");

content = content.replace("      sass.render({ }, function(error) {", "      sass.render({\n      }, function(error) {");

content = content.replace(/\n\n+( +done\(\);)/g, "\n$1");

content = content.replace(
  /\n      sass\.render\((options|\{\n(?:\n|        .*\n)*      \}), function\(\) \{\n(        .*this\..*\n)        done\(\);\n      \}\);\n/g,
  function (match, g1, g2) {
    return `
      var thisObject = await new Promise((resolve, reject) => sass.render(${g1}, function(error, result) {
        if (error) reject(error);
        else resolve(this);
      }));
` + g2.replace(/^  /gm, '').replace(/\bthis\b/g, 'thisObject');
  });

content = content.replace(
  /\n      sass\.render\((options|\{\n(?:\n|        .*\n)*      \}), function\(\) \{\n((?:\n|        .*\n)*?)(?:        done\(\);\n)?      \}\);\n/g,
  function (match, g1, g2) {
    return '\n      await render(' + g1 + ');\n' + g2.replace(/^  /gm, '');
  });

content = content.replace(
  /\n      sass\.render\((options|\{\n(?:\n|        .*\n)*      \}), function\(errr?or, result\) \{\n((?:\n|        .*\n)*)        done\(\);\n      \}\);\n/g,
  function (match, g1, g2) {
    g2 = g2.replace(/^        assert\(\!error\);\n/gm, '');
    if (/error/.test(g2)) throw Error(g2);
    return '\n      var result = await render(' + g1 + ');\n' + g2.replace(/^  /gm, '');
  });

content = content.replace(
  /\n      sass\.render\((options|\{\n(?:\n|        .*\n)*      \}), function\(error\) \{\n((?:\n|        .*\n)*)        done\(\);\n      \}\);\n/g,
  function (match, g1, g2) {
    return '\n      var error = await catchError(render(' + g1 + '));\n' + g2.replace(/^  /gm, '');
  });

content = content.replace(
  /\n        sass\.render\((options|\{\n(?:\n|          .*\n)*        \}), function\(error\) \{\n((?:\n|          .*\n)*)          done\(\);\n        \}\);\n/g,
  function (match, g1, g2) {
    return '\n        var error = await catchError(render(' + g1 + '));\n' + g2.replace(/^  /gm, '');
  });

content = content.replace(
  /\n      sass\.render\((options|\{\n(?:\n|        .*\n)*      \}), function\(error, result\) \{\n(.*expectedRed.*\n)      \}\);\n/g,
  function (match, g1, g2) {
    g2 = g2.replace(/^        assert\(\!error\);\n/gm, '');
    if (/error/.test(g2)) throw Error(g2);
    return '\n      var result = await render(' + g1 + ');\n' + g2.replace(/^  /gm, '');
  });

content = content.replace(
  /(\n    it\(.*, )function *\(done\) \{\n((?:\n|      .*\n)*)      done\(\);\n    \}\);\n/g,
  function (match, g1, g2) {
    if (/await/.test(g2)) return g1 + 'async function() {\n' + g2 + '    });\n';
    return g1 + 'function() {\n' + g2 + '    });\n';
  });

content = content.replace(
  /(\n    it\(.*, )function *\(done\) \{\n((?:\n|      .*\n)*)    \}\);\n/g,
  function (match, g1, g2) {
    if (/await/.test(g2)) return g1 + 'async function() {\n' + g2 + '    });\n';
    return match;
  });

content = content.replace(
  /(\n      it\(.*, )function *\(done\) \{\n((?:\n|        .*\n)*)      \}\);\n/g,
  function (match, g1, g2) {
    if (/await/.test(g2)) return g1 + 'async function() {\n' + g2 + '    });\n';
    return match;
  });

content = content.replace("render({\n      })", "render({})");

content = content.replace(/returned value of `contents` must be a string/g, "result.contents must be a string if it's set");
content = content.replace(/A SassValue object was expected/g, "Found a raw JavaScript value instead of an instance of a sass type");
content = content.replace(/Expected one boolean argument/g, "value must be a boolean");
content = content.replace(/Supplied value should be a string/g, "unit must be a string");
content = content.replace(/Supplied value should be a SassValue object/g, "value must be a sass type");
content = content.replace(/A SassValue is expected as the list item/g, "value must be a sass type");
content = content.replace(/A SassValue is expected as a map key/g, "value must be a sass type");
content = content.replace(/A SassValue is expected as a map value/g, "value must be a sass type");
content = content.replace(/Constructor arguments should be numbers exclusively/g, "r must be a number");
content = content.replace(/Constructor should be invoked with either 0, 1, 3 or 4 arguments/g, "Color should be constructed with 0, 1, 3 or 4 arguments");
content = content.replace(/Only argument should be an integer/g, "argb must be a number");

var count = 0;
content = content.replace(/No input specified: provide a file name or a source string to process/g,
  () => (++count % 2) ? 'Data context created with empty source string' : 'At least one of options.data or options.file must be set');

fs.writeFileSync(process.argv[3], content, 'utf8');
