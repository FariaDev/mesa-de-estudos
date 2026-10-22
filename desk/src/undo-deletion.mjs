/* Aviso "Desfazer" para remoções do Caderno e das Anotações (renderer).
 *
 * Independente do toast global (não importa `state.mjs`, não usa `#toast`):
 * monta o próprio aviso efêmero com UM botão Desfazer, contador visível e
 * mensagem de erro acessível. O CSS mora em `src/undo-notice.css` (o
 * integrador liga o `<link>` no `index.html`).
 *
 * Contrato de integração (o integrador liga no `main.cjs`/`preload.cjs`):
 *   - `review-save` com `mode:'remove'` responde
 *     `{items, undoToken, undoExpiresAt}` (e `review-undo` responde
 *     `{ok, reason, items}`);
 *   - `study-notes-save` com `mode:'remove'` responde
 *     `{scope, items, undoToken, undoExpiresAt}` (e `study-notes-undo` responde
 *     `{ok, reason, scope, items}`);
 *   - o token NASCE no backend; este módulo só o devolve ao host no clique.
 *
 * O contador (`core.undoview.noticeMs`) só esconde a tela quando termina: o
 * token continua no processo do host até o prazo real (`ttlMs`). Nenhuma função
 * daqui apaga dados de recuperação.
 *
 * Acessibilidade: o aviso é `role="status"` com `aria-live="polite"` (o
 * Desfazer não rouba o foco de quem digita); o erro vira `role="alert"`; o
 * botão e o fechar têm rótulo completo. Se o foco estava no aviso quando ele
 * fecha, ele volta pelo `restoreFocus` do chamador (ou o botão perde o foco). */

/* Os textos do núcleo chegam como mensagens (chave e argumentos); a tradução é do idioma da interface (#41). */
import {text as uiText} from './ui-text.mjs';
import {toNat} from './bend-nat.mjs';

const DEFAULT_TICK_MS = 500;
const DONE_HIDE_MS = 3500;

let deps = {
  document: null,
  window: null,
  host: null,
  core: null,
  timers: null,
  now: null,
  restoreFocus: null,
};
let refs = null;
let active = null;
let corePromise = null;

function docOf() {
  return deps.document || (typeof globalThis.document !== 'undefined' ? globalThis.document : null);
}

function winOf() {
  return deps.window || (typeof globalThis.window !== 'undefined' ? globalThis.window : null);
}

function timersOf() {
  if (deps.timers) return deps.timers;
  const win = winOf();
  return {
    setInterval: (fn, ms) => win.setInterval(fn, ms),
    clearInterval: (id) => win.clearInterval(id),
    setTimeout: (fn, ms) => win.setTimeout(fn, ms),
    clearTimeout: (id) => win.clearTimeout(id),
  };
}

function nowOf() {
  return typeof deps.now === 'function' ? Number(deps.now()) : Date.now();
}

function ensureCore() {
  if (deps.core) return Promise.resolve(deps.core);
  if (!corePromise) corePromise = import('./generated/undoview.core.js').then((mod) => mod.default);
  return corePromise;
}

function element(tag, props = {}, kids = []) {
  const el = docOf().createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(kids)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/* O aviso é criado uma vez, fora do `#toast` (o aviso tem vida própria). */
function install() {
  if (refs) return refs;
  const root = element('div', {id: 'undo-notice', class: 'undo-notice', role: 'status', 'aria-live': 'polite', hidden: true});
  const text = element('p', {class: 'undo-notice-text'});
  const error = element('p', {class: 'undo-notice-error', role: 'alert', hidden: true});
  const undo = element('button', {type: 'button', class: 'undo-notice-undo'});
  const timer = element('span', {class: 'undo-notice-timer', 'aria-hidden': 'true'});
  const close = element('button', {type: 'button', class: 'undo-notice-close', text: '×'});
  const actions = element('div', {class: 'undo-notice-actions'}, [undo, timer, close]);
  root.append(text, error, actions);
  undo.addEventListener('click', () => { void undoActive(); });
  close.addEventListener('click', () => cancelUndoNotice());
  docOf().body.append(root);
  refs = {root, text, error, undo, timer, close, actions};
  return refs;
}

function paintTimer(core) {
  const ms = Number(core.remainingMs(toNat(nowOf()), toNat(active.deadline)));
  refs.timer.textContent = `${Number(core.secondsLeft(toNat(nowOf()), toNat(active.deadline)))}s`;
  return ms;
}

function stopClocks() {
  if (!active) return;
  const timers = timersOf();
  if (active.interval) timers.clearInterval(active.interval);
  if (active.timeout) timers.clearTimeout(active.timeout);
  active.interval = 0;
  active.timeout = 0;
}

/* Esconde a tela. NUNCA chama o host: o token segue no processo até o prazo. */
function hideNotice() {
  if (!active) {
    if (refs) refs.root.hidden = true;
    return;
  }
  const focused = docOf()?.activeElement === refs.undo || docOf()?.activeElement === refs.close;
  stopClocks();
  active = null;
  refs.root.hidden = true;
  refs.undo.disabled = false;
  refs.error.hidden = true;
  refs.error.textContent = '';
  refs.timer.textContent = '';
  if (focused) {
    if (typeof deps.restoreFocus === 'function') deps.restoreFocus();
    else if (typeof refs.undo.blur === 'function') refs.undo.blur();
  }
}

export function cancelUndoNotice() {
  hideNotice();
}

export function isUndoNoticeVisible() {
  return !!active && refs && refs.root.hidden === false;
}

function reasonText(core, reason) {
  switch (reason) {
    case 'expired': return uiText(core.expiredText());
    case 'scope': return uiText(core.foreignText());
    case 'unauthorized': return uiText(core.blockedText());
    case 'unknown': return uiText(core.unknownText());
    default: return uiText(core.failedText());
  }
}

function showError(text, retry = false) {
  if (!active) return;
  refs.error.textContent = text;
  refs.error.hidden = false;
  refs.undo.disabled = !retry;
  const timers = timersOf();
  if (active.interval) timers.clearInterval(active.interval);
  active.interval = 0;
  if (retry) {
    active.busy = false;
    active.interval = timers.setInterval(tick, DEFAULT_TICK_MS);
  }
}

function tick() {
  if (!active) return;
  const scoped = active.scopeNow && String(active.scopeNow()) !== active.scopeKey;
  if (scoped) {
    /* Trocar matéria/conversa desativa o aviso: o Desfazer vale no escopo de
       onde o item saiu. Os dados continuam no host até o prazo. */
    cancelUndoNotice();
    return;
  }
  const core = active.core;
  if (nowOf() >= active.deadline) {
    hideNotice();
    return;
  }
  paintTimer(core);
}

async function undoActive() {
  if (!active || active.busy) return;
  const core = active.core;
  if (active.scopeNow && String(active.scopeNow()) !== active.scopeKey) {
    cancelUndoNotice();
    return;
  }
  if (nowOf() >= active.deadline) {
    /* O host ainda tem o token até o TTL dele; a tela só parou de contar. */
    hideNotice();
    return;
  }
  active.busy = true;
  refs.error.hidden = true;
  refs.undo.disabled = true;
  const timers = timersOf();
  if (active.interval) timers.clearInterval(active.interval);
  active.interval = 0;
  const {token, kind, onUndone} = active;
  const request = active;
  try {
    const host = deps.host || winOf()?.desk || null;
    const call = kind === 'note' ? host?.studyNotesUndo : host?.reviewUndo;
    if (typeof call !== 'function') throw new Error(uiText(core.failedText()));
    const result = await Promise.resolve(call.call(host, {token}));
    if (active !== request) return;
    if (result && result.ok === false) {
      showError(reasonText(core, result.reason));
      return;
    }
    refs.text.textContent = kind === 'note' ? uiText(core.restoredNote()) : uiText(core.restoredReview());
    refs.timer.textContent = '';
    if (typeof onUndone === 'function') {
      try {
        await onUndone(result);
      } catch { /* a lista do chamador é só a tela; a restauração já valeu */ }
    }
    if (active !== request) return;
    active.timeout = timers.setTimeout(() => {
      if (active === request) hideNotice();
    }, DONE_HIDE_MS);
  } catch (error) {
    if (active !== request) return;
    showError(String(error?.message || uiText(core.failedText())), nowOf() < active.deadline);
  }
}

/* Mostra o aviso de UMA remoção. `scopeKey`/`scopeNow` desativam o aviso quando
 * o escopo muda; `onUndone` recebe a resposta do host (ex.: `{items}`) para o
 * chamador redesenhar. */
export async function showUndoNotice({kind = 'review', token = '', expiresAt = 0, scopeKey = '', scopeNow = null, onUndone = null, restoreFocus = null, container = null} = {}) {
  if (typeof token !== 'string' || !token) return false;
  install();
  const core = await ensureCore();
  cancelUndoNotice();
  // Um diálogo modal deixa o body inerte: o botão precisa pertencer ao diálogo.
  (container || docOf().body).append(refs.root);
  deps.restoreFocus = typeof restoreFocus === 'function' ? restoreFocus : deps.restoreFocus;
  const at = nowOf();
  const deadline = Math.min(Number(expiresAt) > at ? Number(expiresAt) : Infinity, at + Number(core.noticeMs()));
  active = {
    core,
    token,
    kind: kind === 'note' ? 'note' : 'review',
    scopeKey: String(scopeKey || ''),
    scopeNow: typeof scopeNow === 'function' ? scopeNow : null,
    onUndone,
    deadline,
    busy: false,
    interval: 0,
    timeout: 0,
  };
  refs.text.textContent = active.kind === 'note' ? uiText(core.noticeNote()) : uiText(core.noticeReview());
  refs.error.hidden = true;
  refs.error.textContent = '';
  refs.undo.disabled = false;
  refs.undo.textContent = uiText(core.undoLabel());
  refs.undo.title = uiText(core.undoTitle());
  refs.undo.setAttribute('aria-label', uiText(core.undoTitle()));
  refs.close.title = uiText(core.closeTitle());
  refs.close.setAttribute('aria-label', uiText(core.closeTitle()));
  refs.root.hidden = false;
  paintTimer(core);
  active.interval = timersOf().setInterval(tick, DEFAULT_TICK_MS);
  return true;
}

export function initUndoNotice(options = {}) {
  deps = {...deps, ...options};
  if (!deps.document) deps.document = typeof globalThis.document !== 'undefined' ? globalThis.document : null;
  if (!deps.window) deps.window = typeof globalThis.window !== 'undefined' ? globalThis.window : null;
  return {show: showUndoNotice, cancel: cancelUndoNotice, isVisible: isUndoNoticeVisible};
}
