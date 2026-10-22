'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {invalidValue} = require('../error-detail.mjs');
const {message: uiMsg} = require('../i18n.mjs');
const {safeRelPath} = require('./zipkit.cjs');

/* Backup — limites e erros, utilidades de arquivo (hash, escrita atômica,
   cópia), classificação do que nunca entra (negativa dura) e caminhos do
   manifesto e das versões.
   Saiu de backup.cjs na #43 fase 2. */

const MANIFEST_NAME = 'manifest.json';
const EXCLUDED_NAME = 'excluded.json';
/* Versões num subdiretório do destino: a raiz fica com o ledger, a config e o
   vizinho `git/` do destino git — nada compete por nome. */
const SNAPSHOTS_DIR = 'snapshots';
const FORMAT_VERSION = 1;
const SNAPSHOT_ID_RE = /^snap-[0-9]{8}T[0-9]{6}[0-9]{3}Z-[0-9a-f]{6}$/;
const DEFAULT_KEEP = 10;
const DEFAULT_IDLE_MINUTES = 30;
const DEFAULT_INTERVAL_HOURS = 24;
const BACKUP_ERROR = 'MESA_BACKUP_ERROR';
const RESTORE_ERROR = 'MESA_RESTORE_ERROR';
class BackupError extends Error {
  constructor(message, code = BACKUP_ERROR) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}
class RestoreError extends Error {
  constructor(message, code = RESTORE_ERROR) {
    super(message);
    this.name = 'RestoreError';
    this.code = code;
  }
}
const {isPlainObject} = require('../../plain-object.cjs');
const posix = (rel) => String(rel).split(path.sep).join('/');
/* Hash e tamanho de um arquivo em streaming: PDF de 200 MB não vira Buffer. */
function hashFile(abs) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(abs);
    let size = 0;
    stream.on('data', (chunk) => {
      size += chunk.length;
      hash.update(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve({sha256: hash.digest('hex'), size}));
  });
}
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
const {readJson, atomicWrite} = require('../../json-file.cjs');
function removeQuiet(abs) {
  try {
    fs.rmSync(abs, {recursive: true, force: true});
  } catch {}
}
/* Realpath tolerante a caminho que ainda não existe (o destino pode ser uma
   pasta a criar): resolve o ancestral existente mais próximo e recompõe a
   cauda — symlink vale nas DUAS direções da comparação. */
function realPathOf(target) {
  let current = path.resolve(target);
  const tail = [];
  for (;;) {
    try {
      return tail.length ? path.join(fs.realpathSync(current), ...tail) : fs.realpathSync(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      tail.unshift(path.basename(current));
      current = parent;
    }
  }
}
/* O destino do backup tem de ficar FORA do runtime em qualquer direção real
   (symlink incluso): dentro, o snapshot copiaria as versões já gravadas e cada
   rodada cresceria sobre a anterior; contendo o runtime, a manutenção do
   destino mexeria na árvore do app. O CLI chama `snapshot`/`backupNow` direto,
   então a guarda mora aqui, antes de criar qualquer pasta. */
function assertDestinationOutsideRuntime({runtime, root}) {
  if (!runtime) throw new BackupError(invalidValue('runtime do snapshot', runtime, 'caminho absoluto'));
  if (!root) throw new BackupError(invalidValue('destino do snapshot', root, 'caminho absoluto'));
  const runtimeReal = realPathOf(runtime);
  const rootReal = realPathOf(root);
  const contains = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
  };
  if (contains(runtimeReal, rootReal) || contains(rootReal, runtimeReal)) {
    throw new BackupError(uiMsg('err.backup.destInRuntime'));
  }
  return {runtime: runtimeReal, root: rootReal};
}
function copyFileStreaming(from, to) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(to), {recursive: true});
    const input = fs.createReadStream(from);
    const output = fs.createWriteStream(to);
    input.on('error', reject);
    output.on('error', reject);
    output.on('close', resolve);
    input.pipe(output);
  });
}
function stampId(now = new Date(), salt = crypto.randomBytes(3).toString('hex')) {
  const iso = new Date(now).toISOString();
  const base = iso.slice(0, 19).replace(/[-:]/g, ''); // YYYYMMDDTHHMMSS
  const millis = iso.slice(20, 23); // milissegundos
  return `snap-${base}${millis}Z-${salt}`;
}
/* Nome que NUNCA entra, em qualquer profundidade. Comparação sem caixa e sem
   acento não é necessária: os nomes de credencial são ASCII. */
const DENY_NAMES = new Set([
  'auth.json', 'auth.json.bak', 'credentials', 'credentials.json', 'credential.json',
  'token', 'token.json', 'tokens.json', 'secret', 'secrets.json', 'keychain',
  'session-env', 'shell-snapshots', 'file-history', 'mcp-cache.json',
  'mcp-npx-cache.json', 'models-store.json', 'search-keys.json', 'update.json',
  'update.lock', 'settings.local.json', 'cache',
  '.ds_store', 'thumbs.db', 'desktop.ini', 'node_modules', '.git', '.cache',
]);
const DENY_SUFFIX = ['.log', '.pem', '.key', '.crt', '.p12', '.pfx', '.tmp', '.part', '.swp', '.lock'];
const ROTATED_LOG = /\.log\.\d+$/;
const DENY_PREFIX = ['.review-draft-', '.mesa-free-staging-', '.tmp-'];
const DENY_DIRS_TOP = new Set(['electron', 'claude-workspaces']);
/* Estado do próprio backup (staging de restauração, diários): nunca entra no
   backup — senão cada versão carregaria o staging da anterior. */
const DENY_STATE_DIR = '.backup';
function denyReason(name, rel, kind) {
  const lower = String(name).toLowerCase();
  if (denyIsDirName(lower)) return 'caminho de trabalho/cache';
  if (DENY_NAMES.has(lower)) return 'nome de credencial/cache';
  for (const suffix of DENY_SUFFIX) if (lower.endsWith(suffix)) return `extensão proibida (${suffix})`;
  /* O `desk.log` rotaciona para `desk.log.1`, que o sufixo `.log` não pegava (#43 fase 3). */
  if (ROTATED_LOG.test(lower)) return 'log rotacionado';
  for (const prefix of DENY_PREFIX) if (lower.startsWith(prefix)) return 'arquivo temporário';
  if (kind === 'live' && rel.split('/')[0] === 'electron') return 'cache do Electron';
  if (kind === 'live' && rel.split('/')[0] === 'claude-workspaces') return 'workspace efêmero do Claude (recriado a cada conversa)';
  return null;
}
function denyIsDirName(lower) {
  return lower === 'node_modules' || lower === '.git' || lower === 'cache' || lower === 'caches' ||
    lower === 'session-env' || lower === 'shell-snapshots' ||
    lower === 'file-history' || lower === '.cache' || lower === 'tmp' || lower === 'temp' ||
    lower === '.trash' || lower === 'crashpad' || lower === 'logs';
}
/* Motivo pelo qual um arquivo do runtime fica de fora. `null` = entra. */
function runtimeExclusion(rel, kind = 'live') {
  const norm = safeRelPath(posix(rel));
  if (!norm) return 'caminho inválido';
  const parts = norm.split('/');
  if (kind === 'live' && parts.length > 1 && DENY_DIRS_TOP.has(parts[0])) {
    return parts[0] === 'electron' ? 'cache do Electron' : 'workspace efêmero do Claude';
  }
  for (const part of parts) {
    if (kind === 'live' && part === DENY_STATE_DIR) return 'estado interno do backup (staging/diário)';
    if (denyIsDirName(part.toLowerCase())) return `diretório excluído (${part})`;
  }
  for (let index = 0; index < parts.length; index++) {
    const reason = denyReason(parts[index], parts.join('/'), kind);
    if (reason) return reason;
  }
  return null;
}
/* Política de PDF/binários: explícita no manifesto. `include` copia;
   `exclude` guarda só inventário (nada some calado — a prévia diz quantos
   PDFs ficaram fora e por quê). */
function normalizeBinaryPolicy(value) {
  return value === 'exclude' ? 'exclude' : 'include';
}
function manifestPath(snapshotDir) {
  return path.join(snapshotDir, MANIFEST_NAME);
}
function readManifest(snapshotDir) {
  const raw = readJson(manifestPath(snapshotDir));
  if (!raw || raw.format !== FORMAT_VERSION || !Array.isArray(raw.entries)) return null;
  return raw;
}
function snapshotsRoot(root) {
  return path.join(path.resolve(root || ''), SNAPSHOTS_DIR);
}
function snapshotDirFor(root, id) {
  if (!SNAPSHOT_ID_RE.test(String(id || ''))) throw new BackupError(uiMsg('err.backup.badVersion', {id: String(id)}));
  return path.join(snapshotsRoot(root), String(id));
}

module.exports = {MANIFEST_NAME, EXCLUDED_NAME, SNAPSHOTS_DIR, FORMAT_VERSION, SNAPSHOT_ID_RE, DEFAULT_KEEP, DEFAULT_IDLE_MINUTES, DEFAULT_INTERVAL_HOURS, BACKUP_ERROR, RESTORE_ERROR, BackupError, RestoreError, isPlainObject, posix, hashFile, hashBuffer, atomicWrite, readJson, removeQuiet, assertDestinationOutsideRuntime, copyFileStreaming, stampId, runtimeExclusion, normalizeBinaryPolicy, manifestPath, readManifest, snapshotsRoot, snapshotDirFor};
