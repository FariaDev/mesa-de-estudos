'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {RestoreError, atomicWrite, isPlainObject, readJson} = require('./backup-files.cjs');

/* Restauração — plano e realocação: caminhos absolutos do runtime e das
   matérias reescritos para o destino novo, e os que ficaram velhos.
   Saiu de backup.cjs na #43 fase 2. */

/* Valida o id do plano antes de tocar em QUALQUER caminho derivado dele:
   `cancelRestore('../../…')` não pode virar remoção fora da pasta do backup. */
function assertPlanId(planId) {
  const value = String(planId || '');
  if (!/^plan-[0-9]+-[0-9a-f]{6}$/.test(value)) throw new RestoreError(`prévia inválida: ${planId}`);
  return value;
}
/* Arquivos do runtime cujos caminhos absolutos apontam para dentro do PRÓPRIO
   runtime (sessões, layout por sessão, workspace Livre, config no modo de
   pasta única). Quando a versão é restaurada em outro caminho, esses caminhos
   são reescritos para a raiz nova — é o que faz sessões, `sessionLayouts`,
   `chat-library.json` e `pdf-drafts.json` (identidade = id da matéria +
   caminho relativo) continuarem válidos depois de mudar de máquina. Caminho
   de pasta de matéria (fora do runtime) NÃO é inventado; o aviso da prévia
   diz o que não existe nesta máquina. */
const RELOCATABLE_FILES = new Set(['desk.json', 'config.json', 'chat-library.json', 'pdf-drafts.json', 'mesa-backup.json']);
/* Arquivos de estado cuja referência a material da matéria pode ser remapeada
   para a cópia restaurada. O remapeamento é EXPLÍCITO na aplicação (ou
   automático só quando a pasta de origem não existe nesta máquina) e a pasta
   original permanece intacta. */
const MATERIAL_REMAP_FILES = new Set([...RELOCATABLE_FILES, 'review.json', 'bookmarks.json', 'resume.json', 'pdf-notes.json']);
function isRelocatableEntry(rel) {
  if (RELOCATABLE_FILES.has(rel)) return true;
  return /^free\/[^/]+\/workspace\.json$/.test(rel);
}
/* Alguma string da estrutura começa com `from` (um diretório)? Usado para
   saber, na prévia, quais arquivos o remapeamento de material tocaria. */
function pathPrefixIn(value, from) {
  if (typeof value === 'string') return value === from || value.startsWith(from + path.sep);
  if (Array.isArray(value)) return value.some((item) => pathPrefixIn(item, from));
  if (isPlainObject(value)) return Object.values(value).some((item) => pathPrefixIn(item, from));
  return false;
}
/* Grupos de material de uma versão: snapshots novos trazem `materials` no
   manifesto (origem + partição); snapshots v1 sem metadados são agrupados
   pelas próprias entradas (sem origem conhecida, só o destino). */
function materialGroupsOf(manifest, runtimeAbs) {
  const counts = new Map();
  for (const entry of manifest.entries || []) {
    if (entry.stored === false || entry.kind !== 'material' || typeof entry.path !== 'string') continue;
    const parts = entry.path.split('/');
    if (parts.length < 3 || parts[0] !== 'courses') continue;
    const archiveBase = `${parts[0]}/${parts[1]}`;
    const current = counts.get(archiveBase) || {files: 0, bytes: 0, courseId: ''};
    current.files++;
    current.bytes += Number(entry.bytes || 0);
    if (!current.courseId && entry.courseId) current.courseId = String(entry.courseId);
    counts.set(archiveBase, current);
  }
  const out = [];
  const archSeen = new Set();
  for (const item of Array.isArray(manifest.materials) ? manifest.materials : []) {
    if (!isPlainObject(item) || typeof item.archiveBase !== 'string' || !item.archiveBase) continue;
    if (archSeen.has(item.archiveBase)) continue;
    archSeen.add(item.archiveBase);
    const count = counts.get(item.archiveBase) || {files: 0, bytes: 0, courseId: ''};
    const sourceDir = typeof item.sourceDir === 'string' && item.sourceDir ? item.sourceDir : '';
    const sourceReal = typeof item.sourceReal === 'string' && item.sourceReal ? item.sourceReal : '';
    const froms = [...new Set([sourceDir, sourceReal].filter(Boolean))];
    out.push({
      courseId: String(item.courseId || count.courseId || ''),
      name: String(item.name || item.archiveBase.split('/')[1] || ''),
      archiveBase: item.archiveBase,
      from: sourceDir || sourceReal,
      real: sourceReal,
      froms,
      to: path.join(runtimeAbs, item.archiveBase),
      files: count.files,
      bytes: count.bytes,
      stale: froms.length ? !froms.some((candidate) => fs.existsSync(candidate)) : false,
      unknown: !froms.length,
    });
  }
  for (const [archiveBase, count] of counts) {
    if (archSeen.has(archiveBase)) continue;
    archSeen.add(archiveBase);
    out.push({courseId: count.courseId, name: archiveBase.split('/')[1] || '', archiveBase, from: '', real: '', froms: [], to: path.join(runtimeAbs, archiveBase), files: count.files, bytes: count.bytes, stale: false, unknown: true});
  }
  return out;
}
function remapRuntimePaths(value, from, to) {
  if (typeof value === 'string') {
    if (value === from) return to;
    if (value.startsWith(from + path.sep)) return path.join(to, value.slice(from.length + 1));
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => remapRuntimePaths(item, from, to));
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[remapRuntimePaths(key, from, to)] = remapRuntimePaths(item, from, to);
    return out;
  }
  return value;
}
/* Caminhos absolutos que continuam fora do runtime novo e não existem aqui:
   a prévia avisa (não finge que restaurou material de outra máquina). */
function staleAbsolutePaths(value, {ignoreRoot, out = new Set()} = {}) {
  if (typeof value === 'string') {
    if (value.length > 3 && value.length < 500 && path.isAbsolute(value) && value !== ignoreRoot && !value.startsWith(ignoreRoot + path.sep)) {
      try {
        if (!fs.existsSync(value)) out.add(value);
      } catch {}
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) staleAbsolutePaths(item, {ignoreRoot, out});
    return out;
  }
  if (isPlainObject(value)) {
    for (const item of Object.values(value)) staleAbsolutePaths(item, {ignoreRoot, out});
    return out;
  }
  return out;
}
/* Reescreve o arquivo no staging APENAS quando algo mudou: restaurar na mesma
   máquina e no mesmo caminho continua byte a byte igual à versão. */
function relocateStagedFile(staged, {from, to}) {
  const raw = readJson(staged);
  if (raw === null) return {changed: false, stale: []};
  const next = remapRuntimePaths(raw, from, to);
  const stale = staleAbsolutePaths(next, {ignoreRoot: to});
  if (JSON.stringify(next) === JSON.stringify(raw)) return {changed: false, stale};
  atomicWrite(staged, `${JSON.stringify(next, null, 2)}\n`);
  return {changed: true, stale};
}

module.exports = {assertPlanId, RELOCATABLE_FILES, MATERIAL_REMAP_FILES, isRelocatableEntry, pathPrefixIn, materialGroupsOf, remapRuntimePaths, relocateStagedFile};
