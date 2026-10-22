/* Painel de Estatísticas (renderer independente).

   `desk/src/study-stats.mjs` não importa o estado global nem edita o shell: o
   integrador chama `initStudyStats({state, host})` e o módulo monta o próprio
   botão e o próprio `<dialog>` acessível. Aqui o teste roda o módulo com um DOM
   mínimo de mentira e um host simulado, provando o que o painel DESENHA e o que
   ele PEDE — sem Electron e sem tocar em arquivo real.

   O que fica para a integração (main/preload): as chaves de IPC e o host de
   verdade (`statistics.cjs`), cobertos por `study-stats.test.mjs`. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src');

/* ---------- DOM mínimo ---------- */

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this._listeners = {};
    this._text = '';
    this._className = '';
    this.value = '';
    this.hidden = false;
    this.open = false;
    this.disabled = false;
  }
  get textContent() {
    if (this._text) return this._text;
    return this.children.map((kid) => kid.textContent).join('');
  }
  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }
  get className() { return this._className; }
  set className(value) { this._className = String(value); }
  get id() { return this.attributes.id || ''; }
  append(...kids) {
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      const node = typeof kid === 'string' ? new FakeNode('#text') : kid;
      if (typeof kid === 'string') node._text = kid;
      node.parentNode = this;
      this.children.push(node);
    }
  }
  prepend(...kids) { this.children.unshift(...kids); }
  replaceChildren(...kids) { this.children = []; this.append(...kids); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this._listeners[type] = (this._listeners[type] || []).filter((one) => one !== fn); }
  dispatch(type, extra = {}) {
    const event = {target: this, currentTarget: this, preventDefault() {}, ...extra};
    for (const fn of this._listeners[type] || []) fn(event);
  }
  querySelector(selector) { return find(this, selector); }
  querySelectorAll(selector) { return findAll(this, selector); }
  closest() { return this; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close'); }
  get options() { return this.children.filter((kid) => kid.tagName === 'OPTION'); }
}

function matches(node, selector) {
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}

function find(node, selector) {
  for (const kid of node.children) {
    if (matches(kid, selector)) return kid;
    const hit = find(kid, selector);
    if (hit) return hit;
  }
  return null;
}

function findAll(node, selector, out = []) {
  for (const kid of node.children) {
    if (matches(kid, selector)) out.push(kid);
    findAll(kid, selector, out);
  }
  return out;
}

function installDom() {
  const body = new FakeNode('body');
  const head = new FakeNode('head');
  const document = {
    body,
    head,
    createElement: (tag) => new FakeNode(tag),
    getElementById: (id) => find(body, `#${id}`) || find(head, `#${id}`),
  };
  globalThis.document = document;
  globalThis.window = {confirm: () => true, addEventListener() {}};
  return {body, head, document};
}

const {body} = installDom();
let version = 0;

/* Cada teste recebe uma instância própria do módulo (o painel é singleton por
   módulo): o cache-busting da URL dá um módulo novo sem API de teste dentro do
   arquivo de produção. */
async function loadPanel(options) {
  version += 1;
  const module = await import(`${pathToFileURL(join(SRC, 'study-stats.mjs')).href}?v=${version}`);
  return module.initStudyStats(options);
}

const summary = {
  period: '7',
  periodLabel: 'Últimos 7 dias',
  totals: {seconds: 5400, sessions: 2, prompts: 3},
  labels: {active: '1 h 30 min', sessions: '2', prompts: '3', input: '120', output: '30', cache: 'indisponível'},
  usage: {
    input: {available: true, count: 120},
    output: {available: true, count: 30},
    cache: {available: false, count: 0},
  },
  series: [
    {day: 20740, weekday: 'qua', minutes: 0, secondsLabel: '0 min'},
    {day: 20741, weekday: 'qui', minutes: 30, secondsLabel: '30 min'},
    {day: 20742, weekday: 'sex', minutes: 60, secondsLabel: '1 h'},
  ],
  courses: [{courseId: 'A', seconds: 5400, sessions: 2, prompts: 3, secondsLabel: '1 h 30 min'}],
  timer: {running: false, idle: false, startedAt: 0, seconds: 0, label: '0 min'},
};

function fakeHost() {
  const calls = [];
  const host = {
    calls,
    timer: {running: false, idle: false, startedAt: 0, seconds: 0, label: '0 min'},
    studyStatsSummary: async (payload) => { calls.push(['summary', payload]); return {...summary, timer: {...host.timer}}; },
    studyStatsControl: async (payload) => {
      calls.push(['control', payload]);
      if (payload.action === 'start' || payload.action === 'resume') host.timer = {running: true, idle: false, startedAt: 1000, seconds: 1800, label: '30 min'};
      else if (payload.action === 'pause') host.timer = {running: false, idle: false, startedAt: 1000, seconds: 1800, label: '30 min'};
      else host.timer = {running: false, idle: false, startedAt: 0, seconds: 0, label: '0 min'};
      return {...host.timer};
    },
    studyStatsReset: async (payload) => { calls.push(['reset', payload]); return {cleared: true}; },
  };
  return host;
}

test('o painel monta botão e diálogo acessíveis sem o shell global', async () => {
  const panel = await loadPanel({state: {currentCourseId: 'A'}, host: fakeHost()});
  assert.equal(panel.toggle.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(panel.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(body.children.includes(panel.toggle), true);
  assert.equal(body.children.includes(panel.dialog), true);
  assert.equal(panel.dialog.getAttribute('aria-labelledby'), 'study-stats-title');
  assert.ok(panel.dialog.querySelector('.study-stats-close'));
  assert.equal(typeof panel.open, 'function');
});

test('abrir o painel pede o resumo e escreve a manchete em linguagem de gente', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {currentCourseId: 'A'}, host});
  await panel.open();
  await panel.reload();
  assert.equal(panel.dialog.open, true);
  assert.equal(panel.toggle.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(host.calls[0], ['summary', {period: '7', courseId: ''}]);
  assert.equal(panel.headline.textContent, '1 h 30 min de estudo em 2 sessões');
  assert.equal(panel.support.textContent, '3 perguntas ao tutor · melhor dia: sexta, 60 min');
  assert.match(panel.usageText.textContent, /^120 tokens lidos · 30 escritos$/, 'cache indisponível some do texto');
  assert.match(panel.dialog.textContent, /Só neste computador/);
  assert.match(panel.dialog.textContent, /Uso do tutor no período/);
});

test('o período é um segmento: clicar pede o período e marca o escolhido', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {}, host});
  await panel.reload();
  const month = panel.period.buttons.find((one) => one.dataset.period === '30');
  month.dispatch('click');
  await tick();
  assert.equal(host.calls.at(-1)[1].period, '30');
  assert.equal(month.getAttribute('aria-checked'), 'true');
  assert.equal(panel.period.buttons[0].getAttribute('aria-checked'), 'false');
});

test('o gráfico tem uma barra por dia, valor acima e dia da semana abaixo', async () => {
  const panel = await loadPanel({state: {}, host: fakeHost()});
  await panel.reload();
  const bars = panel.bars.querySelectorAll('.study-stats-bar');
  assert.equal(bars.length, 3);
  assert.match(panel.bars.getAttribute('aria-label'), /3 dias, total de 90 minutos/);
  assert.deepEqual(panel.bars.querySelectorAll('.study-stats-value').map((one) => one.textContent), ['', '30', '60']);
  assert.deepEqual(panel.bars.querySelectorAll('.study-stats-day').map((one) => one.textContent), ['qua', 'qui', 'sex']);
  assert.equal(bars[0].className.includes('empty'), true, 'dia vazio é um fio de 2px');
  assert.ok(bars[2].getAttribute('style')?.includes('height:100%'), 'a barra do pico usa 100% da altura');
});

test('a tabela por matéria traz nome, tempo, sessões e perguntas', async () => {
  const panel = await loadPanel({
    state: {appConfig: {courses: [{id: 'A', name: 'Cálculo'}]}},
    host: fakeHost(),
  });
  await panel.reload();
  const text = panel.coursesTable.textContent;
  assert.match(text, /MatériaTempoSessõesPerguntas/);
  assert.match(text, /Cálculo1 h 30 min23/);
});

test('a matéria filtrada aparece no seletor e no pedido', async () => {
  const host = fakeHost();
  const panel = await loadPanel({
    state: {currentCourseId: 'A', activeCourseName: 'Cálculo', appConfig: {courses: [{id: 'A', name: 'Cálculo'}, {id: 'B', name: 'Física'}]}},
    host,
  });
  await panel.reload();
  const options = panel.course.options.map((one) => one.getAttribute('value') || '');
  assert.deepEqual(options, ['', 'A', 'B']);
  panel.course.value = 'B';
  await panel.reload();
  assert.equal(host.calls.at(-1)[1].courseId, 'B');
});

test('uma ação só no cronômetro: começa, pausa, retoma e encerra pela ação discreta', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {currentCourseId: 'A'}, host});
  await panel.open();
  assert.match(panel.sessionText.textContent, /Pausado · nada está sendo contado/);
  assert.equal(panel.timerAction.textContent, 'Retomar');
  assert.equal(panel.sessionStop.hidden, true, 'sem sessão não há o que encerrar');
  await panel.timerAction.dispatch('click');
  await settle(host);
  assert.deepEqual(host.calls.find(([kind]) => kind === 'control')[1], {action: 'start', courseId: 'A'}, 'sem sessão, Retomar começa uma');
  assert.match(panel.sessionText.textContent, /Contando agora · 30 min nesta sessão/);
  assert.equal(panel.timerAction.textContent, 'Pausar');
  assert.equal(panel.sessionStop.hidden, false);
  await panel.timerAction.dispatch('click');
  await settle(host);
  assert.equal(host.calls.filter(([kind]) => kind === 'control').at(-1)[1].action, 'pause');
  assert.equal(panel.timerAction.textContent, 'Retomar');
  await panel.timerAction.dispatch('click');
  await settle(host);
  assert.equal(host.calls.filter(([kind]) => kind === 'control').at(-1)[1].action, 'resume', 'com sessão, Retomar continua a mesma');
});

test('sem o host o painel explica o contrato em vez de quebrar', async () => {
  const panel = await loadPanel({state: {}, host: {}});
  await panel.open();
  await panel.reload();
  assert.match(panel.warning.textContent, /study-stats-summary/);
});

test('o reset exige confirmação e só então chama o host', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {}, host});
  let answer = false;
  globalThis.window.confirm = () => answer;
  await panel.reset.dispatch('click');
  await tick();
  assert.equal(host.calls.some(([kind]) => kind === 'reset'), false);
  answer = true;
  await panel.reset.dispatch('click');
  await tick();
  assert.deepEqual(host.calls.find(([kind]) => kind === 'reset')[1], {confirm: true});
});

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* Espera as chamadas assíncronas do painel assentarem (host + refresh). */
async function settle(host) {
  for (let i = 0; i < 20 && !host.calls.some(([kind]) => kind === 'control'); i += 1) await tick();
  await tick();
  await tick();
}
