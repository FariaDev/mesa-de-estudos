'use strict';

/* Fluxo do turno do ClaudeAdapter: eventos de stream, quadros do assistente,
   resultados de ferramenta e resultado final. Métodos instalados no protótipo
   pelo claude-adapter.cjs (#43 fase 2). */

/* Política pura de liquidação do turno (correlação, fim de consulta, falhas
   nativas, retry e recusa): o adaptador mede os fatos e aplica o veredito. */
const turnPolicy = require('./claude-turn-policy.cjs');
const {MAX_COMPLETED_KEYS, ASSISTANT_ERROR_CODES} = require('./claude-adapter-contract.cjs');
const {normalizeAssistantBlocks, capToolDetails, assistantFrameKey, summarizeToolResult, normalizeUsage, resultText} = require('./claude-adapter-history.cjs');

class ClaudeAdapterStream {
  _markCompleted(key) {
    if (!key) return true;
    if (this._completed.has(key)) return false;
    this._completed.set(key, true);
    if (this._completed.size > MAX_COMPLETED_KEYS) {
      const oldest = this._completed.keys().next().value;
      this._completed.delete(oldest);
    }
    return true;
  }

  /* Uso do provedor por mensagem lógica, no máximo UMA vez: a CLI pode emitir
     vários quadros com o mesmo `message.id` (um por bloco de conteúdo) e cada
     um carrega o mesmo uso final — emitir todos duplicaria a mesma rodada.
     Quadro sem uso reportado não reserva a chave: um quadro posterior com uso
     ainda emite. Teto igual ao dos concluídos (não cresce sem limite). */

  _takeAssistantUsage(key, raw) {
    const usage = normalizeUsage(raw);
    if (!usage) return null;
    if (typeof key === 'string' && key) {
      if (this._usageReported.has(key)) return null;
      this._usageReported.set(key, true);
      if (this._usageReported.size > MAX_COMPLETED_KEYS) {
        const oldest = this._usageReported.keys().next().value;
        this._usageReported.delete(oldest);
      }
    }
    return usage;
  }

  _handleStreamEvent(message) {
    if (message.parent_tool_use_id) return;
    const event = message.event;
    if (!event || typeof event !== 'object') return;
    const key = event.message?.id || message.uuid || null;
    if (event.type === 'message_start') {
      if (key) this._streamed.add(key);
      this._emit('message_start', {message: {role: 'assistant', id: event.message?.id ?? null}});
      return;
    }
    /* Declaração do bloco de ferramenta: reserva a posição no renderer ANTES
       dos deltas seguintes (texto depois de tool_use na mesma mensagem). A
       execução não começa aqui; o `pending:true` mantém o estado distinto. */
    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (!block || typeof block !== 'object') return;
      if (block.type === 'tool_use' && typeof block.id === 'string' && block.id) {
        const name = String(block.name || '');
        this._toolNames.set(block.id, name);
        if (this._markDeclaredTool(block.id)) {
          this._emit('tool_start', {
            id: block.id,
            name,
            args: block.input && typeof block.input === 'object' ? block.input : {},
            pending: true,
          });
        }
      }
      return;
    }
    if (event.type !== 'content_block_delta') return;
    const delta = event.delta;
    if (!delta || typeof delta !== 'object') return;
    const contentIndex = Number.isInteger(event.index) ? event.index : null;
    if (delta.type === 'text_delta' && typeof delta.text === 'string' && delta.text) {
      this._emit('message_delta', {delta: delta.text, kind: 'text', messageId: event.message?.id ?? null, contentIndex});
    } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string' && delta.thinking) {
      this._emit('message_delta', {delta: delta.thinking, kind: 'thinking', messageId: event.message?.id ?? null, contentIndex});
    }
    /* message_stop NÃO libera busy: só result/fim de consulta/close. */
  }

  /* Declaração de tool_use: emite `tool_start` uma vez por bloco (o quadro
     final não repete a declaração). Mapa com teto, como o dos concluídos. */

  _markDeclaredTool(id) {
    if (!id) return true;
    if (this._declaredTools.has(id)) return false;
    this._declaredTools.set(id, true);
    if (this._declaredTools.size > MAX_COMPLETED_KEYS) {
      const oldest = this._declaredTools.keys().next().value;
      this._declaredTools.delete(oldest);
    }
    return true;
  }

  /* Índices GLOBAIS dos blocos de uma mensagem lógica: quadros da mesma
     resposta (um por bloco) recebem `contentIndexes` sem colidir todos no 0. */

  _advanceBlockCursor(messageId, count) {
    if (!messageId || count <= 0) return [];
    const start = this._messageBlockCursor.get(messageId) || 0;
    const indexes = [];
    for (let i = 0; i < count; i += 1) indexes.push(start + i);
    this._messageBlockCursor.set(messageId, start + count);
    if (this._messageBlockCursor.size > MAX_COMPLETED_KEYS) {
      const oldest = this._messageBlockCursor.keys().next().value;
      this._messageBlockCursor.delete(oldest);
    }
    return indexes;
  }

  _handleAssistant(message) {
    if (message.parent_tool_use_id) return;
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      /* Fatos do turno para classificar o `result` (mesma leitura do T3):
         `rate_limit` mais recente do assistente e falha de autenticação
         acumulada — nunca contaminam o turno seguinte. */
      turn.latestAssistantRateLimited = message.error === 'rate_limit';
      if (message.error === 'authentication_failed' || message.error === 'oauth_org_not_allowed') {
        turn.authenticationFailure = true;
      }
    }
    if (message.error) {
      const code = ASSISTANT_ERROR_CODES[message.error] || 'CLAUDE_ASSISTANT_ERROR';
      /* Erro de assistente nativo é recuperável: a consulta pode continuar
         (retry/result à frente), então `fatal:false`. Falha de autenticação
         pode ser terminal (`fatal:true`). */
      this._emit('error', {
        message: `Claude Code: ${String(message.error)}`,
        code,
        fatal: code === 'CLAUDE_AUTH_FAILED',
        detail: {error: message.error},
      });
    }
    /* Dedupe por `uuid`; sem uuid, a impressão digital do CONTEÚDO (nunca o
       `message.id` sozinho): a CLI pode emitir vários quadros com o mesmo
       `message.id` — um por bloco — e todos precisam chegar ao renderer. */
    const key = message.uuid || assistantFrameKey(message);
    if (!this._markCompleted(key)) return;
    const streamKey = message.message?.id || key;
    if (!(streamKey && this._streamed.has(streamKey))) {
      this._emit('message_start', {message: {role: 'assistant', id: message.message?.id ?? null}});
    }
    const content = normalizeAssistantBlocks(message.message?.content);
    for (const block of content) {
      if (block.type !== 'toolCall') continue;
      this._toolNames.set(block.id, block.name);
      if (this._markDeclaredTool(block.id)) {
        this._emit('tool_start', {id: block.id, name: block.name, args: block.arguments});
      }
    }
    if (streamKey) this._streamed.delete(streamKey);
    /* Uso da mensagem LÓGICA: quadros divididos da MESMA resposta repetem o
       mesmo `message.id` e o mesmo uso final; só o primeiro emite usage. */
    const usage = this._takeAssistantUsage(streamKey, message.message?.usage);
    this._noteUsageSample(message.message?.usage, usage, message.message?.model || this._model || null);
    const contentIndexes = this._advanceBlockCursor(streamKey, content.length);
    this._emit('message_end', {
      message: {
        role: 'assistant',
        id: message.message?.id ?? null,
        uuid: key,
        model: message.message?.model || this._model || null,
        content,
        ...(contentIndexes.length ? {contentIndexes} : {}),
        ...(usage ? {usage} : {}),
      },
    });
  }

  _handleUser(message) {
    if (message.parent_tool_use_id) return;
    const content = message.message?.content;
    const blocks = Array.isArray(content) ? content : [];
    const resultBlocks = blocks.filter((block) => block && typeof block === 'object' && block.type === 'tool_result');
    /* `tool_use_result` é do QUADRO: com um único resultado, ele é o detalhe
       estruturado daquela chamada; com vários, não se inventa dono. */
    const details = resultBlocks.length === 1 ? capToolDetails(message.tool_use_result) : undefined;
    for (const block of blocks) {
      if (!block || block.type !== 'tool_result') continue;
      const id = typeof block.tool_use_id === 'string' ? block.tool_use_id : null;
      this._emit('tool_end', {
        id,
        name: this._toolNames.get(id) || null,
        result: summarizeToolResult(block.content),
        isError: block.is_error === true,
        ...(details !== undefined ? {details} : {}),
      });
      this._toolNames.delete(id);
    }
  }

  async _handleResult(message) {
    if (message.parent_tool_use_id) return;
    const turn = this._turn;
    if (!turn || turn.finalized) {
      this._emit('warning', {message: 'resultado recebido fora de um turno ativo', code: 'CLAUDE_RESULT_UNEXPECTED'});
      return;
    }
    const echoUuid = this._turnEchoUuid(turn, message);
    const correlation = turnPolicy.correlationEvidence(message, echoUuid);
    if (correlation.evidence === 'mismatch') {
      turn.foreignSeen = true;
      this._emitTurn(turn, 'warning', {message: 'resultado de outro envio foi ignorado; o turno atual continua', code: 'CLAUDE_RESULT_FOREIGN'});
      return;
    }
    /* Veredito PURO do turno: sem eco, só liquida o turno ÚNICO com aceite
       comprovado e não degradado, sem evidência estrangeira, sem origem
       não-humana e sem `num_turns` zero. `taken` NÃO é prova de aceite;
       resultado sem correlação de turno ainda não aceito é ignorado até
       timeout/fim de consulta. */
    const decision = turnPolicy.classifyResultCorrelation({
      message,
      wireUuid: echoUuid,
      accepted: turn.acceptResolved,
      degraded: turn.degraded,
      foreignSeen: turn.foreignSeen,
      outstandingTurns: 1,
    });
    if (decision.action !== 'finalize') {
      this._emitTurn(turn, 'warning', {message: 'resultado sem correlação e sem entrega comprovada foi ignorado', code: 'CLAUDE_RESULT_FOREIGN'});
      return;
    }
    const cancelled = this._cancelRequested;
    /* A falha nativa é classificada à parte: o aceite comprovado continua
       `settled`; o erro é reportado com código/detalhe canônicos. */
    const failure = turnPolicy.classifyResultFailure(message, {
      rejectedRateLimitTypes: turn.rejectedRateLimitTypes,
      latestAssistantRateLimited: turn.latestAssistantRateLimited,
      authenticationFailure: turn.authenticationFailure,
      rateLimit: turn.lastRateLimit,
    });
    const envelopeError = message.is_error === true || message.subtype !== 'success';
    if (!cancelled) {
      if (failure) {
        this._emit('error', {
          message: failure.message,
          code: failure.code,
          fatal: false,
          detail: {
            ...failure.detail,
            failureClass: failure.class,
            terminalReason: failure.terminalReason,
            apiErrorStatus: failure.apiErrorStatus,
            providerRetryable: failure.providerRetryable,
          },
        });
      } else if (envelopeError) {
        this._emit('error', {
          message: resultText(message),
          code: 'CLAUDE_RESULT_ERROR',
          fatal: false,
          detail: {subtype: message.subtype || null, terminalReason: message.terminal_reason || null},
        });
      }
    }
    await this._enqueue(turn, () => this._finalizeTurn(turn, decision.outcome, {
      cancelled,
      isError: envelopeError || failure !== null,
      message: decision.settled ? undefined : 'a rodada terminou sem confirmação de recebimento',
      reason: 'result',
    }));
  }
}

module.exports = {ClaudeAdapterStream};
