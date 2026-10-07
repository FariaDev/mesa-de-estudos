/* Política pura de liquidação do turno Claude Code — ponte Mesa ↔ SDK 0.3.246.
 *
 * Módulo PURO: não importa o SDK, não faz I/O, não cria timer, não abre rede,
 * não inicia consulta e NUNCA decide reenvio. Ele transforma fatos que o host
 * já mediu (aceite persistido, evidência de correlação, fim da consulta,
 * mensagens nativas do CLI) em decisões explícitas que o adaptador aplica:
 *
 *   - correlação do `result` (inclusive sem eco `user_message_uuid`);
 *   - desfecho do fim de consulta (cancelamento após aceite × queda sem cancelamento);
 *   - classificação de falhas nativas (limite de uso, sobrecarga, contexto, imagem, orçamento);
 *   - progresso de `api_retry` (tentativa/máximo/atraso/status preservados);
 *   - aviso de recusa com modelo de fallback e lista de retração.
 *
 * Decisões conservadoras (fail closed):
 *   - sem eco, só liquida o turno ÚNICO com ACEITE COMPROVADO e não degradado,
 *     sem evidência estrangeira anterior, sem origem não-humana e sem
 *     `num_turns` zero; `taken` (item puxado pela consulta) NÃO é prova de
 *     aceite e não aparece na assinatura;
 *   - UUID estrangeiro explícito continua ignorado;
 *   - cancelamento só liquida `settled` com aceite comprovado E fim de consulta
 *     observado (`endKind: 'query'`); `close`/timer do host continuam
 *     conservadores (a entrega é conhecida, o fim nativo não);
 *   - queda da consulta sem cancelamento continua incerta (não apaga a espera);
 *   - classificação de erro NUNCA cria incerteza de entrega: aceite comprovado
 *     permanece `settled`;
 *   - `api_retry` não encerra turno nem muda a entrega (`endsTurn:false`,
 *     `deliveryEffect:'none'`);
 *   - recusa/fallback devolve dados limitados; evicção de DOM fica adiada.
 *
 * O núcleo Bend (`core/agentdelivery.bend`) decide a entrega: aceite domina
 * `mayHaveSent`. As decisões daqui DEVEM concordar com o artefato gerado
 * (`desk/src/generated/agentdelivery.core.js`): `settled` só com aceite,
 * `refused` só sem indício de envio, `uncertain` segura a fila.
 *
 * Referência conceitual (sem cópia de código): comportamento do T3 Code no
 * commit 1604ccc9d79f5270fb8e14d60664184bf142c4cb (`ClaudeAdapterV2.ts`,
 * `isClaudeResultForOtherTurn`, `providerFailureFromResult`,
 * `providerFailureFromApiRetry`), MIT © 2026 T3 Tools Inc. As APIs usadas são
 * SÓ as do SDK pinado (@anthropic-ai/claude-agent-sdk 0.3.246): `TerminalReason`,
 * `SDKResultSuccess/Error`, `SDKAPIRetryMessage`, `SDKModelRefusalFallbackMessage`,
 * `SDKUserMessageReplay`.
 *
 * Contrato do host (o pai liga; este módulo não conhece adapter/main/IPC/DOM):
 *   const policy = require('./claude-turn-policy.cjs');
 *   const corr = policy.classifyResultCorrelation({message, wireUuid, accepted,
 *     degraded, foreignSeen, outstandingTurns});
 *   if (corr.action === 'finalize') await finish(turn, corr.outcome, ...);
 *   const failure = policy.classifyResultFailure(message, {rejectedRateLimitTypes, ...});
 *   const end = policy.classifyQueryEnd({accepted, taken, phase, cancelled, degraded, endKind});
 *   const retry = policy.classifyApiRetry(message);        // nunca encerra turno
 *   const refusal = policy.classifyRefusalNotice(message); // evicção adiada
 */
'use strict';

const POLICY_VERSION = '1.0.0-experimental';

const LIMITS = Object.freeze({
  MAX_TEXT_CHARS: 2000,
  MAX_ERROR_TEXT_CHARS: 2000,
  MAX_EXPLANATION_CHARS: 500,
  MAX_MODEL_CHARS: 200,
  MAX_UUID_CHARS: 128,
  MAX_RETRACTED_UUIDS: 64,
  MAX_RATE_LIMIT_TYPES: 8,
  MAX_RETRY_FIELD: 1000000,
  MAX_RETRY_DELAY_MS: 2147483647,
});

/* Códigos estáveis de erro/aviso. O host pode mapeá-los para a UI. */
const CODES = Object.freeze({
  RATE_LIMITED: 'CLAUDE_RATE_LIMITED',
  OVERLOADED: 'CLAUDE_OVERLOADED',
  API_RETRY: 'CLAUDE_API_RETRY',
  API_ERROR: 'CLAUDE_API_ERROR',
  RESULT_ERROR: 'CLAUDE_RESULT_ERROR',
  CONTEXT_LIMIT: 'CLAUDE_CONTEXT_LIMIT',
  CONTEXT_REFILL: 'CLAUDE_CONTEXT_REFILL',
  IMAGE_ERROR: 'CLAUDE_IMAGE_ERROR',
  BUDGET_EXHAUSTED: 'CLAUDE_BUDGET_EXHAUSTED',
  MODEL_ERROR: 'CLAUDE_MODEL_ERROR',
  MODEL_FALLBACK: 'CLAUDE_MODEL_FALLBACK',
  MODEL_REFUSAL: 'CLAUDE_MODEL_REFUSAL',
  MAX_TURNS: 'CLAUDE_MAX_TURNS',
  MALFORMED_TOOL_USE: 'CLAUDE_MALFORMED_TOOL_USE',
  STRUCTURED_OUTPUT: 'CLAUDE_STRUCTURED_OUTPUT',
  TOOL_DEFERRED: 'CLAUDE_TOOL_DEFERRED',
  TURN_SETUP_FAILED: 'CLAUDE_TURN_SETUP_FAILED',
  STOP_HOOK: 'CLAUDE_STOP_HOOK',
  HOOK_STOPPED: 'CLAUDE_HOOK_STOPPED',
});

const FAILURE_CLASSES = Object.freeze({
  USAGE_LIMIT: 'usage_limit',
  OVERLOADED: 'overloaded',
  CONTEXT_LIMIT: 'context_limit',
  IMAGE_ERROR: 'image_error',
  BUDGET: 'budget',
  PROVIDER_ERROR: 'provider_error',
  TRANSPORT_ERROR: 'transport_error',
});

const CORRELATION_REASONS = Object.freeze({
  NOT_RESULT: 'not-result',
  FOREIGN_UUID: 'foreign-uuid',
  ECHO: 'echo-match',
  ECHO_UNACCEPTED: 'echo-match-unaccepted',
  ECHO_DEGRADED: 'echo-match-degraded',
  ACCEPTED: 'uncorrelated-accepted-single-turn',
  UNACCEPTED: 'uncorrelated-unaccepted',
  DEGRADED: 'uncorrelated-degraded',
  FOREIGN_SEEN: 'uncorrelated-foreign-seen',
  NON_HUMAN: 'uncorrelated-non-human-origin',
  ZERO_TURN: 'uncorrelated-zero-turn-debris',
  NOT_SINGLE_TURN: 'uncorrelated-not-single-turn',
});

const QUERY_END_REASONS = Object.freeze({
  CANCELLED_AFTER_ACCEPT: 'cancelled-after-accept',
  CANCELLED_UNOBSERVED_END: 'cancelled-unobserved-end',
  CANCELLED_BEFORE_PROOF: 'cancelled-before-proof',
  CANCELLED_BEFORE_DELIVERY: 'cancelled-before-delivery',
  DEGRADED_HOLD: 'accepted-degraded-safe-hold',
  ENDED_WITH_FAILURE: 'ended-with-failure',
  ENDED_WITHOUT_RESULT: 'ended-without-result',
  UNOBSERVED_END: 'unobserved-end',
  ENDED_BEFORE_DELIVERY: 'ended-before-delivery',
});

/* `TerminalReason` do SDK pinado (sdk.d.ts:8147) → falha estruturada Mesa.
   Só entram razões que SEMPRE significam falha de rodada; `completed`,
   `aborted_streaming`, `aborted_tools`, `tool_deferred` e `background_requested`
   NÃO entram (não são falhas por si). */
const TERMINAL_FAILURES = Object.freeze({
  blocking_limit: {
    code: CODES.RATE_LIMITED,
    failureClass: FAILURE_CLASSES.USAGE_LIMIT,
    message: 'Limite de uso do Claude Code atingido; envie a mensagem de novo quando o limite reiniciar.',
  },
  rapid_refill_breaker: {
    code: CODES.CONTEXT_REFILL,
    failureClass: FAILURE_CLASSES.CONTEXT_LIMIT,
    message: 'O contexto voltou a encher logo depois da compactação; a rodada parou.',
  },
  prompt_too_long: {
    code: CODES.CONTEXT_LIMIT,
    failureClass: FAILURE_CLASSES.CONTEXT_LIMIT,
    message: 'O contexto desta conversa passou da janela do modelo.',
  },
  image_error: {
    code: CODES.IMAGE_ERROR,
    failureClass: FAILURE_CLASSES.IMAGE_ERROR,
    message: 'Uma imagem da conversa não pôde ser processada pelo modelo.',
  },
  budget_exhausted: {
    code: CODES.BUDGET_EXHAUSTED,
    failureClass: FAILURE_CLASSES.BUDGET,
    message: 'O orçamento de tokens desta rodada foi esgotado.',
  },
  model_error: {
    code: CODES.MODEL_ERROR,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'O modelo retornou um erro.',
  },
  api_error: {
    code: CODES.API_ERROR,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'A API do Claude falhou depois das tentativas.',
  },
  malformed_tool_use_exhausted: {
    code: CODES.MALFORMED_TOOL_USE,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'O modelo repetiu chamadas de ferramenta malformadas e a rodada parou.',
  },
  structured_output_retry_exhausted: {
    code: CODES.STRUCTURED_OUTPUT,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'Não deu para produzir a saída estruturada pedida.',
  },
  tool_deferred_unavailable: {
    code: CODES.TOOL_DEFERRED,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'Uma ferramenta adiada não está mais disponível para retomar a chamada.',
  },
  turn_setup_failed: {
    code: CODES.TURN_SETUP_FAILED,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'Não deu para iniciar a rodada com o Claude Code.',
  },
  stop_hook_prevented: {
    code: CODES.STOP_HOOK,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'Um hook impediu o término normal da rodada.',
  },
  hook_stopped: {
    code: CODES.HOOK_STOPPED,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'Um hook encerrou a rodada antes do fim.',
  },
  max_turns: {
    code: CODES.MAX_TURNS,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: 'A rodada atingiu o limite de turnos.',
  },
});

/* Subtipos de erro do SDK pinado (`SDKResultError.subtype`). */
const RESULT_SUBTYPE_CODES = Object.freeze({
  error_during_execution: CODES.RESULT_ERROR,
  error_max_turns: CODES.MAX_TURNS,
  error_max_budget_usd: CODES.BUDGET_EXHAUSTED,
  error_max_structured_output_retries: CODES.STRUCTURED_OUTPUT,
});

/* `SDKAssistantMessageError` do SDK pinado (sdk.d.ts:3145) → rótulo curto PT. */
const ASSISTANT_ERROR_LABELS = Object.freeze({
  authentication_failed: 'falha de autenticação',
  oauth_org_not_allowed: 'organização não autorizada',
  account_on_hold: 'conta em espera',
  billing_error: 'erro de cobrança',
  rate_limit: 'limite de uso',
  overloaded: 'sobrecarga',
  invalid_request: 'requisição inválida',
  model_not_found: 'modelo indisponível',
  server_error: 'erro no servidor',
  unknown: 'erro desconhecido',
  max_output_tokens: 'limite de saída do modelo',
});

const REFUSAL_DIRECTIONS = Object.freeze(['retry', 'revert', 'sticky']);
const REFUSAL_SCOPES = Object.freeze(['session', 'local']);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function sanitizeText(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  const truncated = Math.trunc(value);
  if (!Number.isFinite(truncated)) return fallback;
  return Math.min(max, Math.max(min, truncated));
}

function apiErrorStatusOf(message) {
  if (!Number.isInteger(message.api_error_status)) return null;
  return message.api_error_status >= 100 && message.api_error_status <= 599 ? message.api_error_status : null;
}

function isHttpStatus(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599;
}

/* Lista de UUIDs limitada e sem lixo. `total` é a contagem bruta de entradas
   aceitáveis (a lista retornada pode ser menor por duplicatas/teto). */
function normalizeUuidList(value) {
  const list = Array.isArray(value) ? value : [];
  const uuids = [];
  let total = 0;
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const text = entry.trim();
    if (!text || text.length > LIMITS.MAX_UUID_CHARS) continue;
    total += 1;
    if (!uuids.includes(text) && uuids.length < LIMITS.MAX_RETRACTED_UUIDS) uuids.push(text);
  }
  return {uuids, total, truncated: total > uuids.length};
}

/* Tipos de janela rejeitada (aceita Array ou Set; o adaptador guarda Set). */
function normalizeRateLimitTypes(value) {
  const list = value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
  const types = [];
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const text = entry.trim();
    if (!text || text.length > LIMITS.MAX_UUID_CHARS) continue;
    if (!types.includes(text)) types.push(text);
    if (types.length >= LIMITS.MAX_RATE_LIMIT_TYPES) break;
  }
  return types;
}

/* Cópia rasa e limitada do payload de limite do adaptador (`_rateLimitPayload`). */
function normalizeRateLimitPayload(value) {
  if (!isPlainObject(value)) return null;
  const out = {};
  if (typeof value.status === 'string') out.status = value.status;
  if (typeof value.type === 'string') out.type = value.type;
  if (typeof value.window === 'string') out.window = value.window;
  if (typeof value.resetsAt === 'string') out.resetsAt = value.resetsAt;
  if (typeof value.resetAt === 'string') out.resetAt = value.resetAt;
  if (Number.isFinite(value.waitMs)) out.waitMs = clampInt(value.waitMs, 0, LIMITS.MAX_RETRY_DELAY_MS, 0);
  if (Number.isFinite(value.utilization)) out.utilization = value.utilization;
  if (typeof value.blocked === 'boolean') out.blocked = value.blocked;
  if (Number.isFinite(value.surpassedThreshold)) out.surpassedThreshold = value.surpassedThreshold;
  if (isPlainObject(value.overage)) {
    const overage = {};
    if (typeof value.overage.status === 'string') overage.status = value.overage.status;
    if (typeof value.overage.inUse === 'boolean') overage.inUse = value.overage.inUse;
    if (typeof value.overage.disabledReason === 'string') overage.disabledReason = value.overage.disabledReason;
    if (typeof value.overage.resetsAt === 'string') overage.resetsAt = value.overage.resetsAt;
    if (typeof value.overage.resetAt === 'string') overage.resetAt = value.overage.resetAt;
    if (Number.isFinite(value.overage.waitMs)) overage.waitMs = clampInt(value.overage.waitMs, 0, LIMITS.MAX_RETRY_DELAY_MS, 0);
    if (Object.keys(overage).length) out.overage = overage;
  }
  return Object.keys(out).length ? out : null;
}

function firstListedError(errors) {
  if (!Array.isArray(errors)) return null;
  for (const entry of errors) {
    if (typeof entry !== 'string') continue;
    if (entry.startsWith('[ede_diagnostic]')) continue;
    const text = sanitizeText(entry, LIMITS.MAX_ERROR_TEXT_CHARS);
    if (text) return text;
  }
  return null;
}

/* ---------------- correlação do result ---------------- */

/* Evidência de correlação da mensagem com o UUID do envio:
   `user_message_uuids` (lista) tem precedência sobre `user_message_uuid`
   (singular), como no produtor que ecoa o conjunto do turno; o eco de replay
   (`type:'user'`, `isReplay:true`) vale pelo `uuid` da própria mensagem.
   Sem eco: `none` — nunca inventa correlação. */
function correlationEvidence(message, wireUuid) {
  const expected = typeof wireUuid === 'string' && wireUuid ? wireUuid : null;
  if (!isPlainObject(message) || !expected) return {evidence: 'none', echoed: [], source: null};
  if (message.type === 'user' && message.isReplay === true) {
    const uuid = typeof message.uuid === 'string' && message.uuid ? message.uuid : null;
    if (!uuid) return {evidence: 'none', echoed: [], source: 'replay'};
    return {evidence: uuid === expected ? 'match' : 'mismatch', echoed: [uuid], source: 'replay'};
  }
  const echoedList = normalizeUuidList(message.user_message_uuids).uuids;
  if (echoedList.length > 0) {
    return {evidence: echoedList.includes(expected) ? 'match' : 'mismatch', echoed: echoedList, source: 'echo-list'};
  }
  const singular = typeof message.user_message_uuid === 'string' && message.user_message_uuid ? message.user_message_uuid : null;
  if (singular) return {evidence: singular === expected ? 'match' : 'mismatch', echoed: [singular], source: 'echo-uuid'};
  return {evidence: 'none', echoed: [], source: null};
}

/* Decisão sobre um `result`: `action:'finalize'` (+ `outcome`) ou `ignore`.
   Um resultado SEM eco só liquida quando TODAS valem:
   turno único (`outstandingTurns === 1`), aceite comprovado (`accepted`),
   não degradado, sem evidência estrangeira anterior (`foreignSeen`), sem
   origem não-humana e sem `num_turns <= 0`. `taken` não é consultado: puxar o
   item para a consulta não prova aceite. */
function classifyResultCorrelation(input = {}) {
  const message = input.message;
  if (!isPlainObject(message) || message.type !== 'result') {
    return {evidence: 'none', action: 'ignore', outcome: null, settled: false, reason: CORRELATION_REASONS.NOT_RESULT};
  }
  const correlation = correlationEvidence(message, input.wireUuid);
  if (correlation.evidence === 'mismatch') {
    return {evidence: 'mismatch', action: 'ignore', outcome: null, settled: false, reason: CORRELATION_REASONS.FOREIGN_UUID};
  }
  const accepted = input.accepted === true;
  const degraded = input.degraded === true;
  if (correlation.evidence === 'match') {
    const settled = accepted && !degraded;
    return {
      evidence: 'match',
      action: 'finalize',
      outcome: settled ? 'settled' : 'uncertain',
      settled,
      reason: settled
        ? CORRELATION_REASONS.ECHO
        : degraded
          ? CORRELATION_REASONS.ECHO_DEGRADED
          : CORRELATION_REASONS.ECHO_UNACCEPTED,
    };
  }
  const outstandingTurns = Number.isInteger(input.outstandingTurns) ? input.outstandingTurns : 1;
  const origin = message.origin;
  const nonHuman = isPlainObject(origin) && typeof origin.kind === 'string' && origin.kind !== 'human';
  const zeroTurn = Number.isInteger(message.num_turns) && message.num_turns <= 0;
  const reason = zeroTurn
    ? CORRELATION_REASONS.ZERO_TURN
    : nonHuman
      ? CORRELATION_REASONS.NON_HUMAN
      : input.foreignSeen === true
        ? CORRELATION_REASONS.FOREIGN_SEEN
        : outstandingTurns !== 1
          ? CORRELATION_REASONS.NOT_SINGLE_TURN
          : !accepted
            ? CORRELATION_REASONS.UNACCEPTED
            : degraded
              ? CORRELATION_REASONS.DEGRADED
              : null;
  if (reason) return {evidence: 'none', action: 'ignore', outcome: null, settled: false, reason};
  return {
    evidence: 'none',
    action: 'finalize',
    outcome: 'settled',
    settled: true,
    reason: CORRELATION_REASONS.ACCEPTED,
  };
}

/* ---------------- fim de consulta ---------------- */

/* Desfecho do fim da consulta (o `query` do SDK terminou/deu erro, o host
   fechou ou o prazo estourou). `endKind:'query'` é o único fim nativo
   observado; `close`/`timeout` (ou valor desconhecido) seguem conservadores.
   Cancelamento EXPLÍCITO + aceite comprovado + fim observado ⇒ `settled` com
   `cancelled:true` e `uncertain:false` — a entrega aconteceu e o usuário
   mandou parar; o desfecho do TURNO é cancelado, sem status novo no disco.
   Qualquer outro caso preserva a espera: incerto quando algo pode ter sido
   enviado, recusa só quando nada saiu. */
function classifyQueryEnd(input = {}) {
  const accepted = input.accepted === true;
  const taken = input.taken === true;
  const cancelled = input.cancelled === true;
  const degraded = input.degraded === true;
  const phase = input.phase;
  const endKind = input.endKind === 'query' || input.endKind === 'close' || input.endKind === 'timeout'
    ? input.endKind
    : 'close';
  const observedEnd = endKind === 'query';
  const mayHaveSent = accepted || taken || phase !== 'transmitting';

  if (accepted && cancelled && !degraded && observedEnd) {
    return {
      outcome: 'settled',
      cancelled: true,
      uncertain: false,
      mayHaveSent,
      reason: QUERY_END_REASONS.CANCELLED_AFTER_ACCEPT,
    };
  }
  if (mayHaveSent) {
    const reason = accepted && degraded
      ? QUERY_END_REASONS.DEGRADED_HOLD
      : cancelled && !observedEnd
        ? QUERY_END_REASONS.CANCELLED_UNOBSERVED_END
        : cancelled
          ? QUERY_END_REASONS.CANCELLED_BEFORE_PROOF
          : !observedEnd
            ? QUERY_END_REASONS.UNOBSERVED_END
            : input.failure
              ? QUERY_END_REASONS.ENDED_WITH_FAILURE
              : QUERY_END_REASONS.ENDED_WITHOUT_RESULT;
    return {outcome: 'uncertain', cancelled, uncertain: true, mayHaveSent, reason};
  }
  return {
    outcome: 'refused',
    cancelled,
    uncertain: false,
    mayHaveSent: false,
    reason: cancelled ? QUERY_END_REASONS.CANCELLED_BEFORE_DELIVERY : QUERY_END_REASONS.ENDED_BEFORE_DELIVERY,
  };
}

/* ---------------- falhas nativas do result ---------------- */

function buildFailure(input) {
  return {
    code: input.code,
    class: input.failureClass,
    message: input.message,
    terminalReason: input.terminalReason,
    apiErrorStatus: input.apiErrorStatus,
    providerRetryable: input.providerRetryable,
    rateLimit: input.rateLimit,
    detail: {
      subtype: input.subtype,
      usageLimitSource: input.usageLimitSource || null,
      usageLimitTypes: input.usageLimitTypes || [],
      raw: input.raw,
    },
  };
}

/* Classifica um `result` como falha significativa, ou `null` quando o turno
   terminou limpo. Recebe o contexto do turno para a evidência de limite
   REJEITADO que não foi liberado (`rejectedRateLimitTypes`/assistant
   `rate_limit`); janela liberada não rotula mais. A classificação NÃO altera a
   entrega: o chamador mantém `settled` quando o aceite foi comprovado. */
function classifyResultFailure(message, context = {}) {
  if (!isPlainObject(message) || message.type !== 'result') return null;
  const subtype = typeof message.subtype === 'string' ? message.subtype : null;
  const terminalReason = typeof message.terminal_reason === 'string' ? message.terminal_reason : null;
  const apiErrorStatus = apiErrorStatusOf(message);
  const listed = firstListedError(message.errors);
  const raw = sanitizeText(listed || message.result, LIMITS.MAX_ERROR_TEXT_CHARS);
  const rejectedTypes = normalizeRateLimitTypes(context.rejectedRateLimitTypes);
  const latestAssistantRateLimited = context.latestAssistantRateLimited === true;
  const authenticationFailure = context.authenticationFailure === true;
  const rateLimit = normalizeRateLimitPayload(context.rateLimit);
  const terminal = terminalReason ? TERMINAL_FAILURES[terminalReason] || null : null;

  const windowEvidence = !authenticationFailure && (rejectedTypes.length > 0 || latestAssistantRateLimited);
  const usageLimitedWindow = windowEvidence
    && (subtype !== 'success' || apiErrorStatus === null || apiErrorStatus === 429)
    && (terminalReason === null || terminalReason === 'api_error' || terminalReason === 'blocking_limit');

  let usageLimitSource = null;
  if (terminalReason === 'blocking_limit') usageLimitSource = 'blocking_limit';
  else if (apiErrorStatus === 429) usageLimitSource = 'api_error_429';
  else if (usageLimitedWindow) usageLimitSource = rejectedTypes.length > 0 ? 'rejected_window' : 'assistant_rate_limit';

  if (usageLimitSource) {
    return buildFailure({
      subtype,
      code: CODES.RATE_LIMITED,
      failureClass: FAILURE_CLASSES.USAGE_LIMIT,
      message: usageLimitSource === 'api_error_429'
        ? 'A API do Claude atingiu o limite de uso; envie de novo quando o limite reiniciar.'
        : 'Limite de uso do Claude Code atingido; envie a mensagem de novo quando o limite reiniciar.',
      terminalReason,
      apiErrorStatus,
      providerRetryable: apiErrorStatus === 429 ? true : null,
      rateLimit,
      raw,
      usageLimitSource,
      usageLimitTypes: rejectedTypes,
    });
  }
  if (apiErrorStatus === 529) {
    return buildFailure({
      subtype,
      code: CODES.OVERLOADED,
      failureClass: FAILURE_CLASSES.OVERLOADED,
      message: 'A API do Claude está sobrecarregada (529); tente de novo em instantes.',
      terminalReason,
      apiErrorStatus,
      providerRetryable: true,
      rateLimit,
      raw,
    });
  }
  if (terminal) {
    return buildFailure({
      subtype,
      code: terminal.code,
      failureClass: terminal.failureClass,
      message: terminal.message,
      terminalReason,
      apiErrorStatus,
      providerRetryable: null,
      rateLimit,
      raw,
    });
  }
  if (subtype === 'success') {
    if (message.is_error !== true) return null;
    return buildFailure({
      subtype,
      code: apiErrorStatus !== null ? CODES.API_ERROR : CODES.RESULT_ERROR,
      failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
      message: raw || 'A rodada do Claude Code terminou com erro.',
      terminalReason,
      apiErrorStatus,
      providerRetryable: null,
      rateLimit,
      raw,
    });
  }
  return buildFailure({
    subtype,
    code: (subtype && RESULT_SUBTYPE_CODES[subtype]) || CODES.RESULT_ERROR,
    failureClass: FAILURE_CLASSES.PROVIDER_ERROR,
    message: raw || 'A rodada do Claude Code terminou com erro.',
    terminalReason,
    apiErrorStatus,
    providerRetryable: null,
    rateLimit,
    raw,
  });
}

/* ---------------- retry nativo (api_retry) ---------------- */

/* Progresso de retry do SDK pinado (`SDKAPIRetryMessage`): preserva
   tentativa/máximo/atraso/status com limites sanitizados e uma chave estável
   para o host deduplicar o mesmo attempt. NUNCA encerra turno nem muda a
   entrega — `retryable` aqui é do transporte, não autoriza reenvio da Mesa
   (quem decide reenvio é `mayRetry` do núcleo, só em recusa). */
function classifyApiRetry(message) {
  if (!isPlainObject(message) || message.type !== 'system' || message.subtype !== 'api_retry') return null;
  const attempt = clampInt(message.attempt, 1, LIMITS.MAX_RETRY_FIELD, 1);
  const maxRetries = clampInt(message.max_retries, 1, LIMITS.MAX_RETRY_FIELD, 1);
  const retryDelayMs = clampInt(message.retry_delay_ms, 0, LIMITS.MAX_RETRY_DELAY_MS, 0);
  const errorStatus = isHttpStatus(message.error_status) ? message.error_status : null;
  const error = typeof message.error === 'string' && message.error.length > 0 && message.error.length <= LIMITS.MAX_UUID_CHARS
    ? message.error
    : null;
  const code = errorStatus === 429
    ? CODES.RATE_LIMITED
    : errorStatus === 529
      ? CODES.OVERLOADED
      : CODES.API_RETRY;
  const failureClass = errorStatus === 429
    ? FAILURE_CLASSES.USAGE_LIMIT
    : errorStatus === 529
      ? FAILURE_CLASSES.OVERLOADED
      : errorStatus === null
        ? FAILURE_CLASSES.TRANSPORT_ERROR
        : FAILURE_CLASSES.PROVIDER_ERROR;
  const cause = errorStatus !== null
    ? `status HTTP ${errorStatus}`
    : error
      ? ASSISTANT_ERROR_LABELS[error] || `erro ${error}`
      : 'erro de transporte';
  return {
    code,
    class: failureClass,
    message: `O Claude Code está repetindo a chamada à API (tentativa ${attempt} de ${maxRetries}; ${cause}${retryDelayMs > 0 ? `; aguardando ${retryDelayMs} ms` : ''}).`,
    retryable: true,
    endsTurn: false,
    deliveryEffect: 'none',
    dedupeKey: `api_retry:${attempt}:${errorStatus === null ? 'none' : errorStatus}:${error || 'none'}`,
    detail: {attempt, maxRetries, retryDelayMs, errorStatus, error},
  };
}

/* ---------------- recusa / fallback de modelo ---------------- */

/* Normaliza o aviso nativo de recusa (SDK 0.3.246). Para o fallback, devolve o
   texto do aviso (quando houver), a lista LIMITADA de UUIDs retratados e a
   decisão de evicção ADIADA (`eviction:'deferred'`): o host decide o DOM, este
   módulo não remove nada. Sem `content` não inventa aviso vazio; a retração
   ainda é devolvida. */
function classifyRefusalNotice(message) {
  if (!isPlainObject(message) || message.type !== 'system') return null;
  if (message.subtype === 'model_refusal_fallback') {
    const retracted = normalizeUuidList(message.retracted_message_uuids);
    const notice = sanitizeText(message.content, LIMITS.MAX_TEXT_CHARS);
    const direction = REFUSAL_DIRECTIONS.includes(message.direction) ? message.direction : null;
    const scope = REFUSAL_SCOPES.includes(message.scope) ? message.scope : 'session';
    return {
      kind: 'fallback',
      code: CODES.MODEL_FALLBACK,
      hasNotice: notice !== null,
      notice,
      eviction: 'deferred',
      detail: {
        trigger: 'refusal',
        direction,
        scope,
        scopeDeclared: REFUSAL_SCOPES.includes(message.scope),
        originalModel: sanitizeText(message.original_model, LIMITS.MAX_MODEL_CHARS),
        fallbackModel: sanitizeText(message.fallback_model, LIMITS.MAX_MODEL_CHARS),
        apiRefusalCategory: sanitizeText(message.api_refusal_category, LIMITS.MAX_UUID_CHARS),
        apiRefusalExplanation: sanitizeText(message.api_refusal_explanation, LIMITS.MAX_EXPLANATION_CHARS),
        refusedUserMessageUuid: sanitizeText(message.refused_user_message_uuid, LIMITS.MAX_UUID_CHARS),
        retractedMessageUuids: retracted.uuids,
        retractedCount: retracted.total,
        retractedTruncated: retracted.truncated,
      },
    };
  }
  if (message.subtype === 'model_refusal_no_fallback') {
    const notice = sanitizeText(message.content, LIMITS.MAX_TEXT_CHARS);
    return {
      kind: 'no_fallback',
      code: CODES.MODEL_REFUSAL,
      hasNotice: notice !== null,
      notice,
      eviction: 'none',
      detail: {
        originalModel: sanitizeText(message.original_model, LIMITS.MAX_MODEL_CHARS),
        apiRefusalCategory: sanitizeText(message.api_refusal_category, LIMITS.MAX_UUID_CHARS),
        apiRefusalExplanation: sanitizeText(message.api_refusal_explanation, LIMITS.MAX_EXPLANATION_CHARS),
        refusedUserMessageUuid: sanitizeText(message.refused_user_message_uuid, LIMITS.MAX_UUID_CHARS),
      },
    };
  }
  return null;
}

module.exports = {
  POLICY_VERSION,
  LIMITS,
  CODES,
  FAILURE_CLASSES,
  CORRELATION_REASONS,
  QUERY_END_REASONS,
  correlationEvidence,
  classifyResultCorrelation,
  classifyQueryEnd,
  classifyResultFailure,
  classifyApiRetry,
  classifyRefusalNotice,
};
