// Fonte única do teste de objeto simples (#43 fase 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {isPlainObject} = require('../plain-object.cjs');
const DESK = path.join(import.meta.dirname, '..');

test('isPlainObject aceita objeto e recusa array, null e primitivos', () => {
  assert.equal(isPlainObject({a: 1}), true);
  assert.equal(isPlainObject(Object.create(null)), true);
  for (const value of [[], null, undefined, 0, '', 'x', true]) assert.equal(isPlainObject(value), false, String(value));
});

test('os módulos do main usam plain-object.cjs em vez de copiar a linha', () => {
  const copies = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.name.startsWith('.') || ['node_modules', 'tests', 'generated'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.cjs') && entry.name !== 'plain-object.cjs' && /(?:const|function)\s+isPlainObject\b/.test(fs.readFileSync(full, 'utf8'))) copies.push(path.relative(DESK, full));
    }
  };
  walk(DESK);
  assert.deepEqual(copies, []);
});
