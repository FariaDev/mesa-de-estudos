'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {message: uiMsg} = require('../i18n.mjs');
const {causeArg} = require('../error-detail.mjs');
const {assertSafePath, joinUnder} = require('./zipkit.cjs');

/* Pacote de matéria — formato, erro, utilidades de arquivo e escrita dentro
   da pasta de destino.
   Saiu de packages.cjs na #43 fase 2. */

const PACKAGE_FORMAT = 1;
const MANIFEST_NAME = 'mesa-package.json';
const PACKAGE_EXT = '.mesa-materia';
const PACKAGE_ERROR = 'MESA_PACKAGE_ERROR';
class PackageError extends Error {
  constructor(message, code = PACKAGE_ERROR) {
    super(message);
    this.name = 'PackageError';
    this.code = code;
  }
}
const {isPlainObject} = require('../../plain-object.cjs');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const posix = (value) => String(value).split(path.sep).join('/');
const {readJson} = require('../../json-file.cjs');
function newId(prefix = 'novo') {
  return `${prefix}-${crypto.randomUUID()}`;
}
/* Nome de pasta seguro a partir de um rótulo humano. */
function safeDirName(name, fallback = 'materia') {
  const clean = String(name || '')
    // eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, 80) || fallback;
}
function writeInside(root, rel, data) {
  const safe = assertSafePath(rel, 'importação');
  const abs = joinUnder(root, safe);
  fs.mkdirSync(path.dirname(abs), {recursive: true});
  fs.writeFileSync(abs, data);
  return abs;
}
/* Grava o arquivo do pacote de forma EXCLUSIVA: um arquivo que apareça entre a
   prévia e a escrita (ou uma segunda exportação simultânea) nunca é
   sobrescrito — o nome ganha sufixo, como o destino de importação. */
function writePackageFile({root, name, buffer, attempts = 50} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new PackageError(uiMsg('err.pkg.noContent'));
  const base = path.resolve(String(root || ''));
  if (base === path.parse(base).root) throw new PackageError(uiMsg('err.pkg.exportRoot'));
  const desired = safeDirName(name, 'Materia');
  for (let counter = 1; counter <= attempts; counter++) {
    const finalName = counter === 1 ? desired : `${desired} (${counter})`;
    const file = path.join(base, `${finalName}${PACKAGE_EXT}`);
    try {
      fs.writeFileSync(file, buffer, {flag: 'wx'});
      return {file, name: finalName, renamed: finalName !== desired};
    } catch (error) {
      if (error && error.code === 'EEXIST') continue;
      throw new PackageError(uiMsg('err.pkg.writeFailed', {detail: causeArg(error)}));
    }
  }
  throw new PackageError(uiMsg('err.pkg.noFreeFileName'));
}

module.exports = {PACKAGE_FORMAT, MANIFEST_NAME, PACKAGE_EXT, PACKAGE_ERROR, PackageError, isPlainObject, sha256, posix, readJson, newId, safeDirName, writeInside, writePackageFile};
