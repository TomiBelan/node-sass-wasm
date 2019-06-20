// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

const asyncRunner = require('./asyncRunner');
const libsassVersion = require('../dist/version').libsass;
const packageVersion = require('../package.json').version;
const path = require('path');
const types = require('./types');

function stringifyJson(obj) {
  if (obj === undefined) obj = null;
  return JSON.stringify(obj, (key, value) => {
    if (value instanceof Error) {
      return { __error: '' + (value.stack || value.message) };
    }
    return value;
  });
}

function preprocess(options) {
  const start = Date.now();

  let {
    data,
    file,
    outFile,
    sourceMap,
    sourceMapRoot,
    linefeed,
    indentWidth,
    indentType,
    outputStyle,
    precision,
    indentedSyntax,
    sourceComments,
    omitSourceMapUrl,
    sourceMapEmbed,
    sourceMapContents,
    includePaths,
  } = options;

  if (typeof file == 'string') file = path.resolve(file);

  if (typeof outFile == 'string') outFile = path.resolve(outFile);

  if (sourceMap == true) {
    if (!outFile) {
      throw Error('options.sourceMap is true but options.outFile is not set');
    }
    sourceMap = outFile + '.map';
  }
  if (typeof sourceMap == 'string') sourceMap = path.resolve(sourceMap);

  const feeds = { cr: '\r', crlf: '\r\n', lf: '\n', lfcr: '\n\r' };
  if (typeof linefeed == 'string') linefeed = feeds[linefeed] || '\n';

  let indent = undefined;
  if (indentWidth || indentType) {
    const character = indentType == 'tab' ? '\t' : ' ';
    indent = character.repeat(indentWidth || 2);
  }

  includePaths = [
    process.cwd(),
    ...(includePaths || []),
    ...(process.env.hasOwnProperty('SASS_PATH')
      ? process.env.SASS_PATH.split(path.delimiter)
      : []),
  ];

  const importers = Array.isArray(options.importer)
    ? options.importer
    : options.importer
    ? [options.importer]
    : [];
  const importersLength = importers.length;

  const functions = [];
  const functionSignatures = [];
  Object.entries(options.functions || {})
    .map(normalizeFunctionSignature)
    .forEach(([signature, callback]) => {
      functionSignatures.push(signature);
      functions.push(callback);
    });

  const processedOptions = {
    data,
    file,
    outFile,
    sourceMap,
    sourceMapRoot,
    linefeed,
    indent, // instead of indentType + indentWidth
    outputStyle,
    precision,
    indentedSyntax,
    sourceComments,
    omitSourceMapUrl,
    sourceMapEmbed,
    sourceMapContents,
    includePaths,
    importersLength, // instead of importer
    functionSignatures, // instead of functions
  };

  const thisObj = { options: processedOptions };

  return { processedOptions, start, importers, functions, thisObj };
}

function normalizeFunctionSignature([signature, callback]) {
  if (
    signature == '*' ||
    signature == '@warn' ||
    signature == '@error' ||
    signature == '@debug' ||
    /^\w+\(.*\)$/.test(signature)
  ) {
    return [signature, callback];
  } else if (/^\w+$/.test(signature)) {
    const newSignature = signature + '(...)';
    function newCallback(firstArg, ...otherArgs) {
      if (!firstArg || firstArg._type != 'list') {
        throw Error('Expected a list from libsass');
      }
      return callback.apply(this, [...firstArg._values, ...otherArgs]);
    }
    return [newSignature, newCallback];
  } else {
    throw Error('Bad function signature: ' + signature);
  }
}

function externalHelperSync(context, helperInput) {
  try {
    if (helperInput.type == 'importer') {
      const { index, file, prev } = helperInput;
      const result = context.importers[index].call(context.thisObj, file, prev);
      return stringifyJson(result);
    }
    if (helperInput.type == 'function') {
      const index = helperInput.index;
      const args = types.revive(helperInput.args);
      if (args._type != 'list') throw Error('Expected a list from libsass');
      const result = context.functions[index].apply(
        context.thisObj,
        args._values
      );
      return stringifyJson(result);
    }
    throw Error('Bad helperInput.type');
  } catch (e) {
    return stringifyJson(normalizeError(e));
  }
}

async function externalHelperAsync(context, helperInput) {
  try {
    if (helperInput.type == 'importer') {
      const { index, file, prev } = helperInput;
      const result = await callWithSyncOrAsyncResult(
        context.importers[index],
        context.thisObj,
        [file, prev]
      );
      return stringifyJson(result);
    }
    if (helperInput.type == 'function') {
      const index = helperInput.index;
      const args = types.revive(helperInput.args);
      if (args._type != 'list') throw Error('Expected a list from libsass');
      const result = await callWithSyncOrAsyncResult(
        context.functions[index],
        context.thisObj,
        args._values
      );
      return stringifyJson(result);
    }
    throw Error('Bad helperInput.type');
  } catch (e) {
    return stringifyJson(normalizeError(e));
  }
}

function callWithSyncOrAsyncResult(func, thisArg, args) {
  return new Promise((resolve, reject) => {
    function done(value) {
      if (value instanceof Error) reject(value);
      else resolve(value);
    }
    const syncResult = func.apply(thisArg, [...args, done]);
    if (syncResult !== undefined) done(syncResult);
  });
}

function normalizeError(e) {
  return e instanceof Error
    ? e
    : typeof e == 'string'
    ? Error(e)
    : Error('An unexpected error occurred');
}

function postprocess(result, { processedOptions, start }) {
  if (result.optionsError) throw Error(result.optionsError);
  if (result.error) throw Object.assign(new Error(), JSON.parse(result.error));
  const end = Date.now();
  return {
    css: Buffer.from(result.css, 'utf8'),
    map: result.map && Buffer.from(result.map, 'utf8'),
    stats: {
      start,
      end,
      duration: end - start,
      entry: processedOptions.file || 'data',
      includedFiles: result.includedFiles,
    },
  };
}

exports.renderSync = function(options) {
  const binding = require('../dist/binding');
  const context = preprocess(options);
  const result = binding.sassRender(
    context.processedOptions,
    externalHelperSync.bind(null, context)
  );
  return postprocess(result, context);
};

exports.render = function(options, callback) {
  const context = preprocess(options);
  asyncRunner
    .run(context.processedOptions, externalHelperAsync.bind(null, context))
    .then(result => postprocess(result, context))
    .then(
      result => callback.call(context.thisObj, null, result),
      error => callback.call(context.thisObj, error)
    );
};

// Lie about the version because sass-loader wants node-sass ^4.0.0.
const emulatedVersion = '4.12.0';

exports.info =
  `node-sass\t${emulatedVersion}\t(compatible)\t[compatible]\n` +
  `libsass  \t${libsassVersion}\t(Sass Compiler)\t[C/C++]\n` +
  `node-sass-wasm\t${packageVersion}\t(Wrapper)\t[JavaScript]`;

exports.wasm = packageVersion;

exports.types = types;
exports.TRUE = types.Boolean.TRUE;
exports.FALSE = types.Boolean.FALSE;
exports.NULL = types.Null.NULL;
