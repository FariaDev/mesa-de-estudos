/* Prova D — pi-connect antigo não é cancelado pela navegação.
   - Troca de sessão/matéria (ou save-config → stopBridge) durante o pi-connect:
     o `step` só olhava `attempt.cancelled`; o serviço parado ainda respondia
     get_state/get_messages e o renderer aplicava o motor antigo na sessão nova.
   - Serviço parado deve rejeitar em vez de parecer vivo.

   1. troca A→B com get_state lento: o pi-connect antigo rejeita (cancelado),
      e o novo para B conecta sozinho.
   2. stopBridge na mesma sessão (live.bridge=null): o antigo rejeita.
   3. serviço parado não responde get_state como vivo.

   Rodar: node --test desk/tests/pi-connect-race.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';

const require = createRequire(import.meta.url);
const {registerTutorSessionIpc} = require('../tutor-session-ipc.cjs');
const {NativeService} = require('../src/agents/service.cjs');
const {parseMessage} = require('../src/i18n.mjs');

const isCancelled = (error) => error?.cancelled === true || parseMessage(error?.message)?.key === 'tutor.error.cancelled';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sessionIpc({session, bridge, connectImpl}) {
  const ipcMain = fakeIpcMain();
  const live = {session, bridge, languageHost: {logText: (text) => text},
    opencodeHost: {liveReady: async () => {}, annotate: (models) => models}};
  registerTutorSessionIpc({ipcMain, live, runtime: '/rt', pendingDialogs: new Set(), appendLog: () => {},
    engine: () => 'opencode', connect: connectImpl || (async () => live.bridge), stopBridge: () => { live.bridge = null; },
    assertIdle: async () => {}, persist: () => {}, courseSessions: () => [],
    conversationData: () => ({}), captureAvailable: () => false,
    trimMessageImages: (messages) => messages, isNative: () => true});
  return {ipcMain, live};
}

test('troca A→B durante o pi-connect: o antigo rejeita e o novo conecta sozinho', async () => {
  const slowBridge = fakeTutorBridge({
    get_state: async () => { await sleep(120); return {model: {id: 'velho'}}; },
    get_messages: async () => ({messages: []}),
    get_available_models: async () => ({models: []}),
    get_session_stats: async () => null,
  });
  const {ipcMain, live} = sessionIpc({session: '/A.jsonl', bridge: slowBridge});
  const old = ipcMain.invoke('pi-connect', {});
  await sleep(20);
  live.session = '/B.jsonl';
  live.bridge = null;
  await assert.rejects(old, isCancelled,
    'o pi-connect antigo devia ser cancelado pela troca, não devolver o motor de A');
  const freshBridge = fakeTutorBridge({
    get_state: async () => ({model: {id: 'novo'}}),
    get_messages: async () => ({messages: []}),
    get_available_models: async () => ({models: []}),
    get_session_stats: async () => null,
  });
  live.bridge = freshBridge;
  const out = await ipcMain.invoke('pi-connect', {});
  assert.equal(out.session, '/B.jsonl', 'a sessão nova conecta sozinha com os dados novos');
  assert.equal(out.state.model.id, 'novo');
});

test('stopBridge na mesma sessão cancela o pi-connect antigo', async () => {
  const slowBridge = fakeTutorBridge({
    get_state: async () => { await sleep(120); return {model: {id: 'velho'}}; },
    get_messages: async () => ({messages: []}),
    get_available_models: async () => ({models: []}),
    get_session_stats: async () => null,
  });
  const {ipcMain, live} = sessionIpc({session: '/A.jsonl', bridge: slowBridge});
  const old = ipcMain.invoke('pi-connect', {});
  await sleep(20);
  live.bridge = null;
  await assert.rejects(old, isCancelled,
    'o pi-connect antigo devia cair quando a ponte foi parada');
});

test('serviço parado não responde get_state como vivo', async () => {
  const adapter = new EventEmitter();
  adapter.snapshot = () => ({busy: false});
  adapter.connect = async () => {};
  adapter.history = async () => [];
  adapter.stop = () => {};
  const service = new NativeService({adapter, engine: 'opencode'});
  service.stop();
  await assert.rejects(service.request('get_state'),
    'o serviço parado não pode responder como se estivesse vivo');
});
