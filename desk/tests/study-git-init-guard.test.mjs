import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {tempDir, cleanup} from './study-backup-fixtures.mjs';

/* `git init` da Mesa nasce surdo ao `init.*` global: `--template=` vazio ignora
   template com hook, `--object-format=sha1` ignora `defaultObjectFormat=sha256`
   e `--ref-format=files` ignora `defaultRefFormat=reftable` (com fallback para
   git antigo). Ruído conhecido (`.DS_Store`, `desktop.ini`, `Thumbs.db`) em
   `hooks/` é ignorado; o resto segue recusado. Se a validação falhar logo
   depois de um `init` deste processo, só o `.mesa-git` recém-criado sai. A
   mensagem de `err.git.untrusted` diz o que recusou. Git de verdade, sem mock. */

const require = createRequire(import.meta.url);
const gitBackup = require('../src/study-data/git-backup.cjs');

const gitInfo = gitBackup.gitAvailable();
const maybe = gitInfo.available ? test : test.skip;

const base = tempDir('mesa-init-guard');
const globalCfg = path.join(base, 'global-config');
fs.writeFileSync(globalCfg, '');
const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
process.env.GIT_CONFIG_GLOBAL = globalCfg;
process.env.GIT_CONFIG_NOSYSTEM = '1';
test.after(() => {
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;
  cleanup(base);
});

function resetGlobal(text) {
  fs.writeFileSync(globalCfg, text);
}

function fresh(name) {
  const dir = path.join(base, name);
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function showObjectFormat(gitDest) {
  return execFileSync('git', ['--git-dir', path.join(gitDest, '.mesa-git'), 'rev-parse', '--show-object-format'], {encoding: 'utf8'}).trim();
}

maybe('template global com hook não envenena o .mesa-git recém-criado', () => {
  const tpl = fresh('template');
  fs.mkdirSync(path.join(tpl, 'hooks'), {recursive: true});
  fs.writeFileSync(path.join(tpl, 'hooks', 'pre-commit'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
  resetGlobal(`[init]\n\ttemplateDir = ${tpl}\n`);
  try {
    const dest = fresh('dest-template');
    assert.equal(gitBackup.api({root: dest}).ensureRoot(), true);
    assert.ok(!fs.existsSync(path.join(dest, '.mesa-git', 'hooks', 'pre-commit')), 'hook do template vazou');
    assert.ok(gitBackup.api({root: dest}).status().available);
  } finally {
    resetGlobal('');
  }
});

maybe('init.defaultObjectFormat=sha256 global não envenena: nasce sha1', () => {
  resetGlobal('[init]\n\tdefaultObjectFormat = sha256\n');
  try {
    const dest = fresh('dest-sha256');
    assert.equal(gitBackup.api({root: dest}).ensureRoot(), true);
    assert.equal(showObjectFormat(dest), 'sha1');
    assert.ok(gitBackup.api({root: dest}).status().available);
  } finally {
    resetGlobal('');
  }
});

maybe('init.defaultRefFormat=reftable global não envenena', () => {
  resetGlobal('[init]\n\tdefaultRefFormat = reftable\n');
  try {
    const dest = fresh('dest-reftable');
    assert.equal(gitBackup.api({root: dest}).ensureRoot(), true);
    if (gitBackup.refFormatSupported(gitInfo.version)) {
      const format = execFileSync('git', ['--git-dir', path.join(dest, '.mesa-git'), 'rev-parse', '--show-ref-format'], {encoding: 'utf8'}).trim();
      assert.equal(format, 'files');
    }
    assert.ok(gitBackup.api({root: dest}).status().available);
  } finally {
    resetGlobal('');
  }
});

maybe('ruído conhecido em hooks/ é ignorado; hook de verdade segue recusado', () => {
  resetGlobal('');
  const dest = fresh('dest-noise');
  gitBackup.api({root: dest}).ensureRoot();
  for (const noise of ['.DS_Store', 'desktop.ini', 'Thumbs.db']) {
    fs.mkdirSync(path.join(dest, '.mesa-git', 'hooks'), {recursive: true});
    fs.writeFileSync(path.join(dest, '.mesa-git', 'hooks', noise), '');
  }
  assert.ok(gitBackup.api({root: dest}).status().available, 'ruído devia passar');
  fs.writeFileSync(path.join(dest, '.mesa-git', 'hooks', 'pre-push'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
  assert.throws(() => gitBackup.api({root: dest}).status(), /gancho em hooks\/: pre-push/, 'hook novo devia recusar dizendo o quê');
});

maybe('validação falhando logo após o init apaga só o .mesa-git recém-criado', () => {
  resetGlobal('');
  const dest = fresh('dest-poisoned-init');
  fs.writeFileSync(path.join(dest, 'mesa-backup.json'), '{"keep":10}\n');
  const {defaultRunner} = gitBackup;
  const tamperRunner = (job) => {
    const out = defaultRunner(job);
    if (Array.isArray(job.args) && job.args[0] === 'init') {
      fs.mkdirSync(path.join(dest, '.mesa-git', 'hooks'), {recursive: true});
      fs.writeFileSync(path.join(dest, '.mesa-git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
    }
    return out;
  };
  assert.throws(() => gitBackup.api({root: dest, runner: tamperRunner}).ensureRoot(), /gancho/);
  assert.ok(!fs.existsSync(path.join(dest, '.mesa-git')), 'só o .mesa-git fresco devia sair');
  assert.equal(fs.readFileSync(path.join(dest, 'mesa-backup.json'), 'utf8'), '{"keep":10}\n', 'arquivo do usuário intacto');
});

test('refFormatSupported só libera a trava no git 2.45+', () => {
  assert.equal(gitBackup.refFormatSupported('git version 2.47.3'), true);
  assert.equal(gitBackup.refFormatSupported('git version 2.45.0'), true);
  assert.equal(gitBackup.refFormatSupported('git version 2.44.9'), false);
  assert.equal(gitBackup.refFormatSupported('git version 1.9.1'), false);
  assert.equal(gitBackup.refFormatSupported(''), false);
});
