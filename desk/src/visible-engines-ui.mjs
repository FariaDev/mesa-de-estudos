// @ts-check
import {S} from './state.mjs';
import {t} from './ui-text.mjs';

/* A vista deste release na janela (#release OpenCode): o host manda
   `visibleEngines` em todo payload. Sem a lista (renderer de teste aberto
   direto), valem os motores do código para não esconder um fake que o teste
   acabou de instalar. */

/**
 * @returns {string[]}
 * @example visibleEngines() // ['opencode']
 */
export function visibleEngines() {
  return Array.isArray(S.visibleEngines) && S.visibleEngines.length ? S.visibleEngines : ['claude', 'opencode'];
}

/* Claude fora da vista: a linha some de Configurações e dos créditos. */
export function applyEngineVisibility() {
  const showClaude = visibleEngines().includes('claude');
  const claudeSetting = document.querySelector('#cfg-claude')?.closest('label');
  if (claudeSetting) claudeSetting.hidden = !showClaude;
  document.querySelector('[data-package="@anthropic-ai/claude-agent-sdk"]')?.toggleAttribute('hidden', !showClaude);
}

/* O motor visível que recebe a continuidade de uma sessão antiga (#87). */
export function legacyContinueEngine() {
  const visible = visibleEngines();
  return visible.includes('opencode') ? 'opencode' : (visible[0] || '');
}

/* O botão "Continuar…" é escrito à mão (o motor entra por parâmetro), então o
   `build` estático não o retraduz: a troca de idioma reaplica pelo evento de
   idioma no main (#87). */
/** @returns {void} */
export function relabelLegacySession() {
  const target = legacyContinueEngine();
  const continueButton = /** @type {HTMLButtonElement | null} */ (document.querySelector('#legacy-continue'));
  if (continueButton) {
    continueButton.hidden = !target;
    if (target) continueButton.textContent = t('session.legacy.continue', {engine: t(target === 'claude' ? 'engine.claudeExperimental' : 'engine.opencode')});
  }
}

/* Conversa antiga de motor fora da vista: a lista abre e o histórico fica
   legível, mas o composer sai de cena com a frase, o botão de continuar com o
   contexto e o de sessão nova vazia. */
/** @param {boolean} on */
export function setLegacySession(on) {
  S.legacySession = !!on;
  const box = /** @type {HTMLElement | null} */ (document.querySelector('#composer-box'));
  const banner = /** @type {HTMLElement | null} */ (document.querySelector('#legacy-session'));
  if (box) box.hidden = !!on;
  if (banner) banner.hidden = !on;
  relabelLegacySession();
  /* A coluna decide se mostra o estado do tutor com este fato; o evento a
     repinta na troca (ida e volta entre conversa antiga e atual). */
  window.dispatchEvent(new Event('desk-tutor-link'));
}
