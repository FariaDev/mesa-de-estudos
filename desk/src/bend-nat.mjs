// @ts-check
/* Fronteira do `Nat` com os artefatos do núcleo Bend (#49).

   Até o bend 2.0.27 um `Nat` entrava e saía dos artefatos como BigInt; do
   2.0.37 (bendlang/bend@d2aeefc1) em diante é `number`. Cada arquivo tinha o
   seu `nat = (n) => BigInt(...)`; agora a conversão mora só aqui, e
   `tests/bend-nat.test.mjs` reprova `BigInt(` e literal `0n` fora desta casca.

   O artefato aceita um `Nat` de entrada até 2^53 (`nat_in`), mas a soma e a
   multiplicação lançam acima de 2^48-1 (`nat_chk`, "a Nat past the largest
   immediate"). Por isso o teto da Mesa é 2^48-1: com ele, nenhuma conta do
   núcleo estoura por causa do que a Mesa mandou. 2^48 ms são uns 8900 anos;
   contagens, páginas e índices ficam muito longe.

   Sem DOM e sem Electron: o main faz `require` e o renderer faz `import` da
   mesma fonte, como em `error-detail.mjs`. */

import {invalidValue} from './error-detail.mjs';

/** Maior `Nat` que a Mesa manda ao núcleo: 2^48-1. */
export const NAT_MAX = 2 ** 48 - 1;

const NAT_FORMAT = 'inteiro 0..2^48-1';

/**
 * Valor que a própria Mesa produziu (tamanho de lista, índice, `Date.now()`)
 * como `Nat` do núcleo. Recusa o que o BigInt também recusava (fração,
 * negativo, NaN) e o que passa do teto, com o valor recebido no erro.
 * @param {number} value
 * @returns {number}
 * @example toNat(list.length) // 3
 * @example toNat(-1) // lança TypeError: Nat inválido: recebido -1; esperado inteiro 0..2^48-1
 */
export function toNat(value) {
  if (Number.isSafeInteger(value) && value >= 0 && value <= NAT_MAX) return value;
  throw new TypeError(invalidValue('Nat', value, NAT_FORMAT));
}

/**
 * Valor vindo de fora (JSON em disco, IPC, DOM) levado a um `Nat`: trunca,
 * troca o que não é número finito por `min` e satura em `min..NAT_MAX`. Nunca
 * lança: é o `Math.max(0, Math.trunc(Number(x) || 0))` que os hosts repetiam
 * (o `whole` deles também levava o infinito a 0).
 * @param {unknown} value
 * @param {number} [min] piso, como o 1 das páginas
 * @returns {number}
 * @example wholeNat('7.9') // 7
 * @example wholeNat(undefined, 1) // 1
 */
export function wholeNat(value, min = 0) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(NAT_MAX, Math.max(min, n));
}

/**
 * Medida em px (ou outra grandeza contínua) arredondada para o `Nat` mais
 * próximo, com as mesmas regras de `wholeNat`. Era o
 * `BigInt(Math.round(Number(x)))` dos presets e do quadro de atividade.
 * @param {unknown} value
 * @returns {number}
 * @example roundNat(399.6) // 400
 */
export function roundNat(value) {
  return wholeNat(Math.round(Number(value)));
}
