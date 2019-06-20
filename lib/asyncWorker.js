// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

const { workerData, parentPort } = require('worker_threads');
const { TextDecoder } = require('util');
const binding = require('../dist/binding');

const { sab, BUFFER_SIZE } = workerData;
const lockArray = new Int32Array(sab, 0, 1);
const responseArray = new Uint8Array(sab, 4, BUFFER_SIZE);

function sendAndWait(port, message) {
  Atomics.store(lockArray, 0, 0);
  port.postMessage(message);
  while (Atomics.load(lockArray, 0) == 0) {
    Atomics.wait(lockArray, 0, 1);
  }
}

parentPort.on('message', function({ payload, port }) {
  function callHelper(helperInput) {
    sendAndWait(port, { type: 'callHelper', helperInput });
    const outputLength = Atomics.load(lockArray, 0);
    const encodedHelperOutput = new Uint8Array(outputLength);
    for (let offset = 0; offset < outputLength; offset += BUFFER_SIZE) {
      if (offset > 0) {
        sendAndWait(port, { type: 'chunk', offset });
      }
      const chunkSize = Math.min(BUFFER_SIZE, outputLength - offset);
      encodedHelperOutput.set(responseArray.subarray(0, chunkSize), offset);
    }
    return new TextDecoder().decode(encodedHelperOutput);
  }

  const result = binding.sassRender(payload, callHelper);
  port.postMessage({ type: 'result', result });
});
