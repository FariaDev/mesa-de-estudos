import notesCore from './generated/studyannotations.core.js';
import {showUndoNotice, cancelUndoNotice} from './undo-deletion.mjs';
import {t, text, LANGUAGE_EVENT} from './ui-text.mjs';
import {toNat, wholeNat} from './bend-nat.mjs';

/* ---------------------------------------------------------------------------
   Anotações de página (Mesa): guarda trecho/observação/dúvida de um PDF, por
   página, sem tocar no arquivo original.

   O módulo NÃO fala com o disco: pede ao host por `window.desk.studyNotesRead`
   / `window.desk.studyNotesSave` (IPC proposta). A forma, os tetos, os rótulos
   e a identidade estável vêm do núcleo (`core/studyannotations.bend` →
   `src/generated/studyannotations.core.js`); aqui entram DOM, seleção do
   leitor e o estado do diálogo.

   Integração (o pai liga no shell):
     - `initPdfNotes({host})` uma vez depois do boot;
     - a barra de ferramentas chama pelo id `#study-notes-open` (criado pelo
       `core/studytoolsview.bend`) — o clique é delegado no documento, então a
       ordem do boot não importa; atalho Ctrl/Cmd+Shift+N;
     - `openPdfNotes({page, quote, path, name})` abre já preenchido (o
       `study-search.mjs` emite `mesa-study-annotate` para um resultado de PDF;
       quem escuta é este módulo);
     - a seleção do leitor é lida do próprio DOM (`.textLayer` + `.pdf-select`),
       o mesmo gesto que já alimenta a citação do chat.

   IPC esperada (host injeta o escopo corrente e valida o caminho contra a
   biblioteca autorizada; o renderer nunca autoriza leitura sozinho):
     - `study-notes-read` {} → {items, scope:{courseId?, free?, name?}}
     - `study-notes-save` {mode:'add'|'edit'|'remove', id?, item?} → {items, scope}
   --------------------------------------------------------------------------- */

const STYLE_ID = 'study-notes-style';
const state = {
  initialized: false,
  open: false,
  items: [],
  scope: null,
  pageFilter: 0,
  materialFilter: '',
  selection: null,
  editing: '',
  error: '',
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

const CSS = `
.study-notes-dialog .study-notes-field{width:100%}
.study-notes-list{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px;max-height:38vh;overflow:auto}
.study-note-card{border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px;background:var(--surface)}
.study-note-card .study-note-meta{color:var(--muted);font-size:var(--fs-sm);display:flex;flex-wrap:wrap;gap:6px}
.study-note-card .study-note-quote{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.study-note-card .study-note-body{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.study-note-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.study-notes-form .study-row label{display:flex;flex-direction:column;gap:var(--space-2)}
.study-notes-form #study-note-page{width:88px}
.study-notes-filters{display:flex;flex-wrap:wrap;gap:var(--space-5);align-items:flex-end;margin-top:var(--space-6);padding-top:var(--space-5);border-top:1px solid var(--border)}
.study-notes-dialog .study-notes-filters label{display:flex;flex-direction:column;gap:var(--space-2);margin:0;font-size:var(--fs-sm)}
.study-notes-status{min-height:20px;color:var(--muted);margin:var(--space-4) 0 0}
.study-notes-status+.study-notes-list:has(>.study-notes-empty:only-child){display:none}
.study-notes-status.error{color:var(--danger,#b42318)}
.study-notes-empty{color:var(--muted);padding:12px 2px}
.study-notes-target{color:var(--muted);font-size:var(--fs-sm)}
`;

function injectStyle() {
  if (deps.document.getElementById(STYLE_ID)) return;
  deps.document.head.append(element('style', {id: STYLE_ID, text: CSS}));
}

function host() {
  return deps.host || deps.window?.desk || deps.document.defaultView?.desk || null;
}

/* ---------- seleção e página do leitor (o gesto já existe no PDF) ---------- */

function selectionInfo() {
  try {
    const view = deps.document.defaultView;
    const selection = view?.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    const layer = el?.closest?.('.textLayer');
    const panel = layer?.closest?.('.pdf-panel');
    if (!panel) return null;
    const page = Number(layer.closest?.('.pdf-page')?.dataset?.page) || 0;
    const path = panel.querySelector?.('.pdf-select')?.value || '';
    const name = path.split(/[/\\]/).at(-1) || '';
    /* `Selection.toString()` devolve vazio quando o foco está num campo do
     * diálogo; a seleção real está no range. */
    const quote = String(range.toString() || selection.toString() || '').replace(/\s+/g, ' ').trim().slice(0, Number(notesCore.maxQuote()));
    if (!quote) return null;
    return {quote, page, path, name};
  } catch {
    return null;
  }
}

function currentReader() {
  const panel = deps.document.querySelector('.pdf-panel:not(.minimized)') || deps.document.querySelector('.pdf-panel');
  if (!panel) return null;
  const path = panel.querySelector?.('.pdf-select')?.value || '';
  const page = Number(panel.querySelector?.('.page-number')?.value) || 0;
  return {page, path, name: path.split(/[/\\]/).at(-1) || ''};
}

/* ---------- desenho ---------- */

function renderStatus() {
  if (!refs) return;
  refs.status.classList.toggle('error', !!state.error);
  const total = state.items.length;
  refs.status.textContent = text(state.error) || (state.editing ? t('annot.status.editing') : total ? text(notesCore.countText(toNat(total))) : text(notesCore.emptyText()));
}

function renderFilters() {
  const pages = [...new Set(state.items.map((item) => item.ref.page))].sort((a, b) => a - b);
  const materials = [...new Set(state.items.map((item) => item.ref.name).filter(Boolean))];
  refs.pageFilter.replaceChildren(
    element('option', {value: '', text: text(notesCore.filterAllLabel()), selected: state.pageFilter === 0}),
    ...pages.map((page) => element('option', {value: String(page), text: text(notesCore.pageLabel(wholeNat(page))), selected: state.pageFilter === page}))
  );
  refs.materialFilter.replaceChildren(
    element('option', {value: '', text: text(notesCore.filterAllLabel()), selected: state.materialFilter === ''}),
    ...materials.map((name) => element('option', {value: name, text: name, selected: state.materialFilter === name}))
  );
}

function visibleItems() {
  return state.items.filter((item) => (state.pageFilter === 0 || item.ref.page === state.pageFilter) && (!state.materialFilter || item.ref.name === state.materialFilter));
}

function renderList() {
  const list = refs.list;
  list.replaceChildren();
  const items = visibleItems();
  if (!items.length) {
    list.append(element('li', {class: 'study-notes-empty', text: text(notesCore.emptyText())}));
    return;
  }
  for (const item of items) {
    const meta = [text(notesCore.kindLabel({$: item.kind === 'duvida' ? 'NoteDoubt' : 'NoteNote'})), text(notesCore.pageLabel(wholeNat(item.ref.page)))];
    if (item.ref.name) meta.push(item.ref.name);
    const card = element('li', {class: 'study-note-card', 'data-note-id': item.id}, [
      element('div', {class: 'study-note-meta'}, meta.map((part) => element('span', {text: part}))),
      item.quote ? element('p', {class: 'study-note-quote', text: item.quote}) : null,
      item.note ? element('p', {class: 'study-note-body', text: item.note}) : null,
      element('div', {class: 'study-note-actions'}, [
        element('button', {type: 'button', class: 'study-note-edit', 'data-note-id': item.id, text: 'Editar', onclick: () => editItem(item)}),
        element('button', {type: 'button', class: 'study-note-remove', 'data-note-id': item.id, text: text(notesCore.removeLabel()), title: text(notesCore.removeTitle()), onclick: () => removeItem(item)}),
      ]),
    ]);
    list.append(card);
  }
}

function renderTarget() {
  const reader = currentReader();
  const selection = state.selection || selectionInfo();
  const page = Number(refs.page.value) || selection?.page || reader?.page || 1;
  const name = refs.quote.dataset.name || selection?.name || reader?.name || '';
  refs.target.textContent = name ? `${name} · ${text(notesCore.pageLabel(wholeNat(page)))}` : text(notesCore.pageLabel(wholeNat(page)));
}

function render() {
  if (!refs) return;
  renderTarget();
  renderFilters();
  renderList();
  renderStatus();
  if (refs.cancelEdit) refs.cancelEdit.hidden = !state.editing;
}

/* ---------- leitura/gravação ---------- */

async function readNotes() {
  const api = host();
  if (!api || typeof api.studyNotesRead !== 'function') {
    state.error = t('annot.error.unavailable');
    state.items = [];
    render();
    return;
  }
  try {
    const result = await Promise.resolve(api.studyNotesRead({}));
    state.items = Array.isArray(result?.items) ? result.items : [];
    state.scope = result?.scope || null;
    state.error = '';
  } catch (error) {
    state.error = error?.message || t('annot.error.read');
    state.items = [];
  }
  render();
}

async function save(payload) {
  const api = host();
  if (!api || typeof api.studyNotesSave !== 'function') {
    state.error = t('annot.error.unavailable');
    renderStatus();
    return false;
  }
  try {
    const result = await Promise.resolve(api.studyNotesSave(payload));
    state.items = Array.isArray(result?.items) ? result.items : state.items;
    state.scope = result?.scope || state.scope;
    state.error = '';
    /* Remoção com Desfazer: o host emite o token (o renderer nunca o inventa) e
       o aviso independe do toast. O host continua sendo a autoridade no undo. */
    if (payload?.mode === 'remove' && typeof result?.undoToken === 'string' && result.undoToken) {
      showUndoNotice({
        kind: 'note',
        container: refs.dialog,
        token: result.undoToken,
        expiresAt: result.undoExpiresAt,
        scopeKey: String(state.scope || ''),
        scopeNow: () => String(state.scope || ''),
        onUndone: (restored) => {
          if (Array.isArray(restored?.items)) state.items = restored.items;
          state.error = '';
          renderFilters();
          renderList();
          renderStatus();
        },
      }).catch((error) => console.error('Desfazer das anotações:', error?.message || error));
    }
    return true;
  } catch (error) {
    state.error = error?.message || t('annot.error.save');
    return false;
  } finally {
    renderFilters();
    renderList();
    renderStatus();
  }
}

function draftFromFields() {
  const quote = String(refs.quote.value || '').trim();
  const note = String(refs.note.value || '').trim();
  const page = Math.max(1, Math.trunc(Number(refs.page.value) || 1));
  const kind = refs.kind.value === 'duvida' ? 'duvida' : 'nota';
  const path = refs.quote.dataset.path || '';
  const name = refs.quote.dataset.name || '';
  const rel = refs.quote.dataset.rel || '';
  return {kind, quote, note, ref: {name, rel, path, page}};
}

async function submit() {
  const item = draftFromFields();
  if (!item.quote && !item.note) {
    state.error = t('annot.error.needText');
    renderStatus();
    return;
  }
  const mode = state.editing ? 'edit' : 'add';
  const payload = mode === 'edit' ? {mode, id: state.editing, item} : {mode: 'add', item};
  if (await save(payload)) {
    state.editing = '';
    refs.quote.value = '';
    refs.note.value = '';
    render();
  }
}

function editItem(item) {
  state.editing = item.id;
  refs.quote.value = item.quote || '';
  refs.note.value = item.note || '';
  refs.kind.value = item.kind === 'duvida' ? 'duvida' : 'nota';
  refs.page.value = String(item.ref.page || 1);
  refs.quote.dataset.path = item.ref.path || '';
  refs.quote.dataset.name = item.ref.name || '';
  refs.quote.dataset.rel = item.ref.rel || '';
  render();
  refs.note.focus();
}

async function removeItem(item) {
  if (!deps.document.defaultView.confirm(t('annot.confirmRemove', {page: item.ref.page}))) return;
  await save({mode: 'remove', id: item.id});
  if (state.editing === item.id) state.editing = '';
  render();
}

/* ---------- abrir/fechar ---------- */

function useSelection() {
  /* A seleção pode ter sido colapsada pelo clique no botão; vale a última
   * seleção no leitor (o `selectionchange` guarda). */
  const info = state.selection || selectionInfo();
  if (!info) {
    state.error = t('pdfnotes.selectFirst');
    renderStatus();
    return;
  }
  refs.quote.value = info.quote;
  refs.quote.dataset.path = info.path;
  refs.quote.dataset.name = info.name;
  refs.page.value = String(info.page || refs.page.value || 1);
  render();
  refs.note.focus();
}

function ensureDialog() {
  if (refs) return refs;
  injectStyle();
  const quote = element('textarea', {id: 'study-note-quote', rows: '3', class: 'study-notes-field', 'aria-label': text(notesCore.quoteLabel())});
  const note = element('textarea', {id: 'study-note-note', rows: '3', class: 'study-notes-field', 'aria-label': text(notesCore.noteLabel())});
  const kind = element('select', {id: 'study-note-kind', 'aria-label': text(notesCore.kindLabelText())}, [
    element('option', {value: 'nota', text: text(notesCore.kindLabel({$: 'NoteNote'}))}),
    element('option', {value: 'duvida', text: text(notesCore.kindLabel({$: 'NoteDoubt'}))}),
  ]);
  const page = element('input', {id: 'study-note-page', type: 'number', min: '1', step: '1', value: '1', 'aria-label': text(notesCore.pageFieldLabel())});
  const status = element('p', {id: 'study-notes-status', class: 'study-notes-status', role: 'status', 'aria-live': 'polite'});
  const list = element('ol', {id: 'study-notes-list', class: 'study-notes-list'});
  const target = element('span', {class: 'study-notes-target'});
  const form = element('form', {class: 'study-notes-form', novalidate: true, onsubmit: (event) => {
    event.preventDefault();
    submit();
  }}, [
    element('div', {class: 'study-head'}, [
      element('h2', {id: 'study-notes-title', text: text(notesCore.panelTitle())}),
      element('button', {type: 'button', id: 'study-notes-close', class: 'icon-btn dialog-close', title: text(notesCore.closeLabel()), 'aria-label': text(notesCore.closeLabel()), text: '×', onclick: () => closePdfNotes()}),
    ]),
    element('p', {class: 'study-muted', text: text(notesCore.panelLead())}),
    element('div', {class: 'study-row'}, [
      element('button', {type: 'button', id: 'study-note-use-selection', text: text(notesCore.useQuoteLabel()), title: text(notesCore.useQuoteTitle()), onclick: useSelection}),
      target,
    ]),
    element('label', {for: 'study-note-quote', text: text(notesCore.quoteLabel())}),
    quote,
    element('label', {for: 'study-note-note', text: text(notesCore.noteLabel())}),
    note,
    element('div', {class: 'study-row'}, [
      element('label', {for: 'study-note-kind', text: text(notesCore.kindLabelText())}, [kind]),
      element('label', {for: 'study-note-page', text: text(notesCore.pageFieldLabel())}, [page]),
    ]),
    element('div', {class: 'study-notes-filters'}, [
      element('label', {for: 'study-notes-page-filter'}, [element('span', {text: text(notesCore.filterPageLabel())}), element('select', {id: 'study-notes-page-filter', onchange: () => {
        state.pageFilter = Number(refs.pageFilter.value) || 0;
        renderList();
      }})]),
      element('label', {for: 'study-notes-material-filter'}, [element('span', {text: 'Material'}), element('select', {id: 'study-notes-material-filter', onchange: () => {
        state.materialFilter = refs.materialFilter.value || '';
        renderList();
      }})]),
    ]),
    status,
    list,
    element('div', {class: 'study-footer'}, [
      element('button', {type: 'button', id: 'study-note-cancel-edit', text: text(notesCore.cancelLabel()), hidden: true, onclick: () => {
        state.editing = '';
        refs.quote.value = '';
        refs.note.value = '';
        render();
      }}),
      element('button', {type: 'submit', id: 'study-note-save', class: 'primary', text: text(notesCore.saveLabel())}),
    ]),
  ]);
  const dialog = element('dialog', {class: 'study-dialog study-notes-dialog', id: 'study-notes-dialog', 'aria-labelledby': 'study-notes-title', 'aria-modal': 'true'}, [form]);
  dialog.addEventListener('close', () => {
    state.open = false;
    cancelUndoNotice();
  });
  deps.document.body.append(dialog);
  refs = {
    dialog,
    form,
    quote,
    note,
    kind,
    page,
    status,
    list,
    target,
    cancelEdit: form.querySelector('#study-note-cancel-edit'),
    pageFilter: form.querySelector('#study-notes-page-filter'),
    materialFilter: form.querySelector('#study-notes-material-filter'),
  };
  return refs;
}

export function openPdfNotes(preset = {}) {
  const ui = ensureDialog();
  /* Clique na barra pode chegar duas vezes (núcleo + delegado): a segunda
   * chamada só reaplica os campos. */
  const already = state.open && ui.dialog.open;
  state.open = true;
  state.error = '';
  const reader = currentReader();
  const selection = selectionInfo();
  if (typeof preset.quote === 'string') refs.quote.value = preset.quote;
  else if (selection) refs.quote.value = selection.quote;
  const targetPath = preset.path || selection?.path || reader?.path || '';
  const targetName = preset.name || selection?.name || reader?.name || '';
  refs.quote.dataset.path = targetPath;
  refs.quote.dataset.name = targetName;
  refs.quote.dataset.rel = targetName;
  const page = Number(preset.page) || selection?.page || reader?.page || 1;
  refs.page.value = String(page);
  if (already) {
    render();
    return true;
  }
  if (!ui.dialog.open) ui.dialog.showModal();
  render();
  readNotes().then(() => {
    if (state.open) refs.note.focus();
  });
  return true;
}

/* O diálogo é montado uma vez; trocar o idioma o refaz, levando o rascunho. */
function rebuildForLanguage() {
  if (!refs) return;
  const {dialog, quote, note, page} = refs;
  const wasOpen = dialog.open;
  const draft = {quote: quote.value, note: note.value, page: page.value, path: quote.dataset.path || '', name: quote.dataset.name || ''};
  dialog.remove();
  refs = null;
  fallbackButton?.remove();
  fallbackButton = null;
  state.open = false;
  if (!wasOpen) return;
  openPdfNotes({quote: draft.quote, page: draft.page, path: draft.path, name: draft.name});
  refs.note.value = draft.note;
}

export function closePdfNotes() {
  if (refs?.dialog?.open) refs.dialog.close();
  state.open = false;
}

export function isPdfNotesOpen() {
  return !!state.open;
}

/* ---------- teclado, barra e o resultado da busca ---------- */

function onKeydown(event) {
  if (event.defaultPrevented) return;
  const combo = (event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || '').toLowerCase() === 'n';
  if (!combo) return;
  event.preventDefault();
  if (state.open) closePdfNotes();
  else openPdfNotes({});
}

function onDocumentClick(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const button = path.find((node) => node?.id === 'study-notes-open' || node?.dataset?.studyAction === 'study-notes');
  if (!button) return;
  event.preventDefault();
  if (state.open) closePdfNotes();
  else openPdfNotes({});
}

/* Botão próprio na barra quando o shell ainda não montou o núcleo; sai quando
 * a barra de verdade aparecer. */
let fallbackButton = null;
function ensureTrigger() {
  const bar = deps.document.getElementById('study-tools-bar');
  if (!bar) return;
  if (deps.document.getElementById('study-notes-open') || bar.querySelector('.study-tool')) {
    fallbackButton?.remove();
    fallbackButton = null;
    return;
  }
  if (fallbackButton?.isConnected) return;
  bar.hidden = false;
  deps.document.body.classList.add('study-tools-ready');
  fallbackButton = element('button', {type: 'button', id: 'study-notes-fallback', class: 'study-tool', text: t('search.title.notes'), onclick: () => openPdfNotes({})});
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

async function onAnnotateEvent(event) {
  const hit = event?.detail?.hit;
  if (!hit) return;
  let destination = null;
  const api = host();
  if (api && typeof api.studySearchResolve === 'function') {
    try {
      destination = await Promise.resolve(api.studySearchResolve({id: hit.id}));
    } catch { /* abre sem caminho; o host decide na gravação */ }
  }
  openPdfNotes({
    page: destination?.page || hit.page || 1,
    path: destination?.path || '',
    name: destination?.name || hit.fileName || '',
  });
}

function onSelectionChange() {
  const info = selectionInfo();
  if (info) state.selection = info;
}

/* ---------- init ---------- */

export function initPdfNotes(options = {}) {
  deps = {
    document: options.document || globalThis.document,
    window: options.window || globalThis.window,
    host: options.host || null,
  };
  if (!deps.document) throw new Error('initPdfNotes precisa de um document.');
  if (state.initialized) return {open: openPdfNotes, close: closePdfNotes};
  state.initialized = true;
  deps.document.addEventListener('keydown', onKeydown, true);
  deps.document.addEventListener('click', onDocumentClick);
  deps.window?.addEventListener?.(LANGUAGE_EVENT, rebuildForLanguage);
  deps.document.addEventListener('selectionchange', onSelectionChange);
  deps.document.addEventListener('mesa-study-annotate', onAnnotateEvent);
  /* Trocar de matéria/conversa desativa o aviso de Desfazer: o token vale no
     escopo de onde a anotação saiu (o host também recusa escopo trocado). */
  deps.window?.addEventListener?.('desk-conversation-changed', () => cancelUndoNotice());
  watchTrigger();
  return {open: openPdfNotes, close: closePdfNotes};
}
