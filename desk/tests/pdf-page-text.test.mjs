/* `ler_pdf` do OpenCode (#70): o `read` do OpenCode não abre PDF, e o tutor
   respondia sem a apostila. A Mesa devolve o texto das páginas pela ponte local,
   só de PDFs da biblioteca. Aqui: o leitor com o pdf.js de verdade, a rota
   `/pdf-page` da ponte e a ferramenta do MCP de ponta a ponta. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tinyPdf} from './helpers.mjs';
import {pdfTool, pdfPagesText} from '../src/extensions/mesa-mcp/pdf-tool.mjs';
import {mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';

const require = createRequire(import.meta.url);
const {createPdfPageReader, pageText, pageRange} = require('../pdf-page-text.cjs');
const {createActivityBridge} = require('../activity-bridge.cjs');

function withPdf(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-page-'));
  const file = path.join(dir, 'Apostila de M03.pdf');
  fs.writeFileSync(file, tinyPdf(['Limites fundamentais', 'sen x sobre x tende a 1'], 2));
  return Promise.resolve(fn(file)).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
}

test('o leitor devolve o texto da página com as quebras de linha do PDF', () => withPdf(async (file) => {
  const result = await createPdfPageReader().read({file, first: 1});
  assert.equal(result.file, 'Apostila de M03.pdf');
  assert.equal(result.total, 1);
  assert.deepEqual(result.pages.map((page) => page.page), [1]);
  assert.match(result.pages[0].text, /Limites fundamentais/);
  assert.match(result.pages[0].text, /sen x sobre x tende a 1/);
}));

test('página fora do PDF é erro com o valor e o intervalo; o teto é de 3 páginas', () => {
  assert.throws(() => pageRange(53, undefined, 9), /Página 53 fora do PDF; esperado de 1 a 9/);
  assert.throws(() => pageRange('x', undefined, 9), /Página "x" fora do PDF/);
  assert.deepEqual(pageRange(2, 40, 9), {first: 2, last: 4});
  assert.deepEqual(pageRange(8, 1, 9), {first: 8, last: 8});
  assert.equal(pageText([{str: 'lim', hasEOL: false}, {str: ' x→0', hasEOL: true}, {str: '= 1'}]), 'lim x→0\n= 1');
});

test('a rota /pdf-page da ponte e a ferramenta ler_pdf levam o texto ao tutor; caminho fora da biblioteca é recusado', () => withPdf(async (file) => {
  const reader = createPdfPageReader();
  const allowed = new Set([file]);
  const bridge = createActivityBridge({
    publish: async () => { throw Error('não publica'); },
    pdfPage: (raw) => {
      if (!allowed.has(raw.path)) throw Error(`PDF fora da biblioteca: ${JSON.stringify(raw.path)}`);
      return reader.read({file: raw.path, first: raw.first, last: raw.last});
    },
  });
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'opencode-1', generation: 1}, {engine: 'opencode'});
    const tool = pdfTool({grant});
    const ok = await tool.call({caminho: file, pagina: 1});
    assert.equal(ok.isError, undefined);
    assert.match(ok.content[0].text, /^Apostila de M03\.pdf \(1 páginas\)\n\n--- p\. 1 ---\nLimites fundamentais/);
    const outside = await tool.call({caminho: '/etc/hosts', pagina: 1});
    assert.equal(outside.isError, true);
    assert.match(outside.content[0].text, /PDF fora da biblioteca: "\/etc\/hosts"/);
    const wrongToken = await pdfTool({grant: {...grant, token: 'outro'}}).call({caminho: file, pagina: 1});
    assert.equal(wrongToken.isError, true, 'sem o token da conversa, nada é lido');
  } finally {
    await bridge.close();
  }
}));

test('o MCP mesa oferece ler_pdf só com a ponte', () => {
  const names = (env) => mesaTools(env).map((tool) => tool.name);
  assert.ok(names({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify({url: 'http://127.0.0.1:1/activity', token: 't'})}).includes('ler_pdf'));
  assert.ok(!names({}).includes('ler_pdf'));
  assert.equal(pdfPagesText({file: 'A.pdf', total: 2, pages: [{page: 2, text: ''}]}), 'A.pdf (2 páginas)\n\n--- p. 2 ---\n(página sem texto: pode ser imagem escaneada)');
});
