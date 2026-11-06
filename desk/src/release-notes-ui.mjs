// @ts-check
import {S, connect, save, toast} from './state.mjs';
import {t} from './ui-text.mjs';
import {providerIcon} from './provider-icons.mjs';
import {icon} from '../icons.mjs';
import {RELEASE_NOTES, loadReleaseNotesSeen, pendingReleaseNotes, releaseNotesSeen} from './release-notes.mjs';

/* Janela de novidades. Abre sozinha uma vez depois de atualizar e, a qualquer
   momento, pelo menu ⚙. A versão 1.1.0 é a mudança do Pi para o OpenCode: quem
   já tem matéria não passa pela primeira abertura, então instalar e entrar na
   conta precisam morar aqui. Os comandos de login foram conferidos no 2.2.4. */

/* O Go vem primeiro por decisão do Lucas: é o caminho mais simples para quem não
   tem assinatura de modelo. Preço e modelos conferidos em opencode.ai/docs/go. */
const GO_SIGNUP_URL = 'https://opencode.ai/console';
const PLANS = Object.freeze([
  {id: 'go', provider: 'opencode-go', name: 'releaseNotes.login.go', hint: 'releaseNotes.login.goHint', commands: ['{binary} auth login opencode-go'], badge: 'releaseNotes.login.goBadge', signup: GO_SIGNUP_URL},
  {id: 'chatgpt', provider: 'openai', name: 'releaseNotes.login.chatgpt', hint: 'releaseNotes.login.chatgptHint', commands: ['{binary} auth login openai']},
  {id: 'claude', provider: 'anthropic', name: 'releaseNotes.login.claude', hint: 'releaseNotes.login.claudeHint', commands: ['claude auth login', '{binary} auth login claude-agent']},
  {id: 'grok', provider: 'xai', name: 'releaseNotes.login.grok', hint: 'releaseNotes.login.grokHint', commands: ['{binary} auth login xai']},
  {id: 'others', icon: 'plug', name: 'releaseNotes.login.others', hint: 'releaseNotes.login.othersHint', commands: ['{binary} auth login']},
]);

/* A pintura da primeira abertura fica fora da partida de quem já tem matéria
   (#desempenho): só entra quando a janela vai abrir. */
/** @type {typeof import('./setup-view.mjs')} */
let setupView;

let facts = {binary: '', oldVersion: '', platform: '', supported: false};
let install = {state: 'idle', phase: '', percent: -1, errorCode: '', version: ''};
let installedHere = false;
let progressWired = false;

/**
 * Elemento com classe e texto.
 * @param {string} tag @param {string} className @param {string} [content]
 * @returns {HTMLElement}
 */
function make(tag, className, content = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.textContent = content;
  return element;
}

/** @returns {string} O caminho do OpenCode para o comando, mesmo antes de instalar. */
function commandBinary() {
  const fallback = facts.platform === 'win32' ? '%USERPROFILE%\\.opencode\\bin\\opencode.exe' : '~/.opencode/bin/opencode';
  return setupView.loginBinary(facts.binary, facts.platform) || fallback;
}

/** Fila com o comando e o botão de copiar. @param {string} command @returns {HTMLElement} */
function commandRow(command) {
  const row = make('div', 'release-command');
  row.append(make('code', '', command));
  const copy = /** @type {HTMLButtonElement} */ (make('button', 'release-copy'));
  copy.type = 'button';
  copy.innerHTML = icon('copy');
  copy.title = t('releaseNotes.copy');
  copy.setAttribute('aria-label', t('releaseNotes.copyCommand', {command}));
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(command);
      copy.innerHTML = icon('check');
      setTimeout(() => { copy.innerHTML = icon('copy'); }, 1400);
    } catch (error) { toast(String(/** @type {Error} */ (error).message)); }
  };
  row.append(copy);
  return row;
}

/** Título do provedor, com o selo e o link de assinar quando há. @param {typeof PLANS[number]} plan @returns {HTMLElement} */
function loginHead(plan) {
  const head = make('div', 'release-login-head');
  head.append(make('strong', '', t(plan.name)));
  if (plan.badge) head.append(make('span', 'release-badge', t(plan.badge)));
  if (!plan.signup) return head;
  const signup = /** @type {HTMLButtonElement} */ (make('button', 'release-signup', t('releaseNotes.login.goSignup')));
  signup.type = 'button';
  signup.onclick = () => { window.desk.openExternal?.(plan.signup)?.catch?.(() => {}); };
  head.append(signup);
  return head;
}

/** O login de um provedor. @param {typeof PLANS[number]} plan @returns {HTMLElement} */
function loginRow(plan) {
  const row = make('div', 'release-login');
  row.dataset.login = plan.id;
  const mark = make('span', 'release-login-mark');
  mark.innerHTML = plan.icon ? icon(plan.icon) : providerIcon(plan.provider, t(plan.name));
  const body = make('div', 'release-login-body');
  body.append(loginHead(plan), make('p', '', t(plan.hint)));
  for (const command of plan.commands) body.append(commandRow(command.replace('{binary}', commandBinary())));
  row.append(mark, body);
  return row;
}

/** Estado do passo de instalar. @param {HTMLElement} box @returns {void} */
function paintInstall(box) {
  box.replaceChildren();
  if (install.state === 'installing') {
    box.append(make('p', 'release-install-status', setupView.installPhaseText(install.phase)));
    const bar = make('progress', 'release-install-bar');
    if (install.percent >= 0) /** @type {HTMLProgressElement} */ (bar).value = install.percent / 100;
    box.append(bar);
    return;
  }
  if (facts.binary && !facts.oldVersion) {
    box.append(make('p', 'release-install-ok', install.state === 'done' ? t('firstrun.install.done', {version: install.version}) : t('releaseNotes.install.found')));
    return;
  }
  if (install.state === 'error') {
    const copy = setupView.installErrorText(install.errorCode);
    box.append(make('p', 'release-install-error', `${copy.title}. ${copy.body}`));
  }
  if (!facts.supported && !facts.oldVersion) {
    box.append(make('p', 'release-install-status', t('firstrun.install.unsupported')));
    return;
  }
  const label = install.state === 'error' ? 'firstrun.install.retry' : facts.oldVersion ? 'firstrun.install.update' : 'firstrun.install.button';
  const button = /** @type {HTMLButtonElement} */ (make('button', 'primary', t(label)));
  button.type = 'button';
  button.id = 'release-install';
  button.onclick = () => { askInstall(box); };
  box.append(button);
}

/** Atualizar por cima pede confirmação, como na primeira abertura. @param {HTMLElement} box @returns {void} */
function askInstall(box) {
  if (facts.oldVersion && !window.confirm(t('firstrun.tutor.opencodeOldConfirm', {version: facts.oldVersion}))) return;
  runInstall(box);
}

/** Roda o instalador da Mesa e relê a detecção. @param {HTMLElement} box @returns {Promise<void>} */
async function runInstall(box) {
  if (install.state === 'installing') return;
  install = {state: 'installing', phase: 'prepare', percent: -1, errorCode: '', version: ''};
  wireProgress(box);
  paintInstall(box);
  try {
    const result = await window.desk.openCodeInstall();
    if (!result?.ok) throw Object.assign(Error('install'), {code: String(result?.code || 'failed')});
    const data = await window.desk.getConfig();
    const binary = String(data?.detectedOpenCode || result.detected?.detectedOpenCode || result.binary || '');
    facts = {...facts, binary, oldVersion: String(data?.detectedOpenCodeOldVersion || '')};
    S.detected = {...(S.detected || {}), opencode: binary};
    install = {state: 'done', phase: 'done', percent: 100, errorCode: '', version: String(result.version || '')};
    installedHere = true;
    window.dispatchEvent(new Event('desk-engine-facts'));
    refreshCommands(box);
  } catch (error) {
    install = {state: 'error', phase: '', percent: -1, errorCode: String(/** @type {{code?: string}} */ (error)?.code || 'failed'), version: ''};
  }
  paintInstall(box);
}

/** @param {HTMLElement} box @returns {void} */
function wireProgress(box) {
  if (progressWired) return;
  progressWired = true;
  window.desk.onOpenCodeInstallProgress?.((payload) => {
    if (install.state !== 'installing') return;
    const percent = Number(payload?.percent);
    /* O percentual só existe no download e nunca volta; as outras fases ficam sem número. */
    const shown = Number.isFinite(percent) ? Math.max(install.percent, Math.min(100, percent)) : -1;
    install = {...install, phase: String(payload?.phase || install.phase), percent: shown};
    paintInstall(document.querySelector('#release-install-box') || box);
  });
}

/** Depois de instalar, os comandos usam o caminho real. @param {HTMLElement} box @returns {void} */
function refreshCommands(box) {
  const list = box.closest('dialog')?.querySelector('.release-logins');
  list?.replaceChildren(...PLANS.map(loginRow));
}

/** O bloco "o que você precisa fazer". @returns {HTMLElement} */
function setupBlock() {
  const block = make('section', 'release-section release-todo');
  block.append(make('h3', '', t('releaseNotes.todo.title')));
  const steps = make('ol', 'release-steps');
  const installStep = make('li', '');
  const box = make('div', 'release-install');
  box.id = 'release-install-box';
  installStep.append(make('strong', '', t('releaseNotes.todo.install')), make('p', '', t('releaseNotes.todo.installHint')), box);
  const loginStep = make('li', '');
  const logins = make('div', 'release-logins');
  logins.append(...PLANS.map(loginRow));
  loginStep.append(make('strong', '', t('releaseNotes.todo.login')), make('p', '', t('releaseNotes.todo.loginHint')), logins, make('p', 'release-login-foot', t('releaseNotes.todo.loginFoot')));
  steps.append(installStep, loginStep);
  block.append(steps);
  paintInstall(box);
  return block;
}

/** Um grupo de cartões curtos. @param {import('./release-notes.mjs').ReleaseGroup} group @returns {HTMLElement} */
function groupBlock(group) {
  const part = make('section', 'release-section');
  const cards = make('div', 'release-cards');
  for (const card of group.cards) {
    const item = make('div', 'release-card');
    const mark = make('span', 'release-card-mark');
    mark.innerHTML = icon(card.icon);
    item.append(mark, make('strong', '', t(card.title)), make('p', '', t(card.body)));
    cards.append(item);
  }
  part.append(make('h3', '', t(group.title)), cards);
  return part;
}

/** Uma versão da janela. @param {import('./release-notes.mjs').ReleaseNote} note @returns {HTMLElement} */
function noteBlock(note) {
  const block = make('article', 'release-note');
  block.dataset.version = note.version;
  block.append(make('h2', '', t(note.title)), make('p', 'help-lead', t(note.lead)));
  if (note.opencodeSetup) block.append(setupBlock());
  for (const group of note.groups) block.append(groupBlock(group));
  return block;
}

/** Fechou depois de instalar aqui: o tutor tenta de novo, sem a pessoa ir atrás. @returns {void} */
function reconnectIfInstalled() {
  if (!installedHere) return;
  installedHere = false;
  connect().catch(() => {});
}

/** @param {import('./release-notes.mjs').ReleaseNote[]} notes @returns {void} */
function openReleaseDialog(notes) {
  document.querySelector('#release-notes-dialog')?.remove();
  const dialog = /** @type {HTMLDialogElement} */ (document.createElement('dialog'));
  dialog.id = 'release-notes-dialog';
  /* B4 (auditoria rodada 8): cabeçalho com o × dos outros diálogos
     (`icon-btn dialog-close`, como em `conversation-library.mjs`); o
     "Entendi" do rodapé continua e o Esc segue fechando. */
  const head = make('div', 'help-head');
  const heading = make('h2', '', t('menu.releaseNotes'));
  heading.id = 'release-notes-title';
  const dismiss = /** @type {HTMLButtonElement} */ (make('button', 'icon-btn dialog-close', '×'));
  dismiss.type = 'button';
  dismiss.id = 'release-dismiss';
  dismiss.title = t('common.close');
  dismiss.setAttribute('aria-label', t('common.close'));
  dismiss.onclick = () => dialog.close();
  dialog.setAttribute('aria-labelledby', 'release-notes-title');
  head.append(heading, dismiss);
  const body = make('div', 'release-body');
  body.append(...notes.map(noteBlock));
  const actions = make('div', 'dialog-actions');
  const close = /** @type {HTMLButtonElement} */ (make('button', 'primary', t('releaseNotes.close')));
  close.type = 'button';
  close.id = 'release-close';
  close.onclick = () => dialog.close();
  actions.append(close);
  dialog.append(head, body, actions);
  dialog.addEventListener('close', () => { dialog.remove(); reconnectIfInstalled(); });
  document.body.append(dialog);
  dialog.showModal();
  /* Foco num botão, e não na área rolável: o contorno dela apareceria cortado no rodapé. */
  /** @type {HTMLElement} */ (dialog.querySelector('#release-install') || close).focus({preventScroll: true});
  body.scrollTop = 0;
}

/**
 * Lê os fatos do host (já vêm no `init`) antes de pintar.
 * @param {{detectedOpenCode?: unknown, detectedOpenCodeOldVersion?: unknown, platform?: unknown}|null|undefined} data
 * @returns {Promise<void>}
 */
async function loadFacts(data) {
  setupView = await import('./setup-view.mjs');
  let supported = false;
  try { supported = !!(await window.desk.openCodeInstallSupported?.()); } catch { /* a janela só não oferece o botão */ }
  facts = {binary: String(data?.detectedOpenCode || ''), oldVersion: String(data?.detectedOpenCodeOldVersion || ''), platform: String(data?.platform || ''), supported};
}

/**
 * Na partida: abre as novidades pendentes e guarda a versão vista. Marca ao abrir,
 * e não ao fechar, para fechar o app com a janela aberta não repetir o aviso sem fim.
 * @param {{releaseVersion?: unknown, detectedOpenCode?: unknown, detectedOpenCodeOldVersion?: unknown, platform?: unknown}} data
 * @param {{firstRun?: boolean}} [options]
 * @returns {Promise<void>}
 * @example await showPendingReleaseNotes(data, {firstRun: isFirstRun()});
 */
export async function showPendingReleaseNotes(data, {firstRun = false} = {}) {
  const pending = pendingReleaseNotes({seen: releaseNotesSeen(), current: data?.releaseVersion, firstRun});
  if (pending.seen === null) return;
  loadReleaseNotesSeen(pending.seen);
  save(true);
  if (!pending.notes.length) return;
  await loadFacts(data);
  openReleaseDialog([...pending.notes].reverse());
}

/**
 * Pelo menu ⚙ e pela paleta: a nota mais recente, em qualquer versão.
 * @returns {Promise<void>}
 * @example await openReleaseNotes();
 */
export async function openReleaseNotes() {
  await loadFacts(await window.desk.getConfig());
  openReleaseDialog([RELEASE_NOTES[0]]);
}
