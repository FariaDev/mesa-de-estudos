// @ts-check
'use strict';

/* Cores da página do celular (#36): o mesmo tema e acento da Mesa, lidos do
   `style.css` para não haver uma segunda tabela de cores que derive dela.
   Só os tokens `--nome:light-dark(claro,escuro)` do `:root` entram. */

const BASE_TOKENS = {bg: 'bg', card: 'surface', fg: 'fg', muted: 'muted', line: 'border'};
const ACCENTS = ['blue', 'violet', 'green', 'orange', 'pink', 'graphite'];
const BAD = {light: '#a3341f', dark: '#f08a72'};

/**
 * Lê do `style.css` os tons claro e escuro de cada token `light-dark(...)`.
 * @param {string} cssText
 * @returns {Record<string, {light: string, dark: string}>}
 * @example readPalette('--bg:light-dark(#efefef,#1f1f1f);').bg // {light:'#efefef', dark:'#1f1f1f'}
 */
function readPalette(cssText) {
  /** @type {Record<string, {light: string, dark: string}>} */
  const out = {};
  for (const match of String(cssText).matchAll(/--([\w-]+):light-dark\(([^,()]+(?:\([^)]*\))?),([^()]+?(?:\([^)]*\))?)\)/g)) {
    if (!(match[1] in out)) out[match[1]] = {light: match[2].trim(), dark: match[3].trim()};
  }
  return out;
}

/**
 * Variáveis da página num dos dois tons.
 * @param {Record<string, {light: string, dark: string}>} palette
 * @param {string} accent
 * @param {'light'|'dark'} tone
 */
function toneVars(palette, accent, tone) {
  const id = ACCENTS.includes(accent) ? accent : 'blue';
  const fill = palette[`acc-${id}`];
  if (!fill) throw Error(`style.css sem --acc-${id}: recebido ${Object.keys(palette).length} tokens, esperado --acc-<acento>:light-dark(...)`);
  const vars = Object.entries(BASE_TOKENS).map(([name, token]) => `--${name}:${palette[token]?.[tone] ?? ''}`);
  /* Grafite no escuro é um preenchimento claro: o texto por cima fica escuro, como no app. */
  const onAccent = id === 'graphite' && tone === 'dark' ? '#181818' : '#ffffff';
  vars.push(`--accent:${fill[tone]}`, `--on-accent:${onAccent}`, `--bad:${BAD[tone]}`);
  return vars.join(';');
}

/**
 * CSS do `:root` da página do celular para o tema e o acento escolhidos na Mesa.
 * Tema `auto` segue o tema do celular; `light`/`dark` fixam o da Mesa.
 * @param {{theme?: string, accent?: string, palette: Record<string, {light: string, dark: string}>}} look
 * @returns {string}
 * @example phoneLookCss({theme:'dark', accent:'green', palette}) // ':root{color-scheme:dark;...--accent:#13865e...}'
 */
function phoneLookCss({theme, accent = 'blue', palette}) {
  if (theme === 'light' || theme === 'dark') return `:root{color-scheme:${theme};${toneVars(palette, accent, theme)}}`;
  return `:root{color-scheme:light dark;${toneVars(palette, accent, 'light')}}`
    + `@media (prefers-color-scheme:dark){:root{${toneVars(palette, accent, 'dark')}}}`;
}

module.exports = {readPalette, phoneLookCss, ACCENTS};
