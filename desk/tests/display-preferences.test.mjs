import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {READING_SIZES, READING_WIDTHS, PDF_DARK_STYLES, normalizeDisplayChoices, applyDisplayState} from '../src/display-preferences.mjs';

/* Preferências de leitura (#106/#107): nomes fechados, padrão de hoje e
   gravação no estado de interface. O adaptador do main e o aplicador do
   renderer precisam aceitar exatamente os mesmos nomes; se um ganhar um degrau
   novo sozinho, o teste acusa. */
const require = createRequire(import.meta.url);
const {deskLayout, saveState, READING_SIZES: MAIN_SIZES, READING_WIDTHS: MAIN_WIDTHS, PDF_DARK_STYLES: MAIN_PDF_DARK} = require('../state-adapter.cjs');
const base = {draft: '', theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: .5};

test('as listas do renderer e do adaptador do main são a mesma fonte de nomes', () => {
  assert.deepEqual([...MAIN_SIZES], [...READING_SIZES]);
  assert.deepEqual([...MAIN_WIDTHS], [...READING_WIDTHS]);
  assert.deepEqual([...MAIN_PDF_DARK], [...PDF_DARK_STYLES]);
});

test('quem nunca escolheu fica no padrão de hoje: Normal, Normal e Inverter', () => {
  assert.deepEqual(deskLayout({}), {...base, accent: 'blue', readingSize: 'normal', readingWidth: 'normal', pdfDark: 'invert'});
  assert.deepEqual(normalizeDisplayChoices(), {readingSize: 'normal', readingWidth: 'normal', pdfDark: 'invert'});
});

test('cada degrau volta como foi gravado', () => {
  for (const readingSize of READING_SIZES) assert.equal(deskLayout({readingSize}).readingSize, readingSize);
  for (const readingWidth of READING_WIDTHS) assert.equal(deskLayout({readingWidth}).readingWidth, readingWidth);
  for (const pdfDark of PDF_DARK_STYLES) assert.equal(deskLayout({pdfDark}).pdfDark, pdfDark);
});

test('valor desconhecido ou de tipo errado cai no padrão na carga', () => {
  for (const value of ['huge', '', 'NORMAL', 'normal ', 0, true, null, {}, ['wide']]) {
    assert.equal(deskLayout({readingSize: value}).readingSize, 'normal', `tamanho ${JSON.stringify(value)}`);
    assert.equal(deskLayout({readingWidth: value}).readingWidth, 'normal', `largura ${JSON.stringify(value)}`);
    assert.equal(deskLayout({pdfDark: value}).pdfDark, 'invert', `tom ${JSON.stringify(value)}`);
  }
});

test('salvar grava a escolha nova e mantém a corrente quando o campo falta', () => {
  const current = {...base, readingSize: 'large', readingWidth: 'narrow', pdfDark: 'soft'};
  assert.deepEqual(saveState(current, {...base, readingSize: 'small', readingWidth: 'wide', pdfDark: 'invert'}),
    {...base, accent: 'blue', readingSize: 'small', readingWidth: 'wide', pdfDark: 'invert'});
  assert.deepEqual(saveState(current, {...base}), {...base, accent: 'blue', readingSize: 'large', readingWidth: 'narrow', pdfDark: 'soft'});
  for (const value of ['huge', '', 7, true, {}]) {
    const saved = saveState(current, {...base, readingSize: value, readingWidth: value, pdfDark: value});
    assert.equal(saved.readingSize, 'large');
    assert.equal(saved.readingWidth, 'narrow');
    assert.equal(saved.pdfDark, 'soft');
  }
});

test('o aplicador usa atributos só fora do padrão — quem não mexeu fica sem eles', () => {
  const doc = {documentElement: {dataset: {}}, querySelector: () => null};
  const S = {};
  applyDisplayState(S, {}, doc);
  assert.deepEqual(doc.documentElement.dataset, {}, 'sem atributos no padrão');
  applyDisplayState(S, {readingSize: 'larger', readingWidth: 'narrow', pdfDark: 'soft'}, doc);
  assert.deepEqual(doc.documentElement.dataset, {readingSize: 'larger', readingWidth: 'narrow', pdfDark: 'soft'});
  assert.equal(S.readingSize, 'larger');
  applyDisplayState(S, {readingSize: 'normal', readingWidth: 'normal', pdfDark: 'invert'}, doc);
  assert.deepEqual(doc.documentElement.dataset, {}, 'voltar ao padrão tira os atributos');
});
