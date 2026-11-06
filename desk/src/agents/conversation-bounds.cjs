'use strict';

/* Tetos do `messages` do descritor; o serviço usa os mesmos para manter a fronteira importado/nativo. */
const MAX_MESSAGES_BYTES = 12 * 1024 * 1024;
const MAX_MESSAGE_COUNT = 5000;

/* Teto de `messages`: mantém as mais novas; corta do começo. Metadados de
   entrega/incerteza ficam fora dessa conta e nunca são cortados. */
function boundMessages(messages) {
  const list = (Array.isArray(messages) ? messages : []).slice(-MAX_MESSAGE_COUNT);
  // Array framing is two brackets plus one comma between each row. Count
  // UTF-8 bytes from newest to oldest without reserializing large images for
  // every discarded prefix row. The retained suffix has the same byte cap.
  let total = 2, start = list.length;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const framing = start < list.length ? 1 : 0;
    let next = total + rowBytes(list[i]) + framing;
    /* Antes de perder a conversa, perde a imagem: a mensagem antiga fica com o
       texto. Guardar todas as imagens (#117) faz o teto chegar mais cedo. */
    if (next > MAX_MESSAGES_BYTES) {
      const textOnly = withoutImages(list[i]);
      next = total + rowBytes(textOnly) + framing;
      if (next > MAX_MESSAGES_BYTES) break;
      list[i] = textOnly;
    }
    total = next;
    start = i;
  }
  return list.slice(start);
}

function rowBytes(row) {
  return Buffer.byteLength(JSON.stringify(row) ?? 'null', 'utf8');
}

function withoutImages(row) {
  if (!Array.isArray(row?.content) || !row.content.some((part) => part?.type === 'image')) return row;
  return {...row, content: row.content.filter((part) => part?.type !== 'image')};
}

module.exports = {MAX_MESSAGES_BYTES, MAX_MESSAGE_COUNT, boundMessages};
