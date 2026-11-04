// Motor do tutor que saiu do main.cjs (#43 fase 2), com um estado vivo falso.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createTutorEngineHost} = require('../tutor-engine-host.cjs');
const prompts = require('../src/agents/desk-prompts.cjs');

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
  live.course = path.join(runtime, 'Courses', 'calc');
  fs.mkdirSync(live.course, {recursive: true});
  const prepared = host.prepareOpenCode();
  assert.equal(prepared.cwd, path.join(runtime, 'opencode-workspaces', prepared.record.id));
  assert.equal(prepared.workspaceRoots, undefined, 'sem W/jaula no Claude (#91)');
  assert.ok(fs.statSync(prepared.cwd).isDirectory());
  assert.match(prepared.systemPrompt, /ferramenta geogebra/);
  assert.equal(host.conversationData({messages: false}).engine, 'opencode');
  live.courseId = 'outra';
  assert.throws(() => host.prepareOpenCode(), (error) => parseMessage(error.message)?.key === 'err.opencode.wrongCourse');
});

test('nos testes de janela o Pi só vem do LEARNING_DESK_PI (nunca o do usuário)', () => {
  const before = process.env.LEARNING_DESK_PI;
  try {
    delete process.env.LEARNING_DESK_PI;
    const host = createTutorEngineHost({live: fakeLive(), runtime, deskDir, TEST_MODE: true, FREE_ID: 'mesa-free'});
    assert.equal(host.piBinary(), '', 'sem fake explícito, nem PATH nem Homebrew contam');
    process.env.LEARNING_DESK_PI = path.join(deskDir, 'tests', 'fake-pi.mjs');
    assert.equal(host.piBinary(), process.env.LEARNING_DESK_PI);
  } finally {
    if (before === undefined) delete process.env.LEARNING_DESK_PI; else process.env.LEARNING_DESK_PI = before;
  }
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

test('A4/B2: o lateral OpenCode não leva ofertas; a Livre não oferece propor_revisao nos dois motores nativos', () => {
  const conversations = require('../src/agents/conversations.cjs');
  const live = fakeLive({courseId: 'mesa-free'});
  const host = createTutorEngineHost({live, runtime, deskDir, TEST_MODE: false, FREE_ID: 'mesa-free'});
  live.session = conversations.createClaudeConversation({runtime, courseId: 'mesa-free', engine: 'opencode'});
  const free = host.prepareOpenCode();
  assert.doesNotMatch(free.systemPrompt, /propor_revisao/, 'Livre: sem caderno, sem oferta de revisão');
  const side = host.prepareOpenCodeSide({id: 'lado-oc', courseId: 'mesa-free'});
  assert.equal(side.systemPrompt.includes(prompts.mainSessionPrompt({pdf: false})), false, 'lateral: sem as ofertas da principal');
  assert.doesNotMatch(side.systemPrompt, /ferramenta geogebra|ver_figura|um quadro/, 'lateral: só ler_pdf existe');
  assert.match(side.systemPrompt, /Este chat lateral só lê e busca nos PDFs/);
  live.courseId = 'calc';
  live.session = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  assert.match(host.prepareOpenCode().systemPrompt, /propor_revisao/, 'matéria: revisão continua oferecida');
  live.courseId = 'mesa-free';
  live.session = conversations.createClaudeConversation({runtime, courseId: 'mesa-free', engine: 'claude'});
  assert.doesNotMatch(host.prepareClaude().systemPrompt, /propor_revisao/);
  live.courseId = 'calc';
  live.session = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'claude'});
  assert.match(host.prepareClaude().systemPrompt, /propor_revisao/);
});

test('resumeSession no release só OpenCode começa uma sessão nova, sem tocar o Pi antigo (#release OpenCode)', () => {
  const before = process.env.LEARNING_DESK_OPENCODE;
  const beforePath = process.env.PATH;
  const empty = path.join(runtime, 'pi-vazio.jsonl');
  const withHistory = path.join(runtime, 'pi-com-historico.jsonl');
  fs.writeFileSync(empty, '');
  fs.writeFileSync(withHistory, `${JSON.stringify({type: 'message', message: {role: 'user', content: 'oi'}})}\n`);
  try {
    process.env.LEARNING_DESK_OPENCODE = path.join(deskDir, 'tests', 'fake-opencode.mjs');
    process.env.LEARNING_DESK_PI = '';
    process.env.PATH = path.dirname(process.execPath);
    const host = createTutorEngineHost({live: fakeLive(), runtime, deskDir, TEST_MODE: true, FREE_ID: 'mesa-free'});
    const next = host.resumeSession(empty, 'calc');
    assert.match(path.basename(next), /^opencode-[0-9a-f-]{36}\.json$/, 'o marcador vazio vira o motor visível');
    assert.equal(fs.readFileSync(empty, 'utf8'), '', 'o arquivo antigo não é tocado');
    assert.match(path.basename(host.resumeSession(withHistory, 'calc')), /^opencode-[0-9a-f-]{36}\.json$/, 'a sessão Pi antiga abre nova no OpenCode');
    assert.equal(fs.readFileSync(withHistory, 'utf8'), `${JSON.stringify({type: 'message', message: {role: 'user', content: 'oi'}})}\n`, 'o histórico antigo continua no disco');
  } finally {
    if (before === undefined) delete process.env.LEARNING_DESK_OPENCODE; else process.env.LEARNING_DESK_OPENCODE = before;
    process.env.PATH = beforePath;
  }
});

test('sessão Pi antiga sem Pi mostra o histórico em somente leitura (#93)', () => {
  const file = path.join(runtime, 'pi-antigo-sem-motor.jsonl');
  const raw = [
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'pergunta antiga'}]}},
    {type: 'message', message: {role: 'assistant', content: [{type: 'text', text: 'resposta antiga'}]}},
  ].map((entry) => JSON.stringify(entry)).join('\n') + '\n';
  fs.writeFileSync(file, raw);
  const host = createTutorEngineHost({live: fakeLive({session: file}), runtime, deskDir, TEST_MODE: true, FREE_ID: 'mesa-free'});
  const data = host.conversationData();
  assert.equal(data.engine, 'pi');
  assert.deepEqual(data.visibleEngines, host.visibleEngines(), 'a vista vai no payload de toda conversa');
  assert.deepEqual(data.messages.map((message) => [message.role, message.content[0].text]), [['user', 'pergunta antiga'], ['assistant', 'resposta antiga']]);
  assert.equal(fs.readFileSync(file, 'utf8'), raw, 'o JSONL nunca é tocado');
  assert.equal(host.conversationData({messages: false}).messages, undefined, 'a leitura pesada só quando pedida');
});
