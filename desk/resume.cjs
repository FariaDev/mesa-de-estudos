'use strict';

/* Registro local do "Encerrar por hoje" (Mesa): `runtime/resume.json`.

   O Encerrar grava AQUI primeiro (arquivo próprio, um registro por matéria) e
   só depois tenta falar com o Pi: sem conexão, sem provedor ou com o Pi fora do
   ar, o que o usuário escreveu continua no disco e o cartão de retomada aparece
   na próxima abertura.

   Fronteira com o núcleo Bend (`core/resume.bend` → `src/generated/resume.core.js`):
   a FORMA do registro — textos aparados e cortados, página nunca abaixo de 1,
   no máximo dois PDFs — sai do núcleo; aqui ficam o arquivo, a leitura tolerante
   e a gravação atômica. Erro de escrita SOBE como exceção: o Encerrar mantém o
   diálogo aberto com o que foi digitado (fechar perdendo o texto é o bug que
   este módulo existe para não ter).

   A chave é o id da matéria. Matéria removida deixa o registro parado no
   arquivo; se ela voltar com o mesmo id, o registro volta junto. */

const fs = require('node:fs');
const path = require('node:path');
const resumeCore = require('./src/generated/resume.core.js').default;

const FILENAME = 'resume.json';
/* Teto de leitura/gravação: um registro por matéria, alguns KB. Arquivo maior
   que isto é lixo (ou corrompido) e vira "sem registro" na leitura. */
const MAX_STORED_BYTES = 256 * 1024;
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

/* Uma página do registro: o núcleo apara o caminho e levanta a página para 1. */
function corePage(ref) {
  const raw = isPlainObject(ref) ? ref : {};
  const page = Number(raw?.page);
  const whole = Number.isFinite(page) ? Math.trunc(page) : 0;
  return resumeCore.pageRef(typeof raw.path === 'string' ? raw.path : '', BigInt(Math.max(0, whole)));
}

/* Registro cru → forma do núcleo → registro do host (JSON puro). `null` quando
   falta o miolo ("onde parei" E "próximo passo"). */
function normalizeRecord(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const stopped = typeof source.stopped === 'string' ? source.stopped : '';
  const next = typeof source.next === 'string' ? source.next : '';
  if (!resumeCore.keepRecord(stopped, next)) return null;
  const pages = (Array.isArray(source.pages) ? source.pages : [])
    .filter((ref) => isPlainObject(ref) && typeof ref.path === 'string' && ref.path)
    .map(corePage);
  const record = resumeCore.record(
    stopped,
    next,
    typeof source.exercise === 'string' ? source.exercise : '',
    typeof source.xopp === 'string' ? source.xopp : '',
    coreList(pages)
  );
  return {
    stopped: record.stopped,
    next: record.next,
    exercise: record.exercise,
    xopp: record.xopp,
    pages: coreArray(record.pages).map((page) => ({path: page.path, page: Number(page.page)})),
  };
}

/* ---------- arquivo ---------- */

/* Leitura tolerante: sem arquivo, JSON torto, chave estranha ou arquivo maior
   que o teto viram "nada guardado" — e o próximo save regrava. */
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
    const record = normalizeRecord(value);
    if (record) out[key] = record;
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

/* O registro guardado para uma matéria (nunca escreve). */
function readResume(runtime, courseId) {
  const entry = readStore(runtime)[String(courseId || '')];
  return entry ? {...entry, pages: entry.pages.map((page) => ({...page}))} : null;
}

/* Grava o registro da matéria e devolve o que foi guardado (o renderer mostra o
   cartão com isto). Registro sem o miolo é recusado, não gravado pela metade. */
function saveResume(runtime, courseId, raw) {
  const key = String(courseId || '');
  if (!key) throw Error('Sem matéria ativa para guardar o registro.');
  const record = normalizeRecord(raw);
  if (!record) throw Error('Preencha onde parei e o próximo passo.');
  const store = readStore(runtime);
  store[key] = record;
  writeStore(runtime, store);
  return {...record, pages: record.pages.map((page) => ({...page}))};
}

/* Apaga o registro da matéria (Retomar/Dispensar). */
function clearResume(runtime, courseId) {
  const key = String(courseId || '');
  const store = readStore(runtime);
  if (!Object.prototype.hasOwnProperty.call(store, key)) return false;
  delete store[key];
  writeStore(runtime, store);
  return true;
}

module.exports = {readResume, saveResume, clearResume, FILENAME};
