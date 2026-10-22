'use strict';

const fs = require('node:fs');
const path = require('node:path');
const annotations = require('./annotations.cjs');
const {isPlainObject, readJson} = require('./package-common.cjs');

/* Pacote de matéria — coleta da origem: stores da matéria (Caderno,
   favoritos, retomada, anotações), conversas e arquivos da pasta.
   Saiu de packages.cjs na #43 fase 2. */

/* Áreas que compõem o pacote de matéria:
     materials      — conteúdo da pasta da matéria (PDFs etc.);
     learning       — `_state.md`, TUTOR/LEARNER, .pi da matéria;
     review         — Caderno de revisão (chave = id da matéria);
     bookmarks      — favoritos do leitor;
     resume         — retomada (Encerrar por hoje);
     annotations    — anotações de página / dúvidas (`pdf-notes.json`);
     conversations  — conversas Pi/Claude da matéria (opt-in). */
/* `annotations` entra por padrão (é dado do usuário) e o host de importação
   já mescla `pdf-notes.json`; `include.annotations === false` desliga. */
const STORE_FILES = Object.freeze({review: 'review.json', bookmarks: 'bookmarks.json', resume: 'resume.json', annotations: 'pdf-notes.json'});
const STORE_MAX_BYTES = 8 * 1024 * 1024;
/* A pasta da matéria pode ser a pasta de estudo do Pi (com `Sessions/`,
   `Sources/`, `.pi/` e `_state.md`): isso NÃO é material do usuário — vai para
   a área de estudo quando o host pedir `learningDir`. Mesma partição do
   backup, para pacote e versão não competirem por nome. */
const MATERIAL_SKIP_DIRS = new Set(['Sessions', 'Sources', 'Assets', '.pi']);
const MATERIAL_SKIP_FILES = new Set(['_state.md']);
function storeEntry(runtime, courseId, file) {
  const abs = path.join(runtime, file);
  try {
    if (fs.statSync(abs).size > STORE_MAX_BYTES) return null;
  } catch {
    return null;
  }
  const store = readJson(abs);
  const slice = isPlainObject(store) ? store[String(courseId || '')] : null;
  if (slice === undefined || slice === null) return null;
  const text = `${JSON.stringify(slice, null, 2)}\n`;
  return {file, text, bytes: Buffer.byteLength(text)};
}
/* Anotações de página em forma PORTÁTIL: `name` + `rel` + `page`, sem caminho
   absoluto da máquina do autor. O caminho só volta na importação/adopção,
   reancorado numa raiz autorizada do destino (`materialsDir`/`learningDir`). */
function noteStoreEntry(runtime, courseId) {
  const portable = annotations.exportPortable(runtime, {courseId: String(courseId || '')});
  if (!portable.items.length) return null;
  const text = `${JSON.stringify(portable, null, 2)}\n`;
  return {file: 'pdf-notes.json', text, bytes: Buffer.byteLength(text), portable: true};
}
/* Converte um store de anotações do pacote (portátil novo ou v1 com caminho
   absoluto) na fatia que o runtime/adopção entende. Itens sem material
   resolvido continuam guardados (trecho/observação valem), mas o caminho do
   autor NÃO é copiado: fica vazio e a nota é reportada em `warnings`. */
function importNoteStore(raw, {roots = [], warnings = []} = {}) {
  const portable = !Array.isArray(raw);
  const list = Array.isArray(raw) ? raw : isPlainObject(raw) && Array.isArray(raw.items) ? raw.items : [];
  const rootList = (Array.isArray(roots) ? roots : []).filter((root) => typeof root === 'string' && root).map((root) => path.resolve(root));
  const underRoots = (abs) => {
    const value = path.resolve(abs);
    return rootList.some((root) => value === root || value.startsWith(root + path.sep));
  };
  const out = [];
  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const ref = isPlainObject(item.ref) ? item.ref : item;
    const quote = typeof item.quote === 'string' ? item.quote : '';
    const note = typeof item.note === 'string' ? item.note : '';
    if (!quote.trim() && !note.trim()) continue;
    const rel = typeof ref.rel === 'string' ? ref.rel : '';
    const name = typeof ref.name === 'string' ? ref.name : '';
    let resolved = '';
    const candidate = typeof ref.path === 'string' ? ref.path : '';
    if (candidate) {
      try {
        if (fs.statSync(candidate).isFile()) resolved = candidate;
      } catch { /* tenta rel/name abaixo */ }
    }
    if (!resolved) resolved = annotations.resolveAbs({rel, name}, rootList);
    /* Caminho que já aponta para o destino novo (mesmo ausente) é preservado:
       o material pode ter ficado fora pela política de binário. */
    if (!resolved && candidate && underRoots(candidate)) resolved = candidate;
    if (!resolved) warnings.push(name || rel || 'anotação sem material');
    const updatedAt = Number.isFinite(Number(item.updatedAt)) ? Math.trunc(Number(item.updatedAt)) : 0;
    const createdAt = Number.isFinite(Number(item.createdAt)) ? Math.trunc(Number(item.createdAt)) : updatedAt;
    out.push({
      id: typeof item.id === 'string' && item.id ? item.id : annotations.newId(),
      kind: item.kind === 'duvida' ? 'duvida' : 'nota',
      quote,
      note,
      ref: {name, rel, path: resolved, page: Number.isFinite(Number(ref.page)) ? Math.max(0, Math.trunc(Number(ref.page))) : 0},
      createdAt: createdAt || Date.now(),
      updatedAt: updatedAt || createdAt || Date.now(),
    });
  }
  return {items: out, portable, unresolved: warnings.length};
}
/* Atalho usado pela adoção (main.cjs) e pelo import: devolve a lista pronta
   para o `runtime/pdf-notes.json`. */
function resolveNoteStore(raw, {roots = []} = {}) {
  return importNoteStore(raw, {roots}).items;
}
/* Conversas da matéria: JSONL do Pi (idioma nativo, retomável em outra
   instalação que tenha o mesmo provedor) e descritores Claude (o transcrito
   do descritor; o id nativo NÃO é reaproveitado na importação). */
function conversationEntries(runtime, courseId) {
  const out = [];
  const conversationsDir = path.join(runtime, 'conversations');
  let names;
  try {
    names = fs.readdirSync(runtime);
  } catch {
    names = [];
  }
  for (const name of names) {
    if (!/^pi-.*\.jsonl$/.test(name)) continue;
    const {sessionCourse} = sessionMeta(runtime, name);
    if (courseId && sessionCourse !== courseId) continue;
    const abs = path.join(runtime, name);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > 64 * 1024 * 1024) continue;
    out.push({source: abs, kind: 'conversations', rel: `pi/${name}`, engine: 'pi'});
  }
  let claudeNames;
  try {
    claudeNames = fs.readdirSync(conversationsDir);
  } catch {
    claudeNames = [];
  }
  for (const name of claudeNames) {
    if (!/^claude-.*\.json$/.test(name)) continue;
    const record = readJson(path.join(conversationsDir, name));
    if (!isPlainObject(record)) continue;
    if (courseId && record.courseId !== courseId) continue;
    out.push({source: path.join(conversationsDir, name), kind: 'conversations', rel: `claude/${name}`, engine: 'claude'});
  }
  return out;
}
/* Compartilhamento exige um único dono comprovado pelo estado do host.
   O formato antigo é aceito; caminho homônimo fora do runtime não é dono. */
function sessionMeta(runtime, name) {
  const desk = readJson(path.join(runtime, 'desk.json'));
  const state = isPlainObject(desk?.courseStates) ? desk : desk?.state;
  const states = isPlainObject(state?.courseStates) ? state.courseStates : {};
  const target = path.resolve(runtime, name);
  const owners = new Set();
  const matches = (file) => typeof file === 'string' && path.isAbsolute(file) && path.resolve(file) === target;
  for (const [courseId, entry] of Object.entries(states)) {
    const sessions = isPlainObject(entry) && Array.isArray(entry.sessions) ? entry.sessions : [];
    if (matches(entry?.session) || sessions.some((s) => matches(s?.path))) owners.add(courseId);
  }
  if (state?.courseId && matches(state.session)) owners.add(state.courseId);
  return {sessionCourse: owners.size === 1 ? [...owners][0] : ''};
}
function walkFiles(absDir, rel, out, {maxFiles = 5000, maxBytes = 512 * 1024 * 1024, skipDirs = null, skipFiles = null} = {}) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, {withFileTypes: true});
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    if (out.length >= maxFiles) return;
    const childAbs = path.join(absDir, entry.name);
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') continue;
      if (skipDirs && skipDirs.has(entry.name)) continue;
      walkFiles(childAbs, childRel, out, {maxFiles, maxBytes, skipDirs, skipFiles});
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    if (skipFiles && skipFiles.has(entry.name)) continue;
    let stat;
    try {
      stat = fs.statSync(childAbs);
    } catch {
      continue;
    }
    if (out.reduce((sum, item) => sum + item.bytes, 0) + stat.size > maxBytes) return;
    out.push({source: childAbs, rel: childRel, bytes: stat.size});
  }
}

module.exports = {STORE_FILES, MATERIAL_SKIP_DIRS, MATERIAL_SKIP_FILES, storeEntry, noteStoreEntry, importNoteStore, resolveNoteStore, conversationEntries, walkFiles};
