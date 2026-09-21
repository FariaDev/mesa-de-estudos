import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/generated/framing.core.js';
import {frameSplit} from '../rpc.cjs';

/* Paridade host × `core/framing.bend` (gêmeo da Mesa).
   O caminho quente do app é o `frameSplit` nativo do host. O núcleo é a
   **spec** e, desde a correção #798 (loops accumulator/tail no lugar de
   `String.split`/`String.length` recursivos), roda os mesmos buffers: os
   testes comparam host × núcleo também no caso de 12 MB e 200k linhas,
   sem teto de tamanho. */

const coreLines = (ls) => {
  const out = [];
  for (let l = ls; l && l.$ === 'Con'; l = l.tail) out.push(l.head);
  return out;
};

const coreFrame = (joined) => {
  const f = core['feed.over'](joined, false);
  return {lines: coreLines(f.lines), rest: f.rest, overflow: f.overflow};
};

test('paridade em casos montados: mesmas linhas e mesmo resto', () => {
  const casos = [
    '',
    '\n',
    'a',
    'a\n',
    '\n\n',
    '{"id":"d1"}\n{"id":"d2"}\nresto',
    'sem-quebra',
    'a\nb\n\nc\nResto com quebra? não: fim',
    '💡 unicode: ação ção\nfim',
  ];
  for (const joined of casos) {
    assert.deepEqual(frameSplit(joined), coreFrame(joined), JSON.stringify(joined.slice(0, 40)));
  }
});

test('paridade em casos aleatórios (1000)', () => {
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 1000; i++) {
    const partes = [];
    const n = Math.floor(rand() * 8);
    for (let j = 0; j < n; j++) {
      const len = Math.floor(rand() * 12);
      let s = '';
      for (let k = 0; k < len; k++) s += rand() < 0.15 ? '\n' : 'x';
      partes.push(s);
    }
    const joined = partes.join('');
    assert.deepEqual(frameSplit(joined), coreFrame(joined), `caso ${i}: ${JSON.stringify(joined)}`);
  }
});

test('overflow: os dois descartam tudo acima do limite', () => {
  const grande = 'x'.repeat(33554433);
  assert.deepEqual(frameSplit(grande), {lines: [], rest: '', overflow: true});
  // O núcleo decide pelo Bool do host sem tocar na string (a spec do descarte).
  const f = core['feed.over'](grande, true);
  assert.equal(f.overflow, true);
  assert.equal(f.rest, '');
  assert.equal(coreLines(f.lines).length, 0);
});

test('regressão: buffers de MB não estouram a pilha e conservam as linhas', () => {
  const grande = 'x'.repeat(12_000_000);
  const semQuebra = frameSplit(grande);
  assert.deepEqual(semQuebra, {lines: [], rest: grande, overflow: false});
  assert.deepEqual(coreFrame(grande), semQuebra, 'núcleo no caso de 12 MB');

  const linhas = [];
  for (let i = 0; i < 200_000; i++) linhas.push(`{"n":${i}}`);
  const joined = linhas.join('\n');

  const many = frameSplit(joined);
  assert.equal(many.lines.length, 199_999, 'sem \\n no fim, a última linha é o resto');
  assert.equal(many.lines[199_998], '{"n":199998}');
  assert.equal(many.rest, '{"n":199999}');
  assert.deepEqual(coreFrame(joined), many, 'núcleo no caso de 200k linhas');

  const completo = frameSplit(joined + '\n');
  assert.equal(completo.lines.length, 200_000);
  assert.equal(completo.rest, '');
  assert.deepEqual(coreFrame(joined + '\n'), completo, 'núcleo no caso de 200k linhas com LF final');

  // Conservação: rejuntar as linhas + resto devolve o original (spec do núcleo).
  const parcial = linhas.slice(0, 500).join('\n') + '\nparcial';
  assert.equal(core.rejoinFrame(core['feed.over'](parcial, false)), parcial);
});

test('feed no núcleo: limite estrito também em MB (strLength em loop)', () => {
  const grande = 'x'.repeat(12_000_000);
  const dentro = core.feed('x'.repeat(6_000_000), 'x'.repeat(6_000_000), 33554432n);
  assert.equal(dentro.overflow, false);
  assert.equal(dentro.rest, grande);

  const fora = core.feed('x'.repeat(6_000_000), 'x'.repeat(6_000_000), 10485760n);
  assert.equal(fora.overflow, true);
  assert.equal(fora.rest, '');
  assert.equal(coreLines(fora.lines).length, 0);
});
