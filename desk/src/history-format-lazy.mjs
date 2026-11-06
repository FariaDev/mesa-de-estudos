/* Formatação preguiçosa do histórico (#118): a conversa longa nasce como texto
   real no DOM e o rico (Markdown + KaTeX + sanitize) entra ao chegar perto da
   vista, via `IntersectionObserver` com margem generosa. Nada é desmontado:
   a seleção, o leitor de tela e a citação leem o texto cru. A bolha viva do
   stream nunca passa por aqui (só o `showHistory` arma o lote) e o fim da
   conversa — o que abre primeiro — é formatado na montagem.

   Chave de segurança: `HISTORY_LAZY_FORMAT_ENABLED`. Desligada, tudo volta ao
   desenho direto de sempre, sem outro custo. */
import {aroundHistoryLayout, setHistoryAnchorScroller, setHistoryAnchorWanted, stopHistoryAnchor} from './history-scroll-anchor.mjs';

export const HISTORY_LAZY_FORMAT_ENABLED = true;
/* Conversa curta continua igual, com formatação direta: sem custo novo e sem
   risco (#118). Conta mensagens, não bolhas. */
export const HISTORY_LAZY_SHORT_LIMIT = 200;
/* Fim formatado desde o início: cobre a primeira tela (a abertura mostra o
   fim) antes do observador disparar. Conta bolhas, não mensagens. */
export const HISTORY_LAZY_TAIL_BUBBLES = 60;
/* Margem generosa: o rico entra antes de a bolha aparecer. */
export const HISTORY_LAZY_MARGIN = '1200px 0px';

let generation = 0;
let armed = false;
let observer = null;
let scrollerOf = null;
const pending = new Set();
const formats = new WeakMap();
/* Seleção em curso (#118): formatar troca os nós e derruba a seleção. A casca
   tocada pela seleção fica pendente e tenta de novo quando a seleção sair. */
const deferred = new Set();
let selectionWatcher = null;

function disconnectLocked() {
  if (observer) observer.disconnect();
  observer = null;
}
function syncAnchorNeed() {
  setHistoryAnchorWanted(pending.size > 0);
}

/**
 * Totais para teste e diagnóstico (sonda, UI).
 * @returns {{enabled: boolean, armed: boolean, generation: number, pending: number}}
 * @example lazyStats().pending // cascas aguardando o observador
 */
export function lazyStats() {
  return {enabled: HISTORY_LAZY_FORMAT_ENABLED, armed, generation, pending: pending.size};
}

/**
 * Cascas adiadas pela seleção em curso (regressão do item 5).
 * @returns {number}
 * @example lazyDeferredCount() // 0 sem seleção tocando casca
 */
export function lazyDeferredCount() {
  return deferred.size;
}

/**
 * Decide sem DOM se o histórico deve nascer em casca (teste unitário).
 * @param {unknown} messageCount quantas mensagens o `showHistory` vai montar
 * @returns {boolean} ex.: shouldDeferHistory(5000) // true
 */
export function shouldDeferHistory(messageCount) {
  return HISTORY_LAZY_FORMAT_ENABLED === true
    && Number.isFinite(Number(messageCount))
    && Number(messageCount) > HISTORY_LAZY_SHORT_LIMIT;
}

/**
 * Arma o lote do `showHistory`: zera o observador anterior e conta a geração
 * nova (conversa errada nunca formata: a casca guarda a geração do lote).
 * @param {unknown} messageCount quantas mensagens vão montar
 * @param {(() => {scrollTop: number, scrollHeight: number, getBoundingClientRect: () => {top: number, bottom: number}}|null)|null} [getScroller]
 * @returns {{armed: boolean, generation: number}}
 * @example const batch = beginLazyHistory(messages.length, messageScroller)
 */
export function beginLazyHistory(messageCount, getScroller = null) {
  generation += 1;
  disconnectLocked();
  stopHistoryAnchor();
  pending.clear();
  /* Remontagem por `showHistory` sem `desk-conversation-changed`: a seleção
     adiada da conversa velha não vaza para a nova (#118 item 5). */
  deferred.clear();
  dropLazySelectionWatcher();
  scrollerOf = typeof getScroller === 'function' ? getScroller : null;
  setHistoryAnchorScroller(scrollerOf);
  syncAnchorNeed();
  armed = shouldDeferHistory(messageCount);
  return {armed, generation};
}

/**
 * Troca de conversa (ou saída antes de formatar): nada pendente vaza para a
 * conversa nova e o observador velho morre aqui. O módulo se registra sozinho
 * no evento; o `showHistory` seguinte rearma com outra geração.
 * @returns {void}
 * @example window.dispatchEvent(new Event('desk-conversation-changed')) // cancela o lote
 */
export function cancelLazyHistory() {
  generation += 1;
  disconnectLocked();
  stopHistoryAnchor();
  pending.clear();
  deferred.clear();
  dropLazySelectionWatcher();
  armed = false;
  scrollerOf = null;
  setHistoryAnchorScroller(null);
  syncAnchorNeed();
}

/* A seleção atual toca a bolha (o `range` cruza o nó ou a âncora/o foco mora
   dentro dela). Sem seleção, sem janela ou sem `getSelection`, não toca. */
function lazySelectionTouches(el) {
  try {
    if (!el || typeof window === 'undefined' || typeof window.getSelection !== 'function') return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index);
      if (range && typeof range.intersectsNode === 'function') {
        try {
          if (range.intersectsNode(el)) return true;
        } catch {
          /* `intersectsNode` estranha o nó solto: cai para o `contains`. */
        }
      }
      if (selection.anchorNode && el.contains(selection.anchorNode)) return true;
      if (selection.focusNode && el.contains(selection.focusNode)) return true;
      if (range && range.commonAncestorContainer && el.contains(range.commonAncestorContainer)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/* O `selectionchange` dispara no `document` (o `window` não o recebe em todos
   os Chromiums): o ouvinte vai no `document`, com volta ao `window`. */
function selectionTarget() {
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') return document;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') return window;
  return null;
}

function dropLazySelectionWatcher() {
  if (!selectionWatcher) return;
  if (deferred.size !== 0) return;
  try {
    selectionTarget()?.removeEventListener('selectionchange', selectionWatcher);
  } catch {
    /* sair sem vigia: nada a limpar. */
  }
  selectionWatcher = null;
}

function flushDeferredLazyShells() {
  if (deferred.size === 0) {
    dropLazySelectionWatcher();
    return;
  }
  for (const el of [...deferred]) {
    if (!el || !el.isConnected) {
      deferred.delete(el);
      formats.delete(el);
      pending.delete(el);
      continue;
    }
    if (lazySelectionTouches(el)) continue;
    deferred.delete(el);
    formatLazyShell(el);
  }
  dropLazySelectionWatcher();
}

function ensureLazySelectionWatcher() {
  const target = selectionTarget();
  if (selectionWatcher || !target) return;
  selectionWatcher = () => {
    flushDeferredLazyShells();
  };
  target.addEventListener('selectionchange', selectionWatcher);
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('desk-conversation-changed', cancelLazyHistory);
}

/**
 * O `message()` pergunta ao montar cada bolha do histórico.
 * @returns {boolean} ex.: if (deferLazyBubble()) return lazyShell(el, text, images, parent)
 */
export function deferLazyBubble() {
  return armed && HISTORY_LAZY_FORMAT_ENABLED === true;
}

function lazyObserver() {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        formatLazyShell(entry.target);
      }
    }, {root: null, rootMargin: HISTORY_LAZY_MARGIN, threshold: 0});
  }
  return observer;
}

/**
 * Registra a casca: o observador formata ao chegar perto da vista.
 * Sem `IntersectionObserver`, formata na hora (nunca deixa cru sem vigia).
 * @param {Element} el a bolha com o texto cru
 * @param {() => void} format pinta o rico (o mesmo caminho do desenho direto)
 * @returns {void}
 * @example watchLazyShell(el, () => updateMessage(el, el._raw, images))
 */
export function watchLazyShell(el, format) {
  if (!armed || typeof IntersectionObserver === 'undefined' || typeof format !== 'function') {
    if (typeof format === 'function') format();
    return;
  }
  el.setAttribute('data-lazy-shell', String(generation));
  formats.set(el, {gen: generation, format});
  pending.add(el);
  syncAnchorNeed();
  lazyObserver().observe(el);
}

/**
 * Formata uma casca agora, com a âncora de rolagem: o que estava acima da
 * vista cresce sem mover o pixel que o aluno lê. Fora da conversa (nó solto)
 * ou de outra geração, não faz nada.
 * @param {Element|null|undefined} el a bolha em casca
 * @returns {boolean} ex.: formatLazyShell(oldest) // true quando pintou
 */
export function formatLazyShell(el) {
  /* Seleção dentro da casca: não formata agora — deixa pendente e tenta de
     novo quando a seleção sair (`selectionchange`, um ouvinte só). */
  if (el && lazySelectionTouches(el)) {
    deferred.add(el);
    ensureLazySelectionWatcher();
    return false;
  }
  const slot = el ? formats.get(el) : undefined;
  formats.delete(el);
  pending.delete(el);
  deferred.delete(el);
  if (deferred.size === 0) dropLazySelectionWatcher();
  if (!slot || !el.isConnected) {
    syncAnchorNeed();
    return false;
  }
  if (el.getAttribute('data-lazy-shell') == null) {
    syncAnchorNeed();
    return false;
  }
  if (Number(el.getAttribute('data-lazy-shell')) !== slot.gen || slot.gen !== generation) {
    syncAnchorNeed();
    return false;
  }
  const scroller = typeof scrollerOf === 'function' ? scrollerOf() : null;
  if (!scroller || typeof scroller.getBoundingClientRect !== 'function') {
    slot.format();
    el.removeAttribute('data-lazy-shell');
    syncAnchorNeed();
    return true;
  }
  /* A âncora mede o primeiro filho visível antes e depois; o delta de
     `scrollHeight` de uma vez só não via a altura real do `content-visibility`
     chegar no quadro seguinte (#118). */
  aroundHistoryLayout(scroller, () => slot.format());
  el.removeAttribute('data-lazy-shell');
  syncAnchorNeed();
  return true;
}

/**
 * Fecha o lote do `showHistory`: desarma (a bolha viva nunca é adiada) e pinta
 * o fim na hora — é o que abre primeiro. O resto fica com o observador.
 * @param {ParentNode|null|undefined} root o `#messages` recém-montado
 * @returns {{total: number, tail: number}} ex.: finishLazyHistory(box) // {total: 3690, tail: 60}
 */
export function finishLazyHistory(root) {
  armed = false;
  if (!root || typeof root.querySelectorAll !== 'function') return {total: 0, tail: 0};
  const shells = [...root.querySelectorAll('.message[data-lazy-shell]')]
    .filter((el) => Number(el.getAttribute('data-lazy-shell')) === generation);
  for (const el of shells.slice(-HISTORY_LAZY_TAIL_BUBBLES)) formatLazyShell(el);
  return {total: shells.length, tail: Math.min(shells.length, HISTORY_LAZY_TAIL_BUBBLES)};
}


