import test from 'node:test';
import assert from 'node:assert/strict';
import findCore from '../src/generated/find.core.js';
import pdfView from '../src/generated/pdfview.core.js';
import {build} from '../src/view-host.mjs';

const Nil = {$: 'Nil'};
const hitsList = hits => hits.reduceRight((tail, {page, count}) => ({$: 'Con', head: {page: BigInt(page), count: BigInt(count)}, tail}), Nil);

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
  addEventListener() {}
}

globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (text) => Object.assign(new FakeNode('#text'), {text: String(text)}),
  createDocumentFragment: () => new FakeNode('#frag'),
};

test('gridFlags: os quatro pares de minimizar', () => {
  assert.deepEqual(pdfView.gridFlags(false, false), {$: 'GridFlags', otherMin: false, hasMin: false, hasOtherMin: false});
  assert.deepEqual(pdfView.gridFlags(false, true), {$: 'GridFlags', otherMin: true, hasMin: true, hasOtherMin: false});
  assert.deepEqual(pdfView.gridFlags(true, false), {$: 'GridFlags', otherMin: false, hasMin: true, hasOtherMin: true});
  assert.deepEqual(pdfView.gridFlags(true, true), {$: 'GridFlags', otherMin: false, hasMin: true, hasOtherMin: false});
});

test('gridClass e panelClass batem as classes do CSS', () => {
  assert.equal(pdfView.gridClass(true, false).value, 'has-min has-other-min');
  assert.equal(pdfView.gridClass(false, true).value, 'other-min has-min');
  assert.equal(pdfView.gridClass(false, false).value, '');
  assert.equal(pdfView.panelClass(true, true).value, 'pdf-panel minimized pinned');
  assert.equal(pdfView.panelClass(false, false).value, 'pdf-panel');
});

test('panelFlags e collapseTitle', () => {
  assert.deepEqual(pdfView.panelFlags(true, false), {$: 'PanelFlags', minimized: true, pinned: false});
  assert.equal(pdfView.collapseTitle(true), 'Restaurar este leitor');
  assert.equal(pdfView.collapseTitle(false), 'Minimizar este leitor');
});

test('navChrome desliga os dois sem doc; com doc ecoa os fatos', () => {
  assert.deepEqual(pdfView.navChrome(false, false, false), {$: 'NavChrome', prevDisabled: true, nextDisabled: true});
  assert.deepEqual(pdfView.navChrome(true, true, false), {$: 'NavChrome', prevDisabled: true, nextDisabled: false});
  assert.deepEqual(pdfView.navChrome(true, false, true), {$: 'NavChrome', prevDisabled: false, nextDisabled: true});
});

test('rótulos de página, zoom e rodapé 1:1 com o chrome antigo', () => {
  assert.equal(pdfView.pageTotalDash(), '/ —');
  assert.equal(pdfView.pageTotalText(12n), '/ 12');
  assert.equal(pdfView.pageNumberValue(2n), '2');
  assert.equal(pdfView.pageNumberMax(10n), '10');
  assert.equal(pdfView.zoomLabelText(100n), '100%');
  assert.equal(pdfView.footLoadingText(), 'Carregando…');
  assert.equal(pdfView.footErrorText(), 'Não foi possível abrir o PDF.');
  assert.equal(
    pdfView.footReadyText(2n, 10n, pdfView.modeContinuous(), 'Limites.pdf'),
    'Página 2 de 10 · rolagem contínua · Limites.pdf'
  );
});

test('findCountChrome formata Hidden / All / Shown já resolvidos', () => {
  assert.deepEqual(pdfView.findCountChrome(true, false, 0n, 0n), {$: 'CountChrome', hidden: true, text: ''});
  assert.deepEqual(pdfView.findCountChrome(false, false, 0n, 4n), {$: 'CountChrome', hidden: false, text: '4 ocorrências'});
  assert.deepEqual(pdfView.findCountChrome(false, true, 1n, 3n), {$: 'CountChrome', hidden: false, text: '1/3'});
});

test('find.bend → pdfview: paridade com o contador antigo', () => {
  const facts = (pages, current) => {
    const out = findCore.findCount(hitsList(pages), BigInt(current));
    const hidden = out.$ === 'Hidden';
    const shown = out.$ === 'Shown';
    return pdfView.findCountChrome(hidden, shown, shown ? out.index : 0n, hidden ? 0n : out.total ?? 0n);
  };
  const pages = [{page: 1, count: 2}, {page: 3, count: 1}];
  assert.equal(facts(pages, 1).text, '1/3');
  assert.equal(facts(pages, 2).text, '3 ocorrências');
  assert.equal(facts([], 1).hidden, true);
});

test('placeholder é a árvore que o host cola no viewport', () => {
  const node = pdfView.placeholder();
  assert.equal(node.$, 'ViewEl');
  assert.equal(node.tag, 'div');
  const built = build(node);
  assert.equal(built.tag, 'div');
  assert.equal(built.attrs.get('class'), 'pdf-placeholder');
  assert.equal(built.children[0].text, 'Escolha um PDF da biblioteca ou abra um arquivo local.');
});
