/* Review r5-D (renderer): o `connect()` seguinte a um save-config/relink (que
   chama stopBridge NA MESMA sessão) reaproveita o voo antigo só porque
   S.connectingSession === S.currentSession — mas esse voo foi cancelado pelo
   main (live.bridge !== b). O connect automático do saveSettings volta a
   receber o erro do voo velho e a sessão fica offline, sem nova tentativa.
   Rodar de /tmp/mesa-review-pc: node --test --test-force-exit state-connect-same-session.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

const {window} = installDom();
const state = await import('../src/state.mjs');
const {S, connect} = state;
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('connect depois de stopBridge na mesma sessão começa um voo novo', async () => {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = '/A.jsonl';
  S.link = {state: '', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
  let rejectOld;
  let resolveFresh;
  const calls = [];
  window.desk.connect = () => {
    const index = calls.length;
    calls.push(index);
    return new Promise((resolve, reject) => {
      if (index === 0) rejectOld = reject; else resolveFresh = resolve;
    });
  };
  window.desk.getConfig = async () => ({engine: 'opencode', models: []});
  const old = connect();
  await tick();
  assert.equal(calls.length, 1);
  /* save-config/relink: o main parou a ponte e o pi-connect antigo vai rejeitar
     (live.bridge !== b). O renderer, ao voltar do save, chama connect() para
     religar a MESMA sessão. */
  const retry = connect();
  await tick();
  assert.equal(calls.length, 2, 'o connect automático do save precisa de um voo novo, não do cancelado');
  rejectOld(Error('Chamada ao tutor cancelada'));
  await old.catch(() => {});
  await tick();
  assert.equal(S.connected, false, 'o voo novo ainda não resolveu');
  resolveFresh?.({engine: 'opencode', models: [], session: '/A.jsonl'});
  await retry;
  await tick();
  assert.equal(S.connected, true, 'a sessão devia ter religado sozinha depois do save');
  assert.equal(S.link.state, 'online');
});
