/* Idioma da interface e do tutor no host (#41): o padrão segue o sistema, a
   escolha vence o sistema, o valor estranho do desk.json volta ao padrão e a
   troca vale na hora no t() do processo principal. A decisão é do núcleo
   (core/language.bend); aqui se prova a fronteira. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createLanguageHost, normalizeUi, normalizeTutor} = require('../language-host.cjs');

/* Host com o estado em memória e o sistema no idioma dado. */
function harness({system = 'en-US', saved = {}, relinkTutor} = {}) {
  const store = {state: {...saved}, changes: []};
  const handlers = new Map();
  const host = createLanguageHost({
    ipcMain: {handle: (name, fn) => handlers.set(name, fn)},
    state: () => store.state,
    patchState: (patch) => { store.state = {...store.state, ...patch}; },
    systemLocale: () => system,
    onChange: (payload) => store.changes.push(payload),
    ...(relinkTutor ? {relinkTutor} : {}),
  });
  return {host, store, call: (name, request) => handlers.get(name)({}, request)};
}

test('sem escolha, o idioma do sistema decide: pt* → português, o resto → inglês', () => {
  assert.equal(harness({system: 'pt-BR'}).host.ui(), 'pt-BR');
  assert.equal(harness({system: 'pt-PT'}).host.ui(), 'pt-BR');
  assert.equal(harness({system: 'en-US'}).host.ui(), 'en');
  assert.equal(harness({system: 'ja'}).host.ui(), 'en');
  assert.deepEqual(harness({system: 'en-US'}).call('language-get'), {ui: 'en', tutor: 'follow', chosen: false});
});

test('a escolha guardada vence o sistema e o t() do main troca na hora', () => {
  const {host, call, store} = harness({system: 'en-US'});
  const result = call('language-set', {ui: 'pt-BR'});
  assert.deepEqual(result, {ui: 'pt-BR', tutor: 'follow', chosen: true});
  assert.equal(store.state.uiLanguage, 'pt-BR');
  assert.equal(host.payload().ui, 'pt-BR');
  assert.equal(store.changes.length, 1);
});

test('o tutor guarda follow, pt-BR ou en; mudar o tutor não mexe na interface', () => {
  const {call, store} = harness({system: 'pt-BR'});
  assert.equal(call('language-set', {tutor: 'en'}).tutor, 'en');
  assert.equal(store.state.tutorLanguage, 'en');
  assert.equal(store.state.uiLanguage, undefined);
  assert.equal(call('language-get').ui, 'pt-BR');
});

test('pedido inválido diz o valor recebido e o formato esperado', () => {
  const {call} = harness();
  assert.throws(() => call('language-set', {ui: 'fr'}), /"fr" desconhecido; esperado "pt-BR" ou "en"/);
  assert.throws(() => call('language-set', {tutor: 'auto'}), /"auto" desconhecido; esperado "follow", "pt-BR" ou "en"/);
});

test('valor estranho no desk.json volta ao padrão', () => {
  assert.equal(normalizeUi('fr'), '');
  assert.equal(normalizeUi(42), '');
  assert.equal(normalizeUi('en'), 'en');
  assert.equal(normalizeTutor('klingon'), 'follow');
  assert.equal(normalizeTutor(undefined), 'follow');
  assert.equal(harness({system: 'pt-BR', saved: {uiLanguage: 'fr', tutorLanguage: 'x'}}).host.payload().ui, 'pt-BR');
});

test('language-relink devolve o que o main decidiu e, sem ponte, não religa nada', async () => {
  assert.deepEqual(await harness().call('language-relink'), {relinked: false});
  const calls = [];
  const idle = harness({relinkTutor: async () => { calls.push('idle'); return {relinked: true}; }});
  assert.deepEqual(await idle.call('language-relink'), {relinked: true});
  const busy = harness({relinkTutor: async () => ({relinked: false, busy: true})});
  assert.deepEqual(await busy.call('language-relink'), {relinked: false, busy: true});
  assert.deepEqual(calls, ['idle']);
});
