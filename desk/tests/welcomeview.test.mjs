import test from 'node:test';
import assert from 'node:assert/strict';

/* Contrato do artefato `welcomeview.core.js` (gerado de core/welcomeview.bend)
   com o aplicador de verdade (`view-host.mjs`): o vazio da conversa é montado
   pelo host no `#messages` e o clique do botão cai na tabela de handlers.

   DOM falso mínimo: só o que o aplicador usa (movimentação de nós inclusive,
   como no DOM de verdade — o fragmento "puxa" o filho do holder). Como no
   teste do toast, esta região não usa o nó de HTML do host. */
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
  removeAttribute(name) {
    this.attrs.delete(name);
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

const {renderInto} = await import('../src/view-host.mjs');
const welcomeCore = (await import('../src/generated/welcomeview.core.js')).default;

const attrOf = (node, name) => {
  const found = welcomeCore['view.attrGet'](node.attrs, name);
  return found.$ === 'Some' ? found.value : null;
};
const textOf = (node) => node.children.map((el) => el.text).join('');

/* Monta o vazio num `#messages` falso e devolve o `#welcome` (o applier troca
   os filhos do mount, como o host faz com `renderInto`). */
const mountWelcome = (title, handlers) => {
  const mount = new FakeNode('div');
  renderInto(mount, welcomeCore.welcomeView(title), handlers);
  return mount.children[0];
};

test('vazio com título: h3 + botão + parágrafo no #welcome', () => {
  const node = welcomeCore.welcomeView('Matéria B');
  assert.equal(node.tag, 'div');
  assert.equal(attrOf(node, 'id'), 'welcome');
  const box = mountWelcome('Matéria B');
  assert.equal(box.tag, 'div');
  assert.equal(box.getAttribute('id'), 'welcome');
  assert.deepEqual(box.children.map((el) => el.tag), ['h3', 'button', 'p']);
  assert.equal(textOf(box.children[0]), 'Matéria B');
  assert.equal(textOf(box.children[2]), 'Sessão local desta matéria.');
});

test('vazio de boot: sem título não nasce h3 vazio', () => {
  const box = mountWelcome('');
  assert.deepEqual(box.children.map((el) => el.tag), ['button', 'p']);
});

test('botão Conectar ao Pi: id/type do contrato e handler do view-host', () => {
  let called = 0;
  const box = mountWelcome('', {Connect: () => { called++; }});
  const button = box.children[0];
  assert.equal(button.getAttribute('id'), 'connect');
  assert.equal(button.getAttribute('type'), 'button');
  assert.equal(textOf(button), 'Conectar ao Pi');
  assert.equal(typeof button.listeners.get('click'), 'function');
  button.listeners.get('click')();
  assert.equal(called, 1);
});

test('troca de matéria troca o título do vazio no mount vivo', () => {
  assert.equal(textOf(mountWelcome('Matéria A').children[0]), 'Matéria A');
  const box = mountWelcome('Matéria B');
  assert.deepEqual(box.children.map((el) => el.tag), ['h3', 'button', 'p']);
  assert.equal(textOf(box.children[0]), 'Matéria B');
});
