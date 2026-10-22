import test from 'node:test';
import assert from 'node:assert/strict';
import policy from '../layout-presets.cjs';
import {
  normalizeLayout as rendererNormalizeLayout,
  normalizePreset as rendererNormalizePreset,
  normalizeStore as rendererNormalizeStore,
  normalizeViewLayout as rendererNormalizeViewLayout,
  builtinPresets,
  summaryOf,
  registerLayoutSurface,
  captureLayout,
  captureViewLayout,
  applyLayout,
  applyViewLayout,
} from '../src/layout-presets.mjs';
import layoutCore from '../src/generated/mesaqollayout.core.js';
import {ptText} from './pt-text.mjs';

/* Layouts pessoais — política pura. O main (`layout-presets.cjs`) e o renderer
   (`src/layout-presets.mjs`) usam o MESMO núcleo Bend; aqui os dois são
   exercitados lado a lado com os mesmos vetores para o contrato não divergir. */

const BASE = {
  chatWidth: 420,
  calcHeight: 220,
  pdfSplit: 0.5,
  chatCollapsed: false,
  calculatorCollapsed: false,
  referenceVisible: false,
  minimized: [false, false],
};

const layout = (over = {}) => ({...BASE, ...over});

test('layout extremo salvo é limitado antes da escala e tipos vazios não viram medidas', () => {
  for (const value of [1e308, -1e308]) {
    const expected = value > 0 ? 0.8 : 0.2;
    for (const normalize of [policy.normalizeLayout, rendererNormalizeLayout]) {
      assert.equal(normalize(layout({pdfSplit: value})).pdfSplit, expected);
    }
    for (const normalize of [policy.normalizeViewLayout, rendererNormalizeViewLayout]) {
      assert.deepEqual(normalize({pdfSplit: value}), {pdfSplit: expected});
    }
  }
  for (const value of [null, '', '  ', true, false, [], [420], {}]) {
    for (const normalize of [policy.normalizeLayout, rendererNormalizeLayout]) {
      assert.equal(normalize(layout({chatWidth: value})), null);
    }
    for (const normalize of [policy.normalizeViewLayout, rendererNormalizeViewLayout]) {
      assert.equal(normalize({chatWidth: value, calcHeight: value, pdfSplit: value}), null);
    }
  }
});

test('limites e números canônicos vêm do núcleo', () => {
  assert.equal(Number(layoutCore.minChat()), 300);
  assert.equal(Number(layoutCore.maxChat()), 700);
  assert.equal(Number(layoutCore.minCalc()), 72);
  assert.equal(Number(layoutCore.maxCalc()), 900);
  assert.equal(Number(layoutCore.minSplit()), 200);
  assert.equal(Number(layoutCore.maxSplit()), 800);
  assert.equal(policy.MAX_PRESETS, 24);
  assert.equal(policy.MAX_NAME, 60);
});

test('os três embutidos existem com layout válido e limites respeitados', () => {
  const builtins = policy.builtins();
  assert.deepEqual(builtins.map((preset) => preset.id), ['mesa-leitura', 'mesa-exercicios', 'mesa-comparar']);
  assert.deepEqual(builtins.map((preset) => ptText(preset.name)), ['Leitura', 'Exercícios', 'Comparar']);
  for (const preset of builtins) {
    assert.equal(preset.builtin, true);
    assert.ok(policy.normalizeLayout(preset.layout), `${preset.id} normaliza`);
    assert.ok(preset.layout.chatWidth >= 300 && preset.layout.chatWidth <= 700);
    assert.ok(preset.layout.calcHeight >= 72 && preset.layout.calcHeight <= 900);
    assert.ok(preset.layout.pdfSplit >= 0.2 && preset.layout.pdfSplit <= 0.8);
    assert.ok(preset.layout.minimized.length === 2);
  }
});

test('normalizeLayout apara fora da faixa e mantém o válido intacto', () => {
  assert.deepEqual(policy.normalizeLayout(layout({chatWidth: 1, calcHeight: 5000, pdfSplit: 3})), layout({chatWidth: 300, calcHeight: 900, pdfSplit: 0.8}));
  assert.deepEqual(policy.normalizeLayout(layout({chatWidth: 420, calcHeight: 220, pdfSplit: 0.5})), BASE);
  assert.deepEqual(policy.normalizeLayout(layout({pdfSplit: 0.625})), layout({pdfSplit: 0.625}));
});

test('normalizeLayout rejeita campo ausente ou de tipo errado', () => {
  assert.equal(policy.normalizeLayout(null), null);
  assert.equal(policy.normalizeLayout('x'), null);
  assert.equal(policy.normalizeLayout(layout({chatWidth: undefined})), null);
  assert.deepEqual(policy.normalizeLayout(layout({chatWidth: '420'})), layout({chatWidth: 420}), 'string numérica é tolerada (convenção do estado)');
  assert.equal(policy.normalizeLayout(layout({chatWidth: 'x'})), null);
  assert.equal(policy.normalizeLayout(layout({pdfSplit: Number.NaN})), null);
  assert.equal(policy.normalizeLayout(layout({chatCollapsed: 1})), null);
  assert.equal(policy.normalizeLayout(layout({minimized: 'não'})), null);
  assert.equal(policy.normalizeLayout(layout({minimized: [true, false, true]})), null, 'mais leitores que a Mesa tem');
  assert.equal(policy.normalizeLayout(layout({minimized: [true, 'false']})), null);
});

test('normalizePreset exige nome e layout completos e não aceita id reservado', () => {
  assert.deepEqual(policy.normalizePreset({name: '  Revisão  ', layout: BASE}), {id: '', name: 'Revisão', layout: BASE, builtin: false});
  assert.equal(policy.normalizePreset({name: '   ', layout: BASE}), null);
  assert.equal(policy.normalizePreset({name: 'x'.repeat(61), layout: BASE}).name.length, 60);
  assert.equal(policy.normalizePreset({name: 'x', layout: {}}), null);
  assert.equal(policy.normalizePreset({id: 'mesa-leitura', name: 'x', layout: BASE}), null, 'embutido não vira pessoal');
  assert.equal(policy.normalizePreset({id: 'X Y', name: 'x', layout: BASE}), null);
});

test('normalizeStore descarta lixo, deduplica ids e para no teto', () => {
  const raw = {presets: [
    {id: 'p-a', name: 'A', layout: BASE},
    {id: 'p-a', name: 'A de novo', layout: BASE},
    {id: 'p-b', name: '', layout: BASE},
    'lixo',
    {id: 'p-c', name: 'C', layout: layout({chatWidth: 9999})},
  ]};
  const store = policy.normalizeStore(raw);
  assert.deepEqual(store.presets.map((preset) => preset.id), ['p-a', 'p-c']);
  assert.equal(store.presets[1].layout.chatWidth, 700);
  const many = policy.normalizeStore({presets: Array.from({length: 40}, (_, i) => ({id: `p-${i}`, name: `L${i}`, layout: BASE}))});
  assert.equal(many.presets.length, policy.MAX_PRESETS);
});

test('read lê o estado global do usuário e tolera ausência', () => {
  assert.deepEqual(policy.read({}), {version: 1, presets: []});
  assert.deepEqual(policy.read(null), {version: 1, presets: []});
  const store = policy.read({layoutPresets: {presets: [{id: 'p-x', name: 'X', layout: layout({chatCollapsed: true})}]}});
  assert.equal(store.presets.length, 1);
  assert.equal(store.presets[0].layout.chatCollapsed, true);
});

test('upsert cria id, substitui no lugar e não muta o store recebido', () => {
  const before = {version: 1, presets: [{id: 'p-abc', name: 'Antigo', layout: BASE, builtin: false}]};
  const snapshot = JSON.parse(JSON.stringify(before));
  const created = policy.modify(before, {action: 'upsert', preset: {name: 'Novo', layout: layout({chatWidth: 500})}});
  assert.equal(created.ok, true);
  assert.match(created.preset.id, /^p-[a-z0-9-]+$/);
  assert.equal(created.store.presets.length, 2);
  const replaced = policy.modify(created.store, {action: 'upsert', preset: {id: 'p-abc', name: 'Antigo 2', layout: layout({chatWidth: 450})}});
  assert.equal(replaced.ok, true);
  assert.equal(replaced.store.presets[0].name, 'Antigo 2');
  assert.equal(replaced.store.presets[0].layout.chatWidth, 450);
  assert.equal(replaced.store.presets.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(before)), snapshot, 'entrada intocada');
});

test('rename e delete só valem para pessoais existentes', () => {
  const base = {version: 1, presets: [{id: 'p-abc', name: 'Antigo', layout: BASE, builtin: false}]};
  assert.equal(policy.modify(base, {action: 'rename', id: 'mesa-leitura', name: 'x'}).ok, false);
  assert.equal(policy.modify(base, {action: 'rename', id: 'p-nope', name: 'x'}).ok, false);
  assert.equal(policy.modify(base, {action: 'rename', id: 'p-abc', name: '  '}).ok, false);
  const renamed = policy.modify(base, {action: 'rename', id: 'p-abc', name: '  Novo nome  '});
  assert.equal(renamed.preset.name, 'Novo nome');
  assert.equal(policy.modify(base, {action: 'delete', id: 'mesa-exercicios'}).ok, false);
  const deleted = policy.modify(base, {action: 'delete', id: 'p-abc'});
  assert.equal(deleted.ok, true);
  assert.equal(deleted.store.presets.length, 0);
});

test('comando desconhecido e limite de presets falham sem mudar o store', () => {
  assert.equal(policy.modify({presets: []}, {action: 'x'}).ok, false);
  const full = {version: 1, presets: Array.from({length: policy.MAX_PRESETS}, (_, i) => ({id: `p-${i}`, name: `L${i}`, layout: BASE}))};
  const result = policy.modify(full, {action: 'upsert', preset: {name: 'Extra', layout: BASE}});
  assert.equal(result.ok, false);
  assert.match(ptText(result.error), /Limite/);
});

test('main e renderer normalizam os MESMOS vetores byte a byte', () => {
  const vectors = [
    BASE,
    layout({chatWidth: 1, calcHeight: 9999, pdfSplit: 1}),
    layout({chatWidth: 420.4, calcHeight: 220.6, pdfSplit: 0.333}),
    layout({chatCollapsed: true, calculatorCollapsed: true, referenceVisible: true}),
    layout({minimized: [true]}),
    layout({minimized: []}),
    layout({chatWidth: 'x'}),
    layout({pdfSplit: null}),
    layout({minimized: [true, false, true]}),
    {chatWidth: 400},
    null,
    'lixo',
  ];
  for (const vector of vectors) {
    assert.deepEqual(
      rendererNormalizeLayout(vector),
      policy.normalizeLayout(vector),
      `vetor ${JSON.stringify(vector)}`,
    );
  }
  const presetVectors = [
    {name: '  A  ', layout: BASE},
    {id: 'p-abc', name: 'B', layout: layout({chatCollapsed: true})},
    {id: 'mesa-leitura', name: 'C', layout: BASE},
    {name: '', layout: BASE},
    {name: 'D', layout: {}},
  ];
  for (const vector of presetVectors) {
    assert.deepEqual(rendererNormalizePreset(vector), policy.normalizePreset(vector), `preset ${JSON.stringify(vector)}`);
  }
  const stores = [{presets: [{id: 'p-a', name: 'A', layout: BASE}]}, {presets: 'x'}, null];
  for (const store of stores) {
    assert.deepEqual(rendererNormalizeStore(store), policy.normalizeStore(store), `store ${JSON.stringify(store)}`);
  }
});

test('renderer lista os embutidos e resume o layout a partir do núcleo', () => {
  assert.deepEqual(builtinPresets().map((preset) => preset.id), policy.builtins().map((preset) => preset.id));
  assert.equal(summaryOf(builtinPresets().find((preset) => preset.id === 'mesa-exercicios').layout), 'Tutor 360 px · Calculadora 420 px · PDF 50% · leitores normais');
  assert.equal(summaryOf({}), '');
});

/* ---------- viewLayout parcial (estado global por usuário) ---------- */

test('normalizeViewLayout apara só os campos presentes e exige o mínimo válido', () => {
  assert.deepEqual(policy.normalizeViewLayout({chatWidth: 1, chatCollapsed: true}), {chatWidth: 300, chatCollapsed: true});
  assert.deepEqual(policy.normalizeViewLayout({pdfSplit: 3, minimized: [true, false]}), {pdfSplit: 0.8, minimized: [true, false]});
  assert.deepEqual(policy.normalizeViewLayout({pdfSplit: 0.625}), {pdfSplit: 0.625});
  assert.equal(policy.normalizeViewLayout({}), null);
  assert.equal(policy.normalizeViewLayout(null), null);
  assert.equal(policy.normalizeViewLayout({minimized: [true, false, true]}), null);
  assert.deepEqual(policy.readViewLayout({viewLayout: {calcHeight: 9999}}), {calcHeight: 900});
  assert.equal(policy.readViewLayout({}), null);
});

test('main e renderer leem o viewLayout com a mesma forma', () => {
  const vectors = [
    {chatWidth: 333, calcHeight: 333, pdfSplit: 0.3, chatCollapsed: false, calculatorCollapsed: true, minimized: [true, false]},
    {chatWidth: 1, calcHeight: 1, pdfSplit: 1},
    {referenceVisible: true},
    {minimized: [true]},
    {minimized: []},
    {},
    null,
  ];
  for (const vector of vectors) {
    assert.deepEqual(rendererNormalizeViewLayout(vector), policy.normalizeViewLayout(vector), `vetor ${JSON.stringify(vector)}`);
  }
});

/* ---------- superfície (captura/aplicação) ---------- */

function fakeSurface(over = {}) {
  const base = {
    chatWidth: 390,
    calcHeight: 220,
    pdfSplit: 0.5,
    chatCollapsed: false,
    calculatorCollapsed: false,
    calcEnabled: true,
    ref: {two: true, tabIsForm: true, open: false},
    minimized: [false, false],
    ...over,
  };
  const calls = [];
  const state = base;
  return {
    calls,
    state,
    save: () => calls.push(['save']),
    panelCount: () => state.minimized.length,
    calculatorEnabled: () => state.calcEnabled,
    referenceFacts: () => ({...state.ref}),
    readChatWidth: () => state.chatWidth,
    readCalcHeight: () => state.calcHeight,
    readPdfSplit: () => state.pdfSplit,
    readChatCollapsed: () => state.chatCollapsed,
    readCalculatorCollapsed: () => state.calculatorCollapsed,
    readReferenceVisible: () => state.ref.tabIsForm && state.ref.open,
    readMinimized: () => state.minimized.slice(),
    setChatWidth: (value) => {state.chatWidth = value; calls.push(['chatWidth', value]);},
    setCalcHeight: (value) => {state.calcHeight = value; calls.push(['calcHeight', value]);},
    setPdfSplit: (value) => {state.pdfSplit = value; calls.push(['pdfSplit', value]);},
    setChatCollapsed: (value) => {state.chatCollapsed = value; calls.push(['chatCollapsed', value]);},
    setCalculatorCollapsed: (value) => {state.calculatorCollapsed = value; calls.push(['calculatorCollapsed', value]);},
    showReference: () => {state.ref = {...state.ref, open: true}; calls.push(['showReference']);},
    hideReference: () => {state.ref = {...state.ref, open: false}; calls.push(['hideReference']);},
    setMinimized: (index, value) => {state.minimized[index] = value; calls.push(['setMinimized', index, value]);},
  };
}

test('captureLayout lê a superfície e devolve um layout completo', () => {
  const surface = fakeSurface({chatWidth: 425,
    calcHeight: 260, pdfSplit: 0.44, chatCollapsed: true, calculatorCollapsed: true, ref: {two: true, tabIsForm: true, open: true}, minimized: [true, false]});
  registerLayoutSurface(surface);
  assert.deepEqual(captureLayout(), {
    chatWidth: 425,
    calcHeight: 260,
    pdfSplit: 0.44,
    chatCollapsed: true,
    calculatorCollapsed: true,
    referenceVisible: true,
    minimized: [true, false],
  });
  assert.deepEqual(captureViewLayout(), {chatWidth: 425, calcHeight: 260, pdfSplit: 0.44, chatCollapsed: true, calculatorCollapsed: true, minimized: [true, false]});
});

test('applyLayout aplica só view e usa a decisão mínima da área de apoio', () => {
  const surface = fakeSurface();
  registerLayoutSurface(surface);
  const exercicios = builtinPresets().find((preset) => preset.id === 'mesa-exercicios').layout;
  assert.deepEqual(applyLayout(exercicios), exercicios);
  assert.deepEqual(surface.state, {
    chatWidth: 360,
    calcHeight: 420,
    pdfSplit: 0.5,
    chatCollapsed: false,
    calculatorCollapsed: false,
    calcEnabled: true,
    ref: {two: true, tabIsForm: true, open: true},
    minimized: [false, false],
  });
  assert.equal(surface.calls.at(-1)[0], 'save');
  assert.deepEqual(surface.calls.filter((call) => call[0] === 'setMinimized'), [['setMinimized', 0, false], ['setMinimized', 1, false]]);
});

test('applyLayout com o chat lateral à frente não troca de aba para esconder o Formulário', () => {
  const surface = fakeSurface({ref: {two: true, tabIsForm: false, open: true}});
  registerLayoutSurface(surface);
  const leitura = builtinPresets().find((preset) => preset.id === 'mesa-leitura').layout;
  applyLayout(leitura);
  assert.equal(surface.calls.some((call) => call[0] === 'hideReference'), false);
  assert.equal(surface.calls.some((call) => call[0] === 'showReference'), false);
  assert.equal(surface.state.ref.tabIsForm, false, 'a aba de apoio não muda');
});

test('calculadora desligada na config não recebe altura nem colapso do preset', () => {
  const surface = fakeSurface({calcEnabled: false});
  registerLayoutSurface(surface);
  applyLayout(builtinPresets().find((preset) => preset.id === 'mesa-exercicios').layout);
  assert.equal(surface.calls.some((call) => call[0] === 'calcHeight'), false);
  assert.equal(surface.calls.some((call) => call[0] === 'calculatorCollapsed'), false);
});

test('applyViewLayout aplica só os campos presentes e nunca toca em documento/conversa', () => {
  const surface = fakeSurface();
  registerLayoutSurface(surface);
  assert.equal(applyViewLayout({}), false);
  assert.deepEqual(surface.calls, []);
  assert.equal(applyViewLayout({chatWidth: 9999, calculatorCollapsed: true, minimized: [true]}), true);
  assert.equal(surface.state.chatWidth, 700);
  assert.equal(surface.state.calculatorCollapsed, true);
  assert.equal(surface.state.minimized[0], true);
  assert.equal(surface.calls.some((call) => call[0] === 'showReference' || call[0] === 'hideReference'), false);
});
