/* Navegação do leitor no artefato (`core/pdfnav.bend` → `src/generated/pdfnav.core.js`).
 *
 * O contrato do núcleo está nas leis (`core/laws/pdfnav.bend`, 88 leis) e o
 * aceitador é o `core/proof.mjs`. Aqui se testa a COSTURA com o host: os
 * registros chegam como `{ $:'Bookmark', name, path, page: BigInt }`, as listas
 * como `Con/Nil`, e o que volta é a árvore de nós que o `view-host.mjs` monta.
 * Se um dia o gerador mudar a forma de Nat/Bool, é aqui que quebra primeiro.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import navCore from '../src/generated/pdfnav.core.js';

const NIL = {$: 'Nil'};
const con = (xs, tail = NIL) => xs.reduceRight((rest, head) => ({$: 'Con', head, tail: rest}), tail);
const book = (name, path, page) => ({$: 'Bookmark', name, path, page: BigInt(page)});
const out = (title, page, depth) => ({$: 'OutlineEntry', title, page: BigInt(page), depth: BigInt(depth)});

const attrOf = (node, name) => {
  for (let attrs = node.attrs; attrs && attrs.$ === 'Con'; attrs = attrs.tail) {
    if (attrs.head.name === name) return attrs.head.value;
  }
  return null;
};
const kids = (node) => {
  const list = [];
  for (let k = node.kids; k && k.$ === 'Con'; k = k.tail) list.push(k.head);
  return list;
};
const textOf = (node) => (node && node.$ === 'ViewText' ? node.text : null);

test('newBookmark apara o nome, o path e levanta a página', () => {
  const bm = navCore.newBookmark('  Revisão  ', '  /p/Limites.pdf  ', 0n);
  assert.deepEqual(bm, {$: 'Bookmark', name: 'Revisão', path: '/p/Limites.pdf', page: 1n});
});

test('keepBookmark exige nome e documento', () => {
  assert.equal(navCore.keepBookmark(book('Revisão', '/p/Limites.pdf', 3)), true);
  assert.equal(navCore.keepBookmark(book('   ', '/p/Limites.pdf', 3)), false);
  assert.equal(navCore.keepBookmark(book('Revisão', '   ', 3)), false);
});

test('addBookmark põe o novo na frente e renomeia o mesmo documento+nome', () => {
  const before = con([book('Antigo', '/p/Limites.pdf', 1)]);
  const grew = navCore.addBookmark(before, book('Novo', '/p/Outro.pdf', 2));
  assert.deepEqual(grew.head.name, 'Novo');
  assert.deepEqual(grew.tail.head.name, 'Antigo');
  const renamed = navCore.addBookmark(before, book('Antigo', '/p/Limites.pdf', 9));
  assert.equal(renamed.tail.$, 'Nil');
  assert.equal(renamed.head.page, 9n);
});

test('removeBookmark tira pela identidade: a posição da linha não é identidade', () => {
  const list = con([book('Um', '/p/Limites.pdf', 1), book('Dois', '/p/Outro.pdf', 2)]);
  const withoutOne = navCore.removeBookmark(list, book('Um', '/p/Limites.pdf', 1));
  assert.equal(withoutOne.head.name, 'Dois');
  assert.equal(withoutOne.tail.$, 'Nil');
  /* Mesmo documento com outro nome é outro favorito: não sai junto. */
  const kept = navCore.removeBookmark(list, book('Outro nome', '/p/Limites.pdf', 1));
  assert.equal(kept.head.name, 'Um');
  assert.equal(kept.tail.head.name, 'Dois');
  assert.equal(navCore.removeBookmark(list, book('Fantasma', '/p/Limites.pdf', 1)).tail.$, 'Con');
});

test('bookmarkRows: data-id é a posição, o documento aberto ganha `current`', () => {
  const rows = navCore.bookmarkRows(con([book('Revisão', '/p/Limites.pdf', 12), book('Outro', '/p/Outro.pdf', 3)]), '/p/Limites.pdf');
  const [rowHere, rowThere] = [rows.head, rows.tail.head];
  const [openHere, openThere] = [kids(rowHere)[0], kids(rowThere)[0]];
  assert.equal(attrOf(openHere, 'class'), 'nav-bookmark current');
  assert.equal(attrOf(openThere, 'class'), 'nav-bookmark');
  assert.equal(attrOf(openThere, 'data-id'), '1');
  assert.equal(attrOf(openThere, 'data-page'), '3');
  assert.equal(attrOf(openThere, 'data-path'), '/p/Outro.pdf');
  assert.equal(attrOf(openHere, 'on:click'), 'OpenBookmark');
  // botão > span.nav-name > texto
  assert.equal(textOf(kids(kids(openHere)[0])[0]), 'Revisão');
  assert.equal(textOf(kids(kids(openHere)[1])[0]), 'p. 12');
  assert.equal(attrOf(kids(rowHere)[1], 'on:click'), 'RemoveBookmark');
});

test('sem lista de páginas a lista de linhas fica vazia', () => {
  assert.equal(navCore.bookmarkRows(NIL, '/p/Limites.pdf').$, 'Nil');
  assert.equal(navCore.emptyBooks(NIL), true);
  assert.equal(navCore.emptyBooks(con([book('Um', '/p', 1)])), false);
});

test('outlineRow limita a profundidade e leva a página', () => {
  const row = navCore.outlineRow(out('Limites', 5, 9));
  assert.equal(attrOf(row, 'class'), 'nav-outline');
  assert.equal(attrOf(row, 'data-depth'), '3');
  assert.equal(attrOf(row, 'data-page'), '5');
  assert.equal(attrOf(row, 'on:click'), 'OpenOutline');
  assert.equal(navCore.outlineDepth(2n), '2');
});

test('navPopover: fechado tem `hidden`, aberto não — e o salvar é do núcleo', () => {
  const closed = navCore.navPopover(false, NIL, NIL, '/p/Limites.pdf');
  const open = navCore.navPopover(true, NIL, NIL, '/p/Limites.pdf');
  assert.equal(attrOf(closed, 'class'), 'pdf-nav-pop');
  assert.equal(attrOf(closed, 'hidden'), '');
  assert.equal(attrOf(open, 'hidden'), null);
  const save = kids(open)[0];
  assert.equal(textOf(kids(save)[0]), 'Guardar esta página…');
  assert.equal(attrOf(save, 'on:click'), 'SaveBookmark');
});

test('navPopover sem favoritos e sem sumário mostra as duas notas de vazio', () => {
  const sections = kids(navCore.navPopover(true, NIL, NIL, '/p/Limites.pdf')).slice(1);
  assert.equal(textOf(kids(sections[0])[0].kids.head), 'Favoritos desta matéria');
  assert.equal(textOf(kids(sections[0])[1].kids.head), 'Nenhum favorito nesta matéria.');
  assert.equal(textOf(kids(sections[1])[1].kids.head), 'Este PDF não tem sumário.');
  const filled = kids(navCore.navPopover(true, con([book('Um', '/p/Limites.pdf', 2)]), con([out('Limites', 5, 0)]), '/p/Limites.pdf')).slice(1);
  // seção > linha > botão > span.nav-name > texto
  assert.equal(textOf(kids(kids(kids(kids(filled[0])[1])[0])[0])[0]), 'Um');
  // seção > button.nav-outline > texto
  assert.equal(textOf(kids(kids(filled[1])[1])[0]), 'Limites');
});

test('os rótulos dos botões e do diálogo vêm do núcleo', () => {
  assert.equal(navCore.navButtonLabel(), 'Navegar');
  assert.equal(navCore.navButtonTitle(), 'Favoritos e sumário');
  assert.equal(navCore.navAria('Enunciado'), 'Navegar em Enunciado');
  assert.equal(navCore.navBackTitle(), 'Voltar à página anterior');
  assert.equal(navCore.navBackAria('Enunciado'), 'Voltar à página anterior de Enunciado');
  assert.equal(navCore.bookmarkDialogTitle(), 'Guardar esta página');
  assert.equal(navCore.bookmarkDialogHint('Limites', 12n), 'Limites, p. 12');
  assert.equal(navCore.bookmarkSaveLabel(), 'Salvar');
  assert.equal(Number(navCore.maxBookmarks()), 200);
  assert.equal(Number(navCore.maxOutline()), 40);
});
