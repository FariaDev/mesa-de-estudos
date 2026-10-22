// IPC da sessão do tutor (#43 fase 2: saiu do main.cjs), com o motor Pi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches} from './pt-text.mjs';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';

const require = createRequire(import.meta.url);
const {registerTutorSessionIpc} = require('../tutor-session-ipc.cjs');

function tutorSessionIpc(script = {}, engine = 'pi') {
  const bridge = fakeTutorBridge({get_state: {model: {id: 'm'}}, get_messages: {messages: []}, get_available_models: {models: [{provider: 'p', id: 'm'}]}, ...script});
  const ipcMain = fakeIpcMain();
  const calls = [];
  const pendingDialogs = new Set();
  const live = {session: '/s.jsonl', bridge, levelsMod: {getSupportedThinkingLevels: () => ['off', 'high']}, languageHost: {logText: text => text},
    opencodeHost: {liveReady: async () => {}, annotate: models => models, rememberModel: () => {}}};
  registerTutorSessionIpc({ipcMain, live, runtime: '/rt', deskDir: '/desk', pendingDialogs, appendLog: (scope, text) => calls.push(`log:${text}`),
    engine: () => engine, connect: () => bridge, stopBridge: () => calls.push('stop'), assertIdle: async () => {}, persist: () => calls.push('persist'),
    courseSessions: () => [], conversationData: () => ({engine: 'pi'}), captureAvailable: () => false, trimMessageImages: messages => messages, piBinary: () => '',
    isNative: kind => kind === 'claude' || kind === 'opencode'});
  return {ipcMain, bridge, calls, pendingDialogs};
}

test('pi-connect persiste e devolve estado, modelos, níveis e sessão', async () => {
  const {ipcMain, calls} = tutorSessionIpc();
  const out = await ipcMain.invoke('pi-connect');
  assert.equal(calls[0], 'persist');
  assert.deepEqual(out.levels, ['off', 'high']);
  assert.equal(out.session, '/s.jsonl');
  assert.equal(out.engine, 'pi');
  assert.equal(await ipcMain.invoke('pi-connect-cancel'), false, 'sem chamada em voo não há o que cancelar');
});

test('pi-connect falho vai para o log e o erro sobe', async () => {
  const {ipcMain, calls} = tutorSessionIpc({get_state: Error('motor caiu')});
  await assert.rejects(async () => ipcMain.invoke('pi-connect'), /motor caiu/);
  assert.ok(calls.includes('log:Chamada ao tutor falhou: motor caiu'));
});

test('pi-commands corta e filtra a lista; erro vira lista vazia', async () => {
  const {ipcMain} = tutorSessionIpc({get_commands: {commands: [{name: 'x'.repeat(80), description: 'd'}, {name: ''}]}});
  const list = await ipcMain.invoke('pi-commands');
  assert.equal(list.length, 1);
  assert.equal(list[0].name.length, 60);
  assert.deepEqual(await tutorSessionIpc({get_commands: Error('x')}).ipcMain.invoke('pi-commands'), []);
});

test('pi-health usa o estado lido agora, não o da mesa', async () => {
  const {ipcMain} = tutorSessionIpc({get_state: {isStreaming: true, pendingMessageCount: 2}, get_session_stats: {tokens: 50, contextWindow: 100}});
  const out = await ipcMain.invoke('pi-health');
  assert.equal(out.isRunning, true);
  assert.equal(out.isStreaming, true);
  assert.equal(out.pendingMessageCount, 2);
  assert.equal(out.contextUsage.percent, 50);
});

test('pi-abort limpa a fila e interrompe; pi-response exige diálogo pendente', async () => {
  const {ipcMain, bridge, pendingDialogs} = tutorSessionIpc();
  await ipcMain.invoke('pi-abort');
  assert.deepEqual(bridge.seen, ['clear_queue', 'abort']);
  await assert.rejects(async () => ipcMain.invoke('pi-response', {id: 'd1'}), ptMatches(/^Não há diálogo pendente para esta resposta: recebido o id "d1"\.$/));
  pendingDialogs.add('d1');
  await ipcMain.invoke('pi-response', {id: 'd1', value: 'sim', confirmed: true});
  assert.deepEqual(bridge.responded, [{id: 'd1', value: 'sim', confirmed: true}]);
  assert.equal(pendingDialogs.has('d1'), false);
});

test('pi-compact passa ao Claude (#58); a compactação automática continua recusada', async () => {
  let asked = null;
  const {ipcMain, bridge} = tutorSessionIpc({compact: (params) => { asked = params; return {summary: '', tokensBefore: 1200, tokensAfter: 140}; }}, 'claude');
  assert.deepEqual(await ipcMain.invoke('pi-compact', '  mantenha as fórmulas '), {summary: '', tokensBefore: 1200});
  assert.deepEqual(asked, {customInstructions: 'mantenha as fórmulas'});
  assert.ok(bridge.seen.includes('compact'));
  await assert.rejects(async () => ipcMain.invoke('pi-auto-compaction', true), ptMatches(/compactação/i));
});
