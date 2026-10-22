import noticeCore from './generated/updatenotice.core.js';
import {renderChildren} from './view-host.mjs';
import {renderComponentRows} from './dialogs.mjs';
import {$, S, toast, connect} from './state.mjs';
import {text, t, LANGUAGE_EVENT} from './ui-text.mjs';

/* Avisos de atualização do Pi e do Claude Code no renderizador (#45).
   A decisão (linha, ponto, "mais nova que a testada", textos) é do núcleo
   (`core/updatenotice.bend`) e chega calculada pelo main; aqui só se liga o
   que a pessoa faz:
   - a linha no topo do Sobre ("Lembrar depois" / "Ignorar esta versão") e a
     mesma no topo das Configurações, com "Ver no Sobre" (#52: o ⚙ abre o menu
     e quem segue o ponto cai nas Configurações);
   - o ponto no ⚙ (some ao abrir o Sobre ou as Configurações com a linha à vista);
   - "Atualizar": confirmação com o comando exato → roda → saída e resultado
     em uma frase → o tutor religa. Nada roda sem o clique de confirmação. */

const Nil = {$: 'Nil'};
const bendList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);

const runs = new Map();
let lastRows = [];
let lastNotices = {lines: [], dot: false};
let handlers = {};

const rowIdOf = (event) => event.currentTarget?.closest?.('.component-row')?.dataset?.id || '';
const rowOf = (id) => lastRows.find((row) => row.id === id);

/** Contexto que o painel de componentes precisa para desenhar a ação e a saída. */
export function toolContext() {
  return {busy: !!S.busy, runs};
}

export function showRows(rows) {
  lastRows = Array.isArray(rows) ? rows : [];
  renderComponentRows(lastRows, handlers, toolContext());
}

function paintDot(dot) {
  const trigger = $('#settings-trigger');
  if (!trigger) return;
  const title = text(noticeCore.settingsTitle(!!dot));
  trigger.dataset.dot = dot ? 'true' : 'false';
  trigger.title = title;
  trigger.setAttribute('aria-label', title);
}

/** Aplica o resumo do main: linhas do Sobre + ponto do ⚙. */
export function showNotices(summary) {
  lastNotices = {
    lines: Array.isArray(summary?.lines) ? summary.lines : [],
    dot: !!summary?.dot,
  };
  paintDot(lastNotices.dot);
  const facts = lastNotices.lines.map((line) => ({
    $: 'NoticeLine',
    id: String(line.id ?? ''),
    name: String(line.name ?? ''),
    version: String(line.version ?? ''),
    ahead: !!line.ahead,
  }));
  paintLines($('#about-notices'), SURFACES.about, facts);
  paintLines($('#settings-notices'), SURFACES.settings, facts);
}

/* Onde a linha mora é regra do núcleo (`Surface`, #52); cada caixa recebe os nós da sua. */
const SURFACES = {about: {$: 'About'}, settings: {$: 'Settings'}};

function paintLines(box, surface, facts) {
  if (!box) return;
  renderChildren(box, noticeCore.noticeLinesFor(surface, bendList(facts)), handlers);
  box.hidden = facts.length === 0;
}

function setRun(id, run) {
  if (run) runs.set(id, run);
  else runs.delete(id);
  renderComponentRows(lastRows, handlers, toolContext());
}

async function answerNotice(call, id) {
  try {
    showNotices(await call(id));
  } catch (error) {
    toast(error.message);
  }
}

async function confirmRun(id) {
  const row = rowOf(id);
  if (!row) return;
  setRun(id, {$: 'RunBusy', command: row.command, output: ''});
  try {
    const result = await window.desk.toolUpdateRun(id);
    setRun(id, {$: 'RunDone', ok: !!result.ok, sentence: String(result.sentence || ''), output: String(result.output || '')});
    if (result.notices) showNotices(result.notices);
    if (result.relink) await connect().catch(() => {});
    window.dispatchEvent(new CustomEvent('desk-tool-updated', {detail: {id, ok: !!result.ok}}));
  } catch (error) {
    runs.delete(id);
    renderComponentRows(lastRows, handlers, toolContext());
    toast(error.message);
  }
}

/**
 * Abre a confirmação do "Atualizar" de uma linha do Sobre já desenhada: o
 * comando exato e o aviso, nada roda sem o clique. Também é o destino do
 * botão "Atualizar Claude Code" da coluna do tutor (#51).
 * @param {string} id `pi` ou `claude`
 * @returns {boolean} false quando a linha ainda não existe
 * @example askUpdate('claude') // a linha do Claude Code mostra "Vai rodar claude update"
 */
export function askUpdate(id) {
  const row = rowOf(id);
  if (!row) return false;
  setRun(id, {$: 'RunConfirm', command: row.command, warning: String(row.warning || '')});
  return true;
}

/** Cliques do Sobre que são desta feature (juntam-se aos do `aboutHandlers`). */
export const toolHandlers = {
  AskUpdate: (event) => askUpdate(rowIdOf(event)),
  ConfirmRun: (event) => confirmRun(rowIdOf(event)),
  CancelRun: (event) => setRun(rowIdOf(event), null),
  CloseRun: (event) => setRun(rowIdOf(event), null),
  CopyCommand: async (event) => {
    const command = event.currentTarget?.dataset?.command || '';
    try {
      await navigator.clipboard.writeText(command);
      toast(t('tools.commandCopied'));
    } catch (error) {
      toast(error.message);
    }
  },
  PostponeNotice: (event) => answerNotice(window.desk.toolNoticePostpone, event.currentTarget?.dataset?.id || ''),
  IgnoreNotice: (event) => answerNotice(window.desk.toolNoticeIgnore, event.currentTarget?.dataset?.id || ''),
};

/**
 * O Sobre ou as Configurações abriram: as linhas já conhecidas aparecem na hora
 * e, se a linha está à vista, ver apaga o ponto (regra `seesLine` do núcleo).
 * @param {'about'|'settings'} surface qual superfície abriu
 * @example await noticesOpened('settings') // o ponto do ⚙ some se havia linha
 */
export async function noticesOpened(surface = 'about') {
  showNotices(lastNotices);
  if (!noticeCore.seesLine(SURFACES[surface] || SURFACES.about, lastNotices.lines.length > 0)) return;
  try {
    showNotices(await window.desk.toolNoticesOpened());
  } catch {
    /* sem resposta do main: a superfície segue com o que já tinha */
  }
}

/** Liga os cliques e os eventos do main; chamada uma vez no arranque. */
export async function initToolNotices(aboutHandlers) {
  handlers = aboutHandlers;
  Object.assign(aboutHandlers, toolHandlers);
  window.addEventListener(LANGUAGE_EVENT, () => paintDot(lastNotices.dot));
  window.desk.onToolNotices?.((summary) => showNotices(summary));
  window.desk.onToolRunOutput?.((data) => {
    const run = runs.get(data?.id);
    if (run?.$ !== 'RunBusy') return;
    runs.set(data.id, {...run, output: String(data.output || '')});
    renderComponentRows(lastRows, handlers, toolContext());
  });
  /* Tutor começou/terminou de responder: a ação liga/desliga sem refazer a checagem. */
  window.addEventListener('desk-busy', () => {
    if ($('#about-dialog')?.open) renderComponentRows(lastRows, handlers, toolContext());
  });
  try {
    showNotices(await window.desk.toolNotices());
  } catch {
    /* sem aviso conhecido ainda: a checagem diária manda o evento */
  }
}
