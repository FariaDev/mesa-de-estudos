// @ts-check

/* Amostra do medidor a partir de uma leitura de saúde (#58; especificação no
   commit `a794128` da branch t3/opencode-provider). A leitura traz o medidor
   ou não traz. Sem o objeto, a tela apaga o número antigo: uma compactação
   zera a amostra do Claude, e o valor anterior deixaria de ser verdade. */

/** @typedef {{tokens: number, contextWindow: number, percent: number}} MeterUsage */

/**
 * O `contextUsage` de uma resposta do host, ou null quando ela não traz um.
 * @param {unknown} health resposta de `window.desk.health()`
 * @returns {MeterUsage | null}
 * @example meterUsage({ok: true}) // null: quem pinta chama updateMeter(null)
 */
export function meterUsage(health) {
  if (!health || typeof health !== 'object') return null;
  const usage = /** @type {{contextUsage?: unknown}} */ (health).contextUsage;
  if (!usage || typeof usage !== 'object') return null;
  return /** @type {MeterUsage} */ (usage);
}
