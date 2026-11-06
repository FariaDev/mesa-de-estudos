/* Concessões de PDF do leitor: avulso (aberto/solto/restaurado fora da
   biblioteca) vale só por inteiro; só a biblioteca libera a pasta irmã. Sem a
   correção, o avulso entrava no mesmo conjunto da biblioteca e o modelo lia o
   vizinho (`~/Downloads/Extrato.pdf` via `~/Downloads/Lista.pdf`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tinyPdf} from './helpers.mjs';

const require = createRequire(import.meta.url);
const {createPdfGrants} = require('../pdf-grants.cjs');
const {resolveTutorPdf} = require('../pdf-read-path.cjs');

function withDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-grants-'));
  return Promise.resolve(fn(dir)).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
}

/** O que o main passa ao `resolveTutorPdf`: biblioteca na pasta, resto em `exact`. */
function tutorRead(grants, raw, chat = []) {
  const args = grants.resolveArgs(chat);
  return resolveTutorPdf(raw, args.library, {exact: args.exact});
}

test('abrir/soltar avulso libera ele e recusa o irmão', () => withDir((dir) => {
  const allowed = new Set();
  const grants = createPdfGrants({allowed});
  const lista = path.join(dir, 'Lista.pdf');
  const extrato = path.join(dir, 'Extrato.pdf');
  fs.writeFileSync(lista, tinyPdf('lista'));
  fs.writeFileSync(extrato, tinyPdf('extrato'));
  grants.addSingle(lista);
  assert.ok(allowed.has(lista), 'o leitor continua mostrando o avulso');
  assert.equal(fs.realpathSync.native(tutorRead(grants, lista)), fs.realpathSync.native(lista));
  assert.throws(() => tutorRead(grants, extrato), /PDF recusado/);
}));

test('biblioteca segue liberando o irmão', () => withDir((dir) => {
  const allowed = new Set();
  const grants = createPdfGrants({allowed});
  const aula = path.join(dir, 'Aula 5.pdf');
  const irma = path.join(dir, 'Aula 6.pdf');
  fs.writeFileSync(aula, tinyPdf('aula'));
  fs.writeFileSync(irma, tinyPdf('irma'));
  grants.addLibrary([aula]);
  assert.equal(fs.realpathSync.native(tutorRead(grants, aula)), fs.realpathSync.native(aula));
  assert.equal(fs.realpathSync.native(tutorRead(grants, irma)), fs.realpathSync.native(irma));
}));

test('symlink para fora da pasta não escapa, maiúscula e NFD casam', () => withDir((dir) => {
  const allowed = new Set();
  const grants = createPdfGrants({allowed});
  const aula = path.join(dir, 'Aula 5.pdf');
  fs.writeFileSync(aula, tinyPdf('aula'));
  grants.addLibrary([aula]);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-grants-out-'));
  try {
    const secret = path.join(outside, 'segredo.pdf');
    fs.writeFileSync(secret, tinyPdf('segredo'));
    const link = path.join(dir, 'atalho.pdf');
    fs.symlinkSync(secret, link);
    assert.throws(() => tutorRead(grants, link), /PDF recusado/);
  } finally {
    fs.rmSync(outside, {recursive: true, force: true});
  }
  const nfd = 'Lógica Formal.pdf'.normalize('NFD');
  const stored = path.join(dir, nfd);
  fs.writeFileSync(stored, tinyPdf('logica'));
  grants.addSingle(stored);
  assert.equal(fs.realpathSync.native(tutorRead(grants, path.join(dir, 'Lógica Formal.pdf'.normalize('NFC')))), fs.realpathSync.native(stored));
}));

test('no Windows a comparação ignora caixa (a pasta irmã não vaza por maiúscula)', () => {
  const allowed = new Set();
  const grants = createPdfGrants({allowed, platform: 'win32'});
  grants.addLibrary(['C:\\Curso\\Aula 5.pdf']);
  grants.addSingle('c:\\curso\\aula 5.pdf');
  assert.deepEqual(grants.singleList(), [], 'o que já é biblioteca não vira exact');
  grants.reset(['C:\\Curso\\Aula 5.pdf'], ['c:\\CURSO\\AULA 5.PDF']);
  assert.deepEqual(grants.singleList(), [], 'restaurado da biblioteca não vira pasta nem exact');
});

test('depois de reabrir o app, avulso restaurado continua exact', () => withDir((dir) => {
  /* Biblioteca numa pasta, avulso noutra (como `~/Downloads/Lista.pdf`): o
     irmão do avulso não pode valer, mesmo restaurado. */
  const lib = path.join(dir, 'materia');
  const dl = path.join(dir, 'downloads');
  fs.mkdirSync(lib);
  fs.mkdirSync(dl);
  const aula = path.join(lib, 'Aula 5.pdf');
  const irma = path.join(lib, 'Aula 6.pdf');
  const lista = path.join(dl, 'Lista.pdf');
  const extrato = path.join(dl, 'Extrato.pdf');
  for (const [file, text] of [[aula, 'a'], [irma, 'b'], [lista, 'c'], [extrato, 'd']]) fs.writeFileSync(file, tinyPdf(text));
  const allowed = new Set();
  const grants = createPdfGrants({allowed});
  grants.reset([aula], [aula, lista]);
  assert.deepEqual(grants.libraryList(), [aula]);
  assert.deepEqual(grants.singleList(), [lista]);
  assert.equal(fs.realpathSync.native(tutorRead(grants, irma)), fs.realpathSync.native(irma), 'irmão da biblioteca segue valendo');
  assert.throws(() => tutorRead(grants, extrato), /PDF recusado/, 'irmão do avulso restaurado continua recusado');
}));

test('avulso que já é da biblioteca não vira single', () => withDir((dir) => {
  const allowed = new Set();
  const grants = createPdfGrants({allowed});
  const aula = path.join(dir, 'Aula 5.pdf');
  fs.writeFileSync(aula, tinyPdf('aula'));
  grants.addLibrary([aula]);
  grants.addSingle(aula);
  assert.deepEqual(grants.singleList(), []);
  grants.reset([aula], [aula]);
  assert.deepEqual(grants.singleList(), [], 'restaurado que é da biblioteca não vira exact');
}));
