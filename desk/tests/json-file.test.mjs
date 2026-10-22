// Leitura tolerante e escrita atômica de JSON, fonte única (#43 fase 2).
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {readJson, atomicWrite} = require('../json-file.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-json-file-'));
after(() => fs.rmSync(dir, {recursive: true, force: true}));

test('readJson devolve o objeto, e null para ausente ou ilegível', () => {
  const ok = path.join(dir, 'ok.json');
  fs.writeFileSync(ok, '{"a":1}');
  assert.deepEqual(readJson(ok), {a: 1});
  assert.equal(readJson(path.join(dir, 'sumiu.json')), null);
  const bad = path.join(dir, 'ruim.json');
  fs.writeFileSync(bad, '{a');
  assert.equal(readJson(bad), null);
});

test('atomicWrite cria a pasta, grava e não deixa temporário', () => {
  const file = path.join(dir, 'sub', 'config.json');
  atomicWrite(file, '{"b":2}\n');
  assert.deepEqual(readJson(file), {b: 2});
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['config.json']);
});
