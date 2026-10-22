// @ts-check
'use strict';

/* Comandos `/` e compactação manual do ClaudeAdapter (#58; especificação nos
   commits `12de58f`, `c427f0a` e `a794128` da branch t3/opencode-provider).

   Catálogo: `Query.supportedCommands()` do SDK 0.3.301 (embutidos, skills e
   plugins), guardado por consulta e trocado pelo `system/commands_changed`.
   Leitura que falha é lista VAZIA: a Mesa nunca inventa comando.

   Execução: o caminho do SDK é o próprio texto `/nome args` como mensagem do
   usuário, pelo MESMO ciclo de entrega do prompt (`send`): marca antes de
   entregar, aceite só com o eco do mesmo uuid, incerteza nunca reenviada.

   Compactação: `/compact` no mesmo iterável, fora do ciclo de turno (não
   marca a conversa como incerta nem emite entrega). O fim é o
   `compact_result` do stream (ver `claude-compaction.cjs`). Métodos
   instalados no protótipo pelo claude-adapter.cjs. */

const crypto = require('node:crypto');
const {message: uiMsg} = require('../i18n.mjs');
const {ClaudeAdapterError} = require('./claude-adapter-contract.cjs');
const {asAdapterError} = require('./claude-adapter-input.cjs');
const {resultText} = require('./claude-adapter-history.cjs');
const turnPolicy = require('./claude-turn-policy.cjs');
const compaction = require('./claude-compaction.cjs');

/** @typedef {{name: string, description: string, argumentHint: string}} ClaudeCommand */

/** @param {unknown} list @returns {ClaudeCommand[]} */
function commandList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({name: String(item?.name || '').replace(/^\/+/, '').trim(), description: String(item?.description || ''), argumentHint: String(item?.argumentHint || '')}))
    .filter((item) => item.name);
}

/* A classe só leva métodos; o tipo do adaptador montado vem de
   `types/claude-adapter-host.d.ts`. `Object` não entra no que é copiado. */
const AdapterBase = /** @type {new () => import('../../types/claude-adapter-host').ClaudeAdapterHost} */ (/** @type {unknown} */ (Object));

class ClaudeAdapterCommands extends AdapterBase {
  /**
   * Catálogo de comandos da consulta viva (abre a consulta sem prompt, como
   * `initializeControls`; nenhuma inferência).
   * @returns {Promise<ClaudeCommand[]>}
   * @example await adapter.commands() // [{name: 'compact', description: '…', argumentHint: '…'}]
   */
  async commands() {
    if (this._commandCache) return this._commandCache;
    await this.connect();
    const query = await this._bounded(this._ensureQuery(), this._controlsTimeoutMs, 'CLAUDE_COMMANDS_TIMEOUT');
    if (typeof query?.supportedCommands !== 'function') return [];
    const list = await this._bounded(Promise.resolve().then(() => query.supportedCommands()), this._controlsTimeoutMs, 'CLAUDE_COMMANDS_TIMEOUT');
    if (this._query === query) this._commandCache = commandList(list);
    return commandList(list);
  }

  /**
   * Executa `/nome args` pelo ciclo do prompt. O aceite não encerra o turno.
   * @param {{id?: string, name: string, text?: string}} input
   * @returns {Promise<{accepted: true, id: string}>}
   * @example await adapter.command({id, name: 'review', text: 'a prova 2'})
   */
  async command(input) {
    const name = String(input?.name || '').replace(/^\/+/, '').trim();
    if (!name) throw new ClaudeAdapterError('CLAUDE_COMMAND_INVALID', uiMsg('err.claude.commandInvalid'), null, true);
    const args = typeof input?.text === 'string' ? input.text.trim() : '';
    return this.send({id: input?.id, text: args ? `/${name} ${args}` : `/${name}`, images: []});
  }

  /** @param {any} message */
  _noteCommandsChanged(message) {
    if (Array.isArray(message?.commands)) this._commandCache = commandList(message.commands);
  }

  /**
   * Compactação manual: um pedido por vez, só sem turno em voo.
   * @param {{customInstructions?: string}} [args]
   * @returns {Promise<{accepted: true, compacted: true, summary: string, tokensBefore: number, tokensAfter: number}>}
   * @example await adapter.compact({customInstructions: 'mantenha as fórmulas'})
   */
  async compact(args = {}) {
    if (!this._connected || this._closed) throw new ClaudeAdapterError('CLAUDE_NOT_CONNECTED', uiMsg('err.claude.notConnected'), null, true);
    if (this._busy || this._turn) throw new ClaudeAdapterError('CLAUDE_BUSY', uiMsg('err.idle.compact'), null, true);
    if (this._compaction) throw new ClaudeAdapterError('CLAUDE_COMPACT_BUSY', uiMsg('err.claude.compactBusy'), null, true);
    let commands;
    try {
      commands = await this.commands();
    } catch (error) {
      throw asAdapterError(error, true, 'CLAUDE_COMPACT_UNAVAILABLE');
    }
    if (!compaction.hasCompactCommand(commands)) throw new ClaudeAdapterError('CLAUDE_COMPACT_UNSUPPORTED', uiMsg('err.claude.compactUnsupported'), null, true);
    const id = crypto.randomUUID();
    const item = {type: 'user', message: {role: 'user', content: [{type: 'text', text: compaction.commandText(args?.customInstructions)}]}, parent_tool_use_id: null, uuid: id, session_id: this._sessionId || undefined};
    const request = new compaction.CompactRequest({id, item, timeoutMs: this._compactTimeoutMs});
    this._compaction = request;
    this._compactUuid = id;
    try {
      this._queue.push(item);
    } catch {
      this._compaction = null;
      this._compactUuid = null;
      throw new ClaudeAdapterError('CLAUDE_COMPACT_REFUSED', uiMsg('err.claude.compactRefused'), null, true);
    }
    request.arm(() => this._settleCompaction('uncertain'));
    return request.promise;
  }

  /**
   * Liquida o pedido em voo: `success`, `failed` (recusa comprovada) ou
   * `uncertain` (sem confirmação: pode ter compactado).
   * @param {'success'|'failed'|'uncertain'} status @param {string} [detail]
   */
  _settleCompaction(status, detail = '') {
    const request = this._compaction;
    if (!request) return;
    this._compaction = null;
    if (status === 'success') { request.succeed(); return; }
    if (status === 'failed') {
      request.fail(new ClaudeAdapterError('CLAUDE_COMPACT_FAILED', detail ? uiMsg('err.claude.compactFailedDetail', {detail}) : uiMsg('err.claude.compactFailed'), {compactError: detail || null}, true));
      return;
    }
    const error = new ClaudeAdapterError('CLAUDE_COMPACT_UNCERTAIN', uiMsg('err.claude.compactUncertain'), null, false);
    request.fail(Object.assign(error, {uncertain: true}));
  }

  /* `system/status` e `system/compact_boundary`. A fronteira sempre apaga a
     amostra do medidor (o corte não aparece no uso antigo); a fronteira
     `auto` é o CLI compactando sozinho e continua aviso. Devolve true quando
     a mensagem foi tratada aqui. */
  /** @param {any} message @returns {boolean} */
  _routeCompactionSystem(message) {
    const status = compaction.classifyStatus(message);
    if (status) {
      if (status.status === 'success') this._settleCompaction('success');
      else if (status.status === 'failed') this._settleCompaction('failed', status.error.trim());
      return true;
    }
    const boundary = compaction.classifyBoundary(message);
    if (!boundary) return false;
    this._resetUsageSample();
    if (this._compaction && boundary.trigger !== 'auto') {
      this._compaction.noteBoundary(boundary);
      return true;
    }
    this._emit('warning', {message: uiMsg('claude.compacted'), code: 'CLAUDE_COMPACTED'});
    return true;
  }

  /* `result` do comando `/compact`: o que ecoa o uuid do pedido, ou qualquer
     `result` sem turno de estudo enquanto o pedido existe. Nunca vai para a
     correlação do turno (não vira eco estrangeiro). Erro prova que não
     compactou. */
  /** @param {any} message @returns {boolean} */
  _routeCompactionResult(message) {
    if (message?.type !== 'result' || !this._compactUuid) return false;
    const echoes = turnPolicy.correlationEvidence(message, this._compactUuid).evidence === 'match';
    if (!echoes && (this._turn || !this._compaction)) return false;
    this._compactUuid = null;
    if (message.is_error === true || message.subtype !== 'success') this._settleCompaction('failed', resultText(message));
    return true;
  }

  /* A consulta acabou ou fechou: sem `compact_result`, o desfecho é incerto. */
  _failOpenCompaction() {
    this._settleCompaction('uncertain');
    this._compactUuid = null;
    this._commandCache = null;
  }
}

module.exports = {ClaudeAdapterCommands, commandList};
