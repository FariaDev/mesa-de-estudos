'use strict';

const fs = require('node:fs');
const core = require('./src/generated/freeworkspaces.core.js').default;
const {message: uiMsg} = require('./src/i18n.mjs');
const {VERSION, assertMaterialsSafe, assertWorkspaceSafe, bump, cleanNativePath, cutDraft, fail, fileOf, freeRoot, hasControls, isPlainObject, isText, materialsDirOf, mustLoad, normalizePdfDraft, normalizeSessionId, nowIso, readRecord, whole, writeRecord} = require('./free-workspace-record.cjs');

/* Aba Livre — fachada do store: criar, achar, listar e atualizar
   workspaces, e o escopo (sessão + revisão) que as operações conferem.
   Saiu de free-workspaces.cjs na #43 fase 2; a política continua no núcleo
   (`core/freeworkspaces.bend`). */

function newRecord(sessionId, title) {
  const now = nowIso();
  return {
    version: VERSION,
    id: sessionId,
    title: core.fitTitleOr(typeof title === 'string' ? title : ''),
    draft: '',
    nativePath: '',
    materials: [],
    promotion: null,
    rev: 1,
    createdAt: now,
    updatedAt: now,
  };
}
function createWorkspace(runtime, {sessionId, title} = {}) {
  const id = normalizeSessionId(sessionId);
  assertWorkspaceSafe(runtime, id);
  const file = fileOf(runtime, id);
  if (fs.existsSync(file)) fail('EXISTS', 'workspace livre já existe');
  fs.mkdirSync(materialsDirOf(runtime, id), {recursive: true});
  const record = newRecord(id, title);
  writeRecord(file, record);
  return record;
}
function ensureWorkspace(runtime, {sessionId, title} = {}) {
  const id = normalizeSessionId(sessionId);
  assertWorkspaceSafe(runtime, id);
  const file = fileOf(runtime, id);
  const found = findWorkspace(runtime, id);
  if (found) return found;
  if (fs.existsSync(file)) fail('CORRUPT', 'workspace.json ilegível; nada foi sobrescrito');
  fs.mkdirSync(materialsDirOf(runtime, id), {recursive: true});
  assertMaterialsSafe(runtime, id);
  const record = newRecord(id, title);
  writeRecord(file, record);
  return record;
}
function findWorkspace(runtime, sessionId) {
  let id;
  try {
    id = normalizeSessionId(sessionId);
  } catch {
    return null;
  }
  try {
    return readRecord(fileOf(runtime, id), id);
  } catch {
    return null;
  }
}
function listWorkspaces(runtime) {
  const root = freeRoot(runtime);
  let entries;
  try {
    entries = fs.readdirSync(root, {withFileTypes: true});
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const record = findWorkspace(runtime, entry.name);
    if (record) out.push(record);
  }
  out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id.localeCompare(b.id));
  return out;
}
function updateWorkspace(runtime, sessionId, patch = {}, {expectRev} = {}) {
  const {file, record} = mustLoad(runtime, sessionId);
  if (expectRev !== undefined && expectRev !== null && record.rev !== whole(expectRev)) {
    fail('STALE', uiMsg('err.freews.staleNothing'), {expected: whole(expectRev), current: record.rev});
  }
  const next = bump(record);
  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    next.title = core.fitTitleOr(typeof patch.title === 'string' ? patch.title : '');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'draft')) {
    next.draft = cutDraft(patch.draft);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'nativePath')) {
    next.nativePath = cleanNativePath(patch.nativePath, 'BAD_PATH');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'pdfDraft')) {
    const draft = normalizePdfDraft(patch.pdfDraft);
    if (patch.pdfDraft !== null && !draft) fail('BAD_DRAFT', 'conteúdo do PDF inválido');
    if (draft) next.pdfDraft = draft; else delete next.pdfDraft;
  }
  writeRecord(file, next);
  return next;
}
function renameWorkspace(runtime, sessionId, title, options) {
  return updateWorkspace(runtime, sessionId, {title}, options);
}
/* Caminho nativo da sessão (JSONL do Pi) ainda pode não existir: registrar o
   caminho não cria arquivo nenhum. */
function setNativePath(runtime, sessionId, nativePath, options) {
  return updateWorkspace(runtime, sessionId, {nativePath}, options);
}
/* Índice que o main usa para listar conversas livres: inclui sessão SEM arquivo
   nativo (nativePath vazio) — o JSONL do Pi nasce no primeiro envio. */
function listSessions(runtime) {
  return listWorkspaces(runtime).map((record) => ({
    sessionId: record.id,
    title: record.title,
    nativePath: record.nativePath,
    promotedCourseId: record.promotion && record.promotion.status === 'promoted' ? record.promotion.courseId : '',
    materials: record.materials.length,
    rev: record.rev,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}
/* Um courseId pertence a no máximo uma sessão promovida: o main consulta antes
   de mexer no config/descriptor e o commit recusa dono diferente. */
function findByCourseId(runtime, courseId) {
  if (!isText(courseId, 128) || hasControls(courseId)) return null;
  for (const record of listWorkspaces(runtime)) {
    const plan = record.promotion;
    if (plan && plan.status === 'promoted' && plan.courseId === courseId) {
      return {sessionId: record.id, promotion: plan};
    }
  }
  return null;
}
/* Fatia de escopo para operações assíncronas: o main captura ANTES do await e
   recheca depois (mutação só grava se a mesma revisão da sessão continuar de
   pé e a sessão não tiver sido promovida nesse meio-tempo). */
function captureScope(runtime, sessionId) {
  const record = mustLoad(runtime, sessionId).record;
  return Object.freeze({
    kind: 'free',
    sessionId: record.id,
    courseId: core.freeCourseId(),
    rev: record.rev,
    promotedCourseId: record.promotion && record.promotion.status === 'promoted' ? record.promotion.courseId : '',
  });
}
function scopeIsCurrent(runtime, scope) {
  if (!isPlainObject(scope) || !isText(scope.sessionId, 128)) return false;
  let record;
  try {
    record = mustLoad(runtime, scope.sessionId).record;
  } catch {
    return false;
  }
  if (scope.rev !== undefined && scope.rev !== null && record.rev !== whole(scope.rev)) return false;
  if (record.promotion && record.promotion.status === 'promoted') return false;
  return true;
}
function assertScope(runtime, scope) {
  if (scopeIsCurrent(runtime, scope) === false) fail('STALE', uiMsg('err.freews.staleCancelled'), {scope: scope || null});
  return true;
}

module.exports = {createWorkspace, ensureWorkspace, findWorkspace, listWorkspaces, updateWorkspace, renameWorkspace, setNativePath, listSessions, findByCourseId, captureScope, scopeIsCurrent, assertScope};
