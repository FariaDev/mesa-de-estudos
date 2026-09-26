import test from 'node:test';
import assert from 'node:assert/strict';
import pdfPage from '../src/generated/pdfpageview.core.js';
import {build, renderChildren, renderInto} from '../src/view-host.mjs';

/* DOM falso mínimo: só o que o aplicador usa (o fragmento "puxa" os filhos
   do holder, como no DOM de verdade). Mesmo desenho do `pdfview.test.mjs`. */
class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.text = '';
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.tag === '#frag') {
        this.append(...node.children);
        continue;
      }
      this.children.push(node);
    }
  }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  addEventListener(event, fn) {
    this.listeners.set(event, fn);
  }
}

globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (text) => Object.assign(new FakeNode('#text'), {text: String(text)}),
  createDocumentFragment: () => new FakeNode('#frag'),
};

const attr = (node, name) => node.attrs.get(name);
// Attr do nó Bend cru (o `build` transforma `on:*` em listener, não em atributo).
const rawAttr = (node, name) => {
  for (let cur = node.attrs; cur && cur.$ === 'Con'; cur = cur.tail) {
    if (cur.head.name === name) return cur.head.value;
  }
  return undefined;
};
const shell = (patch = {}) => ({
  $: 'PdfShell', label: 'Enunciado', options: {$: 'Nil'}, path: '', minimized: false, findOpen: false, ...patch,
});
const optionList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

test('panelShell monta a section e as quatro regiões do leitor', () => {
  const node = pdfPage.panelShell(shell());
  assert.equal(node.$, 'ViewEl');
  assert.equal(node.tag, 'section');
  const built = build(node, {});
  assert.equal(attr(built, 'class'), 'pdf-panel');
  assert.equal(attr(built, 'aria-label'), 'Enunciado');
  assert.equal(attr(built, 'tabindex'), '0');
  const classes = built.children.map((kid) => attr(kid, 'class'));
  assert.deepEqual(classes, ['pdf-title', 'pdf-tools', 'pdf-stage', 'pdf-find']);
});

test('titleBar: rótulo, select, botões de ícone (Voltar incluso) e estado de minimizar/busca', () => {
  const built = build(pdfPage.titleBar(shell()), {});
  assert.equal(attr(built, 'class'), 'pdf-title');
  assert.equal(built.children[0].tag, 'strong');
  assert.equal(built.children[0].children[0].text, 'Enunciado');
  const select = built.children[1];
  assert.equal(attr(select, 'class'), 'pdf-select');
  assert.equal(attr(select, 'aria-label'), 'Documento de Enunciado');
  const open = built.children[2], toggle = built.children[3], shot = built.children[4], back = built.children[5], nav = built.children[6], collapse = built.children[7];
  assert.equal(attr(open, 'class'), 'open icon-btn');
  assert.equal(attr(open, 'data-icon'), 'plus');
  assert.equal(attr(open, 'title'), 'Abrir outro PDF');
  assert.equal(attr(open, 'aria-label'), 'Abrir PDF em Enunciado');
  assert.equal(attr(toggle, 'class'), 'find-toggle icon-btn');
  assert.equal(attr(toggle, 'data-icon'), 'search');
  assert.equal(attr(toggle, 'aria-pressed'), 'false');
  assert.equal(attr(shot, 'class'), 'page-shot icon-btn');
  assert.equal(attr(shot, 'title'), 'Mandar esta página como imagem no chat');
  assert.equal(attr(back, 'class'), 'back icon-btn');
  assert.equal(attr(back, 'data-icon'), 'chevronLeft');
  assert.equal(attr(back, 'title'), 'Voltar à página anterior');
  assert.equal(attr(back, 'aria-label'), 'Voltar à página anterior de Enunciado');
  assert.equal(attr(back, 'hidden'), '');
  assert.equal(attr(nav, 'class'), 'nav icon-btn');
  assert.equal(attr(nav, 'data-icon'), 'book');
  assert.equal(attr(nav, 'title'), 'Favoritos e sumário');
  assert.equal(attr(nav, 'aria-label'), 'Navegar em Enunciado');
  assert.equal(attr(nav, 'aria-expanded'), 'false');
  assert.equal(attr(collapse, 'class'), 'collapse icon-btn');
  assert.equal(attr(collapse, 'title'), 'Minimizar este leitor');
  assert.equal(attr(collapse, 'data-icon'), 'chevronDown');
  const minimized = build(pdfPage.titleBar(shell({minimized: true, findOpen: true})), {});
  const collapsed = minimized.children[7], pressed = minimized.children[3];
  assert.equal(attr(collapsed, 'aria-pressed'), 'true');
  assert.equal(attr(collapsed, 'title'), 'Restaurar este leitor');
  assert.equal(attr(collapsed, 'data-icon'), 'chevronUp');
  assert.equal(attr(pressed, 'aria-pressed'), 'true');
});

test('toolsBar mantém a ordem, o page-number e os espaços que o host preenche', () => {
  const built = build(pdfPage.toolsBar('Enunciado'), {});
  assert.equal(attr(built, 'class'), 'pdf-tools');
  assert.equal(built.children.length, 9);
  assert.deepEqual(built.children.map((kid) => attr(kid, 'class')), [
    'prev icon-btn', 'page-number', 'page-total', 'next icon-btn', 'out icon-btn',
    'zoom-label', 'in icon-btn', 'fit icon-btn', 'invert icon-btn',
  ]);
  const page = built.children[1];
  assert.equal(attr(page, 'type'), 'number');
  assert.equal(attr(page, 'min'), '1');
  assert.equal(attr(page, 'value'), '1');
  assert.equal(attr(page, 'aria-label'), 'Página de Enunciado');
  assert.equal(attr(built.children[0], 'aria-label'), 'Página anterior');
  assert.equal(attr(built.children[3], 'aria-label'), 'Próxima página');
  assert.equal(attr(built.children[7], 'title'), 'Ajustar à largura');
  assert.equal(attr(built.children[8], 'aria-label'), 'Inverter cores da página');
  assert.equal(built.children[2].children.length, 0);
  assert.equal(built.children[5].children.length, 0);
});

test('select da biblioteca: opção vazia, nome/path e selected', () => {
  const options = optionList([{$: 'PdfOption', name: 'Limites.pdf', path: '/x/Limites.pdf'}]);
  const built = build(pdfPage.selectNode('Enunciado', options, '/x/Limites.pdf'), {});
  assert.equal(built.children.length, 2);
  assert.equal(attr(built.children[0], 'value'), '');
  assert.equal(built.children[0].children[0].text, 'Escolha um PDF…');
  assert.equal(attr(built.children[1], 'value'), '/x/Limites.pdf');
  assert.equal(attr(built.children[1], 'selected'), '');
  assert.equal(built.children[1].children[0].text, 'Limites.pdf');
  const other = build(pdfPage.selectNode('Enunciado', options, '/y/Outro.pdf'), {});
  assert.equal(attr(other.children[1], 'selected'), undefined);
});

test('findForm: form escondido, input e contador escondido', () => {
  const built = build(pdfPage.findForm('Enunciado'), {});
  assert.equal(built.tag, 'form');
  assert.equal(attr(built, 'class'), 'pdf-find');
  assert.equal(attr(built, 'hidden'), '');
  assert.equal(rawAttr(pdfPage.findForm('Enunciado'), 'on:submit'), 'Find');
  const input = built.children[0], count = built.children[1], button = built.children[2];
  assert.equal(attr(input, 'placeholder'), 'Buscar neste PDF…');
  assert.equal(attr(input, 'aria-label'), 'Buscar em Enunciado');
  assert.equal(attr(count, 'class'), 'find-count');
  assert.equal(attr(count, 'hidden'), '');
  assert.equal(button.children[0].text, 'Buscar');
});

test('stage e divider preservam o contrato do smoke', () => {
  const stage = build(pdfPage.stage(), {});
  assert.deepEqual(stage.children.map((kid) => attr(kid, 'class')), ['pdf-viewport', 'pdf-foot']);
  const div = build(pdfPage.divider(), {});
  assert.equal(attr(div, 'class'), 'pdf-divider');
  assert.equal(attr(div, 'role'), 'separator');
  assert.equal(attr(div, 'tabindex'), '0');
  assert.equal(attr(div, 'aria-label'), 'Redimensionar leitores de PDF');
});

test('viewport: vazio mostra o placeholder, pronto monta o documento', () => {
  const page = {$: 'PdfPageBox', n: 2n, width: '612px', height: '792px'};
  const ready = pdfPage.viewport({$: 'PdfReady'}, optionList([page]));
  assert.equal(ready.$, 'Some');
  const doc = build(ready.value, {});
  assert.equal(attr(doc, 'class'), 'pdf-document');
  assert.equal(doc.children.length, 1);
  assert.equal(attr(doc.children[0], 'class'), 'pdf-page');
  assert.equal(attr(doc.children[0], 'data-page'), '2');
  assert.equal(attr(doc.children[0], 'style'), 'width:612px;height:792px');
  const empty = pdfPage.viewport({$: 'PdfEmpty'}, {$: 'Nil'});
  assert.equal(attr(build(empty.value, {}), 'class'), 'pdf-placeholder');
  assert.deepEqual(pdfPage.viewport({$: 'PdfLoading'}, {$: 'Nil'}), {$: 'None'});
  assert.deepEqual(pdfPage.viewport({$: 'PdfFailed'}, {$: 'Nil'}), {$: 'None'});
});

test('hlSegments: destaques com os índices da dobra e sem sobreposição', () => {
  // O host monta os filhos do span com `renderChildren` (nós DOM).
  const span = (text, folded, term) => {
    const el = new FakeNode('span');
    renderChildren(el, pdfPage.hlSegments(text, folded, term), {});
    return el;
  };
  const shape = (el) => el.children.map((kid) => kid.tag === '#text' ? kid.text : `[${attr(kid, 'class')}]${kid.children[0].text}`);
  assert.deepEqual(shape(span('abcabc', 'abcabc', 'ab')), ['[pdf-hl]ab', 'c', '[pdf-hl]ab', 'c']);
  assert.deepEqual(shape(span('aaa', 'aaa', 'aa')), ['[pdf-hl]aa', 'a']);
  assert.deepEqual(shape(span('Ação', 'acao', 'ca')), ['A', '[pdf-hl]çã', 'o']);
});

test('hlSegments: sem casamento, o span continua um nó de texto único', () => {
  for (const segs of [pdfPage.hlSegments('abc', 'abc', 'zz'), pdfPage.hlSegments('abc', 'abc', '')]) {
    const built = build({$: 'ViewEl', tag: 'div', attrs: {$: 'Nil'}, kids: segs}, {});
    assert.equal(built.children.length, 1);
    assert.equal(built.children[0].tag, '#text');
    assert.equal(built.children[0].text, 'abc');
  }
});

test('renderInto aplica a moldura no viewport como o host faz', () => {
  const viewport = new FakeNode('div');
  const frame = pdfPage.viewport({$: 'PdfReady'}, optionList([
    {$: 'PdfPageBox', n: 1n, width: '10px', height: '20px'},
    {$: 'PdfPageBox', n: 2n, width: '10px', height: '20px'},
  ]));
  renderInto(viewport, frame.value);
  assert.equal(viewport.children.length, 1);
  assert.deepEqual(viewport.children[0].children.map((kid) => attr(kid, 'data-page')), ['1', '2']);
  renderInto(viewport, pdfPage.viewport({$: 'PdfEmpty'}, {$: 'Nil'}).value);
  assert.equal(attr(viewport.children[0], 'class'), 'pdf-placeholder');
});

test('os handlers do painel vêm ligados na árvore (tabela do host)', () => {
  const handlers = {
    OpenFile() {}, ToggleFind() {}, PageShot() {}, ToggleCollapse() {}, NavBack() {}, ToggleNav() {},
    OpenDoc() {}, GotoPage() {}, Prev() {}, Next() {}, ZoomOut() {}, ZoomIn() {},
    Fit() {}, ToggleInvert() {}, Find() {},
  };
  const panel = build(pdfPage.panelShell(shell()), handlers);
  const title = panel.children[0], tools = panel.children[1], form = panel.children[3];
  assert.equal(title.children[1].listeners.get('change'), handlers.OpenDoc);
  assert.equal(title.children[2].listeners.get('click'), handlers.OpenFile);
  assert.equal(title.children[3].listeners.get('click'), handlers.ToggleFind);
  assert.equal(title.children[4].listeners.get('click'), handlers.PageShot);
  assert.equal(title.children[5].listeners.get('click'), handlers.NavBack);
  assert.equal(title.children[6].listeners.get('click'), handlers.ToggleNav);
  assert.equal(title.children[7].listeners.get('click'), handlers.ToggleCollapse);
  assert.equal(tools.children[0].listeners.get('click'), handlers.Prev);
  assert.equal(tools.children[1].listeners.get('change'), handlers.GotoPage);
  assert.equal(tools.children[3].listeners.get('click'), handlers.Next);
  assert.equal(tools.children[4].listeners.get('click'), handlers.ZoomOut);
  assert.equal(tools.children[6].listeners.get('click'), handlers.ZoomIn);
  assert.equal(tools.children[7].listeners.get('click'), handlers.Fit);
  assert.equal(tools.children[8].listeners.get('click'), handlers.ToggleInvert);
  assert.equal(form.listeners.get('submit'), handlers.Find);
});
