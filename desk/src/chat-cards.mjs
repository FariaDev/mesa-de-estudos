/* Cartões do tutor na coluna da conversa (#92): criação pelo evento do host,
   atualização quando o aluno responde/conclui e remontagem no histórico.
   A posição no histórico sai do `createdAt` do cartão; a conversa que seguiu
   mantém o cartão onde ele nasceu. */

import {cardElement, updateCard} from './cards-view.mjs';

/**
 * @param {{messages: () => HTMLElement|null, api: object, onSending?: Function,
 *   onSettled?: Function, onFailed?: Function}} options
 * @returns {{make: (card: object) => HTMLElement, mount: (card: object) => void,
 *   update: (card: object) => void, reset: () => void, api: object}}
 * @example const board = createCardBoard({messages: () => document.querySelector('#messages'), api});
 */
export function createCardBoard({messages, api, onSending = () => {}, onSettled = () => {}, onFailed = () => {}}) {
  const byId = new Map();

  const make = (card) => {
    const element = cardElement(card, api);
    byId.set(card.id, element);
    return element;
  };

  const mount = (card) => {
    if (!card?.id) return;
    const existing = byId.get(card.id);
    if (existing?.isConnected) { updateCard(existing, card, api); return; }
    const box = messages();
    if (!box) return;
    box.append(make(card));
  };

  const update = (card) => {
    if (!card?.id) return;
    const existing = byId.get(card.id);
    if (existing) updateCard(existing, card, api);
    else mount(card);
  };

  const handle = (payload) => {
    if (!payload || typeof payload !== 'object' || !payload.card?.id) return;
    if (payload.type === 'shown') { mount(payload.card); return; }
    update(payload.card);
    if (payload.type === 'sending') onSending(payload.card);
    else if (payload.type === 'update' && payload.sent === true) onSettled(payload.card, payload.streaming === true);
    else if (payload.type === 'failed') onFailed(payload.card, String(payload.error || ''));
  };

  return {
    make,
    mount,
    update,
    handle,
    reset: () => byId.clear(),
    api,
  };
}
