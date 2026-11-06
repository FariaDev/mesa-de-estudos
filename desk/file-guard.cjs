'use strict';

/* Guarda `file:` da sessão (rodada 2026-11): nega por padrão e aceita só os
   arquivos estáticos do app. Pura, testável sem Electron (`session-file-guard`).
   Uma responsabilidade: decidir `file:`. O runtime (`activity-runtime.cjs`)
   só a aplica na sessão. */

const fs = require('node:fs');
const path = require('node:path');

/* Caminho de um `file:` como o sistema o vê, ou `null` se não dá para dizer.
   `fileURLToPath` resolve `%20`, barra e letra de unidade; asar passa direto
   (`/a/app.asar/desk/x` continua sob `/a/app.asar`). Fora do Windows o
   `fileURLToPath` devolve `/C:/…` para URL de unidade: tira a barra inicial
   para a comparação sem caixa valer igual nos testes puros. */
function filePathForUrl(url) {
  try {
    const {fileURLToPath} = require('node:url');
    const resolved = fileURLToPath(String(url));
    return resolved.replace(/^\/([a-zA-Z]:[\\/])/, '$1');
  } catch { return null; }
}

/* `file:` sem diferenciar caixa: o Chromium normaliza o esquema para
   minúsculo antes do `webRequest`, e `FILE:///etc/passwd` entrava como
   `nao-file` na função pura. */
function isFileUrl(url) {
  return String(url || '').slice(0, 5).toLowerCase() === 'file:';
}

/* Caminho resolvido quando existe (symlink sai): `/tmp/liga` que aponta
   para fora da raiz não herda o `sob-raiz` do elo. Em asar empacotado o
   `realpathSync` pode não resolver (`/x/app.asar/y` não é pasta de verdade
   fora do Electron): sem resolver, compara o léxico, sem falhar. */
function resolveExisting(target) {
  try {
    if (target && fs.existsSync(target)) return fs.realpathSync(target);
  } catch { /* sem resolver: vale o léxico */ }
  return target;
}

/* `filePath` está sob `root`? Compara sem caixa (no Windows a unidade e as
   pastas não distinguem; na função pura, sempre — o Chromium já normalizou)
   e com separador (sem prefixo solto: `/app-evil/x` não é `/app`). Asar,
   macOS e Linux caem no mesmo `startsWith` depois do normalize. */
function isPathUnderRoot(filePath, appRoot) {
  const rawFile = String(filePath || '');
  const rawRoot = String(appRoot || '');
  if (!rawFile || !rawRoot) return false;
  const looksWin = /^[a-zA-Z]:[\\/]/.test(rawFile) || /^[a-zA-Z]:[\\/]/.test(rawRoot)
    || (rawFile.includes('\\') && rawRoot.includes('\\'));
  const mod = looksWin ? path.win32 : path.posix;
  const norm = (value) => {
    let out = String(value);
    if (looksWin) out = out.replace(/\//g, '\\');
    else out = out.replace(/\\/g, '/');
    out = mod.normalize(out);
    return out.toLowerCase();
  };
  const file = norm(rawFile);
  let root = norm(rawRoot);
  const sep = looksWin ? '\\' : '/';
  while (root.length > 1 && root.endsWith(sep)) root = root.slice(0, -1);
  if (file === root) return true;
  return file.startsWith(root + sep);
}

/* Arquivos estáticos que a janela principal carrega por `file:` (medido em
   janela: `src/`, `assets/`, `node_modules/` e os soltos da raiz que o
   `index.html` puxa). Negar por padrão e aceitar só estes saiu tão simples
   quanto negar só o runtime — então vale a lista fechada: aluno nenhum mora
   aqui, e dado novo fora daqui já nasce negado. */
const STATIC_DIRS = ['src', 'assets', 'node_modules'];
const STATIC_FILES = ['index.html', 'preload.cjs', 'renderer.mjs', 'style.css', 'text.mjs', 'icons.mjs', 'highlight.mjs', 'calculator.mjs'];

/**
 * Entradas estáticas do app para a guarda `file:`.
 * @param {string} appRoot pasta do app (`__dirname` do main)
 * @returns {{dirs: string[], files: string[]}}
 * @example staticAppEntries('/app/desk').dirs // ['/app/desk/src', …]
 */
function staticAppEntries(appRoot) {
  const root = String(appRoot || '');
  return {
    dirs: STATIC_DIRS.map((dir) => path.join(root, dir)),
    files: STATIC_FILES.map((file) => path.join(root, file)),
  };
}

/**
 * Defesa de sessão para `file:` (pura, testável sem Electron): nega por
 * padrão e aceita só os arquivos estáticos do app. Documento principal
 * (`mainFrame`) segue. O runtime da instância (inclusive personalizado) e
 * os dados do aluno (`dataRoots`: cursos, cofre) são negados mesmo sob a
 * raiz do app (`desk/.runtime` mora sob ela). Sem raiz conhecida, falha
 * fechada. Symlink resolve quando o caminho existe; asar empacotado compara
 * o léxico (`app.asar` e `app.asar.unpacked` valem como raiz).
 * @param {{url: string, resourceType?: string, appRoot?: string|null, runtimeRoot?: string|null, dataRoots?: string[]|(() => string[]), staticEntries?: {dirs: string[], files: string[]}|null}} input
 * @returns {{cancel: boolean, reason: string}}
 * @example fileSubresourceBlocked({url: 'file:///app/desk/src/x.mjs', resourceType: 'image', appRoot: '/app/desk'}) // {cancel:false,…}
 * @example fileSubresourceBlocked({url: 'file:///tmp/x.png', resourceType: 'image', appRoot: '/app/desk'}).cancel // true
 */
function fileSubresourceBlocked({url, resourceType = '', appRoot = null, runtimeRoot = null, dataRoots = [], staticEntries = null} = {}) {
  const target = String(url || '');
  if (!isFileUrl(target)) return {cancel: false, reason: 'nao-file'};
  if (String(resourceType) === 'mainFrame') return {cancel: false, reason: 'documento'};
  const filePath = filePathForUrl(target);
  if (filePath === null) return {cancel: true, reason: 'url-ilegivel'};
  const file = resolveExisting(filePath);
  const rootsOf = (roots) => (typeof roots === 'function' ? roots() : roots || []);
  if (runtimeRoot && isPathUnderRoot(file, resolveExisting(runtimeRoot))) return {cancel: true, reason: 'runtime'};
  for (const root of rootsOf(dataRoots)) {
    if (root && isPathUnderRoot(file, resolveExisting(root))) return {cancel: true, reason: 'dados'};
  }
  const entries = staticEntries || (appRoot ? staticAppEntries(appRoot) : null);
  if (!entries) return {cancel: true, reason: 'sem-raiz'};
  const sameFile = (left, right) => isPathUnderRoot(left, right) && isPathUnderRoot(right, left);
  const dirs = entries.dirs.map(resolveExisting);
  if (dirs.some((dir) => isPathUnderRoot(file, dir))) return {cancel: false, reason: 'sob-estatico'};
  if (entries.files.map(resolveExisting).some((entry) => sameFile(file, entry))) return {cancel: false, reason: 'sob-estatico'};
  if (appRoot && isPathUnderRoot(file, resolveExisting(appRoot))) return {cancel: true, reason: 'fora-dos-estaticos'};
  return {cancel: true, reason: 'fora-do-app'};
}

/**
 * Opções da guarda para as sessões do main (janela principal e prévia):
 * nega por padrão, aceita os estáticos; runtime e dados do aluno negados.
 * `live` é o estado vivo (`live.config.vaultPath`, `live.courses[].path`):
 * função porque cursos/cofre mudam no `save-config` depois da instalação.
 * @param {{appRoot: string, runtimeRoot?: string|null, live?: {config?: {vaultPath?: string}, courses?: {path?: string}[]}|null, dataRoots?: string[]|(() => string[])}} input
 * @returns {{appRoot: string, runtimeRoot: string|null, dataRoots: () => string[]}}
 * @example fileGuardOptions({appRoot: '/app/desk', runtimeRoot: '/tmp/rt', live: null}).appRoot // '/app/desk'
 */
function fileGuardOptions({appRoot, runtimeRoot = null, live = null, dataRoots = null} = {}) {
  return {
    appRoot: String(appRoot || ''),
    runtimeRoot: typeof runtimeRoot === 'string' && runtimeRoot ? runtimeRoot : null,
    dataRoots: dataRoots !== null && dataRoots !== undefined ? dataRoots : () => [
      ...(typeof live?.config?.vaultPath === 'string' && live.config.vaultPath ? [live.config.vaultPath] : []),
      ...(Array.isArray(live?.courses) ? live.courses : []).map((course) => course && course.path).filter((entry) => typeof entry === 'string' && entry),
    ],
  };
}

module.exports = {
  filePathForUrl,
  isFileUrl,
  isPathUnderRoot,
  staticAppEntries,
  fileSubresourceBlocked,
  fileGuardOptions,
};
