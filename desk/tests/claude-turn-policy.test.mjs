/* Política pura de liquidação do turno Claude (desk/src/agents/claude-turn-policy.cjs).
 *
 * Tudo sintético: nenhum SDK, binário, credencial, sessão, rede, processo ou
 * inferência; nenhum arquivo do runtime é lido/escrito. O módulo é puro (sem
 * I/O), então o teste importa direto. O último bloco ancora as decisões no
 * artefato gerado do núcleo Bend (`src/generated/agentdelivery.core.js`), que
 * permanece com o pai — aqui só se verifica que a política concorda com ele.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const policy = require('../src/agents/claude-turn-policy.cjs');
const delivery = require('../src/generated/agentdelivery.core.js').default;

const WIRE = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';

function replay(uuid = WIRE, extra = {}) {
  return {type: 'user', isReplay: true, uuid, session_id: SESSION, message: {role: 'user', content: 'texto'}, ...extra};
}

function result(extra = {}) {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    num_turns: 1,
    result: 'resposta',
    errors: [],
    uuid: '44444444-4444-4444-8444-444444444444',
    session_id: SESSION,
    ...extra,
  };
}

function decide(message, extra = {}) {
  return policy.classifyResultCorrelation({message, wireUuid: WIRE, accepted: true, ...extra});
}

/* ---------------- evidência de correlação ---------------- */

test('replay do próprio envio é match; replay de outro UUID é mismatch; sem carimbo é none', () => {
  assert.equal(policy.correlationEvidence(replay(), WIRE).evidence, 'match');
  assert.equal(policy.correlationEvidence(replay(FOREIGN), WIRE).evidence, 'mismatch');
  assert.equal(policy.correlationEvidence({type: 'user', isReplay: true}, WIRE).evidence, 'none');
  assert.equal(policy.correlationEvidence(result(), WIRE).evidence, 'none');
  assert.equal(policy.correlationEvidence(result(), null).evidence, 'none');
});

test('user_message_uuids (lista) tem precedência sobre user_message_uuid (singular)', () => {
  const conflicting = result({user_message_uuids: [FOREIGN], user_message_uuid: WIRE});
  assert.equal(policy.correlationEvidence(conflicting, WIRE).evidence, 'mismatch');
  const agreeing = result({user_message_uuids: [FOREIGN, WIRE], user_message_uuid: FOREIGN});
  assert.equal(policy.correlationEvidence(agreeing, WIRE).evidence, 'match');
  const onlySingular = result({user_message_uuid: WIRE});
  assert.equal(policy.correlationEvidence(onlySingular, WIRE).evidence, 'match');
});

/* ---------------- L1: result sem eco ---------------- */

test('L1: result success sem eco depois do aceite comprovado liquida settled', () => {
  const decision = decide(result());
  assert.equal(decision.evidence, 'none');
  assert.equal(decision.action, 'finalize');
  assert.equal(decision.outcome, 'settled');
  assert.equal(decision.reason, 'uncorrelated-accepted-single-turn');
});

test('L1: result sem eco antes de qualquer aceite é ignorado (taken não é aceite)', () => {
  const decision = decide(result(), {accepted: false, taken: true, phase: 'transmitting'});
  assert.equal(decision.action, 'ignore');
  assert.equal(decision.reason, 'uncorrelated-unaccepted');
});

test('L1: result sem eco com aceite degradado não liquida (espera preservada)', () => {
  const decision = decide(result(), {degraded: true});
  assert.equal(decision.action, 'ignore');
  assert.equal(decision.reason, 'uncorrelated-degraded');
});

test('L1: evidência estrangeira anterior bloqueia o result sem eco', () => {
  const decision = decide(result(), {foreignSeen: true});
  assert.equal(decision.action, 'ignore');
  assert.equal(decision.reason, 'uncorrelated-foreign-seen');
});

test('L1: result sem eco com origem não-humana é ignorado; origem humana permite', () => {
  const task = decide(result({origin: {kind: 'task-notification'}}));
  assert.equal(task.action, 'ignore');
  assert.equal(task.reason, 'uncorrelated-non-human-origin');
  const peer = decide(result({origin: {kind: 'peer', from: 'outra-sessao'}}));
  assert.equal(peer.action, 'ignore');
  assert.equal(peer.reason, 'uncorrelated-non-human-origin');
  const human = decide(result({origin: {kind: 'human'}}));
  assert.equal(human.action, 'finalize');
  assert.equal(human.outcome, 'settled');
});

test('L1: result sem eco de turno zero é detrito e não liquida', () => {
  const decision = decide(result({num_turns: 0, origin: {kind: 'task-notification'}}));
  assert.equal(decision.action, 'ignore');
  assert.equal(decision.reason, 'uncorrelated-zero-turn-debris');
});

test('L1: result sem eco com mais de um turno pendente não liquida', () => {
  const decision = decide(result(), {outstandingTurns: 2});
  assert.equal(decision.action, 'ignore');
  assert.equal(decision.reason, 'uncorrelated-not-single-turn');
});

test('uuid estrangeiro explícito continua ignorado mesmo com aceite e turno único', () => {
  const decision = decide(result({user_message_uuid: FOREIGN}));
  assert.equal(decision.evidence, 'mismatch');
  assert.equal(decision.action, 'ignore');
  assert.equal(decision.reason, 'foreign-uuid');
});

test('eco do próprio UUID com aceite liquida settled; sem aceite ou degradado finaliza incerto', () => {
  const settled = decide(result({user_message_uuid: WIRE}));
  assert.equal(settled.outcome, 'settled');
  assert.equal(settled.reason, 'echo-match');
  const unaccepted = decide(result({user_message_uuid: WIRE}), {accepted: false});
  assert.equal(unaccepted.action, 'finalize');
  assert.equal(unaccepted.outcome, 'uncertain');
  assert.equal(unaccepted.reason, 'echo-match-unaccepted');
  const degraded = decide(result({user_message_uuid: WIRE}), {degraded: true});
  assert.equal(degraded.outcome, 'uncertain');
  assert.equal(degraded.reason, 'echo-match-degraded');
});

test('mensagem que não é result nunca finaliza', () => {
  assert.equal(decide({type: 'assistant'}).reason, 'not-result');
  assert.equal(policy.classifyResultCorrelation().reason, 'not-result');
});

/* ---------------- L2: fim de consulta / cancelamento ---------------- */

test('L2: cancelamento após aceite com fim de consulta observado liquida settled cancelled sem incerteza', () => {
  const end = policy.classifyQueryEnd({accepted: true, taken: true, phase: 'accepted', cancelled: true, endKind: 'query'});
  assert.equal(end.outcome, 'settled');
  assert.equal(end.cancelled, true);
  assert.equal(end.uncertain, false);
  assert.equal(end.reason, 'cancelled-after-accept');
});

test('L2: queda da consulta depois do cancelamento explícito ainda liquida settled (cancelamento domina)', () => {
  const end = policy.classifyQueryEnd({
    accepted: true,
    taken: true,
    phase: 'accepted',
    cancelled: true,
    endKind: 'query',
    failure: new Error('runtime_exit sem result'),
  });
  assert.equal(end.outcome, 'settled');
  assert.equal(end.uncertain, false);
});

test('crash sem cancelamento permanece incerto: não apaga a espera segura', () => {
  const end = policy.classifyQueryEnd({accepted: true, taken: true, phase: 'accepted', cancelled: false, endKind: 'query'});
  assert.equal(end.outcome, 'uncertain');
  assert.equal(end.uncertain, true);
  assert.equal(end.reason, 'ended-without-result');
  const crashed = policy.classifyQueryEnd({
    accepted: true,
    taken: true,
    phase: 'accepted',
    cancelled: false,
    endKind: 'query',
    failure: new Error('processo morreu'),
  });
  assert.equal(crashed.outcome, 'uncertain');
  assert.equal(crashed.reason, 'ended-with-failure');
});

test('L2: cancelamento antes do aceite e sem I/O é recusa comprovada, não incerteza', () => {
  const end = policy.classifyQueryEnd({
    accepted: false,
    taken: false,
    phase: 'transmitting',
    cancelled: true,
    endKind: 'query',
  });
  assert.equal(end.outcome, 'refused');
  assert.equal(end.cancelled, true);
  assert.equal(end.uncertain, false);
  assert.equal(end.reason, 'cancelled-before-delivery');
});

test('L2: cancelamento antes do aceite com item já puxado pela consulta vira incerto', () => {
  const end = policy.classifyQueryEnd({
    accepted: false,
    taken: true,
    phase: 'transmitting',
    cancelled: true,
    endKind: 'query',
  });
  assert.equal(end.outcome, 'uncertain');
  assert.equal(end.reason, 'cancelled-before-proof');
});

test('close/timeout do host não são fim nativo observado: incerto mesmo com aceite e cancelamento', () => {
  for (const endKind of ['close', 'timeout']) {
    const end = policy.classifyQueryEnd({accepted: true, taken: true, phase: 'accepted', cancelled: true, endKind});
    assert.equal(end.outcome, 'uncertain');
    assert.equal(end.cancelled, true);
    assert.equal(end.uncertain, true);
    assert.equal(end.reason, 'cancelled-unobserved-end');
  }
  const unknown = policy.classifyQueryEnd({accepted: true, phase: 'accepted', cancelled: true, endKind: 'qualquer'});
  assert.equal(unknown.reason, 'cancelled-unobserved-end');
});

test('aceite degradado não vira settled: a espera segura é mantida', () => {
  const end = policy.classifyQueryEnd({
    accepted: true,
    taken: true,
    phase: 'accepted',
    cancelled: true,
    degraded: true,
    endKind: 'query',
  });
  assert.equal(end.outcome, 'uncertain');
  assert.equal(end.reason, 'accepted-degraded-safe-hold');
});

test('fim sem entrega e sem cancelamento é recusa; fase desconhecida é conservadora', () => {
  const refused = policy.classifyQueryEnd({accepted: false, taken: false, phase: 'transmitting', endKind: 'query'});
  assert.equal(refused.outcome, 'refused');
  assert.equal(refused.uncertain, false);
  assert.equal(refused.reason, 'ended-before-delivery');
  const unknownPhase = policy.classifyQueryEnd({accepted: false, taken: false, phase: undefined, endKind: 'query'});
  assert.equal(unknownPhase.outcome, 'uncertain');
});

/* ---------------- L3: limite de uso, sobrecarga e causas claras ---------------- */

test('L3: blocking_limit em envelope success vira erro de limite, sem criar incerteza', () => {
  const message = result({subtype: 'success', is_error: false, terminal_reason: 'blocking_limit'});
  const failure = policy.classifyResultFailure(message);
  assert.equal(failure.code, 'CLAUDE_RATE_LIMITED');
  assert.equal(failure.class, 'usage_limit');
  assert.equal(failure.detail.usageLimitSource, 'blocking_limit');
  const deliveryDecision = decide(message);
  assert.equal(deliveryDecision.outcome, 'settled');
  assert.equal(deliveryDecision.settled, true);
});

test('L3: api_error_status 429 vira CLAUDE_RATE_LIMITED com origem api_error_429', () => {
  const failure = policy.classifyResultFailure(result({is_error: true, api_error_status: 429}));
  assert.equal(failure.code, 'CLAUDE_RATE_LIMITED');
  assert.equal(failure.class, 'usage_limit');
  assert.equal(failure.detail.usageLimitSource, 'api_error_429');
  assert.equal(failure.apiErrorStatus, 429);
  assert.equal(failure.providerRetryable, true);
});

test('L3: api_error_status 529 vira CLAUDE_OVERLOADED', () => {
  const failure = policy.classifyResultFailure(result({is_error: true, api_error_status: 529}));
  assert.equal(failure.code, 'CLAUDE_OVERLOADED');
  assert.equal(failure.class, 'overloaded');
  assert.equal(failure.providerRetryable, true);
});

test('L3: janela rejeitada não recuperada classifica o result como limite', () => {
  const failure = policy.classifyResultFailure(
    result({is_error: true, terminal_reason: 'api_error'}),
    {rejectedRateLimitTypes: ['five_hour'], rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: '2026-10-05T18:00:00.000Z', blocked: true}},
  );
  assert.equal(failure.code, 'CLAUDE_RATE_LIMITED');
  assert.equal(failure.detail.usageLimitSource, 'rejected_window');
  assert.deepEqual(failure.detail.usageLimitTypes, ['five_hour']);
  assert.equal(failure.rateLimit.resetsAt, '2026-10-05T18:00:00.000Z');
});

test('L3: janela liberada depois de rejeitada NÃO rotula limite (recuperado)', () => {
  const failure = policy.classifyResultFailure(
    result({is_error: true, terminal_reason: 'api_error'}),
    {rejectedRateLimitTypes: []},
  );
  assert.equal(failure.code, 'CLAUDE_API_ERROR');
  assert.equal(failure.class, 'provider_error');
  assert.equal(failure.detail.usageLimitSource, null);
});

test('L3: assistant rate_limit é evidência de limite restante quando não há janela registrada', () => {
  const failure = policy.classifyResultFailure(
    result({is_error: true, terminal_reason: 'api_error'}),
    {latestAssistantRateLimited: true},
  );
  assert.equal(failure.code, 'CLAUDE_RATE_LIMITED');
  assert.equal(failure.detail.usageLimitSource, 'assistant_rate_limit');
});

test('L3: falha de autenticação não é confundida com limite pela janela', () => {
  const failure = policy.classifyResultFailure(
    result({is_error: true, terminal_reason: 'api_error'}),
    {rejectedRateLimitTypes: ['five_hour'], authenticationFailure: true},
  );
  assert.equal(failure.code, 'CLAUDE_API_ERROR');
  assert.equal(failure.class, 'provider_error');
});

test('causas nativas claras: contexto, imagem e orçamento do SDK pinado', () => {
  const context = policy.classifyResultFailure(result({terminal_reason: 'prompt_too_long'}));
  assert.equal(context.code, 'CLAUDE_CONTEXT_LIMIT');
  assert.equal(context.class, 'context_limit');
  const refill = policy.classifyResultFailure(result({terminal_reason: 'rapid_refill_breaker'}));
  assert.equal(refill.code, 'CLAUDE_CONTEXT_REFILL');
  const image = policy.classifyResultFailure(result({terminal_reason: 'image_error'}));
  assert.equal(image.code, 'CLAUDE_IMAGE_ERROR');
  assert.equal(image.class, 'image_error');
  const budget = policy.classifyResultFailure(result({terminal_reason: 'budget_exhausted'}));
  assert.equal(budget.code, 'CLAUDE_BUDGET_EXHAUSTED');
  assert.equal(budget.class, 'budget');
});

test('result success limpo não é falha; subtype de erro tem código próprio', () => {
  assert.equal(policy.classifyResultFailure(result()), null);
  const maxTurns = policy.classifyResultFailure(result({subtype: 'error_max_turns', is_error: true}));
  assert.equal(maxTurns.code, 'CLAUDE_MAX_TURNS');
  const budget = policy.classifyResultFailure(result({subtype: 'error_max_budget_usd', is_error: true}));
  assert.equal(budget.code, 'CLAUDE_BUDGET_EXHAUSTED');
  const during = policy.classifyResultFailure(result({subtype: 'error_during_execution', is_error: true, errors: ['quebrou de verdade']}));
  assert.equal(during.code, 'CLAUDE_RESULT_ERROR');
  assert.equal(during.message, 'quebrou de verdade');
  const diagnostic = policy.classifyResultFailure(result({is_error: true, errors: ['[ede_diagnostic] barulho', 'falha real']}));
  assert.equal(diagnostic.message, 'falha real');
});

/* ---------------- L4: retry nativo ---------------- */

test('L4: api_retry preserva tentativa, máximo, atraso e status sem encerrar o turno', () => {
  const retry = policy.classifyApiRetry({
    type: 'system',
    subtype: 'api_retry',
    attempt: 2,
    max_retries: 10,
    retry_delay_ms: 1500,
    error_status: 529,
    error: 'overloaded',
    uuid: '55555555-5555-4555-8555-555555555555',
    session_id: SESSION,
  });
  assert.equal(retry.code, 'CLAUDE_OVERLOADED');
  assert.equal(retry.class, 'overloaded');
  assert.equal(retry.retryable, true);
  assert.equal(retry.endsTurn, false);
  assert.equal(retry.deliveryEffect, 'none');
  assert.deepEqual(retry.detail, {attempt: 2, maxRetries: 10, retryDelayMs: 1500, errorStatus: 529, error: 'overloaded'});
  assert.match(retry.message, /tentativa 2 de 10/);
});

test('L4: api_retry 429 vira limite; status nulo vira transporte; resto é retry genérico', () => {
  const limited = policy.classifyApiRetry({type: 'system', subtype: 'api_retry', attempt: 1, max_retries: 5, retry_delay_ms: 10, error_status: 429, error: 'rate_limit'});
  assert.equal(limited.code, 'CLAUDE_RATE_LIMITED');
  assert.equal(limited.class, 'usage_limit');
  const transport = policy.classifyApiRetry({type: 'system', subtype: 'api_retry', attempt: 1, max_retries: 5, retry_delay_ms: 10, error_status: null, error: 'unknown'});
  assert.equal(transport.code, 'CLAUDE_API_RETRY');
  assert.equal(transport.class, 'transport_error');
  const generic = policy.classifyApiRetry({type: 'system', subtype: 'api_retry', attempt: 1, max_retries: 5, retry_delay_ms: 10, error_status: 500, error: 'server_error'});
  assert.equal(generic.code, 'CLAUDE_API_RETRY');
  assert.equal(generic.class, 'provider_error');
});

test('L4: api_retry sanitiza números e status fora da faixa sem inventar valores', () => {
  const retry = policy.classifyApiRetry({
    type: 'system',
    subtype: 'api_retry',
    attempt: -3,
    max_retries: 1e12,
    retry_delay_ms: Number.NaN,
    error_status: 999,
    error: 'x'.repeat(200),
  });
  assert.equal(retry.detail.attempt, 1);
  assert.equal(retry.detail.maxRetries, policy.LIMITS.MAX_RETRY_FIELD);
  assert.equal(retry.detail.retryDelayMs, 0);
  assert.equal(retry.detail.errorStatus, null);
  assert.equal(retry.detail.error, null);
});

test('L4: chave de dedupe é estável por tentativa/status e mensagem repetida não é nova', () => {
  const base = {type: 'system', subtype: 'api_retry', attempt: 3, max_retries: 10, retry_delay_ms: 2500, error_status: 529, error: 'overloaded'};
  const first = policy.classifyApiRetry(base);
  const second = policy.classifyApiRetry({...base});
  assert.equal(first.dedupeKey, second.dedupeKey);
  const nextAttempt = policy.classifyApiRetry({...base, attempt: 4});
  assert.notEqual(first.dedupeKey, nextAttempt.dedupeKey);
});

test('mensagem que não é api_retry não é classificada como retry', () => {
  assert.equal(policy.classifyApiRetry(result()), null);
  assert.equal(policy.classifyApiRetry({type: 'system', subtype: 'init'}), null);
});

/* ---------------- L5: recusa/fallback ---------------- */

test('L5: model_refusal_fallback normaliza aviso e retração sem decidir evicção', () => {
  const refusal = policy.classifyRefusalNotice({
    type: 'system',
    subtype: 'model_refusal_fallback',
    trigger: 'refusal',
    direction: 'retry',
    scope: 'local',
    original_model: 'modelo-a',
    fallback_model: 'modelo-b',
    request_id: null,
    api_refusal_category: 'cyber',
    api_refusal_explanation: null,
    retracted_message_uuids: ['u-1', 'u-2', 'u-1'],
    refused_user_message_uuid: WIRE,
    content: 'O modelo original recusou; a resposta veio do fallback.',
    uuid: '66666666-6666-4666-8666-666666666666',
    session_id: SESSION,
  });
  assert.equal(refusal.kind, 'fallback');
  assert.equal(refusal.code, 'CLAUDE_MODEL_FALLBACK');
  assert.equal(refusal.hasNotice, true);
  assert.equal(refusal.notice, 'O modelo original recusou; a resposta veio do fallback.');
  assert.equal(refusal.eviction, 'deferred');
  assert.equal(refusal.detail.direction, 'retry');
  assert.equal(refusal.detail.scope, 'local');
  assert.deepEqual(refusal.detail.retractedMessageUuids, ['u-1', 'u-2']);
  assert.equal(refusal.detail.retractedCount, 3);
  assert.equal(refusal.detail.refusedUserMessageUuid, WIRE);
});

test('L5: fallback sem content não emite aviso vazio, mas preserva a retração', () => {
  const refusal = policy.classifyRefusalNotice({
    type: 'system',
    subtype: 'model_refusal_fallback',
    direction: 'revert',
    original_model: 'modelo-a',
    fallback_model: 'modelo-b',
    retracted_message_uuids: ['u-9'],
    content: '   ',
    uuid: '77777777-7777-4777-8777-777777777777',
    session_id: SESSION,
  });
  assert.equal(refusal.hasNotice, false);
  assert.equal(refusal.notice, null);
  assert.deepEqual(refusal.detail.retractedMessageUuids, ['u-9']);
  assert.equal(refusal.detail.scope, 'session');
  assert.equal(refusal.detail.scopeDeclared, false);
});

test('L5: model_refusal_no_fallback é recusa simples com categoria limitada', () => {
  const refusal = policy.classifyRefusalNotice({
    type: 'system',
    subtype: 'model_refusal_no_fallback',
    original_model: 'modelo-a',
    api_refusal_category: 'bio',
    content: 'O modelo recusou a solicitação.',
    uuid: '88888888-8888-4888-8888-888888888888',
    session_id: SESSION,
  });
  assert.equal(refusal.kind, 'no_fallback');
  assert.equal(refusal.code, 'CLAUDE_MODEL_REFUSAL');
  assert.equal(refusal.hasNotice, true);
  assert.equal(refusal.eviction, 'none');
  assert.equal(refusal.detail.apiRefusalCategory, 'bio');
});

test('L5: lista de retração é limitada e filtra lixo', () => {
  const retracted_message_uuids = Array.from({length: 100}, (_, index) => `retratado-${index}`);
  retracted_message_uuids.push(42);
  const refusal = policy.classifyRefusalNotice({
    type: 'system',
    subtype: 'model_refusal_fallback',
    direction: 'sticky',
    original_model: 'modelo-a',
    fallback_model: 'modelo-b',
    retracted_message_uuids,
    content: 'fallback',
    uuid: '99999999-9999-4999-8999-999999999999',
    session_id: SESSION,
  });
  assert.equal(refusal.detail.retractedMessageUuids.length, policy.LIMITS.MAX_RETRACTED_UUIDS);
  assert.equal(refusal.detail.retractedCount, 100);
  assert.equal(refusal.detail.retractedTruncated, true);
  assert.equal(refusal.detail.direction, 'sticky');
});

test('avisos que não são de recusa não são classificados', () => {
  assert.equal(policy.classifyRefusalNotice({type: 'system', subtype: 'api_retry'}), null);
  assert.equal(policy.classifyRefusalNotice({type: 'assistant'}), null);
  assert.equal(policy.classifyRefusalNotice(null), null);
});

/* ---------------- ancoragem no núcleo Bend ---------------- */

test('decisões settled/refused respeitam o outcome gerado do núcleo Bend', () => {
  assert.equal(delivery.outcome(true, true).$, 'DeliveryOutcome.Accepted');
  assert.equal(delivery.outcome(false, true).$, 'DeliveryOutcome.Uncertain');
  assert.equal(delivery.outcome(false, false).$, 'DeliveryOutcome.Refused');

  const cases = [
    {input: {accepted: true, taken: true, phase: 'accepted', cancelled: true, endKind: 'query'}, expected: 'settled'},
    {input: {accepted: true, taken: true, phase: 'accepted', cancelled: false, endKind: 'query'}, expected: 'uncertain'},
    {input: {accepted: false, taken: true, phase: 'transmitting', cancelled: true, endKind: 'query'}, expected: 'uncertain'},
    {input: {accepted: false, taken: false, phase: 'transmitting', cancelled: true, endKind: 'query'}, expected: 'refused'},
    {input: {accepted: false, taken: false, phase: 'transmitting', cancelled: false, endKind: 'query'}, expected: 'refused'},
  ];
  for (const {input, expected} of cases) {
    const end = policy.classifyQueryEnd(input);
    assert.equal(end.outcome, expected);
    if (end.outcome === 'settled') {
      assert.equal(input.accepted, true, 'settled exige aceite comprovado');
      assert.equal(delivery.outcome(true, true).$, 'DeliveryOutcome.Accepted');
      assert.equal(delivery.mayRetry(delivery.outcome(true, true)), false);
      assert.equal(delivery.mayAdvanceQueue(false, false, end.uncertain, end.cancelled), false);
    }
    if (end.outcome === 'refused') {
      assert.equal(delivery.outcome(input.accepted, end.mayHaveSent).$, 'DeliveryOutcome.Refused');
      assert.equal(delivery.mayRetry(delivery.outcome(false, false)), true);
    }
    if (end.outcome === 'uncertain') {
      assert.equal(delivery.mayAdvanceQueue(false, false, true, input.cancelled === true), false);
    }
  }

  const scenario = {message: result(), wireUuid: WIRE, accepted: true, degraded: false};
  assert.equal(policy.classifyResultCorrelation(scenario).outcome, 'settled');
  assert.equal(delivery.outcome(scenario.accepted, true).$, 'DeliveryOutcome.Accepted');
  const held = {message: result({num_turns: 0}), wireUuid: WIRE, accepted: false, degraded: true};
  assert.equal(policy.classifyResultCorrelation(held).action, 'ignore');
  assert.equal(delivery.mayAdvanceQueue(false, false, true, false), false);
});
