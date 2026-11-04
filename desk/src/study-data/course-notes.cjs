'use strict';

/* Notas do tutor (#91): `Notas/<título>.md` dentro da matéria (ou do
   workspace da sessão Livre).
 *
 * O núcleo Bend (`core/tutornotes.bend` → `src/generated/tutornotes.core.js`)
 * decide o invariante: o caminho é SEMPRE relativo e começa em `Notas/`;
 * título vazio, com `..`, com separador ou com quebra de linha é recusado.
 * Aqui fica só o I/O do sistema:
 *
 *   - `realpath` da raiz e de `Notas/`; pasta que virou link é recusada;
 *   - o nome do arquivo é saneado uma vez (a colisão usa a sequência do
 *     núcleo: `-2`, `-3`, …);
 *   - o conteúdo vai para um temporário `O_EXCL` e é publicado por link
 *     exclusivo (ou cópia exclusiva onde o link não existe);
 *   - nunca sobrescreve: nome tomado avança a tentativa.
 *
 * O chamador entrega a raiz já resolvida pelo host (matéria ou Livre); esta
 * função não amplia escopo e não lê o config. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../generated/tutornotes.core.js').default;
const {toNat} = require('../bend-nat.mjs');
const {message} = require('../i18n.mjs');

const MAX_ATTEMPTS = 500;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Nome de arquivo seguro a partir do título. Mantém o título legível, tira
 * controles e separadores e corta no teto do núcleo. Título que só tem
 * caractere inseguro vira vazio — o núcleo recusa.
 * @param {unknown} raw
 * @returns {string}
 * @example noteStem('  Derivadas: regra  ') // 'Derivadas- regra'
 */
function noteStem(raw) {
  let text = String(raw ?? '').normalize('NFC')
    // eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-\s]+/, '')
    .replace(/[.\-\s]+$/, '');
  if (WINDOWS_RESERVED.test(text)) text = `_${text}`;
  const limit = Number(core.maxTitle());
  if (text.length > limit) text = text.slice(0, limit).replace(/[.\-\s]+$/, '');
  return text;
}

function assertRoot(root, {realpathSync}) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw Error(message('err.note.badRoot'));
  const real = realpathSync(root);
  const stats = fs.lstatSync(real);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw Error(message('err.note.badRoot'));
  return real;
}

function notesDirectory(rootReal) {
  const folder = String(core.folder());
  const dir = path.join(rootReal, folder);
  fs.mkdirSync(dir, {recursive: true});
  const link = fs.lstatSync(dir);
  if (!link.isDirectory() || link.isSymbolicLink()) throw Error(message('err.note.badRoot'));
  if (fs.realpathSync(dir) !== path.join(rootReal, folder)) throw Error(message('err.note.badRoot'));
  return dir;
}

/* Publica o temporário sem NUNCA sobrescrever: link exclusivo e, onde ele não
   existe, cópia exclusiva. Devolve false quando o nome foi tomado. */
function commitExclusive(temporary, target) {
  try {
    fs.linkSync(temporary, target);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    if (!['EPERM', 'EXDEV', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS'].includes(error.code)) throw error;
  }
  try {
    fs.copyFileSync(temporary, target, fs.constants.COPYFILE_EXCL);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

function writeTemporary(dir, content) {
  const temporary = path.join(dir, `.mesa-note-${crypto.randomUUID()}.tmp`);
  let fd = null;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    return temporary;
  } catch (error) {
    if (fd !== null) { try { fs.closeSync(fd); } catch { /* já foi */ } }
    try { fs.rmSync(temporary, {force: true}); } catch { /* já foi */ }
    throw error;
  }
}

/**
 * Grava a nota e devolve o nome/caminho reais. Nunca sobrescreve e nunca sai
 * da raiz recebida.
 * @param {{root: string, title: unknown, content: unknown, writeTemporary?: typeof writeTemporary,
 *   realpathSync?: typeof fs.realpathSync}} options
 * @returns {{saved: true, title: string, name: string, rel: string, path: string, bytes: number}}
 * @example saveNote({root: '/c', title: 'Limites', content: '# a'})
 */
function saveNote({root, title, content, writeTemporary: write = writeTemporary, realpathSync = fs.realpathSync}) {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  const text = typeof content === 'string' ? content : '';
  if (!text.trim() || text.length > Number(core.maxContent())) throw Error(message('err.note.badContent', {max: Number(core.maxContent())}));
  if (!trimmed || core.noteTarget('', trimmed).$ === 'NoteTarget.Refused') throw Error(message('err.note.badTitle', {max: Number(core.maxTitle())}));
  const stem = noteStem(trimmed);
  if (!stem || core.noteTarget('', stem).$ === 'NoteTarget.Refused') throw Error(message('err.note.badTitle', {max: Number(core.maxTitle())}));

  const rootReal = assertRoot(root, {realpathSync});
  const dir = notesDirectory(rootReal);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const target = core.noteTargetAt(rootReal, stem, toNat(attempt));
    if (target.$ === 'NoteTarget.Refused') throw Error(message('err.note.badTitle', {max: Number(core.maxTitle())}));
    const rel = target.rel;
    const file = path.join(rootReal, rel);
    if (!file.startsWith(rootReal + path.sep)) throw Error(message('err.note.badRoot'));
    if (fs.lstatSync(file, {throwIfNoEntry: false})) continue;

    const temporary = write(dir, text);
    let committed;
    try {
      committed = commitExclusive(temporary, file);
    } finally {
      try { fs.rmSync(temporary, {force: true}); } catch { /* já foi */ }
    }
    if (!committed) continue;
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error(message('err.note.badRoot'));
    if (fs.realpathSync(file) !== file) throw Error(message('err.note.badRoot'));
    return {saved: true, title: stem, name: path.basename(file), rel, path: file, bytes: stat.size};
  }
  throw Error(message('err.note.noName'));
}

module.exports = {MAX_ATTEMPTS, noteStem, saveNote};
