import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* #67: numa sessão de 1000 mensagens, o turno caiu de ~218 para ~117 ms quando as
   mensagens fora da vista saíram do layout (tests/perf-probe.mjs --only=session).
   A sonda abre janela e é opt-in; este teste segura a regra no portão rápido. */
const css = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'src', 'tutor-chat.css'), 'utf8');

test('mensagens antigas ficam fora do layout; a última, que cresce no streaming, não', () => {
  const rule = css.match(/#messages>\.message:not\(:last-child\)\{([^}]*)\}/);
  assert.ok(rule, 'tutor-chat.css: esperado #messages>.message:not(:last-child){content-visibility:auto;…}');
  assert.match(rule[1], /content-visibility:auto/);
  assert.match(rule[1], /contain-intrinsic-size:auto \d+px/, 'sem "auto" a altura medida se perde e a rolagem pula');
});
