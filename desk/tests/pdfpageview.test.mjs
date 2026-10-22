import test from 'node:test';
import {ptText} from './pt-text.mjs';
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
    if (cur.head.name === name) return ptText(cur.head.value);
  }
  return undefined;
};
const shell = (patch = {}) => ({
  $: 'PdfShell', label: 'Enunciado', options: {$: 'Nil'}, path: '', minimized: false, findOpen: false, rotation: 0, ...patch,
});
const optionList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

test('panelShell monta a section: barra única, palco, busca, menu e faixa recolhida', () => {
  const node = pdfPage.panelShell(shell());
  assert.equal(node.$, 'ViewEl');
  assert.equal(node.tag, 'section');
  const built = build(node, {});
  assert.equal(attr(built, 'class'), 'pdf-panel');
  assert.equal(attr(built, 'aria-label'), 'Enunciado');
  assert.equal(attr(built, 'tabindex'), '0');
  const classes = built.children.map((kid) => attr(kid, 'class'));
  assert.deepEqual(classes, ['pdf-title', 'pdf-stage', 'pdf-find', 'pdf-more-pop', 'pdf-restore']);
});

test('titleBar: uma linha com rótulo, material, voltar, página, busca, favoritos e mais opções', () => {
  const built = build(pdfPage.titleBar(shell()), {});
  assert.equal(attr(built, 'class'), 'pdf-title');
  assert.equal(built.children.length, 10);
  assert.deepEqual(built.children.map((kid) => attr(kid, 'class')), [
    undefined, 'pdf-select', 'back icon-btn', 'prev icon-btn', 'page-number', 'page-total',
    'next icon-btn', 'find-toggle icon-btn', 'nav icon-btn', 'more icon-btn',
  ]);
  assert.equal(built.children[0].tag, 'strong');
  assert.equal(built.children[0].children[0].text, 'Enunciado');
  const [, select, back, prev, page, total, next, toggle, nav, more] = built.children;
  assert.equal(attr(select, 'aria-label'), 'Documento de Enunciado');
  assert.equal(attr(back, 'data-icon'), 'chevronLeft');
  assert.equal(attr(back, 'title'), 'Voltar à página anterior');
  assert.equal(attr(back, 'aria-label'), 'Voltar à página anterior de Enunciado');
  assert.equal(attr(back, 'hidden'), '');
  assert.equal(attr(prev, 'aria-label'), 'Página anterior');
  assert.equal(attr(next, 'aria-label'), 'Próxima página');
  assert.equal(attr(page, 'type'), 'number');
  assert.equal(attr(page, 'min'), '1');
  assert.equal(attr(page, 'value'), '1');
  assert.equal(attr(page, 'aria-label'), 'Página de Enunciado');
  assert.equal(total.children.length, 0);
  assert.equal(attr(toggle, 'data-icon'), 'search');
  assert.equal(attr(toggle, 'aria-pressed'), 'false');
  assert.equal(attr(nav, 'data-icon'), 'bookmark');
  assert.equal(attr(nav, 'title'), 'Sumário e favoritos');
  assert.equal(attr(nav, 'aria-label'), 'Sumário e favoritos de Enunciado');
  assert.equal(attr(nav, 'aria-expanded'), 'false');
  assert.equal(attr(more, 'data-icon'), 'more');
  assert.equal(attr(more, 'title'), 'Mais opções');
  assert.equal(attr(more, 'aria-label'), 'Mais opções de Enunciado');
  assert.equal(attr(more, 'aria-expanded'), 'false');
  assert.equal(rawAttr(pdfPage.moreBtn('Enunciado'), 'on:click'), 'ToggleMore');
  const searching = build(pdfPage.titleBar(shell({findOpen: true})), {});
  assert.equal(attr(searching.children[7], 'aria-pressed'), 'true');
});

test('moreMenu: o que saiu da barra mora no menu, com texto, e nasce fechado', () => {
  const built = build(pdfPage.moreMenu('Enunciado', 0, false), {});
  assert.equal(attr(built, 'class'), 'pdf-more-pop');
  assert.equal(attr(built, 'hidden'), '');
  assert.equal(attr(built, 'aria-label'), 'Mais opções de Enunciado');
  assert.deepEqual(built.children.map((kid) => attr(kid, 'class')), [
    'open more-item', 'page-shot more-item', 'more-zoom', 'fit more-item',
    'invert more-item', 'rotate more-item', 'collapse more-item',
  ]);
  const text = (node) => node.children.map((kid) => ptText(kid.text ?? '')).join('');
  assert.equal(text(built.children[0]), 'Abrir outro PDF');
  assert.equal(attr(built.children[0], 'data-icon'), 'plus');
  assert.equal(text(built.children[1]), 'Capturar página');
  assert.equal(attr(built.children[1], 'data-icon'), 'camera');
  assert.equal(text(built.children[3]), 'Ajustar à largura');
  assert.equal(attr(built.children[3], 'data-icon'), 'unfold');
  assert.equal(text(built.children[4]), 'Página escura');
  assert.equal(attr(built.children[4], 'aria-label'), 'Página escura');
  assert.equal(text(built.children[5]), 'Girar');
  assert.equal(text(built.children[6]), 'Minimizar este leitor');
  const zoom = built.children[2].children[1];
  assert.deepEqual(zoom.children.map((kid) => attr(kid, 'class')), ['out icon-btn', 'zoom-label', 'in icon-btn']);
  assert.equal(attr(zoom.children[0], 'aria-label'), 'Diminuir zoom');
  assert.equal(attr(zoom.children[2], 'aria-label'), 'Aumentar zoom');
  assert.equal(zoom.children[1].children.length, 0);
  const minimized = build(pdfPage.moreMenu('Enunciado', 0, true), {});
  assert.equal(attr(minimized.children[6], 'aria-pressed'), 'true');
  assert.equal(attr(minimized.children[6], 'data-icon'), 'chevronUp');
  assert.equal(text(minimized.children[6]), 'Restaurar este leitor');
});

test('restoreBtn: a faixa do leitor recolhido mostra o rótulo e reabre', () => {
  const built = build(pdfPage.restoreBtn('Formulário & apoio'), {});
  assert.equal(attr(built, 'class'), 'pdf-restore');
  assert.equal(attr(built, 'aria-label'), 'Abrir o leitor Formulário & apoio');
  assert.equal(attr(built.children[0], 'data-icon'), 'chevronLeft');
  assert.equal(built.children[1].children[0].text, 'Formulário & apoio');
  assert.equal(rawAttr(pdfPage.restoreBtn('Enunciado'), 'on:click'), 'ToggleCollapse');
});

test('rotateBtn: um botão por leitor, com a orientação corrente no title/aria', () => {
  const built = build(pdfPage.rotateBtn('Enunciado', 90), {});
  assert.equal(attr(built, 'class'), 'rotate more-item');
  assert.equal(attr(built, 'data-icon'), 'rotateCw');
  assert.equal(attr(built, 'title'), 'Girar 90° — orientação atual: 90°');
  assert.equal(attr(built, 'aria-label'), 'Girar página de Enunciado (atual: 90°)');
  assert.equal(rawAttr(pdfPage.rotateBtn('Enunciado', 0), 'on:click'), 'Rotate');
});

test('rotação: ciclo 0→90→180→270→0, validação e normalização do núcleo', () => {
  assert.equal(pdfPage.rotationStep(), 90);
  assert.equal(pdfPage.rotationNext(0), 90);
  assert.equal(pdfPage.rotationNext(90), 180);
  assert.equal(pdfPage.rotationNext(180), 270);
  assert.equal(pdfPage.rotationNext(270), 0);
  for (const ok of [0, 90, 180, 270]) assert.equal(pdfPage.rotationValid(ok), true);
  for (const bad of [45, 360]) assert.equal(pdfPage.rotationValid(bad), false);
  assert.equal(pdfPage.rotationNormalize(270), 270);
  assert.equal(pdfPage.rotationNormalize(45), 0);
  assert.equal(ptText(pdfPage.rotateToast(180)), 'Orientação: 180°');
});

test('select da biblioteca: opção vazia, nome/path e selected', () => {
  const options = optionList([{$: 'PdfOption', name: 'Limites.pdf', path: '/x/Limites.pdf'}]);
  const built = build(pdfPage.selectNode('Enunciado', options, '/x/Limites.pdf'), {});
  assert.equal(built.children.length, 2);
  assert.equal(attr(built.children[0], 'value'), '');
  assert.equal(built.children[0].children[0].text, 'Nenhum material');
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
  const page = {$: 'PdfPageBox', n: 2, width: '612px', height: '792px'};
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
    {$: 'PdfPageBox', n: 1, width: '10px', height: '20px'},
    {$: 'PdfPageBox', n: 2, width: '10px', height: '20px'},
  ]));
  renderInto(viewport, frame.value);
  assert.equal(viewport.children.length, 1);
  assert.deepEqual(viewport.children[0].children.map((kid) => attr(kid, 'data-page')), ['1', '2']);
  renderInto(viewport, pdfPage.viewport({$: 'PdfEmpty'}, {$: 'Nil'}).value);
  assert.equal(attr(viewport.children[0], 'class'), 'pdf-placeholder');
});

test('os handlers do painel vêm ligados na árvore (tabela do host)', () => {
  const handlers = {
    OpenFile() {}, ToggleFind() {}, PageShot() {}, ToggleCollapse() {}, ToggleInvert() {}, Rotate() {},
    NavBack() {}, ToggleNav() {}, ToggleMore() {},
    OpenDoc() {}, GotoPage() {}, Prev() {}, Next() {}, ZoomOut() {}, ZoomIn() {},
    Fit() {}, Find() {},
  };
  const panel = build(pdfPage.panelShell(shell()), handlers);
  const [title, , form, menu, strip] = panel.children;
  assert.equal(title.children[1].listeners.get('change'), handlers.OpenDoc);
  assert.equal(title.children[2].listeners.get('click'), handlers.NavBack);
  assert.equal(title.children[3].listeners.get('click'), handlers.Prev);
  assert.equal(title.children[4].listeners.get('change'), handlers.GotoPage);
  assert.equal(title.children[6].listeners.get('click'), handlers.Next);
  assert.equal(title.children[7].listeners.get('click'), handlers.ToggleFind);
  assert.equal(title.children[8].listeners.get('click'), handlers.ToggleNav);
  assert.equal(title.children[9].listeners.get('click'), handlers.ToggleMore);
  const zoom = menu.children[2].children[1];
  assert.equal(menu.children[0].listeners.get('click'), handlers.OpenFile);
  assert.equal(menu.children[1].listeners.get('click'), handlers.PageShot);
  assert.equal(zoom.children[0].listeners.get('click'), handlers.ZoomOut);
  assert.equal(zoom.children[2].listeners.get('click'), handlers.ZoomIn);
  assert.equal(menu.children[3].listeners.get('click'), handlers.Fit);
  assert.equal(menu.children[4].listeners.get('click'), handlers.ToggleInvert);
  assert.equal(menu.children[5].listeners.get('click'), handlers.Rotate);
  assert.equal(menu.children[6].listeners.get('click'), handlers.ToggleCollapse);
  assert.equal(strip.listeners.get('click'), handlers.ToggleCollapse);
  assert.equal(form.listeners.get('submit'), handlers.Find);
});
