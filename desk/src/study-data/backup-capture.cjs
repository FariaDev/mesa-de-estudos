'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {safeRelPath} = require('./zipkit.cjs');
const {BackupError, normalizeBinaryPolicy, runtimeExclusion} = require('./backup-files.cjs');

/* Backup — captura do runtime: as fontes de cada versão (runtime, materiais,
   sessões externas por allowlist) e a política de binários.
   Saiu de backup.cjs na #43 fase 2. */

/* Monta a lista de entradas a copiar. Não lê arquivos: só decide caminho,
   tipo e motivo de exclusão (o hash vem no `snapshot`). */
function buildSources({runtime, materials = [], external = [], binaries = 'include'}) {
  const sources = [];
  const excluded = [];
  const warnings = [];
  const materialGroups = [];
  const runtimeAbs = path.resolve(runtime);
  if (!fs.existsSync(runtimeAbs)) throw new BackupError(`Runtime não encontrado: ${runtimeAbs}`);
  /* Realpath da raiz: uma pasta de matéria que é link para o runtime não pode
     entrar duas vezes. */
  const runtimeReal = fs.realpathSync(runtimeAbs);

  const walk = (absDir, relBase, kind, options = {}) => {
    let entries;
    try {
      entries = fs.readdirSync(absDir, {withFileTypes: true});
    } catch (error) {
      warnings.push(`não foi possível ler ${relBase || '.'}: ${error.message}`);
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const abs = path.join(absDir, entry.name);
      if (entry.isSymbolicLink()) {
        excluded.push({path: rel, reason: 'link simbólico (não segue)', size: 0, sha256: ''});
        continue;
      }
      if (entry.isDirectory()) {
        if (options.skipDirs && options.skipDirs.has(entry.name)) continue;
        const reason = runtimeExclusion(`${rel}/x`, kind);
        if (reason) {
          excluded.push({path: rel, reason, size: 0, sha256: ''});
          continue;
        }
        walk(abs, rel, kind, options);
        continue;
      }
      /* Só arquivo regular: FIFO/socket/device não se copiam por stream. */
      if (!entry.isFile()) continue;
      const reason = runtimeExclusion(rel, kind);
      if (reason) {
        excluded.push({path: rel, reason, size: 0, sha256: ''});
        continue;
      }
      sources.push({source: abs, rel, kind, origin: runtimeAbs, ...(options.courseId ? {courseId: options.courseId} : {})});
    }
  };

  walk(runtimeAbs, '', 'live', {});

  /* Partições `courses/<X>` já ocupadas: as que o próprio runtime trouxe e as
     matérias anteriores. Nome repetido (ou que sanitiza igual) ganha partição
     própria com sufixo único em vez de sobrescrever a primeira — as duas
     matérias ficam no manifesto e no `data/`, sem caminho duplicado. A
     primeira mantém o `courses/<nome>` de sempre (compatibilidade com
     snapshots/restaurações antigas). */
  const usedArchiveBases = new Set();
  for (const source of sources) {
    const parts = source.rel.split('/');
    if (parts.length > 1 && parts[0] === 'courses') usedArchiveBases.add(`${parts[0]}/${parts[1]}`);
  }
  const uniqueArchiveBase = (desired, seed) => {
    if (!usedArchiveBases.has(desired)) {
      usedArchiveBases.add(desired);
      return desired;
    }
    const stem = desired.slice(desired.lastIndexOf('/') + 1);
    const prefix = desired.slice(0, desired.length - stem.length);
    const digest = crypto.createHash('sha256').update(String(seed || desired)).digest('hex').slice(0, 6);
    let candidate = `${prefix}${stem}-${digest}`;
    for (let index = 2; usedArchiveBases.has(candidate); index++) candidate = `${prefix}${stem}-${digest}-${index}`;
    usedArchiveBases.add(candidate);
    return candidate;
  };

  /* Material gerado/importado fora do runtime (pastas das matérias). */
  for (const material of materials) {
    if (!material || typeof material.path !== 'string' || !material.path) continue;
    const absDir = path.resolve(material.path);
    if (!fs.existsSync(absDir)) {
      warnings.push(`pasta da matéria não encontrada: ${material.path}`);
      continue;
    }
    let realDir;
    try {
      realDir = fs.realpathSync(absDir);
    } catch (error) {
      warnings.push(`pasta da matéria ilegível (${material.path}): ${error.message}`);
      continue;
    }
    if (!fs.statSync(realDir).isDirectory()) {
      warnings.push(`pasta da matéria não é diretório: ${material.path}`);
      continue;
    }
    if (realDir === runtimeReal || realDir.startsWith(runtimeReal + path.sep)) continue; // já entrou
    const courseId = String(material.id || material.name || '');
    /* A mesma matéria passada duas vezes não vira duas cópias. */
    if (materialGroups.some((group) => group.courseId === courseId && group.sourceReal === realDir)) continue;
    const base = uniqueArchiveBase(`courses/${safeCourseDir(material.name || courseId || 'materia')}`, courseId || realDir);
    /* O manifesto registra a origem para a restauração poder remapear as
       referências com a cópia restaurada (a pasta original nunca é tocada).
       Guarda o caminho como o app o conhece (`sourceDir`) e o realpath
       (`sourceReal`): referências salvas podem usar qualquer um dos dois. */
    materialGroups.push({courseId, name: String(material.name || courseId || ''), archiveBase: base, sourceDir: absDir, sourceReal: realDir});
    walk(realDir, base, 'material', {skipDirs: new Set(['Sessions', 'Sources', '.pi', 'Assets']), courseId});
  }

  /* Allowlist externa: só o que veio listado, com referência portável. */
  const externalRefs = new Set();
  for (const item of external) {
    if (!item || typeof item.path !== 'string' || !item.path) continue;
    const abs = path.resolve(item.path);
    if (!fs.existsSync(abs)) {
      warnings.push(`origem externa não encontrada: ${item.path}`);
      continue;
    }
    const ref = typeof item.ref === 'string' && item.ref ? item.ref : path.basename(abs);
    if (!safeRelPath(ref) || ref.includes('/')) {
      warnings.push(`referência externa inválida (${ref})`);
      continue;
    }
    if (externalRefs.has(ref)) {
      warnings.push(`referência externa repetida, ignorada: ${ref}`);
      continue;
    }
    externalRefs.add(ref);
    if (item.include === false) {
      excluded.push({path: `external/${ref}`, reason: 'excluído pela allowlist (include=false)', size: 0, sha256: ''});
      continue;
    }
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) {
      excluded.push({path: `external/${ref}`, reason: 'link simbólico (não segue)', size: 0, sha256: ''});
      continue;
    }
    if (!stat.isFile()) {
      warnings.push(`origem externa não é arquivo: ${item.path}`);
      continue;
    }
    sources.push({source: abs, rel: `external/${ref}`, kind: 'external', origin: path.dirname(abs), externalRef: ref, resume: item.resume || ''});
  }

  /* PDF/binário: `exclude` mantém só inventário (hash no manifesto). */
  const binary = [];
  const kept = [];
  for (const source of sources) {
    if (isBinaryPath(source.rel)) {
      if (normalizeBinaryPolicy(binaries) === 'include') kept.push(source);
      else binary.push(source);
    } else kept.push(source);
  }
  return {sources: kept, binary, excluded, warnings, materials: materialGroups};
}
const BINARY_EXT = /\.(pdf|png|jpe?g|gif|webp|bmp|tiff?|svgz?|zip|xopp|mp3|mp4|wav|m4a|ogg|epub|docx?|pptx?|xlsx?)$/i;
const isBinaryPath = (rel) => BINARY_EXT.test(rel);
const safeCourseDir = (name) => String(name || 'materia').replace(/[\\/:*?"<>|]/g, '-').replace(/\.+$/, '').trim() || 'materia';

module.exports = {buildSources};
