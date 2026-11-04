'use strict';

/* `quiz` e `perguntar` no caminho Claude (#92): o MESMO guia da extensão do Pi
   (`mesa-quiz/guide.mjs` e `mesa-perguntar/guide.mjs`). O host registra o
   cartão e devolve o texto curto; a ferramenta NÃO espera o aluno. */

const {toolErrorText} = require('./tool-error-text.cjs');

async function load() {
  return Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-quiz/guide.mjs'),
    import('../extensions/mesa-perguntar/guide.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
}

/**
 * As duas ferramentas de cartão do Claude.
 * @param {(kind: 'quiz'|'ask', args: object) => Promise<{id: string}>} showCard
 * @param {{language?: string}} [options]
 * @returns {Promise<Array<object>>}
 */
async function createCardTools(showCard, {language} = {}) {
  const [{tool}, {z}, quiz, ask, fields] = await load();
  return [
    tool('quiz', quiz.QUIZ_DESCRIPTION, z.object(fields.zodShape(z, quiz.QUIZ_FIELDS)), async (args) => {
      try {
        const result = await showCard('quiz', {...args});
        return {content: [{type: 'text', text: quiz.quizText()}], details: {cardId: result.id}};
      } catch (error) {
        return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.card.invalid')}]};
      }
    }, {annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}, alwaysLoad: true}),
    tool('perguntar', ask.ASK_DESCRIPTION, z.object(fields.zodShape(z, ask.ASK_FIELDS)), async (args) => {
      try {
        const result = await showCard('ask', {...args});
        return {content: [{type: 'text', text: ask.askText()}], details: {cardId: result.id}};
      } catch (error) {
        return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.card.invalid')}]};
      }
    }, {annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}, alwaysLoad: true}),
  ];
}

module.exports = {createCardTools};
