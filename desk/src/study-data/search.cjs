'use strict';

/* Busca de estudos (Mesa): busca unificada e OFFLINE no conteúdo que a mesa já
 * tem autorização para ler — conversas Pi e Claude, chat lateral, Caderno de
 * revisão, sessões Livre, matérias (título/nomes de material), anotações de
 * página e o TEXTO dos PDFs autorizados.
 *
 * A POLÍTICA mora no núcleo Bend (`core/studysearch.bend` →
 * `src/generated/studysearch.core.js`): dobra de acento/caixa, pontuação,
 * tetos, recorte com `…`, quais fontes existem e a autorização
 * (`allowed`: runtime para dado de runtime; matéria explícita para metadado;
 * matéria + autorização explícita para texto de PDF). Aqui ficam o índice
 * incremental, a leitura dos arquivos, o relógio e os IDs.
 *
 * Regras de escopo (o renderer NUNCA manda caminho que autoriza leitura):
 *   - `options.courses` é a lista AUTORITATIVA do host (`{id,name,path}`);
 *     matéria fora dela não é lida nem listada;
 *   - `options.scope.courses` escolhe ids DESSA lista; sem a lista, todas;
 *   - `options.scope.sources` escolhe as fontes (ver KNOWN_SOURCES);
 *   - nenhuma varredura fora do runtime e das pastas de matéria explícitas;
 *   - o índice guarda só texto de fala user/assistant e metadados: NUNCA
 *     `thinking`, `toolCall`/`toolResult`, anexos, credenciais ou payload de
 *     ferramenta.
 *
 * IDs são estáveis e opacos (`<prefixo>:<hash>`); `resolve()` transforma o id
 * no destino real (caminho da sessão/PDF, página, item do Caderno/anotação)
 * DEPOIS de reconferir a lista autorizada do host.
 *
 * Índice: `runtime/study-search/index.json`, por arquivo, com assinatura
 * `mtime:tamanho`. Arquivo inalterado é reusado; alterado/novo é reextraído;
 * `clearIndex`/`invalidate` derrubam o cache. JSON ilegível é recomeço (é só
 * cache, nunca dado do usuário). */

const fs = require('node:fs');
const path = require('node:path');
const core = require('../generated/studysearch.core.js').default;
const notesStore = require('./annotations.cjs');
const {message} = require('../i18n.mjs');
const {CHAT_ID_RE, FREE_COURSE_ID, INDEX_DIR, INDEX_FILE, INDEX_VERSION, KNOWN_SOURCES, MAX_DOCS, MAX_INDEX_BYTES, MAX_TITLE_CHARS, SRC_TAG, clampLimit, findMatches, fold, foldText, keyOf, materialKey, maxHits, maxPerFile, maxQueryChars, minQueryChars, plain, readJson, reviewKey, sha1, snippetOf, statOf, text, whole} = require('./search-text.cjs');
const {buildCourses, chatLabelFor, chatLabelStore, docsFromMessages, gather, parsePiLine, stripContextEnvelope} = require('./search-sources.cjs');
const {clearIndex, invalidate, loadIndex, pruneIndex, writeIndex} = require('./search-index.cjs');
const {defaultPdfText, extractCandidate} = require('./search-extract.cjs');

/* ---------- consulta ---------- */

function sourceAllowed(candidate, {selectedCourses, sources, hasPdf, hasAnyCourses}) {
  if (!sources.has(candidate.source)) return false;
  const tag = SRC_TAG[candidate.source];
  /* Texto de PDF só passa com a fonte ligada, matéria explícita e autorização
   * (a própria fonte marcada); `allowed` reconfere a tabela do núcleo. Sessão
   * Livre é autorizada pela própria sessão, sem exigir matéria. */
  if (candidate.source === 'pdf') {
    const courseOk = candidate.scope === 'free' ? hasPdf : hasAnyCourses && selectedCourses.has(candidate.courseId);
    return core.allowed(tag, true, courseOk, hasPdf);
  }
  if (candidate.source === 'materia') {
    return core.allowed(tag, true, selectedCourses.has(candidate.courseId), false);
  }
  return core.allowed(tag, true, true, false);
}

function selectedCourseIds(raw, courses) {
  const all = [...new Set([...courses.map((course) => course.id), FREE_COURSE_ID])];
  if (!Array.isArray(raw)) return new Set(all);
  return new Set(raw.map((id) => text(id, 200)).filter((id) => all.includes(id)));
}

function selectedSourceKeys(raw) {
  if (!Array.isArray(raw)) return new Set(KNOWN_SOURCES);
  /* Lista EXPLÍCITA vazia significa nenhuma fonte (o diálogo deixa desmarcar
   * tudo e o status diz "marque mais fontes"); ausente/ inválida é "todas". */
  return new Set(raw.map((key) => text(key, 40)).filter((key) => KNOWN_SOURCES.includes(key)));
}

function queryOf(value) {
  return text(value, maxQueryChars()).trim();
}

function hitId(record, doc) {
  const slot = whole(doc?.i) < 0 ? 't' : String(Math.max(0, whole(doc?.i)));
  switch (record.kind) {
    case 'pi':
    case 'claude':
      return `cv:${record.key}:${slot}`;
    case 'sidechat':
      return `sc:${record.key}:${slot}`;
    case 'pdf':
      return `pd:${record.key}:${Math.max(1, whole(doc.page))}`;
    case 'review':
      return `rv:${doc.reviewId}`;
    case 'free':
      return `fr:${record.sessionId}:${slot}`;
    case 'material':
      return `mt:${doc.materialId}`;
    case 'notes':
      return `nt:${doc.noteId}`;
    default:
      return `xx:${record.key}:${Math.max(0, whole(doc.i))}`;
  }
}

const SOURCE_ORDER = new Map(KNOWN_SOURCES.map((key, index) => [key, index]));
const RANK_NAMES = Object.freeze({RankTitle: 'titulo', RankStart: 'inicio', RankWord: 'palavra', RankAny: 'qualquer'});
const rankName = (tag) => RANK_NAMES[tag?.$] || 'qualquer';

function sourceLabel(source) {
  const tag = SRC_TAG[source] || SRC_TAG.conversa;
  return core.sourceLabel(tag);
}

/* Filtro de matéria por DOC: Caderno e anotações carregam o curso no próprio
 * item e conversas carregam o dono da sessão. Seleção explícita de matérias
 * esconde o que é de outra matéria; Livre tem o dono `mesa-free`.
 * Conversas sem dono só entram sem seleção explícita.
 * Em Nota/Caderno o escopo é ESTRITO: matéria que não está mais na lista
 * autorizada do host (curso removido da config) não entra nem com "todas". */
function docCourseAllowed(courseId, {selectedCourses, explicit, authorizedCourses}, strict = false) {
  const rawScope = text(courseId, 200);
  const scope = rawScope.startsWith('free:') ? FREE_COURSE_ID : rawScope;
  if (!scope) return !explicit;
  if (strict && scope !== FREE_COURSE_ID && (!authorizedCourses || !authorizedCourses.has(scope))) return false;
  if (!explicit) return true;
  return selectedCourses.has(scope);
}

/* Varre um registro e devolve os hits candidatos (título/assunto + docs, no
 * teto por arquivo). O host calcula os fatos; o núcleo decide a prioridade. */
function scanRecord(record, needle, {limit, selection}) {
  const out = [];
  const perFile = maxPerFile();
  const strict = record.source === 'nota' || record.source === 'caderno';
  const allowedScope = (courseId) => docCourseAllowed(courseId, selection, strict);
  const titleField = record.title || '';
  const topicField = record.topic || '';
  const recordTitleHit = !!titleField && allowedScope(record.courseId) && fold(titleField).includes(needle);
  const recordTopicHit = !recordTitleHit && !!topicField && allowedScope(record.courseId) && fold(topicField).includes(needle);
  if (recordTitleHit || recordTopicHit) {
    const field = recordTitleHit ? titleField : topicField;
    const at = fold(field).indexOf(needle);
    out.push(matchOf(record, {i: -1, role: '', text: field, title: titleField, when: record.when}, {
      snippet: snippetOf(field, at, at + needle.length),
      rank: core.best(true, false, false),
      count: 1,
    }));
  }
  for (const doc of record.docs || []) {
    if (out.length >= perFile) break;
    if (!allowedScope(doc.courseId ?? record.courseId)) continue;
    const room = perFile - out.length;
    const titleHit = fold(doc.title || '').includes(needle);
    const matches = findMatches(doc.text || '', needle, Math.max(1, room + 1));
    if (!matches.length) {
      if (titleHit) {
        const at = fold(doc.title).indexOf(needle);
        out.push(matchOf(record, doc, {snippet: snippetOf(doc.title, at, at + needle.length), rank: core.best(true, false, false), count: 1}));
      }
      continue;
    }
    const count = matches.length;
    for (const match of matches) {
      if (out.length >= perFile) break;
      out.push(matchOf(record, doc, {snippet: match.snippet, rank: core.best(titleHit, match.startHit, match.wordHit), count, index: match.index}));
    }
  }
  return out.slice(0, limit);
}

function matchOf(record, doc, match) {
  return {
    id: hitId(record, doc),
    source: record.source,
    sourceLabel: sourceLabel(record.source),
    kind: record.kind,
    title: text(record.title || doc.title || '', MAX_TITLE_CHARS),
    topic: text(record.topic || '', 80),
    favorite: record.favorite === true,
    chatId: CHAT_ID_RE.test(String(record.chatId || '')) ? record.chatId : '',
    /* Rótulo de matéria sem arquivo (só o nome do curso) não tem o que abrir. */
    openable: record.kind !== 'material' || !!doc.materialPath,
    courseId: doc.courseId ?? record.courseId ?? '',
    courseName: record.courseName || '',
    role: doc.role || '',
    page: Math.max(0, whole(doc.page)),
    fileName: record.materialName || (record.file && !record.file.startsWith('course:') ? path.basename(record.file) : ''),
    when: whole(doc.when) || whole(record.when) || 0,
    snippet: match.snippet,
    rank: match.rank,
    count: match.count || 1,
    _weight: Number(core.rankWeight(match.rank)),
    _order: SOURCE_ORDER.get(record.source) ?? 99,
  };
}

function compareHits(a, b) {
  return (
    b._weight - a._weight ||
    b.count - a.count ||
    (b.when || 0) - (a.when || 0) ||
    a._order - b._order ||
    String(a.id).localeCompare(String(b.id))
  );
}

function publicHit(hit) {
  const {_weight, _order, rank, ...rest} = hit;
  return {...rest, rank: rankName(rank)};
}

/* Busca. Nunca lança por arquivo: falha de leitura vira contador e a busca
 * segue. O relógio e o provider de PDF entram por injeção para o teste. */
async function search(runtime, options = {}) {
  const clock = typeof options.nowMs === 'function' ? options.nowMs : () => Date.now();
  const startedAt = clock();
  const query = queryOf(options.query);
  const courses = buildCourses(options.courses, runtime);
  const selectedCourses = selectedCourseIds(options.scope?.courses, courses);
  const sources = selectedSourceKeys(options.scope?.sources);
  const limit = clampLimit(options.limit);
  const provider = typeof options.pdfText === 'function' ? options.pdfText : defaultPdfText;
  const result = {
    query,
    limit,
    sources: [...sources],
    courses: courses.map((course) => ({id: course.id, name: course.name})),
    hits: [],
    truncated: false,
    skipped: {large: 0, errors: 0, files: 0},
    index: {reused: 0, added: 0, removed: 0, total: 0},
    ms: 0,
  };
  if (query.length < minQueryChars()) {
    result.short = true;
    result.ms = clock() - startedAt;
    return result;
  }
  const needle = fold(query);
  const {candidates} = gather(runtime, {courses});
  const index = options.fresh ? {version: INDEX_VERSION, files: {}, updatedAt: 0} : loadIndex(runtime);
  const records = [];
  let dirty = false;
  const deadline = startedAt + Number(core.timeBudgetMs());
  let inspected = 0;
  for (const candidate of candidates) {
    if (inspected >= Number(core.maxFiles())) {
      result.truncated = true;
      break;
    }
    inspected++;
    const stats = candidate.kind === 'material' ? null : statOf(candidate.file);
    if (candidate.kind !== 'material' && !stats) continue;
    if (stats && stats.size > Number(core.maxFileBytes())) {
      result.skipped.large++;
      result.truncated = true;
      continue;
    }
    const key = candidate.kind === 'material' ? `material:${candidate.courseId}` : keyOf(candidate.file);
    /* Metadado de matéria não tem arquivo: a assinatura é a lista de nomes. */
    const labelSig = candidate.chat ? sha1(`${candidate.chat.id}\u0000${candidate.chat.title}\u0000${candidate.chat.topic}\u0000${candidate.chat.favorite}`).slice(0, 12) : '';
    const sig = candidate.kind === 'material' ? sha1((candidate.names || []).map((pdf) => pdf.name).join('\n')).slice(0, 16) : `${Math.round(stats.mtimeMs)}:${stats.size}:${labelSig}`;
    const cached = index.files[key];
    if (cached && cached.sig === sig && cached.kind === candidate.kind) {
      cached.at = clock();
      /* O escopo/título/rótulos podem ter mudado sem o arquivo mudar (estado da
       * sessão, biblioteca de conversas): atualiza os metadados do cache sem
       * reextrair o texto. */
      cached.courseId = candidate.courseId ?? cached.courseId;
      cached.courseName = candidate.courseName || cached.courseName;
      cached.title = cached.docs?.length ? cached.title : candidate.title;
      if (candidate.chat) {
        cached.chatId = candidate.chat.id;
        cached.topic = candidate.chat.topic;
        cached.favorite = candidate.chat.favorite === true;
      }
      cached.partial = cached.partial === true;
      records.push(cached);
      result.index.reused++;
      continue;
    }
    if (clock() > deadline) {
      result.truncated = true;
      break;
    }
    try {
      const extracted = await extractCandidate(candidate, provider);
      const record = {
        key,
        sig,
        kind: candidate.kind,
        source: candidate.source,
        scope: candidate.scope,
        file: candidate.kind === 'material' ? '' : candidate.file,
        courseId: candidate.courseId || '',
        courseName: candidate.courseName || '',
        title: text(extracted.title, MAX_TITLE_CHARS),
        topic: text(extracted.topic, 80),
        favorite: extracted.favorite === true,
        chatId: CHAT_ID_RE.test(String(extracted.chatId || '')) ? extracted.chatId : '',
        partial: !!extracted.partial,
        when: whole(candidate.when),
        sessionId: candidate.sessionId || '',
        materialName: candidate.materialName || '',
        at: clock(),
        docs: extracted.docs.slice(0, MAX_DOCS),
      };
      index.files[key] = record;
      records.push(record);
      dirty = true;
      result.index.added++;
    } catch {
      result.skipped.errors++;
    }
  }
  const hits = [];
  const selection = {selectedCourses, explicit: Array.isArray(options.scope?.courses), authorizedCourses: new Set(courses.map((course) => course.id))};
  let partialRecords = 0;
  for (const record of records) {
    if (!sourceAllowed(record, {selectedCourses, sources, hasPdf: sources.has('pdf'), hasAnyCourses: courses.length > 0})) {
      continue;
    }
    /* Índice parcial (mais mensagens que o teto, fala cortada, PDF além do teto
     * de páginas) aparece como truncado mesmo quando o cache é reusado. */
    if (record.partial) partialRecords++;
    for (const hit of scanRecord(record, needle, {limit: maxHits(), selection})) {
      hits.push(hit);
      if (hits.length >= maxHits()) break;
    }
    if (hits.length >= maxHits()) {
      result.truncated = true;
      break;
    }
  }
  if (partialRecords) result.truncated = true;
  result.partial = partialRecords;
  /* Registro de arquivo APAGADO não fica no cache para sempre: some do índice.
   * Candidato que só não foi visto nesta passada (orçamento/teto) continua. */
  const seenKeys = new Set(records.map((record) => record.key));
  for (const key of Object.keys(index.files)) {
    if (seenKeys.has(key)) continue;
    const file = index.files[key]?.file;
    if (!file || fs.existsSync(file)) continue;
    delete index.files[key];
    result.index.removed++;
    dirty = true;
  }
  result.index.total = Object.keys(index.files).length;
  if (dirty) {
    pruneIndex(index);
    try {
      writeIndex(runtime, index);
    } catch { /* índice é cache: falha de escrita não derruba a busca */ }
  }
  hits.sort(compareHits);
  if (hits.length > limit) {
    result.truncated = true;
    hits.length = limit;
  }
  result.hits = hits.map(publicHit);
  result.ms = clock() - startedAt;
  return result;
}

/* ---------- resolução de destino (host) ---------- */

function parseId(id) {
  const raw = text(id, 400);
  const parts = raw.split(':');
  if (parts.length < 2 || !parts[1]) return null;
  return {prefix: parts[0], key: parts[1], index: whole(parts[2]), page: whole(parts[2])};
}

/* Escopo de matéria que o host ainda lista. Sessão Livre (`free:`) e escopo
 * vazio são do runtime e passam; curso removido da config não. */
function courseScopeAuthorized(scope, courses) {
  const id = text(scope, 200);
  if (!id || id.startsWith('free:')) return true;
  return new Set(courses.map((course) => course.id)).has(id);
}

function resolve(runtime, id, options = {}) {
  const parsed = parseId(id);
  if (!parsed) return {ok: false, error: message('search.error.unknownResult')};
  const courses = buildCourses(options.courses, runtime);
  if (parsed.prefix === 'nt') {
    const {store} = notesStore.readStore(runtime);
    for (const [scope, items] of Object.entries(store)) {
      for (const item of Array.isArray(items) ? items : []) {
        const one = notesStore.normalizeStored(item);
        if (one && one.id === parsed.key) {
          /* Nota de matéria que saiu da config não volta pela ID, mesmo que a
           * tela tenha envelhecido (o resultado “estrangeiro” não abre). */
          if (!courseScopeAuthorized(scope, courses)) return {ok: false, error: message('search.error.unauthorized')};
          return {ok: true, kind: 'note', id: one.id, scope, page: one.ref.page, name: one.ref.name, path: one.ref.path, quote: one.quote, note: one.note, noteKind: one.kind};
        }
      }
    }
    return {ok: false, error: message('search.error.noteMissing')};
  }
  if (parsed.prefix === 'rv') {
    const store = readJson(path.join(runtime, 'review.json'));
    for (const [courseId, items] of Object.entries(store || {})) {
      for (const item of Array.isArray(items) ? items : []) {
        const question = text(item?.question, 400);
        const ref = plain(item?.ref) ? item.ref : {};
        const page = Math.max(1, whole(ref.page));
        if (reviewKey(courseId, question, text(ref.path, 4096), page) === parsed.key) {
          if (!courseScopeAuthorized(courseId, courses)) return {ok: false, error: message('search.error.unauthorized')};
          return {ok: true, kind: 'review', courseId, page, name: text(ref.name, 200), path: text(ref.path, 4096), question};
        }
      }
    }
    return {ok: false, error: message('search.error.reviewMissing')};
  }
  const {candidates} = gather(runtime, {courses});
  for (const candidate of candidates) {
    if (parsed.prefix === 'fr' && candidate.kind === 'free' && candidate.sessionId === parsed.key) {
      return {ok: true, kind: 'free', sessionId: candidate.sessionId, title: candidate.title, chatId: candidate.chat?.id || ''};
    }
    if (candidate.kind === 'material') {
      if (materialKey(candidate.courseId, candidate.title) === parsed.key) {
        return {ok: true, kind: 'material', courseId: candidate.courseId, courseName: candidate.courseName, name: candidate.title, path: ''};
      }
      for (const pdf of candidate.names || []) {
        if (materialKey(candidate.courseId, pdf.name) === parsed.key) {
          return {ok: true, kind: 'material', courseId: candidate.courseId, courseName: candidate.courseName, name: pdf.name, path: pdf.path};
        }
      }
      continue;
    }
    if (keyOf(candidate.file) !== parsed.key) continue;
    if (parsed.prefix === 'pd' && candidate.kind === 'pdf') {
      return {ok: true, kind: 'pdf', path: candidate.file, name: candidate.materialName || path.basename(candidate.file), page: Math.max(1, parsed.page), courseId: candidate.courseId, scope: candidate.scope};
    }
    if (parsed.prefix === 'cv' && (candidate.kind === 'pi' || candidate.kind === 'claude')) {
      return {
        ok: true,
        kind: 'conversation',
        engine: candidate.kind === 'pi' ? 'pi' : 'claude',
        sessionPath: candidate.file,
        courseId: candidate.courseId,
        scope: candidate.scope,
        messageIndex: Math.max(0, parsed.index),
        title: candidate.title,
        chatId: candidate.chat?.id || '',
      };
    }
    if (parsed.prefix === 'sc' && candidate.kind === 'sidechat') {
      return {ok: true, kind: 'sidechat', sessionPath: candidate.file, courseId: candidate.courseId, messageIndex: Math.max(0, parsed.index), title: candidate.title};
    }
  }
  return {ok: false, error: message('search.error.unauthorized')};
}

/* Catálogo para o filtro do diálogo (fontes e matérias do host). */
function catalog(runtime, options = {}) {
  const courses = buildCourses(options.courses, runtime);
  return {
    sources: KNOWN_SOURCES.map((key) => ({key, label: sourceLabel(key)})),
    courses: courses.map((course) => ({id: course.id, name: course.name})),
  };
}

module.exports = {
  KNOWN_SOURCES,
  INDEX_DIR,
  INDEX_FILE,
  MAX_INDEX_BYTES,
  FREE_COURSE_ID,
  fold,
  foldText,
  snippetOf,
  findMatches,
  clampLimit,
  minQueryChars,
  maxQueryChars,
  parsePiLine,
  docsFromMessages,
  stripContextEnvelope,
  chatLabelStore,
  chatLabelFor,
  search,
  resolve,
  catalog,
  gather,
  loadIndex,
  writeIndex,
  clearIndex,
  invalidate,
  keyOf,
  materialKey,
  reviewKey,
  defaultPdfText,
};
