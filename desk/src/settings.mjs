import settingsCore from './generated/settingsview.core.js';
import {build, childrenOf, preserveFocus, renderChildren, renderInto} from './view-host.mjs';
import {LANGUAGE_EVENT} from './ui-text.mjs';

/* Aplicador das Configurações com seções na lateral (ticket #20). O núcleo é
   `core/settingsview.bend`: quais são as seções, a árvore da navegação, a
   validação das matérias e o aviso de erro. Aqui só se cola no DOM: mostrar a
   seção certa, entregar as linhas lidas como fatos, pôr o aviso ao lado do
   campo e levar o foco até ele. Ler/gravar o `config.json` continua no main. */

const $ = (selector) => document.querySelector(selector);
const bendList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

let current = settingsCore.firstSection();
/* Fatos do rodapé (#42): o tutor está respondendo e há mudança pendente. O
   texto e a trava do Salvar são do núcleo (`footerHintFor`/`saveBlocked`). */
let footer = {busy: false, dirty: false};

const HANDLERS = {
  SelectSection: (event) => showSection(event.currentTarget?.dataset?.sec, {focus: true}),
};

function renderNav(focus) {
  const tabs = $('#settings-tabs');
  if (!tabs) return;
  preserveFocus(tabs, () => renderChildren(tabs, settingsCore.navChildren(current), HANDLERS));
  if (focus) tabs.querySelector('[aria-current="page"]')?.focus();
}

/* Mostra uma seção e esconde as outras. Seção desconhecida cai em Matérias
   (decisão do núcleo). Trocar de seção nunca salva nem descarta nada: os campos
   das seções escondidas continuam no DOM com o que foi digitado. */
export function showSection(id, {focus = false} = {}) {
  current = settingsCore.activeSection(String(id ?? ''));
  const body = $('#settings-body');
  if (body) {
    for (const pane of body.querySelectorAll(':scope > [data-sec]')) {
      pane.hidden = pane.dataset.sec !== current;
    }
    body.scrollTop = 0;
  }
  renderNav(focus);
  paintFooter();
  return current;
}

function paintFooter() {
  const hint = $('#settings-hint');
  if (hint) renderInto(hint, settingsCore.footerHintForNode(current, footer.busy, footer.dirty));
  const blocked = settingsCore.saveBlocked(footer.busy, footer.dirty);
  hint?.classList.toggle('waiting', blocked);
  const save = $('#settings-save');
  if (save) save.disabled = blocked;
}

/* O host avisa quando o tutor começa/termina a resposta e quando a pessoa
   mexe num campo; o rodapé e o Salvar acompanham na hora. */
export function setSettingsFooter({busy = footer.busy, dirty = footer.dirty} = {}) {
  footer = {busy: !!busy, dirty: !!dirty};
  paintFooter();
}

export function saveBlockedNow() {
  return settingsCore.saveBlocked(footer.busy, footer.dirty);
}

/* Erro de salvar (o main recusou) aparece DENTRO do diálogo, ao lado do Salvar
   — nunca num aviso que ficaria atrás do modal. */
export function showSaveError(message) {
  const box = $('#settings-error');
  if (!box) return;
  box.textContent = String(message || '');
  box.hidden = !message;
  const hint = $('#settings-hint');
  if (hint) hint.hidden = !!message;
}

/* Abertura do diálogo: sempre em Matérias (ou na seção pedida) e sem avisos
   de uma tentativa anterior. */
export function prepareSettings({section = ''} = {}) {
  clearErrors();
  showSaveError('');
  showSection(section || settingsCore.firstSection());
}

/* ---------- validação das matérias ---------- */

function courseRows() {
  return [...document.querySelectorAll('#cfg-courses .cfg-course')];
}

function rowFacts(rows) {
  return bendList(rows.map((row) => ({
    $: 'SettingsRow',
    id: String(row.dataset.id ?? ''),
    name: row.querySelector('.cfg-name')?.value ?? '',
    path: row.querySelector('.cfg-path')?.value ?? '',
  })));
}

/* Tira o aviso de uma linha (o parágrafo logo abaixo e as marcas do campo). */
function clearRowError(row) {
  const note = row.nextElementSibling;
  if (note?.classList.contains('cfg-error')) note.remove();
  row.classList.remove('has-error');
  for (const field of row.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  }
}

export function clearErrors() {
  for (const row of courseRows()) clearRowError(row);
  for (const note of document.querySelectorAll('#cfg-courses .cfg-error')) note.remove();
}

/* `true` = pode salvar. Com erro: o aviso aparece ao lado do campo, a seção do
   primeiro erro abre e o foco vai para o campo. */
export function validateSettings() {
  clearErrors();
  const rows = courseRows();
  const facts = rowFacts(rows);
  const list = settingsCore.settingsIssues(facts);
  const issues = childrenOf(list);
  if (!issues.length) return true;
  let first = null;
  for (const issue of issues) {
    const row = rows[Number(issue.row)];
    if (!row) continue;
    const field = row.querySelector(issue.field === 'name' ? '.cfg-name' : '.cfg-path');
    const id = `course-${Number(issue.row)}`;
    row.classList.add('has-error');
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', settingsCore.errorId(id));
      first ||= field;
    }
    row.after(build(settingsCore.errorNode(id, String(issue.message))));
  }
  showSection(settingsCore.issueSection(list));
  first?.focus();
  return false;
}

/* ---------- ligação ---------- */

export function initSettings() {
  const tabs = $('#settings-tabs');
  tabs?.addEventListener('keydown', (event) => {
    const target = {
      ArrowDown: settingsCore.nextSection(current),
      ArrowRight: settingsCore.nextSection(current),
      ArrowUp: settingsCore.prevSection(current),
      ArrowLeft: settingsCore.prevSection(current),
      Home: settingsCore.firstSection(),
      End: settingsCore.prevSection(settingsCore.firstSection()),
    }[event.key];
    if (!target) return;
    event.preventDefault();
    showSection(target, {focus: true});
  });
  const courses = $('#cfg-courses');
  /* Corrigir o campo tira o aviso; remover/escolher pasta numa linha também
     (o clique em botão, não o clique para posicionar o cursor). */
  courses?.addEventListener('input', (event) => {
    const row = event.target?.closest?.('.cfg-course');
    if (row) clearRowError(row);
  });
  courses?.addEventListener('click', (event) => {
    if (event.target?.closest?.('button')) clearErrors();
  });
  $('#settings-dialog')?.addEventListener('close', clearErrors);
  // A navegação e o rodapé são árvores do núcleo: trocar o idioma as refaz na hora (#41).
  window.addEventListener(LANGUAGE_EVENT, () => { renderNav(false); paintFooter(); });
}
