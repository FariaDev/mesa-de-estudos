/* Prova C — connect antigo grava o ses_ de A na conversa B.
   Gatilho: salvar Ajustes (ou trocar de matéria) durante o primeiro connect,
   com o POST /api/session atrasado. O `admitSession` conferia a geração antes
   do POST, não depois; o `adoptSession` rodava mesmo após `stop()` e o host
   usava `live.session` no momento do callback.

   1. adapter: POST atrasado + stop() → ses_ não pode ser adotado.
   2. host: troca live.session=A→B durante o primeiro connect → B não herda ses_ de A.

   Rodar: node --test desk/tests/opencode-session-race.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');
const {createOpenCodeTutorHost} = require('../opencode-tutor-host.cjs');
const conversations = require('../src/agents/conversations.cjs');

const PASSWORD = 'senha-de-teste';
const fakeReadVersion = async () => 'opencode v2.2.4';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const temps = [];
function tempDir() {
  const dir = trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ses-race-')));
  temps.push(dir);
  return dir;
}

function delayedFetch(delayMs, started = null) {
  return async (url, init = {}) => {
    if (init.method === 'POST' && new URL(url).pathname === '/api/session') {
      if (started) started.value = true;
      await sleep(delayMs);
    }
    return fetch(url, init);
  };
}

test('adapter: POST atrasado + stop() não adota o ses_', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const runtime = tempDir();
  t.after(() => fs.rmSync(runtime, {recursive: true, force: true}));
  const adopted = [];
  const postStarted = {value: false};
  const adapter = new OpenCodeAdapter({conversationId: 'conv-A', sessionId: '', directory: path.join(runtime, 'ws'),
    acquire: async () => ({baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'}),
    readVersion: fakeReadVersion, fetch: delayedFetch(300, postStarted),
    onSessionId: (id) => adopted.push(id),
    mcpConfig: () => ({type: 'local', command: ['node', 'x']})});
  t.after(() => adapter.stop());
  const connecting = adapter.connect();
  for (let i = 0; i < 200 && !postStarted.value; i++) await sleep(10);
  assert.ok(postStarted.value, 'o POST partiu antes do stop');
  adapter.stop();
  await connecting.then(() => {}, () => {});
  assert.equal(adapter.sessionId, '', 'o ses_ tardio não pode ser adotado após o stop');
  assert.deepEqual(adopted, [], 'o descritor não pode ser avisado após o stop');
});

test('host: troca A→B durante o primeiro connect não grava ses_ de A em B', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const runtime = tempDir();
  t.after(() => fs.rmSync(runtime, {recursive: true, force: true}));
  const descriptorA = conversations.createClaudeConversation({runtime, courseId: 'c', engine: 'opencode'});
  const descriptorB = conversations.createClaudeConversation({runtime, courseId: 'c', engine: 'opencode'});
  const live = {session: descriptorA, courseId: 'c', freeSessionId: '', opencodeHost: {keyEnv: () => ({})}};
  live.languageHost = {tutorLanguage: () => 'pt-BR', t: (key) => key === 'opencode.session.title' ? 'Mesa de Estudos' : key};
  live.activityBridge = {grant: () => ({url: 'http://127.0.0.1:1/a', token: 't0'}), revoke: () => {}};
  live.tutorMaterialBridge = {grant: () => ({url: 'http://127.0.0.1:1/p', token: 'm'})};
  const host = createOpenCodeTutorHost({live, runtime, ggbBridge: () => '/tmp/ggb.json', appendLog: () => {},
    captureActivityScope: () => ({}),
    prepareOpenCode: () => {
      const record = conversations.readClaudeConversation(live.session, {runtime});
      return {cwd: runtime, systemPrompt: 'mesa', record};
    },
    openCodeBinary: () => '/fake/opencode', readVersion: fakeReadVersion,
    createOwner: () => ({acquire: async () => ({baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'}),
      cancelStarting: () => {}, stop: () => {}, sweepAtBoot: () => ({})})});
  const service = host.connect();
  t.after(() => { try { service.stop(); } catch {} host.release(); });
  live.session = descriptorB;
  try { await service.adapter.connect(); } catch {}
  const recordB = conversations.readClaudeConversation(descriptorB, {runtime});
  assert.equal(recordB.nativeSessionId || '', '', `B ficou com o ses_ de A: ${recordB.nativeSessionId}`);
});
