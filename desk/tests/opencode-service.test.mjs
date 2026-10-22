/* Serviço nativo com o motor OpenCode (#57): o mesmo serviço do Claude, com
   steer pela lei `canSteer`, `/comando` do catálogo, compactação e medidor.
   Adaptador real contra o `opencode serve` falso. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {parseMessage} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {NativeService, ClaudeService} = require('../src/agents/service.cjs');
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');

const PASSWORD = 'senha-de-teste';

async function createHarness(t, serveOptions = {}, serviceOptions = {}) {
  const serve = await createFakeOpencodeServe({password: PASSWORD, ...serveOptions});
  const adapter = new OpenCodeAdapter({conversationId: 'conv-1', sessionId: '', directory: '/tmp/mesa-ws/conv-1',
    acquire: async () => ({baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'})});
  const service = new NativeService({adapter, engine: 'opencode', ...serviceOptions});
  const events = [];
  service.on('event', (event) => events.push(event));
  t.after(() => { service.stop(); return serve.close(); });
  return {serve, adapter, service, events};
}

async function waitFor(events, predicate, label) {
  for (let i = 0; i < 200; i++) {
    if (events.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw Error(`evento não chegou: ${label}`);
}

const keyOf = (error) => parseMessage(error.message)?.key;

test('steer com o turno em voo entra com delivery steer; sem turno vira envio normal', async (t) => {
  const {serve, service} = await createHarness(t, {ask: true});
  await service.request('prompt', {message: 'sem turno', streamingBehavior: 'steer'});
  assert.equal(serve.requests.filter((item) => item.url.endsWith('/prompt'))[0].body.delivery, undefined);
  await service.request('prompt', {message: 'mude de assunto', streamingBehavior: 'steer'});
  assert.equal(serve.requests.filter((item) => item.url.endsWith('/prompt'))[1].body.delivery, 'steer');
});

test('envio normal com turno em voo é recusado como ocupado', async (t) => {
  const {service} = await createHarness(t, {ask: true});
  await service.request('prompt', {message: 'primeira'});
  await assert.rejects(service.request('prompt', {message: 'segunda'}), (error) => keyOf(error) === 'opencode.svc.busy' && error.notSent === true);
});

test('entrega incerta fecha até o steer', async (t) => {
  const {service} = await createHarness(t, {ask: true}, {uncertain: true});
  await assert.rejects(service.request('prompt', {message: 'oi', streamingBehavior: 'steer'}), (error) => keyOf(error) === 'opencode.svc.uncertain');
});

test('/review do catálogo vira comando nativo; /outra coisa vai como texto', async (t) => {
  const {serve, service, events} = await createHarness(t);
  assert.deepEqual((await service.request('get_commands')).commands.map((item) => item.name), ['init', 'review']);
  await service.request('prompt', {message: '/review a lista 3'});
  assert.deepEqual(serve.requests.find((item) => item.url.endsWith('/command')).body, {name: 'review', text: 'a lista 3'});
  await waitFor(events, (item) => item.type === 'agent_settled', 'fim do comando');
  await service.request('prompt', {message: '/derivada de x²'});
  assert.equal(serve.requests.find((item) => item.url.endsWith('/prompt')).body.text, '/derivada de x²');
});

test('compactação, medidor e estado passam pelo serviço', async (t) => {
  const {service, events} = await createHarness(t);
  assert.equal((await service.request('compact', {})).summary, 'Resumo falso da conversa.');
  await service.request('prompt', {message: 'oi'});
  await waitFor(events, (item) => item.type === 'agent_settled', 'turno');
  assert.deepEqual((await service.request('get_session_stats')).contextUsage, {tokens: 1000, contextWindow: 200000, percent: 1});
  assert.equal((await service.request('get_state')).isCompacting, false);
  assert.ok(events.some((item) => item.type === 'message_update' && item.assistantMessageEvent.contentIndex === 0));
});

test('motor desconhecido continua sem steer, comandos e medidor; o Claude agora pergunta ao adaptador (#58)', async () => {
  /* Adaptador nomeado mínimo: com os caps fechados, o serviço nem pergunta. */
  const {EventEmitter} = await import('node:events');
  class SilentAdapter extends EventEmitter {
    snapshot() { return {busy: false}; }
    async connect() {}
    async commands() { throw Error('não devia ser chamado'); }
    async sessionUsage() { throw Error('não devia ser chamado'); }
  }
  const unknown = new NativeService({adapter: new SilentAdapter(), engine: 'outro'});
  assert.deepEqual(await unknown.request('get_commands'), {commands: []});
  assert.deepEqual(await unknown.request('get_session_stats'), {});
  await assert.rejects(unknown.request('prompt', {message: 'x', streamingBehavior: 'steer'}), (error) => keyOf(error) === 'claude.svc.noSteer');
  class AskedClaudeAdapter extends SilentAdapter {
    async commands() { return [{name: 'review', description: 'Revisa'}]; }
    async sessionUsage() { return {tokens: 10, contextWindow: 1000, percent: 1}; }
  }
  const claude = new ClaudeService({adapter: new AskedClaudeAdapter()});
  assert.deepEqual(await claude.request('get_commands'), {commands: [{name: 'review', description: 'Revisa'}]});
  assert.deepEqual(await claude.request('get_session_stats'), {contextUsage: {tokens: 10, contextWindow: 1000, percent: 1}});
});
