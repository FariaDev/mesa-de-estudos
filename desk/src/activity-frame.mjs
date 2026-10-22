import * as quadro from './activity-view.mjs';
import {t} from './ui-text.mjs';
import {ACTIVITY_SCHEME,HEIGHT_RESERVED,MAX_ATTEMPT_BYTES,MAX_STATE_BYTES,MAX_STATE_ENVELOPE_BYTES,buildActivityUrl,jsonSize,parseMessage,parseRpc} from './activity-messages.mjs';

/* Quadro de atividade — o iframe: estado salvo, mensagens com o quadro,
   montagem e o orçamento de quadros montados.
   Saiu do createActivityHost (activity.mjs) na #43 fase 2. */

/**
 * Cria as funções deste grupo sobre o contexto compartilhado do host.
 * @param {object} ctx estado e funções do `createActivityHost` (getters preguiçosos)
 * @returns {{stopFrame, flushState, postRaw, post, onMessage, mount}}
 * @example Object.assign(ctx,createActivityFrame(ctx));
 */
export function createActivityFrame(ctx) {
  function consumePendingState(ctl) {
    if (ctl.pendingState === undefined) return;
    if (ctl.stateCoalesceTimer) {
      clearTimeout(ctl.stateCoalesceTimer);
      ctl.stateCoalesceTimer = null;
    }
    ctl.lastState = ctl.pendingState;
    ctl.pendingState = undefined;
    ctl.lastStateAt = ctx.now();
  }
  function stateForMount(ctl) {
    return ctl.lastState !== null && ctl.lastState !== undefined ? ctl.lastState : ctl.restoreState;
  }
  function stopFrame(ctl) {
    consumePendingState(ctl);
    if (!ctl.frame) return;
    if (ctl.card && ctl.card.classList.contains('activity-fullscreen')) ctx.setFullscreen(ctl, false);
    /* Aviso best-effort antes de remover (o realm morre com o frame; quem está
       ocioso consegue limpar timers/observers). */
    post(ctl, 'stop', {});
    try {
      if (ctl.frame.parentNode) ctl.frame.parentNode.removeChild(ctl.frame);
    } catch { /* já foi */ }
    ctl.frame = null;
    ctx.host.mounted.delete(ctl);
    if (ctl.visibilityTimer) {
      clearTimeout(ctl.visibilityTimer);
      ctl.visibilityTimer = null;
    }
    if (ctl.readyTimer) {
      clearTimeout(ctl.readyTimer);
      ctl.readyTimer = null;
    }
  }
  function flushState(ctl) {
    consumePendingState(ctl);
    if (ctl.saveTimer) {
      clearTimeout(ctl.saveTimer);
      ctl.saveTimer = null;
    }
    if (!ctl.dirty || typeof ctx.desk.activityStateSave !== 'function') return;
    if (ctl.saveInFlight) {
      ctl.dirty = true;
      return;
    }
    const state = {values: ctl.lastState, attempt: ctl.lastAttempt};
    /* Tetos por campo e do envelope, iguais aos do store. Estourar não pode
       sumir em silêncio: o card mostra o erro e o próximo estado menor volta a
       salvar (sem retry infinito de um payload inválido). */
    if (jsonSize(ctl.lastState) > MAX_STATE_BYTES || jsonSize(ctl.lastAttempt) > MAX_ATTEMPT_BYTES || jsonSize(state) > MAX_STATE_ENVELOPE_BYTES) {
      ctl.dirty = false;
      ctl.saveFailed = true;
      ctx.setError(ctl, t('activity.error.limit'));
      return;
    }
    ctl.dirty = false;
    ctl.saveInFlight = true;
    /* Falha de persistência NÃO some: o estado continua dirty e o card mostra o
       erro, com retry limitado. O `scopeRef` capturado não muda. */
    const finish = (failed) => {
      ctl.saveInFlight = false;
      if (!failed) {
        ctl.saveFailures = 0;
        if (ctl.saveFailed) {
          ctl.saveFailed = false;
          ctx.setError(ctl, ctl.artifactError || '');
        }
        if (ctl.dirty) {
          ctl.saveTimer = setTimeout(() => {
            ctl.saveTimer = null;
            flushState(ctl);
          }, 250);
        }
        return;
      }
      ctl.saveFailed = true;
      ctl.dirty = true;
      ctl.saveFailures = (ctl.saveFailures || 0) + 1;
      ctx.setError(ctl, t('activity.error.saveRetry'));
      if (ctl.saveFailures <= 4) {
        ctl.saveTimer = setTimeout(() => {
          ctl.saveTimer = null;
          flushState(ctl);
        }, 1500 * ctl.saveFailures);
      }
    };
    Promise.resolve(ctx.desk.activityStateSave({
      id: ctl.item.id,
      version: ctl.item.version,
      hash: ctl.item.hash,
      scopeRef: ctl.scopeRef,
      state,
    })).then(() => finish(false)).catch(() => finish(true));
  }
  function scheduleSave(ctl) {
    ctl.dirty = true;
    if (ctl.saveTimer) return;
    ctl.saveTimer = setTimeout(() => {
      ctl.saveTimer = null;
      flushState(ctl);
    }, 600);
  }
  function postRaw(ctl, message) {
    if (!ctl.frame || !ctl.frame.contentWindow) return;
    try { ctl.frame.contentWindow.postMessage(message, '*'); } catch { /* frame removido */ }
  }
  /* `ui/open-link` (#42): o quadro é offline; um link https que o aluno clicou
     abre no navegador do sistema, nunca dentro do quadro. Só clique de verdade
     (o runtime confere `isTrusted`), com teto por montagem. */
  function openLink(ctl, message) {
    ctl.links = (ctl.links || 0) + 1;
    if (ctl.links > 20) return;
    if (typeof ctx.desk.openExternal === 'function') Promise.resolve(ctx.desk.openExternal(message.payload.url)).catch(() => {});
    if (message.id !== null) postRaw(ctl, {jsonrpc: '2.0', id: message.id, result: {}});
  }
  function post(ctl, type, payload) {
    if (!ctl.frame || !ctl.frame.contentWindow) return;
    try {
      ctl.frame.contentWindow.postMessage({
        v: 1, type, id: ctl.item.id, version: ctl.item.version, hash: ctl.item.hash, payload: payload === undefined ? null : payload,
      }, '*');
    } catch { /* frame removido */ }
  }
  function onMessage(event) {
    let ctl = null;
    for (const card of ctx.host.mounted) {
      if (card.frame && card.frame.contentWindow === event.source) {
        ctl = card;
        break;
      }
    }
    if (!ctl) return;
    const origin = String(event.origin || '');
    if (origin && origin !== 'null' && !origin.startsWith(`${ACTIVITY_SCHEME}:`)) return;
    const rpc = parseRpc(event.data);
    const message = rpc || parseMessage(event.data, ctl.item);
    if (!message) return;
    /* O log do quadro é para a prévia do tutor; aqui não vira nada. */
    if (message.type === 'log') return;
    if (message.type === 'open-link') {
      openLink(ctl, message);
      return;
    }
    if (message.type === 'pointer') {
      ctl.card.classList.toggle('activity-hover', message.payload.inside);
      return;
    }
    if (message.type === 'inline') {
      ctx.setFullscreen(ctl, false);
      if (message.id !== null) postRaw(ctl, {jsonrpc: '2.0', id: message.id, result: {mode: 'inline'}});
      return;
    }
    /* Script livre pode chamar parent.postMessage direto: o host limita taxa e
       total por montagem, independente do wrapper. Estado dentro da janela de
       250ms é COALESCIDO (guarda o último) — nunca descartado, senão uma
       mudança legítima de slider logo após o load se perde. */
    const at = ctx.now();
    ctl.messageCount = (ctl.messageCount || 0) + 1;
    if (ctl.messageCount > 3000) return;
    if (message.type === 'state') {
      if (at - (ctl.lastStateAt || 0) < 250) {
        ctl.pendingState = message.payload;
        if (!ctl.stateCoalesceTimer) {
          ctl.stateCoalesceTimer = setTimeout(() => {
            ctl.stateCoalesceTimer = null;
            if (ctl.pendingState === undefined) return;
            const value = ctl.pendingState;
            ctl.pendingState = undefined;
            ctl.lastState = value;
            ctl.lastStateAt = ctx.now();
            scheduleSave(ctl);
          }, Math.max(20, 250 - (at - (ctl.lastStateAt || 0))));
        }
        return;
      }
      ctl.lastStateAt = at;
    } else if (message.type === 'height') {
      if (at - (ctl.lastHeightAt || 0) < 80) return;
      ctl.lastHeightAt = at;
    } else if (message.type === 'error') {
      if (at - (ctl.lastErrorAt || 0) < 500) return;
      ctl.lastErrorAt = at;
    }
    if (message.type === 'ready') {
      if (ctl.readyTimer) {
        clearTimeout(ctl.readyTimer);
        ctl.readyTimer = null;
      }
      ctl.failed = false;
      ctx.setError(ctl, '');
      ctl.card.dataset.state = 'ready';
      ctl.poster.hidden = true;
      /* `ready` pode repetir (load + readyState). Só o PRIMEIRO init carrega
         estado restaurado; os seguintes só acertam o tema, sem resetar o que o
         aluno/artefato já mudou. */
      if (!ctl.initialized) {
        ctl.initialized = true;
        post(ctl, 'init', {theme: ctx.currentTheme(), state: ctl.restoreState});
      } else {
        post(ctl, 'theme', {theme: ctx.currentTheme()});
      }
      /* Tokens completos do tema e do acento (#42), no nome do MCP Apps. */
      postRaw(ctl, ctx.hostContext());
      return;
    }
    if (message.type === 'height') {
      /* Em tela cheia a altura do quadro é a da janela, não a do conteúdo: guardá-la
         faria o quadro voltar enorme ao sair (#52). */
      if (ctl.card.classList.contains('activity-fullscreen')) return;
      const raw = Number(message.payload && message.payload.height) || 0;
      const height = quadro.clampHeight(raw);
      if (Math.abs(height - (ctl.lastHeight || 0)) < 2) return;
      ctl.lastHeight = height;
      ctl.frameHost.style.height = `${height}px`;
      return;
    }
    if (message.type === 'state') {
      ctl.lastState = message.payload;
      scheduleSave(ctl);
      return;
    }
    if (message.type === 'attempt') {
      /* Tentativa é ação explícita do aluno: grava JÁ, incluindo um estado
         coalescido que ainda não tinha sido aplicado. */
      ctl.lastAttempt = message.payload;
      if (ctl.pendingState !== undefined) {
        if (ctl.stateCoalesceTimer) {
          clearTimeout(ctl.stateCoalesceTimer);
          ctl.stateCoalesceTimer = null;
        }
        ctl.lastState = ctl.pendingState;
        ctl.pendingState = undefined;
        ctl.lastStateAt = ctx.now();
      }
      ctl.dirty = true;
      flushState(ctl);
      return;
    }
    if (message.type === 'error') {
      ctl.artifactError = String(message.payload && message.payload.message || t('activity.error.generic')).slice(0, 400);
      ctx.setError(ctl, ctl.artifactError);
    }
  }
  function enforceMountBudget(except) {
    let evicted = null;
    while (ctx.host.mounted.size >= ctx.maxMounted) {
      const victim = [...ctx.host.mounted].find((card) => card !== except);
      if (!victim) return false;
      flushState(victim);
      stopFrame(victim);
      evicted = victim;
      victim.card.dataset.state = 'paused';
      if (victim.poster) victim.poster.hidden = false;
      if (victim.posterText) victim.posterText.textContent = t('activity.paused');
      if (victim.openBtn) victim.openBtn.hidden = false;
      victim.updateButtons?.();
    }
    return evicted === null || ctx.host.mounted.size < ctx.maxMounted;
  }
  function mount(ctl, {restore, fresh = false} = {}) {
    if (ctl.stopped) return false;
    /* Parar o PRÓPRIO card ANTES de medir a quota: reiniciar/reabrir um card
       montado não pode despejar outra atividade sem relação. */
    stopFrame(ctl);
    if (!enforceMountBudget(ctl)) {
      ctl.poster.hidden = false;
      ctl.posterText.textContent = t('activity.openToLoad');
      ctx.openButton(ctl).hidden = false;
      ctl.updateButtons?.();
      return false;
    }
    /* Cada montagem é um contexto novo: `initialized` volta a falso (o próximo
       ready recebe init) e os contadores de taxa são do contexto. O estado
       inicial é o mais recente aceito (ou o snapshot persistido), nunca um
       snapshot velho. */
    ctl.initialized = false;
    ctl.messageCount = 0;
    ctl.lastStateAt = 0;
    ctl.lastHeightAt = 0;
    ctl.lastErrorAt = 0;
    if (fresh) {
      ctl.lastState = null;
      ctl.lastAttempt = null;
      ctl.restoreState = null;
    } else {
      ctl.restoreState = restore !== undefined ? restore : stateForMount(ctl);
    }
    const frame = ctx.doc.createElement('iframe');
    frame.className = 'activity-iframe';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    /* O título é para o leitor de tela; o balão do app não o repete sobre o quadro. */
    frame.setAttribute('data-no-tip', '');
    frame.setAttribute('title', quadro.frameTitle(ctl.kind, ctl.item.title || ''));
    ctl.frame = frame;
    ctl.failed = false;
    ctx.host.mounted.add(ctl);
    ctl.poster.hidden = true;
    ctl.card.dataset.state = 'loading';
    ctx.setError(ctl, '');
    ctl.readyTimer = setTimeout(() => {
      ctl.readyTimer = null;
      if (ctl.frame && ctl.card.dataset.state === 'loading') {
        ctl.failed = true;
        ctx.setError(ctl, t('activity.error.timeout'));
        stopFrame(ctl);
        ctl.card.dataset.state = 'timeout';
        ctl.poster.hidden = false;
        ctl.posterText.textContent = t('activity.retry');
        ctl.updateButtons?.();
      }
    }, ctx.readyTimeoutMs);
    frame.src = buildActivityUrl(ctl.item, ctx.currentTheme(), ctx.currentAccent());
    ctl.frameHost.textContent = '';
    /* Nasce com a altura medida antes de publicar, para a largura da coluna
       (#42): sem pulo quando o quadro reporta a dele. Sem medição, a reserva
       de sempre. */
    const width = ctl.stage ? ctl.stage.clientWidth : 0;
    const start = quadro.initialHeight(ctl.item.heights, width);
    ctl.lastHeight = start || HEIGHT_RESERVED;
    ctl.frameHost.style.height = `${ctl.lastHeight}px`;
    ctl.frameHost.append(frame);
    return true;
  }
  return {stopFrame, flushState, postRaw, post, onMessage, mount};
}
