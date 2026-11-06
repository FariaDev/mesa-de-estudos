/* Review r5-D (renderer): o connect antigo de A não pode limpar nem derrubar o
   connect novo de B. `S.connecting`/`S.connectingSession` são de B depois que a
   navegação troca a sessão; o finally do connect de A é incondicional.
   Rodar de /tmp/mesa-review-pc: node --test --test-force-exit state-connect-race.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

const {window} = installDom();
const state = await import('../src/state.mjs');
const {S, connect} = state;
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('connect antigo de A não limpa o connect pendente de B nem pinta B como erro', async () => {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = '/A.jsonl';
  S.link = {state: '', label: '', reason: ''};
  let rejectA;
  let resolveB;
  const calls = [];
  window.desk.connect = (identity) => {
    const call = {identity};
    calls.push(call);
    call.promise = new Promise((resolve, reject) => {
      if (calls.length === 1) rejectA = reject; else resolveB = resolve;
    });
    return call.promise;
  };
  window.desk.getConfig = async () => ({engine: 'opencode', models: []});
  const a = connect();
  await tick();
  assert.equal(calls.length, 1, 'o connect de A partiu');
  const connectA = S.connecting;
  assert.equal(S.connectingSession, '/A.jsonl');
  /* Navegação real (switchCourse/loadCourse): a sessão corrente vira B antes
     de o renderer pedir o connect de B. */
  S.currentSession = '/B.jsonl';
  const b = connect();
  await tick();
  assert.equal(calls.length, 2, 'a sessão nova tem connect próprio');
  const connectB = S.connecting;
  assert.notEqual(S.connecting, connectA, 'S.connecting é o connect de B');
  assert.equal(S.connectingSession, '/B.jsonl');
  /* O pi-connect de A só agora descobre a troca e rejeita "cancelado". */
  rejectA(Error('Chamada ao tutor cancelada'));
  await a.catch(() => {});
  await tick();
  assert.equal(S.connectingSession, '/B.jsonl', 'o finally de A não pode apagar a sessão que está ligando');
  assert.equal(S.connecting, connectB, 'o finally de A não trocou o voo de B em S.connecting');
  assert.ok(S.connecting, 'o connect de B ainda está em voo e S.connecting não pode ficar nulo');
  assert.notEqual(S.link.state, 'error', 'A cancelada por navegação não é falha da sessão B');
  resolveB({engine: 'opencode', models: [], session: '/B.jsonl'});
  await b;
  assert.equal(S.connected, true);
  assert.equal(S.link.state, 'online');
});

test('erro tardio do connect de A não derruba a sessão B já online', async () => {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = '/A2.jsonl';
  S.link = {state: '', label: '', reason: ''};
  let rejectA;
  let resolveB;
  const calls = [];
  window.desk.connect = () => {
    calls.push(true);
    return new Promise((resolve, reject) => {
      if (calls.length === 1) rejectA = reject; else resolveB = resolve;
    });
  };
  window.desk.getConfig = async () => ({engine: 'opencode', models: []});
  const a = connect();
  await tick();
  S.currentSession = '/B2.jsonl';
  const b = connect();
  await tick();
  resolveB({engine: 'opencode', models: [], session: '/B2.jsonl'});
  await b;
  assert.equal(S.connected, true);
  assert.equal(S.link.state, 'online');
  rejectA(Error('Chamada ao tutor cancelada'));
  await a.catch(() => {});
  await tick();
  assert.equal(S.connected, true, 'sessão B continua ligada');
  assert.equal(S.link.state, 'online', 'erro do connect de A não pinta B como falha');
});
