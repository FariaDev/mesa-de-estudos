// @ts-check
'use strict';

/* O que os motores nativos (Claude e OpenCode; #57) gravam no descritor: a
   fase da entrega, as mensagens com a prévia e a escolha de modelo/esforço.
   Uma fonte só para os dois `connect` do `tutor-bridge-host.cjs`. */

const conversations = require('./conversations.cjs');

/**
 * @typedef {import('../../types/agent').AgentMessage} AgentMessage
 */

/**
 * A primeira fala do aluno, cortada para a lista de sessões.
 * @param {AgentMessage[]} messages @param {string} fallback
 * @returns {string}
 * @example previewOf([{role: 'user', content: [{type: 'text', text: 'oi'}]}], '') // 'oi'
 */
function previewOf(messages, fallback) {
  const first = messages.find((item) => item.role === 'user');
  const text = first?.content?.find((part) => part.type === 'text');
  return (text && 'text' in text ? String(text.text).slice(0, 160) : '') || fallback;
}

/**
 * Os retornos de gravação de uma conversa nativa.
 * @param {{descriptor: string, runtime: string, preview?: string}} options
 * @returns {{persistDelivery: (delivery: {id: string, status: string}) => void,
 *   onMessages: (messages: AgentMessage[], meta: {importedPrefixLength: number}) => void,
 *   onSelection: (patch: object) => void}}
 * @example const persistence = nativePersistence({descriptor: live.session, runtime, preview: record.preview});
 */
function nativePersistence({descriptor, runtime, preview = ''}) {
  return {
    persistDelivery(delivery) {
      conversations.updateClaudeConversation(descriptor, {delivery, ...(delivery.status === 'accepted' ? {nativeEstablished: true} : {})}, {runtime});
    },
    onMessages(messages, meta) {
      conversations.updateClaudeConversation(descriptor, {messages, importedPrefixLength: meta.importedPrefixLength, preview: previewOf(messages, preview)}, {runtime});
    },
    onSelection(patch) {
      conversations.updateClaudeConversation(descriptor, patch, {runtime});
    },
  };
}

module.exports = {nativePersistence, previewOf};
