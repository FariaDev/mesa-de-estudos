'use strict';

/* Serviço de PDF de material (aba Livre): Markdown+LaTeX viram um PDF DE VERDADE
   pelo `printToPDF` do Electron, com a MESMA função `markup` do chat
   (`desk/src/markdown.mjs`) e `allowAssets=false` — figura/asset local vira
   código, nada é buscado na rede. A página de impressão é local, sandbox,
   contextIsolation e CSP fechada; o payload do renderer nunca é injetado como
   script nem vira caminho de arquivo.

   Contrato:
     available()                                  true sob Electron
     renderPdf({title, markdown, timeoutMs, signal})
                                                  {buffer, bytes, sha256}
     savePdf({dir, stem, title, markdown, timeoutMs, signal})
                                                  {name, path, bytes, sha256}
     MaterialPdfError (code: NO_ELECTRON, BAD_PAYLOAD, BAD_DIR, TOO_BIG, LOAD,
     PAGE, GONE, TIMEOUT, ABORTED, PRINT, EMPTY, COLLISION, VERIFY, WRITE)

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
const {fileURLToPath} = require('node:url');
const core = require('./src/generated/freeworkspaces.core.js').default;

const PRINT_DIR = path.join(__dirname, 'src', 'materials');
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
   `markdown.mjs` importa (`../highlight.mjs`) sem abrir a raiz toda. */
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

async function renderPdf({title = '', markdown = '', timeoutMs, signal} = {}) {
  if (typeof markdown !== 'string') fail('BAD_PAYLOAD', 'conteúdo do PDF precisa ser texto Markdown');
  if (markdown.trim() === '') fail('BAD_PAYLOAD', 'conteúdo do PDF está vazio');
  if (markdown.length > MAX_MARKDOWN_CHARS) fail('TOO_BIG', 'conteúdo do PDF acima do teto');
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) fail('TOO_BIG', 'conteúdo do PDF acima do teto');
  if (signal !== undefined && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function')) {
    fail('BAD_PAYLOAD', 'sinal de cancelamento inválido');
  }
  const safeTitle = String(title ?? '').slice(0, MAX_TITLE_CHARS);
  const electron = loadElectron();
  if (!electron) fail('NO_ELECTRON', 'geração de PDF só funciona dentro do aplicativo');
  const {BrowserWindow, ipcMain} = electron;
  if (fs.existsSync(PRINT_HTML) === false || fs.existsSync(PRINT_PRELOAD) === false) {
    fail('LOAD', 'página de impressão do app não encontrada');
  }

  const token = crypto.randomBytes(12).toString('hex');
  const budget = normalizeTimeout(timeoutMs);
  const state = {error: null, timer: null, done: false};
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
  const onAbort = () => abortWith(new MaterialPdfError('ABORTED', 'geração de PDF cancelada'));

  try {
    await new Promise((resolve, reject) => {
      const finishFail = (error) => {
        abortWith(error);
        reject(state.error);
      };
      onDone = (_event, payload) => {
        if (!payload || payload.token !== token) return;
        if (payload.ok === true) {
          state.done = true;
          stopWaiting();
          resolve();
          return;
        }
        finishFail(new MaterialPdfError('PAGE', String(payload.message || 'falha ao renderizar o PDF')));
      };
      ipcMain.on(DONE_CHANNEL, onDone);
      if (signal) {
        if (signal.aborted) {
          finishFail(new MaterialPdfError('ABORTED', 'geração de PDF cancelada'));
          return;
        }
        signal.addEventListener('abort', onAbort, {once: true});
      }
      /* O mesmo orçamento cobre a página e o printToPDF: se a página ficou
         pronta mas o print travou, o timer destrói a janela e a operação falha
         sem gravar nada. */
      state.timer = setTimeout(() => {
        const error = new MaterialPdfError('TIMEOUT', 'o PDF demorou demais para ser gerado');
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
          if (isMainFrame) finishFail(new MaterialPdfError('LOAD', `página de impressão não carregou (${code} ${description})`));
        });
        win.webContents.on('render-process-gone', () => finishFail(new MaterialPdfError('GONE', 'o renderizador do PDF caiu')));
        win.webContents.on('preload-error', (_event, _preloadPath, error) => {
          finishFail(new MaterialPdfError('LOAD', `o preload da página de impressão falhou: ${String(error?.message || error)}`));
        });
        win.webContents.on('did-finish-load', () => {
          if (state.error) return;
          win.webContents.send(RENDER_CHANNEL, {token, title: safeTitle, markdown});
        });
        win.loadFile(PRINT_HTML).catch((error) => finishFail(new MaterialPdfError('LOAD', String(error?.message || error))));
      } catch (error) {
        finishFail(error instanceof MaterialPdfError ? error : new MaterialPdfError('LOAD', String(error?.message || error)));
      }
    });
  } catch (error) {
    /* Aborto/cancelamento tem prioridade sobre o erro colateral de destruir a
       janela (loadFile/promise rejeita com ERR_ABORTED). */
    if (state.error) throw state.error;
    throw error;
  }

  try {
    if (state.error) throw state.error;
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
      throw new MaterialPdfError('EMPTY', 'o aplicativo não devolveu um PDF válido');
    }
    return {buffer, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex')};
  } catch (error) {
    if (state.error) throw state.error;
    if (error instanceof MaterialPdfError) throw error;
    throw new MaterialPdfError('PRINT', String(error?.message || error));
  } finally {
    destroy();
  }
}

function assertTargetDir(dir) {
  if (!isAbsolute(dir)) fail('BAD_DIR', 'pasta de destino do PDF inválida');
  let stats;
  try {
    stats = fs.lstatSync(dir);
  } catch {
    fail('BAD_DIR', 'pasta de destino do PDF não existe');
  }
  if (stats.isSymbolicLink() || stats.isDirectory() === false) fail('BAD_DIR', 'pasta de destino do PDF inválida');
  const real = fs.realpathSync(dir);
  if (fs.lstatSync(real).isDirectory() === false) fail('BAD_DIR', 'pasta de destino do PDF inválida');
  return real;
}

function sanitizeStem(raw) {
  let text = String(raw ?? '').normalize('NFC')
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
    const name = core.candidateName(sanitizeStem(stem), '.pdf', BigInt(attempt));
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
      throw new MaterialPdfError('WRITE', `não foi possível gravar o PDF: ${error.message}`);
    }
    let committed = false;
    try {
      committed = commitExclusive(temporary, target);
    } catch (error) {
      throw new MaterialPdfError('WRITE', `não foi possível publicar o PDF: ${error.message}`);
    } finally {
      try { fs.rmSync(temporary, {force: true}); } catch { /* já foi */ }
    }
    if (committed === false) continue;
    const stats = fs.statSync(target);
    if (stats.size !== buffer.length || sha256OfFile(target) !== expectedHash) {
      try { fs.rmSync(target, {force: true}); } catch { /* já foi */ }
      fail('VERIFY', 'o PDF gravado não confere com os bytes gerados');
    }
    return name;
  }
  fail('COLLISION', 'não foi possível achar um nome livre para o PDF');
}

async function savePdf({dir, stem, title, markdown, timeoutMs, signal} = {}) {
  const targetDir = assertTargetDir(dir);
  const rendered = await renderPdf({title, markdown, timeoutMs, signal});
  const name = writeUniquePdf(targetDir, stem, rendered.buffer, rendered.sha256);
  return {
    name,
    path: path.join(targetDir, name),
    bytes: rendered.bytes,
    sha256: rendered.sha256,
  };
}

module.exports = {
  MaterialPdfError,
  available,
  isAvailable: available,
  renderPdf,
  savePdf,
  sanitizeStem,
  MAX_MARKDOWN_CHARS,
  MAX_MARKDOWN_BYTES,
  MAX_TITLE_CHARS,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
};
