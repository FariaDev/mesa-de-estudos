// @ts-check
/* `ler_pdf`: o tutor lê páginas pela Mesa, em todo motor. A ferramenta pede
   à Mesa, pela ponte local e com o mesmo token do quadro (rota `/pdf-page`),
   o texto e, quando a página é escaneada, tem figura grande ou fórmula, a
   imagem. No Pi o nome é `mesa_ler_pdf`; no Claude, `mcp__mesa__ler_pdf`; no
   OpenCode, `mesa_ler_pdf`. */

import {createRequire} from 'node:module';
import {message} from '../../i18n.mjs';
import toolErrorModule from '../../agents/tool-error-text.cjs';
import {jsonSchemaOf} from '../tool-fields.mjs';

const {toolErrorText} = toolErrorModule;
const {MAX_PAGES, MAX_IMAGE_PAGES, MAX_CHARS_PER_PAGE} = createRequire(import.meta.url)('../../../pdf-page-text.cjs');

export const PDF_TOOL_NAME = 'ler_pdf';
export const PDF_MAX_PAGES = MAX_PAGES;
export const PDF_MAX_IMAGE_PAGES = MAX_IMAGE_PAGES;

export const PDF_DESCRIPTION = `Reads pages of a PDF from the desk library, or of a .pdf in the same folder as an authorized PDF. Use it when the answer depends on the material. Request large ranges (up to ${PDF_MAX_PAGES} pages): if there is a cut, the response says what came back and the page to continue from. The response also says which pages of this PDF were already delivered in this session: do not request them again; continue after them. A scanned page, a page with a large figure or formula comes with the page PNG, at most ${PDF_MAX_IMAGE_PAGES} image pages per call; logo and banner stay as text. To force the PNG of a page whose text was not enough, send imagem: "sim"; use "nao" for text only. caminho is what the desk reported, without (p. N) or #page=.`;

/* Campos (`tool-fields.mjs` monta o JSON Schema). */
export const PDF_FIELDS = {
  caminho: {type: 'string', min: 1, max: 4096, description: 'PDF path, as the desk reported, without `(p. N)` or `#page=N`.'},
  pagina: {type: 'integer', min: 1, max: 100000, description: 'First page, counted from 1.'},
  ate: {type: 'integer', min: 1, max: 100000, optional: true, description: `Last page (default: the same page). Request large ranges: up to ${PDF_MAX_PAGES} pages per call; the response says where to continue.`},
  imagem: {type: 'enum', values: ['auto', 'sim', 'nao'], default: 'auto', optional: true, description: 'auto (default): image only for a scanned page, large figure or formula; sim: force the page PNG; nao: text only.'},
};

const numberText = (value) => new Intl.NumberFormat('pt-BR').format(value);

/**
 * O aviso de paginação honesta, só quando o que voltou não é o que foi pedido.
 * @param {{total: number, requested?: {first: number, last: number}, pages: Array<{page: number}>, next?: number|null, imageLimitHit?: boolean}} result
 * @returns {string}
 */
function rangeNotice(result) {
  const requested = result.requested;
  if (!requested || result.pages.length === 0) return '';
  const first = result.pages[0].page;
  const last = result.pages[result.pages.length - 1].page;
  if (last === requested.last && requested.last <= result.total) return '';
  const imageCap = result.imageLimitHit ? `; teto de ${PDF_MAX_IMAGE_PAGES} imagens` : '';
  const follow = result.next ? `; continue com pagina: ${result.next}` : '';
  return `(pedido p. ${requested.first}–${requested.last}; devolvidas ${first}–${last} de ${result.total}${imageCap}${follow})`;
}

/**
 * Faixas compactas de páginas (`33–42, 48`), para o aviso da sessão.
 * @param {number[]|undefined} pages
 * @returns {string}
 */
function pageRanges(pages) {
  const sorted = [...new Set((Array.isArray(pages) ? pages : []).filter((page) => Number.isInteger(page) && page > 0))].sort((a, b) => a - b);
  const ranges = [];
  for (const page of sorted) {
    const last = ranges.at(-1);
    if (last && page === last.end + 1) last.end = page;
    else ranges.push({start: page, end: page});
  }
  return ranges.map(({start, end}) => (start === end ? `${start}` : `${start}–${end}`)).join(', ');
}

/**
 * O texto de uma página, com o corte visível e o aviso da imagem.
 * @param {{page: number, text?: string, kind?: string, textLength?: number, textTruncated?: boolean, image?: string, imageError?: string}} page
 * @returns {string}
 */
function pageBlock(page) {
  const cut = page.textTruncated ? `\n(texto da p. ${page.page} cortado em ${numberText(MAX_CHARS_PER_PAGE)} de ${numberText(page.textLength)} caracteres)` : '';
  const miss = page.imageError ? `\n(a imagem não foi produzida: ${page.imageError})` : '';
  if (page.text && page.image) return `--- p. ${page.page} ---\n${page.text}${cut}\n(a imagem da página segue)${miss}`;
  if (page.text) return `--- p. ${page.page} ---\n${page.text}${cut}${miss}`;
  if (page.image) return `--- p. ${page.page} ---\n(página sem texto; a imagem da página segue)`;
  return `--- p. ${page.page} ---\n(página sem texto: pode ser imagem escaneada)${miss}`;
}

/**
 * O texto que o tutor recebe.
 * @param {{file: string, total: number, requested?: {first: number, last: number}, pages: Array<{page: number, text: string, textLength?: number, textTruncated?: boolean, image?: string, imageError?: string}>, next?: number|null, imageLimitHit?: boolean, deliveredBefore?: number[]}} result
 * @returns {string}
 * @example pdfPagesText({file: 'Apostila.pdf', total: 9, pages: [{page: 2, text: 'Limites'}]}) // 'Apostila.pdf (9 páginas)\n\n--- p. 2 ---\nLimites'
 */
export function pdfPagesText(result) {
  const notice = rangeNotice(result);
  const delivered = pageRanges(result.deliveredBefore);
  const deliveredNotice = delivered ? `(nesta sessão, já entregues: p. ${delivered})` : '';
  return [`${result.file} (${result.total} páginas)`, ...(deliveredNotice ? [deliveredNotice] : []), ...(notice ? [notice] : []), ...result.pages.map(pageBlock)].join('\n\n');
}

/**
 * Sessão de leitura do tutor: lembra, por PDF, quais páginas já foram
 * entregues. A resposta seguinte avisa as anteriores para o modelo não pedir
 * a mesma faixa de novo (`33–42` e depois `36–45`).
 * @returns {{content: (result: {file: string, total: number, pages: Array<{page: number, text: string}>, [key: string]: unknown}) => Array<{type: 'text', text: string} | {type: 'image', data: string, mimeType: 'image/png'}>}}
 * @example const session = createPdfSession(); session.content(result) // content com "já entregues"
 */
export function createPdfSession() {
  const delivered = new Map();
  const pagesOf = (file) => {
    const key = String(file || '');
    if (!delivered.has(key)) delivered.set(key, new Set());
    return delivered.get(key);
  };
  return {
    content(result) {
      const seen = pagesOf(result?.file);
      const before = [...seen];
      for (const page of Array.isArray(result?.pages) ? result.pages : []) {
        const number = Number(page?.page);
        if (Number.isInteger(number) && number > 0) seen.add(number);
      }
      return pdfPagesContent({...result, deliveredBefore: before});
    },
  };
}

/**
 * Texto e, nas páginas visuais, a imagem PNG que a Mesa renderizou.
 * @param {{file: string, total: number, requested?: {first: number, last: number}, pages: Array<{page: number, text: string, textLength?: number, textTruncated?: boolean, image?: string, imageError?: string}>, next?: number|null, imageLimitHit?: boolean, deliveredBefore?: number[]}} result
 * @returns {Array<{type: 'text', text: string} | {type: 'image', data: string, mimeType: 'image/png'}>}
 */
export function pdfPagesContent(result) {
  /** @type {Array<{type: 'text', text: string} | {type: 'image', data: string, mimeType: 'image/png'}>} */
  const content = [];
  content.push({type: 'text', text: pdfPagesText(result)});
  for (const page of result.pages) {
    if (page.image) content.push({type: 'image', data: page.image, mimeType: 'image/png'});
  }
  return content;
}

/**
 * Pede as páginas à ponte local. Falha de transporte e resposta sem leitura
 * dizem o status e o próximo passo para o modelo não repetir a mesma chamada.
 * @param {{url?: string, token?: string}} bridge concessão da ponte (`LEARNING_DESK_ACTIVITY_BRIDGE`)
 * @param {{caminho?: unknown, pagina?: unknown, ate?: unknown, imagem?: unknown}} args
 * @param {{fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{file: string, total: number, pages: Array<{page: number, text: string}>}>}
 */
export async function readPdfPages(bridge, args, {fetchImpl = fetch} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error(message('err.pdf.readUnavailable'));
  }
  let response;
  try {
    response = await fetchImpl(String(bridge.url).replace(/\/activity$/, '/pdf-page'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
      body: JSON.stringify({path: args.caminho, first: args.pagina, last: args.ate, imagem: args.imagem}),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    const cause = error?.cause?.code || error?.cause?.message || '';
    const reason = cause ? `${error?.message || error} (${cause})` : String(error?.message || error);
    throw Error(message('err.pdf.bridgeDown', {reason}));
  }
  const data = await response.json().catch(() => null);
  if (!data) throw Error(message('err.pdf.bridgeJson', {status: response.status}));
  if (!response.ok || data.read !== true) {
    const reason = typeof data.error === 'string' && data.error ? `: ${data.error}` : '';
    throw Error(message('err.pdf.bridgeStatus', {status: response.status, reason}));
  }
  return data;
}

/**
 * A ferramenta do MCP, ligada à concessão da ponte.
 * @param {{grant: {url: string, token: string}, read?: typeof readPdfPages, language?: string}} options
 * @returns {import('./protocol.mjs').McpTool}
 * @example pdfTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'ler_pdf'
 */
export function pdfTool({grant, read = readPdfPages, language}) {
  const session = createPdfSession();
  return {
    name: PDF_TOOL_NAME,
    description: PDF_DESCRIPTION,
    inputSchema: jsonSchemaOf(PDF_FIELDS),
    async call(args) {
      try {
        return {content: session.content(await read(grant, args))};
      } catch (error) {
        return {content: [{type: 'text', text: toolErrorText(error, language, 'err.pdf.readFailed')}], isError: true};
      }
    },
  };
}
