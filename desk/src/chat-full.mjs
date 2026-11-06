/* Chat na tela inteira (#98): estado de interface GLOBAL, não por aba, e só da
   execução aberta — não entra no `layoutSnapshot` nem no `localStorage`. O
   `body.chat-full` esconde a área de referências (os leitores só saem de vista;
   PDF, página e zoom continuam vivos) e centra a coluna do tutor.

   O módulo é só o fato e a classe no `body`; quem decide o que fazer com o
   tutor recolhido e com o chat lateral é o `main.mjs`/`tutor-header.mjs`. */

const COMBO_KEY = 'e';
let full = false;
let surface = null;

/** O main entrega como reabrir a coluna do tutor (o modo não existe recolhido).
 * @param {{expandTutor?: () => void} | null} next
 * @returns {typeof next}
 * @example registerChatFullSurface({expandTutor: () => setChatCollapsed(false)})
 */
export function registerChatFullSurface(next) {
  surface = next && typeof next === 'object' ? next : null;
  return surface;
}

/** Se o chat está na tela inteira agora.
 * @returns {boolean}
 * @example isChatFull() // false no boot
 */
export function isChatFull() {
  return full;
}

/** Liga ou desliga o modo, sem tocar no layout dos leitores.
 * @param {boolean} value
 * @returns {boolean} o estado final
 * @example setChatFull(true); document.body.classList.contains('chat-full') // true
 */
export function setChatFull(value) {
  const next = value === true;
  if (next === full) return full;
  full = next;
  document.body.classList.toggle('chat-full', full);
  window.dispatchEvent(new CustomEvent('desk-chat-full-changed', {detail: {full}}));
  return full;
}

/** Alterna o modo; entrar com o tutor recolhido reabre a coluna primeiro.
 * @returns {boolean} o estado final
 * @example toggleChatFull()
 */
export function toggleChatFull() {
  if (!full) surface?.expandTutor?.();
  return setChatFull(!full);
}

/* O atalho é global e vale em qualquer aba, inclusive a Livre. A tecla padrão
   é `Mod+Shift+E`; o preload do editor de atalhos reenvia este mesmo evento
   quando a pessoa troca o combo. Diálogo aberto não alterna (o resto do app
   também ignora atalhos de fundo com modal). */
function onKey(event) {
  if (event.defaultPrevented || event.isComposing || document.querySelector('dialog[open]')) return;
  if (!(event.ctrlKey || event.metaKey) || event.altKey || !event.shiftKey) return;
  if (String(event.key || '').toLowerCase() !== COMBO_KEY) return;
  event.preventDefault();
  toggleChatFull();
}

/** Liga o atalho e guarda a superfície que reabre a coluna.
 * @param {{expandTutor?: () => void}} next
 * @returns {void}
 * @example initChatFull({expandTutor: () => setChatCollapsed(false)})
 */
export function initChatFull(next) {
  registerChatFullSurface(next);
  window.addEventListener('keydown', onKey, true);
}
