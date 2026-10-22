'use strict';

/* Ferramenta de atividade no caminho Claude.
 *
 * O handler MCP NÃO recebe `toolCallId` (o `extra` do SDK não o expõe). A
 * correlação vem do hook PreToolUse do adaptador: ele gera um `callRef` opaco,
 * chama `registry.registerCall({callRef, toolCallId, conversationId,
 * generation, paramsHash})` e devolve ao CLI
 * `hookSpecificOutput.updatedInput = registry.injectRef(input, callRef)`.
 * O handler apenas repassa o campo reservado para `createActivity`; um
 * `callRef` inventado pelo modelo não resolve e a publicação é recusada.
 *
 * Uso no adaptador (integração do pai):
 *   const {createActivityServer}=require('./activity-tools.cjs');
 *   options.mcpServers={mesa:await createActivityServer(async args=>createActivity(args))};
 *   options.allowedTools=[...,ACTIVITY_TOOL_NAME];
 *   // em _preToolUse, para ACTIVITY_TOOL_NAME:
 *   const callRef=crypto.randomUUID();
 *   registry.registerCall({callRef, toolCallId:input.tool_use_id, conversationId, generation, paramsHash});
 *   return {continue:true, hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision:'allow', updatedInput:registry.injectRef(input.tool_input, callRef)}};
 */

const ACTIVITY_TOOL_NAME = 'mcp__mesa__criar_atividade';
const PREVIEW_TOOL_NAME = 'mcp__mesa__previsualizar_atividade';

/* Texto, campos e resultado são os MESMOS da extensão do Pi (`guide.mjs`, #42):
   mudam juntos, e `tests/native-tool-parity.mjs` confere. */
const guide = require('../extensions/mesa-activity/guide.mjs');
const {zodShape} = require('../extensions/tool-fields.mjs');
const {toolErrorText} = require('./tool-error-text.cjs');
const ACTIVITY_TOOL_DESCRIPTION = guide.CREATE_DESCRIPTION;
const PREVIEW_TOOL_DESCRIPTION = guide.PREVIEW_DESCRIPTION;

async function createActivityTool(createActivity, {language} = {}) {
  const [{tool}, {z}] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
  ]);
  return tool('criar_atividade', ACTIVITY_TOOL_DESCRIPTION, zodShape(z, guide.CREATE_FIELDS), async (args) => {
    try {
      const result = await createActivity({...args});
      return {content: [{type: 'text', text: guide.publishedText(result, args.kind)}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.bridge.failed')}]};
    }
  }, {annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: false}, alwaysLoad: true});
}

/* Prévia (#42): print, altura e console, nada gravado — só leitura no sentido
   do MCP. O resultado leva a imagem e o resumo em texto (o mesmo do Pi). */
async function createPreviewTool(previewActivity, {language} = {}) {
  const [{tool}, {z}] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
  ]);
  return tool('previsualizar_atividade', PREVIEW_TOOL_DESCRIPTION, zodShape(z, guide.PREVIEW_FIELDS), async (args) => {
    try {
      const result = await previewActivity({...args});
      return {content: [
        {type: 'image', data: result.screenshot.data, mimeType: result.screenshot.mimeType},
        {type: 'text', text: guide.previewText(result)},
      ]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.bridge.previewFailed')}]};
    }
  }, {annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}, alwaysLoad: true});
}

/* Wrapper de servidor único `mesa`. O root combina com o factory de PDF:
   `tools:[await createActivityTool(fn), await createTutorPdfTool(fn)]`. */
async function createActivityServer(createActivity, previewActivity = null) {
  const [{createSdkMcpServer}, activityTool] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    createActivityTool(createActivity),
  ]);
  const tools = [activityTool];
  if (typeof previewActivity === 'function') tools.push(await createPreviewTool(previewActivity));
  return createSdkMcpServer({
    name: 'mesa',
    version: '1.2.0',
    tools,
  });
}

module.exports = {ACTIVITY_TOOL_NAME, ACTIVITY_TOOL_DESCRIPTION, PREVIEW_TOOL_NAME, PREVIEW_TOOL_DESCRIPTION, createActivityTool, createPreviewTool, createActivityServer};
