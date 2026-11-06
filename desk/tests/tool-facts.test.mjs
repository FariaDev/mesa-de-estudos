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
  assert.equal(facts.versionFromOutput('opencode v1.3.0'), '1.3.0');
  assert.equal(facts.versionFromOutput('versão 1.3'), '', 'sem patch não é versão estável');
  assert.equal(facts.versionFromOutput(''), '');
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
  assert.equal(facts.executableIn('brew', {}, '/nada', [fake.bin]), fake.brewPath);
  assert.equal(facts.executableIn('brew', {}, '/nada', [path.join(fake.bin, 'vazio')]), '');
  assert.equal(facts.executableIn('/abs/claude', {}, '/nada', [fake.bin]), '/abs/claude');
  assert.equal(facts.executableIn('', {}, '/nada', [fake.bin]), '');
});
