'use strict';

const path = require('node:path');
const {atomicWrite, isPlainObject, readJson} = require('./backup-files.cjs');
const {backupNow, latestActivity, readStatus, writeStatus} = require('./backup-snapshot.cjs');

/* Backup — agendador: quando o automático deve rodar (ociosidade, intervalo,
   atividade recente). Quem chama é o shell/root.
   Saiu de backup.cjs na #43 fase 2. */

/* Estado do agendador automático: última atividade vista no runtime e se um
   ciclo automático já rodou depois dela. Não tem timer aqui: o root chama
   `shouldAutoBackup` em intervalo curto (5 min basta) e `backupNow` quando
   devolver `due`. É o que mantém o app sem relógio escondido no módulo. */
function autoStateFile(root) {
  return path.join(path.resolve(root), 'auto.json');
}
function readAutoState(root) {
  const raw = readJson(autoStateFile(root));
  return isPlainObject(raw) ? raw : {lastActivityAt: '', lastAutoAt: '', lastAutoId: ''};
}
function writeAutoState(root, patch) {
  const next = {...readAutoState(root), ...patch};
  atomicWrite(autoStateFile(root), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
/* `due` quando: auto ligado, destino configurado, passou o intervalo desde o
   último backup e o runtime ficou inativo por `idleMinutes`. Atividade nova
   reinicia a contagem — backup nunca corre com o Pi escrevendo. Atividade
   DEPOIS de `now` (relógio torto ou cálculo feito fora) também conta como
   "em uso": na dúvida, não roda. */
function shouldAutoBackup({runtime, root, settings = {}, now = Date.now(), activityAt = null, autoState = null}) {
  if (!settings.auto) return {due: false, why: 'automático desligado'};
  if (!root) return {due: false, why: 'sem destino de backup'};
  const status = readStatus(root);
  const state = autoState || readAutoState(root);
  const activity = activityAt === null ? latestActivity(runtime, {ignore: root}) : activityAt;
  const idleMs = settings.idleMinutes * 60 * 1000;
  const intervalMs = settings.intervalHours * 60 * 60 * 1000;
  if (activity >= now - idleMs) {
    return {due: false, why: 'mesa em uso', activityAt: new Date(activity).toISOString()};
  }
  const lastBackup = status.lastBackupAt ? Date.parse(status.lastBackupAt) : 0;
  if (lastBackup && now - lastBackup < intervalMs) {
    return {due: false, why: 'dentro do período', nextAt: new Date(lastBackup + intervalMs).toISOString()};
  }
  const lastAuto = state.lastAutoAt ? Date.parse(state.lastAutoAt) : 0;
  if (lastAuto && lastAuto >= lastBackup && lastAuto >= (activity || 0)) {
    return {due: false, why: 'já rodou depois da última atividade'};
  }
  return {
    due: true,
    why: lastBackup ? 'passou o período e a mesa está parada' : 'primeiro backup automático',
    activityAt: activity ? new Date(activity).toISOString() : '',
  };
}
/* Ciclo completo do automático: roda quando `shouldAutoBackup` manda e grava o
   estado de tentativa (sucesso OU erro) para não repetir em laço. */
async function runAutoBackup({runtime, root, deskDir = '', materials = [], external = [], settings = {}, now = Date.now(), activityAt = null, allowActive = false, log = () => {}}) {
  /* Atividade calculada uma vez: o gate e o snapshot veem o mesmo instante. */
  const activity = activityAt === null ? latestActivity(runtime, {ignore: root}) : activityAt;
  const gate = shouldAutoBackup({runtime, root, settings, now, activityAt: activity});
  if (!gate.due) return {ran: false, ...gate};
  const reason = settings.reason || 'auto';
  writeAutoState(root, {lastAutoAt: new Date(now).toISOString(), lastActivityAt: gate.activityAt || ''});
  try {
    const result = await backupNow({runtime, root, deskDir, materials, external, binaries: settings.binaries, reason, keep: settings.keep, allowActive, log});
    writeAutoState(root, {lastAutoId: result.snapshotId, lastAutoAt: result.created});
    writeStatus(root, {auto: {attemptedAt: new Date(now).toISOString(), snapshotId: result.snapshotId, error: ''}});
    return {ran: true, ok: true, result, why: gate.why};
  } catch (error) {
    writeStatus(root, {auto: {attemptedAt: new Date(now).toISOString(), snapshotId: '', error: error.message}});
    log(`backup automático falhou: ${error.message}`);
    return {ran: true, ok: false, error: error.message, why: gate.why};
  }
}

module.exports = {readAutoState, writeAutoState, shouldAutoBackup, runAutoBackup};
