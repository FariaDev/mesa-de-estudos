/* Diálogos da busca e das anotações (Mesa): teste de UI com Electron de verdade.
 *
 * O harness (main + HTML temporários) carrega os módulos REAIS
 * (`src/study-search.mjs` e `src/pdf-notes.mjs`) e injeta um host falso pela
 * mesma superfície do preload (`window.desk.studySearch`, `studySearchResolve`,
 * `studySearchCatalog`, `studyNotesRead`, `studyNotesSave`). Nenhum app,
 * config ou material real é aberto; os diálogos são criados pelos próprios
 * módulos (o shell não é tocado).
 */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {_electron as electron} from '@playwright/test';
import {testEnv} from './electron-env.mjs';

const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEARCH_URL = pathToFileURL(path.join(DESK, 'src', 'study-search.mjs')).href;
const NOTES_URL = pathToFileURL(path.join(DESK, 'src', 'pdf-notes.mjs')).href;
const temporaries = [];

after(() => {
  for (const dir of temporaries) {
    try {
      fs.rmSync(dir, {recursive: true, force: true});
    } catch { /* já foi */ }
  }
});

/* Host falso: registra as chamadas e devolve o formato real da IPC. */
const HOST_SCRIPT = `
window.__calls = {search: [], resolve: [], read: [], save: []};
window.__opened = [];
window.__notes = [{
  id: 'n-1', kind: 'nota', quote: 'trecho antigo',
  note: '<img src=x onerror="window.__xss=2">',
  ref: {name: 'Limites.pdf', rel: 'Limites.pdf', path: '/tmp/limites.pdf', page: 2},
  createdAt: 1, updatedAt: 1,
}];
window.__hits = [
  {
    id: 'pd:k1:2', source: 'pdf', sourceLabel: 'PDF', kind: 'pdf', title: 'Limites e derivadas.pdf',
    courseId: 'Calculo', courseName: 'Cálculo I', role: '', page: 2, fileName: 'Limites e derivadas.pdf',
    when: 1700000000000, snippet: 'O <img src=x onerror="window.__xss=1"> limite de f', rank: 'palavra', count: 1,
  },
  {
    id: 'cv:k2:0', source: 'conversa', sourceLabel: 'Conversa', kind: 'pi', title: 'Explique limites',
    courseId: 'Calculo', courseName: 'Cálculo I', role: 'user', page: 0, fileName: 'pi-1.jsonl',
    when: 0, snippet: 'Explique cálculo de limites no infinito', rank: 'inicio', count: 1,
    topic: 'Limites', favorite: true, chatId: 'chat-0123456789abcdef0123456789abcdef',
  },
];
window.__host = {
  studySearch(payload) {
    window.__calls.search.push(JSON.parse(JSON.stringify(payload)));
    return {hits: window.__hits, truncated: false, sources: payload.scope?.sources || [], courses: [{id: 'Calculo', name: 'Cálculo I'}, {id: 'Fisica', name: 'Física I'}]};
  },
  studySearchCatalog() {
    return {sources: [{key: 'conversa', label: 'Conversa'}, {key: 'lateral', label: 'Chat lateral'}, {key: 'nota', label: 'Anotação'}, {key: 'caderno', label: 'Caderno'}, {key: 'livre', label: 'Sessão Livre'}, {key: 'materia', label: 'Matéria'}, {key: 'pdf', label: 'PDF'}], courses: [{id: 'Calculo', name: 'Cálculo I'}, {id: 'Fisica', name: 'Física I'}]};
  },
  studySearchResolve(payload) {
    window.__calls.resolve.push(payload);
    return {ok: true, kind: 'pdf', path: '/tmp/limites.pdf', name: 'Limites.pdf', page: 2, courseId: 'Calculo'};
  },
  studyNotesRead() {
    window.__calls.read.push({});
    return {items: window.__notes.slice(), scope: {courseId: 'Calculo', name: 'Cálculo I'}};
  },
  studyNotesSave(payload) {
    window.__calls.save.push(JSON.parse(JSON.stringify(payload)));
    if (payload.mode === 'remove') window.__notes = window.__notes.filter((item) => item.id !== payload.id);
    else if (payload.mode === 'edit') window.__notes = window.__notes.map((item) => (item.id === payload.id ? {...payload.item, id: payload.id} : item));
    else window.__notes = [{...payload.item, id: 'n-novo'}, ...window.__notes];
    return {items: window.__notes.slice(), scope: {courseId: 'Calculo'}};
  },
};
window.__xss = 0;
`;

const HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>harness</title>
<link rel="stylesheet" href="${pathToFileURL(path.join(DESK, 'src', 'study-tools.css')).href}">
</head><body>
<nav id="study-tools-bar"><button id="study-search-open" type="button">Buscar estudos</button><button id="study-notes-open" type="button">Anotações</button></nav>
<div class="pdf-panel">
  <select class="pdf-select"><option value="/tmp/limites.pdf" selected>Limites.pdf</option></select>
  <input class="page-number" value="3">
  <div class="pdf-viewport">
    <div class="pdf-page" data-page="3"><div class="textLayer"><span id="selection-source">trecho selecionado do pdf</span></div></div>
  </div>
</div>
<script>${HOST_SCRIPT}</script>
<script type="module">
import {initStudySearch, openStudySearch, closeStudySearch} from ${JSON.stringify(SEARCH_URL)};
import {initPdfNotes, openPdfNotes, closePdfNotes} from ${JSON.stringify(NOTES_URL)};
initStudySearch({host: window.__host, onOpenResult: (destination, hit) => { window.__opened.push({destination, id: hit.id}); return true; }, onAnnotate: null});
initPdfNotes({host: window.__host});
window.__ui = {openStudySearch, closeStudySearch, openPdfNotes, closePdfNotes};
</script>
</body></html>`;

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-study-ui-'));
  temporaries.push(dir);
  const html = path.join(dir, 'harness.html');
  const main = path.join(dir, 'main.cjs');
  fs.writeFileSync(html, HTML);
  fs.writeFileSync(main, [
    "const {app, BrowserWindow} = require('electron');",
    "app.whenReady().then(() => {",
    "  const win = new BrowserWindow({show: false, width: 1100, height: 720, webPreferences: {contextIsolation: false, sandbox: false}});",
    "  win.loadFile(process.env.STUDY_UI_HTML);",
    "});",
    "app.on('window-all-closed', () => {});",
    '',
  ].join('\n'));
  const app = await electron.launch({args: [main], env: testEnv({STUDY_UI_HTML: html})});
  const page = await app.firstWindow();
  page.on('dialog', (dialog) => dialog.accept());
  await page.waitForSelector('#study-search-open');
  return {app, page};
}

const openSearch = (page) => page.waitForSelector('#study-search-dialog[open]');

test('Ctrl/Cmd+Shift+F abre e Esc fecha; Ctrl+F fica para o PDF', async () => {
  const {app, page} = await launch();
  try {
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'f', ctrlKey: true, bubbles: true})));
    assert.equal(await page.evaluate(() => !!document.querySelector('#study-search-dialog')?.open), false, 'Ctrl+F não abre a busca de estudos');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'f', ctrlKey: true, shiftKey: true, bubbles: true})));
    await openSearch(page);
    assert.equal(await page.evaluate(() => document.querySelector('#study-search-dialog').open), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#study-search-dialog').open);
  } finally {
    await app.close();
  }
});

test('clicar na barra abre; buscar mostra status, resultados e escapa HTML', async () => {
  const {app, page} = await launch();
  try {
    await page.click('#study-search-open');
    await openSearch(page);
    await page.fill('#study-search-input', 'limite');
    await page.click('#study-search-submit');
    await page.waitForFunction(() => document.querySelectorAll('.study-search-result').length === 2);
    const payload = await page.evaluate(() => window.__calls.search.at(-1));
    assert.equal(payload.query, 'limite');
    assert.ok(payload.scope.sources.includes('pdf'), 'fonte pdf entra no escopo');
    assert.equal(await page.textContent('#study-search-status'), '2 resultados');
    assert.equal(await page.locator('.study-search-result mark').first().textContent(), 'limite', 'trecho marca o casamento');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.study-search-snippet img').length), 0, 'nada de <img> injetado');
    assert.equal(await page.evaluate(() => window.__xss), 0, 'o onerror não roda');
    assert.match(await page.textContent('.study-search-result .study-search-snippet'), /<img src=x/, 'o texto aparece como texto');
  } finally {
    await app.close();
  }
});

test('filtro de fontes e de matérias refaz a busca com o escopo escolhido', async () => {
  const {app, page} = await launch();
  try {
    await page.click('#study-search-open');
    await openSearch(page);
    await page.fill('#study-search-input', 'limite');
    await page.click('#study-search-submit');
    await page.waitForFunction(() => document.querySelectorAll('.study-search-result').length === 2);
    await page.selectOption('#study-search-sources', 'conversa');
    await page.waitForFunction(() => window.__calls.search.length >= 2);
    assert.deepEqual(await page.evaluate(() => window.__calls.search.at(-1).scope.sources), ['conversa']);
    await page.selectOption('#study-search-courses', 'Calculo');
    await page.waitForFunction(() => window.__calls.search.length >= 3);
    assert.deepEqual(await page.evaluate(() => window.__calls.search.at(-1).scope.courses), ['Calculo']);
    await page.click('#study-search-reset');
    await page.waitForFunction(() => window.__calls.search.length >= 4);
    assert.equal(await page.evaluate(() => window.__calls.search.at(-1).scope.sources.length), 7);
    assert.equal(await page.evaluate(() => Object.hasOwn(window.__calls.search.at(-1).scope, 'courses')), false);
    assert.equal(await page.locator('#study-search-reset').isVisible(), false);
  } finally {
    await app.close();
  }
});

test('Abrir resolve no host e entrega o destino ao handler pai', async () => {
  const {app, page} = await launch();
  try {
    await page.click('#study-search-open');
    await openSearch(page);
    await page.fill('#study-search-input', 'limite');
    await page.click('#study-search-submit');
    await page.waitForFunction(() => document.querySelectorAll('.study-search-result').length === 2);
    await page.click('.study-search-open-result');
    await page.waitForFunction(() => window.__opened.length === 1);
    assert.deepEqual(await page.evaluate(() => window.__calls.resolve), [{id: 'pd:k1:2'}]);
    const opened = await page.evaluate(() => window.__opened[0]);
    assert.equal(opened.destination.kind, 'pdf');
    assert.equal(opened.destination.page, 2);
    assert.equal(await page.evaluate(() => document.querySelector('#study-search-dialog').open), false, 'o diálogo fecha ao abrir');
  } finally {
    await app.close();
  }
});

test('anotações: barra abre, lista escapa HTML, seleção preenche e salvar manda o item certo', async () => {
  const {app, page} = await launch();
  try {
    await page.click('#study-notes-open');
    await page.waitForSelector('#study-notes-dialog[open]');
    await page.waitForFunction(() => document.querySelectorAll('.study-note-card').length === 1);
    assert.equal(await page.evaluate(() => window.__calls.read.length), 1);
    assert.equal(await page.evaluate(() => document.querySelectorAll('.study-note-card img').length), 0, 'nota com HTML não injeta elemento');
    assert.match(await page.textContent('.study-note-card'), /<img src=x/, 'o HTML fica como texto');

    /* Selecionar o trecho do leitor e usar a seleção. */
    await page.evaluate(() => {
      const span = document.querySelector('#selection-source');
      const range = document.createRange();
      range.selectNodeContents(span);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await page.click('#study-note-use-selection');
    assert.equal(await page.inputValue('#study-note-quote'), 'trecho selecionado do pdf');
    assert.equal(await page.inputValue('#study-note-page'), '3');

    await page.fill('#study-note-note', 'minha dúvida');
    await page.click('#study-note-save');
    await page.waitForFunction(() => window.__calls.save.length === 1);
    const save = await page.evaluate(() => window.__calls.save.at(-1));
    assert.equal(save.mode, 'add');
    assert.equal(save.item.quote, 'trecho selecionado do pdf');
    assert.equal(save.item.note, 'minha dúvida');
    assert.equal(save.item.ref.page, 3);
    assert.equal(save.item.ref.path, '/tmp/limites.pdf', 'o caminho do material vem do leitor e o host valida');
    await page.waitForFunction(() => document.querySelectorAll('.study-note-card').length === 2);
  } finally {
    await app.close();
  }
});

test('anotações: filtro de página, editar mantém id e remover pede confirmação', async () => {
  const {app, page} = await launch();
  try {
    await page.click('#study-notes-open');
    await page.waitForSelector('#study-notes-dialog[open]');
    await page.waitForFunction(() => document.querySelectorAll('.study-note-card').length === 1);
    /* Filtro pela página 2 (do item existente) e pela página 7 (vazia). */
    await page.selectOption('#study-notes-page-filter', '2');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.study-note-card').length), 1);
    await page.selectOption('#study-notes-page-filter', '');
    await page.click('.study-note-edit');
    assert.equal(await page.inputValue('#study-note-note'), '<img src=x onerror="window.__xss=2">');
    assert.equal(await page.isVisible('#study-note-cancel-edit'), true, 'editar mostra o cancelar');
    await page.fill('#study-note-note', 'revisada');
    await page.click('#study-note-save');
    await page.waitForFunction(() => window.__calls.save.length === 1);
    const edit = await page.evaluate(() => window.__calls.save.at(-1));
    assert.equal(edit.mode, 'edit');
    assert.equal(edit.id, 'n-1');
    assert.equal(edit.item.note, 'revisada');

    await page.click('.study-note-remove');
    await page.waitForFunction(() => window.__calls.save.length === 2);
    const remove = await page.evaluate(() => window.__calls.save.at(-1));
    assert.deepEqual(remove, {mode: 'remove', id: 'n-1'});
    await page.waitForFunction(() => document.querySelectorAll('.study-note-card').length === 0);
  } finally {
    await app.close();
  }
});

test('resultado de PDF no diálogo de busca abre as anotações no caminho resolvido', async () => {
  const {app, page} = await launch();
  try {
    await page.click('#study-search-open');
    await openSearch(page);
    await page.fill('#study-search-input', 'limite');
    await page.click('#study-search-submit');
    await page.waitForFunction(() => document.querySelectorAll('.study-search-result').length === 2);
    await page.click('.study-search-annotate-result');
    await page.waitForSelector('#study-notes-dialog[open]');
    await page.waitForFunction(() => window.__calls.resolve.length === 1);
    assert.equal(await page.evaluate(() => window.__calls.resolve[0].id), 'pd:k1:2');
    assert.equal(await page.inputValue('#study-note-page'), '2');
    assert.equal(await page.evaluate(() => document.querySelector('#study-note-quote').dataset.path), '/tmp/limites.pdf');
  } finally {
    await app.close();
  }
});

test('favorito e assunto aparecem; seletores substituem checkboxes e preset vazio não busca tudo', async () => {
  const {app, page} = await launch();
  try {
    await page.click('#study-search-open');
    await openSearch(page);
    await page.fill('#study-search-input', 'limite');
    await page.click('#study-search-submit');
    await page.waitForFunction(() => document.querySelectorAll('.study-search-result').length === 2);
    const meta = await page.textContent('.study-search-result[data-hit="cv:k2:0"] .study-search-meta');
    assert.match(meta, /★ Favorita/);
    assert.match(meta, /Assunto: Limites/);
    assert.match(meta, /Cálculo I/);
    assert.equal(meta.includes('pi-1.jsonl'), false, 'a referência visível mostra a matéria, não o arquivo interno da conversa');

    assert.equal(await page.locator('#study-search-dialog input[type=checkbox]').count(), 0);
    assert.equal(await page.locator('#study-search-sources option').count(), 8, 'sete conteúdos e a busca geral');
    const beforeLast = await page.evaluate(() => window.__calls.search.length);
    await page.evaluate(() => window.__ui.openStudySearch({sources: []}));
    await page.click('#study-search-submit');
    assert.equal(await page.evaluate(() => window.__calls.search.length), beforeLast, 'nenhuma fonte não chama o host');
    assert.equal(await page.locator('.study-search-result').count(), 0);
    assert.match(await page.textContent('#study-search-status'), /amplie os filtros/);
  } finally {
    await app.close();
  }
});
