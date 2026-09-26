'use strict';

/* Favoritos nomeados do leitor (Mesa): `runtime/bookmarks.json`.

   Um favorito é `{name, path, page}` — o documento e a página que o usuário
   nomeou no popover "Navegar". A FORMA e a ORDEM saem do núcleo Bend
   (`core/pdfnav.bend` → `src/generated/pdfnav.core.js`): nome e path aparados e
   cortados no teto, página nunca abaixo de 1, guardar de novo o mesmo favorito
   NÃO duplica (renomeia, e o favorito novo vai para a frente) e a lista para no
   `maxBookmarks()`. Remover também vai pela IDENTIDADE (mesmo documento e mesmo
   nome): quem mostra a lista a filtra, então a posição da linha não serve para
   achar o registro. Aqui ficam o arquivo, a leitura tolerante e a gravação
   atômica — nada além disso.

   A chave é o id da matéria, como no `resume.json`: trocar de matéria troca a
   lista de favoritos do popover. Matéria removida deixa os favoritos parados no
   arquivo; se ela voltar com o mesmo id, eles voltam junto. */

const fs = require('node:fs');
const path = require('node:path');
const navCore = require('./src/generated/pdfnav.core.js').default;

const FILENAME = 'bookmarks.json';
/* Teto de leitura/gravação: uma lista de favoritos por matéria, alguns KB.
   Arquivo maior que isto é lixo (ou corrompido) e vira "sem favoritos". */
const MAX_STORED_BYTES = 512 * 1024;
const MAX_KEY = 120;
const NIL = {$: 'Nil'};

const fileOf = (runtime) => path.join(runtime, FILENAME);
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const coreList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const coreLimit = () => Number(navCore.maxBookmarks());

/* Um favorito do JSON → forma do núcleo → favorito do host (JSON puro).
   `null` quando não vale guardar (sem nome ou sem documento). */
function normalizeOne(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const page = Number(source.page);
  const whole = Number.isFinite(page) ? Math.trunc(page) : 0;
  const bookmark = navCore.newBookmark(
    typeof source.name === 'string' ? source.name : '',
    typeof source.path === 'string' ? source.path : '',
    BigInt(Math.max(0, whole))
  );
  if (!navCore.keepBookmark(bookmark)) return null;
  return {name: bookmark.name, path: bookmark.path, page: Number(bookmark.page)};
}

/* Lista crua → lista do host, na ordem do arquivo e no teto do núcleo. */
function normalizeList(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (out.length >= coreLimit()) break;
    const one = normalizeOne(item);
    if (one) out.push(one);
  }
  return out;
}

/* ---------- arquivo ---------- */

/* Leitura tolerante: sem arquivo, JSON torto, chave estranha ou arquivo maior
   que o teto viram "sem favoritos" — e o próximo save regrava. */
function readStore(runtime) {
  let text = '';
  try {
    const file = fileOf(runtime);
    if (fs.statSync(file).size > MAX_STORED_BYTES) return {};
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch {
    return {};
  }
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key || key === '__proto__' || key.length > MAX_KEY) continue;
    const list = normalizeList(value);
    if (list.length) out[key] = list;
  }
  return out;
}

/* Gravação atômica (tmp + rename). Erro de IO sobe para quem chamou. */
function writeStore(runtime, store) {
  const file = fileOf(runtime);
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, file);
}

/* ---------- API ---------- */

/* Os favoritos guardados de uma matéria (nunca escreve). */
function readBookmarks(runtime, courseId) {
  const list = readStore(runtime)[String(courseId || '')];
  return list ? list.map((item) => ({...item})) : [];
}

/* Grava a lista inteira da matéria (normalizada) e devolve o que ficou. */
function saveBookmarks(runtime, courseId, raw) {
  const key = String(courseId || '');
  if (!key) throw Error('Sem matéria ativa para guardar o favorito.');
  const store = readStore(runtime);
  const list = normalizeList(raw);
  if (list.length) store[key] = list;
  else delete store[key];
  writeStore(runtime, store);
  return list.map((item) => ({...item}));
}

/* Guardar um favorito: o núcleo decide (mesmo documento+nome renomeia, o novo
   entra na frente, o teto corta o resto) e o arquivo guarda o resultado. */
function addBookmark(runtime, courseId, raw) {
  const item = normalizeOne(raw);
  if (!item) throw Error('Dê um nome ao favorito.');
  const current = coreList(readBookmarks(runtime, courseId));
  const next = coreArray(navCore.addBookmark(current, item))
    .map((node) => ({name: node.name, path: node.path, page: Number(node.page)}));
  return saveBookmarks(runtime, courseId, next);
}

/* Remove o favorito pela IDENTIDADE (mesmo documento e mesmo nome), onde ele
   estiver: a lista que a tela desenha é FILTRADA pelos documentos da matéria,
   então a posição da linha não é a posição do arquivo. Favorito que não está
   mais lá — ou payload torto — não mexe em nada e devolve o que está guardado. */
function removeBookmark(runtime, courseId, raw) {
  const item = normalizeOne(raw);
  const list = readBookmarks(runtime, courseId);
  if (!item) return list;
  const next = coreArray(navCore.removeBookmark(coreList(list), item))
    .map((node) => ({name: node.name, path: node.path, page: Number(node.page)}));
  if (next.length === list.length) return list;
  return saveBookmarks(runtime, courseId, next);
}

module.exports = {readBookmarks, saveBookmarks, addBookmark, removeBookmark, FILENAME};
