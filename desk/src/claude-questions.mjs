/* Aviso nativo de limite de uso e avisos de atividade (retry/recusa/fallback):
   a parte pura que o renderer da Mesa interpreta antes de tocar no DOM. Sem
   DOM, timers ou rede (só `i18n.mjs`, puro): os textos saem como mensagens
   marcadas, que o chat traduz ao exibir (#41) — o
   `tests/claude-questions.test.mjs` importa direto e o `chat.mjs` aplica na
   faixa de atividade. O caminho nativo de pergunta (AskUserQuestion) saiu na
   #92; pergunta agora é cartão do host.

   Limite de uso (eventos `warning` do adaptador → `desk_warn` no renderer): o
   serviço repassa `code`, `rateLimit` e `detail`; sem eles o aviso continua só
   no console (comportamento genérico preservado). Códigos canônicos:
     CLAUDE_RATE_LIMITED        bloqueio (a execução pausa, o turno NÃO morre)
     CLAUDE_RATE_LIMIT_WARNING  aviso de proximidade do limite
     CLAUDE_RATE_LIMIT_OVERAGE  limite atingido, mas seguindo em overage
     CLAUDE_RATE_LIMIT_RESUMED  janela liberada (transição nativa; o adaptador
                                emite uma por janela rejeitada)
     CLAUDE_RATE_LIMIT_CLEARED  compatibilidade com o contrato anterior: mesmo
                                efeito de RESUMED
   `claudeLimitNotice` classifica um evento e `limitNoticeState` guarda o estado
   POR JANELA (tipo + reset): liberar uma janela limpa só aquela e o aviso mais
   grave que restar volta à faixa. `resetsAt` numérico (segundos nativos),
   `resetsAt`/`resetAt` ISO e texto não parseável viram identidades estáveis —
   o mesmo instante tem o mesmo token, então o dedup não reavisa à toa.

   Avisos de atividade (retry/overload/recusa/fallback) ganham faixa e toast
   concisos por `claudeActivityNotice`, sem mexer em busy/conexão/fila; a
   evicção do texto parcial de fallback segue ADIADA de propósito (o host não
   remove bolha por aqui). */

import {message} from './i18n.mjs';

export const RATE_LIMIT_CODES = Object.freeze({
  blocked: 'CLAUDE_RATE_LIMITED',
  warning: 'CLAUDE_RATE_LIMIT_WARNING',
  overage: 'CLAUDE_RATE_LIMIT_OVERAGE',
  resumed: 'CLAUDE_RATE_LIMIT_RESUMED',
  cleared: 'CLAUDE_RATE_LIMIT_CLEARED',
});

export const ACTIVITY_NOTICE_CODES = Object.freeze({
  retry: 'CLAUDE_API_RETRY',
  overloaded: 'CLAUDE_OVERLOADED',
  fallback: 'CLAUDE_MODEL_FALLBACK',
  refusal: 'CLAUDE_MODEL_REFUSAL',
});

const limitFallback = (kind) => message(`claude.limit.fallback.${kind}`);
const activityFallback = (kind) => message(`claude.activity.${kind}`);

const LIMIT_PRIORITY = Object.freeze({blocked: 3, overage: 2, warning: 1});


/* Identidade estável de um reset de janela: número nativo em SEGUNDOS e ISO
   apontando o mesmo instante têm o mesmo token; texto não parseável fica como
   veio (prefixo `s:`), vazio vira ''. */
function resetId(info) {
  if (!info) return '';
  if (Number.isFinite(info.resetsAt)) return `t:${Math.round(info.resetsAt * 1000)}`;
  if (typeof info.resetsAt === 'string' && info.resetsAt.trim()) {
    const ms = Date.parse(info.resetsAt);
    return Number.isFinite(ms) ? `t:${ms}` : `s:${info.resetsAt.trim()}`;
  }
  if (typeof info.resetAt === 'string' && info.resetAt.trim()) {
    const ms = Date.parse(info.resetAt);
    return Number.isFinite(ms) ? `t:${ms}` : `s:${info.resetAt.trim()}`;
  }
  return '';
}

/* Classifica um `desk_warn` do Claude. Devolve null quando não é aviso de
   limite (o console genérico continua intocado) ou um fato pronto para a UI:
   {kind, key, message, window, type, reset}. `window` identifica a JANELA
   (tipo + reset) para o estado por janela; `key` deduplica o mesmo aviso na
   mesma janela. `cleared` (RESUMED/CLEARED/`status:'allowed'`) manda limpar a
   janela identificada por `type`/`reset` — sem tipo, limpa todas. Não mexe em
   conexão, busy nem fila. */
export function claudeLimitNotice(event) {
  if (!event || typeof event !== 'object') return null;
  const info = event.rateLimit && typeof event.rateLimit === 'object' ? event.rateLimit : null;
  const code = typeof event.code === 'string' ? event.code : '';
  const status = info && typeof info.status === 'string' ? info.status : '';
  const type = info && typeof info.type === 'string' && info.type
    ? info.type
    : (info && typeof info.window === 'string' && info.window ? info.window : '');
  const reset = resetId(info);
  let kind = null;
  if (code === RATE_LIMIT_CODES.cleared || code === RATE_LIMIT_CODES.resumed || status === 'allowed' || (info && info.resumed === true)) kind = 'cleared';
  else if (code === RATE_LIMIT_CODES.blocked || (info && info.blocked === true)) kind = 'blocked';
  else if (code === RATE_LIMIT_CODES.warning || (info && status === 'allowed_warning')) kind = 'warning';
  else if (code === RATE_LIMIT_CODES.overage || (info && status === 'rejected')) kind = 'overage';
  if (!kind) return null;
  if (kind === 'cleared') return {kind, key: 'cleared', message: '', window: '', type, reset};
  const message = typeof event.message === 'string' && event.message.trim() ? event.message : limitFallback(kind);
  const window = `${type || message}:${reset || 'unknown'}`;
  return {kind, key: `${kind}:${window}`, message, window, type, reset};
}

function clearedMatches(entry, notice) {
  if (notice.type && entry.type && notice.type !== entry.type) return false;
  if (notice.reset && entry.reset && notice.reset !== entry.reset) return false;
  return true;
}

function visibleLimit(entries, conversationId) {
  let best = null;
  for (const entry of entries) {
    if (entry.conversationId !== conversationId) continue;
    if (!best || (LIMIT_PRIORITY[entry.kind] || 0) > (LIMIT_PRIORITY[best.kind] || 0)) best = entry;
  }
  return best;
}

/* Passo puro do estado de limite: recebe a lista de avisos visíveis (qualquer
   conversa), o aviso novo e a conversa de origem. Devolve a lista nova e o
   aviso MAIS GRAVE ainda visível naquela conversa (blocked > overage >
   warning). Liberar uma janela não esconde outra janela rejeitada; trocar o
   aviso da mesma janela substitui o anterior. */
export function limitNoticeState(entries, notice, conversationId) {
  const list = Array.isArray(entries) ? entries : [];
  if (!notice || typeof notice !== 'object') return {entries: list, visible: visibleLimit(list, conversationId)};
  if (notice.kind === 'cleared') {
    const next = list.filter((entry) => entry.conversationId !== conversationId || !clearedMatches(entry, notice));
    return {entries: next, visible: visibleLimit(next, conversationId)};
  }
  const next = list.filter((entry) => entry.conversationId !== conversationId || entry.window !== notice.window);
  next.push({
    conversationId,
    window: notice.window,
    type: notice.type || '',
    reset: notice.reset || '',
    key: notice.key,
    kind: notice.kind,
    message: notice.message,
  });
  return {entries: next, visible: visibleLimit(next, conversationId)};
}

function activityMessage(kind, event, detail) {
  const text = typeof event.message === 'string' && event.message.trim() ? event.message.trim() : '';
  if (kind === 'retry') {
    const attempt = Number.isInteger(detail?.attempt) ? detail.attempt : null;
    const max = Number.isInteger(detail?.maxRetries) ? detail.maxRetries : null;
    if (attempt !== null && max !== null) return message('claude.activity.retryAttempt', {attempt, max});
    return text || activityFallback('retry');
  }
  if (kind === 'fallback') {
    if (text) return text;
    const model = typeof detail?.fallbackModel === 'string' && detail.fallbackModel ? detail.fallbackModel : '';
    return model ? message('claude.activity.fallbackModel', {model}) : activityFallback('fallback');
  }
  return text || activityFallback(kind);
}

function activityKey(kind, detail, message) {
  const dedupe = typeof detail?.dedupeKey === 'string' && detail.dedupeKey ? detail.dedupeKey : '';
  const attempt = Number.isInteger(detail?.attempt) ? String(detail.attempt) : '';
  const status = Number.isInteger(detail?.errorStatus) ? String(detail.errorStatus) : '';
  return [kind, dedupe || `${attempt}:${status}`, message].join(':');
}

/* Classifica avisos nativos de atividade (retry/overload/recusa/fallback) em um
   fato pronto para a faixa/toast: {kind, code, key, message}. Não é aviso de
   limite (esses são de `claudeLimitNotice`) e não altera conexão, busy ou fila.
   A evicção do parcial retratado no fallback fica explicitamente adiada: este
   módulo só descreve o aviso, nunca toca no DOM. */
export function claudeActivityNotice(event) {
  if (!event || typeof event !== 'object') return null;
  const code = typeof event.code === 'string' ? event.code : '';
  let kind = null;
  for (const [name, value] of Object.entries(ACTIVITY_NOTICE_CODES)) if (code === value) kind = name;
  if (!kind) return null;
  const detail = event.detail && typeof event.detail === 'object' ? event.detail : null;
  const message = activityMessage(kind, event, detail);
  if (!message) return null;
  return {kind, code, key: activityKey(kind, detail, message), message};
}

/* `desk_error` nativo pode vir com `fatal:false` quando a consulta continua
   utilizável (retry/result nativos à frente): o erro fica visível, mas
   conexão, busy e fila NÃO mudam — quem encerra o turno é o `agent_settled`.
   Ausente/true (Pi, transporte, erro fatal) preserva o tratamento de queda. */
export function deskErrorIsFatal(event) {
  return !event || event.fatal !== false;
}
