'use strict';

/* Store imutável das atividades do tutor, por conversa.
 *
 * Layout (nunca sai de <runtime>/activities/):
 *   activities/<sha256(identidade portátil)[0:24]>/
 *     index.json                 {schema, conversationId, portableId, items:[…]}
 *     docs/<id>-v<version>.json  {schema, hash, spec}
 *     state.json                 {schema, items:{"<id>@<v>@<hash>":{state,updatedAt}}}
 *
 * Identidade portátil: o diretório NÃO é o hash do caminho absoluto da conversa.
 * Caminho dentro do runtime vira caminho relativo (`rel:pi-123.jsonl`); id
 * opaco (ex.: free session) vira `id:<uuid>`. Assim o backup que restaura em
 * outro runtime encontra o mesmo diretório depois de a conversa mudar de lugar.
 * Índices antigos (chave pelo caminho absoluto, sem `portableId`) continuam
 * legíveis: a busca valida por caminho relativo equivalente e, na primeira
 * gravação, o índice é remapeado para a identidade portátil.
 *
 * Regras:
 *   - o documento de uma versão nunca muda; regerar cria versão nova;
 *   - dedupe idempotente por (toolCallId|callRef) + hash: retry devolve o
 *     MESMO item, sem duplicar;
 *   - corrupção é preservada no disco e vira erro (nunca "sumiu");
 *   - o renderer/modelo nunca informa caminho: só ids opacos validados;
 *   - tetos: spec 64 KiB UTF-8 somada, estado 16 KiB por versão.
 *
 * Erros: ActivityStoreError {code} — BAD_SPEC, BAD_INPUT, CORRUPT, MISSING,
 * STALE, TOO_BIG, LIMIT. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {message: uiMsg} = require('./src/i18n.mjs');
const {causeText, describeReceived, invalidValue} = require('./src/error-detail.mjs');

const SCHEMA = 1;
const MAX_TITLE = 160;
const MAX_OBJECTIVE = 300;
const MAX_ALTERNATIVE = 8000;
const MAX_HTML = 51200;
const MAX_CSS = 32768;
const MAX_JS = 32768;
const MAX_SPEC_BYTES = 65536;
/* Contrato de estado: `values` ≤ 16 KiB e `attempt` ≤ 4 KiB, medidos em JSON
   UTF-8; o envelope `{values, attempt}` completo ≤ 21 KiB. Assim um estado de
   16 KiB com uma tentativa de 4 KiB não é descartado em silêncio. */
const MAX_VALUES_BYTES = 16384;
const MAX_ATTEMPT_BYTES = 4096;
const MAX_STATE_ENVELOPE_BYTES = 21504;
const MAX_STATE_BYTES = MAX_VALUES_BYTES; // compat: teto dos valores
const MAX_ITEMS = 200;
const MAX_CONVERSATION = 512;
const MAX_TOOL_CALL = 160;
const MAX_CALL_REF = 64;
const MAX_SCAN_DIRS = 500;

class ActivityStoreError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ActivityStoreError';
    this.code = code;
    this.details = details || null;
  }
}

const utf8 = (value) => Buffer.byteLength(String(value), 'utf8');

const {isPlainObject} = require('./plain-object.cjs');

/* O campo vai com o nome do contrato da ferramenta (`title`, `html`): o tutor
   corrige o pedido pelo nome que mandou (#43 fase 3). */
const fieldError = (code, field, value, expected) => new ActivityStoreError(code, uiMsg('err.activity.field', {field, received: describeReceived(value), expected}));

function requireString(value, field, max, {allowEmpty = false} = {}) {
  const expected = `string(${allowEmpty ? 0 : 1}..${max})`;
  if (typeof value !== 'string' || value.length > max) throw fieldError('BAD_SPEC', field, value, expected);
  if (!allowEmpty && value.trim() === '') throw fieldError('BAD_SPEC', field, value, expected);
  return value;
}

function normalizeSpec(raw) {
  if (!isPlainObject(raw)) throw fieldError('BAD_SPEC', 'spec', raw, 'object');
  const spec = {
    title: requireString(raw.title, 'title', MAX_TITLE).trim(),
    objective: requireString(raw.objective, 'objective', MAX_OBJECTIVE).trim(),
    alternativeMarkdown: requireString(raw.alternativeMarkdown, 'alternativeMarkdown', MAX_ALTERNATIVE),
    html: requireString(raw.html === undefined ? '' : raw.html, 'html', MAX_HTML, {allowEmpty: true}),
    css: requireString(raw.css === undefined ? '' : raw.css, 'css', MAX_CSS, {allowEmpty: true}),
    js: requireString(raw.js === undefined ? '' : raw.js, 'js', MAX_JS, {allowEmpty: true}),
    katex: raw.katex === true,
  };
  /* #42: o tipo (visualização × atividade) e a biblioteca de gráficos só entram
     no documento quando usados. Fora disso o JSON canônico — e o hash — é o de
     antes: as atividades salvas continuam abrindo com a mesma identidade. */
  if (raw.kind === 'visualizacao') spec.kind = 'visualizacao';
  if (raw.charts === true) spec.charts = true;
  if (spec.html.trim() === '' && spec.js.trim() === '') {
    throw new ActivityStoreError('BAD_SPEC', uiMsg('err.activity.specEmpty'));
  }
  const bytes = utf8(spec.title) + utf8(spec.objective) + utf8(spec.alternativeMarkdown) + utf8(spec.html) + utf8(spec.css) + utf8(spec.js);
  if (bytes > MAX_SPEC_BYTES) throw new ActivityStoreError('TOO_BIG', uiMsg('err.activity.specTooBig', {bytes, max: MAX_SPEC_BYTES}));
  return spec;
}

/* Pares largura→altura medidos pela prévia antes de publicar (#42): no máximo
   24, inteiros, em ordem crescente de largura. Qualquer coisa fora disso é
   descartada inteira (o quadro segue a medição viva, como antes). */
function normalizeHeights(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 24) return undefined;
  const pairs = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) return undefined;
    const [width, height] = entry.map(Number);
    if (!Number.isInteger(width) || width < 1 || width > 10000 || !Number.isInteger(height) || height < 0 || height > 100000) return undefined;
    pairs.push([width, height]);
  }
  return pairs.sort((a, b) => a[0] - b[0]);
}

/* JSON determinístico: normalizeSpec já monta as chaves sempre na mesma ordem. */
function canonicalSpec(spec) {
  return JSON.stringify(normalizeSpec(spec));
}

function specHash(spec) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalSpec(spec)).digest('hex');
}

/* Identidade portátil da conversa: relativa ao runtime quando o caminho está
   dentro dele; id opaco caso contrário. Exportada para os testes e para o host
   provar que o diretório não depende do caminho absoluto. */
function portableIdentity(runtime, conversationId) {
  if (typeof conversationId !== 'string' || conversationId.trim() === '' || conversationId.length > MAX_CONVERSATION) {
    throw fieldError('BAD_INPUT', 'conversationId', conversationId, `string(1..${MAX_CONVERSATION})`);
  }
  const root = path.resolve(runtime);
  const text = String(conversationId);
  if (path.isAbsolute(text)) {
    const resolved = path.resolve(text);
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      const relative = path.relative(root, resolved).split(path.sep).join('/');
      return {kind: 'rel', value: relative, key: `rel:${relative}`};
    }
    return {kind: 'abs', value: resolved, key: `abs:${resolved}`};
  }
  return {kind: 'id', value: text, key: `id:${text}`};
}

function sessionKey(identityKey) {
  return crypto.createHash('sha256').update(String(identityKey), 'utf8').digest('hex').slice(0, 24);
}

/* Compat: o esquema anterior nomeava o diretório pelo hash do conversationId
   absoluto, sem `portableId` no índice. */
function legacyKey(conversationId) {
  return crypto.createHash('sha256').update(String(conversationId), 'utf8').digest('hex').slice(0, 24);
}

function isSafeId(value) {
  return typeof value === 'string' && /^act-[a-z0-9][a-z0-9-]{2,63}$/.test(value);
}

function normalizeVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1 || version > 1000000) {
    throw fieldError('BAD_INPUT', 'version', value, 'integer(1..1000000)');
  }
  return version;
}

function normalizeState(raw) {
  if (!isPlainObject(raw)) throw fieldError('BAD_INPUT', 'state', raw, 'object');
  let text;
  try {
    text = JSON.stringify(raw);
  } catch {
    throw fieldError('BAD_INPUT', 'state', raw, 'JSON object');
  }
  if (text === undefined) throw fieldError('BAD_INPUT', 'state', raw, 'JSON object');
  const envelopeBytes = utf8(text);
  if (envelopeBytes > MAX_STATE_ENVELOPE_BYTES) {
    throw new ActivityStoreError('TOO_BIG', uiMsg('err.activity.stateTooBig', {bytes: envelopeBytes, max: MAX_STATE_ENVELOPE_BYTES}));
  }
  if (raw.values !== undefined && raw.values !== null) {
    let values;
    try { values = JSON.stringify(raw.values); } catch { values = undefined; }
    if (typeof values !== 'string' || utf8(values) > MAX_VALUES_BYTES) {
      throw new ActivityStoreError('TOO_BIG', uiMsg('err.activity.partTooBig', {field: 'values', bytes: typeof values === 'string' ? utf8(values) : '?', max: MAX_VALUES_BYTES}));
    }
  }
  if (raw.attempt !== undefined && raw.attempt !== null) {
    let attempt;
    try { attempt = JSON.stringify(raw.attempt); } catch { attempt = undefined; }
    if (typeof attempt !== 'string' || utf8(attempt) > MAX_ATTEMPT_BYTES) {
      throw new ActivityStoreError('TOO_BIG', uiMsg('err.activity.partTooBig', {field: 'attempt', bytes: typeof attempt === 'string' ? utf8(attempt) : '?', max: MAX_ATTEMPT_BYTES}));
    }
  }
  return JSON.parse(text);
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ActivityStoreError('CORRUPT', uiMsg('err.activity.corruptFile', {name: path.basename(file)}), {file: path.basename(file), cause: causeText(error)});
  }
}

/* Escrita atômica: temporário no mesmo diretório + fsync + rename. */
function writeJsonAtomic(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, {recursive: true});
  const temporary = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const text = JSON.stringify(value);
  let fd = null;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temporary, file);
  } catch (error) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* já foi */ }
    }
    try { fs.rmSync(temporary, {force: true}); } catch { /* já foi */ }
    throw error;
  }
}

/* O índice pertence à conversa pedida? `portableId` é a verdade nova; sem ele,
   aceita o id exato OU o mesmo caminho relativo depois da relocação. */
function matchesIndex(data, conversationId, identity) {
  if (!isPlainObject(data) || Array.isArray(data.items) === false) return false;
  if (typeof data.portableId === 'string') return data.portableId === identity.key;
  if (data.conversationId === undefined || data.conversationId === null) return false;
  const stored = String(data.conversationId);
  if (stored === String(conversationId)) return true;
  if (identity.kind === 'rel') return stored.endsWith('/' + identity.value) || stored === identity.value;
  if (identity.kind === 'id') return stored === identity.value;
  return stored === identity.value;
}

function createActivityStore({runtime} = {}) {
  if (typeof runtime !== 'string' || !path.isAbsolute(runtime)) throw new ActivityStoreError('BAD_INPUT', invalidValue('runtime', runtime, 'caminho absoluto'));
  const root = path.join(runtime, 'activities');
  const locks = new Map();
  const dirCache = new Map();
  /* Leitura-depois-escrita: um save em voo (ou recém-gravado) é visível para o
     próximo get, sem esperar o disco. `stateSave` só entra aqui DEPOIS de
     validar hash/versão; falha de gravação remove a entrada. */
  const stateOverlay = new Map();

  const withLock = async (key, run) => {
    const previous = locks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const chain = previous.then(() => gate);
    locks.set(key, chain);
    await previous.catch(() => {});
    try {
      return await run();
    } finally {
      release();
      if (locks.get(key) === chain) locks.delete(key);
    }
  };

  const emptyIndex = (conversationId, identity) => ({schema: SCHEMA, conversationId, portableId: identity.key, items: []});

  /* Carrega o índice de um diretório. Diretório canônico sem arquivo ainda é
     um índice vazio; arquivo ilegível ou de outra conversa vira CORRUPT. */
  const loadIndex = (dir, conversationId, identity) => {
    const file = path.join(dir, 'index.json');
    if (!fs.existsSync(file)) return emptyIndex(conversationId, identity);
    const data = readJson(file);
    if (!matchesIndex(data, conversationId, identity)) {
      throw new ActivityStoreError('CORRUPT', uiMsg('err.activity.corruptIndex'), {file});
    }
    if (typeof data.portableId !== 'string') data.portableId = identity.key;
    return data;
  };

  const indexMatches = (dir, conversationId, identity) => {
    const file = path.join(dir, 'index.json');
    if (!fs.existsSync(file)) return false;
    try {
      const data = readJson(file);
      return matchesIndex(data, conversationId, identity);
    } catch {
      return false;
    }
  };

  /* Localiza o diretório da conversa: identidade portátil primeiro, chave
     legada do caminho absoluto depois e, por fim, varredura limitada para o
     caso de backup restaurado em outro runtime (índices sem `portableId`). */
  const locateDir = (conversationId) => {
    const identity = portableIdentity(runtime, conversationId);
    const cached = dirCache.get(identity.key);
    if (cached && fs.existsSync(cached) && indexMatches(cached, conversationId, identity)) {
      return {dir: cached, identity};
    }
    const canonical = path.join(root, sessionKey(identity.key));
    if (indexMatches(canonical, conversationId, identity)) {
      dirCache.set(identity.key, canonical);
      return {dir: canonical, identity};
    }
    const legacy = path.join(root, legacyKey(conversationId));
    if (legacy !== canonical && indexMatches(legacy, conversationId, identity)) {
      dirCache.set(identity.key, legacy);
      return {dir: legacy, identity};
    }
    if (fs.existsSync(root)) {
      let seen = 0;
      for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
        if (seen >= MAX_SCAN_DIRS) break;
        if (!entry.isDirectory()) continue;
        const dir = path.join(root, entry.name);
        if (dir === canonical || dir === legacy) continue;
        seen += 1;
        if (indexMatches(dir, conversationId, identity)) {
          dirCache.set(identity.key, dir);
          return {dir, identity};
        }
      }
    }
    return {dir: canonical, identity};
  };

  const writeIndex = (dir, conversationId, identity, items) => {
    writeJsonAtomic(path.join(dir, 'index.json'), {schema: SCHEMA, conversationId, portableId: identity.key, items});
  };

  const docFile = (dir, item) => path.join(dir, 'docs', `${item.id}-v${item.version}.json`);
  const stateFile = (dir) => path.join(dir, 'state.json');
  const stateKey = (item) => `${item.id}@${item.version}@${item.hash}`;

  const readStateFile = (dir) => {
    const file = stateFile(dir);
    if (!fs.existsSync(file)) return {schema: SCHEMA, items: {}};
    const data = readJson(file);
    if (!isPlainObject(data) || !isPlainObject(data.items)) throw new ActivityStoreError('CORRUPT', uiMsg('err.activity.corruptState'), {file});
    return data;
  };

  const findItem = (items, id, version) => items.find((item) => item && item.id === id && Number(item.version) === version) || null;

  const requireItem = (items, id, version) => {
    if (!isSafeId(id)) throw fieldError('BAD_INPUT', 'id', id, 'act-[a-z0-9-]{3,64}');
    const normalized = normalizeVersion(version);
    const item = findItem(items, id, normalized);
    if (!item) throw new ActivityStoreError('MISSING', uiMsg('err.activity.missing'));
    return item;
  };

  const store = {
    root,
    /* Lista os itens da conversa, mais recentes primeiro. Corrupção não é
       mascarada: quem chamou recebe CORRUPT e o arquivo fica no disco. */
    list({conversationId} = {}) {
      const {dir, identity} = locateDir(conversationId);
      const data = loadIndex(dir, conversationId, identity);
      return data.items
        .slice()
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
        .map((item) => ({...item}));
    },

    read({conversationId, id, version} = {}) {
      const {dir, identity} = locateDir(conversationId);
      const data = loadIndex(dir, conversationId, identity);
      const item = requireItem(data.items, id, version);
      const file = docFile(dir, item);
      if (!fs.existsSync(file)) throw new ActivityStoreError('CORRUPT', uiMsg('err.activity.docMissing', {id: item.id, version: item.version}), {file, id: item.id, version: item.version});
      const doc = readJson(file);
      if (!isPlainObject(doc) || doc.hash !== item.hash) throw new ActivityStoreError('CORRUPT', uiMsg('err.activity.docMismatch', {id: item.id, version: item.version}), {file});
      return {item: {...item}, spec: normalizeSpec(doc.spec)};
    },

    /* Publica (ou repete de forma idempotente). `spec` é o payload do modelo;
       `toolCallId`/`callRef` são a identidade da chamada; `generation` é a
       geração da conversa capturada pelo host. */
    async publish({conversationId, generation = 0, toolCallId = '', callRef = '', spec, activityId = '', heights, createdAt = Date.now()} = {}) {
      const clean = normalizeSpec(spec);
      const measured = normalizeHeights(heights);
      const hash = specHash(clean);
      const cleanToolCall = typeof toolCallId === 'string' ? toolCallId.slice(0, MAX_TOOL_CALL) : '';
      const cleanCallRef = typeof callRef === 'string' ? callRef.slice(0, MAX_CALL_REF) : '';
      const identity = portableIdentity(runtime, conversationId);
      return withLock(identity.key, async () => {
        const {dir} = locateDir(conversationId);
        const data = loadIndex(dir, conversationId, identity);
        const gen = Number.isFinite(Number(generation)) ? Number(generation) : 0;
        /* Retry idempotente: mesmo chamador + mesmo conteúdo devolve o item. */
        const sameCall = data.items.find((item) => (
          (cleanToolCall && item.toolCallId === cleanToolCall && item.hash === hash) ||
          (cleanCallRef && item.callRef === cleanCallRef && item.hash === hash)
        ));
        if (sameCall) return {...sameCall, reused: true};
        let item;
        const revision = activityId ? data.items.filter((entry) => entry.id === activityId) : [];
        if (activityId && !isSafeId(activityId)) throw fieldError('BAD_INPUT', 'activityId', activityId, 'act-[a-z0-9-]{3,64}');
        if (activityId && !revision.length) throw new ActivityStoreError('MISSING', uiMsg('err.activity.reviewMissing'));
        if (revision.length) {
          if (data.items.length >= MAX_ITEMS) throw new ActivityStoreError('LIMIT', uiMsg('err.activity.limitReview', {max: MAX_ITEMS}));
          const version = Math.max(...revision.map((entry) => Number(entry.version) || 0)) + 1;
          item = {
            id: activityId, version, hash, conversationId, generation: gen,
            toolCallId: cleanToolCall, callRef: cleanCallRef, kind: 'activity',
            title: clean.title, objective: clean.objective, createdAt: Number(createdAt) || Date.now(),
            bytes: utf8(canonicalSpec(clean)), katex: clean.katex === true,
            ...(clean.kind ? {view: clean.kind} : {}), ...(measured ? {heights: measured} : {}),
          };
          writeJsonAtomic(docFile(dir, item), {schema: SCHEMA, hash, spec: clean});
          data.items.push(item);
          writeIndex(dir, conversationId, identity, data.items);
          return {...item, reused: false, revision: true};
        }
        if (data.items.length >= MAX_ITEMS) throw new ActivityStoreError('LIMIT', uiMsg('err.activity.limitActivities', {max: MAX_ITEMS}));
        let id;
        do {
          id = 'act-' + crypto.randomBytes(5).toString('hex');
        } while (data.items.some((entry) => entry.id === id));
        item = {
          id, version: 1, hash, conversationId, generation: gen,
          toolCallId: cleanToolCall, callRef: cleanCallRef, kind: 'activity',
          title: clean.title, objective: clean.objective, createdAt: Number(createdAt) || Date.now(),
          bytes: utf8(canonicalSpec(clean)), katex: clean.katex === true,
          ...(clean.kind ? {view: clean.kind} : {}), ...(measured ? {heights: measured} : {}),
        };
        writeJsonAtomic(docFile(dir, item), {schema: SCHEMA, hash, spec: clean});
        data.items.push(item);
        writeIndex(dir, conversationId, identity, data.items);
        return {...item, reused: false, revision: false};
      });
    },

    stateGet({conversationId, id, version, hash} = {}) {
      const {dir, identity} = locateDir(conversationId);
      const data = loadIndex(dir, conversationId, identity);
      const item = requireItem(data.items, id, version);
      if (typeof hash !== 'string' || hash !== item.hash) throw new ActivityStoreError('STALE', uiMsg('err.activity.stale'));
      const overlay = stateOverlay.get(`${dir}|${stateKey(item)}`);
      if (overlay) return {item: {...item}, state: overlay.state, updatedAt: overlay.updatedAt};
      const state = readStateFile(dir);
      const entry = state.items[stateKey(item)];
      return {item: {...item}, state: entry ? entry.state : null, updatedAt: entry ? entry.updatedAt : 0};
    },

    async stateSave({conversationId, id, version, hash, state, updatedAt = Date.now()} = {}) {
      const clean = normalizeState(state);
      const identity = portableIdentity(runtime, conversationId);
      return withLock(identity.key, async () => {
        const {dir} = locateDir(conversationId);
        const data = loadIndex(dir, conversationId, identity);
        const item = requireItem(data.items, id, version);
        if (typeof hash !== 'string' || hash !== item.hash) throw new ActivityStoreError('STALE', uiMsg('err.activity.stale'));
        const current = readStateFile(dir);
        const stamp = Number(updatedAt) || Date.now();
        current.items[stateKey(item)] = {state: clean, updatedAt: stamp};
        const overlayKey = `${dir}|${stateKey(item)}`;
        stateOverlay.set(overlayKey, {state: clean, updatedAt: stamp});
        while (stateOverlay.size > 512) stateOverlay.delete(stateOverlay.keys().next().value);
        try {
          writeJsonAtomic(stateFile(dir), {schema: SCHEMA, items: current.items});
        } catch (error) {
          stateOverlay.delete(overlayKey);
          throw error;
        }
        return {saved: true, updatedAt: stamp};
      });
    },

    stats({conversationId} = {}) {
      const {dir, identity} = locateDir(conversationId);
      const data = loadIndex(dir, conversationId, identity);
      return {items: data.items.length};
    },

    /* Identidade portátil (para testes/host provarem que o caminho não depende
       do absoluto) e localização atual do diretório. */
    portableIdentity: (conversationId) => portableIdentity(runtime, conversationId),
    directoryFor(conversationId) {
      const {dir} = locateDir(conversationId);
      return dir;
    },
  };
  return store;
}

module.exports = {
  normalizeHeights,
  ActivityStoreError,
  createActivityStore,
  normalizeSpec,
  canonicalSpec,
  specHash,
  portableIdentity,
  sessionKey,
  isSafeId,
  MAX_TITLE,
  MAX_OBJECTIVE,
  MAX_ALTERNATIVE,
  MAX_HTML,
  MAX_CSS,
  MAX_JS,
  MAX_SPEC_BYTES,
  MAX_VALUES_BYTES,
  MAX_ATTEMPT_BYTES,
  MAX_STATE_ENVELOPE_BYTES,
  MAX_STATE_BYTES,
  MAX_ITEMS,
};
