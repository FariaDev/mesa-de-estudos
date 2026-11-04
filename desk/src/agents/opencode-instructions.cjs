'use strict';

/* Canal de sistema do OpenCode v2: `PUT /api/experimental/session/{id}/instructions/entries/{key}`
 * (204). Cada entrada cabe em ~8 KiB (`InstructionEntryValueTooLargeError`, 413).
 * A rota nasceu depois do `serve` 2.0.32: 404 cai no prefixo marcado do adaptador.
 * A chave só aceita minúsculas, dígitos e `.` `_` `-`. */

const {isPlainObject} = require('../../plain-object.cjs');

const DEFAULT_MAX_BYTES = 7000;
const MESA_KEY = /^mesa(?:\.\d+)?$/;

/**
 * Pedaços do prompt, cada um com no máximo `maxBytes` em UTF-8.
 * @param {string} text
 * @param {number} [maxBytes]
 * @returns {string[]|null} null se um caractere sozinho não cabe
 * @example chunksOf('abcdef', 2) // ['ab', 'cd', 'ef']
 */
function chunksOf(text, maxBytes = DEFAULT_MAX_BYTES) {
  const source = String(text || '');
  /** @type {string[]} */
  const chunks = [];
  let rest = source;
  while (rest) {
    let end = rest.length;
    while (end > 0 && Buffer.byteLength(rest.slice(0, end)) > maxBytes) end -= 1;
    if (!end) return null;
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  return chunks;
}

/** @param {number} index */
function instructionKey(index) {
  return index === 0 ? 'mesa' : `mesa.${index}`;
}

/** @param {string} sessionId @param {string} suffix */
function instructionRoute(sessionId, suffix) {
  return `/api/experimental/session/${encodeURIComponent(sessionId)}${suffix}`;
}

/**
 * @param {(method: string, route: string, options?: {body?: unknown}) => Promise<{ok: boolean, status: number, payload: unknown}>} request
 * @param {string} sessionId
 * @param {string} key
 * @param {string} value
 */
async function putChunk(request, sessionId, key, value) {
  const route = instructionRoute(sessionId, `/instructions/entries/${encodeURIComponent(key)}`);
  const sent = await request('PUT', route, {body: {value}});
  /* O esquema documenta `value` como objeto; o exemplo público manda string. */
  if (sent.status !== 400) return sent;
  return request('PUT', route, {body: {value: {text: value}}});
}

/**
 * @param {(method: string, route: string, options?: {body?: unknown}) => Promise<{ok: boolean, status: number, payload: unknown}>} request
 * @param {string} sessionId
 * @param {Set<string>} keep
 */
async function deleteStale(request, sessionId, keep) {
  const listed = await request('GET', instructionRoute(sessionId, '/instructions/entries')).catch(() => null);
  const data = listed?.ok && isPlainObject(listed.payload) && Array.isArray(listed.payload.data) ? listed.payload.data : [];
  for (const entry of data) {
    const key = String(entry?.key || '');
    if (!MESA_KEY.test(key) || keep.has(key)) continue;
    await request('DELETE', instructionRoute(sessionId, `/instructions/entries/${encodeURIComponent(key)}`)).catch(() => {});
  }
}

/**
 * Publica o prompt no canal de instruções. false: a rota não existe, a entrada
 * não cabe ou a rede falhou — quem chama usa o prefixo marcado.
 * @param {(method: string, route: string, options?: {body?: unknown}) => Promise<{ok: boolean, status: number, payload: unknown}>} request
 * @param {string} sessionId
 * @param {string} prompt
 * @param {number} [maxBytes]
 * @returns {Promise<boolean>}
 * @example await publishSessionInstructions(request, 'ses_1', 'Você é o tutor…')
 */
async function publishSessionInstructions(request, sessionId, prompt, maxBytes = DEFAULT_MAX_BYTES) {
  const chunks = chunksOf(prompt, maxBytes);
  if (!chunks || !chunks.length) return false;
  /** @type {string[]} */
  const keys = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const key = instructionKey(index);
    const response = await putChunk(request, sessionId, key, chunks[index]);
    if (response.status === 413 && maxBytes > 512) {
      const reported = Number(isPlainObject(response.payload) ? response.payload.maxBytes : 0);
      const next = reported >= 512 && reported < maxBytes ? reported : Math.floor(maxBytes / 2);
      return publishSessionInstructions(request, sessionId, prompt, next);
    }
    if (!response.ok) return false;
    keys.push(key);
  }
  await deleteStale(request, sessionId, new Set(keys));
  return true;
}

module.exports = {chunksOf, instructionKey, publishSessionInstructions};
