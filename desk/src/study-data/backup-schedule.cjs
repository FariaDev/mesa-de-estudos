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
const AUTO_RETRY_MS = 15 * 60 * 1000;
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
  /* Falha recente espera AUTO_RETRY_MS: o "já rodou" só marca no sucesso, e
     sem esta espera um destino que sempre falha (disco cheio, pasta sumida)
     tentaria um snapshot inteiro a cada tique de 60 s (§14 da auditoria). */
  const failedAt = Math.max(status.auto && status.auto.error ? Date.parse(status.auto.attemptedAt) || 0 : 0, autoFailedAt.get(autoFlightKey(root)) || 0);
  if (failedAt && now - failedAt < AUTO_RETRY_MS) {
    return {due: false, why: 'falhou há pouco', nextAt: new Date(failedAt + AUTO_RETRY_MS).toISOString()};
  }
  return {
    due: true,
    why: lastBackup ? 'passou o período e a mesa está parada' : 'primeiro backup automático',
    activityAt: activity ? new Date(activity).toISOString() : '',
  };
}
/* Tentativa em voo por destino: o tique do root é curto e o snapshot é lento;
   sem isso duas chamadas corriam o mesmo destino juntas. Chave é o root
   resolvido; sem timer aqui, só o conjunto. */
const autoInFlight = new Set();
/* Última falha do automático por destino, em memória: se o próprio destino não
   aceita escrita (disco cheio, somente leitura), o `writeStatus` da falha também
   falha e o ledger não guarda o freio de AUTO_RETRY_MS. */
const autoFailedAt = new Map();
function autoFlightKey(root) {
  try {
    return path.resolve(root || '');
  } catch {
    return String(root || '');
  }
}
/* Ciclo completo do automático: roda quando `shouldAutoBackup` manda. O
   "já rodou" (`lastAutoAt`) só é gravado DEPOIS do snapshot dar certo: se
   falhar ou o app cair no meio, o próximo tique tenta de novo em vez de ler
   "já rodou" sem snapshot novo. */
async function runAutoBackup({runtime, root, deskDir = '', materials = [], external = [], settings = {}, now = Date.now(), activityAt = null, allowActive = false, log = () => {}, takeSnapshot = backupNow}) {
  /* Atividade calculada uma vez: o gate e o snapshot veem o mesmo instante. */
  const activity = activityAt === null ? latestActivity(runtime, {ignore: root}) : activityAt;
  const gate = shouldAutoBackup({runtime, root, settings, now, activityAt: activity});
  if (!gate.due) return {ran: false, ...gate};
  const reason = settings.reason || 'auto';
  const flight = autoFlightKey(root);
  if (autoInFlight.has(flight)) return {ran: false, why: 'automático em curso', due: false};
  autoInFlight.add(flight);
  try {
    const result = await takeSnapshot({runtime, root, deskDir, materials, external, binaries: settings.binaries, reason, keep: settings.keep, allowActive, log});
    autoFailedAt.delete(flight);
    writeAutoState(root, {lastAutoId: result.snapshotId, lastAutoAt: result.created, lastActivityAt: gate.activityAt || ''});
    writeStatus(root, {auto: {attemptedAt: new Date(now).toISOString(), snapshotId: result.snapshotId, error: ''}});
    return {ran: true, ok: true, result, why: gate.why};
  } catch (error) {
    autoFailedAt.set(flight, now);
    try {
      writeStatus(root, {auto: {attemptedAt: new Date(now).toISOString(), snapshotId: '', error: error.message}});
    } catch (statusError) {
      log(`estado da falha do backup automático não gravado: ${statusError.message}`);
    }
    log(`backup automático falhou: ${error.message}`);
    return {ran: true, ok: false, error: error.message, why: gate.why};
  } finally {
    autoInFlight.delete(flight);
  }
}

module.exports = {readAutoState, writeAutoState, shouldAutoBackup, runAutoBackup};
