import {ptMatches} from './pt-text.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {resolveDrop, suggestedDataFolder, prepareDataFolder} = require('../first-run.cjs');

/* Tudo numa pasta temporária: nada toca a pasta pessoal nem material de curso. */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-first-run-'));
test.after(() => fs.rmSync(root, {recursive: true, force: true}));
const make = (...parts) => {
  const file = path.join(root, ...parts);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, '%PDF-1.4\n');
  return file;
};

test('uma pasta solta vira a pasta da matéria e conta os PDFs dela', () => {
  make('calculo', 'a.pdf');
  make('calculo', 'b.PDF');
  make('calculo', 'notas.txt');
  const out = resolveDrop([path.join(root, 'calculo')]);
  assert.equal(out.folder, path.join(root, 'calculo'));
  assert.equal(out.kind, 'folder');
  assert.equal(out.pdfCount, 2);
  assert.deepEqual(out.pdfNames, ['a.pdf', 'b.PDF']);
  assert.equal(out.elsewhere, 0);
});

/* #64: a tela de PDFs mostra os primeiros nomes, em ordem natural, e quantos sobram. */
test('a pasta solta traz os quatro primeiros nomes de PDF em ordem natural', () => {
  for (const name of ['Lista 10.pdf', 'Lista 2.pdf', 'Lista 1.pdf', 'Formulário.pdf', 'Limites.pdf', 'notas.txt']) make('nomes', name);
  const out = resolveDrop([path.join(root, 'nomes')]);
  assert.equal(out.pdfCount, 5);
  assert.deepEqual(out.pdfNames, ['Formulário.pdf', 'Limites.pdf', 'Lista 1.pdf', 'Lista 2.pdf']);
});

/* #70: a pasta com os PDFs em subpastas dava zero no setup, mas a biblioteca
   da matéria (courseLibrary) lista as subpastas. Os dois contam igual. */
test('#70: a pasta conta os PDFs das subpastas, como a biblioteca da matéria', () => {
  make('apostilas', 'Unidade 1', 'Limites.pdf');
  make('apostilas', 'Unidade 2', 'Provas', 'P1.pdf');
  make('apostilas', 'Ementa.pdf');
  const folder = path.join(root, 'apostilas');
  const out = resolveDrop([folder]);
  assert.equal(out.pdfCount, 3);
  assert.deepEqual(out.pdfNames, ['Ementa.pdf', 'Limites.pdf', 'P1.pdf']);
  const {courseLibrary} = require('../courses.cjs');
  assert.equal(out.pdfCount, courseLibrary(folder).length, 'o mesmo número que a biblioteca vai mostrar');
});

test('PDFs soltos vêm da pasta do primeiro; os de outra pasta não entram e são contados', () => {
  const a = make('fisica', 'lista1.pdf');
  const b = make('fisica', 'lista2.pdf');
  const c = make('outra', 'prova.pdf');
  const out = resolveDrop([a, b, c]);
  assert.equal(out.folder, path.join(root, 'fisica'));
  assert.equal(out.kind, 'pdfs');
  assert.equal(out.pdfCount, 2);
  assert.deepEqual(out.pdfNames, ['lista1.pdf', 'lista2.pdf'], 'só os da pasta da matéria');
  assert.equal(out.elsewhere, 1);
});

test('uma pasta junto de PDFs: vale a pasta; PDF de fora dela é contado', () => {
  const inside = make('algebra', 'a.pdf');
  const outside = make('solto', 'x.pdf');
  const out = resolveDrop([outside, path.join(root, 'algebra'), inside]);
  assert.equal(out.folder, path.join(root, 'algebra'));
  assert.equal(out.elsewhere, 1);
});

test('arquivo que não é PDF, caminho que não existe e caminho relativo são ignorados', () => {
  const txt = path.join(root, 'ler.txt');
  fs.writeFileSync(txt, 'oi');
  assert.throws(() => resolveDrop([txt, path.join(root, 'nao-existe.pdf'), 'relativo.pdf']), ptMatches(/Solte PDFs ou uma pasta/));
  assert.throws(() => resolveDrop([]), ptMatches(/Solte PDFs ou uma pasta/));
  assert.throws(() => resolveDrop(null), ptMatches(/Solte PDFs ou uma pasta/));
});

test('o que foi solto nunca é alterado', () => {
  const file = make('intacta', 'a.pdf');
  const before = fs.readFileSync(file);
  const stat = fs.statSync(file).mtimeMs;
  resolveDrop([file, path.join(root, 'intacta')]);
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.statSync(file).mtimeMs, stat);
  assert.deepEqual(fs.readdirSync(path.join(root, 'intacta')), ['a.pdf']);
});

test('a pasta de dados sugerida é a da configuração ou Documentos/Mesa de Estudos', () => {
  const home = path.join(root, 'home');
  assert.equal(suggestedDataFolder({vaultPath: ''}, home), path.join(home, 'Documents', 'Mesa de Estudos'));
  assert.equal(suggestedDataFolder(null, home), path.join(home, 'Documents', 'Mesa de Estudos'));
  assert.equal(suggestedDataFolder({vaultPath: '/dados/minha'}, home), '/dados/minha');
});

test('preparar a pasta de dados cria só ela e recusa o que não é caminho absoluto', () => {
  const target = path.join(root, 'home', 'Documents', 'Mesa de Estudos');
  assert.equal(fs.existsSync(target), false, 'nada é criado antes de confirmar');
  assert.equal(prepareDataFolder(target), target);
  assert.equal(fs.statSync(target).isDirectory(), true);
  assert.deepEqual(fs.readdirSync(target), []);
  assert.throws(() => prepareDataFolder(''), ptMatches(/pasta de dados válida/));
  assert.throws(() => prepareDataFolder('relativa/pasta'), ptMatches(/pasta de dados válida/));
  const file = make('arquivo.pdf');
  assert.throws(() => prepareDataFolder(file), /Error|pasta/);
});
