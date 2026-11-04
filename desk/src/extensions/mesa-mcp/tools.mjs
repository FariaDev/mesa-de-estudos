// @ts-check
/* Ferramentas do MCP `mesa` para o OpenCode (#57). O texto, os campos e os
   resultados são os MESMOS do Pi e do Claude (`guide.mjs` de cada ferramenta);
   as chamadas vão às mesmas pontes locais da Mesa (`client.mjs`). No OpenCode
   o nome final é `mesa_<ferramenta>` (servidor `mesa`), igual ao do Pi.

   `criar_pdf` usa o guia e a ponte de material do Pi e do Claude
   (`tutor-pdf/`); a ponte só existe na sessão principal, então o chat lateral
   não a recebe — como já acontece com `salvar_nota`. `ler_pdf`
   (`pdf-tool.mjs`) e `buscar_material` (`mesa-search/`) entram com a ponte de
   atividades. `LEARNING_DESK_PDF_ONLY` deixa só essas duas: o chat lateral lê
   PDF e busca no material, mas não propõe card nem publica quadro. */

import crypto from 'node:crypto';
import {BRIDGE_CLOSED, callGeogebra} from '../mesa-geogebra/client.mjs';
import {guideFor} from '../mesa-geogebra/guide.mjs';
import {createActivity, previewActivity} from '../mesa-activity/client.mjs';
import {CREATE_DESCRIPTION, CREATE_FIELDS, PREVIEW_DESCRIPTION, PREVIEW_FIELDS, previewText, publishedText} from '../mesa-activity/guide.mjs';
import {viewFigure} from '../mesa-figure/client.mjs';
import {FIGURE_DESCRIPTION, FIGURE_FIELDS, figureText} from '../mesa-figure/guide.mjs';
import {proposeReview} from '../mesa-review/client.mjs';
import {REVIEW_DESCRIPTION, REVIEW_FIELDS, proposalText} from '../mesa-review/guide.mjs';
import {jsonSchemaOf} from '../tool-fields.mjs';
import {pdfTool} from './pdf-tool.mjs';
import {searchMaterial} from '../mesa-search/client.mjs';
import {SEARCH_DESCRIPTION, SEARCH_FIELDS, searchText} from '../mesa-search/guide.mjs';
import {calculateValue} from '../mesa-calc/client.mjs';
import {CALC_DESCRIPTION, CALC_FIELDS, calcText} from '../mesa-calc/guide.mjs';
import {listMaterials} from '../mesa-materials/client.mjs';
import {MATERIALS_DESCRIPTION, MATERIALS_FIELDS, materialsText} from '../mesa-materials/guide.mjs';
import {saveNote} from '../mesa-notes/client.mjs';
import {NOTES_DESCRIPTION, NOTES_FIELDS, noteText} from '../mesa-notes/guide.mjs';
import {createTutorPdf} from '../tutor-pdf/client.mjs';
import {showCard} from '../../cards/client.mjs';
import {QUIZ_DESCRIPTION, QUIZ_FIELDS, quizText} from '../mesa-quiz/guide.mjs';
import {ASK_DESCRIPTION, ASK_FIELDS, askText} from '../mesa-perguntar/guide.mjs';
import {FIELDS as PDF_CREATE_FIELDS, TOOL_DESCRIPTION as PDF_CREATE_DESCRIPTION, resultText as pdfCreateText} from '../tutor-pdf/guide.mjs';
import toolErrorModule from '../../agents/tool-error-text.cjs';

const {toolErrorText} = toolErrorModule;

/** @typedef {import('./protocol.mjs').McpTool} McpTool */

/**
 * Resultado de texto do MCP; `isError` marca falha de ponte/applet (B1).
 * @param {string} value
 * @param {{isError?: boolean, details?: object}} [options]
 * @returns {import('./protocol.mjs').ToolResult}
 * @example text('ok') // {content: [{type: 'text', text: 'ok'}]}
 */
const text = (value, {isError = false, details} = {}) => ({content: [{type: 'text', text: value}], ...(isError ? {isError: true} : {}), ...(details ? {details} : {})});

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
        /* B1: ponte fechada ou applet sem resposta vira isError; comando
           recusado continua resultado normal (guide.runText). */
        const closed = error?.code === BRIDGE_CLOSED;
        return text(guide.unavailableText(closed ? guide.bridgeClosed : String(error?.message || error)), {isError: true});
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
 * Propor um card de revisão. O aluno confirma no diálogo; o chat lateral não recebe esta ferramenta.
 * @param {{grant: {url: string, token: string}, propose?: typeof proposeReview}} options
 * @returns {McpTool}
 * @example reviewTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'propor_revisao'
 */
export function reviewTool({grant, propose = proposeReview}) {
  return {
    name: 'propor_revisao',
    description: REVIEW_DESCRIPTION,
    inputSchema: jsonSchemaOf(REVIEW_FIELDS),
    async call(args) {
      const result = await propose(grant, args);
      return text(proposalText(result));
    },
  };
}

/**
 * `buscar_material`: o tutor procura no texto dos PDFs da matéria antes de
 * varrer a aula. A ponte recorta o escopo; o modelo só manda consulta e limite.
 * @param {{grant: {url: string, token: string}, search?: typeof searchMaterial}} options
 * @returns {McpTool}
 * @example searchTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'buscar_material'
 */
export function searchTool({grant, search = searchMaterial}) {
  return {
    name: 'buscar_material',
    description: SEARCH_DESCRIPTION,
    inputSchema: jsonSchemaOf(SEARCH_FIELDS),
    async call(args) {
      try {
        return text(searchText(await search(grant, args)));
      } catch (error) {
        return {content: [{type: 'text', text: String(error?.message || error)}], isError: true};
      }
    },
  };
}

/**
 * `calcular` (#91): o mesmo avaliador local da calculadora da janela, sem
 * ponte. Existe em toda sessão, inclusive no chat lateral.
 * @param {{calc?: typeof calculateValue}} [options]
 * @returns {McpTool}
 * @example calcTool().name // 'calcular'
 */
export function calcTool({calc = calculateValue} = {}) {
  return {
    name: 'calcular',
    description: CALC_DESCRIPTION,
    inputSchema: jsonSchemaOf(CALC_FIELDS),
    async call(args) {
      try {
        return text(calcText(await calc(args)));
      } catch (error) {
        return text(String(error?.message || error), {isError: true});
      }
    },
  };
}

/**
 * `listar_materiais` (#91): os PDFs da matéria/Livre com o caminho canônico.
 * @param {{grant: {url: string, token: string}, list?: typeof listMaterials}} options
 * @returns {McpTool}
 * @example materialsTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'listar_materiais'
 */
export function materialsTool({grant, list = listMaterials}) {
  return {
    name: 'listar_materiais',
    description: MATERIALS_DESCRIPTION,
    inputSchema: jsonSchemaOf(MATERIALS_FIELDS),
    async call(args) {
      try {
        return text(materialsText(await list(grant, args)));
      } catch (error) {
        return text(String(error?.message || error), {isError: true});
      }
    },
  };
}

/**
 * `criar_pdf`: prepara o PDF no diálogo de revisão pela ponte de material.
 * O texto, os campos e o resultado são os MESMOS do Pi e do Claude.
 * @param {{grant: {url: string, token: string}, create?: typeof createTutorPdf, language?: string}} options
 * @returns {McpTool}
 * @example materialPdfTool({grant: {url: 'http://127.0.0.1:5000/pdf', token}}).name // 'criar_pdf'
 */
export function materialPdfTool({grant, create = createTutorPdf, language}) {
  return {
    name: 'criar_pdf',
    description: PDF_CREATE_DESCRIPTION,
    inputSchema: jsonSchemaOf(PDF_CREATE_FIELDS),
    async call(args) {
      try {
        return text(pdfCreateText(await create(grant, args)));
      } catch (error) {
        return text(toolErrorText(error, language, 'err.pdfbridge.failed'), {isError: true});
      }
    },
  };
}

/**
 * `salvar_nota` (#91): `Notas/<título>.md` na matéria, pela ponte de material.
 * O chat lateral não recebe a concessão, então a ferramenta não existe nele.
 * @param {{grant: {url: string, token: string}, save?: typeof saveNote}} options
 * @returns {McpTool}
 * @example noteTool({grant: {url: 'http://127.0.0.1:5000/pdf', token}}).name // 'salvar_nota'
 */
export function noteTool({grant, save = saveNote}) {
  return {
    name: 'salvar_nota',
    description: NOTES_DESCRIPTION,
    inputSchema: jsonSchemaOf(NOTES_FIELDS),
    async call(args) {
      try {
        return text(noteText(await save(grant, args)));
      } catch (error) {
        return text(String(error?.message || error), {isError: true});
      }
    },
  };
}


/**
 * `quiz` (#92): mostra o cartão e volta na hora; o aluno responde e a Mesa
 * envia o resultado numa mensagem nova. Texto e campos são os mesmos do Pi e
 * do Claude (`mesa-quiz/guide.mjs`).
 * @param {{grant: {url: string, token: string}, show?: typeof showCard}} options
 * @returns {McpTool}
 * @example quizTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'quiz'
 */
export function quizTool({grant, show = showCard}) {
  return {
    name: 'quiz',
    description: QUIZ_DESCRIPTION,
    inputSchema: jsonSchemaOf(QUIZ_FIELDS),
    async call(args) {
      try {
        const result = await show(grant, 'quiz', args);
        return text(quizText(), {details: {cardId: result.id}});
      } catch (error) {
        return text(String(error?.message || error), {isError: true});
      }
    },
  };
}

/**
 * `perguntar` (#92): pergunta com opções ou resposta livre. O cartão fica na
 * conversa e o resultado chega numa mensagem nova.
 * @param {{grant: {url: string, token: string}, show?: typeof showCard}} options
 * @returns {McpTool}
 * @example askTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'perguntar'
 */
export function askTool({grant, show = showCard}) {
  return {
    name: 'perguntar',
    description: ASK_DESCRIPTION,
    inputSchema: jsonSchemaOf(ASK_FIELDS),
    async call(args) {
      try {
        const result = await show(grant, 'ask', args);
        return text(askText(), {details: {cardId: result.id}});
      } catch (error) {
        return text(String(error?.message || error), {isError: true});
      }
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
  const tools = [calcTool()];
  let grant;
  try { grant = JSON.parse(env.LEARNING_DESK_ACTIVITY_BRIDGE || ''); } catch { grant = null; }
  const grantOk = grant && typeof grant.url === 'string' && typeof grant.token === 'string';
  /* Nota só na sessão principal: a ponte de material não existe no lateral. */
  let materialGrant;
  try { materialGrant = JSON.parse(env.LEARNING_DESK_MATERIAL_BRIDGE || ''); } catch { materialGrant = null; }
  const materialOk = materialGrant && typeof materialGrant.url === 'string' && typeof materialGrant.token === 'string';
  /* Cartões (#92): a concessão própria (principal ou lateral) diz onde o
     cartão mora. A ferramenta não existe sem ela. */
  let cardGrant;
  try { cardGrant = JSON.parse(env.LEARNING_DESK_CARD_BRIDGE || ''); } catch { cardGrant = null; }
  const cardOk = cardGrant && typeof cardGrant.url === 'string' && typeof cardGrant.token === 'string';
  if (env.LEARNING_DESK_PDF_ONLY === '1') {
    if (grantOk) tools.push(pdfTool({grant, language: env.LEARNING_DESK_TUTOR_LANGUAGE}), searchTool({grant}), materialsTool({grant}));
    if (cardOk) tools.push(quizTool({grant: cardGrant}), askTool({grant: cardGrant}));
    return tools;
  }
  if (cardOk) tools.push(quizTool({grant: cardGrant}), askTool({grant: cardGrant}));
  const bridgeFile = String(env.LEARNING_DESK_GGB_BRIDGE || '').trim();
  if (bridgeFile) tools.push(geogebraTool({bridgeFile, language: env.LEARNING_DESK_TUTOR_LANGUAGE}));
  if (grantOk) tools.push(...activityTools({grant}), figureTool({grant}), reviewTool({grant}), pdfTool({grant, language: env.LEARNING_DESK_TUTOR_LANGUAGE}), searchTool({grant}), materialsTool({grant}));
  if (materialOk) tools.push(materialPdfTool({grant: materialGrant, language: env.LEARNING_DESK_TUTOR_LANGUAGE}), noteTool({grant: materialGrant}));
  return tools;
}
