// @ts-check
'use strict';

/* PDFs que o aluno soltou no chat desta conversa. Não é a biblioteca: o
   `resolveTutorPdf` recebe estes caminhos junto com `allowed`, e trocar de
   conversa troca a lista. O arquivo continua onde o aluno o deixou. */

const fs = require('node:fs');
const path = require('node:path');

const FILE = 'chat-pdf-grants.json';
const MAX_GRANTS = 64;
const MAX_PATH = 4096;

/**
 * @param {unknown} raw
 * @returns {Record<string, string[]>}
 */
function storeFrom(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key || key === '__proto__' || !Array.isArray(value)) continue;
    const paths = value.filter((item) => typeof item === 'string' && item && item.length <= MAX_PATH);
    if (paths.length) out[key] = paths.slice(-MAX_GRANTS);
  }
  return out;
}

/**
 * Autorizações de PDF do chat, por caminho de sessão.
 * @param {{runtime: string, session: () => string, readFile?: typeof fs.readFileSync, writeFile?: typeof fs.writeFileSync, rename?: typeof fs.renameSync, mkdir?: typeof fs.mkdirSync}} options
 * @returns {{grant: (file: string) => string, list: () => string[], file: string}}
 * @example const grants = createChatPdfGrants({runtime: '/tmp/mesa', session: () => '/tmp/mesa/pi.jsonl'});
 */
function createChatPdfGrants({runtime, session, readFile = fs.readFileSync, writeFile = fs.writeFileSync, rename = fs.renameSync, mkdir = fs.mkdirSync}) {
  if (typeof runtime !== 'string' || !runtime) throw Error('createChatPdfGrants: runtime deve ser uma pasta.');
  if (typeof session !== 'function') throw Error('createChatPdfGrants: session deve ser função.');
  const file = path.join(runtime, FILE);
  /** @type {Record<string, string[]> | null} */
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      cache = storeFrom(JSON.parse(String(readFile(file, 'utf8'))));
    } catch {
      cache = {};
    }
    return cache;
  }

  function save(store) {
    mkdir(runtime, {recursive: true});
    const tmp = `${file}.tmp`;
    writeFile(tmp, JSON.stringify(store));
    rename(tmp, file);
    cache = store;
  }

  function list() {
    const key = String(session() || '');
    const rows = load()[key];
    return Array.isArray(rows) ? rows.slice() : [];
  }

  function grant(filePath) {
    if (typeof filePath !== 'string' || !filePath || filePath.length > MAX_PATH) {
      throw Error(`createChatPdfGrants: caminho inválido; esperado string de 1 a ${MAX_PATH}.`);
    }
    const key = String(session() || '');
    if (!key) throw Error('createChatPdfGrants: sessão vazia.');
    const store = {...load()};
    const current = Array.isArray(store[key]) ? store[key].slice() : [];
    if (!current.includes(filePath)) {
      current.push(filePath);
      store[key] = current.slice(-MAX_GRANTS);
      save(store);
    }
    return filePath;
  }

  return {grant, list, file: FILE};
}

module.exports = {createChatPdfGrants, FILE, MAX_GRANTS};
