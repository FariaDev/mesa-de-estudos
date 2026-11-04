import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {proposeReview} from './client.mjs';
import {REVIEW_DESCRIPTION, REVIEW_FIELDS, proposalText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* `mesa_propor_revisao`: o mesmo texto e os mesmos campos do Claude e do
   OpenCode. Sem a ponte da sessão principal, a ferramenta não existe. */

export default function mesaReview(pi: ExtensionAPI) {
  let bridge: {url?: string, token?: string};
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE || '');
  } catch {
    return;
  }
  if (!bridge || typeof bridge.url !== 'string' || typeof bridge.token !== 'string') return;
  const grant = {url: bridge.url, token: bridge.token};
  pi.registerTool({
    name: 'mesa_propor_revisao',
    label: 'Propor revisão',
    description: REVIEW_DESCRIPTION,
    parameters: typeboxObject(Type, REVIEW_FIELDS),
    async execute(_id, params, signal) {
      try {
        const result = await proposeReview(grant, params, {signal});
        return {
          content: [{type: 'text' as const, text: proposalText(result)}],
          details: {status: result.status, saved: result.saved, item: result.item},
        };
      } catch (error) {
        return {content: [{type: 'text' as const, text: String((error as Error)?.message || error)}], isError: true};
      }
    },
  });
}
