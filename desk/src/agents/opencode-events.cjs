// @ts-check
'use strict';

/* Vocabulário do SSE medido no opencode v2.0.32 (#57, porte da branch
 * t3/opencode-provider; o envelope `{type, data:{sessionID…}}` foi conferido
 * de novo no binário em 2026-10-19).
 *
 * O turno real emite `session.text.*`, `session.reasoning.*`,
 * `session.tool.*` e termina em `session.execution.succeeded|failed|interrupted`.
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
    if (type === 'permission.asked' || type === 'permission.updated') return this.permission(data);
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
    if (status === 'failed') this.emit('error', {code: 'OPENCODE_TURN_FAILED', message: providerFailureMessage(failure), fatal: false});
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
      message: String(error.message || error.data?.message || message('opencode.event.turnFailed')),
    });
  }

  permission(data) {
    const id = String(data.id || data.requestID || '');
    if (!id.startsWith('per')) return;
    const resources = Array.isArray(data.resources) ? data.resources.filter((item) => typeof item === 'string') : [];
    const metadata = isPlainObject(data.metadata) ? data.metadata : {};
    /* Sem título: a janela usa o "Permissão" do catálogo; a linha diz a ação e o alvo. */
    const action = typeof data.action === 'string' ? data.action : '';
    this.emit('permission_request', {
      id,
      method: 'confirm',
      title: '',
      message: [action, resources.join(', ')].filter(Boolean).join(': '),
      details: resources.length ? {...metadata, resources} : (Object.keys(metadata).length ? metadata : undefined),
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
 */
function providerFailureMessage(raw) {
  if (isFreeTierError(raw)) return message('opencode.event.freeTier');
  const reason = errorText(raw).split(MESSAGE_MARK).join('').split(MESSAGE_SEP).join(' ').trim();
  return reason ? message('opencode.event.providerFailed', {reason}) : message('opencode.event.turnFailed');
}

/* O Zen responde 403 com corpo `FreeTierError` quando recusa o grátis. */
function isFreeTierError(raw) {
  if (!isPlainObject(raw) || raw.status !== 403) return false;
  const response = isPlainObject(raw.response) ? raw.response : {};
  return String(response.body ?? '').includes('FreeTierError');
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

function toolResult(data) {
  if (typeof data.content === 'string') return data.content;
  if (Array.isArray(data.content)) {
    return data.content.map((part) => (isPlainObject(part) && typeof part.text === 'string' ? part.text : '')).filter(Boolean).join('\n');
  }
  if (isPlainObject(data.error) && typeof data.error.message === 'string') return data.error.message;
  return '';
}

module.exports = {OpenCodeEventReader, providerFailureMessage};
