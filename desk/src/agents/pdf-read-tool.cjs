'use strict';

/* `ler_pdf` no Claude (#70 nos outros motores): o mesmo texto e os mesmos
   campos do Pi e do OpenCode (`pdf-tool.mjs`). O adaptador chama o leitor
   do processo principal; não há segunda ida HTTP. O nome que o modelo vê é
   `mcp__mesa__ler_pdf`. */
const PDF_READ_TOOL_NAME = 'mcp__mesa__ler_pdf';
const {toolErrorText} = require('./tool-error-text.cjs');

/**
 * @param {(raw: {path?: unknown, first?: unknown, last?: unknown, imagem?: unknown, girar?: unknown, recorte?: unknown, ampliar?: unknown}) => Promise<object>} readPdf
 * @param {{language?: string}} [options]
 */
async function createPdfReadTool(readPdf, {language} = {}) {
  const [{tool}, {z}, pdf, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-mcp/pdf-tool.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  const session = pdf.createPdfSession();
  return tool('ler_pdf', pdf.PDF_DESCRIPTION, fields.zodShape(z, pdf.PDF_FIELDS), async (args) => {
    try {
      const result = await readPdf({path: args.caminho, first: args.pagina, last: args.ate, imagem: args.imagem, girar: args.girar, recorte: args.recorte, ampliar: args.ampliar});
      return {content: session.content(result)};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.pdf.readFailed')}]};
    }
  }, {annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {PDF_READ_TOOL_NAME, createPdfReadTool};
