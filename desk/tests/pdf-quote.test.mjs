/* Citar fórmula do PDF (#70): a seleção sobre a camada de texto saía em
   retalhos e o Quote levava texto embaralhado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {formulaLike, cropRect} from '../src/pdf-quote.mjs';

test('o retalho do teste manual (limite fundamental) é fórmula', () => {
  assert.equal(formulaLike('f\n(\nx\n)\n]\n= 1\nf\n(\nx\n)\n→0'), true);
  assert.equal(formulaLike('lim f(x) = 1, x ∈ ℝ'), true, 'operador matemático');
  assert.equal(formulaLike('sen\n[\nf\n(\nx'), true, 'só retalhos');
});

test('texto corrido do PDF continua citado como texto', () => {
  assert.equal(formulaLike('Limites fundamentais'), false);
  assert.equal(formulaLike('O limite de uma função mede o valor\nque ela se aproxima quando x\ntende a um ponto.'), false);
  assert.equal(formulaLike(''), false);
});

test('o recorte fica dentro da página, na escala do canvas', () => {
  const page = {left: 100, top: 200, width: 600, height: 800};
  assert.deepEqual(cropRect({left: 110, top: 220, right: 310, bottom: 260}, page, 2, 8), {x: 4, y: 24, width: 432, height: 112});
  assert.deepEqual(cropRect({left: 90, top: 190, right: 120, bottom: 210}, page, 1, 8), {x: 0, y: 0, width: 28, height: 18});
  assert.equal(cropRect({left: 800, top: 220, right: 900, bottom: 260}, page, 2, 8), null);
});
