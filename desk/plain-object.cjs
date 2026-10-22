'use strict';

/* Uma fonte só para o teste de objeto simples (#43 fase 2): vinte módulos do
   main tinham a mesma linha copiada. Arrays e null ficam de fora. */

/**
 * Diz se o valor é um objeto simples (não null, não array).
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 * @example isPlainObject({a: 1}) // true; isPlainObject([1]) // false
 */
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

module.exports = {isPlainObject};
