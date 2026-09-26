/* Favoritos nomeados do leitor (Mesa).
 *
 * O caminho real: o "Guardar esta página…" do popover Navegar manda o item por
 * IPC, `bookmarks.cjs` grava `runtime/bookmarks.json` (por matéria) e a lista
 * volta inteira para o renderer remontar o popover. Aqui o teste fala direto
 * com o módulo (sem Electron e sem Pi), em runtime temporário.
 *
 * O que NÃO é testado aqui: o popover, o diálogo e o clique que pula a página
 * (isso é do `hunt-nav.mjs`) e a IPC (`core.test.mjs`). A FORMA e a ORDEM das
 * linhas são do núcleo e estão nas leis (`core/laws/pdfnav.bend`).
 *
 * Remover é por IDENTIDADE (o registro que veio da tela), não por posição: a
 * lista que a tela mostra é filtrada pela biblioteca da matéria, então um índice
 * do renderer não corresponde ao arquivo gravado. O mesmo vale para o caderno
 * (`review.test.mjs`) e para a lei do núcleo (`pdfnav_remove_ignores_position`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const bookmarks = require('../bookmarks.cjs');

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-bookmarks-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const fileOf = (runtime) => join(runtime, bookmarks.FILENAME);
const stored = (runtime) => JSON.parse(readFileSync(fileOf(runtime), 'utf8'));

test('sem arquivo não há favoritos e nada é criado na leitura', () => {
  withRuntime((runtime) => {
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A'), []);
    assert.equal(existsSync(fileOf(runtime)), false);
  });
});

test('guardar apara o nome, corta o path e levanta a página para 1', () => {
  withRuntime((runtime) => {
    const saved = bookmarks.addBookmark(runtime, 'A', {name: '  Revisão  ', path: ' /p/Limites.pdf ', page: 0});
    assert.deepEqual(saved, [{name: 'Revisão', path: '/p/Limites.pdf', page: 1}]);
    assert.deepEqual(stored(runtime).A, saved);
  });
});

test('sem nome ou sem documento o favorito é recusado (nada é gravado)', () => {
  withRuntime((runtime) => {
    assert.throws(() => bookmarks.addBookmark(runtime, 'A', {name: '   ', path: '/p/Limites.pdf', page: 3}), /Dê um nome/);
    assert.throws(() => bookmarks.addBookmark(runtime, 'A', {name: 'Revisão', path: '', page: 3}), /Dê um nome/);
    assert.equal(existsSync(fileOf(runtime)), false);
  });
});

test('guardar de novo o mesmo documento e nome renomeia, não duplica', () => {
  withRuntime((runtime) => {
    bookmarks.addBookmark(runtime, 'A', {name: 'Revisão', path: '/p/Limites.pdf', page: 3});
    bookmarks.addBookmark(runtime, 'A', {name: 'Revisão', path: '/p/Limites.pdf', page: 9});
    const list = bookmarks.readBookmarks(runtime, 'A');
    assert.equal(list.length, 1);
    assert.equal(list[0].page, 9);
  });
});

test('o favorito novo entra na frente e a matéria é a chave', () => {
  withRuntime((runtime) => {
    bookmarks.addBookmark(runtime, 'A', {name: 'Primeiro', path: '/p/Limites.pdf', page: 1});
    bookmarks.addBookmark(runtime, 'A', {name: 'Segundo', path: '/p/Outro.pdf', page: 2});
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A').map((b) => b.name), ['Segundo', 'Primeiro']);
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'B'), []);
    assert.deepEqual(Object.keys(stored(runtime)), ['A']);
  });
});

test('remover vai pela identidade (nome + documento): a posição não identifica o favorito', () => {
  withRuntime((runtime) => {
    bookmarks.addBookmark(runtime, 'A', {name: 'Um', path: '/p/Limites.pdf', page: 1});
    bookmarks.addBookmark(runtime, 'A', {name: 'Dois', path: '/p/Outro.pdf', page: 2});
    /* 'Dois' é a POSIÇÃO 0 da lista guardada; quem sai é o registro entregue. */
    assert.deepEqual(bookmarks.removeBookmark(runtime, 'A', {name: 'Dois', path: '/p/Outro.pdf'}).map((b) => b.name), ['Um']);
    /* Mesmo documento com outro nome é outro favorito: não sai junto. */
    const kept = bookmarks.removeBookmark(runtime, 'A', {name: 'Outro nome', path: '/p/Limites.pdf'});
    assert.deepEqual(kept.map((b) => b.name), ['Um']);
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A').map((b) => b.name), ['Um']);
    /* Favorito que não está mais lá (nome velho) e payload torto não mexem em nada. */
    const before = readFileSync(fileOf(runtime), 'utf8');
    assert.deepEqual(bookmarks.removeBookmark(runtime, 'A', {name: 'Fantasma', path: '/p/Limites.pdf'}), kept);
    assert.deepEqual(bookmarks.removeBookmark(runtime, 'A', null), kept);
    assert.equal(readFileSync(fileOf(runtime), 'utf8'), before, 'remove que não achou nada não regrava o arquivo');
  });
});

test('remover o último apaga a chave da matéria (e a lista vazia não volta)', () => {
  withRuntime((runtime) => {
    bookmarks.addBookmark(runtime, 'A', {name: 'Um', path: '/p/Limites.pdf', page: 1});
    assert.deepEqual(bookmarks.removeBookmark(runtime, 'A', {name: 'Um', path: '/p/Limites.pdf', page: 9}), []);
    assert.deepEqual(stored(runtime), {});
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A'), []);
  });
});

test('sem matéria ativa não há onde guardar', () => {
  withRuntime((runtime) => {
    assert.throws(() => bookmarks.saveBookmarks(runtime, '', []), /Sem matéria ativa/);
  });
});

test('leitura tolerante: JSON torto, lixo e chave de proto viram "sem favoritos"', () => {
  withRuntime((runtime) => {
    writeFileSync(fileOf(runtime), '{isso não é json');
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A'), []);
    writeFileSync(fileOf(runtime), JSON.stringify({A: ['lixo', 7, {name: ''}], __proto__: {x: 1}, B: [{name: 'Ok', path: '/p/x.pdf', page: 4}]}));
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A'), []);
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'B'), [{name: 'Ok', path: '/p/x.pdf', page: 4}]);
  });
});

test('arquivo maior que o teto é ignorado (e o save regrava por cima)', () => {
  withRuntime((runtime) => {
    writeFileSync(fileOf(runtime), JSON.stringify({A: [{name: 'x'.repeat(600 * 1024), path: '/p/x.pdf', page: 1}]}));
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A'), []);
    const saved = bookmarks.addBookmark(runtime, 'A', {name: 'Novo', path: '/p/x.pdf', page: 2});
    assert.deepEqual(saved.map((b) => b.name), ['Novo']);
    assert.deepEqual(bookmarks.readBookmarks(runtime, 'A').map((b) => b.name), ['Novo']);
  });
});

test('o teto do núcleo vale na gravação (a lista não cresce sem fim)', () => {
  withRuntime((runtime) => {
    const many = Array.from({length: 260}, (_, i) => ({name: `F${i}`, path: `/p/${i}.pdf`, page: 1}));
    const saved = bookmarks.saveBookmarks(runtime, 'A', many);
    assert.equal(saved.length, 200);
    assert.equal(saved[0].name, 'F0');
  });
});
