// @ts-check
/* Seguir o fim do chat lateral (#release OpenCode, item 15): a mesma regra da
   coluna do tutor, mas o lateral tem o próprio scroller e o próprio estado.
   O aluno manda por gesto real (roda, toque, teclado, arrastar a barra): se
   ele subiu, nada é puxado; se está no fim, qualquer mudança de altura
   (texto final, figura carregando, cartão) acompanha. O scroll que o próprio
   código pediu é ignorado mesmo se o evento chegar atrasado; rolagem de
   layout sem gesto nunca desliga. */
import {CHAT_SCROLL_THRESHOLD,chatFollowDecision,createGestureWindow} from './chat-scroll.mjs';

const SCROLL_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End',' ']);

/**
 * Liga o acompanhamento do fim a um scroller do chat lateral.
 * @param {HTMLElement} element `#sidechat-messages`
 * @returns {{scrollBottom: (follow?: boolean) => void, isFollowing: () => boolean, setFollowing: (value: boolean) => void}}
 * @example const scroll=createSidechatScroll(msgsEl); scroll.scrollBottom(true);
 */
export function createSidechatScroll(element) {
  let following = true;
  let ownTop = null;
  let resize = null;
  let mutations = null;
  let frame = 0;
  let pointerHeld = false;
  const gesture = createGestureWindow();
  const markUser = () => { gesture.mark(); };
  const isUser = () => pointerHeld || gesture.isOpen();
  const inside = (target) => {
    if (!target) return false;
    try { return target === element || element.contains(target); } catch { return false; }
  };

  const distance = () => element.scrollHeight - element.scrollTop - element.clientHeight;
  const onScroll = () => {
    if (ownTop != null && Math.abs(element.scrollTop - ownTop) <= 1) { ownTop = null; return; }
    ownTop = null;
    const far = distance() > CHAT_SCROLL_THRESHOLD;
    if (!far) {
      following = chatFollowDecision({intent: 'scroll', distanceFromEnd: distance(), following, userScroll: true}).following;
      return;
    }
    if (!isUser()) return;
    following = chatFollowDecision({intent: 'scroll', distanceFromEnd: distance(), following, userScroll: true}).following;
  };
  const followFrame = () => {
    if (!following || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!following) return;
      element.scrollTop = element.scrollHeight;
      ownTop = element.scrollTop;
    });
  };
  const watch = () => {
    if (resize) return;
    const observed = new WeakSet();
    const observeChildren = () => {
      for (const child of element.children) {
        if (observed.has(child)) continue;
        observed.add(child);
        resize.observe(child);
      }
    };
    resize = new ResizeObserver(followFrame);
    mutations = new MutationObserver(observeChildren);
    mutations.observe(element, { childList: true });
    observeChildren();
  };
  const scrollBottom = (follow = following) => {
    if (!follow) return;
    following = true;
    element.scrollTop = element.scrollHeight;
    ownTop = element.scrollTop;
  };

  element.addEventListener('scroll', onScroll, { passive: true });
  element.addEventListener('wheel', markUser, { passive: true });
  element.addEventListener('touchmove', markUser, { passive: true });
  element.addEventListener('pointerdown', () => { pointerHeld = true; markUser(); });
  for (const end of ['pointerup', 'pointercancel']) element.addEventListener(end, () => { pointerHeld = false; });
  element.addEventListener('keydown', (event) => {
    if (!SCROLL_KEYS.has(event.key)) return;
    if (inside(event.target) || inside(document.activeElement)) markUser();
  });
  watch();
  return { scrollBottom, isFollowing: () => following, setFollowing: (value) => { following = Boolean(value); } };
}
