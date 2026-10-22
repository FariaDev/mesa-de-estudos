import {ptMatches} from './pt-text.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, write, read, cleanup} from './study-backup-fixtures.mjs';

/* Destino Git do backup: repositórios git LOCAIS de verdade (sem rede, sem
   mock de git), política de commit/push, recuperação e o ciclo completo com a
   restauração byte a byte. Se o binário `git` não existir, os testes que
   dependem dele são pulados — o módulo continua carregando e o app avisa. */

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const gitBackup = require('../src/study-data/git-backup.cjs');

const gitInfo = gitBackup.gitAvailable();
const maybe = gitInfo.available ? test : test.skip;

function gitCmd(args, cwd) {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

/* O repositório do backup é `--bare` com `core.worktree`: para inspecionar a
   árvore a partir do destino, o comando grita o git-dir explicitamente. */
function gitTree(args, dest) {
  return gitCmd(['--git-dir', path.join(dest, gitBackup.GIT_DIR), ...args], dest);
}

function bareRemote(tag = 'mesa-remote') {
  const dir = tempDir(tag);
  gitCmd(['init', '-q', '--bare', dir], dir);
  return dir;
}

async function snapshotWith(backupRoot, fixture, extra = {}) {
  return backup.backupNow({
    runtime: fixture.runtime,
    root: backupRoot,
    materials: extra.materials === false ? [] : [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}],
    reason: extra.reason || 'manual',
    log: () => {},
  });
}

test('git: disponibilidade e URL com credencial são tratados sem gravar segredo', () => {
  const info = gitBackup.gitAvailable();
  assert.equal(typeof info.available, 'boolean');
  const clean = gitBackup.sanitizeRemote('https://usuario:token-secreto@github.com/faria/mesa-backup.git');
  assert.equal(clean.url, 'https://github.com/faria/mesa-backup.git');
  assert.equal(clean.insecure, true);
  assert.ok(!clean.url.includes('token-secreto'));
  assert.deepEqual(gitBackup.sanitizeRemote('git@github.com:faria/mesa-backup.git'), {url: 'git@github.com:faria/mesa-backup.git', insecure: false, reason: ''});
  assert.deepEqual(gitBackup.sanitizeRemote(''), {url: '', insecure: false, reason: ''});
});

maybe('git: commit de snapshot válido, ledger e push para um remoto local', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  const remote = bareRemote();
  try {
    const first = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, deskDir: path.resolve(import.meta.dirname, '..'), backupRoot: path.join(dest, 'snapshots')});
    const committed = integrateAndPush(git, {snapshotDir: first.path, manifest: backup.readManifest(first.path), remote});
    assert.equal(committed.committed, true);
    assert.equal(committed.pushed, true);
    assert.equal(committed.remote, remote);

    /* A árvore do git tem os arquivos do snapshot e NÃO tem o repositório do
       backup nem o ledger. */
    const tracked = gitTree(['ls-files'], dest).split('\n').filter(Boolean);
    assert.ok(tracked.includes('review.json'));
    assert.ok(tracked.includes('pending.json'));
    assert.ok(tracked.includes('pi-1700000000000.jsonl'));
    assert.ok(tracked.includes('learning/Courses/Algebra Linear/_state.md'));
    assert.ok(!tracked.some((item) => item.startsWith('.mesa-git')), 'repositório do backup fora do commit');
    assert.ok(!tracked.some((item) => item.startsWith('snapshots/')), 'versões em si fora do commit');
    assert.ok(!tracked.includes('ledger.json'));

    /* A árvore do git espelha o manifesto do snapshot, byte a byte. */
    const snapshotManifest = backup.readManifest(first.path);
    for (const entry of snapshotManifest.entries) {
      if (entry.stored === false) continue;
      const inTree = path.join(dest, ...entry.path.split('/'));
      const inSnapshot = path.join(first.path, 'data', ...entry.path.split('/'));
      assert.equal(fs.readFileSync(inTree).equals(fs.readFileSync(inSnapshot)), true, entry.path);
    }
    assert.ok(tracked.includes('courses/Algebra Linear/aula.pdf'));

    /* O remoto recebeu o commit. */
    const remoteHead = gitCmd(['--git-dir', remote, 'rev-parse', 'HEAD'], remote);
    assert.equal(remoteHead, committed.commit);

    /* Segundo snapshot: commit novo, sem force, com o histórico preservado. */
    write(fixture.runtime, 'review.json', '{"mat-1":["mudou"]}');
    const second = await snapshotWith(dest, fixture);
    const secondCommit = integrateAndPush(git, {snapshotDir: second.path, manifest: backup.readManifest(second.path), remote});
    assert.equal(secondCommit.committed, true);
    assert.equal(secondCommit.previous, committed.commit);
    const log = gitCmd(['log', '--oneline', '--all'], remote);
    assert.equal(log.split('\n').length, 2);

    /* Status reflete o que o app mostra. */
    const status = git.status();
    assert.equal(status.available, true);
    assert.equal(status.head, secondCommit.commit);
    assert.equal(status.commits, 2);
    assert.equal(status.push.ok, true);
    assert.ok(status.tracked >= 4);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, remote);
  }
});

maybe('git: falha de push mantém o commit local e grava o motivo no ledger', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  const remote = bareRemote();
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    git.ensureRoot();
    const first = git.commitSnapshot({snapshotDir: snapshot.path, manifest: backup.readManifest(snapshot.path)});
    assert.equal(first.pushed, false);
    assert.equal(first.reason, 'sem remoto');

    /* Remoto inexistente: erro de rede/host, commit local continua. */
    const failed = git.push({remote: path.join(dest, 'nao-existe.git'), branch: 'main'});
    assert.equal(failed.pushed, false);
    assert.ok(failed.error, 'erro registrado');
    const ledger = git.readLedger();
    assert.equal(ledger.push.ok, false);
    assert.ok(ledger.push.error.length > 0);
    assert.equal(git.status().head, first.commit, 'HEAD local intacto');

    /* Remoto de verdade depois: mesmo commit sobe, sem force. */
    const retry = git.push({remote, branch: 'main'});
    assert.equal(retry.pushed, true);
    assert.equal(gitCmd(['--git-dir', remote, 'rev-parse', 'HEAD'], remote), first.commit);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, remote);
  }
});

maybe('git: push rejeitado (non-fast-forward) não força nem faz merge', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  const remote = bareRemote();
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    const committed = integrateAndPush(git, {snapshotDir: snapshot.path, manifest: backup.readManifest(snapshot.path), remote});
    assert.equal(committed.pushed, true);

    /* Outro clone empurra um commit à frente no mesmo remoto. */
    const other = tempDir('mesa-git-outro');
    gitCmd(['clone', '-q', remote, other], other);
    write(other, 'outro.txt', 'commit de outra máquina');
    gitCmd(['-c', 'user.name=Outro', '-c', 'user.email=o@o', 'add', '-A'], other);
    gitCmd(['-c', 'user.name=Outro', '-c', 'user.email=o@o', 'commit', '-q', '-m', 'outro'], other);
    gitCmd(['push', '-q', 'origin', 'HEAD:refs/heads/main'], other);

    write(fixture.runtime, 'review.json', '{"mat-1":["divergiu"]}');
    const second = await snapshotWith(dest, fixture);
    const rejected = integrateAndPush(git, {snapshotDir: second.path, manifest: backup.readManifest(second.path), remote});
    assert.equal(rejected.committed, true, 'commit local acontece mesmo com push rejeitado');
    assert.equal(rejected.pushed, false);
    assert.ok(/reject|non-fast-forward|fetch first|hint/i.test(rejected.error), rejected.error);
    /* O remoto NÃO ganhou o commit local: nada de force. */
    assert.notEqual(gitCmd(['--git-dir', remote, 'rev-parse', 'HEAD'], remote), rejected.commit);
    assert.equal(git.status().head, rejected.commit, 'a versão local continua sendo a boa');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, remote);
  }
});

maybe('git: destino dentro do repositório do app é recusado', () => {
  const git = gitBackup.api({root: path.join(path.resolve(import.meta.dirname, '..'), 'tmp-backup-proibido'), deskDir: path.resolve(import.meta.dirname, '..'), repoRoot: path.resolve(import.meta.dirname, '..', '..')});
  assert.throws(() => git.ensureRoot(), ptMatches(/repositório do aplicativo/));
});

maybe('git: operação interrompida e árvore suja são recuperadas para o último commit', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    const committed = integrateAndPush(git, {snapshotDir: snapshot.path, manifest: backup.readManifest(snapshot.path)});
    /* Simula queda: estado em `mesas/` sem `finished` e arquivo modificado. */
    const stateDir = path.join(dest, 'mesas', 'snap-interrompido');
    fs.mkdirSync(stateDir, {recursive: true});
    fs.writeFileSync(path.join(stateDir, 'journal.json'), JSON.stringify({treeId: 'snap-interrompido', finished: false}));
    fs.writeFileSync(path.join(dest, 'review.json'), '{"sujo":true}');
    fs.writeFileSync(path.join(dest, 'arquivo-novo.txt'), 'novo');

    const report = git.recover();
    assert.equal(report.reset, true);
    assert.ok(report.cleaned.includes('snap-interrompido'));
    assert.equal(report.head, committed.commit);
    assert.equal(fs.existsSync(stateDir), false);
    const review = JSON.parse(fs.readFileSync(path.join(dest, 'review.json'), 'utf8'));
    assert.deepEqual(review, JSON.parse(fs.readFileSync(path.join(snapshot.path, 'data', 'review.json'), 'utf8')));
    assert.equal(fs.existsSync(path.join(dest, 'arquivo-novo.txt')), false, 'untracked de operação morta sai');
    assert.equal(gitTree(['status', '--porcelain'], dest), '');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('git: runner tem prazo e teto de saída (não trava o main)', () => {
  const slowDir = tempDir('mesa-git-slow');
  fs.writeFileSync(path.join(slowDir, 'git'), '#!/bin/sh\nsleep 5\n');
  fs.chmodSync(path.join(slowDir, 'git'), 0o755);
  const slow = gitBackup.defaultRunner({args: ['--version'], cwd: slowDir, env: {PATH: `${slowDir}:${process.env.PATH}`}, timeoutMs: 200});
  assert.notEqual(slow.code, 0);
  assert.equal(slow.timedOut, true);
  assert.match(slow.stderr, /demorou demais/);

  const loudDir = tempDir('mesa-git-loud');
  fs.writeFileSync(path.join(loudDir, 'git'), "#!/bin/sh\nprintf '%200000s' '' | tr ' ' a\n");
  fs.chmodSync(path.join(loudDir, 'git'), 0o755);
  const loud = gitBackup.defaultRunner({args: ['--version'], cwd: loudDir, env: {PATH: `${loudDir}:${process.env.PATH}`}, maxBuffer: 4096});
  assert.notEqual(loud.code, 0);
  assert.equal(loud.overflow, true);
  assert.match(loud.stderr, /limite de 4096 bytes/);

  cleanup(slowDir, loudDir);
});

maybe('git: pasta com arquivos do usuário não vira destino (o commit apagaria)', () => {
  const dir = tempDir('mesa-git-cheia');
  try {
    fs.writeFileSync(path.join(dir, 'documento.txt'), 'importante');
    const git = gitBackup.api({root: dir});
    assert.throws(() => git.ensureRoot(), ptMatches(/não está vazia/));
    assert.equal(fs.readFileSync(path.join(dir, 'documento.txt'), 'utf8'), 'importante');
  } finally {
    cleanup(dir);
  }
});

maybe('git: runtime e arranjo das versões são conferidos no ensureRoot', () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  const links = tempDir('mesa-git-links');
  try {
    /* Destino dentro do runtime (symlink incluso) é recusado. */
    const inside = gitBackup.api({root: path.join(fixture.runtime, 'git-x'), runtime: fixture.runtime});
    assert.throws(() => inside.ensureRoot(), ptMatches(/runtime/));
    fs.symlinkSync(fixture.runtime, path.join(links, 'rt'));
    const viaLink = gitBackup.api({root: path.join(links, 'rt', 'git-x'), runtime: path.join(links, 'rt')});
    assert.throws(() => viaLink.ensureRoot(), ptMatches(/runtime/));

    /* Versões precisam ser filha DIRETA do destino git; mais fundo, o commit
       apagaria a pasta. */
    const nested = gitBackup.api({root: dest, backupRoot: path.join(dest, 'a', 'snapshots')});
    assert.throws(() => nested.ensureRoot(), ptMatches(/filha direta/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, links);
  }
});

maybe('git: recuperação em repositório sem commit limpa sem lançar', () => {
  const dest = tempDir('mesa-git-novo');
  try {
    const git = gitBackup.api({root: dest});
    git.ensureRoot();
    fs.writeFileSync(path.join(dest, 'sujo.txt'), 'untracked');
    const report = git.recover();
    assert.equal(report.reset, false);
    assert.equal(fs.existsSync(path.join(dest, 'sujo.txt')), false);
  } finally {
    cleanup(dest);
  }
});

maybe('git: bundle cria um arquivo portátil do repositório', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    integrateAndPush(git, {snapshotDir: snapshot.path, manifest: backup.readManifest(snapshot.path)});
    const out = path.join(tempDir('mesa-bundle'), 'backup.bundle');
    const file = git.bundle({out});
    assert.equal(fs.existsSync(file), true);
    assert.ok(fs.statSync(file).size > 100);
    /* O bundle abre num repositório novo — prova de que é um backup portátil. */
    const cloneTarget = tempDir('mesa-clone');
    gitCmd(['clone', '-q', file, cloneTarget], path.dirname(file));
    assert.equal(fs.existsSync(path.join(cloneTarget, 'review.json')), true);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

maybe('git: ciclo completo — snapshot, commit, restauração byte a byte e rollback', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  const remote = bareRemote();
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const manifest = backup.readManifest(snapshot.path);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    const committed = integrateAndPush(git, {snapshotDir: snapshot.path, manifest, remote});
    assert.equal(committed.pushed, true);

    /* Muda o runtime e restaura. */
    write(fixture.runtime, 'review.json', '{"mat-1":["outro"]}');
    write(fixture.runtime, 'learning/Courses/Algebra Linear/_state.md', '# outro\n');
    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(applied.applied, true);
    assert.equal(applied.written, plan.entries);
    /* Byte a byte contra o commit do git (árvore de verdade, não cópia). */
    for (const entry of manifest.entries) {
      if (entry.stored === false) continue;
      const target = path.join(fixture.runtime, ...entry.path.split('/'));
      if (!fs.existsSync(target)) continue;
      assert.equal(backup.hashBuffer(fs.readFileSync(target)), entry.sha256, entry.path);
    }
    const rollback = backup.rollbackRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(rollback.ok, true);
    assert.equal(read(fixture.runtime, 'review.json'), '{"mat-1":["outro"]}');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, remote);
  }
});

function integrateAndPush(git, payload) {
  const local = git.integrate(payload);
  return payload.remote ? {...local, ...git.push({remote: payload.remote})} : local;
}
