// @ts-check
'use strict';

/* Vocabulário do SSE medido no opencode v2.0.32 (#57, porte da branch
 * t3/opencode-provider; o envelope `{type, data:{sessionID…}}` foi conferido
 * de novo no binário em 2026-10-19).
 *
 * O turno real emite `session.step.started|streamed|ended`, `session.text.*`,
 * `session.reasoning.*`, `session.tool.*` e termina em
 * `session.execution.succeeded|failed|interrupted`.
 * O miolo do quadro fica em `data` (o adaptador já separa o envelope).
 * `message.part.*` e `session.idle` continuam como fallback e não são o que
 * o servidor emite hoje. Nome desconhecido é ignorado. */

const {message, MESSAGE_MARK, MESSAGE_SEP} = require('../i18n.mjs');

const {isPlainObject} = require('../../plain-object.cjs');

/**
 * Lê os quadros do SSE de UMA sessão e devolve eventos no vocabulário da Mesa.
 * @example const reader = new OpenCodeEventReader({emit: (type, payload) => …, sessionId: 'ses_1'});
 *          reader.handle('session.text.delta', {sessionID: 'ses_1', assistantMessageID: 'msg_a', delta: 'oi'});
 */
class OpenCodeEventReader {
  /** @param {{emit?: (type: string, payload?: object) => void, sessionId?: string}} [options] */
  constructor({emit, sessionId = ''} = {}) {
    this.emit = typeof emit === 'function' ? emit : () => {};
    this.sessionId = sessionId;
    this.parts = new Map();
    this.tools = new Map();
    /* Respostas já abertas: a primeira linha de cada uma abre o balão. */
    this.started = new Set();
    /* Erro do último passo que falhou: o `execution.failed` que vem depois
     * o leva à conversa (um aviso por turno, não um por passo). */
    this.stepFailure = null;
  }

  handle(type, raw) {
    if (typeof type !== 'string' || !type) return;
    const data = isPlainObject(raw) ? raw : {};
    const session = isPlainObject(data.session) ? data.session : {};
    const sessionID = data.sessionID || data.sessionId || session.id || '';
    if (sessionID && this.sessionId && sessionID !== this.sessionId) return;
    if (type === 'session.text.delta') return this.textDelta(data, 'text');
    if (type === 'session.reasoning.delta') return this.textDelta(data, 'thinking');
    if (type === 'session.text.ended') return this.textEnded(data, 'text');
    if (type === 'session.reasoning.ended') return this.textEnded(data, 'thinking');
    /* Fim de um passo do modelo: a fala daquele passo está completa. Fechar
       aqui entrega o `message_end` ANTES do próximo `message_start` (texto →
       ferramenta → texto). O renderer guarda os blocos por id e limpa o mapa
       quando o id muda; um `message_end` atrasado da fala anterior virava um
       balão novo no fim do turno — a primeira frase repetida (#112). */
    if (type === 'session.step.ended') return this.flush();
    if (type === 'session.tool.input.started') return this.rememberTool(data);
    if (type === 'session.tool.called') return this.toolCalled(data);
    if (type === 'session.tool.success') return this.toolFinished(data, false);
    if (type === 'session.tool.failed') return this.toolFinished(data, true);
    if (type === 'session.compaction.started') return this.compactionStarted(data);
    if (type === 'session.compaction.delta') return this.compactionDelta(data);
    if (type === 'session.compaction.ended') return this.compactionEnded(data);
    if (type === 'session.compaction.failed') return this.compactionFailed(data);
    if (type === 'session.execution.succeeded') return this.execution('succeeded', data);
    if (type === 'session.step.failed') { this.stepFailure = data.error ?? null; return; }
    if (type === 'session.execution.failed') return this.execution('failed', data);
    if (type === 'session.execution.interrupted') return this.execution('interrupted', data);
    /* O pedido inesperado ainda é reconhecido para o adaptador RECUSAR: nenhuma
       ferramenta nativa existe no tutor (#91), então não há diálogo. */
    if (type === 'permission.asked' || type === 'permission.updated' || type === 'permission.v2.asked') return this.permission(data);
    if (type === 'message.part.updated' || type === 'message.part.delta') return this.part(data.part || data);
    if (type === 'message.updated') return this.message(data.info || data);
    if (type === 'session.idle') {
      this.flush();
      this.emit('idle');
      return;
    }
    if (type === 'session.error') return this.sessionError(data);
  }

  textDelta(data, kind) {
    const delta = typeof data.delta === 'string' ? data.delta : '';
    if (!delta) return;
    const messageID = String(data.assistantMessageID || '');
    if (messageID && !this.started.has(messageID)) {
      /* Resposta nova no mesmo turno sem `step.ended` no fio (versões mais
         velhas): fecha a anterior antes de abrir a próxima, pelo mesmo motivo
         do `step.ended` (#112). */
      this.flush();
      this.started.add(messageID);
      this.emit('message_start', {message: {role: 'assistant', id: messageID}});
    }
    this.append(messageID, kind, delta);
    /* O texto é o bloco 0 da resposta (o `message_end` usa a mesma chave). */
    this.emit('message_delta', {delta, kind, messageId: messageID, ...(kind === 'text' ? {contentIndex: 0} : {})});
  }

  /* `ended` traz o texto inteiro. Se os deltas já formam o prefixo, só o
   * sufixo segue para a Mesa. Sem isso a resposta aparece duas vezes. */
  textEnded(data, kind) {
    const full = typeof data.text === 'string' ? data.text : '';
    if (!full) return;
    const messageID = String(data.assistantMessageID || '');
    const entry = this.parts.get(messageID) || {role: 'assistant', text: '', thinking: ''};
    const current = kind === 'text' ? entry.text : entry.thinking;
    if (full === current) return;
    if (full.startsWith(current)) return this.textDelta({...data, delta: full.slice(current.length)}, kind);
    if (!current) return this.textDelta({...data, delta: full}, kind);
    if (kind === 'text') entry.text = full;
    else entry.thinking = full;
    this.parts.set(messageID, entry);
  }

  rememberTool(data) {
    const id = String(data.id || '');
    if (!id) return;
    this.tools.set(id, String(data.name || 'tool'));
  }

  toolCalled(data) {
    const id = String(data.id || '');
    if (!id) return;
    this.emit('tool_start', {id, name: this.tools.get(id) || 'tool', args: data.input});
  }

  toolFinished(data, isError) {
    const id = String(data.id || '');
    if (!id) return;
    this.emit('tool_end', {
      id,
      name: this.tools.get(id) || 'tool',
      result: toolResult(data),
      isError,
    });
  }

  /* Turno que falha no provedor (403 do grátis, chave recusada…) só avisava
   * pelo `turn_end` com erro, e a bolha ficava muda. O erro sai antes, com a
   * frase do provedor; `fatal: false` porque a sessão continua usável. */
  execution(status, data) {
    this.flush();
    const failure = data.error ?? this.stepFailure;
    this.stepFailure = null;
    if (status === 'failed') this.emit('error', {code: 'OPENCODE_TURN_FAILED', message: providerFailureMessage(failure), fatal: false, ...(isProviderAuthError(failure) ? {detail: errorText(failure).slice(0, 400)} : {})});
    this.emit('execution', {status, error: failure, reason: data.reason});
  }

  /* Compactação: o pedido entra na fila de controle; só os eventos contam o
   * fim. `delta` é o resumo crescendo e `ended.text` é o resumo inteiro. */
  compactionStarted(data) {
    this.emit('compaction_start', {
      id: String(data.inputID || ''),
      reason: String(data.reason || ''),
      recent: typeof data.recent === 'string' ? data.recent : '',
    });
  }

  compactionDelta(data) {
    const text = typeof data.text === 'string' ? data.text : '';
    if (text) this.emit('compaction_delta', {text});
  }

  compactionEnded(data) {
    this.emit('compaction_end', {
      reason: String(data.reason || ''),
      text: typeof data.text === 'string' ? data.text : '',
      tokens: data.tokens ?? null,
    });
  }

  compactionFailed(data) {
    this.emit('compaction_failed', {
      reason: String(data.reason || ''),
      error: data.error,
      message: compactionMessage(data.error),
    });
  }

  part(part) {
    if (!isPlainObject(part)) return;
    const messageID = String(part.messageID || part.messageId || '');
    if (part.type === 'text' && typeof part.text === 'string') return this.textDelta({assistantMessageID: messageID, delta: part.text}, 'text');
    if (part.type === 'reasoning' && typeof part.text === 'string') return this.textDelta({assistantMessageID: messageID, delta: part.text}, 'thinking');
    if (part.type !== 'tool') return;
    const id = String(part.id || part.callID || '');
    const state = isPlainObject(part.state) ? part.state : {};
    const status = String(state.status || part.status || '');
    this.tools.set(id, String(part.tool || part.name || this.tools.get(id) || 'tool'));
    if (status === 'running' || status === 'pending') return this.toolCalled({id, input: state.input ?? part.input});
    if (status === 'completed' || status === 'error') return this.toolFinished({id, content: state.output ?? part.output ?? ''}, status === 'error');
  }

  message(info) {
    if (!isPlainObject(info)) return;
    const messageID = String(info.id || '');
    const role = info.role || (info.type === 'assistant' ? 'assistant' : info.type === 'user' ? 'user' : '');
    if (!messageID || (role !== 'user' && role !== 'assistant')) return;
    const entry = this.parts.get(messageID);
    if (!entry) return;
    entry.role = role;
  }

  sessionError(data) {
    const error = isPlainObject(data.error) ? data.error : {};
    this.emit('error', {
      code: 'OPENCODE_SESSION_ERROR',
      message: providerFailureMessage(error),
      ...(isProviderAuthError(error) ? {detail: errorText(error).slice(0, 400)} : {}),
    });
    /* `session.error` é terminal para o turno: sem este fim a coluna ficava
       em "pensando" com Parar depois da recusa do provedor. */
    this.emit('turn_end', {isError: true});
  }

  permission(data) {
    const id = String(data.id || data.requestID || '');
    if (!id) return;
    const raw = Array.isArray(data.resources) ? data.resources : data.patterns;
    this.emit('permission_request', {
      id,
      action: typeof data.action === 'string' ? data.action : (typeof data.permission === 'string' ? data.permission : ''),
      resources: Array.isArray(raw) ? raw.filter((item) => typeof item === 'string') : [],
    });
  }

  append(messageID, kind, text) {
    if (!messageID || !text) return;
    const entry = this.parts.get(messageID) || {role: 'assistant', text: '', thinking: ''};
    if (kind === 'text') entry.text += text;
    else entry.thinking += text;
    this.parts.set(messageID, entry);
  }

  flush() {
    for (const [messageID, entry] of this.parts) {
      if (!entry.text.trim() && !entry.thinking.trim()) continue;
      const content = [];
      if (entry.text) content.push({type: 'text', text: entry.text});
      if (entry.thinking) content.push({type: 'thinking', thinking: entry.thinking});
      this.parts.delete(messageID);
      this.started.delete(messageID);
      this.emit('message_end', {message: {role: entry.role || 'assistant', id: messageID, uuid: messageID, content}});
    }
  }
}

/**
 * A frase do erro de um turno, como mensagem marcada do catálogo.
 * @param {unknown} raw o `error` de `session.step.failed`/`session.execution.failed`
 * @returns {string}
 * @example providerFailureMessage({type: 'provider.auth', status: 403, response: {body: '{"error":{"type":"FreeTierError"}}'}}) // marca 'opencode.event.freeTier'
 * @example providerFailureMessage({type: 'provider.free-limit', status: 429, response: {body: '{"error":{"type":"FreeUsageLimitError"}}'}}) // marca 'opencode.event.freeLimit'
 */
function providerFailureMessage(raw) {
  if (isProviderAuthError(raw)) return message('opencode.event.providerAuth');
  if (isFreeLimitError(raw)) return message('opencode.event.freeLimit');
  if (isFreeTierError(raw)) return message('opencode.event.freeTier');
  if (isProviderUnreachableError(raw)) return message('opencode.event.providerUnreachable');
  if (isNetworkError(raw)) return message('opencode.event.network');
  const reason = errorText(raw).split(MESSAGE_MARK).join('').split(MESSAGE_SEP).join(' ').trim();
  return reason ? message('opencode.event.providerFailed', {reason}) : message('opencode.event.turnFailed');
}

/* Recusa de credencial do provedor (401/Invalid credential) não é texto para
   a tela: a pessoa precisa da frase curta e do conserto, e o JSON fica no log. */
function isProviderAuthError(raw) {
  if (isPlainObject(raw) && Number(raw.status) === 401) return true;
  return /\b401\b|invalid credential|invalid api key|unauthorized|authentication/i.test(errorText(raw));
}

/* Códigos que provam falta de rede (DNS, roteamento, tempo esgotado). O `fetch`
 * do Node embrulha o original no `cause`, então o código vale nos dois níveis. */
const NETWORK_CODES = ['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT'];

/* Recusa local e TLS (revisão rodada 5): porta parada, certificado vencido ou
 * autoassinado e modelo parado não são "confira sua internet" — têm frase
 * própria (`opencode.event.providerUnreachable`). */
const UNREACHABLE_CODES = ['ECONNREFUSED'];

/* O erro e o `cause` em cadeia (o `fetch` do Node embrulha o original uma vez;
 * três níveis bastam e o `cause` de `Error` real também entra, porque
 * `isPlainObject` aceita instância de `Error`). */
function errorChain(raw) {
  const chain = [];
  let node = raw;
  for (let depth = 0; depth < 3 && (typeof node === 'string' || isPlainObject(node)); depth++) {
    chain.push(node);
    if (!isPlainObject(node)) break;
    node = node.cause;
  }
  return chain;
}

function errorCodes(raw) {
  return errorChain(raw).filter(isPlainObject).map((node) => (typeof node.code === 'string' ? node.code.toUpperCase() : ''));
}

function errorMessageChain(raw) {
  return errorChain(raw).map((node) => errorText(node)).filter(Boolean).join('\n');
}

function isProviderUnreachableError(raw) {
  const codes = errorCodes(raw);
  if (codes.some((code) => UNREACHABLE_CODES.includes(code) || code.startsWith('CERT_') || code.startsWith('ERR_TLS') || code.startsWith('ERR_SSL'))) return true;
  return /connection refused|ECONNREFUSED|certificad|certificate|self[ -]signed|unable to verify|fails to verify|SSL handshake|\bTLS\b|model is offline/i.test(errorMessageChain(raw));
}

/* Sem rede (auditoria rodada 4, sem-conexão; revisão rodada 5): só o que é
 * prova real — código de DNS/roteamento/tempo ou texto de DNS/rede. `fetch
 * failed` sozinho segue rede (não há mais prova); com `cause` de recusa local
 * ou TLS, quem decide é o `isProviderUnreachableError` acima, que roda antes.
 * `offline` fora de frase de conexão ("model is offline") não é rede. */
function isNetworkError(raw) {
  const codes = errorCodes(raw);
  if (codes.some((code) => NETWORK_CODES.includes(code))) return true;
  const text = errorMessageChain(raw);
  if (/getaddrinfo|network error|ERR_INTERNET_DISCONNECTED|internet desconectada|sem (conex[aã]o|internet|rede)|appears to be offline|you're offline|está offline/i.test(text)) return true;
  return /fetch failed|failed to fetch/i.test(text);
}

/* O Zen responde 403 com corpo `FreeTierError` quando recusa o grátis. */
function isFreeTierError(raw) {
  if (!isPlainObject(raw) || raw.status !== 403) return false;
  const response = isPlainObject(raw.response) ? raw.response : {};
  return String(response.body ?? '').includes('FreeTierError');
}

/* O 2.2.4 responde 429 com corpo `FreeUsageLimitError` quando o grátis bate
   no limite do serviço (medido em 2026-11-05, sem credencial e com as travas
   da Mesa): não é cota do aluno nem pedido de espera — é o grátis que não
   respondeu aqui. O `type` exato decide; o texto e o corpo cobrem o mesmo erro
   que chega sem o `type` (por exemplo, via `session.error`). */
function isFreeLimitError(raw) {
  if (isPlainObject(raw) && String(raw.type) === 'provider.free-limit') return true;
  if (isPlainObject(raw) && Number(raw.status) === 429) {
    const response = isPlainObject(raw.response) ? raw.response : {};
    if (String(response.body ?? '').includes('FreeUsageLimitError')) return true;
  }
  return /free usage limit reached|freeusagelimit/i.test(errorText(raw));
}

function errorText(raw) {
  if (typeof raw === 'string') return raw;
  if (!isPlainObject(raw)) return '';
  if (typeof raw.message === 'string') return raw.message;
  return isPlainObject(raw.data) && typeof raw.data.message === 'string' ? raw.data.message : '';
}

function compactionMessage(raw) {
  const text = typeof raw?.message === 'string' ? raw.message
    : typeof raw?.data?.message === 'string' ? raw.data.message
      : typeof raw === 'string' ? raw
        : '';
  return text || message('opencode.compact.failed');
}

/* O 2.0.32 põe a falha em `error` string, em `error.data.message` ou em
   `output`. Sem isso o diário via `result` vazio e a UI dizia só
   "A ferramenta falhou.", enquanto o modelo tinha visto a frase. */
function contentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (isPlainObject(part) && typeof part.text === 'string' ? part.text : '')).filter(Boolean).join('\n');
  }
  if (!isPlainObject(content)) return '';
  if (typeof content.text === 'string' && content.text) return content.text;
  if (typeof content.message === 'string' && content.message) return content.message;
  const nested = typeof content.content === 'string' || Array.isArray(content.content) ? contentText(content.content) : '';
  return nested || errorText(content.error);
}

function toolResult(data) {
  if (!isPlainObject(data)) return '';
  return contentText(data.content) || contentText(data.output) || errorText(data.error) || errorText(data);
}

module.exports = {OpenCodeEventReader, providerFailureMessage};
