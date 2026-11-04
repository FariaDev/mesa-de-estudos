// @ts-check
'use strict';

/* Casca da instalação do OpenCode no main (#release OpenCode). A execução
   (rede, npm, tar, cópia atômica, versão) mora em
   `src/agents/opencode-install.cjs`; aqui ficam o IPC, o aviso de progresso
   para a janela, a trava de uma instalação por vez e a detecção refeita no
   fim. Testes injetam `install`, `supported` e `detect`; o fixture nomeado só
   é lido com `testMode`, como os outros fixtures do repositório. */

const path = require('node:path');
const {message} = require('./src/i18n.mjs');
const {installOpenCode, openCodeInstallSupported} = require('./src/agents/opencode-install.cjs');

/** @typedef {{ok: true, binary: string, version: string, detected?: object}|{ok: false, code: string, message: string}} InstallResult */

/** @param {string} file @returns {null|((options: object) => Promise<object>)} */
function fixtureInstaller(file) {
  if (!file) return null;
  try {
    const module = require(path.resolve(file));
    return typeof module.install === 'function' ? module.install : null;
  } catch { return null; }
}

/**
 * Registra `opencode-install` e `opencode-install-supported`. A segunda chamada
 * concorrente recebe a MESMA promessa: nada roda duas vezes em paralelo.
 * @param {{ipcMain: import('electron').IpcMain, win: () => import('electron').BrowserWindow|null|undefined,
 *   home?: string, env?: NodeJS.ProcessEnv, testMode?: boolean,
 *   log?: (area: string, line: string) => void,
 *   install?: (options: object) => Promise<{ok: true, binary: string, version: string}>,
 *   supported?: () => boolean,
 *   detect?: () => Record<string, unknown>}} input
 * @returns {{install: () => Promise<InstallResult>, supported: () => boolean, busy: () => boolean}}
 * @example const host = createOpenCodeInstallHost({ipcMain, win: () => win});
 */
function createOpenCodeInstallHost({ipcMain, win, home = require('node:os').homedir(), env = process.env, testMode = false, log = () => {}, install, supported, detect = () => ({})}) {
  const fixture = testMode ? fixtureInstaller(env.LEARNING_DESK_OPENCODE_INSTALL_FIXTURE) : null;
  const runInstall = install || fixture || installOpenCode;
  const isSupported = supported || (() => openCodeInstallSupported({platform: process.platform, arch: process.arch}));
  let current = null;

  const sendProgress = (payload) => {
    const window = win();
    if (!window || window.isDestroyed?.()) return;
    try { window.webContents.send('opencode-install-progress', payload); } catch { /* janela fechando */ }
  };

  const start = () => {
    if (current) return current;
    sendProgress({phase: 'prepare', percent: -1});
    current = Promise.resolve()
      .then(() => runInstall({home, onProgress: sendProgress}))
      .then((result) => ({...result, detected: detect()}))
      .catch((error) => {
        const code = typeof error?.code === 'string' ? error.code : 'failed';
        const text = typeof error?.message === 'string' && error.message ? error.message : message('err.opencode.install.failed');
        log('opencode-install', `${code}: ${String(error?.cause?.message || error?.cause || text)}`);
        return {ok: false, code, message: text};
      })
      .finally(() => { current = null; });
    return current;
  };

  ipcMain.handle('opencode-install', () => start());
  ipcMain.handle('opencode-install-supported', () => isSupported());
  return {install: start, supported: isSupported, busy: () => !!current};
}

module.exports = {createOpenCodeInstallHost, fixtureInstaller};
