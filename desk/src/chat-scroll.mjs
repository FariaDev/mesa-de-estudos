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
 * `scroll` liga o seguir quando a vista volta ao fim e desliga quando sai.
 * `history` segue só se a vista já estava no fim antes do lote.
 * @param {{intent?: 'send'|'stream'|'history'|'scroll', distanceFromEnd?: number, following?: boolean, threshold?: number}} [facts]
 * @returns {{following: boolean, alignSent: boolean, followEnd: boolean}}
 * @example chatFollowDecision({intent: 'send'}) // {following: true, alignSent: true, followEnd: false}
 */
export function chatFollowDecision({intent = 'stream', distanceFromEnd = 0, following = false, threshold = CHAT_SCROLL_THRESHOLD} = {}) {
  const near = Number(distanceFromEnd) <= threshold;
  if (intent === 'send') return {following: true, alignSent: true, followEnd: false};
  if (intent === 'scroll') return {following: near, alignSent: false, followEnd: false};
  if (intent === 'history') return {following: near, alignSent: false, followEnd: near};
  return {following: Boolean(following), alignSent: false, followEnd: Boolean(following)};
}
