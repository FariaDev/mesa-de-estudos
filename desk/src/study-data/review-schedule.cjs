'use strict';

/* Caderno de revisão — agenda (Mesa): `runtime/review-schedule.json`.

   O caderno antigo (`runtime/review.json`) guarda o item como o aluno escreveu
   (questão, tentativa, dificuldade, referência). Este arquivo guarda a AGENDA
   por cima do mesmo item:

   - `id` estável (hash da chave questão+nome+página+caminho, normalizada pelo
     núcleo `core/reviewschedule.bend`) — reabrir o caderno nunca duplica, e
     editar a questão gera id novo;
   - `interval`, `reps`, `lapses`, `due` (dia civil local) e `lastResult`;
   - `history` (mais novo primeiro, teto de 50) com dia e resultado;
   - `active`: o item ainda está no caderno? Item removido do caderno NÃO perde
     o histórico — fica inativo e a UI mostra "não está mais no caderno";
   - `refState`: referência ok, não encontrada ou fora da biblioteca é um
     ESTADO VISÍVEL — nunca um filtro que esconde o item.

   Migração: `sync(runtime, {courseId, items, today, at})` recebe os itens do
   `review.json` (o mesmo `readItems` do host) e cria a agenda que falta, com
   vencimento HOJE (nada fica escondido esperando data). O que já tem agenda é
   preservado; marcar/desmarcar `active` não mexe no histórico.

   A API para o `main.cjs` é a mesma dos testes:
     sync(runtime, {courseId, items, today, at, exists, allowed})
       -> {items, added, kept}
     listItems(runtime, {courseId, today, exists, allowed})
       -> itens normalizados com dueNow/nextLabel/refState/refNote
     dueItems(runtime, {courseId, today, exists, allowed})
       -> ativos vencidos, ordenados por due e questão
     grade(runtime, {courseId, id, result, at, today})
       -> item com a agenda nova (intervalo, próxima data, histórico)
     summary(runtime, {courseId, today, exists, allowed})
       -> {due, total, active, history}
     stableId({question, ref})

   Datas são dias inteiros no fuso do host (`dayOf` do módulo de estatísticas —
   uma régua só). O renderer nunca manda caminho: `runtime` vem do host,
   `exists`/`allowed` vêm do host, e o payload é sanitizado. Gravação atômica;
   leitura tolerante. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const stats = require('./statistics.cjs');
const {message} = require('../i18n.mjs');

const FILENAME = 'review-schedule.json';
const VERSION = 1;
const MAX_STORE_BYTES = 2 * 1024 * 1024;
const MAX_COURSE = 120;
const MAX_ID = 40;
const MAX_QUESTION = 400;
const MAX_ATTEMPT = 400;
const MAX_DIFFICULTY = 240;
const MAX_NAME = 60;
const MAX_PATH = 1024;
const MAX_TAG = 20;
const MAX_HISTORY = 50;
const ID_LENGTH = 16;

let coreCache = null;
function core() {
  if (!coreCache) {
    const file = process.env.MESA_REVIEWSCHEDULE_CORE
      || path.join(__dirname, '..', 'generated', 'reviewschedule.core.js');
    coreCache = require(file).default;
  }
  return coreCache;
}

const {isPlainObject} = require('../../plain-object.cjs');
const {toNat, wholeNat} = require('../bend-nat.mjs');
const NIL = {$: 'Nil'};
const coreListOf = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const whole = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
};
const timeOf = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
};
const textOf = (value, cap) => (typeof value === 'string' ? value.slice(0, cap) : '');
const courseKey = (value) => textOf(value, MAX_COURSE);

function freshStore() {
  return {version: VERSION, courses: {}, meta: {createdAt: 0, lastSync: 0}};
}

function fileOf(runtime) {
  return path.join(String(runtime), FILENAME);
}

/* Mesma régua de dia do módulo de estatísticas: um só dia civil local. */
function dayOf(at, tzOffset, west) {
  return stats.dayOf(Math.floor(Math.max(0, timeOf(at, Date.now())) / 1000), {
    offsetMinutes: Math.abs(Number.isFinite(Number(tzOffset)) ? Math.trunc(Number(tzOffset)) : 0),
    west: west == null ? Number(tzOffset) > 0 : Boolean(west),
  });
}

function localDay(at, tzOffset) {
  const offset = Number.isFinite(Number(tzOffset)) ? Math.trunc(Number(tzOffset)) : new Date(at).getTimezoneOffset();
  return dayOf(at, offset, offset > 0);
}

/* ---------- leitura/gravação ---------- */

function normalizeRef(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return {
    name: textOf(source.name, MAX_NAME),
    page: whole(source.page),
    path: textOf(source.path, MAX_PATH),
  };
}

function normalizeLog(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const result = textOf(source.result, MAX_TAG);
  const order = coreArray(core().resultsOrder());
  return {
    day: whole(source.day),
    result: core().resultTag(order.find((one) => core().tagMatches(one, result)) || order[0]),
    at: timeOf(source.at),
  };
}

function normalizeItem(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return {
    id: textOf(source.id, MAX_ID),
    question: textOf(source.question, MAX_QUESTION),
    attempt: textOf(source.attempt, MAX_ATTEMPT),
    difficulty: textOf(source.difficulty, MAX_DIFFICULTY),
    ref: normalizeRef(source.ref),
    interval: whole(source.interval),
    reps: whole(source.reps),
    lapses: whole(source.lapses),
    due: whole(source.due),
    lastResult: textOf(source.lastResult, MAX_TAG),
    history: (Array.isArray(source.history) ? source.history : []).slice(0, MAX_HISTORY).map(normalizeLog),
    createdAt: timeOf(source.createdAt),
    updatedAt: timeOf(source.updatedAt),
    active: source.active === false ? false : true,
  };
}

function readStore(runtime) {
  const store = freshStore();
  let parsed;
  try {
    const file = fileOf(runtime);
    const info = fs.statSync(file);
    if (!info.isFile() || info.size > MAX_STORE_BYTES) return store;
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return store;
  }
  if (!isPlainObject(parsed)) return store;
  if (isPlainObject(parsed.courses)) {
    for (const [course, bucket] of Object.entries(parsed.courses)) {
      if (!isPlainObject(bucket)) continue;
      store.courses[courseKey(course)] = {
        items: (Array.isArray(bucket.items) ? bucket.items : []).map(normalizeItem),
      };
    }
  }
  if (isPlainObject(parsed.meta)) {
    store.meta.createdAt = timeOf(parsed.meta.createdAt);
    store.meta.lastSync = timeOf(parsed.meta.lastSync);
  }
  return store;
}

function writeStore(runtime, store) {
  const file = fileOf(runtime);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 1)}\n`, 'utf8');
  fs.renameSync(temporary, file);
  return store;
}

/* ---------- identidade estável ---------- */

function stableId(item = {}) {
  const ref = isPlainObject(item.ref) ? item.ref : {};
  const source = core().keySource(
    textOf(item.question, MAX_QUESTION),
    textOf(ref.name, MAX_NAME),
    wholeNat(ref.page),
    textOf(ref.path, MAX_PATH),
  );
  return crypto.createHash('sha1').update(source).digest('hex').slice(0, ID_LENGTH);
}

/* ---------- referência visível ---------- */

/* `allowed` pode vir como Set (o host padrão), lista ou predicado
   (`file => permitido`), como o adapter de serviços usa. Ausente = não acusa;
   coleção vazia ACUSA fora, como o `annotateVisibility` do Caderno — a mesma
   referência não pode aparecer "ok" num painel e "fora" no outro. */
function inLibrary(allowed, path) {
  if (!allowed) return true;
  if (typeof allowed === 'function') return allowed(path) !== false;
  if (Array.isArray(allowed)) return allowed.includes(path);
  if (typeof allowed.has === 'function') return allowed.has(path);
  return true;
}

function refStateOf(ref, exists, allowed) {
  const hasPath = !!String(ref.path || '').trim();
  const missing = hasPath && !(typeof exists === 'function' ? exists(ref.path) : fs.existsSync(ref.path));
  const state = core().refState(hasPath, missing, inLibrary(allowed, ref.path));
  return {state, note: core().refNote(state)};
}

function refStateName(state) {
  switch (state.$) {
    case 'RefMissing': return 'missing';
    case 'RefOutside': return 'outside';
    default: return 'ok';
  }
}

/* ---------- item para a UI ---------- */

function viewOf(item, today, exists, allowed) {
  const reference = refStateOf(item.ref, exists, allowed);
  return {
    ...item,
    dueNow: core().isDue(wholeNat(item.due), wholeNat(today)),
    refState: refStateName(reference.state),
    refNote: reference.note,
    nextLabel: core().nextLabel(wholeNat(item.due), wholeNat(today)),
  };
}

/* ---------- migração/sincronização ---------- */

function itemFromChecklist(one, at, today) {
  const source = isPlainObject(one) ? one : {};
  const ref = normalizeRef(source.ref);
  const item = normalizeItem({
    id: stableId({...source, ref}),
    question: source.question,
    attempt: source.attempt,
    difficulty: source.difficulty,
    ref,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: today,
    lastResult: '',
    history: [],
    createdAt: at,
    updatedAt: at,
    active: true,
  });
  if (!item.question.trim()) return null;
  return item;
}

/* Sincroniza a agenda com o caderno: cria o que falta (vencendo hoje), marca o
   que ainda está no caderno e desativa (sem apagar) o que saiu. */
function sync(runtime, options = {}) {
  const store = readStore(runtime);
  const courseId = courseKey(options.courseId);
  const at = timeOf(options.at, Date.now());
  const today = whole(options.today);
  const bucket = store.courses[courseId] || {items: []};
  const byId = new Map(bucket.items.map((item) => [item.id, item]));
  let added = 0;
  let kept = 0;
  for (const one of Array.isArray(options.items) ? options.items : []) {
    const item = itemFromChecklist(one, at, today);
    if (!item) continue;
    if (byId.has(item.id)) {
      /* O caderno manda no texto; a agenda manda nas datas. */
      const current = byId.get(item.id);
      current.question = item.question;
      current.attempt = item.attempt;
      current.difficulty = item.difficulty;
      current.ref = item.ref;
      current.active = true;
      current.updatedAt = at;
      kept += 1;
      continue;
    }
    byId.set(item.id, item);
    added += 1;
  }
  const present = new Set();
  for (const one of Array.isArray(options.items) ? options.items : []) {
    const item = itemFromChecklist(one, at, today);
    if (item) present.add(item.id);
  }
  for (const item of byId.values()) {
    if (!present.has(item.id)) item.active = false;
  }
  const items = [...byId.values()];
  store.courses[courseId] = {items};
  store.meta.createdAt = store.meta.createdAt || at;
  store.meta.lastSync = at;
  writeStore(runtime, store);
  return {items: items.map((item) => viewOf(item, today, options.exists, options.allowed)), added, kept};
}

function listItems(runtime, options = {}) {
  const store = readStore(runtime);
  const courseId = courseKey(options.courseId);
  const today = whole(options.today);
  const bucket = store.courses[courseId];
  if (!bucket) return [];
  return bucket.items
    .slice()
    .sort((a, b) => (a.due - b.due) || a.question.localeCompare(b.question))
    .map((item) => viewOf(item, today, options.exists, options.allowed));
}

function dueItems(runtime, options = {}) {
  return listItems(runtime, options).filter((item) => item.active && item.dueNow);
}

function summary(runtime, options = {}) {
  const store = readStore(runtime);
  const courseId = courseKey(options.courseId);
  const today = whole(options.today);
  const items = (store.courses[courseId]?.items || []).map((item) => viewOf(item, today, options.exists, options.allowed));
  const active = items.filter((item) => item.active);
  const due = active.filter((item) => item.dueNow);
  const history = items.reduce((count, item) => count + item.history.length, 0);
  return {
    due: due.length,
    total: items.length,
    active: active.length,
    inactive: items.length - active.length,
    history,
    dueLabel: core().dueCount(toNat(due.length)),
  };
}

/* ---------- marcar o resultado ---------- */

function grade(runtime, options = {}) {
  const store = readStore(runtime);
  const courseId = courseKey(options.courseId);
  const tag = textOf(options.result, MAX_TAG);
  const result = coreArray(core().resultsOrder()).find((one) => core().tagMatches(one, tag));
  if (!result) throw new Error(message('review.error.unknownResult', {tag: tag || '(vazio)'}));
  const bucket = store.courses[courseId];
  const id = textOf(options.id, MAX_ID);
  const item = bucket?.items.find((one) => one.id === id);
  if (!item) throw new Error(message('review.error.itemNotFound'));
  const at = timeOf(options.at, Date.now());
  const today = whole(options.today);
  const previous = toCoreState(item);
  const next = core().stateAfter(wholeNat(today), previous, result);
  const pushed = fromCoreHistory(core().pushHistory(
    toCoreHistory(item.history),
    {$: 'ReviewLog', day: wholeNat(today), result},
  ));
  /* O núcleo manda no dia/resultado; o `at` de cada linha é do host. O novo
     log é o primeiro e a cauda acompanha o histórico antigo. */
  const tail = item.history.slice(0, MAX_HISTORY - 1);
  item.history = pushed.map((log, index) => ({...log, at: index === 0 ? at : (tail[index - 1]?.at || at)}));
  item.interval = Number(next.interval);
  item.reps = Number(next.reps);
  item.lapses = Number(next.lapses);
  item.due = Number(next.due);
  item.lastResult = core().resultTag(result);
  item.updatedAt = at;
  writeStore(runtime, store);
  return {
    item: viewOf(item, today, options.exists, options.allowed),
    explain: core().explain(wholeNat(previous.interval), result),
    nextDue: item.due,
    nextLabel: core().nextLabel(wholeNat(item.due), wholeNat(today)),
  };
}

function toCoreState(item) {
  return {
    $: 'ScheduleState',
    interval: wholeNat(item.interval),
    reps: wholeNat(item.reps),
    lapses: wholeNat(item.lapses),
    due: wholeNat(item.due),
  };
}

function toCoreHistory(history) {
  const order = coreArray(core().resultsOrder());
  return coreListOf((Array.isArray(history) ? history : []).slice(0, MAX_HISTORY).map((log) => ({
    $: 'ReviewLog',
    day: wholeNat(log.day),
    result: order.find((one) => core().tagMatches(one, textOf(log.result, MAX_TAG))) || order[0],
  })));
}

function fromCoreHistory(history) {
  const out = [];
  for (const log of coreArray(history)) {
    out.push({day: Number(log.day), result: core().resultTag(log.result), at: 0});
  }
  return out;
}

module.exports = {
  FILENAME,
  readStore,
  writeStore,
  stableId,
  sync,
  listItems,
  dueItems,
  summary,
  grade,
  dayOf,
  localDay,
};
