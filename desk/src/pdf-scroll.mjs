// @ts-check
/* Página sob o centro do leitor (#desempenho): as páginas são empilhadas em
   ordem, então a mais próxima do centro sai de uma busca binária. Antes, cada
   evento de rolagem varria TODAS as páginas (600 leituras de `offsetTop` num
   PDF de 600 páginas); agora são ~10. A escolha é a mesma da varredura antiga,
   inclusive no empate (fica a página de cima: só troca com distância menor). */

/**
 * Índice (0-based) da página cujo centro está mais perto de `center`.
 * @param {Array<{offsetTop: number, offsetHeight: number}>} pages
 * @param {number} center
 * @returns {number} `0` sem páginas
 * @example nearestPageIndex([{offsetTop: 0, offsetHeight: 100}], 40) // 0
 */
export function nearestPageIndex(pages, center) {
  if (!pages.length) return 0;
  const middle = (index) => pages[index].offsetTop + pages[index].offsetHeight / 2;
  let low = 0;
  let high = pages.length - 1;
  while (low < high) {
    const half = (low + high) >> 1;
    if (middle(half) < center) low = half + 1;
    else high = half;
  }
  if (low > 0) {
    const before = middle(low - 1);
    const current = middle(low);
    if (Math.abs(center - before) <= Math.abs(center - current)) return low - 1;
  }
  return low;
}
