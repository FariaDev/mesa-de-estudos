/* Adaptador OpenCode (#57) contra o `opencode serve` falso: sessão com pasta
   e MCP mesa, os três desfechos da entrega, steer, comandos, compactação,
   controles e medidor. Nenhum modelo de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {parseMessage} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');
/* Um `ses_` como o servidor cunha (o adaptador nunca cunha o seu). */
const SERVER_ID = 'ses_ea5e2000affeZzYyXxWwVvUuTt';
const fakeReadVersion = async () => 'opencode v2.2.4';

const PASSWORD = 'senha-de-teste';
const SYSTEM = 'Você é o tutor da Mesa.';

/** Adaptador ligado ao fake, com os eventos e as fases da entrega guardados. */
function createHarness(serve, overrides = {}) {
  const events = [];
  const deliveries = [];
  const adopted = [];
  const lease = {baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode', ...(overrides.lease || {})};
  const adapter = new OpenCodeAdapter({conversationId: 'conv-1', sessionId: '', onSessionId: (id) => adopted.push(id), acquire: async () => lease, directory: '/tmp/mesa-ws/conv-1',
    systemPrompt: SYSTEM, persistDelivery: (patch) => deliveries.push(patch), mcpConfig: () => ({type: 'local', command: ['node', 'mesa-mcp.mjs']}), readVersion: fakeReadVersion, ...overrides});
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

test('connect deixa o servidor cunhar o ses_ e cria a sessão com a pasta e o MCP mesa', async (t) => {
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
  assert.equal(created.body.permissions, undefined, 'sem permissões de ferramenta: o config já desliga as nativas (#91)');
  const mcp = serve.requests.find((item) => item.method === 'PUT');
  assert.equal(mcp.url, '/api/experimental/mcp/mesa?location%5Bdirectory%5D=%2Ftmp%2Fmesa-ws%2Fconv-1');
  /* #91: o catálogo não leva mais a query `location` que aquecia a pasta só
     para o plugin da jaula carregar (#89). */
  assert.ok(serve.requests.some((item) => item.method === 'GET' && item.url === '/api/model'), 'catálogo sem a query da jaula');
  assert.equal(mcp.body.config.type, 'local');
  assert.ok(serve.requests.every((item) => item.authorized));
  assert.equal(events.find((item) => item.type === 'init').sessionId, adapter.sessionId);
});

test('connect espera o MCP ficar conectado antes de criar a sessão e enviar', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, mcpStatus: 'pending'});
  t.after(() => serve.close());
  const {adapter} = createHarness(serve);
  t.after(() => adapter.stop());
  let settled = false;
  const connecting = adapter.connect().then(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(settled, false, 'o connect não resolve enquanto o MCP está pending');
  assert.equal(serve.requests.some((item) => item.method === 'POST' && item.url === '/api/session'), false, 'a sessão não nasce antes do MCP');
  serve.state.mcpStatus = 'connected';
  await connecting;
  assert.equal(settled, true);
  assert.ok(serve.requests.some((item) => item.method === 'GET' && item.url.startsWith('/api/mcp')), 'consultou o estado do MCP');
  assert.ok(serve.requests.some((item) => item.method === 'POST' && item.url === '/api/session'), 'a sessão nasce depois do MCP');
});

test('connect segue no status conectado, sem gastar o prazo do MCP nem avisar', async (t) => {
  /* O `/api/mcp` real responde só `{name, status: {status}}`: esperar uma lista
     de ferramentas custava 10 s em toda conexão, com aviso falso (596ecc4). */
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  const started = Date.now();
  await adapter.connect();
  assert.ok(Date.now() - started < 5000, `conectou em ${Date.now() - started} ms`);
  assert.equal(JSON.stringify(events).includes('OPENCODE_MCP_FAILED'), false, 'sem aviso falso');
});

test('o título da sessão vem da interface, não do marcador cru (#93)', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter} = createHarness(serve, {sessionTitle: 'Mesa de Estudos'});
  t.after(() => adapter.stop());
  await adapter.connect();
  const created = serve.requests.find((item) => item.method === 'POST' && item.url === '/api/session');
  assert.equal(created.body.title, 'Mesa de Estudos');
  assert.notEqual(created.body.title, 'opencode.session.title');
});

test('OpenCode 1.x é recusado antes de qualquer pedido, com a versão na frase', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter} = createHarness(serve, {readVersion: async () => 'opencode v1.19.5'});
  t.after(() => adapter.stop());
  await assert.rejects(adapter.send({id: 'u1', text: 'oi'}), (error) => {
    const parsed = parseMessage(error.message);
    return parsed?.key === 'err.opencode.versionUnsupported' && parsed.args.version === '1.19.5' && error.notSent === true;
  });
  assert.deepEqual(serve.requests, [], 'a versão é lida antes de sessão, MCP ou prompt');
  assert.equal(adapter.sessionId, '', 'nenhum ses_ foi cunhado');
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

test('as instruções da Mesa vão no canal da sessão e saem do histórico', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'primeira'});
  await waitFor(events, (item) => item.type === 'turn_end', 'primeiro turno');
  await adapter.send({id: 'u2', text: 'segunda'});
  const prompts = serve.requests.filter((item) => item.url.endsWith('/prompt'));
  assert.equal(prompts[0].body.text, 'primeira');
  assert.equal(prompts[1].body.text, 'segunda');
  assert.match(prompts[0].body.id, /^msg_/);
  const put = serve.requests.find((item) => item.method === 'PUT' && item.url.includes('/instructions/entries/mesa'));
  assert.equal(put.body.value, SYSTEM);
  const history = await adapter.history();
  assert.equal(history.find((item) => item.role === 'user').content[0].text, 'primeira');
  assert.ok(history.find((item) => item.role === 'user').timestamp > 0, 'o histórico guarda time.created');
});

test('histórico lê todas as páginas da sessão', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, pageSize: 1});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'primeira'});
  await waitFor(events, (item) => item.type === 'turn_end', 'primeiro turno');
  await adapter.send({id: 'u2', text: 'segunda'});
  await waitFor(events, (item) => item.type === 'turn_end' && events.filter((e) => e.type === 'turn_end').length === 2, 'segundo turno');
  const history = await adapter.history();
  assert.deepEqual(history.filter((item) => item.role === 'user').map((item) => item.content[0].text), ['primeira', 'segunda']);
  assert.ok(serve.requests.filter((item) => item.url.includes('/message')).length >= 4, 'seguiu o cursor');
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
  assert.equal(prompts[1].body.text, 'oi de novo');
  assert.ok(serve.requests.some((item) => item.method === 'PUT' && item.url.includes('/instructions/entries/mesa')));
});

test('sem canal de instruções o prompt vai marcado e não volta como fala', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, instructionsStatus: 404});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'primeira'});
  await waitFor(events, (item) => item.type === 'turn_end', 'turno');
  const prompt = serve.requests.find((item) => item.url.endsWith('/prompt')).body.text;
  assert.match(prompt, /\[\[mesa-tutor-prompt\]\]/);
  assert.match(prompt, new RegExp(SYSTEM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt, /primeira$/);
  const history = await adapter.history();
  assert.equal(history.find((item) => item.role === 'user').content[0].text, 'primeira');
  assert.equal(history.filter((item) => item.role === 'user').length, 1);
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

test('pedido de permissão inesperado é recusado na hora, sem diálogo', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, permission: {action: 'bash', resources: ['ls *']}});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'liste'});
  const warning = await waitFor(events, (item) => item.type === 'warning' && item.code === 'OPENCODE_PERMISSION_REFUSED', 'aviso de recusa');
  assert.ok(warning.message);
  const reply = serve.requests.find((item) => item.method === 'POST' && item.url.includes('/permission/') && item.url.endsWith('/reply'));
  assert.deepEqual(reply.body, {decision: 'reject'});
  assert.equal(events.some((item) => item.type === 'permission_request'), false, 'nunca abre diálogo');
});

test('1.19.5: o pedido inesperado também é recusado pelo campo reply', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, permission: {action: 'read', resources: ['*.env']}, permissionEvent: 'v2', permissionReply: 'reply'});
  t.after(() => serve.close());
  const {adapter, events} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'leia'});
  await waitFor(events, (item) => item.type === 'warning' && item.code === 'OPENCODE_PERMISSION_REFUSED', 'aviso de recusa');
  const reply = await waitFor(serve.requests, (item) => item.method === 'POST' && item.url.includes('/permission/') && item.url.endsWith('/reply') && item.body?.reply === 'reject', 'reply de recusa');
  assert.deepEqual(reply.body, {reply: 'reject'});
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

test('o MCP sobe junto com o catálogo e o SSE só começa depois da sessão', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const spans = [];
  let inflight = 0;
  let maxInflight = 0;
  const fetchImpl = async (input, init) => {
    const url = String(input);
    const slow = url.includes('/api/model') || url.includes('/mcp/');
    inflight += 1;
    maxInflight = Math.max(maxInflight, inflight);
    const start = performance.now();
    if (slow) await new Promise((resolve) => setTimeout(resolve, 50));
    try { return await fetch(input, init); }
    finally { inflight -= 1; spans.push({url, start, end: performance.now()}); }
  };
  let acquires = 0;
  const {adapter, events} = createHarness(serve, {
    fetch: fetchImpl,
    acquire: async () => { acquires += 1; return {baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'}; },
  });
  t.after(() => adapter.stop());
  await adapter.connect();
  const model = spans.find((span) => span.url.includes('/api/model'));
  const mcp = spans.find((span) => span.url.includes('/mcp/'));
  const session = spans.find((span) => span.url.endsWith('/api/session'));
  const sse = spans.find((span) => span.url.includes('/api/event'));
  assert.ok(model && mcp && model.start < mcp.end && mcp.start < model.end, 'catálogo e MCP se sobrepõem');
  assert.ok(maxInflight >= 2);
  assert.ok(session && sse && sse.start + 2 >= session.end, 'o canal de eventos espera a sessão');
  assert.ok(events.some((event) => event.type === 'init' && event.sessionId));
  await adapter.initializeControls();
  assert.equal(acquires, 1, 'controles já prontos não religam o servidor');
});

test('steer aceito NÃO abre outro turno: a resposta interrompida não duplica (#89)', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, turnDelayMs: 150});
  t.after(() => serve.close());
  const {adapter, events, deliveries} = createHarness(serve);
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'primeira'});
  await waitFor(events, (item) => item.type === 'turn_start', 'turno principal');
  const mainRun = events.find((item) => item.type === 'turn_start').runId;
  await adapter.send({id: 'u2', text: 'mude', delivery: 'steer'});
  assert.equal(events.filter((item) => item.type === 'turn_start').length, 1, 'steer não reabre o turno');
  await waitFor(events, (item) => item.type === 'turn_end', 'fim do turno');
  const after = events.filter((item) => item.type === 'message_end' || item.type === 'turn_end');
  assert.ok(after.every((item) => item.runId === mainRun), 'eventos seguem no MESMO runId');
  assert.deepEqual(deliveries, [{id: 'u1', status: 'accepted'}, {id: 'u2', status: 'accepted'}, {id: 'u1', status: 'settled'}],
    'o turno principal liquida a entrega principal, não o steer');
});

test('erro imediato do provedor chega DEPOIS do turn_start e abre o diário (#89)', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, failTurn: 'free-tier', turnDelayMs: 5});
  t.after(() => serve.close());
  const delayed = [];
  const {adapter, events} = createHarness(serve, {
    persistDelivery: async (patch) => { await new Promise((resolve) => setTimeout(resolve, 100)); delayed.push(patch); },
  });
  t.after(() => adapter.stop());
  await adapter.send({id: 'u1', text: 'oi'});
  await waitFor(events, (item) => item.type === 'turn_end', 'fim com erro');
  const order = events.filter((item) => ['turn_start', 'error', 'turn_end'].includes(item.type)).map((item) => item.type);
  assert.deepEqual(order, ['turn_start', 'error', 'turn_end']);
  assert.equal(events.find((item) => item.type === 'error').fatal, false);
  assert.equal(adapter.snapshot().busy, false);
});


test('a sessão temporária é apagada com a pasta na query; 404 vira log, não sucesso (#93)', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  t.after(() => serve.close());
  const logs = [];
  const {adapter} = createHarness(serve, {deleteSessionOnStop: true, log: (_area, line) => logs.push(line)});
  await adapter.connect();
  const id = adapter.sessionId;
  assert.ok(serve.sessions.has(id));
  await adapter.stop();
  const deleted = serve.requests.find((item) => item.method === 'DELETE');
  assert.equal(deleted.url, `/api/session/${encodeURIComponent(id)}?location%5Bdirectory%5D=%2Ftmp%2Fmesa-ws%2Fconv-1`,
    'sem a pasta na query o 2.2.4 responde 404 e a sessão fica');
  assert.equal(serve.sessions.has(id), false, 'a sessão temporária some do servidor');
  assert.deepEqual(logs, [], 'a exclusão que deu certo não escreve log');

  const failures = [];
  const failing = new OpenCodeAdapter({conversationId: 'conv-404', sessionId: 'ses_404', directory: '/tmp/mesa-ws/conv-404',
    acquire: async () => { throw Error('não deveria conectar'); }, deleteSessionOnStop: true, log: (_area, line) => failures.push(line)});
  failing.client = {request: async () => ({ok: false, status: 404, payload: null, text: ''})};
  await failing.deleteTemporarySession();
  assert.equal(failures.length, 1, 'a recusa é registrada');
  assert.match(failures[0], /ses_404.*HTTP 404/);
});
