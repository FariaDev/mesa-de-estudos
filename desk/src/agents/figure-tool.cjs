'use strict';

/* "Ver o que desenhei" no caminho Claude (#60): o MESMO guia da extensão do Pi
   (`mesa-figure/guide.mjs`), no servidor MCP `mesa`. O adaptador roda no
   processo principal e chama o host de captura (`figure-preview.cjs`) direto.
   `tests/native-tool-parity.mjs` confere descrição e esquema contra o Pi. */
const FIGURE_TOOL_NAME = 'mcp__mesa__ver_figura';
const {toolErrorText} = require('./tool-error-text.cjs');

/** @param {(args: object) => Promise<any>} viewFigure @param {{language?: string}} [options] */
async function createFigureTool(viewFigure, {language} = {}) {
  const [{tool}, {z}, guide, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-figure/guide.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  return tool('ver_figura', guide.FIGURE_DESCRIPTION, fields.zodShape(z, guide.FIGURE_FIELDS), async (args) => {
    try {
      const result = await viewFigure({...args});
      return {content: [
        {type: 'image', data: result.screenshot.data, mimeType: result.screenshot.mimeType},
        {type: 'text', text: guide.figureText(result)},
      ]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.bridge.figureFailed')}]};
    }
  }, {annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {FIGURE_TOOL_NAME, createFigureTool};
