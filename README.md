# node-sass-wasm

This is an experimental proof-of-concept rewrite of
[node-sass](https://github.com/sass/node-sass) using WebAssembly. Just like
node-sass, it allows you to compile .sass and .scss to CSS. It is fully
compatible with the node-sass API, including support for importers and custom
functions. Thanks to WebAssembly, it has zero dependencies, it doesn't need to
be updated when a new version of node.js is released, and it might theoretically
run on more platforms than node-sass. However, it requires **node.js >=
10.5.0**, see below.

## Usage

The package is not published on npm yet. Please download it from GitHub for now
if you want to try it.

```bash
npm install git+https://github.com/TomiBelan/node-sass-wasm#built/master
# or
yarn add git+https://github.com/TomiBelan/node-sass-wasm#built/master
```

```js
const sass = require('node-sass-wasm');
sass.render(...);
```

To use it with webpack and sass-loader, add the `implementation` option:

```js
{
  loader: 'sass-loader',
  options: {
    implementation: require('node-sass-wasm'),
    ...
  }
}
```

Or you can install it as a package alias, allowing code that calls
`require('node-sass')` to keep working:

```bash
npm --version  # must be at least 6.9.0
npm install node-sass@git+https://github.com/TomiBelan/node-sass-wasm#built/master
# or
yarn add node-sass@git+https://github.com/TomiBelan/node-sass-wasm#built/master
```

## Building

- Install the
  [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
- Activate the SDK (add it to \$PATH): `source ./emsdk_env.sh`
- Clone the node-sass-wasm Git repository
- Run `emmake make`
- Run `npm pack .`

## Caveats

- node-sass-wasm relies on the
  [worker_threads](https://nodejs.org/api/worker_threads.html) module, which is
  experimental and may break.
- Because of the above, node-sass-wasm only works in **node.js >= 10.5.0**.
  Plus, in **node.js < 11.7.0** you must also enable the flag
  `--experimental-worker`, perhaps in an environment variable as
  `export NODE_OPTIONS=--experimental-worker`.
- Loading the wasm module takes a while (around 0.9s on my system). It is loaded
  lazily on the first call to `render` or `renderSync`.
- `render` calls run serially, waiting in a queue. One call cannot begin until
  the previous call finishes. It is important not to get stuck in an
  asynchronous importer or custom function that never calls `done`.
- node-sass-wasm might be stricter than node-sass about validating the types of
  the options passed to `render` and `renderSync`.
- node-sass-wasm doesn't provide a CLI binary. I think that belongs in a
  separate package anyway.

## Contributing

Sorry, I'm not accepting pull requests at the moment.

## Status

The project is feature-complete and implements the full API of node-sass 4.12.0.
But it is still just an experimental prototype and I can't guarantee I'll keep
updating it over the long term -- nothing is preventing it, but it's too early
to tell. Please keep that in mind if you decide to depend on it.

## Disclaimer

My employer wanted me to write this disclaimer:

This is not an official Google product.
