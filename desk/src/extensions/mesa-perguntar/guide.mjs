/* `perguntar` — UM texto, um esquema e um resultado para os três motores
   (Pi `mesa_perguntar`, Claude `mcp__mesa__perguntar`, OpenCode
   `mesa_perguntar`). A ferramenta MOSTRA o cartão e volta na hora; o aluno
   responde quando quiser e a Mesa envia o resultado numa mensagem nova.
   Descrição e campos são SEMPRE em inglês; o texto ao tutor é português. */

import {CARD_LIMITS} from '../../cards/input.mjs';

export const ASK_DESCRIPTION = [
  'Ask the student one or more structured questions in a card. The desk shows the card and the tool returns immediately: do NOT wait for the answer and do NOT repeat the questions in text. End your reply; the student answers when they want, and the result arrives in the next message.',
  'Each question may have options (label plus optional description) or be answered freely; the card always accepts a free answer that replaces the options. Use it when the answer changes what you do next (diagnosis, preference, next step). For a graded question, use `quiz` instead.',
].join('\n\n');

const QUESTION_FIELDS = {
  header: {type: 'string', max: CARD_LIMITS.MAX_HEADER, optional: true, trim: true, description: 'Short label above the question.'},
  question: {type: 'string', min: 1, max: CARD_LIMITS.MAX_QUESTION, trim: true, description: 'Question shown to the student; LaTeX is rendered.'},
  options: {
    type: 'array',
    max: CARD_LIMITS.ASK_MAX_OPTIONS,
    optional: true,
    items: {
      type: 'object',
      fields: {
        label: {type: 'string', min: 1, max: CARD_LIMITS.MAX_LABEL, trim: true, description: 'Option text; the free answer replaces it.'},
        description: {type: 'string', max: CARD_LIMITS.MAX_DESCRIPTION, optional: true, trim: true, description: 'Optional second line explaining the option.'},
      },
    },
    description: 'Choices shown to the student; omit for free answer only.',
  },
  multiSelect: {type: 'boolean', default: false, description: 'true when the student may mark more than one option.'},
};

export const ASK_FIELDS = {
  questions: {
    type: 'array',
    min: 1,
    max: CARD_LIMITS.ASK_MAX_QUESTIONS,
    items: {type: 'object', fields: QUESTION_FIELDS},
    description: 'Questions, in the order shown to the student.',
  },
};

export const SHOWN_TEXT = 'Mostrado ao aluno. Encerre sua resposta; o resultado chega na próxima mensagem quando ele concluir.';

/**
 * O resultado curto que a ferramenta devolve ao tutor.
 * @returns {string}
 * @example askText() // 'Mostrado ao aluno. Encerre sua resposta; …'
 */
export function askText() {
  return SHOWN_TEXT;
}
