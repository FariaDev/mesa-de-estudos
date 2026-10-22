// @ts-check
'use strict';

/* Serviço de PDF de material (aba Livre e matéria): título + Markdown viram um
   PDF DE VERDADE pelo `printToPDF` do Electron, com o renderizador próprio do
   template (`desk/src/materials/template.mjs`: marked + DOMPurify + KaTeX, sem
   a regex de `markdown.mjs`) e `allowAssets=false` — figura/asset local vira
   código, nada é buscado na rede. A página de impressão é local, sandbox,
   contextIsolation e CSP fechada; o payload do renderer nunca é injetado como
   script nem vira caminho de arquivo.

   Contrato:
     available()                                  true sob Electron
     checkMaterial({title, markdown})
                                                  {markdown, diagnostics, blocking,
                                                   message, templateHash} (assíncrono;
                                                   viável em Node puro)
     renderPdf({title, markdown, model, options, context, timeoutMs, signal})
                                                  {buffer, bytes, sha256, templateHash,
                                                   diagnostics, model, options, columns,
                                                   columnsAuto, columnsLabel, fit} —
                                                  diagnostics é uma LISTA de registros
                                                  do template; `model` ausente ou
                                                   desconhecido é o Livre de sempre
     savePdf({dir, stem, title, markdown, model, options, context, timeoutMs, signal})
                                                  {name, path, bytes, sha256,
                                                   templateHash, diagnostics, model,
                                                   options, columns, columnsLabel}
     MaterialPdfError (code: NO_ELECTRON, BAD_PAYLOAD, BAD_DIR, TOO_BIG, LOAD,
     PAGE, GONE, TIMEOUT, ABORTED, PRINT, EMPTY, COLLISION, VERIFY, WRITE,
     MATH, OVERFLOW)

   MATH/OVERFLOW são bloqueios de qualidade: a validação/medição encontra erro de
   sintaxe ou fórmula que não cabe nem no piso legível e NADA é impresso nem
   gravado (o rascunho segue intacto para edição).

   Garantias:
     - `renderPdf` só resolve depois de a página sinalizar `ok` E o
       `printToPDF` devolver um Buffer com assinatura `%PDF-`; timeout/cancelar
       destrói a janela e rejeita (nunca "salvou" sem PDF);
     - `savePdf` grava em arquivo temporário com fsync e só publica o nome
       final por link exclusivo (nunca sobrescreve); o arquivo final é conferido
       por tamanho e sha256 antes de a função resolver;
     - nomes seguem a sequência do núcleo (`x.pdf`, `x-2.pdf`, …), então duas
       gravações simultâneas do mesmo título recebem nomes distintos;
     - o serviço não executa nada que o payload mande: nenhum eval, nenhum
       caminho escolhido pelo conteúdo, nenhum download. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {fileURLToPath, pathToFileURL} = require('node:url');
const core = require('./src/generated/freeworkspaces.core.js').default;
const {toNat} = require('./src/bend-nat.mjs');
const {message: uiMsg} = require('./src/i18n.mjs');
const {causeArg, causeText} = require('./src/error-detail.mjs');

const PRINT_DIR = path.join(__dirname, 'src', 'materials');
const TEMPLATE_MODULE = path.join(PRINT_DIR, 'template.mjs');
const MODEL_MODULE = path.join(PRINT_DIR, 'model.mjs');
const PRINT_HTML = path.join(PRINT_DIR, 'print.html');
const PRINT_PRELOAD = path.join(PRINT_DIR, 'print-preload.cjs');
const RENDER_CHANNEL = 'material-pdf:render';
const DONE_CHANNEL = 'material-pdf:done';

const MAX_MARKDOWN_CHARS = Number(core.maxDraftChars());
const MAX_MARKDOWN_BYTES = MAX_MARKDOWN_CHARS * 4;
const MAX_TITLE_CHARS = Number(core.maxTitle());
const MAX_PATH = 4096;
const MAX_ATTEMPTS = 200;
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_TIMEOUT_MS = 120000;

class MaterialPdfError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'MaterialPdfError';
    this.code = code;
    this.details = details || null;
  }
}

const fail = (code, message, details) => {
  throw new MaterialPdfError(code, message, details);
};

/* O template é ESM (também importável em Node puro pelos testes); o serviço é
   CJS. Carrega uma vez e reusa. */
let templateModule = null;
function loadTemplate() {
  if (!templateModule) templateModule = import(pathToFileURL(TEMPLATE_MODULE).href);
  return templateModule;
}

/* Modelos de PDF (Lista, Apostila, …): a normalização mora no núcleo e chega
   por `model.mjs`; o serviço só valida o que o payload manda e repassa. */
let modelModule = null;
function loadModel() {
  if (!modelModule) modelModule = import(pathToFileURL(MODEL_MODULE).href);
  return modelModule;
}

const MAX_CONTEXT_CHARS = 200;

/* Validação pura do material (sem Electron): título único, headings por
   estrutura Markdown e matemática tokenizada fora de código/escape. Devolve a
   lista de diagnósticos; `blocking` contém só os erros que impedem o PDF. */
async function checkMaterial({title = '', markdown = ''} = {}) {
  const template = await loadTemplate();
  const prepared = template.prepareMaterialMarkdown({title: String(title ?? ''), markdown: String(markdown ?? '')});
  const math = template.checkMaterialMath(prepared.markdown);
  const diagnostics = [...prepared.diagnostics, ...math.diagnostics];
  const blocking = math.errors;
  const first = blocking[0];
  const message = blocking.length === 0
    ? ''
    : (blocking.length === 1 ? first.message : uiMsg('err.pdf.mathMany', {count: blocking.length}));
  return {
    markdown: prepared.markdown,
    diagnostics,
    blocking,
    message,
    templateHash: template.materialTemplateHash(),
  };
}

const isAbsolute = (value) => typeof value === 'string' && value.length > 0 && value.length <= MAX_PATH && path.isAbsolute(value);

function loadElectron() {
  try {
    const electron = require('electron');
    if (electron && electron.BrowserWindow && electron.app && electron.ipcMain) return electron;
  } catch { /* Node puro: o wrapper isolado é quem roda isto */ }
  return null;
}

function available() {
  return loadElectron() !== null;
}

function sha256OfFile(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let read = 0;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function normalizeTimeout(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.trunc(number), 1000), MAX_TIMEOUT_MS);
}

/* Somente arquivos do próprio app (página, markup compartilhado, KaTeX/marked/
   DOMPurify, highlight.mjs e fontes) podem ser requisitados; qualquer outra URL
   — inclusive http(s) — é cancelada antes de sair da máquina. `roots` lista
   PASTAS; `allowedFiles` lista os arquivos soltos na raiz de desk/ que o
   `template.mjs` importa (`../highlight.mjs`) sem abrir a raiz toda. */
function lockSession(session) {
  const roots = [
    PRINT_DIR,
    path.join(__dirname, 'src'),
    path.join(__dirname, 'node_modules'),
  ].map((root) => path.resolve(root));
  const allowedFiles = new Set([
    path.join(__dirname, 'highlight.mjs'),
  ].map((file) => path.resolve(file)));
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  if (typeof session.setPermissionCheckHandler === 'function') session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => {
    let allow = false;
    try {
      const url = new URL(String(details.url || ''));
      if (url.protocol === 'file:') {
        const file = path.resolve(fileURLToPath(url));
        allow = allowedFiles.has(file) || roots.some((root) => file === root || file.startsWith(root + path.sep));
      }
    } catch { allow = false; }
    callback({cancel: allow === false});
  });
}

/** Monta o PDF numa janela escondida e devolve os bytes, sem gravar.
 * @typedef {{title?: string, markdown?: string, model?: string, options?: object, context?: string, timeoutMs?: number, signal?: AbortSignal}} PdfRequest
 * @param {PdfRequest} [request] */
async function renderPdf({title = '', markdown = '', model, options, context = '', timeoutMs, signal} = {}) {
  if (typeof markdown !== 'string') fail('BAD_PAYLOAD', uiMsg('err.pdf.notMarkdown'));
  if (markdown.trim() === '') fail('BAD_PAYLOAD', uiMsg('err.pdf.empty'));
  if (markdown.length > MAX_MARKDOWN_CHARS) fail('TOO_BIG', uiMsg('err.pdf.tooBig'));
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) fail('TOO_BIG', uiMsg('err.pdf.tooBig'));
  if (signal !== undefined && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function')) {
    fail('BAD_PAYLOAD', uiMsg('err.pdf.badSignal'));
  }
  const safeTitle = String(title ?? '').slice(0, MAX_TITLE_CHARS);
  const modelApi = await loadModel();
  const safeModel = modelApi.modelId(model);
  const safeOptions = modelApi.normalizeOptions(safeModel, options);
  const safeContext = String(context ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CONTEXT_CHARS);
  /* Erro de matemática é barrado antes de abrir janela: nada de PDF
     defeituoso e nenhuma surpresa no print. */
  const checked = await checkMaterial({title: safeTitle, markdown});
  if (checked.blocking.length > 0) {
    fail('MATH', checked.message, {diagnostics: checked.diagnostics, blocking: checked.blocking});
  }
  const electron = loadElectron();
  if (!electron) fail('NO_ELECTRON', uiMsg('err.pdf.needsApp'));
  const {BrowserWindow, ipcMain} = electron;
  if (fs.existsSync(PRINT_HTML) === false || fs.existsSync(PRINT_PRELOAD) === false) {
    fail('LOAD', uiMsg('err.pdf.printPageMissing'));
  }

  const token = crypto.randomBytes(12).toString('hex');
  const budget = normalizeTimeout(timeoutMs);
  const state = {error: null, timer: null, done: false, diagnostics: [], overflows: [], modelInfo: null};
  let win = null;
  let onDone = null;

  /* Tira só o ouvinte de conclusão; o timer e o aborto continuam valendo
     durante o printToPDF. */
  const stopWaiting = () => {
    if (onDone) {
      ipcMain.removeListener(DONE_CHANNEL, onDone);
      onDone = null;
    }
  };
  const destroy = () => {
    stopWaiting();
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (signal && signal.removeEventListener) signal.removeEventListener('abort', onAbort);
    if (win && win.isDestroyed() === false) {
      try { win.destroy(); } catch { /* já foi */ }
    }
  };
  const abortWith = (error) => {
    if (state.error) return;
    state.error = error;
    destroy();
  };
  const onAbort = () => abortWith(new MaterialPdfError('ABORTED', uiMsg('err.pdf.cancelled')));

  try {
    await /** @type {Promise<void>} */(new Promise((resolve, reject) => {
      const finishFail = (error) => {
        abortWith(error);
        reject(state.error);
      };
      onDone = (_event, payload) => {
        if (!win || _event.sender !== win.webContents) return;
        if (!payload || payload.token !== token) return;
        if (payload.ok === true) {
          state.done = true;
          state.diagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics : [];
          state.overflows = Array.isArray(payload.overflows) ? payload.overflows : [];
          state.modelInfo = {
            columns: Number.isInteger(payload.columns) ? payload.columns : 1,
            columnsAuto: payload.columnsAuto === true,
            columnsLabel: typeof payload.columnsLabel === 'string' ? payload.columnsLabel : '',
            fit: payload.fit && typeof payload.fit === 'object' ? {percent: Number(payload.fit.percent) || 100, fits: payload.fit.fits === true} : null,
          };
          stopWaiting();
          resolve();
          return;
        }
        finishFail(new MaterialPdfError('PAGE', String(payload.message || uiMsg('err.pdf.renderFail'))));
      };
      ipcMain.on(DONE_CHANNEL, onDone);
      if (signal) {
        if (signal.aborted) {
          finishFail(new MaterialPdfError('ABORTED', uiMsg('err.pdf.cancelled')));
          return;
        }
        signal.addEventListener('abort', onAbort, {once: true});
      }
      /* O mesmo orçamento cobre a página e o printToPDF: se a página ficou
         pronta mas o print travou, o timer destrói a janela e a operação falha
         sem gravar nada. */
      state.timer = setTimeout(() => {
        const error = new MaterialPdfError('TIMEOUT', uiMsg('err.pdf.timeout'));
        if (state.done) abortWith(error);
        else finishFail(error);
      }, budget);
      try {
        win = new BrowserWindow({
          show: false,
          width: 794,
          height: 1123,
          webPreferences: {
            preload: PRINT_PRELOAD,
            partition: `material-pdf-${process.pid}-${token}`,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            spellcheck: false,
            backgroundThrottling: false,
            disableDialogs: true,
          },
        });
        lockSession(win.webContents.session);
        win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
          if (isMainFrame) finishFail(new MaterialPdfError('LOAD', uiMsg('err.pdf.printLoadFail', {code, description})));
        });
        win.webContents.on('render-process-gone', () => finishFail(new MaterialPdfError('GONE', uiMsg('err.pdf.rendererGone'))));
        win.webContents.on('preload-error', (_event, _preloadPath, error) => {
          finishFail(new MaterialPdfError('LOAD', uiMsg('err.pdf.preloadFail', {error: causeArg(error)})));
        });
        win.webContents.on('did-finish-load', () => {
          if (state.error) return;
          win.webContents.send(RENDER_CHANNEL, {token, title: safeTitle, markdown, model: safeModel, options: safeOptions, context: safeContext});
        });
        win.loadFile(PRINT_HTML).catch((error) => finishFail(new MaterialPdfError('LOAD', causeText(error))));
      } catch (error) {
        finishFail(error instanceof MaterialPdfError ? error : new MaterialPdfError('LOAD', causeText(error)));
      }
    }));
  } catch (error) {
    /* Aborto/cancelamento tem prioridade sobre o erro colateral de destruir a
       janela (loadFile/promise rejeita com ERR_ABORTED). */
    if (state.error) throw state.error;
    throw error;
  }

  try {
    if (state.error) throw state.error;
    /* A página mediu depois das fontes: se uma fórmula não cabe nem no piso de
       9 pt, falha aqui — o printToPDF não é chamado. */
    if (state.overflows.length > 0) {
      const first = state.overflows[0];
      throw new MaterialPdfError('OVERFLOW', first.message || uiMsg('err.pdf.overflow'), {
        diagnostics: [...checked.diagnostics, ...state.diagnostics, ...state.overflows],
        blocking: state.overflows,
      });
    }
    const buffer = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      margins: {top: 0, bottom: 0, left: 0, right: 0},
      generateTaggedPDF: true,
      generateDocumentOutline: true,
    });
    if (state.error) throw state.error;
    if (Buffer.isBuffer(buffer) === false || buffer.length < 8 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new MaterialPdfError('EMPTY', uiMsg('err.pdf.invalidBytes'));
    }
    return {
      buffer,
      bytes: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      templateHash: checked.templateHash,
      diagnostics: [...checked.diagnostics, ...state.diagnostics],
      model: safeModel,
      options: safeOptions,
      ...(state.modelInfo || {columns: 1, columnsAuto: false, columnsLabel: '', fit: null}),
    };
  } catch (error) {
    if (state.error) throw state.error;
    if (error instanceof MaterialPdfError) throw error;
    throw new MaterialPdfError('PRINT', causeText(error));
  } finally {
    destroy();
  }
}

function assertTargetDir(dir) {
  if (!isAbsolute(dir)) fail('BAD_DIR', uiMsg('err.pdf.badDir'));
  let stats;
  try {
    stats = fs.lstatSync(dir);
  } catch {
    fail('BAD_DIR', uiMsg('err.pdf.dirMissing'));
  }
  if (stats.isSymbolicLink() || stats.isDirectory() === false) fail('BAD_DIR', uiMsg('err.pdf.badDir'));
  const real = fs.realpathSync(dir);
  if (fs.lstatSync(real).isDirectory() === false) fail('BAD_DIR', uiMsg('err.pdf.badDir'));
  return real;
}

function sanitizeStem(raw) {
  let text = String(raw ?? '').normalize('NFC')
    // eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-\s]+/, '')
    .replace(/[.\-\s]+$/, '');
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(text)) text = `_${text}`;
  const limit = Math.max(1, Number(core.maxName()) - 4);
  if (text.length > limit) text = text.slice(0, limit).replace(/[.\-\s]+$/, '');
  return text || 'Material';
}

/* Publica o temporário no nome final sem NUNCA sobrescrever: link exclusivo e,
   na falta dele, cópia exclusiva. Devolve false quando o nome foi tomado. */
function commitExclusive(temporary, target) {
  try {
    fs.linkSync(temporary, target);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    if (error.code !== 'EPERM' && error.code !== 'EXDEV') throw error;
  }
  try {
    fs.copyFileSync(temporary, target, fs.constants.COPYFILE_EXCL);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

function writeUniquePdf(dir, stem, buffer, expectedHash) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const name = core.candidateName(sanitizeStem(stem), '.pdf', toNat(attempt));
    const target = path.join(dir, name);
    if (fs.lstatSync(target, {throwIfNoEntry: false})) continue;
    const temporary = path.join(dir, `.save-${crypto.randomBytes(6).toString('hex')}.tmp`);
    let fd = null;
    try {
      fd = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(fd, buffer);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
    } catch (error) {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch { /* já foi */ }
      }
      try { fs.rmSync(temporary, {force: true}); } catch { /* já foi */ }
      throw new MaterialPdfError('WRITE', uiMsg('err.pdf.writeFail', {error: causeArg(error)}));
    }
    let committed;
    try {
      committed = commitExclusive(temporary, target);
    } catch (error) {
      throw new MaterialPdfError('WRITE', uiMsg('err.pdf.publishFail', {error: causeArg(error)}));
    } finally {
      try { fs.rmSync(temporary, {force: true}); } catch { /* já foi */ }
    }
    if (committed === false) continue;
    const stats = fs.statSync(target);
    if (stats.size !== buffer.length || sha256OfFile(target) !== expectedHash) {
      try { fs.rmSync(target, {force: true}); } catch { /* já foi */ }
      fail('VERIFY', uiMsg('err.pdf.verifyFail'));
    }
    return name;
  }
  fail('COLLISION', uiMsg('err.pdf.noFreeName'));
}

/** Monta e grava o PDF em `dir`, com um nome livre a partir de `stem`. @param {PdfRequest & {dir?: string, stem?: string}} [request] */
async function savePdf({dir, stem, title, markdown, model, options, context, timeoutMs, signal} = {}) {
  const targetDir = assertTargetDir(dir);
  const rendered = await renderPdf({title, markdown, model, options, context, timeoutMs, signal});
  const name = writeUniquePdf(targetDir, stem, rendered.buffer, rendered.sha256);
  return {
    name,
    path: path.join(targetDir, name),
    bytes: rendered.bytes,
    sha256: rendered.sha256,
    templateHash: rendered.templateHash,
    diagnostics: rendered.diagnostics,
    model: rendered.model,
    options: rendered.options,
    columns: rendered.columns,
    columnsAuto: rendered.columnsAuto,
    columnsLabel: rendered.columnsLabel,
    fit: rendered.fit,
  };
}

module.exports = {
  MaterialPdfError,
  available,
  isAvailable: available,
  checkMaterial,
  renderPdf,
  savePdf,
  sanitizeStem,
  MAX_MARKDOWN_CHARS,
  MAX_MARKDOWN_BYTES,
  MAX_TITLE_CHARS,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
};
