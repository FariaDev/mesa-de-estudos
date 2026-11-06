// Ponte do tutor que saiu do main.cjs (#43 fase 2), com estado vivo e
// serviços falsos (nada de Pi nem Claude reais: só assertIdle e stopBridge).
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createTutorBridgeHost} = require('../tutor-bridge-host.cjs');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-bridge-'));
after(() => fs.rmSync(runtime, {recursive: true, force: true}));

/** Registra o que a ponte pede aos serviços do main. */
function fakeServices() {
  const calls = [];
  const note = (name) => (...args) => { calls.push([name, ...args]); return {token: name}; };
  return {calls, live: {
    config: {desk: {}}, courseId: 'mesa-free', session: path.join(runtime, 's.jsonl'), freeSessionId: 'abc', state: {}, win: null,
    bridge: null, activityGeneration: 1, activityGrant: null, tutorMaterialGrant: null,
    materialPreviewHost: {cancel: note('preview.cancel')}, activityHost: {invalidate: note('activity.invalidate')},
    activityBridge: {grant: note('activity.grant'), revoke: note('activity.revoke')},
    tutorMaterialBridge: {grant: note('material.grant'), revoke: note('material.revoke')},
    sidechatManager: {suspend: note('sidechat.suspend')},
    opencodeHost: {keyEnv: () => ({}), launchArgs: () => []}, languageHost: {tutor: () => 'pt-BR', tutorLanguage: () => 'pt-BR'},
  }};
}
/* Tutor OpenCode falso com nome: só registra o que a ponte pede. */
function fakeOpenCodeTutor(calls = []) {
  return {calls, connect: () => { calls.push('connect'); return null; }, release: () => calls.push('release')};
}
function bridgeHost(live, engineName = 'claude') {
  return createTutorBridgeHost({live, runtime, ggb: {bridgeFile: '/tmp/ggb.json'},
    pendingDialogs: new Set(['x']), appendLog: () => {}, captureActivityScope: () => ({generation: live.activityGeneration}),
    prepareTutorMaterial: async () => ({}), engine: () => engineName, prepareClaude: () => { throw Error('sem Claude'); },
    testClaudeSdkLoader: () => undefined, claudeBinary: () => '', claudeDetector: () => undefined,
    isNative: kind => kind === 'claude' || kind === 'opencode', openCodeTutor: fakeOpenCodeTutor()});
}

test('assertIdle passa sem ponte e recusa com turno do Claude em curso', async () => {
  const {live} = fakeServices();
  const host = bridgeHost(live, 'claude');
  await host.assertIdle('ocupado');
  live.bridge = {isRunning: () => true};
  await assert.rejects(host.assertIdle('ocupado'), /ocupado/);
  live.bridge = {isRunning: () => true, isTurnActive: () => false};
  await host.assertIdle('conectando');
  live.bridge = {isRunning: () => true, isTurnActive: () => true};
  await assert.rejects(host.assertIdle('ocupado'), /ocupado/);
});

test('stopBridge revoga concessões, avança a geração, suspende o lateral e solta a ponte', () => {
  const {live, calls} = fakeServices();
  let stopped = false;
  live.bridge = {removeAllListeners() {}, stop() { stopped = true; }};
  live.activityGrant = {token: 'a'}; live.tutorMaterialGrant = {token: 'm'};
  bridgeHost(live).stopBridge();
  assert.equal(stopped, true);
  assert.equal(live.bridge, null);
  assert.equal(live.activityGeneration, 2);
  assert.deepEqual([live.activityGrant, live.tutorMaterialGrant], [null, null]);
  assert.deepEqual(calls.map(([name]) => name), ['preview.cancel', 'activity.invalidate', 'activity.revoke', 'material.revoke', 'sidechat.suspend']);
});
