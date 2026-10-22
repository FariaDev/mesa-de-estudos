// @ts-check
/* A cerca `plot` como bloco HTML (#60): é o que o chat, o PDF e a ferramenta
   de ver a figura põem no lugar do bloco de código. Cerca malformada não some:
   vira um aviso legível com o que veio e o que se esperava. O HTML devolvido
   ainda passa pelo DOMPurify de quem o usa (a mesma guarda de SVG). */

import {PlotError, describePlotError, languageOf} from './plot-error.mjs';
import {parsePlot} from './plot-spec.mjs';
import {renderPlotSvg} from './plot-render.mjs';

/** @typedef {import('./plot-error.mjs').FigureLanguage} FigureLanguage */
/** @typedef {{kind: 'figure', severity: 'warning', code: string, message: string, line?: number}} FigureDiagnostic */

/** @param {unknown} value */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char] ?? char));

/** O idioma da tela, quando há tela; pt-BR em Node puro. @returns {FigureLanguage} */
export function screenLanguage() {
  return languageOf(typeof document === 'undefined' ? '' : document.documentElement.lang);
}

/** @param {PlotError} error @param {FigureLanguage} language */
function warningHtml(error, language) {
  const text = describePlotError(error, language);
  return `<div class="plot-warning" role="note" data-plot-error="${escapeHtml(error.code)}">`
    + `<strong>${escapeHtml(text.title)}</strong>${text.where ? ` <span>${escapeHtml(text.where)}.</span>` : ''}`
    + `<span class="plot-warning-got">${escapeHtml(text.received)}</span>`
    + `<span class="plot-warning-want">${escapeHtml(text.expected)}</span>`
    + `<span>${escapeHtml(text.fix)}</span></div>`;
}

/**
 * Corpo de uma cerca `plot` → bloco HTML da figura, ou o aviso se o formato falhar.
 * @param {string} source texto entre as cercas (já sem escape de HTML)
 * @param {FigureLanguage} [language]
 * @returns {{html: string, svg: string, diagnostic: FigureDiagnostic | null}} `svg` vazio quando houve erro
 * @example plotFigure('x: -2..2\nfuncao: x^2').diagnostic // null
 * @example plotFigure('x: abc').diagnostic.code // 'plot-domain'
 */
export function plotFigure(source, language = screenLanguage()) {
  try {
    const svg = renderPlotSvg(parsePlot(source), language);
    return {html: `<div class="plot-figure" data-figure="plot">${svg}</div>`, svg, diagnostic: null};
  } catch (error) {
    if (!(error instanceof PlotError)) throw error;
    const text = describePlotError(error, language);
    const message = [text.title, text.where, text.received, text.expected].filter(Boolean).join(' ');
    /** @type {FigureDiagnostic} */
    const diagnostic = {kind: 'figure', severity: 'warning', code: `plot-${error.code}`, message, ...(error.detail.line ? {line: error.detail.line} : {})};
    return {html: warningHtml(error, language), svg: '', diagnostic};
  }
}
