// @ts-check
/* Desenha a cerca `plot` como SVG (#60). Determinístico: a mesma entrada dá a
   mesma string em qualquer máquina (sem relógio, sem aleatório, números
   arredondados por `fmt`). Sem rede, sem script, sem `style` além da cor da
   série (`var(--plot-N, #hex)`): a tinta é `currentColor`, então o gráfico
   acompanha o tema do chat e sai preto no papel do PDF. */

import {autoRange, fmt, niceTicks, tickLabel} from './plot-scale.mjs';

/** @typedef {import('./plot-spec.mjs').PlotSpec} PlotSpec */
/** @typedef {import('./plot-spec.mjs').PlotFunction} PlotFunction */
/** @typedef {import('./plot-error.mjs').FigureLanguage} FigureLanguage */

/* Cores de reserva (quando `--plot-N` não existe, como no print do PDF). */
export const SERIES_COLORS = Object.freeze(['#2563eb', '#d9480f', '#0b8a5f', '#a21caf', '#6d28d9', '#a16207']);
const SAMPLES = 240;
const SCREEN_LIMIT = 1e4;

/** @param {unknown} value */
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char] ?? char));

/** @param {number} slot 1..6 @param {'stroke' | 'fill'} property */
const paint = (slot, property) => `style="${property}:var(--plot-${slot},${SERIES_COLORS[slot - 1]})"`;

/** Identificador curto e estável do conteúdo (FNV-1a): dois gráficos na mesma página não dividem o `clipPath`.
 * @param {string} text */
function contentId(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return `plot-${(hash >>> 0).toString(16)}`;
}

/** @param {number} value */
const signed = (value) => fmt(value).replace('-', '\u2212');

/** @param {number} value */
const clampScreen = (value) => Math.max(-SCREEN_LIMIT, Math.min(SCREEN_LIMIT, value));

/** A cor da série `index` (0-based) quando o tutor não escolheu. @param {number} chosen @param {number} index */
const slotOf = (chosen, index) => chosen || (index % SERIES_COLORS.length) + 1;

/**
 * @typedef {{left: number, right: number, top: number, bottom: number, width: number, height: number,
 *   xMin: number, xMax: number, yMin: number, yMax: number, sx: (x: number) => number, sy: (y: number) => number}} Frame
 */

/** @param {PlotSpec} spec @returns {Frame} */
function frameOf(spec) {
  const left = 16 + (spec.yLabel ? 16 : 0) + 30;
  const right = spec.width - 14;
  const top = 12 + (spec.title ? 22 : 0);
  const bottom = spec.height - 26 - (spec.xLabel ? 16 : 0);
  const {min: xMin, max: xMax} = spec.x;
  const {min: yMin, max: yMax} = spec.y ?? yRangeOf(spec);
  return {
    left, right, top, bottom, width: spec.width, height: spec.height, xMin, xMax, yMin, yMax,
    sx: (x) => left + ((x - xMin) / (xMax - xMin)) * (right - left),
    sy: (y) => bottom - ((y - yMin) / (yMax - yMin)) * (bottom - top),
  };
}

/** @param {PlotSpec} spec */
function yRangeOf(spec) {
  const values = spec.points.map((point) => point.y);
  for (const line of spec.lines) if (line.axis === 'y') values.push(line.at);
  for (const entry of spec.functions) {
    for (let index = 0; index <= SAMPLES; index += 1) values.push(entry.curve(spec.x.min + (index / SAMPLES) * (spec.x.max - spec.x.min)));
  }
  return autoRange(values);
}

/** Caminho SVG da função, cortado onde ela não existe ou salta (tan, 1/x…).
 * @param {PlotFunction} entry @param {Frame} frame */
function pathOf(entry, frame) {
  const reach = (frame.bottom - frame.top) * 2;
  let data = '';
  let previous = Number.NaN;
  for (let index = 0; index <= SAMPLES; index += 1) {
    const x = frame.xMin + (index / SAMPLES) * (frame.xMax - frame.xMin);
    const y = entry.curve(x);
    if (!Number.isFinite(y)) {
      previous = Number.NaN;
      continue;
    }
    const screenY = clampScreen(frame.sy(y));
    const jump = Number.isNaN(previous) || Math.abs(screenY - previous) > reach;
    data += `${jump ? 'M' : 'L'}${fmt(frame.sx(x))} ${fmt(screenY)}`;
    previous = screenY;
  }
  return data;
}

/** @param {Frame} frame @param {boolean} grid */
function axesMarkup(frame, grid) {
  const xs = niceTicks(frame.xMin, frame.xMax, Math.max(2, Math.round((frame.right - frame.left) / 70)));
  const ys = niceTicks(frame.yMin, frame.yMax, Math.max(2, Math.round((frame.bottom - frame.top) / 45)));
  const axisY = frame.yMin < 0 && frame.yMax > 0 ? frame.sy(0) : frame.bottom;
  const axisX = frame.xMin < 0 && frame.xMax > 0 ? frame.sx(0) : frame.left;
  const crossing = axisX > frame.left && axisY < frame.bottom;
  const out = [];
  if (grid) {
    for (const tick of xs.ticks) out.push(`<line x1="${fmt(frame.sx(tick))}" y1="${fmt(frame.top)}" x2="${fmt(frame.sx(tick))}" y2="${fmt(frame.bottom)}" stroke="currentColor" stroke-opacity=".12"/>`);
    for (const tick of ys.ticks) out.push(`<line x1="${fmt(frame.left)}" y1="${fmt(frame.sy(tick))}" x2="${fmt(frame.right)}" y2="${fmt(frame.sy(tick))}" stroke="currentColor" stroke-opacity=".12"/>`);
  }
  out.push(`<line x1="${fmt(frame.left)}" y1="${fmt(axisY)}" x2="${fmt(frame.right)}" y2="${fmt(axisY)}" stroke="currentColor" stroke-width="1.2"/>`);
  out.push(`<line x1="${fmt(axisX)}" y1="${fmt(frame.top)}" x2="${fmt(axisX)}" y2="${fmt(frame.bottom)}" stroke="currentColor" stroke-width="1.2"/>`);
  for (const tick of xs.ticks) {
    if (crossing && Math.abs(tick) < xs.step / 1e6) continue;
    out.push(`<text x="${fmt(frame.sx(tick))}" y="${fmt(Math.min(axisY + 14, frame.bottom + 14))}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity=".75">${tickLabel(tick, xs.step)}</text>`);
  }
  for (const tick of ys.ticks) {
    if (crossing && Math.abs(tick) < ys.step / 1e6) continue;
    out.push(`<text x="${fmt(axisX - 5)}" y="${fmt(frame.sy(tick) + 4)}" text-anchor="end" font-size="11" fill="currentColor" fill-opacity=".75">${tickLabel(tick, ys.step)}</text>`);
  }
  return out.join('');
}

/** @param {PlotSpec} spec @param {Frame} frame */
function marksMarkup(spec, frame) {
  const out = [];
  for (const line of spec.lines) {
    const vertical = line.axis === 'x';
    const at = vertical ? frame.sx(line.at) : frame.sy(line.at);
    const [x1, y1, x2, y2] = vertical ? [at, frame.top, at, frame.bottom] : [frame.left, at, frame.right, at];
    out.push(`<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="currentColor" stroke-opacity=".6" stroke-dasharray="5 4"/>`);
    if (line.label) out.push(`<text x="${fmt(vertical ? at + 4 : frame.left + 4)}" y="${fmt(vertical ? frame.top + 11 : at - 4)}" font-size="11" fill="currentColor" fill-opacity=".8">${escapeXml(line.label)}</text>`);
  }
  spec.functions.forEach((entry, index) => {
    const dash = entry.dashed ? ' stroke-dasharray="6 4"' : '';
    out.push(`<path d="${pathOf(entry, frame)}" fill="none" stroke-width="2" stroke-linejoin="round" ${paint(slotOf(entry.color, index), 'stroke')}${dash}/>`);
  });
  return out.join('');
}

/** @param {PlotSpec} spec @param {Frame} frame */
function pointsMarkup(spec, frame) {
  return spec.points.map((point, index) => {
    const x = frame.sx(point.x);
    const y = clampScreen(frame.sy(point.y));
    const dot = `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="4" ${paint(slotOf(point.color, index), 'fill')} stroke="currentColor" stroke-opacity=".35"/>`;
    if (!point.label) return dot;
    const flip = x > frame.right - 60;
    return `${dot}<text x="${fmt(x + (flip ? -7 : 7))}" y="${fmt(y - 7)}" text-anchor="${flip ? 'end' : 'start'}" font-size="11" fill="currentColor">${escapeXml(point.label)}</text>`;
  }).join('');
}

/** @param {PlotSpec} spec @param {Frame} frame */
function legendMarkup(spec, frame) {
  if (!spec.legend) return '';
  const rows = spec.functions.map((entry, index) => ({entry, slot: slotOf(entry.color, index), text: entry.label || entry.source}));
  if (rows.length === 0) return '';
  const widest = Math.max(...rows.map((row) => row.text.length));
  const boxWidth = Math.min(frame.right - frame.left - 8, 34 + widest * 6.2);
  const x = frame.right - boxWidth - 4;
  const items = rows.map((row, index) => {
    const y = frame.top + 14 + index * 16;
    return `<line x1="${fmt(x + 6)}" y1="${fmt(y - 4)}" x2="${fmt(x + 24)}" y2="${fmt(y - 4)}" stroke-width="2" ${paint(row.slot, 'stroke')}/>`
      + `<text x="${fmt(x + 30)}" y="${fmt(y)}" font-size="11" fill="currentColor">${escapeXml(row.text)}</text>`;
  });
  return `<rect x="${fmt(x)}" y="${fmt(frame.top + 2)}" width="${fmt(boxWidth)}" height="${rows.length * 16 + 6}" rx="4" fill="var(--plot-bg,#fff)" fill-opacity=".85" stroke="currentColor" stroke-opacity=".2"/>${items.join('')}`;
}

/** @param {PlotSpec} spec @param {Frame} frame */
function labelsMarkup(spec, frame) {
  const out = [];
  if (spec.title) out.push(`<text x="${fmt(spec.width / 2)}" y="17" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">${escapeXml(spec.title)}</text>`);
  if (spec.xLabel) out.push(`<text x="${fmt((frame.left + frame.right) / 2)}" y="${fmt(spec.height - 6)}" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity=".85">${escapeXml(spec.xLabel)}</text>`);
  if (spec.yLabel) out.push(`<text transform="translate(13 ${fmt((frame.top + frame.bottom) / 2)}) rotate(-90)" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity=".85">${escapeXml(spec.yLabel)}</text>`);
  return out.join('');
}

/**
 * Frase que descreve o gráfico para quem não o vê (`aria-label` e `<title>`).
 * @param {PlotSpec} spec @param {FigureLanguage} [language]
 * @returns {string}
 * @example describeFigure(parsePlot('x: -1..1\nfuncao: x^2')) // 'Gráfico, x de −1 a 1. Funções: x^2.'
 */
export function describeFigure(spec, language = 'pt-BR') {
  const words = language === 'en'
    ? {chart: 'Chart', xFrom: 'x from', to: 'to', functions: 'Functions', points: 'Points', lines: 'Reference lines'}
    : {chart: 'Gráfico', xFrom: 'x de', to: 'a', functions: 'Funções', points: 'Pontos', lines: 'Retas de referência'};
  const parts = [`${spec.title ? `${words.chart}: ${spec.title}` : words.chart}, ${words.xFrom} ${signed(spec.x.min)} ${words.to} ${signed(spec.x.max)}.`];
  if (spec.functions.length) parts.push(`${words.functions}: ${spec.functions.map((entry) => entry.label ? `${entry.label} = ${entry.source}` : entry.source).join('; ')}.`);
  if (spec.points.length) parts.push(`${words.points}: ${spec.points.map((point) => `(${fmt(point.x)}, ${fmt(point.y)})${point.label ? ` ${point.label}` : ''}`).join('; ')}.`);
  if (spec.lines.length) parts.push(`${words.lines}: ${spec.lines.map((line) => `${line.axis}=${fmt(line.at)}`).join('; ')}.`);
  return parts.join(' ');
}

/**
 * O SVG do gráfico descrito em `spec`.
 * @param {PlotSpec} spec saída de `parsePlot`
 * @param {FigureLanguage} [language] idioma da descrição acessível
 * @returns {string} `<svg>` completo, determinístico
 * @example renderPlotSvg(parsePlot('x: -2..2\nfuncao: x^2')).startsWith('<svg') // true
 */
export function renderPlotSvg(spec, language = 'pt-BR') {
  const frame = frameOf(spec);
  const label = escapeXml(describeFigure(spec, language));
  const body = axesMarkup(frame, spec.grid)
    + `<g clip-path="url(#CLIP)">${marksMarkup(spec, frame)}</g>`
    + pointsMarkup(spec, frame) + legendMarkup(spec, frame) + labelsMarkup(spec, frame);
  const clip = contentId(body + label);
  const area = `<clipPath id="${clip}"><rect x="${fmt(frame.left)}" y="${fmt(frame.top)}" width="${fmt(frame.right - frame.left)}" height="${fmt(frame.bottom - frame.top)}"/></clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.width} ${spec.height}" width="${spec.width}" height="${spec.height}" role="img" aria-label="${label}" font-family="inherit">`
    + `<title>${label}</title><defs>${area}</defs>${body.replace('#CLIP', `#${clip}`)}</svg>`;
}
