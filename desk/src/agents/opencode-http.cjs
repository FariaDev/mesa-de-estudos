// @ts-check
'use strict';

/* Transporte HTTP do `opencode serve` (#57; medido no binário 2.0.32).

   - Basic auth com usuário fixo `opencode`; a senha vem do dono do servidor e
     só existe na memória (nunca em log nem em mensagem de erro).
   - Falha de rede (sem resposta HTTP) é INCERTEZA: o servidor pode ter
     escrito. O erro sai com `uncertain: true` e `notSent: false`, e quem chama
     nunca reenvia sozinho (`agentdelivery.bend`).
   - O SSE `/api/event` manda blocos `data: {"id","type","data":{…}}` e linhas
     `: heartbeat`. Bloco que não é JSON, ou sem `type`, é ignorado.

   `fetch` entra por parâmetro: os testes usam o `fake-opencode.mjs`. */

const {message} = require('../i18n.mjs');

const USERNAME = 'opencode';
const DEFAULT_TIMEOUT_MS = 30000;
/* Recusa comprovada: o servidor respondeu e NADA foi escrito. */
const REFUSAL_STATUSES = new Set([400, 401, 404, 409]);

/**
 * @typedef {{status: number, ok: boolean, payload: unknown, text: string}} OpenCodeResponse
 * @typedef {{body?: unknown, timeoutMs?: number, query?: Record<string, string>}} RequestOptions
 * @typedef {{type: string, data: Record<string, unknown>}} OpenCodeEvent
 * @typedef {{request: (method: string, route: string, options?: RequestOptions) => Promise<OpenCodeResponse>,
 *   openEvents: (onEvent: (event: OpenCodeEvent) => void) => Promise<EventStream|null>}} OpenCodeClient
 * @typedef {{abort: () => void, closed: Promise<void>}} EventStream
 */

const {isPlainObject} = require('../../plain-object.cjs');

/**
 * Lê um bloco SSE do servidor. Devolve null para heartbeat, lixo ou bloco sem tipo.
 * @param {string} block
 * @returns {OpenCodeEvent|null}
 * @example parseSseBlock('data: {"type":"session.idle","data":{"sessionID":"ses_1"}}') // {type: 'session.idle', data: {sessionID: 'ses_1'}}
 */
function parseSseBlock(block) {
  const raw = String(block || '').split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isPlainObject(parsed) || typeof parsed.type !== 'string' || !parsed.type) return null;
  return {type: parsed.type, data: isPlainObject(parsed.data) ? parsed.data : {}};
}

/**
 * A query `location[directory]=…` que as rotas por pasta aceitam (deepObject).
 * @param {Record<string, string>|undefined} query
 * @returns {string}
 * @example queryString({'location[directory]': '/tmp/w'}) // '?location%5Bdirectory%5D=%2Ftmp%2Fw'
 */
function queryString(query) {
  const entries = Object.entries(query || {}).filter(([, value]) => typeof value === 'string' && value);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

/** @param {unknown} cause @returns {Error & {uncertain: boolean, notSent: boolean}} */
function unreachable(cause) {
  const detail = /** @type {{name?: string, code?: string}} */ (cause)?.name === 'TimeoutError' ? 'timeout' : String(/** @type {{code?: string}} */ (cause)?.code || /** @type {Error} */ (cause)?.message || cause);
  const error = /** @type {Error & {uncertain: boolean, notSent: boolean}} */ (Error(message('err.opencode.unreachable', {cause: detail})));
  error.uncertain = true;
  error.notSent = false;
  return error;
}

/**
 * Cliente HTTP do servidor da Mesa.
 * @param {{baseUrl: string, password: string, fetch?: typeof globalThis.fetch, log?: (area: string, line: string) => void}} options
 * @returns {OpenCodeClient}
 * @example const client = createOpenCodeClient({baseUrl: lease.baseUrl, password: lease.password});
 */
function createOpenCodeClient({baseUrl, password, fetch: fetchImpl = (input, init) => globalThis.fetch(input, init), log = () => {}}) {
  const root = String(baseUrl || '').replace(/\/+$/, '');
  const authorization = `Basic ${Buffer.from(`${USERNAME}:${password}`).toString('base64')}`;

  /** @type {OpenCodeClient['request']} */
  async function request(method, route, {body, timeoutMs = DEFAULT_TIMEOUT_MS, query} = {}) {
    /** @type {Record<string, string>} */
    const headers = {authorization, accept: 'application/json'};
    /** @type {RequestInit} */
    const init = {method, headers, signal: AbortSignal.timeout(timeoutMs)};
    if (body !== undefined) { headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
    let response;
    try { response = await fetchImpl(`${root}${route}${queryString(query)}`, init); } catch (error) { throw unreachable(error); }
    const text = await response.text().catch(() => '');
    let payload = null;
    if (text) { try { payload = JSON.parse(text); } catch { payload = null; } }
    return {status: response.status, ok: response.ok, payload, text};
  }

  /** @type {OpenCodeClient['openEvents']} */
  async function openEvents(onEvent) {
    const controller = new AbortController();
    let response;
    try {
      response = await fetchImpl(`${root}/api/event`, {method: 'GET', headers: {authorization, accept: 'text/event-stream'}, signal: controller.signal});
    } catch (error) {
      log('opencode', `canal de eventos não abriu: ${/** @type {Error} */ (error)?.message || error}`);
      return null;
    }
    if (!response.ok || !response.body) { log('opencode', `canal de eventos recusado (HTTP ${response.status})`); return null; }
    const closed = readEvents(response.body, onEvent).catch((error) => {
      if (!controller.signal.aborted) log('opencode', `canal de eventos caiu: ${error?.message || error}`);
    });
    return {abort: () => controller.abort(), closed};
  }

  return {request, openEvents};
}

/**
 * Consome o corpo SSE até o fim, entregando cada evento.
 * @param {ReadableStream<Uint8Array>} body @param {(event: OpenCodeEvent) => void} onEvent
 * @returns {Promise<void>}
 */
async function readEvents(body, onEvent) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of /** @type {AsyncIterable<Uint8Array>} */ (/** @type {unknown} */ (body))) {
    buffer = (buffer + decoder.decode(chunk, {stream: true})).replace(/\r\n/g, '\n');
    let index = buffer.indexOf('\n\n');
    while (index !== -1) {
      const event = parseSseBlock(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
      if (event) onEvent(event);
      index = buffer.indexOf('\n\n');
    }
  }
}

/**
 * A recusa comprovada (o servidor respondeu e nada foi escrito)?
 * @param {number} status
 * @returns {boolean}
 * @example isRefusal(409) // true; isRefusal(500) // false (incerto)
 */
function isRefusal(status) {
  return REFUSAL_STATUSES.has(status);
}

/**
 * O item que o servidor devolve no envelope `{data}` (ou cru); `{}` sem objeto.
 * @example wireItem({data: {type: 'user', id: 'msg_1'}}) // {type: 'user', id: 'msg_1'}
 * @param {unknown} payload @returns {{type?: unknown, role?: unknown, id?: unknown}}
 */
function wireItem(payload) {
  const inner = payload && typeof payload === 'object' ? /** @type {{data?: unknown}} */ (payload).data ?? payload : null;
  return inner && typeof inner === 'object' ? /** @type {{type?: unknown, role?: unknown, id?: unknown}} */ (inner) : {};
}
module.exports = {USERNAME, DEFAULT_TIMEOUT_MS, REFUSAL_STATUSES, parseSseBlock, queryString, createOpenCodeClient, isRefusal, wireItem};
