'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {message: uiMsg} = require('../i18n.mjs');
const {readZip, safeRelPath, ZipError} = require('./zipkit.cjs');
const {MANIFEST_NAME, PACKAGE_FORMAT, PackageError, isPlainObject, safeDirName, sha256} = require('./package-common.cjs');

/* Pacote de matéria — leitura e validação do pacote e a pasta de destino.
   Saiu de packages.cjs na #43 fase 2. */

const PACKAGE_KINDS = new Set(['materials', 'learning', 'store', 'conversations']);
/* Abre o arquivo SEM tocar o disco de destino: valida zip, manifesto, limites
   e o hash de cada arquivo. Devolve manifesto + mapa de buffers prontos para a
   prévia de importação. */
function openPackage(buffer, {limits = {}} = {}) {
  let entries;
  try {
    entries = readZip(buffer, {limits});
  } catch (error) {
    if (error instanceof ZipError) throw new PackageError(error.message);
    throw error;
  }
  const map = new Map(entries.map((entry) => [entry.name, entry.data]));
  const manifestBuffer = map.get(MANIFEST_NAME);
  if (!manifestBuffer) throw new PackageError(uiMsg('err.pkg.noManifest'));
  let manifest;
  try {
    manifest = JSON.parse(manifestBuffer.toString('utf8'));
  } catch {
    throw new PackageError(uiMsg('err.pkg.unreadableManifest'));
  }
  if (!isPlainObject(manifest) || manifest.kind !== 'mesa-study-package') {
    throw new PackageError(uiMsg('err.pkg.notPackage'));
  }
  if (Number(manifest.format) !== PACKAGE_FORMAT) {
    throw new PackageError(uiMsg('err.pkg.format', {format: String(manifest.format)}));
  }
  if (!Array.isArray(manifest.files)) throw new PackageError(uiMsg('err.pkg.noFileList'));
  const maxFiles = Number(limits.maxEntries) > 0 ? Math.trunc(Number(limits.maxEntries)) : 20000;
  if (manifest.files.length > maxFiles) throw new PackageError(uiMsg('err.pkg.tooManyFiles', {count: manifest.files.length}));
  const declared = new Set([MANIFEST_NAME]);
  const missing = [];
  const mismatched = [];
  for (const item of manifest.files) {
    if (!isPlainObject(item) || typeof item.archivePath !== 'string') throw new PackageError(uiMsg('err.pkg.badEntry'));
    const rel = safeRelPath(item.archivePath);
    if (!rel || !rel.startsWith('payload/')) throw new PackageError(uiMsg('err.pkg.suspiciousPath', {path: item.archivePath}));
    /* O manifesto é a ROTA da importação: kind decide a partição e rel o nome
       dentro dela. Um kind desconhecido (ou a combinação de rota e caminho
       que não bate) não pode virar escrita silenciosa em lugar nenhum. */
    if (!PACKAGE_KINDS.has(item.kind)) throw new PackageError(uiMsg('err.pkg.unknownKind', {kind: String(item.kind)}));
    const payloadRel = safeRelPath(item.rel);
    if (!payloadRel) throw new PackageError(uiMsg('err.pkg.badRel', {path: String(item.rel)}));
    if (rel !== `payload/${item.kind}/${payloadRel}`) throw new PackageError(uiMsg('err.pkg.badRoute', {path: item.archivePath}));
    if (item.kind === 'conversations' && item.engine !== 'pi' && item.engine !== 'claude') {
      throw new PackageError(uiMsg('err.pkg.noEngine', {path: item.archivePath}));
    }
    declared.add(rel);
    const data = map.get(rel);
    if (!data) {
      missing.push(rel);
      continue;
    }
    if (data.length !== Number(item.bytes) || sha256(data) !== item.sha256) mismatched.push(rel);
  }
  const extra = [];
  for (const name of map.keys()) if (!declared.has(name)) extra.push(name);
  if (missing.length || mismatched.length || extra.length) {
    /* Uma frase só: a mensagem marcada não aceita outra mensagem como argumento. */
    throw new PackageError(uiMsg('err.pkg.inconsistent', {missing: missing.length, mismatched: mismatched.length, extra: extra.length}));
  }
  return {manifest, entries: manifest.files, buffers: map};
}
/* Onde o pacote pousa: `<root>/<nome>`; nome ocupado ganha sufixo, nunca
   sobrescreve. O host escolhe a raiz (diálogo) e passa o nome sugerido. */
function planDestination({root, name}) {
  const base = path.resolve(root);
  const desired = safeDirName(name, 'Matéria importada');
  /* Nunca no próprio volume: importar em `/` criaria `/materiais` etc. fora de
     qualquer matéria. O destino tem de ser uma pasta de verdade. */
  if (base === path.parse(base).root) throw new PackageError(uiMsg('err.pkg.importRoot'));
  let dir = path.join(base, desired);
  let finalName = desired;
  let counter = 1;
  while (fs.existsSync(dir)) {
    counter++;
    finalName = `${desired} (${counter})`;
    dir = path.join(base, finalName);
    if (counter > 200) throw new PackageError(uiMsg('err.pkg.noFreeName'));
  }
  return {dir, name: finalName, renamed: finalName !== desired};
}

module.exports = {openPackage, planDestination};
