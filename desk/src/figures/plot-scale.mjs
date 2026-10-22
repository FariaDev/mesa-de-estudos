// @ts-check
/* Escalas e marcas dos eixos da cerca `plot` (#60): intervalo automático do
   eixo y, marcas "bonitas" e números sem ruído de ponto flutuante. Só
   aritmética, sem DOM — o resultado depende apenas da entrada. */

/**
 * Número com até 2 casas, sem zeros à direita nem "-0" (sai idêntico em toda máquina).
 * @param {number} value
 * @returns {string}
 * @example fmt(0.30000000000000004) // '0.3'
 * @example fmt(-0.001) // '0'
 */
export function fmt(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/**
 * Rótulo de marca: o sinal de menos tipográfico e as casas que o passo pede.
 * @param {number} value @param {number} step
 * @returns {string}
 * @example tickLabel(-1.5, 0.5) // '−1.5'
 */
export function tickLabel(value, step) {
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  const text = (Math.abs(value) < step / 1e6 ? 0 : value).toFixed(decimals);
  return text.startsWith('-') ? `−${text.slice(1)}` : text;
}

/**
 * Marcas igualmente espaçadas num passo 1, 2 ou 5 × 10^k.
 * @param {number} min @param {number} max @param {number} [target] quantidade desejada de marcas
 * @returns {{step: number, ticks: number[]}}
 * @example niceTicks(0, 10, 5) // {step: 2, ticks: [0, 2, 4, 6, 8, 10]}
 */
export function niceTicks(min, max, target = 5) {
  const raw = (max - min) / Math.max(1, target);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const unit = raw / magnitude;
  const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * magnitude;
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  const ticks = [];
  for (let index = first; index <= last; index += 1) ticks.push(Math.round(index * step * 1e9) / 1e9 || 0);
  return {step, ticks};
}

/**
 * Intervalo do eixo y quando o tutor não o fixa: a faixa dos valores finitos
 * com folga. Uma assíntota (valores gigantes) não achata o resto: se a faixa
 * total passa de 20 vezes a dos 90% centrais, vale a dos 90% centrais.
 * @param {number[]} values
 * @returns {{min: number, max: number}}
 * @example autoRange([0, 1, 4, 9]) // {min: -0.54, max: 9.54}
 */
export function autoRange(values) {
  const finite = values.filter((value) => Number.isFinite(value) && Math.abs(value) <= 1e6).sort((a, b) => a - b);
  if (finite.length === 0) return {min: -1, max: 1};
  const at = (share) => finite[Math.min(finite.length - 1, Math.floor(share * (finite.length - 1)))];
  let low = finite[0];
  let high = finite[finite.length - 1];
  const core = at(0.95) - at(0.05);
  if (finite.length > 20 && high - low > 20 * core && core > 0) {
    low = at(0.05);
    high = at(0.95);
  }
  if (high - low < 1e-9) return {min: low - 1, max: high + 1};
  const pad = (high - low) * 0.06;
  return {min: low - pad, max: high + pad};
}
