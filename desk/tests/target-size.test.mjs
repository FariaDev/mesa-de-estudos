import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* #67: alvo mínimo de clique de 24px (WCAG 2.5.8). Varre as regras de botão
   das folhas da Mesa que fixam largura ou altura em px. O que fica menor tem de
   ganhar a borda invisível de 3px (`::after{inset:-3px}`) ou estar na lista de
   adiados do relatório, com o motivo. */
const desk = path.resolve(import.meta.dirname, '..');
const MIN_TARGET = 24;
const HIT_AREA = ['.mention-chip-remove', '.attachment .attachment-remove'];
/* Adiado no relatório da #67: a fila é uma lista densa e os botões ficam a 4px
   um do outro; a borda invisível sobreporia os vizinhos. Pede redesenho da linha. */
const DEFERRED = ['.queue-item button'];

function sheets() {
  const src = fs.readdirSync(path.join(desk, 'src')).filter((f) => f.endsWith('.css')).map((f) => path.join('src', f));
  return ['style.css', ...src].map((rel) => ({rel, css: fs.readFileSync(path.join(desk, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')}));
}

/** Seletor cujo último trecho é um botão, sem estado nem pseudo-elemento. */
function isButtonSelector(selector) {
  const tail = selector.split(/[\s>+~]+/).pop() ?? '';
  return /(button|-btn\b|-remove\b|-close\b|role=button)/.test(tail) && !/:hover|:focus|:active|::/.test(selector);
}

function smallButtonRules() {
  const found = [];
  for (const {rel, css} of sheets()) {
    for (const chunk of css.split('}')) {
      const open = chunk.lastIndexOf('{');
      if (open < 0) continue;
      const selectors = chunk.slice(0, open).trim().split('\n').pop().split(',').map((s) => s.trim()).filter(isButtonSelector);
      const sizes = [...chunk.slice(open + 1).matchAll(/(?:^|;)\s*(width|height)\s*:\s*(\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[2]) < MIN_TARGET);
      for (const selector of sizes.length ? selectors : []) found.push({rel, selector, sizes: sizes.map((m) => `${m[1]}:${m[2]}px`).join(' ')});
    }
  }
  return found;
}

test('botão com largura ou altura abaixo de 24px ganha borda de clique ou está adiado', () => {
  for (const {rel, selector, sizes} of smallButtonRules()) {
    assert.ok(HIT_AREA.includes(selector) || DEFERRED.includes(selector), `${rel}: ${selector} tem ${sizes}; esperado ≥ ${MIN_TARGET}px ou a borda invisível de 3px`);
  }
});

test('a borda invisível existe e soma 24px nos 18px do desenho', () => {
  const composer = fs.readFileSync(path.join(desk, 'src', 'composer.css'), 'utf8');
  const rule = composer.match(/:is\(([^)]*)\)::after\{content:"";position:absolute;inset:-3px/);
  assert.ok(rule, 'composer.css: esperado :is(...)::after{content:"";position:absolute;inset:-3px…}');
  assert.deepEqual(rule[1].split(',').map((s) => s.trim()), HIT_AREA);
  assert.ok(smallButtonRules().filter((r) => HIT_AREA.includes(r.selector)).every((r) => /18px/.test(r.sizes)), 'o desenho segue em 18px');
});
