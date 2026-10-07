'use strict';

/* Ponte mínima da página de impressão: recebe o material do main, entrega para
   o `print.mjs` e devolve o resultado. Sem expor `ipcRenderer`, sem aceitar
   caminho/comando do payload — o renderer do PDF só conversa pelo canal certo. */
const {contextBridge, ipcRenderer} = require('electron');

let pending = null;
let handler = null;

ipcRenderer.on('material-pdf:render', (_event, payload) => {
  if (handler) {
    try { handler(payload); } catch { /* o print.mjs reporta a falha */ }
    return;
  }
  pending = payload;
});

contextBridge.exposeInMainWorld('materialPrint', {
  onRender(callback) {
    if (typeof callback !== 'function') return;
    handler = callback;
    if (pending) {
      const payload = pending;
      pending = null;
      Promise.resolve().then(() => handler(payload));
    }
  },
  done(result) {
    ipcRenderer.send('material-pdf:done', result);
  },
});
