import {$, S, connect, toast} from './state.mjs';
import {t, text, LANGUAGE_EVENT} from './ui-text.mjs';
import {newSession} from './course-conversations.mjs';

/* Modelos grátis do OpenCode Zen (#44; motor OpenCode na #57), do lado da janela. A decisão
   (o que vale como chave, a frase de cada resultado, o padrão recomendado) é do
   núcleo `core/freemodels.bend`; o cofre, a área de transferência, a rede e o
   arquivo do OpenCode são do host (`opencode-host.cjs`). Aqui ficam o diálogo
   do fluxo curto, o bloco das Configurações e o aviso de modelo pago.

   A chave nunca volta do host: a janela só vê a máscara (`sk-••••abcd`). */

const DIALOG = '#free-models-dialog';
const STEP_TITLE = {card: 'freeModels.card.title', key: 'freeModels.key.title', paid: 'freeModels.paid.title', done: 'freeModels.card.title'};

let step = 'card';
let working = false;
let declinedMask = '';
let resolvePaid = null;

const dialog = () => $(DIALOG);

function say(sentence, target = '#free-models-status') {
  const line = $(target);
  if (!line) return;
  line.textContent = sentence;
  line.hidden = sentence === '';
}

function showStep(next) {
  step = next;
  const root = dialog();
  for (const section of root.querySelectorAll('[data-step]')) section.hidden = section.dataset.step !== next;
  for (const control of root.querySelectorAll('[data-show]')) control.hidden = !control.dataset.show.split(' ').includes(next);
  const title = $('#free-models-title');
  title.dataset.i18n = STEP_TITLE[next];
  title.textContent = t(STEP_TITLE[next]);
}

function setWorking(on) {
  working = on;
  for (const control of dialog().querySelectorAll('button, input')) control.disabled = on;
}

/* ---------- depois de uma chave aprovada ---------- */

/**
 * A frase final depois de uma chave aprovada. Os grátis não saem pelo Pi (o
 * OpenCode só libera o plano grátis no próprio cliente: 403 `FreeTierError`),
 * então a chave leva a uma sessão OpenCode (#57): o botão do passo final a
 * começa. Numa sessão OpenCode aberta, o servidor da Mesa sobe de novo com a
 * chave nova no próximo envio; a coluna religa já.
 * `await startWithKey({ok: true, relink: {relinked: true}})` → `'A chave foi guardada…'`
 * @param {{relink?: {relinked?: boolean, busy?: boolean}}} result resposta do host a uma chave aprovada
 */
export async function startWithKey(result) {
  if (result.relink?.relinked) S.connected = false;
  if (result.relink?.relinked && S.engine === 'opencode') connect().catch(() => {});
  return t('freeModels.done.openCode');
}

/* O botão do passo final: fecha o diálogo, abre uma sessão OpenCode nova e chama o tutor. */
async function startOpenCodeSession() {
  dialog().close();
  await newSession('opencode');
  if (S.engine === 'opencode') await connect();
}

async function conclude(result) {
  if (!result.ok) { say(text(result.message)); return; }
  say(t('freeModels.key.starting'));
  setWorking(true);
  try {
    const sentence = await startWithKey(result);
    setWorking(false);
    showStep('done');
    say('');
    $('#free-models-done').textContent = sentence;
    $('#free-models-start').focus();
  } finally {
    if (working) setWorking(false);
    paintFreeSettings().catch(() => {});
  }
}

async function attempt(run) {
  setWorking(true);
  say(t('freeModels.key.testing'));
  let result;
  try { result = await run(); } catch (error) { setWorking(false); say(error.message); return; }
  setWorking(false);
  await conclude(result);
}

/* ---------- o fluxo curto ---------- */

function paintAuthFile(authFile) {
  const link = $('#free-models-authfile');
  const note = $('#free-models-authnote');
  link.hidden = !authFile.exists;
  note.hidden = !authFile.exists;
  note.textContent = authFile.exists ? t('freeModels.card.authFileNote', {file: authFile.display}) : '';
}

/** Abre o cartão de aviso (passo 1): conta, cartão, cobrança e onde a chave fica. */
export async function openFreeModelsFlow() {
  const info = await window.desk.opencodeStatus();
  paintAuthFile(info.authFile);
  declinedMask = '';
  showStep('card');
  say('');
  if (!dialog().open) dialog().showModal();
}

async function openSite() {
  await window.desk.opencodeOpenConsole();
  showStep('key');
  $('#free-models-key').focus();
}

/* O Mesa recebeu o foco de volta: é aqui, e só aqui, que a área de transferência é lida. */
async function peekClipboard() {
  if (!dialog()?.open || step !== 'key' || working) return;
  const found = await window.desk.opencodeClipboardPeek();
  const panel = $('#free-models-clip');
  const offer = found.found && found.masked !== declinedMask;
  panel.hidden = !offer;
  if (offer) { $('#free-models-masked').textContent = found.masked; $('#free-models-clip-yes').focus(); }
}

async function declineClipboard() {
  declinedMask = $('#free-models-masked').textContent;
  $('#free-models-clip').hidden = true;
  await window.desk.opencodeClipboardForget();
}

function wireFlow() {
  $('#free-models-open-site').onclick = () => openSite().catch((error) => say(error.message));
  $('#free-models-have-key').onclick = () => { showStep('key'); $('#free-models-key').focus(); };
  $('#free-models-authfile').onclick = () => attempt(() => window.desk.opencodeAuthFileUse());
  $('#free-models-clip-yes').onclick = () => attempt(() => window.desk.opencodeClipboardAccept());
  $('#free-models-clip-no').onclick = () => declineClipboard().catch(() => {});
  $('#free-models-start').onclick = () => startOpenCodeSession().catch((error) => toast(error.message));
  $('#free-models-key-use').onclick = () => attempt(() => window.desk.opencodeKeySave($('#free-models-key').value));
  $('#free-models-key').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    $('#free-models-key-use').click();
  });
  window.addEventListener('focus', () => peekClipboard().catch(() => {}));
  dialog().addEventListener('close', onDialogClose);
}

function onDialogClose() {
  $('#free-models-key').value = '';
  window.desk.opencodeClipboardForget().catch(() => {});
  if (resolvePaid) { resolvePaid(false); resolvePaid = null; }
}

/* ---------- modelo pago: pergunta uma vez ---------- */

/**
 * Pergunta "Este modelo cobra por uso" na primeira escolha de um modelo pago do Zen.
 * `await confirmPaidModel()` → `true` se a pessoa aceitou (agora ou antes), `false` se voltou.
 */
export async function confirmPaidModel() {
  const info = await window.desk.opencodeStatus();
  if (info.paidConfirmed) return true;
  showStep('paid');
  say('');
  return new Promise((resolve) => {
    resolvePaid = resolve;
    $('#free-models-paid-yes').onclick = async () => {
      await window.desk.opencodePaidAck();
      resolvePaid = null;
      resolve(true);
      dialog().close();
    };
    dialog().showModal();
  });
}

/* ---------- Configurações → Pastas e programas ---------- */

/** Repinta o bloco "Modelos gratuitos (OpenCode Zen)" com o que o host sabe agora. */
export async function paintFreeSettings() {
  const info = await window.desk.opencodeStatus();
  const field = $('#cfg-opencode-key');
  if (!field) return;
  /* Guardada: a máscara (sk-••••abcd) à vista num campo só de leitura; sem chave, campo de senha para colar. */
  field.type = info.saved ? 'text' : 'password';
  field.readOnly = info.saved;
  field.value = info.saved ? info.masked : '';
  field.placeholder = info.saved ? '' : t('freeModels.settings.paste');
  $('#cfg-opencode-test').hidden = !info.saved;
  $('#cfg-opencode-remove').hidden = !info.saved;
  $('#cfg-opencode-save').hidden = info.saved;
  $('#cfg-opencode-usefile').hidden = info.saved || !info.authFile.exists;
  $('#cfg-opencode-usefile-note').hidden = info.saved || !info.authFile.exists;
  $('#cfg-opencode-usefile-note').textContent = t('freeModels.card.authFileNote', {file: info.authFile.display});
  if (!info.secure) say(t('freeModels.settings.noVault'), '#cfg-opencode-status');
}

async function settingsAttempt(run) {
  say(t('freeModels.key.testing'), '#cfg-opencode-status');
  const result = await run();
  if (!result.ok) { say(text(result.message), '#cfg-opencode-status'); return; }
  say(await startWithKey(result), '#cfg-opencode-status');
  await paintFreeSettings();
}

function wireSettings() {
  const status = (sentence) => say(sentence, '#cfg-opencode-status');
  const fail = (error) => status(error.message);
  $('#cfg-opencode-save').onclick = () => settingsAttempt(() => window.desk.opencodeKeySave($('#cfg-opencode-key').value)).catch(fail);
  $('#cfg-opencode-usefile').onclick = () => settingsAttempt(() => window.desk.opencodeAuthFileUse()).catch(fail);
  $('#cfg-opencode-test').onclick = () => {
    status(t('freeModels.key.testing'));
    window.desk.opencodeKeyTest().then((result) => status(text(result.message))).catch(fail);
  };
  $('#cfg-opencode-create').onclick = () => window.desk.opencodeOpenConsole().catch(fail);
  $('#cfg-opencode-remove').onclick = async () => {
    try {
      const result = await window.desk.opencodeKeyRemove();
      if (result.relink?.relinked) { S.connected = false; connect().catch(() => {}); }
      status(t('freeModels.settings.removed'));
      await paintFreeSettings();
    } catch (error) { fail(error); }
  };
  /* Enter no campo guarda a chave; sem isto o Enter salvaria as Configurações inteiras. */
  $('#cfg-opencode-key').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!$('#cfg-opencode-save').hidden) $('#cfg-opencode-save').click();
  });
}

/** Liga os botões do diálogo, das Configurações e o pedido do botão da primeira abertura. */
export function initFreeModels() {
  wireFlow();
  wireSettings();
  window.addEventListener('desk-open-free-models', () => openFreeModelsFlow().catch((error) => toast(error.message)));
  /* O texto dos blocos pintados uma vez (nota da chave do OpenCode) troca de idioma junto com a tela (#41). */
  window.addEventListener(LANGUAGE_EVENT, () => paintFreeSettings().catch((error) => console.warn('modelos grátis: repintura sem efeito:', error?.message || error)));
}
