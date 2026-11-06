// @ts-check
'use strict';

/* Opções visuais do `ler_pdf`: giro, recorte proporcional e ampliação. A
   validação mora aqui, no processo principal, porque a mesma rota serve aos
   três motores e o render é uma janela escondida. Nenhuma opção muda o
   arquivo nem o caminho autorizado: só o PNG gerado na hora (#114). */

const {invalidValue} = require('./src/error-detail.mjs');

const GIRAR_VALUES = [90, 180, 270];
const MIN_AMPLIAR = 1;
const MAX_AMPLIAR = 3;
const EPSILON = 1e-9;

/** @typedef {{x: number, y: number, largura: number, altura: number}} Recorte */
/** @typedef {{girar: number, recorte: Recorte|null, ampliar: number, visual: boolean}} PageView */

/**
 * Uma fração do recorte, de 0 a 1, com o valor recebido no erro.
 * @param {'x'|'y'|'largura'|'altura'} field
 * @param {unknown} value
 * @returns {number}
 */
function fractionOf(field, value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw Error(invalidValue(`recorte.${field}`, value, 'número de 0 a 1'));
  }
  return number;
}

/**
 * O retângulo do recorte em proporção da página, depois do giro.
 * @param {unknown} raw
 * @returns {Recorte}
 * @example cropOf({x: 0, y: 0, largura: 0.5, altura: 0.25}) // {x: 0, y: 0, largura: 0.5, altura: 0.25}
 */
function cropOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw Error(invalidValue('recorte', raw, '{x, y, largura, altura} com números de 0 a 1'));
  }
  const values = /** @type {Record<string, unknown>} */ (raw);
  const recorte = {
    x: fractionOf('x', values.x),
    y: fractionOf('y', values.y),
    largura: fractionOf('largura', values.largura),
    altura: fractionOf('altura', values.altura),
  };
  if (recorte.largura === 0) throw Error(invalidValue('recorte.largura', values.largura, 'número maior que 0 e até 1'));
  if (recorte.altura === 0) throw Error(invalidValue('recorte.altura', values.altura, 'número maior que 0 e até 1'));
  if (recorte.x + recorte.largura > 1 + EPSILON) {
    throw Error(invalidValue('recorte (x + largura)', recorte.x + recorte.largura, 'até 1'));
  }
  if (recorte.y + recorte.altura > 1 + EPSILON) {
    throw Error(invalidValue('recorte (y + altura)', recorte.y + recorte.altura, 'até 1'));
  }
  return recorte;
}

/**
 * Normaliza `girar`, `recorte` e `ampliar` para o render. Opção visual junto
 * de `imagem: "nao"` é contradição: a imagem é justamente o que se pediu.
 * @param {{girar?: unknown, recorte?: unknown, ampliar?: unknown, imagem?: unknown}} [options]
 * @returns {PageView}
 * @example normalizePageView({girar: 90, recorte: {x: 0, y: 0, largura: 0.5, altura: 0.5}})
 */
function normalizePageView({girar, recorte, ampliar, imagem} = {}) {
  const rotation = girar == null ? 0 : Number(girar);
  if (girar != null && !GIRAR_VALUES.includes(rotation)) {
    throw Error(invalidValue('girar', girar, '90, 180 ou 270'));
  }
  const zoom = ampliar == null ? 1 : Number(ampliar);
  if (ampliar != null && (!Number.isFinite(zoom) || zoom < MIN_AMPLIAR || zoom > MAX_AMPLIAR)) {
    throw Error(invalidValue('ampliar', ampliar, `número de ${MIN_AMPLIAR} a ${MAX_AMPLIAR}`));
  }
  const crop = recorte == null ? null : cropOf(recorte);
  const visual = rotation !== 0 || crop !== null || zoom !== 1;
  if (visual && imagem === 'nao') {
    throw Error('imagem "nao" não combina com girar, recorte ou ampliar: a imagem é o que se quer ver. Use imagem "sim" ou "auto".');
  }
  return {girar: rotation, recorte: crop, ampliar: zoom, visual};
}

module.exports = {normalizePageView, cropOf, GIRAR_VALUES, MIN_AMPLIAR, MAX_AMPLIAR};
