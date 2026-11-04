'use strict';

/* `buscar_material` no Claude: o MESMO guia da extensão do Pi
   (`mesa-search/guide.mjs`), no servidor MCP `mesa`. O adaptador roda no
   processo principal e chama o host direto; o escopo é o da sessão atual. */
const SEARCH_TOOL_NAME = 'mcp__mesa__buscar_material';
const {toolErrorText} = require('./tool-error-text.cjs');

/**
 * @param {(args: {consulta?: unknown, limite?: unknown}) => Promise<object>} searchMaterial
 * @param {{language?: string}} [options]
 */
async function createSearchTool(searchMaterial, {language} = {}) {
  const [{tool}, {z}, guide, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-search/guide.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  return tool('buscar_material', guide.SEARCH_DESCRIPTION, fields.zodShape(z, guide.SEARCH_FIELDS), async (args) => {
    try {
      const result = await searchMaterial({consulta: args.consulta, limite: args.limite});
      return {content: [{type: 'text', text: guide.searchText(result)}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.searchTool.failed')}]};
    }
  }, {annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {SEARCH_TOOL_NAME, createSearchTool};
