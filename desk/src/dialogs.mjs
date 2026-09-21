import dialogsCore from './generated/dialogsview.core.js';
import {build, htmlNode, renderChildren, renderInto} from './view-host.mjs';

/* Aplicadores dos diálogos da Mesa (o núcleo é `core/dialogsview.bend`).
   O casco estático (`<dialog>`/`<form method=dialog>`, inputs de caminho,
   seções de aparência/avisos, corpo da ajuda) continua no `index.html`; aqui
   só se troca o que é dinâmico: título/lead, linhas de matéria, o formulário
   do Encerrar, a versão da ajuda e os fatos de flag que escondem itens.

   Convenções do aplicador: ids/classes/aria/valores preservados; `on:<evento>`
   cai em `dialogsHandlers` (ou na tabela de quem chama); o IPC continua com
   quem abre/fecha o diálogo (`main.mjs`, `chat.mjs`). */

const $ = (selector) => document.querySelector(selector);
const Nil = {$: 'Nil'};
const bendList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const courseFacts = (course = {}) => ({
  $: 'SettingsCourse',
  id: String(course.id ?? ''),
  name: String(course.name ?? ''),
  path: String(course.path ?? ''),
});

/* Handlers das linhas de matéria: a pasta sai do diálogo do sistema e a
   remoção tira a linha do DOM (o `readSettingsForm` do main lê o resto). */
export const dialogsHandlers = {
  BrowseCourse: async (event) => {
    const row = event.currentTarget?.closest?.('.cfg-course');
    if (!row) return;
    const folder = await window.desk.pickFolder();
    if (folder) row.querySelector('.cfg-path').value = folder;
  },
  RemoveCourse: (event) => {
    event.currentTarget?.closest?.('.cfg-course')?.remove();
  },
};

/* ---------- end-day-dialog (main.mjs) ---------- */

/* Filhos do `#end-day-form`: rótulos, textareas (com o valor digitado) e ações.
   O `<form>` e o listener de submit são do main — re-renderizar o miolo não
   derruba nenhum dos dois. */
export function renderEndDay(where = '', next = '') {
  const form = $('#end-day-form');
  if (!form) return;
  renderChildren(form, dialogsCore.endDayChildren(String(where), String(next)), dialogsHandlers);
}

/* Depois de salvar: o formulário volta vazio (como o `value=''` antigo). */
export function clearEndDay() {
  renderEndDay('', '');
}

/* ---------- welcome-dialog (primeira abertura) ---------- */

/* Boas-vindas da primeira abertura: o miolo (título, 4 blocos e ações) vem do
   núcleo (`core/dialogsview.bend`); o casco é o `<form id="welcome-form">` do
   index.html. O clique do "Configurar agora" (`WelcomeConfigure`) é do host. */
export function renderWelcome(win32, { handlers = {} } = {}) {
  const form = $('#welcome-form');
  if (!form) return;
  renderChildren(form, dialogsCore.welcomeChildren(!!win32), handlers);
}

/* ---------- settings-dialog (main.mjs) ---------- */

/* Título e lead: "Bem-vindo…" na primeira abertura, "Configurações" depois. */
export function renderSettingsHead(first) {
  const title = $('#settings-title');
  const lead = $('#settings-lead');
  if (title) renderInto(title, dialogsCore.settingsTitleNode(!!first));
  if (lead) renderInto(lead, dialogsCore.settingsLeadNode(!!first));
}

/* Linhas de matéria: lista vazia vira uma linha em branco (decisão do núcleo). */
export function renderCourseRows(courses) {
  const box = $('#cfg-courses');
  if (!box) return;
  const list = bendList((Array.isArray(courses) ? courses : []).map(courseFacts));
  renderChildren(box, dialogsCore.courseRows(list), dialogsHandlers);
}

/* O "+" de Adicionar matéria acrescenta uma linha em branco. */
export function appendCourseRow() {
  const box = $('#cfg-courses');
  if (!box) return;
  box.append(build(dialogsCore.courseRow(dialogsCore.emptyCourse()), dialogsHandlers));
}

/* ---------- help-dialog / about-dialog (main.mjs) ---------- */

/* `#help-version`: "Mesa de Estudos X.Y.Z" ou vazio. */
export function renderHelpVersion(version) {
  const el = $('#help-version');
  if (!el) return;
  renderInto(el, dialogsCore.helpVersionNode(String(version ?? '')));
}

/* Fatos de flag (do `desk` normalizado): esconde os itens do texto da ajuda.
   A decisão vem do núcleo (`helpChrome`); aqui só se aplica `hidden`. */
export function applyHelpFlags(flags = {}) {
  const chrome = dialogsCore.helpChrome(
    '',
    dialogsCore.helpFlags(!!flags.studyContext, !!flags.endDay, !!flags.refsToggle, flags.conferir !== false)
  );
  const hide = (selector, hidden) => {
    const el = $(selector);
    if (el) el.hidden = hidden;
  };
  hide('#help-study-li', chrome.studyHidden);
  hide('#help-endday-li', chrome.endDayHidden);
  hide('#help-refs-li', chrome.refsHidden);
  /* Conferir Xournal++: some a linha de atalho e as duas menções quando o
     win32 (ou a flag `conferir`) desliga o recurso. */
  hide('#help-check-row', chrome.conferirHidden);
  hide('#help-conferir-step', chrome.conferirHidden);
  hide('#help-conferir-li', chrome.conferirHidden);
}

/* O lead do Sobre carrega a versão; sem versão o texto estático fica. */
export function renderAboutLead(version) {
  /* O primeiro `.help-lead` do corpo é o da versão (o outro é o do link). */
  const el = $('#about-dialog .help-lead');
  const lead = dialogsCore.aboutLead(String(version ?? ''));
  if (el && lead) renderInto(el, dialogsCore.aboutLeadNode(String(version)));
}

/* ---------- about: linha de atualização + painel de componentes ---------- */

/* A linha do updater vem do núcleo (`aboutUpdateChildren`): o estado é uma
   variante de `UpdateState` (o main.mjs mapeia o IPC) e os cliques
   (CheckUpdate / OpenLink / ApplyUpdate) caem na tabela de handlers do host. */
export function renderAboutUpdate(state, handlers = {}) {
  const box = $('#about-update');
  if (!box) return;
  renderChildren(box, dialogsCore.aboutUpdateChildren(state || {$: 'UpdateIdle'}), handlers);
}

/* Fatos de uma linha de componente: o estado vira a variante de
   `ComponentState` e os opcionais (dica/link/botão) entram crus. */
const componentFacts = (row = {}) => ({
  $: 'ComponentRow',
  id: String(row.id ?? ''),
  label: String(row.label ?? ''),
  version: String(row.version ?? ''),
  state: componentStateFacts(row),
  hint: String(row.hint ?? ''),
  link: String(row.link ?? ''),
  linkLabel: String(row.linkLabel ?? ''),
  canUpdate: !!row.canUpdate,
});
function componentStateFacts(row = {}) {
  if (row.state === 'outdated') return {$: 'CompOutdated', latest: String(row.latest ?? '')};
  if (row.state === 'warn') return {$: 'CompWarn', note: String(row.note ?? '')};
  if (row.state === 'ok') return {$: 'CompOk'};
  return {$: 'CompUnknown'};
}

/* Painel "Componentes": Mesa, Pi, Node e Xournal++ (a ordem é do núcleo). */
export function renderComponentRows(rows, handlers = {}) {
  const box = $('#component-rows');
  if (!box) return;
  const list = bendList((Array.isArray(rows) ? rows : []).map(componentFacts));
  renderChildren(box, dialogsCore.componentRows(list), handlers);
}

/* ---------- pi-dialog / image-dialog (onda da Conversa) ---------- */

/* `#pi-dialog`: título/mensagem entram crus e o `inline` de quem chama resolve
   markdown/KaTeX (`markupInline` do chat); os campos vêm do núcleo. */
export function renderPiDialog({title = '', message = '', field = null} = {}, {inline = (s) => s, handlers = {}} = {}) {
  const titleEl = $('#dialog-title');
  const messageEl = $('#dialog-message');
  const box = $('#dialog-fields');
  if (titleEl) renderInto(titleEl, htmlNode(inline(dialogsCore.piTitle(String(title ?? '')))));
  if (messageEl) renderInto(messageEl, htmlNode(inline(dialogsCore.piMessage(String(message ?? '')))));
  if (box) renderChildren(box, dialogsCore.piFields(bendList(field ? [field] : [])), handlers);
}

/* `#image-dialog`: título pelo nome do arquivo, ações e o caminho no `dataset`
   (o mesmo `#image-dialog` + `#image-preview.src` do chat). Copiar/abrir
   continuam handlers de quem chama (clipboard/Preview são do host). */
export function renderImageChrome({file = '', hasFile} = {}, handlers = {}) {
  const dialog = $('#image-dialog');
  const title = $('#image-title');
  const actions = $('#image-dialog .dialog-actions');
  const path = String(file ?? '');
  if (title) renderInto(title, dialogsCore.imageTitleNode(path));
  if (actions) renderChildren(actions, dialogsCore.imageActions(hasFile ?? !!path), handlers);
  if (dialog) dialog.dataset.path = path;
}
