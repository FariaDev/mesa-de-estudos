// @ts-check
/* A faixa de esforço no rodapé do popover de modelo (acabamento da #59): os
   níveis que o motor oferece viram botões lado a lado (Desligado · Baixo ·
   Médio · Alto…), no lugar do `<select id="thinking-select">`. É um
   `role=radiogroup` com foco itinerante: Tab entra no nível marcado, ←→ (e ↑↓)
   andam com volta e já escolhem, Home e End vão às pontas, como um grupo de
   rádios nativo. Os caps são os de antes: quem decide se a faixa está à vista e
   travada é `state.mjs` (`#effort-field`, `capabilities().effort`).

   Travada, a faixa usa `aria-disabled` e não `disabled`: o foco fica nela no
   meio de uma troca (o host trava enquanto o motor confirma o nível). */

const STRIP = '#effort-strip';

const EFFORT_LEVELS = ['default', 'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
/* O nível `default` deixa o MOTOR escolher; o texto diz qual (#58: no
   OpenCode a faixa dizia "Padrão do Claude"). Motor sem nome próprio fica com
   o "Padrão" neutro. */
const DEFAULT_EFFORT_KEYS = {claude: 'effort.defaultClaude', opencode: 'effort.defaultOpenCode'};

/**
 * Texto de um nível de esforço no idioma da tela; nível desconhecido volta cru.
 * `effortLevelText('default', 'opencode', t)` → "Padrão do OpenCode"
 * @param {string} level @param {string} engine @param {(key: string) => string} t
 * @returns {string}
 */
export function effortLevelText(level, engine, t) {
  if (level === 'default') return t(Object.hasOwn(DEFAULT_EFFORT_KEYS, engine) ? DEFAULT_EFFORT_KEYS[engine] : 'effort.default');
  return EFFORT_LEVELS.includes(level) ? t(`effort.${level}`) : level;
}

/** @typedef {{levels: string[], value: string, label: (level: string) => string, title?: string}} EffortStripView */

const strip = {
  /** @type {string[]} */
  levels: [],
  value: '',
  disabled: true,
  /** @type {null | ((level: string) => void)} */
  onPick: null,
};

/** @returns {HTMLElement | null} */
const root = () => document.querySelector(STRIP);

/**
 * Liga o clique e o teclado; `pick` recebe o nível escolhido.
 * `initEffortStrip({pick: (level) => settings({level})})`
 * @param {{pick: (level: string) => void}} wiring
 */
export function initEffortStrip({pick}) {
  strip.onPick = pick;
  const box = root();
  if (!box) return;
  box.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[role="radio"][data-level]') : null;
    if (button) choose(/** @type {HTMLElement} */ (button).dataset.level || '');
  });
  box.addEventListener('keydown', onKeydown);
}

/**
 * Pinta os níveis do motor e marca o atual. `label` dá o texto de cada nível no
 * idioma da tela; `title` explica a faixa travada (Claude sem modelo explícito).
 * `renderEffortStrip({levels: ['off', 'low', 'high'], value: 'low', label: (l) => l})`
 * @param {EffortStripView} view
 */
export function renderEffortStrip({levels, value, label, title = ''}) {
  strip.levels = [...levels];
  strip.value = value;
  const box = root();
  if (!box) return;
  box.title = title;
  const fresh = strip.levels.map((level) => radioOf(level, label(level)));
  /* Repintar a cada confirmação do host tirava o foco de quem anda com ←→:
     com os mesmos botões, só as marcas mudam; reconstruída, o foco volta. */
  if (!sameButtons(box, fresh)) {
    const hadFocus = box.contains(document.activeElement);
    box.replaceChildren(...fresh);
    paintChecked();
    if (hadFocus) /** @type {HTMLElement | null} */ (box.querySelector('[tabindex="0"]'))?.focus();
  } else paintChecked();
  setEffortStripDisabled(strip.disabled);
}

/** Os botões já na faixa são os mesmos (nível e texto) que os novos? @param {HTMLElement} box @param {HTMLElement[]} fresh */
function sameButtons(box, fresh) {
  const current = [...box.querySelectorAll('[role="radio"]')];
  return current.length === fresh.length && current.every((button, at) => /** @type {HTMLElement} */ (button).dataset.level === fresh[at].dataset.level && button.textContent === fresh[at].textContent);
}

/**
 * Trava ou solta a escolha (turno em andamento, motor sem esforço, troca no meio).
 * @param {boolean} disabled
 */
export function setEffortStripDisabled(disabled) {
  strip.disabled = !!disabled;
  const box = root();
  if (!box) return;
  box.setAttribute('aria-disabled', String(strip.disabled));
  for (const button of box.querySelectorAll('[role="radio"]')) button.setAttribute('aria-disabled', String(strip.disabled));
}

/** O nível marcado agora (`''` antes de haver catálogo). @returns {string} */
export function effortStripValue() {
  return strip.value;
}

/** @param {string} level @param {string} text */
function radioOf(level, text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'effort-option';
  button.setAttribute('role', 'radio');
  button.dataset.level = level;
  button.textContent = text;
  return button;
}

/* Foco itinerante: só o nível marcado (ou o primeiro) entra na ordem do Tab. */
function paintChecked() {
  const box = root();
  if (!box) return;
  const buttons = [...box.querySelectorAll('[role="radio"]')];
  const at = Math.max(0, strip.levels.indexOf(strip.value));
  buttons.forEach((button, index) => {
    button.setAttribute('aria-checked', String(index === strip.levels.indexOf(strip.value)));
    button.setAttribute('tabindex', index === at ? '0' : '-1');
  });
}

/** @param {string} level */
function choose(level) {
  if (strip.disabled || !strip.levels.includes(level) || level === strip.value) return;
  strip.value = level;
  paintChecked();
  strip.onPick?.(level);
}

/**
 * O índice de destino de uma tecla do grupo, com volta nas pontas; -1 se a
 * tecla não anda.
 * `effortKeyTarget('ArrowRight', 3, 2)` → `0`; `effortKeyTarget('Home', 3, 2)` → `0`
 * @param {string} key
 * @param {number} count quantos níveis há
 * @param {number} index o nível marcado
 * @returns {number}
 */
export function effortKeyTarget(key, count, index) {
  if (count <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (!step) return -1;
  return (Math.max(0, index) + step + count) % count;
}

/** @param {KeyboardEvent} event */
function onKeydown(event) {
  const target = effortKeyTarget(event.key, strip.levels.length, strip.levels.indexOf(strip.value));
  if (target < 0) return;
  event.preventDefault();
  if (strip.disabled) return;
  choose(strip.levels[target]);
  /** @type {HTMLElement | null | undefined} */ (root()?.querySelector(`[data-level="${CSS.escape(strip.levels[target])}"]`))?.focus();
}
