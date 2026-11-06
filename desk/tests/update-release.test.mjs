import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';

/* Script de release assinada (#80) rodando de verdade: git local temporário,
   par Ed25519 gerado no teste e nenhuma rede. Cobre keygen, sign, verify e a
   recusa enquanto a chave pública é o marcador. */
const require = createRequire(import.meta.url);
const signature = require('../updater-signature.cjs');
const updater = require('../updater.cjs');

const DESK = path.resolve(import.meta.dirname, '..');
const SCRIPT = path.join(DESK, 'scripts', 'update-release.mjs');
const tmp = () => tempDir('mesa-release-test');

function write(file, text) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text);
}

function git(args, cwd) {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

function repoFixture() {
  const root = tmp();
  write(path.join(root, 'desk', 'update-signing-key.pub'), 'PLACEHOLDER — chave ainda não configurada\n');
  write(path.join(root, 'desk', 'package.json'), '{"name":"mesa","version":"0.1.0"}\n');
  write(path.join(root, 'desk', 'main.cjs'), 'main\n');
  git(['init'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'add', '-A'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'v0.1.0'], root);
  git(['tag', 'v0.1.0'], root);
  return root;
}

function runScript(args, {cwd, expectFail = false} = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {cwd, encoding: 'utf8'});
  if (!expectFail) assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  else assert.notEqual(result.status, 0, 'o script tinha de recusar');
  return result;
}

test('#80 keygen: grava a privada fora do repositório e a pública no lugar do marcador', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  const result = runScript(['keygen', '--private-key', privateFile], {cwd: root});
  assert.equal(fs.existsSync(privateFile), true);
  // Windows não tem modo POSIX: o Node sempre devolve 0o666 lá.
  if (process.platform !== 'win32') assert.equal(fs.statSync(privateFile).mode & 0o777, 0o600, 'a privada nasce com permissão 600');
  assert.ok(!result.stdout.includes('PRIVATE KEY'), 'a chave privada nunca é impressa');
  const publicKey = fs.readFileSync(path.join(root, 'desk', 'update-signing-key.pub'), 'utf8');
  assert.equal(signature.isPlaceholderKey(publicKey), false, 'a pública deixou de ser o marcador');
  assert.match(publicKey, /BEGIN PUBLIC KEY/);
});

test('#80 keygen: recusa chave privada dentro do repositório e não sobrescreve', () => {
  const root = repoFixture();
  const dentro = runScript(['keygen', '--private-key', path.join(root, 'chave.pem')], {cwd: root, expectFail: true});
  assert.match(dentro.stderr, /não pode ficar dentro do repositório/);
  const fora = path.join(tmp(), 'chave.pem');
  runScript(['keygen', '--private-key', fora], {cwd: root});
  const denovo = runScript(['keygen', '--private-key', path.join(tmp(), 'outra.pem')], {cwd: root, expectFail: true});
  assert.match(denovo.stderr, /já existe uma chave pública configurada/);
});

test('#80 keygen: recusa a privada dentro do repositório mesmo por link simbólico', (t) => {
  const root = repoFixture();
  const alias = path.join(tmp(), 'atalho');
  try {
    fs.symlinkSync(root, alias, 'junction');
  } catch (error) {
    t.skip(`sem permissão para criar link simbólico: ${error.code}`);
    return;
  }
  const result = runScript(['keygen', '--private-key', path.join(alias, 'chave.pem')], {cwd: root, expectFail: true});
  assert.match(result.stderr, /não pode ficar dentro do repositório/);
  assert.equal(fs.existsSync(path.join(root, 'chave.pem')), false, 'nada foi gravado dentro do repositório');
});

test('#80 sign/verify: monta zip com prefixo, manifesto com o commit da tag e assinatura válida', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd: root});
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'add', '-A'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'chave pública'], root);
  git(['tag', '-f', 'v0.1.0'], root);

  const out = path.join(tmp(), 'assets');
  runScript(['sign', 'v0.1.0', '--private-key', privateFile, '--out', out], {cwd: root});
  const manifestFile = path.join(out, 'mesa-manifest-v0.1.0.json');
  const signatureFile = path.join(out, 'mesa-manifest-v0.1.0.sig');
  const zipFile = path.join(out, 'mesa-estudos-0.1.0.zip');
  for (const file of [manifestFile, signatureFile, zipFile]) assert.equal(fs.existsSync(file), true, path.basename(file));

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  assert.deepEqual(Object.keys(manifest).sort(), ['commit', 'version', 'zipBytes', 'zipSha256']);
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.commit, git(['rev-parse', 'v0.1.0^{commit}'], root));
  assert.equal(manifest.zipBytes, fs.statSync(zipFile).size);

  const publicKey = fs.readFileSync(path.join(root, 'desk', 'update-signing-key.pub'), 'utf8');
  const verified = signature.verifySignedManifest({
    manifestBytes: fs.readFileSync(manifestFile),
    signatureBytes: fs.readFileSync(signatureFile),
    publicKey,
    announcedVersion: '0.1.0',
  });
  assert.deepEqual(verified, manifest);
  signature.assertZipMatchesManifest(fs.readFileSync(zipFile), manifest);
  const entries = updater.readZip(fs.readFileSync(zipFile));
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.name.startsWith('mesa-de-estudos-0.1.0/')), 'prefixo que o updater-files.cjs descarta');

  const checked = runScript(['verify', 'v0.1.0', '--dir', out], {cwd: root});
  assert.match(checked.stdout, /release v0\.1\.0 confere/);
});

test('#80 sign: recusa privada que não corresponde à pública commitada', () => {
  const root = repoFixture();
  const privateFile = path.join(tmp(), 'mesa-update.pem');
  runScript(['keygen', '--private-key', privateFile], {cwd: root});
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'add', '-A'], root);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'chave pública'], root);
  const outra = crypto.generateKeyPairSync('ed25519').privateKey.export({type: 'pkcs8', format: 'pem'});
  const outraFile = path.join(tmp(), 'outra.pem');
  fs.writeFileSync(outraFile, outra);
  const result = runScript(['sign', 'v0.1.0', '--private-key', outraFile, '--out', path.join(tmp(), 'assets')], {cwd: root, expectFail: true});
  assert.match(result.stderr, /não corresponde a desk\/update-signing-key\.pub/);
});

test('#80 verify: recusa enquanto a chave pública for o marcador', () => {
  const root = repoFixture();
  const result = runScript(['verify', 'v0.1.0', '--dir', tmp()], {cwd: root, expectFail: true});
  assert.match(result.stderr, /marcador PLACEHOLDER/);
});
