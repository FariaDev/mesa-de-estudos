import {icon} from '../icons.mjs';
import {t} from './ui-text.mjs';

/* Menu "Nova sessão" do cabeçalho do tutor (#87): interface pura — rótulo,
   ordem e "(atual)". Saiu de tutor-header.mjs para caber no teto de linhas
   (ADR 0003: o menu de motores não tem o que provar no núcleo). Com 2+
   motores visíveis E prontos ele lista os motores e a escolha cria a sessão
   nova COM passagem; com um motor só o "+" cria direto e não há menu. */

/** Chave de rótulo de cada motor no menu. */
const ENGINE_MENU_LABEL = {claude: 'engine.claudeExperimental', opencode: 'engine.opencode'};

/**
 * Os motores que entram no menu: visíveis neste release e prontos (instalados)
 * agora; o atual vem primeiro. Pura para o teste cobrir sem janela.
 * @param {{state: {engine?: string, detected?: {claude?: string, opencode?: string}}, visibleEngines: () => string[], engineReady: (facts: object) => boolean}} deps
 * @returns {{engine: string, label: string, current: boolean}[]}
 * @example sessionChoices({state: {engine: 'opencode'}, visibleEngines: () => ['claude', 'opencode'], engineReady: () => true});
 */
export function sessionChoices({state, visibleEngines, engineReady}) {
  const facts = {engine: state.engine, detectedClaude: state.detected?.claude, detectedOpenCode: state.detected?.opencode};
  return visibleEngines()
    .filter((engine) => engine === 'claude' || engine === 'opencode')
    .filter((engine) => engineReady({...facts, engine}))
    .map((engine) => ({engine, label: t(ENGINE_MENU_LABEL[engine]), current: engine === state.engine}))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/**
 * Desenha o menu de sessão nova no popover.
 * @param {{state: {engine?: string, detected?: object, currentSession?: string}, visibleEngines: () => string[], engineReady: (facts: object) => boolean, getHost: () => {newSession?: (request: object) => unknown} | null, closePops: (options?: {restoreFocus?: boolean}) => void}} deps
 * @returns {{choices: () => {engine: string, label: string, current: boolean}[], render: (pop: HTMLElement | null, trigger: HTMLElement | null) => {engine: string, label: string, current: boolean}[]}}
 * @example const menu = createNewSessionMenu({state: S, visibleEngines, engineReady, getHost: () => host, closePops: closeTutorPops});
 */
export function createNewSessionMenu({state, visibleEngines, engineReady, getHost, closePops}) {
  function menuButton(choice) {
    const button = document.createElement('button');
    button.type = 'button'; button.id = `new-session-${choice.engine}`; button.setAttribute('role', 'menuitem'); button.dataset.engine = choice.engine;
    button.innerHTML = icon('plus');
    const label = document.createElement('span');
    label.textContent = choice.current ? t('header.newSessionCurrent', {engine: choice.label}) : choice.label;
    button.append(' ', label);
    button.addEventListener('click', () => {
      closePops({restoreFocus: true});
      getHost()?.newSession?.({engine: choice.engine, carryFrom: state.currentSession});
    });
    return button;
  }

  function render(pop, trigger) {
    const choices = list();
    if (!pop) return choices;
    pop.replaceChildren();
    if (trigger) {
      if (choices.length > 1) trigger.setAttribute('aria-haspopup', 'menu');
      else trigger.removeAttribute('aria-haspopup');
    }
    if (choices.length < 2) return choices;
    const head = document.createElement('div');
    head.className = 'conv-head'; head.setAttribute('aria-hidden', 'true');
    const strong = document.createElement('strong');
    strong.textContent = t('header.newSession');
    head.append(strong);
    pop.append(head, ...choices.map(menuButton));
    return choices;
  }

  function list() {
    return sessionChoices({state, visibleEngines, engineReady});
  }

  return {choices: list, render};
}
