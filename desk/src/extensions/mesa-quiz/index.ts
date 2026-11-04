import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {showCard} from '../../cards/client.mjs';
import {QUIZ_DESCRIPTION, QUIZ_FIELDS, quizText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* `mesa_quiz`: mostra o cartão e volta na hora. O cartão fica na fila da Mesa
   (ou no host da sessão), não na chamada: o resultado chega numa mensagem
   nova quando o aluno conclui. */
export default function mesaQuiz(pi: ExtensionAPI) {
  let bridge;
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_CARD_BRIDGE || '');
  } catch {
    return;
  }
  if (!bridge || typeof bridge.url !== 'string' || typeof bridge.token !== 'string') return;
  pi.registerTool({
    name: 'mesa_quiz',
    label: 'Quiz',
    description: QUIZ_DESCRIPTION,
    parameters: typeboxObject(Type, QUIZ_FIELDS),
    async execute(id, params, signal) {
      try {
        const result = await showCard(bridge, 'quiz', params, {toolCallId: String(id || ''), signal});
        return {content: [{type: 'text' as const, text: quizText()}], details: {cardId: result.id}};
      } catch (error) {
        return {content: [{type: 'text' as const, text: String((error as Error)?.message || error)}], isError: true};
      }
    },
  });
}
