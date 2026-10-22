// Numeração impressa e PDF solto: unidade do host (pdf-labels/pdf-drop) e do
// núcleo gerado (pdfpageview/pdfview). Sem Electron, sem PDF real, sem DOM de
// verdade: o que aqui passa é contrato; o comportamento no app fica no
// `hunt-pdf-qol.mjs`.
//
// Rodar em desk/: node --test tests/pdf-labels.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {offsetFacts,offsetFromRecord,labelsList,readDocLabels,normalizeOffset,MAX_PAGE_OFFSET} from '../src/pdf-labels.mjs';
import {bindPdfDrop,draggedLooksPdf,isPdfFile} from '../src/pdf-drop.mjs';
import pdfPage from '../src/generated/pdfpageview.core.js';
import pdfView from '../src/generated/pdfview.core.js';
import {build} from '../src/view-host.mjs';
import {ptText} from './pt-text.mjs';

/* ------------------------------------------------------------------ */
/* DOM falso mínimo (mesmo desenho do pdfpageview.test.mjs)            */
/* ------------------------------------------------------------------ */

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = new Map();
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
const list = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});
const labels = (items) => list(items);

/* ------------------------------------------------------------------ */
/* pdf-labels.mjs                                                      */
/* ------------------------------------------------------------------ */

test('normalizeOffset: null, lixo e fora do teto viram automático; zero é ajuste', () => {
  assert.equal(normalizeOffset(0), 0);
  assert.equal(normalizeOffset(-3), -3);
  assert.equal(normalizeOffset(MAX_PAGE_OFFSET), MAX_PAGE_OFFSET);
  assert.equal(normalizeOffset(MAX_PAGE_OFFSET + 1), null);
  assert.equal(normalizeOffset(1.5), null);
  assert.equal(normalizeOffset('3'), null);
  assert.equal(normalizeOffset(null), null);
  assert.equal(normalizeOffset(undefined), null);
});

test('offsetFromRecord: só {offset} inteiro entra; formato antigo vira automático', () => {
  assert.equal(offsetFromRecord({offset: 2}), 2);
  assert.equal(offsetFromRecord({offset: null}), null);
  assert.equal(offsetFromRecord({offset: '2'}), null);
  assert.equal(offsetFromRecord({}), null);
  assert.equal(offsetFromRecord(null), null);
});

test('offsetFacts: OffsetAuto e OffsetValue com sinal e magnitude', () => {
  assert.deepEqual(offsetFacts(null), {$: 'OffsetAuto'});
  assert.deepEqual(offsetFacts(0), {$: 'OffsetValue', negative: false, magnitude: 0});
  assert.deepEqual(offsetFacts(4), {$: 'OffsetValue', negative: false, magnitude: 4});
  assert.deepEqual(offsetFacts(-4), {$: 'OffsetValue', negative: true, magnitude: 4});
});

test('labelsList: ordem das páginas e entrada estranha vira vazio', () => {
  const built = labelsList(['i', null, 3]);
  assert.deepEqual(built, {$: 'Con', head: 'i', tail: {$: 'Con', head: '', tail: {$: 'Con', head: '3', tail: {$: 'Nil'}}}});
  assert.deepEqual(labelsList(null), {$: 'Nil'});
});

test('readDocLabels: array do PDF.js, recorte por numPages e falhas viram []', async () => {
  assert.deepEqual(await readDocLabels({numPages: 3, getPageLabels: async () => ['i', 'ii', '1', 'x']}), ['i', 'ii', '1']);
  assert.deepEqual(await readDocLabels({numPages: 2, getPageLabels: async () => null}), []);
  assert.deepEqual(await readDocLabels({numPages: 2, getPageLabels: async () => { throw new Error('sem árvore'); }}), []);
  assert.deepEqual(await readDocLabels({numPages: 2}), []);
  assert.deepEqual(await readDocLabels(null), []);
});

/* ------------------------------------------------------------------ */
/* Núcleo: rótulo impresso e resolução                                 */
/* ------------------------------------------------------------------ */

test('printedLabel: próprios do PDF vencem; offset só cobre o que falta', () => {
  assert.equal(pdfPage.printedLabel(labels([]), {$: 'OffsetAuto'}, 3), '');
  assert.equal(pdfPage.printedLabel(labels([]), {$: 'OffsetValue', negative: false, magnitude: 2}, 1), '3');
  assert.equal(pdfPage.printedLabel(labels([]), {$: 'OffsetValue', negative: true, magnitude: 3}, 5), '2');
  // Front matter: impressa <= 0 não é rótulo.
  assert.equal(pdfPage.printedLabel(labels([]), {$: 'OffsetValue', negative: true, magnitude: 3}, 2), '');
  assert.equal(pdfPage.printedLabel(labels(['i', 'ii', '1']), {$: 'OffsetValue', negative: false, magnitude: 9}, 3), '1');
  // PDF parcial: a página sem rótulo próprio cai no ajuste, com a física certa.
  assert.equal(pdfPage.printedLabel(labels(['i']), {$: 'OffsetValue', negative: false, magnitude: 4}, 2), '6');
});

test('resolvePrinted: rótulo exato, caixa ignorada, repetido em ciclo', () => {
  const own = labels(['i', 'ii', 'i']);
  assert.deepEqual(pdfPage.resolvePrinted(own, {$: 'OffsetAuto'}, 10, 1, 'ii'), {$: 'Some', value: 2});
  assert.deepEqual(pdfPage.resolvePrinted(labels(['IV']), {$: 'OffsetAuto'}, 10, 1, 'iv'), {$: 'Some', value: 1});
  assert.deepEqual(pdfPage.resolvePrinted(own, {$: 'OffsetAuto'}, 10, 1, 'i'), {$: 'Some', value: 3});
  assert.deepEqual(pdfPage.resolvePrinted(own, {$: 'OffsetAuto'}, 10, 3, 'i'), {$: 'Some', value: 1});
});

test('resolvePrinted: sem rótulos é número impresso, com ajuste desfeito', () => {
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetAuto'}, 10, 1, '5'), {$: 'Some', value: 5});
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetValue', negative: true, magnitude: 3}, 10, 1, '2'), {$: 'Some', value: 5});
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetValue', negative: false, magnitude: 2}, 10, 1, '5'), {$: 'Some', value: 3});
});

test('resolvePrinted: vazio, não numérico, fora do documento e abaixo da 1ª são None', () => {
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetAuto'}, 10, 1, '  '), {$: 'None'});
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetAuto'}, 10, 1, 'abc'), {$: 'None'});
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetAuto'}, 10, 1, '0'), {$: 'None'});
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetAuto'}, 10, 1, '11'), {$: 'None'});
  assert.deepEqual(pdfPage.resolvePrinted(labels([]), {$: 'OffsetValue', negative: false, magnitude: 2}, 10, 1, '1'), {$: 'None'});
  assert.deepEqual(pdfPage.resolvePrinted(labels(['i']), {$: 'OffsetAuto'}, 10, 1, 'zz'), {$: 'None'});
});

test('printedLabel é a página FÍSICA: goto/estado/citação não mudam', () => {
  // O rótulo existe, mas o alvo devolvido é sempre 1..total (físico).
  assert.deepEqual(pdfPage.resolvePrinted(labels(['A-1', 'A-2']), {$: 'OffsetAuto'}, 2, 1, 'A-2'), {$: 'Some', value: 2});
  assert.deepEqual(pdfPage.resolvePrinted(labels(['A-1', 'A-2']), {$: 'OffsetAuto'}, 1, 1, 'A-2'), {$: 'None'});
});

/* O host junta o modo do ajuste e o rótulo da página (pdf.mjs): um núcleo não concatena mensagens (#41). */
const panelStatus = (own, offset, label) => `${ptText(pdfPage.printedStatusText(own, offset))} · ${ptText(pdfPage.printedCurrentText(label))}`;

test('textos do controle: status, achado e ajuste salvo', () => {
  assert.equal(panelStatus(false, {$: 'OffsetValue', negative: false, magnitude: 2}, '5'), 'Impressa = física + 2 · Impressa: 5');
  assert.equal(panelStatus(true, {$: 'OffsetAuto'}, ''), 'Numeração do PDF · Esta página não tem número impresso.');
  assert.equal(ptText(pdfPage.printedFoundText('iv', 7)), 'Impressa iv → página 7.');
  assert.equal(ptText(pdfPage.printedNotFoundText()), 'Rótulo não encontrado neste PDF.');
  assert.equal(ptText(pdfPage.printedBadOffsetText()), 'Use um inteiro entre -1000000 e 1000000.');
  assert.equal(ptText(pdfPage.printedSavedOffsetText({$: 'OffsetAuto'})), 'Numeração impressa no automático.');
  assert.equal(ptText(pdfPage.printedSavedOffsetText({$: 'OffsetValue', negative: true, magnitude: 3})), 'Deslocamento -3 salvo.');
  assert.equal(ptText(pdfPage.dropOpenedText('Extra.pdf', 'Formulário')), '“Extra.pdf” aberto em Formulário.');
  assert.equal(ptText(pdfPage.dropInvalidText()), 'Solte um arquivo PDF neste leitor.');
});

/* ------------------------------------------------------------------ */
/* Núcleo: árvores do controle e do rodapé                             */
/* ------------------------------------------------------------------ */

test('printedRow: form escondido por padrão, aberto sem hidden, submit GoPrinted', () => {
  const closed = build(pdfPage.printedRow('Enunciado', false), {});
  assert.equal(attr(closed, 'class'), 'pdf-printed');
  assert.equal(attr(closed, 'on:submit') ?? null, null); // on:* vira listener, não atributo
  assert.equal(attr(closed, 'hidden'), '');
  assert.equal(attr(closed, 'aria-label'), 'Numeração impressa de Enunciado');
  const open = build(pdfPage.printedRow('Enunciado', true), {});
  assert.equal(attr(open, 'hidden'), undefined);
  const submit = pdfPage.printedRow('Enunciado', true).attrs;
  assert.equal(submit.tail.head.name, 'on:submit');
  assert.equal(submit.tail.head.value, 'GoPrinted');
  const input = build(pdfPage.printedInput('Enunciado'), {});
  assert.equal(attr(input, 'placeholder'), 'ex.: 5, iv, A-2');
  assert.equal(attr(input, 'aria-label'), 'Ir para página impressa em Enunciado');
  const offset = build(pdfPage.printedOffsetInput('Enunciado'), {});
  assert.equal(attr(offset, 'min'), '-1000000');
  assert.equal(attr(offset, 'max'), '1000000');
  assert.equal(attr(offset, 'type'), 'number');
});

test('printedToggleBtn e dropHint: rótulos, aria e handlers', () => {
  const toggle = build(pdfPage.printedToggleBtn('Enunciado', true), {});
  assert.equal(attr(toggle, 'class'), 'printed-toggle more-item');
  assert.equal(attr(toggle, 'data-icon'), 'scan');
  assert.equal(attr(toggle, 'aria-expanded'), 'true');
  assert.equal(attr(toggle, 'title'), 'Numeração impressa e ajuste deste PDF');
  const hint = build(pdfPage.dropHint('Enunciado'), {});
  assert.equal(attr(hint, 'class'), 'pdf-drop-hint');
  assert.equal(attr(hint, 'hidden'), '');
  assert.equal(hint.children[0].text, 'Solte para abrir em Enunciado');
});

test('footReadyLabeled: texto do rodapé e nome completo no title', () => {
  const withLabel = build(pdfView.footReadyLabeled(7, 200, 'Livro.pdf', 'iv'), {});
  assert.equal(attr(withLabel, 'title'), 'Página 7 de 200 · rótulo iv · rolagem contínua · Livro.pdf');
  assert.equal(withLabel.children[0].text, attr(withLabel, 'title'));
  const without = build(pdfView.footReadyLabeled(2, 10, 'Limites.pdf', ''), {});
  assert.equal(without.children[0].text, 'Página 2 de 10 · rolagem contínua · Limites.pdf');
});

/* ------------------------------------------------------------------ */
/* pdf-drop.mjs                                                        */
/* ------------------------------------------------------------------ */

test('isPdfFile: tipo PDF ou extensão .pdf; imagem recusada', () => {
  assert.equal(isPdfFile({name: 'lista.pdf', type: ''}), true);
  assert.equal(isPdfFile({name: 'LISTA.PDF', type: 'application/octet-stream'}), true);
  assert.equal(isPdfFile({name: 'x', type: 'application/pdf'}), true);
  assert.equal(isPdfFile({name: 'foto.png', type: 'image/png'}), false);
  assert.equal(isPdfFile({name: '', type: ''}), false);
  assert.equal(isPdfFile(null), false);
});

test('draggedLooksPdf: tipo desconhecido vale área alvo; imagem não', () => {
  assert.equal(draggedLooksPdf({items: [{kind: 'file', type: 'application/pdf'}]}), true);
  assert.equal(draggedLooksPdf({items: [{kind: 'file', type: ''}]}), true);
  assert.equal(draggedLooksPdf({items: [{kind: 'file', type: 'image/png'}]}), false);
  assert.equal(draggedLooksPdf({items: [{kind: 'string', type: 'text/plain'}]}), false);
  assert.equal(draggedLooksPdf(undefined), false);
});

class FakeDropEl {
  constructor() {
    this.listeners = new Map();
    this.children = [];
  }
  addEventListener(type, fn) { (this.listeners.get(type) || this.listeners.set(type, []).get(type)).push(fn); }
  removeEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    const index = list.indexOf(fn);
    if (index >= 0) list.splice(index, 1);
  }
  contains(node) { return this.children.includes(node); }
  fire(type, event) { for (const fn of this.listeners.get(type) || []) fn(event); return event; }
}

const dragEvent = (over = {}) => ({
  dataTransfer: {types: ['Files'], items: [{kind: 'file', type: 'application/pdf'}], files: [], dropEffect: ''},
  defaultPrevented: false,
  stopped: false,
  preventDefault() { this.defaultPrevented = true; },
  stopPropagation() { this.stopped = true; },
  ...over,
});

test('bindPdfDrop: arrasto de PDF acende, sai apaga e drop entrega o primeiro arquivo', () => {
  const el = new FakeDropEl();
  const active = [];
  const dropped = [];
  const binding = bindPdfDrop(el, {onActive: (on) => active.push(on), onDrop: (file) => dropped.push(file)});
  const over = el.fire('dragover', dragEvent());
  assert.equal(over.defaultPrevented, true);
  assert.equal(over.stopped, true);
  assert.equal(over.dataTransfer.dropEffect, 'copy');
  assert.deepEqual(active, [true]);
  const child = {};
  el.children.push(child);
  el.fire('dragleave', dragEvent({relatedTarget: child}));
  assert.deepEqual(active, [true], 'sair para um filho não apaga a área');
  el.fire('dragleave', dragEvent({relatedTarget: {}}));
  assert.deepEqual(active, [true, false]);
  const file = {name: 'lista.pdf', type: 'application/pdf'};
  const drop = el.fire('drop', dragEvent({dataTransfer: {types: ['Files'], items: [], files: [file, {name: 'outro.pdf'}]}}));
  assert.equal(drop.defaultPrevented, true);
  assert.deepEqual(dropped, [file]);
  assert.deepEqual(active, [true, false, false]);
  binding.destroy();
  assert.equal(el.listeners.get('dragover').length, 0);
});

test('bindPdfDrop: imagem não acende e drop sem arquivo não chama o host', () => {
  const el = new FakeDropEl();
  const active = [];
  const dropped = [];
  bindPdfDrop(el, {onActive: (on) => active.push(on), onDrop: (file) => dropped.push(file)});
  el.fire('dragover', dragEvent({dataTransfer: {types: ['Files'], items: [{kind: 'file', type: 'image/png'}]}}));
  assert.deepEqual(active, [false]);
  el.fire('drop', dragEvent({dataTransfer: {types: ['Files'], items: [], files: []}}));
  assert.deepEqual(dropped, []);
});
