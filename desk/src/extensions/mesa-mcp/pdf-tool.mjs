// @ts-check
/* `ler_pdf` (#70): só no OpenCode. O `read` dele devolve o PDF como anexo, e os
   modelos do OpenCode não aceitam PDF; o tutor respondia sem a apostila. Esta
   ferramenta pede à Mesa, pela ponte local e com o mesmo token do quadro (rota
   `/pdf-page`), o texto das páginas de um PDF da biblioteca. O Pi e o Claude
   leem PDF com o próprio `read`, e não a recebem. */

import {jsonSchemaOf} from '../tool-fields.mjs';

export const PDF_TOOL_NAME = 'ler_pdf';
export const PDF_MAX_PAGES = 3;

export const PDF_DESCRIPTION = `Lê o texto de páginas de um PDF que a Mesa informou (referência \`caminho (p. N)\`). Use quando a resposta depender do material: o read deste computador não abre PDF. Devolve o texto de até ${PDF_MAX_PAGES} páginas por chamada; fórmulas saem como texto corrido e podem vir fora de ordem, então confira com o aluno o que não estiver claro. Só PDFs da biblioteca da Mesa.`;

/* Campos (`tool-fields.mjs` monta o JSON Schema). */
export const PDF_FIELDS = {
  caminho: {type: 'string', min: 1, max: 4096, description: 'Caminho do PDF, como a Mesa informou, sem `(p. N)` nem `#page=N`.'},
  pagina: {type: 'integer', min: 1, max: 100000, description: 'Primeira página, contada a partir de 1.'},
  ate: {type: 'integer', min: 1, max: 100000, optional: true, description: `Última página (padrão: a mesma). No máximo ${PDF_MAX_PAGES} por chamada.`},
};

/**
 * O texto que o tutor recebe.
 * @param {{file: string, total: number, pages: Array<{page: number, text: string}>}} result
 * @returns {string}
 * @example pdfPagesText({file: 'Apostila.pdf', total: 9, pages: [{page: 2, text: 'Limites'}]}) // 'Apostila.pdf (9 páginas)\n\n--- p. 2 ---\nLimites'
 */
export function pdfPagesText(result) {
  const pages = result.pages.map(({page, text}) => `--- p. ${page} ---\n${text || '(página sem texto: pode ser imagem escaneada)'}`);
  return [`${result.file} (${result.total} páginas)`, ...pages].join('\n\n');
}

/**
 * Pede as páginas à ponte local.
 * @param {{url?: string, token?: string}} bridge concessão da ponte (`LEARNING_DESK_ACTIVITY_BRIDGE`)
 * @param {{caminho?: unknown, pagina?: unknown, ate?: unknown}} args
 * @param {{fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{file: string, total: number, pages: Array<{page: number, text: string}>}>}
 */
export async function readPdfPages(bridge, args, {fetchImpl = fetch} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('Ler PDF está disponível na sessão principal da Mesa.');
  }
  const response = await fetchImpl(String(bridge.url).replace(/\/activity$/, '/pdf-page'), {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
    body: JSON.stringify({path: args.caminho, first: args.pagina, last: args.ate}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.read !== true) throw Error((data && data.error) || 'A Mesa não conseguiu ler o PDF.');
  return data;
}

/**
 * A ferramenta do MCP, ligada à concessão da ponte.
 * @param {{grant: {url: string, token: string}, read?: typeof readPdfPages}} options
 * @returns {import('./protocol.mjs').McpTool}
 * @example pdfTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'ler_pdf'
 */
export function pdfTool({grant, read = readPdfPages}) {
  return {
    name: PDF_TOOL_NAME,
    description: PDF_DESCRIPTION,
    inputSchema: jsonSchemaOf(PDF_FIELDS),
    async call(args) {
      try {
        return {content: [{type: 'text', text: pdfPagesText(await read(grant, args))}]};
      } catch (error) {
        return {content: [{type: 'text', text: String(error?.message || error)}], isError: true};
      }
    },
  };
}
