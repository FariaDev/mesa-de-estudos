// @ts-check
/* Os dois textos que o caderno de revisão põe no campo de mensagem ("Tentar de
   novo com o tutor" e "Pedir um parecido"). É texto de interface que o aluno lê
   e envia, então segue o idioma da interface; antes morava em `core/review.bend`,
   onde a junção de frases traduzíveis não cabe (ADR 0001, #41 fase 3). */
import {t as interfaceT} from './ui-text.mjs';

/** @typedef {{name: string, page: number, path: string}} ReviewPromptRef */
/** @typedef {{question: string, attempt: string, difficulty: string, ref: ReviewPromptRef}} ReviewPromptItem */

/** @typedef {(key: string, args?: Record<string, string | number>) => string} Translate */

/** Sem arquivo não há referência para citar; sem nome sobra a página.
 * @param {ReviewPromptRef} ref @param {Translate} t */
function referenceLine(ref, t) {
  if (!ref.path.trim()) return '';
  const page = String(ref.page);
  return ref.name.trim() ? t('review.refHint.named', {name: ref.name, page}) : t('review.refHint.page', {page});
}

/**
 * Prompt de um item do caderno, uma linha por parte que existe.
 * `reviewPrompt({question: 'Derivadas', attempt: '', difficulty: '', ref: {name: '', page: 1, path: ''}}, 'similar')`
 * → `'Quero um exercício semelhante a este, com outros números:\nDerivadas'` (em pt-BR).
 * @param {ReviewPromptItem} item @param {'redo' | 'similar'} kind @param {Translate} [t] o tradutor da interface (os testes passam o do idioma que querem)
 */
export function reviewPrompt(item, kind, t = interfaceT) {
  if (kind !== 'redo' && kind !== 'similar') throw new Error(`review-prompts: tipo ${JSON.stringify(kind)} desconhecido; esperado "redo" ou "similar"`);
  const lines = [t(kind === 'redo' ? 'review.prompt.redo' : 'review.prompt.similar', {question: item.question})];
  if (kind === 'redo' && item.attempt.trim()) lines.push(t('review.prompt.attempt', {attempt: item.attempt}));
  if (item.difficulty.trim()) lines.push(t('review.prompt.stuck', {difficulty: item.difficulty}));
  const reference = referenceLine(item.ref, t);
  if (reference) lines.push(reference);
  return lines.join('\n');
}
