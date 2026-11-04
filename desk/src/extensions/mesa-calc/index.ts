import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {calculateValue} from './client.mjs';
import {CALC_DESCRIPTION, CALC_FIELDS, calcText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* `mesa_calcular`: o mesmo avaliador local da calculadora da janela. A
   ferramenta não precisa de ponte: existe em toda sessão da Mesa. */

export default function mesaCalc(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'mesa_calcular',
    label: 'Calcular',
    description: CALC_DESCRIPTION,
    parameters: typeboxObject(Type, CALC_FIELDS),
    async execute(_id, params) {
      try {
        return {content: [{type: 'text' as const, text: calcText(await calculateValue(params))}]};
      } catch (error) {
        return {content: [{type: 'text' as const, text: String((error as Error)?.message || error)}], isError: true};
      }
    },
  });
}
