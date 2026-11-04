// @ts-check
/* Cor de acento (#9): estado de interface, como o tema. O nome do acento é o
   que o `desk.json` grava (núcleo `core/accent.bend`). Este módulo também
   aplica a marca do cabeçalho, que segue o acento (#101). */

/** Os acentos na ordem das opções; azul é o padrão. */
export const ACCENTS = /** @type {const} */ ([['blue', 'Azul'], ['violet', 'Violeta'], ['green', 'Verde'], ['orange', 'Laranja'], ['pink', 'Rosa'], ['graphite', 'Grafite']]);

/**
 * Atualiza a marca do cabeçalho para o acento corrente.
 * @param {any} S estado da Mesa
 * @param {Document} [doc]
 * @example applyBrandIcon(S)
 */
export function applyBrandIcon(S, doc = document) {
  const src = `assets/app-icon/lamp-${S.currentAccent}-128.png`;
  for (const brand of doc.querySelectorAll('.brand-icon')) brand.setAttribute('src', src);
}

/**
 * Aplica e marca a cor de acento.
 * @param {any} S
 * @param {unknown} value
 * @param {Document} [doc]
 */
export function applyAccentState(S, value, doc = document) {
  S.currentAccent = ACCENTS.some(([id]) => id === value) ? value : 'blue';
  if (S.currentAccent === 'blue') delete doc.documentElement.dataset.accent;
  else doc.documentElement.dataset.accent = S.currentAccent;
  for (const option of doc.querySelectorAll('.accent-option[data-accent]')) {
    const on = option.getAttribute('data-accent') === S.currentAccent;
    option.setAttribute('aria-checked', String(on));
    /** @type {HTMLElement} */ (option).tabIndex = on ? 0 : -1;
  }
  applyBrandIcon(S, doc);
}
