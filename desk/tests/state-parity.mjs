// Paridade do estado persistido da Mesa: lógica antiga (referência inline, como
// estava em desk/main.cjs antes da fiação) × adaptador real do app
// (desk/state-adapter.cjs, require'ado pelo main.cjs), que fala com o núcleo
// Bend (src/generated/state.core.js). Roda da pasta desk:
// `node tests/state-parity.mjs`.
//
// O save é diferencial em todo o domínio (inclusive lixo de tipo/valor): o
// núcleo tem que devolver exatamente o que o JS antigo devolvia, com os
// fallbacks por campo que o adaptador reproduz na base do merge. No
// carregamento, o diferencial cobre o domínio que o app grava; o bloco final
// fixa a normalização canônica de arquivo corrompido (fora de faixa/tipo), que
// antes vazava cru para o renderer.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
// Código real do app (o main.cjs usa este módulo); a referência antiga segue
// inline abaixo.
const {deskLayout, saveState} = require('../state-adapter.cjs');


// --- lógica antiga (referência) ---------------------------------------------
const clamp = (lo, hi, value) => Math.max(lo, Math.min(hi, value));
function oldSave(current, value) {
  return {
    draft: typeof value.draft === 'string' ? value.draft.slice(0, 100000) : '',
    theme: ['auto', 'light', 'dark'].includes(value.theme) ? value.theme : (current.theme || 'auto'),
    referenceVisible: !!value.referenceVisible,
    chatWidth: clamp(300, 700, Number(value.chatWidth) || 390),
    calcHeight: clamp(72, 900, Number(value.calcHeight) || current.calcHeight || 220),
    pdfSplit: clamp(.2, .8, Number(value.pdfSplit) || current.pdfSplit || .5),
  };
}
function oldLoad(saved, rawTheme) {
  return {
    draft: saved.draft || '',
    // O main antigo não normalizava o tema; quem normalizava era o renderer
    // (`applyTheme`: só 'light'/'dark' valem, o resto cai em 'auto'). O
    // carregamento novo já entrega o tema canônico — mesmo efetivo.
    theme: ['light', 'dark'].includes(rawTheme) ? rawTheme : 'auto',
    referenceVisible: saved.referenceVisible !== false,
    chatWidth: saved.chatWidth || 390,
    calcHeight: saved.calcHeight || 220,
    pdfSplit: clamp(.2, .8, Number(saved.pdfSplit) || .5),
  };
}

// --- comparação -------------------------------------------------------------
// O host devolve o decimal canônico dos limites F32 (splitValue), então a
// comparação é exata — nada de tolerância escondendo divergência.
const close = (a, b) => a === b;
function sameLayout(a, b) {
  return a.draft === b.draft && a.theme === b.theme && a.referenceVisible === b.referenceVisible
    && close(a.chatWidth, b.chatWidth) && close(a.calcHeight, b.calcHeight) && close(a.pdfSplit, b.pdfSplit);
}
function dump(kind, current, input, old, mine) {
  const show = (value) => JSON.stringify(value, (_key, item) => (typeof item === 'string' && item.length > 200 ? `${item.slice(0, 40)}…(${item.length})` : item));
  console.error(`divergiu (${kind}):\n current=${show(current)}\n input=${show(input)}\n old=${show(old)}\n new=${show(mine)}`);
  process.exit(1);
}

// --- aleatório --------------------------------------------------------------
let seed = 0x5a7e51;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % n; };
const pick = (xs) => xs[rnd(xs.length)];

const CURRENT_DRAFTS = ['', 'antigo', 'rascunho 🙂', 'linha\noutra', 'a'.repeat(100000)];
const CURRENT_THEMES = ['auto', 'light', 'dark'];

const SAVE_DRAFTS = [undefined, null, '', 'oi', 'rascunho 🙂', 'a'.repeat(100000), 'a'.repeat(100001), 'x'.repeat(120000), 42, true, false, [], {}];
const SAVE_NUMBERS = [undefined, null, NaN, Infinity, -Infinity, -5, -0, 0, 1, 300, 390, 500, 700, 1000, 5000, '450', '0', 'abc', '', true, false, [], {}];
const SAVE_SPLITS = [undefined, null, NaN, Infinity, -Infinity, -1, 0, .1, .2, .200000002, .35, .5, .7, .799999999, .8, .9, 1, '0.5', 'abc', '', true, false];
const SAVE_BOOLS = [undefined, null, true, false, 0, 1, '', 'true', 'x'];
const SAVE_THEMES = [undefined, null, 'auto', 'light', 'dark', 'roxo', '', 'AUTO', 'dark ', 0, 1, true, {}];

const SAVED_DRAFTS = [undefined, null, '', 'rascunho', 'a'.repeat(100000), '🙂', 0, false];
const SAVED_WIDTHS = [undefined, null, NaN, 0, -0, '', false, 300, 350, 390, 500, 700];
const SAVED_HEIGHTS = [undefined, null, NaN, 0, '', false, 72, 220, 430, 900];
const SAVED_SPLITS = [undefined, null, NaN, 0, '', false, .1, .2, .200000002, .35, .5, .799999999, .8, .9, 1, 2];
const SAVED_REFS = [undefined, null, true, false, 0, 1, '', 'x', 'false'];

const CASES = 20000;
let checked = 0;
for (let i = 0; i < CASES; i++) {
  const current = {
    draft: pick(CURRENT_DRAFTS),
    theme: pick(CURRENT_THEMES),
    referenceVisible: rnd(2) === 1,
    chatWidth: 300 + rnd(401),
    calcHeight: 72 + rnd(829),
    pdfSplit: .2 + rnd(601) / 1000,
  };
  const value = {
    draft: pick(SAVE_DRAFTS),
    theme: pick(SAVE_THEMES),
    referenceVisible: pick(SAVE_BOOLS),
    chatWidth: pick(SAVE_NUMBERS),
    calcHeight: pick(SAVE_NUMBERS),
    pdfSplit: pick(SAVE_SPLITS),
  };
  const oldA = oldSave(current, value), newA = saveState(current, value);
  if (!sameLayout(oldA, newA)) dump('save', current, value, oldA, newA);
  checked++;

  const saved = {
    draft: pick(SAVED_DRAFTS),
    referenceVisible: pick(SAVED_REFS),
    chatWidth: pick(SAVED_WIDTHS),
    calcHeight: pick(SAVED_HEIGHTS),
    pdfSplit: pick(SAVED_SPLITS),
  };
  const theme = pick(SAVE_THEMES);
  const oldB = oldLoad(saved, theme), newB = deskLayout({...saved, theme});
  if (!sameLayout(oldB, newB)) dump('load', saved, theme, oldB, newB);
  checked++;
}

// --- bordas explícitas ------------------------------------------------------
for (const draft of SAVE_DRAFTS) {
  const current = {draft: 'base', theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: .5};
  const value = {draft, theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: .5};
  const oldA = oldSave(current, value);
  const newA = saveState(current, value);
  if (!sameLayout(oldA, newA)) dump('save/draft', current, value, oldA, newA);
  checked++;
}
for (const theme of SAVE_THEMES) {
  const current = {draft: 'x', theme: 'dark', referenceVisible: false, chatWidth: 500, calcHeight: 300, pdfSplit: .6};
  const value = {draft: 'x', theme, referenceVisible: false, chatWidth: 500, calcHeight: 300, pdfSplit: .6};
  const oldA = oldSave(current, value), newA = saveState(current, value);
  if (!sameLayout(oldA, newA)) dump('save/theme', current, value, oldA, newA);
  checked++;
}
for (const number of SAVE_NUMBERS) {
  const current = {draft: '', theme: 'light', referenceVisible: true, chatWidth: 410, calcHeight: 230, pdfSplit: .6};
  const value = {draft: '', theme: 'light', referenceVisible: true, chatWidth: number, calcHeight: number, pdfSplit: number};
  const oldA = oldSave(current, value), newA = saveState(current, value);
  if (!sameLayout(oldA, newA)) dump('save/number', current, value, oldA, newA);
  checked++;
}
for (const value of SAVE_BOOLS) {
  const current = {draft: '', theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: .5};
  const payload = {draft: '', theme: 'auto', referenceVisible: value, chatWidth: 390, calcHeight: 220, pdfSplit: .5};
  const oldA = oldSave(current, payload), newA = saveState(current, payload);
  if (!sameLayout(oldA, newA)) dump('save/refs', current, payload, oldA, newA);
  checked++;
}

// --- limite de pdfSplit: valor legítimo perto do literal F32 ------------------
// B1: 0.200000002 e 0.799999999 estão dentro da faixa e não podem virar 0.2/0.8
// (o snapshot do host só devolve o decimal na igualdade exata com o F32).
for (const value of [0.200000002, 0.799999999]) {
  const current = {draft: '', theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: .5};
  const payload = {draft: '', theme: 'auto', referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: value};
  const oldA = oldSave(current, payload), newA = saveState(current, payload);
  if (!sameLayout(oldA, newA) || newA.pdfSplit !== value) dump('save/split-limite', current, payload, oldA, newA);
  checked++;
  const saved = {chatWidth: 390, calcHeight: 220, pdfSplit: value, referenceVisible: true, draft: ''};
  const loaded = deskLayout({...saved, theme: 'auto'});
  if (loaded.pdfSplit !== value) dump('load/split-limite', saved, value, oldLoad(saved, 'auto'), loaded);
  checked++;
}

// --- normalização canônica fora do domínio gravado ---------------------------
// desk.json editado à mão: o valor cru antes vazava para o renderer; agora o
// carregamento encosta nos limites/coage tipo como o save já fazia. Aqui o
// esperado é o núcleo, não o JS antigo.
const CANONICAL = [
  ['chatWidth', -5, 300], ['chatWidth', 1000, 700], ['chatWidth', Infinity, 700], ['chatWidth', -Infinity, 300], ['chatWidth', '450', 450],
  ['calcHeight', -1, 72], ['calcHeight', 5000, 900], ['calcHeight', Infinity, 900], ['calcHeight', '220', 220],
  ['pdfSplit', .1, .2], ['pdfSplit', .95, .8], ['pdfSplit', Infinity, .8],
  ['pdfSplit', Math.fround(.2), .2], ['pdfSplit', Math.fround(.8), .8],
  ['draft', 42, ''], ['draft', 'a'.repeat(100001), 'a'.repeat(100000)],
];
for (const [field, raw, expected] of CANONICAL) {
  const saved = {chatWidth: 390, calcHeight: 220, pdfSplit: .5, referenceVisible: true, draft: '', theme: 'auto'};
  saved[field] = raw;
  const out = deskLayout({...saved, theme: 'auto'});
  if (!close(out[field], expected)) {
    console.error(`normalização divergiu: field=${field} raw=${JSON.stringify(raw)} esperado=${JSON.stringify(expected)} veio=${JSON.stringify(out[field])}`);
    process.exit(1);
  }
  checked++;
}

console.log(`STATE PASSED (${checked} comparações em ${CASES} casos + bordas)`);
