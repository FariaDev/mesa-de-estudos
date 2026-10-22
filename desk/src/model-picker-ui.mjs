// @ts-check
import {icon} from '../icons.mjs';
import {t, text} from './ui-text.mjs';
import {groupModels, flattenGroups, railEntries, stepActive, initialActive, modelKey, pushRecent, normalizeRecents, normalizeFavorites, toggleFavorite, alignedScrollTop, isFavoriteShortcut, activeAfterFlip} from './model-picker.mjs';
import {railButton, groupNode, itemRow, defaultRow, waitingRow, chartTokens} from './model-picker-rows.mjs';

/* O seletor de modelo do `#model-pop` (#59), a parte que toca o DOM. Substitui o
   `<select>` por uma caixa de busca (`role=combobox`, o foco fica nela) e uma
   lista (`role=listbox`) com grupos por provedor, os recentes no topo e os
   grátis num grupo só deles. A mecânica do teclado é a do menu `@` (#53): ↑↓ com
   volta, ⏎ escolhe, Esc fecha o popover; o foco nunca sai da busca, a linha
   ativa vai em `aria-activedescendant`. Agrupar, filtrar e andar o índice são
   funções puras de `model-picker.mjs`.

   Os marcadores `data-free` e `data-zen-paid` seguem nas linhas: o aviso de
   cobrança do Zen pago (#44) pergunta uma vez, em `main.mjs`. Os recentes e os
   favoritos vão no `desk.json` (estado de interface, fora do `config.json`)
   pelo `save-state`.

   Acabamento visual (#59): cada linha tem duas camadas, o nome (com o selo
   "Grátis") em cima e o logo e o nome do provedor embaixo, e uma estrela à
   direita que liga e desliga o favorito. O trilho usa os logos de
   `provider-icons.mjs`; Favoritos, Recentes e Grátis usam estrela, relógio e faísca. */

/** @typedef {import('./model-picker.mjs').PickerItem} PickerItem */
/** @typedef {{provider: string, id: string, zenPaid: boolean, free: boolean}} ModelPick */

const SEARCH = '#model-search';
const LIST = '#model-list';
const EMPTY = '#model-empty';
const RAIL = '#model-rail';
const STATUS = '#model-picker-status';
const IS_MAC = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

const picker = {
  /** @type {Array<{name?: string, id: string, provider: string, free?: {is?: boolean, tail?: string[]}}>} */
  catalog: [],
  engine: 'pi',
  selectedKey: '',
  query: '',
  disabled: true,
  /** @type {PickerItem[]} */
  rows: [],
  active: -1,
  /** @type {import('./model-picker.mjs').ModelRecents} */
  recents: {},
  /** @type {import('./model-picker.mjs').ModelFavorites} */
  favorites: {},
  /** @type {null | ((pick: ModelPick) => void)} */
  onPick: null,
  /** @type {null | (() => void)} */
  onFavorites: null,
};

/** @param {string} selector @returns {HTMLElement | null} */
const el = (selector) => document.querySelector(selector);

/**
 * Liga a busca, a lista e o teclado; `pick` recebe a linha escolhida e
 * `favoritesChanged` avisa que a estrela mudou algo a gravar.
 * `initModelPicker({pick: ({provider, id}) => trocarModelo(provider, id), favoritesChanged: () => gravar()})`
 * @param {{pick: (pick: ModelPick) => void, favoritesChanged?: () => void}} wiring
 */
export function initModelPicker({pick, favoritesChanged}) {
  picker.onPick = pick;
  picker.onFavorites = favoritesChanged || null;
  const search = /** @type {HTMLInputElement | null} */ (el(SEARCH));
  const list = el(LIST);
  if (!search || !list) return;
  mountChrome(search);
  search.addEventListener('input', () => { picker.query = search.value; paint({resetActive: true}); });
  search.addEventListener('keydown', onKeydown);
  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', onListClick);
  el(RAIL)?.addEventListener('click', onRailClick);
  list.addEventListener('mousemove', (event) => { const at = rowIndexOf(event.target); if (at >= 0 && at !== picker.active) setActive(at, {scroll: false}); });
  paint({resetActive: true});
}

/**
 * Atualiza o catálogo, o motor e/ou o modelo em uso (`selected` é `[provedor, id]`
 * ou `null`) e repinta a lista. Sem argumentos, só repinta (troca de idioma).
 * `renderModelPicker({catalog, engine: 'pi', selected: ['xai', 'grok-4']})`
 * @param {{catalog?: Array<{name?: string, id: string, provider: string, free?: {is?: boolean, tail?: string[]}}>, engine?: string, selected?: [string, string] | null}} [change]
 */
export function renderModelPicker(change = {}) {
  if (change.catalog) picker.catalog = change.catalog;
  if (change.engine) picker.engine = change.engine;
  if (change.selected !== undefined) picker.selectedKey = change.selected ? modelKey(change.selected[0], change.selected[1]) : '';
  paint({resetActive: true});
}

/**
 * Trava a escolha (turno em andamento, tutor desligado, motor sem seletor). A
 * busca fica só para leitura em vez de `disabled`, para o foco não se perder
 * no meio de uma troca.
 * @param {boolean} disabled
 */
export function setModelPickerDisabled(disabled) {
  picker.disabled = !!disabled;
  const search = /** @type {HTMLInputElement | null} */ (el(SEARCH));
  const box = el('#model-picker');
  if (search) { search.readOnly = picker.disabled; search.setAttribute('aria-disabled', String(picker.disabled)); }
  if (box) box.dataset.disabled = picker.disabled ? '1' : '';
  el(LIST)?.setAttribute('aria-disabled', String(picker.disabled));
}

/** Recentes lidos do estado de interface (`initialData`). @param {unknown} raw */
export function loadModelRecents(raw) {
  picker.recents = normalizeRecents(raw);
  paint({resetActive: true});
}

/** Os recentes para o `save-state`. */
export function modelRecentsSnapshot() {
  return picker.recents;
}

/** Favoritos lidos do estado de interface (`initialData`). @param {unknown} raw */
export function loadModelFavorites(raw) {
  picker.favorites = normalizeFavorites(raw);
  paint({resetActive: false});
}

/** Os favoritos para o `save-state`. */
export function modelFavoritesSnapshot() {
  return picker.favorites;
}

/**
 * Anota o modelo escolhido nos recentes do motor, mas só se o host confirmou a
 * troca (o modelo em uso é o escolhido). Devolve `true` quando mudou algo a gravar.
 * @param {string} provider
 * @param {string} id
 * @returns {boolean}
 */
export function noteModelPicked(provider, id) {
  if (picker.selectedKey !== modelKey(provider, id)) return false;
  picker.recents = pushRecent(picker.recents, picker.engine, provider, id);
  paint({resetActive: true});
  return true;
}

/** Ao abrir o popover: busca limpa e a linha em uso à vista. */
export function resetModelSearch() {
  picker.query = '';
  const search = /** @type {HTMLInputElement | null} */ (el(SEARCH));
  if (search) search.value = '';
  paint({resetActive: true});
}

/* O trilho de provedores e a lupa nascem aqui, não no `index.html`, que não pode
   crescer. Os dois são só visuais: o foco fica na busca, e os grupos já têm
   título para quem usa leitor de tela. */
/** @param {HTMLInputElement} search */
function mountChrome(search) {
  const box = el('#model-picker');
  if (!box || el(RAIL)) return;
  const rail = document.createElement('div');
  rail.id = 'model-rail';
  rail.className = 'model-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.hidden = true;
  rail.addEventListener('mousedown', (event) => event.preventDefault());
  const lens = document.createElement('span');
  lens.className = 'model-search-icon';
  lens.setAttribute('aria-hidden', 'true');
  lens.innerHTML = icon('search');
  /* A estrela muda pelo teclado sem tirar o foco da busca: o leitor de tela
     ouve o novo estado por esta região (#58). */
  const status = document.createElement('span');
  status.id = STATUS.slice(1);
  status.className = 'model-picker-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  box.prepend(rail);
  search.after(lens);
  box.append(status);
}

/** @param {MouseEvent} event */
function onRailClick(event) {
  const entry = event.target instanceof Element ? event.target.closest('[data-group]') : null;
  const list = el(LIST);
  const group = entry && list ? list.querySelector(`.model-group[data-group="${/** @type {HTMLElement} */ (entry).dataset.group}"]`) : null;
  if (!group || !list) return;
  list.scrollTop += group.getBoundingClientRect().top - list.getBoundingClientRect().top - 4;
  const first = group.querySelector('[data-row]');
  if (first) setActive(Number(/** @type {HTMLElement} */ (first).dataset.row), {scroll: false});
}

/* A estrela não escolhe a linha: só liga ou desliga o favorito. */
/** @param {MouseEvent} event */
function onListClick(event) {
  const at = rowIndexOf(event.target);
  if (at < 0) return;
  const star = event.target instanceof Element && event.target.closest('.model-row-star');
  if (star) { flipFavorite(at); return; }
  choose(at);
}

/* Só linha com estrela (a lista plana do Claude não tem favoritos). Depois
   de repintar, a linha ativa segue o mesmo modelo e o novo estado é anunciado. */
/** @param {number} at */
function flipFavorite(at) {
  const item = picker.rows[at];
  if (!item || !el(LIST)?.querySelector(`[data-row="${at}"] .model-row-star`)) return;
  picker.favorites = toggleFavorite(picker.favorites, picker.engine, item.provider, item.id);
  const list = el(LIST);
  const keep = list ? list.scrollTop : 0;
  paint({resetActive: false});
  if (list) list.scrollTop = keep;
  setActive(activeAfterFlip(picker.rows, item.key, at), {scroll: false});
  const on = picker.rows.some((row) => row.key === item.key && row.favorite);
  const status = el(STATUS);
  if (status) status.textContent = t(on ? 'modelPicker.star.added' : 'modelPicker.star.removed', {model: item.name});
  picker.onFavorites?.();
}

/** @param {KeyboardEvent} event */
function onKeydown(event) {
  const {key} = event;
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    setActive(stepActive(picker.rows.length, picker.active, key === 'ArrowDown' ? 1 : -1), {scroll: true});
    return;
  }
  if (key === 'Enter') {
    event.preventDefault();
    choose(picker.active);
    return;
  }
  if (!isFavoriteShortcut(event, IS_MAC)) return;
  event.preventDefault();
  event.stopPropagation();
  flipFavorite(picker.active);
}

/** @param {number} at */
function choose(at) {
  const item = picker.rows[at];
  if (!item || picker.disabled || item.key === picker.selectedKey) return;
  picker.onPick?.({provider: item.provider, id: item.id, zenPaid: item.zenPaid, free: item.free});
}

/** @param {EventTarget | null} target @returns {number} */
function rowIndexOf(target) {
  const row = target instanceof Element ? target.closest('[role="option"][data-row]') : null;
  return row ? Number(/** @type {HTMLElement} */ (row).dataset.row) : -1;
}

/** @param {number} at @param {{scroll: boolean, center?: boolean}} how */
function setActive(at, {scroll, center = false}) {
  picker.active = at;
  const list = el(LIST);
  if (!list) return;
  for (const row of list.querySelectorAll('[role="option"][data-row]')) row.classList.toggle('active', Number(/** @type {HTMLElement} */ (row).dataset.row) === at);
  const active = list.querySelector(`[data-row="${at}"]`);
  const search = el(SEARCH);
  if (active) search?.setAttribute('aria-activedescendant', active.id);
  else search?.removeAttribute('aria-activedescendant');
  if (active && scroll) reveal(list, /** @type {HTMLElement} */ (active), center);
  markRail(active?.closest('.model-group')?.getAttribute('data-group') ?? null);
}

/** O provedor da linha ativa fica marcado no trilho. @param {string | null} group */
function markRail(group) {
  for (const entry of document.querySelectorAll(`${RAIL} [data-group]`)) {
    const on = /** @type {HTMLElement} */ (entry).dataset.group === group;
    entry.classList.toggle('active', on);
  }
}

/* A primeira linha de um grupo rola até o topo da lista, para o título não
   ficar escondido acima dela. Ao abrir, a linha em uso vai para o meio e a
   rolagem para no começo de um item: nenhuma linha cortada no topo. */
/** @param {HTMLElement} list @param {HTMLElement} row @param {boolean} center ao abrir, a linha em uso fica no meio, não colada na borda */
function reveal(list, row, center) {
  if (picker.active === 0) { list.scrollTop = 0; return; }
  row.scrollIntoView({block: center ? 'center' : 'nearest'});
  if (!center) return;
  list.scrollTop = alignedScrollTop(list.scrollTop, itemEdges(list), parseFloat(getComputedStyle(list).paddingTop) || 0);
}

/** Títulos de grupo e linhas em coordenadas da lista (rolagem inclusa). @param {HTMLElement} list */
function itemEdges(list) {
  const base = list.getBoundingClientRect().top - list.scrollTop;
  return [...list.querySelectorAll('.model-group-title, .model-section-title, .model-row')].map((node) => {
    const box = node.getBoundingClientRect();
    return {top: box.top - base, bottom: box.bottom - base};
  });
}

/** @param {{resetActive: boolean}} how */
function paint({resetActive}) {
  const list = el(LIST);
  if (!list) return;
  const groups = groupModels(picker.catalog, {engine: picker.engine, query: picker.query, recents: picker.recents[picker.engine] || [], favorites: picker.favorites[picker.engine] || [], label: text});
  picker.rows = flattenGroups(groups);
  const waiting = picker.catalog.length === 0;
  const fallback = picker.engine === 'opencode' && !picker.query.trim() && !waiting;
  let row = 0;
  /** @type {(item: PickerItem, context: import('./model-picker-rows.mjs').RowContext) => Node} */
  const rowOf = (item, context) => itemRow(item, context, row++);
  const fragment = document.createDocumentFragment();
  if (waiting) fragment.append(waitingRow());
  if (fallback) fragment.append(defaultRow(picker.selectedKey === ''));
  groups.forEach((group, groupAt) => {
    if (group.kind !== 'flat') { fragment.append(groupNode(group, groupAt, rowOf, picker.selectedKey)); return; }
    for (const item of group.items) fragment.append(rowOf(item, {selectedKey: picker.selectedKey, short: false, kind: 'flat'}));
  });
  list.replaceChildren(fragment);
  paintPalette();
  paintChrome(groups.length === 0 && !waiting);
  paintRail(groups);
  const keep = resetActive ? (picker.query.trim() ? 0 : initialActive(picker.rows, picker.selectedKey)) : Math.min(picker.active, picker.rows.length - 1);
  setActive(keep, {scroll: resetActive && !picker.query.trim(), center: true});
}

/* As cores dos monogramas seguem o tema e o acento: a paleta vai na caixa do seletor a cada pintura. */
function paintPalette() {
  const box = el('#model-picker');
  if (!box) return;
  for (const [name, value] of chartTokens(document)) box.style.setProperty(name, value);
}

/** @param {boolean} noMatch */
function paintChrome(noMatch) {
  const search = /** @type {HTMLInputElement | null} */ (el(SEARCH));
  if (search) search.placeholder = t('modelPicker.search');
  const empty = el(EMPTY);
  if (!empty) return;
  empty.hidden = !noMatch;
  empty.textContent = noMatch ? t('modelPicker.noMatch', {query: picker.query.trim()}) : '';
}

/** @param {import('./model-picker.mjs').PickerGroup[]} groups */
function paintRail(groups) {
  const rail = el(RAIL);
  if (!rail) return;
  const entries = railEntries(groups);
  rail.hidden = entries.length === 0;
  rail.replaceChildren(...entries.map((entry) => railButton(entry)));
}
