// @ts-check
'use strict';

/* Uma conversa de cartões `quiz`/`perguntar` (#92): a ferramenta registra, o
   aluno responde no cartão e o "Concluir" manda o resultado numa mensagem
   nova, uma vez só. O mesmo serviço atende a conversa principal (sessão viva)
   e cada chat lateral (id do descritor); quem muda é o caminho de envio. */

const {normalizeAsk, normalizeQuiz} = require('./src/cards/input.mjs');
const cardStore = require('./card-store.cjs');
const {invalidValue} = require('./src/error-detail.mjs');
const {isPlainObject} = require('./plain-object.cjs');

/**
 * Cria o serviço de cartões de UMA conversa.
 * @param {{runtime: string, conversation: () => string, sendText: (text: string, target?: string) => Promise<object>,
 *   emit?: (payload: object) => void, appendLog?: (area: string, line: string) => void}} options
 * @returns {{show: (raw: object, target?: string) => {id: string, card: object},
 *   list: (target?: string) => object[], answer: (payload: object) => object,
 *   draft: (payload: object) => object, dismiss: (payload: object) => object,
 *   conclude: (id: string) => Promise<object>}}
 * @example const cards = createCardSession({runtime, conversation: () => session, sendText});
 */
function createCardSession({runtime, conversation, sendText, emit = () => {}, appendLog = () => {}}) {
  cardStore.setInvalidLog(appendLog);
  function session() {
    const value = String(conversation() || '');
    if (!value) throw Error('A conversa atual não tem sessão para guardar o cartão.');
    return value;
  }

  function normalized(kind, args) {
    if (kind === 'quiz') return normalizeQuiz(args);
    if (kind === 'ask') return normalizeAsk(args);
    throw Error(invalidValue('kind', kind, 'quiz|ask'));
  }

  function show(raw, target = session()) {
    if (!isPlainObject(raw)) throw Error(invalidValue('cartão', raw, 'object {kind, args}'));
    const owner = String(target || '');
    if (!owner) throw Error(invalidValue('conversationId', target, 'string(1..)'));
    const card = cardStore.createCard(runtime, owner, normalized(raw.kind, raw.args));
    /* A conversa pode ter trocado durante a validação/escrita: o cartão fica
       na conversa dona e a janela não mistura cartões de sessões diferentes. */
    if (owner === session()) emit({type: 'shown', conversationId: owner, card});
    return {id: card.id, card};
  }

  function list(target = session()) {
    return cardStore.listCards(runtime, String(target || ''));
  }

  function own(id) {
    if (typeof id !== 'string' || !/^card-[0-9a-f-]{36}$/.test(id)) throw Error(invalidValue('id', id, 'card-<uuid>'));
    const card = cardStore.findCard(runtime, session(), id);
    if (!card) throw Error(`cartão ${id} não existe nesta conversa; esperado um cartão aberto`);
    return card;
  }

  function answer(payload) {
    if (!isPlainObject(payload)) throw Error(invalidValue('resposta', payload, 'object {id, answer}'));
    const data = /** @type {Record<string, any>} */ (payload);
    own(data.id);
    const card = cardStore.answerCard(runtime, session(), data.id, isPlainObject(data.answer) ? data.answer : {});
    if (!card) throw Error(`cartão ${data.id} não existe nesta conversa`);
    emit({type: 'update', conversationId: session(), card});
    return card;
  }

  function draft(payload) {
    if (!isPlainObject(payload)) throw Error(invalidValue('rascunho', payload, 'object {id, draft}'));
    const data = /** @type {Record<string, any>} */ (payload);
    return cardStore.saveDraft(runtime, session(), String(data.id || ''), isPlainObject(data.draft) ? data.draft : {});
  }

  function dismiss(payload) {
    if (!isPlainObject(payload)) throw Error(invalidValue('cartão', payload, 'object {id}'));
    const data = /** @type {Record<string, any>} */ (payload);
    own(data.id);
    const card = cardStore.dismissCard(runtime, session(), data.id);
    emit({type: 'update', conversationId: session(), card});
    return card;
  }

  async function conclude(id) {
    const target = session();
    const begin = cardStore.beginSend(runtime, target, id);
    if (!begin.ok) return {ok: false, code: begin.code || 'refused', card: begin.card || null};
    emit({type: 'sending', conversationId: target, card: begin.card});
    let result;
    try {
      result = await sendText(begin.text, target);
    } catch (error) {
      /* `sendText` devolve os desfechos conhecidos; o que escapa dele é falha
         antes da escrita (connect/validação) — pode reenviar. Incerteza só
         vem marcada. */
      const uncertain = error?.uncertain === true;
      result = {sent: false, retryable: !uncertain, uncertain, error: String(error?.message || error)};
    }
    if (result?.sent === true) {
      const card = cardStore.confirmSend(runtime, target, id);
      emit({type: 'update', conversationId: target, card, sent: true, streaming: result.streaming === true});
      return {ok: true, card, streaming: result.streaming === true};
    }
    /* Só a recusa comprovada reabre o envio. Incerteza continua reservada:
       nunca reenvia sozinha (a mesma regra da entrega do tutor). */
    const proven = result?.retryable === true && result?.uncertain !== true;
    const error = result?.error || 'Não foi possível enviar o resultado ao tutor.';
    const card = cardStore.abortSend(runtime, target, id, proven, error);
    try { appendLog('card', `envio do cartão ${id} recusado: ${error}`); } catch {}
    emit({type: 'failed', conversationId: target, card, retryable: proven, error});
    return {ok: false, card, retryable: proven, error};
  }

  return {show, list, answer, draft, dismiss, conclude};
}

module.exports = {createCardSession};
