/* Saída privada em cacheDir autorizado:
   - cacheDir precisa ser caminho absoluto; é criado 0700 (próprio dono) se
     não existir;
   - cacheDir pré-existente é aceito só se for diretório real (leaf symlink
     recusado), do próprio UID e sem escrita por grupo/outros; o modo/dono de
     diretório alheio NUNCA é alterado — a operação recusa;
   - cada operação ganha um subdiretório exclusivo criado por mkdtemp (0700)
     com um marcador `.mesa-study.json` (token + createdAt, arquivo 0600);
   - falha remove SÓ esse subdiretório próprio;
   - poda de retenção remove SÓ diretórios com o prefixo e um marcador válido
     (host + kind page/capture + token aleatório de 32 hex + timestamp), mais
     velhos que o TTL. Nada fora disso é lido/apagado. */

import path from 'node:path';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {HostError} from './errors.mjs';
import {
  OUTPUT_PREFIX,
  OUTPUT_MARKER,
  OUTPUT_HOST_ID,
  OUTPUT_TTL_MS,
} from './config.mjs';

const MARKER_TOKEN = /^[0-9a-f]{32}$/;
const MARKER_KINDS = new Set(['page', 'capture']);

function uidProvider(deps) {
  if (deps && typeof deps.getuid === 'function') return deps.getuid;
  if (typeof process.getuid === 'function') return () => process.getuid();
  return null;
}

async function inspectCacheLeaf(cacheDir) {
  let stat;
  try {
    stat = await fs.lstat(cacheDir);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw new HostError('CACHE_DIR_IO', 'Não foi possível acessar o cacheDir.', {cacheDir});
  }
  if (stat.isSymbolicLink()) {
    throw new HostError('CACHE_DIR_SYMLINK', 'O cacheDir é um symlink; use um diretório real e privado.', {cacheDir});
  }
  if (!stat.isDirectory()) {
    throw new HostError('CACHE_DIR_NOT_DIRECTORY', 'O cacheDir precisa ser um diretório.', {cacheDir});
  }
  return stat;
}

export async function ensureCacheDir(cacheDir, deps = {}) {
  if (!path.isAbsolute(cacheDir)) {
    throw new HostError('CACHE_DIR_NOT_ABSOLUTE', 'Campo cacheDir precisa ser um caminho absoluto.');
  }
  const getuid = uidProvider(deps);
  let leaf = await inspectCacheLeaf(cacheDir);
  if (!leaf) {
    try {
      await fs.mkdir(cacheDir, {recursive: true, mode: 0o700});
      // mkdir respeita umask; garante 0700 no diretório que acabamos de criar.
      await fs.chmod(cacheDir, 0o700);
    } catch {
      throw new HostError('CACHE_DIR_IO', 'Não foi possível criar o cacheDir.', {cacheDir});
    }
    leaf = await inspectCacheLeaf(cacheDir);
    if (!leaf) throw new HostError('CACHE_DIR_IO', 'Não foi possível criar o cacheDir.', {cacheDir});
  } else {
    // Diretório alheio: verificar, nunca chmod/chown.
    if (getuid && typeof leaf.uid === 'number' && leaf.uid !== getuid()) {
      throw new HostError('CACHE_DIR_NOT_OWNED', 'O cacheDir pertence a outro usuário; use um diretório seu.', {cacheDir});
    }
    if ((leaf.mode & 0o022) !== 0) {
      throw new HostError(
        'CACHE_DIR_PERMISSIONS',
        'O cacheDir é gravável por grupo ou outros; use um diretório privado (0700).',
        {cacheDir},
      );
    }
  }
  let real;
  try {
    real = await fs.realpath(cacheDir);
  } catch {
    throw new HostError('CACHE_DIR_IO', 'Não foi possível acessar o cacheDir.', {cacheDir});
  }
  let realStat;
  try {
    realStat = await fs.stat(real);
  } catch {
    throw new HostError('CACHE_DIR_IO', 'Não foi possível acessar o cacheDir.', {cacheDir});
  }
  if (!realStat.isDirectory()) {
    throw new HostError('CACHE_DIR_NOT_DIRECTORY', 'O cacheDir precisa ser um diretório.', {cacheDir});
  }
  return real;
}

export async function createOutputDir(cacheDir, kind) {
  let dir;
  try {
    dir = await fs.mkdtemp(path.join(cacheDir, OUTPUT_PREFIX));
    await fs.chmod(dir, 0o700);
  } catch {
    throw new HostError('CACHE_DIR_IO', 'Não foi possível criar a pasta de saída no cacheDir.', {cacheDir});
  }
  const token = randomBytes(16).toString('hex');
  const marker = {
    host: OUTPUT_HOST_ID,
    kind,
    token,
    createdAt: new Date().toISOString(),
  };
  try {
    await fs.writeFile(path.join(dir, OUTPUT_MARKER), JSON.stringify(marker), {mode: 0o600});
  } catch {
    await fs.rm(dir, {recursive: true, force: true});
    throw new HostError('CACHE_DIR_IO', 'Não foi possível preparar a pasta de saída.', {cacheDir});
  }
  return {dir, token, kind};
}

/* Remove apenas o diretório próprio criado nesta operação. */
export async function removeOwnOutputDir(dir) {
  try {
    await fs.rm(dir, {recursive: true, force: true});
  } catch {
    // melhor esforço: nunca falha a operação por causa da limpeza do próprio dir
  }
}

/* Marcador que a poda aceita remover: host certo, kind page/capture,
   token aleatório de 16 bytes (32 hex) e createdAt parseável. */
export function isValidOutputMarker(marker) {
  if (!marker || typeof marker !== 'object') return false;
  if (marker.host !== OUTPUT_HOST_ID) return false;
  if (!MARKER_KINDS.has(marker.kind)) return false;
  if (typeof marker.token !== 'string' || !MARKER_TOKEN.test(marker.token)) return false;
  if (typeof marker.createdAt !== 'string') return false;
  return Number.isFinite(Date.parse(marker.createdAt));
}

/* Poda de retenção: só diretórios `mesa-study-*` (não symlink, via dirent)
   com marcador VÁLIDO do host e createdAt mais velho que ttlMs.
   Best-effort, nunca lança. */
export async function pruneOwnOutputs(cacheDir, {ttlMs = OUTPUT_TTL_MS, now = Date.now()} = {}) {
  const result = {removed: 0, scanned: 0};
  let entries;
  try {
    entries = await fs.readdir(cacheDir, {withFileTypes: true});
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(OUTPUT_PREFIX)) continue;
    result.scanned += 1;
    const dir = path.join(cacheDir, entry.name);
    try {
      const raw = await fs.readFile(path.join(dir, OUTPUT_MARKER), 'utf8');
      const marker = JSON.parse(raw);
      if (!isValidOutputMarker(marker)) continue;
      const createdAt = Date.parse(marker.createdAt);
      if (now - createdAt < ttlMs) continue;
      await fs.rm(dir, {recursive: true, force: true});
      result.removed += 1;
    } catch {
      // sem marcador legível: não é nosso, preserva
    }
  }
  return result;
}
