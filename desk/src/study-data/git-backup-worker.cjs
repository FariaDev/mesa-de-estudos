'use strict';
const {parentPort, workerData} = require('node:worker_threads');
const {api} = require('./git-backup.cjs');
const {invalidValue} = require('../error-detail.mjs');
try {
  const {options, method, payload} = workerData;
  if (!['status', 'integrate', 'push', 'setRemote', 'recover'].includes(method)) throw new Error(invalidValue('operação Git', method, 'status|integrate|push|setRemote|recover'));
  const input = payload && typeof payload === 'object'
    ? {...payload, log: line => parentPort.postMessage({kind: 'log', line})} : payload;
  const result = api(options)[method](input);
  parentPort.postMessage({kind: 'result', result});
} catch (error) {
  parentPort.postMessage({kind: 'error', message: error.message, code: error.code});
}
