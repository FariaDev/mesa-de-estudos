/* Release assinada do updater (#80): gera o par Ed25519, monta o zip estável
   da tag (`git archive`, prefixo que o updater-files.cjs descarta), assina o
   manifesto {version, commit, zipSha256, zipBytes} e confere os assets antes
   do `gh release upload`. Só o `crypto` do Node — sem dependência nova.

   Uso:
     npm run update:keygen -- --private-key <caminho FORA do repositório>
     npm run update:sign -- vX.Y.Z --private-key <caminho> --out <pasta>
     npm run update:release:verify -- vX.Y.Z --dir <pasta>

   A chave privada nunca é impressa nem entra no repositório; a pública vai
   para `desk/update-signing-key.pub` e é commitada. Enquanto ela for o
   marcador PLACEHOLDER, o app recusa qualquer atualização. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {rehearseBeforeSigning} from './update-rehearsal.mjs';

const require = createRequire(import.meta.url);
const signature = require('../updater-signature.cjs');

/* A raiz vem do git do diretório de onde o script roda (o npm script roda em
   `desk/`): assim o release funciona na cópia pública e os testes rodam o
   script num repositório temporário. */
let REPO_ROOT = '';
let PUBLIC_KEY_FILE = '';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const USAGE = `uso:
  update-release.mjs keygen --private-key <caminho fora do repositório>
  update-release.mjs sign vX.Y.Z --private-key <caminho> --out <pasta>
  update-release.mjs verify vX.Y.Z --dir <pasta>`;

function flag(args, name) {
  const at = args.indexOf(name);
  return at >= 0 ? String(args[at + 1] || '') : '';
}

function fail(message) {
  throw Error(message);
}

function versionOf(raw) {
  try {
    return signature.normalizeVersion(raw);
  } catch {
    fail(`versão inválida: recebido ${JSON.stringify(raw || '')}; esperado vX.Y.Z`);
  }
}

function locateRepo() {
  try {
    REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: process.cwd(), encoding: 'utf8'}).trim();
  } catch {
    fail(`rode o update-release dentro do repositório git da Mesa (script em ${SCRIPT_DIR})`);
  }
  PUBLIC_KEY_FILE = path.join(REPO_ROOT, 'desk', 'update-signing-key.pub');
}

function git(args) {
  return execFileSync('git', args, {cwd: REPO_ROOT, encoding: 'utf8'}).trim();
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/* Caminho real de um arquivo que talvez ainda não exista: resolve o ancestral
   existente mais próximo e junta o resto. No Windows o tmpdir vem com nome
   curto (RUNNER~1) e o git devolve o longo, e um link simbólico para o
   repositório também esconde a raiz; sem isso a privada passava como "fora". */
function canonicalPath(file) {
  const rest = [];
  let current = path.resolve(file);
  while (!fs.existsSync(current) && path.dirname(current) !== current) {
    rest.unshift(path.basename(current));
    current = path.dirname(current);
  }
  const real = path.join(fs.realpathSync.native(current), ...rest);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

/* A privada nunca pode ficar dentro do repositório (nem por engano de caminho
   relativo). Fora inclui outro drive no Windows. */
function assertOutsideRepo(file) {
  const relative = path.relative(canonicalPath(REPO_ROOT), canonicalPath(file));
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    fail('a chave privada não pode ficar dentro do repositório — passe um caminho fora dele');
  }
}

function readConfiguredPublicKey() {
  if (!fs.existsSync(PUBLIC_KEY_FILE)) fail('desk/update-signing-key.pub não existe; rode keygen primeiro');
  const text = fs.readFileSync(PUBLIC_KEY_FILE, 'utf8');
  if (signature.isPlaceholderKey(text)) {
    fail('desk/update-signing-key.pub ainda é o marcador PLACEHOLDER; rode keygen e commite a chave pública antes de assinar');
  }
  return text;
}

function readPrivateKey(rawPath) {
  if (!rawPath) fail('informe --private-key <caminho fora do repositório>');
  const file = path.resolve(rawPath);
  assertOutsideRepo(file);
  if (!fs.existsSync(file)) fail('a chave privada não existe no caminho informado');
  try {
    return crypto.createPrivateKey(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`a chave privada é ilegível (${error.message}); esperado PEM PKCS#8 Ed25519`);
  }
}

function publicPemOf(key) {
  return crypto.createPublicKey(key).export({type: 'spki', format: 'pem'});
}

function keygen(args) {
  const privateFile = path.resolve(flag(args, '--private-key') || '');
  if (!flag(args, '--private-key')) fail('informe --private-key <caminho fora do repositório>');
  assertOutsideRepo(privateFile);
  if (fs.existsSync(privateFile)) fail('a chave privada já existe no caminho informado; não sobrescrevo');
  const current = fs.existsSync(PUBLIC_KEY_FILE) ? fs.readFileSync(PUBLIC_KEY_FILE, 'utf8') : '';
  if (!signature.isPlaceholderKey(current) && !args.includes('--force')) {
    fail('já existe uma chave pública configurada; use --force só para trocar a chave de propósito');
  }
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({type: 'spki', format: 'pem'});
  const privatePem = privateKey.export({type: 'pkcs8', format: 'pem'});
  fs.mkdirSync(path.dirname(privateFile), {recursive: true});
  fs.writeFileSync(privateFile, privatePem, {mode: 0o600, flag: 'wx'});
  fs.writeFileSync(PUBLIC_KEY_FILE, publicPem);
  const fingerprint = crypto.createHash('sha256').update(publicKey.export({type: 'spki', format: 'der'})).digest('hex');
  console.log('chave privada Ed25519 gravada no caminho informado (fora do repositório, modo 0600); guarde o backup.');
  console.log(`chave pública escrita em ${path.relative(REPO_ROOT, PUBLIC_KEY_FILE)} — commite este arquivo.`);
  console.log(`fingerprint SHA-256 (SPKI): ${fingerprint}`);
}

function buildZip(version, outDir) {
  const zipName = `mesa-estudos-${version}.zip`;
  const zipFile = path.join(outDir, zipName);
  fs.rmSync(zipFile, {force: true});
  git(['archive', '--format=zip', `--prefix=mesa-de-estudos-${version}/`, `--output=${zipFile}`, `v${version}`]);
  return {zipName, zipFile, zipBytes: fs.statSync(zipFile).size, zipSha256: sha256File(zipFile)};
}

async function sign(args) {
  const version = versionOf(args[0] || flag(args, '--versao'));
  const configured = readConfiguredPublicKey();
  const privateKey = readPrivateKey(flag(args, '--private-key'));
  if (publicPemOf(privateKey).trim() !== configured.trim()) {
    fail('a chave privada não corresponde a desk/update-signing-key.pub; assine com a chave cuja pública está commitada');
  }
  const outDir = path.resolve(flag(args, '--out') || '');
  if (!flag(args, '--out')) fail('informe --out <pasta dos assets>');
  await rehearseBeforeSigning({repoRoot: REPO_ROOT, version});
  fs.mkdirSync(outDir, {recursive: true});
  const commit = git(['rev-parse', '--verify', `v${version}^{commit}`]);
  const zip = buildZip(version, outDir);
  const manifest = {version, commit, zipSha256: zip.zipSha256, zipBytes: zip.zipBytes};
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const manifestFile = path.join(outDir, `mesa-manifest-v${version}.json`);
  const signatureFile = path.join(outDir, `mesa-manifest-v${version}.sig`);
  fs.writeFileSync(manifestFile, manifestBytes);
  fs.writeFileSync(signatureFile, crypto.sign(null, manifestBytes, privateKey).toString('base64') + '\n');
  console.log(`zip: ${zip.zipName} (${zip.zipBytes} bytes, sha256 ${zip.zipSha256})`);
  console.log(`manifesto: ${path.basename(manifestFile)} (commit ${commit})`);
  console.log(`assinatura: ${path.basename(signatureFile)}`);
  console.log(`publique com: gh release upload v${version} ${JSON.stringify(zip.zipName)} ${JSON.stringify(path.basename(manifestFile))} ${JSON.stringify(path.basename(signatureFile))} --clobber`);
}

function verify(args) {
  const version = versionOf(args[0] || flag(args, '--versao'));
  const dir = path.resolve(flag(args, '--dir') || '.');
  const publicKey = readConfiguredPublicKey();
  const manifestFile = path.join(dir, `mesa-manifest-v${version}.json`);
  const signatureFile = path.join(dir, `mesa-manifest-v${version}.sig`);
  const zipFile = path.join(dir, `mesa-estudos-${version}.zip`);
  for (const file of [manifestFile, signatureFile, zipFile]) {
    if (!fs.existsSync(file)) fail(`asset ausente: ${path.basename(file)} em ${dir}`);
  }
  const manifest = signature.verifySignedManifest({
    manifestBytes: fs.readFileSync(manifestFile),
    signatureBytes: fs.readFileSync(signatureFile),
    publicKey,
    announcedVersion: version,
  });
  signature.assertZipMatchesManifest(fs.readFileSync(zipFile), manifest);
  let tagCommit = '';
  try {
    tagCommit = git(['rev-parse', '--verify', `v${version}^{commit}`]);
  } catch {
    fail(`a tag v${version} não existe no repositório; crie/publica a tag antes de verificar`);
  }
  signature.assertTagCommitMatches(manifest, tagCommit, {tag: `v${version}`});
  console.log(`release v${version} confere: assinatura, zip (${manifest.zipBytes} bytes) e commit ${tagCommit}.`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  locateRepo();
  if (command === 'keygen') return keygen(args);
  if (command === 'sign') return sign(args);
  if (command === 'verify') return verify(args);
  console.error(USAGE);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`update-release: ${error.message}`);
  process.exitCode = 1;
});
