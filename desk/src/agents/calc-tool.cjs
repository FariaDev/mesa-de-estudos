'use strict';

/* `calcular` no Claude (#91): o mesmo guia e o mesmo avaliador da extensão do
   Pi (`mesa-calc/`), sem ponte — roda no processo principal. O nome que o
   modelo vê é `mcp__mesa__calcular`. */
const CALC_TOOL_NAME = 'mcp__mesa__calcular';
const {toolErrorText} = require('./tool-error-text.cjs');

/** @param {{language?: string}} [options] */
async function createCalcTool({language} = {}) {
  const [{tool}, {z}, guide, {calculate}] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-calc/guide.mjs'),
    import('../../calculator.mjs'),
  ]);
  const fields = await import('../extensions/tool-fields.mjs');
  return tool('calcular', guide.CALC_DESCRIPTION, fields.zodShape(z, guide.CALC_FIELDS), async (args) => {
    try {
      const value = calculate(String(args?.expressao || ''), args?.graus === true);
      return {content: [{type: 'text', text: guide.calcText(value)}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.calc.failed')}]};
    }
  }, {annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {CALC_TOOL_NAME, createCalcTool};
