// @ts-check
'use strict';

/* Quem aparece na página do celular (#66): um do trio ∫ Σ ∇ por estado. O
   desenho vem do mesmo `mascoteMarkup` da Mesa (#64), sem cópia do SVG; o
   movimento é o `trio.css` com os tokens da #63, lidos do `style.css` e do
   `motion.css` como a paleta de `phone-look.cjs`.

   A página tem CSP com nonce (`phone-host.cjs`): atributo `style` no HTML é
   recusado pelo navegador. O desenho traz alguns (tamanho, pivô do lápis,
   destino das faíscas), então eles viram `data-style` e o script da página,
   que tem o nonce, os aplica pelo CSSOM. */

const {mascoteMarkup} = require('./src/mascote.mjs');
const {AMBAR} = require('./src/trio-art.mjs');

/** @typedef {'start'|'sending'|'offline'} PhoneState */

/**
 * Personagem, humor e tamanho de cada estado: ∫ recebe, Σ soma o que chegou,
 * ∇ fica aflito quando a Mesa some.
 * @type {Record<PhoneState, {personagem: string, humor: 'normal'|'pensando'|'aflita', tamanho: number}>}
 */
const PHONE_CAST = {
  start: {personagem: 'integral', humor: 'normal', tamanho: 92},
  sending: {personagem: 'sigma', humor: 'pensando', tamanho: 92},
  offline: {personagem: 'nabla', humor: 'aflita', tamanho: 140},
};

/**
 * Troca `style="…"` por `data-style="…"`, para a CSP não recusar.
 * @param {string} markup
 * @returns {string}
 * @example liftInlineStyles('<g style="a:b">') // '<g data-style="a:b">'
 */
const liftInlineStyles = (markup) => markup.replace(/ style="([^"]*)"/g, ' data-style="$1"');

/**
 * O SVG parado do personagem de um estado, pronto para a página com CSP.
 * @param {PhoneState} state
 * @returns {string}
 * @example phoneCastMarkup('offline').includes('mascote-nabla') // true
 */
function phoneCastMarkup(state) {
  const cast = Object.hasOwn(PHONE_CAST, state) ? PHONE_CAST[state] : null;
  if (!cast) throw new Error(`estado da página do celular desconhecido: ${JSON.stringify(state)}; esperado ${Object.keys(PHONE_CAST).map((id) => `"${id}"`).join(', ')}`);
  return liftInlineStyles(mascoteMarkup(cast));
}

/** Os tokens de duração e curva (`--t-*`, `--ease-*`) do `:root` do style.css. */
function motionTokens(styleCss) {
  const found = String(styleCss).match(/--(?:t|ease)-[\w-]+:[^;]+;/g);
  if (!found) throw new Error('style.css sem tokens de movimento: esperado --t-fast:…; e --ease-out:…; no :root (#63)');
  return found.join('');
}

/** O bloco de movimento reduzido do motion.css, que zera os laços. */
function reducedMotionRule(motionCss) {
  const found = String(motionCss).match(/@media \(prefers-reduced-motion:reduce\)\{\s*:root\{[^}]*\}\s*\}/);
  if (!found) throw new Error('motion.css sem @media (prefers-reduced-motion:reduce){:root{…}}: a página do celular não teria como parar o trio');
  return found[0];
}

/**
 * O CSS fixo da página: tokens de movimento, o âmbar, o trio e o layout.
 * @param {{styleCss: string, motionCss: string, trioCss: string, pageCss: string}} sheets o texto de
 *   `style.css`, `src/motion.css`, `src/trio.css` e `src/phone-page.css`
 * @returns {string}
 * @example phoneCastCss({styleCss, motionCss, trioCss, pageCss}).includes('--t-loop') // true
 */
function phoneCastCss({styleCss, motionCss, trioCss, pageCss}) {
  return `:root{${motionTokens(styleCss)}--amber:${AMBAR}}${reducedMotionRule(motionCss)}\n${trioCss}\n${pageCss}`;
}

module.exports = {PHONE_CAST, phoneCastMarkup, phoneCastCss, liftInlineStyles};
