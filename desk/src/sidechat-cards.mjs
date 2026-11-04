/* Cartões `quiz`/`perguntar` do chat lateral (#92). O estado e o canal
   continuam em `sidechat.mjs`; este módulo só monta a lista, atualiza o
   cartão pelo id e trata o evento `card` que o manager emite. */

import {toast} from './state.mjs';
import {message as uiMessage} from './i18n.mjs';
import {cardElement} from './cards-view.mjs';

/**
 * Troca o cartão na lista do lateral (ou inclui, se for novo).
 * @param {{cards: object[]}} state
 * @param {object} card
 * @returns {void}
 * @example replaceSideCard(state, card)
 */
export function replaceSideCard(state, card) {
  if (!card || typeof card.id !== 'string') return;
  const index = state.cards.findIndex((item) => item.id === card.id);
  if (index < 0) state.cards.push(card);
  else state.cards[index] = card;
}

/**
 * Callbacks do cartão para o canal `sidechat-card-*`; o id do chat e o do
 * cartão são campos distintos (o manager resolve o escopo pelo primeiro).
 * @param {{cards: object[], id: string}} state
 * @param {() => object} api
 * @returns {{answer: Function, draft: Function, dismiss: Function, conclude: Function}}
 * @example const callbacks = sideCardApi(state, api);
 */
export function sideCardApi(state, api) {
  return {
    answer: (cardId, answer) => api().sidechatCardAnswer({id: state.id, cardId, answer}).then((card) => { replaceSideCard(state, card); return card; }),
    draft: (cardId, draft) => api().sidechatCardDraft({id: state.id, cardId, draft}).then((card) => { replaceSideCard(state, card); return card; }),
    dismiss: (cardId) => api().sidechatCardDismiss({id: state.id, cardId}).then((card) => { replaceSideCard(state, card); return card; }),
    conclude: (cardId) => api().sidechatCardConclude({id: state.id, cardId}).then((result) => { if (result?.card) replaceSideCard(state, result.card); return result; }),
  };
}

/**
 * Acrescenta os cartões ao fragmento do histórico, em ordem de criação.
 * @param {DocumentFragment} fragment
 * @param {{cards: object[]}} state
 * @param {object} api callbacks de `sideCardApi`
 * @returns {void}
 * @example renderSideCards(fragment, state, sideCardApi(state, api));
 */
export function renderSideCards(fragment, state, api) {
  for (const card of [...state.cards].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))) {
    fragment.append(cardElement(card, api));
  }
}

/**
 * Trata `{type:'card', cardType:'shown'|'sending'|'update'|'failed', card}`.
 * @param {object} event
 * @param {{cards: object[]}} state
 * @param {() => void} render
 * @returns {void}
 * @example handleSideCardEvent(event, state, renderMessages)
 */
export function handleSideCardEvent(event, state, render) {
  const card = event.card;
  if (card && typeof card.id === 'string') {
    replaceSideCard(state, card);
    render();
  }
  if (event.cardType === 'failed') toast(String(event.error || uiMessage('quiz.sendFailed')));
}
