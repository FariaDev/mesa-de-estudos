import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {courseDropFolder, courseLibrary} = require('../courses.cjs');

/* "Mostrar a pasta" da folha Lista 0 tem de abrir a pasta que a biblioteca
   realmente varre — senão o PDF jogado ali nunca aparece. */
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-drop-folder-'));

test('sem Sources nem source_roots: a própria pasta da matéria', () => {
  const course = tmp();
  assert.equal(courseDropFolder(course), course);
});

test('com Sources/: a pasta Sources, que é a varrida', () => {
  const course = tmp();
  fs.mkdirSync(path.join(course, 'Sources'));
  assert.equal(courseDropFolder(course), path.join(course, 'Sources'));
});

test('com source_roots no _state.md: a primeira pasta que existe', () => {
  const course = tmp();
  fs.mkdirSync(path.join(course, 'Livros'));
  fs.writeFileSync(path.join(course, '_state.md'), 'source_roots:\n  - Ausente\n  - Livros\n');
  assert.equal(courseDropFolder(course), path.join(course, 'Livros'));
});

test('pasta inexistente: vazio, e a biblioteca também', () => {
  assert.equal(courseDropFolder(path.join(os.tmpdir(), 'mesa-nao-existe-12')), '');
  assert.deepEqual(courseLibrary(path.join(os.tmpdir(), 'mesa-nao-existe-12')), []);
});
