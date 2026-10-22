// A casca do `Nat` entre a Mesa e os artefatos do núcleo Bend (src/bend-nat.mjs, #49).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {NAT_MAX, roundNat, toNat, wholeNat} from '../src/bend-nat.mjs';

test('NAT_MAX é o teto da soma do artefato: 2^48-1', () => {
  assert.equal(NAT_MAX, 281474976710655);
});

test('toNat devolve o próprio número quando é Nat', () => {
  for (const ok of [0, 1, 42, Date.UTC(2100, 0, 1), NAT_MAX]) assert.equal(toNat(ok), ok);
});

test('toNat recusa o que o BigInt recusava e o que passa do teto, dizendo o valor', () => {
  for (const bad of [-1, 1.5, Number.NaN, Infinity, NAT_MAX + 1, 2 ** 53]) {
    assert.throws(() => toNat(bad), (error) => error instanceof TypeError && error.message.includes(String(bad)) && error.message.includes('0..2^48-1'));
  }
  assert.throws(() => toNat(/** @type {any} */ ('5')), /recebido "5"/);
  assert.throws(() => toNat(/** @type {any} */ (5n)), /recebido 5/, 'um BigInt esquecido não passa calado');
});

test('wholeNat trunca, satura e troca lixo pelo piso', () => {
  assert.equal(wholeNat(7.9), 7);
  assert.equal(wholeNat('12'), 12);
  assert.equal(wholeNat(-3), 0);
  assert.equal(wholeNat(undefined), 0);
  assert.equal(wholeNat('abc', 1), 1);
  assert.equal(wholeNat(0, 1), 1);
  assert.equal(wholeNat(Infinity), 0, 'como o whole dos hosts: infinito não é número de página');
  assert.equal(wholeNat(-Infinity, 1), 1);
  assert.equal(wholeNat(1e300), NAT_MAX);
});

test('roundNat arredonda antes de levar a Nat', () => {
  assert.equal(roundNat(399.6), 400);
  assert.equal(roundNat(399.4), 399);
  assert.equal(roundNat('12.5'), 13);
  assert.equal(roundNat(-7), 0);
  assert.equal(roundNat(Number.NaN), 0);
});

/* A regra da #49: BigInt e literal `\d+n` só na casca. Uma comparação como
   `=== 0n` com o núcleo devolvendo number não lança, só deixa de casar, por
   isso a varredura olha o literal e não só o `BigInt(`. */
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCANNED = ['desk', 'core'];
const SKIPPED_DIRS = new Set(['node_modules', 'generated', '.runtime']);
const CODE_FILE = /\.(?:mjs|cjs|js|ts)$/;
const ALLOWED = new Map([
  ['desk/src/bend-nat.mjs', 'a casca cita o BigInt antigo no comentário'],
  ['desk/tests/bend-nat.test.mjs', 'prova que a casca recusa um BigInt esquecido'],
  ['desk/tests/pdf-model-samples.cjs', '`12+3n` é texto de matemática numa amostra de PDF'],
]);
const FORBIDDEN = [/\bBigInt\s*\(/, /(?<![\w.$])\d+n\b/];

function codeFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), {withFileTypes: true})) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) out.push(...codeFiles(rel));
    if (entry.isFile() && CODE_FILE.test(entry.name)) out.push(rel);
  }
  return out;
}

test('nenhum BigInt( nem literal \\d+n fora da casca, em desk/ e core/ (#49)', () => {
  const found = [];
  for (const rel of SCANNED.flatMap((dir) => codeFiles(dir))) {
    if (ALLOWED.has(rel)) continue;
    fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').forEach((line, index) => {
      if (FORBIDDEN.some((rule) => rule.test(line))) found.push(`${rel}:${index + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(found, [], 'use toNat/wholeNat/roundNat de src/bend-nat.mjs e número comum');
});

test('a varredura pega o que diz pegar', () => {
  for (const bad of ['x === 0n', 'assert.equal(x, 2n)', 'BigInt(page)', 'f(10n, 1n)']) assert.ok(FORBIDDEN.some((rule) => rule.test(bad)), bad);
  for (const ok of ['const n2n = 1', 'x.n1n', 'page: 2', 'token1n']) assert.ok(!FORBIDDEN.some((rule) => rule.test(ok)), ok);
});
