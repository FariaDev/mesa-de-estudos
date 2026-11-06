/* `captureWithRetry` (#95): a captura é idempotente e tenta de novo no erro
   transitório do compositor, mas não dorme depois da última tentativa. O
   `setTimeout` é contado (e acelerado) no teste: rápido e determinístico. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {captureWithRetry} = require('../figure-preview.cjs');

/* Conta os `sleep` sem esperar: o atraso real vira 0 ms. */
async function withCountedSleep(run) {
  const delays = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...rest) => { delays.push(ms); return realSetTimeout(fn, 0, ...rest); };
  try { return {result: await run(), delays}; }
  finally { globalThis.setTimeout = realSetTimeout; }
}

test('cinco tentativas, quatro pausas: nada depois da última (#95)', async () => {
  let attempts = 0;
  const contents = {capturePage: async () => { attempts += 1; throw Error('UnknownVizError: CopyFromSurface'); }};
  const {delays} = await withCountedSleep(() => assert.rejects(
    captureWithRetry(contents, {x: 0, y: 0, width: 10, height: 10}), /UnknownVizError/));
  assert.equal(attempts, 5);
  assert.deepEqual(delays, [100, 200, 300, 400]);
});

test('erro transitório no meio tenta de novo e devolve a captura', async () => {
  let attempts = 0;
  const contents = {capturePage: async () => {
    attempts += 1;
    if (attempts < 3) throw Error('viz_main: sem superfície');
    return 'png-falso';
  }};
  const {result, delays} = await withCountedSleep(() => captureWithRetry(contents, {x: 0, y: 0, width: 10, height: 10}));
  assert.equal(result, 'png-falso');
  assert.deepEqual(delays, [100, 200]);
});

test('erro que não é transitório sai na hora, sem dormir', async () => {
  const contents = {capturePage: async () => { throw Error('permissão negada'); }};
  const {delays} = await withCountedSleep(() => assert.rejects(
    captureWithRetry(contents, {x: 0, y: 0, width: 10, height: 10}), /permissão negada/));
  assert.deepEqual(delays, []);
});
