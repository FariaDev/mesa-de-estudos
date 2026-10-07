/* Fábrica do canal Claude do chat lateral: wiring do descritor PRÓPRIO, cache de
   mensagens, permissões e incerteza — com adaptador fake, nada de SDK real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createClaudeSideEngine} = require('../sidechat-engine.cjs');
const {ClaudeService} = require('../src/agents/service.cjs');
const conversations = require('../src/agents/conversations.cjs');

class FakeAdapter extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.sent = [];
    this.responses = [];
    this.policies = [];
    this.cancelled = 0;
    this.stopped = false;
    this.initialized = 0;
    FakeAdapter.instances.push(this);
  }
  async connect() {}
  async initializeControls() {
    this.initialized += 1;
    return {};
  }
  setToolPolicy(policy) {
    this.policies.push(policy);
    return policy;
  }
  controlsSnapshot() {
    return {models: [], levels: [], selection: {model: null, effort: null}, modelSelection: false, effort: false};
  }
  snapshot() {
    return {busy: false, model: {id: 'claude-test', input: ['text']}};
  }
  async history() {
    return [];
  }
  async send(input) {
    this.sent.push(input);
    await this.options.persistDelivery?.({id: input.id, status: 'accepted'});
    this.emit('event', {type: 'delivery', id: input.id, status: 'accepted'});
    return {id: input.id, accepted: true};
  }
  async cancel() {
    this.cancelled += 1;
    return {cancelled: true};
  }
  respond(input) {
    this.responses.push(input);
    return {ok: true};
  }
  stop() {
    this.stopped = true;
  }
}
FakeAdapter.instances = [];

function newRuntime() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-claude-'));
}

function build(runtime, descriptor) {
  const events = [];
  const engine = createClaudeSideEngine({
    id: 'sc-lateral',
    descriptor,
    runtime,
    prepare: (record) => ({cwd: runtime, systemPrompt: `prompt-${record.id}`}),
    sdkLoader: null,
    claudePath: '/fake/claude',
    onEvent: (event) => events.push(event),
    deps: {Adapter: FakeAdapter, Service: ClaudeService},
  });
  return {engine, events, adapter: FakeAdapter.instances.at(-1)};
}

test('canal Claude: descritor próprio, política de leitura por prompt e cache persistido', async () => {
  const runtime = newRuntime();
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'Calculo I'});
  const {engine, events, adapter} = build(runtime, descriptor);
  assert.equal(adapter.options.conversationId, descriptor);
  assert.equal(adapter.options.claudePath, '/fake/claude', 'sem executável fixado, usa o binário do host');
  assert.equal(adapter.options.deliveryUncertain, false);
  assert.deepEqual(adapter.options.toolPolicy.readRoots, [runtime]);
  const result = await engine.prompt({text: 'olá claude', readPaths: ['/a.pdf', '/b.pdf', '/c.pdf']});
  assert.equal(result.accepted, true);
  assert.equal(adapter.sent.length, 1);
  assert.equal(adapter.sent[0].text, 'olá claude');
  assert.deepEqual(adapter.policies.at(-1), {readPaths: ['/a.pdf', '/b.pdf'], readRoots: [runtime]});
  const record = conversations.readClaudeConversation(descriptor, {runtime});
  assert.equal(record.delivery.status, 'accepted');
  assert.equal(record.nativeEstablished, true, 'aceite marca a sessão nativa do lateral');
  assert.deepEqual(record.messages.map((message) => message.role), ['user']);
  adapter.emit('event', {type: 'message_end', conversationId: descriptor, message: {role: 'assistant', content: [{type: 'text', text: 'resposta do claude'}]}});
  const after = conversations.readClaudeConversation(descriptor, {runtime});
  assert.deepEqual(after.messages.map((message) => message.role), ['user', 'assistant']);
  assert.deepEqual(events.map((event) => event.type), ['message_end']);
  assert.equal(events[0].conversationId, descriptor);
  assert.equal(engine.isBusy(), false);
  assert.equal(engine.isUncertain(), false);
  fs.rmSync(runtime, {recursive: true, force: true});
});

test('canal Claude: permissão roteada e cancelamento passam pelo próprio adaptador', async () => {
  const runtime = newRuntime();
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'Calculo I'});
  const {engine, events, adapter} = build(runtime, descriptor);
  adapter.emit('event', {type: 'permission_request', id: 'pedido-1', method: 'confirm', title: 'Permitir leitura?'});
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'extension_ui_request');
  assert.equal(events[0].id, 'pedido-1');
  assert.equal(events[0].permission, true);
  assert.deepEqual(engine.respond({id: 'pedido-1', confirmed: true}), {ok: true});
  assert.deepEqual(adapter.responses, [{id: 'pedido-1', confirmed: true}]);
  const aborted = await engine.abort();
  assert.equal(adapter.cancelled, 1);
  assert.deepEqual(aborted, {cancelled: true});
  engine.close();
  assert.equal(adapter.stopped, true, 'fechar o canal encerra só a consulta do lateral');
  fs.rmSync(runtime, {recursive: true, force: true});
});

test('incerteza hidratada do descritor bloqueia novo envio no canal Claude', async () => {
  const runtime = newRuntime();
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'Calculo I'});
  conversations.updateClaudeConversation(descriptor, {delivery: {id: 'antigo', status: 'uncertain'}}, {runtime});
  const {engine, adapter} = build(runtime, descriptor);
  assert.equal(adapter.options.deliveryUncertain, true);
  assert.equal(engine.isUncertain(), true);
  await assert.rejects(
    () => engine.prompt({text: 'não repete', readPaths: []}),
    (error) => error.notSent === true && /incerta/i.test(error.message),
  );
  assert.equal(adapter.sent.length, 0);
  fs.rmSync(runtime, {recursive: true, force: true});
});

test('descritor Claude inválido nunca vira Pi: a fábrica recusa', () => {
  const runtime = newRuntime();
  const fake = path.join(runtime, 'conversations', 'claude-11111111-1111-4111-8111-111111111111.json');
  fs.mkdirSync(path.dirname(fake), {recursive: true});
  fs.writeFileSync(fake, '{ isto não é um descritor }');
  assert.throws(() => build(runtime, fake), /inválido|indisponível/i);
  fs.rmSync(runtime, {recursive: true, force: true});
});
