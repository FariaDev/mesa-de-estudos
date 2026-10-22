'use strict';

const path = require('node:path');
const {DEFAULT_IDLE_MINUTES, DEFAULT_INTERVAL_HOURS, DEFAULT_KEEP, atomicWrite, isPlainObject, normalizeBinaryPolicy, readJson} = require('./backup-files.cjs');

/* Backup — configuração do destino (fora do runtime): leitura, defaults e escrita.
   Saiu de backup.cjs na #43 fase 2. */

function configCandidates(rootAbs) {
  return [
    path.join(rootAbs, 'mesa-backup.json'),
    path.join(rootAbs, 'desk', 'backup-config.json'),
  ];
}
/* `rootAbs` é um DIRETÓRIO; `readConfigFile`/`writeConfigFile` trabalham com o
   ARQUIVO JSON exato (o host pode passar `settingsFile`). As duas formas
   existem porque o CLI/testes usam a pasta e o adapter usa o arquivo. */
function readConfigFile(fileAbs) {
  const raw = readJson(path.resolve(fileAbs));
  return isPlainObject(raw) ? raw : {};
}
function readConfig(rootAbs) {
  for (const file of configCandidates(rootAbs)) {
    const raw = readJson(file);
    if (isPlainObject(raw)) return {...raw, __file: file};
  }
  return {};
}
function resolveSettings(rootAbs, options = {}) {
  const explicitFile = typeof options.configFile === 'string' && options.configFile ? path.resolve(options.configFile) : '';
  const file = explicitFile ? readConfigFile(explicitFile) : readConfig(rootAbs);
  const env = options.env || process.env;
  const merged = {...file, ...(isPlainObject(options.settings) ? options.settings : {})};
  const destEnv = env.MESA_BACKUP_DIR;
  const dest = options.destination || merged.destination || destEnv || '';
  const minutes = Number(env.MESA_BACKUP_IDLE_MINUTES ?? merged.idleMinutes);
  const hours = Number(env.MESA_BACKUP_INTERVAL_HOURS ?? merged.intervalHours);
  const keep = Number(env.MESA_BACKUP_KEEP ?? merged.keep);
  const gitRemote = options.gitRemote ?? merged.gitRemote ?? env.MESA_BACKUP_GIT_REMOTE ?? '';
  return {
    destination: typeof dest === 'string' ? dest : '',
    auto: merged.auto === true,
    idleMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.trunc(minutes) : DEFAULT_IDLE_MINUTES,
    intervalHours: Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_INTERVAL_HOURS,
    keep: Number.isFinite(keep) && keep > 0 ? Math.trunc(keep) : DEFAULT_KEEP,
    binaries: normalizeBinaryPolicy(merged.binaries),
    git: merged.git === true,
    gitRoot: typeof merged.gitRoot === 'string' ? merged.gitRoot : '',
    gitRemote: typeof gitRemote === 'string' ? gitRemote : '',
    external: Array.isArray(merged.external) ? merged.external : [],
    configFile: explicitFile || file.__file || configCandidates(rootAbs)[0],
  };
}
function writeConfig(rootAbs, patch) {
  const current = readConfig(rootAbs);
  const next = {...current, ...(isPlainObject(patch) ? patch : {})};
  delete next.__file;
  const file = configCandidates(rootAbs)[0];
  atomicWrite(file, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
function writeConfigFile(fileAbs, patch) {
  const target = path.resolve(fileAbs);
  const current = readConfigFile(target);
  const next = {...current, ...(isPlainObject(patch) ? patch : {})};
  atomicWrite(target, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

module.exports = {readConfigFile, readConfig, resolveSettings, writeConfig, writeConfigFile};
