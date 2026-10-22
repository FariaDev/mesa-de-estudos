/* Quando a contagem de sobreposições muda, a view do GeoGebra precisa saber
   (ggb.mjs). Antes da #67 o observador contava as sobreposições a cada mudança
   de classe no documento, com ou sem GeoGebra aberto: numa sessão de 1000
   mensagens isso era um `querySelectorAll` no DOM inteiro a cada turno. Agora
   só conta com a view ligada. Desligada, esquece a última contagem, para a
   primeira mudança depois de religar sempre mandar o estado. */

/**
 * Monta o callback do MutationObserver das sobreposições.
 * @param {{active: () => boolean, count: () => number, onChange: () => void}} deps
 *   `active`: a view do GeoGebra está ligada; `count`: sobreposições abertas
 *   agora; `onChange`: reenviar o estado da view
 * @returns {() => void}
 * @example new MutationObserver(overlayWatch({active: () => S.ggbActive, count: openOverlays, onChange: sendGgbRect}))
 */
function overlayWatch({active, count, onChange}) {
  let last = -1;
  return () => {
    if (!active()) { last = -1; return; }
    const now = count();
    if (now === last) return;
    last = now;
    onChange();
  };
}

export {overlayWatch};
