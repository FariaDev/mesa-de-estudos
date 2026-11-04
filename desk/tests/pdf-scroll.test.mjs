import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestPageIndex} from '../src/pdf-scroll.mjs';

/* A varredura antiga, como referência de comportamento. */
function reference(pages, center) {
  let nearest = 0;
  let distance = Infinity;
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const current = Math.abs(page.offsetTop + page.offsetHeight / 2 - center);
    if (current < distance) {
      distance = current;
      nearest = index;
    }
  }
  return nearest;
}

test('busca binária escolhe a mesma página que a varredura em todos os centros', () => {
  const pages = [];
  let top = 0;
  for (let index = 0; index < 60; index++) {
    const height = 300 + (index % 5) * 37;
    pages.push({offsetTop: top, offsetHeight: height});
    top += height + 8;
  }
  const centers = [-500, 0, 1, 299, 300, 301, 10000, top - 1, top, top + 500];
  for (let center = -600; center <= top + 600; center += 7) centers.push(center);
  for (const page of pages) centers.push(page.offsetTop + page.offsetHeight / 2);
  for (const center of centers) {
    assert.equal(nearestPageIndex(pages, center), reference(pages, center), `centro ${center}`);
  }
});

test('empate fica com a página de cima, como antes', () => {
  const pages = [
    {offsetTop: 0, offsetHeight: 100},
    {offsetTop: 100, offsetHeight: 100},
  ];
  assert.equal(nearestPageIndex(pages, 100), reference(pages, 100));
  assert.equal(nearestPageIndex(pages, 100), 0);
});

test('sem páginas devolve 0', () => {
  assert.equal(nearestPageIndex([], 42), 0);
});
