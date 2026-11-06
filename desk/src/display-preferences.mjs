// @ts-check
/* Preferências de leitura da Mesa (#106, #107): tamanho e largura do texto do
   chat e o tom da página escura do PDF. São estado de interface, como o tema e
   o acento: moram no `desk.json`, valem na hora e não passam pelo Salvar das
   Configurações. Os nomes são os únicos valores gravados; os pixels de cada
   degrau ficam no CSS (`style.css`), com o padrão igual ao de antes dos tickets.
   O adaptador do main (`state-adapter.cjs`) repete estas listas para sanear o
   estado; `tests/display-preferences.test.mjs` compara as duas cópias. */

/** Degraus do tamanho do texto, do menor ao maior. `normal` é o padrão. */
export const READING_SIZES = /** @type {const} */ (['small', 'normal', 'large', 'larger']);
/** Degraus da largura da coluna de leitura. `normal` é o padrão (720px). */
export const READING_WIDTHS = /** @type {const} */ (['narrow', 'normal', 'wide']);
/** Tons da página escura do PDF. `invert` é o padrão (#42). */
export const PDF_DARK_STYLES = /** @type {const} */ (['invert', 'soft']);

/**
 * Escolhe um nome válido ou mantém o anterior (e o padrão no fim).
 * @param {readonly string[]} valid
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function choice(valid, value, fallback) {
  return typeof value === 'string' && valid.includes(value) ? value : fallback;
}

/**
 * Normaliza as três escolhas sem tocar no DOM. Campo ausente mantém o corrente;
 * valor desconhecido também, como no núcleo do tema e do acento.
 * @param {{readingSize?: unknown, readingWidth?: unknown, pdfDark?: unknown}} [value]
 * @param {{readingSize?: string, readingWidth?: string, pdfDark?: string}} [current]
 * @returns {{readingSize: string, readingWidth: string, pdfDark: string}}
 * @example normalizeDisplayChoices({readingSize: 'larger'}, {readingSize: 'normal'})
 */
export function normalizeDisplayChoices(value = {}, current = {}) {
  return {
    readingSize: choice(READING_SIZES, value.readingSize, choice(READING_SIZES, current.readingSize, 'normal')),
    readingWidth: choice(READING_WIDTHS, value.readingWidth, choice(READING_WIDTHS, current.readingWidth, 'normal')),
    pdfDark: choice(PDF_DARK_STYLES, value.pdfDark, choice(PDF_DARK_STYLES, current.pdfDark, 'invert')),
  };
}

/**
 * Põe um atributo `data-*` no `<html>` só quando o valor difere do padrão: quem
 * nunca escolheu continua com o DOM e os pixels de antes.
 * @param {HTMLElement} root
 * @param {string} name
 * @param {string} value
 * @param {string} fallback
 */
function paintAttribute(root, name, value, fallback) {
  if (value === fallback) delete root.dataset[name];
  else root.dataset[name] = value;
}

/**
 * Aplica as escolhas no `<html>` e mantém os seletores das Configurações em dia.
 * @param {any} S estado da Mesa
 * @param {{readingSize?: unknown, readingWidth?: unknown, pdfDark?: unknown}} [value]
 * @param {Document} [doc]
 * @returns {{readingSize: string, readingWidth: string, pdfDark: string}} o que valeu
 * @example applyDisplayState(S, {pdfDark: 'soft'})
 */
export function applyDisplayState(S, value = {}, doc = document) {
  const next = normalizeDisplayChoices(value, S);
  S.readingSize = next.readingSize;
  S.readingWidth = next.readingWidth;
  S.pdfDark = next.pdfDark;
  const root = /** @type {HTMLElement} */ (doc.documentElement);
  paintAttribute(root, 'readingSize', next.readingSize, 'normal');
  paintAttribute(root, 'readingWidth', next.readingWidth, 'normal');
  paintAttribute(root, 'pdfDark', next.pdfDark, 'invert');
  const selects = [
    ['reading-size', next.readingSize],
    ['reading-width', next.readingWidth],
    ['pdf-dark', next.pdfDark],
  ];
  for (const [id, chosen] of selects) {
    const select = /** @type {HTMLSelectElement | null} */ (doc.querySelector(`#${id}`));
    if (select) select.value = chosen;
  }
  return next;
}
