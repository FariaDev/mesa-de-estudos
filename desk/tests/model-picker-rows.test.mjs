/* Seletor de modelo, linhas (`src/model-picker-rows.mjs`): nome e nota cortados
   com reticências mostram o texto completo no `title` (G8), sem mudar o layout.
   Só quando houver texto: linha sem nota não ganha `title` vazio.
   Roda: node --test tests/model-picker-rows.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
 constructor(tag) {
  this.tagName = String(tag).toUpperCase();
  this.children = [];
  this.attributes = {};
  this.dataset = {};
  this.style = {};
  this._listeners = {};
  this._text = '';
  this._className = '';
  this.value = '';
  this.hidden = false;
  this.open = false;
  this.disabled = false;
  this.id = '';
 }
 get textContent() {
  if (this._text) return this._text;
  return this.children.map((kid) => kid.textContent).join('');
 }
 set textContent(value) {
  this.children = [];
  this._text = String(value);
 }
 get className() { return this._className; }
 set className(value) { this._className = String(value); }
 get classList() {
  const self = this;
  return {
   add: (...names) => { self._className = [self._className, ...names].filter(Boolean).join(' '); },
   toggle() {},
   contains: (name) => self._className.split(' ').includes(name),
   remove() {},
  };
 }
 set title(value) { this.setAttribute('title', value); }
 get title() { return this.getAttribute('title') || ''; }
 append(...kids) {
  for (const kid of kids.flat()) {
   if (kid == null || kid === false) continue;
   const node = typeof kid === 'string' ? Object.assign(new FakeNode('#text'), {_text: kid}) : kid;
   node.parentNode = this;
   this.children.push(node);
  }
 }
 prepend(...kids) {
  for (const kid of [...kids].flat().reverse()) {
   if (kid == null || kid === false) continue;
   const node = typeof kid === 'string' ? Object.assign(new FakeNode('#text'), {_text: kid}) : kid;
   node.parentNode = this;
   this.children.unshift(node);
  }
 }
 replaceChildren(...kids) { this.children = []; this.append(...kids); }
 setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = String(value); }
 getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
 hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
 removeAttribute(name) { delete this.attributes[name]; }
 addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
 remove() {
  if (!this.parentNode) return;
  const at = this.parentNode.children.indexOf(this);
  if (at >= 0) this.parentNode.children.splice(at, 1);
  this.parentNode = null;
 }
 querySelector(selector) { return find(this, selector); }
 querySelectorAll(selector) { return findAll(this, selector); }
 closest() { return this; }
 focus() {}
 get firstChild() { return this.children[0] || null; }
 get innerHTML() { return ''; }
 set innerHTML(value) { this._html = String(value); }
}

function matches(node, selector) {
 if (selector.startsWith('#')) return node.id === selector.slice(1);
 if (selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
 return node.tagName === selector.toUpperCase();
}

function find(node, selector) {
 for (const kid of node.children) {
  if (matches(kid, selector)) return kid;
  const hit = find(kid, selector);
  if (hit) return hit;
 }
 return null;
}

function findAll(node, selector, out = []) {
 for (const kid of node.children) {
  if (matches(kid, selector)) out.push(kid);
  findAll(kid, selector, out);
 }
 return out;
}

const body = new FakeNode('body');
globalThis.document = {
 body,
 documentElement: new FakeNode('html'),
 querySelectorAll: () => [],
 createElement: (tag) => new FakeNode(tag),
 createDocumentFragment: () => new FakeNode('fragment'),
 createTreeWalker: () => ({nextNode: () => false, currentNode: null}),
 getElementById: (id) => find(body, `#${id}`),
};
globalThis.window = Object.assign(new EventTarget(), {desk: {initialLanguage: 'pt-BR'}});
globalThis.NodeFilter = {SHOW_TEXT: 4};

const rows = await import('../src/model-picker-rows.mjs');

const itemOf = (over = {}) => ({
 key: '["xai","grok-4"]', provider: 'xai', id: 'grok-4',
 name: 'Grok 4 com um nome bem longo para cortar na linha', vendor: '', short: 'Grok 4',
 providerName: 'xAI', free: false, zenPaid: false, favorite: false, notes: [],
 facts: {context: 200000, vision: true, reasoning: true, price: {input: 1, output: 2}},
 ...over,
});

test('G8: o nome cortado mostra o texto completo no title', () => {
 const row = rows.itemRow(itemOf(), {selectedKey: '', short: false, kind: 'provider', engine: 'pi'}, 0);
 const name = row.querySelector('.model-row-name');
 assert.equal(name?.textContent, 'Grok 4 com um nome bem longo para cortar na linha');
 assert.equal(name?.title, 'Grok 4 com um nome bem longo para cortar na linha');
});

test('G8: a nota cortada mostra o texto completo no title', () => {
 const row = rows.itemRow(itemOf(), {selectedKey: '', short: false, kind: 'provider', engine: 'pi'}, 0);
 const note = row.querySelector('.model-row-note');
 assert.match(note?.textContent || '', /200 mil/);
 assert.equal(note?.title, note?.textContent);
 assert.ok((note?.title || '').length > 0);
});

test('G8: sem nota não há title vazio na linha da nota', () => {
 const row = rows.itemRow(itemOf({facts: {context: 0, vision: false, reasoning: false, price: null}}), {selectedKey: '', short: false, kind: 'recent', engine: 'pi'}, 0);
 assert.equal(row.querySelector('.model-row-note'), null);
});
