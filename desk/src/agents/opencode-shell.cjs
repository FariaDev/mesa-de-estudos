// @ts-check
'use strict';

/* Onde está o `opencode` quando ele não está nos caminhos fixos (#102).

   O app aberto pelo Finder não herda o PATH do terminal: quem instalou o
   OpenCode por `bun` ou `npm` só o vê no PATH montado pelo rc do shell de
   login. Perguntamos ao shell da pessoa (`-ilc`), com prazo, e aceitamos só um
   arquivo executável de verdade. O rc pode imprimir qualquer coisa antes do
   comando; por isso o caminho vem entre marcadores. O Windows não tem shell de
   login (o comportamento de lá continua o dos caminhos fixos). */

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const SHELL_TIMEOUT_MS = 3000;
const MARKER = '__MESA_OPENCODE__';

/** @typedef {{found: string, key: string}} ShellCache */

/** @type {ShellCache|null} */
let cache = null;

/**
 * Um arquivo comum com permissão de execução.
 * @param {unknown} file
 * @returns {boolean}
 * @example isExecutableFile('/home/ana/.bun/bin/opencode') // true
 */
function isExecutableFile(file) {
  if (typeof file !== 'string' || !file) return false;
  try {
    if (!fs.statSync(file).isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch { return false; }
}

/**
 * O shell de login a perguntar: o da pessoa ou um dos padrões do sistema.
 * @param {{env?: NodeJS.ProcessEnv, isExecutable?: (file: unknown) => boolean}} [options]
 * @returns {string}
 * @example loginShellPath({env: {SHELL: '/bin/zsh'}}) // '/bin/zsh'
 */
function loginShellPath({env = process.env, isExecutable = isExecutableFile} = {}) {
  return [env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh']
    .find((file) => !!file && isExecutable(file)) || '';
}

/**
 * O stdout de um shell que roda o comando, ou vazio quando ele falha/trava.
 * @param {{shell: string, env: NodeJS.ProcessEnv, timeoutMs: number,
 *   spawnSyncProcess: typeof spawnSync}} input
 * @returns {string}
 */
function runLoginShell({shell, env, timeoutMs, spawnSyncProcess}) {
  /* `-ilc` e não `-lc`: o `bun` põe o PATH no rc interativo (`.zshrc`), que um
     shell de login não-interativo não lê. Sem tty, a maioria dos rc só fala do
     job control no stderr, que não é lido. */
  const script = `printf '\\n${MARKER}%s${MARKER}\\n' "$(command -v opencode 2>/dev/null)"`;
  try {
    const result = spawnSyncProcess(shell, ['-ilc', script], {
      encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL', env,
      windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!result || result.error) return '';
    return typeof result.stdout === 'string' ? result.stdout : '';
  } catch { return ''; }
}

/**
 * O caminho entre os marcadores, quando ele é absoluto.
 * @param {string} output
 * @returns {string}
 * @example markedPath('rc falou\n__MESA_OPENCODE__/bin/opencode__\n') // '/bin/opencode'
 */
function markedPath(output) {
  const match = new RegExp(`${MARKER}([^\\n]*)${MARKER}`).exec(output);
  const candidate = match ? match[1].trim() : '';
  return candidate && path.isAbsolute(candidate) ? candidate : '';
}

/**
 * Pergunta ao shell de login onde está o `opencode`. Devolve `''` quando o
 * shell trava (prazo), imprime lixo sem o marcador, ou aponta um caminho que
 * não é um executável. A pergunta é síncrona e segura o processo principal, e
 * a detecção roda a cada sessão montada: por isso "não achei" vale até reabrir o
 * app. Escolher o caminho à mão não depende disto, porque `opencodePath` vem antes.
 * @param {{shellPath?: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform,
 *   timeoutMs?: number, spawnSyncProcess?: typeof spawnSync,
 *   isExecutable?: (file: unknown) => boolean}} [options]
 *   `shellPath` ausente usa o shell da pessoa; `''` desliga a pergunta.
 * @returns {string}
 * @example findOpenCodeInLoginShell({shellPath: '/bin/zsh'}) // '/home/ana/.bun/bin/opencode'
 */
function findOpenCodeInLoginShell({shellPath, env = process.env, platform = process.platform,
  timeoutMs = SHELL_TIMEOUT_MS, spawnSyncProcess = spawnSync,
  isExecutable = isExecutableFile} = {}) {
  if (platform === 'win32') return '';
  const shell = shellPath === undefined ? loginShellPath({env, isExecutable}) : shellPath;
  if (!shell) return '';
  const key = JSON.stringify([shell, env.PATH || '', platform, timeoutMs]);
  if (cache && cache.key === key) {
    if (cache.found && isExecutable(cache.found)) return cache.found;
    if (!cache.found) return '';
  }
  const candidate = markedPath(runLoginShell({shell, env, timeoutMs, spawnSyncProcess}));
  const found = isExecutable(candidate) ? candidate : '';
  cache = {found, key};
  return found;
}

/** Esquece o resultado guardado; só os testes precisam disso. */
function resetOpenCodeShellCache() {
  cache = null;
}

module.exports = {SHELL_TIMEOUT_MS, findOpenCodeInLoginShell, isExecutableFile, loginShellPath, resetOpenCodeShellCache};
