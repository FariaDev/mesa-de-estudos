// IPC da sessão do tutor (#43 fase 2: saiu do main.cjs), com o motor nativo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ptMatches} from './pt-text.mjs';
import {createRequire} from 'node:module';
import {fakeAgentAdapter} from './fake-agent-adapter.mjs';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';

const require = createRequire(import.meta.url);
const {registerTutorSessionIpc} = require('../tutor-session-ipc.cjs');
const {ClaudeService} = require('../src/agents/service.cjs');
const conversations = require('../src/agents/conversations.cjs');
const {nativePersistence} = require('../src/agents/native-persistence.cjs');
const {createPromptImages} = require('../prompt-images.cjs');

function tutorSessionIpc(script = {}, engine = 'claude') {
  const bridge = fakeTutorBridge({get_state: {model: {id: 'm'}}, get_messages: {messages: []}, get_available_models: {models: [{provider: 'p', id: 'm'}]}, ...script});
  const ipcMain = fakeIpcMain();
  const calls = [];
  const pendingDialogs = new Set();
  const live = {session: '/s.jsonl', bridge, levelsMod: {getSupportedThinkingLevels: () => ['off', 'high']}, languageHost: {logText: text => text},
    opencodeHost: {liveReady: async () => {}, annotate: models => models, rememberModel: () => {}}};
  registerTutorSessionIpc({ipcMain, live, runtime: '/rt', deskDir: '/desk', pendingDialogs, appendLog: (scope, text) => calls.push(`log:${text}`),
    engine: () => engine, connect: () => bridge, stopBridge: () => calls.push('stop'), assertIdle: async () => {}, persist: () => calls.push('persist'),
    courseSessions: () => [], conversationData: () => ({engine: 'claude'}), captureAvailable: () => false, trimMessageImages: messages => messages,
    isNative: kind => kind === 'claude' || kind === 'opencode'});
  return {ipcMain, bridge, calls, pendingDialogs};
}

test('pi-connect persiste e devolve estado, modelos, níveis e sessão', async () => {
  const {ipcMain, calls} = tutorSessionIpc();
  const out = await ipcMain.invoke('pi-connect');
  assert.equal(calls[0], 'persist');
  assert.deepEqual(out.levels, []);
  assert.equal(out.session, '/s.jsonl');
  assert.equal(out.engine, 'claude');
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

test('pi-connect lê estado, histórico, catálogo e medidor ao mesmo tempo', async () => {
  let inflight = 0;
  let maxInflight = 0;
  const bridge = {
    uncertain: false,
    isRunning: () => false,
    async request(method) {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inflight -= 1;
      if (method === 'get_state') return {model: {id: 'm'}};
      if (method === 'get_messages') return {messages: [{role: 'user'}]};
      if (method === 'get_available_models') return {models: [{provider: 'p', id: 'm'}]};
      if (method === 'get_session_stats') return {tokens: 10, contextWindow: 100};
      return {};
    },
    respond() { return {ok: true}; },
  };
  const ipcMain = fakeIpcMain();
  const live = {session: '/s.jsonl', bridge, levelsMod: {getSupportedThinkingLevels: () => ['off', 'high']}, languageHost: {logText: (text) => text},
    opencodeHost: {liveReady: async () => { await new Promise((resolve) => setTimeout(resolve, 30)); }, annotate: (models) => models, rememberModel: () => {}}};
  registerTutorSessionIpc({ipcMain, live, runtime: '/rt', deskDir: '/desk', pendingDialogs: new Set(), appendLog: () => {},
    engine: () => 'claude', connect: () => bridge, stopBridge: () => {}, assertIdle: async () => {}, persist: () => {},
    courseSessions: () => [], conversationData: () => ({engine: 'claude'}), captureAvailable: () => false, trimMessageImages: (messages) => messages,
    isNative: (kind) => kind === 'claude' || kind === 'opencode'});
  const out = await ipcMain.invoke('pi-connect');
  /* A prova de que os pedidos não somam prazo é a sobreposição, não o
     relógio: cada `request` dorme 30 ms, e sob carga o total de uma rodada
     paralela também passa de 120 ms. Todos em voo ao mesmo tempo só acontece
     se o `Promise.all` os dispara juntos. */
  assert.equal(maxInflight, 5, 'as cinco leituras independentes saem juntas');
  assert.deepEqual(out.levels, []);
  assert.equal(out.contextUsage.percent, 10);
  assert.equal(out.messages.length, 1);
});

test('#117: o corte de imagens para a tela não apaga imagens antigas do descritor', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-trim-'));
  try {
    const file = conversations.createClaudeConversation({runtime, courseId: 'c1'});
    const seeded = Array.from({length: 8}, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: [
        {type: 'text', text: `mensagem ${index}`},
        {type: 'image', data: Buffer.from(`imagem-${index}`).toString('base64'), mimeType: 'image/png'},
      ],
    }));
    conversations.updateClaudeConversation(file, {messages: seeded}, {runtime});
    const record = conversations.readClaudeConversation(file, {runtime});
    const adapter = fakeAgentAdapter({messages: record.messages});
    const persistence = nativePersistence({descriptor: file, runtime, preview: record.preview});
    const service = new ClaudeService({adapter, messages: record.messages, importedPrefixLength: record.importedPrefixLength || 0,
      onMessages: persistence.onMessages});
    const trimMessageImages = createPromptImages({runtime, deskDir: path.resolve(import.meta.dirname, '..'),
      learningRoot: path.join(runtime, 'learning'), nativeImage: {createFromBuffer: () => ({isEmpty: () => true})}}).trimMessageImages;
    const ipcMain = fakeIpcMain();
    const live = {session: file, bridge: service, levelsMod: {getSupportedThinkingLevels: () => []}, languageHost: {logText: text => text},
      opencodeHost: {liveReady: async () => {}, annotate: models => models}};
    registerTutorSessionIpc({ipcMain, live, runtime, deskDir: path.resolve(import.meta.dirname, '..'), pendingDialogs: new Set(), appendLog: () => {},
      engine: () => 'claude', connect: () => service, stopBridge: () => {}, assertIdle: async () => {}, persist: () => {},
      courseSessions: () => [], conversationData: () => ({engine: 'claude'}), captureAvailable: () => false, trimMessageImages,
      isNative: kind => kind === 'claude' || kind === 'opencode'});
    const screen = await ipcMain.invoke('pi-connect');
    assert.equal(screen.messages.filter(message => message.content.some(part => part.type === 'image')).length, 6,
      'a tela recebe no máximo 6 mensagens com imagem');
    await service.request('prompt', {message: 'mensagem nova'});
    const saved = conversations.readClaudeConversation(file, {runtime});
    const images = saved.messages.flatMap(message => message.content).filter(part => part.type === 'image');
    assert.equal(images.length, seeded.length, 'o descritor guarda todas as 8 imagens antigas');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
