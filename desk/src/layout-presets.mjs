import layoutCore from './generated/mesaqollayout.core.js';
import {t, text, LANGUAGE_EVENT} from './ui-text.mjs';
import {roundNat} from './bend-nat.mjs';

/* ---------------------------------------------------------------------------
   Layouts pessoais da Mesa (renderer): captura, aplicação e a UI do diálogo.

   O QUE É: só view — chat (largura/recolhido), calculadora (altura/recolhida),
   divisor dos leitores, painel de referências visível e leitores recolhidos.
   NUNCA documento, página, rascunho, conversa, matéria, tema ou contexto.

   A política pura (limites, normalização, decisão mínima da área de apoio e os
   três embutidos Leitura/Exercícios/Comparar) mora no núcleo
   (`core/mesaqollayout.bend` → `mesaqollayout.core.js`); a mesma política é
   usada pelo main (`desk/layout-presets.cjs`) para sanear o que vai ao disco.

   SUPERFÍCIE (registrada pelo `main.mjs` com `registerLayoutSurface`): o módulo
   não importa `state.mjs`/`support.mjs` para não criar ciclo; quem conhece os
   fatos vivos entrega estes acessores:
     save()                            — agenda a gravação do estado
     panelCount(): number              — leitores existentes (0..2)
     calculatorEnabled(): boolean      — flag `desk.calculator`
     referenceFacts(): {two, tabIsForm, open}
     readChatWidth()/readCalcHeight()/readPdfSplit()
     readChatCollapsed()/readCalculatorCollapsed()/readReferenceVisible()
     readMinimized(): boolean[]
     setChatWidth(px)/setCalcHeight(px)/setPdfSplit(fraction)
     setChatCollapsed(on)/setCalculatorCollapsed(on)
     showReference()/hideReference()   — mínimo: selectTab('form') / recolher se
                                          o Formulário estiver à frente
     setMinimized(index, on)

   INTEGRAÇÃO COM O HOST:
     - `layoutSnapshot()` (root, em `state.mjs`) pode enriquecer o payload com
       `viewLayout: captureViewLayout()`; o root preserva o campo nos spreads e
       no save-state.
     - depois de leitores/apoio carregados, o root dispara
       `desk-layout-ready` com `{detail:{layout:data.state.viewLayout}}`; o
       `main.mjs` escuta e chama `applyViewLayout(detail.layout)` — é o que
       reaplica chat recolhido/calculadora recolhida/minimizados depois de
       recompor os leitores (troca de matéria/sessão ou boot).
     - a persistência dos presets pessoais é `window.desk.layoutPresetsGet()` /
       `layoutPresetsSave(payload)` (IPC do root; payload = comando do
       `desk/layout-presets.cjs`).
   --------------------------------------------------------------------------- */

const MAX_MINIMIZED = 2;
const ID_RE = /^[a-z][a-z0-9-]{2,39}$/;
const NIL = {$: 'Nil'};
const BUILTIN_IDS = [layoutCore.leituraId(), layoutCore.exerciciosId(), layoutCore.compararId()];
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const coreList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const clampNat = (value, lo, hi) => Number(layoutCore.clamp(roundNat(value), roundNat(lo), roundNat(hi)));
const splitNat = (value) => roundNat(Math.max(Number(layoutCore.minSplit()) / 1000, Math.min(Number(layoutCore.maxSplit()) / 1000, Number(value))) * 1000);
const clampSplit = (value) => Number(layoutCore.clamp(splitNat(value), 200, 800)) / 1000;

let surface = null;
let ui = null;

/* ---------- política (mesma forma do `desk/layout-presets.cjs`) ---------- */

function layoutOfCore(view) {
  return {
    chatWidth: Number(view.chatWidth),
    calcHeight: Number(view.calcHeight),
    pdfSplit: Number(view.splitPct) / 1000,
    chatCollapsed: view.chatCollapsed === true,
    calculatorCollapsed: view.calculatorCollapsed === true,
    referenceVisible: view.referenceVisible === true,
    minimized: coreArray(view.minimized).map((flag) => flag === true),
  };
}

export function normalizeLayout(raw) {
  if (!isPlainObject(raw)) return null;
  const chatWidth = finite(raw.chatWidth);
  const calcHeight = finite(raw.calcHeight);
  const pdfSplit = finite(raw.pdfSplit);
  if (chatWidth === null || calcHeight === null || pdfSplit === null) return null;
  if (typeof raw.chatCollapsed !== 'boolean' || typeof raw.calculatorCollapsed !== 'boolean' || typeof raw.referenceVisible !== 'boolean') return null;
  if (!Array.isArray(raw.minimized) || raw.minimized.length > MAX_MINIMIZED || !raw.minimized.every((flag) => typeof flag === 'boolean')) return null;
  return layoutOfCore(layoutCore.layout(
    roundNat(chatWidth),
    roundNat(calcHeight),
    splitNat(pdfSplit),
    raw.chatCollapsed,
    raw.calculatorCollapsed,
    raw.referenceVisible,
    coreList(raw.minimized),
  ));
}

/* `viewLayout` do estado é PARCIAL: aplica/valida só os campos presentes (o
   reapply do boot não pode rejeitar o estado inteiro por causa de um campo
   velho). Espelho do `layout-presets.cjs` para o contrato ser um só. */
export function normalizeViewLayout(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  const chatWidth = finite(raw.chatWidth);
  if (chatWidth !== null) out.chatWidth = clampNat(chatWidth, 300, 700);
  const calcHeight = finite(raw.calcHeight);
  if (calcHeight !== null) out.calcHeight = clampNat(calcHeight, 72, 900);
  const pdfSplit = finite(raw.pdfSplit);
  if (pdfSplit !== null) out.pdfSplit = clampSplit(pdfSplit);
  for (const key of ['chatCollapsed', 'calculatorCollapsed', 'referenceVisible']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (Array.isArray(raw.minimized) && raw.minimized.length <= MAX_MINIMIZED && raw.minimized.every((flag) => typeof flag === 'boolean')) {
    out.minimized = raw.minimized.slice();
  }
  return Object.keys(out).length ? out : null;
}

export function normalizePreset(raw) {
  if (!isPlainObject(raw)) return null;
  const id = raw.id === undefined || raw.id === null || raw.id === '' ? '' : String(raw.id);
  if (id && (!ID_RE.test(id) || BUILTIN_IDS.includes(id))) return null;
  const name = String(layoutCore.name(typeof raw.name === 'string' ? raw.name : ''));
  if (!name) return null;
  const layout = normalizeLayout(raw.layout);
  if (!layout) return null;
  return {id, name, layout, builtin: false};
}

export function normalizeStore(raw) {
  const source = Array.isArray(raw) ? {presets: raw} : isPlainObject(raw) ? raw : {};
  const seen = new Set();
  const presets = [];
  for (const item of Array.isArray(source.presets) ? source.presets : []) {
    const preset = normalizePreset(item);
    if (!preset?.id || seen.has(preset.id)) continue;
    seen.add(preset.id);
    presets.push(preset);
    if (presets.length >= Number(layoutCore.maxPresets())) break;
  }
  return {version: 1, presets};
}

export function builtinPresets() {
  return BUILTIN_IDS.map((id) => {
    const hit = layoutCore.builtinLayout(id);
    return {id, name: text(layoutCore.builtinName(id)), layout: layoutOfCore(hit.value), builtin: true};
  });
}

/** A frase da lista de layouts: "Tutor 420 px · Calculadora 220 px · PDF 50% · leitores normais".
 * Junta frases do catálogo aqui (não no Bend): a ordem das partes é do idioma (#41 fase 3).
 * @param {unknown} layout */
export function summaryOf(layout) {
  const normalized = normalizeLayout(layout);
  if (!normalized) return '';
  const parts = [t('layout.summary.sizes', {
    chat: normalized.chatWidth,
    calc: normalized.calcHeight,
    percent: Math.floor((Math.round(normalized.pdfSplit * 1000) + 5) / 10),
  })];
  const minimized = normalized.minimized.filter(Boolean).length;
  parts.push(minimized === 0 ? t('layout.summary.readersNormal') : t('layout.summary.readersCollapsed', {count: minimized}));
  if (normalized.chatCollapsed) parts.push(t('layout.summary.tutorCollapsed'));
  return parts.join(' · ');
}

/* ---------- superfície ---------- */

export function registerLayoutSurface(next) {
  surface = next && typeof next === 'object' ? next : null;
  return surface;
}

export function hasLayoutSurface() {
  return !!surface && typeof surface === 'object';
}

/* ---------- captura ---------- */

export function captureLayout() {
  if (!surface) return null;
  return normalizeLayout({
    chatWidth: surface.readChatWidth(),
    calcHeight: surface.readCalcHeight(),
    pdfSplit: surface.readPdfSplit(),
    chatCollapsed: surface.readChatCollapsed(),
    calculatorCollapsed: surface.readCalculatorCollapsed(),
    referenceVisible: surface.readReferenceVisible(),
    minimized: Array.isArray(surface.readMinimized?.()) ? surface.readMinimized() : [],
  });
}

/* viewLayout global por usuário: a MESMA view, sem `referenceVisible` (essa é
   por matéria, persistida pelo apoio em `mesa.support`). */
export function captureViewLayout() {
  if (!surface) return null;
  return {
    chatWidth: clampNat(finite(surface.readChatWidth()) ?? 390, 300, 700),
    calcHeight: clampNat(finite(surface.readCalcHeight()) ?? 220, 72, 900),
    pdfSplit: clampSplit(finite(surface.readPdfSplit()) ?? 0.5),
    chatCollapsed: surface.readChatCollapsed() === true,
    calculatorCollapsed: surface.readCalculatorCollapsed() === true,
    minimized: (Array.isArray(surface.readMinimized?.()) ? surface.readMinimized() : []).slice(0, MAX_MINIMIZED).map((flag) => flag === true),
  };
}

/* ---------- aplicação ---------- */

function applyReference(visible) {
  const facts = surface.referenceFacts?.() || {};
  const action = String(layoutCore.referenceAction(facts.two === true, facts.tabIsForm === true, facts.open === true, !!visible));
  if (action === 'show') surface.showReference?.();
  else if (action === 'hide') surface.hideReference?.();
  return action;
}

function applyMinimized(flags) {
  const count = Math.max(0, Number(surface.panelCount?.()) || 0);
  for (let i = 0; i < Math.min(flags.length, count, MAX_MINIMIZED); i++) surface.setMinimized?.(i, flags[i] === true);
}

/** Aplica um layout completo (preset). Devolve o layout normalizado ou null. */
export function applyLayout(raw) {
  const layout = normalizeLayout(raw);
  if (!layout || !surface) return null;
  surface.setChatWidth(layout.chatWidth);
  if (surface.calculatorEnabled?.() !== false) {
    surface.setCalculatorCollapsed(layout.calculatorCollapsed);
    surface.setCalcHeight(layout.calcHeight);
  }
  surface.setPdfSplit(layout.pdfSplit);
  surface.setChatCollapsed(layout.chatCollapsed);
  applyReference(layout.referenceVisible);
  applyMinimized(layout.minimized);
  surface.save?.();
  return layout;
}

/* Aplica o `viewLayout` do estado (boot/troca de curso): campos ausentes não
   são tocados (compatibilidade com estado antigo). */
export function applyViewLayout(raw) {
  if (!isPlainObject(raw) || !surface) return false;
  let touched = false;
  const chatWidth = finite(raw.chatWidth);
  if (chatWidth !== null) {
    surface.setChatWidth(clampNat(chatWidth, 300, 700));
    touched = true;
  }
  const calcHeight = finite(raw.calcHeight);
  if (calcHeight !== null && surface.calculatorEnabled?.() !== false) {
    surface.setCalcHeight(clampNat(calcHeight, 72, 900));
    touched = true;
  }
  const pdfSplit = finite(raw.pdfSplit);
  if (pdfSplit !== null) {
    surface.setPdfSplit(clampSplit(pdfSplit));
    touched = true;
  }
  if (typeof raw.chatCollapsed === 'boolean') {
    surface.setChatCollapsed(raw.chatCollapsed);
    touched = true;
  }
  if (typeof raw.calculatorCollapsed === 'boolean' && surface.calculatorEnabled?.() !== false) {
    surface.setCalculatorCollapsed(raw.calculatorCollapsed);
    touched = true;
  }
  if (typeof raw.referenceVisible === 'boolean') {
    applyReference(raw.referenceVisible);
    touched = true;
  }
  if (Array.isArray(raw.minimized) && raw.minimized.every((flag) => typeof flag === 'boolean')) {
    applyMinimized(raw.minimized);
    touched = true;
  }
  if (touched) surface.save?.();
  return touched;
}

/* ---------- UI (diálogo + entrada nas Configurações) ---------- */

function defaultApi() {
  const desk = globalThis.window?.desk || {};
  return {
    get: () => (typeof desk.layoutPresetsGet === 'function' ? desk.layoutPresetsGet() : Promise.resolve({version: 1, presets: []})),
    save: (payload) => (typeof desk.layoutPresetsSave === 'function' ? desk.layoutPresetsSave(payload) : Promise.resolve({version: 1, presets: []})),
    confirm: (text) => globalThis.window?.confirm ? globalThis.window.confirm(text) : true,
    document: globalThis.document,
  };
}

const el = (doc, tag, attrs = {}, kids = []) => {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') node.textContent = String(value);
    else if (key === 'onclick') node.addEventListener('click', value);
    else node.setAttribute(key, String(value));
  }
  for (const kid of kids) node.append(kid);
  return node;
};

function buildDialog(doc) {
  const select = el(doc, 'select', {id: 'layout-preset-select', 'aria-label': t('layout.dialog.label')});
  const summary = el(doc, 'p', {id: 'layout-preset-summary', class: 'fine'});
  const name = el(doc, 'input', {id: 'layout-preset-name', type: 'text', maxlength: '60', placeholder: t('layout.dialog.namePlaceholder'), 'aria-label': t('layout.dialog.nameAria')});
  const status = el(doc, 'p', {id: 'layout-preset-status', class: 'fine', role: 'status'});
  const apply = el(doc, 'button', {type: 'button', id: 'layout-preset-apply', class: 'primary', text: t('layout.dialog.apply')});
  const save = el(doc, 'button', {type: 'button', id: 'layout-preset-save', text: t('layout.dialog.save')});
  const rename = el(doc, 'button', {type: 'button', id: 'layout-preset-rename', text: t('layout.dialog.rename')});
  const remove = el(doc, 'button', {type: 'button', id: 'layout-preset-delete', text: t('layout.dialog.delete')});
  const close = el(doc, 'button', {type: 'button', id: 'layout-presets-close', class: 'icon-btn', 'aria-label': t('common.close'), text: '×'});
  const leadNode = el(doc, 'p', {class: 'help-lead', text: t('layout.dialog.lead')});
  const selectLabel = el(doc, 'label', {for: 'layout-preset-select', text: t('layout.dialog.label')});
  const nameLabel = el(doc, 'label', {for: 'layout-preset-name', text: t('layout.dialog.name')});
  const title = el(doc, 'h2', {id: 'layout-presets-title', text: t('layout.dialog.title')});
  const dialog = el(doc, 'dialog', {id: 'layout-presets-dialog', 'aria-labelledby': 'layout-presets-title'}, [
    el(doc, 'div', {class: 'help-head'}, [title, close]),
    leadNode,
    selectLabel,
    select,
    summary,
    nameLabel,
    name,
    el(doc, 'div', {class: 'layout-preset-actions'}, [apply, save, rename, remove]),
    status,
  ]);
  doc.body.append(dialog);
  return {dialog, select, summary, name, status, apply, save, rename, remove, close, title, leadNode, selectLabel, nameLabel};
}

export function initLayoutPresetsUI({api, onApplied, document: docArg} = {}) {
  if (ui) return ui;
  const deps = {...defaultApi(), ...(api || {})};
  const doc = docArg || deps.document || globalThis.document;
  if (!doc) throw Error('layout-presets: documento indisponível');
  const refs = buildDialog(doc);
  let store = {version: 1, presets: []};
  let ready = false;

  /* Entrada nas Configurações: o módulo cria o botão se o host não tiver
     ligado um no HTML (mesmo lugar do editor de leitores). */
  const shell = doc.querySelector('#cfg-layout');
  if (shell && !doc.querySelector('#layout-presets-open')) {
    const openButton = el(doc, 'button', {type: 'button', id: 'layout-presets-open', class: 'layout-presets-open', text: t('settings.layout.presetsOpen')});
    openButton.addEventListener('click', () => api_refs.open());
    shell.append(openButton);
  }
  const trigger = doc.querySelector('#layout-presets-open');
  if (trigger) trigger.setAttribute('aria-haspopup', 'dialog');
  /* O botão é do Configurações (#41); o diálogo que ele abre e os nomes dos layouts seguem em português até a fase dos leitores. */
  globalThis.window?.addEventListener?.(LANGUAGE_EVENT, () => { if (trigger) trigger.textContent = t('settings.layout.presetsOpen'); });

  function allPresets() {
    return [...builtinPresets(), ...store.presets];
  }

  function selected() {
    const id = refs.select.value;
    return allPresets().find((preset) => preset.id === id) || null;
  }

  function setStatus(text) {
    refs.status.textContent = String(text || '');
  }

  function render() {
    const current = refs.select.value;
    refs.select.replaceChildren();
    const built = builtinPresets();
    if (built.length) {
      const group = doc.createElement('optgroup');
      group.label = t('layout.group.builtin');
      for (const preset of built) group.append(new Option(t('layout.builtinSuffix', {name: preset.name}), preset.id));
      refs.select.append(group);
    }
    if (store.presets.length) {
      const group = doc.createElement('optgroup');
      group.label = t('layout.group.mine');
      for (const preset of store.presets) group.append(new Option(preset.name, preset.id));
      refs.select.append(group);
    }
    const want = current && allPresets().some((preset) => preset.id === current) ? current : allPresets()[0]?.id || '';
    refs.select.value = want;
    const preset = selected();
    refs.summary.textContent = preset ? summaryOf(preset.layout) : '';
    const personal = !!preset && preset.builtin !== true;
    refs.apply.disabled = !preset;
    refs.save.disabled = !hasLayoutSurface();
    refs.rename.disabled = !personal;
    refs.remove.disabled = !personal;
    if (preset && !personal) refs.name.value = preset.name;
  }

  async function reload() {
    try {
      store = normalizeStore(await deps.get());
    } catch (error) {
      store = {version: 1, presets: []};
      setStatus(error?.message || t('layout.status.readFail'));
    }
    ready = true;
    render();
  }

  async function command(payload) {
    try {
      const result = await deps.save(payload);
      store = normalizeStore(result);
      render();
      return true;
    } catch (error) {
      setStatus(error?.message || t('layout.status.saveFail'));
      return false;
    }
  }

  async function open() {
    if (refs.dialog.open) return;
    setStatus('');
    refs.dialog.showModal();
    await reload();
    refs.select.focus();
  }

  function close() {
    if (refs.dialog.open) refs.dialog.close();
  }

  refs.select.addEventListener('change', render);
  refs.close.addEventListener('click', close);
  refs.dialog.addEventListener('click', (event) => {
    if (event.target === refs.dialog) close();
  });
  refs.apply.addEventListener('click', () => {
    const preset = selected();
    if (!preset) return;
    const applied = applyLayout(preset.layout);
    if (!applied) {
      setStatus(t('layout.status.notReady'));
      return;
    }
    setStatus(t('layout.status.applied', {name: preset.name}));
    onApplied?.(preset);
  });
  refs.save.addEventListener('click', async () => {
    const name = refs.name.value.trim();
    if (!name) {
      setStatus(t('layout.status.needName'));
      refs.name.focus();
      return;
    }
    const layout = captureLayout();
    if (!layout) {
      setStatus(t('layout.status.notReady'));
      return;
    }
    const before = new Set(store.presets.map((preset) => preset.id));
    if (!(await command({action: 'upsert', preset: {name, layout}}))) return;
    const created = store.presets.find((preset) => !before.has(preset.id)) || store.presets.find((preset) => preset.name === name);
    if (created) refs.select.value = created.id;
    render();
    setStatus(t('layout.status.saved', {name}));
  });
  refs.rename.addEventListener('click', async () => {
    const preset = selected();
    if (!preset || preset.builtin) return;
    const name = refs.name.value.trim();
    if (!name) {
      setStatus(t('layout.status.needName'));
      refs.name.focus();
      return;
    }
    if (await command({action: 'rename', id: preset.id, name})) {
      refs.select.value = preset.id;
      render();
      setStatus(t('layout.status.renamed'));
    }
  });
  refs.remove.addEventListener('click', async () => {
    const preset = selected();
    if (!preset || preset.builtin) return;
    if (!deps.confirm(t('layout.deleteConfirm', {name: preset.name}))) return;
    if (await command({action: 'delete', id: preset.id})) {
      render();
      setStatus(t('layout.status.deleted'));
    }
  });

  /* Troca de idioma com o diálogo já montado: reescreve o texto fixo e refaz a lista. */
  function relabel() {
    refs.title.textContent = t('layout.dialog.title');
    refs.leadNode.textContent = t('layout.dialog.lead');
    refs.selectLabel.textContent = t('layout.dialog.label');
    refs.nameLabel.textContent = t('layout.dialog.name');
    refs.select.setAttribute('aria-label', t('layout.dialog.label'));
    refs.name.setAttribute('placeholder', t('layout.dialog.namePlaceholder'));
    refs.name.setAttribute('aria-label', t('layout.dialog.nameAria'));
    refs.apply.textContent = t('layout.dialog.apply');
    refs.save.textContent = t('layout.dialog.save');
    refs.rename.textContent = t('layout.dialog.rename');
    refs.remove.textContent = t('layout.dialog.delete');
    refs.close.setAttribute('aria-label', t('common.close'));
    if (ready) render();
  }
  globalThis.window?.addEventListener?.(LANGUAGE_EVENT, relabel);

  const api_refs = {
    open,
    close,
    isOpen: () => refs.dialog.open,
    list: () => ({version: store.version, presets: store.presets.slice()}),
    all: allPresets,
    builtins: builtinPresets,
    refresh: reload,
    capture: captureLayout,
    apply: (id) => {
      const preset = allPresets().find((item) => item.id === id);
      if (!preset) return null;
      const layout = applyLayout(preset.layout);
      if (layout) onApplied?.(preset);
      return layout;
    },
    /* Teste de UI isolado: troca o backend de persistência em memória sem
       tocar no objeto congelado do contextBridge. Em produção ninguém chama. */
    useApi: (overrides) => {
      if (overrides && typeof overrides === 'object') Object.assign(deps, overrides);
      return api_refs;
    },
    dialog: refs.dialog,
  };
  ui = api_refs;
  if (globalThis.window) globalThis.window.mesaLayoutPresets = {...api_refs, surface: () => surface, summaryOf, normalizeLayout, normalizeStore, builtinPresets};
  return api_refs;
}

/* Testes de UI: reseta o singleton (a criação é por documento e o teste sobe
   um app por vez). */
export function resetLayoutPresetsUI() {
  ui = null;
}
