// @ts-check
/* O seletor da cor de acento, um só para as Configurações e para a primeira
   abertura (#70: no teste manual a cor só aparecia depois do setup). Os dois
   grupos têm a mesma marcação e o mesmo teclado; aplicar e guardar entram por
   parâmetro, porque quem sabe do estado é o `state.mjs`. */

/** Os acentos na ordem das opções; azul é o padrão (`core/accent.bend`). */
export const ACCENT_IDS = /** @type {const} */ (['blue', 'violet', 'green', 'orange', 'pink', 'graphite']);

/**
 * As opções do grupo, com `data-i18n` para a tradução estática.
 * @returns {string}
 * @example accentOptionsMarkup().includes('data-accent="violet"') // true
 */
export function accentOptionsMarkup() {
  return ACCENT_IDS.map((id, i) => `<button type="button" role="radio" class="accent-option" data-accent="${id}" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span class="accent-dot" aria-hidden="true"></span><span data-i18n="settings.accent.${id}"></span></button>`).join('');
}

/**
 * Preenche os grupos vazios (`.accent-options`) das Configurações e do setup.
 * Roda antes do primeiro `setUiLanguage`, para os rótulos serem traduzidos.
 * @param {Document} [doc]
 * @example mountAccentOptions() // #accent-mode e #setup-accent ganham as seis opções
 */
export function mountAccentOptions(doc = document) {
  for (const box of doc.querySelectorAll('.accent-options')) if (!box.childElementCount) box.innerHTML = accentOptionsMarkup();
}

/**
 * O acento vizinho pelas setas, dando a volta; outra tecla devolve ''.
 * @param {string} current @param {string} key
 * @returns {string}
 * @example nextAccent('graphite', 'ArrowRight') // 'blue'
 */
export function nextAccent(current, key) {
  const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[key];
  if (!step) return '';
  const index = Math.max(0, ACCENT_IDS.findIndex((id) => id === current));
  return ACCENT_IDS[(index + step + ACCENT_IDS.length) % ACCENT_IDS.length];
}

/**
 * Liga clique e setas de um grupo: o acento vale na hora e fica guardado.
 * @param {HTMLElement | null} group o elemento com `role="radiogroup"`
 * @param {{current: () => string, choose: (id: string) => void}} deps
 * @example wireAccentPicker($('#setup-accent'), {current: () => S.currentAccent, choose: id => {applyAccent(id); save(true);}})
 */
export function wireAccentPicker(group, {current, choose}) {
  if (!group) return;
  group.addEventListener('click', (event) => {
    const option = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest?.('[data-accent]'));
    if (option?.dataset.accent) choose(option.dataset.accent);
  });
  group.addEventListener('keydown', (event) => {
    const next = nextAccent(current(), event.key);
    if (!next) return;
    event.preventDefault();
    choose(next);
    /** @type {HTMLElement | null} */ (group.querySelector(`[data-accent="${next}"]`))?.focus();
  });
}
