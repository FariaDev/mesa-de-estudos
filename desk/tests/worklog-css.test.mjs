import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* #90: o diário recolhido é uma linha; aberto, os passos ficam indentados e
   ligados por uma linha lateral, sem uma caixa por passo (o botão global
   pintava cada .step-toggle como cartão). */
const css = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'src', 'tutor-chat.css'), 'utf8');

test('os passos do diário têm linha lateral e não viram caixas aninhadas', () => {
  const steps = css.match(/\.work-steps\{([^}]*)\}/);
  assert.ok(steps, 'tutor-chat.css: esperado .work-steps{…;border-left:…}');
  assert.match(steps[1], /border-left:\d+px solid var\(--[a-z-]+\)/);
  const toggle = css.match(/\.step-toggle\{([^}]*)\}/);
  assert.ok(toggle, 'tutor-chat.css: esperado .step-toggle{…}');
  assert.match(toggle[1], /border-color:transparent/);
  assert.match(toggle[1], /background:transparent/);
  assert.match(toggle[1], /box-shadow:none/);
});
