/* Atividades interativas no chat.
 *
 * O renderer NÃO cria o artefato nem executa o documento: ele hidrata os slots
 * que a timeline já colocou no lugar certo (`div.activity-slot[data-activity-call]`,
 * eventos `desk-activity-slot` e `desk-history-rendered`) usando só a API do
 * preload:
 *
 *   window.desk.activityList()                          → {items:[{id,version,hash,…,toolCallId,scopeRef}]}
 *   window.desk.activityRead({id,version,scopeRef})     → {item,spec}
 *   window.desk.activityStateGet({id,version,hash,scopeRef}) → {state}
 *   window.desk.activityStateSave({id,version,hash,scopeRef,state})
 *   window.desk.onActivity(fn)                          → {status:'published',activity:{…},scope:{conversationId,generation,courseId}}
 *   window.desk.activityScope()                         → {conversationId,generation,courseId,scopeRef}
 *
 * `scopeRef` é opaco, por geração/conversa e não persistido: o renderer só o
 * repassa de volta (list → read/stateGet/stateSave) e o host valida contra o
 * escopo capturado, para um id não resolver silenciosamente na conversa nova.
 *
 * Garantias desta camada:
 *   - carga de histórico é preguiçosa: sem evento ao vivo, o card abre com
 *     pôster + alternativa e só monta o iframe quando o aluno pede;
 *   - iframe `sandbox="allow-scripts"` com origem `mesa-activity:`; mensagens
 *     validadas por `event.source`, origem opaca e identidade id/version/hash;
 *   - ampliar só muda o CSS do MESMO iframe (sem reparenting, o contexto não
 *     recarrega); reiniciar cria montagem nova com init limpo; parar remove o
 *     iframe (um laço no artefato morre com o frame, medido no spike);
 *   - “Levar ao tutor” só ANEXA um rascunho ao conteúdo existente e dispara
 *     `input`; nunca envia prompt, nunca apaga o texto do aluno;
 *   - awaits guardam época/tamanho do slot: resposta atrasada de outra conversa
 *     ou de um histórico já refeito é descartada.
 *
 * O módulo é puro DOM: nenhuma dependência de Electron, nenhuma chamada de
 * rede, nenhum eval. Testes em `tests/activity-ui.mjs` o exercitam num
 * harness sintético. */

import * as quadro from './activity-view.mjs';
import {t} from './ui-text.mjs';
import {READY_TIMEOUT_MS} from './activity-messages.mjs';
import {createActivityCardDom} from './activity-card-dom.mjs';
import {createActivityFrame} from './activity-frame.mjs';
/* API pública de sempre: os limites e a URL moram em activity-messages.mjs. */
export {ACTIVITY_SCHEME, MAX_STATE_BYTES, MAX_ATTEMPT_BYTES, MAX_STATE_ENVELOPE_BYTES, HEIGHT_MIN, HEIGHT_MAX, HEIGHT_RESERVED, READY_TIMEOUT_MS, buildActivityUrl} from './activity-messages.mjs';

export function createActivityHost({
  doc = document,
  api = null,
  composer = null,
  getScope = null,
  maxMounted = 3,
  readyTimeoutMs = READY_TIMEOUT_MS,
  now = () => Date.now(),
} = {}) {
  const host = {
    epoch: 0,
    cards: new Map(),
    mounted: new Set(),
  };
  const listCache = {at: 0, items: []};
  const pendingEvents = new Map();
  let observer = null;
  let themeObserver = null;
  let unsubscribe = null;
  const listenerTargets = [];
  /* Grupos do host em módulos próprios (#43 fase 2): o ctx entrega o estado
     daqui por getters, lidos só quando as funções rodam. */
  const ctx = {
    get composerElement() { return composerElement; },
    get currentAccent() { return currentAccent; },
    get currentTheme() { return currentTheme; },
    get desk() { return desk; },
    get doc() { return doc; },
    get draftFor() { return draftFor; },
    get host() { return host; },
    get hostContext() { return hostContext; },
    get maxMounted() { return maxMounted; },
    get now() { return now; },
    get observeCard() { return observeCard; },
    get readyTimeoutMs() { return readyTimeoutMs; },
  };
  Object.assign(ctx, createActivityCardDom(ctx));
  Object.assign(ctx, createActivityFrame(ctx));
  const {element, renderCard, factLines, onEscape, stopFrame, flushState, postRaw, post, onMessage, mount} = ctx;

  async function refreshScope() {
    host.scope = null;
    let scope = null;
    /* O escopo confiável (geração + scopeRef) vive no main e chega por
       activityScope; getScope é o espelho síncrono do renderer. Se os dois
       divergirem de conversa, vale o síncrono (sem geração) e o host revalida
       no publish — nunca misturar geração antiga com conversa nova. */
    if (typeof desk.activityScope === 'function') {
      try {
        const hostScope = await desk.activityScope();
        if (hostScope && typeof hostScope === 'object' && typeof hostScope.conversationId === 'string') scope = {...hostScope};
      } catch { scope = null; }
    }
    if (typeof getScope === 'function') {
      try {
        const local = getScope();
        if (local && typeof local === 'object' && typeof local.conversationId === 'string') {
          scope = scope && scope.conversationId === local.conversationId ? {...scope, ...nonEmpty(local)} : {...local};
        }
      } catch { /* mantém o escopo do host */ }
    }
    if (scope && typeof scope.conversationId === 'string') host.scope = scope;
  }

  const nonEmpty = (value) => {
    const clean = {};
    for (const [key, item] of Object.entries(value || {})) {
      if (item === undefined || item === null || item === '') continue;
      clean[key] = item;
    }
    return clean;
  };

  const desk = api || (typeof window !== 'undefined' ? window.desk : null) || {};
  const composerElement = () => (typeof composer === 'function' ? composer() : composer);
  const currentTheme = () => (doc.documentElement && doc.documentElement.dataset ? doc.documentElement.dataset.theme : '') || 'system';
  const currentAccent = () => quadro.accentOf(doc.documentElement && doc.documentElement.dataset ? doc.documentElement.dataset.accent : '');
  const prefersDark = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  /* Tema resolvido (o quadro recebe claro ou escuro, nunca "sistema") e os
     tokens completos do núcleo para o `host-context-changed`. */
  const resolvedTheme = () => {
    const theme = currentTheme();
    return theme === 'dark' || theme === 'light' ? theme : (prefersDark() ? 'dark' : 'light');
  };
  const hostContext = () => ({jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: {theme: resolvedTheme(), styles: {variables: quadro.themeTokens(resolvedTheme(), currentAccent())}}});

  const slotOf = (toolCallId) => {
    if (!toolCallId) return null;
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(toolCallId) : String(toolCallId).replace(/"/g, '\\"');
    return doc.querySelector(`.activity-slot[data-activity-call="${escaped}"]`);
  };

  async function items({force = false} = {}) {
    if (typeof desk.activityList !== 'function') return [];
    if (!force && now() - listCache.at < 1500) return listCache.items;
    try {
      const result = await desk.activityList();
      const items = Array.isArray(result) ? result : (result && Array.isArray(result.items) ? result.items : []);
      listCache.items = items;
      listCache.at = now();
      return items;
    } catch {
      return listCache.items;
    }
  }

  function itemFor(itemsList, toolCallId) {
    let found = null;
    for (const item of itemsList) {
      if (!item || item.toolCallId !== toolCallId) continue;
      if (!found || Number(item.version) > Number(found.version)) found = item;
    }
    return found;
  }

  function draftFor(ctl) {
    const lines = [t('activity.draft.header', {title: ctl.item.title})];
    if (ctl.item.objective) lines.push(t('activity.draft.objective', {objective: ctl.item.objective}));
    const attempt = factLines(ctl.lastAttempt);
    if (attempt.length) lines.push(t('activity.draft.attempt'), ...attempt);
    const state = factLines(ctl.lastState);
    if (state.length) lines.push(attempt.length ? t('activity.draft.stateAfter') : t('activity.draft.state'), ...state);
    lines.push(t('activity.draft.footer'));
    return lines.join('\n');
  }

  const intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const ctl = [...host.cards.values()].find((card) => card.card === entry.target);
      if (!ctl) continue;
      if (!entry.isIntersecting && entry.intersectionRatio === 0) {
        if (!ctl.visibilityTimer && (ctl.auto || ctl.opened)) {
          ctl.visibilityTimer = setTimeout(() => {
            ctl.visibilityTimer = null;
            if (ctl.auto || ctl.opened) {
              flushState(ctl);
              stopFrame(ctl);
              ctl.card.dataset.state = 'paused';
              ctl.poster.hidden = false;
              ctl.posterText.textContent = t('activity.paused');
              ctl.openBtn.hidden = false;
              ctl.updateButtons?.();
            }
          }, 4000);
        }
      } else {
        if (ctl.visibilityTimer) {
          clearTimeout(ctl.visibilityTimer);
          ctl.visibilityTimer = null;
        }
        if ((ctl.auto || ctl.opened) && !ctl.frame && !ctl.stopped) {
          mount(ctl);
          ctl.updateButtons?.();
        }
      }
    }
  }, {rootMargin: '200px 0px'}) : null;

  function observeCard(ctl) {
    if (intersection) {
      try { intersection.observe(ctl.card); } catch { /* inerte */ }
    }
  }

  /* ---------- hidratação ---------- */
  /* O evento pode chegar antes do slot (declaração/execução) ou depois; um
     `published` pendente continua sendo uma publicação ao vivo quando o slot
     aparece, mesmo que a hidratação venha do MutationObserver. */
  async function hydrateSlot(slot, {live = false, item = null} = {}) {
    if (!slot || !slot.isConnected) return null;
    const toolCallId = slot.dataset ? slot.dataset.activityCall : '';
    if (!toolCallId) return null;
    const epoch = host.epoch;
    const event = item ? null : pendingEvents.get(toolCallId);
    const eventActivity = event && event.activity
      ? {...event.activity, scopeRef: event.activity.scopeRef || (event.scope && event.scope.scopeRef) || ''}
      : null;
    let chosen = item || eventActivity || itemFor(await items(), toolCallId);
    if (!chosen && !event) chosen = itemFor(await items({force: true}), toolCallId);
    if (chosen && host.scope && host.scope.conversationId && chosen.conversationId && chosen.conversationId !== host.scope.conversationId) chosen = null;
    if (chosen && !chosen.scopeRef && host.scope && host.scope.scopeRef) chosen = {...chosen, scopeRef: host.scope.scopeRef};
    /* Slot Parado/erro nunca automonta por evento atrasado; ainda dá para abrir
       explicitamente (card textual lazy). */
    const slotStatus = slot.dataset ? String(slot.dataset.status || '') : '';
    const blockedLive = slotStatus === 'stopped' || slotStatus === 'error';
    const isLive = !blockedLive && (live || !!(event && event.status === 'published'));
    if (!chosen) {
      const status = slot.dataset.status || 'pending';
      if (status === 'pending' || status === 'running') {
        if (!slot.firstChild) {
          const card = element('div', 'activity-card activity-pending');
          card.append(element('div', 'activity-head', ''));
          card.firstChild.append(element('span', 'activity-poster-text', t('activity.preparingActivity')));
          slot.append(card);
        }
        return null;
      }
      if (status === 'error' || status === 'stopped') {
        slot.textContent = '';
        const note = element('div', 'activity-note', status === 'error' ? t('activity.error.notPublished') : t('activity.stoppedNote'));
        slot.append(note);
        return null;
      }
      slot.textContent = '';
      slot.append(element('div', 'activity-note', t('activity.error.notFound')));
      return null;
    }
    if (epoch !== host.epoch || !slot.isConnected) return null;
    let read;
    try {
      read = await desk.activityRead({id: chosen.id, version: chosen.version, scopeRef: chosen.scopeRef});
    } catch (error) {
      if (epoch !== host.epoch || !slot.isConnected) return null;
      slot.textContent = '';
      slot.append(element('div', 'activity-note', t('activity.error.open', {reason: String(error && error.message || error).slice(0, 200)})));
      return null;
    }
    if (epoch !== host.epoch || !slot.isConnected) return null;
    const resolvedItem = read && read.item ? {...chosen, ...read.item, scopeRef: read.item.scopeRef || chosen.scopeRef || ''} : chosen;
    const spec = read && read.spec;
    if (!spec || typeof spec !== 'object') {
      slot.textContent = '';
      slot.append(element('div', 'activity-note', t('activity.error.corrupt')));
      return null;
    }
    let saved = null;
    if (typeof desk.activityStateGet === 'function') {
      try {
        const result = await desk.activityStateGet({id: resolvedItem.id, version: resolvedItem.version, hash: resolvedItem.hash, scopeRef: resolvedItem.scopeRef});
        saved = result && result.state ? result.state : null;
      } catch { saved = null; }
    }
    if (epoch !== host.epoch || !slot.isConnected) return null;
    pendingEvents.delete(toolCallId);
    return renderCard(slot, resolvedItem, spec, saved, {live: isLive, stopped: blockedLive});
  }

  function handleActivityEvent(event) {
    const activity = event && event.activity;
    if (!activity || !activity.toolCallId) return;
    /* `getScope` é um getter do host e pode ter mudado desde o attach (root
       inicializa o host antes do `desk.init`); consultar de novo evita
       descartar a publicação live com escopo já conhecido. */
    if (typeof getScope === 'function') {
      try {
        const fresh = getScope();
        if (fresh && typeof fresh === 'object' && typeof fresh.conversationId === 'string') {
          const previous = host.scope || {};
          host.scope = previous.conversationId && previous.conversationId !== fresh.conversationId
            ? {...fresh}
            : {...previous, ...nonEmpty(fresh)};
        }
      } catch { /* mantém o escopo anterior */ }
    }
    const eventScope = event.scope || null;
    const currentScope = host.scope || null;
    /* Só filtra quando os DOIS lados têm valor: escopo vazio (init antes do
       desk.init) não derruba a publicação. */
    if (currentScope && eventScope) {
      const currentConversation = currentScope.conversationId || '';
      const eventConversation = eventScope.conversationId || activity.conversationId || '';
      if (currentConversation && eventConversation && currentConversation !== eventConversation) return;
      const currentCourse = currentScope.courseId == null ? '' : String(currentScope.courseId);
      const eventCourse = eventScope.courseId == null ? '' : String(eventScope.courseId);
      if (currentCourse && eventCourse && currentCourse !== eventCourse) return;
      if (currentScope.generation != null && eventScope.generation != null && Number(currentScope.generation) !== Number(eventScope.generation)) return;
      const currentRef = currentScope.scopeRef || '';
      const eventRef = eventScope.scopeRef || activity.scopeRef || '';
      if (currentRef && eventRef && currentRef !== eventRef) return;
    }
    pendingEvents.set(activity.toolCallId, event);
    const slot = slotOf(activity.toolCallId);
    if (slot) hydrateSlot(slot, {live: event.status === 'published'});
  }

  function hydrateAll() {
    const slots = doc.querySelectorAll('.activity-slot[data-activity-call]');
    for (const slot of slots) hydrateSlot(slot, {live: false});
  }

  function attach() {
    const onSlotEvent = (event) => {
      const detail = event && event.detail ? event.detail : {};
      const slot = detail.element && detail.element.isConnected ? detail.element : slotOf(detail.toolCallId);
      if (slot) hydrateSlot(slot);
    };
    const onHistoryEvent = () => {
      host.epoch += 1;
      listCache.at = 0;
      listCache.items = [];
      pendingEvents.clear();
      for (const ctl of host.cards.values()) {
        flushState(ctl);
        stopFrame(ctl);
      }
      host.cards.clear();
      refreshScope();
      hydrateAll();
    };
    const onScopeEvent = () => {
      listCache.at = 0;
      listCache.items = [];
      refreshScope();
    };
    for (const target of [doc, typeof window !== 'undefined' ? window : null]) {
      if (target && typeof target.addEventListener === 'function') {
        target.addEventListener('desk-activity-slot', onSlotEvent);
        target.addEventListener('desk-history-rendered', onHistoryEvent);
        target.addEventListener('desk-conversation-changed', onScopeEvent);
        target.addEventListener('desk-workspace', onScopeEvent);
        listenerTargets.push({target, onSlotEvent, onHistoryEvent, onScopeEvent});
      }
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('message', onMessage);
    }
    if (typeof doc.body === 'object' && doc.body && typeof MutationObserver === 'function') {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (target && target.classList && target.classList.contains('activity-slot')) hydrateSlot(target);
            continue;
          }
          for (const node of mutation.addedNodes || []) {
            if (node && node.nodeType === 1) {
              if (node.classList && node.classList.contains('activity-slot')) hydrateSlot(node);
              else if (node.querySelectorAll) for (const slot of node.querySelectorAll('.activity-slot[data-activity-call]')) hydrateSlot(slot);
            }
          }
        }
      });
      observer.observe(doc.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['data-status'],
      });
    }
    if (typeof doc.documentElement === 'object' && typeof MutationObserver === 'function') {
      /* Tema e acento ao vivo (#42): o v1 `theme` para o contrato antigo e os
         tokens completos no `host-context-changed`. */
      const repaint = () => {
        const theme = currentTheme();
        const context = hostContext();
        for (const ctl of host.mounted) {
          post(ctl, 'theme', {theme});
          postRaw(ctl, context);
        }
      };
      themeObserver = new MutationObserver(repaint);
      themeObserver.observe(doc.documentElement, {attributes: true, attributeFilter: ['data-theme', 'data-accent']});
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint); } catch { /* sem media query */ }
      }
    }
    /* Esc sai da tela cheia (com o foco fora do quadro; dentro, o próprio
       quadro pede pelo `ui/request-display-mode`). */
    doc.addEventListener('keydown', onEscape, true);
    doc.addEventListener('pointermove', onPointerAway, {passive: true});
    watchColumn();
    if (typeof desk.onActivity === 'function') {
      const result = desk.onActivity(handleActivityEvent);
      if (typeof result === 'function') unsubscribe = result;
    }
    refreshScope();
    hydrateAll();
    return host;
  }

  /* O ponteiro saiu do quadro sem o quadro avisar (salto, janela): o primeiro
     movimento fora do palco tira a marca de hover. */
  function onPointerAway(event) {
    for (const ctl of host.cards.values()) {
      if (ctl.card && ctl.card.classList.contains('activity-hover') && !(ctl.stage && ctl.stage.contains(event.target))) ctl.card.classList.remove('activity-hover');
    }
  }

  /* Largura do texto da resposta (#42): a prévia do tutor mede nela por
     padrão. O host recebe a largura útil de #messages quando ela muda. */
  let columnObserver = null;
  let lastColumn = 0;
  function watchColumn() {
    if (typeof desk.activityColumn !== 'function' || typeof ResizeObserver !== 'function') return;
    const messages = doc.querySelector('#messages');
    if (!messages) return;
    const report = () => {
      const style = getComputedStyle(messages);
      const width = Math.round(messages.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
      if (!width || Math.abs(width - lastColumn) < 4) return;
      lastColumn = width;
      Promise.resolve(desk.activityColumn(width)).catch(() => {});
    };
    columnObserver = new ResizeObserver(report);
    columnObserver.observe(messages);
    report();
  }

  function detach() {
    doc.removeEventListener('keydown', onEscape, true);
    doc.removeEventListener('pointermove', onPointerAway);
    if (columnObserver) columnObserver.disconnect();
    if (observer) observer.disconnect();
    if (themeObserver) themeObserver.disconnect();
    if (typeof unsubscribe === 'function') unsubscribe();
    for (const entry of listenerTargets.splice(0)) {
      entry.target.removeEventListener('desk-activity-slot', entry.onSlotEvent);
      entry.target.removeEventListener('desk-history-rendered', entry.onHistoryEvent);
      entry.target.removeEventListener('desk-conversation-changed', entry.onScopeEvent);
      entry.target.removeEventListener('desk-workspace', entry.onScopeEvent);
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('message', onMessage);
    }
    for (const ctl of [...host.cards.values()]) {
      flushState(ctl);
      stopFrame(ctl);
    }
    return host;
  }

  return Object.assign(host, {
    attach,
    detach,
    refresh: () => hydrateAll(),
    hydrateSlot,
    handleActivityEvent,
    mount,
    stop: (toolCallId) => {
      const ctl = host.cards.get(toolCallId);
      if (ctl && ctl.stopBtn) ctl.stopBtn.click();
      return ctl;
    },
    open: (toolCallId) => {
      const ctl = host.cards.get(toolCallId);
      if (ctl && ctl.openBtn) ctl.openBtn.click();
      return ctl;
    },
    draftFor,
    currentTheme,
  });
}

export function initActivityHost(options = {}) {
  const host = createActivityHost(options);
  host.attach();
  return host;
}
