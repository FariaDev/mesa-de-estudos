/* Aviso "Desfazer" (`desk/src/undo-deletion.mjs`) com DOM de mentira.
 *
 * Prova o que a tela faz: aviso acessível (status/alert, rótulos completos),
 * botão Desfazer chamando o host certo (Caderno ou Anotações), mensagem de
 * sucesso/erro visível, contador que esconde a tela SEM chamar o host (os dados
 * de recuperação continuam no processo) e troca de escopo que desativa o aviso.
 * Sem Electron e sem tocar em dado real. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {useUndoviewCore} from './undo-core-build.mjs';

const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src');
const core = (await import(pathToFileURL(useUndoviewCore()).href)).default;

/* ---------- DOM mínimo ---------- */

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this._text = '';
    this._className = '';
    this._listeners = {};
    this.hidden = false;
    this.disabled = false;
    this.title = '';
  }
  get className() { return this._className; }
  set className(value) { this._className = String(value); }
  get textContent() {
    if (this._text) return this._text;
    return this.children.map((kid) => kid.textContent).join('');
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get id() { return this.attributes.id || ''; }
  append(...kids) {
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      const node = typeof kid === 'string' ? new FakeNode('#text') : kid;
      if (typeof kid === 'string') node._text = kid;
      node.parentNode = this;
      this.children.push(node);
    }
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this._listeners[type] = (this._listeners[type] || []).filter((one) => one !== fn); }
  dispatch(type, extra = {}) {
    const event = {target: this, currentTarget: this, preventDefault() {}, ...extra};
    for (const fn of this._listeners[type] || []) fn(event);
  }
  querySelector(selector) { return find(this, selector); }
  querySelectorAll(selector) { return findAll(this, selector); }
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

function installDom() {
  const body = new FakeNode('body');
  const document = {
    body,
    activeElement: null,
    createElement: (tag) => new FakeNode(tag),
    getElementById: (id) => find(body, `#${id}`),
  };
  return {body, document};
}

/* Relógio de mentira: o teste decide quando o contador anda. */
function fakeClock(start = 10_000) {
  let now = start;
  let seq = 0;
  const jobs = new Map();
  const timers = {
    setInterval(fn, ms) { const id = ++seq; jobs.set(id, {fn, ms, at: now + ms, repeat: true}); return id; },
    clearInterval(id) { jobs.delete(id); },
    setTimeout(fn, ms) { const id = ++seq; jobs.set(id, {fn, ms, at: now + ms, repeat: false}); return id; },
    clearTimeout(id) { jobs.delete(id); },
  };
  return {
    now: () => now,
    advance(ms) {
      const target = now + ms;
      for (let guard = 0; guard < 100000; guard += 1) {
        const next = [...jobs.entries()].filter(([, job]) => job.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, job] = next;
        now = job.at;
        if (job.repeat) job.at = now + job.ms;
        else jobs.delete(id);
        job.fn();
      }
      now = target;
    },
    timers,
  };
}

let version = 0;
async function loadNotice({document, timers, now, host}) {
  version += 1;
  const module = await import(`${pathToFileURL(join(SRC, 'undo-deletion.mjs')).href}?v=${version}`);
  module.initUndoNotice({document, window: {}, core, timers, now, host});
  return module;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('falha transitória permite repetir Desfazer com o mesmo token', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const calls = [];
  const host = {reviewUndo: async payload => {
    calls.push(payload);
    if (calls.length === 1) throw new Error('disco cheio');
    return {ok: true, items: []};
  }};
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  await notice.showUndoNotice({token: 'u-tok', expiresAt: clock.now() + 25000, scopeKey: 'A'});
  const root = document.getElementById('undo-notice');
  const button = root.querySelector('.undo-notice-undo');
  button.dispatch('click');
  await tick();
  assert.equal(root.querySelector('.undo-notice-error').hidden, false);
  assert.equal(button.disabled, false);
  clock.advance(500);
  button.dispatch('click');
  await tick();
  assert.deepEqual(calls, [{token: 'u-tok'}, {token: 'u-tok'}]);
  assert.equal(root.querySelector('.undo-notice-error').hidden, true);
  assert.equal(button.disabled, true);
  assert.equal(root.querySelector('.undo-notice-text').textContent, 'Item devolvido ao caderno.');
});

function fakeHost() {
  const calls = [];
  const host = {
    calls,
    reviewUndo: async (payload) => { calls.push(['review', payload]); return {ok: true, items: [{id: 'n-1'}]}; },
    studyNotesUndo: async (payload) => { calls.push(['note', payload]); return {ok: true, items: [{id: 'n-2'}]}; },
  };
  return host;
}

test('callback atrasado não fecha um novo aviso de exclusão', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  await notice.showUndoNotice({token: 'first', expiresAt: clock.now() + 25000, onUndone: () => waiting});
  document.getElementById('undo-notice').querySelector('.undo-notice-undo').dispatch('click');
  await tick();
  await notice.showUndoNotice({token: 'second', kind: 'note', expiresAt: clock.now() + 25000});
  release();
  await tick();
  clock.advance(4000);
  assert.equal(notice.isUndoNoticeVisible(), true);
  assert.equal(document.getElementById('undo-notice').querySelector('.undo-notice-text').textContent, 'Anotação removida.');
});

test('o aviso aparece com rótulos do núcleo, sem depender do toast', async () => {
  const {body, document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  await notice.showUndoNotice({kind: 'review', token: 'u-tok', expiresAt: clock.now() + 25000, scopeKey: 'A', scopeNow: () => 'A'});
  const root = document.getElementById('undo-notice');
  assert.equal(root.parentNode, body);
  assert.equal(root.hidden, false);
  assert.equal(root.getAttribute('role'), 'status');
  assert.equal(root.getAttribute('aria-live'), 'polite');
  assert.equal(root.querySelector('.undo-notice-text').textContent, 'Item removido do caderno.');
  const button = root.querySelector('.undo-notice-undo');
  assert.equal(button.textContent, 'Desfazer');
  assert.equal(button.getAttribute('aria-label'), 'Desfazer a remoção');
  assert.equal(root.querySelector('.undo-notice-timer').textContent, '25s');
  assert.equal(root.querySelector('.undo-notice-close').getAttribute('aria-label'), 'Fechar o aviso');
});

test('clicar Desfazer chama o host do Caderno e a lista volta pelo onUndone', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  let restored = null;
  await notice.showUndoNotice({
    kind: 'review',
    token: 'u-tok',
    expiresAt: clock.now() + 25000,
    scopeKey: 'A',
    scopeNow: () => 'A',
    onUndone: (result) => { restored = result; },
  });
  const root = document.getElementById('undo-notice');
  await root.querySelector('.undo-notice-undo').dispatch('click');
  await tick();
  assert.deepEqual(host.calls, [['review', {token: 'u-tok'}]]);
  assert.deepEqual(restored, {ok: true, items: [{id: 'n-1'}]});
  assert.equal(root.querySelector('.undo-notice-text').textContent, 'Item devolvido ao caderno.');
  assert.equal(root.querySelector('.undo-notice-undo').disabled, true, 'não desfaz duas vezes');
});

test('o token das Anotações chama studyNotesUndo e mostra o texto próprio', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  await notice.showUndoNotice({kind: 'note', token: 'u-note', expiresAt: clock.now() + 25000, scopeKey: 'A'});
  const root = document.getElementById('undo-notice');
  assert.equal(root.querySelector('.undo-notice-text').textContent, 'Anotação removida.');
  await root.querySelector('.undo-notice-undo').dispatch('click');
  await tick();
  assert.deepEqual(host.calls, [['note', {token: 'u-note'}]]);
  assert.equal(root.querySelector('.undo-notice-text').textContent, 'Anotação restaurada.');
});

test('erro do host fica visível (role=alert) e não some sozinho', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  host.reviewUndo = async () => ({ok: false, reason: 'expired'});
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  await notice.showUndoNotice({kind: 'review', token: 'u-tok', expiresAt: clock.now() + 25000, scopeKey: 'A'});
  const root = document.getElementById('undo-notice');
  await root.querySelector('.undo-notice-undo').dispatch('click');
  await tick();
  const error = root.querySelector('.undo-notice-error');
  assert.equal(error.hidden, false);
  assert.equal(error.getAttribute('role'), 'alert');
  assert.equal(error.textContent, 'O prazo para desfazer terminou.');
  assert.equal(root.querySelector('.undo-notice-undo').disabled, true);
  clock.advance(30000);
  assert.equal(root.hidden, false, 'erro não é escondido pelo relógio');
});

test('o contador esconde o aviso no fim e NUNCA chama o host (dados ficam no processo)', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  await notice.showUndoNotice({kind: 'review', token: 'u-tok', expiresAt: clock.now() + 25000, scopeKey: 'A', scopeNow: () => 'A'});
  const root = document.getElementById('undo-notice');
  clock.advance(24999);
  assert.equal(root.hidden, false);
  clock.advance(1);
  assert.equal(root.hidden, true);
  assert.equal(notice.isUndoNoticeVisible(), false);
  assert.deepEqual(host.calls, [], 'o relógio da tela não consome nem apaga o token');
});

test('trocar o escopo desativa o aviso sem chamar o host', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  let scope = 'A';
  await notice.showUndoNotice({kind: 'review', token: 'u-tok', expiresAt: clock.now() + 25000, scopeKey: 'A', scopeNow: () => scope});
  const root = document.getElementById('undo-notice');
  scope = 'B';
  clock.advance(500);
  assert.equal(root.hidden, true);
  assert.deepEqual(host.calls, []);
});

test('fechar o aviso não chama o host e devolve o foco quando o botão estava focado', async () => {
  const {document} = installDom();
  const clock = fakeClock();
  const host = fakeHost();
  const notice = await loadNotice({document, timers: clock.timers, now: clock.now, host});
  let back = false;
  await notice.showUndoNotice({kind: 'review', token: 'u-tok', expiresAt: clock.now() + 25000, scopeKey: 'A', restoreFocus: () => { back = true; }});
  const root = document.getElementById('undo-notice');
  document.activeElement = root.querySelector('.undo-notice-undo');
  root.querySelector('.undo-notice-close').dispatch('click');
  assert.equal(root.hidden, true);
  assert.equal(back, true);
  assert.deepEqual(host.calls, []);
});
