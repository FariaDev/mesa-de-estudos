/* Regressão: o prompt do tutor voltava como bolha do aluno, e o diário de
   trabalho com início ausente (0) dizia "29888217m". OpenCode colava o prompt
   no envio; Pi (`--append-system-prompt`) e Claude (`systemPrompt`) já usam
   canal de sistema — o filtro vale para os três na hora de mostrar a fala. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {displayUserText} from '../text.mjs';
import {STEP, headLine, historyTurns} from '../src/worklog.mjs';

const require = createRequire(import.meta.url);
const {openCodePrompt} = require('../src/agents/desk-prompts.cjs');
const {normalizeHistory} = require('../src/agents/opencode-history.cjs');
const {visibleHistory, withoutTutorPrompt, markTutorPrompt, OPEN_MARK} = require('../src/agents/tutor-prompt-text.mjs');
const {normalizeHistory: normalizeClaude} = require('../src/agents/claude-adapter-history.cjs');

const PROMPT = openCodePrompt();
const STARTED = 1_700_000_000_000;

test('o prompt do tutor sai de qualquer fala, não só da primeira', () => {
  const drifted = PROMPT.replace('o aluno estuda', 'o estudante estuda');
  const leaked = [
    {id: 'u1', type: 'user', text: `${PROMPT}\n\nQual o limite?`, time: {created: STARTED}},
    {id: 'a1', type: 'assistant', time: {created: STARTED + 2500}, content: [
      {type: 'text', text: 'É a aproximação.'},
      {type: 'tool', id: 'c1', name: 'ler_pdf', state: {status: 'completed', input: {}, content: [{type: 'text', text: 'pág'}]}, time: {created: STARTED + 400, completed: STARTED + 2000}},
    ]},
    {id: 'u2', type: 'user', text: markTutorPrompt(drifted, 'E a derivada?'), time: {created: STARTED + 3000}},
    {id: 'u3', type: 'user', text: drifted, time: {created: STARTED + 4000}},
  ];
  const visible = visibleHistory(normalizeHistory(leaked), PROMPT);
  const users = visible.filter((item) => item.role === 'user').map((item) => item.content[0].text);
  assert.deepEqual(users, ['Qual o limite?', 'E a derivada?']);
  assert.equal(displayUserText(`${PROMPT}\n\nQual o limite?`), 'Qual o limite?');
  assert.equal(withoutTutorPrompt(drifted + '\n\nQual o limite?', PROMPT), 'Qual o limite?');
  const turns = historyTurns(visible);
  assert.equal(turns[0].userText, 'Qual o limite?');
  assert.match(headLine(turns[0]), /^Trabalhou por \d+s/);
  assert.doesNotMatch(headLine(turns[0]), /\d{5,}/);
});

/* Regressão: a fala do aluno que começa como um parágrafo de instrução (`- o `, `- um `, `TUTOR.md`) fica. */
test('fala do aluno que começa com "- o", "- um" ou TUTOR.md fica depois do prompt, mesmo com o prompt mudado', () => {
  const drifted = PROMPT.replace('o aluno estuda', 'o estudante estuda');
  for (const speech of ['- o gráfico está certo?', '- um ponto a mais', 'TUTOR.md é o que exatamente?']) {
    assert.equal(withoutTutorPrompt(`${drifted}\n\n${speech}`, PROMPT), speech, speech);
  }
});

/* Regressão: a abertura sem fechamento não é prompt inteiro; o resto da mensagem fica como está. */
test('marcador de abertura sem fechamento não apaga o resto da mensagem', () => {
  const broken = `${OPEN_MARK}\nQual o limite?\n\nE a derivada?`;
  assert.equal(withoutTutorPrompt(broken, ''), broken);
  assert.equal(withoutTutorPrompt(`${markTutorPrompt(PROMPT, 'primeira')}\n\n${broken}`, PROMPT), `primeira\n\n${broken}`);
});

test('início ausente não vira décadas no diário', () => {
  const tool = {kind: STEP.TOOL, status: 'done', toolName: 'ler_pdf'};
  assert.equal(headLine({steps: [tool], startedAt: 0, endedAt: 0}), 'Trabalhou · 1 ferramenta');
  assert.equal(headLine({steps: [tool], startedAt: 0, endedAt: Date.now()}), 'Trabalhou · 1 ferramenta');
  assert.equal(headLine({steps: [tool], startedAt: 0, endedAt: 3000}), 'Trabalhou por 3s · 1 ferramenta');
});

/* Regressão (teste manual do Mac, 2026-10-31): trabalho do histórico só com
   raciocínio não tem fim, e o cabeçalho usava `Date.now()` ("Pensou por 24939m"). */
test('fim ausente no histórico não vira dias no diário', () => {
  const thinking = {kind: STEP.THINKING, status: 'done', text: 'pensando'};
  const old = Date.now() - 17 * 24 * 60 * 60 * 1000;
  assert.equal(headLine({steps: [thinking], startedAt: old, endedAt: 0}), 'Pensou');
  assert.equal(headLine({steps: [thinking], startedAt: old, endedAt: old + 4000}), 'Pensou por 4s');
});

test('Claude descarta o prompt que vazou numa fala; Pi não o coloca na fala', () => {
  const only = normalizeClaude([{type: 'user', message: {content: [{type: 'text', text: PROMPT}]}}]);
  assert.deepEqual(only, []);
  const kept = normalizeClaude([{type: 'user', message: {content: [{type: 'text', text: `${PROMPT}\n\nquanto vale?`}]}}]);
  assert.equal(kept[0].content[0].text, 'quanto vale?');
  assert.equal(displayUserText('quanto vale o limite?'), 'quanto vale o limite?');
});
