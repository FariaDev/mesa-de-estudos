import test from 'node:test';
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
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out.set(String(a.head.name), String(a.head.value));
  return out;
}

function classOf(node) {
  return attrsOf(node).get('class') || '';
}

function textOf(node) {
  return node && node.$ === 'ViewText' ? node.text : '';
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

test('linhas: id por índice, key, papel, ARIA e handlers do host', () => {
  const [, listNode] = kidsOf(sv.slashMenuView(true, TWO, 'compact'));
  const [first, second] = kidsOf(listNode);
  const attrsFirst = attrsOf(first);
  assert.equal(classOf(first), 'slash-item active', 'o ativo acende a classe na ordem do CSS');
  assert.equal(attrsFirst.get('id'), 'slash-opt-0');
  assert.equal(attrsFirst.get('key'), 'compact', 'a key é a identidade da linha');
  assert.equal(attrsFirst.get('role'), 'option');
  assert.equal(attrsFirst.get('aria-selected'), 'true');
  assert.equal(attrsFirst.get('on:mousedown'), 'hold', 'não tira o foco do campo');
  assert.equal(attrsFirst.get('on:mouseenter'), 'hover');
  assert.equal(attrsFirst.get('on:click'), 'pick');

  assert.equal(classOf(second), 'slash-item');
  assert.equal(attrsOf(second).get('id'), 'slash-opt-1');
  assert.equal(attrsOf(second).get('key'), 'help');
  assert.equal(attrsOf(second).get('aria-selected'), 'false');
});

test('linhas: sem ativo nenhuma acende; id cresce na ordem da lista', () => {
  const rows = rowsOf(sv.slashItemViews(TWO, ''));
  assert.deepEqual(rows.map(classOf), ['slash-item', 'slash-item']);
  assert.deepEqual(rows.map((r) => attrsOf(r).get('id')), ['slash-opt-0', 'slash-opt-1']);
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

test('check: slot nasce em toda linha e o SVG é do host', () => {
  const [first] = rowsOf(sv.slashItemViews(TWO, 'compact'));
  const check = kidsOf(first)[1];
  assert.equal(classOf(check), 'slash-check');
  assert.equal(attrsOf(check).get('aria-hidden'), 'true');
  assert.equal(textOf(kidsOf(check)[0]), 'check', 'nome do ícone que o host materializa');
});

test('id do item: prefixo estável para o aria-activedescendant do campo', () => {
  assert.equal(sv.slashItemId(0n), 'slash-opt-0');
  assert.equal(sv.slashItemId(9n), 'slash-opt-9');
});

test('textos: cabeça, rótulo do listbox e rodapé', () => {
  assert.equal(sv.slashHeadText(), 'Comandos');
  assert.equal(sv.slashListLabel(), 'Comandos do Pi');
  assert.equal(sv.slashFootText(), '↑↓ navegar · ⏎ inserir · Esc fechar');
});
