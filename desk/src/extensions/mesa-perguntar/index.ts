import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {showCard} from '../../cards/client.mjs';
import {ASK_DESCRIPTION, ASK_FIELDS, askText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* `mesa_perguntar`: pergunta com opções ou resposta livre, sem bloquear o
   turno. O cartão fica na conversa e o resultado chega numa mensagem nova. */
export default function mesaPerguntar(pi: ExtensionAPI) {
  let bridge;
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_CARD_BRIDGE || '');
  } catch {
    return;
  }
  if (!bridge || typeof bridge.url !== 'string' || typeof bridge.token !== 'string') return;
  pi.registerTool({
    name: 'mesa_perguntar',
    label: 'Perguntar ao aluno',
    description: ASK_DESCRIPTION,
    parameters: typeboxObject(Type, ASK_FIELDS),
    async execute(id, params, signal) {
      try {
        const result = await showCard(bridge, 'ask', params, {toolCallId: String(id || ''), signal});
        return {content: [{type: 'text' as const, text: askText()}], details: {cardId: result.id}};
      } catch (error) {
        return {content: [{type: 'text' as const, text: String((error as Error)?.message || error)}], isError: true};
      }
    },
  });
}
