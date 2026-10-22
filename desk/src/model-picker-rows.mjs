// @ts-check
import {icon} from '../icons.mjs';
import {t, text, currentLanguage} from './ui-text.mjs';
import {contextSize} from './model-picker.mjs';
import {providerIcon, vendorIcon} from './provider-icons.mjs';
import {themeTokens} from './activity-view.mjs';
import {format as formatCombo} from './keys.mjs';

/* Os nós da lista do seletor de modelo (#59): grupos, subgrupos por fabricante,
   linhas e o trilho. Saiu do `model-picker-ui.mjs` nos ajustes do seletor (o
   arquivo passava de 500 linhas); o estado, o teclado e a pintura seguem lá.

   A segunda linha depende do grupo: no grupo de um provedor o nome dele já está
   no título, então ali vão os fatos do catálogo (contexto, visão, raciocínio,
   preço); nos grupos mistos (Favoritos, Recentes, Grátis, busca) vai o provedor.
   O grátis leva a política de dados nos dois. */

/** @typedef {import('./model-picker.mjs').PickerItem} PickerItem */
/** @typedef {import('./model-picker.mjs').PickerGroup} PickerGroup */
/** @typedef {{selectedKey: string, short: boolean, kind: PickerGroup['kind']}} RowContext */

const FAVORITE_COMBO = 'Mod+D';

/* Favoritos, Recentes e Grátis têm ícone da Mesa; provedor, o logo ou o monograma. */
const GROUP_ICONS = Object.freeze({favorite: 'star', recent: 'clock', free: 'sparkles'});

/** @param {PickerGroup['kind']} kind @param {string} title */
export function groupTitle(kind, title) {
  if (kind === 'favorite') return t('modelPicker.group.favorite');
  if (kind === 'recent') return t('modelPicker.group.recent');
  if (kind === 'free') return t('modelPicker.group.free');
  return title;
}

/**
 * A paleta categórica da Mesa (`--mesa-chart-1…6`) no tema e no acento em uso,
 * para as cores dos monogramas. A fonte é o núcleo do quadro (`themeTokens`).
 * @param {Document} doc
 * @returns {Array<[string, string]>}
 */
export function chartTokens(doc) {
  const root = doc.documentElement;
  const chosen = root.dataset.theme;
  const dark = chosen === 'dark' || (chosen !== 'light' && !!doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const tokens = /** @type {Record<string, string>} */ (themeTokens(dark ? 'dark' : 'light', root.dataset.accent || 'blue'));
  return Object.entries(tokens).filter(([name]) => name.startsWith('--mesa-chart-'));
}

/* A dica (balão da Mesa, `data-tip`) e o nome acessível dizem o grupo. */
/** @param {{group: number, kind: PickerGroup['kind'], title: string, provider: string}} entry */
export function railButton(entry) {
  const item = document.createElement('div');
  const name = groupTitle(entry.kind, entry.title);
  item.className = 'model-rail-item';
  item.dataset.group = String(entry.group);
  item.dataset.kind = entry.kind;
  item.dataset.tip = name;
  item.setAttribute('aria-label', name);
  item.innerHTML = entry.kind === 'provider' ? providerIcon(entry.provider, entry.title) : icon(GROUP_ICONS[/** @type {keyof typeof GROUP_ICONS} */ (entry.kind)] || 'cpu');
  return item;
}

/** @param {PickerGroup} group @param {number} groupAt @param {(item: PickerItem, context: RowContext) => Node} rowOf @param {string} selectedKey */
export function groupNode(group, groupAt, rowOf, selectedKey) {
  const box = document.createElement('div');
  box.setAttribute('role', 'group');
  box.className = 'model-group';
  box.dataset.kind = group.kind;
  box.dataset.group = String(groupAt);
  const title = document.createElement('div');
  title.className = 'model-group-title';
  title.id = `model-group-${groupAt}`;
  title.textContent = groupTitle(group.kind, group.title);
  box.setAttribute('aria-labelledby', title.id);
  box.append(title);
  const context = {selectedKey, kind: group.kind};
  if (!group.sections) {
    for (const item of group.items) box.append(rowOf(item, {...context, short: false}));
    return box;
  }
  group.sections.forEach((section, at) => {
    box.append(sectionTitle(section, `${title.id}-${at}`));
    for (const item of section.items) box.append(rowOf(item, {...context, short: true}));
  });
  return box;
}

/* Subtítulo do fabricante dentro de um provedor grande. As linhas dele perdem o
   "Fabricante: " do nome; a busca segue achando pelo nome completo. O logo sai
   do prefixo do id do primeiro modelo (`x-ai/…`); sem logo, o monograma; o
   subgrupo sem fabricante fica só com o texto. */
/** @param {import('./model-picker.mjs').PickerSection} section @param {string} id */
function sectionTitle(section, id) {
  const title = document.createElement('div');
  title.className = 'model-section-title';
  title.id = id;
  title.setAttribute('role', 'presentation');
  const name = document.createElement('span');
  name.className = 'model-section-name';
  name.textContent = section.vendor || t('modelPicker.section.unnamed');
  title.append(name);
  if (!section.vendor) return title;
  const logo = document.createElement('span');
  logo.className = 'model-section-logo';
  logo.innerHTML = vendorIcon(section.items[0]?.id || '', section.vendor);
  title.prepend(logo);
  return title;
}

/** A linha "Padrão do OpenCode": o que vale sem escolha; não é escolhível (#57). @param {boolean} selected */
export function defaultRow(selected) {
  const row = baseRow('model-opt-default', t('opencode.model.default'));
  row.setAttribute('aria-disabled', 'true');
  row.setAttribute('aria-selected', String(selected));
  row.classList.add('model-row-default');
  return row;
}

/** O lugar da lista antes de haver catálogo (tutor desligado). */
export function waitingRow() {
  const row = baseRow('model-opt-waiting', t('tutor.callOption'));
  row.setAttribute('aria-disabled', 'true');
  row.setAttribute('aria-selected', 'true');
  return row;
}

/* Duas camadas: o nome (com o selo "Grátis") em cima; embaixo, os fatos do
   modelo ou o provedor, conforme o grupo, e a política de dados do grátis. A
   estrela fica fora da lista plana do Claude, que não tem favoritos. */
/** @param {PickerItem} item @param {RowContext} context @param {number} at */
export function itemRow(item, context, at) {
  const notes = item.notes.map(text);
  const row = baseRow(`model-opt-${at}`, context.short ? item.short : item.name);
  row.dataset.row = String(at);
  row.dataset.key = item.key;
  row.setAttribute('aria-selected', String(item.key === context.selectedKey));
  if (context.short && item.vendor) row.setAttribute('aria-label', item.name);
  if (item.free) { row.dataset.free = '1'; row.querySelector('.model-row-top')?.append(freeBadge()); }
  if (item.zenPaid) row.dataset.zenPaid = '1';
  const facts = context.kind === 'provider';
  const meta = facts ? factsLine(item, notes) : providerLine(item, notes);
  /* A dica completa a linha que pode sair cortada: o nome inteiro e os fatos, ou a política. */
  const tip = [context.short ? item.name : '', facts ? meta.textContent || '' : notes.join(' · ')].filter(Boolean).join('\n');
  if (tip) row.title = tip;
  row.querySelector('.model-row-text')?.append(meta);
  if (context.kind === 'flat') return row;
  const star = starOf(item.favorite, row.id);
  row.setAttribute('aria-describedby', star.id);
  row.append(star);
  return row;
}

function freeBadge() {
  const badge = document.createElement('span');
  badge.className = 'model-row-badge';
  badge.textContent = t('modelPicker.group.free');
  return badge;
}

/** @param {string[]} parts */
function metaOf(parts) {
  const meta = document.createElement('span');
  meta.className = 'model-row-meta';
  const line = document.createElement('span');
  line.className = 'model-row-note';
  line.textContent = parts.join(' · ');
  meta.append(line);
  return meta;
}

/** Nos grupos mistos: o logo e o nome do provedor, e a política do grátis. @param {PickerItem} item @param {string[]} notes */
function providerLine(item, notes) {
  const meta = metaOf(notes);
  const logo = document.createElement('span');
  logo.className = 'model-row-logo';
  logo.innerHTML = providerIcon(item.provider, item.providerName);
  const provider = document.createElement('span');
  provider.className = 'model-row-provider';
  provider.textContent = item.providerName;
  meta.prepend(logo, provider);
  if (!notes.length) meta.querySelector('.model-row-note')?.remove();
  return meta;
}

/** No grupo do provedor: contexto, visão, raciocínio, preço e a política do grátis. @param {PickerItem} item @param {string[]} notes */
function factsLine(item, notes) {
  return metaOf([...factTexts(item.facts), ...notes]);
}

/* O preço do catálogo é em dólar por milhão de tokens (entrada / saída). */
const MONEY = new Map();
/** @param {number} value */
function money(value) {
  const language = currentLanguage();
  if (!MONEY.has(language)) MONEY.set(language, new Intl.NumberFormat(language, {style: 'currency', currency: 'USD', maximumFractionDigits: 2}));
  return MONEY.get(language).format(value);
}

/** @param {import('./model-picker.mjs').ModelFacts} facts @returns {string[]} */
function factTexts(facts) {
  const parts = [];
  if (facts.context) {
    const size = contextSize(facts.context);
    parts.push(t(size.unit === 'M' ? 'modelPicker.meta.contextM' : 'modelPicker.meta.contextK', {n: size.value.toLocaleString(currentLanguage())}));
  }
  if (facts.vision) parts.push(t('modelPicker.meta.vision'));
  if (facts.reasoning) parts.push(t('modelPicker.meta.reasoning'));
  if (facts.price) parts.push(t('modelPicker.meta.price', {input: money(facts.price.input), output: money(facts.price.output)}));
  return parts;
}

/* O mouse clica; o teclado usa ⌘D/Ctrl+D na linha ativa (o foco fica na
   busca). O estado vai ao leitor de tela pela descrição da linha
   (`aria-describedby`) e `data-favorite` o mostra (#58). */
/** @param {boolean} on @param {string} rowId */
function starOf(on, rowId) {
  const star = document.createElement('span');
  star.className = 'model-row-star';
  star.id = `${rowId}-star`;
  star.dataset.favorite = on ? '1' : '';
  const shortcut = formatCombo(FAVORITE_COMBO);
  star.title = t(on ? 'modelPicker.star.remove' : 'modelPicker.star.add', {shortcut});
  star.setAttribute('aria-label', t(on ? 'modelPicker.star.on' : 'modelPicker.star.off', {shortcut}));
  star.innerHTML = STAR_ICON();
  return star;
}

/* O SVG da estrela e do check se repetem em cada linha: monta uma vez. */
let starSvg = '', checkSvg = '';
const STAR_ICON = () => (starSvg ||= icon('star'));
const CHECK_ICON = () => (checkSvg ||= icon('check'));

/** @param {string} id @param {string} name */
function baseRow(id, name) {
  const row = document.createElement('div');
  row.setAttribute('role', 'option');
  row.className = 'model-row';
  row.id = id;
  const label = document.createElement('span');
  label.className = 'model-row-text';
  const top = document.createElement('span');
  top.className = 'model-row-top';
  const title = document.createElement('span');
  title.className = 'model-row-name';
  title.textContent = name;
  top.append(title);
  label.append(top);
  const check = document.createElement('span');
  check.className = 'model-row-check';
  check.innerHTML = CHECK_ICON();
  row.append(label, check);
  return row;
}
