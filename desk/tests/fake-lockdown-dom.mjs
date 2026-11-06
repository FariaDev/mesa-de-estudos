import {createRequire} from 'node:module';
import vm from 'node:vm';

/* DOM falso para o prelude de isolamento das atividades
   (`activity-lockdown-script.cjs`): exercita a guarda de inserção sem Electron.
   Só a árvore e os accessors que o prelude captura (firstChild/nextSibling/
   parentNode/localName/content/shadowRoot); sem layout, sem rede, sem parser:
   o fixture monta a árvore por ligação direta, como um DOMParser sem Trusted
   Types entregaria o nó. */

class FakeDomException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name || 'Error';
  }
}

function linkChildren(host, child) {
  if (child.nodeKind === 11) {
    const moved = child.childNodes.slice();
    child.childNodes = [];
    for (const grand of moved) {
      grand.parent = null;
      host.childNodes.push(grand);
      grand.parent = host;
    }
    return child;
  }
  child.parent = host;
  host.childNodes.push(child);
  return child;
}

function applyTreeMethods(proto) {
  proto.append = function (...items) {
    for (const item of items) this.appendChild(typeof item === 'string' ? new FakeText(item) : item);
    return undefined;
  };
  proto.prepend = function (...items) {
    for (const item of items.reverse()) this.insertBefore(typeof item === 'string' ? new FakeText(item) : item, this.firstChild);
    return undefined;
  };
  proto.replaceChildren = function (...items) {
    while (this.firstChild) this.removeChild(this.firstChild);
    for (const item of items) this.appendChild(typeof item === 'string' ? new FakeText(item) : item);
    return undefined;
  };
}

class FakeNode {
  constructor() {
    this.childNodes = [];
    this.parent = null;
    this.nodeKind = 1;
  }
  /* O prelude captura ESTE getter (do protótipo base) e o aplica a qualquer
     nó: ele lê o campo da instância, como o slot interno do DOM real. */
  get nodeType() { return this.nodeKind; }
  get nodeName() { return '#node'; }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() {
    if (!this.parent) return null;
    const siblings = this.parent.childNodes;
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  get parentNode() { return this.parent; }
  get isConnected() {
    let node = this;
    while (node) {
      if (node.isDocument) return true;
      node = node.parent;
    }
    return false;
  }
  appendChild(child) { return linkChildren(this, child); }
  insertBefore(child, ref) {
    if (child.nodeKind === 11) {
      const moved = child.childNodes.slice();
      child.childNodes = [];
      let at = ref ? this.childNodes.indexOf(ref) : -1;
      if (at < 0) at = this.childNodes.length;
      for (const grand of moved) {
        grand.parent = null;
        this.childNodes.splice(at, 0, grand);
        grand.parent = this;
        at += 1;
      }
      return child;
    }
    if (ref && this.childNodes.includes(ref)) {
      this.childNodes.splice(this.childNodes.indexOf(ref), 0, child);
      child.parent = this;
      return child;
    }
    return linkChildren(this, child);
  }
  replaceChild(next, prev) {
    const at = this.childNodes.indexOf(prev);
    if (at < 0) throw new FakeDomException('nó antigo não é filho', 'NotFoundError');
    this.childNodes.splice(at, 1, next);
    prev.parent = null;
    next.parent = this;
    return prev;
  }
  removeChild(child) {
    const at = this.childNodes.indexOf(child);
    if (at < 0) throw new FakeDomException('nó não é filho', 'NotFoundError');
    this.childNodes.splice(at, 1);
    child.parent = null;
    return child;
  }
}

function siblingsInsert(node, items, after) {
  if (!node.parent) return undefined;
  const parent = node.parent;
  let at = parent.childNodes.indexOf(node) + (after ? 1 : 0);
  for (const item of items) {
    const child = typeof item === 'string' ? new FakeText(item) : item;
    parent.childNodes.splice(at, 0, child);
    child.parent = parent;
    at += 1;
  }
  return undefined;
}

class FakeText extends FakeNode {
  constructor(text) {
    super();
    this.nodeKind = 3;
    this.textContent = String(text);
  }
  get nodeName() { return '#text'; }
  before(...items) { return siblingsInsert(this, items, false); }
  after(...items) { return siblingsInsert(this, items, true); }
  replaceWith(...items) {
    if (!this.parent) return undefined;
    const parent = this.parent;
    const at = parent.childNodes.indexOf(this);
    this.parent = null;
    parent.childNodes.splice(at, 1);
    for (const item of items) {
      const node = typeof item === 'string' ? new FakeText(item) : item;
      parent.childNodes.splice(at, 0, node);
      node.parent = parent;
    }
    return undefined;
  }
}

class FakeElement extends FakeNode {
  constructor(localName) {
    super();
    this.tag = String(localName);
    this.attrs = new Map();
    this.shadow = null;
  }
  /* Accessor de verdade no protótipo: o prelude o captura e o aplica até a
     instância que guarda a etiqueta no campo. */
  get localName() { return this.tag; }
  get nodeName() { return String(this.localName).toUpperCase(); }
  get shadowRoot() { return this.shadow; }
  attachShadow() {
    this.shadow = new FakeShadowRoot();
    return this.shadow;
  }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); return undefined; }
  setAttributeNS(_ns, name, value) { this.attrs.set(name, String(value)); return undefined; }
  getAttributeNames() { return [...this.attrs.keys()]; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); return undefined; }
  before(...items) { return siblingsInsert(this, items, false); }
  after(...items) { return siblingsInsert(this, items, true); }
  replaceWith(...items) {
    if (!this.parent) return undefined;
    const parent = this.parent;
    const at = parent.childNodes.indexOf(this);
    this.parent = null;
    parent.childNodes.splice(at, 1);
    for (const item of items) {
      const node = typeof item === 'string' ? new FakeText(item) : item;
      parent.childNodes.splice(at, 0, node);
      node.parent = parent;
    }
    return undefined;
  }
  insertAdjacentElement(where, element) {
    if (where === 'afterbegin') return this.insertBefore(element, this.firstChild);
    if (where === 'beforeend') return this.appendChild(element);
    if (!this.parent) return element;
    const parent = this.parent;
    const at = parent.childNodes.indexOf(this) + (where === 'afterend' ? 1 : 0);
    parent.childNodes.splice(at, 0, element);
    element.parent = parent;
    return element;
  }
  get innerHTML() { return ''; }
  set innerHTML(_value) { /* trocado pelo prelude em teste real; aqui só existe para o lock */ }
  get outerHTML() { return ''; }
  set outerHTML(_value) { }
  get insertAdjacentHTML() { return undefined; }
  set insertAdjacentHTML(_value) { }
}

class FakeFragment extends FakeNode {
  constructor() {
    super();
    this.nodeKind = 11;
  }
  get nodeName() { return '#document-fragment'; }
}

class FakeShadowRoot extends FakeFragment {
  get nodeName() { return '#shadow-root'; }
  get innerHTML() { return ''; }
  set innerHTML(_value) { }
}

class FakeTemplateElement extends FakeElement {
  constructor() {
    super('template');
    this.fragment = new FakeFragment();
  }
  get content() { return this.fragment; }
}

function isTemplateTag(tag) {
  return String(tag === undefined || tag === null ? '' : tag).toLowerCase() === 'template';
}

class FakeRange {
  constructor() {
    this.container = null;
  }
  selectNodeContents(node) { this.container = node; return undefined; }
  createContextualFragment() { return new FakeFragment(); }
  insertNode(node) {
    if (this.container) this.container.appendChild(node);
    return undefined;
  }
  surroundContents(node) {
    if (this.container) this.container.appendChild(node);
    return undefined;
  }
}

class FakeDocument extends FakeNode {
  constructor() {
    super();
    this.nodeKind = 9;
    this.root = new FakeElement('html');
    this.root.parent = this;
    this.root.childNodes = [];
    this.bodyNode = new FakeElement('body');
    this.root.appendChild(this.bodyNode);
  }
  get isDocument() { return true; }
  get nodeName() { return '#document'; }
  get documentElement() { return this.root; }
  get body() { return this.bodyNode; }
  get implementation() { return null; }
  createElement(tag) { return isTemplateTag(tag) ? new FakeTemplateElement() : new FakeElement(tag); }
  createElementNS(_ns, tag) { return isTemplateTag(tag) ? new FakeTemplateElement() : new FakeElement(tag); }
  createRange() { return new FakeRange(); }
  write() { throw new FakeDomException('document.write indisponível', 'NotSupportedError'); }
  writeln() { throw new FakeDomException('document.writeln indisponível', 'NotSupportedError'); }
  open() { throw new FakeDomException('document.open indisponível', 'NotSupportedError'); }
  close() { throw new FakeDomException('document.close indisponível', 'NotSupportedError'); }
  execCommand() { return false; }
}

applyTreeMethods(FakeElement.prototype);
applyTreeMethods(FakeFragment.prototype);
applyTreeMethods(FakeDocument.prototype);

class FakeMutationObserver {
  constructor(_callback) { }
  observe() { return undefined; }
  disconnect() { return undefined; }
}

const FakeNodeList = {prototype: {item(index) { return this[index]; }}};

/**
 * Sobe o prelude de isolamento sobre o DOM falso e devolve o reino para o teste.
 * @returns {{window: object, document: FakeDocument, mintLink: () => FakeElement, graft: (parent: FakeNode, child: FakeNode) => FakeNode, FakeElement: typeof FakeElement, FakeFragment: typeof FakeFragment}}
 * @example const {document, mintLink} = loadActivityLockdown();
 */
export function loadActivityLockdown() {
  const document = new FakeDocument();
  const trusted = {createPolicy: (_name, rules) => ({createHTML: (value) => rules.createHTML(value)})};
  const window = {
    DOMException: FakeDomException,
    HTMLTemplateElement: FakeTemplateElement,
    trustedTypes: trusted,
    open: undefined,
  };
  const navigator = {};
  const sandbox = {
    window,
    document,
    navigator,
    MutationObserver: FakeMutationObserver,
    NodeList: FakeNodeList,
    DOMException: FakeDomException,
    Document: FakeDocument,
    ShadowRoot: FakeShadowRoot,
    Element: FakeElement,
    CharacterData: FakeText,
    Node: FakeNode,
    DocumentFragment: FakeFragment,
    Range: FakeRange,
    Object,
    Reflect,
    String,
    Array,
  };
  vm.createContext(sandbox);
  const require = createRequire(import.meta.url);
  const {LOCKDOWN_SCRIPT} = require('../activity-lockdown-script.cjs');
  vm.runInContext(LOCKDOWN_SCRIPT, sandbox);
  const mintLink = () => {
    const link = new FakeElement('link');
    link.setAttribute('rel', 'dns-prefetch');
    link.setAttribute('href', 'https://evil.example/x');
    return link;
  };
  /* Liga o filho ao pai sem passar pela guarda — como um DOMParser sem Trusted
     Types entregaria o nó. Só para montar fixture aninhada no teste. */
  const graft = (parent, child) => linkChildren(parent, child);
  return {window, document, mintLink, graft, FakeElement, FakeFragment};
}
