import test from 'node:test';
import {ptText} from './pt-text.mjs';
import assert from 'node:assert/strict';

/* Contrato do artefato `slashview.core.js` (gerado de core/slashview.bend,
   compartilhado com a Conversa). A árvore é conferida aqui sem DOM: o mesmo
   formato `Con/Nil` que o view-host aplica. As leis do módulo ficam em
   core/proofs/slashview.bend; este teste cobre o que o app recebe pronto do
   artefato — casca, linhas, `key`, ARIA, handlers e o slot do check (o SVG é
   asset do host, trocado por cima do slot em `src/slash.mjs`). */

const sv = (await import('../src/generated/slashview.core.js')).default;

function kidsOf(node) {
  const out = [];
  for (let n = node.kids; n && n.$ === 'Con'; n = n.tail) out.push(n.head);
  return out;
}

/* `slashItemViews` devolve uma lista Con/Nil, não um nó. */
function rowsOf(xs) {
  const out = [];
  for (let n = xs; n && n.$ === 'Con'; n = n.tail) out.push(n.head);
  return out;
}

function attrsOf(node) {
  const out = new Map();
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out.set(String(a.head.name), ptText(String(a.head.value)));
  return out;
}

function classOf(node) {
  return attrsOf(node).get('class') || '';
}

function textOf(node) {
  return node && node.$ === 'ViewText' ? ptText(node.text) : '';
}

const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

const item = (key, hint, desc) => ({$: 'SlashItem', key, name: key, hint, desc});
const TWO = list(item('compact', '[instruções]', 'Resumir a conversa'), item('help', '', 'Mostrar os comandos'));
const BARE = list(item('status', '', ''));

/* .slash-text > .slash-name */
const nameKid = (row) => kidsOf(kidsOf(row)[0])[0];
/* .slash-text > .slash-desc */
const descKid = (row) => kidsOf(kidsOf(row)[0])[1];
/* .slash-name > .slash-arg */
const argKid = (row) => kidsOf(nameKid(row))[1];

test('casca: id, classe, style fixo, hidden do aberto/fechado e ordem dos filhos', () => {
  const closed = sv.slashMenuView(false, {$: 'Nil'}, '');
  assert.equal(closed.tag, 'div');
  const attrs = attrsOf(closed);
  assert.equal(attrs.get('id'), 'slash-menu');
  assert.equal(attrs.get('class'), 'slash-pop');
  assert.equal(attrs.get('style'), 'position:fixed;z-index:105', 'o CSS não carrega o fixo/z-index');
  assert.equal(attrs.has('hidden'), true, 'fechado nasce hidden');
  assert.equal(attrsOf(sv.slashMenuView(true, {$: 'Nil'}, '')).has('hidden'), false, 'aberto sem hidden');

  const [head, listNode, foot] = kidsOf(closed);
  assert.equal(classOf(head), 'slash-head');
  assert.equal(attrsOf(head).get('role'), 'presentation');
  assert.equal(textOf(kidsOf(head)[0]), 'Comandos');
  assert.equal(attrsOf(listNode).get('id'), 'slash-list');
  assert.equal(classOf(listNode), 'slash-list');
  assert.equal(attrsOf(listNode).get('role'), 'listbox');
  assert.equal(attrsOf(listNode).get('aria-label'), 'Comandos do Pi');
  assert.equal(classOf(foot), 'slash-foot');
  assert.equal(attrsOf(foot).get('role'), 'presentation');
  assert.equal(textOf(kidsOf(foot)[0]), '↑↓ navegar · ⏎ inserir · Esc fechar');
});

test('linha: nome /comando, dica de argumento e descrição', () => {
  const [first, second] = rowsOf(sv.slashItemViews(TWO, 'help'));
  assert.equal(classOf(kidsOf(first)[0]), 'slash-text');
  assert.equal(textOf(kidsOf(nameKid(first))[0]), '/compact');
  assert.equal(classOf(argKid(first)), 'slash-arg');
  assert.equal(textOf(kidsOf(argKid(first))[0]), '[instruções]');
  assert.equal(classOf(descKid(first)), 'slash-desc');
  assert.equal(textOf(kidsOf(descKid(first))[0]), 'Resumir a conversa');

  assert.equal(classOf(second), 'slash-item active');
  assert.equal(kidsOf(nameKid(second)).length, 1, 'sem argumentHint não nasce .slash-arg');
  assert.equal(kidsOf(kidsOf(second)[0]).length, 2, 'o .slash-text tem nome + descrição');
});

test('linha: sem dica nem descrição sobra só o nome', () => {
  const [row] = rowsOf(sv.slashItemViews(BARE, 'status'));
  assert.equal(kidsOf(kidsOf(row)[0]).length, 1, '.slash-text só com o nome');
  assert.equal(kidsOf(nameKid(row)).length, 1, '.slash-name só com o texto');
});

test('id do item: prefixo estável para o aria-activedescendant do campo', () => {
  assert.equal(sv.slashItemId(0), 'slash-opt-0');
  assert.equal(sv.slashItemId(9), 'slash-opt-9');
});

test('textos: cabeça, rótulo do listbox e rodapé', () => {
  assert.equal(ptText(sv.slashHeadText()), 'Comandos');
  assert.equal(ptText(sv.slashListLabel()), 'Comandos do Pi');
  assert.equal(ptText(sv.slashFootText()), '↑↓ navegar · ⏎ inserir · Esc fechar');
});
