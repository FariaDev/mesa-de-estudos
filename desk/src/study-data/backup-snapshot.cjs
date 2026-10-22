'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {message: uiMsg} = require('../i18n.mjs');
const {causeArg, invalidValue} = require('../error-detail.mjs');
const {joinUnder} = require('./zipkit.cjs');
const {BackupError, DEFAULT_KEEP, EXCLUDED_NAME, FORMAT_VERSION, SNAPSHOT_ID_RE, assertDestinationOutsideRuntime, atomicWrite, copyFileStreaming, hashFile, isPlainObject, manifestPath, normalizeBinaryPolicy, posix, readJson, readManifest, removeQuiet, runtimeExclusion, snapshotsRoot, stampId} = require('./backup-files.cjs');
const {buildSources} = require('./backup-capture.cjs');

/* Backup — gravação da versão com manifesto e hash, verificação, listagem,
   status, backup manual e retenção.
   Saiu de backup.cjs na #43 fase 2. */

/* Trava de atividade: snapshot e restauração não correm com o runtime sendo
   escrito agora (o Pi gravando JSONL, o app salvando estado). O host pode
   passar `recentMs` (ex.: 1500 ms) e `allowActive` quando ele mesmo já
   garantiu que o app está parado. */
function assertRuntimeAtRest({runtime, root = '', recentMs = 0, allowActive = false}) {
  if (allowActive || !(Number(recentMs) > 0)) return 0;
  const now = Date.now();
  const activity = latestActivity(runtime, {ignore: root});
  const age = activity ? now - activity : Infinity;
  if (age < Number(recentMs)) {
    throw new BackupError(uiMsg('err.backup.inUse', {seconds: Math.max(0, Math.round(age / 1000))}));
  }
  return activity;
}
async function snapshot({runtime, root, deskDir = '', materials = [], external = [], binaries = 'include', reason = 'manual', label = '', now = new Date(), recentMs = 0, allowActive = false, log = () => {}}) {
  assertDestinationOutsideRuntime({runtime, root});
  assertRuntimeAtRest({runtime, root, recentMs, allowActive});
  const rootAbs = path.resolve(root);
  const snapRoot = snapshotsRoot(rootAbs);
  fs.mkdirSync(snapRoot, {recursive: true});
  const id = stampId(now);
  const dir = path.join(snapRoot, id);
  const staging = path.join(snapRoot, `.tmp-${id}`);
  removeQuiet(staging);
  fs.mkdirSync(staging, {recursive: true});
  const started = Date.now();
  try {
    const {sources, binary, excluded, warnings, materials: materialGroups} = buildSources({runtime, deskDir, materials, external, binaries});
    const dataDir = path.join(staging, 'data');
    fs.mkdirSync(dataDir, {recursive: true});
    const entries = [];
    let totalBytes = 0;
    for (const source of sources) {
      const dest = joinUnder(dataDir, source.rel);
      let hash;
      try {
        const first = await hashFile(source.source);
        await copyFileStreaming(source.source, dest);
        const second = await hashFile(dest);
        if (first.sha256 !== second.sha256 || first.size !== second.size) {
          removeQuiet(dest);
          warnings.push(`arquivo mudou durante a cópia e ficou fora: ${source.rel}`);
          excluded.push({path: source.rel, reason: 'mudou durante a cópia', size: first.size, sha256: first.sha256});
          continue;
        }
        hash = second;
      } catch (error) {
        removeQuiet(dest);
        warnings.push(`não foi possível ler ${source.rel}: ${error.message}`);
        excluded.push({path: source.rel, reason: `falha de leitura: ${error.message}`, size: 0, sha256: ''});
        continue;
      }
      entries.push({
        path: source.rel,
        kind: source.kind,
        bytes: hash.size,
        sha256: hash.sha256,
        ...(source.courseId ? {courseId: source.courseId} : {}),
        ...(source.externalRef ? {externalRef: source.externalRef, resume: source.resume || 'transcript-only'} : {}),
      });
      totalBytes += hash.size;
      log(`backup: ${source.rel} (${hash.size} bytes)`);
    }
    /* Inventário do que ficou fora por política de binário (hash incluído:
       a prévia de restauração mostra exatamente o que não está lá). */
    const binaryInventory = [];
    for (const source of binary) {
      try {
        const hash = await hashFile(source.source);
        entries.push({
          path: source.rel,
          kind: source.kind,
          bytes: hash.size,
          sha256: hash.sha256,
          stored: false,
          reason: 'binário excluído pela política',
          ...(source.courseId ? {courseId: source.courseId} : {}),
        });
        binaryInventory.push({path: source.rel, bytes: hash.size, sha256: hash.sha256});
      } catch (error) {
        warnings.push(`não foi possível inventariar ${source.rel}: ${error.message}`);
      }
    }
    entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const excludedList = [...excluded, ...binaryInventory.map((item) => ({path: item.path, reason: 'binário excluído pela política', size: item.bytes, sha256: item.sha256}))]
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const stored = entries.filter((entry) => entry.stored !== false);
    const manifest = {
      format: FORMAT_VERSION,
      id,
      created: new Date(now).toISOString(),
      reason,
      label: String(label || ''),
      deskVersion: deskDir ? readDeskVersion(deskDir) : '',
      host: {platform: process.platform, node: process.version},
      runtime: {path: path.resolve(runtime)}, // referência humana; a restauração usa o runtime dela
      /* Material das matérias: `archiveBase` é a partição no snapshot e
         `sourceDir` a pasta original (referência, nunca autorização). */
      materials: materialGroups,
      policy: {
        binaries: normalizeBinaryPolicy(binaries),
        excluded: excludedList.length,
        excludedBytes: excludedList.reduce((sum, item) => sum + (item.size || 0), 0),
        externalAllowlist: external.length,
      },
      counts: {
        entries: stored.length,
        bytes: totalBytes,
        excluded: excludedList.length,
        skipped: binaryInventory.length,
      },
      entries,
    };
    atomicWrite(manifestPath(staging), `${JSON.stringify(manifest, null, 2)}\n`);
    atomicWrite(path.join(staging, EXCLUDED_NAME), `${JSON.stringify({excluded: excludedList, warnings}, null, 2)}\n`);
    fs.renameSync(staging, dir);
    return {
      snapshotId: id,
      path: dir,
      created: manifest.created,
      entries: stored.length,
      bytes: totalBytes,
      excluded: excludedList.length,
      skippedBinary: binaryInventory.length,
      warnings,
      ms: Date.now() - started,
    };
  } catch (error) {
    removeQuiet(staging);
    if (error instanceof BackupError) throw error;
    throw new BackupError(uiMsg('err.backup.writeFailed', {detail: causeArg(error)}));
  }
}
function readDeskVersion(deskDir) {
  try {
    const pkg = readJson(path.join(deskDir, 'package.json'));
    return pkg && typeof pkg.version === 'string' ? pkg.version : '';
  } catch {
    return '';
  }
}
function list(root) {
  const rootAbs = snapshotsRoot(root || '');
  if (!rootAbs || !fs.existsSync(rootAbs)) return [];
  const out = [];
  for (const name of fs.readdirSync(rootAbs)) {
    if (!SNAPSHOT_ID_RE.test(name)) continue;
    const dir = path.join(rootAbs, name);
    let stat;
    try {
      stat = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const manifest = readManifest(dir);
    out.push({
      snapshotId: name,
      path: dir,
      created: manifest ? manifest.created : stat.mtime.toISOString(),
      reason: manifest ? manifest.reason : 'desconhecido',
      label: manifest ? manifest.label : '',
      valid: !!manifest,
      entries: manifest ? manifest.counts.entries : 0,
      bytes: manifest ? manifest.counts.bytes : 0,
      excluded: manifest ? manifest.counts.excluded : 0,
      binaries: manifest ? manifest.policy.binaries : '',
    });
  }
  return out.sort((a, b) => (a.snapshotId < b.snapshotId ? 1 : -1));
}
/* Confere o snapshot no disco contra o próprio manifesto: falta, sobrou ou
   hash diferente. Devolve o relatório; opcionalmente lança (`strict`). */
async function verifySnapshot(snapshotDir, {strict = false, log = () => {}} = {}) {
  const manifest = readManifest(snapshotDir);
  if (!manifest) {
    const error = new BackupError(`versão sem manifesto legível: ${path.basename(snapshotDir)}`);
    if (strict) throw error;
    return {ok: false, errors: [error.message], missing: [], mismatched: [], extra: [], checked: 0, bytes: 0};
  }
  const errors = [];
  const missing = [];
  const mismatched = [];
  const dataDir = path.join(snapshotDir, 'data');
  let checked = 0;
  let bytes = 0;
  const expected = new Set();
  for (const entry of manifest.entries) {
    if (entry.stored === false) continue;
    expected.add(entry.path);
    const abs = joinUnder(dataDir, entry.path);
    if (!fs.existsSync(abs)) {
      missing.push(entry.path);
      continue;
    }
    const hash = await hashFile(abs);
    if (hash.sha256 !== entry.sha256 || hash.size !== entry.bytes) {
      mismatched.push({path: entry.path, expected: entry.sha256, got: hash.sha256});
      continue;
    }
    checked++;
    bytes += hash.size;
  }
  const extra = [];
  if (fs.existsSync(dataDir)) {
    const walk = (abs, rel) => {
      for (const entry of fs.readdirSync(abs, {withFileTypes: true})) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(abs, entry.name), childRel);
        else if (!expected.has(childRel)) extra.push(childRel);
      }
    };
    walk(dataDir, '');
  }
  if (missing.length) errors.push(`${missing.length} arquivo(s) faltando`);
  if (mismatched.length) errors.push(`${mismatched.length} arquivo(s) com hash diferente`);
  if (extra.length) log(`backup: ${extra.length} arquivo(s) extra(s) no snapshot (ignorados)`);
  if (strict && errors.length) throw new BackupError(`versão inválida: ${errors.join('; ')}`);
  return {ok: errors.length === 0, errors, missing, mismatched, extra, checked, bytes, manifest};
}
/* Status do último backup: direto do ledger gravado no destino. */
function readStatus(root) {
  const ledger = readJson(path.join(path.resolve(root || ''), 'ledger.json'));
  if (!isPlainObject(ledger)) {
    return {available: false, lastBackupAt: '', lastSnapshotId: '', lastError: '', lastResult: null, auto: {attemptedAt: '', snapshotId: '', error: ''}, gitError: '', gitAt: ''};
  }
  return {
    available: true,
    lastBackupAt: typeof ledger.lastBackupAt === 'string' ? ledger.lastBackupAt : '',
    lastSnapshotId: typeof ledger.lastSnapshotId === 'string' ? ledger.lastSnapshotId : '',
    lastError: typeof ledger.lastError === 'string' ? ledger.lastError : '',
    lastResult: isPlainObject(ledger.lastResult) ? ledger.lastResult : null,
    auto: isPlainObject(ledger.auto) ? ledger.auto : {attemptedAt: '', snapshotId: '', error: ''},
    gitError: typeof ledger.gitError === 'string' ? ledger.gitError : '',
    gitAt: typeof ledger.gitAt === 'string' ? ledger.gitAt : '',
  };
}
function writeStatus(root, patch) {
  if (!root || typeof root !== 'string') throw new BackupError(invalidValue('destino de backup', root, 'caminho absoluto'));
  const rootAbs = path.resolve(root);
  fs.mkdirSync(rootAbs, {recursive: true});
  const current = readJson(path.join(rootAbs, 'ledger.json'));
  const next = isPlainObject(current) ? {...current, ...patch} : {...patch};
  atomicWrite(path.join(rootAbs, 'ledger.json'), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
/* Executa o snapshot e mantém o ledger/status em dia — inclusive quando
   falha (o destino continua válido e o erro fica visível). */
async function backupNow({runtime, root, deskDir = '', materials = [], external = [], binaries = 'include', reason = 'manual', label = '', keep = DEFAULT_KEEP, recentMs = 0, allowActive = false, log = () => {}}) {
  /* Guarda antes do try: destino recusado não cria a pasta nem o ledger. */
  assertDestinationOutsideRuntime({runtime, root});
  try {
    const result = await snapshot({runtime, root, deskDir, materials, external, binaries, reason, label, recentMs, allowActive, log});
    writeStatus(root, {lastBackupAt: result.created, lastSnapshotId: result.snapshotId, lastError: '', lastResult: result});
    const pruned = prune({root, keep, log});
    return {...result, pruned};
  } catch (error) {
    /* O status é acessório: falha ao gravar o ledger nunca esconde o erro
       original nem escreve em caminho vazio. */
    if (typeof root === 'string' && root) {
      try {
        writeStatus(root, {lastError: error.message, lastAttemptAt: new Date().toISOString()});
      } catch {}
    }
    throw error;
  }
}
/* Retenção: mantém as `keep` versões mais novas; o resto sai (com manifesto
   junto). O snapshot que está em uso por uma restauração é preservado. */
function prune({root, keep = DEFAULT_KEEP, keepIds = [], log = () => {}}) {
  const listAll = list(root);
  const protectedIds = new Set(keep && keep > 0 ? listAll.slice(0, keep).map((item) => item.snapshotId) : []);
  for (const id of keepIds) protectedIds.add(id);
  const removed = [];
  for (const item of listAll) {
    if (protectedIds.has(item.snapshotId)) continue;
    removeQuiet(item.path);
    removed.push(item.snapshotId);
    log(`backup: versão antiga removida (${item.snapshotId})`);
  }
  return removed;
}
/* Atividade persistida mais recente; batimentos, logs e índice não contam.
   `ignore` exclui o próprio
   destino do backup quando ele mora dentro da árvore conferida. */
function latestActivity(runtime, {ignore = ''} = {}) {
  let newest = 0;
  const ignoreAbs = ignore ? path.resolve(ignore) : '';
  const walk = (abs) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = path.join(abs, entry.name);
      if (ignoreAbs && (child === ignoreAbs || child.startsWith(ignoreAbs + path.sep))) continue;
      if (entry.isSymbolicLink()) continue;
      const rel = posix(path.relative(runtime, child));
      if (runtimeExclusion(rel) || ['study-search', '.study-index'].includes(rel.split('/')[0])) continue;
      if (rel === 'study-stats.json') {
        try {
          if (fs.statSync(child).size <= 4 * 1024 * 1024) {
            const activeAt = Number(readJson(child)?.meta?.activeAt);
            if (Number.isFinite(activeAt) && activeAt > newest) newest = activeAt;
          }
        } catch {}
        continue;
      }
      if (entry.isDirectory()) {
        if (entry.name === 'electron' || entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.backup') continue;
        walk(child);
        continue;
      }
      try {
        const stat = fs.statSync(child);
        if (stat.mtimeMs > newest) newest = stat.mtimeMs;
      } catch {}
    }
  };
  walk(path.resolve(runtime));
  return newest;
}

module.exports = {latestActivity, assertRuntimeAtRest, snapshot, list, verifySnapshot, readStatus, writeStatus, backupNow, prune};
