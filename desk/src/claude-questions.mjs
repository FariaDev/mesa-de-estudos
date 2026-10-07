/* Perguntas estruturadas do Claude Code (AskUserQuestion), aviso nativo de
   limite de uso e avisos de atividade (retry/recusa/fallback): a parte pura que
   o renderer da Mesa interpreta antes de tocar no DOM. Sem imports, DOM, timers
   ou rede — o `tests/claude-questions.test.mjs` importa direto e o `chat.mjs`
   aplica em `#pi-dialog`/faixa de atividade.

   Contrato canônico (adaptador → serviço → renderer) do pedido de pergunta:
     extension_ui_request {
       id, method:'question', title, message,
       questions:[{id, header, question, options:[{label, description}], multiSelect}]
     }
   Resposta do renderer (o host encaminha para `adapter.respond`):
     {id, answers: {[questionText]: string | string[]}}
   O texto EXATO da pergunta é a chave; escolha única responde string,
   multiSelect responde lista; o texto livre ("Outra resposta") responde string
   e vence as opções marcadas. TODA pergunta precisa de ao menos uma resposta —
   o adaptador recusa faltantes (CLAUDE_QUESTION_ANSWERS_MISSING) e nunca
   responde pela metade. `questionSubmitAction` decide o submit do formulário:
   só o botão Responder (`value='ok'`) exige respostas completas; o Cancelar
   submete igual e precisa fechar SEMPRE, mesmo sem nenhuma resposta.

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

export const MAX_QUESTIONS = 16;
export const MAX_OPTIONS = 32;
export const MAX_TEXT_CHARS = 4000;
export const MAX_ANSWER_CHARS = 4000;

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

const LIMIT_FALLBACKS = Object.freeze({
  blocked: 'Limite de uso do Claude Code atingido. A execução fica pausada até o limite reiniciar.',
  warning: 'Atenção: o limite de uso do Claude Code está próximo.',
  overage: 'Limite atingido, mas a execução continua usando overage.',
});

const ACTIVITY_FALLBACKS = Object.freeze({
  retry: 'O Claude Code está repetindo a chamada à API.',
  overloaded: 'A API do Claude está sobrecarregada; a execução tenta de novo.',
  fallback: 'O modelo recusou a solicitação; uma alternativa está respondendo.',
  refusal: 'O modelo recusou a solicitação.',
});

const LIMIT_PRIORITY = Object.freeze({blocked: 3, overage: 2, warning: 1});

const textOf = (value) => (typeof value === 'string' ? value : '');
const withinTextLimit = (value) => value.length <= MAX_TEXT_CHARS;

/* Normaliza o pedido vindo do IPC. Estrito de propósito: pergunta/opção que não
   dá para renderizar fielmente derruba o pedido INTEIRO (`ok:false`) em vez de
   responder só parte — o chat cancela o pedido nesse caso. Strings válidas são
   preservadas exatamente como chegaram (sem trim; o adaptador já normalizou). */
export function questionRequest(raw) {
  const source = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && Array.isArray(raw.questions) ? raw.questions : null);
  if (!source || source.length === 0) return {ok: false, reason: 'empty', questions: []};
  if (source.length > MAX_QUESTIONS) return {ok: false, reason: 'bounded', questions: []};
  const questions = [];
  for (const value of source) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {ok: false, reason: 'invalid', questions: []};
    const question = textOf(value.question);
    if (!question.trim()) return {ok: false, reason: 'invalid', questions: []};
    if (!withinTextLimit(question)) return {ok: false, reason: 'bounded', questions: []};
    const header = textOf(value.header) || `Pergunta ${questions.length + 1}`;
    if (!withinTextLimit(header)) return {ok: false, reason: 'bounded', questions: []};
    const rawOptions = Array.isArray(value.options) ? value.options : [];
    if (rawOptions.length > MAX_OPTIONS) return {ok: false, reason: 'bounded', questions: []};
    const options = [];
    for (const option of rawOptions) {
      if (!option || typeof option !== 'object' || Array.isArray(option)) return {ok: false, reason: 'invalid', questions: []};
      const label = textOf(option.label);
      if (!label.trim()) return {ok: false, reason: 'invalid', questions: []};
      if (!withinTextLimit(label)) return {ok: false, reason: 'bounded', questions: []};
      const description = textOf(option.description);
      if (!withinTextLimit(description)) return {ok: false, reason: 'bounded', questions: []};
      options.push({label, description});
    }
    questions.push({header, question, options, multiSelect: value.multiSelect === true});
  }
  return {ok: true, reason: null, questions};
}

/* O texto da pergunta é chave de objeto e pode ser `__proto__`/`constructor`.
   Atribuição simples em `__proto__` cai no setter do protótipo e a resposta
   some; `defineProperty` cria uma propriedade PRÓPRIA, enumerável e de valor,
   preservando o formato de objeto simples que o IPC e os testes esperam. */
function setAnswer(answers, question, value) {
  Object.defineProperty(answers, question, {value, enumerable: true, writable: true, configurable: true});
}

/* Monta as respostas a partir do rascunho do formulário. `picks[i]` é o estado
   da pergunta i: `selected` (rótulos marcados) e `text` (texto livre). Texto
   livre vence opções; seleção fora das opções é ignorada; pergunta sem resposta
   vira erro com índice — o chat foca o primeiro erro e não fecha o diálogo. */
export function compileQuestionAnswers(questions, picks) {
  const list = Array.isArray(questions) ? questions : [];
  const answers = {};
  const errors = [];
  list.forEach((question, index) => {
    const pick = Array.isArray(picks) && picks[index] && typeof picks[index] === 'object' ? picks[index] : {};
    const labels = new Set((Array.isArray(question.options) ? question.options : []).map((option) => option.label));
    const selected = [...new Set((Array.isArray(pick.selected) ? pick.selected : []).filter((value) => typeof value === 'string' && labels.has(value)))];
    const text = typeof pick.text === 'string' ? pick.text.trim() : '';
    if (text.length > MAX_ANSWER_CHARS) {
      errors.push({index, code: 'long', message: 'Resposta longa demais.'});
      return;
    }
    if (text) {
      setAnswer(answers, question.question, text);
      return;
    }
    if (question.multiSelect) {
      if (!selected.length) {
        errors.push({index, code: 'missing', message: 'Marque ao menos uma opção ou escreva uma resposta.'});
        return;
      }
      setAnswer(answers, question.question, selected);
      return;
    }
    if (selected.length > 1) {
      errors.push({index, code: 'multiple', message: 'Escolha apenas uma opção.'});
      return;
    }
    if (!selected.length) {
      errors.push({index, code: 'missing', message: 'Escolha uma opção ou escreva uma resposta.'});
      return;
    }
    setAnswer(answers, question.question, selected[0]);
  });
  const ok = list.length > 0 && errors.length === 0;
  return {ok, answers: ok ? answers : null, errors};
}

/* Decide o que um submit do formulário de perguntas significa. O botão
   Responder submete com `value='ok'`; o Cancelar (`value='cancel'`) submete
   pelo mesmo evento e NÃO pode exigir resposta — devolve `cancel` e o casco
   fecha com `returnValue='cancel'`. Sem botão identificado (`requestSubmit()`
   direto), vale o caminho exigente, igual ao Responder. */
export function questionSubmitAction(questions, picks, submitterValue) {
  if (submitterValue != null && submitterValue !== 'ok') return {action: 'cancel', answers: null, errors: []};
  const compiled = compileQuestionAnswers(questions, picks);
  if (compiled.ok) return {action: 'answers', answers: compiled.answers, errors: []};
  return {action: 'invalid', answers: null, errors: compiled.errors};
}

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
  const message = typeof event.message === 'string' && event.message.trim() ? event.message : LIMIT_FALLBACKS[kind];
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
    if (attempt !== null && max !== null) return `O Claude Code está repetindo a chamada à API (tentativa ${attempt} de ${max}).`;
    return text || ACTIVITY_FALLBACKS.retry;
  }
  if (kind === 'fallback') {
    if (text) return text;
    const model = typeof detail?.fallbackModel === 'string' && detail.fallbackModel ? detail.fallbackModel : '';
    return model ? `Modelo alternativo em uso: ${model}.` : ACTIVITY_FALLBACKS.fallback;
  }
  return text || ACTIVITY_FALLBACKS[kind];
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
