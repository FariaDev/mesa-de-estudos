import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {auditUpdatedInstall, previousReleaseTag, rehearseUpdate} from '../scripts/update-rehearsal.mjs';

const DESK = path.resolve(import.meta.dirname, '..');
const KEY = 'CHAVE PUBLICA\n';
const windows = process.platform === 'win32';

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ensaio-teste-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}

function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
    fs.writeFileSync(path.join(root, rel), content);
  }
}

test('versão anterior é a maior tag abaixo da candidata', () => {
  const tags = ['v1.0.2', 'v1.0.10', 'v1.1.0', 'v2.0.0', 'nota', 'arquivo-pastas-avulsas', ''];
  assert.equal(previousReleaseTag(tags, '1.1.0'), 'v1.0.10');
  assert.equal(previousReleaseTag(tags, '1.0.2'), '');
  assert.throws(() => previousReleaseTag(tags, 'abc'), /versão inválida/);
});

function auditFixture(t, overrides = {}) {
  const installDir = tempDir(t);
  const candidateDir = tempDir(t);
  const files = {'desk/package.json': '{"version":"1.1.0"}', 'desk/main.cjs': 'main'};
  writeTree(candidateDir, {...files, 'desk/types/a.d.ts': 'x', 'desk/.gitignore': 'x', 'desk/update-signing-key.pub': KEY});
  writeTree(installDir, {...files, 'desk/config.json': '{"ensaio":true}\n', 'desk/.runtime/ensaio.json': '{"ensaio":true}\n'});
  const input = {
    installDir, candidateDir, version: '1.1.0', installedKey: KEY, expectedKey: KEY,
    candidateFiles: ['desk/package.json', 'desk/main.cjs', 'desk/types/a.d.ts', 'desk/.gitignore', 'desk/update-signing-key.pub', 'README.md'],
  };
  return {...input, ...overrides};
}

test('auditoria aceita instalação certa, sem exigir o que o app não carrega', (t) => {
  assert.deepEqual(auditUpdatedInstall(auditFixture(t)), []);
});

test('auditoria acusa instalação sem chave, porque a atualização seguinte seria recusada', (t) => {
  const problems = auditUpdatedInstall(auditFixture(t, {installedKey: ''}));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /chave de atualização \(nenhuma\)/);
  assert.match(auditUpdatedInstall(auditFixture(t, {installedKey: 'OUTRA'}))[0], /diferente da commitada/);
});

test('auditoria acusa arquivo ausente, arquivo diferente, versão errada e dado do usuário alterado', (t) => {
  const input = auditFixture(t);
  fs.rmSync(path.join(input.installDir, 'desk', 'main.cjs'));
  assert.match(auditUpdatedInstall(input)[0], /ausente ou diferente: desk\/main\.cjs/);
  fs.writeFileSync(path.join(input.installDir, 'desk', 'main.cjs'), 'antigo');
  assert.match(auditUpdatedInstall(input)[0], /ausente ou diferente: desk\/main\.cjs/);
  fs.writeFileSync(path.join(input.installDir, 'desk', 'main.cjs'), 'main');
  assert.match(auditUpdatedInstall({...input, version: '1.1.1'}).join(), /versão instalada 1\.1\.0; esperado 1\.1\.1/);
  fs.rmSync(path.join(input.installDir, 'desk', 'config.json'));
  assert.match(auditUpdatedInstall(input)[0], /dado do usuário alterado: desk\/config\.json/);
});

/* Fake do updater publicado: como o da 1.0.2, não copia `.pub`. */
function fakePreviousUpdater() {
  const realFiles = JSON.stringify(path.join(DESK, 'updater-files.cjs'));
  return `const fs=require('node:fs');const path=require('node:path');
const {readZip,stripCommonRoot}=require(${realFiles});
module.exports={
 readManifest:()=>null,writeManifest:()=>{},removeOrphans:()=>{},
 applyZip(buffer,{rootDir}){
  for(const entry of stripCommonRoot(readZip(buffer))){
   if(entry.name.endsWith('/')||entry.name.endsWith('.pub'))continue;
   const file=path.join(rootDir,entry.name);
   fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,entry.data);
  }
 },
};`;
}

const signatureModule = (embedded) => `const fs=require('node:fs');
module.exports={readUpdatePublicKey(file){try{return fs.readFileSync(file,'utf8');}catch{return ${JSON.stringify(embedded)};}}};\n`;

function commitAll(root, message) {
  const git = (...args) => execFileSync('git', ['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', ...args], {cwd: root, stdio: 'ignore'});
  git('add', '-A');
  git('commit', '-m', message);
  git('tag', message);
}

function releaseRepo(t, {publicKey = KEY, embedded = ''} = {}) {
  const root = tempDir(t);
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  writeTree(root, {
    'desk/package.json': '{"name":"mesa","version":"0.1.0"}\n',
    'desk/updater.cjs': fakePreviousUpdater(),
    'desk/updater-signature.cjs': signatureModule(''),
  });
  commitAll(root, 'v0.1.0');
  writeTree(root, {
    'desk/package.json': '{"name":"mesa","version":"0.2.0"}\n',
    'desk/update-signing-key.pub': publicKey,
    'desk/updater-signature.cjs': signatureModule(embedded),
  });
  commitAll(root, 'v0.2.0');
  return root;
}

test('ensaio de ponta a ponta recusa o updater antigo que deixa a instalação sem chave', {skip: windows}, async (t) => {
  const {fromTag, problems} = await rehearseUpdate({repoRoot: releaseRepo(t), version: '0.2.0'});
  assert.equal(fromTag, 'v0.1.0');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /chave de atualização \(nenhuma\)/);
});

test('ensaio de ponta a ponta passa quando o código leva a cópia da chave', {skip: windows}, async (t) => {
  const {problems} = await rehearseUpdate({repoRoot: releaseRepo(t, {embedded: KEY}), version: '0.2.0'});
  assert.deepEqual(problems, []);
});

test('sign recusa assinar quando o ensaio falha e não deixa assets', {skip: windows}, (t) => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({type: 'spki', format: 'pem'});
  const keyDir = tempDir(t);
  const privateFile = path.join(keyDir, 'chave.pem');
  fs.writeFileSync(privateFile, privateKey.export({type: 'pkcs8', format: 'pem'}));
  const out = path.join(keyDir, 'assets');
  const run = (root) => spawnSync(process.execPath, [path.join(DESK, 'scripts', 'update-release.mjs'), 'sign', 'v0.2.0', '--private-key', privateFile, '--out', out], {cwd: root, encoding: 'utf8'});
  const refused = run(releaseRepo(t, {publicKey: publicPem}));
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /ensaio v0\.1\.0 → 0\.2\.0 falhou/);
  assert.equal(fs.existsSync(out), false);
  const signed = run(releaseRepo(t, {publicKey: publicPem, embedded: publicPem}));
  assert.equal(signed.status, 0, signed.stderr);
  assert.equal(fs.existsSync(path.join(out, 'mesa-manifest-v0.2.0.sig')), true);
});

test('clone raso é recusado, porque esconderia a versão anterior', {skip: windows}, async (t) => {
  const origin = releaseRepo(t, {embedded: KEY});
  const shallow = path.join(tempDir(t), 'raso');
  execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 'v0.2.0', `file://${origin}`, shallow]);
  await assert.rejects(() => rehearseUpdate({repoRoot: shallow, version: '0.2.0'}), /clone raso/);
});
