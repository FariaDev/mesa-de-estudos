'use strict';

/* Backup local, restauração e retenção da Mesa (domínio estudo/compartilhar).

   O que este módulo é: um SNAPSHOT de arquivo por versão, fora do runtime, com
   manifesto + hash SHA-256 por entrada, listagem de versões, prévia de
   restauração e aplicação em staging com diário e rollback. O que ele NÃO é:
   backup indiscriminado de `~/.pi`/`~/.claude`. Sessões nessas áreas só entram
   por allowlist explícita (`external`), com referências portáveis, e o
   manifesto marca quando o arquivo só serve como transcrição exportável.

   Política de captura (explícita no manifesto, nada some calado):
     live      — conversas Pi/Claude e lateral, fila retida, Livre, Caderno,
                 favoritos, retomada, notas de página, layout/estado, stats do
                 estudo, ggb e xopp: o runtime inteiro, menos a negativa abaixo;
     material  — material gerado/importado e PDFs das pastas das matérias;
     desk      — `config.json` SÓ quando ele mora dentro do runtime (modo de
                 pasta única `LEARNING_DESK_RUNTIME`); a configuração pessoal
                 fora do runtime e o `install-source.json` NÃO entram. NUNCA
                 credencial: as credenciais do Pi/Claude vivem no agente, não
                 na Mesa;
     external  — allowlist à parte, com referência portável.

   Negativa dura (nunca entra, nem por engano de lista): `electron/` (cache do
   Chromium), `*.log`, `desk.log`, `update.json`/`update.lock` (efêmero),
   `.review-draft-*`, `.DS_Store`, `Thumbs.db`, `*.tmp`, temporários de escrita,
   `node_modules`, `.git`, caches (`.cache/`, `caches/`, `tmp/`) e qualquer
   coisa com nome de credencial (`auth.json`, `credentials`, `token`, `secret`,
   `keychain`, `session-env`, `*.pem`, `*.key`). O caminho é conferido
   componente a componente: uma matéria chamada "tokens" não derruba o
   backup — só o arquivo é recusado. Pasta/arquivo do usuário com nome comum
   (`backups/`, `downloads/`, `plugins/`, `history.jsonl`, `tmp-relatorio.md`)
   NÃO é exclusão: só credencial e cache saem.

   Assíncrono porque hash e cópia de PDF grande não podem travar o main do
   Electron; o resto é síncrono e pequeno. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {message: uiMsg} = require('../i18n.mjs');
const {causeArg} = require('../error-detail.mjs');
const {joinUnder} = require('./zipkit.cjs');
const {BACKUP_ERROR, BackupError, DEFAULT_IDLE_MINUTES, DEFAULT_INTERVAL_HOURS, DEFAULT_KEEP, EXCLUDED_NAME, FORMAT_VERSION, MANIFEST_NAME, RESTORE_ERROR, RestoreError, SNAPSHOTS_DIR, atomicWrite, copyFileStreaming, hashBuffer, hashFile, isPlainObject, manifestPath, readJson, readManifest, removeQuiet, runtimeExclusion, snapshotDirFor, snapshotsRoot} = require('./backup-files.cjs');
const {MATERIAL_REMAP_FILES, RELOCATABLE_FILES, assertPlanId, isRelocatableEntry, materialGroupsOf, pathPrefixIn, relocateStagedFile, remapRuntimePaths} = require('./backup-relocate.cjs');
const {assertRuntimeAtRest, backupNow, latestActivity, list, prune, readStatus, snapshot, verifySnapshot, writeStatus} = require('./backup-snapshot.cjs');
const {buildSources} = require('./backup-capture.cjs');
const {readAutoState, runAutoBackup, shouldAutoBackup, writeAutoState} = require('./backup-schedule.cjs');
const {readConfig, readConfigFile, resolveSettings, writeConfig, writeConfigFile} = require('./backup-config.cjs');

/* ---------- restauração (prévia → staging → aplicar/rollback) ---------- */

/* Lê o manifesto, confere o snapshot inteiro e MONTA a prévia: o que seria
   substituído, o que é novo, o que ficou fora da versão e quantos bytes. Não
   escreve nada no runtime — é o texto que a UI mostra antes da confirmação. */
async function prepareRestore({runtime, root, snapshotId, recentMs = 0, allowActive = false, log = () => {}}) {
  assertRuntimeAtRest({runtime, root, recentMs, allowActive});
  const dir = snapshotDirFor(path.resolve(root || ''), snapshotId);
  if (!fs.existsSync(dir)) throw new RestoreError(uiMsg('err.backup.versionMissing', {id: snapshotId}));
  const check = await verifySnapshot(dir, {strict: true, log});
  const manifest = check.manifest;
  const planId = `plan-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const runtimeAbs = path.resolve(runtime);
  const stateDir = path.join(runtimeAbs, '.backup');
  const staging = path.join(stateDir, 'staging', planId);
  removeQuiet(staging);
  fs.mkdirSync(staging, {recursive: true});
  const oldRuntime = manifest.runtime && typeof manifest.runtime.path === 'string' ? path.resolve(manifest.runtime.path) : '';
  const from = oldRuntime && oldRuntime !== runtimeAbs ? oldRuntime : '';
  const materialGroups = materialGroupsOf(manifest, runtimeAbs);
  const relocated = [];
  const stale = new Set();
  const replaced = [];
  const created = [];
  const preserved = [];
  const external = [];
  let bytes = 0;
  for (const entry of manifest.entries) {
    if (entry.stored === false) continue;
    const target = joinUnder(runtimeAbs, entry.path);
    const source = joinUnder(path.join(dir, 'data'), entry.path);
    if (!fs.existsSync(source)) throw new RestoreError(`prévia inconsistente: falta ${entry.path}`);
    const staged = joinUnder(staging, entry.path);
    if (!fs.existsSync(staged)) fs.mkdirSync(path.dirname(staged), {recursive: true});
    /* A cópia para o staging é a conferência final: se falhar aqui, nada
       toca o runtime. */
    await copyFileStreaming(source, staged);
    const hash = await hashFile(staged);
    if (hash.sha256 !== entry.sha256) {
      removeQuiet(staging);
      throw new RestoreError(`falha ao preparar ${entry.path} (hash diferente)`);
    }
    if (from && isRelocatableEntry(entry.path)) {
      const info = relocateStagedFile(staged, {from, to: runtimeAbs});
      if (info.changed) relocated.push(entry.path);
      for (const item of info.stale) stale.add(item);
    }
    /* Alvo que hoje é link simbólico NÃO é substituído: trocar o link por um
       arquivo não é reversível pelo pré-restore. O link fica e a prévia avisa. */
    let targetStat = null;
    try {
      targetStat = fs.lstatSync(target);
    } catch { /* alvo novo */ }
    if (targetStat && targetStat.isSymbolicLink()) {
      preserved.push({path: entry.path, reason: 'link simbólico preservado (não restaurado)'});
      continue;
    }
    bytes += hash.size;
    if (entry.kind === 'external') external.push(entry.path);
    if (fs.existsSync(target)) replaced.push(entry.path);
    else created.push(entry.path);
  }
  const excluded = readJson(path.join(dir, EXCLUDED_NAME));
  const warnings = isPlainObject(excluded) && Array.isArray(excluded.warnings) ? [...excluded.warnings] : [];
  if (relocated.length) warnings.push(`caminhos do runtime antigo (${from}) foram ajustados para ${runtimeAbs}: ${relocated.join(', ')}`);
  if (stale.size) warnings.push(`${stale.size} caminho(s) absoluto(s) da versão não existem nesta máquina e ficaram como estavam; confira os materiais depois de restaurar`);
  if (preserved.length) warnings.push(`${preserved.length} arquivo(s) do runtime são links simbólicos e foram preservados (não restaurados): ${preserved.map((item) => item.path).join(', ')}`);
  /* Prévia do material: quais arquivos o remapeamento explícito mudaria. */
  const materialChanges = new Set();
  for (const group of materialGroups) {
    if (!group.from && !group.courseId) continue;
    for (const rel of [...replaced, ...created]) {
      if (!MATERIAL_REMAP_FILES.has(rel)) continue;
      const raw = readJson(joinUnder(staging, rel));
      if (raw === null) continue;
      const prefixes = (Array.isArray(group.froms) && group.froms.length ? group.froms : [group.from]).filter((prefix) => prefix && prefix !== group.to);
      if (prefixes.some((prefix) => pathPrefixIn(raw, prefix))) materialChanges.add(rel);
      if (rel === 'config.json' && group.courseId && isPlainObject(raw) && Array.isArray(raw.courses)
        && raw.courses.some((course) => isPlainObject(course) && String(course.id || '') === group.courseId && course.path !== group.to)) {
        materialChanges.add(rel);
      }
    }
  }
  if (materialGroups.length) warnings.push(`material de ${materialGroups.length} matéria(s) na versão: a cópia restaurada fica em ${path.join(runtimeAbs, 'courses')} e a pasta original não é tocada`);
  const staleGroups = materialGroups.filter((group) => group.stale);
  if (staleGroups.length) warnings.push(`a pasta original de ${staleGroups.length} matéria(s) não existe nesta máquina; o remapeamento automático aponta a matéria para a cópia restaurada`);
  const unknownGroups = materialGroups.filter((group) => group.unknown);
  if (unknownGroups.length) warnings.push(`a versão não guarda a pasta de origem de ${unknownGroups.length} matéria(s) (formato antigo); a matéria só aponta para a cópia restaurada se a pasta atual não existir`);
  if (materialChanges.size) warnings.push(`o remapeamento ajusta referências de material em: ${[...materialChanges].join(', ')}`);
  const plan = {
    planId,
    snapshotId,
    staging,
    runtime: runtimeAbs,
    /* Data da versão. Até a #43 fase 3 a chave era `created`, repetida mais
       abaixo pela lista de arquivos novos, que a apagava (achado pelo lint). */
    snapshotCreated: manifest.created,
    reason: manifest.reason,
    bytes,
    entries: replaced.length + created.length,
    replaced,
    created,
    external,
    binariesIncluded: manifest.policy.binaries === 'include',
    excluded: isPlainObject(excluded) && Array.isArray(excluded.excluded) ? excluded.excluded : [],
    preserved,
    materials: materialGroups,
    materialCourses: materialGroups.map((group) => ({courseId: group.courseId, name: group.name, path: group.to, from: group.from})),
    materialsChanges: [...materialChanges],
    warnings,
    relocation: {from, to: runtimeAbs, files: relocated, stale: [...stale]},
  };
  const planFile = path.join(stateDir, 'restore', `${planId}.json`);
  atomicWrite(planFile, `${JSON.stringify(plan, null, 2)}\n`);
  log(`restauração preparada: ${plan.entries} arquivo(s), ${bytes} bytes${relocated.length ? `, ${relocated.length} com caminhos ajustados` : ''}`);
  return plan;
}

function readPlan(runtime, planId) {
  const id = assertPlanId(planId);
  const file = path.join(path.resolve(runtime), '.backup', 'restore', `${id}.json`);
  const plan = readJson(file);
  if (!plan) throw new RestoreError(uiMsg('err.backup.planMissing', {id: planId}));
  return plan;
}

function dropPlan(runtime, planId) {
  const id = assertPlanId(planId);
  const stateDir = path.join(path.resolve(runtime), '.backup');
  removeQuiet(path.join(stateDir, 'staging', id));
  removeQuiet(path.join(stateDir, 'restore', `${id}.json`));
}

function cancelRestore({runtime, planId}) {
  dropPlan(runtime, planId);
  return {cancelled: true, planId};
}

/* Aplica a prévia: cada arquivo vai para o alvo por temp+rename e o original,
   quando existe, é guardado em `.backup/pre-restore/<planId>/`. O diário é
   gravado ANTES da primeira escrita; falha no meio = rollback automático e o
   erro sobe. Nunca apaga arquivo arbitrário do usuário: substituição é sempre
   reversível pelo backup do pré-restore. */
async function applyRestore({runtime, planId, materials = 'auto', recentMs = 0, allowActive = false, log = () => {}}) {
  /* Confere de novo na aplicação: entre a prévia e a confirmação o usuário
     pode ter voltado a estudar. */
  assertRuntimeAtRest({runtime, recentMs, allowActive});
  const plan = readPlan(runtime, planId);
  const runtimeAbs = path.resolve(runtime);
  const stateDir = path.join(runtimeAbs, '.backup');
  /* Caminhos derivados do id validado, nunca do JSON do plano: editar o plano
     no disco não redireciona a escrita para fora do runtime. */
  const staging = path.join(stateDir, 'staging', plan.planId);
  const preDir = path.join(stateDir, 'pre-restore', plan.planId);
  const journalFile = path.join(stateDir, 'journal', `${plan.planId}.json`);
  const journal = {planId: plan.planId, snapshotId: plan.snapshotId, started: new Date().toISOString(), replaced: [], created: [], finished: false, error: ''};
  atomicWrite(journalFile, `${JSON.stringify(journal, null, 2)}\n`);
  const written = [];
  try {
    /* Remapeamento EXPLÍCITO do material: 'remap' força todas as matérias,
       'auto' só as que perderam a pasta de origem, 'keep' mantém tudo. A
       pasta original nunca é escrita; só o staging do runtime é ajustado. */
    const materialRemapped = [];
    const groups = Array.isArray(plan.materials) ? plan.materials : [];
    for (const group of groups) {
      const remapStrings = materials === 'remap' || (materials !== 'keep' && group.stale);
      const prefixes = (Array.isArray(group.froms) && group.froms.length ? group.froms : [group.from]).filter((prefix) => prefix && prefix !== group.to);
      let changed = false;
      for (const rel of [...plan.replaced, ...plan.created]) {
        if (!MATERIAL_REMAP_FILES.has(rel)) continue;
        const staged = joinUnder(staging, rel);
        const raw = readJson(staged);
        if (raw === null) continue;
        let next = raw;
        if (remapStrings) for (const prefix of prefixes) next = remapRuntimePaths(next, prefix, group.to);
        if (rel === 'config.json' && group.courseId && isPlainObject(next) && Array.isArray(next.courses)) {
          next = {...next, courses: next.courses.map((course) => {
            if (!isPlainObject(course) || String(course.id || '') !== group.courseId || course.path === group.to) return course;
            const shouldRemap = materials === 'remap'
              || (materials !== 'keep' && (group.stale || !course.path || !fs.existsSync(course.path)));
            return shouldRemap ? {...course, path: group.to} : course;
          })};
        }
        if (JSON.stringify(next) !== JSON.stringify(raw)) {
          atomicWrite(staged, `${JSON.stringify(next, null, 2)}\n`);
          changed = true;
        }
      }
      /* A DECISÃO de remapear entra em `materialsRemapped` mesmo quando nenhum
         arquivo do staging cita a origem: é por essa lista que o host aponta a
         config EXTERNA (fora do runtime) para a cópia restaurada. */
      const decided = remapStrings && !!group.courseId && Number(group.files || 0) > 0;
      if (changed || decided) materialRemapped.push({courseId: group.courseId, name: group.name, from: group.from, to: group.to});
    }
    for (const rel of [...plan.replaced, ...plan.created]) {
      const staged = joinUnder(staging, rel);
      const target = joinUnder(runtimeAbs, rel);
      if (!fs.existsSync(staged)) throw new RestoreError(`staging perdido para ${rel}`);
      if (fs.existsSync(target)) {
        const backup = joinUnder(preDir, rel);
        fs.mkdirSync(path.dirname(backup), {recursive: true});
        await copyFileStreaming(target, backup);
        const withHash = journal.replaced.find((item) => item.path === rel);
        if (!withHash) journal.replaced.push({path: rel, sha256: (await hashFile(backup)).sha256});
        atomicWrite(journalFile, `${JSON.stringify(journal, null, 2)}\n`);
      } else {
        if (!journal.created.includes(rel)) journal.created.push(rel);
        atomicWrite(journalFile, `${JSON.stringify(journal, null, 2)}\n`);
      }
      const tmp = `${target}.mesa-restore-${process.pid}`;
      fs.mkdirSync(path.dirname(target), {recursive: true});
      await copyFileStreaming(staged, tmp);
      fs.renameSync(tmp, target);
      written.push(rel);
    }
    journal.finished = true;
    journal.finishedAt = new Date().toISOString();
    atomicWrite(journalFile, `${JSON.stringify(journal, null, 2)}\n`);
    dropPlan(runtime, plan.planId);
    return {
      applied: true,
      planId: plan.planId,
      snapshotId: plan.snapshotId,
      written: written.length,
      backupOfReplaced: plan.replaced.length ? preDir : '',
      external: plan.external,
      materials: groups.map((group) => ({courseId: group.courseId, name: group.name, from: group.from, to: group.to, files: group.files, stale: group.stale})),
      materialCourses: groups.map((group) => ({courseId: group.courseId, name: group.name, path: group.to, from: group.from})),
      materialsRemapped: materialRemapped,
    };
  } catch (error) {
    const rolled = rollbackRestore({runtime, planId: plan.planId, log});
    throw new RestoreError(uiMsg(rolled.ok ? 'err.backup.restoreRolledBack' : 'err.backup.restoreRollbackPartial', {detail: causeArg(error), rollback: causeArg(rolled.error || '')}));
  }
}

/* Desfaz uma aplicação pelo diário: devolve os arquivos substituídos do
   pré-restore e remove os criados pela restauração. Idempotente e seguro para
   rodar depois de queda (o diário é a verdade). */
function rollbackRestore({runtime, planId, log = () => {}}) {
  const runtimeAbs = path.resolve(runtime);
  const stateDir = path.join(runtimeAbs, '.backup');
  let id;
  try {
    id = assertPlanId(planId);
  } catch (error) {
    return {ok: false, error: error.message};
  }
  const journalFile = path.join(stateDir, 'journal', `${id}.json`);
  const journal = readJson(journalFile);
  if (!journal) return {ok: false, error: `diário não encontrado: ${planId}`};
  const preDir = path.join(stateDir, 'pre-restore', id);
  let restored = 0;
  let removed = 0;
  try {
    for (const item of journal.replaced || []) {
      const backup = joinUnder(preDir, item.path);
      const target = joinUnder(runtimeAbs, item.path);
      if (!fs.existsSync(backup)) continue;
      fs.mkdirSync(path.dirname(target), {recursive: true});
      const tmp = `${target}.mesa-rollback-${process.pid}`;
      fs.copyFileSync(backup, tmp);
      fs.renameSync(tmp, target);
      restored++;
      log(`rollback: ${item.path} devolvido`);
    }
    for (const rel of journal.created || []) {
      const target = joinUnder(runtimeAbs, rel);
      removeQuiet(target);
      removed++;
      log(`rollback: ${rel} removido (não existia antes)`);
    }
    fs.rmSync(journalFile, {force: true});
    removeQuiet(preDir);
    return {ok: true, planId: id, restored, removed};
  } catch (error) {
    return {ok: false, error: error.message, planId, restored, removed};
  }
}

/* Recuperação de queda: diário sem `finished` = restauração interrompida;
   devolve o estado anterior antes de qualquer outra coisa. */
/** @param {{runtime: string, log?: (message: string) => void}} options */
function recoverRestore({runtime, log = () => {}}) {
  const stateDir = path.join(path.resolve(runtime), '.backup');
  const journalDir = path.join(stateDir, 'journal');
  const recovered = [];
  let names;
  try {
    names = fs.readdirSync(journalDir);
  } catch {
    return recovered;
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const journal = readJson(path.join(journalDir, name));
    if (!journal || journal.finished) continue;
    const result = rollbackRestore({runtime, planId: journal.planId, log});
    recovered.push({planId: journal.planId, ...result});
  }
  return recovered;
}

const api = {
  BackupError,
  RestoreError,
  BACKUP_ERROR,
  RESTORE_ERROR,
  MANIFEST_NAME,
  SNAPSHOTS_DIR,
  snapshotsRoot,
  FORMAT_VERSION,
  DEFAULT_KEEP,
  DEFAULT_IDLE_MINUTES,
  DEFAULT_INTERVAL_HOURS,
  snapshot,
  backupNow,
  list,
  verifySnapshot,
  readStatus,
  writeStatus,
  prune,
  readManifest,
  manifestPath,
  snapshotDirFor,
  buildSources,
  runtimeExclusion,
  remapRuntimePaths,
  MATERIAL_REMAP_FILES,
  RELOCATABLE_FILES,
  readConfig,
  writeConfig,
  readConfigFile,
  writeConfigFile,
  resolveSettings,
  readAutoState,
  writeAutoState,
  latestActivity,
  shouldAutoBackup,
  runAutoBackup,
  assertRuntimeAtRest,
  prepareRestore,
  applyRestore,
  cancelRestore,
  rollbackRestore,
  recoverRestore,
  readPlan,
  hashFile,
  hashBuffer,
};

module.exports = api;
module.exports.default = api;
