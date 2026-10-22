'use strict';

/* Ferramenta GeoGebra no caminho Claude (#53): o MESMO guia da extensão do Pi
   (`mesa-geogebra/guide.mjs`, no idioma do tutor), no servidor MCP `mesa`. Sem ponte HTTP: o
   adaptador roda no processo principal e chama o serviço do host
   (`createGeogebraHost(...).service`) direto. `tests/native-tool-parity.mjs`
   confere descrição e esquema contra o Pi. */
const GEOGEBRA_TOOL_NAME = 'mcp__mesa__geogebra';
const {toolErrorText} = require('./tool-error-text.cjs');

async function createGeogebraTool(service, {language} = {}) {
  const [{tool}, {z}, guide, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-geogebra/guide.mjs').then((module) => module.guideFor(language)),
    import('../extensions/tool-fields.mjs'),
  ]);
  const reply = (text) => ({content: [{type: 'text', text}]});
  return tool('geogebra', guide.description, fields.zodShape(z, guide.fields), async (args) => {
    try {
      if (args.action === 'run' && !String(args.command || '').trim()) return reply(guide.missingCommandText);
      if (args.action === 'screenshot') {
        const shot = await service.screenshot();
        return {content: [{type: 'image', data: String(shot.png || ''), mimeType: 'image/png'}, {type: 'text', text: guide.shotText}]};
      }
      if (args.action === 'state') return reply(guide.stateText(await service.state()));
      return reply(guide.runText(await service.run({command: args.command, continuar: args.continuar === true})));
    } catch (error) {
      return reply(guide.unavailableText(toolErrorText(error, language)));
    }
  }, {annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {GEOGEBRA_TOOL_NAME, createGeogebraTool};
