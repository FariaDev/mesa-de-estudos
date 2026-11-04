import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {saveNote} from './client.mjs';
import {NOTES_DESCRIPTION, NOTES_FIELDS, noteText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* `mesa_salvar_nota`: grava em `Notas/` da matéria. A ferramenta só é
   registrada na sessão principal, que recebe a ponte de material; o chat
   lateral não tem essa concessão. */

export default function mesaNotes(pi: ExtensionAPI) {
  let bridge;
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_MATERIAL_BRIDGE || '');
  } catch {
    return;
  }
  if (!bridge || typeof bridge.url !== 'string' || typeof bridge.token !== 'string') return;
  pi.registerTool({
    name: 'mesa_salvar_nota',
    label: 'Salvar nota',
    description: NOTES_DESCRIPTION,
    parameters: typeboxObject(Type, NOTES_FIELDS),
    async execute(_id, params) {
      try {
        const result = await saveNote(bridge, params);
        return {content: [{type: 'text' as const, text: noteText(result)}], details: result};
      } catch (error) {
        return {content: [{type: 'text' as const, text: String((error as Error)?.message || error)}], isError: true};
      }
    },
  });
}
