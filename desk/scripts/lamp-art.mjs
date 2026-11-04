// @ts-check
/* A luminária da Mesa (#101). A arte grande é a PNG-mestra do Lucas; para
   16 px sobra um desenho simplificado, sem mesa nem gavetas.
   Este módulo desenha essa variante em SVG. Os seis tons são os mesmos
   da tabela de acento dos ícones da #100, para a folha acompanhar o acento. */

/** Os acentos e os dois tons da folha de cada um. */
export const LAMP_ACCENTS = Object.freeze({
  blue: {topo: '#4f74d7', base: '#1d3ba8'},
  violet: {topo: '#8864e5', base: '#5b20b7'},
  green: {topo: '#549778', base: '#0b6746'},
  orange: {topo: '#d46f4f', base: '#a33508'},
  pink: {topo: '#d46086', base: '#a21e56'},
  graphite: {topo: '#505053', base: '#1f1f22'},
});

const CREAM = '#fbf8f1';
const SHADE_EDGE = '#d9d1bf';
const BULB = '#ffd978';

/**
 * Variante de 16 px: sem grade e com cúpula, braço e base mais grossos para
 * continuar sendo uma luminária no tamanho mínimo (#101).
 * @param {string} accent
 * @returns {string}
 * @example tinyLampSvg('blue').includes('lamp-tiny-sheet') // true
 */
export function tinyLampSvg(accent) {
  const colors = LAMP_ACCENTS[/** @type {keyof typeof LAMP_ACCENTS} */ (accent)];
  if (!colors) throw new Error(`Acento da luminária desconhecido: ${JSON.stringify(accent)}; esperado um de ${Object.keys(LAMP_ACCENTS).join(', ')}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
<linearGradient id="lamp-tiny-sheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors.topo}"/><stop offset="1" stop-color="${colors.base}"/></linearGradient>
<linearGradient id="lamp-tiny-shade" x1="0" y1="0" x2="1" y2="0"><stop offset=".3" stop-color="${CREAM}"/><stop offset="1" stop-color="${SHADE_EDGE}"/></linearGradient>
<linearGradient id="lamp-tiny-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c9" stop-opacity=".85"/><stop offset="1" stop-color="#fff1c9" stop-opacity="0"/></linearGradient>
</defs>
<rect x="80" y="80" width="864" height="864" rx="132" fill="url(#lamp-tiny-sheet)"/>
<path d="M512 610L330 920H694Z" fill="url(#lamp-tiny-glow)"/>
<path d="M250 862L430 500" stroke="${CREAM}" stroke-width="92" stroke-linecap="round"/>
<rect x="220" y="846" width="584" height="76" rx="38" fill="${CREAM}"/>
<g transform="translate(540 470) rotate(-8)">
<path d="M-220 60C-210 -50 -100 -130 0 -130C100 -130 210 -50 220 60Q0 90 -220 60Z" fill="url(#lamp-tiny-shade)" stroke="url(#lamp-tiny-shade)" stroke-width="30" stroke-linejoin="round"/>
<ellipse cx="0" cy="72" rx="160" ry="26" fill="${BULB}"/>
</g>
</svg>
`;
}
