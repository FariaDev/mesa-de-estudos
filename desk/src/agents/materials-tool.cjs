'use strict';

/* `listar_materiais` no Claude (#91): o MESMO guia da extensão do Pi
   (`mesa-materials/guide.mjs`), no servidor MCP `mesa`. O host chama o serviço
   da sessão atual; o modelo não manda caminho. */
const MATERIALS_TOOL_NAME = 'mcp__mesa__listar_materiais';
const {toolErrorText} = require('./tool-error-text.cjs');

/**
 * @param {(args: object) => Promise<{materials: Array<{name: string, path: string}>, truncated: boolean}>} listMaterials
 * @param {{language?: string}} [options]
 */
async function createMaterialsTool(listMaterials, {language} = {}) {
  const [{tool}, {z}, guide, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-materials/guide.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  return tool('listar_materiais', guide.MATERIALS_DESCRIPTION, fields.zodShape(z, guide.MATERIALS_FIELDS), async (args) => {
    try {
      const result = await listMaterials({...args});
      return {content: [{type: 'text', text: guide.materialsText(result)}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.materials.failed')}]};
    }
  }, {annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {MATERIALS_TOOL_NAME, createMaterialsTool};
