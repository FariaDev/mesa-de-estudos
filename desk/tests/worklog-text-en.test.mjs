/* Textos do registro de trabalho do tutor seguem o idioma da interface (#41). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setUiLanguage} from '../src/ui-text.mjs';
import {STEP, formatDuration, liveLabel, stepLabel, countsLabel, headLine} from '../src/worklog.mjs';

globalThis.document = {documentElement: {}, querySelectorAll: () => []};
globalThis.window = Object.assign(new EventTarget(), {desk: undefined});

const PORTUGUESE = /\b(Pensou|Pensando|Procurou|Procurando|Consultou|Abriu|Abrindo|Usou|Usando|Você|Trabalhou|interrompido|página|buscas?|ferramentas?)\b/;
const steps = [
  {kind: STEP.SEARCH, query: 'limits', status: 'done'},
  {kind: STEP.FETCH, domain: 'example.org', status: 'done'},
  {kind: STEP.TOOL, toolName: 'geogebra', status: 'done'},
];

test('em inglês, os rótulos do registro de trabalho não trazem português', () => {
  try {
    setUiLanguage('en');
    const texts = [
      liveLabel({kind: STEP.THINKING}), liveLabel({kind: STEP.SEARCH, query: 'limits'}), liveLabel({kind: STEP.FETCH}),
      ...steps.map(stepLabel), stepLabel({kind: STEP.THINKING, startedAt: 1000, endedAt: 66000}),
      countsLabel(steps), headLine({steps, startedAt: 0, endedAt: 3000, reason: 'stopped'}),
      headLine({steps: [], startedAt: 0, endedAt: 3000, reason: 'timeout'}), formatDuration(125000),
    ];
    for (const text of texts) assert.doesNotMatch(text, PORTUGUESE, text);
    assert.equal(stepLabel(steps[0]), 'Searched the web: “limits”');
    assert.equal(countsLabel(steps), '1 search · 1 page · 1 tool');
    assert.equal(formatDuration(125000), '2m 5s');
    assert.equal(headLine({steps, startedAt: 0, endedAt: 3000, reason: 'stopped'}), 'You stopped after 3s · 1 search · 1 page · 1 tool');
  } finally {
    setUiLanguage('pt-BR');
  }
});

test('em português o texto de sempre continua igual', () => {
  assert.equal(stepLabel(steps[1]), 'Abriu example.org');
  assert.equal(formatDuration(125000), '2min 5s');
  assert.equal(countsLabel(steps), '1 busca · 1 página · 1 ferramenta');
});
