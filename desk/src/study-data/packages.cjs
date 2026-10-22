'use strict';

/* Compartilhar matéria num ARQUIVO PORTÁTIL (`.mesa-materia`, zip com
   manifesto). Um arquivo guarda:

     mesa-package.json     manifesto: o que veio, hash SHA-256 por arquivo,
                           matéria de origem e se as conversas entraram;
     payload/…             os arquivos, separados por área.

   Importar cria SEMPRE um destino novo: nome novo, id novo (`novo-…`), cada
   referência é remapeada e cada conversa ganha id/arquivo novos. Nunca
   substitui matéria existente, nunca executa conteúdo nem aplica configuração
   exportada (o `config.json` de dentro não é lido nem aplicado).

   Validação antes de qualquer escrita: zip legível (CRC conferido por
   `zipkit.readZip`), manifesto presente e do formato conhecido, `..`/absoluto/
   symlink recusados, hash de cada arquivo batendo com o manifesto e limites de
   entrada/bytes respeitados.

   Nada de dependência nova: o zip é o do `zipkit.cjs` (builtins). */

const fs = require('node:fs');
const path = require('node:path');
const {message: uiMsg} = require('../i18n.mjs');
const {writeZip, assertSafePath} = require('./zipkit.cjs');
const {MANIFEST_NAME, PACKAGE_ERROR, PACKAGE_EXT, PACKAGE_FORMAT, PackageError, isPlainObject, newId, safeDirName, sha256, writePackageFile} = require('./package-common.cjs');
const {MATERIAL_SKIP_DIRS, MATERIAL_SKIP_FILES, STORE_FILES, conversationEntries, importNoteStore, noteStoreEntry, resolveNoteStore, storeEntry, walkFiles} = require('./package-source.cjs');
const {importPackage, remapValue} = require('./package-import.cjs');
const {openPackage, planDestination} = require('./package-read.cjs');

/* ---------- escrever o pacote ---------- */

/* `exportCourse` monta o pacote a partir das escolhas explícitas do host:
   `include` decide review/bookmarks/resume/annotations/conversations;
   `materialsDir` e `learningDir` são caminhos CONFERIDOS pelo host (nunca
   vindos do renderer como autorização). Devolve o Buffer do arquivo — quem
   grava é o host (`writePackageFile`, com criação exclusiva). */
function buildPackage({
  runtime,
  course = {},
  materialsDir = '',
  learningDir = '',
  include = {},
  now = new Date(),
  appVersion = '',
}) {
  if (!runtime) throw new PackageError(uiMsg('err.pkg.noRuntime'));
  const courseId = String(course.id || '');
  const courseName = String(course.name || courseId || 'Matéria');
  const entries = [];
  const files = new Map();
  const add = (kind, rel, data, extra = {}) => {
    const norm = assertSafePath(`payload/${kind}/${rel}`, 'pacote');
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    const hash = sha256(buffer);
    files.set(norm, buffer);
    entries.push({archivePath: norm, kind, rel, sha256: hash, bytes: buffer.length, ...extra});
    return hash;
  };

  if (materialsDir && fs.existsSync(materialsDir)) {
    const found = [];
    walkFiles(path.resolve(materialsDir), '', found, {skipDirs: MATERIAL_SKIP_DIRS, skipFiles: MATERIAL_SKIP_FILES});
    for (const item of found) add('materials', item.rel, fs.readFileSync(item.source));
  }
  if (learningDir && fs.existsSync(learningDir)) {
    const found = [];
    walkFiles(path.resolve(learningDir), '', found);
    for (const item of found) add('learning', item.rel, fs.readFileSync(item.source));
  }

  const stores = {};
  for (const [feature, file] of Object.entries(STORE_FILES)) {
    if (include[feature] === false) continue;
    const slice = feature === 'annotations' ? noteStoreEntry(runtime, courseId) : storeEntry(runtime, courseId, file);
    if (slice) {
      add('store', file, slice.text, {store: feature, ...(slice.portable ? {portable: 1} : {})});
      stores[feature] = slice.bytes;
    }
  }

  const conversations = {included: include.conversations === true, items: []};
  if (conversations.included) {
    for (const item of conversationEntries(runtime, courseId)) {
      const data = fs.readFileSync(item.source);
      const hash = add('conversations', item.rel, data, {engine: item.engine, originalName: path.basename(item.source)});
      conversations.items.push({
        archivePath: `payload/conversations/${item.rel}`,
        engine: item.engine,
        originalName: path.basename(item.source),
        sha256: hash,
        bytes: data.length,
        resume: item.engine === 'pi' ? 'pi-jsonl-portable' : 'exported-transcript',
      });
    }
  }

  const manifest = {
    kind: 'mesa-study-package',
    format: PACKAGE_FORMAT,
    created: new Date(now).toISOString(),
    appVersion: String(appVersion || ''),
    host: {platform: process.platform, node: process.version},
    course: {name: courseName, sourceId: courseId},
    /* Caminhos de origem só servem para a IMPORTAÇÃO remapear referências
       guardadas dentro dos stores (favoritos apontam para o PDF de origem).
       Não são autorização de leitura nem de escrita. */
    source: {materialsDir: materialsDir ? path.resolve(materialsDir) : '', learningDir: learningDir ? path.resolve(learningDir) : ''},
    features: {
      materials: entries.some((entry) => entry.kind === 'materials'),
      learning: entries.some((entry) => entry.kind === 'learning'),
      review: !!stores.review,
      bookmarks: !!stores.bookmarks,
      resume: !!stores.resume,
      annotations: !!stores.annotations,
      conversations: conversations.included,
    },
    counts: {
      files: entries.length,
      bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      conversations: conversations.items.length,
    },
    conversations: conversations.items,
    files: entries,
  };
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  files.set(MANIFEST_NAME, manifestBuffer);
  const zip = writeZip(files, {deflate: true});
  return {buffer: zip, manifest};
}

/* ---------- prévia de importação ---------- */

/* Prévia: o que entra, quantos bytes, o que vai para conversa nova e onde o
   host deve registrar a matéria. Zero escrita. */
function previewImport({buffer, destination, now = new Date()}) {
  const {manifest, entries, buffers} = openPackage(buffer);
  const dir = path.resolve(destination.dir || destination);
  const newCourseId = newId('materia');
  const byKind = (kind) => entries.filter((entry) => entry.kind === kind);
  /* Anotações: conta itens portáteis sem tocar no disco de destino. */
  let noteItems = 0;
  let notePortable = false;
  for (const entry of byKind('store')) {
    if (entry.store !== 'annotations' && entry.rel !== 'pdf-notes.json') continue;
    const data = buffers.get(entry.archivePath);
    if (!data) continue;
    try {
      const raw = JSON.parse(data.toString('utf8'));
      if (isPlainObject(raw) && Array.isArray(raw.items)) {
        notePortable = true;
        noteItems += raw.items.filter((item) => isPlainObject(item) && (String(item.quote || '').trim() || String(item.note || '').trim())).length;
      } else if (Array.isArray(raw)) {
        noteItems += raw.filter((item) => isPlainObject(item) && (String(item.quote || '').trim() || String(item.note || '').trim())).length;
      }
    } catch { /* manifesto/hash já validaram; prévia não quebra por leitura */ }
  }
  return {
    packageKind: manifest.kind,
    created: manifest.created,
    sourceCourse: manifest.course || {name: '', sourceId: ''},
    features: manifest.features || {},
    destination: {dir, name: destination.name || path.basename(dir), renamed: !!destination.renamed},
    courseId: newCourseId,
    counts: {
      files: entries.length,
      bytes: entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0),
      materials: byKind('materials').length,
      learning: byKind('learning').length,
      conversations: byKind('conversations').length,
      stores: byKind('store').length,
    },
    conversations: entries.filter((entry) => entry.kind === 'conversations').map((entry) => ({
      archivePath: entry.archivePath,
      engine: entry.engine || 'pi',
      originalName: entry.originalName || path.basename(entry.archivePath),
      resume: entry.engine === 'claude' ? 'exported-transcript' : 'pi-jsonl-portable',
      nativeResume: entry.engine !== 'claude',
      bytes: Number(entry.bytes || 0),
    })),
    storeFeatures: byKind('store').map((entry) => entry.store).filter(Boolean),
    annotations: {items: noteItems, portable: notePortable},
    warnings: manifest.features && manifest.features.conversations
      ? []
      : ['pacote sem conversas'],
    bytes: entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0),
    checkedAt: new Date(now).toISOString(),
  };
}

module.exports = {
  PackageError,
  PACKAGE_ERROR,
  PACKAGE_FORMAT,
  MANIFEST_NAME,
  PACKAGE_EXT,
  STORE_FILES,
  buildPackage,
  openPackage,
  previewImport,
  planDestination,
  writePackageFile,
  importPackage,
  importNoteStore,
  resolveNoteStore,
  remapValue,
  safeDirName,
  newId,
};
