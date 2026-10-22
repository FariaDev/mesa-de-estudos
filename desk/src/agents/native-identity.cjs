// @ts-check
'use strict';

/* A identidade nativa que o descritor guarda: o UUID que a Mesa cunha para o
   Claude, o `ses_` do OpenCode.

   O `ses_` do OpenCode é cunhado PELO SERVIDOR (`POST /api/session` sem `id`).
   Medido no 2.0.32 em 2026-10-20: o Zen recusa os modelos grátis com 403
   `FreeTierError` quando a sessão tem um id que não saiu do gerador do
   OpenCode (o `ses_` + base64url que a Mesa cunhava levava o 403, e até o
   `opencode run --session <esse id>` oficial levava). Por isso o descritor
   OpenCode nasce com `nativeSessionId: null` e grava o id do servidor UMA
   vez; depois disso ele é imutável como o do Claude. */

const deliveryCore = require('../generated/agentdelivery.core.js').default;
const {describeReceived, invalidValue} = require('../error-detail.mjs');
const {WIRE_SESSION_RE} = require('./opencode-ids.cjs');

const ENGINE_OPENCODE = 'opencode';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A identidade nativa vale para o motor? OpenCode aceita `null` (ainda sem sessão no servidor).
 * @param {string} engine @param {unknown} value
 * @returns {boolean}
 * @example validNativeId('opencode', null) // true; validNativeId('claude', null) // false
 */
function validNativeId(engine, value) {
  if (engine !== ENGINE_OPENCODE) return typeof value === 'string' && UUID_RE.test(value);
  return value === null || (typeof value === 'string' && WIRE_SESSION_RE.test(value));
}

/**
 * O `nativeSessionId` depois de um patch: grava o primeiro `ses_` do servidor e, dali em diante, só aceita o mesmo.
 * @param {string} engine @param {string|null} current @param {unknown} requested
 * @param {(text: string) => Error} fail monta o erro do patch
 * @returns {string}
 * @example nextNativeId('opencode', null, 'ses_ea5e…', fail) // 'ses_ea5e…'
 */
function nextNativeId(engine, current, requested, fail) {
  if (requested === null || !validNativeId(engine, requested)) throw fail(invalidValue('nativeSessionId', requested, engine === ENGINE_OPENCODE ? 'ses_…' : 'uuid'));
  const value = /** @type {string} */ (requested);
  if (current === null) return value;
  if (!deliveryCore.sameNativeIdentity(current, value)) throw fail(`nativeSessionId é imutável: recebido ${describeReceived(value)}, diferente do atual; comece outra sessão para usar outra identidade nativa.`);
  return current;
}

module.exports = {validNativeId, nextNativeId};
