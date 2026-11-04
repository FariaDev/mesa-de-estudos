// @ts-check
'use strict';

/* Preload da janela escondida que desenha a página, em `sandbox`: não lê disco.
   Pede os bytes ao main pelo canal `mesa-pdf-render-read` (`pdf-page-render.cjs`),
   que só entrega o caminho da chamada em curso e só a esta janela. O mundo da
   página não recebe Node, só `mesaPdf.read`. */

const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('mesaPdf', {
  read(file) {
    return ipcRenderer.invoke('mesa-pdf-render-read', file);
  },
});
