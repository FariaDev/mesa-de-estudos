import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {listMaterials} from './client.mjs';
import {MATERIALS_DESCRIPTION, MATERIALS_FIELDS, materialsText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* `mesa_listar_materiais`: os PDFs da matéria (ou da Livre) com o caminho
   canônico. Sem a ponte da sessão, a ferramenta não existe. */

export default function mesaMaterials(pi: ExtensionAPI) {
  let bridge;
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE || '');
  } catch {
    return;
  }
  if (!bridge || typeof bridge.url !== 'string' || typeof bridge.token !== 'string') return;
  pi.registerTool({
    name: 'mesa_listar_materiais',
    label: 'Listar materiais',
    description: MATERIALS_DESCRIPTION,
    parameters: typeboxObject(Type, MATERIALS_FIELDS),
    async execute(_id, params) {
      try {
        const result = await listMaterials(bridge, params);
        return {content: [{type: 'text' as const, text: materialsText(result)}], details: result};
      } catch (error) {
        return {content: [{type: 'text' as const, text: String((error as Error)?.message || error)}], isError: true};
      }
    },
  });
}
