import paletteCore from './generated/mesaqolpalette.core.js';
import {foldSearch} from './pdf.mjs';
import {icon} from '../icons.mjs';
import {build, htmlNode, preserveScroll, renderChildren} from './view-host.mjs';
import {t} from './ui-text.mjs';

/* ---------------------------------------------------------------------------
   Paleta de ações da Mesa (⌘K / item "Paleta de ações" do menu nativo).

   A árvore, o casamento e o ranque são do núcleo
   (`core/mesaqolpalette.bend` → `mesaqolpalette.core.js`); aqui ficam a dobra
   sem acento (a mesma do leitor/da busca), os ícones SVG, o foco, o scroll e a
   execução das ações. A LISTA de ações é do host (`main.mjs`), que resolve
   matéria/conversa disponíveis, flags do `desk` e o estado do turno — este
   módulo não conhece regra de negócio nem importa `state.mjs`.

   Ação (contrato do host):
     {id, label, icon?, kbd?, check?, when?, section?, search?, disabled?, reason?,
      run()}
   - `disabled`/`reason` são fatos já resolvidos (busy, flag desligada, sem
     leitor…): a paleta mostra o item apagado, com o motivo no title, e as
     setas/Enter pulam ele.
   - `search` é o texto extra do filtro (matéria/caminho/prévia) já pronto.
   - `section` agrupa por id: commands, courses, sessions, layouts (ordem fixa).

   Abrir/fechar:
     - ⌘/Ctrl+K alterna (o padrão pode ser remapeado no editor de atalhos: o
       preload reenvia o combo atual como tecla sintética e este listener é o
       handler da ação `command-palette` do catálogo do keys.mjs);
     - o menu nativo chega por `window.desk.onMenuPalette` (ligado no main.mjs)
       e chama `openCommandPalette()`;
     - com um `<dialog open>` o `canOpen` é falso (mesma guarda dos outros
       atalhos) e o item do menu não abre por cima.
   --------------------------------------------------------------------------- */

const NIL = {$: 'Nil'};
/* Ids das seções, na ordem em que aparecem; o título vem do catálogo (`palette.section.<id>`). */
const SECTION_ORDER = ['commands', 'courses', 'sessions', 'layouts'];
const ITEM_HANDLERS = {
  hold: (event) => event.preventDefault(),
  pick: (event) => execute(entries.find((item) => item.id === event.currentTarget?.id)),
};

let backdrop = null;
let input = null;
let list = null;
let open = false;
let prevFocus = null;
/* `catalog` guarda todas as ações da abertura; `entries` é o recorte visível
   (filtrado e ordenado) — refiltrar parte sempre do catálogo, senão apagar ou
   trocar o texto da busca só encontraria o que já tinha sobrado. */
let catalog = [];
let entries = [];
let sections = [];
let active = -1;
let deps = null;

const listToCore = (items, convert = (value) => value) => {
  const source = Array.isArray(items) ? items : [];
  let out = NIL;
  for (let i = source.length - 1; i >= 0; i--) out = {$: 'Con', head: convert(source[i]), tail: out};
  return out;
};

/* Dobra sem acento do leitor/busca (`pdf.mjs#foldSearch` preserva o
   comprimento, então o índice dobrado vale no texto original). */
function tokensOf(value) {
  return foldSearch(value).split(/\s+/).filter(Boolean);
}

function segmentsOf(text, tokens) {
  const value = String(text ?? '');
  const folded = foldSearch(value);
  const spans = [];
  for (const token of tokens) {
    let from = 0;
    let at;
    while ((at = folded.indexOf(token, from)) !== -1) {
      spans.push([at, at + token.length]);
      from = at + token.length;
    }
  }
  if (!spans.length) return [{$: 'PaletteSegment', text: value, matched: false}];
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  const pieces = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) pieces.push({$: 'PaletteSegment', text: value.slice(cursor, start), matched: false});
    pieces.push({$: 'PaletteSegment', text: value.slice(start, end), matched: true});
    cursor = end;
  }
  if (cursor < value.length) pieces.push({$: 'PaletteSegment', text: value.slice(cursor), matched: false});
  return pieces;
}

function attrValue(node, name) {
  for (let attrs = node?.attrs; attrs?.$ === 'Con'; attrs = attrs.tail) {
    if (attrs.head?.name === name) return attrs.head.value;
  }
  return '';
}

/* SVG continua HTML do host: o Bend fornece o slot e o nome; esta ponte troca
   só o filho textual do slot por `Html` (extensão do view-host). */
function materializeIcons(node) {
  if (!node || node.$ !== 'ViewEl') return node;
  const cls = attrValue(node, 'class').split(/\s+/);
  if (cls.includes('palette-item-icon') || cls.includes('palette-check')) {
    const name = node.kids?.$ === 'Con' ? String(node.kids.head?.text || '') : '';
    return {...node, kids: listToCore([htmlNode(icon(name))])};
  }
  const kids = [];
  for (let current = node.kids; current?.$ === 'Con'; current = current.tail) kids.push(materializeIcons(current.head));
  return {...node, kids: listToCore(kids)};
}

function normalizeActions(source) {
  const out = [];
  for (const raw of Array.isArray(source) ? source : []) {
    if (!raw || typeof raw !== 'object' || typeof raw.run !== 'function') continue;
    const label = String(raw.label || raw.id || '');
    if (!label) continue;
    out.push({
      id: String(raw.id || `palette-action-${out.length + 1}`),
      label,
      icon: String(raw.icon || 'chevronRight'),
      kbd: String(raw.kbd || ''),
      check: raw.check === true,
      when: String(raw.when || ''),
      section: SECTION_ORDER.includes(raw.section) ? raw.section : 'commands',
      search: String(raw.search || label),
      disabled: raw.disabled === true,
      reason: String(raw.reason || ''),
      run: raw.run,
    });
  }
  return out;
}

function sectionFacts(tokens) {
  return listToCore(sections, (section) => ({
    $: 'PaletteSection',
    title: section.title,
    items: listToCore(section.items, (item) => ({
      $: 'PaletteItem',
      id: item.id,
      icon: item.icon,
      segments: listToCore(segmentsOf(item.label, tokens)),
      kbd: item.disabled ? '' : item.kbd,
      check: item.check,
      when: item.disabled ? item.reason : item.when,
      disabled: item.disabled,
    })),
  }));
}

function paint(tokens) {
  const activeId = entries[active]?.id || '';
  preserveScroll(list, () => renderChildren(list, materializeSections(paletteCore.listKids(sectionFacts(tokens), activeId)), ITEM_HANDLERS));
  if (activeId) input.setAttribute('aria-activedescendant', activeId);
  else input.removeAttribute('aria-activedescendant');
}

function materializeSections(nodes) {
  const out = [];
  for (let current = nodes; current?.$ === 'Con'; current = current.tail) out.push(materializeIcons(current.head));
  return out;
}

function render() {
  const tokens = tokensOf(input.value);
  const rank = (source) => source
    .map((entry) => ({entry, score: Number(paletteCore.score(foldSearch(entry.search), listToCore(tokens)))}))
    .filter((hit) => !Number.isNaN(hit.score) && hit.score < 2)
    .sort((a, b) => a.score - b.score)
    .map((hit) => hit.entry);
  const bySection = new Map();
  for (const entry of catalog) {
    const bucket = bySection.get(entry.section) || [];
    bucket.push(entry);
    bySection.set(entry.section, bucket);
  }
  sections = SECTION_ORDER
    .filter((id) => bySection.has(id))
    .map((id) => ({title: t(`palette.section.${id}`), items: rank(bySection.get(id))}))
    .filter((section) => section.items.length);
  entries = [];
  let seq = 0;
  for (const section of sections) {
    for (const item of section.items) {
      item.id = `command-palette-item-${++seq}`;
      entries.push(item);
    }
  }
  active = entries.findIndex((entry) => !entry.disabled);
  paint(tokens);
}

function setActive(index) {
  if (!entries.length) {
    active = -1;
    paint(tokensOf(input.value));
    return;
  }
  const count = entries.length;
  const forward = index >= active;
  let next = ((index % count) + count) % count;
  active = -1;
  for (let step = 0; step < count; step++) {
    if (!entries[next].disabled) {active = next; break;}
    next = (next + (forward ? 1 : -1) + count) % count;
  }
  paint(tokensOf(input.value));
  list.querySelector('.palette-item.active')?.scrollIntoView({block: 'nearest'});
}

function execute(item) {
  if (!item || item.disabled) return;
  closeCommandPalette();
  try {
    const result = item.run?.();
    if (result && typeof result.then === 'function') result.catch((error) => deps?.onError?.(error));
  } catch (error) {
    deps?.onError?.(error);
  }
}

function buildPalette() {
  if (backdrop) return;
  const shell = paletteCore.paletteView(NIL, '', '');
  backdrop = build(materializeIcons(shell), {
    filter: () => render(),
    key: (event) => onInputKey(event),
    dim: (event) => {if (event.target === backdrop) closeCommandPalette();},
  });
  input = backdrop.querySelector('.palette-input');
  list = backdrop.querySelector('#command-palette-list');
  document.body.append(backdrop);
}

function onInputKey(event) {
  if (event.isComposing) return;
  if (event.key === 'ArrowDown') {event.preventDefault(); setActive(active + 1); return;}
  if (event.key === 'ArrowUp') {event.preventDefault(); setActive(active - 1); return;}
  if (event.key === 'Enter') {event.preventDefault(); execute(entries[active]); return;}
  if (event.key === 'Tab') event.preventDefault();
}

function restoreFocus() {
  const back = prevFocus;
  prevFocus = null;
  if (back?.isConnected && typeof back.focus === 'function' && back !== document.body) {
    back.focus();
    return;
  }
  document.querySelector(String(deps?.fallbackFocus || '#prompt'))?.focus();
}

export function isCommandPaletteOpen() {
  return open;
}

export function openCommandPalette() {
  if (open) return true;
  if (!deps) return false;
  if (deps.canOpen && !deps.canOpen()) return false;
  buildPalette();
  const current = document.activeElement;
  prevFocus = current instanceof HTMLElement && current !== input && !backdrop.contains(current) ? current : null;
  catalog = normalizeActions(deps.actions?.());
  entries = catalog;
  open = true;
  backdrop.hidden = false;
  input.value = '';
  render();
  input.focus();
  deps.onOpen?.();
  return true;
}

export function closeCommandPalette() {
  if (!open) return;
  open = false;
  backdrop.hidden = true;
  input.value = '';
  catalog = [];
  entries = [];
  sections = [];
  active = -1;
  list.replaceChildren();
  input.removeAttribute('aria-activedescendant');
  restoreFocus();
}

export function toggleCommandPalette() {
  if (open) {closeCommandPalette(); return true;}
  return openCommandPalette();
}

/* Handler dos atalhos: ⌘/Ctrl+K (a ação também é remapeável no keys.mjs — o
   preload reenvia o combo atual como tecla sintética e este listener o trata). */
function onWindowKey(event) {
  if (event.defaultPrevented) return;
  const mod = event.metaKey || event.ctrlKey;
  if (open && event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeCommandPalette();
    return;
  }
  if (!mod || event.altKey || event.shiftKey || event.repeat) return;
  if (String(event.key || '').toLowerCase() !== 'k') return;
  if (!open && deps?.canOpen && !deps.canOpen()) return;
  event.preventDefault();
  event.stopPropagation();
  toggleCommandPalette();
}

export function initCommandPalette(options = {}) {
  deps = {
    actions: options.actions || (() => []),
    canOpen: options.canOpen || (() => !document.querySelector('dialog[open]')),
    onOpen: options.onOpen,
    onError: options.onError,
    fallbackFocus: options.fallbackFocus || '#prompt',
  };
  window.addEventListener('keydown', onWindowKey, true);
  return {open: openCommandPalette, close: closeCommandPalette, toggle: toggleCommandPalette, isOpen: isCommandPaletteOpen};
}
