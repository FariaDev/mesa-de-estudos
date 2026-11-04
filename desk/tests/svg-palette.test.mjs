/* Cores literais do SVG do tutor viram tokens do tema. Sem DOM: a troca é
   pura; o gancho do DOMPurify só aplica `themeAttribute`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {literalColor, themeAttribute, themePaint, themeStyle} from '../src/figures/svg-palette.mjs';

const slots = () => new Map();

test('hex, rgb e nome cromáticos viram séries estáveis, na ordem em que aparecem', () => {
  const used = slots();
  assert.equal(themePaint('#2563eb', 'stroke', used), 'var(--plot-1)');
  assert.equal(themePaint('orange', 'stroke', used), 'var(--plot-2)');
  assert.equal(themePaint('rgb(15, 123, 85)', 'fill', used), 'var(--plot-3)');
  assert.equal(themePaint('#2563EB', 'fill', used), 'var(--plot-1)');
  assert.equal(themePaint('hsl(210 90% 56%)', 'stroke', used), 'var(--plot-4)');
  assert.equal(used.size, 4);
});

test('tinta escura segue o texto; fundo claro vira a superfície; traço claro continua visível', () => {
  const used = slots();
  assert.equal(themePaint('#111111', 'stroke', used), 'currentColor');
  assert.equal(themePaint('black', 'fill', used), 'currentColor');
  assert.equal(themePaint('#ffffff', 'fill', used), 'var(--plot-bg)');
  assert.equal(themePaint('white', 'stroke', used), 'currentColor');
  assert.equal(themePaint('whitesmoke', 'fill', used), 'var(--plot-bg)');
  assert.equal(used.size, 0, 'cinza não consome série');
});

test('token, none, url e nome desconhecido ficam como o tutor escreveu', () => {
  const used = slots();
  for (const value of ['currentColor', 'var(--plot-1)', 'var(--plot-1,#2563eb)', 'none', 'transparent', 'url(#grade)']) {
    assert.equal(themePaint(value, 'stroke', used), value, value);
  }
  assert.equal(themeAttribute('href', '#2563eb', used), '#2563eb');
  assert.equal(themeAttribute('stroke', 'not-a-color', used), 'not-a-color');
  assert.equal(literalColor('currentColor'), null);
});

test('alfa vira color-mix e a sétima cor recomeça a série', () => {
  const used = slots();
  assert.equal(themePaint('rgba(37, 99, 235, 0.4)', 'stroke', used), 'color-mix(in srgb, var(--plot-1) 40%, transparent)');
  assert.equal(themePaint('#2563eb00', 'fill', used), 'transparent');
  const many = slots();
  for (let index = 0; index < 6; index += 1) themePaint(`hsl(${index * 40} 80% 50%)`, 'stroke', many);
  assert.equal(themePaint('hsl(280 80% 50%)', 'stroke', many), 'var(--plot-1)');
  assert.equal(many.size, 7);
});

test('style troca só a pintura e preserva o resto, inclusive !important', () => {
  const used = slots();
  assert.equal(themeStyle('stroke:#000;stroke-width:2;fill:orange', used), 'stroke:currentColor;stroke-width:2;fill:var(--plot-1)');
  assert.equal(themePaint('blue !important', 'stroke', used), 'var(--plot-2) !important');
  assert.equal(themeStyle('stroke:var(--plot-3,#000)', slots()), 'stroke:var(--plot-3,#000)');
});
