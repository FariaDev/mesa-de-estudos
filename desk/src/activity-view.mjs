/* Ponte JS do núcleo do quadro (`core/activityview.bend`, #42): converte fatos
   do host para o Bend e as listas do Bend para JS. Usada pelo renderer
   (`src/activity.mjs`) e pelos hosts CJS (`activity-runtime.cjs`,
   `activity-preview.cjs`) por `require` de ESM síncrono. Nenhuma regra mora
   aqui: tipo, controles, altura, tokens e textos são do núcleo. */
import core from './generated/activityview.core.js';
import {text} from './ui-text.mjs';
import {roundNat} from './bend-nat.mjs';

const list = (value) => {
  const out = [];
  for (let cell = value; cell && cell.$ === 'Con'; cell = cell.tail) out.push(cell.head);
  return out;
};


export const kindOf = (raw) => core.kindOf(String(raw ?? ''));
export const isViz = (raw) => core.isViz(String(raw ?? ''));
export const showsBring = (raw) => core.showsBring(String(raw ?? ''));
export const controlIds = (raw) => list(core.controlIds(String(raw ?? '')));
export const kindLabel = (raw) => text(core.kindLabel(String(raw ?? '')));
export const frameTitle = (raw, title) => text(core.frameTitle(String(raw ?? ''), String(title ?? '')));

/* Os rótulos são mensagens do núcleo; cada leitura traduz no idioma de agora
   (uma constante congelada na carga ficaria no idioma antigo). */
const labelOf = (read) => ({get: () => text(read()), enumerable: true});
export const TEXT = Object.freeze(Object.defineProperties({}, {
  fullscreen: labelOf(core.fullscreenLabel),
  exitFullscreen: labelOf(core.exitFullscreenLabel),
  bring: labelOf(core.bringLabel),
  bringDone: labelOf(core.bringDone),
  description: labelOf(core.descriptionLabel),
  restart: labelOf(core.restartLabel),
  stop: labelOf(core.stopLabel),
  open: labelOf(core.openLabel),
}));

export const HEIGHT_MIN = Number(core.heightMin());
export const HEIGHT_MAX = Number(core.heightMax());
export const clampHeight = (value) => Number(core.clampHeight(roundNat(value)));
export const measureWidths = () => list(core.measureWidths()).map(Number);

/* Pares `[largura, altura]` (do store) → altura com que o quadro nasce na
   largura da coluna; 0 = sem medição. */
export function initialHeight(pairs, width) {
  const clean = Array.isArray(pairs) ? pairs.filter((pair) => Array.isArray(pair) && pair.length === 2) : [];
  const bend = clean.reduceRight((tail, [w, h]) => ({$: 'Con', head: {$: 'HeightPair', width: roundNat(w), height: roundNat(h)}, tail}), {$: 'Nil'});
  return Number(core.initialHeight(bend, roundNat(width)));
}

export const ACCENTS = list(core.accentIds());
export const accentOf = (raw) => core.accentOf(String(raw ?? ''));

/* Tokens do quadro para um tema resolvido (`light`/`dark`) e o acento. */
export function themeTokens(theme, accent) {
  const out = {};
  for (const token of list(core.themeTokens(theme === 'dark' ? 'dark' : 'light', accentOf(accent)))) out[token.name] = token.value;
  return out;
}

export const rootCss = (theme, accent) => core.rootCss(theme === 'dark' ? 'dark' : 'light', accentOf(accent));

/* O documento nasce pintado: tema fixo usa a regra dele; `system` segue o
   sistema por media query até o host mandar o tema resolvido. */
export function documentThemeCss(theme, accent) {
  if (theme === 'dark' || theme === 'light') return rootCss(theme, accent);
  return `${rootCss('light', accent)}@media (prefers-color-scheme:dark){${rootCss('dark', accent)}}`;
}
