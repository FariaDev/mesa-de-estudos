/* Adaptador OpenCode (#57) contra o `opencode serve` falso: sessão com pasta
   e permissões de estudo, os três desfechos da entrega, steer, comandos,
   compactação, permissões, controles e medidor. Nenhum modelo de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {parseMessage} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {OpenCodeAdapter, STUDY_PERMISSIONS} = require('../src/agents/opencode-adapter.cjs');
/* Um `ses_` como o servidor cunha (o adaptador nunca cunha o seu). */
const SERVER_ID = 'ses_ea5e2000affeZzYyXxWwVvUuTt';

const PASSWORD = 'senha-de-teste';
const SYSTEM = 'Você é o tutor da Mesa.';

/** Adaptador ligado ao fake, com os eventos e as fases da entrega guardados. */
function createHarness(serve, overrides = {}) {
  const events = [];
  const deliveries = [];
  const adopted = [];
  const lease = {baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'};
  const adapter = new OpenCodeAdapter({conversationId: 'conv-1', sessionId: '', onSessionId: (id) => adopted.push(id), acquire: async () => lease, directory: '/tmp/mesa-ws/conv-1',
    systemPrompt: SYSTEM, persistDelivery: (patch) => deliveries.push(patch), mcpConfig: () => ({type: 'local', command: ['node', 'mesa-mcp.mjs']}), ...overrides});
  adapter.on('event', (event) => events.push(event));
  return {adapter, events, deliveries, lease, adopted};
}

/** Espera um evento que cumpra o predicado (o SSE é assíncrono). */
async function waitFor(events, predicate, label) {
  for (let i = 0; i < 200; i++) {
    const found = events.find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw Error(`evento não chegou: ${label}`);
}

const keyOf = (error) => parseMessage(error.message)?.key;

test('connect deixa o servidor cunhar o ses_ e cria a sessão com a pasta, as permissões de estudo e o MCP mesa', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter, events, adopted} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.connect();
  const created = serve.requests.find((item) => item.method === 'POST' && item.url === '/api/session');
  /* Regressão do 403 do grátis (2026-10-20): o id sai do servidor, nunca da Mesa. */
  assert.equal('id' in created.body, false);
  assert.ok(serve.sessions.has(adapter.sessionId));
  assert.deepEqual(adopted, [adapter.sessionId]);
  assert.deepEqual(created.body.location, {directory: '/tmp/mesa-ws/conv-1'});
  assert.deepEqual(created.body.permissions, STUDY_PERMISSIONS);
  assert.deepEqual(STUDY_PERMISSIONS.map((rule) => rule.action), ['edit', 'shell', 'subagent', 'browser']);
  const mcp = serve.requests.find((item) => item.method === 'PUT');
  assert.equal(mcp.url, '/api/experimental/mcp/mesa?location%5Bdirectory%5D=%2Ftmp%2Fmesa-ws%2Fconv-1');
  assert.equal(mcp.body.config.type, 'local');
  assert.ok(serve.requests.every((item) => item.authorized));
  assert.equal(events.find((item) => item.type === 'init').sessionId, adapter.sessionId);
});

test('id de sessão fora do formato ses_ é recusado antes de qualquer escrita', () => {
  assert.throws(() => new OpenCodeAdapter({sessionId: 'b7d1-uuid', acquire: async () => null, directory: '/tmp'}), (error) => keyOf(error) === 'err.opencode.badSession' && error.notSent === true);
});

test('envio aceito abre o turno, a resposta chega pelo SSE e o turno fecha como settled', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, reply: () => 'Derivada é taxa de variação.'});
  t.after(() => serve.close());
  const {adapter, events, deliveries} = createHarness(serve);
  t.after(() => adapter.stop());
  const result = await adapter.send({id: 'uuid-1', text: 'O que é derivada?'});
  assert.deepEqual(result, {id: 'uuid-1', accepted: true});
  assert.equal(adapter.snapshot().busy, true);
  await waitFor(events, (item) => item.type === 'turn_end', 'turn_end');
  const start = events.find((item) => item.type === 'message_start');
  const end = events.find((item) => item.type === 'message_end');
  assert.equal(start.message.id, end.message.id);
  assert.equal(end.message.content[0].text, 'Derivada é taxa de variação.');
  assert.deepEqual(deliveries.map((item) => item.status), ['accepted', 'settled']);
  assert.equal(adapter.snapshot().busy, false);
});

test('as instruções da Mesa vão só no primeiro prompt e saem do histórico', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'primeira'});
  await waitFor(events, (item) => item.type === 'turn_end', 'primeiro turno');
  await adapter.send({id: 'u2', text: 'segunda'});
  const prompts = serve.requests.filter((item) => item.url.endsWith('/prompt'));
  assert.equal(prompts[0].body.text, `${SYSTEM}\n\nprimeira`);
  assert.equal(prompts[1].body.text, 'segunda');
  assert.match(prompts[0].body.id, /^msg_/);
  const history = await adapter.history();
  assert.equal(history.find((item) => item.role === 'user').content[0].text, 'primeira');
});

test('recusa comprovada não abre turno, pode repetir e a repetição ainda leva as instruções', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, promptStatus: 409});
  t.after(() => serve.close());
  const {adapter, deliveries} = createHarness(serve);
  t.after(() => adapter.stop());
  await assert.rejects(adapter.send({id: 'u1', text: 'oi'}), (error) => error.notSent === true && keyOf(error) === 'err.opencode.refused');
  assert.deepEqual(deliveries, [{id: 'u1', status: 'refused'}]);
  serve.state.promptStatus = 200;
  await adapter.send({id: 'u2', text: 'oi de novo'});
  const prompts = serve.requests.filter((item) => item.url.endsWith('/prompt'));
  assert.ok(prompts[1].body.text.startsWith(SYSTEM));
});

test('status desconhecido é incerteza: nada de reenvio', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, promptStatus: 500});
  t.after(() => serve.close());
  const {adapter, deliveries} = createHarness(serve);
  t.after(() => adapter.stop());
  await assert.rejects(adapter.send({id: 'u1', text: 'oi'}), (error) => error.uncertain === true && error.notSent === false && keyOf(error) === 'err.opencode.unconfirmed');
  assert.deepEqual(deliveries, [{id: 'u1', status: 'uncertain'}]);
});

test('sem resposta HTTP no envio é incerteza', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  /* `fetch` nomeado que corta só o POST do prompt, como uma rede que caiu no meio. */
  const droppingFetch = (url, init) => (String(url).endsWith('/prompt') ? Promise.reject(Object.assign(Error('socket hang up'), {code: 'ECONNRESET'})) : fetch(url, init));
  const {adapter, deliveries} = createHarness(serve, {fetch: droppingFetch});
  t.after(() => adapter.stop());
  await assert.rejects(adapter.send({id: 'u1', text: 'oi'}), (error) => error.uncertain === true && keyOf(error) === 'err.opencode.unreachable');
  assert.deepEqual(deliveries, [{id: 'u1', status: 'uncertain'}]);
});

test('SSE que cai depois do aceite fecha o turno como incerto', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, dropAfterAccept: true});
  t.after(() => serve.close());
  const {adapter, events, deliveries} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'oi'});
  const end = await waitFor(events, (item) => item.type === 'turn_end', 'turn_end incerto');
  assert.equal(end.uncertain, true);
  assert.deepEqual(deliveries.map((item) => item.status), ['accepted', 'uncertain']);
});

test('steer leva delivery steer no corpo', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'mude de assunto', delivery: 'steer'});
  assert.equal(serve.requests.find((item) => item.url.endsWith('/prompt')).body.delivery, 'steer');
});

test('comando do catálogo é aceito com 204; comando que o servidor não tem é recusa', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  assert.deepEqual((await adapter.commands()).map((item) => item.name), ['init', 'review']);
  assert.ok(serve.requests.some((item) => item.url.startsWith('/api/command?location')));
  assert.deepEqual(await adapter.command({id: 'c1', name: '/review', text: 'a prova'}), {id: 'c1', accepted: true});
  assert.deepEqual(serve.requests.find((item) => item.url.endsWith('/command')).body, {name: 'review', text: 'a prova'});
  await waitFor(events, (item) => item.type === 'turn_end', 'fim do comando');
  await assert.rejects(adapter.command({id: 'c2', name: 'nada'}), (error) => error.notSent === true);
});

test('compactação manual espera o fim pelo SSE e devolve o resumo', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter} = createHarness(serve);
  t.after(() => adapter.stop());
  const result = await adapter.compact({id: 'k1'});
  assert.equal(result.accepted, true);
  assert.equal(result.summary, 'Resumo falso da conversa.');
  assert.equal(serve.requests.find((item) => item.url.endsWith('/compact')).body.delivery, 'steer');
  assert.equal(adapter.snapshot().compacting, false);
});

test('pedido de permissão vira diálogo e a resposta libera o turno', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, ask: true});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'leia o pdf'});
  const ask = await waitFor(events, (item) => item.type === 'permission_request', 'permissão');
  assert.equal(ask.title, '');
  assert.equal(ask.message, 'read: /tmp/x.pdf');
  assert.deepEqual(await adapter.respond({id: ask.id, confirmed: true}), {ok: true, decision: 'once'});
  await waitFor(events, (item) => item.type === 'turn_end', 'turno depois da permissão');
  await assert.rejects(adapter.respond({id: ''}), (error) => keyOf(error) === 'err.opencode.permissionId');
});

test('controles: catálogo liga modelo e esforço, modelo fora do catálogo é recusa e a escolha válida vai ao servidor', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter} = createHarness(serve);
  t.after(() => adapter.stop());
  const before = await adapter.initializeControls();
  assert.equal(before.modelSelection, true);
  assert.equal(before.effort, false);
  await assert.rejects(adapter.setControls({model: 'opencode/nao-existe'}), (error) => error.notSent === true && keyOf(error) === 'opencode.controls.modelUnavailable');
  let saved = null;
  const after = await adapter.setControls({model: 'opencode/deepseek-v4.1-flash-free', effort: 'max'}, {persistSelection: (patch) => { saved = patch; }});
  assert.deepEqual(saved, {model: 'opencode/deepseek-v4.1-flash-free', effort: 'max'});
  assert.deepEqual(after.levels, ['low', 'high', 'max']);
  assert.deepEqual(serve.requests.find((item) => item.method === 'POST' && item.url.endsWith('/model')).body.model, {id: 'deepseek-v4.1-flash-free', providerID: 'opencode', variant: 'max'});
});

test('reabrir conversa cuja sessão sumiu avisa e recria com o mesmo id', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve, {resume: true, sessionId: SERVER_ID});
  t.after(() => adapter.stop());
  await adapter.connect();
  assert.ok(events.some((item) => item.type === 'warning' && item.code === 'OPENCODE_SESSION_MISSING'));
  assert.ok(serve.sessions.has(SERVER_ID));
  assert.equal(serve.requests.find((item) => item.method === 'POST' && item.url === '/api/session').body.id, SERVER_ID);
  /* Reaberta, a conversa já tinha mandado as instruções: não repete. */
  await adapter.send({id: 'u1', text: 'continuando'});
  assert.equal(serve.requests.find((item) => item.url.endsWith('/prompt')).body.text, 'continuando');
});

test('servidor trocado pelo dono religa a sessão no servidor novo', async (t) => {
  const first = await createFakeOpencodeServe({password: PASSWORD});
  const second = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => Promise.all([first.close(), second.close()]));
  let lease = {baseUrl: first.url, password: PASSWORD, binary: '/fake/opencode'};
  const {adapter, adopted} = createHarness(first, {acquire: async () => lease});
  t.after(() => adapter.stop());
  await adapter.connect();
  lease = {...lease, baseUrl: second.url};
  await adapter.connect();
  assert.ok(second.sessions.has(adapter.sessionId));
  assert.equal(second.requests.find((item) => item.method === 'POST' && item.url === '/api/session').body.id, adapter.sessionId, 'o servidor novo recebe o id já cunhado');
  assert.deepEqual(adopted, [adapter.sessionId], 'o descritor grava o id uma vez só');
});

test('medidor de contexto usa os tokens reais da última resposta e o limite do catálogo', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, tokens: {input: 18000, output: 2000, reasoning: 0, cache: {read: 0, write: 0}}});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  assert.equal(await adapter.sessionUsage(), null);
  await adapter.send({id: 'u1', text: 'oi'});
  await waitFor(events, (item) => item.type === 'turn_end', 'turno');
  assert.deepEqual(await adapter.sessionUsage(), {tokens: 20000, contextWindow: 200000, percent: 10});
});

test('403 do grátis no SSE vira error não fatal com a frase própria e fecha o turno com erro (sem bolha muda)', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, failTurn: 'free-tier'});
  t.after(() => serve.close());
  const {adapter, events, deliveries} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'uuid-1', text: 'Diga só: oi'});
  const end = await waitFor(events, (item) => item.type === 'turn_end', 'turn_end');
  const error = events.find((item) => item.type === 'error');
  assert.equal(parseMessage(error.message)?.key, 'opencode.event.freeTier');
  assert.equal(error.fatal, false);
  assert.ok(events.indexOf(error) < events.indexOf(end));
  assert.equal(end.isError, true);
  assert.equal(events.filter((item) => item.type === 'error').length, 1);
  assert.deepEqual(deliveries.map((item) => item.status), ['accepted', 'settled']);
});
