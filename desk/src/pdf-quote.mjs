/* Citar do PDF quando a seleção é fórmula (#70). A camada de texto do pdf.js põe
   cada índice, colchete e traço de fração de uma fonte matemática numa caixa
   própria, fora da ordem de leitura: `lim f(x)→0 sen[f(x)]/f(x) = 1` vira
   retalhos ("f ( x ) ] = 1 … → 0"). Texto assim não se lê no rascunho, então a
   citação vai como recorte da página (imagem), com o arquivo e a página. */

/* Setas, operadores matemáticos e a área de uso privado, onde as fontes de
   fórmula (TeX, MathType) costumam mapear os glifos. */
const MATH_GLYPHS = /[←-⇿∀-⋿⨀-⫿-]/;

/**
 * A seleção parece fórmula: tem glifo matemático ou é feita de retalhos (muitas
 * linhas com até 2 caracteres).
 * @param {string} text texto da seleção, como o `Selection.toString()` devolve
 * @returns {boolean}
 * @example formulaLike('f ( x ) ]\n= 1\n( x ) → 0') // true
 */
export function formulaLike(text) {
  const lines = String(text || '').split('\n').map((line) => line.replace(/\s/g, '')).filter(Boolean);
  if (!lines.length) return false;
  if (MATH_GLYPHS.test(text)) return true;
  const scraps = lines.filter((line) => line.length <= 2).length;
  return lines.length >= 3 && scraps / lines.length >= 0.4;
}

/**
 * Retângulo do recorte em pixels do canvas: a seleção com folga, dentro da página.
 * @param {{left: number, top: number, right: number, bottom: number}} selection retângulo da seleção na tela
 * @param {{left: number, top: number, width: number, height: number}} page retângulo do canvas na tela
 * @param {number} scale pixels do canvas por pixel da tela
 * @param {number} [pad] folga em pixels da tela
 * @returns {{x: number, y: number, width: number, height: number} | null} null se a seleção está fora do canvas
 * @example cropRect({left: 110, top: 220, right: 310, bottom: 260}, {left: 100, top: 200, width: 600, height: 800}, 2, 8) // {x: 4, y: 24, width: 432, height: 112}
 */
export function cropRect(selection, page, scale, pad = 8) {
  const left = Math.max(0, selection.left - page.left - pad);
  const top = Math.max(0, selection.top - page.top - pad);
  const right = Math.min(page.width, selection.right - page.left + pad);
  const bottom = Math.min(page.height, selection.bottom - page.top + pad);
  if (right <= left || bottom <= top) return null;
  return {x: Math.round(left * scale), y: Math.round(top * scale), width: Math.round((right - left) * scale), height: Math.round((bottom - top) * scale)};
}
