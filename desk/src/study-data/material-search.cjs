'use strict';

/* Busca do tutor no material (`buscar_material`): o mesmo índice offline da
 * interface (`search.cjs`), com o escopo FIXO pelo host — a matéria da sessão e
 * só o texto dos PDFs que a biblioteca dela já autoriza. O modelo manda apenas
 * `consulta` e `limite`; nunca caminho, matéria ou fonte.
 *
 * A validação mora aqui, uma vez para os três motores: as mensagens saem
 * marcadas (`message`) e o i18n de cada caminho as traduz (a ponte usa
 * `tutorText`; o Claude, `toolErrorText`). A política de casamento, tetos e
 * autorização continua no núcleo (`core/studysearch.bend`). */

const {describeReceived} = require('../error-detail.mjs');
const {message} = require('../i18n.mjs');
const search = require('./search.cjs');
const {maxLimit} = require('./search-text.cjs');

const DEFAULT_HITS = 5;

/**
 * Campos do tutor em fatos da busca: consulta aparada e limite inteiro.
 * @param {unknown} raw o que o modelo mandou
 * @returns {{query: string, limit: number}}
 * @example searchArgs({consulta: ' exercício 7b '}) // {query: 'exercício 7b', limit: 5}
 */
function searchArgs(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const consulta = input.consulta;
  if (typeof consulta !== 'string') {
    throw Error(message('err.searchTool.queryType', {
      received: describeReceived(consulta),
      min: search.minQueryChars(),
      max: search.maxQueryChars(),
    }));
  }
  const query = consulta.trim();
  if (query.length < search.minQueryChars()) throw Error(message('err.searchTool.queryShort', {length: query.length, min: search.minQueryChars()}));
  if (query.length > search.maxQueryChars()) throw Error(message('err.searchTool.queryLong', {length: query.length, max: search.maxQueryChars()}));
  const limite = input.limite;
  if (limite === undefined || limite === null) return {query, limit: DEFAULT_HITS};
  if (typeof limite !== 'number' || !Number.isInteger(limite) || limite < 1 || limite > maxLimit()) {
    throw Error(message('err.searchTool.limit', {received: describeReceived(limite), min: 1, max: maxLimit()}));
  }
  return {query, limit: limite};
}

/**
 * A matéria que o host autoriza. O escopo chega do grant da sessão; id fora da
 * lista não vira busca em outra matéria.
 * @param {Array<{id: string, name: string, path?: string}>} courses lista do host
 * @param {unknown} courseId matéria pedida pelo grant
 * @returns {{id: string, name: string, path?: string}}
 * @example courseOf([{id: 'calculo', name: 'Cálculo'}], 'calculo').name // 'Cálculo'
 */
function courseOf(courses, courseId) {
  const course = (Array.isArray(courses) ? courses : []).find((entry) => entry && entry.id === courseId);
  if (!course) throw Error(message('err.searchTool.course', {received: describeReceived(courseId)}));
  return course;
}

/**
 * Busca no material da sessão e devolve só o que a próxima chamada de
 * `ler_pdf` precisa: caminho, página e trecho, na ordem do índice.
 * @param {string} runtime pasta de runtime da Mesa
 * @param {{courses: Array<{id: string, name: string, path?: string}>, courseId: string,
 *   freeSessionId?: string, raw: unknown, nowMs?: () => number, pdfText?: (file: string) => Promise<unknown>}} options
 *   `nowMs` e `pdfText` são injeções de teste; no app vêm do relógio e do pdf.js
 * @returns {Promise<{query: string, limit: number, short: boolean, truncated: boolean,
 *   indexing: boolean, hits: Array<{path: string, name: string, page: number, snippet: string}>}>}
 * @example await tutorSearch(runtime, {courses, courseId: 'calculo', raw: {consulta: 'derivada'}})
 */
async function tutorSearch(runtime, {courses, courseId, freeSessionId = '', raw, nowMs, pdfText} = {}) {
  const {query, limit} = searchArgs(raw);
  const course = courseOf(courses, courseId);
  const result = await search.search(runtime, {
    query,
    limit,
    courses: [course],
    scope: {sources: ['pdf'], courses: [course.id], freeSessionId: String(freeSessionId || '')},
    ...(typeof nowMs === 'function' ? {nowMs} : {}),
    ...(typeof pdfText === 'function' ? {pdfText} : {}),
  });
  return {
    query: result.query,
    limit: result.limit,
    short: result.short === true,
    truncated: result.truncated === true,
    indexing: result.index?.incomplete === true,
    hits: result.hits.map((hit) => ({path: hit.path || '', name: hit.fileName || '', page: Math.max(1, hit.page || 0), snippet: hit.snippet || ''})),
  };
}

module.exports = {DEFAULT_HITS, searchArgs, courseOf, tutorSearch};
