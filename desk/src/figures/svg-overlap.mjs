// @ts-check
/* Rótulo em cima de rótulo ou de traço, medido depois de desenhar (#60).
   A conta é pura: caixas e segmentos. A página de ver_figura lê o getBBox
   de cada `<text>` e passa os cantos pela CTM da tela, para um grupo
   transformado comparar no mesmo espaço. Não empurramos o texto: a caixa
   não diz o lado livre, e um deslocamento corta no viewBox ou cobre outro
   rótulo. O aviso volta no resumo da ferramenta para o tutor corrigir. */

/** @typedef {{x: number, y: number, width: number, height: number}} Box */
/** @typedef {{x1: number, y1: number, x2: number, y2: number}} Segment */
/** @typedef {{label?: string, box: Box, fontSize?: number|null}} TextMark */
/** @typedef {{a: number, b: number, c: number, d: number, e: number, f: number}} Matrix */
/** Nó de SVG só com o que a medida lê. O DOM real tem o resto.
 * @typedef {{localName?: string, textContent?: string|null, getBBox?: () => Box, getScreenCTM?: () => Matrix|null, getAttribute?: (name: string) => string|null, ownerDocument?: {defaultView?: {getComputedStyle?: (element: object) => {fontSize?: string}}}, getTotalLength?: () => number, getPointAtLength?: (distance: number) => {x: number, y: number}, points?: {length: number, getItem?: (index: number) => {x: number, y: number}}}} SvgNode */

const MARKS = new Set(['line', 'polyline', 'polygon', 'path', 'rect']);
const WARN_LIMIT = 8;

/** @param {number} x @param {number} y @param {Matrix|null} ctm @returns {[number, number]} */
function mapPoint(x, y, ctm) {
  if (!ctm) return [x, y];
  return [ctm.a * x + ctm.c * y + ctm.e, ctm.b * x + ctm.d * y + ctm.f];
}

/**
 * Caixa eixo-alinhada de um getBBox, já no espaço da CTM (ou no local, sem CTM).
 * @param {Box} box
 * @param {Matrix|null} ctm
 * @returns {Box}
 * @example aabbFromBBox({x: 0, y: 0, width: 10, height: 4}, {a: 2, b: 0, c: 0, d: 2, e: 5, f: 1}) // {x: 5, y: 1, width: 20, height: 8}
 */
export function aabbFromBBox(box, ctm) {
  const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
  const points = corners.map(([x, y]) => mapPoint(x, y, ctm));
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY};
}

/**
 * getBBox do elemento, no espaço da tela quando há CTM.
 * @param {{getBBox?: () => Box, getScreenCTM?: () => Matrix|null}} element
 * @returns {Box|null}
 * @example boxOf({getBBox: () => ({x: 1, y: 2, width: 3, height: 4}), getScreenCTM: () => null}) // {x: 1, y: 2, width: 3, height: 4}
 */
export function boxOf(element) {
  if (typeof element.getBBox !== 'function') return null;
  const raw = element.getBBox();
  if (!raw || !Number.isFinite(raw.width) || raw.width < 0 || !Number.isFinite(raw.height)) return null;
  const ctm = typeof element.getScreenCTM === 'function' ? element.getScreenCTM() : null;
  return aabbFromBBox(raw, ctm);
}

/** @param {number} px @param {number} py @param {number} left @param {number} top @param {number} right @param {number} bottom */
function pointInRect(px, py, left, top, right, bottom) {
  return px >= left && px <= right && py >= top && py <= bottom;
}

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} cx @param {number} cy */
function cross(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} x3 @param {number} y3 @param {number} x4 @param {number} y4 */
function properCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = cross(x3, y3, x4, y4, x1, y1);
  const d2 = cross(x3, y3, x4, y4, x2, y2);
  const d3 = cross(x1, y1, x2, y2, x3, y3);
  const d4 = cross(x1, y1, x2, y2, x4, y4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * O segmento corta a caixa, ou passa a até `pad` unidades dela.
 * @param {Segment} segment
 * @param {Box} box
 * @param {number} [pad]
 * @returns {boolean}
 * @example segmentHitsBox({x1: 0, y1: 5, x2: 20, y2: 5}, {x: 4, y: 0, width: 6, height: 8}, 0) // true
 */
export function segmentHitsBox(segment, box, pad = 0) {
  const left = box.x - pad;
  const right = box.x + box.width + pad;
  const top = box.y - pad;
  const bottom = box.y + box.height + pad;
  const {x1, y1, x2, y2} = segment;
  if (pointInRect(x1, y1, left, top, right, bottom) || pointInRect(x2, y2, left, top, right, bottom)) return true;
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]];
  for (let index = 0; index < 4; index += 1) {
    const [ax, ay] = corners[index];
    const [bx, by] = corners[(index + 1) % 4];
    if (properCross(x1, y1, x2, y2, ax, ay, bx, by)) return true;
  }
  return false;
}

/**
 * As duas caixas se sobrepõem. `gap` amplia as duas: 0 é interseção real.
 * @param {Box} a
 * @param {Box} b
 * @param {number} [gap]
 * @returns {boolean}
 * @example boxesOverlap({x: 0, y: 0, width: 10, height: 10}, {x: 9, y: 9, width: 4, height: 4}, 0) // true
 */
export function boxesOverlap(a, b, gap = 0) {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

/** @param {string|undefined} label */
function quote(label) {
  const text = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return (text || 'texto').replaceAll('"', "'");
}

/** @param {Box} box @param {Box} view */
function clipped(box, view) {
  const width = Math.min(box.x + box.width, view.x + view.width) - Math.max(box.x, view.x);
  const height = Math.min(box.y + box.height, view.y + view.height) - Math.max(box.y, view.y);
  const inside = Math.max(0, width) * Math.max(0, height);
  const area = box.width * box.height;
  return area > 0 && inside / area < 0.6;
}

/**
 * Avisos de rótulo encostado, fonte miúda ou texto fora do viewBox.
 * @param {{texts?: TextMark[], segments?: Segment[], view?: Box|null, minFont?: number, limit?: number}} geometry
 * @returns {string[]}
 * @example overlapWarnings({texts: [{label: 'A', box: {x: 0, y: 0, width: 8, height: 8}}, {label: 'B', box: {x: 4, y: 2, width: 8, height: 8}}]}) // ['O rótulo "A" encosta no rótulo "B".']
 */
export function overlapWarnings({texts = [], segments = [], view = null, minFont = 12, limit = WARN_LIMIT} = {}) {
  const notes = [];
  const push = (note) => {
    if (notes.length < limit && !notes.includes(note)) notes.push(note);
  };
  for (let i = 0; i < texts.length; i += 1) {
    const text = texts[i];
    if (view && clipped(text.box, view)) push(`O rótulo "${quote(text.label)}" sai do viewBox. Aumente a folga do viewBox.`);
    if (Number.isFinite(text.fontSize) && text.fontSize < minFont) push(`O rótulo "${quote(text.label)}" está com fonte de ${Math.round(text.fontSize)}px; o mínimo é ${minFont}px.`);
    for (let j = i + 1; j < texts.length; j += 1) {
      if (boxesOverlap(text.box, texts[j].box, 0)) push(`O rótulo "${quote(text.label)}" encosta no rótulo "${quote(texts[j].label)}".`);
    }
    if (segments.some((segment) => segmentHitsBox(segment, text.box, 1))) push(`O rótulo "${quote(text.label)}" cruza um traço.`);
  }
  return notes;
}

/** @param {{getAttribute?: (name: string) => string|null, localName?: string}} element @param {string} name */
function attr(element, name) {
  return String(element.getAttribute?.(name) || '').trim().toLowerCase();
}

/** Traço explícito, preenchimento explícito, ou retângulo/polígono (preenchidos por omissão no SVG).
 * @param {{getAttribute?: (name: string) => string|null, localName?: string}} element */
function drawn(element) {
  const stroke = attr(element, 'stroke');
  const fill = attr(element, 'fill');
  if (stroke && stroke !== 'none') return true;
  if (fill && fill !== 'none') return true;
  const name = element.localName;
  return (name === 'rect' || name === 'polygon' || name === 'path') && fill !== 'none';
}

/** @param {{getAttribute?: (name: string) => string|null, points?: {length: number, getItem?: (i: number) => {x: number, y: number}}}} element */
function pointPairs(element) {
  if (element.points && typeof element.points.length === 'number') {
    const pairs = [];
    for (let index = 0; index < element.points.length; index += 1) {
      const point = element.points.getItem ? element.points.getItem(index) : element.points[index];
      pairs.push([point.x, point.y]);
    }
    return pairs;
  }
  const numbers = String(element.getAttribute?.('points') || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const pairs = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) pairs.push([numbers[index], numbers[index + 1]]);
  return pairs;
}

/** @param {Array<[number, number]>} pairs @param {Matrix|null} ctm @param {boolean} close @returns {Segment[]} */
function joinPairs(pairs, ctm, close) {
  const points = pairs.map(([x, y]) => mapPoint(x, y, ctm));
  const segments = [];
  for (let index = 1; index < points.length; index += 1) {
    segments.push({x1: points[index - 1][0], y1: points[index - 1][1], x2: points[index][0], y2: points[index][1]});
  }
  if (close && points.length > 2) segments.push({x1: points.at(-1)[0], y1: points.at(-1)[1], x2: points[0][0], y2: points[0][1]});
  return segments;
}

/** @param {{getTotalLength?: () => number, getPointAtLength?: (t: number) => {x: number, y: number}, getScreenCTM?: () => Matrix|null}} element */
function pathSegments(element) {
  if (typeof element.getTotalLength !== 'function' || typeof element.getPointAtLength !== 'function') return [];
  let length = 0;
  try { length = element.getTotalLength(); } catch { return []; }
  if (!Number.isFinite(length) || length <= 0) return [];
  const steps = Math.min(24, Math.max(1, Math.ceil(length / 12)));
  const ctm = typeof element.getScreenCTM === 'function' ? element.getScreenCTM() : null;
  const at = (distance) => {
    const point = element.getPointAtLength(Math.min(length, distance));
    return mapPoint(point.x, point.y, ctm);
  };
  const segments = [];
  let previous = at(0);
  for (let step = 1; step <= steps; step += 1) {
    const next = at((length * step) / steps);
    segments.push({x1: previous[0], y1: previous[1], x2: next[0], y2: next[1]});
    previous = next;
  }
  return segments;
}

/**
 * Segmentos visíveis de um traço (linha, polígono, retângulo ou caminho).
 * @param {{localName?: string, getAttribute?: (name: string) => string|null, getBBox?: () => Box, getScreenCTM?: () => Matrix|null, getTotalLength?: () => number, getPointAtLength?: (t: number) => {x: number, y: number}}} element
 * @returns {Segment[]}
 * @example segmentsOf({localName: 'line', getAttribute: (name) => ({x1: '0', y1: '0', x2: '4', y2: '0', stroke: 'currentColor'})[name], getScreenCTM: () => null}) // [{x1: 0, y1: 0, x2: 4, y2: 0}]
 */
export function segmentsOf(element) {
  if (!MARKS.has(element.localName || '') || !drawn(element)) return [];
  const ctm = typeof element.getScreenCTM === 'function' ? element.getScreenCTM() : null;
  if (element.localName === 'line') {
    const n = (name) => Number(element.getAttribute?.(name));
    const [x1, y1] = mapPoint(n('x1'), n('y1'), ctm);
    const [x2, y2] = mapPoint(n('x2'), n('y2'), ctm);
    return [{x1, y1, x2, y2}];
  }
  if (element.localName === 'polyline' || element.localName === 'polygon') return joinPairs(pointPairs(element), ctm, element.localName === 'polygon');
  if (element.localName === 'path') return pathSegments(element);
  const raw = element.getBBox?.();
  if (!raw) return [];
  return joinPairs([[raw.x, raw.y], [raw.x + raw.width, raw.y], [raw.x + raw.width, raw.y + raw.height], [raw.x, raw.y + raw.height]], ctm, true);
}

/** Tamanho em px: o computado, senão o atributo `font-size`. Null se não houver número.
 * @param {{ownerDocument?: {defaultView?: {getComputedStyle?: (element: object) => {fontSize?: string}}}, getAttribute?: (name: string) => string|null}} element
 * @returns {number|null}
 * @example fontPx({getAttribute: () => '12px', ownerDocument: {}}) // 12
 */
export function fontPx(element) {
  const computed = element.ownerDocument?.defaultView?.getComputedStyle?.(element)?.fontSize;
  const parsed = parseFloat(computed || element.getAttribute?.('font-size') || '');
  return Number.isFinite(parsed) ? parsed : null;
}

/** @param {{getBoundingClientRect?: () => Box}} svg @returns {Box|null} */
function viewOf(svg) {
  const rect = svg.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(rect.width) || rect.width <= 0 || rect.height <= 0) return null;
  return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
}

/**
 * Avisos de um SVG já desenhado. A cerca `plot` fica de fora: os rótulos dela
 * são da Mesa, e o tutor não move tick por tick.
 * @param {{closest?: (selector: string) => unknown, querySelectorAll?: (selector: string) => Iterable<SvgNode>, getBoundingClientRect?: () => Box}} svg
 * @returns {string[]}
 * @example overlapReport({closest: () => ({}), querySelectorAll: () => []}) // []
 */
export function overlapReport(svg) {
  if (svg.closest?.('.plot-figure')) return [];
  const texts = [...(svg.querySelectorAll?.('text') || [])].flatMap((element) => {
    const box = boxOf(element);
    if (!box || box.width <= 0 || box.height <= 0) return [];
    return [{label: element.textContent, box, fontSize: fontPx(element)}];
  });
  const segments = [...(svg.querySelectorAll?.('line,polyline,polygon,path,rect') || [])].flatMap((element) => segmentsOf(element));
  return overlapWarnings({texts, segments, view: viewOf(svg)});
}
