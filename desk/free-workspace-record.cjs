'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./src/generated/freeworkspaces.core.js').default;
const materialModel = require('./material-model.cjs');
const {message: uiMsg} = require('./src/i18n.mjs');

/* Aba Livre — limites, erro, caminhos da sessão, forma do registro,
   gravação atômica, leitura conferida e nomes seguros.
   Saiu de free-workspaces.cjs na #43 fase 2; a política continua no núcleo
   (`core/freeworkspaces.bend`). */

const FILENAME = 'workspace.json';
const MATERIALS_DIR = 'materials';
const FREE_DIR = 'free';
const STAGING_PREFIX = '.mesa-free-staging-';
const VERSION = 2;
/* Teto de leitura do metadata: rascunho no teto do núcleo + materiais pequenos. */
const MAX_STORE_BYTES = 8 * 1024 * 1024;
/* Teto por PDF importado: generoso para apostila, longe de um payload abusivo. */
const MAX_MATERIAL_BYTES = 64 * 1024 * 1024;
const MAX_PATH = 4096;
const MAX_ATTEMPTS = 500;
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
class FreeWorkspaceError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'FreeWorkspaceError';
    this.code = code;
    this.details = details || null;
  }
}
const fail = (code, message, details) => {
  throw new FreeWorkspaceError(code, message, details);
};
const {isPlainObject} = require('./plain-object.cjs');
const isText = (value, max = MAX_PATH) => typeof value === 'string' && value.length > 0 && value.length <= max;
const isAbsolute = (value) => isText(value) && path.isAbsolute(value);
// eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
const hasControls = (value) => /[\u0000\r\n]/.test(value);
/* Caminho nativo da sessão (JSONL do Pi): existe ou ainda não nasceu; o store
   só guarda o caminho, nunca cria nem apaga o arquivo nativo. */
const cleanNativePath = (raw, code) => {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw !== 'string' || !isAbsolute(raw) || hasControls(raw)) fail(code, 'caminho nativo da sessão inválido');
  return raw;
};
const bump = (record, extra = {}) => ({...record, ...extra, updatedAt: nowIso(), rev: whole(record.rev) + 1});
/* Sessão aberta para mutação: promovida não aceita mais material; transação de
   promoção em andamento (journal `committing`) precisa ser concluída/desfeita. */
const assertOpen = (record) => {
  const plan = record.promotion;
  if (!plan) return;
  if (plan.status === 'promoted') fail('ALREADY_PROMOTED', uiMsg('err.freews.alreadyPromoted'));
  if (plan.status === 'committing') fail('PENDING', uiMsg('err.freews.pending'));
};
const SHA256 = /^[a-f0-9]{64}$/;
const SHA256_ANY = /^[a-f0-9]{64}$/i;
const whole = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
};
const nowIso = () => new Date().toISOString();
/* O corte do rascunho é do host: `String.take` da Base estoura a pilha em ~10k
   chars (README do core) e o rascunho chega a 256k. O teto continua vindo do
   núcleo — mesma divisão do `MAX_DRAFT` do state-adapter.cjs. */
const cutDraft = (text) => {
  const value = typeof text === 'string' ? text : '';
  const limit = Number(core.maxDraftChars());
  return value.length <= limit ? value : value.slice(0, limit);
};
const limitNat = (fn) => Number(fn());
const maxTitle = () => limitNat(core.maxTitle);
const maxName = () => limitNat(core.maxName);
const maxDraftChars = () => limitNat(core.maxDraftChars);
const maxMaterials = () => limitNat(core.maxMaterials);
const maxSlug = () => limitNat(core.maxSlug);
function assertRuntime(runtime) {
  if (!isAbsolute(runtime)) fail('BAD_RUNTIME', 'runtime da mesa inválido');
  return runtime;
}
function normalizeSessionId(raw) {
  if (typeof raw !== 'string') fail('BAD_ID', 'id de sessão livre inválido');
  const id = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) fail('BAD_ID', 'id de sessão livre inválido');
  return id;
}
function freeRoot(runtime) {
  return path.join(assertRuntime(runtime), FREE_DIR);
}
function workspaceDir(runtime, sessionId) {
  const id = normalizeSessionId(sessionId);
  const dir = path.join(freeRoot(runtime), id);
  if (!dir.startsWith(freeRoot(runtime) + path.sep)) fail('BAD_ID', 'workspace fora da área livre');
  return dir;
}
function fileOf(runtime, sessionId) {
  return path.join(workspaceDir(runtime, sessionId), FILENAME);
}
function materialsDirOf(runtime, sessionId) {
  return path.join(workspaceDir(runtime, sessionId), MATERIALS_DIR);
}
function normalizeMaterial(raw) {
  if (!isPlainObject(raw)) fail('CORRUPT', 'material inválido no workspace.json');
  const entry = {
    id: isText(raw.id, 128) ? raw.id : '',
    name: isText(raw.name, maxName()) ? raw.name : '',
    path: isAbsolute(raw.path) ? raw.path : '',
    kind: raw.kind === 'generated' ? 'generated' : raw.kind === 'imported' ? 'imported' : '',
    bytes: whole(raw.bytes),
    sha256: typeof raw.sha256 === 'string' && SHA256_ANY.test(raw.sha256) ? raw.sha256.toLowerCase() : '',
    addedAt: isText(raw.addedAt, 64) ? raw.addedAt : nowIso(),
  };
  if (!entry.id || !entry.name || !entry.path || !entry.kind) fail('CORRUPT', 'material inválido no workspace.json');
  return entry;
}
function normalizePromotion(raw) {
  if (raw === null || raw === undefined) return null;
  if (!isPlainObject(raw)) fail('CORRUPT', 'promoção inválida no workspace.json');
  const status = raw.status === 'promoted' ? 'promoted' : raw.status === 'prepared' ? 'prepared' : raw.status === 'committing' ? 'committing' : '';
  if (!status) fail('CORRUPT', 'promoção inválida no workspace.json');
  const plan = {
    status,
    token: isText(raw.token, 128) ? raw.token : '',
    folderName: isText(raw.folderName, maxName()) ? raw.folderName : '',
    folderPath: isAbsolute(raw.folderPath) ? raw.folderPath : '',
    parentDir: isAbsolute(raw.parentDir) ? raw.parentDir : '',
    stagingPath: isAbsolute(raw.stagingPath) ? raw.stagingPath : '',
    materials: Array.isArray(raw.materials) ? raw.materials.map(normalizeStaged).filter(Boolean) : [],
    at: isText(raw.at, 64) ? raw.at : nowIso(),
    courseId: isText(raw.courseId, 128) ? raw.courseId : '',
    courseName: isText(raw.courseName, maxName()) ? raw.courseName : '',
  };
  if (!plan.token || !plan.folderName || !plan.folderPath || !plan.parentDir) fail('CORRUPT', 'promoção inválida no workspace.json');
  if (status !== 'promoted' && !plan.stagingPath) fail('CORRUPT', 'promoção preparada sem staging');
  return plan;
}
function normalizeStaged(raw) {
  if (!isPlainObject(raw)) return null;
  const name = isText(raw.name, maxName()) ? raw.name : '';
  if (!name) return null;
  return {name, bytes: whole(raw.bytes), sha256: typeof raw.sha256 === 'string' ? raw.sha256.toLowerCase() : ''};
}
function normalizePdfDraft(raw) {
  if (!isPlainObject(raw) || !isText(raw.id, 64) || !raw.id || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > maxTitle() || typeof raw.markdown !== 'string' || !raw.markdown.trim() || raw.markdown.length > maxDraftChars()) return null;
  return {id:raw.id,title:raw.title,markdown:raw.markdown,...materialModel.draftModel(raw)};
}
function normalizeRecord(raw, sessionId) {
  if (!isPlainObject(raw)) fail('CORRUPT', 'workspace.json ilegível');
  if (raw.id !== sessionId) fail('CORRUPT', 'workspace.json de outra sessão');
  if (typeof raw.title !== 'string') fail('CORRUPT', 'título inválido no workspace.json');
  const materials = [];
  const seen = new Set();
  for (const item of Array.isArray(raw.materials) ? raw.materials : []) {
    if (materials.length >= maxMaterials()) break;
    const entry = normalizeMaterial(item);
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    materials.push(entry);
  }
  return {
    version: VERSION,
    id: sessionId,
    title: core.fitTitleOr(raw.title),
    draft: cutDraft(raw.draft),
    nativePath: cleanNativePath(raw.nativePath, 'CORRUPT'),
    materials,
    ...(normalizePdfDraft(raw.pdfDraft)?{pdfDraft:normalizePdfDraft(raw.pdfDraft)}:{}),
    promotion: normalizePromotion(raw.promotion),
    rev: whole(raw.rev),
    createdAt: isText(raw.createdAt, 64) ? raw.createdAt : nowIso(),
    updatedAt: isText(raw.updatedAt, 64) ? raw.updatedAt : nowIso(),
  };
}
function writeFileAtomic(file, bytes, {mode = 0o600} = {}) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, {recursive: true});
  const temporary = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  let fd = null;
  try {
    fd = fs.openSync(temporary, 'wx', mode);
    fs.writeFileSync(fd, bytes);
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
function writeRecord(file, record) {
  writeFileAtomic(file, Buffer.from(`${JSON.stringify(record, null, 1)}\n`, 'utf8'));
}
/* Leitura estrita: devolve o registro ou lança CORRUPT. Nunca regrava sozinha. */
function readRecord(file, sessionId) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_STORE_BYTES) fail('CORRUPT', 'workspace.json grande demais');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail('CORRUPT', 'workspace.json ilegível; nada foi sobrescrito');
  }
  return normalizeRecord(parsed, sessionId);
}
/* Nada da área livre pode ser (ou passar por) link simbólico: sem isto, um
   `<runtime>/free/<id>` que aponta para fora faria a mesa gravar no destino. */
function assertWorkspaceSafe(runtime, sessionId) {
  const targets = [freeRoot(runtime), workspaceDir(runtime, sessionId)];
  for (const target of targets) {
    const stats = fs.lstatSync(target, {throwIfNoEntry: false});
    if (stats && stats.isSymbolicLink()) fail('BAD_PATH', 'área do workspace livre não pode ser link simbólico');
  }
}
function assertMaterialsSafe(runtime, sessionId) {
  const dir = materialsDirOf(runtime, sessionId);
  const stats = fs.lstatSync(dir, {throwIfNoEntry: false});
  if (stats && stats.isSymbolicLink()) fail('BAD_PATH', 'pasta de materiais não pode ser link simbólico');
}
function mustLoad(runtime, sessionId) {
  const id = normalizeSessionId(sessionId);
  assertWorkspaceSafe(runtime, id);
  const file = fileOf(runtime, id);
  const record = readRecord(file, id);
  if (!record) fail('NOT_FOUND', uiMsg('err.freews.notFound'));
  return {file, record};
}
function sanitizeStem(raw, fallback = 'Material') {
  let text = String(raw ?? '').normalize('NFC')
    // eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-\s]+/, '')
    .replace(/[.\-\s]+$/, '');
  if (RESERVED_NAME.test(text)) text = `_${text}`;
  const limit = Math.max(1, maxName() - 4);
  if (text.length > limit) text = text.slice(0, limit).replace(/[.\-\s]+$/, '');
  return text || fallback;
}
function folderSlug(raw) {
  let text = String(raw ?? '').normalize('NFC')
    // eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-\s]+/, '')
    .replace(/[.\-\s]+$/, '');
  if (RESERVED_NAME.test(text)) text = `_${text}`;
  const limit = Math.max(1, maxSlug() - 4);
  if (text.length > limit) text = text.slice(0, limit).replace(/[.\-\s]+$/, '');
  return text || 'Nova matéria';
}
module.exports = {FILENAME, MATERIALS_DIR, FREE_DIR, STAGING_PREFIX, VERSION, MAX_MATERIAL_BYTES, MAX_PATH, MAX_ATTEMPTS, FreeWorkspaceError, fail, isPlainObject, isText, isAbsolute, hasControls, cleanNativePath, bump, assertOpen, SHA256, whole, nowIso, cutDraft, maxTitle, maxName, maxDraftChars, maxMaterials, maxSlug, normalizeSessionId, freeRoot, workspaceDir, fileOf, materialsDirOf, normalizePdfDraft, writeRecord, readRecord, assertWorkspaceSafe, assertMaterialsSafe, mustLoad, sanitizeStem, folderSlug};
