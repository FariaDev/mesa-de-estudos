'use strict';

const fs = require('fs');
const path = require('path');

/* Leitura tolerante e escrita atômica de JSON (#43 fase 2): a mesma função
   estava copiada nos pacotes, no backup, no git-backup, no chat lateral e na
   promoção Livre. Quem precisa distinguir arquivo corrompido (activity-store) ou
   limitar tamanho (search-text) segue com a sua. */

/**
 * Lê e analisa um JSON; arquivo ausente ou ilegível vira null.
 * @param {string} file caminho absoluto
 * @returns {any|null}
 * @example readJson('/runtime/desk.json') // {...} ou null
 */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Grava num temporário ao lado e renomeia, criando a pasta se faltar: quem lê
 * nunca vê o arquivo pela metade.
 * @param {string} file caminho absoluto
 * @param {string|Buffer} data conteúdo já serializado
 * @returns {void}
 * @example atomicWrite('/runtime/backup/config.json', `${JSON.stringify(config)}\n`)
 */
function atomicWrite(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, data);
  renameWithWindowsRetry(tmp, file);
}

/* No Windows, antivírus e indexador seguram por instantes um arquivo recém-lido
   ou recém-escrito, e o rename falha com EPERM, EACCES ou EBUSY (visto na CI do
   481e2bb, na restauração de backup). Nos outros sistemas esses erros são
   permanentes e sobem na hora. */
const WINDOWS_TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const WINDOWS_RENAME_ATTEMPTS = 8;
const WINDOWS_RENAME_WAIT_MS = 50;

function waitBlocking(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Renomeia; no Windows repete por até cerca de 1,4 s quando o arquivo está
 * preso por outro processo.
 * @param {string} from caminho atual
 * @param {string} to caminho final
 * @param {{platform?: string, rename?: (from: string, to: string) => void, wait?: (ms: number) => void}} [deps]
 * @returns {void}
 * @example renameWithWindowsRetry('/runtime/a.json.tmp', '/runtime/a.json')
 */
function renameWithWindowsRetry(from, to, {platform = process.platform, rename = fs.renameSync, wait = waitBlocking} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      rename(from, to);
      return;
    } catch (error) {
      const transient = platform === 'win32' && WINDOWS_TRANSIENT_RENAME_CODES.has(error.code);
      if (!transient || attempt >= WINDOWS_RENAME_ATTEMPTS) throw error;
      wait(WINDOWS_RENAME_WAIT_MS * attempt);
    }
  }
}

module.exports = {readJson, atomicWrite, renameWithWindowsRetry};
