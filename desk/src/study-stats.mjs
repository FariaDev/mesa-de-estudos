/* ---------------------------------------------------------------------------
   Painel de Estatísticas de estudo (aba flutuante, independente do shell).

   Tela do ticket #34: uma frase que diz o período ("3 h 20 min de estudo em 6
   sessões"), uma faixa de cronômetro com UMA ação (Pausar/Retomar), barras por
   dia, tabela por matéria e o uso do tutor em texto corrido. As frases saem de
   `study-stats-text.mjs` (catálogo `stats.*`); a duração e o dia da semana curto
   vêm do núcleo (`core/studystats.bend`); aqui só se desenha.

   O host registra a evidência (`desk/src/study-data/statistics.cjs`) e expõe o
   resumo por IPC; aqui só se desenha e se pede. Este módulo NÃO altera o
   `index.html`/`style.css` globais e NÃO importa o estado global: o integrador
   passa `initStudyStats({state: S, host: window.desk})` no `main.mjs`, e o
   módulo cria o próprio botão e o próprio `<dialog>` acessível, com estilo
   injetado no prefixo `.study-stats-*`.

   Contrato proposto para o `preload.cjs`/`main.cjs`:
     studyStatsSummary({period, courseId}) -> resumo de `statistics.summary`
     studyStatsControl({action, courseId}) -> estado do timer da sessão
     studyStatsEvent({kind})               -> ciclo de vida (freeze/suspend/show/hide)
     studyStatsReset({confirm: true})      -> reset consciente

   Sem o IPC, o painel existe e explica o contrato em vez de quebrar — a
   descoberta é o botão "Estatísticas" no canto, rotulado e acessível. Nenhuma
   telemetria sai daqui; o resumo já é local por construção. */

import statsCore from './generated/studystats.core.js';
import {t, text, formatNumber, LANGUAGE_EVENT} from './ui-text.mjs';
import * as statsText from './study-stats-text.mjs';

const PERIODS = [
  {value: '7', labelKey: 'stats.period.week'},
  {value: '30', labelKey: 'stats.period.month'},
  {value: 'all', labelKey: 'stats.period.all'},
];

/* As frases de `study-stats-text.mjs` leem o idioma atual a cada chamada. */
const deps = {t, text, formatNumber};

const STYLE_ID = 'study-stats-style';
let panel = null;

const host = () => panel?.host || window.desk || {};
const missing = () => typeof host().studyStatsSummary !== 'function';

function el(tag, attrs = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of [].concat(kids)) {
    if (kid == null || kid === false) continue;
    node.append(kid);
  }
  return node;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = el('style', {id: STYLE_ID});
  style.textContent = `
.study-stats-toggle{
 position:fixed; z-index:60; inset-block-end:18px; inset-inline-end:18px;
 padding:10px 16px; border-radius:999px; border:1px solid var(--border);
 background:var(--surface); color:var(--fg); font:600 var(--fs-sm) inherit;
 cursor:pointer;
}
.study-stats-toggle:hover{border-color:var(--accent-text); color:var(--accent-text)}
.study-stats-dialog{width:min(680px,92vw); max-width:none; max-height:calc(100vh - 32px); padding:0; overflow:hidden}
.study-stats-dialog[open]{display:flex; flex-direction:column}
.study-stats-body{display:flex; flex-direction:column; min-height:0; max-height:calc(100vh - 32px)}
.study-stats-head{display:flex; align-items:center; gap:12px; flex:none; min-height:52px; padding:0 16px 0 24px}
.study-stats-scroll{display:flex; flex-direction:column; gap:20px; flex:1 1 auto; min-height:0; overflow:auto; padding:4px 24px 20px}
.study-stats-head h2{margin:0; flex:1; font-size:15px; font-weight:600}
.study-stats-close{flex:none; width:28px; height:28px; font-size:18px; line-height:1; border:0; background:transparent; box-shadow:none}
.study-stats-controls{display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between}
.study-stats-controls select{height:30px; padding-block:0; margin:0; width:auto; max-width:220px}
.study-stats-segment{display:inline-flex; gap:2px; padding:2px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--code)}
.study-stats-segment button{height:26px; padding:0 12px; border:0; border-radius:calc(var(--r-md) - 2px); background:transparent; box-shadow:none; color:var(--muted); font-size:var(--fs-sm)}
.study-stats-segment button[aria-checked="true"]{background:var(--surface); color:var(--fg); font-weight:600; box-shadow:0 0 0 1px var(--border)}
.study-stats-hero{display:flex; flex-direction:column; gap:4px}
.study-stats-headline{margin:0; font:500 26px/1.2 var(--serif,Georgia,serif); letter-spacing:-.01em}
.study-stats-support{margin:0; font-size:var(--fs-sm); color:var(--muted)}
.study-stats-timer{display:flex; align-items:center; gap:10px; min-height:44px; padding:0 8px 0 14px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--code)}
.study-stats-dot{flex:none; width:8px; height:8px; border-radius:50%; background:var(--muted)}
.study-stats-timer[data-running="true"] .study-stats-dot{background:var(--accent-text)}
.study-stats-timer p{margin:0; flex:1 1 auto; font-size:var(--fs-sm)}
.study-stats-timer button{flex:none; height:30px}
.study-stats-end{border-color:transparent; background:transparent; box-shadow:none; color:var(--muted)}
.study-stats-end[hidden]{display:none}
.study-stats-chart{display:flex; align-items:stretch; gap:6px; height:150px}
.study-stats-col{flex:1 1 0; min-width:0; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:4px}
.study-stats-col .study-stats-bar{width:100%; max-width:44px; min-height:2px; border-radius:4px 4px 0 0; background:var(--accent-text)}
.study-stats-col .study-stats-bar.empty{background:var(--border); height:2px}
.study-stats-value,.study-stats-day{font-size:var(--fs-xs); color:var(--muted); line-height:1.2; min-height:1.2em; white-space:nowrap}
.study-stats-value{font-variant-numeric:tabular-nums}
.study-stats-courses{width:100%; border-collapse:collapse; font-size:var(--fs-sm)}
.study-stats-courses th{font-size:var(--fs-xs); font-weight:600; color:var(--muted); text-align:right; padding:0 0 6px}
.study-stats-courses td{text-align:right; padding:8px 0; border-top:1px solid var(--border); font-variant-numeric:tabular-nums}
.study-stats-courses th:first-child,.study-stats-courses td:first-child{text-align:left}
.study-stats-courses .empty td{text-align:left; color:var(--muted)}
.study-stats-usage summary{cursor:pointer; font-size:var(--fs-sm); font-weight:600}
.study-stats-usage p{margin:8px 0 0; font-size:var(--fs-sm); color:var(--muted)}
.study-stats-foot{display:flex; gap:16px; align-items:center; justify-content:space-between; flex:none; min-height:52px; padding:0 16px 0 24px; border-top:1px solid var(--border)}
.study-stats-foot p{margin:0; font-size:var(--fs-xs); color:var(--muted); line-height:1.4}
.study-stats-foot button{flex:none; height:30px}
.study-stats-reset{border-color:transparent; background:transparent; box-shadow:none; color:var(--danger,var(--muted))}
.study-stats-warn{margin:0; font-size:var(--fs-sm); color:var(--muted)}
.study-stats-warn:empty{display:none}
.study-stats-dialog button:focus-visible,.study-stats-toggle:focus-visible{outline:2px solid var(--accent-text); outline-offset:2px}
`;
  document.head.append(style);
}

function option(value, label, selected) {
  return el('option', {value, selected: !!selected, text: label});
}

function buildPanel() {
  const dialogId = 'study-stats-dialog';
  const titleId = 'study-stats-title';

  const closeButton = el('button', {
    type: 'button',
    class: 'study-stats-close icon-btn',
    'aria-label': t('stats.close.aria'),
    title: t('common.close'),
    text: '×',
  });

  /* Período: um segmento (radiogroup); `period.value` é o que se pede ao host. */
  const period = {value: PERIODS[0].value, buttons: []};
  const segment = el('div', {class: 'study-stats-segment', id: 'study-stats-period', role: 'radiogroup', 'aria-label': t('stats.period.aria')},
    PERIODS.map((one) => {
      const button = el('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(one.value === period.value),
        dataset: {period: one.value},
        text: t(one.labelKey),
      });
      period.buttons.push(button);
      return button;
    }));
  const course = el('select', {id: 'study-stats-course', 'aria-label': t('stats.course.aria')});

  const warning = el('p', {class: 'study-stats-warn'});

  const headline = el('h3', {id: 'study-stats-headline', class: 'study-stats-headline', text: statsText.headline(0, 0, deps)});
  const support = el('p', {id: 'study-stats-support', class: 'study-stats-support'});

  const timerDot = el('span', {class: 'study-stats-dot', 'aria-hidden': 'true'});
  const sessionText = el('p', {id: 'study-stats-session-text', role: 'status'});
  const timerAction = el('button', {type: 'button', id: 'study-stats-timer-action', dataset: {action: 'resume'}, text: t('stats.timer.resume')});
  const sessionStop = el('button', {type: 'button', class: 'study-stats-end', dataset: {action: 'stop'}, text: t('stats.endSession'), hidden: true});
  const timer = el('div', {class: 'study-stats-timer', 'data-running': 'false'}, [timerDot, sessionText, timerAction, sessionStop]);

  const bars = el('div', {class: 'study-stats-chart', id: 'study-stats-chart', role: 'img'});

  const coursesTable = el('table', {class: 'study-stats-courses', id: 'study-stats-courses', 'aria-label': t('stats.coursesTable.aria')});

  const usageText = el('p', {id: 'study-stats-usage-text'});
  const usage = el('details', {class: 'study-stats-usage', id: 'study-stats-usage'}, [
    el('summary', {text: t('stats.usage.title')}),
    usageText,
  ]);

  const reset = el('button', {type: 'button', class: 'study-stats-reset', text: t('stats.erase')});

  const title = el('h2', {id: titleId, text: t('stats.title')});
  const privacy = el('p', {id: 'study-stats-privacy', text: t('stats.privacy')});
  const usageTitle = usage.firstChild;

  const form = el('form', {method: 'dialog', class: 'study-stats-body', id: 'study-stats-form'}, [
    el('div', {class: 'study-stats-head'}, [
      title,
      closeButton,
    ]),
    el('div', {class: 'study-stats-scroll'}, [
      el('div', {class: 'study-stats-controls'}, [segment, course]),
      warning,
      el('div', {class: 'study-stats-hero'}, [headline, support]),
      timer,
      bars,
      coursesTable,
      usage,
    ]),
    el('div', {class: 'study-stats-foot'}, [
      privacy,
      reset,
    ]),
  ]);

  const dialog = el('dialog', {class: 'study-stats-dialog', id: dialogId, 'aria-labelledby': titleId}, [form]);
  const toggle = el('button', {
    type: 'button',
    class: 'study-stats-toggle',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-controls': dialogId,
    text: t('study.stats'),
  });

  return {toggle, dialog, closeButton, segment, title, privacy, usageTitle, period, course, warning, headline, support, timer, sessionText, timerAction, sessionStop, bars, coursesTable, usageText, usage, reset};
}

export function initStudyStats(options = {}) {
  if (panel) return panel;
  ensureStyles();
  panel = buildPanel();
  panel.state = options.state || {};
  panel.lastSummary = null;
  panel.host = options.host || null;
  panel.lastTimer = {running: false, idle: false, startedAt: 0};
  document.body.append(panel.toggle, panel.dialog);

  const open = () => {
    if (!panel.dialog.open) panel.dialog.showModal();
    panel.toggle.setAttribute('aria-expanded', 'true');
    return refresh();
  };
  const close = () => {
    if (panel.dialog.open) panel.dialog.close();
    panel.toggle.setAttribute('aria-expanded', 'false');
  };
  panel.toggle.addEventListener('click', () => (panel.dialog.open ? close() : open()));
  panel.dialog.addEventListener('close', () => panel.toggle.setAttribute('aria-expanded', 'false'));
  panel.dialog.querySelector('.study-stats-close').addEventListener('click', (event) => {
    event.preventDefault();
    close();
  });
  for (const button of panel.period.buttons) {
    button.addEventListener('click', () => {
      setPeriod(button.dataset.period);
      refresh();
    });
  }
  panel.course.addEventListener('change', () => refresh());
  panel.timerAction.addEventListener('click', () => {
    const last = panel.lastTimer;
    control(statsCore.timerVerb(!!last.running, Number(last.startedAt) > 0));
  });
  panel.sessionStop.addEventListener('click', () => control('stop'));
  panel.reset.addEventListener('click', reset);
  panel.dialog.addEventListener('click', (event) => {
    /* Clique no backdrop (fora do formulário) fecha; o botão Fechar já cuida do resto. */
    if (event.target === panel.dialog) close();
  });
  window.addEventListener(LANGUAGE_EVENT, relabel);
  panel.open = open;
  panel.close = close;
  panel.reload = refresh;
  panel.setPeriod = setPeriod;
  return panel;
}

function setPeriod(value) {
  panel.period.value = value;
  for (const button of panel.period.buttons) {
    button.setAttribute('aria-checked', String(button.dataset.period === value));
  }
}

export function openStudyStats() {
  initStudyStats().open();
}

export function closeStudyStats() {
  if (panel) panel.close();
}

function fillCourses(select, courses, current) {
  select.replaceChildren(option('', t('common.allCourses'), !current));
  for (const course of courses) {
    select.append(option(String(course.id || ''), String(course.name || course.id || ''), current === course.id));
  }
}

function courseOptions() {
  const state = panel?.state || {};
  const courses = Array.isArray(state.appConfig?.courses) ? state.appConfig.courses : [];
  const list = courses.map((one) => ({id: one.id, name: one.name || one.id})).filter((one) => one.id);
  if (state.currentCourseId && !list.some((one) => one.id === state.currentCourseId)) {
    list.push({id: state.currentCourseId, name: state.activeCourseName || state.currentCourseId});
  }
  return list;
}

async function refresh() {
  if (!panel) return;
  if (missing()) {
    panel.warning.textContent = t('stats.warn.notConnected');
    return;
  }
  panel.warning.textContent = '';
  fillCourses(panel.course, courseOptions(), panel.course.value || '');
  try {
    const summary = await host().studyStatsSummary({
      period: panel.period.value || '7',
      courseId: panel.course.value || '',
    });
    render(summary || {});
  } catch (error) {
    panel.warning.textContent = t('stats.error.read', {reason: text(error.message)});
  }
}

/* O dia mais cheio: o nome por extenso vem do núcleo, a partir do dia civil. */
function bestDay(series) {
  let best = null;
  for (const day of series) {
    const minutes = Number(day.minutes) || 0;
    if (minutes > 0 && (!best || minutes > best.minutes)) best = {minutes, day: Number(day.day) || 0};
  }
  if (!best) return {label: '', minutes: 0};
  const index = new Date(best.day * 86400000).getUTCDay();
  return {label: statsText.weekdayName(index, deps), minutes: best.minutes};
}

function render(summary) {
  const totals = summary.totals || {};
  const usage = summary.usage || {};
  const series = summary.series || [];
  const best = bestDay(series);
  panel.headline.textContent = statsText.headline(Number(totals.seconds) || 0, Number(totals.sessions) || 0, deps, !!summary.timer?.held);
  panel.support.textContent = statsText.supportLine(Number(totals.prompts) || 0, best.label, best.minutes, deps);
  renderChart(series);
  renderCourses(summary.courses || []);
  renderUsage(usage);
  renderTimer(summary.timer || {});
  panel.lastSummary = summary;
}

/* Troca de idioma com o painel já montado: reescreve o que o painel desenhou à mão. */
function relabel() {
  if (!panel) return;
  panel.toggle.textContent = t('study.stats');
  panel.title.textContent = t('stats.title');
  panel.closeButton.setAttribute('aria-label', t('stats.close.aria'));
  panel.closeButton.setAttribute('title', t('common.close'));
  panel.segment.setAttribute('aria-label', t('stats.period.aria'));
  PERIODS.forEach((one, index) => { panel.period.buttons[index].textContent = t(one.labelKey); });
  panel.course.setAttribute('aria-label', t('stats.course.aria'));
  panel.coursesTable.setAttribute('aria-label', t('stats.coursesTable.aria'));
  panel.usageTitle.textContent = t('stats.usage.title');
  panel.sessionStop.textContent = t('stats.endSession');
  panel.reset.textContent = t('stats.erase');
  panel.privacy.textContent = t('stats.privacy');
  fillCourses(panel.course, courseOptions(), panel.course.value || '');
  render(panel.lastSummary || {});
}

function renderUsage(usage) {
  panel.usageText.textContent = statsText.usageLine(usage, deps);
}

function renderChart(series) {
  const max = series.reduce((peak, day) => Math.max(peak, Number(day.minutes) || 0), 0);
  panel.bars.replaceChildren();
  const labelStep = series.length > 14 ? Math.ceil(series.length / 7) : 1;
  const showAllValues = series.length <= 14;
  for (let index = 0; index < series.length; index += 1) {
    const day = series[index];
    const minutes = Number(day.minutes) || 0;
    const peak = max > 0 && minutes === max;
    const height = max > 0 && minutes > 0 ? Math.max(4, Math.round((minutes / max) * 100)) : 0;
    const bar = el('div', {
      class: `study-stats-bar${minutes > 0 ? '' : ' empty'}`,
      style: minutes > 0 ? `height:${height}%` : null,
      title: t('stats.chart.title', {weekday: text(String(day.weekday || '')), duration: text(String(day.secondsLabel || ''))}),
    });
    const value = el('span', {class: 'study-stats-value', text: minutes > 0 && (showAllValues || peak) ? `${minutes}` : ''});
    const label = el('span', {class: 'study-stats-day', text: index % labelStep === 0 ? text(String(day.weekday || '')) : ''});
    panel.bars.append(el('div', {class: 'study-stats-col'}, [value, bar, label]));
  }
  const total = series.reduce((sum, day) => sum + (Number(day.minutes) || 0), 0);
  const chartArgs = {days: series.length, total, peak: max};
  panel.bars.setAttribute('aria-label', t(max > 0 ? 'stats.chart.ariaPeak' : 'stats.chart.aria', chartArgs));
}

function courseName(id) {
  const found = courseOptions().find((one) => one.id === id);
  return found?.name || String(id || t('stats.noCourse'));
}

function renderCourses(courses) {
  const head = el('thead', {}, [el('tr', {}, [
    el('th', {scope: 'col', text: t('stats.table.course')}),
    el('th', {scope: 'col', text: t('stats.table.time')}),
    el('th', {scope: 'col', text: t('stats.table.sessions')}),
    el('th', {scope: 'col', text: t('stats.table.prompts')}),
  ])]);
  const rows = courses.length
    ? courses.map((course) => el('tr', {}, [
      el('td', {text: courseName(course.courseId)}),
      el('td', {text: text(String(course.secondsLabel || ''))}),
      el('td', {text: String(course.sessions || 0)}),
      el('td', {text: String(course.prompts || 0)}),
    ]))
    : [el('tr', {class: 'empty'}, [el('td', {colspan: '4', text: t('stats.table.empty')})])];
  panel.coursesTable.replaceChildren(head, el('tbody', {}, rows));
}

function renderTimer(timer) {
  const running = !!timer.running;
  const hasSession = Number(timer.startedAt) > 0;
  panel.lastTimer = {running, idle: !!timer.idle, startedAt: Number(timer.startedAt) || 0};
  panel.timer.setAttribute('data-running', String(running));
  panel.sessionText.textContent = statsText.timerLine(running, String(timer.label || statsCore.durationLabel(0)), deps);
  panel.timerAction.textContent = t(running ? 'stats.timer.pause' : 'stats.timer.resume');
  panel.timerAction.dataset.action = statsCore.timerVerb(running, hasSession);
  panel.sessionStop.hidden = !hasSession;
}

async function control(action) {
  if (missing() || typeof host().studyStatsControl !== 'function') return;
  try {
    const timer = await host().studyStatsControl({action, courseId: panel?.state?.currentCourseId || ''});
    renderTimer(timer || {});
    refresh();
  } catch (error) {
    panel.warning.textContent = t('stats.error.session', {reason: text(error.message)});
  }
}

async function reset() {
  if (missing() || typeof host().studyStatsReset !== 'function') return;
  const ok = window.confirm(t('stats.eraseConfirm'));
  if (!ok) return;
  try {
    await host().studyStatsReset({confirm: true});
    refresh();
  } catch (error) {
    panel.warning.textContent = t('stats.error.erase', {reason: text(error.message)});
  }
}
