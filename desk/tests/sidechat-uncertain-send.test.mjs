/* Chat lateral no estado incerto: o botão Enviar desliga e nem clique nem
   Enter criam bolha nova (finding §5: `uncertain=true` com Enviar habilitado;
   cada clique pintava uma bolha que o canal recusava — `sidechat.mjs:431`,
   `:722`). O incerto só sai por "Novo".
   Sem Electron nem janela: DOM falso navegável + bridge falso nomeado. O
   `markup` (DOMPurify) não roda em Node, então os cenários ficam no incerto,
   onde nenhuma bolha nasce e nada é renderizado; o caminho feliz segue coberto
   na janela (`sidechat-ui-races.mjs`).
   Rodar: node --test --test-force-exit tests/sidechat-uncertain-send.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';

/* DOM falso mínimo e navegável: árvore real para `querySelector('#id')`,
   ouvintes disparáveis na mão e `DocumentFragment` que move os filhos, como
   no DOM de verdade. `innerHTML` é só texto (nada aqui parseia HTML). */
class FakeEl {
  constructor(tag) {
    this.tag = tag === '#frag' ? '#frag' : String(tag);
    this.children = [];
    this.attrs = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.parent = null;
    this.classList = {
      add: (...names) => this.#setClass(true, names),
      remove: (...names) => this.#setClass(false, names),
      toggle: (name, force) => {
        const has = this.className.split(/\s+/).includes(name);
        const next = force === undefined ? !has : !!force;
        this.#setClass(next, [name]);
        return next;
      },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
    this.style = {};
  }
  #setClass(on, names) {
    const kept = new Set(this.className.split(/\s+/).filter(Boolean));
    for (const name of names) {
      if (on) kept.add(name);
      else kept.delete(name);
    }
    this.className = [...kept].join(' ');
  }
  append(...nodes) {
    for (const node of nodes.flat()) {
      if (node == null) continue;
      if (typeof node !== 'object') continue;
      if (node.tag === '#frag') {
        this.append(...node.children);
        continue;
      }
      if (node.parent) node.remove();
      node.parent = this;
      this.children.push(node);
    }
    return this;
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((kid) => kid !== this);
    this.parent = null;
  }
  replaceChildren(...nodes) {
    for (const kid of [...this.children]) kid.remove();
    this.append(...nodes);
  }
  setAttribute(name, value) {
    this.attrs.set(String(name), String(value));
  }
  getAttribute(name) {
    return this.attrs.has(String(name)) ? this.attrs.get(String(name)) : null;
  }
  hasAttribute(name) {
    return this.attrs.has(String(name));
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.getAttribute('id') === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    return this.tag === selector;
  }
  querySelector(selector) {
    if (this.matches(selector)) return this;
    for (const kid of this.children) {
      const hit = kid.querySelector(selector);
      if (hit) return hit;
    }
    return null;
  }
  querySelectorAll(selector, out = []) {
    if (this.matches(selector)) out.push(this);
    for (const kid of this.children) kid.querySelectorAll(selector, out);
    return out;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) return node;
      node = node.parent;
    }
    return null;
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((kid) => kid.contains(node));
  }
  get isConnected() {
    return true;
  }
}

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
  setItem: (key, value) => {
    store.set(String(key), String(value));
  },
  removeItem: (key) => {
    store.delete(String(key));
  },
};
/* O HTML estático da Mesa não existe aqui: `document.querySelector` devolve um
   órfão estável por seletor (como `dom-shim.mjs`), só para os módulos
   instalarem ouvintes no import sem efeito. A árvore do lateral é navegável
   de verdade via `root.querySelector` do FakeEl. */
const orphans = new Map();
function orphanFor(selector) {
  if (!orphans.has(selector)) orphans.set(selector, new FakeEl('orphan'));
  return orphans.get(selector);
}
globalThis.document = {
  createElement: (tag) => new FakeEl(tag),
  createTextNode: (text) => Object.assign(new FakeEl('#text'), {textContent: String(text)}),
  createDocumentFragment: () => new FakeEl('#frag'),
  createTreeWalker: () => ({currentNode: null, nextNode() { return null; }}),
  getElementById: (id) => orphanFor(`#${id}`),
  querySelector: (selector) => orphanFor(selector),
  querySelectorAll: () => [],
  readyState: 'complete',
  addEventListener() {},
  removeEventListener() {},
  documentElement: new FakeEl('html'),
  body: new FakeEl('body'),
  head: new FakeEl('head'),
};
const windowTarget = new EventTarget();
windowTarget.document = globalThis.document;
windowTarget.localStorage = globalThis.localStorage;
windowTarget.location = {href: 'file:///x', protocol: 'file:'};
windowTarget.navigator = {userAgent: 'node', platform: 'linux', language: 'pt-BR'};
windowTarget.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
windowTarget.requestAnimationFrame = (fn) => setTimeout(fn, 0);
windowTarget.cancelAnimationFrame = clearTimeout;
windowTarget.desk = new Proxy({}, {
  get: (target, key) => {
    if (!(key in target)) target[key] = () => Promise.resolve(undefined);
    return target[key];
  },
  set: (target, key, value) => {
    target[key] = value;
    return true;
  },
});
globalThis.window = windowTarget;
for (const [key, value] of Object.entries({navigator: windowTarget.navigator, location: windowTarget.location})) {
  try {
    Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
  } catch {}
}
globalThis.requestAnimationFrame = windowTarget.requestAnimationFrame;
globalThis.cancelAnimationFrame = windowTarget.cancelAnimationFrame;
globalThis.getComputedStyle = () => ({getPropertyValue: () => ''});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
globalThis.confirm = () => true;
globalThis.CustomEvent = class extends Event {
  constructor(type, init = {}) {
    super(type);
    this.detail = init.detail;
  }
};
globalThis.NodeFilter = {SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3};
globalThis.CSS = {escape: (s) => String(s)};
for (const name of ['HTMLInputElement', 'HTMLTextAreaElement', 'SVGElement']) {
  globalThis[name] = class {};
}

const {fakeSidechatBridge} = await import('./fake-sidechat-bridge.mjs');
const sidechat = await import('../src/sidechat.mjs');

function freshMount({uncertain = false} = {}) {
  /* O estado do módulo é único: cada cenário começa do zero (sem id, sem
     mensagens, sem incerteza), como uma conversa recém-trocada. */
  sidechat.setSidechatVisible(false);
  sidechat.resetSidechat();
  const fake = fakeSidechatBridge();
  fake.setOpen({uncertain});
  sidechat.setSidechatBridge(fake.bridge);
  const container = new FakeEl('div');
  sidechat.mountSidechat(container);
  return {fake, root: container.querySelector('#sidechat')};
}

async function openVisible() {
  sidechat.setSidechatVisible(true);
  const state = sidechat.sidechatState();
  await state.opening;
  return state;
}

/** Dispara os ouvintes e devolve as promessas, para o teste assentar sem
 * `unhandled rejection` quando o envio falha no caminho. */
function fireClick(el) {
  return (el.listeners.get('click') || []).map((fn) => fn());
}
function fireEnter(el) {
  const event = {key: 'Enter', isComposing: false, shiftKey: false, preventDefault() {}};
  return (el.listeners.get('keydown') || []).map((fn) => fn(event));
}

test('incerto: Enviar desliga e o clique não cria bolha nem chama o canal', async () => {
  const {fake, root} = freshMount({uncertain: true});
  const state = await openVisible();
  assert.ok(state.id, 'o chat abre com o payload incerto do host');
  assert.equal(state.uncertain, true);
  const send = root.querySelector('#sidechat-send');
  assert.equal(send.disabled, true, 'o Enviar desliga no incerto (§5: habilitado era o defeito)');
  const prompt = root.querySelector('#sidechat-prompt');
  prompt.value = 'tentativa no incerto';
  await Promise.allSettled(fireClick(send));
  assert.equal(state.messages.length, 0, 'nenhuma bolha nova nasce no incerto');
  assert.equal(fake.prompts.length, 0, 'o canal nem é chamado no incerto');
});

test('incerto: Enter não cria bolha nem chama o canal', async () => {
  const {fake, root} = freshMount({uncertain: true});
  const state = await openVisible();
  assert.equal(state.uncertain, true);
  const prompt = root.querySelector('#sidechat-prompt');
  prompt.value = 'tentativa por Enter';
  await Promise.allSettled(fireEnter(prompt));
  assert.equal(state.messages.length, 0, 'Enter no incerto não cria bolha');
  assert.equal(fake.prompts.length, 0, 'Enter no incerto não chama o canal');
});

test('sem incerteza o Enviar segue habilitado (o fix não trava o normal)', async () => {
  const {root} = freshMount({uncertain: false});
  const state = await openVisible();
  assert.equal(state.uncertain, false);
  assert.equal(root.querySelector('#sidechat-send').disabled, false);
});
