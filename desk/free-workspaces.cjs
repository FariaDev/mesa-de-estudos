'use strict';

/* Aba Livre (Mesa): o workspace de sessão avulsa. Cada conversa livre tem o seu
   próprio diretório isolado, o seu metadata e os seus materiais — PDFs de uma
   sessão nunca aparecem na outra.

   Layout em disco (tudo dentro do runtime da mesa, nada em pasta de curso):

     <runtime>/free/<sessionId>/workspace.json   metadata (título, rascunho,
                                                 materiais, recibo de promoção)
     <runtime>/free/<sessionId>/materials/*.pdf  cópias gerenciadas, nomes únicos

   O núcleo Bend (`core/freeworkspaces.bend`) decide os tetos, o recorte de
   título/rascunho e a SEQUÊNCIA de nomes (`x.pdf`, `x-2.pdf`, …). Aqui ficam o
   I/O, a validação de forma, a gravação atômica e as cópias verificadas.

   Regras que o host garante:
     - id de sessão é opaco mas restrito a [A-Za-z0-9][A-Za-z0-9._-]{0,127} —
       nunca vira caminho fora de `<runtime>/free`;
     - `workspace.json` só é trocado por rename atômico: falha preserva o antigo;
     - JSON ilegível NÃO é sobrescrito (find devolve null; mutação recusa CORRUPT);
     - importação copia bytes verificados e NUNCA toca o original;
     - material importado/gerado já existe no disco antes de entrar no metadata;
       se o metadata falhar, a cópia criada pela operação é removida;
     - promoção só cria pasta NOVA, com staging no mesmo diretório-pai, cópias
       verificadas por sha256 e rollback que nunca apaga conteúdo estranho.

   Exportações (host → main.cjs; o renderer nunca escolhe caminho por conta):

     freeCourseId()/freeCourseName()/defaultTitle()      rótulos reservados
     freeRoot(runtime)                                   <runtime>/free
     workspaceDir(runtime, sessionId)                    diretório da sessão
     createWorkspace(runtime, {sessionId, title})        cria; erro se já existe
     ensureWorkspace(runtime, {sessionId, title})        cria se faltar (idempotente)
     findWorkspace(runtime, sessionId)                   registro ou null
     updateWorkspace(runtime, sessionId, {title, draft, nativePath}, {expectRev})
                                                         grava título/rascunho/caminho nativo
     renameWorkspace(runtime, sessionId, title)          atalho do update
     setNativePath(runtime, sessionId, nativePath, {expectRev})
     listWorkspaces(runtime)                             registros válidos, recentes primeiro
     listSessions(runtime)                               índice host: id, título, nativePath
                                                         (inclusive vazio), promoção, rev
     importPdf(runtime, sessionId, {sourcePath, name})   {material, workspace}
     saveMaterial(runtime, sessionId, {title, markdown, signal, timeoutMs})
                                                         renderiza PDF e registra
     workspacePayload(record)                            forma para o initialData
     folderSlug(name)                                    nome de pasta seguro (prévia)
     captureScope(runtime, sessionId)                    fatia p/ rechecar depois do await
     scopeIsCurrent(runtime, scope) / assertScope(runtime, scope)
     preparePromotion(runtime, sessionId, {parentDir, name})  staging verificado
     commitPromotion(runtime, sessionId, {token, courseId, courseName})
                                                         journal + rename + recibo
     recoverPromotion(runtime, sessionId)                conserta transação interrompida
     recoverAllPromotions(runtime)                       varredura de boot
     rollbackPromotion(runtime, sessionId)               desfaz só o que criou
     promotionPlan(runtime, sessionId)                   recibo/plano atual
     findByCourseId(runtime, courseId)                   dono de uma matéria promovida

   Erros: `FreeWorkspaceError` com `.code` estável (BAD_ID, BAD_RUNTIME, NOT_FOUND,
   EXISTS, CORRUPT, TOO_MANY, BAD_PDF, TOO_BIG, BAD_SOURCE, BAD_PATH, COLLISION,
   PENDING, ALREADY_PROMOTED, NOT_PREPARED, BAD_TOKEN, VERIFY, CONFLICT, STALE,
   OWNED, ROLLBACK) e `.details` opcional. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./src/generated/freeworkspaces.core.js').default;

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

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isText = (value, max = MAX_PATH) => typeof value === 'string' && value.length > 0 && value.length <= max;
const isAbsolute = (value) => isText(value) && path.isAbsolute(value);
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
  if (plan.status === 'promoted') fail('ALREADY_PROMOTED', 'sessão já promovida');
  if (plan.status === 'committing') fail('PENDING', 'promoção em andamento; conclua ou desfaça antes');
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

/* ---------- forma do registro ---------- */

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
  return {id:raw.id,title:raw.title,markdown:raw.markdown};
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

/* ---------- gravação atômica ---------- */

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
  if (!record) fail('NOT_FOUND', 'workspace livre não encontrado');
  return {file, record};
}

/* ---------- fachada do store ---------- */

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
  let entries = [];
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
    fail('STALE', 'a sessão mudou desde a captura; nada foi gravado', {expected: whole(expectRev), current: record.rev});
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
  let record = null;
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
  if (scopeIsCurrent(runtime, scope) === false) fail('STALE', 'a sessão mudou desde a captura; operação cancelada', {scope: scope || null});
  return true;
}

/* ---------- nomes seguros ---------- */

function sanitizeStem(raw, fallback = 'Material') {
  let text = String(raw ?? '').normalize('NFC')
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

/* Um nome ainda livre dentro de `dir` seguindo a sequência do núcleo. */
function uniqueName(dir, stem, ext = '.pdf') {
  const taken = new Set();
  try {
    for (const name of fs.readdirSync(dir)) taken.add(name);
  } catch { /* diretório recém-criado */ }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = core.candidateName(stem, ext, BigInt(attempt));
    if (!taken.has(candidate) && !fs.existsSync(path.join(dir, candidate))) return candidate;
  }
  fail('COLLISION', 'não foi possível achar um nome livre para o material');
}

/* ---------- materiais ---------- */

function sha256OfFile(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let read = 0;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function assertManagedPdf(runtime, sessionId, file) {
  if (!isAbsolute(file)) fail('BAD_PATH', 'caminho de material precisa ser absoluto');
  assertWorkspaceSafe(runtime, sessionId);
  assertMaterialsSafe(runtime, sessionId);
  const dir = materialsDirOf(runtime, sessionId);
  const realDir = fs.realpathSync(dir);
  const workspaceReal = fs.realpathSync(workspaceDir(runtime, sessionId));
  if (realDir !== path.join(workspaceReal, MATERIALS_DIR)) fail('BAD_PATH', 'pasta de materiais fora do workspace');
  const realFile = fs.realpathSync(file);
  if (realFile !== path.join(realDir, path.basename(file))) fail('BAD_PATH', 'material fora da área gerenciada');
  const stats = fs.lstatSync(file);
  if (!stats.isFile()) fail('BAD_PATH', 'material não é arquivo regular');
  if (stats.size > MAX_MATERIAL_BYTES) fail('TOO_BIG', 'material acima do teto');
  return {realFile, realDir, bytes: stats.size};
}

function materialEntry(runtime, sessionId, file, kind, {bytes, sha256} = {}) {
  const checked = assertManagedPdf(runtime, sessionId, file);
  const size = checked.bytes;
  let digest = typeof sha256 === 'string' && SHA256.test(sha256) ? sha256 : '';
  if (!digest) digest = sha256OfFile(file);
  if (whole(bytes) && whole(bytes) !== size) fail('VERIFY', 'material não confere com o tamanho esperado');
  if (sha256 && digest !== String(sha256).toLowerCase()) fail('VERIFY', 'material não confere com o sha256 esperado');
  return {
    id: `m_${crypto.randomBytes(8).toString('hex')}`,
    name: path.basename(file),
    path: file,
    kind: kind === 'generated' ? 'generated' : 'imported',
    bytes: size,
    sha256: digest,
    addedAt: nowIso(),
  };
}

function registerMaterial(runtime, sessionId, file, kind, extra = {}) {
  const {file: storeFile, record} = mustLoad(runtime, sessionId);
  if (record.materials.length >= maxMaterials()) fail('TOO_MANY', 'limite de materiais da sessão atingido');
  const entry = materialEntry(runtime, sessionId, file, kind, extra);
  if (record.materials.some((material) => material.path === entry.path)) fail('EXISTS', 'material já registrado');
  const next = bump(record, {materials: [...record.materials, entry]});
  writeRecord(storeFile, next);
  return {material: entry, workspace: next};
}

function importPdf(runtime, sessionId, {sourcePath, name} = {}) {
  const id = normalizeSessionId(sessionId);
  const {record} = mustLoad(runtime, id);
  assertOpen(record);
  if (record.materials.length >= maxMaterials()) fail('TOO_MANY', 'limite de materiais da sessão atingido');
  if (!isAbsolute(sourcePath) || sourcePath.length > MAX_PATH || /[\u0000\r\n]/.test(sourcePath)) {
    fail('BAD_SOURCE', 'caminho de PDF inválido');
  }
  let stats;
  try {
    stats = fs.lstatSync(sourcePath);
  } catch {
    fail('BAD_SOURCE', 'PDF não encontrado');
  }
  if (!stats.isFile()) fail('BAD_SOURCE', 'PDF precisa ser arquivo regular');
  if (stats.size === 0) fail('BAD_PDF', 'PDF vazio');
  if (stats.size > MAX_MATERIAL_BYTES) fail('TOO_BIG', 'PDF acima do teto');
  let bytes;
  try {
    bytes = fs.readFileSync(sourcePath);
  } catch {
    fail('BAD_SOURCE', 'PDF não pôde ser lido');
  }
  if (bytes.length !== stats.size) fail('BAD_SOURCE', 'PDF mudou durante a leitura');
  if (bytes.subarray(0, Math.min(1024, bytes.length)).includes(Buffer.from('%PDF-'))) {
    /* ok: assinatura dentro dos primeiros KB, como o leitor aceita */
  } else {
    fail('BAD_PDF', 'arquivo não parece um PDF');
  }
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const dir = materialsDirOf(runtime, id);
  fs.mkdirSync(dir, {recursive: true});
  assertMaterialsSafe(runtime, id);
  const stem = sanitizeStem(name || path.basename(sourcePath, path.extname(sourcePath)));
  let chosen = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt += 1) {
    const candidate = core.candidateName(stem, '.pdf', BigInt(attempt));
    const temporary = path.join(dir, `.import-${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(temporary, bytes, {flag: 'wx', mode: 0o600});
      try {
        const written = sha256OfFile(temporary);
        if (written !== digest) fail('VERIFY', 'cópia do PDF não confere com o original');
        try {
          fs.linkSync(temporary, path.join(dir, candidate));
          chosen = candidate;
        } catch (error) {
          if (error.code !== 'EEXIST' && error.code !== 'EPERM' && error.code !== 'EXDEV') throw error;
          if (error.code !== 'EEXIST') {
            fs.copyFileSync(temporary, path.join(dir, candidate), fs.constants.COPYFILE_EXCL);
            chosen = candidate;
          }
        }
      } finally {
        try { fs.rmSync(temporary, {force: true}); } catch { /* já foi */ }
      }
    } catch (error) {
      if (error && error.code === 'EEXIST') continue;
      throw error;
    }
  }
  if (!chosen) fail('COLLISION', 'não foi possível achar um nome livre para o PDF');
  const target = path.join(dir, chosen);
  const entry = materialEntry(runtime, id, target, 'imported', {bytes: bytes.length, sha256: digest});
  const next = bump(record, {materials: [...record.materials, entry]});
  try {
    writeRecord(fileOf(runtime, id), next);
  } catch (error) {
    try { fs.rmSync(target, {force: true}); } catch { /* já foi */ }
    throw error;
  }
  return {material: entry, workspace: next};
}

/* Renderiza o PDF pelo serviço e registra o material. A composição vive aqui
   para que uma falha de metadata desfaça o arquivo criado por esta operação.
   `pdf` só existe para o teste isolado (default: material-pdf.cjs). */
async function saveMaterial(runtime, sessionId, {title, markdown, signal, timeoutMs, pdf} = {}) {
  const id = normalizeSessionId(sessionId);
  const {record} = mustLoad(runtime, id);
  assertOpen(record);
  if (record.materials.length >= maxMaterials()) fail('TOO_MANY', 'limite de materiais da sessão atingido');
  if (typeof markdown !== 'string' || markdown.trim() === '') fail('EMPTY', 'escreva o conteúdo do PDF antes de salvar');
  if (markdown.length > maxDraftChars()) fail('TOO_BIG', 'conteúdo acima do teto');
  const materialPdf = pdf || require('./material-pdf.cjs');
  const picked = typeof title === 'string' && title.trim() ? title : record.title;
  const stem = sanitizeStem(picked);
  const materialsDir = materialsDirOf(runtime, id);
  fs.mkdirSync(materialsDir, {recursive: true});
  assertMaterialsSafe(runtime, id);
  const saved = await materialPdf.savePdf({
    dir: materialsDir,
    stem,
    title: core.fitTitle(picked),
    markdown,
    signal,
    timeoutMs,
  });
  try {
    return registerMaterial(runtime, id, saved.path, 'generated', {bytes: saved.bytes, sha256: saved.sha256});
  } catch (error) {
    try { fs.rmSync(saved.path, {force: true}); } catch { /* já foi */ }
    throw error;
  }
}

/* ---------- promoção (pasta nova, nunca sobrescreve, rollback só do que criou) ---------- */

function assertParentDir(parentDir) {
  if (!isAbsolute(parentDir) || parentDir.length > MAX_PATH) fail('BAD_PATH', 'pasta escolhida inválida');
  let stats;
  try {
    stats = fs.statSync(parentDir);
  } catch {
    fail('BAD_PATH', 'pasta escolhida não existe');
  }
  if (!stats.isDirectory()) fail('BAD_PATH', 'destino não é uma pasta');
  const real = fs.realpathSync(parentDir);
  if (!fs.statSync(real).isDirectory()) fail('BAD_PATH', 'destino não é uma pasta');
  return real;
}

function assertInside(parent, child) {
  const base = path.resolve(parent);
  const target = path.resolve(child);
  if (target !== base && !target.startsWith(base + path.sep)) fail('BAD_PATH', 'caminho escapa da pasta autorizada');
  return target;
}

function isGuardedStaging(stagingPath, parentDir) {
  const base = path.basename(stagingPath);
  return path.dirname(stagingPath) === path.resolve(parentDir) && base.startsWith(STAGING_PREFIX) && base.length > STAGING_PREFIX.length;
}

function removeStagingGuarded(plan) {
  if (!isGuardedStaging(plan.stagingPath, plan.parentDir)) fail('CONFLICT', 'staging fora da pasta autorizada; nada foi apagado');
  const stats = fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false});
  if (!stats) return;
  if (stats.isSymbolicLink()) {
    fs.rmSync(plan.stagingPath, {force: true});
    return;
  }
  if (!stats.isDirectory()) fail('CONFLICT', 'staging não é pasta; nada foi apagado');
  fs.rmSync(plan.stagingPath, {recursive: true, force: false});
}

function preparePromotion(runtime, sessionId, {parentDir, name} = {}) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  if (record.promotion && record.promotion.status === 'promoted') fail('ALREADY_PROMOTED', 'sessão já promovida');
  if (record.promotion && record.promotion.status === 'committing') fail('PENDING', 'promoção em andamento; conclua ou desfaça antes');
  if (record.promotion && record.promotion.status === 'prepared') {
    fail('PENDING', 'já existe uma promoção preparada; desfaça antes de preparar de novo');
  }
  const realParent = assertParentDir(parentDir);
  const base = folderSlug(name || record.title);
  let folderName = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = core.candidateFolder(base, BigInt(attempt));
    const target = path.join(realParent, candidate);
    assertInside(realParent, target);
    const stats = fs.lstatSync(target, {throwIfNoEntry: false});
    if (!stats) {
      folderName = candidate;
      break;
    }
  }
  if (!folderName) fail('COLLISION', 'não foi possível achar um nome de pasta livre');
  const folderPath = path.join(realParent, folderName);
  const token = crypto.randomBytes(12).toString('hex');
  const stagingPath = path.join(realParent, `${STAGING_PREFIX}${token}`);
  if (fs.lstatSync(stagingPath, {throwIfNoEntry: false})) fail('COLLISION', 'staging já existia');
  fs.mkdirSync(stagingPath, {mode: 0o700});
  const stagingMaterials = path.join(stagingPath, MATERIALS_DIR);
  fs.mkdirSync(stagingMaterials);
  const staged = [];
  try {
    const workspaceReal = fs.realpathSync(workspaceDir(runtime, id));
    const materialsReal = fs.realpathSync(materialsDirOf(runtime, id));
    if (materialsReal !== path.join(workspaceReal, MATERIALS_DIR)) fail('BAD_PATH', 'pasta de materiais do workspace não confere');
    for (const material of record.materials) {
      const source = fs.lstatSync(material.path, {throwIfNoEntry: false});
      if (!source || !source.isFile()) fail('BAD_SOURCE', `material ausente: ${material.name}`);
      const sourceReal = fs.realpathSync(material.path);
      assertInside(materialsReal, sourceReal);
      const sourceHash = sha256OfFile(sourceReal);
      if (material.sha256 && material.sha256 !== sourceHash) fail('VERIFY', `material mudou desde a importação: ${material.name}`);
      const target = path.join(stagingMaterials, material.name);
      if (fs.lstatSync(target, {throwIfNoEntry: false})) fail('COLLISION', `staging já tem ${material.name}`);
      fs.copyFileSync(sourceReal, target, fs.constants.COPYFILE_EXCL);
      const copyHash = sha256OfFile(target);
      const copyBytes = fs.statSync(target).size;
      if (copyHash !== sourceHash || (material.bytes && copyBytes !== material.bytes)) {
        fail('VERIFY', `cópia não confere: ${material.name}`);
      }
      staged.push({name: material.name, bytes: copyBytes, sha256: copyHash});
    }
  } catch (error) {
    try { fs.rmSync(stagingPath, {recursive: true, force: true}); } catch { /* já foi */ }
    throw error;
  }
  const plan = {
    status: 'prepared',
    token,
    folderName,
    folderPath,
    parentDir: realParent,
    stagingPath,
    materials: staged,
    at: nowIso(),
    courseId: '',
    courseName: '',
  };
  try {
    writeRecord(file, bump(record, {promotion: plan}));
  } catch (error) {
    try { fs.rmSync(stagingPath, {recursive: true, force: true}); } catch { /* já foi */ }
    throw error;
  }
  return plan;
}

/* Um courseId pertence a no máximo uma sessão promovida; quem promove não pode
   roubar a matéria de outra conversa. */
function assertCourseOwnership(runtime, sessionId, courseId) {
  if (!courseId) return;
  if (!isText(courseId, 128) || hasControls(courseId)) fail('BAD_ID', 'id de matéria inválido para a promoção');
  if (core.isFreeCourseId(courseId)) fail('BAD_ID', 'mesa-free não pode ser matéria de destino da promoção');
  const owner = findByCourseId(runtime, courseId);
  if (owner && owner.sessionId !== sessionId) {
    fail('OWNED', 'outra sessão já reivindica esta matéria', {courseId, sessionId: owner.sessionId});
  }
}

/* Transação em duas fases: o journal (`committing` + matéria) é gravado ANTES
   do rename; depois do rename grava-se o recibo (`promoted`). Crash entre os
   dois deixa um estado que `recoverPromotion` conclui ou desfaz sem chute. */
function commitPromotion(runtime, sessionId, {token, courseId, courseName} = {}) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  const plan = record.promotion;
  if (!plan || (plan.status !== 'prepared' && plan.status !== 'committing')) fail('NOT_PREPARED', 'nenhuma promoção preparada para confirmar');
  if (token && token !== plan.token) fail('BAD_TOKEN', 'promoção preparada é de outra operação');
  const pickedCourseId = courseId === undefined || courseId === null ? '' : courseId;
  if (pickedCourseId !== '' && (!isText(pickedCourseId, 128) || hasControls(pickedCourseId))) {
    fail('BAD_ID', 'id de matéria inválido para a promoção');
  }
  const pickedCourseName = typeof courseName === 'string' && courseName.trim() !== '' ? core.fitName(courseName) : '';
  if (pickedCourseId) assertCourseOwnership(runtime, id, pickedCourseId);
  if (!isGuardedStaging(plan.stagingPath, plan.parentDir)) fail('CONFLICT', 'staging fora da pasta autorizada');
  assertInside(plan.parentDir, plan.folderPath);
  let live = record;
  let staging = fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false});
  let folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});

  if (plan.status === 'prepared') {
    if (folder) {
      try { removeStagingGuarded(plan); } catch { /* mantém o staging se não puder apagar */ }
      writeRecord(file, bump(live, {promotion: null}));
      fail('COLLISION', 'a pasta de destino apareceu durante a operação; nada foi sobrescrito');
    }
    if (!staging || !staging.isDirectory() || staging.isSymbolicLink()) fail('NOT_PREPARED', 'staging da promoção sumiu; desfaça e prepare de novo');
    live = bump(live, {promotion: {
      ...plan,
      status: 'committing',
      courseId: pickedCourseId || plan.courseId,
      courseName: pickedCourseName || plan.courseName,
      at: nowIso(),
    }});
    writeRecord(file, live);
  } else {
    if (staging && folder) fail('CONFLICT', 'staging e pasta de destino existem ao mesmo tempo; resolva antes de confirmar');
    if (!staging && !folder) {
      writeRecord(file, bump(live, {promotion: null}));
      fail('NOT_PREPARED', 'transação de promoção sem staging nem destino; desfaça e prepare de novo');
    }
  }

  if (staging && !folder && staging.isDirectory() && staging.isSymbolicLink() === false) {
    try {
      fs.renameSync(plan.stagingPath, plan.folderPath);
    } catch (error) {
      /* Fica em `committing` com o staging intacto: recover/rollback decidem. */
      throw new FreeWorkspaceError('CONFLICT', `não foi possível publicar a pasta da matéria: ${error.message}`, {cause: error.message});
    }
    folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
  }
  if (!folder) fail('NOT_PREPARED', 'a pasta de destino não existe; desfaça e prepare de novo');
  verifyPromotedFolder(live.promotion);

  const receipt = {...live.promotion, status: 'promoted', stagingPath: '', at: nowIso()};
  try {
    writeRecord(file, bump(live, {promotion: receipt}));
  } catch (error) {
    try {
      fs.renameSync(plan.folderPath, plan.stagingPath);
    } catch (back) {
      throw new FreeWorkspaceError('ROLLBACK', `falha ao gravar o recibo e ao devolver a pasta: ${back.message}`, {cause: error.message});
    }
    throw error;
  }
  return {
    folderName: receipt.folderName,
    folderPath: receipt.folderPath,
    materials: receipt.materials,
    promotion: receipt,
  };
}

function verifyPromotedFolder(plan) {
  const stats = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) fail('CONFLICT', 'pasta promovida não confere; nada foi apagado');
  const entries = fs.readdirSync(plan.folderPath);
  if (entries.length !== 1 || entries[0] !== MATERIALS_DIR) fail('CONFLICT', 'a pasta de destino tem conteúdo inesperado; nada foi apagado');
  const inside = fs.readdirSync(path.join(plan.folderPath, MATERIALS_DIR)).sort();
  const expected = plan.materials.map((material) => material.name).sort();
  if (inside.length !== expected.length || inside.some((name, index) => name !== expected[index])) {
    fail('CONFLICT', 'a pasta de destino tem arquivos inesperados; nada foi apagado');
  }
  for (const material of plan.materials) {
    const file = path.join(plan.folderPath, MATERIALS_DIR, material.name);
    const fileStats = fs.lstatSync(file, {throwIfNoEntry: false});
    if (!fileStats || !fileStats.isFile() || fileStats.isSymbolicLink()) fail('CONFLICT', 'arquivo promovido não confere; nada foi apagado');
    if (sha256OfFile(file) !== material.sha256) fail('CONFLICT', 'arquivo promovido mudou; nada foi apagado');
  }
}

function rollbackPromotion(runtime, sessionId) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  const plan = record.promotion;
  if (!plan) return {rolledBack: false, reason: 'nothing-to-undo'};
  if (plan.status === 'promoted' || plan.status === 'committing') {
    const folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
    if (folder) {
      verifyPromotedFolder(plan);
      fs.rmSync(plan.folderPath, {recursive: true, force: false});
    }
    if (plan.stagingPath && fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false})) removeStagingGuarded(plan);
  } else {
    removeStagingGuarded(plan);
  }
  writeRecord(file, bump(record, {promotion: null}));
  return {rolledBack: true};
}

/* Conserta uma transação interrompida por crash/queda, sem inventar pasta:
     prepared + staging + sem destino      → segue pendente (`prepared`)
     prepared + destino                    → `conflict` (destino não é nosso)
     prepared sem staging e sem destino    → `cancelled` (nada foi criado)
     committing + staging + sem destino    → conclui o rename e grava o recibo
     committing + destino verificado       → grava o recibo
     committing sem staging e sem destino  → `cancelled`
   Qualquer incoerência vira `conflict` e NADA é apagado. */
function recoverPromotion(runtime, sessionId) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  const plan = record.promotion;
  if (!plan) return {state: 'none'};
  if (plan.status === 'promoted') return {state: 'promoted', promotion: plan};
  const staging = plan.stagingPath ? fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false}) : undefined;
  const folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
  if (plan.status === 'prepared') {
    if (folder) return {state: 'conflict', promotion: plan, reason: 'destino-existe-sem-journal' };
    if (staging) return {state: 'prepared', promotion: plan};
    writeRecord(file, bump(record, {promotion: null}));
    return {state: 'cancelled', promotion: plan};
  }
  if (staging && folder) return {state: 'conflict', promotion: plan, reason: 'staging-e-destino' };
  if (!staging && !folder) {
    writeRecord(file, bump(record, {promotion: null}));
    return {state: 'cancelled', promotion: plan};
  }
  if (staging && (!staging.isDirectory() || staging.isSymbolicLink())) {
    return {state: 'conflict', promotion: plan, reason: 'staging-invalido'};
  }
  if (staging) {
    try {
      fs.renameSync(plan.stagingPath, plan.folderPath);
    } catch (error) {
      return {state: 'conflict', promotion: plan, reason: `rename: ${error.message}`};
    }
  }
  try {
    verifyPromotedFolder(plan);
  } catch (error) {
    return {state: 'conflict', promotion: plan, reason: error.message};
  }
  const receipt = {...plan, status: 'promoted', stagingPath: '', at: nowIso()};
  writeRecord(file, bump(record, {promotion: receipt}));
  return {state: 'committed', completed: true, promotion: receipt};
}

/* Varredura de boot: devolve só as sessões que precisaram de algo. */
function recoverAllPromotions(runtime) {
  const out = [];
  for (const record of listWorkspaces(runtime)) {
    if (!record.promotion || record.promotion.status === 'promoted') continue;
    const result = recoverPromotion(runtime, record.id);
    out.push({sessionId: record.id, ...result});
  }
  return out;
}

function promotionPlan(runtime, sessionId) {
  return mustLoad(runtime, sessionId).record.promotion;
}

/* ---------- formas para o renderer ---------- */

function workspacePayload(record) {
  return {
    kind: 'free',
    id: core.freeCourseId(),
    sessionId: record.id,
    title: record.title,
    ...(record.pdfDraft?{pdfDraft:record.pdfDraft}:{}),
    materials: record.materials.map((material) => ({
      id: material.id,
      name: material.name,
      path: material.path,
      kind: material.kind,
    })),
    promotedCourseId: record.promotion && record.promotion.status === 'promoted' ? record.promotion.courseId : '',
  };
}

module.exports = {
  FreeWorkspaceError,
  FILENAME,
  MATERIALS_DIR,
  FREE_DIR,
  STAGING_PREFIX,
  MAX_MATERIAL_BYTES,
  freeCourseId: () => core.freeCourseId(),
  freeCourseName: () => core.freeCourseName(),
  defaultTitle: () => core.defaultTitle(),
  maxTitle,
  maxName,
  maxDraftChars,
  maxMaterials,
  maxSlug,
  freeRoot,
  workspaceDir,
  createWorkspace,
  ensureWorkspace,
  findWorkspace,
  updateWorkspace,
  renameWorkspace,
  setNativePath,
  listWorkspaces,
  listSessions,
  captureScope,
  scopeIsCurrent,
  assertScope,
  findByCourseId,
  importPdf,
  registerMaterial,
  saveMaterial,
  cutDraft,
  sanitizeStem,
  folderSlug,
  preparePromotion,
  commitPromotion,
  recoverPromotion,
  recoverAllPromotions,
  rollbackPromotion,
  promotionPlan,
  workspacePayload,
};
