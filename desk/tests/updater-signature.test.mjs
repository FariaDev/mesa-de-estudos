import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {TEST_COMMIT, generateSigningPair, makeSignedRelease} from './fake-update-release.mjs';

/* Manifesto assinado e teto de download do updater (#80). A chave é um par
   Ed25519 gerado na hora; nenhum teste usa a chave real nem a rede. */
const require = createRequire(import.meta.url);
const signature = require('../updater-signature.cjs');
const updater = require('../updater.cjs');

const DESK = path.resolve(import.meta.dirname, '..');

test('#80: assinatura válida confere o manifesto e o zip', () => {
  const zip = Buffer.from('conteúdo do zip');
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const manifest = signature.verifySignedManifest({
    manifestBytes: release.manifestBytes,
    signatureBytes: release.signatureBytes,
    publicKey: release.publicKey,
    announcedVersion: '0.4.1',
  });
  assert.deepEqual(manifest, release.manifest);
  assert.deepEqual(signature.assertZipMatchesManifest(zip, manifest), {sha256: release.manifest.zipSha256});
});

test('#80: assinatura de outra chave recusa', () => {
  const zip = Buffer.from('zip');
  const outra = generateSigningPair();
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip, signingKey: outra.privateKey});
  assert.throws(() => signature.verifySignedManifest({
    manifestBytes: release.manifestBytes,
    signatureBytes: release.signatureBytes,
    publicKey: release.publicKey,
    announcedVersion: '0.4.1',
  }), /assinatura do manifesto da v0\.4\.1 não confere/);
});

test('#80: assinatura ausente recusa', () => {
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  assert.throws(() => signature.verifySignedManifest({
    manifestBytes: release.manifestBytes,
    signatureBytes: Buffer.alloc(0),
    publicKey: release.publicKey,
    announcedVersion: '0.4.1',
  }), /assinatura do manifesto da v0\.4\.1 não confere/);
});

test('#80: manifesto adulterado depois da assinatura recusa', () => {
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  const adulterado = Buffer.from(release.manifestBytes.toString('utf8').replace(TEST_COMMIT, 'f'.repeat(40)));
  assert.throws(() => signature.verifySignedManifest({
    manifestBytes: adulterado,
    signatureBytes: release.signatureBytes,
    publicKey: release.publicKey,
    announcedVersion: '0.4.1',
  }), /assinatura do manifesto/);
});

test('#80: hash e tamanho diferentes do manifesto recusam', () => {
  const zip = Buffer.from('zip verdadeiro');
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const outroZip = Buffer.from('outro zip');
  assert.throws(() => signature.assertZipMatchesManifest(outroZip, release.manifest), /O zip tem \d+ bytes e o manifesto assinado declara \d+/);
  const mesmoTamanho = Buffer.from(zip);
  mesmoTamanho[0] ^= 0xff;
  assert.throws(() => signature.assertZipMatchesManifest(mesmoTamanho, release.manifest), /SHA-256 do zip não confere/);
});

test('#80: manifesto inválido (campo faltando ou versão trocada) recusa', () => {
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  assert.throws(() => signature.verifySignedManifest({
    manifestBytes: release.manifestBytes,
    signatureBytes: release.signatureBytes,
    publicKey: release.publicKey,
    announcedVersion: '0.4.2',
  }), /O manifesto assinado é da v0\.4\.1 e a atualização anunciada é a v0\.4\.2/);
  const semZip = makeSignedRelease({
    version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip'),
    manifest: {version: '0.4.1', commit: TEST_COMMIT, zipBytes: 3},
  });
  assert.throws(() => signature.verifySignedManifest({
    manifestBytes: semZip.manifestBytes,
    signatureBytes: semZip.signatureBytes,
    publicKey: semZip.publicKey,
    announcedVersion: '0.4.1',
  }), /zipSha256 ausente/);
});

test('#80: chave marcador recusa antes de qualquer download', async () => {
  const zip = Buffer.from('zip');
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  assert.equal(signature.isPlaceholderKey('PLACEHOLDER — gere a chave'), true);
  assert.equal(signature.isPlaceholderKey(''), true);
  assert.throws(() => signature.verifySignedManifest({
    manifestBytes: release.manifestBytes,
    signatureBytes: release.signatureBytes,
    publicKey: 'PLACEHOLDER — chave ainda não configurada',
    announcedVersion: '0.4.1',
  }), /chave pública de atualização não foi configurada/);
  let downloads = 0;
  await assert.rejects(() => signature.loadSignedRelease({
    version: '0.4.1',
    publicKey: 'PLACEHOLDER',
    fetchBuffer: async () => { downloads++; return zip; },
    needZip: true,
  }), /chave pública de atualização não foi configurada/);
  assert.equal(downloads, 0);
  /* O arquivo commitado é o marcador ou, depois do keygen do autor, uma chave Ed25519. */
  const committed = fs.readFileSync(path.join(DESK, 'update-signing-key.pub'), 'utf8');
  if (!signature.isPlaceholderKey(committed)) assert.equal(crypto.createPublicKey(committed).asymmetricKeyType, 'ed25519');
});

test('#80: chave pública ilegível recusa', () => {
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  assert.throws(() => signature.verifySignedManifest({
    manifestBytes: release.manifestBytes,
    signatureBytes: release.signatureBytes,
    publicKey: 'não é PEM',
    announcedVersion: '0.4.1',
  }), /chave pública de atualização é inválida/);
});

test('#80: commit da tag diferente do manifesto recusa', () => {
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  assert.throws(() => signature.assertTagCommitMatches(release.manifest, 'c'.repeat(40), {tag: 'v0.4.1'}),
    /O commit da tag v0\.4\.1 \(c{40}\) não bate com o commit do manifesto assinado/);
  assert.equal(signature.assertTagCommitMatches(release.manifest, TEST_COMMIT), TEST_COMMIT);
});

test('#80: HEAD fora do commit assinado recusa (branch à frente da tag)', () => {
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  assert.throws(() => signature.assertAppliedCommitMatches(release.manifest, 'd'.repeat(40)),
    /O repositório ficou no commit d{40}, mas o manifesto assinado é do commit/);
  assert.equal(signature.assertAppliedCommitMatches(release.manifest, TEST_COMMIT), TEST_COMMIT);
});

test('#80: zip declarado acima do teto recusa antes do download', async () => {
  const zip = Buffer.alloc(2048, 1);
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  let requested = '';
  await assert.rejects(() => signature.loadSignedRelease({
    version: '0.4.1',
    publicKey: release.publicKey,
    fetchBuffer: async (url) => { requested = url; return release.fetchBuffer(url); },
    needZip: true,
    zipMaxBytes: 1024,
  }), /acima do teto de 1024/);
  assert.equal(requested, release.urls.signature, 'o zip nem chega a ser baixado');
});

test('#80: download maior que o teto recusa', async () => {
  const zip = Buffer.from('zip pequeno');
  const release = makeSignedRelease({
    version: '0.4.1', commit: TEST_COMMIT, zip,
    manifest: {version: '0.4.1', commit: TEST_COMMIT, zipSha256: crypto.createHash('sha256').update(zip).digest('hex'), zipBytes: zip.length},
  });
  await assert.rejects(() => signature.loadSignedRelease({
    version: '0.4.1',
    publicKey: release.publicKey,
    fetchBuffer: async (url) => (url === release.urls.zip ? Buffer.alloc(2048, 7) : release.fetchBuffer(url)),
    needZip: true,
    zipMaxBytes: 1024,
  }), /passou do teto de 1024 bytes/);
});

test('#80: defaultFetchBuffer aborta content-length e stream acima do teto', async (t) => {
  let reply = new Response(null, {status: 200, headers: {'content-length': '100'}});
  t.mock.method(globalThis, 'fetch', async () => reply);
  await assert.rejects(() => updater.defaultFetchBuffer('https://exemplo.test/bin', {maxBytes: 10}), /passou do teto de 10/);

  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(100)); },
    cancel() { cancelled = true; },
  });
  reply = new Response(body);
  await assert.rejects(() => updater.defaultFetchBuffer('https://exemplo.test/bin', {maxBytes: 10}), /passou do teto de 10/);
  assert.equal(cancelled, true, 'o stream é cancelado ao passar do teto');
});

test('instalação sem o .pub usa a chave embutida, igual à commitada', () => {
  const committed = fs.readFileSync(path.join(DESK, 'update-signing-key.pub'), 'utf8');
  assert.equal(signature.EMBEDDED_UPDATE_PUBLIC_KEY.trim(), committed.trim(), 'trocar a chave pede trocar as duas cópias');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-key-'));
  try {
    const missing = signature.readUpdatePublicKey(path.join(dir, 'update-signing-key.pub'));
    assert.equal(missing, signature.EMBEDDED_UPDATE_PUBLIC_KEY);
    assert.equal(signature.isPlaceholderKey(missing), false);
    assert.equal(crypto.createPublicKey(missing).asymmetricKeyType, 'ed25519');
    /* A embutida só cobre o arquivo que falta: marcador e erro de leitura seguem recusando. */
    const placeholder = path.join(dir, 'marcador.pub');
    fs.writeFileSync(placeholder, 'PLACEHOLDER');
    assert.equal(signature.isPlaceholderKey(signature.readUpdatePublicKey(placeholder)), true);
    assert.equal(signature.readUpdatePublicKey(dir), '');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
