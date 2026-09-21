import test from 'node:test';
import assert from 'node:assert/strict';

/* Contrato de attrs do aplicador: o primeiro attr de cada nome vence — a
   mesma política do `attrGet` (`core/view.bend:107-124`; lei
   `core/laws/view.bend:107-108`). O DOM falso é mínimo (só o que o
   aplicador usa) e guarda a fila de listeners de cada evento, para contar
   duplicatas (o `view-host.test.mjs` guarda só o último). */
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
    const queue = this.listeners.get(event) || [];
    queue.push(fn);
    this.listeners.set(event, queue);
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

const {build} = await import('../src/view-host.mjs');

const Nil = {$: 'Nil'};
const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const el = (tag, attrs = [], kids = []) => ({$: 'ViewEl', tag, attrs: list(...attrs), kids: list(...kids)});
const txt = (text) => ({$: 'ViewText', text});
const attr = (name, value) => ({$: 'ViewAttr', name, value});
const on = (event, handler) => ({$: 'ViewAttr', name: `on:${event}`, value: handler});

test('title/class/data-*/aria-* duplicados: o primeiro valor vence', () => {
  const built = build(el('div', [
    attr('title', 'primeiro'), attr('title', 'ultimo'),
    attr('class', 'a b'), attr('class', 'c d'),
    attr('data-id', '1'), attr('data-id', '2'),
    attr('aria-pressed', 'true'), attr('aria-pressed', 'false'),
  ]));
  assert.equal(built.attrs.get('title'), 'primeiro');
  assert.equal(built.attrs.get('class'), 'a b');
  assert.equal(built.attrs.get('data-id'), '1');
  assert.equal(built.attrs.get('aria-pressed'), 'true');
});

test('class/id vazios continuam pulados, mesmo com duplicata depois', () => {
  const built = build(el('div', [
    attr('class', ''), attr('class', 'depois'),
    attr('id', ''), attr('id', 'depois'),
    attr('hidden', ''),
  ]));
  assert.equal(built.attrs.has('class'), false);
  assert.equal(built.attrs.has('id'), false);
  assert.equal(built.attrs.get('hidden'), '');
});

test('on:click duplicado pendura um único listener (o primeiro)', () => {
  const primeiro = () => {};
  const ultimo = () => {};
  const built = build(el('button', [on('click', 'primeiro'), on('click', 'ultimo')]), {primeiro, ultimo});
  assert.equal(built.listeners.get('click').length, 1);
  assert.equal(built.listeners.get('click')[0], primeiro);
});

test('on:click duplicado: se o primeiro handler não existe, o segundo não assume', () => {
  const ultimo = () => {};
  const built = build(el('button', [on('click', 'fantasma'), on('click', 'ultimo')]), {ultimo});
  assert.equal(built.listeners.has('click'), false);
});

test('key duplicado: o primeiro vence; key único segue em dataset.key', () => {
  const dup = build(el('div', [attr('key', 'primeiro'), attr('key', 'ultimo')]));
  assert.equal(dup.dataset.key, 'primeiro');

  const single = build(el('div', [attr('key', 'item-7'), attr('title', 't')]));
  assert.equal(single.dataset.key, 'item-7');
  assert.equal(single.attrs.has('key'), false);
});

test('árvore sem duplicata: todos os attrs/listeners/dataset como antes', () => {
  const click = () => {};
  const built = build(el('button', [
    attr('key', 'send'),
    attr('class', 'primary'),
    attr('id', 'send'),
    attr('type', 'button'),
    attr('title', 'Enviar'),
    attr('data-role', 'acao'),
    attr('aria-pressed', 'false'),
    attr('hidden', ''),
    on('click', 'send'),
  ], [txt('Enviar')]), {send: click});
  assert.deepEqual([...built.attrs.entries()], [
    ['class', 'primary'],
    ['id', 'send'],
    ['type', 'button'],
    ['title', 'Enviar'],
    ['data-role', 'acao'],
    ['aria-pressed', 'false'],
    ['hidden', ''],
  ]);
  assert.equal(built.dataset.key, 'send');
  assert.deepEqual(built.listeners.get('click'), [click]);
  assert.equal(built.children.length, 1);
  assert.equal(built.children[0].tag, '#text');
  assert.equal(built.children[0].text, 'Enviar');
});

test('nomes aplicados são por elemento: irmãos repetem os mesmos attrs', () => {
  const tree = el('div', [], [
    el('i', [attr('class', 'x'), attr('title', 't')]),
    el('b', [attr('class', 'x'), attr('title', 't')]),
  ]);
  const built = build(tree);
  assert.equal(built.children[0].attrs.get('class'), 'x');
  assert.equal(built.children[0].attrs.get('title'), 't');
  assert.equal(built.children[1].attrs.get('class'), 'x');
  assert.equal(built.children[1].attrs.get('title'), 't');
});
