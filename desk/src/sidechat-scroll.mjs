// @ts-check
/* Seguir o fim do chat lateral (#release OpenCode, item 15): a mesma regra da
   coluna do tutor, mas o lateral tem o próprio scroller e o próprio estado.
   O aluno manda: se ele subiu, nada é puxado; se está no fim, qualquer mudança
   de altura (texto final, figura carregando, cartão) acompanha. O scroll que o
   próprio código pediu é ignorado mesmo se o evento chegar atrasado. */

const THRESHOLD = 80;

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

  const distance = () => element.scrollHeight - element.scrollTop - element.clientHeight;
  const onScroll = () => {
    if (ownTop != null && Math.abs(element.scrollTop - ownTop) <= 1) { ownTop = null; return; }
    ownTop = null;
    following = distance() <= THRESHOLD;
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
  watch();
  return { scrollBottom, isFollowing: () => following, setFollowing: (value) => { following = Boolean(value); } };
}
