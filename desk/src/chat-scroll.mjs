/** Folga de `atBottom` em `state.mjs`: dentro dela a vista ainda está no fim. */
export const CHAT_SCROLL_THRESHOLD = 80;

/**
 * Decide a rolagem da coluna do tutor. Curso e aba Livre usam a mesma coluna.
 * O DOM fica no aplicador: aqui só entram a intenção, a distância ao fim
 * (medida antes de crescer o conteúdo) e se o aluno ainda está seguindo.
 *
 * `send` leva a vista até a mensagem enviada e religa o seguir.
 * `stream` segue o fim só enquanto `following` — a distância depois do token
 * novo parece que o aluno subiu, então não serve para decidir.
 * `scroll` liga o seguir quando a vista volta ao fim e só desliga por gesto
 * real do aluno (`userScroll`): rolagem de layout, âncora nativa, clamp por
 * encolhimento e `followBottom` nunca desligam.
 * `history` segue só se a vista já estava no fim antes do lote.
 * @param {{intent?: 'send'|'stream'|'history'|'scroll', distanceFromEnd?: number, following?: boolean, threshold?: number, userScroll?: boolean}} [facts]
 * @returns {{following: boolean, alignSent: boolean, followEnd: boolean}}
 * @example chatFollowDecision({intent: 'send'}) // {following: true, alignSent: true, followEnd: false}
 */
export function chatFollowDecision({intent = 'stream', distanceFromEnd = 0, following = false, threshold = CHAT_SCROLL_THRESHOLD, userScroll = true} = {}) {
  const near = Number(distanceFromEnd) <= threshold;
  if (intent === 'send') return {following: true, alignSent: true, followEnd: false};
  if (intent === 'scroll') {
    if (near) return {following: true, alignSent: false, followEnd: false};
    if (!userScroll) return {following: Boolean(following), alignSent: false, followEnd: false};
    return {following: false, alignSent: false, followEnd: false};
  }
  if (intent === 'history') return {following: near, alignSent: false, followEnd: near};
  return {following: Boolean(following), alignSent: false, followEnd: Boolean(following)};
}

/**
 * Janela em que um `scroll` conta como gesto do aluno. Só o relógio não basta:
 * o `scroll` sai no quadro seguinte, e com o quadro atrasado (medi 2,9 s depois
 * do PageUp, com a tecla entregue em 8 ms) a janela fechava antes de o evento
 * chegar, o seguir não desligava e o stream puxava o aluno de volta. Por isso
 * ela fica aberta até passar o tempo E rodarem `minFrames` quadros.
 * @param {{windowMs?: number, minFrames?: number, now?: () => number, requestFrame?: (run: () => void) => unknown}} [options]
 * @returns {{mark: () => void, isOpen: () => boolean}}
 * @example const gesture = createGestureWindow(); gesture.mark(); gesture.isOpen() // true
 */
export function createGestureWindow({windowMs = 1000, minFrames = 3, now = () => Date.now(), requestFrame = (run) => requestAnimationFrame(run)} = {}) {
  let markedAt = -Infinity, frames = minFrames, counting = false;
  const countFrame = () => {
    frames += 1;
    if (frames < minFrames) { requestFrame(countFrame); return; }
    counting = false;
  };
  return {
    mark() {
      markedAt = now();
      frames = 0;
      if (counting) return;
      counting = true;
      requestFrame(countFrame);
    },
    isOpen: () => now() - markedAt <= windowMs || frames < minFrames
  };
}
