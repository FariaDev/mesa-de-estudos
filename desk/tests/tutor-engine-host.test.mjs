// Motor do tutor que saiu do main.cjs (#43 fase 2), com um estado vivo falso.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createTutorEngineHost} = require('../tutor-engine-host.cjs');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-engine-'));
after(() => fs.rmSync(runtime, {recursive: true, force: true}));

/** Estado vivo mínimo, no formato do `live` do main. */
function fakeLive(overrides = {}) {
  return {config: {piPath: '', claudePath: '', vaultPath: ''}, session: path.join(runtime, 'pi-1.jsonl'), courseId: 'calc',
    course: '', bridge: null, state: {}, languageHost: {tutor: () => 'pt-BR'}, ...overrides};
}
const deskDir = path.resolve(import.meta.dirname, '..');

test('engine trata descritor Claude gerenciado como Claude mesmo sem o arquivo', () => {
  const host = createTutorEngineHost({live: fakeLive(), runtime, deskDir, TEST_MODE: false, FREE_ID: 'mesa-free'});
  assert.equal(host.engine(path.join(runtime, 'claude-12345678-1234-1234-1234-123456789abc.json')), 'claude');
  assert.equal(host.engine(), 'pi');
});

test('claudeProfile fica vazio na aba Livre e usa os templates numa matéria', () => {
  const live = fakeLive({courseId: 'mesa-free'});
  const host = createTutorEngineHost({live, runtime, deskDir, TEST_MODE: false, FREE_ID: 'mesa-free'});
  assert.deepEqual(host.claudeProfile(), []);
  live.courseId = 'calc';
  assert.deepEqual(host.claudeProfile().map((entry) => entry.name), ['TUTOR.md', 'LEARNER.md']);
});

test('prepareClaudeSide recusa descritor de outra matéria e cria o workspace do próprio', () => {
  const host = createTutorEngineHost({live: fakeLive(), runtime, deskDir, TEST_MODE: false, FREE_ID: 'mesa-free'});
  assert.throws(() => host.prepareClaudeSide({id: 'x', courseId: 'outra'}), /wrongCourse|Claude/);
  const prepared = host.prepareClaudeSide({id: 'lado', courseId: 'calc'});
  assert.equal(prepared.cwd, path.join(runtime, 'claude-workspaces', 'lado'));
  assert.ok(fs.statSync(prepared.cwd).isDirectory());
  assert.equal(typeof prepared.systemPrompt, 'string');
});

test('fora dos testes não há SDK simulado nem detector injetado', () => {
  const host = createTutorEngineHost({live: fakeLive(), runtime, deskDir, TEST_MODE: false, FREE_ID: 'mesa-free'});
  assert.equal(host.testClaudeSdkLoader(), undefined);
  assert.equal(host.claudeDetector(), undefined);
});

test('OpenCode (#57): o nome gerenciado diz o motor e o preparo usa a pasta e o prompt próprios', () => {
  const conversations = require('../src/agents/conversations.cjs');
  const {parseMessage} = require('../src/i18n.mjs');
  const live = fakeLive({languageHost: {tutor: () => 'pt-BR'}});
  const host = createTutorEngineHost({live, runtime, deskDir, TEST_MODE: false, FREE_ID: 'mesa-free'});
  assert.equal(host.engine(path.join(runtime, 'opencode-12345678-1234-1234-1234-123456789abc.json')), 'opencode');
  assert.equal(host.isNative('opencode'), true);
  assert.equal(host.isNative('pi'), false);
  live.session = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  const prepared = host.prepareOpenCode();
  assert.equal(prepared.cwd, path.join(runtime, 'opencode-workspaces', prepared.record.id));
  assert.ok(fs.statSync(prepared.cwd).isDirectory());
  assert.match(prepared.systemPrompt, /ferramenta geogebra/);
  assert.equal(host.conversationData({messages: false}).engine, 'opencode');
  live.courseId = 'outra';
  assert.throws(() => host.prepareOpenCode(), (error) => parseMessage(error.message)?.key === 'err.opencode.wrongCourse');
});

test('nos testes de janela o OpenCode só vem do LEARNING_DESK_OPENCODE (nunca o do usuário)', () => {
  const host = createTutorEngineHost({live: fakeLive(), runtime, deskDir, TEST_MODE: true, FREE_ID: 'mesa-free'});
  const before = process.env.LEARNING_DESK_OPENCODE;
  try {
    delete process.env.LEARNING_DESK_OPENCODE;
    assert.equal(host.openCodeBinary(), '');
    process.env.LEARNING_DESK_OPENCODE = path.join(deskDir, 'tests', 'fake-opencode.mjs');
    assert.equal(host.openCodeBinary(), process.env.LEARNING_DESK_OPENCODE);
  } finally {
    if (before === undefined) delete process.env.LEARNING_DESK_OPENCODE; else process.env.LEARNING_DESK_OPENCODE = before;
  }
});
