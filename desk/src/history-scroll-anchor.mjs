/* Âncora de rolagem do histórico preguiçoso (#118): formatar uma bolha não
   pode mover o que o aluno lê. A âncora nativa do Chromium perde o nó quando
   o `content-visibility: auto` (#67) troca a altura reservada (160px) pela
   altura real num quadro seguinte: o `scrollHeight` não muda no formato, o
   `scrollTop` também não, e a vista anda quando a pintura chega. Aqui a âncora
   é o primeiro filho visível do `#messages`, medida quadro a quadro só
   enquanto existe casca no histórico. O que se move sem ter vindo da rolagem
   do aluno é devolvido ao `scrollTop`; a rolagem dele nunca é desfeita (o
   passo entra na conta e é descontado). Em repouso nenhum quadro roda, e
   conversa curta (sem casca) não liga nada.

   O `overflow-anchor` nativo fica desligado só enquanto o acompanhamento está
   ativo: duas âncoras somando puxariam a vista duas vezes. Volta ao valor
   anterior assim que o layout assenta. */

const SETTLE_FRAMES = 4;
const EPSILON = 0.5;
const OWN_SCROLL_MS = 500;

let getScroller = null;
let wanted = false;
let active = false;
let frame = 0;
let trackedScroller = null;
let anchor = null;
let lastTop = 0;
let lastScroll = 0;
let quietFrames = 0;
let nativeAnchorOwner = null;
let savedOverflowAnchor = '';
const ownScrolls = [];

/**
 * Diferença de layout entre dois quadros, já descontada a rolagem pedida.
 * Positiva quando o conteúdo acima da âncora cresceu (a âncora desceu).
 * @param {{anchorTop: number, previousTop: number, scrollTop: number, previousScroll: number}} facts
 * @returns {number} ex.: anchorDrift({anchorTop: 320, previousTop: 200, scrollTop: 0, previousScroll: 0}) // 120
 * @example anchorDrift({anchorTop: 200, previousTop: 200, scrollTop: 40, previousScroll: 0}) // 0 (só a rolagem do aluno)
 */
export function anchorDrift({anchorTop, previousTop, scrollTop, previousScroll}) {
  return (Number(anchorTop) - Number(previousTop)) + (Number(scrollTop) - Number(previousScroll));
}

/**
 * Liga a âncora ao rolador da conversa (o `showHistory` chama no lote).
 * @param {(() => {scrollTop: number, scrollHeight: number, clientHeight: number, style: object, getBoundingClientRect: () => DOMRect})|null} getter
 * @returns {void}
 * @example setHistoryAnchorScroller(messageScroller)
 */
export function setHistoryAnchorScroller(getter) {
  getScroller = typeof getter === 'function' ? getter : null;
  if (!getScroller) stopHistoryAnchor();
}

/**
 * Diz se ainda há casca no histórico; sem casca a âncora não tem o que vigiar.
 * Zerar não para na hora: a altura adiada do `content-visibility` chega nos
 * quadros seguintes (#118) e o acompanhamento drena até assentar, depois para.
 * A troca de conversa (`cancelLazyHistory`) continua parando na hora via
 * `stopHistoryAnchor`.
 * @param {boolean} value
 * @returns {void}
 * @example setHistoryAnchorWanted(lazyStats().pending > 0)
 */
export function setHistoryAnchorWanted(value) {
  wanted = value === true;
  if (!wanted && !active) stopHistoryAnchor();
  else if (!wanted && active) schedule();
}

/**
 * Se o acompanhamento vigia, conta para teste e sonda.
 * @returns {boolean}
 * @example isHistoryAnchorActive() // false em repouso
 */
export function isHistoryAnchorActive() {
  return active;
}

function scrollerNow() {
  const el = typeof getScroller === 'function' ? getScroller() : null;
  return el && typeof el.getBoundingClientRect === 'function' ? el : null;
}

function pickAnchor(scroller) {
  const root = typeof document !== 'undefined' ? document.querySelector('#messages') : null;
  if (!root || !root.children.length) return null;
  const viewTop = scroller.getBoundingClientRect().top;
  let low = 0;
  let high = root.children.length - 1;
  let found = null;
  /* A âncora é o primeiro filho que começa dentro da vista (o "sentinel" da
     leitura): a bolha parcialmente cortada no topo pode mudar de altura sem
     que o topo dela ande, e aí o que o aluno lê abaixo dela anda sem a medida
     ver. */
  let foundTop = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const box = root.children[middle].getBoundingClientRect();
    if (box.top >= viewTop + 0.5) {
      found = root.children[middle];
      foundTop = box.top;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  if (found) return {el: found, top: foundTop};
  const last = root.children[root.children.length - 1];
  return last ? {el: last, top: last.getBoundingClientRect().top} : null;
}

function disableNativeAnchor(scroller) {
  if (nativeAnchorOwner && nativeAnchorOwner !== scroller) restoreNativeAnchor();
  if (nativeAnchorOwner) return;
  nativeAnchorOwner = scroller;
  savedOverflowAnchor = scroller.style.overflowAnchor || '';
  scroller.style.overflowAnchor = 'none';
}

function restoreNativeAnchor() {
  if (!nativeAnchorOwner) return;
  nativeAnchorOwner.style.overflowAnchor = savedOverflowAnchor;
  nativeAnchorOwner = null;
  savedOverflowAnchor = '';
}

function noteOwnScroll(top) {
  ownScrolls.push({top: Number(top) || 0, at: Date.now()});
  if (ownScrolls.length > 16) ownScrolls.shift();
}

/* Leitura sem consumo: o mesmo `scroll` do Chromium passa por dois ouvintes
   (`chat-scroll-view` e este); se o primeiro consumisse a marca, o segundo
   leria rolagem do aluno. A marca morre por prazo (500 ms). */
function isOwnScroll(top) {
  const now = Date.now();
  const value = Number(top) || 0;
  let found = false;
  for (let index = ownScrolls.length - 1; index >= 0; index--) {
    const entry = ownScrolls[index];
    if (now - entry.at > OWN_SCROLL_MS) {
      ownScrolls.splice(index, 1);
      continue;
    }
    if (Math.abs(entry.top - value) <= 1) found = true;
  }
  return found;
}

/**
 * Fonte única da "rolagem nossa" (#118 item 3): o `followBottom` e o
 * `revealInChat` (`chat-scroll-view`) anotam aqui, e o `writeScroll` daqui
 * também cai aqui — um `scroll` nosso nunca liga o acompanhamento, nos dois
 * sentidos. Sem segunda lista.
 * @param {number} top posição pedida (`scrollTop`)
 * @returns {void}
 * @example noteHistoryOwnScroll(scroller.scrollTop)
 */
export function noteHistoryOwnScroll(top) {
  noteOwnScroll(top);
}

/**
 * Diz se o `scrollTop` veio do próprio código (e não do aluno).
 * @param {number} top `scrollTop` do evento
 * @returns {boolean}
 * @example isHistoryOwnScroll(scroller.scrollTop) // true no `followBottom`
 */
export function isHistoryOwnScroll(top) {
  return isOwnScroll(top);
}

function writeScroll(scroller, top) {
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const value = Math.min(Math.max(0, top), max);
  if (Math.abs(value - scroller.scrollTop) <= EPSILON) return;
  scroller.scrollTop = value;
  noteOwnScroll(scroller.scrollTop);
}

/* Desvio pendente da âncora atual: a altura real pode ter chegado e o `tick`
   ainda não a devolveu ao `scrollTop`. Quem troca a âncora (`tick` fora da
   vista, `aroundHistoryLayout` com outra casca) aplica antes de re-basear,
   senão o desvio morre junto com a base antiga (#118 itens 1-2). Sem medida
   (âncora solta, outro rolador), só re-baseia. */
function drainPendingDrift(scroller) {
  if (!active || !anchor || !anchor.isConnected || scroller !== trackedScroller) return;
  let box;
  try {
    box = anchor.getBoundingClientRect();
  } catch {
    return;
  }
  if (!box || !Number.isFinite(box.top)) return;
  const drift = anchorDrift({anchorTop: box.top, previousTop: lastTop, scrollTop: scroller.scrollTop, previousScroll: lastScroll});
  if (Math.abs(drift) <= EPSILON) return;
  writeScroll(scroller, scroller.scrollTop + drift);
  try {
    lastTop = anchor.getBoundingClientRect().top;
  } catch {
    lastTop = box.top;
  }
  lastScroll = scroller.scrollTop;
  quietFrames = 0;
}

function retarget(scroller) {
  const next = pickAnchor(scroller);
  if (!next) {
    stopHistoryAnchor();
    return;
  }
  trackedScroller = scroller;
  anchor = next.el;
  lastTop = next.top;
  lastScroll = scroller.scrollTop;
  quietFrames = 0;
  disableNativeAnchor(scroller);
  schedule();
}

function schedule() {
  if (frame || !active) return;
  frame = requestAnimationFrame(tick);
}

function tick() {
  frame = 0;
  if (!active) return;
  const scroller = scrollerNow();
  if (!scroller) {
    stopHistoryAnchor();
    return;
  }
  if (scroller !== trackedScroller || !anchor || !anchor.isConnected) {
    retarget(scroller);
    return;
  }
  const view = scroller.getBoundingClientRect();
  const box = anchor.getBoundingClientRect();
  if (box.bottom <= view.top + 1 || box.top >= view.bottom) {
    /* A bolha acima cresceu mais que a janela e tirou a âncora da vista: o
       desvio corrige antes da troca, senão o aluno salta (#118 item 2). */
    drainPendingDrift(scroller);
    retarget(scroller);
    return;
  }
  const scrollTop = scroller.scrollTop;
  const drift = anchorDrift({anchorTop: box.top, previousTop: lastTop, scrollTop, previousScroll: lastScroll});
  if (Math.abs(drift) > EPSILON) {
    writeScroll(scroller, scrollTop + drift);
    lastTop = anchor.getBoundingClientRect().top;
    lastScroll = scroller.scrollTop;
    quietFrames = 0;
  } else {
    const moved = Math.abs(scrollTop - lastScroll) > EPSILON;
    quietFrames = moved ? 0 : quietFrames + 1;
    lastTop = box.top;
    lastScroll = scrollTop;
  }
  if (quietFrames >= SETTLE_FRAMES) {
    stopHistoryAnchor();
    return;
  }
  schedule();
}

/**
 * Garante o acompanhamento ativo para o rolador da hora.
 * @returns {void}
 * @example startHistoryAnchor()
 */
export function startHistoryAnchor() {
  if (!wanted) return;
  const scroller = scrollerNow();
  if (!scroller) return;
  if (active && trackedScroller === scroller) {
    quietFrames = 0;
    schedule();
    return;
  }
  active = true;
  retarget(scroller);
}

/**
 * Desliga o acompanhamento e devolve o `overflow-anchor` do rolador.
 * @returns {void}
 * @example stopHistoryAnchor()
 */
export function stopHistoryAnchor() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  active = false;
  trackedScroller = null;
  anchor = null;
  quietFrames = 0;
  restoreNativeAnchor();
}

/**
 * Roda uma mudança de layout (o formato de uma casca) com a âncora medida
 * antes e depois; o que a mudança moveu acima da vista volta ao `scrollTop`.
 * A âncora escolhida continua valendo nos quadros seguintes, quando o
 * `content-visibility` aplica a altura real.
 * @param {object} scroller o rolador da conversa
 * @param {() => void} run a pintura que muda a altura
 * @returns {void}
 * @example aroundHistoryLayout(messageScroller(), () => updateMessage(el, text, images))
 */
export function aroundHistoryLayout(scroller, run) {
  if (!wanted || !scroller || typeof scroller.getBoundingClientRect !== 'function') {
    run();
    return;
  }
  /* A altura real da casca anterior pode ter chegado e o `tick` ainda não a
     devolveu: aplica o desvio pendente antes de escolher a nova âncora, senão
     a segunda medida (já deslocada) engole a correção (#118 item 1). */
  if (active && anchor && anchor.isConnected && trackedScroller === scroller) drainPendingDrift(scroller);
  /* Sempre mede a âncora na hora: o lote formata várias bolhas no mesmo
     quadro e a leitura anterior pode ter deixado alturas a caminho. */
  active = true;
  trackedScroller = scroller;
  disableNativeAnchor(scroller);
  const next = pickAnchor(scroller);
  const target = next?.el || null;
  const beforeTop = next?.top || 0;
  const beforeScroll = scroller.scrollTop;
  anchor = target;
  lastTop = beforeTop;
  lastScroll = beforeScroll;
  run();
  if (target && target.isConnected) {
    const drift = anchorDrift({anchorTop: target.getBoundingClientRect().top, previousTop: beforeTop, scrollTop: scroller.scrollTop, previousScroll: beforeScroll});
    if (Math.abs(drift) > EPSILON) writeScroll(scroller, scroller.scrollTop + drift);
    lastTop = target.getBoundingClientRect().top;
    lastScroll = scroller.scrollTop;
    quietFrames = 0;
    schedule();
  }
}

function onHistoryScroll(event) {
  if (!wanted) return;
  const scroller = scrollerNow();
  if (!scroller || event.target !== scroller) return;
  if (isOwnScroll(scroller.scrollTop)) return;
  startHistoryAnchor();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('scroll', onHistoryScroll, true);
}
