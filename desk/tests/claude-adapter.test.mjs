/* Ponte Claude isolada (desk/src/agents/claude-adapter.cjs) contra SDK fake.
 *
 * Nenhum binário Claude, nenhuma credencial, nenhum processo real: os testes
 * injetam `sdkLoader` (e às vezes `detectClaude`/`queryFactory`) e empurram as
 * mensagens que o CLI real emitiria. O que se prova é o comportamento que a
 * Mesa vai depender: marca antes de entregar, aceite só com replay/carimbo,
 * PERSISTÊNCIA do ciclo transmitting→accepted→settled/refused/uncertain
 * (callback sync ou async aguardado), recusa × incerteza × conservador quando
 * o registro falha, um turno por vez, result com UUID errado não encerra o
 * turno, sessão divergente/subagente não muda identidade, permissão/respond,
 * pergunta estruturada (AskUserQuestion) com answers validadas, limite de uso
 * nativo (rate_limit_event) que pausa sem encerrar o turno, política de
 * caminhos trocável e confinada, cancelamento e close.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {
  ClaudeAdapter,
  normalizeHistory,
  normalizeUserQuestions,
  validateQuestionAnswers,
} = require('../src/agents/claude-adapter.cjs');

const CONV = 'conv-claude-teste';

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

async function accept(query, item, sessionId = fx.UUID.session) {
  query.emit(fx.replayMessage(item, sessionId));
}

function statuses(recorder) {
  return recorder.calls.map((call) => call.status);
}

/* ---------------- contrato e conexão ---------------- */

test('snapshot expõe o contrato congelado sem prometer inferência', async () => {
  const {adapter, sdk} = makeAdapter();
  assert.deepEqual(adapter.snapshot(), {
    connected: false,
    busy: false,
    model: {provider: 'anthropic', id: 'default', name: 'Claude Code', input: ['text', 'image']},
    capabilities: {
      images: true,
      permissions: true,
      steer: false,
      compact: false,
      autoCompaction: false,
      modelSelection: false,
      effort: false,
      reviewDraft: false,
      handoff: false,
      commands: false,
      geogebra: false,
      quiz: false,
      contextUsage: false,
    },
    sessionId: null,
    thinkingLevel: null,
  });
  assert.equal(adapter.deliveryState(), null);

  await adapter.connect();
  assert.equal(adapter.snapshot().connected, true);
  assert.equal(sdk.state.queries.length, 0, 'connect não abre processo nem chamada de modelo');
});

test('connect recusa com código do ambiente e notSent quando o detector falha', async () => {
  let detected = 0;
  const adapter = new ClaudeAdapter({
    conversationId: CONV,
    cwd: process.cwd(),
    detectClaude: async () => {
      detected += 1;
      const error = new Error('sem login');
      error.code = 'CLAUDE_LOGIN_REQUIRED';
      error.notSent = true;
      throw error;
    },
  });

  await assert.rejects(
    () => adapter.connect(),
    (error) => {
      assert.equal(error.code, 'CLAUDE_LOGIN_REQUIRED');
      assert.equal(error.notSent, true);
      assert.equal(error.name, 'ClaudeAdapterError');
      return true;
    },
  );
  assert.equal(detected, 1);
  assert.equal(adapter.snapshot().connected, false);
});

test('connect real exige cwd controlado antes de qualquer detecção', async () => {
  let detected = 0;
  const adapter = new ClaudeAdapter({
    conversationId: CONV,
    detectClaude: async () => {
      detected += 1;
      throw new Error('não devia chegar aqui');
    },
  });
  await assert.rejects(
    () => adapter.connect(),
    (error) => error.code === 'CLAUDE_CWD_REQUIRED' && error.notSent === true,
  );
  assert.equal(detected, 0, 'sem cwd nem tenta executar o binário');
});

test('resume=true exige sessionId explícito; nunca pega "última sessão"', () => {
  assert.throws(
    () => new ClaudeAdapter({conversationId: CONV, cwd: process.cwd(), resume: true}),
    (error) => error.code === 'CLAUDE_RESUME_WITHOUT_SESSION' && error.notSent === true,
  );
});

/* ---------------- envio, ciclo de entrega e aceite ---------------- */

test('marca transmitting antes de entregar; aceite só com o replay do mesmo uuid e persistido', async () => {
  const sdk = fx.fakeSdk();
  const order = [];
  const recorder = fx.persistRecorder();
  let queriesAtPersist = -1;
  const wrapped = (state) => {
    if (state.status === 'transmitting') queriesAtPersist = sdk.state.queries.length;
    order.push(`persist:${state.status}`);
    return recorder.persist(state);
  };
  const {adapter} = makeAdapter({sdk, persistDelivery: wrapped});
  await adapter.connect();
  const events = fx.collectEvents(adapter);

  const promise = adapter.send({id: fx.UUID.a, text: 'explique limites'});
  order.push('send');
  assert.deepEqual(order, ['persist:transmitting', 'send'], 'a marca é gravada antes de a consulta existir');
  assert.equal(queriesAtPersist, 0, 'nenhuma consulta existia quando a marca foi gravada');
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  order.push('delivered');
  assert.deepEqual(order, ['persist:transmitting', 'send', 'delivered']);
  assert.deepEqual(recorder.calls, [{id: fx.UUID.a, status: 'transmitting'}]);

  let settled = false;
  promise.then(() => {
    settled = true;
  });
  query.emit({...fx.replayMessage(item), uuid: fx.UUID.wrong});
  await fx.tick();
  assert.equal(settled, false, 'replay com uuid errado não confirma nada');
  assert.equal(adapter.snapshot().busy, true);

  await accept(query, item);
  assert.deepEqual(await promise, {accepted: true, id: fx.UUID.a});
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted']);
  assert.equal(adapter.deliveryState().status, 'accepted');
  assert.equal(adapter.deliveryState().accepted, true);

  const acceptedIndex = events.events.findIndex((event) => event.type === 'delivery' && event.status === 'accepted');
  const initIndex = events.events.findIndex((event) => event.type === 'init');
  assert.ok(initIndex >= 0, 'init do sessionId sai');
  assert.ok(initIndex < acceptedIndex, 'init sai antes de send resolver');
  assert.equal(events.events[initIndex].sessionId, fx.UUID.session);

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra o turno');
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted', 'settled']);
  assert.deepEqual(
    events.of('delivery').map((event) => event.status),
    ['transmitting', 'accepted', 'settled'],
  );
  assert.equal(events.of('turn_end').at(-1).uncertain, false);
});

test('persistDelivery sync ou async é aguardado antes de resolver o envio e antes do turn_end', async () => {
  const recorder = fx.persistRecorder({asyncDelay: 25});
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'assíncrono'});
  const item = await fx.takeInput(query);

  let resolved = false;
  promise.then(() => {
    resolved = true;
  });
  await accept(query, item);
  await fx.tick();
  assert.equal(resolved, false, 'o aceite não resolve antes do registro assíncrono terminar');
  await fx.waitFor(() => resolved, 2000, 'aceite persistido');
  assert.deepEqual(await promise, {accepted: true, id: fx.UUID.a});

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.tick();
  assert.equal(events.of('turn_end').length, 0, 'turn_end espera o registro final');
  await fx.waitFor(() => events.of('turn_end').length === 1, 2000, 'turn_end');
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted', 'settled']);
  assert.equal(adapter.snapshot().busy, false);
});

test('ack duplicado não resolve de novo nem duplica o evento accepted (sem exactly-once inventado)', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'ack duplo'});
  const item = await fx.takeInput(query);
  let resolutions = 0;
  promise.then(() => {
    resolutions += 1;
  });
  await accept(query, item);
  await promise;
  await accept(query, item);
  await fx.tick();
  assert.equal(resolutions, 1);
  assert.equal(events.of('delivery').filter((event) => event.status === 'accepted').length, 1);
});

test('imagem válida vira bloco base64 do SDK no formato Pi reduzido', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const {promise, query} = await startSend(adapter, sdk, {
    text: 'veja a captura',
    images: [{type: 'image', data: 'aGVsbG8=', mimeType: 'image/png'}],
  });
  const item = await fx.takeInput(query);
  assert.deepEqual(item.message.content, [
    {type: 'text', text: 'veja a captura'},
    {type: 'image', source: {type: 'base64', media_type: 'image/png', data: 'aGVsbG8='}},
  ]);
  await accept(query, item);
  await promise;
});

test('recusas pré-envio: sem conexão, imagem inválida e turno concorrente não tocam o disco', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});

  await assert.rejects(
    () => adapter.send({text: 'oi'}),
    (error) => error.code === 'CLAUDE_NOT_CONNECTED' && error.notSent === true,
  );
  await adapter.connect();

  await assert.rejects(
    () => adapter.send({text: ''}),
    (error) => error.code === 'CLAUDE_BAD_MESSAGE' && error.notSent === true,
  );
  await assert.rejects(
    () => adapter.send({text: 'x', images: [{type: 'image', data: 'data:image/png;base64,AAAA', mimeType: 'image/png'}]}),
    (error) => error.code === 'CLAUDE_BAD_MESSAGE' && /base64/.test(error.message),
  );
  await assert.rejects(
    () => adapter.send({text: 'x', images: [{type: 'image', data: 'AAAA', mimeType: 'image/tiff'}]}),
    (error) => error.code === 'CLAUDE_BAD_MESSAGE' && /mimeType/.test(error.message),
  );
  await assert.rejects(
    () => adapter.send({text: 'x', images: [{type: 'image', data: '@@@@', mimeType: 'image/png'}]}),
    (error) => error.code === 'CLAUDE_BAD_MESSAGE',
  );
  assert.equal(recorder.calls.length, 0, 'validação e recusa acontecem antes da marca');
  assert.equal(sdk.state.queries.length, 0);

  const {promise, query} = await startSend(adapter, sdk, {text: 'primeiro turno'});
  const item = await fx.takeInput(query);
  await assert.rejects(
    () => adapter.send({id: fx.UUID.b, text: 'segundo em paralelo'}),
    (error) => error.code === 'CLAUDE_BUSY' && error.notSent === true,
  );
  assert.deepEqual(statuses(recorder), ['transmitting'], 'o concorrente não marcou envio');
  await accept(query, item);
  await promise;
});

test('persistDelivery que falha na marca impede o envio; nada entra no iterador', async () => {
  const recorder = fx.persistRecorder({failStatuses: ['transmitting'], failMessage: 'disco cheio'});
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);

  await assert.rejects(
    () => adapter.send({id: fx.UUID.a, text: 'não sai'}),
    (error) => error.code === 'CLAUDE_PERSIST_FAILED' && error.notSent === true && /disco cheio/.test(error.message),
  );
  assert.equal(sdk.state.queries.length, 0, 'nem sobe consulta');
  assert.equal(adapter.snapshot().busy, false, 'turno não fica preso');
  assert.deepEqual(events.types(), [], 'sem evento de transmissão para algo que não saiu');
});

test('timeout de aceite vira incerteza persistida; busy só cai no result', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({timeoutMs: 30, persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'demora'});
  await fx.takeInput(query);

  await assert.rejects(
    () => promise,
    (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN' && error.notSent === false,
  );
  assert.equal(adapter.snapshot().busy, true, 'o turno segue; não é inferido como terminado');
  assert.deepEqual(statuses(recorder), ['transmitting', 'uncertain']);
  assert.ok(events.of('delivery').some((event) => event.status === 'uncertain'));

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.equal(events.of('turn_end').at(-1).isError, false);
  assert.equal(events.of('turn_end').at(-1).uncertain, true, 'sem aceite persistido o fim é conservador');
  assert.equal(statuses(recorder).includes('settled'), false, 'turno incerto nunca vira settled');
});

test('timeout + ack atrasado + result tardio: nada reaceita, nada reenvia', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({timeoutMs: 25, persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'atrasa'});
  const item = await fx.takeInput(query);
  await assert.rejects(() => promise, (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN');

  await accept(query, item);
  await fx.tick();
  assert.ok(events.of('warning').some((event) => event.code === 'CLAUDE_LATE_ACK'), 'ack atrasado avisa em vez de reaceitar');
  assert.equal(events.of('delivery').some((event) => event.status === 'accepted'), false);

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.deepEqual(statuses(recorder), ['transmitting', 'uncertain']);
  assert.equal(sdk.state.queries.length, 1, 'nada reenvia: uma única consulta');
  assert.equal(query.prompt.pendingCount, 0, 'nada reenfileira');
  const turnEnds = events.of('turn_end');
  assert.equal(turnEnds.length, 1);
  assert.equal(turnEnds[0].uncertain, true);
});

test('queda antes da entrega é recusa persistida; queda depois é incerteza', async () => {
  {
    const recorder = fx.persistRecorder();
    const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
    await adapter.connect();
    const events = fx.collectEvents(adapter);
    const {promise, query} = await startSend(adapter, sdk, {text: 'cai antes'});
    await fx.waitFor(() => query.prompt.pendingCount === 1, 2000, 'item guardado na fila');
    query.fail(new Error('processo não subiu'));

    await assert.rejects(
      () => promise,
      (error) => error.code === 'CLAUDE_DELIVERY_REFUSED' && error.notSent === true,
    );
    assert.deepEqual(statuses(recorder), ['transmitting', 'refused']);
    assert.ok(events.of('error').some((event) => event.code === 'CLAUDE_QUERY_ERROR'));
    assert.equal(events.of('turn_end').at(-1).isError, true);
    assert.equal(events.of('turn_end').at(-1).uncertain, false);
    assert.equal(adapter.snapshot().busy, false);
  }

  {
    const recorder = fx.persistRecorder();
    const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
    await adapter.connect();
    const {promise, query} = await startSend(adapter, sdk, {text: 'cai depois'});
    await fx.takeInput(query);
    query.fail(new Error('processo caiu no meio'));

    await assert.rejects(
      () => promise,
      (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN' && error.notSent === false,
    );
    assert.deepEqual(statuses(recorder), ['transmitting', 'uncertain']);
  }
});

test('aceite persistido + queda durante o turno vira incerteza conservadora', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'aceito e cai'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  query.fail(new Error('morreu depois do aceite'));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'queda encerra');
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted', 'uncertain']);
  const turnEnd = events.of('turn_end').at(-1);
  assert.equal(turnEnd.uncertain, true);
  assert.equal(turnEnd.isError, true);
});

test('result subtype success com is_error true é erro de turno, sem desfazer o aceite', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'erro de API'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  assert.deepEqual(await promise, {accepted: true, id: fx.UUID.a});

  query.emit(fx.resultMessage({subtype: 'success', isError: true, userMessageUuid: fx.UUID.a, result: 'API caiu'}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  const error = events.of('error').at(-1);
  assert.equal(error.code, 'CLAUDE_RESULT_ERROR');
  assert.match(error.message, /API caiu/);
  const turnEnd = events.of('turn_end').at(-1);
  assert.equal(turnEnd.isError, true);
  assert.equal(turnEnd.cancelled, false);
  assert.equal(turnEnd.uncertain, false);
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted', 'settled']);
  assert.equal(events.of('turn_end').length, 1, 'um result, um turn_end');
});

test('falha ao persistir o aceite: send rejeita incerto, sem accepted, sem liberar a fila', async () => {
  const recorder = fx.persistRecorder({failStatuses: ['accepted']});
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'aceite sem registro'});
  const item = await fx.takeInput(query);

  await accept(query, item);
  await assert.rejects(
    () => promise,
    (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN' && error.notSent === false && error.detail?.persistFailure === true,
  );
  assert.equal(adapter.snapshot().busy, true, 'a fila não é liberada com registro incerto');
  assert.equal(events.of('delivery').some((event) => event.status === 'accepted'), false);
  assert.ok(events.of('error').some((event) => event.code === 'CLAUDE_PERSIST_FAILED' && event.detail?.phase === 'accepted'));
  assert.equal(adapter.deliveryState().degraded, true);

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted', 'uncertain'], 'o accepted só é tentado (falhou); nunca confirmado');
  assert.equal(events.of('turn_end').at(-1).uncertain, true, 'turno degradado termina incerto e nunca repete');
  assert.equal(statuses(recorder).includes('settled'), false);
});

test('falha ao persistir o desfecho final não confirma sucesso nem libera a fila', async () => {
  const recorder = fx.persistRecorder({failStatuses: ['settled']});
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'final falho'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted', 'settled', 'uncertain']);
  assert.ok(events.of('error').some((event) => event.code === 'CLAUDE_PERSIST_FAILED' && event.detail?.phase === 'settled'));
  const turnEnd = events.of('turn_end').at(-1);
  assert.equal(turnEnd.uncertain, true);
  assert.equal(events.of('delivery').some((event) => event.status === 'settled'), false);
});

test('falha ao persistir a recusa cai para incerto (nunca promete recusa não registrada)', async () => {
  const recorder = fx.persistRecorder({failStatuses: ['refused']});
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'recusa sem registro'});
  await fx.waitFor(() => query.prompt.pendingCount === 1, 2000, 'item na fila');
  query.fail(new Error('não subiu'));

  await assert.rejects(
    () => promise,
    (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN' && error.notSent === false && error.detail?.phase === 'refused',
  );
  assert.deepEqual(statuses(recorder), ['transmitting', 'refused', 'uncertain']);
  assert.ok(events.of('error').some((event) => event.code === 'CLAUDE_PERSIST_FAILED' && event.detail?.phase === 'refused'));
  assert.equal(events.of('delivery').some((event) => event.status === 'refused'), false);
  assert.equal(events.of('turn_end').at(-1).uncertain, true);
});

test('a persistent SDK waiting for input receives consecutive turns on the same query', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const first = await startSend(adapter, sdk, {text: 'first'});
  const input = await fx.takeInput(first.query);
  await accept(first.query, input); await first.promise;
  first.query.emit(fx.resultMessage({userMessageUuid: input.uuid}));
  await fx.waitFor(() => !adapter.snapshot().busy);
  for (const id of [fx.UUID.b, fx.UUID.c]) {
    const waiting = fx.takeInput(first.query);
    await fx.tick();
    const sent = adapter.send({id, text: 'next'});
    const next = await waiting;
    assert.equal(next.uuid, id);
    await accept(first.query, next); await sent;
    first.query.emit(fx.resultMessage({userMessageUuid: id}));
    await fx.waitFor(() => !adapter.snapshot().busy);
  }
  assert.equal(sdk.state.queries.length, 1, 'one native query survives all turns');
  adapter.close();
});

test('result com UUID errado não encerra o turno atual; UUID certo encerra', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'uuid errado'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.wrong}));
  await fx.tick();
  assert.equal(adapter.snapshot().busy, true, 'result de outro turno não encerra o atual');
  assert.ok(events.of('warning').some((event) => event.code === 'CLAUDE_RESULT_FOREIGN'));
  assert.equal(events.of('turn_end').length, 0);

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result certo encerra');
  assert.equal(events.of('turn_end').length, 1);
});

test('fallback result.user_message_uuids: array com o UUID certo encerra; array errado não', async () => {
  {
    const {adapter, sdk} = makeAdapter();
    await adapter.connect();
    const {promise, query} = await startSend(adapter, sdk, {text: 'array certo'});
    const item = await fx.takeInput(query);
    await accept(query, item);
    await promise;
    query.emit(fx.resultMessage({userMessageUuids: [fx.UUID.wrong, fx.UUID.a]}));
    await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'array com match encerra');
  }
  {
    const {adapter, sdk} = makeAdapter();
    await adapter.connect();
    const events = fx.collectEvents(adapter);
    const {promise, query} = await startSend(adapter, sdk, {text: 'array errado'});
    const item = await fx.takeInput(query);
    await accept(query, item);
    await promise;
    query.emit(fx.resultMessage({userMessageUuids: [fx.UUID.wrong]}));
    await fx.tick();
    assert.equal(adapter.snapshot().busy, true);
    assert.ok(events.of('warning').some((event) => event.code === 'CLAUDE_RESULT_FOREIGN'));
  }
});

test('sessão divergente não muda a identidade nem polui a conversa principal', async () => {
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'sessão fixa'});
  const item = await fx.takeInput(query);

  query.emit({...fx.assistantMessage({uuid: fx.newUuid(), text: 'outra sessão'}), session_id: fx.UUID.otherSession});
  await fx.tick();
  assert.ok(events.of('warning').some((event) => event.code === 'CLAUDE_SESSION_MISMATCH'));
  assert.equal(adapter.snapshot().sessionId, fx.UUID.session, 'a identidade não muda em silêncio');
  assert.equal(events.of('message_end').length, 0, 'conteúdo de outra sessão não entra');

  query.emit(fx.initMessage({sessionId: fx.UUID.otherSession}));
  await fx.tick();
  assert.equal(adapter.snapshot().sessionId, fx.UUID.session);

  await accept(query, item);
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'turno da sessão certa encerra');
});

test('subagente (parent_tool_use_id) não correlaciona, não muda sessão e não encerra turno', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'subagente'});
  const item = await fx.takeInput(query);
  let resolved = false;
  promise.then(() => {
    resolved = true;
  });

  query.emit({
    ...fx.assistantMessage({uuid: fx.newUuid(), text: 'resposta do subagente', userMessageUuid: fx.UUID.a}),
    parent_tool_use_id: 'tool-sub',
    session_id: fx.UUID.otherSession,
  });
  await fx.tick();
  assert.equal(resolved, false, 'estampa de subagente não confirma o aceite');
  assert.equal(events.of('message_end').length, 0);
  assert.equal(adapter.snapshot().sessionId, null, 'subagente não define a identidade da conversa');

  query.emit({...fx.resultMessage({userMessageUuid: fx.UUID.a}), parent_tool_use_id: 'tool-sub'});
  await fx.tick();
  assert.equal(adapter.snapshot().busy, true, 'result de subagente não encerra o turno');
  assert.equal(events.of('turn_end').length, 0);

  await accept(query, item);
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result principal encerra');
});

test('result tardio depois do turn_end não reabre nem duplica o desfecho', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'tardio'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  const turns = events.of('turn_end').length;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.tick();
  assert.equal(events.of('turn_end').length, turns, 'result tardio não duplica turn_end');
  assert.ok(events.of('warning').some((event) => event.code === 'CLAUDE_RESULT_UNEXPECTED'));
  assert.equal(adapter.deliveryState(), null, 'o turno liquidado não volta ao estado de entrega');
});

/* ---------------- cancelamento ---------------- */

test('cancel antes do aceite pede interrupt, invalida permissão e mantém busy', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'cancela'});
  await fx.takeInput(query);

  assert.deepEqual(await adapter.cancel(), {cancelled: true, requested: true});
  assert.equal(query.interruptCalls, 1);
  assert.equal(adapter.snapshot().busy, true, 'busy até result/end confiável');

  /* Sem eco e sem aceite, o result é IGNORADO (`taken` não é aceite); o
     desfecho conservador vem do fim NATIVO da consulta (interrupt → exit). */
  query.emit(fx.resultMessage({subtype: 'error_during_execution', isError: true, terminalReason: 'aborted'}));
  await fx.tick();
  assert.equal(adapter.snapshot().busy, true, 'result sem correlação e sem aceite não encerra o turno');
  assert.equal(events.of('turn_end').length, 0, 'nada de turn_end prematuro');
  query.end();
  await assert.rejects(
    () => promise,
    (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN' && error.notSent === false,
  );
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'fim da consulta encerra');
  assert.equal(events.of('turn_end').at(-1).cancelled, true);
  assert.equal(events.of('turn_end').at(-1).isError, true);
  assert.equal(events.of('turn_end').at(-1).uncertain, true, 'cancelamento sem aceite registrado é conservador');
  assert.equal(
    events.of('error').some((event) => event.code === 'CLAUDE_RESULT_ERROR'),
    false,
    'cancelamento não aparece como erro de execução',
  );
});

test('cancel com interrupt que falha vira aviso, sem fingir sucesso', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const {promise, query} = await startSend(adapter, sdk, {text: 'trava'});
  await fx.takeInput(query);
  let interruptTried = 0;
  query.interrupt = async () => {
    interruptTried += 1;
    throw new Error('sem interrupt');
  };
  const events = fx.collectEvents(adapter);

  assert.deepEqual(await adapter.cancel(), {cancelled: true, requested: true});
  assert.equal(interruptTried, 1);
  assert.ok(events.of('warning').some((event) => event.code === 'CLAUDE_INTERRUPT_FAILED'));
  assert.equal(adapter.snapshot().busy, true, 'sem result, busy continua e exige close');

  /* Result sem eco e sem aceite é ignorado; o fim real vem do iterador. */
  query.emit(fx.resultMessage({subtype: 'error_during_execution', isError: true}));
  await fx.tick();
  assert.equal(adapter.snapshot().busy, true, 'result sem aceite não libera o turno');
  query.end();
  await assert.rejects(() => promise, (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN');
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'fim da consulta encerra');
});

/* ---------------- permissões e política ---------------- */

test('queda da consulta com permissão pendente nega o pedido em vez de pendurar o diálogo', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'permissão e queda'});
  await fx.takeInput(query);

  const permission = query.options.canUseTool(
    'Read',
    {file_path: join(process.cwd(), 'arquivo.txt')},
    {requestId: 'req-queda', toolUseID: 'tool-queda'},
  );
  await fx.tick();
  assert.equal(events.of('permission_request').at(-1).id, 'req-queda');

  query.fail(new Error('processo morreu'));
  assert.deepEqual(await permission, {behavior: 'deny', message: 'Consulta encerrada'});
  assert.equal(events.of('permission_cancelled').at(-1).id, 'req-queda');
  await assert.rejects(
    () => promise,
    (error) => error.code === 'CLAUDE_DELIVERY_UNCERTAIN' && error.notSent === false,
  );
  assert.equal(events.of('turn_end').at(-1).uncertain, true);
});

test('respond: allow só com confirmed, deny explícito, sem updatedPermissions e stale não permite', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'permissões'});
  const item = await fx.takeInput(query);
  const file = join(process.cwd(), 'package.json');
  const suggestions = [{type: 'addRules', rules: [{toolName: 'Read'}], behavior: 'allow', destination: 'session'}];

  const p1 = query.options.canUseTool('Read', {file_path: file}, {requestId: 'r1', toolUseID: 't1', suggestions});
  await fx.tick();
  const request = events.of('permission_request').at(-1);
  assert.equal(request.method, 'confirm');
  assert.equal(request.toolName, 'Read');
  assert.equal(request.target, realpathSync(file), 'o pedido é concreto: caminho real + ferramenta');
  assert.deepEqual(adapter.respond({id: 'r1', confirmed: false}), {ok: true, id: 'r1', allowed: false});
  assert.deepEqual(await p1, {behavior: 'deny', message: 'Recusado pelo usuário'});

  const p2 = query.options.canUseTool('Read', {file_path: file}, {requestId: 'r2', toolUseID: 't2', suggestions});
  await fx.tick();
  assert.deepEqual(adapter.respond({id: 'r2', confirmed: true}), {ok: true, id: 'r2', allowed: true});
  assert.deepEqual(await p2, {behavior: 'allow'}, 'sugestões de permissão global NUNCA são aplicadas');

  assert.deepEqual(
    adapter.respond({id: 'r9', confirmed: true}),
    {ok: false, id: 'r9', code: 'CLAUDE_PERMISSION_UNKNOWN'},
  );

  await accept(query, item);
  await promise;
});

test('result invalida permissão pendente; diálogo vencido não aceita allow novo', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'permissão vencida'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  const pending = query.options.canUseTool('Read', {file_path: join(process.cwd(), 'rascunho.txt')}, {requestId: 'rv', toolUseID: 'tv'});
  await fx.tick();
  assert.equal(events.of('permission_request').at(-1).id, 'rv');

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.deepEqual(await pending, {behavior: 'deny', message: 'Rodada terminou'});
  assert.ok(events.of('permission_cancelled').some((event) => event.id === 'rv'));
  assert.deepEqual(
    adapter.respond({id: 'rv', confirmed: true}),
    {ok: false, id: 'rv', code: 'CLAUDE_PERMISSION_UNKNOWN'},
    'stale não pode conceder allow',
  );
});

/* ---------------- perguntas (AskUserQuestion) ---------------- */

const QUESTION_FIXTURE = Object.freeze({
  questions: [
    {
      header: 'Abordagem',
      question: 'Qual abordagem?',
      options: [
        {label: 'Simples', description: 'Menos partes móveis', preview: '# Simples'},
        {label: 'Robusta', description: 'Mais testes'},
      ],
      multiSelect: true,
    },
    {
      question: 'Publicar agora?',
      options: [
        {label: 'Não', description: 'Espera a revisão'},
        {label: 'Sim', description: 'Vai agora'},
      ],
      multiSelect: false,
    },
  ],
});

test('normalizeUserQuestions/validateQuestionAnswers: forma canônica e recusas explícitas', () => {
  const questions = normalizeUserQuestions(QUESTION_FIXTURE.questions);
  assert.deepEqual(questions, [
    {
      id: 'Qual abordagem?',
      header: 'Abordagem',
      question: 'Qual abordagem?',
      options: [
        {label: 'Simples', description: 'Menos partes móveis', preview: '# Simples'},
        {label: 'Robusta', description: 'Mais testes'},
      ],
      multiSelect: true,
    },
    {
      id: 'Publicar agora?',
      header: 'Pergunta 2',
      question: 'Publicar agora?',
      options: [
        {label: 'Não', description: 'Espera a revisão'},
        {label: 'Sim', description: 'Vai agora'},
      ],
      multiSelect: false,
    },
  ]);
  assert.deepEqual(normalizeUserQuestions([{question: ''}, null, 'x', {question: '  '}]), []);

  const answers = {'Qual abordagem?': ['Simples', 'Robusta'], 'Publicar agora?': 'Não'};
  assert.deepEqual(validateQuestionAnswers(questions, answers), {
    ok: true,
    answers: {'Qual abordagem?': 'Simples, Robusta', 'Publicar agora?': 'Não'},
  });
  assert.equal(validateQuestionAnswers(questions, null).code, 'CLAUDE_QUESTION_ANSWERS_INVALID');
  assert.equal(validateQuestionAnswers(questions, {'Outra?': 'x'}).code, 'CLAUDE_QUESTION_ANSWERS_UNKNOWN');
  assert.equal(validateQuestionAnswers(questions, {'Qual abordagem?': 'Simples'}).code, 'CLAUDE_QUESTION_ANSWERS_MISSING');
  assert.equal(validateQuestionAnswers(questions, {...answers, 'Publicar agora?': ['Sim', 'Não']}).code, 'CLAUDE_QUESTION_ANSWER_INVALID');
  assert.equal(validateQuestionAnswers(questions, {...answers, 'Publicar agora?': ''}).code, 'CLAUDE_QUESTION_ANSWER_INVALID');
  assert.equal(validateQuestionAnswers(questions, {...answers, 'Publicar agora?': []}).code, 'CLAUDE_QUESTION_ANSWER_INVALID');
});

test('AskUserQuestion: permission_request estruturado e allow só com answers validadas', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'pergunta'});
  const item = await fx.takeInput(query);

  const pending = query.options.canUseTool(
    'AskUserQuestion',
    QUESTION_FIXTURE,
    {requestId: 'ask-1', toolUseID: 'tool-ask-1', signal: new AbortController().signal, title: 'Escolha do tutor', description: 'Decida com calma'},
  );
  await fx.tick();
  const request = events.of('permission_request').at(-1);
  assert.equal(request.method, 'question');
  assert.equal(request.toolName, 'AskUserQuestion');
  assert.equal(request.title, 'Escolha do tutor');
  assert.equal(request.message, 'Decida com calma');
  assert.equal(request.runId, item.uuid, 'a pergunta carrega a identidade do turno');
  assert.equal(request.questions.length, 2);
  assert.equal(request.questions[0].multiSelect, true);
  assert.ok(typeof request.expiresAt === 'string' && !Number.isNaN(Date.parse(request.expiresAt)));

  assert.deepEqual(
    adapter.respond({id: 'ask-1', confirmed: true}),
    {ok: false, id: 'ask-1', code: 'CLAUDE_QUESTION_ANSWERS_REQUIRED'},
    'confirmar sem respostas não pode conceder a pergunta',
  );
  assert.deepEqual(
    adapter.respond({id: 'ask-1', answers: {'Qual abordagem?': 'Simples'}}),
    {ok: false, id: 'ask-1', code: 'CLAUDE_QUESTION_ANSWERS_MISSING', detail: {question: 'Publicar agora?'}},
  );
  assert.equal(
    adapter.respond({id: 'ask-1', answers: {'Qual abordagem?': 'Simples', 'Publicar agora?': 'Não', 'Outra?': 'x'}}).code,
    'CLAUDE_QUESTION_ANSWERS_UNKNOWN',
  );
  assert.equal(
    adapter.respond({id: 'ask-1', answers: {'Qual abordagem?': ['Simples', 'Robusta'], 'Publicar agora?': ['Sim', 'Não']}}).code,
    'CLAUDE_QUESTION_ANSWER_INVALID',
  );

  const answered = adapter.respond({
    id: 'ask-1',
    answers: {'Qual abordagem?': ['Simples', 'Robusta'], 'Publicar agora?': 'Não'},
  });
  assert.deepEqual(answered, {
    ok: true,
    id: 'ask-1',
    allowed: true,
    answers: {'Qual abordagem?': 'Simples, Robusta', 'Publicar agora?': 'Não'},
  });
  assert.deepEqual(await pending, {
    behavior: 'allow',
    updatedInput: {
      questions: QUESTION_FIXTURE.questions,
      answers: {'Qual abordagem?': 'Simples, Robusta', 'Publicar agora?': 'Não'},
    },
    toolUseID: 'tool-ask-1',
  });
  assert.equal(events.of('permission_cancelled').length, 0);
  assert.deepEqual(
    adapter.respond({id: 'ask-1', answers: {'Qual abordagem?': 'Simples', 'Publicar agora?': 'Não'}}),
    {ok: false, id: 'ask-1', code: 'CLAUDE_PERMISSION_UNKNOWN'},
    'a pergunta já respondida não aceita segunda resposta',
  );

  await accept(query, item);
  await promise;
});

test('AskUserQuestion: negar, cancelar e abort do SDK negam com permission_cancelled identificado', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'cancela pergunta'});
  const item = await fx.takeInput(query);
  const signal = () => new AbortController().signal;

  const denied = query.options.canUseTool('AskUserQuestion', QUESTION_FIXTURE, {requestId: 'ask-deny', toolUseID: 't-deny', signal: signal()});
  await fx.tick();
  assert.deepEqual(adapter.respond({id: 'ask-deny', confirmed: false}), {ok: true, id: 'ask-deny', allowed: false});
  assert.deepEqual(await denied, {behavior: 'deny', message: 'Recusado pelo usuário'});

  const cancelled = query.options.canUseTool('AskUserQuestion', QUESTION_FIXTURE, {requestId: 'ask-cancel', toolUseID: 't-cancel', signal: signal()});
  await fx.tick();
  assert.deepEqual(adapter.respond({id: 'ask-cancel', cancelled: true}), {ok: true, id: 'ask-cancel', cancelled: true});
  assert.deepEqual(await cancelled, {behavior: 'deny', message: 'Cancelado pelo usuário'});
  assert.ok(events.of('permission_cancelled').some((event) => event.id === 'ask-cancel' && event.reason === 'user'));

  const controller = new AbortController();
  const aborted = query.options.canUseTool('AskUserQuestion', QUESTION_FIXTURE, {requestId: 'ask-abort', toolUseID: 't-abort', signal: controller.signal});
  await fx.tick();
  controller.abort();
  assert.deepEqual(await aborted, {behavior: 'deny', message: 'A execução foi encerrada antes da resposta'});
  assert.ok(events.of('permission_cancelled').some((event) => event.id === 'ask-abort' && event.reason === 'abort'));
  assert.deepEqual(
    adapter.respond({id: 'ask-abort', answers: {'Qual abordagem?': 'Simples', 'Publicar agora?': 'Não'}}),
    {ok: false, id: 'ask-abort', code: 'CLAUDE_PERMISSION_UNKNOWN'},
  );

  const deadController = new AbortController();
  deadController.abort();
  const dead = await query.options.canUseTool('AskUserQuestion', QUESTION_FIXTURE, {requestId: 'ask-dead', toolUseID: 't-dead', signal: deadController.signal});
  assert.deepEqual(dead, {behavior: 'deny', message: 'A execução foi encerrada antes da resposta'});
  assert.equal(events.of('permission_request').some((event) => event.id === 'ask-dead'), false, 'sinal já abortado nem abre diálogo');

  await accept(query, item);
  await promise;
});

test('ID de pergunta vence: deny, permission_cancelled reason expired e respond desconhecido', async () => {
  const {adapter, sdk} = makeAdapter({permissionTtlMs: 25});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'vence'});
  const item = await fx.takeInput(query);

  const pending = query.options.canUseTool('AskUserQuestion', QUESTION_FIXTURE, {requestId: 'ask-exp', toolUseID: 't-exp', signal: new AbortController().signal});
  await fx.tick();
  assert.equal(events.of('permission_request').at(-1).id, 'ask-exp');
  assert.deepEqual(await pending, {behavior: 'deny', message: 'O pedido expirou sem resposta'});
  assert.ok(events.of('permission_cancelled').some((event) => event.id === 'ask-exp' && event.reason === 'expired'));
  assert.deepEqual(
    adapter.respond({id: 'ask-exp', answers: {'Qual abordagem?': 'Simples', 'Publicar agora?': 'Não'}}),
    {ok: false, id: 'ask-exp', code: 'CLAUDE_PERMISSION_UNKNOWN'},
  );

  await accept(query, item);
  await promise;
});

test('result invalida pergunta pendente; resposta vencida nunca concede', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'pergunta vencida'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  const pending = query.options.canUseTool('AskUserQuestion', QUESTION_FIXTURE, {requestId: 'ask-result', toolUseID: 't-result', signal: new AbortController().signal});
  await fx.tick();
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.deepEqual(await pending, {behavior: 'deny', message: 'Rodada terminou'});
  assert.ok(events.of('permission_cancelled').some((event) => event.id === 'ask-result' && event.reason === 'turn_end'));
  assert.equal(
    adapter.respond({id: 'ask-result', answers: {'Qual abordagem?': 'Simples', 'Publicar agora?': 'Não'}}).code,
    'CLAUDE_PERMISSION_UNKNOWN',
  );
});

test('pergunta sem questões válidas é negada sem diálogo; hook deixa o canUseTool decidir', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'pergunta vazia'});
  const item = await fx.takeInput(query);

  const denied = await query.options.canUseTool('AskUserQuestion', {questions: [{header: 'x', question: '  '}]}, {requestId: 'ask-empty', toolUseID: 't-empty'});
  assert.equal(denied.behavior, 'deny');
  assert.match(denied.message, /sem questões válidas/);
  assert.equal(events.of('permission_request').some((event) => event.id === 'ask-empty'), false);

  const hook = query.options.hooks.PreToolUse[0].hooks[0];
  const hookAllowed = await hook({hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: {questions: []}});
  assert.deepEqual(hookAllowed, {continue: true}, 'a decisão da pergunta é do canUseTool, não do hook');

  await accept(query, item);
  await promise;
});

test('pergunta no segundo turno da MESMA consulta nativa usa canUseTool e updatedInput', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const first = await startSend(adapter, sdk, {text: 'primeiro'});
  const input = await fx.takeInput(first.query);
  await accept(first.query, input);
  await first.promise;
  first.query.emit(fx.resultMessage({userMessageUuid: input.uuid}));
  await fx.waitFor(() => !adapter.snapshot().busy);

  const second = await startSend(adapter, sdk, {id: fx.UUID.b, text: 'segundo'});
  assert.equal(second.query, first.query, 'a consulta persistente é a mesma');
  const item2 = await fx.takeInput(second.query);
  const pending = second.query.options.canUseTool('AskUserQuestion', QUESTION_FIXTURE, {requestId: 'ask-2nd', toolUseID: 't-2nd', signal: new AbortController().signal});
  await fx.tick();
  adapter.respond({id: 'ask-2nd', answers: {'Qual abordagem?': 'Robusta', 'Publicar agora?': 'Sim'}});
  assert.equal((await pending).updatedInput.answers['Qual abordagem?'], 'Robusta');
  await accept(second.query, item2);
  await second.promise;
  second.query.emit(fx.resultMessage({userMessageUuid: fx.UUID.b}));
  await fx.waitFor(() => !adapter.snapshot().busy);
  assert.equal(sdk.state.queries.length, 1, 'pergunta não abriu consulta nova');
  adapter.close();
});

test('canUseTool nega caminho fora da política sem nem virar pedido na tela', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'fora'});
  const item = await fx.takeInput(query);

  const denied = await query.options.canUseTool('Read', {file_path: '/etc/hosts'}, {requestId: 'r5', toolUseID: 't5'});
  assert.deepEqual(denied, {behavior: 'deny', message: 'fora das pastas autorizadas desta conversa'});
  assert.equal(events.of('permission_request').some((event) => event.id === 'r5'), false);

  await accept(query, item);
  await promise;
});

test('hook PreToolUse aplica realpath/política inclusive em auto-aprovadas, e barra symlink', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mesa-claude-hook-'));
  try {
    mkdirSync(join(dir, 'pdfs'));
    mkdirSync(join(dir, 'work'));
    mkdirSync(join(dir, 'fora'));
    const pdf = join(dir, 'pdfs', 'enunciado.pdf');
    writeFileSync(pdf, '%PDF-1.4');
    writeFileSync(join(dir, 'fora.txt'), 'segredo');
    writeFileSync(join(dir, 'fora', 'alheio.txt'), 'segredo');
    symlinkSync(join(dir, 'fora.txt'), join(dir, 'work', 'escape.txt'));
    symlinkSync(join(dir, 'fora'), join(dir, 'work', 'link'));

    const {adapter, sdk} = makeAdapter({
      cwd: join(dir, 'work'),
      toolPolicy: {readPaths: [pdf], readRoots: [join(dir, 'work')]},
    });
    await adapter.connect();
    const {promise, query} = await startSend(adapter, sdk, {text: 'hook'});
    const item = await fx.takeInput(query);
    const hook = query.options.hooks.PreToolUse[0].hooks[0];

    const bash = await hook({hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: {command: 'ls'}});
    assert.equal(bash.hookSpecificOutput.permissionDecision, 'deny');

    const fora = await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: join(dir, 'fora.txt')}});
    assert.equal(fora.hookSpecificOutput.permissionDecision, 'deny');

    const proprio = await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: join(dir, 'work', 'rascunho.txt')}});
    assert.equal(proprio.continue, true);
    assert.equal('permissionDecision' in (proprio.hookSpecificOutput || {}), false, 'dentro da raiz controlada segue o fluxo normal');

    const autorizado = await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: pdf}});
    assert.equal(autorizado.continue, true);

    const symlink = await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: join(dir, 'work', 'escape.txt')}});
    assert.equal(symlink.hookSpecificOutput.permissionDecision, 'deny', 'symlink que escapa da raiz é negado pelo realpath');

    const glob = await hook({hook_event_name: 'PreToolUse', tool_name: 'Glob', tool_input: {pattern: '../**'}});
    assert.equal(glob.hookSpecificOutput.permissionDecision, 'deny');

    const globLink = await hook({hook_event_name: 'PreToolUse', tool_name: 'Glob', tool_input: {path: join(dir, 'work'), pattern: 'link/**'}});
    assert.equal(globLink.hookSpecificOutput.permissionDecision, 'deny', 'segmento literal symlink fora da raiz é negado');
    const globBase = await hook({hook_event_name: 'PreToolUse', tool_name: 'Glob', tool_input: {path: join(dir, 'work', 'link'), pattern: '*'}});
    assert.equal(globBase.hookSpecificOutput.permissionDecision, 'deny', 'base symlink fora da raiz é negada');
    const grepLink = await hook({hook_event_name: 'PreToolUse', tool_name: 'Grep', tool_input: {path: join(dir, 'work', 'link'), pattern: 'segredo'}});
    assert.equal(grepLink.hookSpecificOutput.permissionDecision, 'deny');

    for (const pattern of ['/api/.*', '~usuario']) {
      for (const path of [undefined, join(dir, 'work')]) {
        const grep = await hook({hook_event_name: 'PreToolUse', tool_name: 'Grep', tool_input: {path, pattern}});
        assert.deepEqual(grep, {continue: true}, `regex ${pattern} é permitida na pasta autorizada`);
      }
      for (const path of [join(dir, 'fora'), join(dir, 'work', 'link')]) {
        const grep = await hook({hook_event_name: 'PreToolUse', tool_name: 'Grep', tool_input: {path, pattern}});
        assert.equal(grep.hookSpecificOutput.permissionDecision, 'deny', `regex ${pattern} não permite escapar pela pasta base`);
      }
      const glob = await hook({hook_event_name: 'PreToolUse', tool_name: 'Glob', tool_input: {path: join(dir, 'work'), pattern}});
      assert.equal(glob.hookSpecificOutput.permissionDecision, 'deny', `Glob ${pattern} continua bloqueado`);
    }

    const globOk = await hook({hook_event_name: 'PreToolUse', tool_name: 'Glob', tool_input: {path: join(dir, 'work'), pattern: '**/*.txt'}});
    assert.equal(globOk.continue, true);

    await accept(query, item);
    await promise;
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('setToolPolicy troca o PDF ativo por prompt, canonicaliza e recusa em turno/permissão pendente', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mesa-claude-pol-'));
  try {
    const work = join(dir, 'work');
    mkdirSync(work);
    const pdfA = join(dir, 'prova-a.pdf');
    const pdfB = join(dir, 'prova-b.pdf');
    writeFileSync(pdfA, '%PDF-1.4 A');
    writeFileSync(pdfB, '%PDF-1.4 B');

    const {adapter, sdk} = makeAdapter({
      cwd: work,
      toolPolicy: {readPaths: [pdfA], readRoots: [work]},
    });
    await adapter.connect();
    const {promise, query} = await startSend(adapter, sdk, {text: 'troca política'});
    const item = await fx.takeInput(query);
    const hook = query.options.hooks.PreToolUse[0].hooks[0];

    assert.equal((await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: pdfA}})).continue, true);
    assert.equal((await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: pdfB}})).hookSpecificOutput.permissionDecision, 'deny');
    assert.throws(
      () => adapter.setToolPolicy({readPaths: [pdfB], readRoots: [work]}),
      (error) => error.code === 'CLAUDE_BUSY' && error.notSent === true,
      'recusa troca com turno em andamento',
    );

    const pending = query.options.canUseTool('Read', {file_path: join(work, 'rascunho.txt')}, {requestId: 'rp', toolUseID: 'tp'});
    await fx.tick();
    assert.throws(
      () => adapter.setToolPolicy({readPaths: [pdfB], readRoots: [work]}),
      (error) => error.code === 'CLAUDE_BUSY',
      'recusa troca com permissão pendente',
    );
    adapter.respond({id: 'rp', confirmed: true});
    await pending;

    await accept(query, item);
    await promise;
    query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
    await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'turno encerra');

    const applied = adapter.setToolPolicy({readPaths: [pdfB], readRoots: [work]});
    assert.deepEqual(applied.readPaths, [realpathSync(pdfB)]);
    assert.equal((await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: pdfA}})).hookSpecificOutput.permissionDecision, 'deny');
    assert.equal((await hook({hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: {file_path: pdfB}})).continue, true);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

/* ---------------- limite de uso (rate_limit_event) ---------------- */

test('rate_limit_event de primeiro nível pausa sem encerrar o turno e deduplica por janela', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'limite'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  const resetsAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  const frame = fx.rateLimitMessage({status: 'rejected', rateLimitType: 'five_hour', resetsAt, utilization: 0.97});
  query.emit(frame);
  query.emit(frame);
  await fx.tick();

  const warnings = events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED');
  assert.equal(warnings.length, 1, 'a mesma janela avisa uma vez');
  assert.equal(adapter.snapshot().busy, true, 'limite não encerra o turno');
  assert.equal(events.of('turn_end').length, 0, 'nada de turn_end prematuro');
  assert.equal(warnings[0].runId, fx.UUID.a, 'o aviso carrega a identidade do turno');
  assert.equal(warnings[0].rateLimit.status, 'rejected');
  assert.equal(warnings[0].rateLimit.type, 'five_hour');
  assert.equal(warnings[0].rateLimit.blocked, true);
  assert.equal(warnings[0].rateLimit.resetsAt, resetsAt);
  assert.match(warnings[0].rateLimit.resetAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(warnings[0].rateLimit.waitMs > 60 * 60 * 1000);
  assert.equal(warnings[0].rateLimit.utilization, 0.97);
  assert.match(warnings[0].message, /pausada/);
  assert.match(warnings[0].message, /janela de 5 horas/);

  const farResetsAt = Math.floor(Date.now() / 1000) + 40 * 24 * 60 * 60;
  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'seven_day', resetsAt: farResetsAt}));
  await fx.tick();
  const far = events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').at(-1);
  assert.equal(far.rateLimit.waitMs, null, 'espera absurda não vira promessa de relógio');
  assert.equal(far.rateLimit.resetsAt, farResetsAt, 'o reset bruto continua no metadado');

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.equal(events.of('turn_end').at(-1).uncertain, false, 'aceite anterior preservado');
  assert.deepEqual(events.of('delivery').map((event) => event.status), ['transmitting', 'accepted', 'settled']);
});

test('allowed libera a janela e um novo rejected volta a avisar', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'libera'});
  const item = await fx.takeInput(query);
  const resetsAt = Math.floor(Date.now() / 1000) + 3600;

  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'five_hour', resetsAt}));
  await fx.tick();
  query.emit(fx.rateLimitMessage({status: 'allowed', rateLimitType: 'five_hour'}));
  await fx.tick();
  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'five_hour', resetsAt}));
  await fx.tick();
  assert.equal(
    events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').length,
    2,
    'liberar a janela permite avisar de novo',
  );

  await accept(query, item);
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
});

test('allowed_warning avisa sem pausar; overage em uso continua e é interpretado', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'overage'});
  const item = await fx.takeInput(query);
  const resetsAt = Math.floor(Date.now() / 1000) + 1800;

  query.emit(fx.rateLimitMessage({status: 'allowed_warning', rateLimitType: 'seven_day', resetsAt, utilization: 0.8}));
  await fx.tick();
  const near = events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_WARNING');
  assert.equal(near.length, 1);
  assert.equal(near[0].rateLimit.blocked, false);
  assert.match(near[0].message, /próximo/);

  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'five_hour', resetsAt, overageStatus: 'allowed', utilization: 1}));
  await fx.tick();
  const overage = events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_OVERAGE');
  assert.equal(overage.length, 1, 'rejected com overage não pausa');
  assert.equal(overage[0].rateLimit.blocked, false);
  assert.equal(overage[0].rateLimit.overage.inUse, true);
  assert.equal(overage[0].rateLimit.overage.status, 'allowed');
  assert.match(overage[0].message, /overage/);
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').length, 0, 'nada de pausa com overage');
  assert.equal(adapter.snapshot().busy, true);

  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'seven_day_sonnet', resetsAt, isUsingOverage: true}));
  await fx.tick();
  assert.equal(
    events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_OVERAGE').length,
    2,
    'isUsingOverage/overageInUse também contam como overage',
  );

  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'overage', resetsAt, overageStatus: 'rejected'}));
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').length, 1, 'overage rejeitado pausa');

  await accept(query, item);
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
});

test('rate_limit_event de outra sessão é ignorado e não pausa a conversa', async () => {
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'sessão'});
  const item = await fx.takeInput(query);
  query.emit(fx.rateLimitMessage({
    sessionId: fx.UUID.otherSession,
    rateLimitType: 'five_hour',
    resetsAt: Math.floor(Date.now() / 1000) + 60,
  }));
  await fx.tick();
  assert.equal(events.of('warning').some((event) => event.code === 'CLAUDE_RATE_LIMITED'), false);
  assert.ok(events.of('warning').some((event) => event.code === 'CLAUDE_SESSION_MISMATCH'));
  await accept(query, item);
  await promise;
});

test('subtype legado system/rate_limit_event continua interpretado (defensivo)', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'legado'});
  const item = await fx.takeInput(query);
  const frame = fx.rateLimitMessage({
    status: 'rejected',
    rateLimitType: 'seven_day',
    resetsAt: Math.floor(Date.now() / 1000) + 600,
  });
  query.emit({...frame, type: 'system', subtype: 'rate_limit_event'});
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').length, 1);
  await accept(query, item);
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
});

/* ---------------- tradução de eventos ---------------- */

test('stream_event vira delta; final não duplica; tool_start/tool_end saem uma vez; message_stop não libera busy', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'conte'});
  const item = await fx.takeInput(query);
  const messageUuid = fx.newUuid();

  query.emit(fx.initMessage());
  query.emit({
    type: 'stream_event',
    event: {type: 'message_start', message: {id: 'msg_1', model: 'claude-test'}},
    parent_tool_use_id: null,
    uuid: messageUuid,
    session_id: fx.UUID.session,
  });
  query.emit({
    type: 'stream_event',
    event: {type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: 'Olá '}},
    parent_tool_use_id: null,
    uuid: messageUuid,
    session_id: fx.UUID.session,
  });
  query.emit({
    type: 'stream_event',
    event: {type: 'content_block_delta', index: 1, delta: {type: 'thinking_delta', thinking: 'penso'}},
    parent_tool_use_id: null,
    uuid: messageUuid,
    session_id: fx.UUID.session,
  });
  query.emit({
    type: 'stream_event',
    event: {type: 'message_stop'},
    parent_tool_use_id: null,
    uuid: messageUuid,
    session_id: fx.UUID.session,
  });
  await fx.tick();

  assert.equal(adapter.snapshot().busy, true, 'message_stop NÃO libera o turno');
  assert.deepEqual(
    events.of('message_delta').map((event) => ({delta: event.delta, kind: event.kind})),
    [{delta: 'Olá ', kind: 'text'}, {delta: 'penso', kind: 'thinking'}],
  );

  query.emit(fx.assistantMessage({
    uuid: fx.newUuid(),
    text: 'Olá mundo',
    toolUse: {id: 'tool-1', name: 'Read', args: {file_path: 'x'}},
    userMessageUuid: item.uuid,
    messageId: 'msg_1',
  }));
  assert.deepEqual(await promise, {accepted: true, id: fx.UUID.a}, 'assistente correlacionado confirma o aceite');
  await fx.waitFor(() => events.of('message_end').length === 1, 2000, 'message_end depois do aceite');

  assert.equal(events.of('message_delta').length, 2, 'o texto final não vira delta duplicado');
  assert.equal(events.of('message_start').length, 1, 'parcial + final não repetem o início');
  const end = events.of('message_end').at(-1).message;
  assert.deepEqual(end.content, [
    {type: 'text', text: 'Olá mundo'},
    {type: 'toolCall', id: 'tool-1', name: 'Read', arguments: {file_path: 'x'}},
  ]);
  const toolStart = events.of('tool_start').at(-1);
  assert.equal(toolStart.id, 'tool-1');
  assert.equal(toolStart.name, 'Read');
  assert.deepEqual(toolStart.args, {file_path: 'x'});

  query.emit({
    type: 'user',
    message: {
      role: 'user',
      content: [{type: 'tool_result', tool_use_id: 'tool-1', content: 'conteúdo do arquivo', is_error: false}],
    },
    parent_tool_use_id: null,
    session_id: fx.UUID.session,
    uuid: fx.newUuid(),
  });
  await fx.tick();
  const toolEnd = events.of('tool_end').at(-1);
  assert.equal(toolEnd.id, 'tool-1');
  assert.equal(toolEnd.name, 'Read');
  assert.equal(toolEnd.result, 'conteúdo do arquivo');
  assert.equal(toolEnd.isError, false);

  query.emit(fx.assistantMessage({uuid: fx.newUuid(), text: 'subagente', parent_tool_use_id: 'tool-sub'}));
  assert.equal(events.of('message_end').length, 1, 'mensagem de subagente não polui a conversa principal');

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
});

test('init sai antes de send resolver mesmo sem system/init; envelope tem identidade', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'sem init explícito'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  const init = events.of('init').at(0);
  assert.equal(init.sessionId, fx.UUID.session);
  assert.equal(init.conversationId, CONV);
  assert.equal(init.adapter, 'claude');
  const acceptedIndex = events.events.findIndex((event) => event.type === 'delivery' && event.status === 'accepted');
  const initIndex = events.events.findIndex((event) => event.type === 'init');
  assert.ok(initIndex >= 0 && initIndex < acceptedIndex);
  assert.equal(events.events[0].conversationId, CONV, 'todo evento carrega a identidade');
  assert.equal(typeof events.events[0].generation, 'number');
  assert.equal(typeof events.events[0].at, 'string');
});

test('erro de stream do assistente vira código canônico sem encerrar o turno sozinho', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'erro de stream'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  query.emit(fx.assistantMessage({uuid: fx.newUuid(), text: 'parcial', userMessageUuid: fx.UUID.a, error: 'authentication_failed'}));
  await fx.tick();
  const streamError = events.of('error').at(-1);
  assert.equal(streamError.code, 'CLAUDE_AUTH_FAILED');
  assert.equal(streamError.detail.error, 'authentication_failed');
  assert.equal(adapter.snapshot().busy, true, 'erro de stream não encerra o turno sozinho');

  query.emit(fx.resultMessage({subtype: 'error_during_execution', isError: true, userMessageUuid: fx.UUID.a, result: 'API Error', terminalReason: 'api_error'}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  /* `terminal_reason:'api_error'` agora tem código canônico próprio na
     política de liquidação (antes caía no genérico CLAUDE_RESULT_ERROR). */
  const resultError = events.of('error').filter((event) => event.code === 'CLAUDE_API_ERROR').at(-1);
  assert.ok(resultError, 'erro do result tem código canônico de API');
  assert.equal(resultError.detail.terminalReason, 'api_error');
  assert.equal(resultError.fatal, false, 'falha nativa de result não derruba a consulta');
});

/* ---------------- histórico ---------------- */

test('history lê só a própria sessão (ignora options.sessionId) e normaliza sem reexecutar ferramenta', async () => {
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session});
  sdk.state.history = [
    {
      type: 'assistant',
      uuid: 'm1',
      session_id: fx.UUID.session,
      parent_tool_use_id: null,
      parent_agent_id: null,
      message: {
        role: 'assistant',
        content: [
          {type: 'text', text: 'resposta'},
          {type: 'tool_use', id: 't1', name: 'Read', input: {file_path: 'x'}},
        ],
      },
    },
    {
      type: 'user',
      uuid: 'm2',
      session_id: fx.UUID.session,
      parent_tool_use_id: null,
      parent_agent_id: null,
      message: {
        role: 'user',
        content: [
          {type: 'tool_result', tool_use_id: 't1', content: 'ok'},
          {type: 'text', text: 'pergunta'},
          {type: 'image', source: {type: 'base64', media_type: 'image/png', data: 'aGVsbG8='}},
        ],
      },
    },
    {
      type: 'assistant',
      uuid: 'm3',
      session_id: fx.UUID.session,
      parent_tool_use_id: 'tool-sub',
      parent_agent_id: null,
      message: {role: 'assistant', content: [{type: 'text', text: 'subagente'}]},
    },
    {
      type: 'system',
      uuid: 'm4',
      session_id: fx.UUID.session,
      parent_tool_use_id: null,
      parent_agent_id: null,
      message: {role: 'system', content: [{type: 'text', text: 'sistema'}]},
    },
  ];

  const out = await adapter.history({sessionId: fx.UUID.wrong});
  assert.deepEqual(out, [
    {
      role: 'assistant',
      content: [
        {type: 'text', text: 'resposta'},
        {type: 'toolCall', id: 't1', name: 'Read', arguments: {file_path: 'x'}},
      ],
    },
    {
      role: 'user',
      content: [
        {type: 'text', text: 'pergunta'},
        {type: 'image', data: 'aGVsbG8=', mimeType: 'image/png'},
      ],
    },
  ]);
  assert.ok(sdk.state.historyCalls.length >= 1);
  assert.ok(
    sdk.state.historyCalls.every((call) => call.sessionId === fx.UUID.session),
    'nunca consulta outra conversa, mesmo com override no argumento',
  );
  assert.deepEqual(sdk.state.historyCalls[0].options, {dir: process.cwd(), limit: 200, offset: 0});

  const semSessao = makeAdapter().adapter;
  assert.deepEqual(await semSessao.history(), [], 'sem sessão não inventa histórico');
});

test('history pagina a API oficial até o limite explícito em vez de ler só o começo', async () => {
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session});
  sdk.state.pageSize = 2;
  sdk.state.history = Array.from({length: 5}, (_, index) => fx.historyEntry({text: `mensagem ${index}`, uuid: `pg-${index}`}));

  const out = await adapter.history({limit: 4});
  assert.equal(out.length, 4, 'respeita o limite explícito');
  assert.deepEqual(sdk.state.historyCalls.map((call) => call.options.offset), [0, 2]);
  assert.deepEqual(sdk.state.historyCalls.map((call) => call.options.limit), [4, 2]);
  assert.deepEqual(sdk.state.historyCalls.map((call) => call.sessionId), [fx.UUID.session, fx.UUID.session]);

  const full = await adapter.history();
  assert.equal(full.length, 5, 'paginou até o fim disponível (não só a primeira página)');
  assert.ok(sdk.state.historyCalls.length > 2);
  assert.ok(sdk.state.historyCalls.every((call) => call.sessionId === fx.UUID.session));
});

test('history announces an incomplete native prefix at the display row limit', async () => {
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session});
  sdk.state.history = Array.from({length: 201}, (_, index) => fx.historyEntry({text: `message ${index}`}));
  const warnings = []; adapter.on('event', event => { if (event.type === 'warning') warnings.push(event); });
  assert.equal((await adapter.history()).length, 200);
  assert.equal(adapter.historyComplete, false);
  assert.ok(warnings.some(event => event.code === 'CLAUDE_HISTORY_TRUNCATED'));
  assert.deepEqual(sdk.state.historyCalls.map(call => call.options.offset), [0, 200]);
});

test('normalizeHistory com teto de bytes avisa o truncamento em vez de cortar em silêncio', () => {
  const entries = [
    fx.historyEntry({text: 'a'.repeat(300), uuid: 'big-1'}),
    fx.historyEntry({text: 'b'.repeat(300), uuid: 'big-2'}),
  ];
  const truncations = [];
  const out = normalizeHistory(entries, {maxBytes: 100, onTruncate: (info) => truncations.push(info)});
  assert.equal(out.length, 0);
  assert.deepEqual(truncations, [{reason: 'bytes', kept: 0, total: 2, maxBytes: 100}]);
});

/* ---------------- close, reconexão e eventos antigos ---------------- */

test('close depois do aceite registra incerteza, encerra só a própria consulta e preserva o histórico', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'fecha'});
  const item = await fx.takeInput(query);
  await accept(query, item);
  await promise;

  adapter.close();
  assert.equal(query.closeCalls, 1);
  assert.equal(adapter.snapshot().connected, false);
  assert.equal(adapter.snapshot().busy, false);
  await fx.waitFor(() => events.of('turn_end').length === 1, 2000, 'turn_end do close');
  assert.deepEqual(statuses(recorder), ['transmitting', 'accepted', 'uncertain']);
  assert.equal(events.of('turn_end').at(-1).cancelled, true);
  assert.equal(events.of('turn_end').at(-1).uncertain, true);

  const iterator = query.prompt[Symbol.asyncIterator]();
  assert.deepEqual(await iterator.next(), {value: undefined, done: true}, 'a entrada não fica pendurada');

  sdk.state.history = [];
  assert.deepEqual(await adapter.history(), [], 'sem processo, o histórico continua recuperável');
});

test('close antes da entrega é recusa persistida (nada foi ao Claude)', async () => {
  const recorder = fx.persistRecorder();
  const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const {promise, query} = await startSend(adapter, sdk, {text: 'nem sai'});
  await fx.waitFor(() => query.prompt.pendingCount === 1, 2000, 'item na fila');
  adapter.close();
  await assert.rejects(
    () => promise,
    (error) => error.code === 'CLAUDE_DELIVERY_REFUSED' && error.notSent === true,
  );
  await fx.waitFor(() => events.of('turn_end').length === 1, 2000, 'turn_end do close');
  assert.deepEqual(statuses(recorder), ['transmitting', 'refused']);
  assert.equal(events.of('turn_end').at(-1).uncertain, false);
});

test('eventos antigos: consulta velha não emite depois de close/reconnect', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);

  const first = adapter.send({id: fx.UUID.a, text: 'um'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'primeira consulta');
  const q1 = sdk.state.queries[0];
  const item = await fx.takeInput(q1);
  q1.emit(fx.replayMessage(item));
  await first;
  q1.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'primeiro turno encerra');

  adapter.close();
  await adapter.connect();
  const before = events.events.length;
  q1.emit(fx.assistantMessage({uuid: fx.newUuid(), text: 'evento velho'}));
  await fx.tick();
  assert.equal(events.events.length, before, 'mensagem da consulta velha é descartada pela geração');

  const second = adapter.send({id: fx.UUID.b, text: 'dois'});
  await fx.waitFor(() => sdk.state.queries.length === 2, 2000, 'segunda consulta');
  const q2 = sdk.state.queries[1];
  const item2 = await fx.takeInput(q2);
  q2.emit(fx.initMessage());
  q2.emit(fx.replayMessage(item2));
  await second;
  const novas = events.events.slice(before);
  assert.ok(novas.some((event) => event.type === 'turn_start' && event.runId === fx.UUID.b));
  assert.ok(novas.every((event) => event.generation > events.events[0].generation));
});

test('depois de o processo terminar, o próximo send retoma a mesma sessão nativa', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);

  const first = adapter.send({id: fx.UUID.a, text: 'um'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'primeira consulta');
  const q1 = sdk.state.queries[0];
  const item = await fx.takeInput(q1);
  q1.emit(fx.initMessage());
  q1.emit(fx.replayMessage(item));
  await first;
  q1.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'turno encerra');
  q1.end();
  await fx.waitFor(() => events.of('warning').some((event) => event.code === 'CLAUDE_QUERY_ENDED'), 2000, 'aviso de fim de processo');

  const second = adapter.send({id: fx.UUID.b, text: 'dois'});
  await fx.waitFor(() => sdk.state.queries.length === 2, 2000, 'segunda consulta');
  const q2 = sdk.state.queries[1];
  assert.equal(q2.options.resume, fx.UUID.session, 'retomada pelo ID exato, nunca "última sessão"');
  const item2 = await fx.takeInput(q2);
  q2.emit(fx.replayMessage(item2));
  await second;
});

test('sessionId precriado vira o ID nativo da primeira consulta; retomada usa resume', async () => {
  {
    const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, resume: false});
    await adapter.connect();
    const {promise, query} = await startSend(adapter, sdk, {text: 'primeira'});
    assert.equal(query.options.sessionId, fx.UUID.session, 'o ID do registro É o ID nativo desde o começo');
    assert.equal(query.options.resume, undefined, 'sessionId e resume nunca se combinam');
    const item = await fx.takeInput(query);
    await accept(query, item);
    await promise;
  }
  {
    const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, resume: true});
    await adapter.connect();
    const {promise, query} = await startSend(adapter, sdk, {text: 'retomando'});
    assert.equal(query.options.resume, fx.UUID.session);
    assert.equal(query.options.sessionId, undefined);
    const item = await fx.takeInput(query);
    await accept(query, item);
    await promise;
  }
});

/* ---------------- opções do SDK ---------------- */

test('opções do SDK: replay público, isolamento, só leitura, binário, prompt e env sem auto-update', async () => {
  const sdk = fx.fakeSdk();
  const {adapter} = makeAdapter({
    sdk,
    claudePath: '/opt/claude/versions/2.1.246',
    systemPrompt: 'Você é um tutor de estudos; só leitura.',
    sessionId: fx.UUID.session,
    resume: true,
    env: {MESA_EXTRA: '1'},
  });
  await adapter.connect();
  const {promise, query} = await startSend(adapter, sdk);
  const item = await fx.takeInput(query);
  const options = query.options;

  assert.equal(options.cwd, process.cwd());
  assert.deepEqual(options.settingSources, []);
  assert.equal(options.strictMcpConfig, true);
  assert.deepEqual(options.mcpServers, {});
  assert.deepEqual(options.tools, ['Read', 'Glob', 'Grep', 'AskUserQuestion']);
  for (const proibida of ['Bash', 'Edit', 'Write', 'Agent', 'Task', 'WebFetch', 'Skill']) {
    assert.ok(options.disallowedTools.includes(proibida), `${proibida} desabilitada`);
  }
  assert.equal(options.disallowedTools.includes('AskUserQuestion'), false, 'AskUserQuestion é a única ferramenta interativa exposta');
  assert.equal(options.permissionMode, 'default');
  assert.equal(options.includePartialMessages, true);
  assert.deepEqual(options.extraArgs, {'replay-user-messages': null}, 'flag pública da CLI para o eco de aceite');
  assert.equal(options.pathToClaudeCodeExecutable, '/opt/claude/versions/2.1.246');
  assert.equal(options.systemPrompt, 'Você é um tutor de estudos; só leitura.');
  assert.equal(options.resume, fx.UUID.session);
  assert.equal(options.sessionId, undefined);
  assert.equal(typeof options.canUseTool, 'function');
  assert.equal(typeof options.hooks.PreToolUse[0].hooks[0], 'function');
  assert.equal(options.env.MESA_EXTRA, '1');
  assert.equal(options.env.PATH, process.env.PATH, 'env do processo é mesclado, não descartado');
  assert.equal(options.env.DISABLE_AUTOUPDATER, '1', 'auto-update desligado só no subprocesso');
  assert.match(options.env.CLAUDE_AGENT_SDK_CLIENT_APP, /mesa-de-estudos/);

  await accept(query, item);
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'turno encerra');
});
