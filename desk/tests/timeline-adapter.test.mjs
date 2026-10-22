/* Ponte Claude: identidade de bloco, declaração × execução de ferramenta e
   resultados com detalhes. Cobre o que a linha do tempo precisa do adaptador:

   - `rendererEvent` preserva `messageId`/`contentIndex`, `pending` e `details`;
   - `content_block_start` de `tool_use` publica a DECLARAÇÃO (pending) uma vez;
   - quadros assistant com o MESMO `message.id` não são deduplicados às cegas:
     cada bloco chega com `contentIndexes` globais;
   - `tool_result` sobrevive no histórico normalizado, na posição, com detalhes
     estruturados dentro do teto;
   - o merge do prefixo não duplica resultado por texto igual.

   SDK fake, sem Electron, sem rede e sem credencial. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {ClaudeAdapter, normalizeHistory, mergePriorHistory, LIMITS} = require('../src/agents/claude-adapter.cjs');
const {rendererEvent} = require('../src/agents/service.cjs');

const CONV = 'conv-timeline-adapter';

function makeAdapter(overrides = {}) {
  const sdk = overrides.sdk || fx.fakeSdk();
  const adapter = new ClaudeAdapter({
    conversationId: CONV,
    cwd: process.cwd(),
    sdkLoader: async () => sdk,
    timeoutMs: 2000,
    ...overrides,
  });
  return {adapter, sdk};
}

async function startSend(adapter, sdk, input = {}) {
  const id = input.id || fx.UUID.a;
  const promise = adapter.send({id, text: input.text ?? 'pergunta', ...input});
  await fx.waitFor(() => sdk.state.queries.length > 0, 2000, 'consulta criada');
  return {promise, query: sdk.state.queries.at(-1), id};
}

function streamFrame(query, event) {
  query.emit({
    type: 'stream_event',
    event,
    parent_tool_use_id: null,
    uuid: fx.newUuid(),
    session_id: fx.UUID.session,
  });
}

/* ---------------- contrato do renderer (service.cjs) ---------------- */

test('rendererEvent preserva identidade de bloco, pending e details', () => {
  assert.deepEqual(
    rendererEvent({type: 'message_delta', kind: 'text', delta: 'Olá', messageId: 'm1', contentIndex: 2, conversationId: 'c', runId: 'r'}),
    {conversationId: 'c', runId: 'r', type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Olá', messageId: 'm1', contentIndex: 2}},
  );
  assert.deepEqual(
    rendererEvent({type: 'message_delta', kind: 'thinking', delta: 'penso', messageId: 'm1', contentIndex: 0, conversationId: 'c'}),
    {conversationId: 'c', runId: undefined, type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'penso', messageId: 'm1', contentIndex: 0}},
  );
  assert.deepEqual(
    rendererEvent({type: 'tool_start', id: 't1', name: 'Read', args: {}, pending: true, conversationId: 'c'}),
    {conversationId: 'c', runId: undefined, type: 'tool_execution_start', toolCallId: 't1', toolName: 'Read', args: {}, pending: true},
  );
  assert.deepEqual(
    rendererEvent({type: 'tool_end', id: 't1', name: 'Read', result: 'ok', isError: false, details: {a: 1}, conversationId: 'c'}),
    {conversationId: 'c', runId: undefined, type: 'tool_execution_end', toolCallId: 't1', toolName: 'Read', result: 'ok', isError: false, details: {a: 1}},
  );
});

/* ---------------- declaração × execução ---------------- */

test('content_block_start publica a declaração pendente uma vez; o delta leva contentIndex', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {query} = await startSend(adapter, sdk, {text: 'oi'});
  const item = await fx.takeInput(query);

  streamFrame(query, {type: 'message_start', message: {id: 'msg_1', model: 'claude-test'}});
  streamFrame(query, {type: 'content_block_start', index: 0, content_block: {type: 'tool_use', id: 'tool-1', name: 'Read', input: {}}});
  streamFrame(query, {type: 'content_block_delta', index: 1, message: {id: 'msg_1'}, delta: {type: 'text_delta', text: 'depois'}});
  await fx.tick();

  const declared = events.of('tool_start');
  assert.equal(declared.length, 1, 'a declaração sai uma vez, no start do bloco');
  assert.equal(declared[0].pending, true);
  assert.equal(declared[0].id, 'tool-1');
  const deltas = events.of('message_delta');
  assert.deepEqual(deltas.map((event) => ({kind: event.kind, index: event.contentIndex, messageId: event.messageId})), [{kind: 'text', index: 1, messageId: 'msg_1'}]);

  /* O quadro final repete o tool_use já declarado: não reemite tool_start. */
  query.emit(fx.assistantMessage({uuid: fx.newUuid(), text: 'depois', toolUse: {id: 'tool-1', name: 'Read', args: {file_path: 'x'}}, userMessageUuid: item.uuid}));
  await fx.waitFor(() => events.of('message_end').length === 1, 2000, 'message_end do quadro final');
  assert.equal(events.of('tool_start').length, 1, 'declaração e quadro final não duplicam tool_start');
  const end = events.of('message_end').at(-1).message;
  assert.deepEqual(end.contentIndexes, [0, 1], 'índices globais dos blocos da mensagem');
  assert.ok(Array.isArray(end.content));
});

/* ---------------- quadros com o mesmo message.id ---------------- */

test('quadros assistant com o mesmo message.id não deduplicam às cegas (contentIndexes acumulam)', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {query} = await startSend(adapter, sdk, {text: 'oi'});
  await fx.takeInput(query);
  const frame = (text) => ({
    type: 'assistant',
    message: {id: 'msg_9', role: 'assistant', model: 'claude-test', content: [{type: 'text', text}]},
    parent_tool_use_id: null,
    session_id: fx.UUID.session,
  });
  query.emit(frame('A'));
  query.emit(frame('B'));
  query.emit(frame('B')); /* repetido sem uuid: dedupe pela impressão digital */
  await fx.tick();
  const ends = events.of('message_end');
  assert.equal(ends.length, 2, 'dois blocos distintos com o mesmo message.id chegam');
  assert.deepEqual(ends.map((event) => event.message.content[0].text), ['A', 'B']);
  assert.deepEqual(ends.map((event) => event.message.contentIndexes), [[0], [1]]);
});

/* ---------------- resultados com detalhes ---------------- */

test('tool_result do quadro user leva details estruturados (com teto)', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {query} = await startSend(adapter, sdk, {text: 'oi'});
  await fx.takeInput(query);
  query.emit({
    type: 'user',
    message: {role: 'user', content: [{type: 'tool_result', tool_use_id: 't1', content: 'saída'}]},
    tool_use_result: {activityId: 'a1', values: [1, 2]},
    parent_tool_use_id: null,
    session_id: fx.UUID.session,
    uuid: fx.newUuid(),
  });
  await fx.tick();
  const end = events.of('tool_end').at(-1);
  assert.equal(end.result, 'saída');
  assert.deepEqual(end.details, {activityId: 'a1', values: [1, 2]});

  query.emit({
    type: 'user',
    message: {role: 'user', content: [{type: 'tool_result', tool_use_id: 't2', content: 'gigante'}]},
    tool_use_result: {blob: 'x'.repeat(LIMITS.MAX_TOOL_DETAILS_CHARS + 10)},
    parent_tool_use_id: null,
    session_id: fx.UUID.session,
    uuid: fx.newUuid(),
  });
  await fx.tick();
  const huge = events.of('tool_end').at(-1).details;
  assert.equal(huge.truncated, true);
  assert.ok(huge.length > LIMITS.MAX_TOOL_DETAILS_CHARS);
});

/* ---------------- histórico nativo ---------------- */

test('normalizeHistory mantém tool_result na posição, com toolCallId e details', () => {
  const out = normalizeHistory([
    {
      type: 'assistant',
      uuid: 'm1',
      message: {role: 'assistant', content: [{type: 'tool_use', id: 't1', name: 'mesa_criar_atividade', input: {title: 'x'}}]},
    },
    {
      type: 'user',
      uuid: 'm2',
      message: {role: 'user', content: [{type: 'tool_result', tool_use_id: 't1', content: 'publicado'}]},
      tool_use_result: {activityId: 'a1'},
    },
    {
      type: 'assistant',
      uuid: 'm3',
      message: {role: 'assistant', content: [{type: 'text', text: 'pronto'}]},
    },
  ]);
  assert.deepEqual(out, [
    {role: 'assistant', content: [{type: 'toolCall', id: 't1', name: 'mesa_criar_atividade', arguments: {title: 'x'}}]},
    {role: 'toolResult', content: [{type: 'text', text: 'publicado'}], toolCallId: 't1', details: {activityId: 'a1'}},
    {role: 'assistant', content: [{type: 'text', text: 'pronto'}]},
  ]);
});

test('normalizeHistory preserva a ordem dentro da mensagem (resultado antes do texto)', () => {
  const out = normalizeHistory([
    {
      type: 'user',
      uuid: 'm1',
      message: {role: 'user', content: [
        {type: 'tool_result', tool_use_id: 't1', content: 'ok'},
        {type: 'text', text: 'segue'},
      ]},
    },
  ]);
  assert.deepEqual(out.map((message) => message.role), ['toolResult', 'user']);
});

test('normalizeHistory com detalhes gigantes corta com marcador, nunca objeto enorme', () => {
  const out = normalizeHistory([
    {type: 'user', uuid: 'm1', message: {role: 'user', content: [{type: 'tool_result', tool_use_id: 't1', content: 'ok'}]}, tool_use_result: {blob: 'y'.repeat(LIMITS.MAX_TOOL_DETAILS_CHARS + 5)}},
  ]);
  assert.equal(out[0].details.truncated, true);
  assert.equal(typeof out[0].details.length, 'number');
});

test('mergePriorHistory não confunde resultados de chamadas diferentes com texto igual', () => {
  const prior = [{role: 'toolResult', content: [{type: 'text', text: 'ok'}], toolCallId: 't1'}];
  const native = [
    {role: 'toolResult', content: [{type: 'text', text: 'ok'}], toolCallId: 't1'},
    {role: 'toolResult', content: [{type: 'text', text: 'ok'}], toolCallId: 't2'},
  ];
  assert.deepEqual(mergePriorHistory(prior, native), [prior[0], native[1]]);
  assert.equal(mergePriorHistory([], native), native);
});
