'use strict';

/* Estado persistido da Mesa: fronteira com o núcleo Bend
   (core/state.bend → src/generated/state.core.js). O host decide presença,
   tipo, o corte do rascunho e os fatos `under`/`over` já comparados; o núcleo
   normaliza tema, refs, rascunho e os limites de layout (300..700, 72..900,
   .2...8). `Maybe` = ausente ou tipo inválido (a base decide); `Some` = valor
   de verdade. Puro: sem DOM, IPC ou relógio — o main usa direto e os testes de
   paridade exercitam este módulo real. */
const core = require('./src/generated/state.core.js').default;
const MAX_DRAFT = core.maxDraftChars(); // teto do núcleo (core/laws/state.bend)

const NONE = {$: 'None'};
const some = (value) => ({$: 'Some', value});
const THEME_NAMES = {StateThemeAuto: 'auto', StateThemeLight: 'light', StateThemeDark: 'dark'};
const themeName = (theme) => THEME_NAMES[theme?.$] || 'auto';
const boolFact = (value) => (typeof value === 'boolean' ? some(value) : NONE);

/* Números do JSON/IPC: o antigo `Number(v) || fallback` aceitava string numérica
   e tratava 0/NaN/''/false como ausentes; Infinity era presente e encostava no
   limite. Os fatos abaixo reproduzem isso (ausente → None; presente → Some com
   o `under`/`over` já comparado). */
function numberFacts(value, low, high) {
  const n = Number(value);
  const present = !Number.isNaN(n) && n !== 0;
  return {value: present ? some(n) : NONE, under: present && n < low, over: present && n > high};
}
function draftFacts(value) {
  const text = typeof value === 'string' ? value : null;
  return {
    draft: text === null ? NONE : some(text),
    draftCut: text === null ? '' : text.slice(0, MAX_DRAFT),
    draftOverLimit: text !== null && text.length > MAX_DRAFT,
  };
}
/* Os literais F32 do núcleo (0.2/0.8) viram Math.fround no artefato JS; o JSON
   antigo gravava os decimais 0.2/0.8. Só o limite exato volta ao decimal
   canônico — valor legítimo perto do limite (0.200000002) passa intacto. */
const splitValue = (value) => (value === Math.fround(.2) ? .2 : value === Math.fround(.8) ? .8 : value);
function deskInput(source) {
  const raw = source && typeof source === 'object' ? source : {};
  const chat = numberFacts(raw.chatWidth, 300, 700);
  const calc = numberFacts(raw.calcHeight, 72, 900);
  const split = numberFacts(raw.pdfSplit, .2, .8);
  return {
    $: 'DeskInput',
    ...draftFacts(raw.draft),
    theme: typeof raw.theme === 'string' ? some(raw.theme) : NONE,
    referenceVisible: boolFact(raw.referenceVisible),
    chatWidth: chat.value, chatWidthUnder: chat.under, chatWidthOver: chat.over,
    calcHeight: calc.value, calcHeightUnder: calc.under, calcHeightOver: calc.over,
    pdfSplit: split.value, pdfSplitUnder: split.under, pdfSplitOver: split.over,
  };
}
const deskState = (source) => core.normalizeDesk(deskInput(source));
const layoutOf = (state) => ({
  draft: state.draft,
  theme: themeName(state.theme),
  referenceVisible: state.referenceVisible,
  chatWidth: state.chatWidth,
  calcHeight: state.calcHeight,
  pdfSplit: splitValue(state.pdfSplit),
});

/* Carga (topo do desk.json ou estado por matéria): defaults do núcleo para
   ausente/tipo errado; refs default true; números encostam nos limites (o save
   já fazia; valor corrompido não vaza cru para o renderer). */
const deskLayout = (source) => layoutOf(deskState(source));

/* Save: fallbacks do JS antigo por campo — refs sempre coagidas (!!), rascunho
   caía em '' fora de string, chatWidth em 390 fora de número e calcHeight/
   pdfSplit no estado corrente. A base por chamada espelha isso. */
function saveState(current, value) {
  const input = deskInput(value);
  input.referenceVisible = some(!!value.referenceVisible);
  return layoutOf(core.mergeDesk({...deskState(current), draft: '', chatWidth: 390}, input));
}

module.exports = {deskLayout, saveState, MAX_DRAFT};
