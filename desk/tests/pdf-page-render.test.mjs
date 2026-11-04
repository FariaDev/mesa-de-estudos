/* Render da página sem Electron: a janela falsa devolve o PNG e o ipc só
   autoriza o caminho da chamada em curso. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PLOT_PNG} from './helpers.mjs';
import {fakePdfWindow, fakeIpc} from './fake-pdf-render.mjs';

const require = createRequire(import.meta.url);
const {createPdfPageRenderer, PDF_RENDER_READ_CHANNEL} = require('../pdf-page-render.cjs');
const {createPdfPageReader, pageKind, kindFromCounts, imageAreaRatio, opsByName} = require('../pdf-page-text.cjs');
const {fakePdfjs} = await import('./fake-pdf-render.mjs');

test('página de texto não pede imagem; página visual anexa o PNG e falha de render não derruba o texto', async () => {
  let renders = 0;
  const textReader = createPdfPageReader({
    loadPdfjs: async () => fakePdfjs({text: 'Limites', fnArray: [1], ops: {showText: 1}}),
    readFile: () => Buffer.from('%PDF'),
    renderPage: async () => { renders += 1; return PLOT_PNG; },
  });
  const text = await textReader.read({file: '/c/Aula.pdf', first: 1});
  assert.equal(text.pages[0].kind, 'text');
  assert.equal(text.pages[0].image, undefined);
  assert.equal(renders, 0);

  const scan = await createPdfPageReader({
    loadPdfjs: async () => fakePdfjs({text: '', fnArray: [9], ops: {paintImageXObject: 9}}),
    readFile: () => Buffer.from('%PDF'),
    renderPage: async ({page}) => { renders += 1; assert.equal(page, 1); return PLOT_PNG; },
  }).read({file: '/c/Scan.pdf', first: 1});
  assert.equal(scan.pages[0].kind, 'scan');
  assert.equal(scan.pages[0].image, PLOT_PNG);

  const broken = await createPdfPageReader({
    loadPdfjs: async () => fakePdfjs({text: '∫', fnArray: [8, 9], argsArray: [[400, 0, 0, 400, 0, 0], [0, 1, 1]], ops: {transform: 8, paintImageXObject: 9}}),
    readFile: () => Buffer.from('%PDF'),
    renderPage: async () => { throw Error('janela caiu'); },
  }).read({file: '/c/Figura.pdf', first: 1});
  assert.match(broken.pages[0].text, /∫/);
  assert.equal(broken.pages[0].kind, 'figure');
  assert.match(broken.pages[0].imageError, /janela caiu/);
  assert.equal(broken.pages[0].image, undefined);
});

test('a classificação usa o nome do operador, não o número, e só figura grande pede imagem', () => {
  assert.equal(kindFromCounts('', 0, 0), 'scan');
  assert.equal(kindFromCounts('tem texto', 0.2, 0), 'figure');
  assert.equal(kindFromCounts('tem texto', 0.05, 0), 'text');
  assert.equal(kindFromCounts('x'.repeat(40), 0, 101), 'formula');
  assert.equal(kindFromCounts('x'.repeat(400), 0, 200), 'text');
  const area = 612 * 792;
  assert.equal(pageKind({OPS: {transform: 4, paintImageXObject: 3}}, {fnArray: [4, 3], argsArray: [[400, 0, 0, 400, 0, 0], [0, 1, 1]]}, 'legenda', area), 'figure');
  assert.equal(pageKind({OPS: {transform: 4, paintImageXObject: 3}}, {fnArray: [4, 3], argsArray: [[48, 0, 0, 48, 0, 0], [0, 1, 1]]}, 'legenda', area), 'text');
  assert.equal(pageKind({OPS: {showText: 3}}, {fnArray: [3]}, 'legenda', area), 'text');
});

test('a área de imagens soma repetições e aceita posições tipadas do pdf.js', () => {
  const byId = opsByName({OPS: {transform: 1, paintImageXObjectRepeat: 2}});
  const ratio = imageAreaRatio(byId, [1, 2], [[100, 0, 0, 100, 0, 0], [0, 1, 1, new Float32Array([0, 0, 200, 0])]], 40000);
  assert.equal(ratio, 0.5);
});

test('o render lê o arquivo só pelo main, só para a janela de render e só na chamada em curso', async () => {
  const ipc = fakeIpc();
  const reads = [];
  const seen = [];
  let win = null;
  const renderer = createPdfPageRenderer({
    createWindow: () => {
      win = fakePdfWindow({
        png: PLOT_PNG,
        onScript(script) {
          if (!script.startsWith('window.mesaRenderPdfPage(')) return;
          /* Durante a chamada, o preload pede o arquivo pela própria janela de render. */
          assert.equal(ipc.handler({sender: win.webContents}, '/c/Aula.pdf').toString(), '%PDF-1.4');
          assert.throws(() => ipc.handler({sender: {}}, '/c/Aula.pdf'), /não autorizado/, 'outra janela não lê');
          assert.throws(() => ipc.handler({sender: win.webContents}, '/etc/passwd'), /não autorizado/, 'outro arquivo não lê');
          seen.push(script);
        },
      });
      return win;
    },
    html: '/tmp/pdf-render.html',
    ipcMain: ipc,
    readFile: (file) => {
      reads.push(file);
      return Buffer.from('%PDF-1.4');
    },
    timeoutMs: 200,
  });
  assert.equal(ipc.channel, PDF_RENDER_READ_CHANNEL);
  assert.equal(await renderer.render({file: '/c/Aula.pdf', page: 2}), PLOT_PNG);
  assert.match(seen[0], /mesaRenderPdfPage\("\/c\/Aula.pdf", 2\)/);
  assert.deepEqual(reads, ['/c/Aula.pdf'], 'só o caminho da chamada foi lido');
  assert.throws(() => ipc.handler({sender: win.webContents}, '/c/Aula.pdf'), /não autorizado/, 'fora da chamada o pedido é recusado');
  renderer.close();

  let hidden = null;
  const slow = createPdfPageRenderer({
    createWindow: () => {
      hidden = fakePdfWindow({ready: false});
      return hidden;
    },
    html: '/tmp/pdf-render.html',
    ipcMain: fakeIpc(),
    timeoutMs: 40,
  });
  await assert.rejects(() => slow.render({file: '/c/Aula.pdf', page: 1}), /não ficou pronto/);
  assert.equal(hidden.closed, true, 'janela que não ficou pronta é fechada');
  /* A janela é `sandbox`: o preload não importa `fs` nem bloqueia; só pede o canal. */
  const preload = fs.readFileSync(path.join(import.meta.dirname, '..', 'pdf-render-preload.cjs'), 'utf8');
  assert.match(preload, new RegExp(`invoke\\('${PDF_RENDER_READ_CHANNEL}'`));
  assert.doesNotMatch(preload, /node:fs|sendSync/);
  const main = fs.readFileSync(path.join(import.meta.dirname, '..', 'main.cjs'), 'utf8');
  assert.match(main, /pdf-render-preload\.cjs'\),contextIsolation:true,nodeIntegration:false,sandbox:true/);
});
