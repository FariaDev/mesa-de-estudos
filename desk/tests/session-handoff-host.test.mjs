/* Passagem de contexto entre sessões (#87), no host: digest da matéria e da
   Livre, JSONL do Pi lido sem reescrever, teto e recusas. Sem Electron e sem
   motor real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

function errorOf(fn) {
  try { fn(); } catch (error) { return error; }
  return null;
}
const {createSessionHandoffHost} = require('../session-handoff-host.cjs');
const {createTutorEngineHost} = require('../tutor-engine-host.cjs');
const conversations = require('../src/agents/conversations.cjs');
const {parseMessage} = require('../src/i18n.mjs');

const deskDir = path.resolve(import.meta.dirname, '..');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-handoff-'));
process.on('exit', () => fs.rmSync(runtime, {recursive: true, force: true}));

function fakeLive(overrides = {}) {
  return {
    courseId: 'calc',
    courses: [{id: 'calc', name: 'Cálculo', path: '/cursos/calc'}],
    session: '',
    bridge: null,
    state: {
      study: {title: 'Lista 3, exercício 2', xopp: ''},
      pdfs: [{path: '/livros/Stewart.pdf', page: 210}, {path: '/listas/Lista3.pdf', page: 1}],
    },
    ...overrides,
  };
}

function makeHost({live = fakeLive(), visible = ['opencode'], facts = {claude: '/bin/claude', opencode: '/bin/opencode'}, legacyHistory = () => []} = {}) {
  return createSessionHandoffHost({
    runtime, live, FREE_ID: 'mesa-free',
    engine: (file = live.session) => conversations.conversationEngine(file, {runtime}),
    engineFacts: () => facts,
    visibleEngines: () => visible,
    legacyHistory,
    sourceInCourse: () => true,
  });
}

function sourceWithMessages(engine = 'opencode') {
  const file = conversations.createClaudeConversation({runtime, courseId: 'calc', engine});
  conversations.updateClaudeConversation(file, {
    messages: [
      {role: 'user', content: [{type: 'text', text: 'Como resolvo a lista?'}]},
      {role: 'assistant', content: [{type: 'text', text: 'Comece isolando o termo.'}]},
      {role: 'user', content: [{type: 'text', text: 'E depois?'}]},
      {role: 'assistant', content: [{type: 'text', text: 'Aplique a regra do quociente.'}]},
    ],
  }, {runtime});
  return file;
}

test('digest leva matéria, questão, PDFs, último ponto e as falas recentes', () => {
  const live = fakeLive();
  const file = sourceWithMessages('opencode');
  live.session = file;
  const host = makeHost({live});
  const plan = host.planHandoff(file, 'opencode');
  assert.equal(plan.target, 'opencode');
  assert.deepEqual(plan.digest.origin, {session: file, engine: 'opencode'});
  assert.match(plan.digest.text, /Matéria: Cálculo/);
  assert.match(plan.digest.text, /Questão: Lista 3, exercício 2/);
  assert.match(plan.digest.text, /PDFs abertos: Stewart\.pdf, p\.210 · Lista3\.pdf, p\.1/);
  assert.match(plan.digest.text, /Último ponto: "Aplique a regra do quociente\."/);
  assert.match(plan.digest.text, /aluno: Como resolvo a lista\?/);
  assert.match(plan.digest.text, /tutor: Aplique a regra do quociente\./);
  assert.ok(plan.digest.turns >= 1);
  assert.equal(plan.digest.bytes, Buffer.byteLength(plan.digest.text, 'utf8'));
});

test('JSONL do Pi entra pelo histórico somente leitura e o arquivo não é tocado', () => {
  const file = path.join(runtime, 'pi-1700000000000.jsonl');
  const raw = [
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'pergunta antiga'}]}},
    {type: 'message', message: {role: 'assistant', content: [{type: 'text', text: 'resposta antiga'}]}},
  ].map((line) => JSON.stringify(line)).join('\n') + '\n';
  fs.writeFileSync(file, raw);
  const live = fakeLive({session: file});
  const host = makeHost({
    live,
    legacyHistory: () => [
      {role: 'user', content: [{type: 'text', text: 'pergunta antiga'}]},
      {role: 'assistant', content: [{type: 'text', text: 'resposta antiga'}]},
    ],
  });
  const plan = host.planHandoff(file, 'opencode');
  assert.equal(plan.sourceEngine, 'pi');
  assert.match(plan.digest.text, /aluno: pergunta antiga/);
  assert.match(plan.digest.text, /tutor: resposta antiga/);
  assert.equal(fs.readFileSync(file, 'utf8'), raw, 'o JSONL fica byte a byte');
});

test('digest marca a parte não-texto que ficou de fora (#87)', () => {
  const live = fakeLive();
  const file = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  conversations.updateClaudeConversation(file, {
    messages: [
      {role: 'user', content: [{type: 'text', text: 'pergunta válida'}]},
      {role: 'assistant', content: [{type: 'image', data: 'aGVsbG8=', mimeType: 'image/png'}]},
      {role: 'assistant', content: [{type: 'text', text: 'resposta válida'}]},
    ],
  }, {runtime});
  live.session = file;
  const plan = makeHost({live}).planHandoff(file, 'opencode');
  assert.equal(plan.digest.skipped, 1);
  assert.match(plan.digest.text, /não vieram/);
  assert.match(plan.digest.text, /pergunta válida/);
  assert.match(plan.digest.text, /Último ponto: "resposta válida"/);
});

test('digest da origem Pi marca a linha ilegível que ficou de fora (#87)', () => {
  const file = path.join(runtime, 'pi-parcial-handoff.jsonl');
  fs.writeFileSync(file, `{\n${JSON.stringify({type: 'message', message: {role: 'user', content: 'pergunta legível'}})}\n`);
  const engineHost = createTutorEngineHost({live: fakeLive({session: file}), runtime, deskDir, TEST_MODE: true, FREE_ID: 'mesa-free'});
  const live = fakeLive();
  live.session = file;
  const host = makeHost({live, legacyHistory: (name, stats) => engineHost.legacyHistory(name, stats)});
  const plan = host.planHandoff(file, 'opencode');
  assert.equal(plan.digest.skipped, 1);
  assert.match(plan.digest.text, /não vieram/);
  assert.match(plan.digest.text, /pergunta legível/);
  assert.equal(fs.readFileSync(file, 'utf8').split('\n').length, 3, 'o JSONL continua intacto');
});

test('passagem Pi longa lê o fim: últimas falas no digest e aviso do corte (#87)', () => {
  const file = path.join(runtime, 'pi-longa-handoff.jsonl');
  const lines = [JSON.stringify({type: 'session', sessionId: 'longa'})];
  for (let index = 0; index < 400; index++) {
    lines.push(JSON.stringify({type: 'message', message: {role: index % 2 ? 'assistant' : 'user', content: `enchimento ${index} ${'x'.repeat(900)}`}}));
  }
  lines.push(JSON.stringify({type: 'message', message: {role: 'assistant', content: 'PONTO FINAL ÚNICO'}}));
  fs.writeFileSync(file, lines.join('\n') + '\n');
  assert.ok(fs.statSync(file).size > 200000, 'o arquivo passa da janela de leitura');
  const engineHost = createTutorEngineHost({live: fakeLive({session: file}), runtime, deskDir, TEST_MODE: true, FREE_ID: 'mesa-free'});
  const live = fakeLive();
  live.session = file;
  const host = makeHost({live, legacyHistory: (name, stats, options) => engineHost.legacyHistory(name, stats, options)});
  const plan = host.planHandoff(file, 'opencode');
  assert.match(plan.digest.text, /PONTO FINAL ÚNICO/);
  assert.match(plan.digest.text, /Último ponto: "PONTO FINAL ÚNICO"/);
  assert.match(plan.digest.text, /não vieram/, 'o que ficou de fora do corte entra no aviso');
  assert.ok(plan.digest.skipped >= 1);
  assert.equal(fs.readFileSync(file, 'utf8').split('\n').length, lines.length + 1, 'o JSONL continua intacto');
});

test('teto de 50.000 corta as falas mais antigas e mantém os fatos fixos', () => {
  const live = fakeLive();
  const file = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  conversations.updateClaudeConversation(file, {
    messages: Array.from({length: 8}, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: [{type: 'text', text: `fala ${index}: ${'x'.repeat(12000)}`}],
    })),
  }, {runtime});
  live.session = file;
  const plan = makeHost({live}).planHandoff(file, 'opencode');
  assert.ok(plan.digest.text.length <= 50000, `digest com ${plan.digest.text.length} caracteres`);
  assert.match(plan.digest.text, /Matéria: Cálculo/);
  assert.match(plan.digest.text, /Questão: Lista 3, exercício 2/);
  assert.match(plan.digest.text, /fala 7:/, 'a fala mais recente fica');
  assert.doesNotMatch(plan.digest.text, /fala 0:/, 'a mais antiga cai');
});

test('recusa origem incerta, de outra matéria, destino fora da vista ou não pronto', () => {
  const file = sourceWithMessages('opencode');
  conversations.updateClaudeConversation(file, {delivery: {id: 'envio-1', status: 'uncertain'}}, {runtime});
  const uncertain = makeHost();
  assert.equal(parseMessage(errorOf(() => uncertain.planHandoff(file, 'opencode')).message).key, 'err.handoff.uncertain');

  const other = sourceWithMessages('opencode');
  const host = makeHost({live: fakeLive({courseId: 'outra'})});
  assert.equal(parseMessage(errorOf(() => host.planHandoff(other, 'opencode')).message).key, 'err.handoff.course');

  const visible = makeHost({visible: ['claude']});
  assert.equal(parseMessage(errorOf(() => visible.planHandoff(other, 'opencode')).message).key, 'err.handoff.target');
  const notReady = makeHost({facts: {claude: '', opencode: ''}});
  assert.equal(parseMessage(errorOf(() => notReady.planHandoff(other, 'opencode')).message).key, 'err.handoff.target');
});

test('mode none não digere: vale sem o texto e sem recusar pelo teto', () => {
  const huge = `${'x'.repeat(60000)}`;
  const live = fakeLive({courses: [{id: 'calc', name: huge, path: '/cursos/calc'}]});
  const file = sourceWithMessages('opencode');
  live.session = file;
  const plan = makeHost({live}).planHandoff(file, 'opencode', {mode: 'none'});
  assert.equal(plan.mode, 'none');
  assert.equal(plan.digest.text, '');
  assert.deepEqual(plan.digest.origin, {session: file, engine: 'opencode'});
});

test('teto estourado nos fatos fixos recusa com o tamanho e o teto', () => {
  const huge = `${'x'.repeat(60000)}`;
  const live = fakeLive({courses: [{id: 'calc', name: huge, path: '/cursos/calc'}]});
  const file = sourceWithMessages('opencode');
  live.session = file;
  const error = errorOf(() => makeHost({live}).planHandoff(file, 'opencode'));
  const parsed = parseMessage(error.message);
  assert.equal(parsed.key, 'err.handoff.cap');
  assert.match(parsed.args.size, /^60\d{3}$/);
  assert.equal(parsed.args.cap, '50000');
});

test('digest da sessão Livre usa o nome da aba e não vaza caminho pessoal', () => {
  const file = conversations.createClaudeConversation({runtime, courseId: 'mesa-free', engine: 'opencode'});
  const live = fakeLive({courseId: 'mesa-free', courses: []});
  live.session = file;
  const plan = makeHost({live}).planHandoff(file, 'opencode');
  assert.match(plan.digest.text, /Matéria: Livre/);
});

/* O plano em JS (ADR 0003): a origem continua onde está e o destino nasce
   novo — sem `handoffPlan` no núcleo, que só repetia o código. */
test('o plano preserva a origem e o destino nasce novo', () => {
  const live = fakeLive();
  const file = sourceWithMessages('opencode');
  live.session = file;
  const host = makeHost({live});
  const plan = host.planHandoff(file, 'opencode');
  assert.equal(plan.source, file);
  assert.equal(plan.sourceEngine, 'opencode');
  assert.equal(plan.target, 'opencode');
  assert.deepEqual(plan.digest.origin, {session: file, engine: 'opencode'});
  const carry = host.carryFor(file, 'opencode');
  const dest = conversations.createClaudeConversation({
    runtime, courseId: 'calc', engine: plan.target,
    importedTranscript: carry.importedTranscript, origin: carry.origin, handoff: carry.handoff,
  });
  assert.notEqual(dest, file, 'o destino é um arquivo novo, a origem fica onde está');
  assert.deepEqual(conversations.readClaudeConversation(dest, {runtime}).origin, {session: file, engine: 'opencode'});
});

test('digest não avisa de linha de ferramenta e raciocínio, que existem em toda conversa (#87)', () => {
  const live = fakeLive();
  const file = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  conversations.updateClaudeConversation(file, {
    messages: [
      {role: 'user', content: [{type: 'text', text: 'pergunta'}]},
      {role: 'assistant', content: [{type: 'tool_use', name: 'ler_pdf'}, {type: 'thinking', thinking: 'x'}]},
      {role: 'toolResult', content: [{type: 'text', text: 'saída'}]},
      {role: 'assistant', content: [{type: 'text', text: 'resposta'}]},
    ],
  }, {runtime});
  live.session = file;
  const plan = makeHost({live}).planHandoff(file, 'opencode');
  assert.equal(plan.digest.skipped, 0);
  assert.doesNotMatch(plan.digest.text, /não vieram/);
});
