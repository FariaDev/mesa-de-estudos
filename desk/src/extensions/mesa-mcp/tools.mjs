// @ts-check
/* Ferramentas do MCP `mesa` para o OpenCode (#57). O texto, os campos e os
   resultados são os MESMOS do Pi e do Claude (`guide.mjs` de cada ferramenta);
   as chamadas vão às mesmas pontes locais da Mesa (`client.mjs`). No OpenCode
   o nome final é `mesa_<ferramenta>` (servidor `mesa`), igual ao do Pi.

   Fica de fora: o PDF do tutor (`tutor-pdf`), que precisa da ponte de
   material por sessão — anotado no relatório da #57. Só aqui: `ler_pdf`
   (#70, `pdf-tool.mjs`), porque o `read` do OpenCode não abre PDF. */

import crypto from 'node:crypto';
import {BRIDGE_CLOSED, callGeogebra} from '../mesa-geogebra/client.mjs';
import {guideFor} from '../mesa-geogebra/guide.mjs';
import {createActivity, previewActivity} from '../mesa-activity/client.mjs';
import {CREATE_DESCRIPTION, CREATE_FIELDS, PREVIEW_DESCRIPTION, PREVIEW_FIELDS, previewText, publishedText} from '../mesa-activity/guide.mjs';
import {viewFigure} from '../mesa-figure/client.mjs';
import {FIGURE_DESCRIPTION, FIGURE_FIELDS, figureText} from '../mesa-figure/guide.mjs';
import {jsonSchemaOf} from '../tool-fields.mjs';
import {pdfTool} from './pdf-tool.mjs';

/** @typedef {import('./protocol.mjs').McpTool} McpTool */

/** @param {string} value @returns {import('./protocol.mjs').ToolResult} */
const text = (value) => ({content: [{type: 'text', text: value}]});

/**
 * A ferramenta GeoGebra, ligada ao arquivo da ponte.
 * @param {{bridgeFile: string, language?: string, call?: typeof callGeogebra}} options
 * @returns {McpTool}
 * @example geogebraTool({bridgeFile: '/runtime/ggb-bridge.json', language: 'pt-BR'}).name // 'geogebra'
 */
export function geogebraTool({bridgeFile, language, call = callGeogebra}) {
  const guide = guideFor(language);
  return {
    name: 'geogebra',
    description: guide.description,
    inputSchema: jsonSchemaOf(guide.fields),
    async call(args) {
      const action = /** @type {'run'|'state'|'screenshot'} */ (String(args.action || ''));
      const command = typeof args.command === 'string' ? args.command : '';
      if (action === 'run' && !command.trim()) return text(guide.missingCommandText);
      try {
        const data = await call(bridgeFile, action, {command, continuar: args.continuar === true});
        if (action === 'screenshot') return {content: [{type: 'image', data: String(data.png || ''), mimeType: 'image/png'}, {type: 'text', text: guide.shotText}]};
        return text(action === 'run' ? guide.runText(data) : guide.stateText(data));
      } catch (error) {
        const closed = error?.code === BRIDGE_CLOSED;
        return text(guide.unavailableText(closed ? guide.bridgeClosed : String(error?.message || error)));
      }
    },
  };
}

/**
 * As ferramentas de quadro (mostrar e prévia), ligadas à concessão da ponte.
 * A identidade da chamada é um `callRef` novo; a Mesa casa com o id do SSE.
 * @param {{grant: {url: string, token: string}, create?: typeof createActivity, preview?: typeof previewActivity}} options
 * @returns {McpTool[]}
 * @example activityTools({grant: {url: 'http://127.0.0.1:5000/activity', token}}).map((tool) => tool.name) // ['previsualizar_atividade', 'criar_atividade']
 */
export function activityTools({grant, create = createActivity, preview = previewActivity}) {
  return [
    {
      name: 'previsualizar_atividade',
      description: PREVIEW_DESCRIPTION,
      inputSchema: jsonSchemaOf(PREVIEW_FIELDS),
      async call(args) {
        const result = await preview(grant, args);
        return {content: [{type: 'image', data: result.screenshot.data, mimeType: result.screenshot.mimeType}, {type: 'text', text: previewText(result)}]};
      },
    },
    {
      name: 'criar_atividade',
      description: CREATE_DESCRIPTION,
      inputSchema: jsonSchemaOf(CREATE_FIELDS),
      async call(args) {
        const result = await create(grant, args, {callRef: `opencode-${crypto.randomUUID()}`});
        return text(publishedText(result, args.kind));
      },
    },
  ];
}

/**
 * "Ver o que desenhei" (#60), ligada à concessão da ponte.
 * @param {{grant: {url: string, token: string}, view?: typeof viewFigure}} options
 * @returns {McpTool}
 * @example figureTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'ver_figura'
 */
export function figureTool({grant, view = viewFigure}) {
  return {
    name: 'ver_figura',
    description: FIGURE_DESCRIPTION,
    inputSchema: jsonSchemaOf(FIGURE_FIELDS),
    async call(args) {
      const result = await view(grant, args);
      return {content: [{type: 'image', data: result.screenshot.data, mimeType: result.screenshot.mimeType}, {type: 'text', text: figureText(result)}]};
    },
  };
}

/**
 * As ferramentas que o ambiente libera: sem ponte, a ferramenta não existe.
 * @param {Record<string, string|undefined>} env
 * @returns {McpTool[]}
 * @example mesaTools({LEARNING_DESK_GGB_BRIDGE: '/runtime/ggb-bridge.json'}).length // 1
 */
export function mesaTools(env) {
  const tools = [];
  const bridgeFile = String(env.LEARNING_DESK_GGB_BRIDGE || '').trim();
  if (bridgeFile) tools.push(geogebraTool({bridgeFile, language: env.LEARNING_DESK_TUTOR_LANGUAGE}));
  let grant;
  try { grant = JSON.parse(env.LEARNING_DESK_ACTIVITY_BRIDGE || ''); } catch { grant = null; }
  if (grant && typeof grant.url === 'string' && typeof grant.token === 'string') tools.push(...activityTools({grant}), figureTool({grant}), pdfTool({grant}));
  return tools;
}
