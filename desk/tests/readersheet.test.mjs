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

test('a folha é a zona de soltar com três atalhos pequenos embaixo', () => {
  const root = build(sheet.sheet('Cálculo I'), {});
  assert.equal(root.tag, 'article');
  assert.equal(attr(root, 'class'), 'reader-sheet');
  assert.equal(attr(root, 'aria-label'), 'Leitor de Cálculo I');
  assert.deepEqual(root.children.map((kid) => attr(kid, 'class')), ['sheet-drop', 'sheet-links']);
  assert.equal(textOf(root.children[0]), 'Solte um PDF aqui');
  assert.equal(root.children[1].children.length, 5);
  assert.deepEqual(root.children[1].children.map((kid) => attr(kid, 'class')), ['sheet-link', 'sheet-sep', 'sheet-link', 'sheet-sep', 'sheet-link']);
});

test('matéria sem nome não vira "undefined": a folha só não tem nome no aria', () => {
  const root = build(sheet.sheet('   '), {});
  assert.equal(attr(root, 'aria-label'), 'Leitor de    ');
  assert.equal(textOf(root.children[0]), 'Solte um PDF aqui');
});

test('os três atalhos chamam os handlers da tabela do leitor', () => {
  const calls = [];
  const handlers = {
    OpenFile: () => calls.push('OpenFile'),
    RevealFolder: () => calls.push('RevealFolder'),
    AskTutor: () => calls.push('AskTutor'),
  };
  const root = build(sheet.sheet('Cálculo I'), handlers);
  const buttons = root.children[1].children.filter((kid) => kid.tag === 'button');
  const separators = root.children[1].children.filter((kid) => attr(kid, 'class') === 'sheet-sep');
  assert.deepEqual(separators.map(textOf), ['·', '·']);
  assert.ok(separators.every((kid) => attr(kid, 'aria-hidden') === 'true'));
  assert.deepEqual(buttons.map(textOf), ['Abrir', 'Pasta', 'Pedir ao tutor']);
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
  const failed = pdfPage.viewport({$: 'PdfFailed', reason: 'arquivo removido'}, {$: 'Nil'});
  assert.equal(attr(build(failed.value, {}), 'class'), 'pdf-failed');
});

test('a sobreposição do arrasto diz o rótulo do leitor', () => {
  assert.equal(ptText(pdfPage.dropHintText('Formulário & apoio')), 'Solte para abrir em Formulário & apoio');
  assert.equal(ptText(pdfPage.emptyOptionLabel()), 'Nenhum material');
});
