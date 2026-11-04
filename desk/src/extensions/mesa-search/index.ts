import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {searchMaterial} from './client.mjs';
import {SEARCH_DESCRIPTION, SEARCH_FIELDS, searchText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* `mesa_buscar_material`: o mesmo texto, os mesmos campos e a mesma saída do
   Claude e do OpenCode. Sem a ponte da sessão, a ferramenta não existe. */

export default function mesaSearch(pi: ExtensionAPI) {
  let bridge: {url?: string, token?: string};
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE || '');
  } catch {
    return;
  }
  if (!bridge || typeof bridge.url !== 'string' || typeof bridge.token !== 'string') return;
  const grant = {url: bridge.url, token: bridge.token};
  pi.registerTool({
    name: 'mesa_buscar_material',
    label: 'Buscar no material',
    description: SEARCH_DESCRIPTION,
    parameters: typeboxObject(Type, SEARCH_FIELDS),
    async execute(_id, params) {
      try {
        const result = await searchMaterial(grant, params);
        return {content: [{type: 'text' as const, text: searchText(result)}], details: result};
      } catch (error) {
        return {content: [{type: 'text' as const, text: String((error as Error)?.message || error)}], isError: true};
      }
    },
  });
}
