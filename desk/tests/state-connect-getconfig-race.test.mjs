/* Prova — o catch do voo de connect não escreve em `S` depois de ficar stale
   durante o `await getConfig()` (achado 1 da revisão connect-parar): o voo A
   falha e fica preso no getConfig; um voo B (save-config/relink ou 2º Chamar
   na mesma sessão) liga a sessão; quando o getConfig tardio de A responde, ele
   não pode derrubar o voo B já online. Rodar: node --test --test-force-exit
   tests/state-connect-getconfig-race.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';
import {fakeTutorDesk} from './fake-desk-tutor.mjs';

const {window} = installDom();
const state = await import('../src/state.mjs');
const {S, connect, invalidateConnect} = state;
const desk = fakeTutorDesk(window);
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

function primeState(session) {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = session;
  S.engine = 'opencode';
  S.link = {state: '', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
}

test('getConfig tardio do voo A não derruba a sessão B ligada depois de invalidar', async () => {
  primeState('/A.jsonl');
  const flightA = desk.flights.length;
  const configA = desk.configs.length;
  const a = connect();
  a.catch(() => {});
  await tick();
  assert.equal(desk.flights.length, flightA + 1, 'o connect de A partiu');
  desk.flights[flightA].reject(Error('connect A falhou'));
  await tick(20);
  assert.equal(desk.configs.length, configA + 1, 'o catch de A consultou o getConfig');
  /* Save-config/relink: o voo corrente é invalidado e um voo novo liga. */
  invalidateConnect();
  const b = connect();
  b.catch(() => {});
  await tick();
  assert.equal(desk.flights.length, flightA + 2, 'o connect de B abriu um voo novo');
  desk.flights[flightA + 1].resolve({engine: 'opencode', models: [], session: '/B.jsonl'});
  await b;
  assert.equal(S.connected, true);
  assert.equal(S.link.state, 'online');
  /* O getConfig de A só agora responde — e o voo A já não é o corrente. */
  desk.configs[configA].resolve({engine: 'opencode', models: []});
  await a.catch(() => {});
  await tick();
  assert.equal(S.connected, true, 'o voo velho não derruba a sessão nova');
  assert.equal(S.link.state, 'online', 'o voo velho não pinta erro por cima do voo novo');
});

test('dois Chamar na mesma sessão: o getConfig do 1º voo não derruba o 2º', async () => {
  primeState('/A2.jsonl');
  const flightA = desk.flights.length;
  const configA = desk.configs.length;
  const a = connect();
  a.catch(() => {});
  await tick();
  assert.equal(desk.flights.length, flightA + 1, 'o connect de A partiu');
  desk.flights[flightA].reject(Error('falha A'));
  await tick(20);
  /* 2º Chamar na mesma sessão: o voo novo liga em fundo e o chamador fica
     com o voo antigo (#r5-D). */
  const b = connect();
  b.catch(() => {});
  await tick();
  assert.equal(desk.flights.length, flightA + 2, 'o 2º Chamar abriu voo novo em fundo');
  desk.flights[flightA + 1].resolve({engine: 'opencode', models: [], session: '/A2.jsonl'});
  await tick();
  assert.equal(S.connected, true, 'o 2º voo ligou a sessão');
  desk.configs[configA].resolve({engine: 'opencode', models: []});
  await Promise.allSettled([a, b]);
  await tick();
  assert.equal(S.connected, true, 'o getConfig do 1º voo não derruba o 2º');
  assert.equal(S.link.state, 'online', 'a sessão segue ligada');
});
