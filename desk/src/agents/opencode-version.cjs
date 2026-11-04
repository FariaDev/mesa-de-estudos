// @ts-check
'use strict';

/* Versão do OpenCode (#91): o adaptador da Mesa fala a API v2 do `serve`
   (`/api/session`). O 1.19.5 estável responde `400 InvalidRequestError:
   Missing key at ["prompt"]` a todo turno e não expõe o MCP `mesa` pela v2;
   isso vem de antes da #91. O config de ferramentas vale nas duas versões,
   mas o turno só existe na 2.x.

   A leitura é `opencode --version` e nunca inicia o servidor nem o modelo.
   Versão ilegível/desconhecida NÃO bloqueia: a Mesa segue como antes e o
   servidor responde o que tiver de responder. */

const {spawn, spawnSync} = require('node:child_process');
const {spawnPlan} = require('../win-cmd-spawn.cjs');

const VERSION_OUTPUT_LIMIT = 4096;

/**
 * A versão de um texto de `opencode --version` (`opencode v2.2.4`, `1.19.5`).
 * @param {unknown} output
 * @returns {{text: string, major: number, minor: number, patch: number}|null} `null` se não houver versão legível
 * @example versionOf('opencode v2.2.4') // {text: '2.2.4', major: 2, minor: 2, patch: 4}
 */
function versionOf(output) {
  if (typeof output !== 'string') return null;
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(output);
  if (!match) return null;
  const [text, major, minor, patch] = match;
  return {text, major: Number(major), minor: Number(minor), patch: Number(patch)};
}

/**
 * A versão encontrada, se ela NÃO roda o turno da Mesa (anterior à 2.x).
 * Versão ilegível devolve `null` e não bloqueia.
 * @param {unknown} output
 * @returns {{text: string, major: number, minor: number, patch: number}|null}
 * @example oldOpenCode('1.19.5')?.text // '1.19.5'; oldOpenCode('2.2.4') // null
 */
function oldOpenCode(output) {
  const version = versionOf(output);
  return version && version.major < 2 ? version : null;
}

/**
 * Roda `opencode --version` e devolve o texto; falha, timeout ou binário
 * ausente devolvem `''` (desconhecida, não bloqueia).
 * @param {string} binary
 * @param {{timeoutMs?: number, spawnProcess?: typeof spawn}} [options]
 * @returns {Promise<string>}
 * @example await readOpenCodeVersion('/usr/local/bin/opencode') // '1.19.5'
 */
async function readOpenCodeVersion(binary, {timeoutMs = 10000, spawnProcess = spawn} = {}) {
  if (typeof binary !== 'string' || !binary) return '';
  const plan = spawnPlan(binary, ['--version']);
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const child = spawnProcess(plan.file, plan.args, {env: process.env, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, ...plan.options});
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* já saiu */ }
      finish('');
    }, timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { output = (output + chunk).slice(0, VERSION_OUTPUT_LIMIT); });
    child.on('error', () => finish(''));
    child.on('close', () => finish(output.trim()));
  });
}

const versionCache = new Map();

/**
 * Lê a versão sem bloquear por mais que alguns segundos; cacheia por caminho e
 * mtime. Versão ilegível devolve `''` e não bloqueia. É usado na detecção do
 * motor padrão e no estado da primeira abertura (#93).
 * @param {string} binary
 * @param {{timeoutMs?: number, spawnProcess?: typeof spawnSync}} [options]
 * @returns {string}
 * @example readOpenCodeVersionSync('/tmp/opencode-1.19.5') // '1.19.5'
 */
function readOpenCodeVersionSync(binary, {timeoutMs = 3000, spawnProcess = spawnSync} = {}) {
  if (typeof binary !== 'string' || !binary) return '';
  let stamp;
  try {
    const stat = require('node:fs').statSync(binary);
    stamp = `${binary}:${stat.mtimeMs}:${stat.size}`;
  } catch { return ''; }
  if (versionCache.has(stamp)) return versionCache.get(stamp) || '';
  const plan = spawnPlan(binary, ['--version']);
  const result = spawnProcess(plan.file, plan.args, {env: process.env, encoding: 'utf8', timeout: timeoutMs, windowsHide: true, ...plan.options});
  const output = typeof result.stdout === 'string' ? result.stdout.slice(0, VERSION_OUTPUT_LIMIT).trim() : '';
  versionCache.set(stamp, output);
  return output;
}

module.exports = {versionOf, oldOpenCode, readOpenCodeVersion, readOpenCodeVersionSync};
