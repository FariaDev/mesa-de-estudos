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
const fs = require('node:fs');
const {startOpenCodeServer} = require('./opencode-process.cjs');
const {sweepOrphans} = require('./opencode-orphans.cjs');
const {message} = require('../i18n.mjs');

/**
 * @typedef {import('./opencode-process.cjs').OpenCodeServer} OpenCodeServer
 * @typedef {{baseUrl: string, password: string, binary: string, pid?: number}} ServeLease
 */

/** @param {Record<string, string>} env @returns {string} */
function fingerprint(env) {
  return crypto.createHash('sha256').update(String(env.OPENCODE_API_KEY || '')).digest('hex');
}

/**
 * Cria o dono do servidor.
 * @param {{findBinary: () => string, keyEnv: () => Record<string, string> | Promise<Record<string, string>>, baseEnv?: () => Record<string, string|undefined>,
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
  /** @type {Promise<ServeLease>|null} */
  let authStarting = null;
  /** @type {AbortController|null} */
  let startController = null;
  /* Época da subida (só cresce): `stop()` e o cancelamento total invalidam a
     época, e o `launch` só publica o servidor se a época ainda for a dele. Se o
     `start` resolve depois da época ter mudado (sinal chegou depois do spawn ou
     o `start` não honra o abort), o recém-nascido é parado na hora em vez de
     ficar vivo sem dono. */
  let launchGeneration = 0;
  /* Quem espera a subida: cada `acquire()` ganha um lugar nesta lista. Como a
     subida é dividida (principal + lateral + rascunho), cancelar é desistir do
     PRÓPRIO lugar — a subida só aborta quando ninguém mais espera (#57). */
  /** @type {{seat?: object, resolve: (lease: ServeLease) => void, reject: (error: unknown) => void, settled: boolean}[]} */
  let waiters = [];

  /* Cancelar desiste da subida em nome de quem pediu (`seat`, um por adaptador):
     uma conversa já ligada ou a que chegou primeiro não pode derrubar a espera
     da outra. O servidor já pronto continua para todas. */
  function cancelStarting(seat) {
    const mine = waiters.filter((entry) => entry.seat === seat);
    waiters = waiters.filter((entry) => entry.seat !== seat);
    for (const entry of mine) {
      entry.settled = true;
      entry.reject(notSent(Error(message('tutor.error.cancelled'))));
    }
    if (waiters.length === 0) { try { startController?.abort(); } catch { /* já cancelado */ } }
    /* Cancelamento total invalida a época: o `launch` em voo (só o da chave —
       a entrada por provedor tem dono próprio no `acquireAuth`) não publica o
       servidor tardio. Sem ninguém esperando, `ensureStarting` também recusa
       subir de novo (#57). */
    if (waiters.length === 0 && !authStarting) launchGeneration += 1;
  }

  async function closeServer() {
    const current = server;
    server = null;
    serverPrint = '';
    try { await current?.stop(); } catch (error) { log('opencode', `servidor não encerrado: ${error.message}`); }
  }

  async function stop() {
    /* A saída derruba tudo: cada espera rejeita como cancelada e a subida
       aborta, em vez de desistir de um lugar só. A época muda para o `launch`
       em voo não publicar o servidor tardio. */
    launchGeneration += 1;
    const pending = waiters;
    waiters = [];
    for (const entry of pending) {
      if (entry.settled) continue;
      entry.settled = true;
      entry.reject(notSent(Error(message('tutor.error.cancelled'))));
    }
    try { startController?.abort(); } catch { /* já cancelado */ }
    /* Só volta depois do exit real (ou do teto do stop); o `before-quit`
       espera para o serve não ficar órfão (#105). */
    await closeServer();
  }

  async function launch(binary, keys, print, signal = null, generation = launchGeneration) {
    /* Só a subida corrente publica: `stop()` ou o cancelamento total avançam a
       época no meio do caminho, e o `start` tardio (sinal chegou depois do
       spawn ou o `start` não honra o abort) é parado na hora em vez de ficar
       vivo sem dono. A troca de chave passa pela mesma conferência: o
       `closeServer` acima para o antigo, e só esta subida publica o novo. */
    await closeServer();
    try { fs.mkdirSync(cwd, {recursive: true}); } catch (error) { log('opencode', `pasta de trabalho não criada: ${error.message}`); }
    const next = await start({binary, cwd, ledgerDir, log, env: {...baseEnv(), ...keys}, signal});
    /* Época mudou enquanto o `start` estava em voo (`stop()` ou cancelamento
       total com ninguém esperando): o recém-nascido não tem dono, então para
       na hora em vez de ficar vivo sem `stop()`. */
    if (generation !== launchGeneration) {
      try { await next?.stop(); } catch (error) { log('opencode', `servidor tardio não encerrado: ${error.message}`); }
      throw notSent(Error(message('tutor.error.cancelled')));
    }
    server = next;
    serverPrint = print;
    next.onExit((code) => {
      if (server !== next) return;
      server = null;
      log('opencode', `servidor saiu sozinho (código ${code}); o próximo envio sobe outro`);
    });
    log('opencode', `servidor da Mesa em ${next.baseUrl} (pid ${next.pid})`);
    return {baseUrl: next.baseUrl, password: next.password, binary: next.binary, pid: next.pid};
  }

  /**
   * O servidor vivo com a chave de agora; sobe ou troca se preciso.
   * @returns {Promise<ServeLease>}
   */
  /* Falha antes de o servidor existir: nada foi escrito no motor, então a
     entrega pode ser repetida (o cartão mostra Reenviar; a fila devolve o
     item). Sem esta marca o envio virava "incerto" e a mensagem ficava presa
     em Enviando (#92/#57 na migração dos testes). */
  /** @param {unknown} error */
  function notSent(error) {
    if (error && typeof error === 'object') /** @type {{notSent?: boolean}} */ (error).notSent = true;
    return error;
  }

  async function acquireReady() {
    /* Época capturada no ponto de decisão (antes de qualquer `await`): só esta
       subida pode publicar o servidor; `stop()` ou cancelamento total no meio
       do caminho avançam a época e invalidam o tardio. A subida dividida usa a
       mesma época para todos os lugares: cancelar um lugar só (ainda há quem
       espere) não invalida, só o cancelamento total com ninguém esperando. */
    const generation = launchGeneration;
    const controller = new AbortController();
    startController = controller;
    try {
      const keys = await keyEnv();
      const print = fingerprint(keys);
      if (server && serverPrint === print) return {baseUrl: server.baseUrl, password: server.password, binary: server.binary, pid: server.pid};
      const binary = findBinary();
      if (!binary) {
        /* A tela não mostra caminho nem variável; o log guarda o que foi procurado. */
        log('opencode', 'binário não encontrado; procurei LEARNING_DESK_OPENCODE, ~/.opencode/bin/opencode e o PATH');
        throw notSent(Error(message('err.opencode.notFound')));
      }
      return await launch(binary, keys, print, controller.signal, generation);
    } catch (error) {
      throw notSent(error);
    } finally {
      if (startController === controller) startController = null;
    }
  }

  /** @param {object} [seat] quem espera: `cancelStarting(seat)` desiste só deste lugar */
  function acquire(seat) {
    /* Cada chamada ganha o seu lugar na espera, mas a subida é uma só: duas
       chamadas juntas dividem o mesmo `starting` mesmo com a chave vindo do
       cofre assíncrono. Quem cancela rejeita só o próprio lugar (#57). */
    /** @type {{seat?: object, resolve: (lease: ServeLease) => void, reject: (error: unknown) => void, settled: boolean}|null} */
    let entry = null;
    const waiting = new Promise((resolve, reject) => { entry = {seat, resolve, reject, settled: false}; });
    waiters.push(/** @type {NonNullable<typeof entry>} */ (entry));
    ensureStarting().catch(() => {});
    /* O `catch` acima segura a subida órfã (ninguém mais esperando): cada
       lugar recebe o seu desfecho pela lista, nunca pela subida dividida. */
    return waiting;
  }

  function ensureStarting() {
    if (starting) return starting;
    /* `starting` é marcado antes do primeiro await: duas chamadas juntas
       dividem a mesma subida mesmo com a chave vindo do cofre assíncrono. */
    /* Espera a subida da entrada por provedor: duas subidas em paralelo deixariam
       a primeira sem dono, porque `launch` só para o servidor já registrado. */
    /* Quem desistiu enquanto a entrada subia não dispara subida nova: sem
       ninguém esperando, o encadeamento rejeita como cancelado (#57). */
    const afterAuth = authStarting ? authStarting.catch(() => {}) : Promise.resolve();
    starting = afterAuth.then(() => {
      if (waiters.length === 0) throw notSent(Error(message('tutor.error.cancelled')));
      return acquireReady();
    }).then(
      (lease) => { settleWaiters(null, lease); return lease; },
      (error) => { settleWaiters(error, null); throw error; },
    );
    return starting;
  }

  /** Entrega o desfecho da subida a cada lugar ainda esperando. @param {unknown} error @param {ServeLease|null} lease */
  function settleWaiters(error, lease) {
    const pending = waiters;
    waiters = [];
    starting = null;
    for (const entry of pending) {
      if (entry.settled) continue;
      entry.settled = true;
      if (error) entry.reject(error);
      else entry.resolve(/** @type {ServeLease} */ (lease));
    }
  }

  /**
   * O servidor para a entrada por provedor. Se já existe um servidor vivo,
   * devolve o mesmo SEM chamar `keyEnv`: abrir Configurações não pode pedir o
   * cofre (#104). Sem servidor, sobe um sem `OPENCODE_API_KEY` — as rotas de
   * credencial não usam a chave do Zen, e o `.json`/SQLite de credenciais do
   * OpenCode continua sendo lido pelo próprio servidor.
   * @returns {Promise<ServeLease>}
   */
  function acquireAuth() {
    if (starting) return starting;
    if (server) return Promise.resolve({baseUrl: server.baseUrl, password: server.password, binary: server.binary, pid: server.pid});
    if (authStarting) return authStarting;
    authStarting = (async () => {
      const found = findBinary();
      if (!found) {
        log('opencode', 'binário não encontrado; procurei LEARNING_DESK_OPENCODE, ~/.opencode/bin/opencode e o PATH');
        throw Error(message('err.opencode.notFound'));
      }
      return launch(found, {}, fingerprint({}));
    })().finally(() => { authStarting = null; });
    return authStarting;
  }

  /** Recolhe o servidor de uma queda anterior; chamar uma vez na partida. */
  function sweepAtBoot() {
    try {
      const result = sweep({dir: ledgerDir});
      for (const item of result.killed) log('opencode', `servidor órfão da Mesa recolhido (pid ${item.pid})`);
      for (const item of result.skipped) log('opencode', `registro velho não recolhido (pid ${item.pid}: ${item.reason})`);
      return result;
    } catch (error) {
      log('opencode', `recolha de órfãos falhou: ${error.message}`);
      return {killed: [], skipped: [], entry: null};
    }
  }

  return {acquire, acquireAuth, stop, cancelStarting, sweepAtBoot, running: () => server !== null, binary: () => findBinary()};
}

module.exports = {createServeOwner};
