import {LANGUAGE_EVENT} from './ui-text.mjs';

/* Status do leitor vazio ("Nenhum material"/"No material", auditoria de
   UI/UX rodada 6, P1): o rótulo tem prioridade e pinta com a largura natural;
   o status aparece inteiro ou some da vista (segue no DOM com o nome
   acessível) — nunca truncado ("Nenhu…"/"N…"). Uma faixa fixa de container
   query não basta porque o rótulo muda de tamanho com o idioma, então a
   decisão é medida na barra real: soma das larguras naturais (rótulo + status
   + Mais opções, com recuos e folgas do CSSOM) contra a largura da barra. Se
   não cabe, o painel marca `data-status-hidden` e o CSS tira o status de
   vista (clip visual). O "Mais opções" continua como está. Reavaliado a cada
   resize da barra (janela, divisor do chat), na troca de idioma e quando as
   fontes assentam. Só lê o layout (nenhuma mutação dentro do ResizeObserver,
   onde a leitura após mutação sai obsoleta no Chromium). */

/** Largura natural do texto da opção selecionada, com os recuos e bordas do
 *  seletor (um span fora da barra, com a mesma fonte).
 *  @param {Element} select o `.pdf-select`
 *  @returns {number} px
 *  @example statusNaturalWidth(select) // 122.7
 */
export function statusNaturalWidth(select) {
  const style = getComputedStyle(select);
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font};letter-spacing:${style.letterSpacing};padding:${style.padding};border:0;`;
  probe.textContent = select.selectedOptions[0]?.textContent || '';
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width
    + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  probe.remove();
  return width;
}

/** @param {Element} panel o `.pdf-panel`
 *  @returns {boolean} true quando rótulo + status + Mais opções cabem na barra
 *  @example statusFitsReader(panel) // false numa barra de 294 px
 */
export function statusFitsReader(panel) {
  const bar = panel.querySelector(':scope > .pdf-title');
  const strong = panel.querySelector(':scope > .pdf-title > strong');
  const select = panel.querySelector(':scope > .pdf-title > .pdf-select');
  const more = panel.querySelector(':scope > .pdf-title > .more');
  if (!bar || !strong || !select || !more) return true;
  /* Sem mutação: escondido, só `transform` tira de vista — recuo, borda e fonte
     continuam os do estado à vista, então a régua lê os mesmos valores com o
     status visível ou não (a mutação temporária lia estilo obsoleto). */
  const barStyle = getComputedStyle(bar);
  const gap = parseFloat(barStyle.columnGap) || 0;
  const visible = [strong, select, more].filter((el) => el.getClientRects().length > 0);
  let needed = parseFloat(barStyle.paddingLeft) + parseFloat(barStyle.paddingRight) + gap * Math.max(0, visible.length - 1);
  for (const el of visible) {
    const style = getComputedStyle(el);
    const natural = el === select ? statusNaturalWidth(el) : el.getBoundingClientRect().width;
    needed += natural + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
  }
  const fits = needed <= bar.clientWidth + 1;
  return fits;
}

/** Aplica (ou tira) o `data-status-hidden` conforme a medida da barra.
 *  Escondido, o seletor também sai da ordem de tab (nada de foco invisível num
 *  alvo 0×0); à vista, volta ao normal. O nome acessível segue no DOM.
 *  @param {Element} panel o `.pdf-panel`
 *  @returns {boolean} true quando o status ficou escondido
 *  @example fitReaderStatus(panel);
 */
export function fitReaderStatus(panel) {
  if (!panel || !panel.isConnected) return false;
  const select = panel.querySelector(':scope > .pdf-title > .pdf-select');
  if (!panel.hasAttribute('data-no-material')) {
    panel.removeAttribute('data-status-hidden');
    select?.removeAttribute('tabindex');
    return false;
  }
  const hidden = !statusFitsReader(panel);
  panel.toggleAttribute('data-status-hidden', hidden);
  if (select) {
    if (hidden) select.setAttribute('tabindex', '-1');
    else select.removeAttribute('tabindex');
  }
  return hidden;
}

let languageHooked = false;

/* A medida lê layout e estilo atuais; logo após a entrega do ResizeObserver o
   Chromium ainda devolve valores obsoletos (até o padding do getComputedStyle),
   então a decisão de resize espera a barra assentar: debounce com re-arme, para
   a última mudança sempre ganhar um ajuste após a quietude. E o "visível" pode
   sair de largura transitória (a barra ainda encolhe depois, sem novo aviso):
   por isso o visível passa por até duas re-leituras — o escondido é terminal e
   não pisca. */
const settledTimers = new Map();
function scheduleFit(panel, again = 0) {
  const pending = settledTimers.get(panel);
  if (pending) clearTimeout(pending);
  settledTimers.set(panel, setTimeout(() => {
    settledTimers.delete(panel);
    let hidden = false;
    try {
      hidden = fitReaderStatus(panel);
    } catch (error) {
      window.__fitErrors = (window.__fitErrors || []).concat([String(error?.message || error)]).slice(-10);
    }
    if (!hidden && panel.isConnected && again < 2) scheduleFit(panel, again + 1);
  }, again === 0 ? 120 : 400));
}

/* Um observador só para todas as barras (guardado no módulo: um RO sem
   referência viva pode ser coletado e parar de avisar). */
const barWatcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
  for (const entry of entries) {
    const panel = entry.target.closest?.('.pdf-panel');
    if (panel) scheduleFit(panel);
  }
});

/** Mede agora e reavalia a cada resize da barra.
 *  @param {Element} panel o `.pdf-panel`
 *  @returns {void}
 *  @example observeReaderStatus(panelEl);
 */
export function observeReaderStatus(panel) {
  const bar = panel.querySelector(':scope > .pdf-title');
  if (!bar || !barWatcher) return;
  if (!languageHooked) {
    languageHooked = true;
    window.addEventListener(LANGUAGE_EVENT, () => {
      for (const other of document.querySelectorAll('#pdf-grid .pdf-panel')) fitReaderStatus(other);
    });
  }
  barWatcher.observe(bar);
  fitReaderStatus(panel);
  if (document.fonts?.ready) document.fonts.ready.then(() => fitReaderStatus(panel)).catch(() => {});
}
