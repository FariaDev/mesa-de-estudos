// Ponte do tutor que saiu do main.cjs (#43 fase 2), com estado vivo e
// serviços falsos (nada de Pi nem Claude reais: só assertIdle, stopBridge e piLaunch).
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createTutorBridgeHost} = require('../tutor-bridge-host.cjs');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-bridge-'));
after(() => fs.rmSync(runtime, {recursive: true, force: true}));
const deskDir = path.resolve(import.meta.dirname, '..');

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
function bridgeHost(live, engineName = 'pi') {
  return createTutorBridgeHost({live, runtime, deskDir, FREE_ID: 'mesa-free', ggb: {bridgeFile: '/tmp/ggb.json'},
    pendingDialogs: new Set(['x']), appendLog: () => {}, captureActivityScope: () => ({generation: live.activityGeneration}),
    prepareTutorMaterial: async () => ({}), engine: () => engineName, prepareClaude: () => { throw Error('sem Claude'); },
    testClaudeSdkLoader: () => undefined, claudeBinary: () => '', claudeDetector: () => undefined, piBinary: () => '/bin/pi',
    isNative: kind => kind === 'claude' || kind === 'opencode', openCodeTutor: fakeOpenCodeTutor()});
}

test('assertIdle passa sem ponte e recusa com turno do Claude em curso', async () => {
  const {live} = fakeServices();
  const host = bridgeHost(live, 'claude');
  await host.assertIdle('ocupado');
  live.bridge = {isRunning: () => true};
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

test('stopBridge durante a leitura da chave não deixa a ponte nascer depois', async () => {
  const {live} = fakeServices();
  let release;
  live.opencodeHost = {keyEnv: () => new Promise((resolve) => { release = resolve; }), launchArgs: () => []};
  const host = bridgeHost(live);
  const pending = host.connect();
  host.stopBridge();
  release({});
  await assert.rejects(pending, ptMatches(/cancelada/i));
  assert.equal(live.bridge, null, 'a ponte cancelada não ressuscita depois do stop');
});

test('stopBridge cancela a proposta aberta e o Pi da matéria leva mesa-review', async () => {
  const {live, calls} = fakeServices();
  live.reviewProposalHost = {cancelAll: (reason) => calls.push(['review.cancel', reason])};
  live.bridge = {removeAllListeners() {}, stop() {}};
  bridgeHost(live).stopBridge();
  assert.deepEqual(calls[0], ['review.cancel', 'session']);
  const withMaterial = await bridgeHost(live).piLaunch({materialTools: true});
  assert.ok(withMaterial.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'mesa-review'))));
  const plain = await bridgeHost(fakeServices().live).piLaunch({materialTools: false});
  assert.ok(plain.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'mesa-pdf'))));
  assert.equal(plain.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'mesa-review'))), false);
});

test('piLaunch na aba Livre usa o workspace da conversa e liga as extensões da Mesa', async () => {
  const {live} = fakeServices();
  const launch = await bridgeHost(live).piLaunch({materialTools: true});
  assert.equal(launch.cwd, require('../free-workspaces.cjs').workspaceDir(runtime, 'abc'));
  assert.ok(fs.statSync(launch.cwd).isDirectory());
  assert.equal(launch.env.LEARNING_DESK_TUTOR_WORKSPACE, undefined, 'sem W/jaula no Pi (#91)');
  assert.equal(launch.pi, '/bin/pi');
  assert.ok(launch.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'tutor-pdf'))));
  assert.ok(launch.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'mesa-pdf'))));
  assert.ok(JSON.parse(launch.env.LEARNING_DESK_MATERIAL_BRIDGE).token, 'concessão do PDF do tutor vai no ambiente');
});

test('piLaunch leva o allowlist e nunca reabre ferramenta nativa', async () => {
  const {live} = fakeServices();
  const launch = await bridgeHost(live).piLaunch({materialTools: true});
  const at = launch.extraArgs.indexOf('--tools');
  assert.ok(launch.extraArgs.includes('--no-builtin-tools'));
  assert.ok(launch.extraArgs.includes('--no-mcp'));
  assert.ok(launch.extraArgs.includes('--exclude-tools'));
  assert.ok(at > 0);
  const names = launch.extraArgs[at + 1].split(',');
  assert.deepEqual(names, require('../src/agents/mesa-tool-catalog.cjs').mesaToolNames({material: true}));
  assert.equal(names.includes('ask_user'), false);
  assert.equal(names.includes('quiz'), false);
  for (const native of ['bash', 'read', 'edit', 'write', 'glob', 'grep', 'find', 'ls', 'powershell', 'web_fetch', 'web_search', 'task']) {
    assert.equal(names.includes(native), false, `${native} fora do allowlist`);
  }
  const side = await bridgeHost(fakeServices().live).piLaunch({materialTools: false});
  const sideNames = side.extraArgs[side.extraArgs.indexOf('--tools') + 1].split(',');
  assert.deepEqual(sideNames, require('../src/agents/mesa-tool-catalog.cjs').mesaToolNames({material: false}));
  assert.equal(side.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'tool-approval'))), false, 'sem a extensão de confirmação');
});

test('o chat lateral com concessão de cartão recebe quiz/perguntar e um grant próprio', async () => {
  const {live, calls} = fakeServices();
  const host = bridgeHost(live);
  const side = await host.piLaunch({materialTools: false, cardScope: {conversationId: 'sc-1'}});
  const names = side.extraArgs[side.extraArgs.indexOf('--tools') + 1].split(',');
  assert.deepEqual(names, require('../src/agents/mesa-tool-catalog.cjs').mesaToolNames({material: false, cards: true}));
  assert.equal(side.cardGrant.token, 'activity.grant');
  assert.equal(JSON.parse(side.env.LEARNING_DESK_CARD_BRIDGE).token, 'activity.grant');
  assert.ok(calls.some(([name, scope]) => name === 'activity.grant' && scope.conversationId === 'sc-1'));
});

test('pinnedExtensions:false continua sem reabrir nativas', async () => {
  const {live} = fakeServices();
  live.config = {desk: {pinnedExtensions: false}};
  const launch = await bridgeHost(live).piLaunch({materialTools: true});
  const names = launch.extraArgs[launch.extraArgs.indexOf('--tools') + 1].split(',');
  assert.equal(names.includes('bash'), false);
  assert.equal(names.includes('read'), false);
  assert.ok(names.includes('mesa_ler_pdf'));
});

test('piLaunch sem material ainda oferece ler_pdf e concede a ponte uma vez', async () => {
  const {live, calls} = fakeServices();
  const host = bridgeHost(live);
  const launch = await host.piLaunch({materialTools: false});
  assert.ok(launch.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'mesa-pdf'))));
  assert.ok(launch.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'mesa-search'))), 'o chat lateral também busca no material');
  assert.equal(launch.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'tutor-pdf'))), false);
  assert.equal(launch.env.LEARNING_DESK_MATERIAL_BRIDGE, '');
  assert.ok(JSON.parse(launch.env.LEARNING_DESK_ACTIVITY_BRIDGE).token);
  const again = await host.piLaunch({materialTools: false});
  assert.equal(calls.filter(([name]) => name === 'activity.grant').length, 1);
  assert.equal(again.env.LEARNING_DESK_ACTIVITY_BRIDGE, launch.env.LEARNING_DESK_ACTIVITY_BRIDGE);
});

test('B2: o prompt do Pi não oferece propor_revisao na Livre e oferece na matéria', async () => {
  const free = await bridgeHost(fakeServices().live).piLaunch({materialTools: true});
  assert.doesNotMatch(fs.readFileSync(free.promptFile, 'utf8'), /propor_revisao/, 'Livre: sem caderno, sem oferta de revisão');
  const {live} = fakeServices();
  live.courseId = 'calc';
  const course = await bridgeHost(live).piLaunch({materialTools: true});
  assert.match(fs.readFileSync(course.promptFile, 'utf8'), /propor_revisao/, 'matéria: revisão continua oferecida');
});
