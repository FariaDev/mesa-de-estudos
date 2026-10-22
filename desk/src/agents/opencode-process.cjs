// @ts-check
'use strict';

/* Processo do `opencode serve` que a Mesa fala por HTTP (#57, porte da branch
   t3/opencode-provider; medido no binário 2.0.32).

   - A senha do Basic auth (usuário fixo `opencode`) é GERADA aqui, só na
     memória, e vai ao filho por `OPENCODE_PASSWORD` (medido: sem ela 401, com
     ela 200). Um `OPENCODE_SERVER_PASSWORD` herdado do shell não viaja.
   - A porta é pedida ao sistema (`--port 0`); o servidor anuncia a efetiva no
     stdout (`server listening on http://127.0.0.1:NNNNN`).
   - O filho nasce no próprio grupo (`detached`, fora do Windows): a recolha de
     órfãos (`opencode-orphans.cjs`) encerra o grupo sem encostar no do app.
   - A chave do Zen, quando existe, chega pelo ambiente que o dono monta
     (`OPENCODE_API_KEY`); este módulo não a conhece, e o stderr que vai ao log
     passa pelo `redact` com a senha e qualquer segredo do ambiente. */

const {spawn} = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {MESA_SERVE_ARGS, writeEntry, clearEntry, killGroup} = require('./opencode-orphans.cjs');
const {message} = require('../i18n.mjs');

const DEFAULT_TIMEOUT_MS = 30000;
const LISTENING_RE = /listening on (https?:\/\/127\.0\.0\.1:\d+)/i;
const USERNAME = 'opencode';

/**
 * @typedef {{baseUrl: string, password: string, binary: string, pid: number, stop: () => void, onExit: (fn: (code: number|null) => void) => void}} OpenCodeServer
 */

/** @param {unknown} candidate @param {string} home @returns {string|null} */
function expandHome(candidate, home) {
  if (typeof candidate !== 'string' || !candidate) return null;
  if (candidate === '~') return home;
  if (candidate.startsWith('~/') || candidate.startsWith('~\\')) return path.resolve(home, candidate.slice(2));
  return path.resolve(candidate);
}

/**
 * Onde procurar o CLI, em ordem: o caminho do ambiente (`LEARNING_DESK_OPENCODE`)
 * e os instaladores usuais. Só a existência do arquivo é lida.
 * @param {{envPath?: string, home?: string, platform?: string}} [options]
 * @returns {string[]}
 * @example candidatePaths({home: '/Users/ana'}) // ['/Users/ana/.opencode/bin/opencode', …]
 */
function candidatePaths({envPath = '', home = os.homedir(), platform = process.platform} = {}) {
  const out = [expandHome(envPath, home)];
  if (platform === 'win32') out.push(path.join(home, 'AppData', 'Local', 'Programs', 'opencode', 'opencode.exe'), path.join(home, '.opencode', 'bin', 'opencode.exe'));
  out.push(path.join(home, '.opencode', 'bin', 'opencode'), path.join(home, '.local', 'bin', 'opencode'));
  if (platform !== 'win32') out.push('/opt/homebrew/bin/opencode', '/usr/local/bin/opencode');
  return [...new Set(out.filter((item) => typeof item === 'string'))];
}

/**
 * O primeiro candidato que existe, ou ''.
 * @param {{envPath?: string, home?: string, platform?: string}} [options]
 * @returns {string}
 * @example findOpenCodeLauncher({envPath: process.env.LEARNING_DESK_OPENCODE})
 */
function findOpenCodeLauncher(options = {}) {
  return candidatePaths(options).find((file) => {
    try { return fs.statSync(file).isFile(); } catch { return false; }
  }) || '';
}

/**
 * O ambiente do filho: o recebido, sem senha herdada, mais a senha gerada.
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} env @param {string} password
 * @returns {Record<string, string|undefined>}
 * @example childEnv({OPENCODE_SERVER_PASSWORD: 'x'}, 'p') // {OPENCODE_PASSWORD: 'p'}
 */
function childEnv(env, password) {
  /** @type {Record<string, string|undefined>} */
  const out = {...env, OPENCODE_PASSWORD: password};
  delete out.OPENCODE_SERVER_PASSWORD;
  return out;
}

/**
 * Tira a senha e os segredos do texto antes do log.
 * @param {string} text @param {string[]} secrets
 * @returns {string}
 * @example redact('senha=abc', ['abc']) // 'senha=***'
 */
function redact(text, secrets) {
  let out = String(text || '');
  for (const secret of secrets) if (secret && secret.length >= 6) out = out.split(secret).join('***');
  return out;
}

/**
 * Sobe o servidor e devolve `{baseUrl, password, stop}` quando ele anuncia a porta.
 * @param {{binary?: string, cwd?: string, env?: Record<string, string|undefined>, timeoutMs?: number,
 *   log?: (area: string, line: string) => void, spawnProcess?: typeof spawn, ledgerDir?: string}} [options]
 * @returns {Promise<OpenCodeServer>}
 * @example const server = await startOpenCodeServer({binary, cwd: workspaces, env, ledgerDir: runtime});
 */
function startOpenCodeServer({binary = '', cwd = '', env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, log = () => {}, spawnProcess = spawn, ledgerDir = ''} = {}) {
  if (!binary) return Promise.reject(Error(message('err.opencode.notFound')));
  const password = crypto.randomBytes(32).toString('base64url');
  const secrets = [password, String(env.OPENCODE_API_KEY || '')];
  const child = spawnProcess(binary, [...MESA_SERVE_ARGS], {
    cwd: cwd || undefined, env: childEnv(env, password), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    detached: process.platform !== 'win32',
  });
  const pid = child.pid || 0;
  if (ledgerDir && pid) {
    try { writeEntry(ledgerDir, {pid, pgid: pid, binary}); } catch (error) { log('opencode', `ledger não gravado: ${error.message}`); }
  }
  const exitListeners = [];
  let exited = false;
  const stop = () => {
    if (!exited && child.exitCode === null && child.signalCode === null) {
      try { killGroup({pid, pgid: pid, signal: 'SIGTERM'}); } catch { /* o grupo já saiu */ }
      try { child.kill(); } catch { /* o filho já saiu */ }
    }
    if (ledgerDir) clearEntry(ledgerDir);
  };
  return new Promise((resolve, reject) => {
    let settled = false;
    let output = '';
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) { stop(); reject(error); } else resolve(value);
    };
    const timer = setTimeout(() => finish(Error(message('err.opencode.startTimeout', {seconds: Math.round(timeoutMs / 1000)}))), timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      output = (output + chunk).slice(-4000);
      const match = LISTENING_RE.exec(output);
      if (!match) return;
      finish(null, {baseUrl: match[1], password, binary, pid, stop, onExit: (fn) => exitListeners.push(fn)});
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      const text = redact(chunk, secrets).trim();
      if (text) log('opencode', text.slice(0, 2000));
    });
    child.on('error', (/** @type {NodeJS.ErrnoException} */ error) => finish(Error(message('err.opencode.spawnFailed', {cause: error.code || error.message}))));
    child.on('exit', (code) => {
      exited = true;
      if (ledgerDir) clearEntry(ledgerDir);
      finish(Error(message('err.opencode.startExit', {code: String(code)})));
      for (const fn of exitListeners) { try { fn(code); } catch { /* quem escuta não derruba o processo */ } }
    });
  });
}

module.exports = {DEFAULT_TIMEOUT_MS, USERNAME, candidatePaths, findOpenCodeLauncher, childEnv, redact, startOpenCodeServer};
