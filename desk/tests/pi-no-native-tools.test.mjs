/* Pi só com as ferramentas da Mesa (#91/#92): `--no-builtin-tools` e `--tools`
   com o allowlist do catálogo; `perguntar`/`quiz` são as ferramentas da Mesa,
   não as antigas `ask_user`/`quiz`. A extensão de confirmação e o W da jaula
   saíram; `pinnedExtensions:false` muda só o perfil, nunca o allowlist. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createTutorBridgeHost} = require('../tutor-bridge-host.cjs');
const {mesaToolNames} = require('../src/agents/mesa-tool-catalog.cjs');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pi-allow-'));
const deskDir = path.resolve(import.meta.dirname, '..');

function liveState(config = {desk: {}}) {
  return {
    config, courseId: 'mesa-free', session: path.join(runtime, 's.jsonl'), freeSessionId: 'abc', state: {}, win: null,
    bridge: null, activityGeneration: 1, activityGrant: null, tutorMaterialGrant: null,
    materialPreviewHost: {cancel() {}}, activityHost: {invalidate() {}},
    activityBridge: {grant: () => ({url: 'http://127.0.0.1:1/activity', token: 'a'}), revoke() {}},
    tutorMaterialBridge: {grant: () => ({url: 'http://127.0.0.1:1/pdf', token: 'm'}), revoke() {}},
    sidechatManager: {suspend() {}}, opencodeHost: {keyEnv: () => ({}), launchArgs: () => []},
    languageHost: {tutor: () => 'pt-BR', tutorLanguage: () => 'pt-BR'},
  };
}

function launchFor(live, materialTools) {
  const host = createTutorBridgeHost({
    live, runtime, deskDir, FREE_ID: 'mesa-free', ggb: {bridgeFile: '/tmp/ggb.json'},
    pendingDialogs: new Set(), appendLog: () => {}, captureActivityScope: () => ({generation: 1}),
    prepareTutorMaterial: async () => ({}), engine: () => 'pi', prepareClaude: () => { throw Error('sem Claude'); },
    testClaudeSdkLoader: () => undefined, claudeBinary: () => '', claudeDetector: () => undefined,
    piBinary: () => '/bin/pi', isNative: () => false,
    openCodeTutor: {connect: () => null, release() {}},
  });
  return host.piLaunch({materialTools});
}

test('a sessão principal lista exatamente as ferramentas da Mesa, sem ask_user nem quiz antigos', async () => {
  const launch = await launchFor(liveState(), true);
  assert.ok(launch.extraArgs.includes('--no-builtin-tools'));
  assert.ok(launch.extraArgs.includes('--no-mcp'), 'nenhum servidor MCP do Pi');
  const exclude = launch.extraArgs.indexOf('--exclude-tools');
  assert.ok(exclude > 0, '--exclude-tools presente');
  assert.deepEqual(launch.extraArgs[exclude + 1].split(','), ['mcp__*', 'list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource']);
  const at = launch.extraArgs.indexOf('--tools');
  assert.ok(at > 0, '--tools presente');
  const names = launch.extraArgs[at + 1].split(',');
  assert.deepEqual(names, mesaToolNames({material: true}));
  assert.equal(names.includes('ask_user'), false);
  assert.equal(names.includes('quiz'), false);
  assert.ok(names.includes('mesa_salvar_nota'));
  for (const native of ['bash', 'read', 'edit', 'write', 'glob', 'grep', 'find', 'ls', 'powershell', 'web_fetch', 'web_search', 'task']) {
    assert.equal(names.includes(native), false, `${native} fora do allowlist`);
  }
});

test('o chat lateral fica com leitura, busca, cálculo e lista; não recebe salvar_nota', async () => {
  const launch = await launchFor(liveState(), false);
  const names = launch.extraArgs[launch.extraArgs.indexOf('--tools') + 1].split(',');
  assert.deepEqual(names, mesaToolNames({material: false}));
  assert.equal(names.includes('mesa_quiz'), false, 'sem cartão quando não há concessão lateral');
  assert.equal(names.includes('ask_user'), false);
  assert.ok(names.includes('mesa_listar_materiais'));
  assert.equal(names.includes('mesa_salvar_nota'), false);
  assert.equal(launch.extraArgs.some((arg) => arg.endsWith(path.join('extensions', 'tool-approval'))), false);
  assert.equal(launch.env.LEARNING_DESK_TUTOR_WORKSPACE, undefined);
});

test('pinnedExtensions:false não reabre ferramenta nativa', async () => {
  const launch = await launchFor(liveState({desk: {pinnedExtensions: false}}), true);
  const names = launch.extraArgs[launch.extraArgs.indexOf('--tools') + 1].split(',');
  assert.deepEqual(names, mesaToolNames({material: true}));
  assert.equal(names.includes('ask_user'), false);
  assert.equal(names.includes('quiz'), false);
  assert.equal(names.includes('bash'), false);
  assert.equal(names.includes('read'), false);
});
