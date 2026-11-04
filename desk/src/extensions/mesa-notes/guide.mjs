/* `salvar_nota` — UM texto e um formato de resultado para os três motores
   (Pi `mesa_salvar_nota`, Claude e OpenCode `salvar_nota`). A nota vai para
   `Notas/<título>.md` na raiz da matéria (ou da sessão Livre), nunca
   sobrescreve e nunca sai da pasta. Descrição e campos são SEMPRE em inglês;
   o resultado (`noteText`) segue em português. */

import notesCore from '../../generated/tutornotes.core.js';

const MAX_TITLE = Number(notesCore.maxTitle());
const MAX_CONTENT = Number(notesCore.maxContent());

export const NOTES_DESCRIPTION =
  'Saves a Markdown note inside the current course (in the Notas folder; in a free session, inside its own workspace). ' +
  'Use it for durable study notes the student asked to keep, not for chat replies. ' +
  'It never overwrites: an existing name gets -2, -3, and so on. It cannot write PDFs or files outside that folder.';

export const NOTES_FIELDS = {
  titulo: {type: 'string', min: 1, max: MAX_TITLE, trim: true, description: `Note title (1 to ${MAX_TITLE} characters); it becomes the file name.`},
  conteudo: {type: 'string', min: 1, max: MAX_CONTENT, description: `Markdown content (1 to ${MAX_CONTENT} characters).`},
};

/**
 * O texto que volta ao tutor quando a nota foi gravada.
 * @param {{title?: string, rel?: string, path?: string}} result
 * @returns {string}
 * @example noteText({title: 'Limites', rel: 'Notas/Limites.md', path: '/c/Notas/Limites.md'})
 */
export function noteText(result) {
  const rel = result?.rel || 'Notas/';
  const title = result?.title || '';
  return `Nota “${title}” salva em ${rel}. O arquivo não foi sobrescrito.`;
}
