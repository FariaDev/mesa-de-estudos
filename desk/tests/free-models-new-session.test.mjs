/* Prova — o clique em "Começar sessão OpenCode" vale mesmo com o reconnect em
   segundo plano (revisão connect Q2e). `startWithKey` religa a sessão que o
   aluno está deixando sem await; o `newSession` do botão recusava com
   `S.connecting` preenchido ("Aguarde: o tutor está sendo chamado") e o host
   recebia `newSession` 0 vezes. O clique descarta o voo de fundo: a sessão
   nova sai uma vez, sem conexão dupla (o voo descartado assentando não
   escreve).
   Rodar: node --test --test-force-exit tests/free-models-new-session.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';
import {fakeTutorDesk} from './fake-desk-tutor.mjs';

const {window, elFor} = installDom();
const state = await import('../src/state.mjs');
const {S} = state;
const {startWithKey, initFreeModels} = await import('../src/free-models.mjs');
const desk = fakeTutorDesk(window);
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

function primeState(session) {
  S.busy = false;
  S.switching = false;
  S.connected = true;
  S.connectCancelled = false;
  S.currentSession = session;
  S.engine = 'claude';
  S.link = {state: 'online', label: '', reason: ''};
  S.connecting = null;
  S.connectingSession = null;
}

test('o clique em "Começar sessão OpenCode" cria a sessão com o reconnect de fundo em voo', async () => {
  primeState('/antiga.jsonl');
  const started = [];
  window.desk.save = async () => true;
  window.desk.newSession = async (engine) => {
    started.push(engine);
    return {session: '/nova.jsonl', engine: 'opencode', capabilities: {},
      sessions: [{path: '/nova.jsonl', label: 'Sessão nova', engine: 'opencode', started: 1}]};
  };
  /* Chave aprovada com a sessão Claude aberta: o main parou a ponte e o
     renderer religa em segundo plano a sessão que o aluno vai abandonar. */
  const sentence = await startWithKey({relink: {relinked: true}});
  assert.ok(sentence, 'o fluxo fecha com a frase final');
  await tick();
  assert.equal(desk.flights.length, 1, 'o reconnect em segundo plano abriu voo');
  assert.ok(S.connecting, 'o voo de fundo pendura em S.connecting');
  initFreeModels();
  /* O clique não é aguardado inteiro: o `newSession` espera o connect da
     sessão nova, que o teste assenta depois. */
  const clicked = elFor('#free-models-start').onclick();
  await tick(30);
  assert.deepEqual(started, ['opencode'], 'o clique cria a sessão nova uma vez (o host recebe newSession 1x)');
  assert.equal(S.currentSession, '/nova.jsonl', 'a sessão nova é a corrente');
  assert.equal(desk.flights.length, 2, 'a sessão nova tem um connect só (o voo de fundo é descartado, não religado)');
  desk.flights[1].resolve({engine: 'opencode', models: [], session: '/nova.jsonl',
    sessions: [{path: '/nova.jsonl', label: 'Sessão nova', engine: 'opencode', started: 1}]});
  await clicked;
  await tick();
  assert.equal(S.connected, true, 'a sessão nova liga');
  assert.equal(S.link.state, 'online');
  /* O voo descartado assentando depois não escreve por cima da sessão nova. */
  desk.flights[0].resolve({engine: 'claude', models: [], session: '/antiga.jsonl'});
  await tick();
  assert.equal(S.connected, true, 'o voo de fundo tardio não derruba a sessão nova');
  assert.equal(S.currentSession, '/nova.jsonl');
  assert.equal(S.engine, 'opencode', 'o voo de fundo tardio não troca o motor');
});

test('se o new-session falha depois do clique, a coluna não fica presa em "conectando"', async () => {
  primeState('/antiga.jsonl');
  window.desk.save = async () => true;
  window.desk.newSession = async () => { throw new Error('new-session recusado no teste'); };
  await startWithKey({relink: {relinked: true}});
  await tick();
  assert.equal(S.link.state, 'connecting', 'o voo de fundo pinta "conectando"');
  initFreeModels();
  await elFor('#free-models-start').onclick();
  await tick(30);
  assert.equal(S.connecting, null, 'sem voo vivo depois da falha');
  assert.notEqual(S.link.state, 'connecting', 'sem voo vivo, a coluna não pode seguir dizendo "conectando" (revisão botão Começar, achado 1)');
});

test('clique recusado (turno em andamento) não apaga o "online" da sessão viva', async () => {
  primeState('/antiga.jsonl');
  S.busy = true;
  let asked = 0;
  window.desk.save = async () => true;
  window.desk.newSession = async () => { asked += 1; return {session: '/nova.jsonl', engine: 'opencode'}; };
  initFreeModels();
  await elFor('#free-models-start').onclick();
  await tick(30);
  S.busy = false;
  assert.equal(asked, 0, 'com turno em andamento o host não cria sessão');
  assert.equal(S.currentSession, '/antiga.jsonl');
  assert.equal(S.link.state, 'online', 'a recusa não apaga o "online" legítimo (revisão de da37e2f0)');
});
