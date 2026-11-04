// @ts-check
import {S} from './state.mjs';

/* A vista deste release na janela (#release OpenCode): o host manda
   `visibleEngines` em todo payload. Sem a lista (renderer de teste aberto
   direto), valem todos para não esconder um fake que o teste acabou de instalar. */

/**
 * @returns {string[]}
 * @example visibleEngines() // ['opencode']
 */
export function visibleEngines() {
  return Array.isArray(S.visibleEngines) && S.visibleEngines.length ? S.visibleEngines : ['pi', 'claude', 'opencode'];
}

/* Pi e Claude fora da vista: as linhas somem de Configurações e dos créditos. */
export function applyEngineVisibility() {
  const showPi = visibleEngines().includes('pi'), showClaude = visibleEngines().includes('claude');
  const piSetting = document.querySelector('#cfg-pi')?.closest('label');
  if (piSetting) piSetting.hidden = !showPi || (!S.detected.pi && !S.appConfig?.piPath);
  const claudeSetting = document.querySelector('#cfg-claude')?.closest('label');
  if (claudeSetting) claudeSetting.hidden = !showClaude;
  document.querySelector('#about-credit-pi')?.toggleAttribute('hidden', !showPi || !S.detected.pi);
  document.querySelector('[data-package="@anthropic-ai/claude-agent-sdk"]')?.toggleAttribute('hidden', !showClaude);
}

/* Conversa antiga de motor fora da vista: a lista abre e o histórico fica
   legível, mas o composer sai de cena com a frase e o botão de sessão nova. */
/** @param {boolean} on */
export function setLegacySession(on) {
  S.legacySession = !!on;
  const box = /** @type {HTMLElement | null} */ (document.querySelector('#composer-box'));
  const banner = /** @type {HTMLElement | null} */ (document.querySelector('#legacy-session'));
  if (box) box.hidden = !!on;
  if (banner) banner.hidden = !on;
  /* A coluna decide se mostra o estado do tutor com este fato; o evento a
     repinta na troca (ida e volta entre conversa antiga e atual). */
  window.dispatchEvent(new Event('desk-tutor-link'));
}
