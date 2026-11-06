/* Prova — o relink do main derruba a ponte de QUALQUER motor
   (`tutor-relink.cjs`): os ramos que invalidam o voo precisam religar a
   sessão corrente, não só no OpenCode. Com uma sessão Claude conectando, o
   ramo que só religa no OpenCode deixa a UI presa em "conectando"
   (`S.connecting` nulo, `S.link.state` 'connecting') ou num "online" falso
   (achado 2 da revisão connect-parar). Rodar: node --test --test-force-exit
   tests/relink-reconnect.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';
import {fakeTutorDesk} from './fake-desk-tutor.mjs';

const {window, elFor} = installDom();
const state = await import('../src/state.mjs');
const {S, connect} = state;
const {startWithKey} = await import('../src/free-models.mjs');
const {initOpenCodeProviders} = await import('../src/opencode-providers.mjs');
const desk = fakeTutorDesk(window);
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

function primeState(session) {
  S.connected = false;
  S.connectCancelled = false;
  S.currentSession = session;
  S.engine = 'claude';
  S.link = {state: '', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
}

test('startWithKey com relink religa a sessão Claude em vez de ficar presa em conectando', async () => {
  primeState('/A.jsonl');
  const flightA = desk.flights.length;
  const a = connect();
  a.catch(() => {});
  await tick();
  assert.equal(desk.flights.length, flightA + 1, 'a sessão Claude está conectando');
  assert.equal(S.link.state, 'connecting');
  /* Chave aprovada com a sessão Claude conectando: o main parou a ponte. */
  const sentence = await startWithKey({relink: {relinked: true}});
  assert.ok(sentence, 'o fluxo fecha com a frase final');
  await tick();
  assert.equal(desk.flights.length, flightA + 2, 'o religar parte para o motor da sessão corrente');
  assert.ok(S.connecting, 'um voo novo está em voo (a UI não fica em conectando sem voo)');
  desk.flights[flightA + 1].resolve({engine: 'claude', models: [], session: '/A.jsonl'});
  await tick();
  assert.equal(S.connected, true);
  assert.equal(S.link.state, 'online');
  desk.flights[flightA].reject(Error('Chamada ao tutor cancelada'));
  await a.catch(() => {});
  await tick();
  assert.equal(S.connected, true, 'o voo antigo assentando não derruba a sessão religada');
  assert.equal(S.link.state, 'online');
});

test('login de provedor com relink religa a sessão Claude (painel OpenCode)', async () => {
  primeState('/C.jsonl');
  const flightA = desk.flights.length;
  const a = connect();
  a.catch(() => {});
  await tick();
  assert.equal(desk.flights.length, flightA + 1, 'a sessão Claude está conectando');
  /* O painel é dirigido pelos próprios handlers de clique/teclado: a lista de
     provedores e a entrada da chave seguem o caminho real do `#login`. */
  const root = elFor('#setup-providers');
  const listeners = {};
  const add = root.addEventListener.bind(root);
  root.addEventListener = (type, handler) => { listeners[type] = handler; add(type, handler); };
  root.querySelector = (selector) => elFor(selector);
  initOpenCodeProviders();
  elFor('[data-role="key-input"]').value = 'sk-teste';
  window.desk.opencodeProviderLoginStart = async () => ({ok: true, kind: 'complete', busy: false, relinked: true});
  const button = {dataset: {action: 'key', provider: 'prov'}};
  button.closest = () => button;
  listeners.click({target: button, preventDefault() {}});
  listeners.keydown({key: 'Enter', target: {dataset: {role: 'key-input'}}, preventDefault() {}, stopPropagation() {}});
  await tick(30);
  assert.equal(desk.flights.length, flightA + 2, 'o religar parte para o motor da sessão corrente');
  assert.ok(S.connecting, 'um voo novo está em voo (a UI não fica em conectando sem voo)');
  desk.flights[flightA + 1].resolve({engine: 'claude', models: [], session: '/C.jsonl'});
  await tick();
  assert.equal(S.connected, true);
  assert.equal(S.link.state, 'online');
  desk.flights[flightA].reject(Error('Chamada ao tutor cancelada'));
  await a.catch(() => {});
  await tick();
  assert.equal(S.connected, true, 'o voo antigo assentando não derruba a sessão religada');
  assert.equal(S.link.state, 'online');
});
