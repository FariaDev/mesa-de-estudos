// @ts-check
'use strict';
const {message: uiMsg} = require('./src/i18n.mjs');

/* Host do Conferir (ticket #35): lista as janelas abertas, entrega os FATOS ao
   núcleo (`core/conferir.bend`) e captura a janela que ele apontou. A decisão —
   qual janela, app ausente, várias janelas, a Mesa e o sistema fora — é do
   núcleo; aqui ficam o mundo (helper do macOS, PowerShell do Windows,
   `screencapture`, permissão de tela) e a escolha salva em `desk.json`.

   Canais:
   - `capture-ready`    → {title, dataUrl, app} | {absent, app, saved, message}
   - `capture-windows`  → {windows:[fatos], choice, canGoBack}
   - `capture-choose`   → {id} captura a janela escolhida e guarda o APP dela
   - `capture-default`  → volta ao Xournal++ (esquece a escolha)

   O que fica salvo é o app (`{app, key}`: nome para mostrar e nome em
   minúsculas), nunca o id da janela, que muda a cada abertura. */
/** @type {import('./types/bend-core').ConferirCore} */
const core = require('./src/generated/conferir.core.js').default;

const MAX_APP = 120;
const MIN_SIDE = 100; // janela de verdade: o que o Conferir sempre exigiu
const NONE = /** @type {const} */ ({$: 'None'});

const normKey = (name) => String(name ?? '').trim().toLowerCase();
const toList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

/* Escolha salva → `{app, key}` ou `null`. Texto vazio, tipo errado ou nome
   desmedido não valem (o padrão volta). A chave é sempre recalculada do nome:
   nunca confia na gravada. */
function normalizeChoice(value) {
  if (!value || typeof value !== 'object') return null;
  const app = typeof value.app === 'string' ? value.app.trim() : '';
  if (!app || app.length > MAX_APP) return null;
  const key = normKey(app);
  return key ? {app, key} : null;
}

/** @returns {import('./types/bend-core').BendMaybe<import('./types/bend-core').ConfChoice>} */
const choiceFact = (choice) => (choice ? {$: 'Some', value: {app: choice.app, key: choice.key}} : NONE);

/* Janela bruta do helper → fato do núcleo. `bounds` vem do helper do macOS
   (`Width`/`Height`); no Windows não há tamanho e a janela vale. */
function windowFact(raw, selfKeys) {
  const b = raw?.bounds;
  const sized = b && typeof b === 'object';
  const width = sized ? Number(b.Width ?? b.width ?? 0) : null;
  const height = sized ? Number(b.Height ?? b.height ?? 0) : null;
  const app = String(raw?.app ?? '').trim();
  const key = normKey(app);
  return {
    $: 'ConfWin',
    id: String(raw?.id ?? ''),
    app,
    key,
    title: String(raw?.title ?? ''),
    usable: sized ? width > MIN_SIDE && height > MIN_SIDE : true,
    self: selfKeys.has(key),
  };
}

function createConferirHost(deps) {
  const {
    ipcMain, platform = process.platform, state, setChoice, selfNames = () => [],
    listWindows, captureWindow, ensurePermission = async () => {}, fixture = null,
  } = deps;

  const selfKeys = () => new Set(selfNames().map(normKey).filter(Boolean));
  const currentChoice = () => normalizeChoice(state());

  /* Lista tudo (já como fatos). Fixture de teste (só em TEST_MODE) substitui o
     sistema inteiro: lista e captura vêm do arquivo. */
  async function list() {
    if (fixture) {
      const data = fixture.read();
      return {raw: data.windows || [], facts: (data.windows || []).map((w) => windowFact(w, selfKeys()))};
    }
    if (platform !== 'darwin' && platform !== 'win32') throw Error(uiMsg('err.conferir.platform'));
    await ensurePermission();
    const raw = await listWindows();
    return {raw, facts: raw.map((w) => windowFact(w, selfKeys()))};
  }

  async function shoot(fact, rawList) {
    if (fixture) return fixture.capture(fact);
    const raw = rawList.find((w) => String(w.id) === fact.id) || {id: fact.id, app: fact.app};
    return captureWindow(raw, core.displayName(fact.app, fact.key));
  }

  async function capturePicked(fact, rawList) {
    const shot = await shoot(fact, rawList);
    return {title: shot.title || fact.title || core.displayName(fact.app, fact.key), dataUrl: shot.dataUrl, app: core.displayName(fact.app, fact.key)};
  }

  async function ready() {
    const {raw, facts} = await list();
    const choice = currentChoice();
    const decision = core.decide(toList(facts), choiceFact(choice));
    if (decision.$ === 'ConfCapture') {
      const fact = facts.find((w) => w.id === decision.id);
      const shot = await shoot(fact, raw);
      return {title: shot.title || decision.title || decision.app, dataUrl: shot.dataUrl, app: decision.app};
    }
    return {absent: true, app: decision.app, saved: !!decision.saved, message: core.absentLead(decision.app, !!decision.saved)};
  }

  async function windows() {
    const {facts} = await list();
    const choice = currentChoice();
    return {windows: facts, choice, canGoBack: !!choice};
  }

  async function choose(input) {
    const id = String(input?.id ?? '');
    const {raw, facts} = await list();
    const eligible = [];
    for (let node = core.eligibleWins(toList(facts)); node && node.$ === 'Con'; node = node.tail) eligible.push(node.head);
    const fact = eligible.find((w) => w.id === id);
    if (!fact) throw Error(uiMsg('err.conferir.windowGone'));
    const picked = {app: core.displayName(fact.app, fact.key), key: fact.key};
    const shot = await capturePicked(fact, raw);
    setChoice(picked);
    return {...shot, choice: picked};
  }

  function reset() {
    setChoice(null);
    return {choice: null};
  }

  function register() {
    ipcMain.handle('capture-ready', () => ready());
    ipcMain.handle('capture-windows', () => windows());
    ipcMain.handle('capture-choose', (_event, input) => choose(input));
    ipcMain.handle('capture-default', () => reset());
  }

  return {register, ready, windows, choose, reset};
}

module.exports = {createConferirHost, normalizeChoice, windowFact, normKey, MAX_APP};
