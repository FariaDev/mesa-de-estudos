// @ts-check
'use strict';

/* Dono do `opencode serve` da Mesa (#57): UM servidor por app, que a Mesa sobe
   na primeira conversa OpenCode, reaproveita nas seguintes e encerra ao sair.

   - Partida: `sweepAtBoot()` recolhe só o servidor que o ledger do runtime
     registrou (ver `opencode-orphans.cjs`); nunca procura por nome.
   - A chave do Zen entra no ambiente do filho na hora de subir. Trocar ou
     remover a chave muda a impressão digital (sha256, só na memória) e o
     próximo `acquire()` sobe outro servidor; a chave nunca vai para log.
   - Servidor que caiu sozinho é trocado no próximo `acquire()`.
   - Tudo de fora entra por parâmetro (`start`, `sweep`, `findBinary`, `keyEnv`):
     o teste usa o `fake-opencode.mjs` e não abre o binário real. */

const crypto = require('node:crypto');
const {startOpenCodeServer} = require('./opencode-process.cjs');
const {sweepOrphans} = require('./opencode-orphans.cjs');
const {message} = require('../i18n.mjs');

/**
 * @typedef {import('./opencode-process.cjs').OpenCodeServer} OpenCodeServer
 * @typedef {{baseUrl: string, password: string, binary: string}} ServeLease
 */

/** @param {Record<string, string>} env @returns {string} */
function fingerprint(env) {
  return crypto.createHash('sha256').update(String(env.OPENCODE_API_KEY || '')).digest('hex');
}

/**
 * Cria o dono do servidor.
 * @param {{findBinary: () => string, keyEnv: () => Record<string, string>, baseEnv?: () => Record<string, string|undefined>,
 *   cwd: string, ledgerDir: string, log?: (area: string, line: string) => void,
 *   start?: typeof startOpenCodeServer, sweep?: typeof sweepOrphans}} deps
 * @example const owner = createServeOwner({findBinary, keyEnv: () => opencodeHost.keyEnv(), cwd, ledgerDir: runtime});
 */
function createServeOwner({findBinary, keyEnv, baseEnv = () => process.env, cwd, ledgerDir, log = () => {}, start = startOpenCodeServer, sweep = sweepOrphans}) {
  /** @type {OpenCodeServer|null} */
  let server = null;
  let serverPrint = '';
  /** @type {Promise<ServeLease>|null} */
  let starting = null;

  function stop() {
    const current = server;
    server = null;
    serverPrint = '';
    try { current?.stop(); } catch (error) { log('opencode', `servidor não encerrado: ${error.message}`); }
  }

  async function launch(binary, keys, print) {
    stop();
    const next = await start({binary, cwd, ledgerDir, log, env: {...baseEnv(), ...keys}});
    server = next;
    serverPrint = print;
    next.onExit((code) => {
      if (server !== next) return;
      server = null;
      log('opencode', `servidor saiu sozinho (código ${code}); o próximo envio sobe outro`);
    });
    log('opencode', `servidor da Mesa em ${next.baseUrl} (pid ${next.pid})`);
    return {baseUrl: next.baseUrl, password: next.password, binary: next.binary};
  }

  /**
   * O servidor vivo com a chave de agora; sobe ou troca se preciso.
   * @returns {Promise<ServeLease>}
   */
  function acquire() {
    if (starting) return starting;
    const keys = keyEnv();
    const print = fingerprint(keys);
    if (server && serverPrint === print) return Promise.resolve({baseUrl: server.baseUrl, password: server.password, binary: server.binary});
    const binary = findBinary();
    if (!binary) return Promise.reject(Error(message('err.opencode.notFound')));
    starting = launch(binary, keys, print).finally(() => { starting = null; });
    return starting;
  }

  /** Recolhe o servidor de uma queda anterior; chamar uma vez na partida. */
  function sweepAtBoot() {
    try {
      const result = sweep({dir: ledgerDir});
      for (const item of result.killed) log('opencode', `servidor órfão da Mesa recolhido (pid ${item.pid})`);
      for (const item of result.skipped) log('opencode', `registro velho descartado (pid ${item.pid}: ${item.reason})`);
      return result;
    } catch (error) {
      log('opencode', `recolha de órfãos falhou: ${error.message}`);
      return {killed: [], skipped: [], entry: null};
    }
  }

  return {acquire, stop, sweepAtBoot, running: () => server !== null, binary: () => findBinary()};
}

module.exports = {createServeOwner};
