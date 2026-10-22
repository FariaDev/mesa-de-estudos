/* Fiação do tutor OpenCode (#57): o que os motores nativos gravam no
   descritor, o prefixo do motor na lista, a escolha de modelo/esforço, o MCP
   `mesa` sem chave e o host que delega o ciclo de vida ao dono do servidor e
   identifica chamadas de atividade. Tudo por código-fonte e fakes com nome:
   sem Electron, sem servidor e sem rede. */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseMessage} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {nativePersistence, previewOf} = require('../src/agents/native-persistence.cjs');
const conversations = require('../src/agents/conversations.cjs');
const {engineLabelPrefix} = require('../lib.cjs');
const {selectionFromChange} = require('../src/agents/opencode-controls.cjs');
const {createOpenCodeTutorHost, mesaMcpConfig, MCP_SERVER} = require('../opencode-tutor-host.cjs');

const temps = [];
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-oc-'));
  temps.push(dir);
  return dir;
}
after(() => {
  for (const dir of temps) fs.rmSync(dir, {recursive: true, force: true});
});

test('previewOf usa a primeira fala do aluno, corta em 160 e cai no fallback sem texto', () => {
  const long = 'a'.repeat(200);
  const messages = [
    {role: 'assistant', content: [{type: 'text', text: 'resposta'}]},
    {role: 'user', content: [{type: 'thinking', thinking: 'pensar'}, {type: 'text', text: long}]},
    {role: 'user', content: [{type: 'text', text: 'segunda fala'}]},
  ];
  assert.equal(previewOf(messages, 'fallback'), 'a'.repeat(160));
  assert.equal(previewOf([{role: 'user', content: [{type: 'thinking', thinking: 'pensar'}]}], 'sem texto'), 'sem texto');
  assert.equal(previewOf([], 'sem fala'), 'sem fala');
});

test('nativePersistence grava entrega aceita, mensagens, prefixo e modelo no descritor OpenCode', () => {
  const runtime = tempDir();
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'c', engine: 'opencode'});
  const persistence = nativePersistence({descriptor, runtime, preview: 'prévia da lista'});

  persistence.persistDelivery({id: 'd1', status: 'accepted'});
  let record = conversations.readClaudeConversation(descriptor, {runtime});
  assert.deepEqual(record.delivery, {id: 'd1', status: 'accepted'});
  assert.equal(record.nativeEstablished, true);

  const messages = [
    {role: 'assistant', content: [{type: 'text', text: 'resposta'}]},
    {role: 'user', content: [{type: 'text', text: 'primeira fala'}]},
    {role: 'user', content: [{type: 'text', text: 'segunda fala'}]},
  ];
  persistence.onMessages(messages, {importedPrefixLength: 2});
  record = conversations.readClaudeConversation(descriptor, {runtime});
  assert.deepEqual(record.messages, messages);
  assert.equal(record.importedPrefixLength, 2);
  assert.equal(record.preview, 'primeira fala');

  persistence.onSelection({model: 'opencode/big-pickle'});
  record = conversations.readClaudeConversation(descriptor, {runtime});
  assert.equal(record.model, 'opencode/big-pickle');
});

test('engineLabelPrefix só marca Claude e OpenCode; Pi e valores estranhos ficam vazios', () => {
  assert.equal(engineLabelPrefix('claude'), 'Claude Code · ');
  assert.equal(engineLabelPrefix('opencode'), 'OpenCode · ');
  for (const engine of ['pi', '', undefined, 'toString']) assert.equal(engineLabelPrefix(engine), '');
});

test('selectionFromChange troca para provider/id, zera esforço, aceita default e recusa modelo/esforço inválidos', () => {
  const current = {model: 'opencode/antigo', effort: 'high'};
  assert.deepEqual(selectionFromChange(current, {model: {provider: 'anthropic', id: 'claude-sonnet'}}), {model: 'anthropic/claude-sonnet', effort: null});
  assert.deepEqual(selectionFromChange(current, {level: 'default'}), {model: 'opencode/antigo', effort: null});
  assert.deepEqual(selectionFromChange(current, {level: 'high'}), {model: 'opencode/antigo', effort: 'high'});
  assert.deepEqual(selectionFromChange(current, {}), current);

  for (const model of [{provider: '', id: 'x'}, {provider: 'p'}, null]) {
    assert.throws(() => selectionFromChange(current, {model}), (error) => {
      assert.equal(parseMessage(error.message)?.key, 'err.model.notInTutor');
      return true;
    });
  }
  assert.throws(() => selectionFromChange(current, {level: 7}), (error) => {
    assert.equal(parseMessage(error.message)?.key, 'err.model.effort');
    return true;
  });
});

test('mesaMcpConfig monta o MCP local com o Node do app, as pontes e o idioma, nunca uma chave', () => {
  const grant = {scope: 'atividade', expires: 123};
  const config = mesaMcpConfig({execPath: '/electron', ggbBridge: '/tmp/ggb.json', activityGrant: grant, tutorLanguage: 'pt-BR'});
  assert.equal(config.type, 'local');
  assert.deepEqual(config.command, ['/electron', MCP_SERVER]);
  assert.equal(config.enabled, true);
  assert.equal(config.codemode, false, '#70: sem Code Mode, as ferramentas aparecem como mesa_<nome> e o quadro tem slot');
  assert.equal(config.environment.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(config.environment.LEARNING_DESK_GGB_BRIDGE, '/tmp/ggb.json');
  assert.equal(config.environment.LEARNING_DESK_ACTIVITY_BRIDGE, JSON.stringify(grant));
  assert.equal(config.environment.LEARNING_DESK_TUTOR_LANGUAGE, 'pt-BR');
  assert.ok(!Object.keys(config.environment).some((name) => name.includes('KEY')));

  const withoutGrant = mesaMcpConfig({execPath: '/electron', ggbBridge: '/tmp/ggb.json', activityGrant: null, tutorLanguage: 'en'});
  assert.equal(withoutGrant.environment.LEARNING_DESK_ACTIVITY_BRIDGE, '');
  assert.ok(!Object.keys(withoutGrant.environment).some((name) => name.includes('KEY')));
});

test('o host do tutor delega sweep e stop ao dono falso e identifica só chamadas OpenCode depois do connect', async () => {
  const calls = [];
  const seen = {};
  function fakeServeOwner(options) {
    seen.options = options;
    return {
      acquire: () => {
        calls.push('acquire');
        return Promise.resolve({baseUrl: 'http://fake', password: '', binary: '/fake/opencode'});
      },
      stop: () => { calls.push('stop'); },
      sweepAtBoot: () => {
        calls.push('sweepAtBoot');
        return {killed: [], skipped: [], entry: null};
      },
    };
  }

  const runtime = tempDir();
  const live = {opencodeHost: {keyEnv: () => ({})}};
  const host = createOpenCodeTutorHost({
    live,
    runtime,
    ggbBridge: () => '/tmp/ggb.json',
    appendLog: () => {},
    captureActivityScope: () => ({scope: 'teste'}),
    prepareOpenCode: () => { throw new Error('connect não deveria rodar neste teste'); },
    openCodeBinary: () => '/fake/opencode',
    createOwner: fakeServeOwner,
  });

  assert.equal(seen.options.cwd, path.join(runtime, 'opencode-workspaces'));
  assert.equal(seen.options.ledgerDir, runtime);

  const otherEngine = {engine: 'claude', paramsHash: 'h1'};
  assert.strictEqual(await host.identifyCaller(otherEngine), otherEngine);
  const alreadyClaimed = {engine: 'opencode', paramsHash: 'h2', toolCallId: 'call_1'};
  assert.strictEqual(await host.identifyCaller(alreadyClaimed), alreadyClaimed);
  const beforeConnect = {engine: 'opencode', paramsHash: 'h3'};
  assert.strictEqual(await host.identifyCaller(beforeConnect), beforeConnect);

  assert.deepEqual(host.sweepAtBoot(), {killed: [], skipped: [], entry: null});
  host.stop();
  assert.deepEqual(calls, ['sweepAtBoot', 'stop']);
});

test('connect liga o serviço OpenCode e o livro casa a atividade do MCP com o id visto no SSE', async () => {
  const runtime = tempDir();
  const session = conversations.createClaudeConversation({runtime, courseId: 'c', engine: 'opencode'});
  const record = conversations.readClaudeConversation(session, {runtime});
  const grants = [];
  const live = {session, opencodeHost: {keyEnv: () => ({})}, languageHost: {tutorLanguage: () => 'pt-BR'},
    activityBridge: {grant: (scope, options) => { grants.push(options); return {url: 'http://127.0.0.1:1/a', token: 't'}; }}};
  const host = createOpenCodeTutorHost({live, runtime, ggbBridge: () => '/tmp/ggb.json', appendLog: () => {},
    captureActivityScope: () => ({conversationId: session}), openCodeBinary: () => '',
    prepareOpenCode: () => ({cwd: runtime, systemPrompt: 'mesa', record}),
    createOwner: () => ({acquire: () => Promise.reject(Error('sem servidor no teste')), stop: () => {}, sweepAtBoot: () => ({})})});
  const service = host.connect();
  assert.equal(service.engine, 'opencode');
  assert.deepEqual(grants, [{engine: 'opencode'}]);
  const {pickPayload} = require('../activity-bridge.cjs');
  const args = {title: 'Derivada', objective: 'ver', alternativeMarkdown: 'texto', html: '<p>x</p>'};
  service.adapter.emit('event', {type: 'tool_start', name: 'mesa_criar_atividade', id: 'call_9', args});
  const caller = await host.identifyCaller({engine: 'opencode', paramsHash: pickPayload(args).paramsHash});
  assert.equal(caller.toolCallId, 'call_9');
  host.release();
  const after = {engine: 'opencode', paramsHash: 'x'};
  assert.strictEqual(await host.identifyCaller(after), after);
});
