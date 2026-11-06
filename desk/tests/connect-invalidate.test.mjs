/* Prova — quem para a ponte invalida o voo corrente (#r5-D): save-config, troca
   de matéria/sessão e relink chamam `invalidateConnect()` antes de religar. O
   resultado tardio do voo antigo não escreve, e o `connect()` seguinte abre um
   voo novo mesmo na mesma sessão.
   Rodar: node --test desk/tests/connect-invalidate.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

const {window} = installDom();
const state = await import('../src/state.mjs');
const {S, connect, invalidateConnect} = state;
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('invalidate solta o voo: resultado tardio não escreve e o próximo connect é novo', async () => {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = '/A.jsonl';
  S.engine = 'opencode';
  S.link = {state: '', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
  let resolveOld;
  let resolveFresh;
  const calls = [];
  window.desk.connect = () => {
    const index = calls.length;
    calls.push(index);
    return new Promise((resolve) => { if (index === 0) resolveOld = resolve; else resolveFresh = resolve; });
  };
  window.desk.getConfig = async () => ({engine: 'opencode', models: []});
  const old = connect();
  await tick();
  assert.equal(calls.length, 1, 'o primeiro connect partiu');
  /* Save-config/relink: a ponte caiu; o renderer invalida antes de religar. */
  invalidateConnect();
  assert.equal(S.connecting, null, 'a referência pendente sai de S');
  resolveOld({engine: 'claude', models: [], session: '/A.jsonl'});
  await old;
  await tick();
  assert.equal(S.engine, 'opencode', 'o voo invalidado não troca o motor');
  assert.equal(S.connected, false, 'o voo invalidado não liga sozinho');
  const fresh = connect();
  await tick();
  assert.equal(calls.length, 2, 'o connect depois de invalidar abre um voo novo na mesma sessão');
  resolveFresh({engine: 'opencode', models: [], session: '/A.jsonl'});
  await fresh;
  assert.equal(S.connected, true, 'o voo novo liga a sessão');
  assert.equal(S.link.state, 'online');
});
