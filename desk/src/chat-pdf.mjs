/* Referência de PDF anexado à mensagem. O host guarda caminho, nome e páginas;
   o arquivo fica no disco e o tutor lê com `ler_pdf`. O bloco entra no texto
   do prompt; o histórico o reconhece para desenhar o chip, sem reenviar o PDF. */

export const MAX_CHAT_PDFS = 4;
const MAX_PATH = 4096;
/* Caminho absoluto: POSIX (`/…`), letra de unidade (`C:\`), UNC
   (`\\servidor\pasta\…`) ou o prefixo de caminho longo (`\\?\C:\…`). O
   renderer manda o caminho real do arquivo, e o Windows também entrega PDFs
   fora de `C:`; sem o UNC o chip aparecia e o envio deixava o PDF para trás. */
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/;
const MAX_NAME = 200;
const MAX_PAGES = 100000;
/* Estas duas frases são `chatpdf.header` nos catálogos. O parser e o
   `displayUserText` comparam o texto, então o catálogo não pode divergir. */
export const PDF_HEADERS = ['PDFs anexados a esta mensagem', 'PDFs attached to this message'];
const HEADER = new RegExp(`\\[(?:${PDF_HEADERS.map(escapeRegExp).join('|')})\\]`);
const LINE = /^  · (.+?) \((\d+) (?:páginas?|pages?)\) — (.+)$/;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function baseName(file) {
  return String(file).split(/[\\/]/).pop() || 'PDF';
}

function oneLine(value) {
  return String(value ?? '').replace(/[\r\n\u2028\u2029\uE000\uE001]+/g, ' ').trim();
}

function wholePage(value) {
  const pages = Math.trunc(Number(value));
  return Number.isFinite(pages) && pages > 0 ? Math.min(pages, MAX_PAGES) : 1;
}

/**
 * Fatos de PDFs vindos do renderer (anexo novo, fila ou bandeja guardada): só
 * caminhos absolutos curtos, sem repetir, até o teto por mensagem. O nome e as
 * páginas são dicas de exibição; o arquivo é validado de novo pelo host.
 * @param {unknown} raw
 * @returns {Array<{path: string, name: string, pages: number}>}
 * @example normalizePdfFacts([{path: '/c/Apostila.pdf', name: 'Apostila.pdf', pages: 12}])
 */
export function normalizePdfFacts(raw) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_CHAT_PDFS) break;
    const file = typeof item?.path === 'string' ? item.path.trim() : '';
    if (!file || file.length > MAX_PATH || !ABSOLUTE_PATH.test(file) || seen.has(file)) continue;
    seen.add(file);
    const name = typeof item?.name === 'string' ? item.name.trim().slice(0, MAX_NAME) : '';
    out.push({path: file, name: name || baseName(file), pages: wholePage(item?.pages)});
  }
  return out;
}

/**
 * Bloco de referência que acompanha o texto do aluno. Uma linha por PDF, com o
 * caminho e o total de páginas, e a ferramenta do motor. O conteúdo do PDF não
 * entra aqui.
 * @param {unknown} pdfs
 * @param {(key: string, args?: object) => string} translate tradutor do idioma do tutor
 * @param {string} [tool] `mesa_ler_pdf` ou `mcp__mesa__ler_pdf`
 * @returns {string} vazio quando não há PDF
 * @example pdfAttachmentsBlock([{name:'A.pdf', path:'/c/A.pdf', pages:12}], t, 'mesa_ler_pdf')
 */
export function pdfAttachmentsBlock(pdfs, translate, tool = 'mesa_ler_pdf') {
  const list = normalizePdfFacts(pdfs);
  if (!list.length) return '';
  const t = typeof translate === 'function' ? translate : (key) => key;
  const lines = list.map((pdf) => `  · ${t('chatpdf.line', {
    name: oneLine(pdf.name),
    count: pdf.pages,
    path: oneLine(pdf.path),
  })}`);
  const how = t('chatpdf.read', {tool: oneLine(tool) || 'mesa_ler_pdf'});
  return [`[${t('chatpdf.header')}]`, ...lines, how].join('\n');
}

/**
 * Lê o bloco de PDFs de um texto já enviado (histórico): devolve só
 * `{name, pages, path}` para o chip da bolha; não valida o arquivo.
 * @param {unknown} text
 * @returns {Array<{name: string, pages: number, path: string}>}
 * @example attachedPdfs('[PDFs anexados a esta mensagem]\n  · A.pdf (12 páginas) — /c/A.pdf')
 */
export function attachedPdfs(text) {
  const source = String(text ?? '');
  const header = HEADER.exec(source);
  if (!header) return [];
  const out = [];
  const after = source.slice(header.index + header[0].length).split('\n');
  for (const line of after) {
    const hit = LINE.exec(line);
    if (hit) {
      out.push({name: hit[1], pages: Number(hit[2]), path: hit[3]});
      continue;
    }
    if (out.length) break;
  }
  return out;
}
