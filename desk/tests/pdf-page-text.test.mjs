/* `ler_pdf`: o `read` nativo não abre PDF. A Mesa devolve o texto pela ponte
   local. O caminho passa por `resolveTutorPdf` (NFC/NFD e a pasta da matéria).
   Aqui: o leitor com o pdf.js de verdade, a rota `/pdf-page` e a ferramenta. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tinyPdf} from './helpers.mjs';
import {imagePagesPdf, multiPagePdf} from './synthetic-pdf.mjs';
import {message} from '../src/i18n.mjs';
import {PDF_FIELDS, createPdfSession, pdfTool, pdfPagesText, readPdfPages} from '../src/extensions/mesa-mcp/pdf-tool.mjs';
import {mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';

const require = createRequire(import.meta.url);
const {createPdfPageReader, pageText, pageRange} = require('../pdf-page-text.cjs');
const {resolveTutorPdf} = require('../pdf-read-path.cjs');
const {createActivityBridge} = require('../activity-bridge.cjs');
const {toolErrorText} = require('../src/agents/tool-error-text.cjs');

function withPdf(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-page-'));
  const file = path.join(dir, 'Apostila de M03.pdf');
  fs.writeFileSync(file, tinyPdf(['Limites fundamentais', 'sen x sobre x tende a 1'], 2));
  return Promise.resolve(fn(file)).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
}

function withPdfBytes(bytes, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-page-'));
  const file = path.join(dir, 'Aula sintetica.pdf');
  fs.writeFileSync(file, bytes);
  return Promise.resolve(fn(file)).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
}

test('o leitor devolve o texto da página com as quebras de linha do PDF', () => withPdf(async (file) => {
  const result = await createPdfPageReader().read({file, first: 1});
  assert.equal(result.file, 'Apostila de M03.pdf');
  assert.equal(result.total, 1);
  assert.deepEqual(result.pages.map((page) => page.page), [1]);
  assert.match(result.pages[0].text, /Limites fundamentais/);
  assert.match(result.pages[0].text, /sen x sobre x tende a 1/);
  assert.equal(await createPdfPageReader().count(file), result.total);
}));

test('página fora do PDF é erro com o valor e o intervalo; o teto é de 10 páginas', () => {
  assert.throws(() => pageRange(53, undefined, 9), /Página 53 fora do PDF; esperado de 1 a 9/);
  assert.throws(() => pageRange('x', undefined, 9), /Página "x" fora do PDF/);
  assert.deepEqual(pageRange(2, 40, 9), {first: 2, last: 9, requestedLast: 40});
  assert.deepEqual(pageRange(8, 1, 9), {first: 8, last: 8, requestedLast: 8});
  assert.deepEqual(pageRange(1, 40, 40), {first: 1, last: 10, requestedLast: 40});
  assert.equal(pageText([{str: 'lim', hasEOL: false}, {str: ' x→0', hasEOL: true}, {str: '= 1'}]), 'lim x→0\n= 1');
});

test('a rota /pdf-page da ponte e a ferramenta ler_pdf levam o texto ao tutor; caminho fora da biblioteca é recusado', () => withPdf(async (file) => {
  const reader = createPdfPageReader();
  const allowed = new Set([file]);
  const bridge = createActivityBridge({
    publish: async () => { throw Error('não publica'); },
    pdfPage: (raw) => reader.read({file: resolveTutorPdf(raw.path, allowed), first: raw.first, last: raw.last}),
  });
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'opencode-1', generation: 1}, {engine: 'opencode'});
    const tool = pdfTool({grant});
    const ok = await tool.call({caminho: file, pagina: 1});
    assert.equal(ok.isError, undefined);
    assert.match(ok.content[0].text, /^Apostila de M03\.pdf \(1 páginas, conteúdo do documento\)\n\n--- p\. 1 ---\nLimites fundamentais/);
    const outside = await tool.call({caminho: '/etc/hosts', pagina: 1});
    assert.equal(outside.isError, true);
    assert.match(outside.content[0].text, /PDF recusado: recebi "\/etc\/hosts"/);
    assert.equal(outside.content[0].text.includes(path.basename(file)), false, 'a recusa não lista outros PDFs da biblioteca');
    const wrongToken = await pdfTool({grant: {...grant, token: 'outro'}}).call({caminho: file, pagina: 1});
    assert.equal(wrongToken.isError, true, 'sem o token da conversa, nada é lido');
  } finally {
    await bridge.close();
  }
}));

test('leitura com sobreposição diz quais páginas já foram entregues nesta sessão', async () => {
  const ranges = [];
  const read = async (_grant, args) => {
    const first = Number(args.pagina);
    const last = Number(args.ate ?? args.pagina);
    ranges.push([first, last]);
    const pages = [];
    for (let page = first; page <= last; page++) pages.push({page, text: `p${page}`});
    return {file: String(args.caminho).split('/').at(-1), total: 60, pages};
  };
  const tool = pdfTool({grant: {url: 'http://127.0.0.1:9/activity', token: 't'}, read});
  const first = await tool.call({caminho: '/c/Apostila.pdf', pagina: 33, ate: 42});
  assert.equal(first.isError, undefined);
  assert.doesNotMatch(first.content[0].text, /já entregues/);
  const second = await tool.call({caminho: '/c/Apostila.pdf', pagina: 36, ate: 45});
  assert.match(second.content[0].text, /\(nesta sessão, já entregues: p\. 33–42\)/);
  assert.deepEqual(ranges, [[33, 42], [36, 45]]);
  const other = await tool.call({caminho: '/c/Outra.pdf', pagina: 1, ate: 2});
  assert.doesNotMatch(other.content[0].text, /já entregues/, 'a memória é por PDF');
});

test('a sessão de leitura compacta as páginas entregues em faixas', () => {
  const session = createPdfSession();
  session.content({file: 'A.pdf', total: 9, pages: [{page: 2}, {page: 3}, {page: 4}, {page: 8}]});
  const text = session.content({file: 'A.pdf', total: 9, pages: [{page: 1}]}).find((part) => part.type === 'text').text;
  assert.match(text, /\(nesta sessão, já entregues: p\. 2–4, 8\)/);
});

test('a segunda leitura do mesmo PDF não reabre o arquivo; mtime novo reabre', async () => {
  let parses = 0;
  let reads = 0;
  let stamp = 10;
  const reader = createPdfPageReader({
    loadPdfjs: async () => ({
      getDocument() {
        parses += 1;
        return {promise: Promise.resolve({
          numPages: 3,
          async getPage(number) {
            return {async getTextContent() { return {items: [{str: `p${number}`, hasEOL: true}]}; }, cleanup() {}};
          },
        }), async destroy() {}};
      },
    }),
    readFile: () => { reads += 1; return Buffer.from('%PDF'); },
    statFile: () => ({mtimeMs: stamp, size: 4}),
  });
  const first = await reader.read({file: '/tmp/apostila.pdf', first: 1, last: 3});
  const second = await reader.read({file: '/tmp/apostila.pdf', first: 1, last: 3});
  assert.equal(parses, 1);
  assert.equal(reads, 1);
  assert.deepEqual(first.pages.map((page) => page.page), [1, 2, 3]);
  assert.deepEqual(second.pages.map((page) => page.text), ['p1', 'p2', 'p3']);
  stamp = 11;
  await reader.read({file: '/tmp/apostila.pdf', first: 2});
  assert.equal(parses, 2, 'mtime novo não reaproveita o documento');
  assert.equal(reads, 2);
});

test('pedido 1–40 num PDF de 40 páginas devolve 10 e indica a próxima', () => withPdfBytes(multiPagePdf(40, (n) => `Pagina ${n} de 40`), async (file) => {
  const result = await createPdfPageReader().read({file, first: 1, last: 40});
  assert.equal(result.pages.length, 10);
  assert.deepEqual(result.requested, {first: 1, last: 40});
  assert.equal(result.next, 11);
  assert.equal(result.imageLimitHit, false);
  assert.match(pdfPagesText(result), /\(pedido p\. 1–40; devolvidas 1–10 de 40; continue com pagina: 11\)/);
}));

test('sem corte não acrescenta aviso; ate acima do total avisa sem inventar próxima página', () => withPdfBytes(multiPagePdf(40, (n) => `Pagina ${n} de 40`), async (file) => {
  const reader = createPdfPageReader();
  const short = await reader.read({file, first: 1, last: 3});
  assert.doesNotMatch(pdfPagesText(short), /\(pedido/);
  const beyond = await reader.read({file, first: 35, last: 99});
  assert.equal(beyond.pages.length, 6);
  assert.equal(beyond.next, null);
  assert.match(pdfPagesText(beyond), /\(pedido p\. 35–99; devolvidas 35–40 de 40\)/);
}));

test('logo pequeno fica texto; figura grande vira imagem', () => withPdfBytes(imagePagesPdf(2, (n) => `Pagina ${n}`, {
  1: [{width: 48, height: 48, x: 520, y: 30}],
  2: [{width: 350, height: 300, x: 131, y: 250}],
}), async (file) => {
  const renders = [];
  const result = await createPdfPageReader({renderPage: async ({page}) => { renders.push(page); return `png-${page}`; }}).read({file, first: 1, last: 2});
  assert.equal(result.pages[0].kind, 'text');
  assert.equal(result.pages[0].image, undefined);
  assert.match(result.pages[0].text, /Pagina 1/);
  assert.ok(result.pages[0].imageRatio < 0.01, `logo ocupa ${result.pages[0].imageRatio}`);
  assert.equal(result.pages[1].kind, 'figure');
  assert.equal(result.pages[1].image, 'png-2');
  assert.ok(result.pages[1].imageRatio >= 0.15, `figura ocupa ${result.pages[1].imageRatio}`);
  assert.deepEqual(renders, [2]);
}));

test('faixa com 5 páginas visuais para na 3ª imagem e diz onde continuar', () => withPdfBytes(imagePagesPdf(5, (n) => `Pagina ${n}`, {
  1: [{width: 350, height: 300, x: 131, y: 250}],
  2: [{width: 350, height: 300, x: 131, y: 250}],
  3: [{width: 350, height: 300, x: 131, y: 250}],
  4: [{width: 350, height: 300, x: 131, y: 250}],
  5: [{width: 350, height: 300, x: 131, y: 250}],
}), async (file) => {
  const renders = [];
  const result = await createPdfPageReader({renderPage: async ({page}) => { renders.push(page); return `png-${page}`; }}).read({file, first: 1, last: 5});
  assert.deepEqual(result.pages.map((page) => page.page), [1, 2, 3]);
  assert.equal(result.imageLimitHit, true);
  assert.equal(result.next, 4);
  assert.deepEqual(renders, [1, 2, 3]);
  assert.match(pdfPagesText(result), /teto de 3 imagens/);
  assert.match(pdfPagesText(result), /continue com pagina: 4/);
}));

test('imagem: sim força o PNG de página de texto; imagem: nao lê a figura só como texto', () => withPdfBytes(imagePagesPdf(2, (n) => `Pagina ${n}`, {
  1: [{width: 48, height: 48, x: 520, y: 30}],
  2: [{width: 350, height: 300, x: 131, y: 250}],
}), async (file) => {
  const renders = [];
  const reader = createPdfPageReader({renderPage: async ({page}) => { renders.push(page); return `png-${page}`; }});
  const forced = await reader.read({file, first: 1, last: 1, imagem: 'sim'});
  assert.equal(forced.pages[0].kind, 'text');
  assert.equal(forced.pages[0].image, 'png-1');
  assert.match(pdfPagesText(forced), /\(a imagem da página segue\)/);
  const textOnly = await reader.read({file, first: 2, last: 2, imagem: 'nao'});
  assert.equal(textOnly.pages[0].kind, 'figure');
  assert.equal(textOnly.pages[0].image, undefined);
  assert.match(textOnly.pages[0].text, /Pagina 2/);
  assert.deepEqual(renders, [1]);
}));

test('texto cortado em 12.000 avisa e não corta no meio de palavra', () => withPdfBytes(imagePagesPdf(1, () => 'palavra '.repeat(2000)), async (file) => {
  const result = await createPdfPageReader().read({file, first: 1});
  const page = result.pages[0];
  assert.equal(page.textTruncated, true);
  assert.equal(page.textLength, 15999);
  assert.ok(page.text.length <= 12000 && page.text.length > 11800, `sobrou ${page.text.length}`);
  assert.ok(page.text.endsWith('palavra'), 'termina numa palavra inteira');
  assert.match(pdfPagesText(result), /\(texto da p\. 1 cortado em 12\.000 de 15\.999 caracteres\)/);
}));

test('falha da ponte diz o status e o que fazer; JSON inválido também', async () => {
  const grant = {url: 'http://127.0.0.1:9/activity', token: 't'};
  const args = {caminho: '/c/Aula.pdf', pagina: 1};
  const invalid = await readPdfPages(grant, args, {fetchImpl: async () => new Response('nao e json', {status: 502})}).catch((error) => error);
  assert.match(toolErrorText(invalid, 'pt-BR'), /HTTP 502/);
  assert.match(toolErrorText(invalid, 'pt-BR'), /Tente de novo/);
  const refused = await readPdfPages(grant, args, {
    fetchImpl: async () => new Response(JSON.stringify({error: 'A sessão mudou; prepare o PDF na sessão atual.'}), {status: 409}),
  }).catch((error) => error);
  const refusedText = toolErrorText(refused, 'pt-BR');
  assert.match(refusedText, /HTTP 409/);
  assert.match(refusedText, /A sessão mudou/);
  const down = await readPdfPages(grant, args, {fetchImpl: async () => { throw Error('connect ECONNREFUSED 127.0.0.1'); }}).catch((error) => error);
  assert.match(toolErrorText(down, 'pt-BR'), /ECONNREFUSED/);
  assert.match(toolErrorText(down, 'pt-BR'), /Tente de novo/);
});

test('a ferramenta traduz o erro no idioma do tutor e anuncia imagem no esquema', async () => {
  const tool = pdfTool({grant: {url: 'http://127.0.0.1:9/activity', token: 't'}, read: async () => { throw Error(message('err.pdf.readFailed')); }, language: 'en'});
  const out = await tool.call({caminho: '/c/Aula.pdf', pagina: 1});
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /Could not read the PDF/);
  assert.deepEqual(PDF_FIELDS.imagem.values, ['auto', 'sim', 'nao']);
  assert.equal(PDF_FIELDS.imagem.default, 'auto');
});

test('as páginas de uma chamada saem juntas e na ordem, e o aquecimento divide a abertura', async () => {
  const order = [];
  let parses = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const reader = createPdfPageReader({
    loadPdfjs: async () => ({
      getDocument() {
        parses += 1;
        return {promise: gate.then(() => ({
          numPages: 3,
          async getPage(number) {
            order.push(`start-${number}`);
            await new Promise((resolve) => setTimeout(resolve, number === 1 ? 40 : 5));
            order.push(`end-${number}`);
            return {async getTextContent() { return {items: [{str: `p${number}`, hasEOL: true}]}; }, cleanup() {}};
          },
        })), async destroy() {}};
      },
    }),
    readFile: () => Buffer.from('%PDF'),
    statFile: () => ({mtimeMs: 1, size: 4}),
  });
  const pending = reader.read({file: '/tmp/apostila.pdf', first: 1, last: 3});
  const warmed = reader.warm({file: '/tmp/apostila.pdf', first: 1, last: 3});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(parses, 1, 'leitura e aquecimento abrem o PDF uma vez');
  release();
  const result = await pending;
  await warmed;
  assert.deepEqual(result.pages.map((page) => page.text), ['p1', 'p2', 'p3']);
  assert.ok(order.indexOf('start-2') < order.indexOf('end-1'), 'a página 2 não espera a 1 terminar');
});

test('o MCP mesa oferece ler_pdf e buscar_material só com a ponte', () => {
  const names = (env) => mesaTools(env).map((tool) => tool.name);
  assert.ok(names({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify({url: 'http://127.0.0.1:1/activity', token: 't'})}).includes('ler_pdf'));
  assert.deepEqual(names({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify({url: 'http://127.0.0.1:1/activity', token: 't'}), LEARNING_DESK_PDF_ONLY: '1'}), ['calcular', 'ler_pdf', 'buscar_material', 'listar_materiais']);
  assert.ok(!names({LEARNING_DESK_PDF_ONLY: '1'}).includes('ler_pdf'));
  assert.ok(!names({}).includes('ler_pdf'));
  assert.equal(pdfPagesText({file: 'A.pdf', total: 2, pages: [{page: 2, text: ''}]}), 'A.pdf (2 páginas, conteúdo do documento)\n\n--- p. 2 ---\n(página sem texto: pode ser imagem escaneada)');
});

test('o resultado de ler_pdf marca a origem: conteúdo do documento, dado de estudo', () => {
  const text = pdfPagesText({file: 'Apostila.pdf', total: 9, pages: [{page: 2, text: 'Limites'}]});
  assert.match(text, /\(9 páginas, conteúdo do documento\)/);
});

/* Documentos de mentira para o cache: o `destroy` marca o documento, e uma página
   de documento destruído falha como o pdf.js falha. `holds[nome]` segura a página
   até o teste soltar: é o "documento preso" em uso. */
function fakeDocs(holds = {}) {
  const destroyed = [];
  const loadPdfjs = async () => ({
    getDocument({data}) {
      const name = Buffer.from(data).toString();
      const hold = holds[name];
      let dead = false;
      return {
        promise: Promise.resolve({
          numPages: 2,
          async getPage() {
            if (dead) throw Error(`${name} foi destruído`);
            if (hold) {
              hold.entered.resolve();
              await hold.released.promise;
            }
            if (dead) throw Error(`${name} foi destruído`);
            return {async getTextContent() { return {items: [{str: `${name}:1`, hasEOL: true}]}; }, cleanup() {}};
          },
        }),
        async destroy() {
          dead = true;
          destroyed.push(name);
        },
      };
    },
  });
  return {loadPdfjs, destroyed};
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {promise, resolve};
}

test('duas aberturas concorrentes com o cache cheio não derrubam o documento em uso', async () => {
  const busy = {entered: deferred(), released: deferred()};
  const fake = fakeDocs({'/c/B.pdf': busy});
  const reader = createPdfPageReader({loadPdfjs: fake.loadPdfjs, readFile: (file) => Buffer.from(file), statFile: () => ({mtimeMs: 1, size: 1})});
  const inUse = reader.read({file: '/c/B.pdf', first: 1, last: 1});
  await busy.entered.promise;
  /* A e C chegam na mesma volta, com CACHE_DOCS=2 e B preso: o que acabou de abrir fica pinado. */
  const [first, pages] = await Promise.all([
    reader.read({file: '/c/A.pdf', first: 1, last: 1}),
    reader.count('/c/C.pdf'),
  ]);
  assert.equal(first.pages[0].text, '/c/A.pdf:1');
  assert.equal(pages, 2);
  assert.deepEqual(fake.destroyed, [], 'nenhum documento em uso sai');
  busy.released.resolve();
  assert.equal((await inUse).pages[0].text, '/c/B.pdf:1');
  await reader.count('/c/D.pdf');
  assert.ok(fake.destroyed.includes('/c/B.pdf'), 'com a leitura solta, o teto do cache volta a valer');
});
