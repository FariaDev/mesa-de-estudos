// @ts-check
'use strict';

/* Compactação manual do OpenCode (#57, porte da branch t3/opencode-provider;
   rota medida no binário 2.0.32):

     POST /api/session/:id/compact   body {id: msg_…, delivery: 'steer'}
       200 + item `compaction` da inbox → ACEITE (o pedido entrou; NÃO é o fim)
       400/401/404/409                  → RECUSA (nada foi escrito; pode repetir)
       sem resposta HTTP / outro status → INCERTEZA (não reenvia)

   O fim vem no SSE: `session.compaction.ended` (resumo em `text`) ou
   `session.compaction.failed`. A rota não tem campo de instruções: o texto de
   `/compact …` não atravessa nesta versão. Compactar não abre turno. */

const {wireMessageId} = require('./opencode-ids.cjs');
const {isRefusal, wireItem} = require('./opencode-http.cjs');
const {message} = require('../i18n.mjs');

const COMPACT_TIMEOUT_MS = 240000;

/**
 * @typedef {{status: 'ended'|'failed'|'abandoned'|'timeout', summary: string, error?: Error}} CompactionSettled
 * @typedef {{id: string, summary: string, status: string, promise: Promise<CompactionSettled>,
 *   timer: ReturnType<typeof setTimeout>|null, resolve: (value: CompactionSettled) => void}} CompactionWaiter
 * @typedef {{request: import('./opencode-http.cjs').OpenCodeClient['request'], route: (suffix: string) => string,
 *   ensureEvents: () => Promise<boolean>, compactions: CompactionTracker}} CompactionPort
 */

/** @param {string} key @param {Record<string, string|number>} args @param {{notSent?: boolean, uncertain?: boolean, status?: number}} flags */
function failure(key, args, flags) {
  return Object.assign(Error(message(key, args)), flags);
}

/**
 * Um pedido de compactação por vez, resolvido pelos eventos do SSE.
 * @example const tracker = new CompactionTracker(); const waiter = tracker.begin(); tracker.receive('compaction_end', {text: 'resumo'});
 */
class CompactionTracker {
  /** @param {{timeoutMs?: number}} [options] */
  constructor({timeoutMs} = {}) {
    const value = Number(timeoutMs);
    this.timeoutMs = Number.isFinite(value) && value > 0 ? value : COMPACT_TIMEOUT_MS;
    /** @type {CompactionWaiter|null} */
    this.current = null;
  }

  /** @returns {CompactionWaiter} */
  begin() {
    if (this.current) return this.current;
    /** @type {(value: CompactionSettled) => void} */
    let resolve = () => {};
    const promise = new Promise((done) => { resolve = done; });
    /** @type {CompactionWaiter} */
    const waiter = {id: '', summary: '', status: '', promise, timer: null, resolve};
    waiter.timer = setTimeout(() => this.finish(waiter, 'timeout'), this.timeoutMs);
    waiter.timer.unref?.();
    this.current = waiter;
    return waiter;
  }

  /* Evento de compactação automática (sem pedido nosso) não resolve nada. */
  /** @param {string} type @param {Record<string, unknown>} [payload] */
  receive(type, payload = {}) {
    const waiter = this.current;
    if (!waiter) return;
    if (type === 'compaction_start' && !waiter.id && payload.id) waiter.id = String(payload.id);
    if (type === 'compaction_delta' && typeof payload.text === 'string') waiter.summary += payload.text;
    if (type === 'compaction_end') this.finish(waiter, 'ended', {summary: typeof payload.text === 'string' && payload.text ? payload.text : waiter.summary});
    if (type === 'compaction_failed') this.finish(waiter, 'failed', {error: Object.assign(Error(typeof payload.message === 'string' && payload.message ? payload.message : message('opencode.compact.failed')), {notSent: false})});
  }

  /** O POST foi recusado, ficou incerto ou a conexão fechou. @param {CompactionWaiter|null} waiter */
  abandon(waiter) {
    if (waiter && !waiter.status) this.finish(waiter, 'abandoned');
  }

  /** @param {CompactionWaiter} waiter @param {CompactionSettled['status']} status @param {Partial<CompactionSettled>} [extra] */
  finish(waiter, status, extra = {}) {
    if (waiter.status) return;
    waiter.status = status;
    if (waiter.timer) clearTimeout(waiter.timer);
    waiter.timer = null;
    if (this.current === waiter) this.current = null;
    waiter.resolve({status, summary: waiter.summary, ...extra});
  }
}

/** @param {CompactionSettled} settled @param {string} id @returns {{id: string, accepted: true, summary: string, tokensBefore: number, pending?: true}} */
function settledResult(settled, id) {
  if (settled.status === 'failed') throw settled.error;
  if (settled.status === 'abandoned') throw failure('opencode.compact.lost', {}, {uncertain: true, notSent: false});
  /* O evento traz o uso do passo que resumiu, não os tokens de antes:
     0 é mais honesto do que inventar um número. */
  const result = {id, accepted: /** @type {const} */ (true), summary: String(settled.summary || '').slice(0, 4000), tokensBefore: 0};
  return settled.status === 'timeout' ? {...result, pending: /** @type {const} */ (true)} : result;
}

/**
 * Pede a compactação e espera o fim pelo SSE.
 * @param {CompactionPort} port @param {{id?: string}} [input]
 * @returns {Promise<{id: string, accepted: true, summary: string, tokensBefore: number, pending?: true}>}
 * @example await runCompaction({request: client.request, route, ensureEvents, compactions: tracker}, {id: uuid})
 */
async function runCompaction(port, input = {}) {
  const id = wireMessageId(input.id);
  if (!await port.ensureEvents()) throw failure('opencode.noEvents', {}, {notSent: true});
  if (port.compactions.current) throw failure('opencode.compact.busy', {}, {notSent: true});
  const waiter = port.compactions.begin();
  let response;
  try {
    response = await port.request('POST', port.route('/compact'), {body: {id, delivery: 'steer'}});
  } catch (error) {
    port.compactions.abandon(waiter);
    throw error;
  }
  if (response.status === 200 && wireItem(response.payload).type === 'compaction') return settledResult(await waiter.promise, id);
  port.compactions.abandon(waiter);
  const action = 'opencode.action.compact';
  if (isRefusal(response.status)) throw failure('err.opencode.refused', {action, status: response.status}, {notSent: true, status: response.status});
  throw failure('err.opencode.unconfirmed', {action, status: response.status}, {uncertain: true, notSent: false, status: response.status});
}

module.exports = {COMPACT_TIMEOUT_MS, CompactionTracker, runCompaction};
