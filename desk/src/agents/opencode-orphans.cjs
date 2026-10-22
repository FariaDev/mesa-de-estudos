// @ts-check
'use strict';

/* Ledger do `opencode serve` que a MESA subiu (#57, porte da branch
   t3/opencode-provider).

   Se o app morre com `kill -9`, o filho pode ficar vivo. Na partida seguinte a
   Mesa recolhe só o que ela mesma gravou: o pid/pgid do ledger, e só se a linha
   de comando ainda for EXATAMENTE o serve que a Mesa lança
   (`opencode serve --hostname 127.0.0.1 --port 0`). Processo fora do ledger
   não é tocado, e um `opencode` que o usuário abriu (outro subcomando, outra
   porta, outro host) também não. Nada de `pkill`.

   O ledger fica no runtime da Mesa e guarda só pid, pgid e o caminho do
   binário — NENHUMA senha. Leitura da linha de comando, existência e kill
   entram por parâmetro: o teste usa fakes nomeados e não mata nada. */

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const LEDGER_FILE = 'opencode-servers.json';
/* Os argumentos que só a Mesa usa juntos: porta efêmera pedida ao sistema. */
const MESA_SERVE_ARGS = Object.freeze(['serve', '--hostname', '127.0.0.1', '--port', '0']);

/**
 * @typedef {{pid: number, pgid: number, binary: string}} LedgerEntry
 * @typedef {{pid: number, pgid: number, signal: string}} KillTarget
 * @typedef {{killed: Array<{pid: number, pgid: number}>, skipped: Array<{pid: number, reason: string}>, entry: LedgerEntry|null}} SweepResult
 */

const {isPlainObject} = require('../../plain-object.cjs');
const positive = (value) => Number.isInteger(value) && value > 0;

/** @param {string} dir @returns {string} */
function ledgerPath(dir) {
  return path.join(dir, LEDGER_FILE);
}

/**
 * O registro gravado, ou null sem ledger ou com registro inválido.
 * @param {string} dir
 * @returns {LedgerEntry|null}
 * @example readEntry(runtime) // {pid: 4242, pgid: 4242, binary: '/…/opencode'}
 */
function readEntry(dir) {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(ledgerPath(dir), 'utf8')); } catch { return null; }
  if (!isPlainObject(parsed)) return null;
  const pid = Number(parsed.pid);
  if (!positive(pid)) return null;
  const pgid = Number(parsed.pgid);
  return {pid, pgid: positive(pgid) ? pgid : pid, binary: typeof parsed.binary === 'string' ? parsed.binary : ''};
}

/**
 * Grava o registro do filho (tmp + rename).
 * @param {string} dir
 * @param {{pid: number, pgid?: number, binary?: string}} entry
 * @returns {void}
 * @example writeEntry(runtime, {pid: child.pid, pgid: child.pid, binary})
 */
function writeEntry(dir, entry) {
  const pid = Number(entry?.pid);
  if (!positive(pid)) throw Error(`registro de servidor do OpenCode inválido: pid ${JSON.stringify(entry?.pid)}, esperado inteiro positivo`);
  const pgid = Number(entry.pgid);
  fs.mkdirSync(dir, {recursive: true});
  const file = ledgerPath(dir);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({pid, pgid: positive(pgid) ? pgid : pid, binary: typeof entry.binary === 'string' ? entry.binary : ''}));
  fs.renameSync(tmp, file);
}

/** @param {string} dir @returns {void} */
function clearEntry(dir) {
  try { fs.rmSync(ledgerPath(dir), {force: true}); } catch { /* sem ledger, nada a apagar */ }
}

/**
 * A linha de comando é o serve da Mesa? O executável é o binário gravado (ou
 * `opencode`) e os argumentos são exatamente os que a Mesa passa.
 * @param {unknown} commandLine @param {unknown} binary
 * @returns {boolean}
 * @example isMesaServe('/x/opencode serve --hostname 127.0.0.1 --port 0', '/x/opencode') // true
 */
function isMesaServe(commandLine, binary) {
  if (typeof commandLine !== 'string' || !commandLine.trim()) return false;
  const parts = commandLine.trim().split(/\s+/);
  const strip = (value) => path.basename(String(value || '')).replace(/\.exe$/i, '').toLowerCase();
  const expected = typeof binary === 'string' && binary ? strip(binary) : 'opencode';
  if (strip(parts[0]) !== expected) return false;
  const args = parts.slice(1);
  return args.length === MESA_SERVE_ARGS.length && args.every((arg, index) => arg === MESA_SERVE_ARGS[index]);
}

/** Linha de comando real do processo (POSIX: `ps`; Windows: CIM). @param {number} pid @returns {string|null} */
function readCommandLine(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`], {encoding: 'utf8'});
      return String(out || '').trim() || null;
    }
    return String(execFileSync('ps', ['-p', String(Number(pid)), '-o', 'command='], {encoding: 'utf8'}) || '').trim() || null;
  } catch {
    return null;
  }
}

/** O processo existe? (sinal 0 não acorda ninguém) @param {number} pid @returns {boolean} */
function processExists(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return /** @type {{code?: string}} */ (error)?.code === 'EPERM';
  }
}

/**
 * Encerra o GRUPO do servidor (POSIX: sinal no grupo; Windows: `taskkill /T`).
 * @param {Partial<KillTarget>} [target]
 * @returns {void}
 */
function killGroup(target = {}) {
  const pid = Number(target.pid || 0);
  const pgid = Number(target.pgid || pid);
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {stdio: 'ignore'});
    return;
  }
  try {
    process.kill(-pgid, typeof target.signal === 'string' ? target.signal : 'SIGTERM');
  } catch (error) {
    if (/** @type {{code?: string}} */ (error)?.code !== 'ESRCH') throw error;
  }
}

/**
 * Recolhe o servidor que a Mesa deixou para trás numa queda.
 * @param {{dir?: string, readCommandLine?: (pid: number) => string|null, kill?: (target: KillTarget) => void, exists?: (pid: number) => boolean}} [deps]
 * @returns {SweepResult}
 * @example sweepOrphans({dir: runtime}) // {killed: [{pid, pgid}], skipped: [], entry}
 */
function sweepOrphans(deps = {}) {
  const {dir = '', readCommandLine: read = readCommandLine, kill = killGroup, exists = processExists} = deps;
  const entry = readEntry(dir);
  if (!entry) return {killed: [], skipped: [], entry: null};
  const skip = (reason) => { clearEntry(dir); return {killed: [], skipped: [{pid: entry.pid, reason}], entry}; };
  let alive;
  try { alive = exists(entry.pid) !== false; } catch { alive = true; }
  if (!alive) return skip('processo não existe mais');
  let commandLine;
  try { commandLine = read(entry.pid); } catch { commandLine = null; }
  if (!commandLine) return skip('processo não existe mais');
  if (!isMesaServe(commandLine, entry.binary)) return skip('a linha de comando não é o serve da Mesa');
  /* O grupo encerrado é o do pid que acabou de ser conferido, nunca o `pgid`
     do arquivo: um ledger estragado com `pgid: 1` viraria `kill(-1)` e
     derrubaria todo processo do usuário. A Mesa sobe o filho `detached`, então
     o grupo dele é o próprio pid. */
  kill({pid: entry.pid, pgid: entry.pid, signal: 'SIGTERM'});
  clearEntry(dir);
  return {killed: [{pid: entry.pid, pgid: entry.pid}], skipped: [], entry};
}

module.exports = {LEDGER_FILE, MESA_SERVE_ARGS, ledgerPath, readEntry, writeEntry, clearEntry, isMesaServe, readCommandLine, processExists, killGroup, sweepOrphans};
