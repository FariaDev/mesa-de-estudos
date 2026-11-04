import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* Citação no chat: sem regra para blockquote, o navegador dava 40px de recuo sem
   barra nem cor, e o trecho citado parecia texto solto dentro da bolha. */
const css = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'src', 'tutor-chat.css'), 'utf8');

test('citação no chat tem barra à esquerda e não herda o recuo de 40px do navegador', () => {
  const rule = css.match(/\.message blockquote\{([^}]*)\}/);
  assert.ok(rule, 'tutor-chat.css: esperado .message blockquote{margin:…;border-left:…}');
  assert.match(rule[1], /border-left:\d+px solid var\(--[a-z-]+\)/);
  assert.match(rule[1], /margin:[^;]*\b0\b/, 'a margem lateral zera o recuo padrão');
});
