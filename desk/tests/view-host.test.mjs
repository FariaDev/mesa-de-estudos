import test from 'node:test';
import assert from 'node:assert/strict';

/* DOM falso mínimo: só o que o aplicador usa (movimentação de nós inclusive,
   como no DOM de verdade — o fragmento "puxa" o filho do holder). */
class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.text = '';
    this._html = '';
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
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  addEventListener(event, fn) {
    this.listeners.set(event, fn);
  }
  focus() {
    globalThis.document.activeElement = this;
  }
  contains(node) {
    for (let cur = node; cur; cur = cur.__parent) if (cur === this) return true;
    return false;
  }
  querySelector(selector) {
    const key = selector.startsWith('[data-key="') ? selector.slice(11, -2) : null;
    const id = selector.startsWith('#') ? selector.slice(1) : null;
    const walk = (node) => {
      for (const child of node.children) {
        if (key && child.dataset?.key === key) return child;
        if (id && child.attrs?.get('id') === id) return child;
        const hit = walk(child);
        if (hit) return hit;
      }
      return null;
    };
    return walk(this);
  }
  get firstChild() {
    return this.children[0];
  }
  get innerHTML() {
    return this._html;
  }
  set innerHTML(value) {
    this._html = String(value);
    this.children = [];
    this.append(Object.assign(new FakeNode('#html'), {text: String(value)}));
  }
}

globalThis.document = {
  activeElement: null,
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (text) => Object.assign(new FakeNode('#text'), {text: String(text)}),
  createDocumentFragment: () => new FakeNode('#frag'),
};
globalThis.CSS = {escape: (value) => String(value)};

const {build, childrenOf, htmlNode, preserveFocus, preserveScroll, renderChildren, renderInto} = await import('../src/view-host.mjs');

const Nil = {$: 'Nil'};
const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const el = (tag, attrs = [], kids = []) => ({$: 'ViewEl', tag, attrs: list(...attrs), kids: list(...kids)});
const txt = (text) => ({$: 'ViewText', text});
const attr = (name, value) => ({$: 'ViewAttr', name, value});
const on = (event, handler) => ({$: 'ViewAttr', name: `on:${event}`, value: handler});

test('build monta elemento, attrs, listeners e filhos na ordem', () => {
  const handlers = {send: () => {}};
  const node = el('button', [attr('class', 'primary'), attr('id', 'send'), attr('type', 'button'), on('click', 'send')], [txt('Enviar')]);
  const built = build(node, handlers);
  assert.equal(built.tag, 'button');
  assert.equal(built.attrs.get('class'), 'primary');
  assert.equal(built.attrs.get('id'), 'send');
  assert.equal(built.attrs.get('type'), 'button');
  assert.equal(built.listeners.get('click'), handlers.send);
  assert.equal(built.children.length, 1);
  assert.equal(built.children[0].tag, '#text');
  assert.equal(built.children[0].text, 'Enviar');
});

test('key vira dataset e class/id vazios são pulados', () => {
  const node = el('div', [attr('key', 'item-7'), attr('class', ''), attr('id', ''), attr('data-role', 'x')], []);
  const built = build(node);
  assert.equal(built.dataset.key, 'item-7');
  assert.equal(built.attrs.has('class'), false);
  assert.equal(built.attrs.has('id'), false);
  assert.equal(built.attrs.get('data-role'), 'x');
});

test('listener só é ligado para eventos conhecidos e handler existente', () => {
  const node = el('div', [on('click', 'nope'), on('teleport', 'yes')], []);
  const built = build(node, {yes: () => {}});
  assert.equal(built.listeners.size, 0);
});

test('htmlNode injeta HTML do host como fragmento', () => {
  const frag = build(htmlNode('<p>oi <b>tudo</b></p>'));
  assert.equal(frag.tag, '#frag');
  assert.equal(frag.children.length, 1);
  assert.equal(frag.children[0].tag, '#html');
  assert.equal(frag.children[0].text, '<p>oi <b>tudo</b></p>');
});

test('renderInto troca o conteúdo do pai', () => {
  const parent = new FakeNode('div');
  renderInto(parent, el('span', [], [txt('a')]));
  assert.equal(parent.children.length, 1);
  assert.equal(parent.children[0].tag, 'span');
  renderInto(parent, el('span', [], [txt('b')]));
  assert.equal(parent.children.length, 1);
  assert.equal(parent.children[0].children[0].text, 'b');
});

test('renderChildren aceita lista Bend e array JS', () => {
  const parent = new FakeNode('div');
  renderChildren(parent, list(el('i', [], []), el('b', [], [])));
  assert.deepEqual(parent.children.map((n) => n.tag), ['i', 'b']);
  renderChildren(parent, [el('u', [], [])]);
  assert.deepEqual(parent.children.map((n) => n.tag), ['u']);
});

test('childrenOf anda a lista Con/Nil', () => {
  const nodes = childrenOf(list(txt('a'), txt('b')));
  assert.deepEqual(nodes.map((n) => n.text), ['a', 'b']);
  assert.deepEqual(childrenOf(Nil), []);
});

test('preserveFocus repõe o foco pelo data-key depois do render', () => {
  const parent = new FakeNode('div');
  renderInto(parent, el('button', [attr('key', 'send')], [txt('ok')]));
  const before = parent.children[0];
  before.focus();
  assert.equal(document.activeElement, before);
  preserveFocus(parent, () => renderInto(parent, el('button', [attr('key', 'send')], [txt('ok 2')])));
  const after = parent.children[0];
  assert.notEqual(after, before);
  assert.equal(document.activeElement, after);
});

test('preserveFocus não mexe no foco quando o nó ativo não tem key/id', () => {
  const parent = new FakeNode('div');
  renderInto(parent, el('button', [], [txt('sem key')]));
  const before = parent.children[0];
  before.focus();
  preserveFocus(parent, () => renderInto(parent, el('button', [], [txt('sem key 2')])));
  assert.equal(document.activeElement, before);
});

test('preserveScroll devolve a rolagem do contêiner', () => {
  const scroller = {scrollTop: 120, scrollLeft: 5};
  preserveScroll(scroller, () => {
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
  });
  assert.equal(scroller.scrollTop, 120);
  assert.equal(scroller.scrollLeft, 5);
});
