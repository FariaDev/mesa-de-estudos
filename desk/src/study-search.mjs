import searchCore from './generated/studysearch.core.js';
import {t, text, currentLanguage, LANGUAGE_EVENT} from './ui-text.mjs';
import {displayCourseName} from './free-names.mjs';
import {toNat, wholeNat} from './bend-nat.mjs';

/* ---------------------------------------------------------------------------
   Busca de estudos (Mesa): o diálogo único de busca (conversas Pi/Claude,
   chat lateral, Caderno, anotações, sessões Livre, matérias e texto de PDF).

   O módulo NÃO fala com o disco: pede ao host por `window.desk.studySearch` /
   `window.desk.studySearchResolve` (IPC proposta) e desenha o resultado. A
   política (fontes, tetos, pontuação, rótulos) vem do núcleo
   (`core/studysearch.bend`); aqui só entram DOM, teclado e a conversa com o
   host.

   Integração (o pai liga no shell):
     - `initStudySearch({onOpenResult, onAnnotate})` uma vez depois do boot;
       opcionalmente passe `{host}` para injetar a API (o teste faz isso);
     - a barra de ferramentas chama a ação pelo id `#study-search-open` (o
       núcleo `core/studytoolsview.bend` já cria esse botão) — o clique é
       delegado no documento, então funciona mesmo se a barra nascer depois;
     - atalho Ctrl/Cmd+Shift+F (NÃO substitui o Ctrl+F da busca do PDF, que
       continua sendo do leitor);
     - `onOpenResult(destino, hit)` recebe o destino já resolvido pelo host;
       sem handler, PDF/anotação abrem pelo `nav.mjs` e o resto vira o evento
       `mesa-open-study-result` no documento (a sessão/Caderno é do shell);
     - `onAnnotate(destino, hit)` recebe um resultado de PDF para anotar; sem
       handler, vira o evento `mesa-study-annotate` (o `pdf-notes.mjs` escuta).

   IPC esperada (host valida tudo; o renderer nunca manda caminho que autoriza
   leitura):
     - `study-search`       {query, scope:{sources?, courses?}, limit?}
                            → {hits, truncated, sources, courses, ...}
     - `study-search-resolve` {id} → {ok, kind, sessionPath?, path?, page?, ...}
     - `study-search-catalog` {} → {sources, courses} (opcional; o catálogo
       também vem da resposta da busca)
   --------------------------------------------------------------------------- */

const SOURCE_KEYS = ['conversa', 'lateral', 'nota', 'caderno', 'livre', 'materia', 'pdf'];
const TAGS = Object.freeze({
  conversa: {$: 'HsConv'},
  lateral: {$: 'HsSide'},
  nota: {$: 'HsNote'},
  caderno: {$: 'HsReview'},
  livre: {$: 'HsFree'},
  materia: {$: 'HsMaterial'},
  pdf: {$: 'HsPdf'},
});
const STYLE_ID = 'study-search-style';
const MAX_HITS = Number(searchCore.maxHits());

/* A dobra do destaque preserva o comprimento (os índices continuam válidos);
   é a mesma do leitor de PDF. O host manda o trecho já recortado. */
const FOLD_MAP = {á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n', ý: 'y', ÿ: 'y'};
function foldSearch(value) {
  return String(value ?? '').toLowerCase().replace(/[áàâãäåéèêëíìîïóòôõöúùûüçñýÿ]/g, (ch) => FOLD_MAP[ch] || ch);
}

const roleLabel = (role) => (role === 'user' || role === 'assistant' ? t(`search.role.${role}`) : '');
const filterLabel = (key) => (key === 'materia' || key === 'pdf' ? t(`search.filter.${key}`) : '');

const state = {
  open: false,
  busy: false,
  query: '',
  hits: [],
  truncated: false,
  short: false,
  error: '',
  message: '',
  catalog: {sources: [], courses: []},
  selectedSources: new Set(SOURCE_KEYS),
  selectedCourses: null, // null = todas; Set = seleção explícita
  seq: 0,
  initialized: false,
};

let deps = {};
let refs = null;

const element = (tag, props = {}, children = []) => {
  const el = deps.document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? deps.document.createTextNode(child) : child);
  }
  return el;
};

/* ---------- estilos (cores/medidas do app; nenhum arquivo do shell é tocado) ---------- */

const CSS = `
.study-search-dialog{width:min(720px,calc(100vw - 32px))}
.study-search-dialog .study-search-field{width:100%}
.study-search-scroll{max-height:calc(100vh - 350px);min-height:120px;overflow:auto;margin:10px 0;padding:2px}
.study-search-results{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.study-search-result{border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px;background:var(--surface)}
.study-search-result .study-search-meta{color:var(--muted);font-size:var(--fs-sm);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.study-search-result .study-search-title{font-weight:600;margin:2px 0 4px;overflow-wrap:anywhere}
.study-search-result .study-search-snippet{margin:0;line-height:1.45;overflow-wrap:anywhere}
.study-search-result mark{background:var(--accent-surface,#ffe58a);color:inherit;border-radius:3px;padding:0 2px}
.study-search-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.study-search-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
.study-search-dialog .study-search-filter-label{margin:0;font-size:var(--fs-sm);color:var(--muted);min-width:0}
.study-search-filters select{display:block;width:100%;margin-top:5px;min-width:0}
.study-search-filter-summary{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0}
.study-search-filter-summary p{margin:0;font-size:var(--fs-sm);color:var(--muted)}
.study-search-reset{font-size:var(--fs-sm);padding:4px 8px}
.study-search-reset[hidden],.study-search-filter-summary p[hidden]{display:none}
.study-search-status{margin:8px 0 0;min-height:20px;color:var(--muted)}
.study-search-status.error{color:var(--danger,#b42318)}
.study-search-empty{color:var(--muted);padding:14px 2px}
@media(max-width:480px){.study-search-filters{grid-template-columns:minmax(0,1fr)}}
`;

function injectStyle() {
  if (deps.document.getElementById(STYLE_ID)) return;
  deps.document.head.append(element('style', {id: STYLE_ID, text: CSS}));
}

/* ---------- host ---------- */

function host() {
  return deps.host || deps.window?.desk || deps.document.defaultView?.desk || null;
}

function hostSearch(payload) {
  const api = host();
  if (!api || typeof api.studySearch !== 'function') return Promise.reject(new Error(t('search.error.unavailable')));
  return Promise.resolve(api.studySearch(payload));
}

function catalog() {
  const api = host();
  if (api && typeof api.studySearchCatalog === 'function') return Promise.resolve(api.studySearchCatalog({}));
  return Promise.resolve(null);
}

/* ---------- textos ---------- */

const label = {
  title: () => text(searchCore.dialogTitle()),
  placeholder: () => text(searchCore.searchPlaceholder()),
  search: () => text(searchCore.searchLabel()),
  sources: () => text(searchCore.sourcesLabel()),
  courses: () => text(searchCore.coursesLabel()),
  hint: () => text(searchCore.hintText()),
  short: () => text(searchCore.shortQueryText()),
  searching: () => text(searchCore.searchingText()),
  empty: () => text(searchCore.emptyText()),
  truncated: () => text(searchCore.truncatedText()),
  open: () => text(searchCore.openLabel()),
  note: () => text(searchCore.noteLabel()),
  close: () => text(searchCore.closeLabel()),
  count: (n) => text(searchCore.countText(toNat(n))),
  page: (n) => text(searchCore.pageLabel(wholeNat(n))),
  button: () => text(searchCore.searchButton()),
  sourceLabel: (key) => text(searchCore.sourceLabel(TAGS[key] || TAGS.conversa)),
};

function formatWhen(when) {
  const stamp = Number(when);
  if (!Number.isFinite(stamp) || stamp <= 0) return '';
  try {
    return new Date(stamp).toLocaleString(currentLanguage(), {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
  } catch {
    return '';
  }
}

/* ---------- destaque seguro (só textContent + <mark>) ---------- */

function appendHighlighted(parent, text, query) {
  const body = String(text ?? '');
  const needle = foldSearch(String(query || '').trim());
  if (!needle) {
    parent.append(deps.document.createTextNode(body));
    return;
  }
  const folded = foldSearch(body);
  const at = folded.indexOf(needle);
  if (at === -1) {
    parent.append(deps.document.createTextNode(body));
    return;
  }
  parent.append(deps.document.createTextNode(body.slice(0, at)));
  parent.append(element('mark', {text: body.slice(at, at + needle.length)}));
  parent.append(deps.document.createTextNode(body.slice(at + needle.length)));
}

/* ---------- desenho ---------- */

function renderSources() {
  const select = refs.sources;
  select.replaceChildren(element('option', {value: '*', text: text(searchCore.allSourcesLabel())}));
  const known = knownSources();
  for (const key of known) {
    select.append(element('option', {value: key, text: filterLabel(key) || text(state.catalog.sources.find((source) => source.key === key)?.label || '') || label.sourceLabel(key)}));
  }
  const all = known.length === state.selectedSources.size && known.every(key => state.selectedSources.has(key));
  const single = state.selectedSources.size === 1 && known.includes([...state.selectedSources][0]);
  const value = all ? '*' : single ? [...state.selectedSources][0] : 'custom';
  if (value === 'custom') select.append(element('option', {value, disabled: true, text: state.selectedSources.size ? t('search.custom', {count: state.selectedSources.size}) : t('search.pickContent')}));
  select.value = value;
  renderFilterSummary();
}

function renderCourses() {
  const select = refs.courses;
  select.replaceChildren(element('option', {value: '*', text: text(searchCore.allCoursesLabel())}));
  const courses = state.catalog.courses || [];
  for (const course of courses) {
    select.append(element('option', {value: course.id, text: displayCourseName(course) || course.id}));
  }
  const single = state.selectedCourses?.size === 1 && courses.some(course => state.selectedCourses.has(course.id));
  const value = state.selectedCourses === null ? '*' : single ? [...state.selectedCourses][0] : 'custom';
  if (value === 'custom') select.append(element('option', {value, disabled: true, text: state.selectedCourses.size ? t('search.custom', {count: state.selectedCourses.size}) : t('search.pickCourse')}));
  select.value = value;
  renderFilterSummary();
}

function knownSources() {
  return state.catalog.sources.length ? state.catalog.sources.map(source => source.key).filter(key => SOURCE_KEYS.includes(key)) : SOURCE_KEYS;
}

function renderFilterSummary() {
  if (!refs) return;
  const known = knownSources();
  const all = known.length === state.selectedSources.size && known.every(key => state.selectedSources.has(key));
  refs.reset.hidden = all && state.selectedCourses === null;
  refs.pdfHint.hidden = !state.selectedSources.has('pdf') || state.selectedCourses !== null;
}

const genericTitle = (source) => (source === 'nota' ? t('search.title.notes') : source === 'caderno' ? t('search.title.review') : '');

function renderResult(hit) {
  const meta = [label.sourceLabel(hit.source)];
  const courseName = displayCourseName({id: hit.courseId, name: hit.courseName || state.catalog.courses.find(course => course.id === hit.courseId)?.name});
  if (courseName) meta.push(courseName);
  if (hit.favorite) meta.push(t('search.favorite'));
  if (hit.topic) meta.push(t('search.topic', {topic: hit.topic}));
  if (roleLabel(hit.role)) meta.push(roleLabel(hit.role));
  if (hit.page) meta.push(label.page(hit.page));
  if (hit.fileName && ['pdf', 'materia', 'nota'].includes(hit.source)) meta.push(hit.fileName);
  const when = formatWhen(hit.when);
  if (when) meta.push(when);

  const snippet = element('p', {class: 'study-search-snippet'});
  appendHighlighted(snippet, hit.snippet || '', state.query);

  const actions = element('div', {class: 'study-search-actions'}, []);
  /* Rótulo de matéria sem arquivo (só o nome do curso) não oferece "Abrir": o
   * destino não tem PDF para o leitor carregar. */
  if (hit.openable !== false) {
    actions.append(element('button', {type: 'button', class: 'study-search-open-result', 'data-hit': hit.id, text: label.open(), onclick: () => openHit(hit)}));
  }
  if (hit.source === 'pdf' || hit.source === 'nota') {
    actions.prepend(element('button', {type: 'button', class: 'study-search-annotate-result', 'data-hit': hit.id, text: label.note(), onclick: () => annotateHit(hit)}));
  }

  return element('li', {class: 'study-search-result', 'data-hit': hit.id}, [
    element('div', {class: 'study-search-meta'}, meta.map((part) => element('span', {text: part}))),
    element('p', {class: 'study-search-title', text: hit.title || hit.fileName || genericTitle(hit.source)}),
    snippet,
    actions,
  ]);
}

function renderResults() {
  const list = refs.results;
  list.replaceChildren();
  if (!state.hits.length) {
    if (state.message) list.append(element('li', {class: 'study-search-empty', text: state.message}));
    return;
  }
  for (const hit of state.hits) list.append(renderResult(hit));
}

function renderStatus() {
  const status = refs.status;
  status.classList.toggle('error', !!state.error);
  if (state.busy) status.textContent = label.searching();
  else if ((state.query || '').length < 2) status.textContent = label.hint();
  else if (state.error) status.textContent = text(state.error);
  else if (state.short) status.textContent = label.short();
  else if (state.message && !state.hits.length) status.textContent = state.message;
  else status.textContent = `${label.count(state.hits.length)}${state.truncated ? ` · ${label.truncated()}` : ''}`;
}

function render() {
  if (!refs) return;
  refs.input.value = state.query;
  renderSources();
  renderCourses();
  renderResults();
  renderStatus();
}

/* ---------- busca ---------- */

let debounceTimer = 0;

function selectionPayload() {
  const sources = state.selectedSources.size ? [...state.selectedSources] : [];
  const scope = {sources};
  if (state.selectedCourses !== null) scope.courses = [...state.selectedCourses];
  return {query: state.query, scope};
}

async function refresh() {
  if (!state.open) return;
  const seq = ++state.seq;
  const query = String(state.query || '').trim();
  state.error = '';
  state.message = '';
  if (!state.selectedSources.size) {
    /* Preset vazio não busca tudo. A UI pode voltar à busca geral pelo reset. */
    state.hits = [];
    state.short = false;
    state.truncated = false;
    state.busy = false;
    state.message = label.empty();
    renderResults();
    renderStatus();
    return;
  }
  if (query.length < Number(searchCore.minQueryChars())) {
    state.hits = [];
    state.short = query.length > 0;
    state.truncated = false;
    state.busy = false;
    renderResults();
    renderStatus();
    return;
  }
  state.busy = true;
  renderStatus();
  try {
    const result = await hostSearch(selectionPayload());
    if (seq !== state.seq || !state.open) return;
    state.hits = Array.isArray(result?.hits) ? result.hits.slice(0, MAX_HITS) : [];
    state.truncated = !!result?.truncated;
    state.short = false;
    /* A resposta ecoa as fontes SELECIONADAS; o catálogo do filtro continua
     * sendo o completo (catálogo do host ou as sete fontes do núcleo). */
    if (Array.isArray(result?.courses)) state.catalog.courses = result.courses;
  } catch (error) {
    if (seq !== state.seq) return;
    state.hits = [];
    state.error = error?.message || t('search.error.failed');
  } finally {
    if (seq === state.seq) {
      state.busy = false;
      renderSources();
      renderCourses();
      renderResults();
      renderStatus();
    }
  }
}

function scheduleRefresh() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => refresh(), Number.isFinite(deps.debounceMs) ? deps.debounceMs : 180);
}

/* ---------- destino ---------- */

async function defaultOpen(destination, hit) {
  if (!destination || destination.ok === false) return false;
  if (destination.kind === 'pdf' || destination.kind === 'note') {
    const nav = await import('./nav.mjs');
    nav.openRef(destination.name || hit.fileName || '', destination.page || 1, destination.path || '');
    return true;
  }
  deps.document.dispatchEvent(new deps.document.defaultView.CustomEvent('mesa-open-study-result', {detail: {destination, hit}}));
  return true;
}

async function openHit(hit) {
  const api = host();
  if (!api || typeof api.studySearchResolve !== 'function') {
    state.error = t('search.error.noResolve');
    renderStatus();
    return;
  }
  try {
    const destination = await Promise.resolve(api.studySearchResolve({id: hit.id}));
    const handled = typeof deps.onOpenResult === 'function' ? await deps.onOpenResult(destination, hit) : await defaultOpen(destination, hit);
    if (handled === false && destination?.error) {
      state.error = text(destination.error);
      renderStatus();
      return;
    }
    closeStudySearch();
  } catch (error) {
    state.error = error?.message || t('search.error.open');
    renderStatus();
  }
}

function annotateHit(hit) {
  if (typeof deps.onAnnotate === 'function') {
    deps.onAnnotate(null, hit);
  } else {
    deps.document.dispatchEvent(new deps.document.defaultView.CustomEvent('mesa-study-annotate', {detail: {hit}}));
  }
  closeStudySearch();
}

/* ---------- abrir/fechar ---------- */

function ensureDialog() {
  if (refs) return refs;
  injectStyle();
  const input = element('input', {
    type: 'search',
    id: 'study-search-input',
    class: 'study-search-field',
    placeholder: label.placeholder(),
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': label.search(),
    oninput: () => {
      state.query = input.value;
      scheduleRefresh();
    },
  });
  const sources = element('select', {id: 'study-search-sources', onchange: () => {
    if (sources.value === 'custom') return;
    state.selectedSources = new Set(sources.value === '*' ? knownSources() : [sources.value]);
    renderFilterSummary();
    refresh();
  }});
  const courses = element('select', {id: 'study-search-courses', onchange: () => {
    if (courses.value === 'custom') return;
    state.selectedCourses = courses.value === '*' ? null : new Set([courses.value]);
    renderFilterSummary();
    refresh();
  }});
  const pdfHint = element('p', {id: 'study-search-pdf-hint', text: text(searchCore.pdfScopeHint())});
  const reset = element('button', {type: 'button', id: 'study-search-reset', class: 'study-search-reset', text: text(searchCore.clearFiltersLabel()), onclick: () => {
    state.selectedSources = new Set(knownSources());
    state.selectedCourses = null;
    renderSources();
    renderCourses();
    refresh();
  }});
  const form = element('form', {class: 'study-search-form', novalidate: true, onsubmit: (event) => {
    event.preventDefault();
    refresh();
  }}, [
    element('div', {class: 'study-head'}, [
      element('h2', {id: 'study-search-title', text: label.title()}),
      element('button', {type: 'button', id: 'study-search-close', class: 'icon-btn dialog-close', title: label.close(), 'aria-label': label.close(), text: '×', onclick: () => closeStudySearch()}),
    ]),
    element('label', {for: 'study-search-input', text: label.search()}),
    input,
    element('div', {class: 'study-search-filters'}, [
      element('label', {class: 'study-search-filter-label', for: 'study-search-courses'}, [label.courses(), courses]),
      element('label', {class: 'study-search-filter-label', for: 'study-search-sources'}, [label.sources(), sources]),
    ]),
    element('div', {class: 'study-search-filter-summary'}, [pdfHint, reset]),
    element('p', {id: 'study-search-status', class: 'study-search-status', role: 'status', 'aria-live': 'polite'}),
    element('div', {class: 'study-search-scroll'}, [element('ol', {id: 'study-search-results', class: 'study-search-results'})]),
    element('div', {class: 'study-footer'}, [
      element('button', {type: 'submit', id: 'study-search-submit', class: 'primary', text: label.button()}),
    ]),
  ]);
  const dialog = element('dialog', {class: 'study-dialog study-search-dialog', id: 'study-search-dialog', 'aria-labelledby': 'study-search-title', 'aria-modal': 'true'}, [form]);
  dialog.addEventListener('close', () => {
    state.open = false;
  });
  dialog.addEventListener('cancel', () => {
    state.open = false;
  });
  deps.document.body.append(dialog);
  refs = {dialog, form, input, sources, courses, reset, pdfHint, status: form.querySelector('#study-search-status'), results: form.querySelector('#study-search-results')};
  return refs;
}

export function openStudySearch(preset = {}) {
  const ui = ensureDialog();
  /* Clique na barra pode chegar duas vezes (listener do núcleo + o delegado
   * deste módulo): a segunda chamada só redesenha. */
  const already = state.open && ui.dialog.open;
  state.open = true;
  if (typeof preset.query === 'string') state.query = preset.query;
  if (Array.isArray(preset.sources)) state.selectedSources = new Set(SOURCE_KEYS.filter((key) => preset.sources.includes(key)));
  if (Array.isArray(preset.courses)) state.selectedCourses = new Set(preset.courses);
  if (already) {
    render();
    return true;
  }
  if (preset.autoSearch || String(state.query || '').trim().length >= 2) refresh();
  catalog().then((result) => {
    if (!state.open || !result) return;
    if (Array.isArray(result.sources) && result.sources.length) {
      state.catalog.sources = result.sources;
      /* O catálogo do host é a verdade: fonte que ele não lista não fica
       * "selecionada invisível" (o filtro não teria como desmarcar). */
      const known = new Set(result.sources.map((source) => source.key));
      state.selectedSources = new Set([...state.selectedSources].filter((key) => known.has(key)));
    }
    if (Array.isArray(result.courses)) state.catalog.courses = result.courses;
    renderSources();
    renderCourses();
  }).catch(() => {});
  if (!ui.dialog.open) ui.dialog.showModal();
  render();
  ui.input.focus();
  ui.input.select?.();
  return true;
}

/* O diálogo é montado uma vez; trocar o idioma o refaz do zero (a busca e os
 * filtros ficam no `state`), em vez de espalhar `relabel` por cada rótulo. */
function rebuildForLanguage() {
  if (!refs) return;
  const wasOpen = refs.dialog.open;
  refs.dialog.remove();
  refs = null;
  fallbackButton?.remove();
  fallbackButton = null;
  state.open = false;
  if (wasOpen) openStudySearch();
}

export function closeStudySearch() {
  if (refs?.dialog?.open) refs.dialog.close();
  state.open = false;
}

export function isStudySearchOpen() {
  return !!state.open;
}

/* ---------- teclado e cliques da barra ---------- */

function onKeydown(event) {
  if (event.defaultPrevented) return;
  const combo = (event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || '').toLowerCase() === 'f';
  if (!combo) return;
  event.preventDefault();
  if (state.open) closeStudySearch();
  else openStudySearch({autoSearch: true});
}

function onDocumentClick(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const button = path.find((node) => node?.id === 'study-search-open' || node?.dataset?.studyAction === 'study-search');
  if (!button) return;
  event.preventDefault();
  openStudySearch({autoSearch: true});
}

/* Se a barra de ferramentas existir mas ainda não tiver nenhum botão (o shell
 * pode não ter montado o núcleo `studytoolsview`), entra um botão próprio —
 * que sai quando a barra de verdade aparecer. */
let fallbackButton = null;
function ensureTrigger() {
  const bar = deps.document.getElementById('study-tools-bar');
  if (!bar) return;
  if (deps.document.getElementById('study-search-open') || bar.querySelector('.study-tool')) {
    fallbackButton?.remove();
    fallbackButton = null;
    return;
  }
  if (fallbackButton?.isConnected) return;
  bar.hidden = false;
  deps.document.body.classList.add('study-tools-ready');
  fallbackButton = element('button', {type: 'button', id: 'study-search-fallback', class: 'study-tool', text: label.title(), onclick: () => openStudySearch({autoSearch: true})});
  bar.append(fallbackButton);
}

function watchTrigger() {
  let tries = 0;
  const tick = () => {
    try {
      ensureTrigger();
    } catch { /* sem barra: o atalho continua */ }
    if (++tries < 20) setTimeout(tick, 500);
  };
  tick();
}

/* ---------- init ---------- */

export function initStudySearch(options = {}) {
  deps = {
    document: options.document || globalThis.document,
    window: options.window || globalThis.window,
    host: options.host || null,
    onOpenResult: options.onOpenResult,
    onAnnotate: options.onAnnotate,
    debounceMs: options.debounceMs,
  };
  if (!deps.document) throw new Error('initStudySearch precisa de um document.');
  if (state.initialized) return {open: openStudySearch, close: closeStudySearch, refresh};
  state.initialized = true;
  deps.document.addEventListener('keydown', onKeydown, true);
  deps.document.addEventListener('click', onDocumentClick);
  deps.window?.addEventListener?.(LANGUAGE_EVENT, rebuildForLanguage);
  watchTrigger();
  return {open: openStudySearch, close: closeStudySearch, refresh};
}
