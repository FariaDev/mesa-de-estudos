import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

/* Cor de acento (ticket #9): estado de interface, como o tema. Pelo adaptador
   real do app (o main.cjs usa este módulo): quem nunca escolheu vê azul, a
   escolha volta na abertura seguinte e valor inválido nunca vira acento. */
const require = createRequire(import.meta.url);
const {deskLayout, saveState} = require('../state-adapter.cjs');

const ACCENTS = ['blue', 'violet', 'green', 'orange', 'pink', 'graphite'];
const base = {draft: '', theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: .5};

test('quem nunca escolheu vê azul', () => {
  assert.equal(deskLayout({}).accent, 'blue');
  assert.equal(deskLayout(undefined).accent, 'blue');
  assert.equal(deskLayout({theme: 'dark'}).accent, 'blue');
});

test('cada um dos seis acentos volta como foi gravado', () => {
  for (const accent of ACCENTS) assert.equal(deskLayout({accent}).accent, accent);
});

test('valor inválido ou de tipo errado volta ao padrão azul na carga', () => {
  for (const accent of ['roxo', '', 'BLUE', 'blue ', 0, 1, true, null, {}, ['green']]) {
    assert.equal(deskLayout({accent}).accent, 'blue', `carga com ${JSON.stringify(accent)}`);
  }
});

test('salvar grava a escolha nova', () => {
  for (const accent of ACCENTS) assert.equal(saveState({...base, accent: 'blue'}, {...base, accent}).accent, accent);
});

test('salvar sem acento, ou com acento inválido, mantém o corrente (como o tema)', () => {
  const current = {...base, accent: 'pink'};
  assert.equal(saveState(current, {...base}).accent, 'pink');
  for (const accent of [null, 'roxo', '', 'PINK', 7, true, {}]) {
    assert.equal(saveState(current, {...base, accent}).accent, 'pink', `salvar com ${JSON.stringify(accent)}`);
  }
});

test('o acento não mexe nos outros campos do estado', () => {
  const layout = saveState({...base, accent: 'blue', theme: 'dark'}, {...base, theme: 'dark', accent: 'green', chatWidth: 500});
  assert.equal(layout.theme, 'dark');
  assert.equal(layout.chatWidth, 500);
  assert.equal(layout.accent, 'green');
});
