/* Destino de um item da fila enviado como steer (o "Enviar agora" da linha).
   Decisão pura, separada do `queue.mjs` para testar sem DOM: o transporte só
   devolve `safe` quando PROVA que nada foi escrito (`notSent`, recusa antes do
   aceite) — aí o item volta à posição original, porque o aluno ainda precisa
   dele. Sem essa prova, a mensagem pode ter chegado: devolvê-la à fila a
   reenviaria no fim do turno e o aluno receberia a mesma fala duas vezes; por
   isso ela fica fora do disco e a fila é segurada (mesma política do
   `queue-retry` com entrega incerta). */

/**
 * O que fazer com o item depois de tentar enviá-lo como steer.
 * `delivered` = aceite (nada volta); `restore` = recusa provada (volta à fila);
 * `hold` = entrega incerta (não volta; a fila fica segurada).
 * @param {boolean} posted o transporte aceitou a mensagem
 * @param {boolean} safe o transporte provou que nada foi entregue
 * @returns {'delivered' | 'restore' | 'hold'}
 * @example
 * steerQueuedOutcome(false, true); // 'restore'
 */
export function steerQueuedOutcome(posted, safe) {
  if (posted) return 'delivered';
  return safe ? 'restore' : 'hold';
}

/**
 * Devolve o item à posição original da fila, limitada ao tamanho de agora
 * (outras linhas podem ter saído enquanto o steer voava).
 * @param {Array<object>} items fila viva
 * @param {object} item item que voltou
 * @param {number} at índice guardado antes do envio
 * @returns {number} índice em que o item entrou
 * @example
 * const queue = [{id: 'a'}, {id: 'c'}];
 * restoreQueuedAt(queue, {id: 'b'}, 1); // 1; fila [a, b, c]
 */
export function restoreQueuedAt(items, item, at) {
  const wanted = Number.isInteger(at) ? at : items.length;
  const index = Math.max(0, Math.min(wanted, items.length));
  items.splice(index, 0, item);
  return index;
}
