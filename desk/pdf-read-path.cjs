// @ts-check
'use strict';

/* O tutor pede um PDF pelo caminho que o modelo escreveu. `validPdf` compara
   a string exata da biblioteca: no macOS o disco guarda NFD e o modelo manda
   NFC ("Lógica"), e a leitura caía fora. Aqui a comparação passa por NFC, NFD
   e realpath. Um PDF real na mesma pasta de um PDF já autorizado também entra
   (a apostila irmã), com teto de tamanho e o realpath conferido para um
   symlink não escapar. Um caminho arbitrário continua recusado: quem escolhe
   o caminho é o modelo, não uma fala verificada do aluno. */

const fs = require('node:fs');
const path = require('node:path');
const {fileURLToPath} = require('node:url');

const MAX_BYTES = 80 * 1024 * 1024;
const PAGE_TAIL = /(?:\s+\(p\.\s*\d+\s*\)|#page=\d+)\s*$/i;

/**
 * O `read` nativo de PDF pede o poppler (`pdftoppm`). A frase é a mesma no
 * Claude e no Pi, com o nome da ferramenta daquele motor.
 * @param {string} tool
 * @returns {string}
 */
function pdfReadDenied(tool) {
  return `O read nativo não abre PDF aqui: ele pede o poppler, que a Mesa não usa. Use ${tool} com caminho, pagina e ate.`;
}

/* Query e fragmento (`?x=1`, `#page=3`) só existem num `file:` URL; num
   caminho do disco o `#` e o `?` fazem parte do nome ("Aula #3.pdf"). Quem
   chama `isPdfPath` pode entregar as duas formas. */
function pathTextOf(file) {
  const text = file.trim();
  if (!/^file:/i.test(text)) return text;
  try {
    return fileURLToPath(text);
  } catch {
    /* URL torta: o construtor já recusou; o `file:` não é nome de arquivo */
    return text.replace(/[?#].*$/, '');
  }
}

/**
 * @param {unknown} file
 * @returns {boolean}
 */
function isPdfPath(file) {
  if (typeof file !== 'string') return false;
  const clean = pathTextOf(file).replace(PAGE_TAIL, '').replace(/\\/g, '/');
  return clean.toLowerCase().endsWith('.pdf');
}

/**
 * Tira `file://`, `(p. N)` e `#page=N`, que o modelo cola no caminho.
 * @param {string} raw
 * @returns {string}
 */
function stripDecorations(raw) {
  return pathTextOf(raw).replace(PAGE_TAIL, '').trim();
}

/**
 * @param {string} platform
 * @returns {path.PlatformPath}
 */
function pathsOf(platform) {
  return platform === 'win32' ? path.win32 : path;
}

/**
 * @param {string} dir
 * @param {string} platform
 * @returns {string}
 */
function dirKey(dir, platform) {
  const normal = pathsOf(platform).normalize(dir);
  return platform === 'win32' ? normal.toLowerCase() : normal;
}

/**
 * @param {string} file
 * @returns {string}
 */
function readMagic(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(5);
    const n = fs.readSync(fd, buf, 0, 5, 0);
    return buf.subarray(0, n).toString('latin1');
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * @param {string} file
 * @param {(file: string) => string} read
 * @returns {boolean}
 */
function hasPdfMagic(file, read) {
  try {
    return read(file).startsWith('%PDF');
  } catch {
    return false;
  }
}

/**
 * @param {unknown} received
 * @returns {string}
 */
function refusal(received) {
  return `PDF recusado: recebi ${JSON.stringify(received)}. Esperado: um PDF da biblioteca da Mesa, ou um .pdf na mesma pasta de um PDF que a biblioteca já autorizou (caminho absoluto, sem (p. N) nem #page=). Para autorizar outro arquivo, abra-o na Mesa.`;
}

/**
 * @param {string} file
 * @param {(file: string) => {isFile: () => boolean, size: number}} stat
 * @param {(file: string) => string} read
 * @returns {string} vazio quando o arquivo pode ser lido
 */
function rejectReason(file, stat, read) {
  let info;
  try {
    info = stat(file);
  } catch (error) {
    const code = error && /** @type {{code?: string}} */ (error).code;
    return `Não abri o arquivo (${code || error.message}). Esperado: um .pdf existente de até 80 MB que comece com %PDF.`;
  }
  if (!info.isFile()) return 'Esperado: um arquivo, não uma pasta.';
  if (info.size < 5 || info.size > MAX_BYTES) return `O arquivo tem ${info.size} bytes. Esperado: entre 5 bytes e 80 MB.`;
  if (!hasPdfMagic(file, read)) return 'Esperado: o arquivo começar com %PDF.';
  return '';
}

/**
 * @param {Map<string, string>} keys
 * @param {string} file
 * @param {string} canonical
 */
function remember(keys, file, canonical) {
  keys.set(file, canonical);
  keys.set(file.normalize('NFC'), canonical);
  keys.set(file.normalize('NFD'), canonical);
}

/**
 * @param {Iterable<string>} allowed
 * @param {(file: string) => string} realpath
 * @param {string} platform
 * @returns {{keys: Map<string, string>, dirs: Set<string>}}
 */
function indexAllowed(allowed, realpath, platform, exact = []) {
  const keys = new Map();
  const dirs = new Set();
  const pathApi = pathsOf(platform);
  /* PDF solto no chat: vale ele, não a pasta. Soltar um arquivo de Downloads
     não libera o resto de Downloads para o modelo. */
  for (const entry of exact) {
    if (typeof entry !== 'string' || !entry) continue;
    remember(keys, entry, entry);
    const real = realpath(entry);
    if (real) remember(keys, real, real);
  }
  for (const entry of allowed) {
    if (typeof entry !== 'string' || !entry) continue;
    remember(keys, entry, entry);
    const real = realpath(entry);
    if (!real) continue;
    remember(keys, real, real);
    dirs.add(dirKey(pathApi.dirname(real), platform));
  }
  return {keys, dirs};
}

/**
 * @param {string} file
 * @param {(file: string) => string} realpath
 * @param {(file: string) => {isFile: () => boolean, size: number}} stat
 * @param {(file: string) => string} read
 * @returns {string}
 */
function openable(file, realpath, stat, read) {
  const real = realpath(file) || file;
  if (!isPdfPath(real) || rejectReason(real, stat, read)) return '';
  return real;
}

/**
 * Resolve o caminho que o tutor pediu para um arquivo que a Mesa pode ler.
 * Não altera a biblioteca. Não devolve outros caminhos dela.
 * @param {unknown} raw
 * @param {Iterable<string>} allowed caminhos já autorizados
 * @param {{platform?: string, exact?: Iterable<string>, realpath?: (file: string) => string, stat?: (file: string) => {isFile: () => boolean, size: number}, readMagic?: (file: string) => string}} [deps]
 *   `exact`: caminhos liberados só por inteiro (PDF solto no chat), sem a regra da pasta irmã
 * @returns {string} caminho real do arquivo
 * @example resolveTutorPdf('/c/Aula.pdf', ['/c/Aula.pdf'])
 */
function resolveTutorPdf(raw, allowed, deps = {}) {
  const platform = deps.platform || process.platform;
  const realpath = deps.realpath || ((file) => {
    try {
      return fs.realpathSync.native(file);
    } catch {
      return '';
    }
  });
  const stat = deps.stat || ((file) => fs.statSync(file));
  const read = deps.readMagic || readMagic;
  if (typeof raw !== 'string' || !raw.trim()) throw Error(refusal(raw));
  const stripped = stripDecorations(raw);
  const index = indexAllowed(allowed, realpath, platform, deps.exact ? [...deps.exact] : []);
  for (const form of [stripped, stripped.normalize('NFC'), stripped.normalize('NFD')]) {
    if (!index.keys.has(form)) continue;
    const opened = openable(index.keys.get(form), realpath, stat, read);
    if (opened) return opened;
  }
  const real = realpath(stripped);
  const pathApi = pathsOf(platform);
  if (real && isPdfPath(real) && index.dirs.has(dirKey(pathApi.dirname(real), platform))) {
    const why = rejectReason(real, stat, read);
    if (!why) return real;
    throw Error(`PDF recusado: recebi ${JSON.stringify(raw)}. ${why}`);
  }
  throw Error(refusal(raw));
}

module.exports = {resolveTutorPdf, isPdfPath, pdfReadDenied, stripDecorations, MAX_BYTES};
