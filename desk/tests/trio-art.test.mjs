import test from 'node:test';
import assert from 'node:assert/strict';
import {trioSvg, TRIO} from '../src/trio-art.mjs';

/* #64: o trio ∫ Σ ∇ entrega ao componente (src/mascote.mjs) os mesmos grupos
   que ele move, e um grupo por pose/rosto que o trio.css liga por humor. */

const ids = /** @type {Array<'integral'|'sigma'|'nabla'>} */ (Object.keys(TRIO));

test('os três existem e entregam os grupos que o componente move', () => {
  assert.deepEqual(ids, ['integral', 'sigma', 'nabla']);
  for (const id of ids) {
    const svg = trioSvg(id, 't1');
    for (const part of ['mascote-tilt', 'mascote-jump', 'mascote-look', 'mascote-sparks']) assert.match(svg, new RegExp(`class="${part}"`), `${id}: ${part}`);
  }
});

test('cada humor tem o seu grupo: poses, olhos, bocas e sinais', () => {
  const groups = ['tr-pose-descanso', 'tr-pose-pensando', 'tr-pose-dica', 'tr-pose-festa', 'tr-pose-escrevendo', 'tr-eyes-happy', 'tr-eyes-closed', 'tr-lid', 'tr-scan', 'tr-question', 'tr-check', 'tr-bang', 'tr-z', 'tr-mouth-o', 'tr-mouth-worried'];
  for (const id of ids) for (const g of groups) assert.ok(trioSvg(id, 't2').includes(g), `${id}: ${g}`);
  assert.ok(trioSvg('integral', 't3').includes('tr-book'), 'a ∫ lê com o livrinho');
  assert.ok(!trioSvg('sigma', 't4').includes('tr-book'));
});

test('sem SMIL, filtro do pincel com id próprio e personagem desconhecida recusada', () => {
  const svg = trioSvg('nabla', 'abc');
  assert.doesNotMatch(svg, /<animate|<set\b/, 'o movimento é CSS (#63)');
  assert.match(svg, /<filter id="abcp"/);
  assert.match(svg, /filter="url\(#abcp\)"/);
  assert.throws(() => trioSvg(/** @type {any} */ ('folhinha'), 'x'), /desconhecido: "folhinha"; esperado "integral", "sigma" ou "nabla"/);
});

test('o rabisco do lápis gira com a ponta como pivô', () => {
  const origin = trioSvg('sigma', 'p1').match(/class="tr-pencil" style="transform-origin:([\d.]+)px ([\d.]+)px"/);
  assert.ok(origin, 'o lápis tem pivô');
  const tip = trioSvg('sigma', 'p1').match(/class="tr-pencil"[^>]*>.*?<path d="M[\d. ]+L[\d. ]+"[^>]*\/>.*?<path d="M[\d.]+ [\d.]+L([\d.]+) ([\d.]+)"/);
  assert.ok(tip, 'o grafite é o segundo traço');
  assert.deepEqual([origin[1], origin[2]], [tip[1], tip[2]], 'pivô na ponta do grafite');
});
