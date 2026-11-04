'use strict';

/* Confirmação do link externo de uma view web (#81). O applet do GeoGebra abre
   janela nova pelo `window.open`; o `guardPage` prende a janela, mas o link
   `https:` não pode ir direto ao navegador do sistema: quem decide é o diálogo
   da Mesa (`src/link-confirm.mjs`), que mostra o domínio de destino. Este host
   leva a pergunta ao renderer e espera a resposta; a página nova continua
   negada em qualquer caso. Sem resposta (janela fechada, renderer recarregado),
   o link não abre. */

const crypto = require('node:crypto');
const {message} = require('./src/i18n.mjs');
const {isExternalLink} = require('./web-guards.cjs');

/**
 * @typedef {{resolve: (ok: boolean) => void, done: boolean}} LinkJob
 */

/**
 * Pergunta ao renderer se pode abrir um link e espera o "Abrir" do diálogo.
 * @param {{send: (channel: string, payload: object) => boolean,
 *   allowSender?: (event: Electron.IpcMainInvokeEvent) => boolean,
 *   newId?: () => string}} deps
 *   `send` devolve `false` quando a janela não existe; aí o link não abre.
 * @returns {{confirm: (url: string) => Promise<boolean>, respond: (event: Electron.IpcMainInvokeEvent, payload: unknown) => {ok: boolean, stale?: boolean}, cancelAll: () => void, register: (ipcMain: {handle: Function}) => void, pending: Map<string, LinkJob>}}
 * @example const confirmHost = createLinkConfirmHost({send: (channel, payload) => win.webContents.send(channel, payload)});
 */
function createLinkConfirmHost({send, allowSender, newId = () => crypto.randomUUID()} = {}) {
  if (typeof send !== 'function') throw new Error('send ausente');
  const pending = new Map();

  function finish(job, ok) {
    if (job.done) return;
    job.done = true;
    job.resolve(ok === true);
  }

  /**
   * `true` só com a resposta "Abrir". URL que não é `https:` nem chega ao
   * renderer.
   * @param {string} url
   * @returns {Promise<boolean>}
   * @example await confirmHost.confirm('https://exemplo.com/x')
   */
  function confirm(url) {
    if (!isExternalLink(url)) return Promise.resolve(false);
    const id = newId();
    return new Promise((resolve) => {
      const job = {resolve, done: false};
      pending.set(id, job);
      let sent;
      try { sent = send('link-confirm', {id, url}) === true; } catch { sent = false; }
      if (!sent) {
        pending.delete(id);
        finish(job, false);
      }
    });
  }

  function respond(event, payload) {
    if (typeof allowSender === 'function' && !allowSender(event)) {
      throw new Error(message('err.ipc.senderDenied', {channel: 'link-confirm-respond'}));
    }
    const id = typeof payload?.id === 'string' ? payload.id : '';
    const job = pending.get(id);
    if (!job) return {ok: false, stale: true};
    pending.delete(id);
    finish(job, payload.ok === true);
    return {ok: true};
  }

  function cancelAll() {
    for (const [id, job] of pending) {
      pending.delete(id);
      finish(job, false);
    }
  }

  function register(ipcMain) {
    ipcMain.handle('link-confirm-respond', (event, payload) => respond(event, payload));
  }

  return {confirm, respond, cancelAll, register, pending};
}

module.exports = {createLinkConfirmHost};
