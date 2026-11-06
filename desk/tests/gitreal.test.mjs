import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {makeSignedRelease} from './fake-update-release.mjs';
import {tempDir} from './temp-dir.mjs';

/* D1 — git DE VERDADE (remoto bare temporário, sem rede): portão de clone
   limpo, `--ff-only` que recusa e a conferência da versão anunciada (A3).
   Os comandos git/npm rodam de verdade; só o reabrir é falso. */
const require = createRequire(import.meta.url);
const updater = require('../updater.cjs');

const tmp = () => tempDir('mesa-gitreal-test');
const write = (file, text) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const git = (args, cwd) => execFileSync('git', args, {cwd, encoding: 'utf8'});

/* Repo de "origin" (bare) + clone de trabalho com a versão 0.4.0 commitada. */
function realRepo() {
  const remote = path.join(tmp(), 'remoto.git');
  const origin = path.join(tmp(), 'origem');
  fs.mkdirSync(origin, {recursive: true});
  git(['init', '--bare', remote], origin);
  const work = path.join(tmp(), 'clone');
  git(['clone', remote, work], path.dirname(work));
  write(path.join(work, 'desk', 'package.json'), '{"version":"0.4.0"}');
  write(path.join(work, 'desk', 'package-lock.json'), '{"lock":"antigo"}');
  write(path.join(work, 'desk', 'main.cjs'), 'main antigo');
  write(path.join(work, 'core', 'view.bend'), 'core antigo');
  git(['add', '-A'], work);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'v0.4.0'], work);
  git(['push', 'origin', 'HEAD'], work);
  return {remote, work};
}

/* Segunda versão (0.4.1) empurrada por outro clone (o fluxo real de release).
   O lock NÃO muda aqui: um lock falso faria o `npm ci` real falhar — o caminho
   "lock mudou → npm ci" já é coberto pelos testes fakes (updateflow). */
function pushNext(remote, tags = ['v0.4.1']) {
  const other = path.join(tmp(), 'outro-' + Math.random().toString(36).slice(2));
  git(['clone', remote, other], path.dirname(other));
  write(path.join(other, 'desk', 'package.json'), '{"version":"0.4.1"}');
  write(path.join(other, 'desk', 'main.cjs'), 'main novo');
  write(path.join(other, 'desk', 'src', 'novo.mjs'), 'novo');
  git(['add', '-A'], other);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'v0.4.1'], other);
  git(['push', 'origin', 'HEAD'], other);
  for (const tag of tags) {
    git(['tag', tag], other);
    git(['push', 'origin', tag], other);
  }
  return {other, commit: git(['rev-parse', 'HEAD'], other).trim()};
}

/* Manifesto assinado com a chave de teste para a tag real do clone (a tag é
   buscada pelo próprio updater; o commit vem do remoto). */
function signedFor(commit, version = '0.4.1') {
  return makeSignedRelease({version, commit, zip: Buffer.from('zip')});
}

test('D1: update real com git — pull ff, versão CONFERIDA, sem npm ci sem lock novo', async () => {
  const {remote, work} = realRepo();
  const {commit} = pushNext(remote);
  const release = signedFor(commit);
  const runtime = tmp();
  const reopens = [];
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: work, deskDir: path.join(work, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    reopen: () => reopens.push('r'), waitPid: 0,
  });
  assert.equal(result.ok, true, 'pull --ff-only de verdade aplica');
  assert.equal(result.diverged, false, 'a versão anunciada é a instalada');
  assert.equal(result.version, '0.4.1', 'a versão devolvida é a CONFERIDA no package.json');
  assert.equal(read(path.join(work, 'desk', 'main.cjs')), 'main novo');
  assert.equal(read(path.join(work, 'desk', 'src', 'novo.mjs')), 'novo', 'arquivo novo do pull está no lugar');
  assert.equal(fs.existsSync(path.join(work, '.update-manifest.json')), false, 'modo git não grava manifesto de zip (o git gerencia)');
  assert.equal(read(path.join(work, 'desk', 'package-lock.json')), '{"lock":"antigo"}', 'lock igual → sem npm ci');
  assert.equal(reopens.length, 1);
  assert.match(read(path.join(runtime, 'desk.log')), /git merge --ff-only v0\.4\.1 ok \(commit da Release\)/);
  assert.match(read(path.join(runtime, 'desk.log')), /v0\.4\.1 no lugar \(conferida no package\.json\)/);
});

/* #80: o main andou depois da tag (o normal entre releases). O update vai
   até o commit ASSINADO da tag, não até a ponta da branch; antes, o `git pull`
   deixava o HEAD fora do manifesto e toda atualização por git era recusada. */
test('#80: main à frente da tag → o clone para no commit assinado da tag', async () => {
  const {remote, work} = realRepo();
  const {other, commit} = pushNext(remote);
  write(path.join(other, 'desk', 'main.cjs'), 'main depois da tag');
  git(['add', '-A'], other);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'depois da tag'], other);
  git(['push', 'origin', 'HEAD'], other);
  const release = signedFor(commit);
  const runtime = tmp();
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: work, deskDir: path.join(work, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(git(['rev-parse', 'HEAD'], work).trim(), commit, 'HEAD é o commit da tag');
  assert.equal(read(path.join(work, 'desk', 'main.cjs')), 'main novo', 'o commit não assinado não entrou');
});

test('D1: clone com trabalho local (manifesto sujo, como o setup antigo fazia) é recusado SEM destruir nada', async () => {
  const {remote, work} = realRepo();
  const {commit} = pushNext(remote);
  const release = signedFor(commit);
  /* Trabalho local no manifesto versionado — o estado que o setup antigo
     deixava (npm install do Pi dentro do desk). */
  write(path.join(work, 'desk', 'package.json'), '{"version":"0.4.0","nota":"edição local"}');
  write(path.join(work, 'desk', 'package-lock.json'), '{"lock":"antigo","sujo":true}');
  const runtime = tmp();
  const reopens = [];
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: work, deskDir: path.join(work, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    reopen: () => reopens.push('r'), waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /trabalho local/);
  assert.deepEqual(reopens, ['r'], 'a versão antiga reabre mesmo com a atualização recusada');
  assert.equal(read(path.join(work, 'desk', 'package.json')), '{"version":"0.4.0","nota":"edição local"}', 'a edição local sobrevive (nada foi resetado)');
  assert.equal(read(path.join(work, 'desk', 'package-lock.json')), '{"lock":"antigo","sujo":true}');
  assert.equal(read(path.join(work, 'desk', 'main.cjs')), 'main antigo');
  const log = read(path.join(runtime, 'desk.log'));
  assert.match(log, /atualização abortada para não destruir mudanças/);
});

test('D1: remoto divergiu (não é ff) → pull recusa, rollback volta a versão antiga de verdade', async () => {
  const {remote, work} = realRepo();
  const {commit} = pushNext(remote);
  const release = signedFor(commit);
  /* Histórico paralelo no remoto: o pull --ff-only NÃO pode avançar. */
  const other = path.join(tmp(), 'paralelo');
  git(['clone', remote, other], path.dirname(other));
  write(path.join(other, 'core', 'view.bend'), 'core paralelo');
  git(['add', '-A'], other);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'paralelo'], other);
  git(['push', 'origin', 'HEAD'], other);
  /* E o clone local anda para o lado oposto (o push dele é da história antiga). */
  write(path.join(work, 'desk', 'main.cjs'), 'main local (commitado)');
  git(['add', '-A'], work);
  git(['-c', 'user.email=teste@mesa', '-c', 'user.name=Teste', 'commit', '-m', 'local'], work);
  const runtime = tmp();
  const reopens = [];
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: work, deskDir: path.join(work, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    reopen: () => reopens.push('r'), waitPid: 0,
  });
  assert.equal(result.ok, false, 'pull não-ff falha');
  assert.match(result.reason, /fast-forward/i, 'a recusa do --ff-only chega como motivo');
  /* O rollback REAL: git reset --hard devolve a cabeça ANTERIOR (o commit
     local do usuário, que é o estado pré-update — nada é destruído). */
  assert.equal(read(path.join(work, 'desk', 'main.cjs')), 'main local (commitado)', 'o rollback volta ao HEAD antigo (com o commit local)');
  assert.equal(read(path.join(work, 'core', 'view.bend')), 'core antigo');
  assert.equal(read(path.join(work, 'desk', 'package.json')), '{"version":"0.4.0"}');
  assert.deepEqual(reopens, ['r'], 'a versão antiga reabre depois do rollback');
  assert.match(read(path.join(runtime, 'desk.log')), /FALHOU/);
  assert.match(read(path.join(runtime, 'desk.log')), /rollback aplicado/);
});

/* A3/C5: --versao no modo git não seleciona versão — o pull segue a branch e a
   divergência (instalada ≠ anunciada) é AVISO explícito, nunca "sucesso" da
   tag. */
test('D1/A3: versão anunciada divergente no modo git vira aviso, não sucesso da tag', async () => {
  const {remote, work} = realRepo();
  const {commit} = pushNext(remote, ['v0.4.1', 'v9.9.9']);
  const release = signedFor(commit, '9.9.9');
  const runtime = tmp();
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: work, deskDir: path.join(work, 'desk'), runtime,
    announcedVersion: '9.9.9', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, true, 'o pull em si funcionou');
  assert.equal(result.diverged, true, 'a divergência é declarada');
  assert.equal(result.version, '0.4.1', 'a versão instalada é a do clone, não a anunciada');
  assert.equal(result.announced, '9.9.9');
  const log = read(path.join(runtime, 'desk.log'));
  assert.match(log, /a versão instalada é v0\.4\.1, não a v9\.9\.9 anunciada/);
  assert.match(log, /divergente da v9\.9\.9 anunciada/);
  assert.ok(!/v9\.9\.9 no lugar/.test(log), 'nunca registra "v9.9.9 no lugar" sem conferir');
});

/* A2/D1: o setup do Pi local NÃO suja os manifestos versionados (é o estado
   que deixava o `npm install` do Pi sujar e o `git pull --ff-only` recusar).
   Sem npm de verdade aqui (rede): o contrato é o walk-up do npm — a pasta do
   Pi tem package.json PRÓPRIO, então o npm daí não acha o do desk. */
