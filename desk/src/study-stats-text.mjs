// @ts-check
/* As frases da tela de Estatísticas ("3 h 20 min de estudo em 6 sessões",
   "139 mil tokens lidos"). Antes moravam em `core/studystats.bend`, mas são
   apresentação, não invariante de domínio: o Bend ficou com a conta (período,
   atividade, tokens) e com a duração/dia da semana, e a frase sai daqui, do
   catálogo (ADR 0001, #41 fase 3). */
import statsCore from './generated/studystats.core.js';
import {wholeNat} from './bend-nat.mjs';

/** @typedef {(key: string, args?: Record<string, string | number>) => string} Translate */
/** @typedef {{t: Translate, text: (value: string) => string, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string}} StatsTextDeps */
/** @typedef {{available?: boolean, count?: number}} TokenReading */

const FIRST_MILLION_ROUNDED = 999500;
const NUMBER_JOINER = ' · ';

/** Contagem para ler, não para auditar: 139 mil, 1,4 milhão.
 * @param {number} value @param {StatsTextDeps} deps
 * @example humanCount(139400, deps) // "139 mil" (pt-BR), "139K" (en) */
export function humanCount(value, deps) {
  const n = Math.max(0, Math.trunc(Number(value) || 0));
  if (n < 1000) return deps.formatNumber(n);
  if (n < FIRST_MILLION_ROUNDED) return deps.t('stats.count.thousand', {amount: deps.formatNumber(Math.floor((n + 500) / 1000))});
  const tenths = Math.floor((n + 50000) / 100000);
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10 === 0 ? 0 : 1;
  const amount = deps.formatNumber(tenths / 10, {minimumFractionDigits: fraction, maximumFractionDigits: fraction});
  return deps.t('stats.count.million', {amount, count: whole});
}

/** @param {TokenReading | undefined} reading @param {string} key @param {StatsTextDeps} deps */
function usagePart(reading, key, deps) {
  if (!reading?.available) return '';
  return deps.t(key, {amount: humanCount(Number(reading.count), deps)});
}

/** Cache que o motor não informa some do texto (não vira zero).
 * @param {{input?: TokenReading, output?: TokenReading, cache?: TokenReading}} usage @param {StatsTextDeps} deps */
export function usageLine(usage, deps) {
  const parts = [
    usagePart(usage.input, 'stats.usage.read', deps),
    usagePart(usage.output, 'stats.usage.written', deps),
    usagePart(usage.cache, 'stats.usage.cache', deps),
  ].filter(Boolean);
  return parts.length ? parts.join(NUMBER_JOINER) : deps.t('stats.usage.none');
}

/** A frase do período: o tempo e, se houve sessão fechada, quantas. Sem tempo
 * e com o cronômetro pausado pelo aluno, diz que a pausa é o motivo (#70).
 * @param {number} seconds @param {number} sessions @param {StatsTextDeps} deps @param {boolean} [held]
 * @example headline(0, 0, deps, true) // 'Nada contado: o cronômetro está pausado'
 */
export function headline(seconds, sessions, deps, held = false) {
  if (!(seconds > 0)) return deps.t(held ? 'stats.headline.held' : 'stats.headline.none');
  const duration = deps.text(statsCore.durationLabel(wholeNat(seconds)));
  if (!(sessions > 0)) return deps.t('stats.headline.time', {duration});
  return deps.t('stats.headline.timeSessions', {duration, count: sessions});
}

/** @param {number} prompts @param {StatsTextDeps} deps */
function promptsPhrase(prompts, deps) {
  return prompts > 0 ? deps.t('stats.prompts', {count: prompts}) : deps.t('stats.prompts.none');
}

/** Perguntas ao tutor e, se há um dia mais cheio, qual foi.
 * @param {number} prompts @param {string} dayName @param {number} minutes @param {StatsTextDeps} deps */
export function supportLine(prompts, dayName, minutes, deps) {
  const phrase = promptsPhrase(prompts, deps);
  if (!(minutes > 0)) return phrase;
  return deps.t('stats.support.best', {prompts: phrase, day: dayName, minutes});
}

/** @param {boolean} running @param {string} durationLabel rótulo do host (mensagem marcada ou texto) @param {StatsTextDeps} deps */
export function timerLine(running, durationLabel, deps) {
  if (!running) return deps.t('stats.timer.paused');
  return deps.t('stats.timer.running', {duration: deps.text(durationLabel)});
}

/** Nome do dia por extenso; `index` 0 = domingo.
 * @param {number} index @param {StatsTextDeps} deps */
export function weekdayName(index, deps) {
  if (!Number.isInteger(index) || index < 0 || index > 6) {
    throw new Error(`study-stats-text: dia da semana ${JSON.stringify(index)} fora de 0–6`);
  }
  return deps.t(`stats.weekday.long.${index}`);
}
