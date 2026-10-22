// @ts-check
'use strict';

/* Medidor de contexto do Claude Code → objeto `contextUsage` da Mesa (#58;
   especificação no commit `c988f59` da branch t3/opencode-provider).

   Fatos do SDK pinado 0.3.301:
   - os TOKENS saem do uso da ÚLTIMA resposta do assistente, já normalizado no
     `message_end` (`input`/`output`/`cacheRead`/`cacheWrite`). A soma é
     entrada + saída + cache, a mesma conta do Pi;
   - a JANELA sai da entrada por modelo do `modelUsage` do `result`
     (`ModelUsage.contextWindow`). O `costUSD` do mesmo objeto é custo e nunca
     vira janela. O catálogo (`ModelInfo`) não traz janela.

   Nada é inventado: soma zero, campo torto, modelo sem janela ou compactação
   (`compact_boundary`, corte que a amostra não vê) dão `null` e o medidor
   some. Módulo puro: sem I/O. */

const {isPlainObject} = require('../../plain-object.cjs');

/** @typedef {{tokens: number, contextWindow: number, percent: number}} ContextUsage */

const USAGE_KEYS = Object.freeze(['input', 'output', 'cacheRead', 'cacheWrite']);
const NATIVE_USAGE_KEYS = Object.freeze(['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']);

/** @param {unknown} value */
const isCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Uso nativo (`BetaUsage`) são? Ausente/nulo é "não reportado"; presente e
 * torto derruba a medição inteira (meia-soma mostraria menos do que existe).
 * @param {unknown} raw
 * @returns {boolean}
 * @example isSaneUsage({input_tokens: 10, output_tokens: -1}) // false
 */
function isSaneUsage(raw) {
  if (!isPlainObject(raw)) return false;
  return NATIVE_USAGE_KEYS.every((key) => raw[key] === undefined || raw[key] === null || isCount(raw[key]));
}

/**
 * Soma do uso normalizado de UMA resposta; null sem número real.
 * @param {unknown} usage
 * @returns {number|null}
 * @example tokenTotal({input: 10, output: 5, cacheRead: 100}) // 115
 */
function tokenTotal(usage) {
  if (!isPlainObject(usage)) return null;
  const present = USAGE_KEYS.filter((key) => Object.hasOwn(usage, key));
  if (!present.length || !present.every((key) => isCount(usage[key]))) return null;
  const total = present.reduce((sum, key) => sum + /** @type {number} */ (usage[key]), 0);
  return total > 0 ? total : null;
}

/**
 * Janela do modelo que respondeu, pela chave do `modelUsage` ou pelo
 * `canonicalModel` da entrada. Outras entradas (subagente, fallback) não servem.
 * @param {unknown} modelUsage @param {unknown} model
 * @returns {number|null}
 * @example modelContextWindow({'claude-x': {contextWindow: 200000}}, 'claude-x') // 200000
 */
function modelContextWindow(modelUsage, model) {
  if (!isPlainObject(modelUsage) || typeof model !== 'string' || !model.trim()) return null;
  const wanted = model.trim();
  const entries = /** @type {Array<[string, {canonicalModel?: unknown, contextWindow?: unknown}]>} */ (Object.entries(modelUsage).filter(([, entry]) => isPlainObject(entry)));
  const match = entries.find(([key]) => key === wanted)
    || entries.find(([, entry]) => entry.canonicalModel === wanted)
    || entries.find(([key]) => key.toLowerCase() === wanted.toLowerCase());
  const window = match?.[1].contextWindow;
  return typeof window === 'number' && Number.isFinite(window) && window > 0 ? window : null;
}

/**
 * Medidor: uso da última resposta contra a janela nativa do modelo; null sem
 * um dos dois.
 * @param {{usage?: unknown, model?: unknown, modelUsage?: unknown}} sample
 * @returns {ContextUsage|null}
 * @example contextUsage({usage: {input: 1000}, model: 'm', modelUsage: {m: {contextWindow: 200000}}}) // {tokens: 1000, contextWindow: 200000, percent: 1}
 */
function contextUsage({usage = null, model = null, modelUsage = null} = {}) {
  const tokens = tokenTotal(usage);
  const contextWindow = tokens === null ? null : modelContextWindow(modelUsage, model);
  if (tokens === null || contextWindow === null) return null;
  return {tokens, contextWindow, percent: Math.round(tokens / contextWindow * 100)};
}

module.exports = {isSaneUsage, tokenTotal, modelContextWindow, contextUsage};
