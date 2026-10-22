import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {describeUnsafe, findUnsafe} from '../../core/unsafe-scan.mjs';

/* O bend 2.0.27 aceitava lei falsa preenchida por @unsafe num arquivo
   importado (#47). O 2.0.37 fixado na #49 recusa, e o portão de provas
   continua recusando os escapes no texto, sem depender da toolchain. */
const CORE = path.resolve(import.meta.dirname, '..', '..', 'core');

/** Núcleo de mentira com um arquivo importado; apagado ao fim do teste. */
function fakeCore(t, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-unsafe-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'proofs'));
  fs.writeFileSync(path.join(root, 'wheel.bend'), 'def ok(x: Nat) -> Nat:\n  x\n');
  fs.writeFileSync(path.join(root, 'proofs', 'wheel.bend'), body);
  return root;
}

test('o núcleo real não tem escape do verificador', () => {
  const hits = findUnsafe(CORE);
  assert.deepEqual(hits, [], describeUnsafe(hits));
});

test('acha @unsafe, def estrangeira e import por string, com arquivo e linha', (t) => {
  const root = fakeCore(t, 'def a() -> Nat:\n  0\n@unsafe def cheat() -> Nat:\n  0\ndef ffi?(x):\n  x\nimport "lib.js"\n');
  const hits = findUnsafe(root);
  assert.deepEqual(hits.map((hit) => [hit.file, hit.line, hit.rule]), [
    [path.join('proofs', 'wheel.bend'), 3, '@unsafe'],
    [path.join('proofs', 'wheel.bend'), 5, 'def estrangeira'],
    [path.join('proofs', 'wheel.bend'), 7, 'import por string'],
  ]);
  assert.match(describeUnsafe(hits), /core\/proofs\/wheel\.bend:3 \[@unsafe\] @unsafe def cheat/);
});

test('nome comum com "unsafe" ou "import" não é escape', (t) => {
  const root = fakeCore(t, 'def unsafe_count(x: Nat) -> Nat:\n  x\ndef imported(x: Nat) -> Nat:\n  x\n');
  assert.deepEqual(findUnsafe(root), []);
});

test('proof.mjs reprova o @unsafe antes de chamar o bend', (t) => {
  const root = fakeCore(t, '@unsafe def cheat() -> Nat:\n  0\n');
  fs.copyFileSync(path.join(CORE, 'proof.mjs'), path.join(root, 'proof.mjs'));
  fs.copyFileSync(path.join(CORE, 'unsafe-scan.mjs'), path.join(root, 'unsafe-scan.mjs'));
  const run = spawnSync(process.execPath, [path.join(root, 'proof.mjs')], {
    encoding: 'utf8',
    // bend inexistente: se a varredura não barrasse, o portão sairia com 0.
    env: {...process.env, BEND_BIN: path.join(root, 'sem-bend')},
  });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /escape do verificador no núcleo \(1\)/);
});
