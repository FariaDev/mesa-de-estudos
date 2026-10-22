'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./src/generated/freeworkspaces.core.js').default;
const {toNat} = require('./src/bend-nat.mjs');
const {message: uiMsg} = require('./src/i18n.mjs');
const {causeText} = require('./src/error-detail.mjs');
const {FreeWorkspaceError, MATERIALS_DIR, MAX_ATTEMPTS, MAX_PATH, STAGING_PREFIX, bump, fail, folderSlug, hasControls, isAbsolute, isText, materialsDirOf, mustLoad, normalizeSessionId, nowIso, workspaceDir, writeRecord} = require('./free-workspace-record.cjs');
const {findByCourseId, listWorkspaces} = require('./free-workspace-store.cjs');
const {sha256OfFile} = require('./free-workspace-materials.cjs');

/* Aba Livre — promoção para matéria: pasta nova, nunca sobrescreve, staging
   verificado, recibo e rollback só do que criou.
   Saiu de free-workspaces.cjs na #43 fase 2; a política continua no núcleo
   (`core/freeworkspaces.bend`). */

function assertParentDir(parentDir) {
  if (!isAbsolute(parentDir) || parentDir.length > MAX_PATH) fail('BAD_PATH', uiMsg('err.freews.badFolder'));
  let stats;
  try {
    stats = fs.statSync(parentDir);
  } catch {
    fail('BAD_PATH', uiMsg('err.freews.folderMissing'));
  }
  if (!stats.isDirectory()) fail('BAD_PATH', uiMsg('err.freews.notFolder'));
  const real = fs.realpathSync(parentDir);
  if (!fs.statSync(real).isDirectory()) fail('BAD_PATH', uiMsg('err.freews.notFolder'));
  return real;
}
function assertInside(parent, child) {
  const base = path.resolve(parent);
  const target = path.resolve(child);
  if (target !== base && !target.startsWith(base + path.sep)) fail('BAD_PATH', 'caminho escapa da pasta autorizada');
  return target;
}
function isGuardedStaging(stagingPath, parentDir) {
  const base = path.basename(stagingPath);
  return path.dirname(stagingPath) === path.resolve(parentDir) && base.startsWith(STAGING_PREFIX) && base.length > STAGING_PREFIX.length;
}
function removeStagingGuarded(plan) {
  if (!isGuardedStaging(plan.stagingPath, plan.parentDir)) fail('CONFLICT', 'staging fora da pasta autorizada; nada foi apagado');
  const stats = fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false});
  if (!stats) return;
  if (stats.isSymbolicLink()) {
    fs.rmSync(plan.stagingPath, {force: true});
    return;
  }
  if (!stats.isDirectory()) fail('CONFLICT', 'staging não é pasta; nada foi apagado');
  fs.rmSync(plan.stagingPath, {recursive: true, force: false});
}
function preparePromotion(runtime, sessionId, {parentDir, name} = {}) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  if (record.promotion && record.promotion.status === 'promoted') fail('ALREADY_PROMOTED', uiMsg('err.freews.alreadyPromoted'));
  if (record.promotion && record.promotion.status === 'committing') fail('PENDING', uiMsg('err.freews.pending'));
  if (record.promotion && record.promotion.status === 'prepared') {
    fail('PENDING', uiMsg('err.freews.alreadyPrepared'));
  }
  const realParent = assertParentDir(parentDir);
  const base = folderSlug(name || record.title);
  let folderName = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = core.candidateFolder(base, toNat(attempt));
    const target = path.join(realParent, candidate);
    assertInside(realParent, target);
    const stats = fs.lstatSync(target, {throwIfNoEntry: false});
    if (!stats) {
      folderName = candidate;
      break;
    }
  }
  if (!folderName) fail('COLLISION', uiMsg('err.freews.noFreeFolderName'));
  const folderPath = path.join(realParent, folderName);
  const token = crypto.randomBytes(12).toString('hex');
  const stagingPath = path.join(realParent, `${STAGING_PREFIX}${token}`);
  if (fs.lstatSync(stagingPath, {throwIfNoEntry: false})) fail('COLLISION', 'staging já existia');
  fs.mkdirSync(stagingPath, {mode: 0o700});
  const stagingMaterials = path.join(stagingPath, MATERIALS_DIR);
  fs.mkdirSync(stagingMaterials);
  const staged = [];
  try {
    const workspaceReal = fs.realpathSync(workspaceDir(runtime, id));
    const materialsReal = fs.realpathSync(materialsDirOf(runtime, id));
    if (materialsReal !== path.join(workspaceReal, MATERIALS_DIR)) fail('BAD_PATH', 'pasta de materiais do workspace não confere');
    for (const material of record.materials) {
      const source = fs.lstatSync(material.path, {throwIfNoEntry: false});
      if (!source || !source.isFile()) fail('BAD_SOURCE', `material ausente: ${material.name}`);
      const sourceReal = fs.realpathSync(material.path);
      assertInside(materialsReal, sourceReal);
      const sourceHash = sha256OfFile(sourceReal);
      if (material.sha256 && material.sha256 !== sourceHash) fail('VERIFY', `material mudou desde a importação: ${material.name}`);
      const target = path.join(stagingMaterials, material.name);
      if (fs.lstatSync(target, {throwIfNoEntry: false})) fail('COLLISION', `staging já tem ${material.name}`);
      fs.copyFileSync(sourceReal, target, fs.constants.COPYFILE_EXCL);
      const copyHash = sha256OfFile(target);
      const copyBytes = fs.statSync(target).size;
      if (copyHash !== sourceHash || (material.bytes && copyBytes !== material.bytes)) {
        fail('VERIFY', `cópia não confere: ${material.name}`);
      }
      staged.push({name: material.name, bytes: copyBytes, sha256: copyHash});
    }
  } catch (error) {
    try { fs.rmSync(stagingPath, {recursive: true, force: true}); } catch { /* já foi */ }
    throw error;
  }
  const plan = {
    status: 'prepared',
    token,
    folderName,
    folderPath,
    parentDir: realParent,
    stagingPath,
    materials: staged,
    at: nowIso(),
    courseId: '',
    courseName: '',
  };
  try {
    writeRecord(file, bump(record, {promotion: plan}));
  } catch (error) {
    try { fs.rmSync(stagingPath, {recursive: true, force: true}); } catch { /* já foi */ }
    throw error;
  }
  return plan;
}
/* Um courseId pertence a no máximo uma sessão promovida; quem promove não pode
   roubar a matéria de outra conversa. */
function assertCourseOwnership(runtime, sessionId, courseId) {
  if (!courseId) return;
  if (!isText(courseId, 128) || hasControls(courseId)) fail('BAD_ID', 'id de matéria inválido para a promoção');
  if (core.isFreeCourseId(courseId)) fail('BAD_ID', 'mesa-free não pode ser matéria de destino da promoção');
  const owner = findByCourseId(runtime, courseId);
  if (owner && owner.sessionId !== sessionId) {
    fail('OWNED', uiMsg('err.freews.owned'), {courseId, sessionId: owner.sessionId});
  }
}
/* Transação em duas fases: o journal (`committing` + matéria) é gravado ANTES
   do rename; depois do rename grava-se o recibo (`promoted`). Crash entre os
   dois deixa um estado que `recoverPromotion` conclui ou desfaz sem chute. */
function commitPromotion(runtime, sessionId, {token, courseId, courseName} = {}) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  const plan = record.promotion;
  if (!plan || (plan.status !== 'prepared' && plan.status !== 'committing')) fail('NOT_PREPARED', uiMsg('err.freews.notPrepared'));
  if (token && token !== plan.token) fail('BAD_TOKEN', 'promoção preparada é de outra operação');
  const pickedCourseId = courseId === undefined || courseId === null ? '' : courseId;
  if (pickedCourseId !== '' && (!isText(pickedCourseId, 128) || hasControls(pickedCourseId))) {
    fail('BAD_ID', 'id de matéria inválido para a promoção');
  }
  const pickedCourseName = typeof courseName === 'string' && courseName.trim() !== '' ? core.fitName(courseName) : '';
  if (pickedCourseId) assertCourseOwnership(runtime, id, pickedCourseId);
  if (!isGuardedStaging(plan.stagingPath, plan.parentDir)) fail('CONFLICT', 'staging fora da pasta autorizada');
  assertInside(plan.parentDir, plan.folderPath);
  let live = record;
  let staging = fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false});
  let folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});

  if (plan.status === 'prepared') {
    if (folder) {
      try { removeStagingGuarded(plan); } catch { /* mantém o staging se não puder apagar */ }
      writeRecord(file, bump(live, {promotion: null}));
      fail('COLLISION', uiMsg('err.freews.destAppeared'));
    }
    if (!staging || !staging.isDirectory() || staging.isSymbolicLink()) fail('NOT_PREPARED', uiMsg('err.freews.stagingGone'));
    live = bump(live, {promotion: {
      ...plan,
      status: 'committing',
      courseId: pickedCourseId || plan.courseId,
      courseName: pickedCourseName || plan.courseName,
      at: nowIso(),
    }});
    writeRecord(file, live);
  } else {
    if (staging && folder) fail('CONFLICT', 'staging e pasta de destino existem ao mesmo tempo; resolva antes de confirmar');
    if (!staging && !folder) {
      writeRecord(file, bump(live, {promotion: null}));
      fail('NOT_PREPARED', uiMsg('err.freews.noStagingNoDest'));
    }
  }

  if (staging && !folder && staging.isDirectory() && staging.isSymbolicLink() === false) {
    try {
      fs.renameSync(plan.stagingPath, plan.folderPath);
    } catch (error) {
      /* Fica em `committing` com o staging intacto: recover/rollback decidem. */
      throw new FreeWorkspaceError('CONFLICT', `não foi possível publicar a pasta da matéria: ${causeText(error)}`, {cause: causeText(error)});
    }
    folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
  }
  if (!folder) fail('NOT_PREPARED', uiMsg('err.freews.destGone'));
  verifyPromotedFolder(live.promotion);

  const receipt = {...live.promotion, status: 'promoted', stagingPath: '', at: nowIso()};
  try {
    writeRecord(file, bump(live, {promotion: receipt}));
  } catch (error) {
    try {
      fs.renameSync(plan.folderPath, plan.stagingPath);
    } catch (back) {
      throw new FreeWorkspaceError('ROLLBACK', `falha ao gravar o recibo e ao devolver a pasta: ${causeText(back)}`, {cause: causeText(error)});
    }
    throw error;
  }
  return {
    folderName: receipt.folderName,
    folderPath: receipt.folderPath,
    materials: receipt.materials,
    promotion: receipt,
  };
}
function verifyPromotedFolder(plan) {
  const stats = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) fail('CONFLICT', 'pasta promovida não confere; nada foi apagado');
  const entries = fs.readdirSync(plan.folderPath);
  if (entries.length !== 1 || entries[0] !== MATERIALS_DIR) fail('CONFLICT', 'a pasta de destino tem conteúdo inesperado; nada foi apagado');
  const inside = fs.readdirSync(path.join(plan.folderPath, MATERIALS_DIR)).sort();
  const expected = plan.materials.map((material) => material.name).sort();
  if (inside.length !== expected.length || inside.some((name, index) => name !== expected[index])) {
    fail('CONFLICT', 'a pasta de destino tem arquivos inesperados; nada foi apagado');
  }
  for (const material of plan.materials) {
    const file = path.join(plan.folderPath, MATERIALS_DIR, material.name);
    const fileStats = fs.lstatSync(file, {throwIfNoEntry: false});
    if (!fileStats || !fileStats.isFile() || fileStats.isSymbolicLink()) fail('CONFLICT', 'arquivo promovido não confere; nada foi apagado');
    if (sha256OfFile(file) !== material.sha256) fail('CONFLICT', 'arquivo promovido mudou; nada foi apagado');
  }
}
function rollbackPromotion(runtime, sessionId) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  const plan = record.promotion;
  if (!plan) return {rolledBack: false, reason: 'nothing-to-undo'};
  if (plan.status === 'promoted' || plan.status === 'committing') {
    const folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
    if (folder) {
      verifyPromotedFolder(plan);
      fs.rmSync(plan.folderPath, {recursive: true, force: false});
    }
    if (plan.stagingPath && fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false})) removeStagingGuarded(plan);
  } else {
    removeStagingGuarded(plan);
  }
  writeRecord(file, bump(record, {promotion: null}));
  return {rolledBack: true};
}
/* Conserta uma transação interrompida por crash/queda, sem inventar pasta:
     prepared + staging + sem destino      → segue pendente (`prepared`)
     prepared + destino                    → `conflict` (destino não é nosso)
     prepared sem staging e sem destino    → `cancelled` (nada foi criado)
     committing + staging + sem destino    → conclui o rename e grava o recibo
     committing + destino verificado       → grava o recibo
     committing sem staging e sem destino  → `cancelled`
   Qualquer incoerência vira `conflict` e NADA é apagado. */
function recoverPromotion(runtime, sessionId) {
  const id = normalizeSessionId(sessionId);
  const {file, record} = mustLoad(runtime, id);
  const plan = record.promotion;
  if (!plan) return {state: 'none'};
  if (plan.status === 'promoted') return {state: 'promoted', promotion: plan};
  const staging = plan.stagingPath ? fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false}) : undefined;
  const folder = fs.lstatSync(plan.folderPath, {throwIfNoEntry: false});
  if (plan.status === 'prepared') {
    if (folder) return {state: 'conflict', promotion: plan, reason: 'destino-existe-sem-journal' };
    if (staging) return {state: 'prepared', promotion: plan};
    writeRecord(file, bump(record, {promotion: null}));
    return {state: 'cancelled', promotion: plan};
  }
  if (staging && folder) return {state: 'conflict', promotion: plan, reason: 'staging-e-destino' };
  if (!staging && !folder) {
    writeRecord(file, bump(record, {promotion: null}));
    return {state: 'cancelled', promotion: plan};
  }
  if (staging && (!staging.isDirectory() || staging.isSymbolicLink())) {
    return {state: 'conflict', promotion: plan, reason: 'staging-invalido'};
  }
  if (staging) {
    try {
      fs.renameSync(plan.stagingPath, plan.folderPath);
    } catch (error) {
      return {state: 'conflict', promotion: plan, reason: `rename: ${causeText(error)}`};
    }
  }
  try {
    verifyPromotedFolder(plan);
  } catch (error) {
    return {state: 'conflict', promotion: plan, reason: causeText(error)};
  }
  const receipt = {...plan, status: 'promoted', stagingPath: '', at: nowIso()};
  writeRecord(file, bump(record, {promotion: receipt}));
  return {state: 'committed', completed: true, promotion: receipt};
}
/* Varredura de boot: devolve só as sessões que precisaram de algo. */
function recoverAllPromotions(runtime) {
  const out = [];
  for (const record of listWorkspaces(runtime)) {
    if (!record.promotion || record.promotion.status === 'promoted') continue;
    const result = recoverPromotion(runtime, record.id);
    out.push({sessionId: record.id, ...result});
  }
  return out;
}
function promotionPlan(runtime, sessionId) {
  return mustLoad(runtime, sessionId).record.promotion;
}

module.exports = {preparePromotion, commitPromotion, rollbackPromotion, recoverPromotion, recoverAllPromotions, promotionPlan};
