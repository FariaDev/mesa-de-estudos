// @ts-check
'use strict';

/* Texto de páginas de um PDF da biblioteca, para o tutor do OpenCode (#70).
   O `read` do OpenCode devolve o PDF inteiro como anexo, e os modelos dele não
   aceitam PDF: o tutor respondia sem a apostila. A ferramenta `ler_pdf` do MCP
   `mesa` pede à Mesa, pela ponte local, o texto das páginas citadas. Quem
   valida o caminho é o main (`validPdf`, a biblioteca autorizada); aqui só se
   abre o arquivo e se junta o texto. O pdf.js entra por `loadPdfjs`, a casca
   da biblioteca. */

const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const MAX_PAGES = 3;
const MAX_CHARS_PER_PAGE = 12000;

/** O pdf.js do app (build legacy, que roda em Node sem DOM). */
const loadDefaultPdfjs = () => import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);

/**
 * Junta os trechos de uma página em linhas: `hasEOL` é a quebra que o pdf.js viu.
 * @param {Array<{str?: string, hasEOL?: boolean}>} items
 * @returns {string}
 */
function pageText(items) {
  const text = items.map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ''}`).join('');
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Intervalo pedido, dentro do PDF e do teto de páginas por chamada.
 * @param {unknown} first @param {unknown} last @param {number} total
 * @returns {{first: number, last: number}}
 */
function pageRange(first, last, total) {
  const start = Math.trunc(Number(first));
  if (!Number.isFinite(start) || start < 1 || start > total) throw Error(`Página ${JSON.stringify(first)} fora do PDF; esperado de 1 a ${total}.`);
  const wanted = Math.trunc(Number(last ?? start));
  const end = Number.isFinite(wanted) && wanted >= start ? wanted : start;
  return {first: start, last: Math.min(end, total, start + MAX_PAGES - 1)};
}

/**
 * Leitor de páginas com o pdf.js injetado.
 * @param {{loadPdfjs?: () => Promise<any>, readFile?: (file: string) => Buffer}} [deps]
 * @returns {{read: (request: {file: string, first: unknown, last?: unknown}) => Promise<{file: string, total: number, pages: Array<{page: number, text: string}>}>}}
 * @example await createPdfPageReader().read({file: '/c/Apostila.pdf', first: 53}) // {file: 'Apostila.pdf', total: 120, pages: [{page: 53, text: '…'}]}
 */
function createPdfPageReader({loadPdfjs = loadDefaultPdfjs, readFile = (file) => fs.readFileSync(file)} = {}) {
  async function read({file, first, last}) {
    const pdfjs = await loadPdfjs();
    const loading = pdfjs.getDocument({data: new Uint8Array(readFile(file)), isEvalSupported: false, useSystemFonts: false, verbosity: 0});
    const doc = await loading.promise;
    try {
      const range = pageRange(first, last, doc.numPages);
      const pages = [];
      for (let number = range.first; number <= range.last; number += 1) {
        const content = await (await doc.getPage(number)).getTextContent();
        pages.push({page: number, text: pageText(content.items).slice(0, MAX_CHARS_PER_PAGE)});
      }
      return {file: path.basename(file), total: doc.numPages, pages};
    } finally {
      await loading.destroy();
    }
  }
  return {read};
}

module.exports = {createPdfPageReader, pageText, pageRange, MAX_PAGES};
