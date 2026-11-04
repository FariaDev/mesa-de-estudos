/* Cliente de `calcular`: o avaliador da calculadora da janela, no processo.
   Não usa ponte, rede nem disco. */

/**
 * Avalia a expressão com o modo de ângulo pedido.
 * @param {{expressao?: unknown, graus?: unknown}} args
 * @param {{calculate?: (source: string, degrees?: boolean) => string}} [deps]
 * @returns {Promise<string>}
 * @example await calculateValue({expressao: 'sin(pi/2)'}) // '1'
 */
export async function calculateValue(args, {calculate} = {}) {
  if (!calculate) ({calculate} = await import('../../../calculator.mjs'));
  const source = typeof args?.expressao === 'string' ? args.expressao : '';
  return calculate(source, args?.graus === true);
}
