// @ts-check
'use strict';

/* Identidade do histórico exibido (#115). A abertura de conversa mostra o
   cache do descritor e, logo depois, o `pi-connect` entrega o histórico do
   motor. Quando os dois são o mesmo conteúdo, o renderer não remonta a lista
   (e o main não reenvia as mensagens). A chave precisa ser conservadora: só
   pula a montagem quando TUDO que a tela mostra é igual — uma mensagem nova,
   um texto trocado no meio ou um cartão diferente mudam a identidade.

   Só campos de exibição entram: `uuid`/`id` ficam de fora (o descritor perde
   o uuid ao normalizar, e o mesmo histórico nativo chega com ele), assim como
   metadados que o renderer não lê. Texto, imagens, ferramentas, resultados,
   `details` (os links de busca do registro), tempos e cartões entram; o hash final evita payload gigante na comparação. */

const crypto = require('node:crypto');

/* Timestamp como o `historyTurns` lê: epoch em `timestamp`, senão data textual. */
function stampOf(message) {
  const ts = Number(message?.timestamp);
  if (Number.isFinite(ts) && ts > 0) return ts;
  const parsed = Date.parse(message?.createdAt || message?.created_at || '') || 0;
  return parsed > 0 ? parsed : 0;
}

/* Objetos com a mesma chave em ordem diferente produzem o mesmo JSON. */
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
  return out;
}

function textOf(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : String(item?.text || '')).filter(Boolean).join('\n');
  return value == null ? '' : String(value);
}

function partStamp(part) {
  if (typeof part === 'string') return ['text', part];
  if (!part || typeof part !== 'object') return ['', String(part ?? '')];
  const type = String(part.type || '');
  if (type === 'text') return [type, String(part.text ?? '')];
  if (type === 'thinking') return [type, String(part.thinking ?? part.text ?? '')];
  if (type === 'image') return [type, String(part.mimeType || ''), String(part.source || ''), String(part.url || ''), String(part.data || '')];
  if (type === 'toolCall') return [type, String(part.id || ''), String(part.name || ''), part.argumentsTruncated === true, stableValue(part.arguments ?? {})];
  if (type === 'toolResult') return [type, String(part.toolCallId || ''), textOf(part.text ?? part.content), part.isError === true];
  return [type, stableValue(part)];
}

function contentStamp(content) {
  if (typeof content === 'string') return [['text', content]];
  if (!Array.isArray(content)) return [];
  return content.map(partStamp);
}

function messageStamp(message) {
  if (!message || typeof message !== 'object') return ['', 0];
  return [String(message.role || ''), stampOf(message), String(message.toolCallId || ''), message.isError === true, contentStamp(message.content), stableValue(message.details ?? null)];
}

/* A mesma ordem que o `showHistory` usa para colocar os cartões na conversa. */
function cardStamp(card) {
  return stableValue({id: card.id, createdAt: Number(card.createdAt), card});
}

/**
 * Identidade estável do que a conversa mostra. Mesma sessão + mesmas mensagens
 * de exibição + mesmos cartões devolvem a mesma string; qualquer diferença de
 * conteúdo devolve outra.
 * @param {{session?: string, messages?: any[], cards?: any[]}} [history]
 * @returns {string}
 * @example historyIdentity({session: '/rt/opencode-a.json', messages, cards}) // 'Q2...'
 */
function historyIdentity({session = '', messages = [], cards = []} = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const cardList = Array.isArray(cards) ? cards : [];
  const orderedCards = cardList
    .filter(card => card && typeof card.id === 'string' && Number.isFinite(Number(card.createdAt)))
    .sort((left, right) => Number(left.createdAt) - Number(right.createdAt))
    .map(cardStamp);
  const payload = JSON.stringify([String(session || ''), list.map(messageStamp), orderedCards]);
  return crypto.createHash('sha256').update(payload).digest('base64url');
}

module.exports = {historyIdentity};
