import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.text = '';
    this.__parent = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.tag === '#frag') { this.append(...node.children); continue; }
      node.__parent = this;
      this.children.push(node);
    }
  }
  setAttribute(name, value) { this.attrs.set(String(name), String(value)); }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  get firstChild() { return this.children[0]; }
}

globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (text) => Object.assign(new FakeNode('#text'), {text: String(text)}),
  createDocumentFragment: () => new FakeNode('#frag'),
};

const shortcut = (await import('../src/generated/shortcutview.core.js')).default;
const {build} = await import('../src/view-host.mjs');

const Nil = {$: 'Nil'};
const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const nodes = (xs) => {
  const out = [];
  for (let cur = xs; cur?.$ === 'Con'; cur = cur.tail) out.push(cur.head);
  return out;
};
const attrs = (node) => Object.fromEntries(nodes(node.attrs).map((attr) => [attr.name, attr.value]));
const text = (node) => nodes(node.kids).map((kid) => kid.$ === 'ViewText' ? kid.text : '').join('');

const sections = () => list(
  shortcut.skSection('keys-group-0', 'Estudar', list(
    shortcut.skRow('check', 'Conferir Xournal++', '⌘⇧C', false, '', true),
    shortcut.skRow('stop', 'Parar a resposta', 'Esc', true, '', false),
  )),
  shortcut.skSection('keys-group-1', 'Arquivo', list(
    shortcut.skRow('new-course', 'Nova matéria', '', false, '', false),
  )),
);
const fact = (over = {}) => shortcut.skDialog(
  over.open ?? false,
  over.capturing ?? '',
  over.conflict ?? false,
  over.status ?? '',
  over.kind ?? 'info',
  over.hasOverrides ?? true,
  sections(),
);

test('diálogo e seções preservam o contrato de DOM e a ordem', () => {
  const dialog = shortcut.shortcutDialog(fact());
  assert.equal(dialog.tag, 'dialog');
  assert.deepEqual(attrs(dialog), {id: 'keys-dialog', 'aria-labelledby': 'keys-title'});
  const [head, groups, status, footer] = nodes(dialog.kids);
  assert.equal(attrs(head).class, 'keys-head');
  assert.equal(text(nodes(head.kids)[0]), 'Atalhos de teclado');
  assert.equal(attrs(groups).class, 'keys-groups');
  assert.deepEqual(nodes(groups.kids).map((section) => text(nodes(section.kids)[0])), ['Estudar', 'Arquivo']);
  assert.equal(attrs(status).role, 'status');
  assert.equal(footer.tag, 'menu');
});

test('linha usa key/data-action, tecla efetiva e estado de gravação', () => {
  const groups = nodes(shortcut.shortcutDialog(fact({capturing: 'check'})).kids)[1];
  const row = nodes(nodes(groups.kids)[0].kids)[1];
  const rowAttrs = attrs(row);
  assert.equal(rowAttrs.key, 'check');
  assert.equal(rowAttrs['data-action'], 'check');
  assert.equal(rowAttrs.class, 'keys-row recording');
  const [, kbd, record, reset] = nodes(row.kids);
  assert.equal(text(kbd), 'Gravando…');
  assert.equal(attrs(kbd)['aria-label'], 'Gravando novo atalho para Conferir Xournal++');
  assert.equal(text(record), 'Cancelar');
  assert.equal(attrs(record)['aria-pressed'], 'true');
  assert.equal(attrs(reset).hidden, undefined, 'override deixa Resetar visível');
});

test('linha fixa traz nota e linha sem tecla traz o fallback', () => {
  const groups = nodes(shortcut.shortcutDialog(fact()).kids)[1];
  const firstSection = nodes(groups.kids)[0];
  const fixed = nodes(firstSection.kids)[2];
  assert.equal(attrs(fixed).class, 'keys-row is-fixed');
  assert.deepEqual(nodes(fixed.kids).map(text), ['Parar a resposta', 'Esc', 'fixo']);
  const empty = nodes(nodes(groups.kids)[1].kids)[1];
  assert.equal(text(nodes(empty.kids)[1]), 'Sem atalho');
  assert.equal(attrs(nodes(empty.kids)[1]).class, 'keys-kbd empty');
  assert.equal(attrs(nodes(empty.kids)[3]).hidden, '');
});

test('aberto, conflito e ações disabled/hidden são fatos do núcleo', () => {
  const dialog = shortcut.shortcutDialog(fact({open: true, conflict: true, status: 'Conflito', hasOverrides: false}));
  assert.equal(attrs(dialog).open, '');
  const [, , status, footer] = nodes(dialog.kids);
  assert.equal(attrs(status)['data-kind'], 'error');
  assert.equal(text(status), 'Conflito');
  const [resetAll] = nodes(footer.kids);
  assert.equal(attrs(resetAll).disabled, '');
});

test('view-host aplica key como dataset e liga as ações pela tabela', () => {
  const calls = [];
  const handlers = {Record: () => calls.push('record'), Reset: () => calls.push('reset')};
  const row = build(shortcut.skRowNode(shortcut.skRow('check', 'Conferir', '⌘⇧C', false, '', true), ''), handlers);
  assert.equal(row.dataset.key, 'check');
  assert.equal(row.attrs.get('data-action'), 'check');
  assert.equal(row.children[2].dataset.key, 'keys-rec-check');
  assert.equal(row.children[2].listeners.get('click'), handlers.Record);
  assert.equal(row.children[3].listeners.get('click'), handlers.Reset);
});

test('artefato exporta os construtores públicos do editor', () => {
  for (const name of ['skRow', 'skSection', 'skDialog', 'skRowNode', 'skSectionNodes', 'skStatusNode', 'skFooterNode', 'skDialogChildren', 'shortcutDialog']) {
    assert.equal(typeof shortcut[name], 'function', `shortcutview.${name}`);
  }
});
