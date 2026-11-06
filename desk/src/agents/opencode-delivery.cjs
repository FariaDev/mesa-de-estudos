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
 * @typedef {{cancelled: boolean, opened: boolean, closed: boolean, endEmitted: boolean, interruptOk: boolean, done: boolean,
 *   run: Promise<unknown>|null}} DeliveryToken
 */
/**
 * @typedef {{turn: {id: string, token?: DeliveryToken}|null, busy: boolean, runId: string,
 *   http: () => import('./opencode-http.cjs').OpenCodeClient, ensureEvents: () => Promise<boolean>,
 *   delivery: (status: string, id: string) => Promise<void>, emitEvent: (type: string, payload?: Record<string, unknown>) => void,
 *   receive: (type: string, payload: Record<string, unknown>) => void,
 *   cancelledAcceptance?: (token: DeliveryToken, id: string) => Promise<unknown>}} AdmissionPort
 */

/**
 * O steer aceito NÃO abre outro turno: o principal continua com o mesmo
 * `runId`, o mesmo diário e o mesmo `turn.id` a liquidar. Um `turn_start` no
 * meio dele reiniciava os balões e a resposta interrompida aparecia duas vezes
 * ao vivo (teste manual do Mac, 2026-10-31).
 * @param {AdmissionPort} port
 * @param {string} id
 * @param {import('./opencode-http.cjs').OpenCodeResponse} response
 * @param {{steer?: boolean, token?: DeliveryToken|null}} [options]
 * @returns {Promise<{id: string, accepted: true, cancelled?: boolean}>}
 */
async function openTurn(port, id, response, {steer = false, token = null} = {}) {
  /* O Parar chegou antes do aceite: a mensagem foi escrita, mas o turno não
     pode abrir — interrompe já e fecha a entrega (o `turn_end` do Parar já
     saiu). Sem esta checagem, o tutor respondia depois de o aluno parar. */
  if (token?.cancelled) {
    await port.delivery('accepted', id);
    await port.cancelledAcceptance?.(token, id);
    return {id, accepted: true, cancelled: true};
  }
  if (steer) {
    await port.delivery('accepted', id);
    if (token?.cancelled) await port.cancelledAcceptance?.(token, id);
    return {id, accepted: true, ...(token?.cancelled ? {cancelled: true} : {})};
  }
  const item = wireItem(response.payload);
  port.runId = String(inboxUser(response.payload) ? item.id || id : id);
  port.busy = true;
  port.turn = {id, ...(token ? {token} : {})};
  if (token) token.opened = true;
  /* Antes de qualquer espera: um erro imediato do provedor chega enquanto a
     fase `accepted` é gravada, e sem o `turn_start` a UI só mostrava um toast
     passageiro (modelo padrão sem acesso; teste manual do Mac, 2026-10-31). */
  port.emitEvent('turn_start', {id});
  await port.delivery('accepted', id);
  if (token?.cancelled) await port.cancelledAcceptance?.(token, id);
  return {id, accepted: true, ...(token?.cancelled ? {cancelled: true} : {})};
}

/**
 * Manda um prompt ou comando e classifica a resposta pelo núcleo.
 * @param {AdmissionPort} port
 * @param {{id: string, route: string, body: Record<string, unknown>, accepts: (response: import('./opencode-http.cjs').OpenCodeResponse) => boolean,
 *   action: string, onRefused?: () => void, steer?: boolean, token?: DeliveryToken|null}} admission
 * @returns {Promise<{id: string, accepted: true, cancelled?: boolean}>}
 */
async function admitTurn(port, {id, route, body, accepts, action, onRefused, steer = false, token = null}) {
  if (!await port.ensureEvents()) throw failure('opencode.noEvents', {}, {notSent: true});
  let response;
  try {
    response = await port.http().request('POST', route, {body, timeoutMs: PROMPT_TIMEOUT_MS});
  } catch (error) {
    /* Envio já cancelado: o Parar não vira incerteza e não trava o próximo
       Enviar. O aceite tardio, quando existe, é interrompido em `openTurn`. */
    if (!token?.cancelled) await port.delivery('uncertain', id);
    throw error;
  }
  const accepted = accepts(response);
  const verdict = deliveryCore.outcome(accepted, !accepted && !isRefusal(response.status)).$;
  if (verdict === 'DeliveryOutcome.Accepted') return openTurn(port, id, response, {steer, token});
  if (verdict === 'DeliveryOutcome.Refused') {
    onRefused?.();
    await port.delivery('refused', id);
    throw failure('err.opencode.refused', {action, status: response.status}, {notSent: true, status: response.status});
  }
  if (!token?.cancelled) await port.delivery('uncertain', id);
  throw failure('err.opencode.unconfirmed', {action, status: response.status}, {uncertain: true, notSent: false, status: response.status});
}

/** @param {unknown} value @returns {string} */
function redactErrorDetail(value) {
  return String(value || '').replace(/((?:api[_-]?key|authorization|bearer)["']?\s*[:=]\s*["']?)[^"',}\s]+/gi, '$1***').slice(0, 400);
}

/** @param {unknown} value @returns {string} */
function stringStatus(value) {
  if (!value || typeof value !== 'object') return '';
  const status = /** @type {{status?: unknown}} */ (value).status;
  return typeof status === 'string' ? status : '';
}

module.exports = {PROMPT_TIMEOUT_MS, admitTurn, failure, inboxUser, openTurn, redactErrorDetail, stringStatus};
