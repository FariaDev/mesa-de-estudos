// @ts-check
/* A luminária do "pensando" do tutor (#101): o SVG da arte aprovada pelo autor
   (`tutor-pensando.html`), com o braço entrando pelo canto de cima da linha. A
   caixa de 76×28 (a arte a 85%, pedido do autor) fica presa ao canto da cabeça do diário, que corta o resto. As
   cores vêm do CSS (`light-dark`): acento no claro, creme no escuro. */

/**
 * O SVG da luminária do "pensando", decorativo.
 * @returns {string}
 * @example lampMarkMarkup().includes('lamp-mark-arm') // true
 */
export function lampMarkMarkup() {
  return '<span class="lamp-mark" aria-hidden="true"><svg viewBox="0 0 90 33" width="76" height="28" focusable="false">'
    + '<defs><linearGradient id="lamp-mark-beam" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#f2a900"/><stop offset="1" stop-color="#f2a900" stop-opacity="0"/>'
    + '</linearGradient></defs>'
    + '<g transform="translate(15 9) rotate(-38) scale(0.09)">'
    + '<path class="lamp-mark-glow" d="M-92 92L92 92L140 460L-140 460Z" fill="url(#lamp-mark-beam)"/>'
    + '</g>'
    + '<path class="lamp-mark-arm" d="M-3 -3L15 9" fill="none" stroke-width="3.6" stroke-linecap="round"/>'
    + '<g transform="translate(15 9) rotate(-38) scale(0.09)">'
    + '<rect class="lamp-mark-clip" x="-26" y="-48" width="52" height="30" rx="9"/>'
    + '<path class="lamp-mark-dome" d="M-112 82C-108 12 -54 -26 0 -26C54 -26 108 12 112 82Q0 98 -112 82Z" stroke-width="16" stroke-linejoin="round"/>'
    + '</g>'
    + '</svg></span>';
}
