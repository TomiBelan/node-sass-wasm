// Copyright 2019 Google LLC
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

const { Worker, MessageChannel } = require('worker_threads');
const { TextEncoder } = require('util');
const path = require('path');

const BUFFER_SIZE = 8 * 1024;

let worker = undefined;
let sab = undefined;

exports.run = function(payload, externalHelper) {
  if (!worker) {
    sab = new SharedArrayBuffer(4 + BUFFER_SIZE);
    worker = new Worker(path.join(__dirname, 'asyncWorker.js'), {
      workerData: { sab, BUFFER_SIZE },
    });
    worker.unref();
  }

  const { port1, port2 } = new MessageChannel();
  const lockArray = new Int32Array(sab, 0, 1);
  const responseArray = new Uint8Array(sab, 4, BUFFER_SIZE);
  let encodedHelperOutput = undefined;

  function sendChunk(offset) {
    responseArray.set(
      encodedHelperOutput.subarray(offset, offset + BUFFER_SIZE)
    );
    Atomics.store(lockArray, 0, encodedHelperOutput.length);
    Atomics.notify(lockArray, 0);
  }

  return new Promise((resolve, reject) => {
    port1.on('message', message => {
      if (message.type == 'result') {
        port1.close();
        resolve(message.result);
      }
      if (message.type == 'chunk') {
        sendChunk(message.offset);
      }
      if (message.type == 'callHelper') {
        externalHelper(message.helperInput).then(helperOutput => {
          encodedHelperOutput = new TextEncoder().encode(helperOutput);
          sendChunk(0);
        });
      }
    });

    worker.postMessage({ payload, port: port2 }, [port2]);
  });
};
