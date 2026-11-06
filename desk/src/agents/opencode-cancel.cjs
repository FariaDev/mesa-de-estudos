// @ts-check
'use strict';

/* Parar do adaptador OpenCode (#57, revisão): acompanha TODO envio (prompt ou
   comando) desde o clique em Enviar. O `cancel()` não espera a admissão
   inteira (PROMPT_TIMEOUT_MS) nem um servidor mudo: fecha a interface numa
   folga curta e interrompe o aceite tardio quando ele chega. A marca é por
   envio — o próximo Enviar nasce limpo. Saiu do `opencode-adapter.cjs` para o
   arquivo caber no teto de linhas. */

const CANCEL_GRACE_MS = 250;
const CANCEL_INTERRUPT_TIMEOUT_MS = 500;

/**
 * @typedef {import('./opencode-delivery.cjs').DeliveryToken} DeliveryToken
 * @typedef {{pendingDeliveries: Set<DeliveryToken>, turn: {id: string, token?: DeliveryToken}|null, client: unknown,
 *   log: (area: string, line: string) => void, turnGuard: {noteInterrupt: () => void},
 *   http: () => import('./opencode-http.cjs').OpenCodeClient, route: (suffix: string) => string,
 *   settleTurn: (end: {cancelled: boolean}) => void, endTurn: (end: {cancelled: boolean}, options?: {force?: boolean}) => void,
 *   delivery: (status: string, id: string) => Promise<void>}} CancelAdapter
 */

/**
 * Registra um envio em voo. O token é a identidade do Parar: `cancel()` o
 * marca e o aceite tardio consulta a marca antes de abrir turno.
 * @param {CancelAdapter} adapter
 * @param {(token: DeliveryToken) => Promise<unknown>} start
 * @returns {Promise<unknown>}
 * @example const run = trackDelivery(adapter, (token) => adapter.deliverPrompt(input, id, token));
 */
function trackDelivery(adapter, start) {
  /** @type {DeliveryToken} */
  const token = {cancelled: false, opened: false, closed: false, endEmitted: false, interruptOk: false, done: false, run: null};
  const run = start(token);
  token.run = run;
  adapter.pendingDeliveries.add(token);
  const settle = () => { token.done = true; adapter.pendingDeliveries.delete(token); };
  run.then(settle, settle);
  return run;
}

/**
 * Um interrupt com prazo curto: o Parar não pode ficar preso no servidor.
 * @param {CancelAdapter} adapter
 * @returns {Promise<import('./opencode-http.cjs').OpenCodeResponse|null>}
 */
async function interrupt(adapter) {
  try {
    return await adapter.http().request('POST', adapter.route('/interrupt'), {timeoutMs: CANCEL_INTERRUPT_TIMEOUT_MS});
  } catch (error) {
    adapter.log('opencode', `falha ao interromper: ${error?.message || error}`);
    return null;
  }
}

/**
 * O Parar vale do clique em Enviar até o fim do turno, inclusive durante
 * `connect()` e a admissão. Espera só uma folga pelo aceite, fecha o turno e
 * deixa o aceite tardio ser interrompido em `cancelledAcceptance`.
 * @param {CancelAdapter} adapter
 * @returns {Promise<{aborted: boolean}>}
 * @example await adapter.cancel();
 */
async function cancel(adapter) {
  const tokens = [...adapter.pendingDeliveries];
  const hadTurn = Boolean(adapter.turn);
  for (const token of tokens) token.cancelled = true;
  if (tokens.length) {
    await Promise.race([
      Promise.allSettled(tokens.map((token) => token.run)),
      new Promise((resolve) => setTimeout(resolve, CANCEL_GRACE_MS)),
    ]);
  }
  /** @type {import('./opencode-http.cjs').OpenCodeResponse|null} */
  let response = null;
  if (adapter.client && adapter.turn) response = await interrupt(adapter);
  let ended = false;
  if (response?.ok) {
    adapter.turnGuard.noteInterrupt();
    adapter.settleTurn({cancelled: true});
    ended = true;
  } else if (adapter.turn) {
    adapter.endTurn({cancelled: true});
    ended = true;
  }
  if (!ended && (hadTurn || tokens.length) && !tokens.some((token) => token.endEmitted)) {
    adapter.endTurn({cancelled: true}, {force: true});
    ended = true;
  }
  for (const token of tokens) { token.closed = true; if (ended) token.endEmitted = true; }
  return {aborted: Boolean(response?.ok) || tokens.length > 0 || tokens.some((token) => token.interruptOk)};
}

/**
 * O aceite chegou DEPOIS do Parar: a mensagem foi escrita, mas o turno não
 * pode ficar de pé. Interrompe agora; sem turno local, só a entrega é
 * liquidada (o `turn_end` do Parar já saiu). Se um turno NOVO já está aberto,
 * não manda interrupt (ele mataria o envio seguinte — a fila de aborto não
 * vaza para o próximo Enviar).
 * @param {CancelAdapter} adapter
 * @param {DeliveryToken} token
 * @param {string} id
 * @returns {Promise<unknown>}
 */
async function cancelledAcceptance(adapter, token, id) {
  if (adapter.turn && adapter.turn.token !== token) return null;
  const response = await interrupt(adapter);
  if (!response?.ok) return response;
  token.interruptOk = true;
  adapter.turnGuard.noteInterrupt();
  if (adapter.turn?.token === token) {
    adapter.settleTurn({cancelled: true});
    token.endEmitted = true;
  } else {
    await adapter.delivery('settled', id);
    if (!token.closed) {
      adapter.endTurn({cancelled: true}, {force: true});
      token.endEmitted = true;
    }
  }
  return response;
}

module.exports = {CANCEL_GRACE_MS, CANCEL_INTERRUPT_TIMEOUT_MS, trackDelivery, interrupt, cancel, cancelledAcceptance};
