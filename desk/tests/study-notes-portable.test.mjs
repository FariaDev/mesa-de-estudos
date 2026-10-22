import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, write, read, cleanup} from './study-backup-fixtures.mjs';
import {ptMatches} from './pt-text.mjs';

/* Anotações de página (pdf-notes) no pacote portátil: exportar NUNCA leva o
   caminho absoluto do autor; importar e adotar reancoram em `rel`/`name` sob a
   matéria nova. Pacotes v1 (fatia crua) continuam entrando, sem copiar caminho
   de outra máquina. Fixtures sintéticas, nenhum PDF real do usuário. */

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');
const zipkit = require('../src/study-data/zipkit.cjs');
const annotations = require('../src/study-data/annotations.cjs');
const {adoptPackage} = require('../src/study-data/adopt-package.cjs');

function buildPackage(fixture, overrides = {}) {
  return packages.buildPackage({
    runtime: fixture.runtime,
    course: {id: 'mat-1', name: 'Algebra Linear'},
    materialsDir: fixture.materialsDir,
    learningDir: path.join(fixture.runtime, 'learning', 'Courses', 'Algebra Linear'),
    include: {review: true, bookmarks: true, resume: true, conversations: false},
    ...overrides,
  });
}

function notesPayload(built) {
  const entries = zipkit.readZip(built.buffer);
  const entry = entries.find((item) => item.name === 'payload/store/pdf-notes.json');
  assert.ok(entry, 'payload de anotações presente');
  return {entries, entry, parsed: JSON.parse(entry.data.toString('utf8'))};
}

function repack(built, mutate) {
  const entries = zipkit.readZip(built.buffer).map((entry) => ({name: entry.name, data: entry.data}));
  mutate(entries);
  return zipkit.writeZip(entries, {deflate: true});
}

function replaceNotes(built, rawNotes) {
  return repack(built, (entries) => {
    const data = Buffer.from(`${JSON.stringify(rawNotes, null, 2)}\n`);
    const payload = entries.find((entry) => entry.name === 'payload/store/pdf-notes.json');
    payload.data = data;
    const manifest = JSON.parse(entries.find((entry) => entry.name === packages.MANIFEST_NAME).data.toString('utf8'));
    const target = manifest.files.find((item) => item.archivePath === 'payload/store/pdf-notes.json');
    target.bytes = data.length;
    target.sha256 = crypto.createHash('sha256').update(data).digest('hex');
    delete target.portable;
    entries.find((entry) => entry.name === packages.MANIFEST_NAME).data = Buffer.from(JSON.stringify(manifest));
  });
}

test('anotações: exportar vira forma portátil, sem caminho absoluto do autor', () => {
  const fixture = seedRuntime();
  try {
    const built = buildPackage(fixture);
    const {entry, parsed} = notesPayload(built);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.scope, 'mat-1');
    assert.equal(parsed.items.length, 1);
    const item = parsed.items[0];
    assert.equal(item.name, 'aula.pdf');
    assert.equal(item.rel, 'aula.pdf');
    assert.equal(item.page, 3);
    assert.equal(item.quote, 'trecho');
    assert.ok(!('path' in item), 'item portátil não tem caminho');
    assert.ok(!entry.data.toString('utf8').includes(fixture.materialsDir), 'payload sem pasta do autor');
    /* O manifesto marca a forma portátil para a importação/adopção. */
    const manifest = built.manifest;
    const declared = manifest.files.find((item) => item.archivePath === 'payload/store/pdf-notes.json');
    assert.equal(declared.store, 'annotations');
    assert.equal(declared.portable, 1);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('anotações: importar reancora no material do destino e o leitor real aceita', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import');
  try {
    const built = buildPackage(fixture);
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    const preview = packages.previewImport({buffer: built.buffer, destination});
    assert.deepEqual(preview.annotations, {items: 1, portable: true});
    const result = packages.importPackage({buffer: built.buffer, destination, courseId: preview.courseId});
    const saved = JSON.parse(read(result.storeDir, 'pdf-notes.json'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].ref.path, path.join(result.materialsDir, 'aula.pdf'));
    assert.equal(saved[0].ref.rel, 'aula.pdf');
    assert.ok(saved[0].id, 'item importado tem id (o leitor real exige)');
    assert.ok(!JSON.stringify(saved).includes(fixture.materialsDir), 'sem caminho do autor');
    assert.equal(result.record.annotations.items, 1);
    assert.equal(result.record.annotations.unresolved, 0);

    /* O runtime de origem NÃO ganhou nada: a matéria importada é um destino
       novo; quem instala no runtime é a adoção (teste seguinte). */
    const origin = annotations.readNotes(fixture.runtime, {courseId: preview.courseId});
    assert.equal(origin.length, 0);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

test('anotações: pacote v1 com caminho cru é reancorado por rel/name', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import');
  try {
    const built = buildPackage(fixture);
    const legacy = [{
      id: 'n-old',
      kind: 'nota',
      quote: 'trecho antigo',
      note: 'observação antiga',
      ref: {name: 'aula.pdf', rel: 'aula.pdf', path: '/Users/autora/Documentos/aula.pdf', page: 2},
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    }];
    const buffer = replaceNotes(built, legacy);
    const destination = packages.planDestination({root, name: 'Legado'});
    const preview = packages.previewImport({buffer, destination});
    assert.equal(preview.annotations.portable, false);
    assert.equal(preview.annotations.items, 1);
    const result = packages.importPackage({buffer, destination, courseId: preview.courseId});
    const saved = JSON.parse(read(result.storeDir, 'pdf-notes.json'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].ref.path, path.join(result.materialsDir, 'aula.pdf'), 'rel reancorou no destino');
    assert.ok(!JSON.stringify(saved).includes('/Users/autora'), 'caminho do autor não foi copiado');
    assert.equal(saved[0].ref.rel, 'aula.pdf');
    assert.equal(result.record.annotations.unresolved, 0);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

test('anotações: v1 sem material resolvido mantém o texto e não inventa caminho', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import');
  try {
    const built = buildPackage(fixture);
    const legacy = [
      {id: 'n-ok', kind: 'nota', quote: 'com material', ref: {name: 'aula.pdf', rel: 'aula.pdf', path: '/Users/autora/aula.pdf', page: 1}},
      {id: 'n-orfa', kind: 'duvida', note: 'não vi a fatoração', ref: {name: 'sumiu.pdf', rel: 'sumiu.pdf', path: '/Users/autora/sumiu.pdf', page: 9}},
    ];
    const buffer = replaceNotes(built, legacy);
    const destination = packages.planDestination({root, name: 'Órfãs'});
    const result = packages.importPackage({buffer, destination, courseId: 'materia-orfa'});
    const saved = JSON.parse(read(result.storeDir, 'pdf-notes.json'));
    assert.equal(saved.length, 2);
    const orphan = saved.find((item) => item.id === 'n-orfa');
    assert.equal(orphan.ref.path, '', 'sem material, sem caminho inventado');
    assert.equal(orphan.note, 'não vi a fatoração');
    assert.equal(orphan.ref.rel, 'sumiu.pdf');
    assert.equal(result.record.annotations.unresolved, 1);
    assert.equal(result.record.annotations.items, 2);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

test('anotações: adoção mescla no runtime com caminho da matéria importada', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import');
  const runtime2 = tempDir('mesa-rt2');
  try {
    const built = buildPackage(fixture);
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    const result = packages.importPackage({buffer: built.buffer, destination, courseId: 'materia-adotada'});
    let configured = 0;
    adoptPackage({runtime: runtime2, result, writeConfiguration: () => { configured++; }});
    assert.equal(configured, 1);
    const stored = JSON.parse(read(runtime2, 'pdf-notes.json'));
    assert.equal(Array.isArray(stored['materia-adotada']), true);
    /* O consumidor real do runtime vê a anotação pronta para abrir. */
    const notes = annotations.readNotes(runtime2, {courseId: 'materia-adotada'});
    assert.equal(notes.length, 1);
    assert.equal(notes[0].ref.path, path.join(result.materialsDir, 'aula.pdf'));
    assert.equal(notes[0].ref.page, 3);
    assert.ok(!JSON.stringify(stored).includes(fixture.materialsDir));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root, runtime2);
  }
});

test('adoção: store local que é link simbólico é recusado e nada é tocado', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import');
  const runtime2 = tempDir('mesa-rt2');
  const outside = path.join(tempDir('mesa-fora'), 'alvo.json');
  try {
    const built = buildPackage(fixture);
    const destination = packages.planDestination({root, name: 'Link'});
    const result = packages.importPackage({buffer: built.buffer, destination, courseId: 'materia-link'});
    write(outside, '', JSON.stringify({alvo: true}));
    fs.symlinkSync(outside, path.join(runtime2, 'pdf-notes.json'));
    assert.throws(
      () => adoptPackage({runtime: runtime2, result, writeConfiguration: () => {}}),
      ptMatches(/Dados locais pdf-notes.json são um link simbólico/),
    );
    assert.equal(fs.lstatSync(path.join(runtime2, 'pdf-notes.json')).isSymbolicLink(), true, 'link intacto');
    assert.equal(JSON.parse(read(path.dirname(outside), 'alvo.json')).alvo, true, 'alvo fora do runtime intacto');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root, runtime2, path.dirname(outside));
  }
});
