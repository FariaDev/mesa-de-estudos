/* `quiz` — UM texto, um esquema e um resultado para os três motores
   (Pi `mesa_quiz`, Claude `mcp__mesa__quiz`, OpenCode `mesa_quiz`). A
   ferramenta MOSTRA o cartão e volta na hora; o aluno responde no ritmo dele e
   a Mesa envia o resultado numa mensagem nova. Descrição e campos são SEMPRE
   em inglês; o texto devolvido ao tutor segue em português. */

import {CARD_LIMITS} from '../../cards/input.mjs';

export const QUIZ_DESCRIPTION = [
  'Show a multiple-choice quiz card in the conversation. The desk validates it, shows it to the student and the tool returns immediately: do NOT wait for the answer and do NOT ask the quiz again in text. End your reply; the student answers when they want, and the result arrives in the next message.',
  'The desk grades it without calling you: the student sees correct/incorrect and the explanation right away. correctAnswer uses an option value (for multiSelect, send a list of values). LaTeX is rendered in the question, options and explanation.',
  'Write one question, 2 to 10 options, the correct answer, and a short explanation. Use `details` for extra context. If you need to ask something open-ended, use `perguntar` instead.',
].join('\n\n');

export const QUIZ_FIELDS = {
  question: {type: 'string', min: 1, max: CARD_LIMITS.MAX_QUESTION, trim: true, description: 'Question shown to the student. LaTeX with $...$ or $$...$$ is rendered.'},
  details: {type: 'string', max: CARD_LIMITS.MAX_DETAILS, optional: true, description: 'Optional short context shown above the options.'},
  note: {type: 'string', max: CARD_LIMITS.MAX_NOTE, optional: true, description: 'Optional note shown after the result (not the explanation).'},
  options: {
    type: 'array',
    min: CARD_LIMITS.QUIZ_MIN_OPTIONS,
    max: CARD_LIMITS.QUIZ_MAX_OPTIONS,
    items: {
      type: 'object',
      fields: {
        label: {type: 'string', min: 1, max: CARD_LIMITS.MAX_LABEL, trim: true, description: 'Option text shown to the student (LaTeX allowed).'},
        value: {type: 'string', min: 1, max: CARD_LIMITS.MAX_VALUE, optional: true, trim: true, description: 'Value used by correctAnswer; defaults to label.'},
      },
    },
    description: 'Options, in order; the student sees their labels.',
  },
  multiSelect: {type: 'boolean', default: false, description: 'true when more than one option can be correct; the student sends the set.'},
  correctAnswer: {
    type: 'anyOf',
    of: [
      {type: 'string', min: 1, max: CARD_LIMITS.MAX_VALUE},
      {type: 'array', min: 1, max: CARD_LIMITS.QUIZ_MAX_OPTIONS, items: {type: 'string', min: 1, max: CARD_LIMITS.MAX_VALUE}},
    ],
    description: 'Value of the correct option (or list of values when multiSelect is true).',
  },
  explanation: {type: 'string', max: CARD_LIMITS.MAX_EXPLANATION, optional: true, description: 'Explanation shown after the student answers. LaTeX is rendered.'},
};

/* O tutor recebe isto na hora; o resultado chega na próxima mensagem. */
export const SHOWN_TEXT = 'Mostrado ao aluno. Encerre sua resposta; o resultado chega na próxima mensagem quando ele concluir.';

/**
 * O resultado curto que a ferramenta devolve ao tutor.
 * @returns {string}
 * @example quizText() // 'Mostrado ao aluno. Encerre sua resposta; …'
 */
export function quizText() {
  return SHOWN_TEXT;
}
