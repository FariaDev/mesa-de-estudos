// @ts-check
'use strict';

/* Compactação MANUAL do Claude Code (#58; especificação nos commits `c427f0a`
   e `a794128` da branch t3/opencode-provider). Módulo puro: sem I/O.

   Mecanismo do SDK 0.3.301 (tipos em `sdk.d.ts`): não há `Query.compact()`
   nem control request de compactação. O CLI publica o comando local `compact`
   em `supportedCommands()`, e o pedido é a mensagem de usuário `/compact
   [instruções]` no mesmo iterável da consulta. O FIM vem no stream:
   - `system/status` (`SDKStatusMessage`) com `compact_result: 'success' |
     'failed'` e `compact_error` — o resultado expresso;
   - `system/compact_boundary` com `compact_metadata.trigger: 'manual' |
     'auto'` e `pre_tokens`/`post_tokens` — a fronteira.

   Classificação: comando ausente ou fila fechada é recusa comprovada
   (`notSent`); `failed` também é recusa (o CLI pegou o pedido e não
   compactou); prazo ou queda sem `compact_result` é INCERTEZA (pode ter
   compactado, não se repete sozinho). A fronteira `auto` no meio do pedido
   manual é o CLI compactando sozinho: aviso, nunca os tokens do botão. */

const COMPACT_COMMAND = 'compact';
const COMPACT_TIMEOUT_MS = 240000;
const MAX_INSTRUCTIONS = 2000;

/**
 * Texto do pedido: `/compact` com as instruções opcionais do aluno.
 * @param {unknown} instructions
 * @returns {string}
 * @example commandText('foque nas fórmulas') // '/compact foque nas fórmulas'
 */
function commandText(instructions) {
  const text = typeof instructions === 'string' ? instructions.trim().slice(0, MAX_INSTRUCTIONS) : '';
  return text ? `/${COMPACT_COMMAND} ${text}` : `/${COMPACT_COMMAND}`;
}

/**
 * O catálogo nativo tem o comando? Sem ele não há o que chamar.
 * @param {unknown} commands
 * @returns {boolean}
 * @example hasCompactCommand([{name: 'compact'}]) // true
 */
function hasCompactCommand(commands) {
  return Array.isArray(commands) && commands.some((command) => command?.name === COMPACT_COMMAND);
}

/**
 * Lê `system/status`: resultado da compactação ou o estado `compacting`.
 * @param {any} message
 * @returns {{status: 'success'|'failed'|'compacting', error: string}|null}
 * @example classifyStatus({type: 'system', subtype: 'status', status: null, compact_result: 'success'}) // {status: 'success', error: ''}
 */
function classifyStatus(message) {
  if (message?.type !== 'system' || message.subtype !== 'status') return null;
  if (message.compact_result === 'success') return {status: 'success', error: ''};
  if (message.compact_result === 'failed') return {status: 'failed', error: typeof message.compact_error === 'string' ? message.compact_error : ''};
  return message.status === 'compacting' ? {status: 'compacting', error: ''} : null;
}

/**
 * Lê `system/compact_boundary`: gatilho e tokens antes/depois.
 * @param {any} message
 * @returns {{trigger: string, preTokens: number, postTokens: number}|null}
 * @example classifyBoundary({type: 'system', subtype: 'compact_boundary', compact_metadata: {trigger: 'manual', pre_tokens: 900}}) // {trigger: 'manual', preTokens: 900, postTokens: 0}
 */
function classifyBoundary(message) {
  if (message?.type !== 'system' || message.subtype !== 'compact_boundary') return null;
  const meta = message.compact_metadata && typeof message.compact_metadata === 'object' ? message.compact_metadata : {};
  /** @param {unknown} value */
  const count = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
  return {trigger: typeof meta.trigger === 'string' ? meta.trigger : '', preTokens: count(meta.pre_tokens), postTokens: count(meta.post_tokens)};
}

/**
 * Um pedido em voo. Quem decide o desfecho é o adaptador; aqui ficam o prazo,
 * os tokens da fronteira manual e a promessa.
 * @example const request = new CompactRequest({id, item}); request.arm(onTimeout); await request.promise;
 */
class CompactRequest {
  /** @param {{id: string, item: object, timeoutMs?: number}} input */
  constructor({id, item, timeoutMs = COMPACT_TIMEOUT_MS}) {
    this.id = id;
    this.item = item;
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : COMPACT_TIMEOUT_MS;
    this.settled = false;
    this.preTokens = 0;
    this.postTokens = 0;
    /** @type {NodeJS.Timeout|null} */
    this.timer = null;
    /** @type {(value: {accepted: true, compacted: true, summary: string, tokensBefore: number, tokensAfter: number}) => void} */
    this.resolve = () => {};
    /** @type {(error: Error) => void} */
    this.reject = () => {};
    this.promise = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    this.promise.catch(() => {});
  }

  /** @param {(request: CompactRequest) => void} onTimeout */
  arm(onTimeout) {
    if (this.settled) return;
    this.timer = setTimeout(() => onTimeout(this), this.timeoutMs);
    this.timer.unref?.();
  }

  /** @param {{trigger: string, preTokens: number, postTokens: number}} boundary */
  noteBoundary(boundary) {
    if (boundary.preTokens) this.preTokens = boundary.preTokens;
    if (boundary.postTokens) this.postTokens = boundary.postTokens;
  }

  /* O CLI não devolve o texto do resumo pela Mesa (ele vive na sessão
     nativa): `summary` vazio é mais honesto do que inventar. */
  succeed() {
    if (!this.finish()) return;
    this.resolve({accepted: true, compacted: true, summary: '', tokensBefore: this.preTokens, tokensAfter: this.postTokens});
  }

  /** @param {Error} error */
  fail(error) {
    if (this.finish()) this.reject(error);
  }

  finish() {
    if (this.settled) return false;
    this.settled = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    return true;
  }
}

module.exports = {COMPACT_COMMAND, COMPACT_TIMEOUT_MS, MAX_INSTRUCTIONS, commandText, hasCompactCommand, classifyStatus, classifyBoundary, CompactRequest};
