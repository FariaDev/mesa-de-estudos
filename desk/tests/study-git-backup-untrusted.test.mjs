import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, write, cleanup} from './study-backup-fixtures.mjs';
import {ptMatches} from './pt-text.mjs';

/* B-02: destino Git em pasta de terceiro. Antes de qualquer comando num
   `.mesa-git` existente, o app recusa o repositório que não reconhece
   (chave fora da allowlist, gancho fora de `*.sample`, link simbólico), sem
   apagar nada do usuário e sem perder o backup em snapshot. Git de verdade,
   com "fakes" que gravam arquivo-marcador se algum código rodar. */

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const gitBackup = require('../src/study-data/git-backup.cjs');

const gitConfigDir = tempDir('mesa-git-config');
const gitConfigFile = path.join(gitConfigDir, 'config');
fs.writeFileSync(gitConfigFile, '');
const savedGitConfigGlobal = process.env.GIT_CONFIG_GLOBAL;
process.env.GIT_CONFIG_GLOBAL = gitConfigFile;
process.env.GIT_CONFIG_NOSYSTEM = '1';
test.after(() => {
  if (savedGitConfigGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGitConfigGlobal;
  delete process.env.GIT_CONFIG_NOSYSTEM;
  cleanup(gitConfigDir);
});

const gitInfo = gitBackup.gitAvailable();
const maybe = gitInfo.available ? test : test.skip;

function gitCmd(args, cwd) {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

function bareRemote(tag = 'mesa-remote') {
  const dir = tempDir(tag);
  gitCmd(['init', '-q', '--bare', dir], dir);
  gitCmd(['symbolic-ref', 'HEAD', 'refs/heads/main'], dir);
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

function markerScript(marker, tag = 'pwned') {
  const script = tempDir(tag);
  const file = path.join(script, 'evil.sh');
  fs.writeFileSync(file, `#!/bin/sh\ntouch ${marker}\n`);
  fs.chmodSync(file, 0o755);
  return {script, file};
}

function commitOnce(git, snapshot) {
  return git.integrate({snapshotDir: snapshot.path, manifest: backup.readManifest(snapshot.path)});
}

maybe('B-02: git config --file --list não executa nada (a leitura da validação é segura)', () => {
  const dir = tempDir('mesa-git-filelist');
  try {
    const marker = path.join(dir, 'marcador');
    const evil = markerScript(marker);
    const configFile = path.join(dir, 'evil-config');
    fs.writeFileSync(configFile, `[core]\n\tfsmonitor = ${evil.file}\n`);
    const listed = gitBackup.defaultRunner({gitDir: '', cwd: dir, args: ['config', '--file', configFile, '--list']});
    assert.equal(listed.code, 0);
    assert.match(listed.stdout, /core\.fsmonitor/);
    assert.equal(fs.existsSync(marker), false, 'só listar não executa o fsmonitor');
    cleanup(evil.script);
  } finally {
    cleanup(dir);
  }
});

maybe('B-02: backup já existente feito pelo app continua funcionando (commit e push)', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  const remote = bareRemote();
  try {
    const first = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    const committed = commitOnce(git, first);
    assert.equal(committed.committed, true);
    const pushed = git.push({remote, branch: 'main'});
    assert.equal(pushed.pushed, true);
    assert.equal(gitCmd(['--git-dir', remote, 'rev-parse', 'HEAD'], remote), committed.commit);
    const status = git.status();
    assert.equal(status.available, true);
    assert.equal(status.head, committed.commit);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, remote);
  }
});

maybe('B-02: pre-push hostil não roda; push e status recusam sem apagar nada', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  const remote = bareRemote();
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    commitOnce(git, snapshot);
    const marker = path.join(dest, 'marcador-pre-push');
    fs.writeFileSync(path.join(dest, gitBackup.GIT_DIR, 'hooks', 'pre-push'), `#!/bin/sh\ntouch ${marker}\n`, {mode: 0o755});
    assert.throws(() => git.push({remote, branch: 'main'}), ptMatches(/não reconhecido/));
    assert.equal(fs.existsSync(marker), false, 'nenhum código rodou');
    assert.throws(() => git.status(), ptMatches(/não reconhecido/));
    assert.equal(fs.existsSync(marker), false);
    /* Sem apagar nada do usuário e sem perder o snapshot. */
    assert.equal(fs.existsSync(path.join(dest, gitBackup.GIT_DIR, 'hooks', 'pre-push')), true, 'gancho alheio continua lá');
    assert.ok(backup.list(dest).length >= 1, 'backup em snapshot independente continua valendo');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, remote);
  }
});

maybe('B-02: pre-commit hostil não roda; commit recusa', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    const marker = path.join(dest, 'marcador-pre-commit');
    git.ensureRoot();
    fs.writeFileSync(path.join(dest, gitBackup.GIT_DIR, 'hooks', 'pre-commit'), `#!/bin/sh\ntouch ${marker}\n`, {mode: 0o755});
    assert.throws(() => commitOnce(git, snapshot), ptMatches(/não reconhecido/));
    assert.equal(fs.existsSync(marker), false, 'nenhum código rodou');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

maybe('B-02: core.fsmonitor hostil não roda', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    commitOnce(git, snapshot);
    const marker = path.join(dest, 'marcador-fsmonitor');
    const evil = markerScript(marker);
    gitCmd(['--git-dir', path.join(dest, gitBackup.GIT_DIR), 'config', 'core.fsmonitor', evil.file], dest);
    assert.throws(() => git.status(), ptMatches(/não reconhecido.*chave não reconhecida.*core\.fsmonitor/));
    assert.equal(fs.existsSync(marker), false, 'nenhum código rodou');
    assert.throws(() => commitOnce(git, snapshot), ptMatches(/não reconhecido/));
    assert.equal(fs.existsSync(marker), false);
    cleanup(evil.script);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

maybe('B-02: filter com .gitattributes hostil não roda', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    git.ensureRoot();
    const marker = path.join(dest, 'marcador-filter');
    const evil = markerScript(marker);
    gitCmd(['--git-dir', path.join(dest, gitBackup.GIT_DIR), 'config', 'filter.evil.clean', evil.file], dest);
    write(dest, '.gitattributes', '*.txt filter=evil\n');
    assert.throws(() => commitOnce(git, snapshot), ptMatches(/não reconhecido.*filter\.evil\.clean/));
    assert.equal(fs.existsSync(marker), false, 'nenhum código rodou');
    cleanup(evil.script);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

maybe('B-02: include.path e hooksPath hostis são recusados', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    commitOnce(git, snapshot);
    const marker = path.join(dest, 'marcador-include');
    const evil = markerScript(marker);
    const includeFile = path.join(dest, 'evil-include');
    fs.writeFileSync(includeFile, `[core]\n\tfsmonitor = ${evil.file}\n`);
    gitCmd(['--git-dir', path.join(dest, gitBackup.GIT_DIR), 'config', 'include.path', includeFile], dest);
    assert.throws(() => git.status(), ptMatches(/não reconhecido.*include\.path/));
    assert.equal(fs.existsSync(marker), false, 'nenhum código rodou');
    gitCmd(['--git-dir', path.join(dest, gitBackup.GIT_DIR), 'config', '--unset', 'include.path'], dest);
    gitCmd(['--git-dir', path.join(dest, gitBackup.GIT_DIR), 'config', 'core.hooksPath', '/tmp'], dest);
    assert.throws(() => git.status(), ptMatches(/não reconhecido.*core\.hookspath/i));
    cleanup(evil.script);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

maybe('B-02: link simbólico em .mesa-git, config ou hooks recusa', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    commitOnce(git, snapshot);
    const realConfig = path.join(dest, gitBackup.GIT_DIR, 'config');
    const parked = path.join(dest, 'config-real');
    fs.renameSync(realConfig, parked);
    fs.symlinkSync(parked, realConfig);
    assert.throws(() => git.status(), ptMatches(/não reconhecido.*link simbólico em config/));
    fs.unlinkSync(realConfig);
    fs.renameSync(parked, realConfig);
    /* Volta a funcionar sem o link: era só o link. */
    assert.equal(git.status().available, true);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

maybe('B-02: validação vale a cada operação (pasta pode mudar entre ops)', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-git-dest');
  try {
    const snapshot = await snapshotWith(dest, fixture);
    const git = gitBackup.api({root: dest, backupRoot: path.join(dest, 'snapshots')});
    commitOnce(git, snapshot);
    assert.equal(git.status().available, true, 'antes do ataque funciona');
    const marker = path.join(dest, 'marcador-tardio');
    fs.writeFileSync(path.join(dest, gitBackup.GIT_DIR, 'hooks', 'pre-push'), `#!/bin/sh\ntouch ${marker}\n`, {mode: 0o755});
    assert.throws(() => git.bundle({}), ptMatches(/não reconhecido/), 'operação seguinte recusa');
    assert.equal(fs.existsSync(marker), false, 'nenhum código rodou');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});
