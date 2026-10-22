/* Uso de tokens + histórico importado do adaptador Claude
 * (desk/src/agents/claude-adapter.cjs), SOMENTE com SDK fake injetado:
 *
 * - `message_end` de assistente carrega `message.usage` no formato do host
 *   (`input`/`output`/`cacheRead`/`cacheWrite`), mapeado do uso nativo;
 * - métrica ausente/nula NÃO vira zero inventado; 0 real continua 0;
 * - o par de cache sai separado (o host soma; pré-somar duplicaria);
 * - quadros com o mesmo `message.id` (mesma rodada dividida em blocos) não
 *   somam o mesmo uso várias vezes;
 * - `priorMessages` preserva a transcrição importada no `history()` mesmo
 *   quando o histórico nativo não a contém, sem duplicar o que ele já tem.
 *
 * Nada aqui inicia inferência, login ou processo Claude real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {
  ClaudeAdapter,
  normalizeUsage,
  normalizePriorMessages,
  mergePriorHistory,
} = require('../src/agents/claude-adapter.cjs');
const {ClaudeService} = require('../src/agents/service.cjs');
const conversations = require('../src/agents/conversations.cjs');

const CONV = 'conv-claude-uso-historico';

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

/* Um turno aceito de verdade (eco com o uuid) para o adaptador ter consulta
   viva e um turno em andamento, como no fluxo real. */
async function acceptedTurn(adapter, sdk) {
  const events = fx.collectEvents(adapter);
  await adapter.connect();
  const promise = adapter.send({id: fx.newUuid(), text: 'pergunta'});
  await fx.waitFor(() => sdk.state.queries.length > 0, 2000, 'consulta criada');
  const query = sdk.state.queries.at(-1);
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  await promise;
  return {events, query};
}

function assistantFrame({
  messageId = 'msg_1',
  wrapperUuid = fx.newUuid(),
  text = 'resposta',
  usage,
  stopReason = 'end_turn',
  parentToolUseId = null,
} = {}) {
  const message = {
    id: messageId,
    role: 'assistant',
    model: 'claude-test',
    content: text == null ? [] : [{type: 'text', text}],
    stop_reason: stopReason,
  };
  if (usage !== undefined) message.usage = usage;
  return {
    type: 'assistant',
    message,
    parent_tool_use_id: parentToolUseId,
    uuid: wrapperUuid,
    session_id: fx.UUID.session,
  };
}

/* ---------------- mapeamento puro do uso ---------------- */

test('normalizeUsage mapeia só o que o provedor reportou: sem zero inventado e sem pré-soma', () => {
  assert.deepEqual(normalizeUsage({
    input_tokens: 12,
    output_tokens: 24,
    cache_creation_input_tokens: 3,
    cache_read_input_tokens: 7,
    service_tier: 'standard',
  }), {input: 12, output: 24, cacheRead: 7, cacheWrite: 3});

  /* nulo do provedor NÃO vira 0 comprovado; 0 real continua 0. */
  assert.deepEqual(
    normalizeUsage({input_tokens: 5, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null}),
    {input: 5, output: 0},
  );
  /* nenhuma métrica reportada = nada a emitir. */
  assert.equal(normalizeUsage({}), null);
  assert.equal(normalizeUsage(undefined), null);
  /* valor ausente/negativo/não numérico fica de fora, sem virar zero. */
  assert.equal(normalizeUsage({input_tokens: -1, output_tokens: 'x'}), null);

  /* o par de cache sai separado: nada de `cache` pré-somado (o host soma). */
  const cache = normalizeUsage({cache_read_input_tokens: 4, cache_creation_input_tokens: 6});
  assert.deepEqual(cache, {cacheRead: 4, cacheWrite: 6});
  assert.equal(Object.hasOwn(cache, 'cache'), false);
});

/* ---------------- message_end com uso ---------------- */

test('message_end leva o uso do provedor e não soma a mesma mensagem lógica duas vezes', async () => {
  const {adapter, sdk} = makeAdapter();
  const {events, query} = await acceptedTurn(adapter, sdk);
  const native = {input_tokens: 12, output_tokens: 24, cache_creation_input_tokens: 3, cache_read_input_tokens: 7};

  /* A CLI divide UMA resposta em um quadro por bloco, todos com o mesmo
     `message.id` e o MESMO uso final. */
  query.emit(assistantFrame({messageId: 'msg_split', text: 'parte 1', usage: native}));
  await fx.waitFor(() => events.of('message_end').length === 1, 2000, 'primeiro quadro');
  query.emit(assistantFrame({messageId: 'msg_split', text: 'parte 2', usage: native}));
  await fx.waitFor(() => events.of('message_end').length === 2, 2000, 'segundo quadro');

  const ends = events.of('message_end');
  assert.equal(ends.length, 2, 'os dois blocos aparecem como mensagens');
  assert.deepEqual(ends[0].message.usage, {input: 12, output: 24, cacheRead: 7, cacheWrite: 3});
  assert.equal(ends[1].message.usage, undefined, 'o mesmo message.id não repete o uso da rodada');
  assert.equal(ends.filter((event) => event.message.usage).length, 1);
  adapter.close();
});

test('mensagens lógicas diferentes mantêm o uso de cada rodada (loop de ferramenta)', async () => {
  const {adapter, sdk} = makeAdapter();
  const {events, query} = await acceptedTurn(adapter, sdk);

  query.emit(assistantFrame({messageId: 'msg_a', text: 'chamada', usage: {input_tokens: 10, output_tokens: 2}}));
  await fx.waitFor(() => events.of('message_end').length === 1, 2000, 'rodada 1');
  query.emit(assistantFrame({messageId: 'msg_b', text: 'final', usage: {input_tokens: 20, output_tokens: 8}}));
  await fx.waitFor(() => events.of('message_end').length === 2, 2000, 'rodada 2');

  assert.deepEqual(events.of('message_end').map((event) => event.message.usage), [
    {input: 10, output: 2},
    {input: 20, output: 8},
  ]);
  adapter.close();
});

test('quadro sem uso não reserva a mensagem e subagente não entra na conta', async () => {
  const {adapter, sdk} = makeAdapter();
  const {events, query} = await acceptedTurn(adapter, sdk);

  query.emit(assistantFrame({messageId: 'msg_late', text: 'sem uso ainda'}));
  await fx.waitFor(() => events.of('message_end').length === 1, 2000, 'quadro sem uso');
  assert.equal(events.of('message_end')[0].message.usage, undefined);
  query.emit(assistantFrame({messageId: 'msg_late', text: 'agora com uso', usage: {output_tokens: 4}}));
  await fx.waitFor(() => events.of('message_end').length === 2, 2000, 'quadro com uso');
  assert.deepEqual(events.of('message_end')[1].message.usage, {output: 4});

  query.emit(assistantFrame({messageId: 'msg_sub', text: 'subagente', usage: {input_tokens: 99}, parentToolUseId: 'tool-sub'}));
  await fx.tick();
  assert.equal(events.of('message_end').length, 2, 'subagente não polui a conversa principal');
  assert.equal(events.of('message_end').some((event) => event.message.usage?.input === 99), false);
  adapter.close();
});

/* ---------------- priorMessages ---------------- */

test('normalizePriorMessages aceita só a forma normalizada e preserva metadados', () => {
  const out = normalizePriorMessages([
    {role: 'user', content: [{type: 'text', text: 'ok'}]},
    {role: 'system', content: [{type: 'text', text: 'fora'}]},
    {role: 'assistant', content: 'não é lista'},
    null,
    {role: 'toolResult', content: [{type: 'text', text: 'resultado'}], toolCallId: 't1', isError: true},
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].role, 'user');
  assert.equal(out[1].role, 'toolResult');
  assert.equal(out[1].toolCallId, 't1');
  assert.equal(out[1].isError, true);
  assert.deepEqual(normalizePriorMessages('não é lista'), []);
  assert.deepEqual(normalizePriorMessages(undefined), []);
});

test('priorMessages preserva a transcrição importada e não duplica o que o nativo já tem', async () => {
  const prior = [
    {role: 'user', content: [{type: 'text', text: 'pergunta importada'}]},
    {role: 'assistant', content: [{type: 'text', text: 'resposta importada'}, {type: 'thinking', thinking: 'pensou'}]},
  ];
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, priorMessages: prior});
  sdk.state.history = [
    /* Cópia nativa da resposta importada, com o mesmo conteúdo e outra forma
       de `thinking` (o descritor guarda `thinking`; o adaptador devolve `text`). */
    fx.historyEntry({role: 'assistant', content: [{type: 'text', text: 'resposta importada'}, {type: 'thinking', thinking: 'pensou'}]}),
    fx.historyEntry({role: 'user', content: [{type: 'text', text: 'pergunta importada'}]}),
    fx.historyEntry({role: 'assistant', text: 'resposta nova'}),
  ];

  const out = await adapter.history();
  assert.deepEqual(out.map((message) => message.role + ':' + message.content.find((part) => part.type === 'text')?.text), [
    'user:pergunta importada',
    'assistant:resposta importada',
    'assistant:resposta nova',
  ]);
  assert.equal(adapter.historyComplete, true);
});

test('mensagens iguais de verdade continuam contando (comparação em multiconjunto)', async () => {
  const same = () => ({role: 'user', content: [{type: 'text', text: 'ok'}]});
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, priorMessages: [same(), same()]});
  sdk.state.history = [
    fx.historyEntry({role: 'user', text: 'ok'}),
    fx.historyEntry({role: 'user', text: 'ok'}),
    fx.historyEntry({role: 'user', text: 'ok'}),
  ];
  const out = await adapter.history();
  assert.equal(out.length, 3, 'as duas cópias do prefixo + a nativa que sobra');
});

test('nova pergunta igual à importada não desaparece do histórico nativo',async()=>{
 const same={role:'user',content:[{type:'text',text:'Resolva a questão 1'}]};
 const {adapter,sdk}=makeAdapter({sessionId:fx.UUID.session,priorMessages:[same],importedPrefixLength:1});
 sdk.state.history=[fx.historyEntry({role:'user',text:'Resolva a questão 1'})];
 const result=await adapter.history();assert.equal(result.length,2);
 const reloaded=makeAdapter({sessionId:fx.UUID.session,priorMessages:result,importedPrefixLength:1});
 reloaded.sdk.state.history=sdk.state.history;
 assert.equal((await reloaded.adapter.history()).length,2,'a pergunta nova também não se duplica na recarga');
});

test('recarga: prefixo que já contém mensagens nativas antigas não as repete', async () => {
  const imported = {role: 'user', content: [{type: 'text', text: 'importada'}]};
  const nativeOld = {role: 'assistant', content: [{type: 'text', text: 'antiga'}]};
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, priorMessages: [imported, nativeOld]});
  sdk.state.history = [
    fx.historyEntry({role: 'assistant', text: 'antiga'}),
    fx.historyEntry({role: 'user', text: 'nova'}),
  ];
  const out = await adapter.history();
  assert.deepEqual(out.map((message) => message.content[0].text), ['importada', 'antiga', 'nova']);
});

test('sem nativo o prefixo continua; sem prefixo o adaptador segue devolvendo só o nativo', async () => {
  const prior = [{role: 'user', content: [{type: 'text', text: 'importada'}]}];
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, priorMessages: prior});
  sdk.state.history = [];
  assert.deepEqual(await adapter.history(), prior);

  const {adapter: plain, sdk: plainSdk} = makeAdapter({sessionId: fx.UUID.session});
  plainSdk.state.history = [fx.historyEntry({role: 'assistant', text: 'só nativa'})];
  assert.deepEqual((await plain.history()).map((message) => message.content[0].text), ['só nativa']);
});

test('mergePriorHistory é a mesma mescla pura, reutilizável pelo host no callback', () => {
  const prior = [{role: 'user', content: [{type: 'text', text: 'importada'}]}];
  const native = [
    {role: 'user', content: [{type: 'text', text: 'importada'}]},
    {role: 'assistant', content: [{type: 'text', text: 'nova'}]},
  ];
  assert.deepEqual(mergePriorHistory(prior, native), [
    {role: 'user', content: [{type: 'text', text: 'importada'}]},
    {role: 'assistant', content: [{type: 'text', text: 'nova'}]},
  ]);
  assert.deepEqual(mergePriorHistory(null, native), native, 'sem prefixo devolve o nativo como veio');
});

/* ---------------- integração com o serviço/descritor ---------------- */

test('cache no limite mantém a fronteira importada em saves e leituras repetidas', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-claude-prefix-limit-'));
  let adapter;
  try {
    const file = conversations.createClaudeConversation({runtime, courseId: 'mat'});
    const imported = Array.from({length: 5000}, (_, i) => ({role: 'user', content: [{type: 'text', text: 'importada ' + i}]}));
    conversations.updateClaudeConversation(file, {messages: imported, importedPrefixLength: imported.length}, {runtime});
    const record = conversations.readClaudeConversation(file, {runtime});
    const sdk = fx.fakeSdk();
    sdk.state.history = [fx.historyEntry({role: 'assistant', text: 'nativa 1'})];
    adapter = new ClaudeAdapter({conversationId: file, sessionId: record.nativeSessionId, cwd: runtime, sdkLoader: async () => sdk,
      priorMessages: record.messages, importedPrefixLength: record.importedPrefixLength, timeoutMs: 2000});
    const service = new ClaudeService({adapter, messages: record.messages, importedPrefixLength: record.importedPrefixLength,
      onMessages(messages, meta) { conversations.updateClaudeConversation(file, {messages, importedPrefixLength: meta.importedPrefixLength}, {runtime}); }});
    for (let round = 0; round < 3; round++) {
      const result = await service.request('get_messages');
      assert.equal(result.messages.length, 5000);
      assert.equal(result.messages.filter(m => m.content[0].text === 'nativa 1').length, 1);
      assert.equal(conversations.readClaudeConversation(file, {runtime}).importedPrefixLength, 4999);
    }
    sdk.state.history.push(fx.historyEntry({role: 'assistant', text: 'nativa 2'}));
    const result = await service.request('get_messages');
    assert.equal(result.messages.length, 5000);
    assert.equal(conversations.readClaudeConversation(file, {runtime}).importedPrefixLength, 4998);
    assert.deepEqual(result.messages.slice(-2).map(m => m.content[0].text), ['nativa 1', 'nativa 2']);
  } finally { adapter?.close(); rmSync(runtime, {recursive: true, force: true}); }
});

test('get_messages preserva o prefixo importado no descritor mesmo quando o nativo viria sozinho', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-claude-prior-'));
  try {
    const file = conversations.createClaudeConversation({runtime, courseId: 'mat'});
    conversations.updateClaudeConversation(file, {
      messages: [{role: 'user', content: [{type: 'text', text: 'pergunta importada'}]}],
      preview: 'importada',
    }, {runtime});
    const record = conversations.readClaudeConversation(file, {runtime});

    const sdk = fx.fakeSdk();
    /* O histórico nativo NÃO contém a pergunta importada (ela só foi ao system
       prompt do primeiro turno). Sem o prefixo, o serviço substituiria o cache
       do descritor por estas duas mensagens e a importada sumiria. */
    sdk.state.history = [
      fx.historyEntry({role: 'user', text: 'nova pergunta'}),
      fx.historyEntry({role: 'assistant', text: 'resposta nativa'}),
    ];
    const adapter = new ClaudeAdapter({
      conversationId: file,
      sessionId: record.nativeSessionId,
      cwd: runtime,
      sdkLoader: async () => sdk,
      priorMessages: record.messages,
      timeoutMs: 2000,
    });
    const service = new ClaudeService({
      adapter,
      messages: record.messages || [],
      onMessages(messages) {
        conversations.updateClaudeConversation(file, {messages, preview: 'atualizada'}, {runtime});
      },
    });

    const result = await service.request('get_messages');
    assert.deepEqual(
      result.messages.map((message) => message.content[0].text),
      ['pergunta importada', 'nova pergunta', 'resposta nativa'],
    );
    const saved = conversations.readClaudeConversation(file, {runtime});
    assert.deepEqual(
      saved.messages.map((message) => message.content[0].text),
      ['pergunta importada', 'nova pergunta', 'resposta nativa'],
      'o cache do descritor mantém a transcrição importada',
    );
    adapter.close();
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});
