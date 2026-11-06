/* Review r5-D (renderer): o pi-connect de A que RESOLVE depois da navegação
   aplica os dados de A na sessão B (S.engine, S.connected, histórico). Só a
   reutilização do voo é comparada por sessão; o resultado não tem geração.
   Rodar de /tmp/mesa-review-pc: node --test --test-force-exit state-connect-stale-result.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

const {window} = installDom();
const state = await import('../src/state.mjs');
const {S, connect} = state;
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('resultado tardio do connect de A não troca o motor da sessão B', async () => {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = '/A.jsonl';
  S.engine = 'opencode';
  S.link = {state: '', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
  let resolveA;
  let resolveB;
  const calls = [];
  window.desk.connect = () => {
    const index = calls.length;
    calls.push(index);
    return new Promise((resolve) => { if (index === 0) resolveA = resolve; else resolveB = resolve; });
  };
  window.desk.getConfig = async () => ({engine: 'opencode', models: []});
  const a = connect();
  await tick();
  S.currentSession = '/B.jsonl';
  S.engine = 'opencode';
  const b = connect();
  await tick();
  resolveB({engine: 'opencode', models: [], session: '/B.jsonl'});
  await b;
  assert.equal(S.engine, 'opencode');
  /* O reply de A chega depois (ex.: IPC em voo quando a troca aconteceu). */
  resolveA({engine: 'claude', models: [{provider: 'anthropic', id: 'x', name: 'X'}], session: '/A.jsonl'});
  await a;
  await tick();
  assert.equal(S.engine, 'opencode', 'o conector de A não pode trocar o motor da sessão B');
  assert.equal(S.connected, true);
});
