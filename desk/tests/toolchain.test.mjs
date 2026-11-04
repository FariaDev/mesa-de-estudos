/* Detecção da toolchain do Bend (`core/toolchain.mjs`), a fonte única que o
   `verify.mjs`, o `build-safe.mjs` e o portão do `npm test` usam. Aqui o spawn é
   um fake com nome: o teste prova a REGRA (plugin + bun + bend respondendo),
   não a instalação desta máquina. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {detectToolchain, findBend} from '../../core/toolchain.mjs';
import {fakeToolchainSpawn} from './fake-toolchain-spawn.mjs';

function fakeBendHome(withPlugin) {
  const home = mkdtempSync(join(tmpdir(), 'mesa-bend-home-'));
  if (withPlugin) {
    mkdirSync(join(home, 'current', 'bend2'), {recursive: true});
    writeFileSync(join(home, 'current', 'bend2', 'main.ts'), '// plugin falso\n');
  }
  return home;
}

const envFor = (home) => ({BEND_HOME: home, BUN_BIN: 'bun-fake', BEND_BIN: 'bend-fake'});

test('plugin + bun + bend respondendo: toolchain presente', () => {
  const home = fakeBendHome(true);
  try {
    const toolchain = detectToolchain({env: envFor(home), spawn: fakeToolchainSpawn()});
    assert.equal(toolchain.present, true);
    assert.deepEqual(toolchain.missing, []);
    assert.equal(toolchain.bun.bin, 'bun-fake');
    assert.equal(toolchain.bend.version, 'bend 2.0.37');
    assert.match(toolchain.plugin, /bend2[\\/]main\.ts$/);
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

test('sem plugin e sem binários: ausente, com o que falta na mensagem', () => {
  const home = fakeBendHome(false);
  try {
    const toolchain = detectToolchain({env: envFor(home), spawn: fakeToolchainSpawn({respond: false})});
    assert.equal(toolchain.present, false);
    assert.equal(toolchain.missing.length, 3);
    assert.match(toolchain.missing.join('\n'), /plugin em/);
    assert.match(toolchain.missing.join('\n'), /bun \(BUN_BIN/);
    assert.match(toolchain.missing.join('\n'), /binário do bend \(bend-fake\)/);
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

test('bend antigo responde por --version quando `version` não existe', () => {
  const fallback = findBend({env: {BEND_BIN: 'bend-fake'}, spawn: fakeToolchainSpawn({bendSubcommand: '--version'})});
  assert.deepEqual(fallback, {bin: 'bend-fake', version: 'bend 2.0.37'});
});
