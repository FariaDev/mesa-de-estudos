/* O religar da ponte parada: sem ponte não faz nada, resposta em curso não é
   interrompida e, ocioso, grava e derruba para o próximo connect nascer com o
   que mudou (chave, conta de provedor, idioma). Fakes nomeados, sem Electron. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createTutorRelink} = require('../tutor-relink.cjs');

function harness({hasBridge = true, busy = false} = {}) {
  const calls = [];
  const relink = createTutorRelink({
    bridge: () => (hasBridge ? {adapter: {}} : null),
    toolHost: () => ({isBusy: async () => busy}),
    persist: () => calls.push('persist'),
    stopBridge: () => calls.push('stop'),
  });
  return {relink, calls};
}

test('sem ponte não há o que religar', async () => {
  const {relink, calls} = harness({hasBridge: false});
  assert.deepEqual(await relink(), {relinked: false});
  assert.deepEqual(calls, []);
});

test('resposta em curso não derruba a ponte', async () => {
  const {relink, calls} = harness({busy: true});
  assert.deepEqual(await relink(), {relinked: false, busy: true});
  assert.deepEqual(calls, []);
});

test('ocioso grava e derruba a ponte para o próximo connect', async () => {
  const {relink, calls} = harness();
  assert.deepEqual(await relink(), {relinked: true});
  assert.deepEqual(calls, ['persist', 'stop']);
});
