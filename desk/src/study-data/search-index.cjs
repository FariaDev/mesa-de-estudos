'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {INDEX_DIR, INDEX_FILE, INDEX_VERSION, MAX_INDEX_BYTES, plain, readJson} = require('./search-text.cjs');

/* Busca de estudos — índice incremental em `runtime/study-search/index.json`
 * (assinatura `mtime:tamanho`, teto de bytes, invalidação).
 * Saiu de search.cjs na #43 fase 2; a política continua no núcleo
 * (`core/studysearch.bend`). */

function indexPath(runtime) {
  return path.join(runtime, INDEX_DIR, INDEX_FILE);
}
function loadIndex(runtime) {
  const parsed = readJson(indexPath(runtime));
  if (!parsed || parsed.version !== INDEX_VERSION || !plain(parsed.files)) {
    return {version: INDEX_VERSION, files: {}, updatedAt: 0};
  }
  return parsed;
}
function writeIndex(runtime, index) {
  const file = indexPath(runtime);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(index)}\n`, {encoding: 'utf8', mode: 0o600});
  fs.renameSync(temporary, file);
}
/* Mantém o índice abaixo do teto derrubando o registro usado há mais tempo. */
function pruneIndex(index) {
  let size = () => JSON.stringify(index).length;
  if (size() <= MAX_INDEX_BYTES) return;
  const keys = Object.keys(index.files).sort((a, b) => (index.files[a]?.at || 0) - (index.files[b]?.at || 0));
  for (const key of keys) {
    if (size() <= MAX_INDEX_BYTES) break;
    delete index.files[key];
  }
}
/* `clearIndex` derruba o cache inteiro (a próxima busca reindexa). */
function clearIndex(runtime) {
  try {
    fs.rmSync(indexPath(runtime), {force: true});
  } catch { /* já foi */ }
}
/* `invalidate(runtime, {file|kind|source})` derruba só o que casa. */
function invalidate(runtime, match = {}) {
  const index = loadIndex(runtime);
  let removed = 0;
  for (const [key, record] of Object.entries(index.files)) {
    const hit =
      (match.file && record.file === match.file) ||
      (match.key && key === match.key) ||
      (match.kind && record.kind === match.kind) ||
      (match.source && record.source === match.source) ||
      (match.courseId && record.courseId === match.courseId);
    if (hit) {
      delete index.files[key];
      removed++;
    }
  }
  if (removed) writeIndex(runtime, index);
  return removed;
}

module.exports = {loadIndex, writeIndex, pruneIndex, clearIndex, invalidate};
