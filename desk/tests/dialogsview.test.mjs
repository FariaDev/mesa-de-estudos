import test from 'node:test';
import assert from 'node:assert/strict';
import {ptText} from './pt-text.mjs';
import {message} from '../src/i18n.mjs';

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
const courseBox = el('div', {id: 'cfg-courses'});
el('p', {id: 'help-version'});
el('li', {id: 'help-study-li'});
el('li', {id: 'help-endday-li'});
el('li', {id: 'help-refs-li'});
el('tr', {id: 'help-check-row'});
el('li', {id: 'help-conferir-step'});
el('li', {id: 'help-conferir-li'});
const aboutLead = el('p', {id: 'about-lead'});
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
const {dialogsHandlers, renderEndDay, clearEndDay, renderCourseRows, appendCourseRow, renderHelpVersion, applyHelpFlags, renderAboutLead, renderAboutUpdate, renderComponentRows, renderComponentChecking, renderPiDialog, renderImageChrome} = await import('../src/dialogs.mjs');

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
  assert.equal(ptText(parts[0].kids.head.text), 'Encerrar por hoje');
  assert.equal(parts[1].tag, 'p');
  assert.equal(kids(parts[1].attrs)[0].value, 'help-lead');
  assert.equal(parts[2].tag, 'label');
  assert.equal(ptText(parts[2].kids.head.text), 'Onde parei');
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

test('settings: linhas de matéria com valores, data-id e handlers', async () => {
  renderCourseRows([{id: 'm1', name: 'Cálculo', path: '/pdfs/calc'}, {name: '', path: ''}]);
  const box = courseBox;
  /* #27 B9: o cabeçalho das colunas vem antes e não é uma linha de matéria. */
  assert.equal(box.children[0].attrs.get('class'), 'cfg-course-head');
  assert.deepEqual(box.children[0].children.map((k) => k.children[0].text), ['Nome', 'Pasta dos PDFs']);
  const rows = box.children.filter((k) => k.attrs.get('class') === 'cfg-course');
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
  assert.equal(box.children.filter((k) => k.attrs.get('class') === 'cfg-course').length, 1, 'Remover tira a linha');
});

test('settings: lista vazia vira uma linha e o "+" acrescenta', () => {
  renderCourseRows([]);
  const box = courseBox;
  const lines = () => box.children.filter((k) => k.attrs.get('class') === 'cfg-course');
  assert.equal(lines().length, 1);
  assert.equal(lines()[0].attrs.get('data-id'), '');
  assert.equal(lines()[0].children[0].tag, 'input');
  appendCourseRow();
  assert.equal(lines().length, 2, 'Adicionar matéria acrescenta uma linha em branco');
  assert.equal(lines()[1].attrs.get('data-id'), '');
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
  assert.equal(aboutLead.textContent, 'Versão 0.4.0 · licença MIT');
  renderAboutLead('0.4.0 9dca5d3');
  assert.equal(aboutLead.textContent, 'Versão 0.4.0 · 9dca5d3 · licença MIT', 'número e commit se separam pelo ponto médio');
});

test('about: a linha de atualização vem do núcleo e liga os handlers', () => {
  let cliques = [];
  const handlers = {
    CheckUpdate: () => cliques.push('check'),
    /* O DOM falso não tem `dataset`; o attr cru é o mesmo que o navegador lê. */
    OpenLink: (e) => cliques.push('link:' + e.currentTarget.attrs.get('data-url')),
    OpenLog: () => cliques.push('log'),
    ApplyUpdate: () => cliques.push('apply'),
  };
  renderAboutUpdate({$: 'UpdateIdle'}, handlers);
  const box = aboutUpdate;
  assert.equal(box.children.length, 3, 'repouso: ícone + frase + ícone de verificar');
  assert.equal(box.children[0].attrs.get('class'), 'update-icon');
  assert.match(box.children[1].textContent, /uma vez por dia/);
  const verificar = box.children[2];
  assert.equal(verificar.attrs.get('id'), 'update-check');
  assert.equal(verificar.attrs.get('aria-label'), 'Verificar atualizações agora', 'verificar é ícone com nome acessível');
  verificar.listeners.get('click')({});
  assert.deepEqual(cliques, ['check']);

  renderAboutUpdate({$: 'UpdateChecking'}, handlers);
  assert.equal(box.children.length, 2, 'verificando: ícone + frase');
  assert.match(box.children[1].textContent, /Verificando atualizações/);

  renderAboutUpdate({$: 'UpdateNone', current: '0.4.0', checked: message('update.checked.today', {time: '9:40'})}, handlers);
  assert.match(box.children[1].textContent, /^Atualizada\. Conferido hoje às 9:40\.$/);
  assert.equal(box.children[0].attrs.get('data-state'), 'ok');
  assert.equal(box.children[2].attrs.get('id'), 'update-check', 'mesmo na última o botão fica');
  renderAboutUpdate({$: 'UpdateNone', current: '0.4.0', checked: ''}, handlers);
  assert.match(box.children[1].textContent, /^Atualizada\. Você está na v0\.4\.0\.$/, 'sem hora a frase diz a versão');

  cliques = [];
  renderAboutUpdate({$: 'UpdateReady', version: '0.4.1', notes: 'Corpo da Release', url: 'https://github.com/x'}, handlers);
  assert.equal(box.children.length, 5, 'pronto: ícone, frase, link, ação e corpo da Release');
  assert.equal(box.children[0].attrs.get('data-state'), 'new');
  assert.equal(box.children[1].textContent, 'v0.4.1 disponível');
  const notas = box.children[2], aplicar = box.children[3];
  assert.equal(notas.attrs.get('id'), 'update-notes');
  assert.equal(notas.attrs.get('data-url'), 'https://github.com/x');
  assert.equal(notas.textContent, 'O que mudou', 'o rótulo é em PT-BR');
  assert.equal(aplicar.attrs.get('id'), 'update-apply');
  assert.equal(aplicar.attrs.get('class'), 'primary');
  assert.equal(aplicar.textContent, 'Atualizar e reiniciar');
  assert.equal(box.children[4].textContent, 'Corpo da Release');

  renderAboutUpdate({$: 'UpdateRecovered', version: '0.4.1', reason: 'npm ci morreu'}, handlers);
  assert.equal(box.children[2].attrs.get('id'), 'update-log');
  assert.equal(box.children[2].textContent, 'Ver o log');
  assert.equal(box.children[3].attrs.get('id'), 'update-check');
  box.children[2].listeners.get('click')({});
  assert.deepEqual(cliques, ['log'], 'o "Ver o log" cai no OpenLog do host');

  renderAboutUpdate({$: 'UpdateIncomplete', version: '0.4.1', reason: ''}, handlers);
  assert.match(box.children[1].textContent, /a recuperação ficou incompleta\./);
  assert.equal(box.children[2].attrs.get('id'), 'update-log');
  assert.equal(box.children[3].attrs.get('id'), 'update-check');
});

test('about: "O que a Mesa usa" — ordem do núcleo, bolinha, nota e Atualizar o Pi', () => {
  let pi = 0;
  renderComponentRows([
    {id: 'pi', label: 'Pi', version: '0.86.1', state: 'outdated', latest: '0.90.0', hint: 'Em desk/.pi-local (atualizável pela Mesa).', canUpdate: true},
    {id: 'node', label: 'Node', version: '22.18.0', state: 'warn', note: 'abaixo de 22.19 — o Pi exige Node 22.19+'},
    {id: 'xournal', label: 'Xournal++', version: '', state: 'unknown', link: 'https://github.com/xournalpp/xournalpp/releases/latest', linkLabel: 'Abrir o site'},
  ], {UpdatePi: () => pi++});
  const rows = componentRows.children;
  assert.deepEqual(rows.map((r) => r.attrs.get('data-id')), ['pi', 'node', 'xournal'], 'ordem: Pi, Node, Xournal++ (a Mesa não é linha)');
  const head = (row) => row.children[0].children[0];
  const piRow = rows[0];
  assert.equal(head(piRow).children[0].textContent, 'Pi');
  assert.equal(head(piRow).children[1].textContent, '0.86.1');
  assert.equal(head(piRow).children[2].attrs.get('data-state'), 'new', 'bolinha de versão nova');
  assert.equal(head(piRow).children[3].textContent, '→ v0.90.0 disponível');
  assert.equal(piRow.children[0].children[1].attrs.get('class'), 'component-hint');
  assert.equal(piRow.children[0].children[1].textContent, 'O programa que faz o tutor funcionar. Em desk/.pi-local (atualizável pela Mesa).');
  const atualizar = piRow.children[1].children[0];
  assert.equal(atualizar.attrs.get('id'), 'update-pi');
  assert.equal(atualizar.attrs.get('class'), 'component-update');
  assert.equal(atualizar.textContent, 'Atualizar o Pi');
  atualizar.listeners.get('click')({});
  assert.equal(pi, 1, 'Atualizar o Pi cai no handler do host');

  assert.equal(head(rows[1]).children[3].textContent, 'abaixo de 22.19 — o Pi exige Node 22.19+', 'aviso do Node vem do núcleo');
  assert.equal(head(rows[1]).children[2].attrs.get('data-state'), 'warn');

  const xournal = rows[2];
  assert.equal(head(xournal).children[1].textContent, '—', 'sem versão vira —');
  assert.equal(head(xournal).children[3].textContent, 'não dá para conferir daqui');
  assert.equal(xournal.children[0].children[1].textContent, 'Atualiza pelo site oficial.');
  const link = xournal.children[1].children[0];
  assert.equal(link.attrs.get('class'), 'component-link');
  assert.equal(link.attrs.get('data-url'), 'https://github.com/xournalpp/xournalpp/releases/latest');
  assert.equal(link.textContent, 'Abrir o site');
  assert.equal(xournal.children[1].children.length, 1, 'Xournal++ nunca ganha botão de atualizar');
});

/* #45: Pi e Claude Code atualizam de dentro da Mesa, conforme quem instalou. */
test('about: "Atualizar" com o comando exato; tutor respondendo desliga e explica', () => {
  const rows = [{id: 'claude', label: 'Claude Code', version: '2.1.296', state: 'outdated', latest: '2.1.302', command: 'claude update'}];
  const asked = [];
  renderComponentRows(rows, {AskUpdate: () => asked.push('ask')});
  const button = componentRows.children[0].children[1].children[0];
  assert.equal(button.textContent, 'Atualizar');
  assert.equal(button.attrs.get('class'), 'component-update tool-ask');
  assert.equal(button.attrs.get('data-command'), 'claude update');
  button.listeners.get('click')({});
  assert.deepEqual(asked, ['ask'], 'o clique só PEDE a confirmação');

  renderComponentRows(rows, {}, {busy: true});
  const actions = componentRows.children[0].children[1];
  assert.equal(actions.children[0].attrs.get('disabled'), '', 'o botão fica desligado');
  assert.equal(actions.children[0].attrs.get('title'), 'Espere o tutor terminar a resposta');
  assert.equal(actions.children[0].listeners.size, 0, 'e sem ação ligada');
  assert.equal(actions.children[1].textContent, 'Espere o tutor terminar');
});

test('about: instalação que a Mesa não reconhece só mostra o comando com Copiar', () => {
  renderComponentRows([{id: 'pi', label: 'Pi', version: '1.2.0', state: 'outdated', latest: '1.3.0', command: 'npm i -g @earendil-works/pi-coding-agent', copyOnly: true}], {CopyCommand: () => {}});
  const button = componentRows.children[0].children[1].children[0];
  assert.equal(button.textContent, 'Copiar');
  assert.equal(button.attrs.get('data-command'), 'npm i -g @earendil-works/pi-coding-agent');
  assert.equal(button.attrs.get('aria-label'), 'Copiar o comando: npm i -g @earendil-works/pi-coding-agent');
});

test('about: confirmação mostra o comando exato e o aviso de "mais nova que a testada"', () => {
  const rows = [{id: 'pi', label: 'Pi', version: '1.2.0', state: 'outdated', latest: '1.4.0', command: 'brew upgrade pi-coding-agent', ahead: true}];
  const runs = new Map([['pi', {$: 'RunConfirm', command: 'brew upgrade pi-coding-agent', warning: 'A 1.4.0 é mais nova que a testada com esta Mesa (1.3.0): o tutor pode se comportar diferente.'}]]);
  renderComponentRows(rows, {}, {runs});
  const row = componentRows.children[0];
  const head = row.children[0].children[0];
  assert.equal(head.children[4].textContent, 'mais nova que a testada', 'a linha diz que passou da testada');
  const panel = row.children[row.children.length - 1];
  assert.equal(panel.attrs.get('data-phase'), 'confirm');
  assert.equal(panel.children[0].textContent, 'Vai rodar: brew upgrade pi-coding-agent');
  assert.match(panel.children[1].textContent, /mais nova que a testada com esta Mesa \(1\.3\.0\)/);
  const [cancel, confirm] = panel.children[2].children;
  assert.deepEqual([cancel.textContent, confirm.textContent], ['Cancelar', 'Atualizar']);
});

test('about: execução mostra a saída e o resultado em uma frase', () => {
  const rows = [{id: 'claude', label: 'Claude Code', version: '2.1.296', state: 'outdated', latest: '2.1.302', command: 'claude update'}];
  renderComponentRows(rows, {}, {runs: new Map([['claude', {$: 'RunBusy', command: 'claude update', output: 'baixando…'}]])});
  let panel = componentRows.children[0].children[2];
  assert.equal(panel.attrs.get('data-phase'), 'busy');
  assert.equal(panel.children[1].attrs.get('class'), 'run-output');
  assert.equal(panel.children[1].textContent, 'baixando…');

  renderComponentRows(rows, {}, {runs: new Map([['claude', {$: 'RunDone', ok: true, sentence: 'Claude Code atualizado para 2.1.302.', output: 'ok'}]])});
  panel = componentRows.children[0].children[2];
  assert.equal(panel.attrs.get('data-phase'), 'done');
  assert.equal(panel.children[0].textContent, 'Claude Code atualizado para 2.1.302.');
});

test('about: sem rede o estado é "não deu para conferir", sem ação e sem erro', () => {
  renderComponentRows([{id: 'pi', label: 'Pi', version: '1.2.0', state: 'offline', command: 'npm i -g @earendil-works/pi-coding-agent'}]);
  const row = componentRows.children[0];
  assert.equal(row.children[0].children[0].children[3].textContent, 'não deu para conferir');
  assert.equal(row.children.length, 1, 'sem versão nova conhecida não há ação');
});

test('about: linha em dia traz só a descrição e nenhuma coluna de ações', () => {
  renderComponentRows([{id: 'node', label: 'Node (sistema)', version: '22.19.0', state: 'ok'}]);
  const row = componentRows.children[0];
  assert.equal(row.children.length, 1, 'sem link nem botão não há coluna de ações');
  assert.equal(row.children[0].children[0].children[3].textContent, 'em dia');
  assert.equal(row.children[0].children[1].textContent, 'Roda as atualizações da Mesa.');
  renderComponentRows([]);
  assert.equal(componentRows.children.length, 0);
  renderComponentRows(undefined);
  assert.equal(componentRows.children.length, 0);
});

/* C3: painel aberto nasce com as 4 linhas "Verificando…" (nada de vão vazio). */
test('about: abertura do painel já pinta as 4 linhas em Verificando…', () => {
  renderComponentChecking();
  const rows = componentRows.children;
  assert.deepEqual(rows.map((r) => r.attrs.get('data-id')), ['pi', 'claude', 'node', 'xournal'], 'as 4 linhas nascem logo');
  for (const row of rows) {
    assert.equal(row.children[0].children[0].children[3].textContent, 'Verificando…', `${row.attrs.get('data-id')} começa verificando`);
    assert.equal(row.children[0].children[0].children[2].attrs.get('data-state'), 'busy');
  }
  /* E a checagem real substitui no mesmo lugar: */
  renderComponentRows([
    {id: 'pi', label: 'Pi', version: '0.86.1', state: 'ok', canUpdate: false},
    {id: 'claude', label: 'Claude Code', version: '2.1.296', state: 'ok'},
    {id: 'node', label: 'Node (sistema)', version: '22.19.0', state: 'ok'},
    {id: 'xournal', label: 'Xournal++', version: '1.2.5', state: 'outdated', latest: '1.2.7'},
  ]);
  assert.equal(componentRows.children[3].children[0].children[0].children[3].textContent, '→ v1.2.7 disponível');
});

test('pi-dialog: título/mensagem passam pelo host e os campos vão para #dialog-fields', () => {
  const seen = [];
  renderPiDialog(
    {title: '', message: 'Escolha', field: {$: 'FieldPick', label: '', value: 'b', options: list({$: 'DialogOption', label: 'A', value: 'a'}, {$: 'DialogOption', label: 'B', value: 'b'})}},
    {inline: (html) => { seen.push(html); return html; }}
  );
  assert.deepEqual(seen.map(ptText), ['Tutor', 'Escolha'], 'título cai em Tutor e a mensagem sai crua');
  assert.equal(ptText(document.querySelector('#dialog-title').children[0].text), 'Tutor');
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
  assert.deepEqual(actions.children.map((button) => button.attrs.get('id') ?? button.attrs.get('value')), ['image-copy', 'image-open']);
  assert.equal(actions.children[0].listeners.get('click'), handlers.ImageCopy, 'copiar vem da tabela de handlers');
  assert.equal(actions.children[1].listeners.get('click'), handlers.ImageOpen, 'abrir vem da tabela de handlers');
  assert.equal(actions.children[1].attrs.has('hidden'), false, 'com arquivo o Abrir no Preview aparece');
  renderImageChrome({file: '', hasFile: false});
  assert.equal(document.querySelector('#image-title').textContent, 'Imagem');
  actions = imageActions;
  assert.equal(actions.children[1].attrs.get('hidden'), '', 'sem arquivo o Abrir no Preview some');
  assert.equal(actions.children.length, 2, 'só Copiar e Abrir: o fechar é o × do cabeçalho');
});
