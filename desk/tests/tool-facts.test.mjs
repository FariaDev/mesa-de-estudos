import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {installFakeTools} from './fake-tool-binaries.mjs';

const require = createRequire(import.meta.url);
const facts = require('../tool-facts.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tool-facts-'));

test('versionFromOutput: só X.Y.Z, vindo de qualquer saída de --version', () => {
  assert.equal(facts.versionFromOutput('2.1.296 (Claude Code)\n'), '2.1.296');
  assert.equal(facts.versionFromOutput('pi v1.3.0'), '1.3.0');
  assert.equal(facts.versionFromOutput('versão 1.3'), '', 'sem patch não é versão estável');
  assert.equal(facts.versionFromOutput(''), '');
});

test('piInstall: o caminho REAL decide — Homebrew, npm global, local da Mesa ou desconhecido', () => {
  const brew = installFakeTools(tmp(), {install: 'brew', formula: 'pi-coding-agent'});
  assert.deepEqual(facts.piInstall({piPath: brew.piPath, localRoot: ''}), {kind: 'brew', formula: 'pi-coding-agent'});
  const npm = installFakeTools(tmp(), {install: 'npm'});
  assert.deepEqual(facts.piInstall({piPath: npm.piPath, localRoot: ''}), {kind: 'npm', formula: ''});
  const solto = installFakeTools(tmp(), {install: 'unknown'});
  assert.deepEqual(facts.piInstall({piPath: solto.piPath, localRoot: ''}), {kind: 'unknown', formula: ''});
  assert.deepEqual(facts.piInstall({piPath: brew.piPath, localRoot: '.pi-local'}), {kind: 'local', formula: ''}, 'o Pi da Mesa vence');
  assert.deepEqual(facts.piInstall({piPath: '', localRoot: ''}), {kind: '', formula: ''});
});

test('piInstall: nome de fórmula estranho não vira comando', () => {
  const dir = tmp();
  const evil = path.join(dir, 'Cellar', 'x; rm -rf ~', '1.0.0', 'bin');
  fs.mkdirSync(evil, {recursive: true});
  const pi = path.join(evil, 'pi');
  fs.writeFileSync(pi, '#!/usr/bin/env node\n');
  assert.equal(facts.piInstall({piPath: pi, localRoot: ''}).kind, 'unknown');
});

test('updatePlan: o comando exato de cada instalador, e só o que a Mesa pode rodar', () => {
  const none = {kind: '', formula: ''};
  assert.deepEqual(facts.updatePlan({id: 'pi', install: {kind: 'brew', formula: 'pi-coding-agent'}, claudeLauncher: ''}),
    {mode: 'run', command: 'brew upgrade pi-coding-agent', file: 'brew', args: ['upgrade', 'pi-coding-agent']});
  assert.deepEqual(facts.updatePlan({id: 'pi', install: {kind: 'npm', formula: ''}, claudeLauncher: ''}),
    {mode: 'run', command: 'npm i -g @earendil-works/pi-coding-agent', file: 'npm', args: ['i', '-g', '@earendil-works/pi-coding-agent']});
  assert.deepEqual(facts.updatePlan({id: 'pi', install: {kind: 'unknown', formula: ''}, claudeLauncher: ''}),
    {mode: 'copy', command: 'npm i -g @earendil-works/pi-coding-agent', file: '', args: []});
  assert.equal(facts.updatePlan({id: 'pi', install: {kind: 'local', formula: ''}, claudeLauncher: ''}).mode, 'local');
  assert.equal(facts.updatePlan({id: 'pi', install: none, claudeLauncher: ''}).mode, 'none');
  assert.deepEqual(facts.updatePlan({id: 'claude', install: none, claudeLauncher: '/x/claude'}),
    {mode: 'run', command: 'claude update', file: '/x/claude', args: ['update']});
  assert.equal(facts.updatePlan({id: 'claude', install: none, claudeLauncher: ''}).mode, 'none');
});

test('claudeInstalledVersion: só `--version`, nunca auth status; sem reserva do SDK (#51)', async () => {
  const calls = [];
  const run = async (file, args) => { calls.push([file, ...args]); return {stdout: '2.1.296 (Claude Code)\n'}; };
  assert.equal(await facts.claudeInstalledVersion({launcher: '/x/claude', run}), '2.1.296');
  assert.equal('reserveVersion' in facts, false);
  assert.deepEqual(calls, [['/x/claude', '--version']]);
  assert.equal(await facts.claudeInstalledVersion({launcher: '', run}), '');
  const quebra = async () => { throw Error('travou'); };
  assert.equal(await facts.claudeInstalledVersion({launcher: '/x/claude', run: quebra}), '', 'binário que falha não derruba o painel');
});

test('executableIn: acha só nos diretórios dados; caminho com barra passa como está', () => {
  const fake = installFakeTools(tmp());
  assert.equal(facts.executableIn('brew', {}, '/nada', [fake.bin]), path.join(fake.bin, 'brew'));
  assert.equal(facts.executableIn('brew', {}, '/nada', [path.join(fake.bin, 'vazio')]), '');
  assert.equal(facts.executableIn('/abs/claude', {}, '/nada', [fake.bin]), '/abs/claude');
  assert.equal(facts.executableIn('', {}, '/nada', [fake.bin]), '');
});
