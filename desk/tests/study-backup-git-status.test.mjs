import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, cleanup} from './study-backup-fixtures.mjs';

/* `.mesa-git` recusado derrubava o painel: `services.status()` rejeitava e a
   tela caía em `backup.msg.readFail`, sumindo a lista de versões. O erro do
   `git.status()` vai para o `gitError` que o painel já lê; a lista e o snapshot
   continuam aparecendo e só a parte do Git mostra a mensagem. Backup agendado
   e snapshot também não falham por isso. Git de verdade, sem mock. */

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const gitBackup = require('../src/study-data/git-backup.cjs');
const {createBackupServices} = require('../src/study-data/backup-services.cjs');

const gitInfo = gitBackup.gitAvailable();
const maybe = gitInfo.available ? test : test.skip;

function poisonWithHook(gitDest) {
  fs.mkdirSync(path.join(gitDest, '.mesa-git', 'hooks'), {recursive: true});
  fs.writeFileSync(path.join(gitDest, '.mesa-git', 'hooks', 'pre-push'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
}

function setup() {
  const base = tempDir('mesa-gitstatus');
  const fixture = seedRuntime();
  const runtime = fixture.runtime;
  const versionsRoot = path.join(base, 'versions');
  const gitDest = path.join(base, 'git');
  fs.mkdirSync(versionsRoot, {recursive: true});
  fs.mkdirSync(gitDest, {recursive: true});
  const settingsFile = path.join(runtime, 'mesa-backup.json');
  fs.writeFileSync(settingsFile, JSON.stringify({destination: versionsRoot, gitRoot: gitDest, git: true}));
  const services = createBackupServices({runtime: () => runtime, settingsFile, backupRoot: () => versionsRoot, gitRoot: () => gitDest, courses: () => [], deskDir: '', log: () => {}});
  return {base, fixtureRuntime: fixture.runtime, runtime, fixture, versionsRoot, gitDest, settingsFile, services};
}

maybe('status com git recusado resolve: versões e erro do git separados', async () => {
  const {base, fixture, versionsRoot, gitDest, services} = setup();
  try {
    await backup.backupNow({runtime: fixture.runtime, root: versionsRoot, materials: [], reason: 'manual', log: () => {}});
    gitBackup.api({root: gitDest, backupRoot: versionsRoot}).ensureRoot();
    poisonWithHook(gitDest);
    const status = await services.status();
    assert.ok(status.versions.length >= 1, 'lista de versões sumiu');
    assert.ok(status.last, 'último snapshot sumiu');
    assert.match(status.gitError, /gancho/, 'erro do git devia ir para gitError');
    assert.equal(status.git.available, false);
  } finally {
    cleanup(base, fixture.runtime, fixture.materialsDir);
  }
});

maybe('backup manual com git recusado entrega o snapshot e registra o erro', async () => {
  const {base, fixture, versionsRoot, gitDest, services} = setup();
  try {
    gitBackup.api({root: gitDest, backupRoot: versionsRoot}).ensureRoot();
    poisonWithHook(gitDest);
    const result = await services.run({reason: 'manual'});
    assert.ok(result.path, 'snapshot devia existir');
    assert.match(String(result.git && result.git.error), /gancho/);
    assert.match(backup.readStatus(versionsRoot).gitError, /gancho/);
    assert.ok(backup.list(versionsRoot).length >= 1);
  } finally {
    cleanup(base, fixture.runtime, fixture.materialsDir);
  }
});

maybe('CLI status com git recusado sai zero e mostra o erro no campo do git', {skip: !gitInfo.available && 'sem git'} , () => {
  const {base, runtime, fixture, versionsRoot, gitDest} = setup();
  try {
    gitBackup.api({root: gitDest, backupRoot: versionsRoot}).ensureRoot();
    poisonWithHook(gitDest);
    const out = execFileSync('node', ['scripts/study-backup.mjs', 'status', '--runtime', runtime, '--dest', gitDest], {encoding: 'utf8'});
    const parsed = JSON.parse(out);
    assert.equal(parsed.git.available, false);
    assert.match(String(parsed.git.error), /gancho/);
  } finally {
    cleanup(base, fixture.runtime, fixture.materialsDir);
  }
});
