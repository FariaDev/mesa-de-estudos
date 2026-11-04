'use strict';

/* "Propor revisão" no caminho Claude: o MESMO guia da extensão do Pi
   (`mesa-review/guide.mjs`), no servidor MCP `mesa`. O adaptador roda no
   processo principal e chama o host direto. Nada entra no caderno sem o
   aluno: o host só grava `approved` e `edited`. */
const REVIEW_TOOL_NAME = 'mcp__mesa__propor_revisao';
const {toolErrorText} = require('./tool-error-text.cjs');

/**
 * @param {(args: object, options?: {signal?: AbortSignal}) => Promise<object>} proposeReview
 * @param {{language?: string}} [options]
 */
async function createReviewTool(proposeReview, {language} = {}) {
  const [{tool}, {z}, guide, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-review/guide.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  return tool('propor_revisao', guide.REVIEW_DESCRIPTION, fields.zodShape(z, guide.REVIEW_FIELDS), async (args, extra) => {
    try {
      const result = await proposeReview({question: args.question, attempt: args.attempt, difficulty: args.difficulty}, {signal: extra?.signal});
      return {content: [{type: 'text', text: guide.proposalText(result)}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.operation.failed')}]};
    }
  }, {annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {REVIEW_TOOL_NAME, createReviewTool};
