// `pi-connect` não devolve o mesmo histórico que o renderer já pintou (#115):
// a identidade volta igual e as mensagens/cartões não atravessam o IPC de novo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';

const require = createRequire(import.meta.url);
const {registerTutorSessionIpc} = require('../tutor-session-ipc.cjs');
const {historyIdentity} = require('../src/history-identity.cjs');

const messages = [
  {role: 'user', content: [{type: 'text', text: 'Pergunta'}], timestamp: 1_000},
  {role: 'assistant', content: [{type: 'text', text: 'Resposta'}], timestamp: 2_000},
];

function connectIpc() {
  const bridge = fakeTutorBridge({get_state: {}, get_messages: {messages}, get_available_models: {models: []}});
  const ipcMain = fakeIpcMain();
  const live = {session: '/rt/opencode-a.json', bridge, levelsMod: {getSupportedThinkingLevels: () => []}, languageHost: {logText: text => text},
    opencodeHost: {liveReady: async () => {}, annotate: models => models, rememberModel: () => {}}};
  registerTutorSessionIpc({ipcMain, live, runtime: '/rt', pendingDialogs: new Set(), appendLog: () => {},
    engine: () => 'claude', connect: () => bridge, stopBridge: () => {}, assertIdle: async () => {}, persist: () => {},
    courseSessions: () => [], conversationData: () => ({engine: 'claude', cards: []}), captureAvailable: () => false,
    historyIdentity, trimMessageImages: list => list, isNative: kind => kind === 'claude' || kind === 'opencode'});
  return ipcMain;
}

test('a segunda chamada com a mesma identidade não reenvia mensagens nem cartões', async () => {
  const ipcMain = connectIpc();
  const first = await ipcMain.invoke('pi-connect');
  assert.equal(first.messages.length, messages.length);
  assert.deepEqual(first.cards, []);
  assert.ok(first.historyIdentity, 'o payload inicial carrega a identidade');

  const second = await ipcMain.invoke('pi-connect', {historyIdentity: first.historyIdentity});
  assert.equal(second.historyUnchanged, true);
  assert.equal(second.messages, undefined, 'o histórico não volta pelo IPC');
  assert.equal(second.cards, undefined, 'os cartões não voltam pelo IPC');
  assert.equal(second.historyIdentity, first.historyIdentity);
});

test('identidade de outro conteúdo devolve o histórico inteiro', async () => {
  const ipcMain = connectIpc();
  const stale = historyIdentity({session: '/rt/opencode-a.json', messages: messages.slice(0, 1), cards: []});
  const result = await ipcMain.invoke('pi-connect', {historyIdentity: stale});
  assert.equal(result.historyUnchanged, undefined);
  assert.equal(result.messages.length, messages.length);
});
