'use strict';

/* Fila e bandeja que sobrevivem ao fechamento (Mesa): `runtime/pending.json`.
   Fronteira com o núcleo Bend (`core/pending.bend` → `src/generated/pending.core.js`
   e `core/attachments.bend` → `src/generated/attachments.core.js`).

   O host resolve os fatos (texto, contagem de imagens, bytes do arquivo) e o
   núcleo decide o que entra, o que é cortado e o que é recusado. Aqui ficam o
   arquivo, a leitura tolerante e o teto de disco:

   - o arquivo é chaveado pelo caminho da conversa (o mesmo `session` do main):
     trocar de conversa não mistura filas, e fechar o app não perde nenhuma;
   - a FILA entra primeiro (é o que ainda não foi aceito pelo Pi); a bandeja
     entra com o que sobrar — um anexo grande nunca encolhe a fila;
   - nada é apagado por leitura: arquivo torto vira o que dá para aproveitar e o
     próximo save regrava; a poda só tira a conversa cujo arquivo não existe
     mais (e que não é a corrente);
   - escrita atômica (`tmp` + rename) e sem repetir o que já está no disco.

   Puro o bastante para testar sozinho: recebe `runtime`/`session` e não fala
   com IPC, DOM nem relógio. */

const fs = require('node:fs');
const path = require('node:path');
const pendingCore = require('./src/generated/pending.core.js').default;
const attachCore = require('./src/generated/attachments.core.js').default;
const {MAX_DRAFT} = require('./state-adapter.cjs');

const FILENAME = 'pending.json';
/* Tetos do núcleo: `maxStoredBytes` é o arquivo inteiro; `maxDraftChars` do
   attachments é o data URL guardado (16 MB); `MAX_DRAFT` (state) é o teto do
   texto, o mesmo que o `pi-prompt` recusa. */
const MAX_STORED_BYTES = Number(pendingCore.maxStoredBytes());
const MAX_DATA_URL = attachCore.maxDraftChars();
const MAX_REFS = Number(pendingCore.maxRefs());
const MAX_EXERCISE = 240;
const MAX_ID = 80;
const MAX_PATH = 4096;
const IMAGE_DATA_URL = /^data:([^;]*);base64,([A-Za-z0-9+/=]+)$/;
const NIL = {$: 'Nil'};

const fileOf = (runtime) => path.join(runtime, FILENAME);
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const coreList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));

/* ---------- normalização (os fatos vêm daqui, a decisão do núcleo) ---------- */

/* Proveniência da captura do Xournal++: horário e exercício do momento. É o que
   permite o main avisar que uma captura antiga não é do exercício de agora —
   valores estranhos simplesmente não entram. */
function provenance(raw) {
  const out = {};
  const capturedAt = Number(raw?.capturedAt);
  if (Number.isFinite(capturedAt) && capturedAt > 0) out.capturedAt = capturedAt;
  const exercise = typeof raw?.exercise === 'string' ? raw.exercise.trim().slice(0, MAX_EXERCISE) : '';
  if (exercise) out.exercise = exercise;
  return out;
}

function normalizeRefs(raw) {
  const out = [];
  for (const ref of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_REFS) break;
    if (!isPlainObject(ref) || typeof ref.path !== 'string' || !ref.path) continue;
    const page = Number(pendingCore.pageOf(BigInt(Math.max(0, Math.trunc(Number(ref.page)) || 0))));
    out.push({path: ref.path.slice(0, MAX_PATH), page});
  }
  return out;
}

/* Imagem guardada: `{dataUrl, mimeType, name, capturedAt, exercise}` — a mesma
   forma da bandeja do composer. Um data URL solto (arquivo editado à mão, versão
   antiga) também é aceito: o mime sai do próprio data URL. O resto o núcleo
   recusa. */
function imageFact(raw) {
  const source = typeof raw === 'string' ? {dataUrl: raw} : raw;
  const dataUrl = typeof source?.dataUrl === 'string' ? source.dataUrl : '';
  const declared = typeof source?.mimeType === 'string' ? source.mimeType : (typeof source?.mime === 'string' ? source.mime : '');
  const match = IMAGE_DATA_URL.exec(dataUrl);
  return {$: 'ImageIn', dataUrl, mime: declared || (match ? match[1] : ''), name: String(source?.name ?? ''), valid: !!match, overRaw: dataUrl.length > MAX_DATA_URL};
}

/* Imagens guardadas: tetos, tipo e forma saem do `core/attachments.bend` (os
   mesmos da bandeja da Conversa). Os que passam mantêm a proveniência. */
function normalizeImages(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = attachCore.normalizeAttachments(coreList(list.map(imageFact)), NIL);
  const kept = coreArray(attachCore.attachImages(out));
  /* O rascunho do núcleo é tudo-ou-nada: `Ok` só com a lista inteira aceita e
     cortada pelo `maxImages()` (do fim) — então `at` ainda aponta para a entrada
     crua correspondente e é dela que sai a proveniência. */
  return kept.map((image, at) => ({
    dataUrl: image.dataUrl,
    mimeType: (() => {
      const match = IMAGE_DATA_URL.exec(image.dataUrl);
      return match ? match[1] : String(list[at]?.mimeType ?? '');
    })(),
    name: image.name,
    ...provenance(list[at]),
  }));
}

function normalizeItem(raw, index) {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, MAX_ID) : `fila-${index}`;
  const text = pendingCore.cutText(String(raw.text ?? ''), BigInt(MAX_DRAFT));
  const refs = normalizeRefs(raw.refs);
  const images = normalizeImages(raw.images);
  if (!pendingCore.keepItem(text, BigInt(images.length))) return null;
  return {id, text, refs, images};
}

function normalizeItems(raw) {
  const out = [];
  for (const [index, item] of (Array.isArray(raw) ? raw : []).entries()) {
    if (!pendingCore.keepAt(BigInt(out.length))) break; // teto: os primeiros ficam
    const value = normalizeItem(item, index);
    if (value) out.push(value);
  }
  return out;
}

function normalizeEntry(value) {
  const source = isPlainObject(value) ? value : {};
  return {items: normalizeItems(source.items), attachments: normalizeImages(source.attachments), held: source.held === true};
}

/* ---------- arquivo ---------- */

/* Leitura tolerante: sem arquivo, JSON torto, chave estranha ou arquivo maior
   que o teto viram "nada guardado" — e o próximo save regrava o que sobrou. */
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
    if (!key || key === '__proto__' || !isPlainObject(value)) continue;
    const entry = normalizeEntry(value);
    if (entry.items.length || entry.attachments.length) out[key] = entry;
  }
  return out;
}

let lastPayload = null;
function writeStore(runtime, store) {
  const payload = JSON.stringify(store);
  if (payload === lastPayload) return;
  const file = fileOf(runtime);
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, payload);
  fs.renameSync(tmp, file);
  lastPayload = payload;
}

/* Poda: só a conversa corrente e as que ainda existem no disco. */
function pruneStore(store, session) {
  for (const key of Object.keys(store)) {
    if (key === session) continue;
    if (!fs.existsSync(key)) delete store[key];
  }
}

const fits = (entry) => !pendingCore.overStored(bytes(entry));

/* A fila entra primeiro e é o que fica: ela só é cortada do FIM quando sozinha
   não cabe (o começo é o que está mais perto de ser enviado). A bandeja que já
   estava guardada perde as últimas imagens até caber — nunca encolhe a fila. */
function fitQueue(items, attachments) {
  const kept = items.slice();
  let dropped = 0;
  while (kept.length && !fits({items: kept, attachments: []})) {
    kept.pop();
    dropped++;
  }
  const tray = attachments.slice();
  let trayDropped = false;
  while (tray.length && !fits({items: kept, attachments: tray})) {
    tray.pop();
    trayDropped = true;
  }
  return {items: kept, attachments: tray, dropped, trayDropped};
}

/* A bandeja não encolhe a fila: um anexo maior perde as últimas imagens até
   caber (e o que não caiu continua na sessão). */
function fitTray(items, images) {
  const tray = images.slice();
  let trayDropped = false;
  while (tray.length && !fits({items, attachments: tray})) {
    tray.pop();
    trayDropped = true;
  }
  return {items, attachments: tray, dropped: 0, trayDropped};
}

/* Sessões gravadas por esta execução: o que veio de outra execução é
   "recuperado" e nunca sai sozinho (a decisão é do núcleo, `heldOnLoad`). */
const touched = new Set();

/* Grava a entrada da conversa. `held` só muda quando vem de quem sabe (a fila);
   um save de bandeja preserva a guarda que já estava no arquivo. */
function commit(runtime, session, fitted, held) {
  const store = readStore(runtime);
  const previous = store[session];
  const entry = {items: fitted.items, attachments: fitted.attachments, held: typeof held === 'boolean' ? held : !!previous?.held};
  if (entry.items.length || entry.attachments.length) store[session] = entry;
  else delete store[session];
  pruneStore(store, session);
  writeStore(runtime, store);
  touched.add(session);
  return {items: entry.items, attachments: entry.attachments, held: entry.held, dropped: fitted.dropped, trayDropped: fitted.trayDropped};
}

/* O que está guardado para uma conversa (o renderer hidrata no boot e a cada
   troca de conversa). Nunca escreve. `live` diz se a gravação é desta execução. */
function readPending(runtime, session) {
  const entry = readStore(runtime)[session];
  return {
    items: entry ? entry.items : [],
    attachments: entry ? entry.attachments : [],
    held: !!entry?.held,
    live: touched.has(session),
  };
}

/* Save da fila (a cada mudança: enfileirar, remover, editar, enviar). */
function saveQueue(runtime, session, items, held) {
  const current = readPending(runtime, session);
  return commit(runtime, session, fitQueue(normalizeItems(items), current.attachments), held);
}

/* Save da bandeja do composer (anexar, remover, limpar). */
function saveTray(runtime, session, images) {
  const current = readPending(runtime, session);
  return commit(runtime, session, fitTray(current.items, normalizeImages(images)));
}

module.exports = {readPending, saveQueue, saveTray, FILENAME, MAX_STORED_BYTES};
