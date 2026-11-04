'use strict';

/* `salvar_nota` no Claude (#91): o MESMO guia da extensão do Pi
   (`mesa-notes/guide.mjs`). O host grava em `Notas/` da matéria (ou da Livre)
   com o invariante do núcleo; o chat lateral não recebe esta ferramenta. */
const NOTE_TOOL_NAME = 'mcp__mesa__salvar_nota';
const {toolErrorText} = require('./tool-error-text.cjs');

/**
 * @param {(args: {titulo?: unknown, conteudo?: unknown}) => Promise<{title: string, rel: string, path: string}>} saveNote
 * @param {{language?: string}} [options]
 */
async function createNoteTool(saveNote, {language} = {}) {
  const [{tool}, {z}, guide, fields] = await Promise.all([
    import('@anthropic-ai/claude-agent-sdk'),
    import('zod'),
    import('../extensions/mesa-notes/guide.mjs'),
    import('../extensions/tool-fields.mjs'),
  ]);
  return tool('salvar_nota', guide.NOTES_DESCRIPTION, fields.zodShape(z, guide.NOTES_FIELDS), async (args) => {
    try {
      const result = await saveNote({titulo: args?.titulo, conteudo: args?.conteudo});
      return {content: [{type: 'text', text: guide.noteText(result)}]};
    } catch (error) {
      return {isError: true, content: [{type: 'text', text: toolErrorText(error, language, 'err.note.write')}]};
    }
  }, {annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}, alwaysLoad: true});
}

module.exports = {NOTE_TOOL_NAME, createNoteTool};
