import * as quadro from './activity-view.mjs';
import {markup} from './markdown.mjs';
import {icon} from '../icons.mjs';
import {t,formatNumber} from './ui-text.mjs';
import {HEIGHT_RESERVED} from './activity-messages.mjs';

/* Quadro de atividade — o cartão no DOM: casca, botões, status, fatos do
   rascunho e tela cheia.
   Saiu do createActivityHost (activity.mjs) na #43 fase 2. */

/**
 * Cria as funções deste grupo sobre o contexto compartilhado do host.
 * @param {object} ctx estado e funções do `createActivityHost` (getters preguiçosos)
 * @returns {{element, setError, openButton, setFullscreen, renderCard, factLines, onEscape}}
 * @example Object.assign(ctx,createActivityCardDom(ctx));
 */
export function createActivityCardDom(ctx) {
  /* ---------- DOM ---------- */
  function element(tag, className, text) {
    const node = ctx.doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  /* Casca do quadro (#42): sem cabeçalho nem cartão. Título e descrição
     ficam para o leitor de tela; o palco guarda o pôster (antes de montar), o
     iframe e as ferramentas do canto; a atividade ganha a linha de baixo. */
  function shell(card, {title = t('activity.defaultTitle'), kind = 'atividade', status = 'preparing', message = ''} = {}) {
    card.textContent = '';
    card.dataset.state = status;
    card.dataset.kind = quadro.kindOf(kind);
    const heading = element('h3', 'activity-sr activity-title', quadro.frameTitle(kind, title));
    const stage = element('div', 'activity-stage');
    const poster = element('div', 'activity-poster');
    poster.append(element('span', 'activity-poster-text', message || (status === 'preparing' ? t('activity.preparing') : t('activity.closed'))));
    const frameHost = element('div', 'activity-frame');
    const tools = element('div', 'activity-tools');
    stage.append(poster, frameHost, tools);
    const error = element('div', 'activity-error');
    error.hidden = true;
    const foot = element('div', 'activity-foot');
    foot.hidden = !quadro.showsBring(kind);
    card.append(heading, stage, error, foot);
    return {poster, frameHost, error, actions: foot, foot, stage, tools, head: heading};
  }
  /* Botão fantasma da Mesa: 30px, sem borda, ícone + rótulo. `iconOnly` deixa só
     o ícone (o rótulo vira aria-label/title). */
  function actionButton(parent, label, act, {hidden = true, iconName = '', iconOnly = false, className = 'activity-action'} = {}) {
    const button = element('button', className);
    button.type = 'button';
    button.dataset.act = act;
    button.hidden = hidden;
    paintButton(button, label, iconName, iconOnly);
    parent.append(button);
    return button;
  }
  function paintButton(button, label, iconName, iconOnly) {
    button.textContent = '';
    if (iconName) {
      const glyph = element('span', 'activity-action-icon');
      glyph.innerHTML = icon(iconName);
      glyph.setAttribute('aria-hidden', 'true');
      button.append(glyph);
    }
    if (iconOnly) {
      button.setAttribute('aria-label', label);
      button.title = label;
      button.classList.add('activity-action-icononly');
    } else {
      button.append(element('span', 'activity-action-label', label));
      button.title = label;
    }
  }
  function setError(ctl, message) {
    if (!ctl.error) return;
    ctl.error.hidden = !message;
    ctl.error.textContent = message || '';
  }
  function openButton(ctl) {
    return ctl.openBtn;
  }
  /* Tela cheia (#42): o MESMO iframe cobre a janela pelo CSS (sem
     reparenting, o contexto não recarrega). Esc ou o botão saem. */
  let fullscreenCtl = null;
  function setFullscreen(ctl, on) {
    if (!ctl || !ctl.card) return;
    const want = !!on && !!ctl.frame;
    if (want && fullscreenCtl && fullscreenCtl !== ctl) setFullscreen(fullscreenCtl, false);
    ctl.card.classList.toggle('activity-fullscreen', want);
    paintButton(ctl.expandBtn, want ? quadro.TEXT.exitFullscreen : quadro.TEXT.fullscreen, 'unfold', true);
    ctl.expandBtn.setAttribute('aria-pressed', want ? 'true' : 'false');
    fullscreenCtl = want ? ctl : (fullscreenCtl === ctl ? null : fullscreenCtl);
    /* #52: o quadro sabe que está em tela cheia (MCP Apps `displayMode`) para a figura crescer. */
    ctx.postRaw(ctl, {jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: {displayMode: want ? 'fullscreen' : 'inline'}});
    if (!want) ctl.frameHost.style.height = `${quadro.clampHeight(ctl.lastHeight || HEIGHT_RESERVED)}px`;
  }
  function renderCard(slot, item, spec, savedState, {live = false, stopped = false} = {}) {
    const existing = ctx.host.cards.get(item.toolCallId);
    if (existing && existing.item.id === item.id && existing.item.version === item.version && existing.card.parentNode === slot) {
      if (stopped) existing.stopped = true;
      if (live && !existing.stopped && !existing.frame) ctx.mount(existing);
      return existing;
    }
    const card = element('div', 'activity-card');
    slot.textContent = '';
    slot.append(card);
    /* Tipo (#42): visualização × atividade; o que não diz é atividade (as
       salvas antes do #42 também). Os controles saem do núcleo. */
    const kind = quadro.kindOf(spec.kind || item.view || '');
    const controls = new Set(quadro.controlIds(kind));
    const parts = shell(card, {title: spec.title, kind, status: live ? 'loading' : 'idle'});
    const openBtn = actionButton(parts.poster, quadro.TEXT.open, 'open', {hidden: false, iconName: 'rotateCw'});
    const restartBtn = actionButton(parts.tools, quadro.TEXT.restart, 'restart', {hidden: true, iconName: 'rotateCw', iconOnly: true});
    const stopBtn = actionButton(parts.tools, quadro.TEXT.stop, 'stop', {hidden: true, iconName: 'square', iconOnly: true});
    const expandBtn = actionButton(parts.tools, quadro.TEXT.fullscreen, 'expand', {hidden: !live, iconName: 'unfold', iconOnly: true, className: 'activity-action activity-expand'});
    const draftBtn = actionButton(parts.foot, quadro.TEXT.bring, 'draft', {hidden: !controls.has('bring'), iconName: 'messageSquare'});
    /* Descrição textual: no DOM para o leitor de tela, fora da vista. */
    const alternative = element('div', 'activity-sr activity-alternative');
    alternative.append(element('span', '', `${quadro.TEXT.description}: `));
    const altBody = element('div', 'activity-alt-body');
    try {
      altBody.innerHTML = markup(spec.alternativeMarkdown, false);
    } catch {
      altBody.textContent = spec.alternativeMarkdown;
    }
    alternative.append(altBody);
    card.append(alternative);

    const ctl = {
      card, slot, item, spec, parts, kind, controls,
      stage: parts.stage,
      poster: parts.poster, posterText: parts.poster.querySelector('.activity-poster-text'),
      frameHost: parts.frameHost, error: parts.error,
      openBtn, expandBtn, restartBtn, stopBtn, draftBtn,
      frame: null, lastState: savedState && savedState.values !== undefined ? savedState.values : null,
      lastAttempt: savedState && savedState.attempt !== undefined ? savedState.attempt : null,
      restoreState: savedState && savedState.values !== undefined ? savedState.values : null,
      scopeRef: item.scopeRef || '',
      dirty: false, stopped: stopped === true, opened: false, auto: live,
      messageCount: 0, lastStateAt: 0, lastHeightAt: 0, lastErrorAt: 0,
      pendingState: undefined, stateCoalesceTimer: null,
      initialized: false,
      saveInFlight: false, saveFailures: 0, saveFailed: false, artifactError: '',
      saveTimer: null, readyTimer: null, visibilityTimer: null,
    };
    ctx.host.cards.set(item.toolCallId, ctl);

    ctl.status = element('span', 'activity-status');
    parts.foot.append(ctl.status);

    openBtn.addEventListener('click', () => {
      ctl.opened = true;
      if (ctl.stopped) {
        ctl.stopped = false;
        ctl.card.dataset.state = 'idle';
      }
      ctl.auto = true;
      ctx.mount(ctl);
      updateButtons(ctl);
    });
    expandBtn.addEventListener('click', () => setFullscreen(ctl, !card.classList.contains('activity-fullscreen')));
    restartBtn.addEventListener('click', () => {
      ctl.stopped = false;
      ctl.opened = true;
      ctl.auto = true;
      ctx.mount(ctl, {fresh: true});
      updateButtons(ctl);
    });
    stopBtn.addEventListener('click', () => {
      ctx.flushState(ctl);
      setFullscreen(ctl, false);
      ctx.stopFrame(ctl);
      ctl.stopped = true;
      ctl.auto = false;
      ctl.card.dataset.state = 'stopped';
      ctl.poster.hidden = false;
      ctl.posterText.textContent = t('activity.stopped');
      setError(ctl, '');
      updateButtons(ctl);
    });
    draftBtn.addEventListener('click', () => {
      const text = ctx.draftFor(ctl);
      const target = ctx.composerElement();
      if (!target) {
        setStatus(ctl, t('activity.error.noDraft'));
        return;
      }
      const current = String(target.value || '');
      target.value = current.trim() ? `${current.replace(/\s+$/, '')}\n\n${text}` : text;
      target.dispatchEvent(new Event('input', {bubbles: true}));
      if (typeof target.focus === 'function') target.focus();
      setStatus(ctl, quadro.TEXT.bringDone);
    });

    function updateButtons() {
      const mounted = !!ctl.frame;
      const live = mounted || ctl.auto || ctl.opened;
      expandBtn.hidden = !mounted || !controls.has('fullscreen');
      restartBtn.hidden = !live || !controls.has('restart');
      stopBtn.hidden = !live || !controls.has('stop');
      openBtn.hidden = mounted;
      draftBtn.hidden = !controls.has('bring');
    }
    ctl.updateButtons = updateButtons;
    updateButtons();

    if (live) {
      ctx.mount(ctl, {restore: ctl.restoreState});
      updateButtons();
    }
    ctx.observeCard(ctl);
    return ctl;
  }
  function setStatus(ctl, text) {
    if (!ctl.status) return;
    ctl.status.textContent = text || '';
    if (text) {
      clearTimeout(ctl.statusTimer);
      ctl.statusTimer = setTimeout(() => { ctl.status.textContent = ''; }, 4000);
    }
  }
  /* Texto do rascunho "Levar ao tutor": a tentativa e o estado como fatos
     legíveis (um por linha), não JSON cru. Só ANEXA ao campo; o aluno revisa e
     envia. */
  function humanKey(key) {
    const text = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : String(key);
  }
  function humanValue(value) {
    if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : formatNumber(Math.round(value * 1000) / 1000);
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > 240 ? `${text.slice(0, 237)}…` : text;
  }
  function factLines(value) {
    if (value === null || value === undefined) return [];
    if (typeof value !== 'object') return [`- ${humanValue(value)}`];
    if (Array.isArray(value)) return value.length ? [`- ${humanValue(value)}`] : [];
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== '')
      .map(([key, item]) => `- ${humanKey(key)}: ${humanValue(item)}`);
  }
  function onEscape(event) {
    if (event.key !== 'Escape' || !fullscreenCtl) return;
    event.preventDefault();
    event.stopPropagation();
    const ctl = fullscreenCtl;
    setFullscreen(ctl, false);
    try { ctl.expandBtn.focus(); } catch { /* sem foco */ }
  }
  return {element, setError, openButton, setFullscreen, renderCard, factLines, onEscape};
}
