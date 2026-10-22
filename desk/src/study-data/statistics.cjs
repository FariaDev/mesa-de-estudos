'use strict';

/* Estatísticas locais de estudo (Mesa): `runtime/study-stats.json`.

   O que este arquivo guarda é EVIDÊNCIA, nunca estimativa:

   - tempo ativo: o host manda o batimento (a cada ~30 s) com a janela visível,
     o sistema acordado e a sessão rodando; o núcleo
     (`core/studystats.bend`) decide quantos segundos o intervalo vale. Batimento
     atrasado, pausa, `powerMonitor` suspenso e janela escondida não viram tempo;
   - perguntas enviadas: só a mensagem do usuário ACEITA e não duplicada conta
     (`addsPrompt`); recusa e reenvio repetido ficam fora;
   - tokens: entrada, saída e cache separados; o provedor que não informa fica
     `indisponível` (nunca vira zero comprovado);
   - dia/fuso: cada evento grava o dia civil LOCAL do momento (época + fuso);
     viajar não reescreve o passado;
   - dedupe: batimento usa id aleatório; pergunta aceita e uso do provedor têm
     registro próprio (impressão do id) que o ruído do batimento não expulsa;
   - reinício: um processo novo não herda a régua nem o congelamento do anterior
     — o intervalo fechado entre o último batimento e o reinício não vira tempo;
   - retroativo: evento com carimbo mais velho que o teto e sem `evidence`
     (caminho/registro nativo) é RECUSADO — o passado não é inventado.

   A API para o `main.cjs` é a mesma dos testes:
     recordActivity(runtime, {id, at, now, courseId, running, frozen, visible, evidence})
     recordPrompt(runtime, {id, at, now, courseId, accepted, duplicate, engine, model})
     recordUsage(runtime, {id, at, now, courseId, engine, model, input, output, cache})
     recordLifecycle(runtime, {id, at, now, kind})   // freeze|suspend|resume|hide|show
     control(runtime, {action, at, courseId})        // start|pause|resume|stop|idle
     summary(runtime, {now, period, courseId, tzOffset, west})
     reset(runtime, {confirm})

   O renderer NUNCA decide caminho nem escopo: `runtime` vem do host e o payload
   é sanitizado (número inteiro ≥ 0, texto cortado, id curto). A gravação é
   atômica (tmp + rename) e a leitura é tolerante: arquivo ilegível vira store
   vazio, nunca derruba o app. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {describeReceived} = require('../error-detail.mjs');

const FILENAME = 'study-stats.json';
const VERSION = 1;
const MAX_STORE_BYTES = 4 * 1024 * 1024;
const MAX_SEEN = 4000;
const MAX_SEEN_STABLE = 8000;
const MAX_PROMPTS = 20000;
const MAX_ID = 120;
const MAX_COURSE = 120;
const MAX_TEXT = 120;
const MAX_LABELS = 8;

/* Identidade do PROCESSO: o relógio do batimento não atravessa um reinício do
   app. Um evento gravado por outro processo não vira tempo de estudo nem deixa
   o congelamento antigo trancar a sessão nova. */
const PROCESS = Object.freeze({id: crypto.randomUUID().slice(0, 16), at: Date.now()});

/* Núcleo gerado. O teste aponta `MESA_STUDYSTATS_CORE` para o build temporário;
   no app o arquivo vem de `desk/src/generated/` (o pai regenera). */
let coreCache = null;
function core() {
  if (!coreCache) {
    const file = process.env.MESA_STUDYSTATS_CORE
      || path.join(__dirname, '..', 'generated', 'studystats.core.js');
    coreCache = require(file).default;
  }
  return coreCache;
}

const {isPlainObject} = require('../../plain-object.cjs');
const {toNat, wholeNat} = require('../bend-nat.mjs');
const whole = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
};
const timeOf = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
};
const textOf = (value, cap = MAX_TEXT) => (typeof value === 'string' ? value.slice(0, cap) : '');
const flag = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);
const courseKey = (value) => textOf(value, MAX_COURSE);
const idOf = (value) => textOf(value, MAX_ID);

/* `getTimezoneOffset()` do JS é o oeste positivo (UTC-3 → 180). O núcleo
   separa magnitude e lado porque `Nat.sub` satura. */
function tzOf(source = {}, at = Date.now()) {
  const raw = Number(source.tzOffset);
  const offset = Number.isFinite(raw) ? Math.trunc(raw) : new Date(at).getTimezoneOffset();
  return {offsetMinutes: Math.abs(offset), west: offset > 0};
}

function freshStore() {
  return {
    version: VERSION,
    activity: {},
    prompts: [],
    usage: {},
    meta: {
      createdAt: 0,
      activeAt: 0,
      resetAt: 0,
      frozen: false,
      beats: {},
      timer: {running: false, idle: false, held: false, courseId: '', startedAt: 0, seconds: 0},
      boot: {id: '', at: 0},
      seen: [],
      seenStable: [],
    },
  };
}

function emptyBucket() {
  return {seconds: 0, sessions: 0};
}

function normalizeBucket(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return {seconds: whole(source.seconds), sessions: whole(source.sessions)};
}

function normalizeCount(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return {available: flag(source.available), count: whole(source.count)};
}

const labelList = (raw) => (Array.isArray(raw) ? raw : [])
  .map((one) => textOf(one))
  .filter(Boolean)
  .slice(0, MAX_LABELS);

function normalizeBucketUsage(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return {
    input: normalizeCount(source.input),
    output: normalizeCount(source.output),
    cache: normalizeCount(source.cache),
    engine: textOf(source.engine),
    model: textOf(source.model),
    engines: labelList(source.engines),
    models: labelList(source.models),
  };
}

/* Leitura tolerante: qualquer coisa fora da forma vira vazio, e o teto de bytes
   evita carregar um arquivo corrompido gigante. */
function readStore(runtime) {
  const store = freshStore();
  let parsed;
  try {
    const file = fileOf(runtime);
    const stats = fs.statSync(file);
    if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return store;
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return store;
  }
  if (!isPlainObject(parsed)) return store;
  if (isPlainObject(parsed.activity)) {
    for (const [day, courses] of Object.entries(parsed.activity)) {
      if (!/^\d+$/.test(day) || !isPlainObject(courses)) continue;
      const bucket = {};
      for (const [course, value] of Object.entries(courses)) {
        bucket[courseKey(course)] = normalizeBucket(value);
      }
      store.activity[day] = bucket;
    }
  }
  if (isPlainObject(parsed.usage)) {
    for (const [day, courses] of Object.entries(parsed.usage)) {
      if (!/^\d+$/.test(day) || !isPlainObject(courses)) continue;
      const bucket = {};
      for (const [course, value] of Object.entries(courses)) {
        bucket[courseKey(course)] = normalizeBucketUsage(value);
      }
      store.usage[day] = bucket;
    }
  }
  if (Array.isArray(parsed.prompts)) {
    for (const raw of parsed.prompts) {
      if (!isPlainObject(raw)) continue;
      store.prompts.push({
        id: idOf(raw.id),
        day: whole(raw.day),
        courseId: courseKey(raw.courseId),
        engine: textOf(raw.engine),
        model: textOf(raw.model),
      });
      if (store.prompts.length >= MAX_PROMPTS) break;
    }
  }
  if (isPlainObject(parsed.meta)) {
    store.meta.createdAt = whole(parsed.meta.createdAt);
    store.meta.activeAt = whole(parsed.meta.activeAt);
    store.meta.resetAt = whole(parsed.meta.resetAt);
    store.meta.frozen = flag(parsed.meta.frozen);
    if (isPlainObject(parsed.meta.beats)) {
      for (const [course, value] of Object.entries(parsed.meta.beats)) {
        store.meta.beats[courseKey(course)] = timeOf(value);
      }
    }
    if (isPlainObject(parsed.meta.boot)) {
      store.meta.boot = {id: textOf(parsed.meta.boot.id, 80), at: timeOf(parsed.meta.boot.at)};
    }
    if (isPlainObject(parsed.meta.timer)) {
      const timer = parsed.meta.timer;
      store.meta.timer = {
        running: flag(timer.running),
        idle: flag(timer.idle),
        held: flag(timer.held),
        courseId: courseKey(timer.courseId),
        startedAt: timeOf(timer.startedAt),
        seconds: whole(timer.seconds),
        lastSession: isPlainObject(timer.lastSession) ? {
          seconds: whole(timer.lastSession.seconds),
          at: timeOf(timer.lastSession.at),
          courseId: courseKey(timer.lastSession.courseId),
          day: whole(timer.lastSession.day),
        } : null,
      };
    }
    if (Array.isArray(parsed.meta.seen)) {
      store.meta.seen = parsed.meta.seen.map(idOf).filter(Boolean).slice(-MAX_SEEN);
    }
    if (Array.isArray(parsed.meta.seenStable)) {
      store.meta.seenStable = parsed.meta.seenStable
        .filter((one) => typeof one === 'string' && /^[a-f0-9]{16}$/.test(one))
        .slice(-MAX_SEEN_STABLE);
    }
  }
  return store;
}

const fileOf = (runtime) => path.join(String(runtime), FILENAME);

function writeStore(runtime, store) {
  const file = fileOf(runtime);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const text = `${JSON.stringify(store, null, 1)}\n`;
  if (Buffer.byteLength(text, 'utf8') > MAX_STORE_BYTES) {
    /* Poda primeiro o log de prompts (o mais volumoso); os agregados por
       dia/matéria ficam — são poucos KB por ano. Se ainda passar do teto, os
       registros de dedupe também encolhem pela metade. */
    store.prompts = store.prompts.slice(-Math.floor(MAX_PROMPTS / 2));
    if (Buffer.byteLength(JSON.stringify(store), 'utf8') > MAX_STORE_BYTES) {
      store.meta.seenStable = store.meta.seenStable.slice(-Math.floor(MAX_SEEN_STABLE / 2));
      store.meta.seen = store.meta.seen.slice(-Math.floor(MAX_SEEN / 2));
    }
  }
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 1)}\n`, 'utf8');
  fs.renameSync(temporary, file);
  return store;
}

function isDuplicate(store, id) {
  return !!id && store.meta.seen.includes(id);
}

function addSeen(store, id) {
  if (!id) return;
  store.meta.seen.push(id);
  if (store.meta.seen.length > MAX_SEEN) store.meta.seen = store.meta.seen.slice(-MAX_SEEN);
}

/* IDs estáveis (pergunta aceita e uso do provedor) têm registro próprio: o
   batimento usa id aleatório que nunca se repete e não pode expulsar o dedupe
   dos eventos que importam. Guarda só a impressão do id para o arquivo não
   crescer; o registro antigo (`seen`) continua consultado como legado. */
const stablePrint = (id) => crypto.createHash('sha1').update(id).digest('hex').slice(0, 16);

function isStableDuplicate(store, id) {
  return !!id && (store.meta.seen.includes(id) || store.meta.seenStable.includes(stablePrint(id)));
}

function addStableSeen(store, id) {
  if (!id) return;
  store.meta.seenStable.push(stablePrint(id));
  if (store.meta.seenStable.length > MAX_SEEN_STABLE) {
    store.meta.seenStable = store.meta.seenStable.slice(-MAX_SEEN_STABLE);
  }
}

/* Um processo novo não herda a régua nem o congelamento do anterior: o
   intervalo fechado entre o último batimento e o reinício não vira tempo. */
const restarted = (store) => !!store.meta.boot.id && store.meta.boot.id !== PROCESS.id;
const claimBoot = (store) => { store.meta.boot = {id: PROCESS.id, at: PROCESS.at}; };

function labelMerge(current, single, incoming) {
  const out = [];
  for (const value of [typeof current === 'string' ? current : '', ...(Array.isArray(current) ? current : []), single, incoming]) {
    const text = textOf(value);
    if (text && !out.includes(text) && out.length < MAX_LABELS) out.push(text);
  }
  return out;
}

function dayOf(seconds, tz) {
  return Number(core().dayNumber(
    wholeNat(seconds),
    wholeNat(tz.offsetMinutes),
    Boolean(tz.west),
  ));
}

function localDay(at, tz) {
  return dayOf(Math.floor(Math.max(0, at) / 1000), tz);
}

function addActivity(store, day, courseId, seconds, sessions) {
  const key = String(day);
  if (!isPlainObject(store.activity[key])) store.activity[key] = {};
  const course = courseKey(courseId);
  const bucket = store.activity[key][course] || emptyBucket();
  store.activity[key][course] = {
    seconds: bucket.seconds + whole(seconds),
    sessions: bucket.sessions + whole(sessions),
  };
}

function timerOf(store) {
  const timer = store.meta.timer;
  const seconds = whole(timer.seconds);
  return {
    running: !!timer.running,
    idle: !!timer.idle,
    held: !!timer.held,
    courseId: timer.courseId || '',
    startedAt: timer.startedAt || 0,
    seconds,
    label: core().durationLabel(wholeNat(seconds)),
    lastSession: timer.lastSession ? {...timer.lastSession} : null,
  };
}

/* ---------- eventos ---------- */

/* Batimento de atividade. Sem `id`, o evento não tem dedupe (o host sempre
   manda um). Devolve os segundos que entraram (0 quando não há evidência). */
function recordActivity(runtime, event = {}) {
  const store = readStore(runtime);
  const id = idOf(event.id);
  if (isDuplicate(store, id)) {
    return {counted: 0, duplicate: true, timer: timerOf(store), store};
  }
  const at = timeOf(event.at, Date.now());
  const now = timeOf(event.now, at);
  const tz = tzOf(event, at);
  const day = localDay(at, tz);
  const courseId = courseKey(event.courseId);
  const timer = store.meta.timer;
  const booted = restarted(store);
  const running = event.running == null ? !!timer.running : flag(event.running);
  const frozen = booted ? flag(event.frozen, false) : (event.frozen == null ? !!store.meta.frozen : flag(event.frozen));
  const visible = event.visible == null ? true : flag(event.visible);
  const evidence = textOf(event.evidence, 200);
  const gapCapMs = Number(core().maxGap()) * 1000;

  /* Retroativo só com evidência nativa: um carimbo mais velho que o teto do
     núcleo não vira tempo sem o registro de onde ele veio. */
  if (now - at > gapCapMs && !evidence) {
    addSeen(store, id);
    writeStore(runtime, store);
    return {counted: 0, rejected: 'retroactive-without-evidence', timer: timerOf(store), store};
  }

  const previous = timeOf(store.meta.beats[courseId] || 0);
  let counted = 0;
  if (!booted && running && previous > 0) {
    counted = Number(core().activeSeconds(
      wholeNat(previous / 1000),
      wholeNat(at / 1000),
      true,
      frozen,
      visible,
    ));
  }
  if (counted > 0) {
    store.meta.activeAt = Math.max(store.meta.activeAt, at);
    addActivity(store, day, courseId, counted, 0);
    timer.seconds = whole(timer.seconds) + counted;
  }
  /* O batimento com a sessão rodando vira a nova régua; parado, a régua fica
     onde estava para a pausa não virar tempo no próximo `retomar`. */
  if (running) store.meta.beats[courseId] = at;
  if (booted) store.meta.frozen = frozen;
  claimBoot(store);
  addSeen(store, id);
  writeStore(runtime, store);
  return {counted, duplicate: false, restarted: booted, timer: timerOf(store), store};
}

/* Pergunta enviada: só aceita e não duplicada. O `duplicate` vem do host (a
   mesma pergunta reenviada por repetição de fila). */
function recordPrompt(runtime, event = {}) {
  const store = readStore(runtime);
  const id = idOf(event.id);
  const at = timeOf(event.at, Date.now());
  const tz = tzOf(event, at);
  const day = localDay(at, tz);
  const courseId = courseKey(event.courseId);
  const duplicate = flag(event.duplicate) || isStableDuplicate(store, id);
  const counts = core().addsPrompt(flag(event.accepted), duplicate);
  if (counts) {
    store.meta.activeAt = Math.max(store.meta.activeAt, at);
    store.prompts.push({
      id,
      day,
      courseId,
      engine: textOf(event.engine),
      model: textOf(event.model),
    });
    if (store.prompts.length > MAX_PROMPTS) {
      store.prompts = store.prompts.slice(-MAX_PROMPTS);
    }
  }
  addStableSeen(store, id);
  writeStore(runtime, store);
  return {counted: counts, duplicate, store};
}

function tokenInput(raw) {
  if (raw == null) return {available: false, count: 0};
  if (typeof raw === 'number') return {available: true, count: whole(raw)};
  const source = isPlainObject(raw) ? raw : {};
  return {available: flag(source.available), count: whole(source.count)};
}

function toCoreToken(raw) {
  const token = tokenInput(raw);
  return {$: 'TokenCount', available: token.available, count: wholeNat(token.count)};
}

function fromCoreUsage(usage) {
  return {
    input: {available: !!usage.input.available, count: Number(usage.input.count)},
    output: {available: !!usage.output.available, count: Number(usage.output.count)},
    cache: {available: !!usage.cache.available, count: Number(usage.cache.count)},
  };
}

/* Uso do provedor: mescla por dia/matéria com `usageAdd` — falta + número
   continua número; falta + falta continua `indisponível`. */
function recordUsage(runtime, event = {}) {
  const store = readStore(runtime);
  const id = idOf(event.id);
  if (isStableDuplicate(store, id)) {
    return {merged: false, duplicate: true, store};
  }
  const at = timeOf(event.at, Date.now());
  const tz = tzOf(event, at);
  const day = localDay(at, tz);
  const courseId = courseKey(event.courseId);
  const key = String(day);
  if (!isPlainObject(store.usage[key])) store.usage[key] = {};
  const current = store.usage[key][courseId] || normalizeBucketUsage({});
  const merged = core().usageAdd(
    {$: 'StatsUsage', input: toCoreToken(current.input), output: toCoreToken(current.output), cache: toCoreToken(current.cache)},
    {$: 'StatsUsage', input: toCoreToken(event.input), output: toCoreToken(event.output), cache: toCoreToken(event.cache)},
  );
  store.usage[key][courseId] = {
    ...fromCoreUsage(merged),
    engine: textOf(event.engine) || current.engine,
    model: textOf(event.model) || current.model,
    /* O rótulo do último evento não apaga os anteriores: o resumo precisa ver
       todo motor/modelo que contribuiu com tokens na janela. */
    engines: labelMerge(current.engines, current.engine, event.engine),
    models: labelMerge(current.models, current.model, event.model),
  };
  addStableSeen(store, id);
  writeStore(runtime, store);
  return {merged: true, duplicate: false, store};
}

/* Congelamento/suspensão/visibilidade: a régua do batimento anda para o agora
   e nenhum intervalo atravessa o evento. */
function recordLifecycle(runtime, event = {}) {
  const store = readStore(runtime);
  const id = idOf(event.id);
  const at = timeOf(event.at, Date.now());
  const kind = textOf(event.kind, 40);
  const known = ['freeze', 'suspend', 'resume', 'hide', 'show'];
  if (!known.includes(kind)) throw new Error(`evento de ciclo de vida desconhecido: ${kind}`);
  if (isDuplicate(store, id)) return {applied: false, duplicate: true, store};
  for (const course of Object.keys(store.meta.beats)) store.meta.beats[course] = at;
  if (kind === 'freeze' || kind === 'suspend') store.meta.frozen = true;
  if (kind === 'resume' || kind === 'show') store.meta.frozen = false;
  store.meta.lifecycle = {kind, at};
  claimBoot(store);
  addSeen(store, id);
  writeStore(runtime, store);
  return {applied: true, duplicate: false, store};
}

/* Sessão (modo timer): começar, pausar, continuar, parar e ficar ocioso. O
   tempo da sessão é o tempo ATIVO contado pelos batimentos; parar marca a
   sessão só quando ela passou de zero. Desde a #70 o batimento liga a sessão
   sozinho (`services.beat`); `by: 'user'` marca a pausa ou a parada que o aluno
   escolheu (`held`), e só ela segura o cronômetro. */
function control(runtime, event = {}) {
  const store = readStore(runtime);
  const at = timeOf(event.at, Date.now());
  const action = textOf(event.action, 20);
  const courseId = courseKey(event.courseId) || store.meta.timer.courseId;
  const timer = store.meta.timer;
  if (action === 'start' || action === 'resume') timer.held = false;
  if ((action === 'pause' || action === 'stop') && event.by === 'user') timer.held = true;
  /* Sessão nova em processo novo destrava o congelamento herdado do anterior. */
  if (restarted(store)) store.meta.frozen = false;
  switch (action) {
    case 'start':
      timer.running = true;
      timer.idle = false;
      timer.courseId = courseId;
      timer.startedAt = at;
      timer.seconds = 0;
      store.meta.beats[courseId] = at;
      break;
    case 'resume':
      timer.running = true;
      timer.idle = false;
      if (!timer.startedAt) timer.startedAt = at;
      store.meta.beats[courseId] = at;
      break;
    case 'pause':
      timer.running = false;
      timer.idle = false;
      store.meta.beats[courseId] = at;
      break;
    case 'idle':
      timer.running = false;
      timer.idle = true;
      store.meta.beats[courseId] = at;
      break;
    case 'stop': {
      timer.running = false;
      timer.idle = false;
      const seconds = whole(timer.seconds);
      if (timer.courseId && core().qualifiesSession(wholeNat(seconds))) {
        const day = localDay(at, tzOf(event, at));
        addActivity(store, day, timer.courseId, 0, 1);
        timer.lastSession = {seconds, at, courseId: timer.courseId, day};
      }
      timer.seconds = 0;
      timer.startedAt = 0;
      store.meta.beats[timer.courseId] = at;
      break;
    }
    default:
      throw new Error(`ação de sessão desconhecida: ${action || '(vazia)'}`);
  }
  store.meta.activeAt = Math.max(store.meta.activeAt, at);
  claimBoot(store);
  writeStore(runtime, store);
  return timerOf(store);
}

/* ---------- resumo ---------- */

function periodOf(value) {
  if (value === 'all' || value === 'tudo' || value === 'todo' || value === 0) return {$: 'PeriodAll'};
  if (value === '30' || value === 30) return {$: 'PeriodMonth'};
  return {$: 'PeriodWeek'};
}

function periodName(period) {
  if (period === '30' || period === 30) return '30';
  if (period === 'all' || period === 'tudo' || period === 'todo' || period === 0) return 'all';
  return '7';
}

/* Dia → data local (para o rótulo do eixo). O dia já é local; o Date só lê os
   componentes UTC do número do dia para não deslocar de novo. */
function weekdayOf(day) {
  return core().weekdayLabel(toNat(new Date(day * 86400000).getUTCDay()));
}

function summary(runtime, options = {}) {
  const store = readStore(runtime);
  const now = timeOf(options.now, Date.now());
  const tz = tzOf(options, now);
  const period = periodOf(options.period);
  const name = periodName(options.period);
  const today = localDay(now, tz);
  const start = Number(core().windowStart(wholeNat(today), period));
  const filter = courseKey(options.courseId);
  const inWindow = (day) => core().inPeriod(wholeNat(day), wholeNat(today), period);

  const buckets = new Map();
  const touch = (day) => {
    if (!buckets.has(day)) buckets.set(day, {seconds: 0, sessions: 0});
  };
  for (const [rawDay, courses] of Object.entries(store.activity)) {
    const day = Number(rawDay);
    if (!inWindow(day)) continue;
    for (const [course, bucket] of Object.entries(courses)) {
      const key = filter && filter !== course ? null : course;
      if (key === null) continue;
      touch(day);
      const entry = buckets.get(day);
      entry.seconds += bucket.seconds;
      entry.sessions += bucket.sessions;
    }
  }

  const promptsByDay = new Map();
  const promptsByCourse = new Map();
  let promptTotal = 0;
  for (const prompt of store.prompts) {
    if (!inWindow(prompt.day)) continue;
    if (filter && prompt.courseId !== filter) continue;
    promptTotal += 1;
    touch(prompt.day);
    promptsByDay.set(prompt.day, (promptsByDay.get(prompt.day) || 0) + 1);
    promptsByCourse.set(prompt.courseId, (promptsByCourse.get(prompt.courseId) || 0) + 1);
  }

  const usage = core().usageEmpty();
  const engines = new Set();
  const models = new Set();
  for (const [rawDay, courses] of Object.entries(store.usage)) {
    const day = Number(rawDay);
    if (!inWindow(day)) continue;
    touch(day);
    for (const [course, bucket] of Object.entries(courses)) {
      if (filter && filter !== course) continue;
      for (const label of bucket.engines.length ? bucket.engines : (bucket.engine ? [bucket.engine] : [])) engines.add(label);
      for (const label of bucket.models.length ? bucket.models : (bucket.model ? [bucket.model] : [])) models.add(label);
      const merged = core().usageAdd(usage, {
        $: 'StatsUsage',
        input: toCoreToken(bucket.input),
        output: toCoreToken(bucket.output),
        cache: toCoreToken(bucket.cache),
      });
      usage.input = merged.input;
      usage.output = merged.output;
      usage.cache = merged.cache;
    }
  }

  const series = [];
  if (name === 'all') {
    const days = [...buckets.keys()].sort((a, b) => a - b).slice(-Number(core().maxHistoryDays()));
    for (const day of days) {
      const entry = buckets.get(day);
      series.push({day, weekday: weekdayOf(day), seconds: entry.seconds, sessions: entry.sessions, prompts: promptsByDay.get(day) || 0});
    }
  } else {
    for (let day = start; day <= today; day += 1) {
      const entry = buckets.get(day);
      series.push({
        day,
        weekday: weekdayOf(day),
        seconds: entry ? entry.seconds : 0,
        sessions: entry ? entry.sessions : 0,
        prompts: promptsByDay.get(day) || 0,
      });
    }
  }
  for (const day of series) {
    day.secondsLabel = core().durationLabel(wholeNat(day.seconds));
    day.minutes = Math.round(day.seconds / 60);
  }

  const totals = series.reduce((acc, day) => ({
    seconds: acc.seconds + day.seconds,
    sessions: acc.sessions + day.sessions,
    prompts: acc.prompts + day.prompts,
  }), {seconds: 0, sessions: 0, prompts: 0});
  totals.prompts = promptTotal;

  const courses = [];
  const courseSeconds = new Map();
  for (const [day, coursesOfDay] of Object.entries(store.activity)) {
    if (!inWindow(Number(day))) continue;
    for (const [course, bucket] of Object.entries(coursesOfDay)) {
      if (filter && filter !== course) continue;
      const entry = courseSeconds.get(course) || {seconds: 0, sessions: 0, prompts: 0};
      entry.seconds += bucket.seconds;
      entry.sessions += bucket.sessions;
      courseSeconds.set(course, entry);
    }
  }
  for (const [course, entry] of courseSeconds) {
    courses.push({
      courseId: course,
      seconds: entry.seconds,
      secondsLabel: core().durationLabel(wholeNat(entry.seconds)),
      sessions: entry.sessions,
      prompts: promptsByCourse.get(course) || 0,
    });
  }
  for (const [course, prompts] of promptsByCourse) {
    if (!courseSeconds.has(course)) courses.push({courseId: course, seconds: 0, secondsLabel: core().durationLabel(0), sessions: 0, prompts});
  }
  courses.sort((a, b) => (b.seconds - a.seconds) || a.courseId.localeCompare(b.courseId));

  return {
    period: name,
    periodLabel: core().periodTitle(period),
    today,
    windowStart: start,
    series,
    totals,
    labels: {
      active: core().durationLabel(wholeNat(totals.seconds)),
      sessions: core().countLabel(wholeNat(totals.sessions)),
      prompts: core().countLabel(wholeNat(totals.prompts)),
      input: core().tokenLabel(usage.input),
      output: core().tokenLabel(usage.output),
      cache: core().tokenLabel(usage.cache),
    },
    courses,
    usage: fromCoreUsage(usage),
    engines: [...engines].sort(),
    models: [...models].sort(),
    timer: timerOf(store),
    recordedSince: store.meta.createdAt || 0,
    resetAt: store.meta.resetAt || 0,
    generatedAt: now,
    tz,
  };
}

/* Reset consciente: exige confirmação explícita e preserva o dedupe (evento
   repetido da fila não ressuscita o que foi apagado). */
function reset(runtime, options = {}) {
  if (options.confirm !== true && options.confirm !== 'reset') {
    throw new Error(`apagar as estatísticas exige confirmação explícita: recebido confirm=${describeReceived(options.confirm)}; esperado true|"reset"`);
  }
  const previous = readStore(runtime);
  const store = freshStore();
  store.meta.createdAt = previous.meta.createdAt || Date.now();
  store.meta.resetAt = Date.now();
  store.meta.activeAt = Math.max(previous.meta.activeAt, store.meta.resetAt);
  store.meta.seen = previous.meta.seen.slice(-MAX_SEEN);
  store.meta.seenStable = previous.meta.seenStable.slice(-MAX_SEEN_STABLE);
  writeStore(runtime, store);
  return {cleared: true, resetAt: store.meta.resetAt};
}

module.exports = {
  FILENAME,
  readStore,
  recordActivity,
  recordPrompt,
  recordUsage,
  recordLifecycle,
  control,
  summary,
  reset,
  timerOf,
  periodOf,
  dayOf,
  localDay,
};
