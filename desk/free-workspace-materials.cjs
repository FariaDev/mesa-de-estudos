'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./src/generated/freeworkspaces.core.js').default;
const {toNat} = require('./src/bend-nat.mjs');
const {message: uiMsg} = require('./src/i18n.mjs');
const {MATERIALS_DIR, MAX_ATTEMPTS, MAX_MATERIAL_BYTES, MAX_PATH, SHA256, assertMaterialsSafe, assertOpen, assertWorkspaceSafe, bump, fail, fileOf, isAbsolute, materialsDirOf, maxDraftChars, maxMaterials, mustLoad, normalizeSessionId, nowIso, sanitizeStem, whole, workspaceDir, writeRecord} = require('./free-workspace-record.cjs');

/* Aba Livre — materiais da sessão: PDF importado (copiado e verificado) e
   material gerado pelo tutor.
   Saiu de free-workspaces.cjs na #43 fase 2; a política continua no núcleo
   (`core/freeworkspaces.bend`). */

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
  if (record.materials.length >= maxMaterials()) fail('TOO_MANY', uiMsg('err.freews.tooMany'));
  const entry = materialEntry(runtime, sessionId, file, kind, extra);
  if (record.materials.some((material) => material.path === entry.path)) fail('EXISTS', uiMsg('err.freews.exists'));
  const next = bump(record, {materials: [...record.materials, entry]});
  writeRecord(storeFile, next);
  return {material: entry, workspace: next};
}
function importPdf(runtime, sessionId, {sourcePath, name} = {}) {
  const id = normalizeSessionId(sessionId);
  const {record} = mustLoad(runtime, id);
  assertOpen(record);
  if (record.materials.length >= maxMaterials()) fail('TOO_MANY', uiMsg('err.freews.tooMany'));
  // eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
  if (!isAbsolute(sourcePath) || sourcePath.length > MAX_PATH || /[\u0000\r\n]/.test(sourcePath)) {
    fail('BAD_SOURCE', uiMsg('err.freews.badSource'));
  }
  let stats;
  try {
    stats = fs.lstatSync(sourcePath);
  } catch {
    fail('BAD_SOURCE', uiMsg('err.freews.pdfNotFound'));
  }
  if (!stats.isFile()) fail('BAD_SOURCE', 'PDF precisa ser arquivo regular');
  if (stats.size === 0) fail('BAD_PDF', 'PDF vazio');
  if (stats.size > MAX_MATERIAL_BYTES) fail('TOO_BIG', 'PDF acima do teto');
  let bytes;
  try {
    bytes = fs.readFileSync(sourcePath);
  } catch {
    fail('BAD_SOURCE', uiMsg('err.freews.pdfUnreadable'));
  }
  if (bytes.length !== stats.size) fail('BAD_SOURCE', 'PDF mudou durante a leitura');
  if (bytes.subarray(0, Math.min(1024, bytes.length)).includes(Buffer.from('%PDF-'))) {
    /* ok: assinatura dentro dos primeiros KB, como o leitor aceita */
  } else {
    fail('BAD_PDF', uiMsg('err.freews.notPdf'));
  }
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const dir = materialsDirOf(runtime, id);
  fs.mkdirSync(dir, {recursive: true});
  assertMaterialsSafe(runtime, id);
  const stem = sanitizeStem(name || path.basename(sourcePath, path.extname(sourcePath)));
  let chosen = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt += 1) {
    const candidate = core.candidateName(stem, '.pdf', toNat(attempt));
    const temporary = path.join(dir, `.import-${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(temporary, bytes, {flag: 'wx', mode: 0o600});
      try {
        const written = sha256OfFile(temporary);
        if (written !== digest) fail('VERIFY', uiMsg('err.freews.copyMismatch'));
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
  if (!chosen) fail('COLLISION', uiMsg('err.pdf.noFreeName'));
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
async function saveMaterial(runtime, sessionId, {title, markdown, model, options, context, signal, timeoutMs, pdf} = {}) {
  const id = normalizeSessionId(sessionId);
  const {record} = mustLoad(runtime, id);
  assertOpen(record);
  if (record.materials.length >= maxMaterials()) fail('TOO_MANY', uiMsg('err.freews.tooMany'));
  if (typeof markdown !== 'string' || markdown.trim() === '') fail('EMPTY', uiMsg('err.freews.writeFirst'));
  if (markdown.length > maxDraftChars()) fail('TOO_BIG', uiMsg('err.pdf.tooBig'));
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
    model,
    options,
    context,
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

module.exports = {sha256OfFile, registerMaterial, importPdf, saveMaterial};
