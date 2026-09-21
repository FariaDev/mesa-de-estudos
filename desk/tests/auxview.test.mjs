import test from 'node:test';
import assert from 'node:assert/strict';

/* Contrato do artefato `auxview.core.js` (gerado de core/auxview.bend) para os
   controles auxiliares da Mesa: densidade, balão de dica e avisos.

   A árvore é conferida sem DOM (formato Con/Nil, como o view-host aplica) e,
   no fim, um DOM falso mínimo confere o que o aplicador monta de verdade:
   classes, attrs, `checked`/`hidden` e o `on:change` caindo na tabela de
   handlers. As leis do módulo ficam em core/proofs/auxview.bend; aqui é o que
   o app recebe pronto do artefato. */

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
      if (node.tag === '#frag') {
        this.append(...node.children);
        continue;
      }
      if (node.__parent) {
        const at = node.__parent.children.indexOf(node);
        if (at >= 0) node.__parent.children.splice(at, 1);
      }
      node.__parent = this;
      this.children.push(node);
    }
  }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }
  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  addEventListener(event, fn) {
    this.listeners.set(event, fn);
  }
  get firstChild() {
    return this.children[0];
  }
}

globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (text) => Object.assign(new FakeNode('#text'), {text: String(text)}),
  createDocumentFragment: () => new FakeNode('#frag'),
};

const {build, renderChildren} = await import('../src/view-host.mjs');
const aux = (await import('../src/generated/auxview.core.js')).default;

const Nil = {$: 'Nil'};
const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const nodes = (l) => {
  const out = [];
  for (let c = l; c && c.$ === 'Con'; c = c.tail) out.push(c.head);
  return out;
};
const attrsOf = (node) => {
  const out = {};
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out[a.head.name] = a.head.value;
  return out;
};
const textsOf = (node) => nodes(node.kids).map((k) => (k.$ === 'ViewText' ? k.text : null));
const classOf = (node) => attrsOf(node).class || '';
const prefs = (over = {}) => ({$: 'NotifyPrefs', sound: true, desktop: true, focused: false, ...over});
const mount = () => new FakeNode('div');

test('densidade: valor cru canoniza e a decisão do body.dense é do núcleo', () => {
  assert.equal(aux.densityValue(''), 'padrao');
  assert.equal(aux.densityValue('outro'), 'padrao');
  assert.equal(aux.densityValue('padrao'), 'padrao');
  assert.equal(aux.densityValue('compacta'), 'compacta');
  assert.equal(aux.densityDense('compacta'), true);
  assert.equal(aux.densityDense('padrao'), false);
});

test('densidade: opções na ordem, selected só no modo corrente e evento do contrato', () => {
  const sel = aux.densitySelect('compacta');
  assert.equal(sel.tag, 'select');
  assert.equal(attrsOf(sel).id, 'density-mode');
  assert.equal(attrsOf(sel)['on:change'], 'SetDensity');
  const options = nodes(sel.kids);
  assert.deepEqual(options.map((o) => o.tag), ['option', 'option']);
  assert.deepEqual(options.map((o) => attrsOf(o).value), ['padrao', 'compacta']);
  assert.equal('selected' in attrsOf(options[0]), false);
  assert.equal(attrsOf(options[1]).selected, '');
  assert.deepEqual(options.map((o) => textsOf(o)[0]), ['Padrão', 'Compacta']);
  const padrao = nodes(aux.densitySelect('padrao').kids);
  assert.equal(attrsOf(padrao[0]).selected, '');
  assert.equal('selected' in attrsOf(padrao[1]), false);
});

test('densidade: label com texto + select desenhado pelo núcleo', () => {
  const label = aux.densityControl('padrao');
  assert.equal(label.tag, 'label');
  assert.deepEqual(textsOf(label), ['Densidade', null]);
  assert.equal(nodes(label.kids)[1].tag, 'select');

  const box = mount();
  renderChildren(box, aux.densityFields('compacta'), {});
  assert.equal(box.children[0].tag, '#text');
  assert.equal(box.children[0].text, 'Densidade');
  assert.equal(box.children[1].tag, 'select');
  assert.equal(box.children[1].getAttribute('id'), 'density-mode');
  assert.equal(box.children[1].children[1].getAttribute('selected'), '');
});

test('densidade: o aplicador liga o change na tabela de handlers', () => {
  const handler = () => {};
  const sel = build(aux.densitySelect('padrao'), {SetDensity: handler});
  assert.equal(sel.listeners.get('change'), handler);
});

test('dica: classes tip/below, hidden de saída e texto', () => {
  assert.equal(classOf(aux.tooltipView(true, 'dica', false)), 'tip');
  assert.equal(classOf(aux.tooltipView(true, 'dica', true)), 'tip below');
  assert.equal(attrsOf(aux.tooltipView(true, 'dica', false)).hidden, undefined);

  const fechado = build(aux.tooltipView(false, 'dica', true));
  assert.equal(fechado.tag, 'div');
  assert.equal(fechado.getAttribute('class'), 'tip below');
  assert.equal(fechado.getAttribute('hidden'), '');
  assert.equal(fechado.children[0].text, 'dica');

  const aberto = build(aux.tooltipView(true, 'outra', false));
  assert.equal(aberto.getAttribute('hidden'), null);
  assert.equal(aberto.getAttribute('class'), 'tip');
  assert.equal(aberto.children[0].text, 'outra');
});

test('avisos: três linhas .set-check com ids, rótulos e checked do fato', () => {
  const rows = nodes(aux.notifyRows(prefs()));
  assert.deepEqual(rows.map((r) => r.tag), ['label', 'label', 'label']);
  assert.deepEqual(rows.map(classOf), ['set-check', 'set-check', 'set-check']);
  const inputs = rows.map((r) => nodes(r.kids)[0]);
  const spans = rows.map((r) => nodes(r.kids)[1]);
  assert.deepEqual(inputs.map((i) => attrsOf(i).id), ['notify-sound', 'notify-desktop', 'notify-focused']);
  assert.deepEqual(inputs.map((i) => attrsOf(i).type), ['checkbox', 'checkbox', 'checkbox']);
  assert.deepEqual(inputs.map((i) => attrsOf(i)['on:change']), ['SetNotify', 'SetNotify', 'SetNotify']);
  assert.deepEqual(inputs.map((i) => 'checked' in attrsOf(i)), [true, true, false]);
  assert.deepEqual(spans.map((s) => textsOf(s)[0]), ['Som', 'Notificação', 'Avisar mesmo com a janela em foco']);

  const off = nodes(aux.notifyRows(prefs({sound: false, focused: true})));
  assert.deepEqual(off.map((r) => 'checked' in attrsOf(nodes(r.kids)[0])), [false, true, true]);
});

test('avisos: o grupo mantém o contrato #notify-mode[role=group] e a legenda', () => {
  const group = aux.notifyGroup(prefs());
  assert.equal(group.tag, 'div');
  const attrs = attrsOf(group);
  assert.equal(attrs.id, 'notify-mode');
  assert.equal(attrs.class, 'set-group');
  assert.equal(attrs.role, 'group');
  assert.equal(attrs['aria-label'], 'Avisos de conclusão');
  assert.equal(nodes(group.kids).length, 4);
  assert.equal(nodes(group.kids)[0].tag, 'span');
  assert.equal(textsOf(nodes(group.kids)[0])[0], 'Avisos de conclusão');
});

test('avisos: aplicador monta as linhas no grupo e liga o change de cada uma', () => {
  const calls = [];
  const handlers = {SetNotify: (event) => calls.push(event.currentTarget.getAttribute('id'))};
  const group = mount();
  renderChildren(group, aux.notifyRows(prefs({focused: true})), handlers);
  assert.equal(group.children.length, 3);
  assert.equal(group.children[0].getAttribute('class'), 'set-check');
  assert.equal(group.children[0].children[0].getAttribute('id'), 'notify-sound');
  assert.equal(group.children[0].children[0].getAttribute('checked'), '');
  assert.equal(group.children[2].children[0].getAttribute('checked'), '');
  group.children[0].children[0].listeners.get('change')({currentTarget: group.children[0].children[0]});
  assert.deepEqual(calls, ['notify-sound']);
});

test('o artefato exporta as decisões e os construtores esperados', () => {
  const names = ['densityValue', 'densityDense', 'densityOption', 'densitySelect', 'densityFields', 'densityControl', 'tooltipClasses', 'tooltipView', 'checkRow', 'notifyLegend', 'notifyRows', 'notifyControls', 'notifyGroup'];
  for (const name of names) assert.equal(typeof aux[name], 'function', `auxview.${name}`);
  assert.deepEqual(nodes(aux.tooltipClasses(false)).map((c) => [c.name, c.on]), [['tip', true], ['below', false]]);
  assert.deepEqual(nodes(aux.tooltipClasses(true)).map((c) => [c.name, c.on]), [['tip', true], ['below', true]]);
  assert.equal(list().$, 'Nil');
});
