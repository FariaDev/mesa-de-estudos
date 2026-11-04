import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* Barra do GeoGebra e do Caderno: o `display:flex` do id vencia o
   `[hidden]{display:none}` do navegador, então a barra continuava na tela
   (invisível pela animação, mas ocupando espaço e recebendo clique). A regra
   `[hidden]` devolve o sumiço; no GeoGebra a saída animada continua porque a
   `motion.css` transiciona `display` com `allow-discrete`. */
const sheets = Object.fromEntries(
  ['header.css', 'review-notebook.css', 'motion.css'].map((name) => [
    name,
    fs.readFileSync(path.resolve(import.meta.dirname, '..', 'src', name), 'utf8'),
  ]),
);

const rule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\{([^}]*)\\}`))?.[1] ?? '';
};

test('#ggb-bar[hidden] realmente esconde a barra', () => {
  assert.match(rule(sheets['header.css'], '#ggb-bar[hidden]'), /display:none/);
});

test('#review-bar[hidden] realmente esconde a barra', () => {
  assert.match(rule(sheets['review-notebook.css'], '#review-bar[hidden]'), /display:none/);
});

test('a saída da #ggb-bar continua animada (display allow-discrete)', () => {
  const transition = rule(sheets['motion.css'], ':is(.chat-pop,#context-pop,.attach-pop,.phone-pop,.palette-backdrop,#ggb-bar,#undo-notice,#update-notice,#ctx-tip,.tip,#quote-btn)');
  assert.match(transition, /transition:[^;]*display var\(--t-base\) allow-discrete/);
});
