// @ts-check
'use strict';

/* Imagem de uma página de PDF sem poppler. O main abre uma BrowserWindow
   escondida que carrega `pdf-render.html`: o mesmo pdf.js da janela de PDF,
   desenhando num canvas do Chromium. A janela roda em `sandbox`, então não lê
   disco: pede os bytes ao main pelo canal `PDF_RENDER_READ_CHANNEL`, e o main
   entrega só o caminho desta chamada em curso e só à janela de render. Os
   testes injetam a janela; aqui não há Electron. */
const fs = require('node:fs');

const PDF_RENDER_READ_CHANNEL = 'mesa-pdf-render-read';

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error(`${label} passou de ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Renderer de páginas: uma janela escondida, criada na primeira página e reaproveitada.
 * `readFile` lê o caminho autorizado no main; a janela de render não tem acesso ao disco.
 * @param {{createWindow: () => {loadFile: (html: string) => Promise<void>, webContents: {executeJavaScript: (script: string) => Promise<unknown>}, on?: (event: string, fn: () => void) => void, close?: () => void}, html: string, ipcMain: {handle: (channel: string, fn: (event: {sender: unknown}, file: unknown) => unknown) => void}, readFile?: (file: string) => Buffer, timeoutMs?: number}} deps
 * @returns {{render: (request: {file: string, page: number, girar?: number, recorte?: import('./pdf-page-view.cjs').Recorte|null, ampliar?: number}) => Promise<string>, close: () => void}}
 * @example const renderer = createPdfPageRenderer({createWindow, html, ipcMain, readFile: fs.readFileSync});
 */
function createPdfPageRenderer({createWindow, html, ipcMain, readFile = (file) => fs.readFileSync(file), timeoutMs = 20000}) {
  let current = '';
  /** @type {unknown} webContents da janela de render, a única que pode pedir bytes */
  let renderContents = null;
  /** @type {Promise<{webContents: {executeJavaScript: (script: string) => Promise<unknown>}, close?: () => void}> | null} */
  let windowPromise = null;
  /* Só a janela de render, só o arquivo da chamada em curso: o resto é recusado. */
  ipcMain.handle(PDF_RENDER_READ_CHANNEL, (event, file) => {
    if (!renderContents || event.sender !== renderContents || typeof file !== 'string' || file === '' || file !== current) {
      throw Error('caminho de PDF não autorizado para render');
    }
    return readFile(file);
  });

  function dropWindow() {
    windowPromise = null;
    renderContents = null;
    current = '';
  }

  async function ensure() {
    if (windowPromise) return windowPromise;
    /** @type {ReturnType<Parameters<typeof createPdfPageRenderer>[0]['createWindow']> | null} */
    let created = null;
    windowPromise = (async () => {
      const win = createWindow();
      created = win;
      renderContents = win.webContents;
      win.on?.('closed', dropWindow);
      await win.loadFile(html);
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const ready = await win.webContents.executeJavaScript('typeof window.mesaRenderPdfPage==="function"');
        if (ready === true) return win;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw Error('o render de PDF não ficou pronto');
    })();
    try {
      return await windowPromise;
    } catch (error) {
      dropWindow();
      try {
        created?.close?.();
      } catch {
        /* a janela que não ficou pronta já pode ter fechado */
      }
      throw error;
    }
  }

  async function renderOne({file, page, girar, recorte, ampliar}) {
    const win = await ensure();
    current = file;
    try {
      /* Giro, recorte e ampliação são só dados: o caminho lido continua sendo
         o da chamada em curso, e nenhuma opção abre outro arquivo (#114). */
      const view = {girar: Number(girar) || 0, recorte: recorte || null, ampliar: Number(ampliar) || 1};
      const script = `window.mesaRenderPdfPage(${JSON.stringify(file)}, ${Number(page)}, ${JSON.stringify(view)})`;
      const image = await withTimeout(win.webContents.executeJavaScript(script), timeoutMs, 'render da página');
      if (typeof image !== 'string' || !image) throw Error('a página não devolveu PNG');
      return image;
    } finally {
      current = '';
    }
  }

  let tail = Promise.resolve();
  function render(request) {
    const run = tail.then(() => renderOne(request));
    tail = run.then(() => {}, () => {});
    return run;
  }

  function close() {
    const pending = windowPromise;
    dropWindow();
    pending?.then((win) => win.close?.()).catch(() => {});
  }

  return {render, close};
}

module.exports = {createPdfPageRenderer, PDF_RENDER_READ_CHANNEL};
