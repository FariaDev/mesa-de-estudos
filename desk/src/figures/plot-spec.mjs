// @ts-check
/* Formato da cerca `plot` (#60): o tutor descreve o gráfico em linhas
   `chave: valor` e a Mesa desenha (`plot-render.mjs`). Texto simples de
   propósito — um erro de vírgula num JSON apagaria a figura inteira.

   ```plot
   titulo: Custo de produção (exemplo)
   x: -1..5
   y: -2..10
   eixo-x: unidades
   eixo-y: custo
   funcao: x^2 - 4x + 3 | rotulo=C(x)
   funcao: 2x - 1 | rotulo=reta | tracejado
   ponto: 1, 0 | rotulo=raiz
   linha: x=2
   ```

   Chaves: titulo, x, y, eixo-x, eixo-y, funcao (até 6), ponto (até 40),
   linha (até 6), grade, legenda, largura, altura. Opções depois de `|`:
   `rotulo=…`, `cor=1..6`, `tracejado`. Importável em Node puro. */

import {PlotError} from './plot-error.mjs';
import {compileCurve} from './plot-expr.mjs';

/** @typedef {{min: number, max: number}} Range */
/** @typedef {{curve: (x: number) => number, source: string, label: string, color: number, dashed: boolean}} PlotFunction */
/** @typedef {{x: number, y: number, label: string, color: number}} PlotPoint */
/** @typedef {{axis: 'x' | 'y', at: number, label: string}} PlotLine */
/** @typedef {{title: string, x: Range, y: Range | null, xLabel: string, yLabel: string, functions: PlotFunction[], points: PlotPoint[], lines: PlotLine[], grid: boolean, legend: boolean, width: number, height: number}} PlotSpec */

export const LIMITS = Object.freeze({
  source: 4000, functions: 6, points: 40, lines: 6, label: 60, title: 100,
  width: {min: 240, max: 720, fallback: 480}, height: {min: 120, max: 540}, coordinate: 1e6, colors: 6,
});

const KEYS = /** @type {Record<string, string>} */ ({
  titulo: 'title', title: 'title',
  x: 'x', y: 'y',
  'eixo-x': 'xLabel', eixox: 'xLabel', xlabel: 'xLabel', 'x-label': 'xLabel',
  'eixo-y': 'yLabel', eixoy: 'yLabel', ylabel: 'yLabel', 'y-label': 'yLabel',
  funcao: 'function', 'função': 'function', function: 'function', f: 'function', fn: 'function',
  ponto: 'point', point: 'point',
  linha: 'line', line: 'line', assintota: 'line', 'assíntota': 'line',
  grade: 'grid', grid: 'grid',
  legenda: 'legend', legend: 'legend',
  largura: 'width', width: 'width',
  altura: 'height', height: 'height',
});
export const KEY_NAMES = ['titulo', 'x', 'y', 'eixo-x', 'eixo-y', 'funcao', 'ponto', 'linha', 'grade', 'legenda', 'largura', 'altura'];

const YES = new Set(['sim', 'true', 'yes', 'on', '1']);
const NO = new Set(['nao', 'não', 'false', 'no', 'off', '0']);

/** @param {string} text @param {string} what @param {number} line @param {string} expected */
function number(text, what, line, expected) {
  const value = Number(String(text).trim().replace(/−/g, '-'));
  if (!String(text).trim() || !Number.isFinite(value) || Math.abs(value) > LIMITS.coordinate) {
    throw new PlotError(what, {line, received: String(text).trim(), expected});
  }
  return value;
}

/** @param {string} text @param {string} key @param {number} line @returns {Range} */
function range(text, key, line) {
  const expected = `\`${key}: mín..máx\` com mín < máx (ex.: \`${key}: -3..3\`)`;
  const parts = text.split(/\s*(?:\.\.|…|;|,|\s+até\s+|\s+to\s+)\s*/);
  if (parts.length !== 2) throw new PlotError('domain', {line, received: `${key}: ${text}`, expected});
  const min = number(parts[0], 'domain', line, expected);
  const max = number(parts[1], 'domain', line, expected);
  if (!(min < max)) throw new PlotError('domain', {line, received: `${key}: ${text}`, expected});
  return {min, max};
}

/** @param {string} value */
function flag(value) {
  const word = value.trim().toLowerCase();
  return YES.has(word) ? true : NO.has(word) ? false : null;
}

/** Separa `corpo | opção | opção=valor` em corpo e opções.
 * @param {string} value @param {number} line
 * @returns {{body: string, label: string, color: number, dashed: boolean}} */
function withOptions(value, line) {
  const [body, ...rest] = value.split('|');
  const result = {body: body.trim(), label: '', color: 0, dashed: false};
  for (const piece of rest) {
    const [name, ...tail] = piece.split('=');
    const option = name.trim().toLowerCase();
    const argument = tail.join('=').trim();
    if (option === 'rotulo' || option === 'rótulo' || option === 'label') result.label = argument.slice(0, LIMITS.label);
    else if (option === 'tracejado' || option === 'dashed') result.dashed = true;
    else if (option === 'cor' || option === 'color') result.color = colorIndex(argument, line);
    else throw new PlotError('option', {line, received: piece.trim(), expected: '`rotulo=texto`, `cor=1..6` ou `tracejado`'});
  }
  return result;
}

/** @param {string} text @param {number} line */
function colorIndex(text, line) {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > LIMITS.colors) {
    throw new PlotError('option', {line, received: `cor=${text}`, expected: `\`cor=1\` até \`cor=${LIMITS.colors}\``});
  }
  return value;
}

/** @param {string} value @param {number} line @returns {PlotFunction} */
function parseFunction(value, line) {
  const options = withOptions(value, line);
  const source = options.body.replace(/^[A-Za-z]\w*\s*\(\s*x\s*\)\s*=\s*/, '').replace(/^y\s*=\s*/i, '');
  return {curve: compileCurve(source, line), source, label: options.label, color: options.color, dashed: options.dashed};
}

/** @param {string} value @param {number} line @returns {PlotPoint} */
function parsePoint(value, line) {
  const options = withOptions(value, line);
  const expected = '`ponto: x, y` (ex.: `ponto: 1, 0 | rotulo=A`)';
  const pair = options.body.replace(/^\(|\)$/g, '').split(/\s*[,;]\s*|\s+/).filter(Boolean);
  if (pair.length !== 2) throw new PlotError('point', {line, received: `ponto: ${options.body}`, expected});
  return {x: number(pair[0], 'point', line, expected), y: number(pair[1], 'point', line, expected), label: options.label, color: options.color};
}

/** @param {string} value @param {number} line @returns {PlotLine} */
function parseLine(value, line) {
  const options = withOptions(value, line);
  const match = /^\s*(x|y)\s*=\s*(.+?)\s*$/i.exec(options.body);
  const expected = '`linha: x=2` (reta vertical) ou `linha: y=1` (reta horizontal)';
  if (!match) throw new PlotError('line', {line, received: `linha: ${options.body}`, expected});
  const axis = /** @type {'x' | 'y'} */ (match[1].toLowerCase());
  return {axis, at: number(match[2], 'line', line, expected), label: options.label};
}

/** @param {string} value @param {number} line @param {string} key */
function size(value, line, key) {
  const limits = key === 'width' ? LIMITS.width : LIMITS.height;
  const expected = `\`${key === 'width' ? 'largura' : 'altura'}: ${limits.min}..${limits.max}\` (pixels)`;
  const pixels = number(value, 'size', line, expected);
  if (pixels < limits.min || pixels > limits.max) throw new PlotError('size', {line, received: String(value).trim(), expected});
  return Math.round(pixels);
}

/**
 * Lê o corpo de uma cerca `plot`.
 * @param {string} source texto entre as cercas
 * @returns {PlotSpec}
 * @throws {PlotError} na primeira linha fora do formato
 * @example parsePlot('x: -2..2\nfuncao: x^2').functions.length // 1
 */
export function parsePlot(source) {
  const text = String(source ?? '');
  if (text.length > LIMITS.source) throw new PlotError('too-long', {line: 0, received: `${text.length} caracteres`, expected: `até ${LIMITS.source} caracteres`});
  /** @type {PlotSpec} */
  const spec = {title: '', x: {min: -5, max: 5}, y: null, xLabel: '', yLabel: '', functions: [], points: [], lines: [], grid: true, legend: false, width: LIMITS.width.fallback, height: 0};
  let legendSet = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const split = /^([^:]+?)\s*:\s*(.*)$/.exec(trimmed);
    const name = split ? split[1].trim().toLowerCase() : '';
    const key = Object.hasOwn(KEYS, name) ? KEYS[name] : undefined;
    if (!split || !key) {
      throw new PlotError('unknown-key', {line, received: trimmed.slice(0, 80), expected: `uma linha \`chave: valor\` com chave em ${KEY_NAMES.join(', ')}`});
    }
    const value = split[2].trim();
    if (key === 'title') spec.title = value.slice(0, LIMITS.title);
    else if (key === 'x') spec.x = range(value, 'x', line);
    else if (key === 'y') spec.y = range(value, 'y', line);
    else if (key === 'xLabel') spec.xLabel = value.slice(0, LIMITS.label);
    else if (key === 'yLabel') spec.yLabel = value.slice(0, LIMITS.label);
    else if (key === 'function') addTo(spec.functions, parseFunction(value, line), 'funcao', LIMITS.functions, line);
    else if (key === 'point') addTo(spec.points, parsePoint(value, line), 'ponto', LIMITS.points, line);
    else if (key === 'line') addTo(spec.lines, parseLine(value, line), 'linha', LIMITS.lines, line);
    else if (key === 'width') spec.width = size(value, line, 'width');
    else if (key === 'height') spec.height = size(value, line, 'height');
    else {
      const on = flag(value);
      if (on === null) throw new PlotError('flag', {line, received: `${split[1].trim()}: ${value}`, expected: '`sim` ou `nao`'});
      if (key === 'grid') spec.grid = on;
      else { spec.legend = on; legendSet = true; }
    }
  });
  if (spec.functions.length + spec.points.length + spec.lines.length === 0) {
    throw new PlotError('empty', {line: 0, received: 'nenhuma funcao, ponto ou linha', expected: 'ao menos uma linha `funcao: …`, `ponto: x, y` ou `linha: x=…`'});
  }
  if (!legendSet) spec.legend = spec.functions.filter((entry) => entry.label).length > 1;
  if (!spec.height) spec.height = Math.min(LIMITS.height.max, Math.max(LIMITS.height.min, Math.round(spec.width * 0.625)));
  return spec;
}

/** @template T @param {T[]} list @param {T} item @param {string} key @param {number} limit @param {number} line */
function addTo(list, item, key, limit, line) {
  if (list.length >= limit) throw new PlotError('too-many', {line, received: `a ${limit + 1}ª linha \`${key}\``, expected: `até ${limit} linhas \`${key}\``});
  list.push(item);
}
