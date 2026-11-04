/* Colisão de rótulo: caixas e segmentos de mentira, no lugar do getBBox real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {aabbFromBBox, boxOf, boxesOverlap, fontPx, overlapReport, overlapWarnings, segmentHitsBox, segmentsOf} from '../src/figures/svg-overlap.mjs';

const box = (x, y, width, height) => ({x, y, width, height});

test('caixas se cruzam só quando a área é comum; a CTM leva o getBBox para a tela', () => {
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(9, 9, 4, 4), 0), true);
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(10, 0, 4, 4), 0), false);
  assert.deepEqual(aabbFromBBox(box(0, 0, 10, 4), {a: 2, b: 0, c: 0, d: 2, e: 5, f: 1}), box(5, 1, 20, 8));
  assert.deepEqual(boxOf({getBBox: () => box(1, 2, 3, 4), getScreenCTM: () => null}), box(1, 2, 3, 4));
  assert.equal(boxOf({}), null);
});

test('segmento que corta a caixa avisa; segmento ao lado, não', () => {
  const label = box(10, 10, 20, 10);
  assert.equal(segmentHitsBox({x1: 0, y1: 15, x2: 40, y2: 15}, label, 0), true);
  assert.equal(segmentHitsBox({x1: 0, y1: 0, x2: 40, y2: 30}, label, 0), true);
  assert.equal(segmentHitsBox({x1: 0, y1: 0, x2: 8, y2: 0}, label, 0), false);
  assert.equal(segmentHitsBox({x1: 0, y1: 0, x2: 4, y2: 0}, label, 1), false);
});

test('overlapWarnings cita os dois rótulos, o traço, a fonte e o viewBox', () => {
  const notes = overlapWarnings({
    texts: [
      {label: 'F paralela', box: box(10, 10, 40, 12), fontSize: 10},
      {label: 'não entra em N', box: box(30, 14, 50, 12), fontSize: 14},
      {label: 'θ', box: box(0, 80, 10, 10), fontSize: 12},
    ],
    segments: [{x1: 0, y1: 16, x2: 80, y2: 16}],
    view: box(0, 0, 70, 40),
  });
  assert.match(notes.join('\n'), /O rótulo "F paralela" encosta no rótulo "não entra em N"\./);
  assert.match(notes.join('\n'), /O rótulo "F paralela" cruza um traço\./);
  assert.match(notes.join('\n'), /fonte de 10px; o mínimo é 12px/);
  assert.match(notes.join('\n'), /O rótulo "θ" sai do viewBox/);
  assert.equal(overlapWarnings({texts: [{label: 'ok', box: box(0, 0, 8, 8), fontSize: 12}], segments: [{x1: 0, y1: 30, x2: 40, y2: 30}], view: box(0, 0, 100, 40)}).length, 0);
});

test('segmentsOf lê a linha pelo atributo e a cerca plot não é medida', () => {
  const line = {
    localName: 'line',
    getAttribute: (name) => ({x1: '0', y1: '0', x2: '8', y2: '0', stroke: 'currentColor'}[name] ?? null),
    getScreenCTM: () => null,
  };
  assert.deepEqual(segmentsOf(line), [{x1: 0, y1: 0, x2: 8, y2: 0}]);
  assert.deepEqual(segmentsOf({...line, getAttribute: (name) => (name === 'stroke' ? 'none' : line.getAttribute(name))}), []);
  const path = {
    localName: 'path',
    getAttribute: (name) => (name === 'stroke' ? '#000' : null),
    getTotalLength: () => 10,
    getPointAtLength: (distance) => ({x: distance, y: 0}),
    getScreenCTM: () => null,
  };
  assert.equal(segmentsOf(path).at(-1).x2, 10);
  assert.equal(fontPx({getAttribute: () => '12px', ownerDocument: {}}), 12);
  const plot = {closest: () => ({}), querySelectorAll: () => [{textContent: 'x'}]};
  assert.deepEqual(overlapReport(plot), []);
});

test('overlapReport usa o getBBox falso e devolve o rótulo que cruza a reta', () => {
  const text = {
    localName: 'text', textContent: 'F paralela',
    getBBox: () => box(10, 8, 30, 12),
    getScreenCTM: () => null,
    getAttribute: (name) => (name === 'font-size' ? '14' : null),
  };
  const line = {
    localName: 'line',
    getAttribute: (name) => ({x1: '0', y1: '14', x2: '80', y2: '14', stroke: 'currentColor'}[name] ?? null),
    getScreenCTM: () => null,
  };
  const svg = {
    closest: () => null,
    getBoundingClientRect: () => box(0, 0, 200, 80),
    querySelectorAll: (selector) => (selector === 'text' ? [text] : [line]),
  };
  assert.deepEqual(overlapReport(svg), ['O rótulo "F paralela" cruza um traço.']);
});
