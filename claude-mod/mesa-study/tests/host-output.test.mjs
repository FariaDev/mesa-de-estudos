/* Testes da saída privada (host/output.mjs):
   - ensureCacheDir: criação 0700, leaf symlink recusado, diretório alheio
     (UID) e gravável por grupo/outros recusados SEM chmod, canônico de /tmp;
   - marcador válido (host + kind page/capture + token 32 hex + timestamp);
   - poda que nunca toca conteúdo alheio (marcador fraco, symlink, curso).
   Tudo local, sem CLI, sem captura real e sem material de curso. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {ensureCacheDir, createOutputDir, removeOwnOutputDir, pruneOwnOutputs, isValidOutputMarker} from '../host/output.mjs';
import {OUTPUT_MARKER, OUTPUT_PREFIX, OUTPUT_HOST_ID} from '../host/config.mjs';

const VALID_TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const OTHER_TOKEN = '00112233445566778899aabbccddeeff';
const OLD = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
const NOW = Date.now();

async function setup() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-out-'));
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache, {mode: 0o700});
  return {base, cache};
}

async function cleanup(base) {
  await fs.rm(base, {recursive: true, force: true});
}

async function writeMarker(dir, overrides = {}) {
  const marker = {
    host: OUTPUT_HOST_ID,
    kind: 'page',
    token: VALID_TOKEN,
    createdAt: OLD,
    ...overrides,
  };
  await fs.writeFile(path.join(dir, OUTPUT_MARKER), JSON.stringify(marker));
  return marker;
}

async function exists(target) {
  return await fs.stat(target).then(() => true, () => false);
}

test('ensureCacheDir: cria 0700 do próprio dono e devolve o caminho canônico', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-out-'));
  try {
    const target = path.join(base, 'novo', 'cache');
    const real = await ensureCacheDir(target);
    const stat = await fs.stat(target);
    assert.equal(real, await fs.realpath(target)); // /tmp → /private/tmp não é erro
    assert.equal(stat.mode & 0o777, 0o700);
    assert.equal(stat.isDirectory(), true);
    if (typeof process.getuid === 'function') assert.equal(stat.uid, process.getuid());

    // Diretório próprio existente 0755 (sem escrita de grupo/outros) é aceito.
    const loose = path.join(base, 'existente');
    await fs.mkdir(loose, {mode: 0o755});
    assert.equal(await ensureCacheDir(loose), await fs.realpath(loose));
  } finally {
    await cleanup(base);
  }
});

test('ensureCacheDir: recusa leaf symlink sem tocar no alvo', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-out-'));
  try {
    const target = path.join(base, 'alvo');
    await fs.mkdir(target, {mode: 0o700});
    await fs.writeFile(path.join(target, 'keep.txt'), 'arquivo alheio');
    const link = path.join(base, 'atalho');
    await fs.symlink(target, link);

    await assert.rejects(
      ensureCacheDir(link),
      (error) => error.code === 'CACHE_DIR_SYMLINK',
    );
    assert.equal((await fs.lstat(link)).isSymbolicLink(), true);
    assert.ok(await exists(path.join(target, 'keep.txt')));
  } finally {
    await cleanup(base);
  }
});

test('ensureCacheDir: recusa gravável por grupo/outros sem alterar o modo', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-out-'));
  try {
    for (const mode of [0o777, 0o770, 0o702]) {
      const insecure = path.join(base, `inseguro-${mode.toString(8)}`);
      await fs.mkdir(insecure, {mode});
      await fs.chmod(insecure, mode);
      await assert.rejects(
        ensureCacheDir(insecure),
        (error) => error.code === 'CACHE_DIR_PERMISSIONS',
      );
      assert.equal((await fs.stat(insecure)).mode & 0o777, mode, 'modo alheio não pode ser alterado');
    }
  } finally {
    await cleanup(base);
  }
});

test('ensureCacheDir: recusa outro UID (dono injetado) sem chmod', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-out-'));
  try {
    const dir = path.join(base, 'de-outro');
    await fs.mkdir(dir, {mode: 0o700});
    const realUid = typeof process.getuid === 'function' ? process.getuid() : 1234;
    await assert.rejects(
      ensureCacheDir(dir, {getuid: () => realUid + 1}),
      (error) => error.code === 'CACHE_DIR_NOT_OWNED',
    );
    assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
    // Diretório novo não tem dono prévio: a injeção de UID não impede a criação.
    const criado = path.join(base, 'novo');
    assert.equal(await ensureCacheDir(criado, {getuid: () => realUid + 1}), await fs.realpath(criado));
  } finally {
    await cleanup(base);
  }
});

test('ensureCacheDir: arquivo comum e caminho relativo são recusados', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-out-'));
  try {
    const file = path.join(base, 'arquivo.txt');
    await fs.writeFile(file, 'x');
    await assert.rejects(ensureCacheDir(file), (error) => error.code === 'CACHE_DIR_NOT_DIRECTORY');
    await assert.rejects(ensureCacheDir('relativo'), (error) => error.code === 'CACHE_DIR_NOT_ABSOLUTE');
  } finally {
    await cleanup(base);
  }
});

test('isValidOutputMarker: só aceita host + kind page/capture + token 32 hex + timestamp', () => {
  assert.equal(isValidOutputMarker({host: OUTPUT_HOST_ID, kind: 'page', token: VALID_TOKEN, createdAt: OLD}), true);
  assert.equal(isValidOutputMarker({host: OUTPUT_HOST_ID, kind: 'capture', token: OTHER_TOKEN, createdAt: new Date().toISOString()}), true);

  for (const weak of [
    null,
    {},
    {host: 'outro-host', kind: 'page', token: VALID_TOKEN, createdAt: OLD},
    {host: OUTPUT_HOST_ID, kind: 'outro', token: VALID_TOKEN, createdAt: OLD},
    {host: OUTPUT_HOST_ID, kind: 'page', token: 'a', createdAt: OLD},
    {host: OUTPUT_HOST_ID, kind: 'page', token: VALID_TOKEN.toUpperCase(), createdAt: OLD},
    {host: OUTPUT_HOST_ID, kind: 'page', token: `${VALID_TOKEN}00`, createdAt: OLD},
    {host: OUTPUT_HOST_ID, kind: 'page', token: VALID_TOKEN, createdAt: 'ontem'},
    {host: OUTPUT_HOST_ID, kind: 'page', token: VALID_TOKEN},
    {host: OUTPUT_HOST_ID, token: VALID_TOKEN, createdAt: OLD},
  ]) {
    assert.equal(isValidOutputMarker(weak), false, JSON.stringify(weak));
  }
});

test('createOutputDir: pasta 0700, marcador válido 0600 e remoção só da própria pasta', async () => {
  const {base, cache} = await setup();
  try {
    const {dir, token, kind} = await createOutputDir(cache, 'capture');
    assert.equal(kind, 'capture');
    assert.match(token, /^[0-9a-f]{32}$/);
    assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
    const raw = JSON.parse(await fs.readFile(path.join(dir, OUTPUT_MARKER), 'utf8'));
    assert.equal(isValidOutputMarker(raw), true);
    assert.equal((await fs.stat(path.join(dir, OUTPUT_MARKER))).mode & 0o777, 0o600);

    const foreign = path.join(cache, 'keep.txt');
    await fs.writeFile(foreign, 'alheio');
    await removeOwnOutputDir(dir);
    assert.equal(await exists(dir), false);
    assert.ok(await exists(foreign));
  } finally {
    await cleanup(base);
  }
});

test('pruneOwnOutputs: remove só marcador válido antigo; fraco, symlink e curso ficam', async () => {
  const {base, cache} = await setup();
  try {
    const oldValid = path.join(cache, `${OUTPUT_PREFIX}old-valid`);
    const oldCapture = path.join(cache, `${OUTPUT_PREFIX}old-capture`);
    const recentValid = path.join(cache, `${OUTPUT_PREFIX}recent`);
    const weakToken = path.join(cache, `${OUTPUT_PREFIX}weak-token`);
    const wrongKind = path.join(cache, `${OUTPUT_PREFIX}wrong-kind`);
    const wrongHost = path.join(cache, `${OUTPUT_PREFIX}wrong-host`);
    const badTime = path.join(cache, `${OUTPUT_PREFIX}bad-time`);
    const noMarker = path.join(cache, `${OUTPUT_PREFIX}no-marker`);
    const curso = path.join(cache, `${OUTPUT_PREFIX}curso`);
    const linkTarget = path.join(base, 'alvo-symlink');
    for (const dir of [oldValid, oldCapture, recentValid, weakToken, wrongKind, wrongHost, badTime, noMarker, curso]) {
      await fs.mkdir(dir);
    }
    await fs.mkdir(linkTarget);
    await writeMarker(linkTarget, {kind: 'page', token: OTHER_TOKEN, createdAt: OLD});

    await writeMarker(oldValid, {kind: 'page', token: VALID_TOKEN, createdAt: OLD});
    await writeMarker(oldCapture, {kind: 'capture', token: OTHER_TOKEN, createdAt: OLD});
    await writeMarker(recentValid, {kind: 'page', token: VALID_TOKEN, createdAt: new Date().toISOString()});
    await writeMarker(weakToken, {kind: 'page', token: 'a', createdAt: OLD});
    await writeMarker(wrongKind, {kind: 'curso', token: VALID_TOKEN, createdAt: OLD});
    await writeMarker(wrongHost, {host: 'outro-host', kind: 'page', token: VALID_TOKEN, createdAt: OLD});
    await writeMarker(badTime, {kind: 'page', token: VALID_TOKEN, createdAt: 'sem-data'});
    // symlink com nome do host: não é diretório (dirent) e não pode ser seguido.
    await fs.symlink(linkTarget, path.join(cache, `${OUTPUT_PREFIX}link`));
    // "curso": conteúdo alheio com marcador fraco; nunca é apagado.
    await fs.writeFile(path.join(curso, 'material.pdf'), 'conteúdo de curso');
    await writeMarker(curso, {kind: 'page', token: 'b', createdAt: OLD});
    await fs.writeFile(path.join(cache, 'keep.txt'), 'arquivo do usuário');

    const result = await pruneOwnOutputs(cache, {ttlMs: 30 * 24 * 3600 * 1000, now: NOW});
    assert.equal(result.removed, 2);

    assert.equal(await exists(oldValid), false);
    assert.equal(await exists(oldCapture), false);
    for (const kept of [recentValid, weakToken, wrongKind, wrongHost, badTime, noMarker, curso, linkTarget]) {
      assert.equal(await exists(kept), true, `${kept} precisa ser preservado`);
    }
    assert.ok(await exists(path.join(curso, 'material.pdf')));
    assert.ok(await exists(path.join(cache, 'keep.txt')));
    assert.equal((await fs.lstat(path.join(cache, `${OUTPUT_PREFIX}link`))).isSymbolicLink(), true);
  } finally {
    await cleanup(base);
  }
});
