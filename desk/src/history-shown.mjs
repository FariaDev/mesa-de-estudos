/* O que `#messages` mostra veio de qual histórico (#115). O main só deixa de
   reenviar as mensagens quando a identidade pedida bate com a do motor, então
   ela só pode ser pedida enquanto a lista ainda é a da montagem: lista esvaziada
   (reabrir sem cache) mostraria conversa em branco, e bolha nova (turno, parcial
   de uma queda) ficaria na tela sem a remontagem que a limpava. */

/**
 * Lembra a identidade da última montagem e a invalida se a lista mudou.
 * @param {() => ({childElementCount: number}|null|undefined)} list
 * @returns {{mark: (identity: string|null) => void, current: () => string|null}}
 * @example const shown=createShownHistory(()=>box); shown.mark('abc'); shown.current() // 'abc'
 */
export function createShownHistory(list) {
  let identity = null;
  let count = 0;
  const countNow = () => list()?.childElementCount || 0;
  return {
    mark(next) {
      identity = next;
      count = countNow();
    },
    current() {
      const now = countNow();
      return identity && now > 0 && now === count ? identity : null;
    },
  };
}
