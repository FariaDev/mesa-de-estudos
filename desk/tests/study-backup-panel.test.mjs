import test from 'node:test';
import assert from 'node:assert/strict';
import {initBackupPanel, buildBackupPanelView, renderBackupPanelView, formatBytes, formatWhen, reasonLabel, ensureStyles, BACKUP_PANEL_CSS_ID} from '../src/backup-panel.mjs';

/* Painel Backup/Compartilhar sem navegador: um DOM mínimo (sem dependência
   nova) exercita o markup, a injeção de CSS, a navegação, os cliques de ação
   e o ciclo de vida do diálogo. As interfaces IPC são as que o main expõe —
   aqui entram como espelho para provar que o painel as chama exatamente. */

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
  get id() {
    return this.attributes.get('id') || '';
  }
  set id(value) {
    this.setAttribute('id', value);
  }
  get className() {
    return this.attributes.get('class') || '';
  }
  set className(value) {
    this.setAttribute('class', value);
  }
  get classList() {
    const self = this;
    return {
      contains: (name) => self.className.split(/\s+/).includes(name),
      add: (name) => {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        set.add(name);
        self.className = [...set].join(' ');
      },
      remove: (name) => {
        self.className = self.className.split(/\s+/).filter((item) => item && item !== name).join(' ');
      },
    };
  }
  get textContent() {
    return this._text || this.children.map((child) => child.textContent).join('');
  }
  set textContent(value) {
    this._text = String(value);
    this._html = '';
    this.children = [];
  }
  get innerHTML() {
    return this._html;
  }
  set innerHTML(html) {
    this._html = String(html);
    this._text = '';
    this.children = parseHtml(String(html));
    for (const child of this.children) child.parentNode = this;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item !== fn));
  }
  dispatch(type, extra = {}) {
    const event = {type, target: extra.target || this, preventDefault: () => {}, stopPropagation: () => {}, ...extra};
    for (const fn of this.listeners.get(type) || []) fn(event);
  }
  closest(selector) {
        let node = this;
    while (node) {
      if (matchesSelector(node, selector)) return node;
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
    if (text.trim()) stack[stack.length - 1].appendChild(textNode(text));
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
  if (tail.trim()) stack[stack.length - 1].appendChild(textNode(tail));
  return root.children;
}

function textNode(text) {
  const node = new El('#text');
  node.textContent = decodeEntities(text);
  return node;
}

function decodeEntities(text) {
  return String(text).replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'"}[entity]));
}

function makeDocument() {
  const document = {
    head: new El('head'),
    body: new El('body'),
    createElement: (tag) => new El(tag),
    getElementById: (id) => document.body.querySelector(`#${id}`) || document.head.querySelector(`#${id}`) || null,
    listeners: [],
    addEventListener(type, fn) {
      document.listeners.push({type, fn});
    },
    removeEventListener(type, fn) {
      document.listeners = document.listeners.filter((item) => !(item.type === type && item.fn === fn));
    },
  };
  return document;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function closestActionButton(el) {
  let node = el;
  while (node) {
    if (node.hasAttribute && (node.hasAttribute('data-bkp-act') || node.hasAttribute('data-bkp-nav'))) return node;
    node = node.parentNode;
  }
  return null;
}

/* O `closest` do DOM mínimo cobre os poucos seletores que o painel usa:
   `[data-bkp-act]`/`[data-bkp-nav]` sobem a árvore. */
El.prototype.closest = function closest(selector) {
  const parts = String(selector).split(',').map((part) => part.trim());
  let node = this;
  while (node) {
    for (const part of parts) {
      if (matchesSelector(node, part)) return node;
    }
    node = node.parentNode;
  }
  return null;
};

/* ---------- dados de exemplo (mesma forma dos IPCs) ---------- */

function fakeModel() {
  const calls = [];
  let saved = null;
  const versions = [
    {snapshotId: 'snap-20261007T120000000Z-aaaaaa', created: '2026-10-07T15:00:00.000Z', reason: 'manual', bytes: 2048, entries: 12, valid: true, label: ''},
    {snapshotId: 'snap-20261006T120000000Z-bbbbbb', created: '2026-10-06T15:00:00.000Z', reason: 'auto', bytes: 4096, entries: 13, valid: true, label: ''},
  ];
  const ipc = {
    status: async () => ({available: true, destination: (saved && saved.destination) || '/tmp/backups', auto: {snapshotId: 'snap-20261006T120000000Z-bbbbbb', attemptedAt: '2026-10-06T15:00:00.000Z', error: ''}, lastError: '', last: {id: 'snap-20261007T120000000Z-aaaaaa', created: '2026-10-07T15:00:00.000Z', bytes: 2048, reason: 'manual'}}),
    listar: async () => {
      calls.push({fn: 'listar'});
      return versions;
    },
    escolherPasta: async () => {
      calls.push({fn: 'escolherPasta'});
      return '/tmp/backups-novo';
    },
    curso: async () => {
      calls.push({fn: 'curso'});
      return {id: 'mat-1', name: 'Algebra Linear', path: '/tmp/aula'};
    },
    obterConfig: async () => ({auto: false, intervalHours: 24, idleMinutes: 30, keep: 10, git: false, gitRoot: '', gitRemote: ''}),
    definirConfig: async (patch) => {
      calls.push({fn: 'definirConfig', patch});
      /* O main grava e devolve o que ficou salvo: daqui em diante o status
         passa a reportar o destino novo (como o app real faz). */
      saved = {destination: patch.destination, auto: patch.auto};
      return patch;
    },
    rodar: async (payload) => {
      calls.push({fn: 'rodar', payload});
      return {snapshotId: 'snap-20261007T200000000Z-cccccc', path: '/tmp/backups/snapshots/snap-20261007T200000000Z-cccccc', entries: 12, bytes: 2048, pruned: ['snap-antigo']};
    },
    verificar: async (id) => {
      calls.push({fn: 'verificar', id});
      return {ok: true, checked: 12, bytes: 2048, errors: []};
    },
    previaRestauracao: async (id) => {
      calls.push({fn: 'previaRestauracao', id});
      return {planId: 'plan-123-abcdef', snapshotId: id, entries: 12, bytes: 2048, snapshotCreated: '2026-10-07T15:00:00.000Z', replaced: ['review.json', 'desk.json'], created: ['novo.txt'], external: ['external/nativa.jsonl'], excluded: [{path: 'aula.pdf', reason: 'binário excluído pela política'}], binariesIncluded: false};
    },
    aplicarRestauracao: async (planId) => {
      calls.push({fn: 'aplicarRestauracao', planId});
      return {applied: true, planId, written: 12, backupOfReplaced: '/tmp/rt/.backup/pre-restore/plan-123-abcdef'};
    },
    cancelarRestauracao: async (planId) => {
      calls.push({fn: 'cancelarRestauracao', planId});
      return {cancelled: true};
    },
    exportar: async (dir, opts) => {
      calls.push({fn: 'exportar', dir, opts});
      return {file: '/tmp/backups/Algebra Linear.mesa-materia', bytes: 8192, features: {}, counts: {}};
    },
    escolherArquivo: async () => {
      calls.push({fn: 'escolherArquivo'});
      return '/tmp/entrada.mesa-materia';
    },
    importar: async (file, dir) => {
      calls.push({fn: 'importar', file, dir});
      return {destination: '/tmp/novo/Algebra Linear', courseId: 'materia-xyz', files: 9, materialsDir: '/tmp/novo/Algebra Linear/materiais', learningDir: '/tmp/novo/Algebra Linear/estudo'};
    },
    abrirPasta: async () => true,
  };
  return {calls, ipc, versions};
}

/* ---------- helpers de leitura ---------- */

function click(dialog, selector) {
  const el = dialog.querySelector(selector);
  assert.ok(el, `elemento ${selector}`);
  const button = closestActionButton(el) || el;
  dialog.dispatch('click', {target: button});
  return button;
}

function liveText(dialog) {
  return dialog.querySelector('[data-bkp-live]').textContent;
}

/* ---------- vistas puras ---------- */

test('painel: formatação e view model são puros e em português', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(reasonLabel('auto'), 'automático');
  assert.equal(reasonLabel('manual'), 'manual');
  assert.match(formatWhen('2026-10-07T15:00:00.000Z'), /^\d{2}\/\d{2}\/\d{4}/);
  assert.equal(formatWhen(''), '—');
  const view = buildBackupPanelView({
    status: {destination: '/tmp/bkp', lastError: '', last: {id: 'snap-1', created: '2026-10-07T15:00:00.000Z', bytes: 1024, reason: 'manual'}},
    versions: [{snapshotId: 'snap-1', created: '2026-10-07T15:00:00.000Z', reason: 'manual', bytes: 1024, entries: 7, valid: true}],
    course: {id: 'mat-1', name: 'Algebra Linear'},
    config: {auto: true, intervalHours: 6, idleMinutes: 45, keep: 5, git: true, gitRoot: '/tmp/git', gitRemote: 'git@host:x.git'},
    section: 'backup',
  });
  assert.equal(view.hasDestination, true);
  assert.equal(view.settings.auto, true);
  assert.equal(view.settings.intervalHours, 6);
  assert.equal(view.settings.gitRoot, '/tmp/git');
  assert.equal(view.versions.length, 1);
  assert.equal(view.versions[0].size, '1.0 KB');
  assert.match(view.status.lastAt, /^07\/10\/2026/);
  const html = renderBackupPanelView(view);
  assert.match(html.nav, /data-bkp-nav="backup" aria-current="true"/);
  assert.match(html.nav, /data-bkp-nav="restaurar"/);
  assert.match(html.nav, /data-bkp-nav="compartilhar"/);
  assert.match(html.sections, /Pasta de backup/);
  assert.match(html.sections, /Backup automático quando a mesa está parada/);
  assert.match(html.sections, /Também versionar no Git/);
  assert.match(html.sections, /Fazer backup agora/);
  assert.match(html.sections, /Restaurar uma versão/);
  assert.match(html.sections, /Compartilhar matéria/);
  assert.match(html.sections, /Incluir sessões/);
  assert.match(html.sections, /Exportar matéria/);
  assert.match(html.sections, /Importar arquivo/);
  /* Fuga de HTML: nome de matéria com `<` não quebra o markup. */
  const escaped = renderBackupPanelView(buildBackupPanelView({course: {name: '<b>x</b>'}, versions: []}));
  assert.ok(escaped.sections.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!escaped.sections.includes('<b>x</b>'));
});

test('painel: CSS escopado é injetado uma vez e usa os tokens do app', () => {
  const document = makeDocument();
  const style = ensureStyles(document);
  assert.ok(style);
  assert.equal(style.id, BACKUP_PANEL_CSS_ID);
  assert.match(style.textContent, /\.mesa-bkp\{/);
  assert.match(style.textContent, /var\(--primary,#6d28d9\)/);
  assert.equal(ensureStyles(document), style, 'não injeta de novo');
  assert.equal(document.head.children.length, 1);
});

/* ---------- painel completo ---------- */

test('painel: abre por conta própria, mostra o status e navega entre as seções', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel();
  const panel = initBackupPanel(document, ipc, {alvo: document.body});
  const dialog = panel.element;
  assert.equal(dialog.id, 'mesa-backup-panel');
  assert.equal(dialog.getAttribute('aria-labelledby'), 'mesa-bkp-titulo');
  assert.equal(dialog.parentNode, document.body);

  await panel.abrir();
  assert.equal(dialog.open, true);
  assert.ok(calls.some((call) => call.fn === 'listar'));
  assert.ok(calls.some((call) => call.fn === 'curso'));
  assert.equal(dialog.querySelector('#mesa-bkp-dest').value, '/tmp/backups');
  assert.match(dialog.querySelector('[data-bkp-sec="backup"]').className, /mesa-bkp-sec/);

  /* Navegação por clique (o mesmo caminho da UI real). */
  click(dialog, '[data-bkp-nav="restaurar"]');
  assert.equal(panel.estado.section, 'restaurar');
  assert.ok(!/mesa-bkp-hidden/.test(dialog.querySelector('[data-bkp-sec="restaurar"]').className));
  assert.match(dialog.querySelector('[data-bkp-sec="backup"]').className, /mesa-bkp-hidden/);

  click(dialog, '[data-bkp-nav="compartilhar"]');
  assert.equal(panel.estado.section, 'compartilhar');
  /* Fechar limpa e o diálogo deixa de estar aberto. */
  panel.fechar();
  assert.equal(dialog.open, false);
});

test('painel: backup, escolher pasta, salvar e exportar batem nos IPCs', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel();
  const panel = initBackupPanel(document, ipc, {alvo: document.body});
  await panel.abrir();
  const dialog = panel.element;

  const runButton = findAction(dialog, 'rodar');
  dialog.dispatch('click', {target: runButton});
  await flush();
  const runCall = calls.find((call) => call.fn === 'rodar');
  assert.ok(runCall, 'backup-run chamado');
  assert.equal(runCall.payload.reason, 'manual');
  assert.match(liveText(dialog), /Backup concluído: 12 arquivos/);
  assert.match(liveText(dialog), /1 versão antiga removida/);

  dialog.dispatch('click', {target: findAction(dialog, 'pasta')});
  await flush();
  assert.ok(calls.some((call) => call.fn === 'escolherPasta'));
  assert.equal(dialog.querySelector('#mesa-bkp-dest').value, '/tmp/backups-novo');

  dialog.dispatch('click', {target: findAction(dialog, 'salvar')});
  await flush();
  const saved = calls.find((call) => call.fn === 'definirConfig');
  assert.ok(saved, 'backup-config chamado');
  assert.equal(saved.patch.destination, '/tmp/backups-novo');
  assert.equal(saved.patch.auto, false);
  assert.equal(saved.patch.keep, 10);

  click(dialog, '[data-bkp-nav="compartilhar"]');
  dialog.dispatch('click', {target: findAction(dialog, 'exportar')});
  await flush();
  const exported = calls.find((call) => call.fn === 'exportar');
  assert.ok(exported, 'share-export-course chamado');
  assert.equal(exported.dir, '/tmp/backups-novo');
  assert.equal(exported.opts.conversations, false);
  assert.match(liveText(dialog), /Arquivo pronto/);
});

test('painel: listar versões, conferir e prévia de restauração antes de aplicar', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel();
  let confirmed = 0;
  let confirmAnswer = false;
  const panel = initBackupPanel(document, ipc, {
    alvo: document.body,
    confirmar: async () => {
      confirmed++;
      return confirmAnswer;
    },
  });
  await panel.abrir('restaurar');
  const dialog = panel.element;

  dialog.dispatch('click', {target: findAction(dialog, 'listar')});
  await flush();
  assert.ok(calls.some((call) => call.fn === 'listar'));
  assert.match(liveText(dialog), /2 versões/);
  const items = dialog.querySelectorAll('[data-bkp-act="previa"]');
  assert.equal(items.length, 2);

  /* Conferir integridade de uma versão. */
  dialog.dispatch('click', {target: dialog.querySelector('[data-bkp-act="verificar"]')});
  await flush();
  const verified = calls.find((call) => call.fn === 'verificar');
  assert.equal(verified.id, 'snap-20261007T120000000Z-aaaaaa');
  assert.match(liveText(dialog), /Versão íntegra/);

  /* Prévia: o IPC é chamado com o id e o box mostra o resumo. */
  dialog.dispatch('click', {target: dialog.querySelector('[data-bkp-act="previa"]')});
  await flush();
  const preview = calls.find((call) => call.fn === 'previaRestauracao');
  assert.equal(preview.id, 'snap-20261007T120000000Z-aaaaaa');
  const box = dialog.querySelector('[data-bkp-preview]');
  assert.ok(box);
  assert.match(box.textContent, /2 substituído\(s\)/);
  assert.match(box.textContent, /1 novo\(s\)/);
  /* Regressão (#43 fase 3): a data da versão saía como "—" porque a lista de
     arquivos novos tinha a mesma chave `created`. */
  assert.match(box.textContent, /12 arquivos · [^·]+ · 07\/10\/2026/);
  assert.match(box.textContent, /PDFs/);
  assert.match(box.textContent, /ficou fora da versão/);
  assert.equal(dialog.querySelector('[data-bkp-act="aplicar"]').textContent, 'Restaurar agora');

  /* Recusar a confirmação CANCELA o plano e não aplica nada. */
  dialog.dispatch('click', {target: dialog.querySelector('[data-bkp-act="aplicar"]')});
  await flush();
  assert.equal(confirmed, 1);
  assert.ok(calls.some((call) => call.fn === 'cancelarRestauracao' && call.planId === 'plan-123-abcdef'));
  assert.ok(!calls.some((call) => call.fn === 'aplicarRestauracao'));

  /* Confirmar aplica e anuncia o resultado. */
  confirmAnswer = true;
  dialog.dispatch('click', {target: dialog.querySelector('[data-bkp-act="previa"]')});
  await flush();
  dialog.dispatch('click', {target: dialog.querySelector('[data-bkp-act="aplicar"]')});
  await flush();
  assert.equal(confirmed, 2);
  const applied = calls.find((call) => call.fn === 'aplicarRestauracao');
  assert.equal(applied.planId, 'plan-123-abcdef');
  assert.match(liveText(dialog), /Restaurado: 12 arquivos/);
});

test('painel: fechar com prévia aberta cancela o plano (nada fica pendurado)', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel();
  const panel = initBackupPanel(document, ipc, {alvo: document.body});
  await panel.abrir('restaurar');
  const dialog = panel.element;
  const previaButton = dialog.querySelector('[data-bkp-act="previa"]');
  assert.ok(previaButton, 'botão de prévia existe depois do refresh');
  dialog.dispatch('click', {target: previaButton});
  await flush();
  assert.equal(panel.estado.planId, 'plan-123-abcdef');
  dialog.dispatch('keydown', {key: 'Escape'});
  await flush();
  assert.equal(dialog.open, false);
  assert.ok(calls.some((call) => call.fn === 'cancelarRestauracao'));
  assert.equal(panel.estado.planId, '');
});

test('painel: importar escolhe arquivo e destino e avisa o host', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel();
  let imported = null;
  const panel = initBackupPanel(document, ipc, {alvo: document.body, aoImportar: (result) => { imported = result; }});
  await panel.abrir('compartilhar');
  const dialog = panel.element;
  dialog.dispatch('click', {target: findAction(dialog, 'importar')});
  await flush();
  const importCall = calls.find((call) => call.fn === 'importar');
  assert.ok(importCall, 'share-import-course chamado');
  assert.equal(importCall.file, '/tmp/entrada.mesa-materia');
  assert.equal(importCall.dir, '/tmp/backups-novo');
  assert.match(liveText(dialog), /Importada em \/tmp\/novo\/Algebra Linear/);
  assert.equal(imported.courseId, 'materia-xyz');
});

test('painel: erro de IPC vira aviso na barra, sem quebrar o diálogo', async () => {
  const document = makeDocument();
  const ipc = {
    status: async () => ({destination: '', last: null}),
    listar: async () => [],
    curso: async () => ({}),
    obterConfig: async () => ({}),
    rodar: async () => {
      throw new Error('destino sem permissão');
    },
    definirConfig: async () => ({}),
    escolherPasta: async () => '',
  };
  const panel = initBackupPanel(document, ipc, {alvo: document.body});
  await panel.abrir();
  const dialog = panel.element;
  dialog.dispatch('click', {target: findAction(dialog, 'rodar')});
  await flush();
  assert.match(liveText(dialog), /Falha no backup: destino sem permissão/);
  assert.equal(dialog.open, true, 'o painel continua utilizável');
  panel.fechar();
  panel.destroy();
  assert.equal(dialog.parentNode, null);
});

test('painel: exportar sem destino avisa em vez de escrever no lugar errado', async () => {
  const document = makeDocument();
  const {calls, ipc} = fakeModel();
  ipc.status = async () => ({destination: '', last: null});
  const panel = initBackupPanel(document, ipc, {alvo: document.body});
  await panel.abrir('compartilhar');
  const dialog = panel.element;
  dialog.dispatch('click', {target: findAction(dialog, 'exportar')});
  await flush();
  assert.match(liveText(dialog), /Escolha a pasta de backup/);
  assert.ok(!calls.some((call) => call.fn === 'exportar'));
});

function findAction(dialog, act) {
  const found = dialog.querySelector(`[data-bkp-act="${act}"]`);
  assert.ok(found, `ação ${act} presente`);
  return found;
}
