import test from 'node:test';
import assert from 'node:assert/strict';

/* DOM falso mínimo: só o que o aplicador usa (movimentação de nós inclusive,
   como no DOM de verdade — o fragmento "puxa" o filho do holder). Esta região
   não usa o nó de HTML do host, então não há innerHTML aqui. */
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

const {build, childrenOf, renderChildren} = await import('../src/view-host.mjs');
const toastCore = (await import('../src/generated/toastview.core.js')).default;

const Toast = (text, closing) => ({$: 'Toast', text, closing});
const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});
const attrOf = (node, name) => {
  const found = toastCore['view.attrGet'](node.attrs, name);
  return found.$ === 'Some' ? found.value : null;
};

test('item aberto: div.toast-item com o texto', () => {
  const item = build(toastCore.toastItem(Toast('Expressão inválida.', false)));
  assert.equal(item.tag, 'div');
  assert.equal(item.getAttribute('class'), 'toast-item');
  assert.equal(item.children.length, 1);
  assert.equal(item.children[0].text, 'Expressão inválida.');
});

test('item saindo: closing e out entram no fim da lista de classes', () => {
  const item = build(toastCore.toastItem(Toast('Oi', true)));
  assert.equal(item.getAttribute('class'), 'toast-item closing out');
});

test('fila: ordem de inserção preservada e casca #toast[role=status]', () => {
  const box = build(toastCore.toastBox(list(Toast('primeiro', false), Toast('segundo', true))));
  assert.equal(box.tag, 'div');
  assert.equal(box.getAttribute('id'), 'toast');
  assert.equal(box.getAttribute('role'), 'status');
  assert.deepEqual(box.children.map((el) => el.getAttribute('class')), ['toast-item', 'toast-item closing out']);
  assert.deepEqual(box.children.map((el) => el.children[0].text), ['primeiro', 'segundo']);
  const empty = build(toastCore.toastBox(list()));
  assert.equal(empty.children.length, 0);
});

test('atividade simples: um texto e o title acompanhando (vazio limpa)', () => {
  const node = toastCore.activityView('Abrindo a sessão do Pi…');
  assert.equal(attrOf(node, 'id'), 'activity');
  assert.equal(attrOf(node, 'role'), 'status');
  assert.equal(attrOf(node, 'title'), 'Abrindo a sessão do Pi…');
  const mount = new FakeNode('div');
  renderChildren(mount, childrenOf(node.kids));
  assert.equal(mount.children.length, 1);
  assert.equal(mount.children[0].tag, '#text');
  assert.equal(mount.children[0].text, 'Abrindo a sessão do Pi…');
  const cleared = toastCore.activityView('');
  assert.equal(attrOf(cleared, 'title'), '');
  renderChildren(mount, childrenOf(cleared.kids));
  assert.equal(mount.children.length, 0);
});

test('atividade ao vivo: ponto pulsante + rótulo, title junto', () => {
  const node = toastCore.activityLiveView('Pi está pensando… · 3s');
  assert.equal(attrOf(node, 'id'), 'activity');
  assert.equal(attrOf(node, 'role'), 'status');
  assert.equal(attrOf(node, 'title'), 'Pi está pensando… · 3s');
  const mount = new FakeNode('div');
  renderChildren(mount, childrenOf(node.kids));
  assert.deepEqual(mount.children.map((el) => el.tag), ['span', 'span']);
  assert.equal(mount.children[0].getAttribute('class'), 'pulse');
  assert.equal(mount.children[0].getAttribute('aria-hidden'), 'true');
  assert.equal(mount.children[0].children.length, 0);
  assert.equal(mount.children[1].getAttribute('class'), 'activity-label');
  assert.equal(mount.children[1].children[0].text, 'Pi está pensando… · 3s');
  const empty = toastCore.activityLiveView('');
  assert.equal(attrOf(empty, 'title'), '');
  renderChildren(mount, childrenOf(empty.kids));
  assert.equal(mount.children.length, 0);
});
