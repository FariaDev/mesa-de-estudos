'use strict';

/* "Ver o que desenhei" (#60): o tutor manda o SVG ou o corpo de uma cerca
   `plot` e recebe um print PNG do que o aluno veria, mais os avisos e o que o
   sanitizador removeu. A figura é desenhada numa janela Electron INVISÍVEL e
   offline, pela mesma página que usa o markup do chat (`src/figures/figure.html`),
   então o renderizador e o sanitizador são os reais. Nada é gravado.

   Segue o desenho de `activity-preview.cjs`: janela por chamada, partição em
   memória, uma chamada por vez. Sessão trancada: só arquivos do próprio app. */

const path = require('node:path');
const {fileURLToPath} = require('node:url');
const {invalidValue} = require('./src/error-detail.mjs');

const FIGURE_HTML = path.join(__dirname, 'src', 'figures', 'figure.html');
const MIN_WIDTH = 240;
const MAX_WIDTH = 1600;
const DEFAULT_WIDTH = 560;
const MAX_CAPTURE = 4000;
const KINDS = ['plot', 'svg'];
const MAX_SOURCE_CHARS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Só o que a página importa: `src`, `node_modules`, `locales` (catálogos de idioma), `style.css` e `highlight.mjs`. */
function allowedFile(file) {
  const roots = [path.join(__dirname, 'src'), path.join(__dirname, 'node_modules'), path.join(__dirname, 'locales')].map((root) => path.resolve(root));
  const loose = [path.join(__dirname, 'highlight.mjs'), path.join(__dirname, 'style.css')].map((entry) => path.resolve(entry));
  const target = path.resolve(file);
  return loose.includes(target) || roots.some((root) => target.startsWith(root + path.sep));
}

/** Tranca a sessão da janela: nenhuma URL fora do app sai da máquina.
 * @param {import('electron').Session} session */
function lockFigureSession(session) {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  if (typeof session.setPermissionCheckHandler === 'function') session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => {
    try {
      const url = new URL(String(details.url || ''));
      callback({cancel: !(url.protocol === 'file:' && allowedFile(fileURLToPath(url)))});
    } catch { callback({cancel: true}); }
  });
}

/** A janela real: escondida, sandbox, partição em memória e sessão trancada.
 * @param {typeof import('electron')} electron @param {{width: number}} size */
function createFigureWindow(electron, {width}) {
  const win = new electron.BrowserWindow({
    show: false, width, height: 600, useContentSize: true, paintWhenInitiallyHidden: true, skipTaskbar: true, focusable: false,
    webPreferences: {partition: `mesa-figure-${process.pid}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false, disableDialogs: true},
  });
  lockFigureSession(win.webContents.session);
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  return win;
}

function cleanWidth(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, number));
}

/** @param {unknown} raw */
function cleanRequest(raw) {
  const request = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  if (!KINDS.includes(String(request.kind))) throw new Error(invalidValue('kind', request.kind, '"plot" ou "svg"'));
  if (typeof request.source !== 'string' || !request.source.trim() || request.source.length > MAX_SOURCE_CHARS) {
    throw new Error(invalidValue('source', typeof request.source === 'string' ? `${request.source.length} caracteres` : request.source, `texto de 1 a ${MAX_SOURCE_CHARS} caracteres`));
  }
  return {kind: String(request.kind), source: request.source, theme: request.theme === 'escuro' || request.theme === 'dark' ? 'escuro' : 'claro', width: cleanWidth(request.width)};
}

/**
 * @param {{createWindow?: (size: {width: number}) => import('electron').BrowserWindow, loadMs?: number}} [options]
 *   `createWindow` entra por parâmetro nos testes (janela falsa); o padrão é a real.
 * @returns {{preview: (raw: unknown) => Promise<object>}}
 * @example const {preview} = createFigurePreview({createWindow}); const {screenshot} = await preview({kind: 'plot', source: 'funcao: x^2'});
 */
function createFigurePreview({createWindow = (size) => createFigureWindow(require('electron'), size), loadMs = 10000} = {}) {
  let chain = Promise.resolve();
  const serial = (job) => {
    const run = chain.then(job, job);
    chain = run.catch(() => {});
    return run;
  };

  async function draw(request) {
    const win = createWindow({width: request.width});
    try {
      await Promise.race([win.loadFile(FIGURE_HTML), sleep(loadMs).then(() => { throw new Error(`a página da figura não carregou em ${loadMs} ms`); })]);
      const report = await win.webContents.executeJavaScript(`window.mesaFigure.render(${JSON.stringify(request)})`);
      const height = Math.min(MAX_CAPTURE, Math.max(48, report.contentHeight));
      win.setContentSize(request.width, height);
      await sleep(120);
      const image = await win.webContents.capturePage({x: 0, y: 0, width: request.width, height});
      const size = image.getSize();
      const scaled = size.width > request.width ? image.resize({width: request.width, height, quality: 'best'}) : image;
      const shot = scaled.getSize();
      return {
        width: request.width, theme: request.theme, contentHeight: report.contentHeight,
        plots: report.plots, svgs: report.svgs, warnings: report.warnings, removed: report.removed,
        screenshot: {mimeType: 'image/png', data: scaled.toPNG().toString('base64'), width: shot.width, height: shot.height},
      };
    } finally {
      try { if (!win.isDestroyed()) win.destroy(); } catch { /* já fechou */ }
    }
  }

  return {preview: (raw) => serial(() => draw(cleanRequest(raw)))};
}

module.exports = {createFigurePreview, cleanRequest, cleanWidth, lockFigureSession, allowedFile};
