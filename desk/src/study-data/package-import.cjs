'use strict';

const fs = require('node:fs');
const path = require('node:path');
const conversations = require('../agents/conversations.cjs');
const {message: uiMsg} = require('../i18n.mjs');
const {causeArg} = require('../error-detail.mjs');
const {PackageError, isPlainObject, newId, posix, writeInside} = require('./package-common.cjs');
const {importNoteStore} = require('./package-source.cjs');
const {openPackage} = require('./package-read.cjs');

/* Pacote de matéria — importação: caminhos e ids remapeados para a matéria
   nova, anotações mescladas e conversas gravadas.
   Saiu de packages.cjs na #43 fase 2. */

/* Remove do objeto JSON toda referência local que aponta para o caminho antigo
   ou o id antigo, trocando pela referência nova. Percorre recursivamente;
   strings que são só caminho são trocadas inteiras. */
function remapValue(value, {oldBase, newBase, oldId, newId, mappings = []} = {}) {
  const table = [
    ...(oldBase && newBase ? [{from: oldBase, to: newBase}] : []),
    ...(Array.isArray(mappings) ? mappings : []),
  ];
  if (typeof value === 'string') {
    let out = value;
    for (const map of table) {
      if (!map || !map.from || !map.to) continue;
      const from = path.resolve(map.from);
      const fromPosix = posix(from);
      if (out === from || out.startsWith(from + path.sep)) {
        out = path.join(map.to, ...posix(out.slice(from.length)).split('/').filter(Boolean));
        break;
      }
      if (out === fromPosix || out.startsWith(`${fromPosix}/`)) {
        out = path.join(map.to, ...out.slice(fromPosix.length).split('/').filter(Boolean));
        break;
      }
    }
    if (oldId && newId && out === oldId) out = newId;
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => remapValue(item, {oldBase, newBase, oldId, newId, mappings: table.slice(oldBase && newBase ? 1 : 0)}));
  if (isPlainObject(value)) {
    const out = {};
    const rest = table.slice(oldBase && newBase ? 1 : 0);
    for (const [entryKey, entryValue] of Object.entries(value)) {
      const nextKey = oldId && newId && entryKey === oldId ? newId : entryKey;
      /* `path`/`file` de favorito mora em objeto próprio: cobre os dois casos. */
      out[nextKey] = remapValue(entryValue, {oldBase, newBase, oldId, newId, key: entryKey, mappings: rest});
    }
    return out;
  }
  return value;
}
/* Anotações no import de pacote: porta o payload novo (portátil) ou o v1
   (fatia crua com caminho absoluto do autor), reancorando SEMPRE nas raízes do
   destino. O v1 ainda passa pelo remap de caminho/id antes da reancoragem.
   Formato desconhecido é preservado como veio (nunca vira lista vazia calada). */
function importPackageNotes(raw, {materialsDir, learningDir, oldBase, oldLearning, oldId, newCourseId, warnings}) {
  const roots = [materialsDir, learningDir].filter(Boolean);
  const isPortable = isPlainObject(raw) && raw.version === 1 && Array.isArray(raw.items);
  if (isPortable) return importNoteStore(raw, {roots, warnings}).items;
  const remap = (value) => remapValue(value, {
    oldBase,
    newBase: materialsDir,
    oldId,
    newId: newCourseId,
    mappings: oldLearning ? [{from: oldLearning, to: learningDir}] : [],
  });
  if (Array.isArray(raw)) return importNoteStore(remap(raw), {roots, warnings}).items;
  /* Store chaveado por matéria (v1 alternativo): usa a fatia do id de origem. */
  if (isPlainObject(raw)) {
    const key = oldId && Array.isArray(raw[oldId]) ? oldId : Object.keys(raw).find((name) => Array.isArray(raw[name]));
    if (key !== undefined) return importNoteStore(remap(raw[key]), {roots, warnings}).items;
  }
  return raw;
}
/* Escreve o conteúdo do pacote num destino novo. Ordem: payload → stores
   remapeados → conversas renomeadas → manifesto de importação (last). Falha em
   qualquer passo remove o destino novo (nada de matéria pela metade). */
function importPackage({buffer, destination, courseId = '', log = () => {}}) {
  const opened = openPackage(buffer);
  const {manifest, entries} = opened;
  const buffers = new Map(opened.buffers);
  const dir = path.resolve(destination.dir || destination);
  if (fs.existsSync(dir)) throw new PackageError(uiMsg('err.pkg.destExists', {dir}));
  const newCourseId = courseId || newId('materia');
  /* A partição de destino é EXPLÍCITA e o host recebe os caminhos prontos:
     material em `materiais/`, estudo em `estudo/`, stores em `mesa/`,
     conversas em `conversas/`. O remap usa a partição certa para cada tipo. */
  const materialsDir = path.join(dir, 'materiais');
  const learningDir = path.join(dir, 'estudo');
  const source = manifest.source && typeof manifest.source === 'object' ? manifest.source : {};
  const oldBase = typeof source.materialsDir === 'string' ? source.materialsDir : '';
  const oldLearning = typeof source.learningDir === 'string' ? source.learningDir : '';
  const mapMaterials = materialsDir;
  const mapLearning = learningDir;
  const oldId = manifest.course && typeof manifest.course.sourceId === 'string' ? manifest.course.sourceId : '';
  const storeDir = path.join(dir, 'mesa');
  const conversationsDir = path.join(dir, 'conversas');
  const written = [];
  const record = {
    kind: 'mesa-import-record',
    format: 1,
    importedAt: new Date().toISOString(),
    packageCreated: manifest.created,
    sourceCourse: manifest.course || {name: '', sourceId: ''},
    courseId: newCourseId,
    destination: dir,
    materialsDir,
    learningDir,
    storeDir,
    conversationsDir,
    features: manifest.features || {},
    files: 0,
    bytes: entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0),
    conversations: [],
    warnings: [],
    annotations: {items: 0, unresolved: 0, warnings: []},
  };
  let owned = false;
  const noteWarnings = [];
  try {
    fs.mkdirSync(dir, {recursive: false});
    owned = true;
    /* Material e estudo primeiro: a reancoragem das anotações precisa dos
       arquivos no destino para resolver `rel`/`name`. O manifesto é a rota;
       a partição decide o destino (ordem não vira autorização). */
    const rank = (kind) => ({materials: 0, learning: 1, store: 2, conversations: 3}[kind] ?? 4);
    const ordered = [...entries].sort((a, b) => rank(a.kind) - rank(b.kind));
    for (const entry of ordered) {
      const data = buffers.get(entry.archivePath);
      if (!data) throw new PackageError(uiMsg('err.pkg.missingContent', {path: entry.archivePath}));
      if (entry.kind === 'materials') {
        writeInside(materialsDir, entry.rel, data);
        written.push(`materiais/${entry.rel}`);
      } else if (entry.kind === 'learning') {
        writeInside(learningDir, entry.rel, data);
        written.push(`estudo/${entry.rel}`);
      } else if (entry.kind === 'store') {
        const raw = JSON.parse(data.toString('utf8'));
        const isNotes = entry.store === 'annotations' || entry.rel === 'pdf-notes.json';
        const remapped = isNotes
          ? importPackageNotes(raw, {materialsDir, learningDir, oldBase, oldLearning, oldId, newCourseId, warnings: noteWarnings})
          : remapValue(raw, {
            oldBase,
            newBase: mapMaterials,
            oldId,
            newId: newCourseId,
            mappings: oldLearning ? [{from: oldLearning, to: mapLearning}] : [],
          });
        writeInside(storeDir, entry.rel, `${JSON.stringify(remapped, null, 2)}\n`);
        written.push(`mesa/${entry.rel}`);
      } else if (entry.kind === 'conversations') {
        const info = writeConversation({entry, data, dir: conversationsDir, newCourseId, written, log});
        record.conversations.push({...info, bytes: data.length});
      }
    }
    record.files = written.length;
    record.annotations = {
      items: (() => { try { const notes = JSON.parse(fs.readFileSync(path.join(storeDir, 'pdf-notes.json'), 'utf8')); return Array.isArray(notes) ? notes.length : 0; } catch { return 0; } })(),
      unresolved: noteWarnings.length,
      warnings: [...new Set(noteWarnings)].slice(0, 50),
    };
    if (noteWarnings.length) log(`importação: ${noteWarnings.length} anotação(ões) sem material encontrado; guardadas sem caminho`);
    writeInside(dir, '.mesa-import.json', `${JSON.stringify(record, null, 2)}\n`);
    return {
      imported: true,
      destination: dir,
      courseId: newCourseId,
      materialsDir,
      learningDir,
      storeDir,
      conversationsDir,
      files: written.length,
      record,
    };
  } catch (error) {
    /* Só remove o que ESTA importação criou: se outra criação (ou outro
       processo) venceu a corrida, o diretório alheio fica intacto. */
    if (owned) {
      try {
        fs.rmSync(dir, {recursive: true, force: true});
      } catch {}
    }
    if (error instanceof PackageError) throw error;
    if (error && error.code === 'EEXIST') throw new PackageError(uiMsg('err.pkg.destExists', {dir}));
    throw new PackageError(uiMsg(owned ? 'err.pkg.importFailedRemoved' : 'err.pkg.importFailed', {detail: causeArg(error)}));
  }
}
/* Conversa Claude importada: vira um descritor VÁLIDO do módulo real
   (`conversations.cjs`). O id antigo e o `nativeSessionId` antigo NÃO são
   reaproveitados: id/arquivo/sessão nascem novos, `nativeEstablished` é false
   e o arquivo só serve de transcrição — nunca anuncia retomada nativa. */
function writeClaudeTranscript({record, name, dir, newCourseId, written, log}) {
  fs.mkdirSync(dir, {recursive: true});
  const staging = fs.mkdtempSync(path.join(dir, '.mesa-transcript-'));
  try {
    const staged = conversations.createClaudeConversation({runtime: staging, courseId: newCourseId});
    const patch = {};
    if (Number.isFinite(record.started) && record.started >= 0) patch.started = record.started;
    if (typeof record.preview === 'string') patch.preview = record.preview.slice(0, 4000);
    if (typeof record.model === 'string' && record.model) patch.model = record.model.slice(0, 400);
    if (typeof record.effort === 'string' && record.effort) patch.effort = record.effort.slice(0, 24);
    if (Array.isArray(record.messages)) patch.messages = record.messages;
    try {
      conversations.updateClaudeConversation(staged, patch, {runtime: staging});
    } catch (error) {
      /* Mensagens que o módulo normalizador não aceita ficam fora; o descritor
         continua válido e a importação não vira "descritor corrompido". */
      delete patch.messages;
      conversations.updateClaudeConversation(staged, patch, {runtime: staging});
      log(`importação: conversa Claude ${name} entra sem as mensagens inválidas: ${error.message}`);
    }
    const descriptor = conversations.readClaudeConversation(staged, {runtime: staging});
    if (!descriptor) throw new PackageError(uiMsg('err.pkg.badClaude', {name}));
    if (typeof record.nativeSessionId === 'string' && record.nativeSessionId) descriptor.importedFrom = record.nativeSessionId;
    const finalName = `claude-${descriptor.id}.json`;
    writeInside(dir, `claude/${finalName}`, `${JSON.stringify(descriptor, null, 2)}\n`);
    written.push(`conversas/claude/${finalName}`);
    return {
      engine: 'claude',
      resume: 'exported-transcript',
      nativeResume: false,
      file: `conversas/claude/${finalName}`,
      originalName: name,
      id: descriptor.id,
      nativeSessionId: descriptor.nativeSessionId,
    };
  } finally {
    fs.rmSync(staging, {recursive: true, force: true});
  }
}
/* Conversa importada: id novo (nunca reusa o id nativo do pacote), pasta de
   mesa nova e Referências apontando para o novo destino. Descritor Claude vira
   transcrição: `nativeEstablished` volta a false (o id antigo não abre aqui). */
function writeConversation({entry, data, dir, newCourseId, written, log}) {
  const name = path.basename(entry.archivePath);
  if (entry.engine === 'claude' || /^claude-/.test(name)) {
    let record;
    try {
      record = JSON.parse(data.toString('utf8'));
    } catch {
      throw new PackageError(uiMsg('err.pkg.unreadableClaude', {name}));
    }
    if (!isPlainObject(record)) throw new PackageError(uiMsg('err.pkg.unreadableClaude', {name}));
    const info = writeClaudeTranscript({record, name, dir, newCourseId, written, log});
    log(`importação: conversa Claude ${name} vira transcrição válida (sem retomada nativa)`);
    return info;
  }
  writeInside(dir, `pi/${name}`, data);
  written.push(`conversas/pi/${name}`);
  return {engine: 'pi', resume: 'pi-jsonl-portable', nativeResume: true, file: `conversas/pi/${name}`, originalName: name};
}

module.exports = {remapValue, importPackage};
