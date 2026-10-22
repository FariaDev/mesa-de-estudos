import test from 'node:test';
import assert from 'node:assert/strict';
import {initBackupPanel, buildBackupPanelView, renderBackupPanelView} from '../src/backup-panel.mjs';

/* Ação manual de push do Git no painel e o opt-in de remapeamento de material
   na restauração. DOM mínimo (o mesmo estilo do teste principal do painel) —
   sem navegador e sem Electron. */

/* ---------- DOM mínimo ---------- */
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this._text = '';
    this._html = '';
    this.checked = false;
    this.value = '';
    this.open = false;
  }
  get id() { return this.attributes.get('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get className() { return this.attributes.get('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get classList() {
    const self = this;
    return {
      contains: (name) => self.className.split(/\s+/).includes(name),
      add: (name) => {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        set.add(name);
        self.className = [...set].join(' ');
      },
      remove: (name) => { self.className = self.className.split(/\s+/).filter((item) => item && item !== name).join(' '); },
    };
  }
  get textContent() { return this._text || this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(html) {
    this._html = String(html);
    this._text = '';
    this.children = parseHtml(String(html));
    for (const child of this.children) child.parentNode = this;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; } }
  showModal() { this.open = true; }
  close() { this.open = false; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  removeEventListener(type, fn) { const list = this.listeners.get(type) || []; this.listeners.set(type, list.filter((item) => item !== fn)); }
  dispatch(type, extra = {}) {
    const event = {type, target: extra.target || this, preventDefault: () => {}, stopPropagation: () => {}, ...extra};
    for (const fn of this.listeners.get(type) || []) fn(event);
  }
  closest(selector) {
    const parts = String(selector).split(',').map((part) => part.trim());
    let node = this;
    while (node) {
      for (const part of parts) if (matchesSelector(node, part)) return node;
      node = node.parentNode;
    }
    return null;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) return child;
      const deep = child.querySelector(selector);
      if (deep) return deep;
    }
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
}

function matchesSelector(el, selector) {
  if (!el || !selector || !el.attributes) return false;
  const attr = selector.match(/^\[([a-zA-Z-]+)(?:="([^"]*)")?\]$/);
  if (attr) {
    if (!el.hasAttribute(attr[1])) return false;
    return attr[2] === undefined || el.getAttribute(attr[1]) === attr[2];
  }
  const idMatch = selector.match(/^#([\w-]+)$/);
  if (idMatch) return el.id === idMatch[1];
  const classMatch = selector.match(/^\.([\w-]+)$/);
  if (classMatch) return el.className.split(/\s+/).includes(classMatch[1]);
  const tagMatch = selector.match(/^([a-zA-Z][\w-]*)$/);
  if (tagMatch) return el.tagName === tagMatch[1].toUpperCase();
  return false;
}

const VOID_TAGS = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);

function parseHtml(html) {
  const root = new El('root');
  const stack = [root];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  let last = 0;
  let match;
  while ((match = tagRe.exec(html))) {
    const text = html.slice(last, match.index);
    if (text.trim()) {
      const node = new El('#text');
      node.textContent = decodeEntities(text);
      stack[stack.length - 1].appendChild(node);
    }
    last = tagRe.lastIndex;
    const [, closing, tag, attrText] = match;
    const lower = tag.toLowerCase();
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const el = new El(tag);
    for (const attr of attrText.matchAll(/([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
      const value = attr[2] !== undefined ? attr[2] : attr[3] !== undefined ? attr[3] : '';
      el.setAttribute(attr[1], value);
      if (attr[1] === 'checked') el.checked = true;
      if (attr[1] === 'value') el.value = value;
    }
    stack[stack.length - 1].appendChild(el);
    if (!VOID_TAGS.has(lower)) stack.push(el);
  }
  const tail = html.slice(last);
  if (tail.trim()) {
    const node = new El('#text');
    node.textContent = decodeEntities(tail);
    stack[stack.length - 1].appendChild(node);
  }
  return root.children;
}

const decodeEntities = (text) => String(text).replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'"}[entity]));

function makeDocument() {
  const document = {
    head: new El('head'),
    body: new El('body'),
    createElement: (tag) => new El(tag),
    getElementById: (id) => document.body.querySelector(`#${id}`) || document.head.querySelector(`#${id}`) || null,
  };
  return document;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const findAction = (dialog, act) => dialog.querySelector(`[data-bkp-act="${act}"]`);
const liveText = (dialog) => dialog.querySelector('[data-bkp-live]').textContent;

function fakeModel({git = true, materials = null} = {}) {
  const calls = [];
  const ipc = {
    status: async () => ({
      available: true,
      destination: '/tmp/backups',
      lastError: '',
      last: {id: 'snap-1', created: '2026-10-07T15:00:00.000Z', bytes: 1024, reason: 'manual'},
      gitError: git === 'error' ? 'rejected (non-fast-forward)' : '',
      gitAt: '2026-10-07T16:00:00.000Z',
    }),
    listar: async () => [{snapshotId: 'snap-1', created: '2026-10-07T15:00:00.000Z', reason: 'manual', bytes: 1024, entries: 3, valid: true}],
    curso: async () => ({id: 'mat-1', name: 'Algebra Linear'}),
    obterConfig: async () => ({auto: false, intervalHours: 24, idleMinutes: 30, keep: 10, git: git !== false, gitRoot: git !== false ? '/tmp/git-backup' : '', gitRemote: 'git@host:mesa.git'}),
    definirConfig: async () => ({}),
    escolherPasta: async () => '/tmp/outra',
    rodar: async () => ({entries: 1, bytes: 1, pruned: []}),
    verificar: async () => ({ok: true}),
    previaRestauracao: async (id) => {
      calls.push({fn: 'previaRestauracao', id});
      return {
        planId: 'plan-1-abcdef',
        snapshotId: id,
        entries: 3,
        bytes: 100,
        snapshotCreated: '2026-10-07T15:00:00.000Z',
        replaced: ['config.json'],
        created: [],
        external: [],
        materials: materials || [],
        materialsChanges: materials ? ['config.json'] : [],
      };
    },
    aplicarRestauracao: async (planId, options) => {
      calls.push({fn: 'aplicarRestauracao', planId, options});
      return {applied: true, written: 3, materialsRemapped: [{courseId: 'mat-1'}]};
    },
    cancelarRestauracao: async () => ({cancelled: true}),
    exportar: async () => ({}),
    escolherArquivo: async () => '',
    importar: async () => ({}),
    abrirPasta: async () => true,
    enviarGit: async () => {
      calls.push({fn: 'enviarGit'});
      return git === 'error'
        ? {pushed: false, error: 'rejeitado (non-fast-forward)'}
        : {pushed: true, remote: 'git@host:mesa.git', branch: 'main'};
    },
  };
  return {calls, ipc};
}

const MATERIAL = {
  courseId: 'mat-1',
  name: 'Algebra Linear',
  from: '/origem/PDFs',
  to: '/rt/courses/Algebra Linear',
  files: 4,
  stale: true,
  currentPath: '/origem/PDFs',
  currentExists: false,
};

test('painel: push do Git tem botão acessível e reporta o mapeamento raiz→remoto', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel();
  const panel = initBackupPanel(document, ipc, {alvo: document.body});
  await panel.abrir('backup');
  const dialog = panel.element;
  const button = findAction(dialog, 'git-push');
  assert.ok(button, 'botão de push existe');
  assert.equal(button.textContent, 'Enviar para o remoto (Git)');
  assert.equal(button.getAttribute('aria-label'), 'Enviar o backup para o repositório Git remoto');
  assert.ok(dialog.querySelector('[data-bkp-gitmap]').textContent.includes('/tmp/git-backup'), 'mapeamento do repositório visível');

  dialog.dispatch('click', {target: button});
  await flush();
  assert.equal(calls.filter((call) => call.fn === 'enviarGit').length, 1);
  assert.match(liveText(dialog), /Push ok: \/tmp\/git-backup → git@host:mesa\.git \(main\)/);
  panel.fechar();
});

test('painel: push recusado explica que o backup local continua válido', async () => {
  const document = makeDocument();
  const {ipc} = fakeModel({git: 'error'});
  const panel = initBackupPanel(document, ipc, {alvo: document.body});
  await panel.abrir('backup');
  const dialog = panel.element;
  dialog.dispatch('click', {target: findAction(dialog, 'git-push')});
  await flush();
  assert.match(liveText(dialog), /Push não concluído: rejeitado \(non-fast-forward\)\. O backup local continua válido\./);
  panel.fechar();
});

test('painel: prévia com material traz o opt-in e aplica remap quando marcado', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel({materials: [MATERIAL]});
  const panel = initBackupPanel(document, ipc, {alvo: document.body, confirmar: async () => true});
  await panel.abrir('restaurar');
  const dialog = panel.element;
  dialog.dispatch('click', {target: findAction(dialog, 'previa')});
  await flush();
  const box = dialog.querySelector('[data-bkp-preview]');
  assert.match(box.textContent, /Materiais da versão/);
  assert.match(box.textContent, /Usar as cópias restauradas/);
  assert.match(box.textContent, /O remapeamento ajusta referências em: config\.json/);
  const checkbox = dialog.querySelector('#mesa-bkp-remap');
  assert.ok(checkbox, 'opt-in presente');
  assert.equal(checkbox.checked, true, 'origem ausente já vem marcada');

  dialog.dispatch('click', {target: findAction(dialog, 'aplicar')});
  await flush();
  const applied = calls.find((call) => call.fn === 'aplicarRestauracao');
  assert.deepEqual(applied.options, {materials: 'remap'});
  assert.match(liveText(dialog), /1 matéria aponta para a cópia restaurada/);
  panel.fechar();
});

test('painel: sem marcar o opt-in o remap fica no automático', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel({materials: [MATERIAL]});
  const panel = initBackupPanel(document, ipc, {alvo: document.body, confirmar: async () => true});
  await panel.abrir('restaurar');
  const dialog = panel.element;
  dialog.dispatch('click', {target: findAction(dialog, 'previa')});
  await flush();
  dialog.querySelector('#mesa-bkp-remap').checked = false;
  dialog.dispatch('click', {target: findAction(dialog, 'aplicar')});
  await flush();
  const applied = calls.find((call) => call.fn === 'aplicarRestauracao');
  assert.deepEqual(applied.options, {materials: 'auto'});
  panel.fechar();
});

test('painel: prévia sem material não mostra o opt-in', () => {
  const html = renderBackupPanelView(buildBackupPanelView({section: 'restaurar'}));
  assert.ok(!html.sections.includes('mesa-bkp-remap'));
  const withGit = renderBackupPanelView(buildBackupPanelView({config: {git: true, gitRoot: '/tmp/git', gitRemote: 'git@host:x.git'}}));
  assert.match(withGit.sections, /data-bkp-act="git-push"/);
  assert.match(withGit.sections, /Repositório: \/tmp\/git · remoto: git@host:x\.git/);
  assert.ok(!/data-bkp-act="git-push" disabled/.test(withGit.sections), 'botão habilitado com git configurado');
  const withoutGit = renderBackupPanelView(buildBackupPanelView({config: {git: true, gitRoot: ''}}));
  assert.match(withoutGit.sections, /data-bkp-act="git-push" disabled/);
});
