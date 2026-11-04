'use strict';

/* Proposta de card do tutor. O diálogo é o que já existe; este host só segura
   uma proposta por vez e grava se `proposalEnters` deixar. Janela fechada,
   prazo e troca de sessão devolvem pendente — o turno do tutor não fica preso.
   Prazo e turno abortado só respondem ao tutor: o diálogo fica aberto, porque
   fechá-lo jogaria fora o que o aluno estava editando, e um "aprovar" depois
   ainda grava. */

const crypto = require('node:crypto');
const reviewCore = require('./src/generated/review.core.js').default;
const {normalizeOne} = require('./review.cjs');
const {message} = require('./src/i18n.mjs');
const {describeReceived} = require('./src/error-detail.mjs');
const {isPlainObject} = require('./plain-object.cjs');

const DEFAULT_TIMEOUT_MS = 120000;
const RENDERER_STATUSES = new Set(['approved', 'edited', 'discarded', 'busy']);

/**
 * @param {{status: string, saved?: boolean, item?: object | null, reason?: string}} input
 * @returns {{proposed: true, status: string, saved: boolean, item: object | null, reason?: string}}
 */
function agentResult({status, saved = false, item = null, reason = ''}) {
  const out = {proposed: true, status, saved, item};
  if (reason) out.reason = reason;
  return out;
}

/* O modelo não manda referência: o renderer cola a página aberta. */
function proposalFields(raw) {
  if (!isPlainObject(raw)) throw new Error(message('err.bridge.badPayload', {what: 'review-proposal', received: describeReceived(raw)}));
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!question) throw new Error(message('review.error.questionRequired'));
  return {
    question,
    attempt: typeof raw.attempt === 'string' ? raw.attempt : '',
    difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : '',
  };
}

/* O agente vê nome e página. O caminho fica no arquivo e na lista da janela. */
function publicItem(item) {
  if (!item) return null;
  const ref = item.ref || {};
  return {question: item.question, attempt: item.attempt, difficulty: item.difficulty, ref: {name: ref.name, page: ref.page}};
}

/** @typedef {{courseId: string, conversationId: string, freeSessionId: string, generation: number}} ReviewScope */

/**
 * @param {{window?: () => Electron.BrowserWindow | null, scopeIsCurrent: (scope: ReviewScope) => boolean,
 *   canReview?: (scope: ReviewScope) => boolean, save: (scope: ReviewScope, item: object) => unknown,
 *   allowSender?: (event: Electron.IpcMainInvokeEvent) => boolean, timeoutMs?: number,
 *   deliver?: (win: Electron.BrowserWindow, payload: object) => boolean}} options
 * @example const host = createReviewProposalHost({window: () => win, scopeIsCurrent, save, allowSender})
 */
function createReviewProposalHost({window: windowOf, scopeIsCurrent, canReview = () => true, save, allowSender, timeoutMs = DEFAULT_TIMEOUT_MS, deliver} = {}) {
  if (typeof scopeIsCurrent !== 'function') throw new Error('scopeIsCurrent ausente');
  if (typeof save !== 'function') throw new Error('save ausente');
  const pending = new Map();
  const waitMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

  /* O tutor recebe uma resposta só; a proposta pode seguir viva depois dela. */
  function answer(job, result) {
    clearTimeout(job.timer);
    if (job.answered) return;
    job.answered = true;
    job.resolve(result);
  }

  function settle(id, result) {
    const job = pending.get(id);
    if (!job) return false;
    pending.delete(id);
    job.win?.off?.('closed', job.onClosed);
    answer(job, result);
    return true;
  }

  function detach(id, reason) {
    const job = pending.get(id);
    if (job) answer(job, agentResult({status: 'pending', reason}));
  }

  /* O cancelamento chega ao renderer antes do settle: o `close` do diálogo é
     síncrono e, com `_proposalSilent`, não responde de novo. */
  function cancel(id, reason) {
    const job = pending.get(id);
    if (!job) return;
    try { job.win?.webContents?.send?.('review-proposal-cancel', {id, reason}); } catch { /* a janela já foi */ }
    settle(id, agentResult({status: 'pending', reason}));
  }

  function deliverTo(win, payload) {
    try {
      if (deliver) return deliver(win, payload) !== false;
      win.webContents.send('review-proposal', payload);
      return true;
    } catch {
      return false;
    }
  }

  async function propose(scope, raw, {signal} = {}) {
    if (!scopeIsCurrent(scope)) throw new Error(message('review.error.sessionChanged'));
    if (!canReview(scope)) throw new Error(message('review.error.free'));
    if (pending.size) return Promise.resolve(agentResult({status: 'busy', reason: 'open'}));
    const fields = proposalFields(raw);
    if (signal?.aborted) return Promise.resolve(agentResult({status: 'pending', reason: 'cancelled'}));
    const win = typeof windowOf === 'function' ? windowOf() : null;
    if (!win || win.isDestroyed?.()) return Promise.resolve(agentResult({status: 'pending', reason: 'window'}));
    const id = crypto.randomUUID();
    const captured = {...scope};
    let resolve;
    const done = new Promise((res) => { resolve = res; });
    const job = {resolve, scope: captured, win, timer: null, onClosed: () => cancel(id, 'window')};
    pending.set(id, job);
    win.on?.('closed', job.onClosed);
    const payload = {id, question: fields.question, attempt: fields.attempt, difficulty: fields.difficulty};
    if (!deliverTo(win, payload)) {
      settle(id, agentResult({status: 'pending', reason: 'window'}));
      return done;
    }
    job.timer = setTimeout(() => detach(id, 'timeout'), waitMs);
    job.timer.unref?.();
    watchAbort(signal, id);
    return done;
  }

  function watchAbort(signal, id) {
    if (!signal) return;
    const onAbort = () => detach(id, 'cancelled');
    signal.addEventListener('abort', onAbort, {once: true});
  }

  function respond(event, payload) {
    if (typeof allowSender === 'function' && !allowSender(event)) throw new Error(message('err.ipc.senderDenied', {channel: 'review-proposal-respond'}));
    const id = typeof payload?.id === 'string' ? payload.id : '';
    const job = pending.get(id);
    if (!job) return {ok: false, stale: true};
    const status = typeof payload.status === 'string' ? payload.status : '';
    if (!RENDERER_STATUSES.has(status)) return rejectStatus(id, status);
    if (!scopeIsCurrent(job.scope)) {
      settle(id, agentResult({status: 'pending', reason: 'session'}));
      return {ok: false, stale: true};
    }
    if (!reviewCore.proposalEnters(status)) return release(id, status);
    return commit(id, status, payload.item, job.scope);
  }

  function rejectStatus(id, status) {
    settle(id, agentResult({status: 'discarded', reason: 'status'}));
    return {ok: false, error: message('review.error.proposalStatus', {received: status || 'vazio'})};
  }

  function release(id, status) {
    const agent = agentResult({status, reason: status === 'busy' ? 'open' : ''});
    settle(id, agent);
    return {ok: true, ...agent};
  }

  function commit(id, status, rawItem, scope) {
    const item = normalizeOne(rawItem);
    if (!item) {
      settle(id, agentResult({status: 'discarded', reason: 'invalid'}));
      return {ok: false, error: message('review.error.itemInvalid')};
    }
    let items;
    try { items = save(scope, item); } catch (error) {
      settle(id, agentResult({status: 'discarded', reason: 'save'}));
      return {ok: false, error: error.message || message('review.error.itemInvalid')};
    }
    const agent = agentResult({status, saved: true, item: publicItem(item)});
    settle(id, agent);
    return {ok: true, ...agent, items};
  }

  function cancelAll(reason) {
    for (const id of [...pending.keys()]) cancel(id, reason);
  }

  function register(ipcMain) {
    ipcMain.handle('review-proposal-respond', (event, payload) => respond(event, payload));
  }

  return {propose, respond, cancelAll, register, get pending() { return pending; }};
}

module.exports = {createReviewProposalHost, DEFAULT_TIMEOUT_MS};
