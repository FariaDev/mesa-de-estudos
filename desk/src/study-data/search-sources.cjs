'use strict';

const fs = require('node:fs');
const path = require('node:path');
const notesStore = require('./annotations.cjs');
const conversations = require('../agents/conversations.cjs');
const {CHAT_ID_RE, CHAT_LIBRARY_FILE, CHAT_LIBRARY_MAX_BYTES, CHAT_LIBRARY_MAX_ITEMS, NATIVE_DESCRIPTOR_RE, CONTEXT_END, FREE_COURSE_ID, FREE_ID_RE, MAX_DOCS, MAX_DOC_CHARS, MAX_STATE_SESSIONS, MAX_TITLE_CHARS, PDF_RE, PI_SESSION_RE, SIDECHAT_RE, plain, readJson, sha256, statOf, text, whole} = require('./search-text.cjs');

/* Busca de estudos — o que existe para ler: linhas de sessão Pi, matérias
 * autorizadas, candidatos por fonte (conversas, chat lateral, notas, Caderno,
 * Livre, materiais) e rótulos da biblioteca de conversas.
 * Saiu de search.cjs na #43 fase 2; a política continua no núcleo
 * (`core/studysearch.bend`). */

/* Linha JSONL do Pi → `{role, text, when}` | null. `thinking`, `toolResult`,
 * `session`, payload de ferramenta e linha torta são ignorados. */
function parsePiLine(line) {
  if (typeof line !== 'string' || !line.trim() || line.indexOf('"message"') === -1) return null;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }
  if (!plain(entry)) return null;
  const message = plain(entry.message) ? entry.message : entry;
  if (!plain(message)) return null;
  if (entry.type !== undefined && entry.type !== 'message' && !plain(entry.message)) return null;
  const role = message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : '';
  if (!role) return null;
  let body = '';
  if (typeof message.content === 'string') body = message.content;
  else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (plain(part) && part.type === 'text' && typeof part.text === 'string') body += (body ? '\n' : '') + part.text;
    }
  }
  if (!body.trim()) return null;
  const when = whole(message.timestamp) || Date.parse(entry.timestamp) || 0;
  return {role, text: body, when: Number.isFinite(when) ? when : 0};
}
/* Mensagens normalizadas (Claude/descritor lateral) → docs. Só `type:'text'`.
 * Devolve também `partial` quando o arquivo tem mais mensagens que o teto do
 * índice ou alguma fala passou do teto por mensagem: o resultado da busca
 * avisa que o índice é parcial em vez de esconder o resto sem status. */
function docsFromMessages(messages, when = 0) {
  const list = Array.isArray(messages) ? messages : [];
  const docs = [];
  let partial = list.length > MAX_DOCS;
  for (let index = 0; index < list.length && index < MAX_DOCS; index++) {
    const message = list[index];
    if (!plain(message)) continue;
    const role = message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : '';
    if (!role) continue;
    let body = '';
    if (typeof message.content === 'string') body = message.content;
    else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (plain(part) && part.type === 'text' && typeof part.text === 'string') body += (body ? '\n' : '') + part.text;
      }
    }
    if (!body.trim()) continue;
    if (role === 'user') body = stripContextEnvelope(body);
    if (body.length > MAX_DOC_CHARS) partial = true;
    docs.push({i: docs.length, role, text: body.slice(0, MAX_DOC_CHARS), when: whole(message.timestamp) || when});
  }
  return {docs, partial};
}
/* O bloco de contexto do chat lateral é digest do principal: fica FORA do
 * índice para o mesmo texto não aparecer duas vezes. */
function stripContextEnvelope(body) {
  if (!body.startsWith('[Contexto do chat lateral]')) return body;
  const at = body.indexOf(CONTEXT_END);
  return at === -1 ? body : body.slice(at + CONTEXT_END.length);
}
/* O host pode mandar `{id,name}` sem caminho (ex.: `allCourses()` do main).
 * Nesse caso o caminho só é inferido DENTRO do runtime, em
 * `<runtime>/learning/Courses/<id>` — layout padrão do app — e nunca a partir
 * de payload do renderer. Curso sem caminho continua aparecendo no catálogo e
 * pelos metadados (nome), mas sem varrer pasta nenhuma. */
function coursePathFor(runtime, id) {
  if (!runtime || !id || path.basename(id) !== id || id === '.' || id === '..') return '';
  const candidate = path.join(runtime, 'learning', 'Courses', id);
  try {
    return fs.statSync(candidate).isDirectory() ? candidate : '';
  } catch {
    return '';
  }
}
function buildCourses(raw, runtime = '') {
  const out = [];
  const seen = new Set();
  for (const one of Array.isArray(raw) ? raw : []) {
    if (!plain(one)) continue;
    const id = text(one.id, 200);
    const name = text(one.name, 200) || id;
    let dir = text(one.path, 4096);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (!dir || !fs.existsSync(dir)) dir = coursePathFor(runtime, id);
    if (!dir) {
      out.push({id, name, path: ''});
      continue;
    }
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    out.push({id, name, path: dir});
  }
  return out;
}
function readState(runtime) {
  const state = readJson(path.join(runtime, 'desk.json'));
  return state || {};
}
/* Sessões Pi conhecidas: estados por matéria + sessão corrente + varredura do
 * runtime (pi-*.jsonl) — nunca fora do runtime. */
function piSessionCandidates(runtime, state, freeRecords) {
  const out = new Map();
  const push = (file, meta = {}) => {
    if (typeof file !== 'string' || !file) return;
    let stats;
    try {
      stats = fs.statSync(file);
    } catch {
      return;
    }
    if (!stats.isFile()) return;
    const abs = path.resolve(file);
    if (out.has(abs)) {
      const existing = out.get(abs);
      if (!existing.courseId && meta.courseId) existing.courseId = meta.courseId;
      if (meta.scope === 'free') existing.scope = 'free';
      return;
    }
    out.set(abs, {
      file: abs,
      kind: 'pi',
      source: 'conversa',
      scope: meta.scope || 'runtime',
      courseId: text(meta.courseId, 200),
      title: text(meta.title, MAX_TITLE_CHARS),
      when: whole(meta.when) || Math.round(stats.mtimeMs) || 0,
    });
  };
  for (const [courseId, courseState] of Object.entries(plain(state.courseStates) ? state.courseStates : {})) {
    if (!plain(courseState)) continue;
    for (const session of Array.isArray(courseState.sessions) ? courseState.sessions : []) {
      if (!plain(session)) continue;
      push(session.path, {courseId, title: session.preview, when: session.started});
    }
    push(courseState.session, {courseId});
  }
  if (state.session) {
    const owner = text(state.courseId, 200);
    push(state.session, {courseId: owner, scope: owner === FREE_COURSE_ID ? 'free' : 'runtime'});
  }
  for (const freeSession of freeRecords) {
    if (freeSession.nativePath) push(freeSession.nativePath, {scope: 'free', courseId: FREE_COURSE_ID, title: freeSession.title, when: Date.parse(freeSession.updatedAt) || 0});
  }
  let entries = [];
  try {
    entries = fs.readdirSync(runtime, {withFileTypes: true});
  } catch { /* runtime sem pasta: nada a varrer */ }
  for (const entry of entries) {
    if (entry.isFile() && PI_SESSION_RE.test(entry.name)) push(path.join(runtime, entry.name));
  }
  return [...out.values()].slice(0, MAX_STATE_SESSIONS);
}
/* Descritores Claude (`runtime/conversations/claude-*.json`), validados pelo
 * módulo de conversas (teto e forma). */
function claudeCandidates(runtime) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(runtime, 'conversations'), {withFileTypes: true});
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !NATIVE_DESCRIPTOR_RE.test(entry.name)) continue;
    const file = path.join(runtime, 'conversations', entry.name);
    const record = conversations.readClaudeConversation(file, {runtime});
    if (!record) continue;
    const courseId = text(record.courseId, 200);
    out.push({
      file,
      kind: 'claude',
      source: 'conversa',
      libraryCourseId: courseId,
      scope: courseId === FREE_COURSE_ID || !courseId ? 'runtime' : 'course',
      courseId,
      title: text(record.preview, MAX_TITLE_CHARS),
      when: whole(record.started),
      messages: Array.isArray(record.messages) ? record.messages : [],
    });
  }
  return out;
}
/* Chats laterais: descritor com mensagens em cache; se o Pi ainda não tem
 * cache, o JSONL do próprio canal entra no lugar. */
function sidechatCandidates(runtime) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(runtime, 'sidechats'), {withFileTypes: true});
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !SIDECHAT_RE.test(entry.name)) continue;
    const file = path.join(runtime, 'sidechats', entry.name);
    const record = readJson(file);
    if (!record || record.schemaVersion !== 1 || !SIDECHAT_RE.test(path.basename(file)) || record.engine !== 'pi' && record.engine !== 'claude') continue;
    const courseId = text(record.courseId, 200);
    const messages = Array.isArray(record.messages) ? record.messages : [];
    const piFile = typeof record.session === 'string' && record.session ? record.session : path.join(runtime, 'sidechats', `${record.id}.jsonl`);
    out.push({
      file,
      kind: 'sidechat',
      source: 'lateral',
      scope: courseId === FREE_COURSE_ID || !courseId ? 'runtime' : 'course',
      courseId,
      title: '',
      when: whole(record.updatedAt) || whole(record.createdAt),
      messages: messages.length ? messages : null,
      fallbackFile: messages.length ? '' : piFile,
      engine: record.engine,
    });
  }
  return out;
}
/* Anotações de página: um arquivo, escopos variados. Sem título próprio: a
 * tela mostra o nome da fonte no idioma dela (#41), não um texto fixo do main. */
function notesCandidate(runtime) {
  const file = notesStore.fileOf(runtime);
  if (!statOf(file)) return null;
  const {store} = notesStore.readStore(runtime);
  return {file, kind: 'notes', source: 'nota', scope: 'runtime', courseId: '', title: '', when: 0, store};
}
/* Caderno de revisão: um arquivo, itens por matéria. */
function reviewCandidate(runtime) {
  const file = path.join(runtime, 'review.json');
  if (!statOf(file)) return null;
  return {file, kind: 'review', source: 'caderno', scope: 'runtime', courseId: '', title: '', when: 0};
}
/* Rótulos da biblioteca de conversas (`chat-library.json`): título, assunto e
 * favorito que o usuário deu a uma sessão. A busca só LÊ esse arquivo (nunca
 * escreve); a chave é a mesma de `chat-library.cjs` — `[courseId, rel]` — e o
 * id, o mesmo `chat-<sha256>`. Arquivo ilegível/ilegítimo simplesmente não
 * contribui rótulo nenhum. */
function chatLabelStore(runtime) {
  const byKey = new Map();
  const byRel = new Map();
  let raw;
  try {
    const file = path.join(runtime, CHAT_LIBRARY_FILE);
    const stats = fs.lstatSync(file);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > CHAT_LIBRARY_MAX_BYTES) return {byKey, byRel};
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {byKey, byRel};
  }
  if (!plain(raw) || raw.version !== 1 || !plain(raw.items)) return {byKey, byRel};
  const entries = Object.entries(raw.items);
  if (entries.length > CHAT_LIBRARY_MAX_ITEMS) return {byKey, byRel};
  for (const [key, value] of entries) {
    let parts;
    try {
      parts = JSON.parse(key);
    } catch {
      continue;
    }
    if (!Array.isArray(parts) || parts.length !== 2 || typeof parts[0] !== 'string' || typeof parts[1] !== 'string') continue;
    const label = {
      id: `chat-${sha256(key).slice(0, 32)}`,
      rel: parts[1],
      title: text(value?.title, MAX_TITLE_CHARS),
      topic: text(value?.topic, 80),
      favorite: value?.favorite === true,
    };
    if (!label.title && !label.topic && !label.favorite) continue;
    byKey.set(`${parts[0]}\u0000${parts[1]}`, label);
    /* Mesmo caminho relativo em duas matérias: o fallback por caminho fica
     * ambíguo e não é usado (a chave completa ainda resolve). */
    byRel.set(parts[1], byRel.has(parts[1]) ? null : label);
  }
  return {byKey, byRel};
}
/* Rótulo de um arquivo de sessão; `courseId` é o dono que a biblioteca usa
 * (matéria configurada ou `mesa-free` para a sessão Livre). */
function chatLabelFor(store, file, courseId, runtime) {
  if (!store || !file) return null;
  let rel;
  try {
    rel = path.relative(path.resolve(runtime), path.resolve(file));
  } catch {
    return null;
  }
  if (!rel || path.isAbsolute(rel) || rel.startsWith('..')) return null;
  const direct = store.byKey.get(`${courseId || ''}\u0000${rel}`);
  if (direct) return direct;
  return store.byRel.get(rel) || null;
}
/* Campos de rótulo que acompanham o resultado (e o destino) para a UI mostrar
 * favorito/assunto e o id original da biblioteca. */
function chatFields(candidate) {
  const chat = candidate?.chat;
  if (!chat) return {chatId: '', topic: '', favorite: false};
  return {chatId: CHAT_ID_RE.test(String(chat.id || '')) ? chat.id : '', topic: text(chat.topic, 80), favorite: chat.favorite === true};
}
let freeModule;
function freeOf() {
  if (freeModule === undefined) {
    try {
      freeModule = require('../../free-workspaces.cjs');
    } catch {
      freeModule = null;
    }
  }
  return freeModule;
}
function freeRecords(runtime) {
  const free = freeOf();
  if (!free) return [];
  try {
    return free.listWorkspaces(runtime).filter((record) => plain(record) && FREE_ID_RE.test(String(record.id || '')));
  } catch {
    return [];
  }
}
let coursesModule;
function courseLibraryOf() {
  if (coursesModule === undefined) {
    try {
      coursesModule = require('../../courses.cjs');
    } catch {
      coursesModule = null;
    }
  }
  return coursesModule;
}
/* Monta os candidatos: runtime (conversas/lateral/caderno/notas/livre) e
 * matéria explícita (metadado + PDFs). Só as matérias de `courses` entram. */
function gather(runtime, {courses = []} = {}) {
  const freeList = freeRecords(runtime);
  const state = readState(runtime);
  const labels = chatLabelStore(runtime);
  const candidates = [];
  for (const one of piSessionCandidates(runtime, state, freeList)) {
    one.chat = chatLabelFor(labels, one.file, one.scope === 'free' ? FREE_COURSE_ID : one.courseId, runtime);
    candidates.push(one);
  }
  for (const one of claudeCandidates(runtime)) {
    one.chat = chatLabelFor(labels, one.file, one.libraryCourseId || one.courseId, runtime);
    candidates.push(one);
  }
  for (const one of sidechatCandidates(runtime)) candidates.push(one);
  const review = reviewCandidate(runtime);
  if (review) candidates.push(review);
  const notes = notesCandidate(runtime);
  if (notes) candidates.push(notes);
  const library = courseLibraryOf();
  for (const record of freeList) {
    const dir = path.join(runtime, 'free', record.id);
    const workspaceFile = path.join(dir, 'workspace.json');
    if (statOf(workspaceFile)) {
      candidates.push({
        file: workspaceFile,
        kind: 'free',
        source: 'livre',
        scope: 'free',
        courseId: FREE_COURSE_ID,
        chat: record.nativePath ? chatLabelFor(labels, record.nativePath, FREE_COURSE_ID, runtime) : null,
        title: text(record.title, MAX_TITLE_CHARS),
        when: Date.parse(record.updatedAt) || 0,
        sessionId: record.id,
        materials: (Array.isArray(record.materials) ? record.materials : []).map((material) => ({
          name: text(material?.name, 200),
          path: text(material?.path, 4096),
        })).filter((material) => material.name && material.path),
      });
    }
    for (const material of Array.isArray(record.materials) ? record.materials : []) {
      const file = text(material?.path, 4096);
      if (!file || !PDF_RE.test(file) || !statOf(file)) continue;
      candidates.push({
        file,
        kind: 'pdf',
        source: 'pdf',
        scope: 'free',
        courseId: FREE_COURSE_ID,
        courseName: '',
        title: text(material?.name, MAX_TITLE_CHARS),
        when: 0,
        materialName: text(material?.name, 200),
      });
    }
  }
  for (const course of courses) {
    const pdfs = course.path && library ? library.courseLibrary(course.path) : [];
    candidates.push({
      file: `course:${course.id}`,
      kind: 'material',
      source: 'materia',
      scope: 'course',
      courseId: course.id,
      courseName: course.name,
      title: course.name,
      when: 0,
      names: pdfs.map((pdf) => ({name: text(pdf.name, 200), path: text(pdf.path, 4096)})).filter((pdf) => pdf.name && pdf.path),
    });
    for (const pdf of pdfs) {
      candidates.push({
        file: pdf.path,
        kind: 'pdf',
        source: 'pdf',
        scope: 'course',
        courseId: course.id,
        courseName: course.name,
        title: text(pdf.name, MAX_TITLE_CHARS),
        when: 0,
        materialName: text(pdf.name, 200),
      });
    }
  }
  return {candidates, courses};
}

module.exports = {parsePiLine, docsFromMessages, stripContextEnvelope, buildCourses, chatLabelStore, chatLabelFor, chatFields, gather};
