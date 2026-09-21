import test from 'node:test';
import assert from 'node:assert/strict';

/* DOM falso mínimo para os aplicadores dos diálogos: o mesmo espírito do
   `view-host.test.mjs` (registro de ids/classes, movimentação de nós e
   listeners). O casco estático do `index.html` é montado à mão aqui. */
class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.text = '';
    this._html = '';
    this.hidden = false;
    this.id = '';
    this.value = '';
    this.__parent = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.tag === '#frag') { this.append(...node.children); continue; }
      if (node.__parent) {
        const at = node.__parent.children.indexOf(node);
        if (at >= 0) node.__parent.children.splice(at, 1);
      }
      node.__parent = this;
      this.children.push(node);
    }
  }
  setAttribute(name, value) {
    const key = String(name), val = String(value);
    if (key === 'id') this.id = val;
    this.attrs.set(key, val);
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  addEventListener(event, fn) {
    this.listeners.set(event, fn);
  }
  remove() {
    const at = this.__parent?.children.indexOf(this) ?? -1;
    if (at >= 0) this.__parent.children.splice(at, 1);
  }
  get classList() {
    const names = String(this.attrs.get('class') || '').split(/\s+/).filter(Boolean);
    return {contains: (name) => names.includes(name)};
  }
  matches(part) {
    const p = part.replace(/:first-of-type/g, '');
    if (p.startsWith('#')) return this.id === p.slice(1);
    if (p.startsWith('.')) return this.classList.contains(p.slice(1));
    const [tag, ...classes] = p.split('.');
    return (!tag || this.tag === tag) && classes.every((name) => this.classList.contains(name));
  }
  closest(selector) {
    for (let cur = this; cur; cur = cur.__parent) if (cur.matches(selector)) return cur;
    return null;
  }
  querySelector(selector) {
    return find(this, selector)[0] || null;
  }
  get textContent() {
    if (this.tag === '#text') return this.text;
    return this.children.map((child) => child.textContent).join('');
  }
  set textContent(value) {
    this.children = [];
    if (value !== '') this.append(Object.assign(new FakeNode('#text'), {text: String(value)}));
  }
  get innerHTML() {
    return this._html;
  }
  set innerHTML(value) {
    this._html = String(value);
    this.children = [];
    this.append(Object.assign(new FakeNode('#html'), {text: String(value)}));
  }
  get firstChild() {
    return this.children[0];
  }
}

const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
const find = (root, selector) => {
  let current = [root];
  for (const part of selector.trim().split(/\s+/)) {
    if (part === '>') continue;
    current = current.flatMap((node) => descendants(node).filter((child) => child.matches(part)));
  }
  return current;
};

const doc = new FakeNode('#doc');
const mk = (tag, attrs = {}, kids = []) => {
  const node = new FakeNode(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  for (const kid of kids) node.append(kid);
  return node;
};
const el = (tag, attrs = {}, kids = []) => {
  const node = mk(tag, attrs, kids);
  doc.append(node);
  return node;
};

/* Casco do index.html que os aplicadores tocam. */
const endDayForm = el('form', {id: 'end-day-form'});
const welcomeForm = el('form', {id: 'welcome-form'});
el('h2', {id: 'settings-title'});
el('p', {id: 'settings-lead'});
const courseBox = el('div', {id: 'cfg-courses'});
el('p', {id: 'help-version'});
el('li', {id: 'help-study-li'});
el('li', {id: 'help-endday-li'});
el('li', {id: 'help-refs-li'});
el('tr', {id: 'help-check-row'});
el('li', {id: 'help-conferir-step'});
el('li', {id: 'help-conferir-li'});
const aboutLead = mk('p', {class: 'help-lead'});
const aboutTail = mk('p', {class: 'help-lead'});
el('dialog', {id: 'about-dialog'}, [mk('div', {class: 'help-body'}, [aboutLead, mk('h3', {}, [mk('#text')]), aboutTail])]);
const aboutUpdate = el('div', {id: 'about-update'});
const componentRows = el('div', {id: 'component-rows'});
el('h2', {id: 'dialog-title'});
el('p', {id: 'dialog-message'});
const dialogFields = el('div', {id: 'dialog-fields'});
const imageActions = mk('div', {class: 'dialog-actions'});
el('dialog', {id: 'image-dialog'}, [mk('h2', {id: 'image-title'}), imageActions]);

globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (text) => Object.assign(new FakeNode('#text'), {text: String(text)}),
  createDocumentFragment: () => new FakeNode('#frag'),
  querySelector: (selector) => find(doc, selector)[0] || null,
};
globalThis.window = {desk: {pickFolder: async () => '/tmp/escolhida'}};

const dialogsCore = (await import('../src/generated/dialogsview.core.js')).default;
const {dialogsHandlers, renderEndDay, clearEndDay, renderWelcome, renderSettingsHead, renderCourseRows, appendCourseRow, renderHelpVersion, applyHelpFlags, renderAboutLead, renderAboutUpdate, renderComponentRows, renderPiDialog, renderImageChrome} = await import('../src/dialogs.mjs');

const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});
const kids = (node) => {
  const out = [];
  for (let cur = node; cur && cur.$ === 'Con'; cur = cur.tail) out.push(cur.head);
  return out;
};
const byId = (root, id) => descendants(root).find((node) => node.id === id) || null;

test('endDayChildren: ids, textos, ações e valores do Encerrar', () => {
  const parts = kids(dialogsCore.endDayChildren('terminei', 'seguir'));
  assert.equal(parts.length, 5);
  assert.equal(parts[0].tag, 'h2');
  assert.equal(parts[0].kids.head.text, 'Encerrar por hoje');
  assert.equal(parts[1].tag, 'p');
  assert.equal(kids(parts[1].attrs)[0].value, 'help-lead');
  assert.equal(parts[2].tag, 'label');
  assert.equal(parts[2].kids.head.text, 'Onde parei');
  const textarea = kids(parts[2].kids)[1];
  assert.equal(textarea.tag, 'textarea');
  assert.equal(kids(textarea.attrs)[0].value, 'end-where');
  assert.equal(kids(textarea.kids)[0].text, 'terminei');
  const actions = parts[4];
  assert.equal(actions.tag, 'div');
  assert.equal(kids(actions.attrs)[0].value, 'dialog-actions');
  const [cancel, save] = kids(actions.kids);
  const cancelAttrs = kids(cancel.attrs), saveAttrs = kids(save.attrs);
  assert.equal(cancelAttrs[0].value, 'cancel');
  assert.equal(cancelAttrs[1].name, 'formnovalidate');
  assert.equal(saveAttrs[0].value, 'end-day-save');
  assert.equal(saveAttrs[1].value, 'ok');
  assert.equal(saveAttrs[2].value, 'primary');
});

test('renderEndDay/clearEndDay colam o miolo no <form> estático', () => {
  renderEndDay('onde', 'próximo');
  const form = endDayForm;
  assert.equal(form.children.length, 5);
  assert.equal(form.children[0].tag, 'h2');
  assert.equal(byId(form, 'end-where').children[0].text, 'onde');
  assert.equal(byId(form, 'end-next').children[0].text, 'próximo');
  assert.equal(byId(form, 'end-next').attrs.get('required'), '');
  clearEndDay();
  assert.equal(byId(form, 'end-where').children.length, 0, 'o valor digitado sai depois de salvar');
  assert.equal(byId(form, 'end-day-save').attrs.get('value'), 'ok', 'o botão de salvar continua');
});

test('welcome: h2, corpo com 4 blocos e as ações do form', () => {
  const parts = kids(dialogsCore.welcomeChildren(false));
  assert.equal(parts.length, 3, 'h2 + corpo + ações');
  assert.equal(parts[0].tag, 'h2');
  assert.equal(parts[0].kids.head.text, 'Bem-vindo à Mesa de Estudos');
  const body = parts[1];
  assert.equal(kids(body.attrs)[0].value, 'help-body');
  const blocks = kids(body.kids);
  assert.deepEqual(blocks.map((node) => node.tag), ['section', 'section', 'section', 'section'], 'quatro blocos');
  assert.deepEqual(blocks.map((node) => node.kids.head.kids.head.text), ['O que é a Mesa', 'O Pi', 'Customização por agentes', 'Dicas de uso']);
  assert.ok(blocks.every((node) => kids(node.attrs)[0].value === 'welcome-block'), 'a classe do bloco é do renderizador');
  const actions = parts[2];
  assert.equal(kids(actions.attrs)[0].value, 'dialog-actions');
  const [cancel, configure] = kids(actions.kids);
  assert.equal(kids(cancel.attrs)[0].value, 'cancel');
  assert.equal(cancel.kids.head.text, 'Agora não');
  const attrs = kids(configure.attrs);
  assert.equal(attrs[0].value, 'welcome-settings');
  assert.equal(attrs[1].value, 'button');
  assert.equal(attrs[2].value, 'primary');
  assert.equal(attrs[3].value, 'WelcomeConfigure', 'o clique cai na tabela de handlers do host');
  assert.equal(configure.kids.head.text, 'Configurar agora');
});

test('welcome: o bloco 4 é o sensível à plataforma; a prosa é dado', () => {
  const mac = kids(dialogsCore.welcomeBlocks(false));
  const win = kids(dialogsCore.welcomeBlocks(true));
  assert.equal(mac.length, 4);
  assert.deepEqual(mac.slice(0, 3), win.slice(0, 3), 'os 3 primeiros blocos não mudam com a plataforma');
  assert.notDeepEqual(mac[3], win[3], 'o bloco de dicas carrega a nota da plataforma');
  const titles = kids(dialogsCore.welcomeTitles(false));
  assert.deepEqual(titles, ['O que é a Mesa', 'O Pi', 'Customização por agentes', 'Dicas de uso'], 'títulos: contagem e ordem');
  assert.deepEqual(kids(dialogsCore.welcomeTitles(true)), titles, 'os títulos não mudam no win32');
});

test('renderWelcome cola o miolo no <form> estático e liga o WelcomeConfigure', () => {
  let called = 0;
  renderWelcome(false, { handlers: { WelcomeConfigure: () => { called++; } } });
  assert.equal(welcomeForm.children.length, 3);
  assert.equal(welcomeForm.children[0].tag, 'h2');
  const button = byId(welcomeForm, 'welcome-settings');
  assert.ok(button, 'o botão do núcleo ganha id');
  const onClick = button.listeners.get('click');
  assert.equal(typeof onClick, 'function', 'on:click vira listener do host');
  onClick({});
  assert.equal(called, 1);
});

test('settings: título/lead mudam com o fato `first`', () => {
  renderSettingsHead(true);
  assert.equal(document.querySelector('#settings-title').textContent, 'Bem-vindo à Mesa de Estudos');
  assert.match(document.querySelector('#settings-lead').textContent, /pelo menos uma matéria/);
  renderSettingsHead(false);
  assert.equal(document.querySelector('#settings-title').textContent, 'Configurações');
  assert.equal(document.querySelector('#settings-lead').textContent, 'Caminhos e nomes desta mesa. As credenciais do modelo continuam no Pi.');
});

test('settings: linhas de matéria com valores, data-id e handlers', async () => {
  renderCourseRows([{id: 'm1', name: 'Cálculo', path: '/pdfs/calc'}, {name: '', path: ''}]);
  const box = courseBox;
  const rows = box.children;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].attrs.get('class'), 'cfg-course');
  assert.equal(rows[0].attrs.get('data-id'), 'm1');
  const name = rows[0].children[0], folder = rows[0].children[1];
  assert.equal(name.tag, 'input');
  assert.equal(name.attrs.get('value'), 'Cálculo');
  assert.equal(name.attrs.get('placeholder'), 'Nome');
  assert.equal(folder.attrs.get('value'), '/pdfs/calc');
  assert.equal(folder.attrs.get('spellcheck'), 'false');
  assert.equal(rows[0].children[2].attrs.get('class'), 'cfg-browse');
  assert.equal(rows[0].children[3].attrs.get('class'), 'cfg-remove icon-btn');
  assert.equal(rows[0].children[3].attrs.get('aria-label'), 'Remover');
  assert.equal(rows[1].attrs.get('data-id'), '', 'linha em branco mantém data-id vazio');
  assert.equal(rows[1].children[0].attrs.has('value'), false, 'valor vazio não vira atributo');
  assert.equal(typeof rows[0].children[2].listeners.get('click'), 'function', 'o botão Pasta tem handler');
  assert.equal(typeof rows[0].children[3].listeners.get('click'), 'function', 'o botão remover tem handler');
  await dialogsHandlers.BrowseCourse({currentTarget: rows[0].children[2]});
  assert.equal(rows[0].children[1].value, '/tmp/escolhida', 'Pasta preenche o campo do caminho');
  dialogsHandlers.RemoveCourse({currentTarget: rows[0].children[3]});
  assert.equal(box.children.length, 1, 'Remover tira a linha');
});

test('settings: lista vazia vira uma linha e o "+" acrescenta', () => {
  renderCourseRows([]);
  const box = courseBox;
  assert.equal(box.children.length, 1);
  assert.equal(box.children[0].attrs.get('data-id'), '');
  assert.equal(box.children[0].children[0].tag, 'input');
  appendCourseRow();
  assert.equal(box.children.length, 2, 'Adicionar matéria acrescenta uma linha em branco');
  assert.equal(box.children[1].attrs.get('data-id'), '');
});

test('help: versão como fato e os itens que a flag esconde', () => {
  renderHelpVersion('0.4.0');
  assert.equal(document.querySelector('#help-version').textContent, 'Mesa de Estudos 0.4.0');
  renderHelpVersion('');
  assert.equal(document.querySelector('#help-version').textContent, '');
  applyHelpFlags({studyContext: false, endDay: false, refsToggle: false});
  assert.equal(document.querySelector('#help-study-li').hidden, true);
  assert.equal(document.querySelector('#help-endday-li').hidden, true);
  assert.equal(document.querySelector('#help-refs-li').hidden, true);
  applyHelpFlags({studyContext: true, endDay: true, refsToggle: true});
  assert.equal(document.querySelector('#help-study-li').hidden, false);
  assert.equal(document.querySelector('#help-endday-li').hidden, false);
  assert.equal(document.querySelector('#help-refs-li').hidden, false);
});

test('help: os itens do Conferir somem com a flag (win32)', () => {
  applyHelpFlags({studyContext: true, endDay: true, refsToggle: true, conferir: false});
  assert.equal(document.querySelector('#help-check-row').hidden, true);
  assert.equal(document.querySelector('#help-conferir-step').hidden, true);
  assert.equal(document.querySelector('#help-conferir-li').hidden, true);
  applyHelpFlags({studyContext: true, endDay: true, refsToggle: true, conferir: true});
  assert.equal(document.querySelector('#help-check-row').hidden, false);
  assert.equal(document.querySelector('#help-conferir-li').hidden, false);
});

test('about: lead com a versão (sem versão mantém o texto estático)', () => {
  const before = aboutLead.textContent;
  renderAboutLead('');
  assert.equal(aboutLead.textContent, before, 'sem versão o HTML estático fica');
  renderAboutLead('0.4.0');
  assert.equal(aboutLead.textContent, 'Mesa de Estudos 0.4.0 · licença MIT');
});

test('about: a linha de atualização vem do núcleo e liga os handlers', () => {
  let cliques = [];
  const handlers = {
    CheckUpdate: () => cliques.push('check'),
    /* O DOM falso não tem `dataset`; o attr cru é o mesmo que o navegador lê. */
    OpenLink: (e) => cliques.push('link:' + e.currentTarget.attrs.get('data-url')),
    ApplyUpdate: () => cliques.push('apply'),
  };
  renderAboutUpdate({$: 'UpdateIdle'}, handlers);
  const box = aboutUpdate;
  assert.equal(box.children.length, 2, 'repouso: linha + botão');
  assert.match(box.children[0].textContent, /uma vez por dia/);
  const verificar = box.children[1];
  assert.equal(verificar.attrs.get('id'), 'update-check');
  verificar.listeners.get('click')({});
  assert.deepEqual(cliques, ['check']);

  renderAboutUpdate({$: 'UpdateChecking'}, handlers);
  assert.equal(box.children.length, 1, 'verificando: só a linha');
  assert.match(box.children[0].textContent, /Verificando atualizações/);

  renderAboutUpdate({$: 'UpdateNone', current: '0.4.0'}, handlers);
  assert.match(box.children[0].textContent, /última versão \(v0\.4\.0\)/);
  assert.equal(box.children[1].attrs.get('id'), 'update-check', 'mesmo na última o botão fica');

  cliques = [];
  renderAboutUpdate({$: 'UpdateReady', version: '0.4.1', notes: 'Corpo da Release', url: 'https://github.com/x'}, handlers);
  assert.equal(box.children.length, 2, 'pronto: linha + corpo da Release');
  const line = box.children[0];
  assert.equal(line.attrs.get('class'), 'update-line');
  assert.match(line.textContent, /^v0\.4\.1 disponível — o que mudou \(/);
  assert.match(line.textContent, /\) · Atualizar e reiniciar$/);
  const notas = line.children[1], aplicar = line.children[3];
  assert.equal(notas.attrs.get('id'), 'update-notes');
  assert.equal(notas.attrs.get('data-url'), 'https://github.com/x');
  assert.equal(aplicar.attrs.get('id'), 'update-apply');
  assert.equal(aplicar.attrs.get('class'), 'primary');
  notas.listeners.get('click')({currentTarget: notas});
  aplicar.listeners.get('click')({});
  assert.deepEqual(cliques, ['link:https://github.com/x', 'apply']);
  assert.equal(box.children[1].attrs.get('class'), 'update-notes');
  assert.equal(box.children[1].textContent, 'Corpo da Release', 'o que mudou é o corpo da Release');

  renderAboutUpdate({$: 'UpdateFailed'}, handlers);
  assert.match(box.children[0].textContent, /Não foi possível verificar/);
  assert.equal(box.children[1].attrs.get('id'), 'update-check', 'falha de rede só oferece tentar de novo');
});

test('about: painel de Componentes — ordem do núcleo, estados e Atualizar Pi', () => {
  let pi = 0;
  renderComponentRows([
    {id: 'mesa', label: 'Mesa', version: '0.4.0', state: 'outdated', latest: '0.4.1'},
    {id: 'pi', label: 'Pi', version: '0.86.1', state: 'ok', hint: 'Em desk/node_modules (atualizável pela Mesa).', canUpdate: true},
    {id: 'node', label: 'Node', version: '22.18.0', state: 'warn', note: 'abaixo de 22.19 — o Pi exige Node 22.19+'},
    {id: 'xournal', label: 'Xournal++', version: '', state: 'unknown', link: 'https://github.com/xournalpp/xournalpp/releases/latest', linkLabel: 'Ver página'},
  ], {UpdatePi: () => pi++});
  const rows = componentRows.children;
  assert.deepEqual(rows.map((r) => r.attrs.get('data-id')), ['mesa', 'pi', 'node', 'xournal'], 'ordem: Mesa, Pi, Node, Xournal++');
  assert.equal(rows[0].children[0].textContent, 'Mesa');
  assert.equal(rows[0].children[1].textContent, '0.4.0');
  assert.equal(rows[0].children[2].textContent, '→ v0.4.1 disponível');
  assert.equal(rows[0].children.length, 3, 'sem dica/link/botão a linha tem três spans');

  assert.equal(rows[2].children[2].textContent, 'abaixo de 22.19 — o Pi exige Node 22.19+', 'aviso do Node vem do núcleo');
  const piRow = rows[1];
  assert.equal(piRow.children[3].attrs.get('class'), 'component-hint');
  const atualizar = piRow.children[4];
  assert.equal(atualizar.attrs.get('id'), 'update-pi');
  assert.equal(atualizar.attrs.get('class'), 'component-update');
  atualizar.listeners.get('click')({});
  assert.equal(pi, 1, 'Atualizar Pi cai no handler do host');

  const xournal = rows[3];
  assert.equal(xournal.children[1].textContent, '—', 'sem versão vira —');
  assert.equal(xournal.children[2].textContent, 'desconhecido');
  const link = xournal.children[3];
  assert.equal(link.attrs.get('class'), 'component-link');
  assert.equal(link.attrs.get('data-url'), 'https://github.com/xournalpp/xournalpp/releases/latest');
  assert.equal(link.textContent, 'Ver página');
  assert.equal(xournal.children.length, 4, 'Xournal++ nunca ganha botão de atualizar');
});

test('about: linha mínima de componente e lista vazia', () => {
  renderComponentRows([{id: 'node', label: 'Node', version: '22.19.0', state: 'ok'}]);
  const row = componentRows.children[0];
  assert.deepEqual(row.children.map((c) => c.tag), ['span', 'span', 'span']);
  assert.equal(row.children[2].textContent, '✓');
  renderComponentRows([]);
  assert.equal(componentRows.children.length, 0);
  renderComponentRows(undefined);
  assert.equal(componentRows.children.length, 0);
});

test('pi-dialog: título/mensagem passam pelo host e os campos vão para #dialog-fields', () => {
  const seen = [];
  renderPiDialog(
    {title: '', message: 'Escolha', field: {$: 'FieldPick', label: '', value: 'b', options: list({$: 'DialogOption', label: 'A', value: 'a'}, {$: 'DialogOption', label: 'B', value: 'b'})}},
    {inline: (html) => { seen.push(html); return html; }}
  );
  assert.deepEqual(seen, ['Pi', 'Escolha'], 'título cai em Pi e a mensagem sai crua');
  assert.equal(document.querySelector('#dialog-title').children[0].text, 'Pi');
  assert.equal(document.querySelector('#dialog-message').children[0].text, 'Escolha');
  const fields = dialogFields;
  assert.equal(fields.children.length, 1);
  const select = fields.children[0];
  assert.equal(select.tag, 'select');
  assert.equal(select.attrs.get('id'), 'dialog-value');
  assert.deepEqual(select.children.map((o) => o.attrs.get('value')), ['a', 'b']);
  assert.equal(select.children[1].attrs.get('selected'), '', 'a opção do valor vem marcada');
  renderPiDialog({title: 'Pergunta', message: '', field: {$: 'FieldText', label: '', value: 'x', hint: 'dica'}});
  const input = dialogFields.children[0];
  assert.equal(input.tag, 'input');
  assert.equal(input.attrs.get('type'), 'text');
  assert.equal(input.attrs.get('placeholder'), 'dica');
  assert.equal(input.attrs.get('value'), 'x');
});

test('pi-dialog: sem campo o #dialog-fields fica vazio', () => {
  renderPiDialog({title: 'Oi', message: ''});
  assert.equal(dialogFields.children.length, 0);
  assert.equal(document.querySelector('#dialog-title').children[0].text, 'Oi');
});

test('image-dialog: título pelo arquivo, ações e o caminho no dataset', () => {
  const handlers = {ImageCopy() {}, ImageOpen() {}};
  renderImageChrome({file: '/tmp/mesa/curva.png', hasFile: true}, handlers);
  assert.equal(document.querySelector('#image-title').textContent, 'curva.png');
  assert.equal(document.querySelector('#image-dialog').dataset.path, '/tmp/mesa/curva.png');
  let actions = imageActions;
  assert.deepEqual(actions.children.map((button) => button.attrs.get('id') ?? button.attrs.get('value')), ['image-copy', 'image-open', 'cancel']);
  assert.equal(actions.children[0].listeners.get('click'), handlers.ImageCopy, 'copiar vem da tabela de handlers');
  assert.equal(actions.children[1].listeners.get('click'), handlers.ImageOpen, 'abrir vem da tabela de handlers');
  assert.equal(actions.children[1].attrs.has('hidden'), false, 'com arquivo o Abrir no Preview aparece');
  renderImageChrome({file: '', hasFile: false});
  assert.equal(document.querySelector('#image-title').textContent, 'Imagem');
  actions = imageActions;
  assert.equal(actions.children[1].attrs.get('hidden'), '', 'sem arquivo o Abrir no Preview some');
  assert.equal(actions.children[2].attrs.get('class'), 'primary');
});
