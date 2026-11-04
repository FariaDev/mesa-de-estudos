// @ts-check
'use strict';

/* Entrega do prompt/comando ao `opencode serve` (#89): o aceite comprovado
   abre o turno pelo SSE, a recusa comprovada pode repetir e o resto é
   incerteza. Fica fora do adaptador porque o mesmo caminho serve prompt,
   comando e steer, e misturar isso com sessão/histórico passava o teto de
   linhas do módulo. */

const deliveryCore = require('../generated/agentdelivery.core.js').default;
const {isRefusal, wireItem} = require('./opencode-http.cjs');
const {message} = require('../i18n.mjs');

const PROMPT_TIMEOUT_MS = 120000;

/**
 * @param {string} key
 * @param {Record<string, string|number>} args
 * @param {Record<string, unknown>} flags
 * @returns {Error & Record<string, unknown>}
 */
const failure = (key, args, flags) => /** @type {Error & Record<string, unknown>} */ (Object.assign(Error(message(key, args)), flags));

/** @param {unknown} payload @returns {boolean} */
const inboxUser = (payload) => { const item = wireItem(payload); return item.type === 'user' || item.role === 'user'; };

/**
 * @typedef {{turn: {id: string}|null, busy: boolean, runId: string,
 *   http: () => import('./opencode-http.cjs').OpenCodeClient, ensureEvents: () => Promise<boolean>,
 *   delivery: (status: string, id: string) => Promise<void>, emitEvent: (type: string, payload?: Record<string, unknown>) => void,
 *   receive: (type: string, payload: Record<string, unknown>) => void}} AdmissionPort
 */

/**
 * O steer aceito NÃO abre outro turno: o principal continua com o mesmo
 * `runId`, o mesmo diário e o mesmo `turn.id` a liquidar. Um `turn_start` no
 * meio dele reiniciava os balões e a resposta interrompida aparecia duas vezes
 * ao vivo (teste manual do Mac, 2026-10-31).
 * @param {AdmissionPort} port
 * @param {string} id
 * @param {import('./opencode-http.cjs').OpenCodeResponse} response
 * @param {{steer?: boolean}} [options]
 * @returns {Promise<{id: string, accepted: true}>}
 */
async function openTurn(port, id, response, {steer = false} = {}) {
  if (steer) {
    await port.delivery('accepted', id);
    return {id, accepted: true};
  }
  const item = wireItem(response.payload);
  port.runId = String(inboxUser(response.payload) ? item.id || id : id);
  port.busy = true;
  port.turn = {id};
  /* Antes de qualquer espera: um erro imediato do provedor chega enquanto a
     fase `accepted` é gravada, e sem o `turn_start` a UI só mostrava um toast
     passageiro (modelo padrão sem acesso; teste manual do Mac, 2026-10-31). */
  port.emitEvent('turn_start', {id});
  await port.delivery('accepted', id);
  return {id, accepted: true};
}

/**
 * Manda um prompt ou comando e classifica a resposta pelo núcleo.
 * @param {AdmissionPort} port
 * @param {{id: string, route: string, body: Record<string, unknown>, accepts: (response: import('./opencode-http.cjs').OpenCodeResponse) => boolean,
 *   action: string, onRefused?: () => void, steer?: boolean}} admission
 * @returns {Promise<{id: string, accepted: true}>}
 */
async function admitTurn(port, {id, route, body, accepts, action, onRefused, steer = false}) {
  if (!await port.ensureEvents()) throw failure('opencode.noEvents', {}, {notSent: true});
  let response;
  try {
    response = await port.http().request('POST', route, {body, timeoutMs: PROMPT_TIMEOUT_MS});
  } catch (error) {
    await port.delivery('uncertain', id);
    throw error;
  }
  const accepted = accepts(response);
  const verdict = deliveryCore.outcome(accepted, !accepted && !isRefusal(response.status)).$;
  if (verdict === 'DeliveryOutcome.Accepted') return openTurn(port, id, response, {steer});
  if (verdict === 'DeliveryOutcome.Refused') {
    onRefused?.();
    await port.delivery('refused', id);
    throw failure('err.opencode.refused', {action, status: response.status}, {notSent: true, status: response.status});
  }
  await port.delivery('uncertain', id);
  throw failure('err.opencode.unconfirmed', {action, status: response.status}, {uncertain: true, notSent: false, status: response.status});
}

module.exports = {PROMPT_TIMEOUT_MS, admitTurn, failure, inboxUser, openTurn};
