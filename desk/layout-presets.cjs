'use strict';
const {message: uiMsg} = require('./src/i18n.mjs');

/* ---------------------------------------------------------------------------
   Presets de layout da Mesa — política do processo principal.

   O que é um preset: um NOME + um LAYOUT (só view). Layout = o que o usuário
   vê, nunca o que ele estuda:
     {chatWidth, calcHeight, pdfSplit, chatCollapsed, calculatorCollapsed,
      referenceVisible, minimized}
   Nada de documento, página, rascunho, conversa, matéria, tema ou contexto.

   A forma e os limites vivem no núcleo Bend (`core/mesaqollayout.bend` →
   `src/generated/mesaqollayout.core.js`): o `layout()` normaliza cada campo
   (300..700 px de chat, 72..900 px de calculadora, 20%..80% de divisor e no
   máximo 2 leitores recolhidos) e os três embutidos
   (Leitura/Exercícios/Comparar) nascem lá. Aqui ficam o JSON, a lista de
   presets pessoais do usuário e a mutação (upsert/rename/delete) — sem disco:
   o estado global por usuário mora em `state.layoutPresets` e quem vê o
   arquivo é o `persist()` do main (mesmo caminho de `desk.json`).

   Contrato HTTP-local do main (os handlers IPC chamam isto):
     layout-presets-get  → read(state)            (store saneado)
     layout-presets-save → modify(state.layoutPresets, payload)
       payload: {action:"upsert", preset:{id?, name, layout}}
              | {action:"rename", id, name}
              | {action:"delete", id}
       quando ok, o handler grava `state.layoutPresets = result.store` e
       `persist()`; quando não, o `error` sobe como rejeição do `invoke`.

   `state.viewLayout` (view global por usuário, PARCIAL):
     {chatWidth?, calcHeight?, pdfSplit?, chatCollapsed?, calculatorCollapsed?,
      referenceVisible?, minimized?}
     - no load/initialData: `readViewLayout(state)`;
     - no save-state: `normalizeViewLayout(value.viewLayout) ?? state.viewLayout`
       e preservar nos spreads de troca de curso/sessão (não sobrescrever com
       draft/pdfs/tema/contexto — o campo é só view).

   Puro e determinístico: `modify` devolve um store NOVO e nunca muta o
   recebido. Os embutidos não entram no store pessoal (não se renomeia nem se
   apaga um preset do app) e nunca são aplicados sozinhos no boot.
   --------------------------------------------------------------------------- */

const core = require('./src/generated/mesaqollayout.core.js').default;
const {roundNat} = require('./src/bend-nat.mjs');

const VERSION = 1;
const MAX_PRESETS = Number(core.maxPresets());
const MAX_NAME = Number(core.maxName());
const MAX_MINIMIZED = 2;
/* Ids pessoais: minúsculos, começando por letra; o `p-` é convenção do host
   para não colidir com os ids reservados dos embutidos (`mesa-*`). */
const ID_RE = /^[a-z][a-z0-9-]{2,39}$/;
const BUILTIN_IDS = [core.leituraId(), core.exerciciosId(), core.compararId()];

const NIL = {$: 'Nil'};
const {isPlainObject} = require('./plain-object.cjs');
const numberOrNull = (value) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/* Lista Bend a partir de um array JS (Bool vira true/false, como no núcleo). */
function coreList(items) {
  let out = NIL;
  for (let i = items.length - 1; i >= 0; i--) out = {$: 'Con', head: items[i], tail: out};
  return out;
}

/* Lista Bend → array JS. */
function coreArray(node) {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
}

// Aparar antes de escalar evita Infinity em JSON com números finitos extremos.
function splitNat(value) {
  const bounded = Math.max(Number(core.minSplit()) / 1000, Math.min(Number(core.maxSplit()) / 1000, value));
  return roundNat(bounded * 1000);
}

/* LayoutView do núcleo → objeto puro do JSON. */
function layoutOfCore(view) {
  return {
    chatWidth: Number(view.chatWidth),
    calcHeight: Number(view.calcHeight),
    pdfSplit: Number(view.splitPct) / 1000,
    chatCollapsed: view.chatCollapsed === true,
    calculatorCollapsed: view.calculatorCollapsed === true,
    referenceVisible: view.referenceVisible === true,
    minimized: coreArray(view.minimized).map((flag) => flag === true),
  };
}

/* Um layout completo é VÁLIDO: números finitos (aparados no núcleo), Bool de
   verdade e `minimized` com 0..2 Bool. Qualquer campo ausente/torto → null; o
   `null` sobe para quem chamou (o preset não é gravado pela metade). */
function normalizeLayout(raw) {
  if (!isPlainObject(raw)) return null;
  const chatWidth = numberOrNull(raw.chatWidth);
  const calcHeight = numberOrNull(raw.calcHeight);
  const pdfSplit = numberOrNull(raw.pdfSplit);
  if (chatWidth === null || calcHeight === null || pdfSplit === null) return null;
  if (typeof raw.chatCollapsed !== 'boolean' || typeof raw.calculatorCollapsed !== 'boolean' || typeof raw.referenceVisible !== 'boolean') return null;
  if (!Array.isArray(raw.minimized) || raw.minimized.length > MAX_MINIMIZED) return null;
  if (!raw.minimized.every((flag) => typeof flag === 'boolean')) return null;
  const view = core.layout(
    roundNat(chatWidth),
    roundNat(calcHeight),
    splitNat(pdfSplit),
    raw.chatCollapsed,
    raw.calculatorCollapsed,
    raw.referenceVisible,
    coreList(raw.minimized),
  );
  return layoutOfCore(view);
}

function nameOf(raw) {
  if (typeof raw !== 'string') return '';
  return String(core.name(raw));
}

/* Preset pessoal: id opcional (novo recebe um), nome não vazio e layout
   completo. `builtin` nunca vem do usuário. */
function normalizePreset(raw) {
  if (!isPlainObject(raw)) return null;
  const id = raw.id === undefined || raw.id === null || raw.id === '' ? '' : String(raw.id);
  if (id && (!ID_RE.test(id) || BUILTIN_IDS.includes(id))) return null;
  const name = nameOf(raw.name);
  if (!name) return null;
  const layout = normalizeLayout(raw.layout);
  if (!layout) return null;
  return {id, name, layout, builtin: false};
}

/* Store saneado: descarta lixo, deduplica ids e para no teto. O `version` é da
   forma do arquivo (migração futura), não do layout de cada preset. */function normalizeStore(raw) {
  const source = Array.isArray(raw) ? {presets: raw} : isPlainObject(raw) ? raw : {};
  const seen = new Set();
  const presets = [];
  for (const item of Array.isArray(source.presets) ? source.presets : []) {
    const preset = normalizePreset(item);
    if (!preset?.id || seen.has(preset.id)) continue;
    seen.add(preset.id);
    presets.push(preset);
    if (presets.length >= MAX_PRESETS) break;
  }
  return {version: VERSION, presets};
}

/* Estado global por usuário (`state.layoutPresets`) → store do renderer. */
function read(state) {
  return normalizeStore(state && state.layoutPresets);
}

/* `state.viewLayout` é PARCIAL por contrato (estado antigo não tem o campo e o
   root pode trocar de curso com o objeto mesclado): aqui entra só o que está
   presente e válido, já aparado — nada de completar com default nem de
   rejeitar o payload inteiro por causa de um campo velho. Devolve null quando
   não há NADA válido (aí o root preserva o que já tinha). */
function normalizeViewLayout(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  const chatWidth = numberOrNull(raw.chatWidth);
  if (chatWidth !== null) out.chatWidth = Number(core.clamp(roundNat(chatWidth), roundNat(300), roundNat(700)));
  const calcHeight = numberOrNull(raw.calcHeight);
  if (calcHeight !== null) out.calcHeight = Number(core.clamp(roundNat(calcHeight), roundNat(72), roundNat(900)));
  const pdfSplit = numberOrNull(raw.pdfSplit);
  if (pdfSplit !== null) out.pdfSplit = Number(core.clamp(splitNat(pdfSplit), roundNat(200), roundNat(800))) / 1000;
  for (const key of ['chatCollapsed', 'calculatorCollapsed', 'referenceVisible']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (Array.isArray(raw.minimized) && raw.minimized.length <= MAX_MINIMIZED && raw.minimized.every((flag) => typeof flag === 'boolean')) {
    out.minimized = raw.minimized.slice();
  }
  return Object.keys(out).length ? out : null;
}

/* Leitura do `state.viewLayout` do disco (sem tocar no resto do estado). */
function readViewLayout(state) {
  return normalizeViewLayout(state && state.viewLayout);
}

function newId() {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0x10000).toString(36).padStart(3, '0');
  return `p-${stamp}-${rand}`;
}

function builtins() {
  return BUILTIN_IDS.map((id) => {
    const hit = core.builtinLayout(id);
    return {id, name: String(core.builtinName(id)), layout: layoutOfCore(hit.value), builtin: true};
  });
}

function findAt(store, id) {
  return store.presets.findIndex((preset) => preset.id === id);
}

function upsert(store, rawPreset) {
  const base = normalizeStore(store);
  const preset = normalizePreset(rawPreset);
  if (!preset) return {ok: false, error: uiMsg('err.layout.invalid')};
  const id = preset.id || newId();
  const index = findAt(base, id);
  if (index >= 0) {
    const presets = base.presets.slice();
    presets[index] = {...preset, id};
    return {ok: true, store: {...base, presets}, preset: presets[index]};
  }
  if (base.presets.length >= MAX_PRESETS) return {ok: false, error: uiMsg('err.layout.limit', {max: MAX_PRESETS})};
  const saved = {...preset, id};
  return {ok: true, store: {...base, presets: [...base.presets, saved]}, preset: saved};
}

function renamePreset(store, id, rawName) {
  const base = normalizeStore(store);
  if (typeof id !== 'string' || !ID_RE.test(id) || BUILTIN_IDS.includes(id)) return {ok: false, error: uiMsg('err.layout.invalidPersonal')};
  const index = findAt(base, id);
  if (index < 0) return {ok: false, error: uiMsg('err.layout.notFound')};
  const name = nameOf(rawName);
  if (!name) return {ok: false, error: uiMsg('err.layout.noName')};
  const presets = base.presets.slice();
  presets[index] = {...presets[index], name};
  return {ok: true, store: {...base, presets}, preset: presets[index]};
}

function deletePreset(store, id) {
  const base = normalizeStore(store);
  if (typeof id !== 'string' || !ID_RE.test(id) || BUILTIN_IDS.includes(id)) return {ok: false, error: uiMsg('err.layout.invalidPersonal')};
  const index = findAt(base, id);
  if (index < 0) return {ok: false, error: uiMsg('err.layout.notFound')};
  const presets = base.presets.slice();
  presets.splice(index, 1);
  return {ok: true, store: {...base, presets}};
}

/* Comando do IPC (`layout-presets-save`). Devolve o store novo quando ok; no
   erro, o store original segue no resultado (o handler não grava). */
function modify(store, command) {
  const base = normalizeStore(store);
  const action = isPlainObject(command) ? command.action : '';
  if (action === 'upsert') return upsert(base, command.preset);
  if (action === 'rename') return renamePreset(base, command.id, command.name);
  if (action === 'delete') return deletePreset(base, command.id);
  return {ok: false, error: uiMsg('err.layout.badAction')};
}

module.exports = {
  VERSION,
  MAX_PRESETS,
  MAX_NAME,
  MAX_MINIMIZED,
  BUILTIN_IDS,
  builtins,
  normalizeLayout,
  normalizePreset,
  normalizeStore,
  read,
  normalizeViewLayout,
  readViewLayout,
  newId,
  upsert,
  renamePreset,
  deletePreset,
  modify,
};
