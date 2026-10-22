/* Paridade do Claude Code com o Pi (#58) contra o SDK fake de
 * `claude-fixtures.mjs`: steer na consulta viva, comandos `/`, compactação
 * manual, medidor de contexto e rascunho de revisão numa consulta temporária.
 * Nenhum binário, credencial ou modelo real: o teste empurra o que o CLI
 * emitiria e prova o que a Mesa escreve e decide. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const {NativeService} = require('../src/agents/service.cjs');
const {createClaudeDraftBridge} = require('../src/agents/claude-review-draft.cjs');
const {generateReviewDraft, draftPrompt} = require('../review-draft.cjs');

const COMMANDS = [{name: 'compact', description: 'Free up context', argumentHint: '<instructions>'}, {name: 'review', description: 'Revisa', argumentHint: ''}];

/* SDK fake cuja consulta também responde `supportedCommands()`. */
function sdkWithCommands(list = COMMANDS) {
  const sdk = fx.fakeSdk();
  const base = sdk.query;
  sdk.query = (args) => {
    const query = base(args);
    query.supportedCommands = typeof list === 'function' ? list : async () => list;
    return query;
  };
  return sdk;
}

function makeAdapter(overrides = {}) {
  const sdk = overrides.sdk || sdkWithCommands();
  const adapter = new ClaudeAdapter({conversationId: 'conv-paridade', cwd: process.cwd(), sdkLoader: async () => sdk, timeoutMs: 2000, ...overrides});
  return {adapter, sdk};
}

/* Turno aceito e em voo: o steer só existe assim. */
async function acceptedTurn(adapter, sdk) {
  await adapter.connect();
  const promise = adapter.send({id: fx.UUID.a, text: 'pergunta'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  await promise;
  return query;
}

function assistantWithUsage(usage, model = 'claude-test') {
  const message = fx.assistantMessage({text: 'resposta', model});
  message.message.usage = usage;
  return message;
}

const boundary = (trigger, pre, post) => ({type: 'system', subtype: 'compact_boundary', compact_metadata: {trigger, pre_tokens: pre, post_tokens: post}, uuid: fx.newUuid(), session_id: fx.UUID.session});
const status = (fields) => ({type: 'system', subtype: 'status', status: null, ...fields, uuid: fx.newUuid(), session_id: fx.UUID.session});

/* ---------------- steer ---------------- */

test('steer entra na MESMA consulta com priority now; o eco aceita só a entrega e o turno segue', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  const query = await acceptedTurn(adapter, sdk);
  const events = fx.collectEvents(adapter);
  const steer = adapter.send({id: fx.UUID.b, text: 'use a fórmula 2', delivery: 'steer'});
  const item = await fx.takeInput(query);
  assert.equal(sdk.state.queries.length, 1, 'nenhuma consulta nova');
  assert.equal(item.uuid, fx.UUID.b);
  assert.equal(item.priority, 'now');
  query.emit(fx.replayMessage(item));
  assert.deepEqual(await steer, {accepted: true, id: fx.UUID.b});
  assert.equal(adapter.snapshot().busy, true, 'o aceite do steer não encerra o turno');
  assert.deepEqual(events.of('delivery').map((e) => [e.id, e.status, e.steer]), [[fx.UUID.b, 'transmitting', true], [fx.UUID.b, 'accepted', true]]);
  /* O `result` que ecoa só o steer é do mesmo turno, não de outro envio. */
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.b}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra o turno');
  assert.equal(events.of('turn_end').at(-1).uncertain, false);
  assert.equal(events.of('warning').some((e) => e.code === 'CLAUDE_RESULT_FOREIGN'), false);
  assert.deepEqual(recorder.calls.map((c) => c.status), ['transmitting', 'accepted', 'transmitting', 'accepted', 'settled']);
  adapter.close();
});

test('steer com o motor ocioso é um envio normal', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const promise = adapter.send({id: fx.UUID.a, text: 'oi', delivery: 'steer'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const item = await fx.takeInput(sdk.state.queries[0]);
  assert.equal(item.priority, undefined);
  sdk.state.queries[0].emit(fx.replayMessage(item));
  await promise;
  adapter.close();
});

test('fila fechada recusa o steer (notSent) e o turno principal continua inteiro', async () => {
  const {adapter, sdk} = makeAdapter();
  await acceptedTurn(adapter, sdk);
  adapter._queue.end();
  await assert.rejects(adapter.send({id: fx.UUID.b, text: 'agora', delivery: 'steer'}), (error) => error.notSent === true);
  assert.equal(adapter._deliveryUncertain, false);
  assert.equal(adapter._turn.degraded, false);
  adapter.close();
});

test('steer sem eco vira incerteza pegajosa: nada é reenviado e o turno termina incerto', async () => {
  const {adapter, sdk} = makeAdapter({timeoutMs: 60});
  const query = await acceptedTurn(adapter, sdk);
  const events = fx.collectEvents(adapter);
  const steer = adapter.send({id: fx.UUID.b, text: 'agora', delivery: 'steer'});
  await fx.takeInput(query);
  await assert.rejects(steer, (error) => error.notSent === false && error.code === 'CLAUDE_DELIVERY_UNCERTAIN');
  assert.equal(events.of('delivery').at(-1).status, 'uncertain');
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra o turno');
  assert.equal(events.of('turn_end').at(-1).uncertain, true, 'o turno degradado fica incerto');
  await assert.rejects(adapter.send({id: fx.UUID.c, text: 'de novo'}), (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN');
  adapter.close();
});

test('a consulta que termina com steer em voo deixa a entrega incerta', async () => {
  const {adapter, sdk} = makeAdapter();
  const query = await acceptedTurn(adapter, sdk);
  const steer = adapter.send({id: fx.UUID.b, text: 'agora', delivery: 'steer'});
  await fx.takeInput(query);
  query.end();
  await assert.rejects(steer, (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN');
  assert.equal(adapter._deliveryUncertain, true);
});

test('o serviço guarda as duas falas e só "steera" com turno do motor em voo', async () => {
  const {adapter, sdk} = makeAdapter();
  const service = new NativeService({adapter, engine: 'claude'});
  const first = service.request('prompt', {message: 'pergunta'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  query.emit(fx.replayMessage(await fx.takeInput(query)));
  await first;
  const second = service.request('prompt', {message: 'na verdade, a 3', streamingBehavior: 'steer'});
  const item = await fx.takeInput(query);
  assert.equal(item.priority, 'now');
  query.emit(fx.replayMessage(item));
  await second;
  assert.deepEqual(service.messages.map((m) => m.content[0].text), ['pergunta', 'na verdade, a 3']);
  service.stop();
});

/* Regressão da janela (#58): o host manda a política de leitura em TODO
   prompt; no steer ela não pode ser trocada (o adaptador recusa com turno
   aberto) e o envio morria antes de sair. */
test('steer com toolPolicy mantém a política do turno e chega à consulta', async () => {
  const {adapter, sdk} = makeAdapter();
  const service = new NativeService({adapter, engine: 'claude'});
  const policy = {readPaths: [], readRoots: []};
  const first = service.request('prompt', {message: 'pergunta', toolPolicy: policy});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  query.emit(fx.replayMessage(await fx.takeInput(query)));
  await first;
  const second = service.request('prompt', {message: 'use a fórmula 2', streamingBehavior: 'steer', toolPolicy: policy});
  const item = await fx.takeInput(query);
  assert.equal(item.priority, 'now');
  query.emit(fx.replayMessage(item));
  await second;
  service.stop();
});

/* ---------------- medidor ---------------- */

test('medidor: uso da última resposta contra a janela do modelUsage; fronteira e uso torto apagam', async () => {
  const {adapter, sdk} = makeAdapter();
  const query = await acceptedTurn(adapter, sdk);
  assert.equal(await adapter.sessionUsage(), null, 'sem resposta medida não há número');
  query.emit(assistantWithUsage({input_tokens: 1500, output_tokens: 500, cache_read_input_tokens: 2000}));
  const result = fx.resultMessage({userMessageUuid: fx.UUID.a});
  result.modelUsage = {'claude-test': {contextWindow: 200000, costUSD: 3}};
  query.emit(result);
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'turno encerrado');
  assert.deepEqual(await adapter.sessionUsage(), {tokens: 4000, contextWindow: 200000, percent: 2});
  query.emit(boundary('auto', 4000, 300));
  await fx.tick();
  assert.equal(await adapter.sessionUsage(), null, 'a compactação corta o que a amostra não vê');
  const service = new NativeService({adapter, engine: 'claude'});
  assert.deepEqual(await service.request('get_session_stats'), {}, 'sem número, a resposta vai sem medidor');
  adapter.close();
});

test('medidor: uso com campo torto apaga a amostra anterior', async () => {
  const {adapter, sdk} = makeAdapter();
  const query = await acceptedTurn(adapter, sdk);
  const result = fx.resultMessage({userMessageUuid: fx.UUID.c});
  result.modelUsage = {'claude-test': {contextWindow: 100000}};
  query.emit(assistantWithUsage({input_tokens: 1000}));
  query.emit(result);
  await fx.waitFor(() => adapter._modelUsage !== null, 2000, 'janela lida');
  assert.equal((await adapter.sessionUsage()).tokens, 1000);
  query.emit({...assistantWithUsage({input_tokens: -5}), message: {id: 'msg_2', role: 'assistant', model: 'claude-test', content: [{type: 'text', text: 'x'}], usage: {input_tokens: -5}}});
  await fx.waitFor(() => adapter._usageSample === null, 2000, 'amostra apagada');
  adapter.close();
});

/* ---------------- comandos ---------------- */

test('comandos: catálogo do supportedCommands guardado por consulta e trocado pelo commands_changed', async () => {
  let reads = 0;
  const {adapter, sdk} = makeAdapter({sdk: sdkWithCommands(async () => { reads += 1; return [{name: '/review', description: 'Revisa'}, {name: ''}]; })});
  assert.deepEqual(await adapter.commands(), [{name: 'review', description: 'Revisa', argumentHint: ''}]);
  await adapter.commands();
  assert.equal(reads, 1, 'a lista fica guardada na consulta');
  sdk.state.queries[0].emit({type: 'system', subtype: 'commands_changed', commands: [{name: 'novo', description: 'd'}], uuid: fx.newUuid(), session_id: fx.UUID.session});
  await fx.waitFor(() => adapter._commandCache?.[0]?.name === 'novo', 2000, 'lista trocada');
  assert.equal(sdk.state.queries.length, 1);
  adapter.close();
});

test('comandos: leitura que falha vira lista vazia no serviço', async () => {
  const {adapter} = makeAdapter({sdk: sdkWithCommands(async () => { throw Error('sem catálogo'); })});
  const service = new NativeService({adapter, engine: 'claude'});
  assert.deepEqual(await service.request('get_commands'), {commands: []});
  service.stop();
});

test('comandos: `/review` do catálogo sai como texto cru pelo ciclo do prompt', async () => {
  const {adapter, sdk} = makeAdapter();
  const service = new NativeService({adapter, engine: 'claude'});
  const sent = service.request('prompt', {message: '/review a prova 2'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const item = await fx.takeInput(sdk.state.queries[0]);
  assert.deepEqual(item.message.content, [{type: 'text', text: '/review a prova 2'}]);
  sdk.state.queries[0].emit(fx.replayMessage(item));
  assert.equal((await sent).accepted, true);
  assert.equal(adapter.snapshot().busy, true, 'o aceite do comando não encerra o turno');
  service.stop();
});

/* ---------------- compactação ---------------- */

async function startCompact(adapter, sdk, args) {
  await adapter.connect();
  const promise = adapter.compact(args);
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  return {promise, query, item};
}

test('compactar: `/compact` no iterável; o fim é o compact_result, com os tokens da fronteira manual', async () => {
  const {adapter, sdk} = makeAdapter();
  const events = fx.collectEvents(adapter);
  const {promise, query, item} = await startCompact(adapter, sdk, {customInstructions: '  mantenha as fórmulas '});
  assert.deepEqual(item.message.content, [{type: 'text', text: '/compact mantenha as fórmulas'}]);
  assert.equal(adapter.snapshot().compacting, true);
  query.emit(status({status: 'compacting'}));
  query.emit(boundary('auto', 9000, 100));
  query.emit(boundary('manual', 1200, 140));
  query.emit(status({compact_result: 'success'}));
  assert.deepEqual(await promise, {accepted: true, compacted: true, summary: '', tokensBefore: 1200, tokensAfter: 140});
  assert.equal(adapter.snapshot().compacting, false);
  assert.equal(events.of('delivery').length, 0, 'compactar não é entrega de estudo');
  assert.equal(events.of('warning').filter((e) => e.code === 'CLAUDE_COMPACTED').length, 1, 'a fronteira auto continua aviso');
  /* O `result` do comando não vira eco estrangeiro do próximo turno. */
  query.emit(fx.resultMessage({userMessageUuid: item.uuid}));
  const next = adapter.send({id: fx.UUID.b, text: 'continua'});
  const turnItem = await fx.takeInput(query);
  query.emit(fx.replayMessage(turnItem));
  await next;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.b}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'turno encerrado');
  assert.equal(events.of('turn_end').at(-1).uncertain, false);
  adapter.close();
});

test('compactar: failed é recusa (pode repetir); sem confirmação é incerteza', async () => {
  const {adapter, sdk} = makeAdapter({compactTimeoutMs: 60});
  const first = await startCompact(adapter, sdk);
  first.query.emit(status({compact_result: 'failed', compact_error: 'contexto curto'}));
  await assert.rejects(first.promise, (error) => error.notSent === true && error.code === 'CLAUDE_COMPACT_FAILED');
  const again = adapter.compact();
  await fx.takeInput(first.query);
  await assert.rejects(again, (error) => error.notSent === false && error.uncertain === true);
  assert.equal(adapter._deliveryUncertain, false, 'compactar nunca marca a conversa como incerta');
  adapter.close();
});

test('compactar: um pedido por vez, nada atravessa o resumo e o turno em voo recusa', async () => {
  const {adapter, sdk} = makeAdapter();
  const {promise, query} = await startCompact(adapter, sdk);
  await assert.rejects(adapter.compact(), (error) => error.code === 'CLAUDE_COMPACT_BUSY' && error.notSent === true);
  await assert.rejects(adapter.send({id: fx.UUID.b, text: 'oi'}), (error) => error.code === 'CLAUDE_COMPACT_BUSY');
  query.emit(status({compact_result: 'success'}));
  await promise;
  const turn = adapter.send({id: fx.UUID.c, text: 'oi'});
  await fx.takeInput(query);
  await assert.rejects(adapter.compact(), (error) => error.code === 'CLAUDE_BUSY');
  adapter.close();
  await turn.catch(() => {});
});

test('compactar: sem o comando no catálogo, recusa sem escrever nada', async () => {
  const {adapter, sdk} = makeAdapter({sdk: sdkWithCommands([{name: 'review', description: ''}])});
  await adapter.connect();
  await assert.rejects(adapter.compact(), (error) => error.code === 'CLAUDE_COMPACT_UNSUPPORTED' && error.notSent === true);
  assert.equal(sdk.state.queries[0].prompt.size ?? 0, 0);
  adapter.close();
});

test('compactar: a consulta que cai no meio deixa o pedido incerto', async () => {
  const {adapter, sdk} = makeAdapter();
  const {promise, query} = await startCompact(adapter, sdk);
  query.end();
  await assert.rejects(promise, (error) => error.code === 'CLAUDE_COMPACT_UNCERTAIN');
});

/* ---------------- rascunho de revisão ---------------- */

test('rascunho: consulta temporária sem ferramentas nem sessão salva; o JSON volta pelo leitor do Pi', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeDraftBridge({cwd: process.cwd(), systemPrompt: draftPrompt('pt-BR'), sdkLoader: async () => sdk, selection: {model: null, effort: null}});
  const context = {question: 'Quanto é 2 + 2?', attempt: 'Somei.', answer: 'É 4.', selection: ''};
  const draft = generateReviewDraft({bridge, context, ref: null, timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  assert.deepEqual(query.options.tools, []);
  assert.equal(query.options.persistSession, false);
  assert.ok(query.options.disallowedTools.includes('Read'));
  assert.deepEqual(query.options.mcpServers, {});
  assert.equal(query.options.systemPrompt, draftPrompt('pt-BR'));
  const item = await fx.takeInput(query);
  assert.deepEqual(JSON.parse(item.message.content[0].text), context, 'o contexto vai como dado');
  query.emit(fx.replayMessage(item));
  query.emit(fx.assistantMessage({text: '{"question":"Quanto é 2 + 2?","attempt":"Somei.","difficulty":"Nenhuma"}'}));
  query.emit(fx.resultMessage({userMessageUuid: item.uuid}));
  const result = await draft;
  assert.equal(result.question, 'Quanto é 2 + 2?');
  assert.equal(result.difficulty, 'Nenhuma');
  assert.ok(query.closeCalls >= 1, 'a consulta temporária fecha no fim');
});

test('rascunho: falha nativa do result derruba o rascunho, sem repetir, e fecha a consulta', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeDraftBridge({cwd: process.cwd(), systemPrompt: draftPrompt('en'), sdkLoader: async () => sdk});
  const draft = generateReviewDraft({bridge, context: {question: 'q', attempt: '', answer: 'a', selection: ''}, ref: null, timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  query.emit(fx.resultMessage({subtype: 'error_during_execution', isError: true, userMessageUuid: item.uuid}));
  await assert.rejects(draft);
  assert.ok(query.closeCalls >= 1);
  assert.equal(query.prompt.size ?? 0, 0, 'nada foi reenviado');
});
