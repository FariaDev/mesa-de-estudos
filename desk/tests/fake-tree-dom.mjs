// DOM mínimo com nós de verdade (tipo, nome, filhos, atributos, dataset) para
// testar o `patchTree` do view-host no node (#70): só o que o aplicador e o
// patch tocam. Instale com `installFakeTreeDocument()` antes de importar o
// view-host.

class FakeTreeNode {
  /** @param {number} nodeType @param {string} nodeName */
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.nodeValue = null;
    /** @type {FakeTreeNode[]} */
    this.childNodes = [];
    /** @type {FakeTreeNode|null} */
    this.parentNode = null;
  }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get firstChild() { return this.childNodes[0] ?? null; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.nodeType === 11) { this.append(...node.childNodes); continue; }
      node.remove();
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const node of [...this.childNodes]) node.remove();
    this.append(...nodes);
  }
  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.childNodes;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }
  replaceWith(node) {
    const parent = this.parentNode;
    const at = parent.childNodes.indexOf(this);
    node.remove();
    parent.childNodes[at] = node;
    node.parentNode = parent;
    this.parentNode = null;
  }
  get textContent() {
    return this.nodeType === 3 ? this.nodeValue : this.childNodes.map((node) => node.textContent).join('');
  }
}

class FakeTreeElement extends FakeTreeNode {
  /** @param {string} tag */
  constructor(tag) {
    super(1, tag.toUpperCase());
    /** @type {Map<string,string>} */
    this.attributes = new Map();
    /** @type {Map<string,Function>} */
    this.listeners = new Map();
    const element = this;
    this.dataset = new Proxy({}, {
      get: (_, key) => element.getAttribute(dataName(key)) ?? undefined,
      set: (_, key, value) => { element.setAttribute(dataName(key), value); return true; },
      deleteProperty: (_, key) => { element.removeAttribute(dataName(key)); return true; },
    });
  }
  getAttributeNames() { return [...this.attributes.keys()]; }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(event, fn) { this.listeners.set(event, fn); }
}

const dataName = (key) => `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/** Põe `document` falso no global e o devolve. */
export function installFakeTreeDocument() {
  const fakeDocument = {
    createElement: (tag) => new FakeTreeElement(tag),
    createTextNode: (text) => Object.assign(new FakeTreeNode(3, '#text'), {nodeValue: String(text)}),
    createDocumentFragment: () => new FakeTreeNode(11, '#document-fragment'),
  };
  globalThis.document = fakeDocument;
  return fakeDocument;
}
