import test from 'node:test';
import assert from 'node:assert/strict';

/* Contrato do artefato `deskflags.core.js` (gerado de core/deskflags.bend):
   as flags do `desk` viram atributos dos controles vivos do index.html
   (#include-refs, #study-context, #context-edit, #check, #calc-divider). O `#end-day` saiu
   do composer: virou item do menu Estudar (leis `tabs_endday_*`). O
   aplicador mora no `state.mjs` (`applyAttrsOn`), que só troca atributos —
   texto, ícone e handlers continuam sendo dos nós do HTML. As leis do módulo
   ficam em core/proofs/deskflags.bend; aqui se confere o que o app recebe. */

const df = (await import('../src/generated/deskflags.core.js')).default;

function attrsOf(node) {
  const out = new Map();
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out.set('' + a.head.name, a.head.value);
  return out;
}

function flags(over = {}) {
  return {
    $: 'DeskFlags',
    refsToggle: true,
    includeRefs: true,
    studyContext: true,
    conferir: true,
    calculator: true,
    ...over,
  };
}

test('contexto de estudo: hidden pela flag', () => {
  assert.equal(attrsOf(df.studyContextRow(flags())).get('id'), 'study-context');
  assert.equal(attrsOf(df.studyContextRow(flags({studyContext: false}))).has('hidden'), true);
});

test('botão Editar da linha Vai junto: some com a flag do contexto de estudo', () => {
  const on = attrsOf(df.contextEditButton(flags()));
  assert.equal(on.get('id'), 'context-edit');
  assert.equal(on.has('hidden'), false);
  assert.equal(attrsOf(df.contextEditButton(flags({studyContext: false}))).has('hidden'), true);
  assert.equal(attrsOf(df.contextEditButton(flags({refsToggle: false}))).has('hidden'), false, 'a flag das referências não mexe na edição do contexto');
});

test('Conferir e divisor da calculadora: hidden SÓ pela flag (sem fato de plataforma)', () => {
  assert.equal(attrsOf(df.conferirButton(flags())).get('id'), 'check');
  assert.equal(attrsOf(df.conferirButton(flags())).has('hidden'), false, 'flag ligada: o botão existe em qualquer plataforma');
  assert.equal(attrsOf(df.conferirButton(flags({conferir: false}))).has('hidden'), true);
  assert.equal(attrsOf(df.calcDivider(flags())).get('id'), 'calc-divider');
  assert.equal(attrsOf(df.calcDivider(flags())).has('hidden'), false);
  assert.equal(attrsOf(df.calcDivider(flags({calculator: false}))).has('hidden'), true);
});
