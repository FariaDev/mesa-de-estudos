// @ts-check
/* A saída do limite do grátis (429 `FreeUsageLimitError` do 2.2.4, medido em
   2026-11-05): o turno falha sem derrubar a conexão, então a coluna do tutor
   não muda de estado — a frase e o conserto moram aqui, entre a linha de
   atividade e a caixa de mensagem. Sem conta, o botão abre o diálogo de login
   e chave que já existe (`desk-open-free-models`, o mesmo caminho dos
   `UseFreeModels` de `tutor-state.mjs` e `first-run.mjs`); com a chave
   guardada, o botão abre o seletor para escolher outro modelo. A frase curta
   vem do mapeamento (`opencode-events.cjs` → `opencode.event.freeLimit`); a
   variante de quem já entrou mora aqui, sem pedir login de novo. */

import {parseMessage} from './i18n.mjs';
import {t, LANGUAGE_EVENT} from './ui-text.mjs';

const NOTE_ID = 'free-limit-note';

/** A mensagem marcada é o limite do grátis mapeado pelo tutor. */
export function freeLimitKey(text) {
  return parseMessage(String(text ?? ''))?.key === 'opencode.event.freeLimit';
}

/**
 * A frase do aviso pela conta: sem chave guardada, entrar ou usar chave; com
 * ela, escolher outro modelo.
 * @param {{saved?: boolean}} facts `saved` é o `opencodeStatus().saved`
 * @returns {'opencode.event.freeLimit'|'opencode.event.freeLimitModels'}
 * @example freeLimitMessageKey({saved: false}) // 'opencode.event.freeLimit'
 * @example freeLimitMessageKey({saved: true}) // 'opencode.event.freeLimitModels'
 */
export function freeLimitMessageKey({saved} = {}) {
  return saved ? 'opencode.event.freeLimitModels' : 'opencode.event.freeLimit';
}

/** @returns {HTMLElement|null} */
const note = () => /** @type {HTMLElement|null} */ (document.querySelector(`#${NOTE_ID}`));

/** @param {HTMLElement|null} el @param {string} selector @returns {HTMLElement|null} */
const part = (el, selector) => /** @type {HTMLElement|null} */ (el?.querySelector(selector));

function ensureNote() {
  let el = note();
  if (el) return el;
  el = document.createElement('div');
  el.id = NOTE_ID;
  el.className = 'free-limit-note';
  el.setAttribute('role', 'status');
  el.hidden = true;
  const text = document.createElement('p');
  text.className = 'free-limit-text';
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'free-limit-action';
  el.append(text, action);
  const activity = document.querySelector('#activity');
  if (activity?.parentNode) activity.after(el);
  else document.querySelector('#chat')?.append(el);
  return el;
}

function current() {
  const el = note();
  if (!el || el.hidden) return null;
  return {saved: el.dataset.saved === '1'};
}

/** Repinta o aviso no idioma atual, sem mudar a variante. */
function repaint() {
  const facts = current();
  if (!facts) return;
  showFreeLimitNote(facts);
}

/**
 * Mostra o aviso com a frase e a saída da conta de agora.
 * @param {{saved?: boolean}} facts `saved` é o `opencodeStatus().saved`
 * @example showFreeLimitNote({saved: false}) // frase + "Entrar ou usar chave"
 */
export function showFreeLimitNote({saved} = {}) {
  const el = ensureNote();
  const logged = !!saved;
  el.dataset.saved = logged ? '1' : '0';
  const label = part(el, '.free-limit-text');
  const action = part(el, '.free-limit-action');
  if (!label || !action) return;
  label.textContent = t(freeLimitMessageKey({saved: logged}));
  if (logged) {
    action.textContent = t('freeLimit.pickModel');
    action.onclick = (event) => {
      /* O clique fora fecha os popovers (`tutor-header.mjs`): sem isto, a
         bolha deste clique fecharia o seletor que o gatilho acabou de abrir. */
      event?.stopPropagation?.();
      hideFreeLimitNote();
      /* O seletor abre pelo indicador, como o usuário faz; se já estiver
         aberto (a troca anterior o deixou assim), o clique o fecharia. */
      const pop = document.querySelector('#model-pop');
      const indicator = document.querySelector('#model-indicator');
      if (pop instanceof HTMLElement && pop.hidden && indicator instanceof HTMLElement) indicator.click();
    };
  } else {
    /* O mesmo evento dos `UseFreeModels` da coluna e da primeira abertura:
       o diálogo de login e chave, sem segundo caminho. */
    action.textContent = t('freeLimit.signIn');
    action.onclick = () => {
      hideFreeLimitNote();
      window.dispatchEvent(new Event('desk-open-free-models'));
    };
  }
  el.hidden = false;
}

export function hideFreeLimitNote() {
  const el = note();
  if (el) el.hidden = true;
}

/**
 * Liga o aviso: some na troca de conversa, no turno novo e na troca de modelo; troca de idioma repinta.
 * @param {{currentModel?: () => string}} [deps] modelo em uso; vem por parâmetro para este módulo seguir sem `state.mjs`, que exige janela
 * @returns {void}
 * @example initFreeLimitNote({currentModel: () => S.choice.model})
 */
export function initFreeLimitNote({currentModel = () => ''} = {}) {
  window.addEventListener(LANGUAGE_EVENT, repaint);
  window.addEventListener('desk-conversation-changed', hideFreeLimitNote);
  /* Escolher outro modelo pelo seletor, sem enviar, também esconde o aviso. O
     `desk-tutor-link` dispara ainda em toda mudança de conexão, inclusive logo
     depois do erro: só o modelo diferente esconde, ou o aviso sumia ao aparecer. */
  let shownModel = currentModel();
  window.addEventListener('desk-tutor-link', () => {
    const model = currentModel();
    if (model === shownModel) return;
    shownModel = model;
    hideFreeLimitNote();
  });
  window.desk?.onEvent?.((event) => {
    if (event?.type === 'agent_start') hideFreeLimitNote();
  });
}
