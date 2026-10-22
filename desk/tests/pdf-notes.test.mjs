/* Anotações de página (Mesa): o módulo de host `src/study-data/annotations.cjs`.
 *
 * O diálogo manda `{mode, id, item}` por IPC, o main injeta o escopo corrente
 * (`{courseId}` ou `{courseId, freeSessionId}`) e a lista autorizada de
 * materiais; o módulo grava `runtime/pdf-notes.json` com id estável, página
 * nunca abaixo de 1 e referência portátil. O PDF original nunca é tocado.
 */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ptText} from './pt-text.mjs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const notes = require(path.join(DESK, 'src', 'study-data', 'annotations.cjs'));

const runtimes = [];
after(() => {
  for (const dir of runtimes) {
    try {
      fs.rmSync(dir, {recursive: true, force: true});
    } catch { /* já foi */ }
  }
});

function withNotes(fn) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-notes-'));
  runtimes.push(runtime);
  const pdf = path.join(runtime, 'Limites.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n');
  return fn({runtime, pdf, scope: {courseId: 'Calculo'}});
}

const baseItem = (pdf, extra = {}) => ({
  kind: extra.kind || 'nota',
  quote: extra.quote ?? 'trecho',
  note: extra.note ?? 'observação',
  ref: {name: extra.name ?? 'Limites.pdf', rel: extra.rel ?? 'Limites.pdf', path: extra.path ?? pdf, page: extra.page ?? 0},
});

const stored = (runtime) => JSON.parse(fs.readFileSync(notes.fileOf(runtime), 'utf8'));

test('guardar apara textos, levanta a página para 1 e grava atômico', () => {
  withNotes(({runtime, pdf, scope}) => {
    const saved = notes.saveNote(runtime, scope, {
      mode: 'add',
      authorizedPaths: [pdf],
      item: baseItem(pdf, {quote: '  trecho selecionado  ', note: '  dúvida  ', page: 0}),
    });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].quote, 'trecho selecionado');
    assert.equal(saved[0].note, 'dúvida');
    assert.equal(saved[0].ref.page, 1);
    assert.equal(saved[0].id.startsWith('n-'), true);
    assert.equal(stored(runtime).Calculo.length, 1);
    assert.deepEqual(fs.readdirSync(runtime).filter((name) => name.endsWith('.tmp')), []);
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(notes.fileOf(runtime)).mode & 0o777, 0o600, 'store nasce privado');
    }
  });
});

test('sem trecho e sem observação não grava nada', () => {
  withNotes(({runtime, pdf, scope}) => {
    assert.throws(
      () => notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {quote: '   ', note: '  '})}),
      (error) => /Escreva um trecho/.test(ptText(error.message))
    );
    assert.equal(fs.existsSync(notes.fileOf(runtime)), false);
  });
});

test('guardar o mesmo de novo não duplica nem regrava o arquivo', () => {
  withNotes(({runtime, pdf, scope}) => {
    const first = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 3})});
    const before = fs.readFileSync(notes.fileOf(runtime), 'utf8');
    const again = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 3})});
    assert.equal(again.length, 1);
    assert.equal(fs.readFileSync(notes.fileOf(runtime), 'utf8'), before);
    assert.equal(again[0].id, first[0].id);
  });
});

test('editar mantém o id estável e a posição; remover vai pela id', () => {
  withNotes(({runtime, pdf, scope}) => {
    const list = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 1, note: 'antiga'})});
    const id = list[0].id;
    notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 2, note: 'segunda'})});
    const edited = notes.saveNote(runtime, scope, {mode: 'edit', id, authorizedPaths: [pdf], item: baseItem(pdf, {kind: 'duvida', page: 4, note: 'revisada'})});
    assert.equal(edited.length, 2);
    assert.equal(edited[1].id, id, 'editar não muda a posição nem o id');
    assert.equal(edited[1].note, 'revisada');
    assert.equal(edited[1].kind, 'duvida');
    assert.equal(edited[1].ref.page, 4);

    const before = fs.readFileSync(notes.fileOf(runtime), 'utf8');
    assert.equal(notes.saveNote(runtime, scope, {mode: 'edit', id: 'n-fantasma', authorizedPaths: [pdf], item: baseItem(pdf)}).length, 2);
    assert.equal(fs.readFileSync(notes.fileOf(runtime), 'utf8'), before, 'id desconhecido não regrava');
    assert.equal(notes.saveNote(runtime, scope, {mode: 'remove', id: 'n-fantasma'}).length, 2);

    const left = notes.saveNote(runtime, scope, {mode: 'remove', id});
    assert.equal(left.length, 1);
    assert.equal(left[0].note, 'segunda');
  });
});

test('filtro por página e matérias separadas (matéria × sessão Livre)', () => {
  withNotes(({runtime, pdf, scope}) => {
    notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 2, quote: 'página dois'})});
    notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 5, quote: 'página cinco'})});
    const freeScope = {courseId: 'Calculo', freeSessionId: 'sess-livre'};
    notes.saveNote(runtime, freeScope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 2, quote: 'sessão avulsa'})});

    assert.deepEqual(notes.readNotes(runtime, scope, {page: 2}).map((one) => one.quote), ['página dois']);
    assert.equal(notes.readNotes(runtime, scope).length, 2);
    assert.equal(notes.readNotes(runtime, freeScope).length, 1);
    assert.equal(notes.readNotes(runtime, {courseId: 'Outra'}).length, 0);
    assert.equal(notes.scopeOf(freeScope), 'free:sess-livre');
    assert.equal(notes.scopeOf({courseId: 'Calculo', freeSessionId: '../../escape'}), 'Calculo', 'id de sessão inválido cai no escopo da matéria');
  });
});

test('arquivo corrompido é preservado antes de gravar e a leitura não lança', () => {
  withNotes(({runtime, pdf, scope}) => {
    fs.writeFileSync(notes.fileOf(runtime), '{isso não é json');
    assert.deepEqual(notes.readNotes(runtime, scope), []);
    const saved = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    assert.equal(saved.length, 1);
    const backups = fs.readdirSync(runtime).filter((name) => name.startsWith('pdf-notes.corrupt-'));
    assert.equal(backups.length, 1, 'o arquivo ilegível foi preservado');
    assert.equal(fs.readFileSync(path.join(runtime, backups[0]), 'utf8'), '{isso não é json');
  });
});

test('teto de itens: o arquivo é cortado no maxItems do núcleo', () => {
  withNotes(({runtime, scope}) => {
    const many = Array.from({length: 520}, (_, index) => ({
      id: `n-${String(index).padStart(4, '0')}`,
      kind: 'nota',
      quote: `trecho ${index}`,
      note: '',
      ref: {name: 'Limites.pdf', rel: 'Limites.pdf', path: '/p/Limites.pdf', page: 1},
      createdAt: 1700000000000 + index,
      updatedAt: 1700000000000 + index,
    }));
    fs.writeFileSync(notes.fileOf(runtime), JSON.stringify({Calculo: many}));
    assert.equal(notes.readNotes(runtime, scope).length, 500);
  });
});

test('caminho novo fora da biblioteca autorizada é recusado sem tocar no arquivo', () => {
  withNotes(({runtime, pdf, scope}) => {
    notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const before = fs.readFileSync(notes.fileOf(runtime), 'utf8');
    let error;
    try {
      notes.saveNote(runtime, scope, {
        mode: 'add',
        authorizedPaths: ['/outra/pasta/Outro.pdf'],
        item: baseItem(pdf, {page: 9}),
      });
    } catch (caught) {
      error = caught;
    }
    assert.equal(error?.code, 'UNAUTHORIZED');
    assert.equal(fs.readFileSync(notes.fileOf(runtime), 'utf8'), before);
    /* Remover não exige autorização: material fora da biblioteca não fica preso. */
    const id = notes.readNotes(runtime, scope)[0].id;
    assert.equal(notes.saveNote(runtime, scope, {mode: 'remove', id, authorizedPaths: []}).length, 0);
  });
});

test('editar anotação de material fora da biblioteca mantém o texto; trocar de caminho continua barrado', () => {
  withNotes(({runtime, pdf, scope}) => {
    notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {note: 'antiga'})});
    const id = notes.readNotes(runtime, scope)[0].id;
    const edited = notes.saveNote(runtime, scope, {mode: 'edit', id, authorizedPaths: [], item: baseItem(pdf, {page: 4, note: 'revisada'})});
    assert.equal(edited[0].note, 'revisada');
    assert.equal(edited[0].ref.page, 4, 'o caminho não mudou; a edição vale sem a lista autorizada');
    let blocked;
    try {
      notes.saveNote(runtime, scope, {mode: 'edit', id, authorizedPaths: [pdf], item: baseItem(pdf, {name: 'Outro.pdf', rel: 'Outro.pdf', path: '/fora/Outro.pdf', note: 'outro'})});
    } catch (error) {
      blocked = error;
    }
    assert.equal(blocked?.code, 'UNAUTHORIZED', 'caminho novo fora da lista continua barrado');
  });
});

test('texto com HTML fica guardado como texto (o diálogo escapa na hora de mostrar)', () => {
  withNotes(({runtime, pdf, scope}) => {
    const nasty = '<img src=x onerror="alert(1)"> & "aspas"';
    const saved = notes.saveNote(runtime, scope, {
      mode: 'add',
      authorizedPaths: [pdf],
      item: baseItem(pdf, {quote: nasty, note: `dúvida ${nasty}`}),
    });
    assert.equal(saved[0].quote, nasty);
    assert.equal(saved[0].note, `dúvida ${nasty}`);
    assert.equal(notes.readNotes(runtime, scope)[0].quote, nasty);
  });
});

test('referência portátil exporta sem caminho absoluto e reancora em outra raiz', () => {
  withNotes(({runtime, pdf, scope}) => {
    notes.saveNote(runtime, scope, {
      mode: 'add',
      authorizedPaths: [pdf],
      item: baseItem(pdf, {name: 'Limites.pdf', rel: 'Materiais/Limites.pdf', path: pdf, page: 3, quote: 'área'}),
    });
    const portable = notes.exportPortable(runtime, scope);
    assert.equal(portable.items[0].rel, 'Materiais/Limites.pdf');
    assert.equal(JSON.stringify(portable).includes(runtime), false, 'pacote não carrega caminho absoluto');

    const moved = path.join(runtime, 'outra-matéria');
    fs.mkdirSync(path.join(moved, 'Materiais'), {recursive: true});
    fs.copyFileSync(pdf, path.join(moved, 'Materiais', 'Limites.pdf'));
    const imported = notes.importPortable(runtime, {courseId: 'Nova'}, portable, [moved]);
    assert.equal(imported.length, 1);
    assert.equal(imported[0].ref.path, path.join(moved, 'Materiais', 'Limites.pdf'));
    assert.equal(imported[0].ref.rel, 'Materiais/Limites.pdf');
    assert.match(imported[0].id, /^n-/);
    assert.equal(notes.resolveAbs({rel: 'Materiais/Limites.pdf', name: 'Limites.pdf'}, [moved]), path.join(moved, 'Materiais', 'Limites.pdf'));
    assert.equal(notes.resolveAbs({rel: '../fora.pdf', name: 'Limites.pdf'}, [moved]), '');
  });
});

test('item sem forma no arquivo é ignorado na leitura', () => {
  withNotes(({runtime, scope}) => {
    fs.writeFileSync(notes.fileOf(runtime), JSON.stringify({
      Calculo: [
        {id: 'n-bom', kind: 'nota', quote: 'válido', note: '', ref: {name: 'x.pdf', rel: 'x.pdf', path: '/p/x.pdf', page: 2}},
        {id: '', quote: 'sem id', ref: {}},
        {id: 'n-vazio', quote: '   ', note: '  ', ref: {}},
        'lixo',
      ],
    }));
    const list = notes.readNotes(runtime, scope);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'n-bom');
    assert.equal(list[0].ref.page, 2);
  });
});

test('teto de escopos nunca descarta o escopo que está sendo salvo', () => {
  withNotes(({runtime, pdf}) => {
    const store = {};
    for (let index = 0; index <= 500; index++) store[`Escopo${index}`] = [];
    fs.writeFileSync(notes.fileOf(runtime), JSON.stringify(store));
    const saved = notes.saveNote(runtime, {courseId: 'Escopo0'}, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    assert.equal(saved.length, 1);
    const disk = stored(runtime);
    assert.equal(Object.keys(disk).length, 500, 'continua no teto');
    assert.equal(disk.Escopo0.length, 1, 'o escopo salvo não foi o descartado');
    assert.equal(disk.Escopo1, undefined, 'o vizinho mais antigo saiu');
  });
});

test('symlink no lugar do arquivo não é seguido para leitura e é preservado ao gravar', () => {
  withNotes(({runtime, pdf, scope}) => {
    const external = path.join(runtime, 'external-notes.json');
    fs.writeFileSync(external, JSON.stringify({Externo: [{id: 'n-externo', quote: 'não é do app', ref: {}}]}));
    fs.symlinkSync(external, notes.fileOf(runtime));
    assert.deepEqual(notes.readNotes(runtime, scope), [], 'a leitura não segue o symlink');
    const saved = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    assert.equal(saved.length, 1);
    assert.equal(JSON.stringify(stored(runtime)).includes('n-externo'), false, 'o arquivo de fora não virou store');
    assert.equal(fs.readFileSync(external, 'utf8').includes('n-externo'), true, 'o alvo do symlink ficou intacto');
    assert.ok(fs.readdirSync(runtime).some((name) => name.startsWith('pdf-notes.corrupt-')), 'o link foi preservado');
  });
});
