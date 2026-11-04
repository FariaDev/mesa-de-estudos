// @ts-check
/* Cerca `svg`/`xml`/`html` que o modelo escreveu em vez do SVG inline (#release
   OpenCode): vira a MESMA figura, pelo mesmo DOMPurify e pela mesma guarda de
   SVG. Só passa o corpo inteiro que é um único `<svg>…</svg>`; o resto continua
   código, inclusive o que passa de MAX_SVG_CHARS. Linha em branco no meio não
   fecha a figura — o corpo é lido até a cerca. */
import {MAX_SVG_CHARS} from '../extensions/mesa-figure/guide.mjs';

const FENCE_LANGS = new Set(['svg', 'xml', 'html']);
const SINGLE_SVG = /^\s*<svg\b[\s\S]*<\/svg>\s*$/i;

/**
 * O HTML da figura para uma cerca, ou `null` para deixar o bloco como código.
 * @param {string} source corpo já sem escape de HTML
 * @param {string} lang linguagem da cerca (`svg`, `xml` ou `html`)
 * @returns {{html: string} | null}
 * @example svgFence('<svg viewBox="0 0 10 10"><rect/></svg>', 'svg')?.html.startsWith('<div class="figure"') // true
 * @example svgFence('<svg>…</svg>\n<script>…</script>', 'svg') // null
 */
export function svgFence(source, lang) {
  const language = String(lang || '').toLowerCase();
  if (!FENCE_LANGS.has(language)) return null;
  const text = String(source || '').trim();
  if (!text || text.length > MAX_SVG_CHARS || !SINGLE_SVG.test(text)) return null;
  if ((text.match(/<svg\b/gi) || []).length !== 1) return null;
  return {html: `<div class="figure" data-figure="svg">${text}</div>`};
}
