import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, cleanup} from './study-backup-fixtures.mjs';

/* `core.worktree` hostil com chave permitida: a allowlist olha só a chave, e o
   `git add -A` indexava a pasta alheia (o `git clean -fd` do `recover` apagava
   fora do destino). Todo comando com `--git-dir` força a árvore real por
   `--work-tree <dest>` (`-c core.worktree=` perde do arquivo; `--work-tree`
   vence — conferido no shell). Nada de recusar valor diferente: pasta movida é
   legítima. Git de verdade, sem mock. */

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const gitBackup = require('../src/study-data/git-backup.cjs');

const gitInfo = gitBackup.gitAvailable();
const maybe = gitInfo.available ? test : test.skip;

function gitDirCmd(gitDir, args) {
  return execFileSync('git', ['--git-dir', gitDir, ...args], {encoding: 'utf8'}).trim();
}

function poisonWorktree(gitDest, victim) {
  fs.appendFileSync(path.join(gitDest, '.mesa-git', 'config'), `\n[core]\n\tworktree = ${victim}\n\tbare = false\n`);
}

async function snapshotOf(versionsRoot, fixture) {
  return backup.backupNow({runtime: fixture.runtime, root: versionsRoot, materials: [], reason: 'manual', log: () => {}});
}

maybe('commit com worktree hostil só leva o snapshot; segredo fica fora dos objetos', async () => {
  const base = tempDir('mesa-wtredir');
  const fixture = seedRuntime(path.join(base, 'runtime'));
  const versionsRoot = path.join(base, 'versions');
  const gitDest = path.join(base, 'git');
  fs.mkdirSync(gitDest, {recursive: true});
  const victim = path.join(base, 'vitima');
  fs.mkdirSync(victim, {recursive: true});
  try {
    const git = gitBackup.api({root: gitDest, backupRoot: versionsRoot});
    const snap = await snapshotOf(versionsRoot, fixture);
    git.ensureRoot();
    fs.writeFileSync(path.join(victim, 'segredo-de-fora.txt'), 'TOKEN-QUE-NAO-DEVIA-SAIR\n');
    poisonWorktree(gitDest, victim);
    const committed = git.integrate({snapshotDir: snap.path, manifest: backup.readManifest(snap.path)});
    assert.equal(committed.committed, true);
    const tree = gitDirCmd(path.join(gitDest, '.mesa-git'), ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n');
    assert.ok(!tree.includes('segredo-de-fora.txt'), 'arquivo da pasta alheia no commit');
    const secretHash = execFileSync('git', ['hash-object', path.join(victim, 'segredo-de-fora.txt')], {encoding: 'utf8'}).trim();
    const objects = gitDirCmd(path.join(gitDest, '.mesa-git'), ['rev-list', '--objects', '--all']);
    assert.ok(!objects.includes(secretHash), 'blob do segredo nos objetos');
  } finally {
    cleanup(base);
  }
});

maybe('recover com worktree hostil não apaga nada fora do destino', async () => {
  const base = tempDir('mesa-wtclean');
  const fixture = seedRuntime(path.join(base, 'runtime'));
  const versionsRoot = path.join(base, 'versions');
  const gitDest = path.join(base, 'git');
  fs.mkdirSync(gitDest, {recursive: true});
  const victim = path.join(base, 'vitima');
  fs.mkdirSync(victim, {recursive: true});
  try {
    const git = gitBackup.api({root: gitDest, backupRoot: versionsRoot});
    const snap = await snapshotOf(versionsRoot, fixture);
    git.ensureRoot();
    git.integrate({snapshotDir: snap.path, manifest: backup.readManifest(snap.path)});
    fs.writeFileSync(path.join(victim, 'fora.txt'), 'intocado\n');
    fs.writeFileSync(path.join(gitDest, 'rascunho.txt'), 'sujeira local\n');
    poisonWorktree(gitDest, victim);
    const report = git.recover({log: () => {}});
    assert.ok(fs.existsSync(path.join(victim, 'fora.txt')), 'recover apagou fora do destino');
    assert.ok(!fs.existsSync(path.join(gitDest, 'rascunho.txt')), 'sujeira do destino devia sair');
    assert.equal(report.head, gitDirCmd(path.join(gitDest, '.mesa-git'), ['rev-parse', 'HEAD']));
  } finally {
    cleanup(base);
  }
});

maybe('destino movido continua legítimo: comandos seguem a pasta real', async () => {
  const base = tempDir('mesa-wtmove');
  const fixture = seedRuntime(path.join(base, 'runtime'));
  const versionsRoot = path.join(base, 'versions');
  const gitDest = path.join(base, 'git');
  fs.mkdirSync(gitDest, {recursive: true});
  try {
    const git = gitBackup.api({root: gitDest, backupRoot: versionsRoot});
    const snap = await snapshotOf(versionsRoot, fixture);
    git.ensureRoot();
    git.integrate({snapshotDir: snap.path, manifest: backup.readManifest(snap.path)});
    const moved = path.join(base, 'git-movido');
    fs.renameSync(gitDest, moved);
    const reopened = gitBackup.api({root: moved, backupRoot: versionsRoot});
    const snap2 = await snapshotOf(versionsRoot, fixture);
    const second = reopened.integrate({snapshotDir: snap2.path, manifest: backup.readManifest(snap2.path)});
    assert.ok(second.commit, 'pasta movida devia commitar sem recusa');
    assert.ok(reopened.status().available);
  } finally {
    cleanup(base);
  }
});
