import test from 'node:test';
import {ptText} from './pt-text.mjs';
import assert from 'node:assert/strict';
import sheet from '../src/generated/readersheet.core.js';
import pdfPage from '../src/generated/pdfpageview.core.js';
import {build} from '../src/view-host.mjs';

/* DOM falso mínimo (o mesmo desenho do `pdfpageview.test.mjs`): o aplicador só
   usa `createElement`, `createTextNode`, fragmento, atributos e listeners. */
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
const textOf = (node) => ptText(node.text) + node.children.map(textOf).join('');

test('a folha tem título, matéria, abertura, quatro itens e o quadro de soltar', () => {
  const root = build(sheet.sheet('Cálculo I'), {});
  assert.equal(root.tag, 'article');
  assert.equal(attr(root, 'class'), 'reader-sheet');
  assert.equal(attr(root, 'aria-label'), 'Lista 0 de Cálculo I');
  assert.deepEqual(root.children.map((kid) => attr(kid, 'class')), [
    'sheet-title', 'sheet-course', 'sheet-intro', 'sheet-items', 'sheet-drop',
  ]);
  assert.equal(textOf(root.children[0]), 'Lista 0');
  assert.equal(textOf(root.children[1]), 'Cálculo I · pôr algo na mesa');
  assert.equal(root.children[3].children.length, 4);
});

test('matéria sem nome não vira "undefined": só o convite', () => {
  const root = build(sheet.sheet('   '), {});
  assert.equal(textOf(root.children[1]), 'Pôr algo na mesa');
});

test('os três atalhos chamam os handlers da tabela do leitor', () => {
  const calls = [];
  const handlers = {
    OpenFile: () => calls.push('OpenFile'),
    RevealFolder: () => calls.push('RevealFolder'),
    AskTutor: () => calls.push('AskTutor'),
  };
  const root = build(sheet.sheet('Cálculo I'), handlers);
  const buttons = root.children[3].children.flatMap((li) => li.children.filter((kid) => kid.tag === 'button'));
  assert.deepEqual(buttons.map(textOf), ['Abrir PDF…', 'Mostrar a pasta', 'Pedir ao tutor']);
  for (const button of buttons) button.listeners.get('click')();
  assert.deepEqual(calls, ['OpenFile', 'RevealFolder', 'AskTutor']);
});

test('o pedido ao tutor cita a matéria e fala de lista de exercícios', () => {
  assert.equal(ptText(sheet.tutorSeed('Cálculo I')), 'Uma lista de exercícios de Cálculo I para eu praticar.');
  assert.equal(ptText(sheet.tutorSeed('')), 'Uma lista de exercícios para eu praticar.');
});

test('o miolo do leitor: folha no estado PdfSheet, nada mudou nos outros', () => {
  const out = pdfPage.viewport({$: 'PdfSheet', course: 'Cálculo I'}, {$: 'Nil'});
  assert.equal(out.$, 'Some');
  assert.equal(attr(build(out.value, {}), 'class'), 'reader-sheet');
  const placeholder = pdfPage.viewport({$: 'PdfEmpty'}, {$: 'Nil'});
  assert.equal(attr(build(placeholder.value, {}), 'class'), 'pdf-placeholder');
  assert.deepEqual(pdfPage.viewport({$: 'PdfLoading'}, {$: 'Nil'}), {$: 'None'});
});

test('a sobreposição do arrasto diz o rótulo do leitor', () => {
  assert.equal(ptText(pdfPage.dropHintText('Formulário & apoio')), 'Solte para abrir em Formulário & apoio');
  assert.equal(ptText(pdfPage.emptyOptionLabel()), 'Nenhum material');
});
