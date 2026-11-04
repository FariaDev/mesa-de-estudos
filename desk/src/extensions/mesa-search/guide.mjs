/* `buscar_material` — UM texto e um formato de resultado para os três motores
   (Pi `mesa_buscar_material`, Claude e OpenCode `buscar_material`). O quando
   usar mora no prompt do tutor (`desk-prompts.cjs`); aqui fica o como e a
   saída compacta que o modelo lê antes de chamar `ler_pdf`. Descrição e campos
   são SEMPRE em inglês; o resultado (`searchText`) segue como estava.
   Os tetos vêm do núcleo (`core/studysearch.bend`), os mesmos do índice. */

import searchCore from '../../generated/studysearch.core.js';

export const SEARCH_DEFAULT_HITS = 5;
const MIN_QUERY = Number(searchCore.minQueryChars());
const MAX_QUERY = Number(searchCore.maxQueryChars());
const MAX_LIMIT = Number(searchCore.maxLimit());

export const SEARCH_DESCRIPTION =
  `Searches the PDF text of this conversation's course and returns one line per result with the file path and page, ready to open with ler_pdf. ` +
  `Use it before scanning the lesson: to locate an exercise, a definition, a topic or a page. It does not summarize. ` +
  `With no result, try synonyms or the exercise number.`;

/* Campos (`tool-fields.mjs` monta o zod do Claude, o TypeBox do Pi e o JSON Schema do OpenCode). */
export const SEARCH_FIELDS = {
  consulta: {type: 'string', min: MIN_QUERY, max: MAX_QUERY, trim: true, description: `Text to search in the PDFs (${MIN_QUERY} to ${MAX_QUERY} characters).`},
  limite: {type: 'integer', min: 1, max: MAX_LIMIT, optional: true, default: SEARCH_DEFAULT_HITS, description: `Maximum results (default ${SEARCH_DEFAULT_HITS}; up to ${MAX_LIMIT}).`},
};

const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * O texto que volta ao tutor: uma linha por resultado, no formato que a próxima
 * chamada de `ler_pdf` usa. Sem hit, sugere outro termo; com o índice ainda em
 * construção, manda ler a página e tentar de novo.
 * @param {{query?: string, indexing?: boolean, truncated?: boolean, hits?: Array<{path?: string, name?: string, page?: number, snippet?: string}>}} result
 * @returns {string}
 * @example searchText({query: '7b', hits: [{path: '/c/A.pdf', page: 27, snippet: 'Exercício 7b'}]}) // '/c/A.pdf, p. 27: Exercício 7b'
 */
export function searchText(result) {
  const hits = Array.isArray(result?.hits) ? result.hits : [];
  if (!hits.length) {
    if (result?.indexing) return 'O índice de busca ainda está sendo montado nesta matéria; use ler_pdf nas páginas por enquanto.';
    return `Nenhum resultado para “${oneLine(result?.query)}”. Tente sinônimos ou o número do exercício.`;
  }
  const lines = hits.map((hit) => `${hit.path || hit.name || 'PDF'}, p. ${Math.max(1, Number(hit.page) || 1)}: ${oneLine(hit.snippet)}`);
  if (result?.indexing) lines.push('(o índice ainda está sendo montado; pode faltar resultado)');
  else if (result?.truncated) lines.push('(há mais resultados; refine a consulta ou aumente o limite)');
  return lines.join('\n');
}
