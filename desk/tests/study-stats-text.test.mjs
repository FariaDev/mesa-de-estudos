/* As frases da tela de Estatísticas (#34, #41 fase 3): saíram de `core/studystats.bend`
   para `src/study-stats-text.mjs`; estas são as leis que o núcleo tinha, agora nos dois idiomas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import {humanCount, usageLine, headline, supportLine, timerLine, weekdayName} from '../src/study-stats-text.mjs';
import statsCore from '../src/generated/studystats.core.js';

function depsFor(language) {
  const i18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language});
  return {t: i18n.t, text: i18n.text, formatNumber: (value, options) => new Intl.NumberFormat(language, options).format(value)};
}
const pt = depsFor('pt-BR');
const english = depsFor('en');
const token = (count) => ({available: true, count});
const missing = {available: false, count: 0};

test('contagem para ler: mil, milhão com uma casa, e o limite onde 999,5 mil vira milhão', () => {
  assert.deepEqual([0, 999, 1000, 139400].map((n) => humanCount(n, pt)), ['0', '999', '1 mil', '139 mil']);
  assert.deepEqual([999499, 999500, 1000000, 1400000, 2000000, 2040000].map((n) => humanCount(n, pt)),
    ['999 mil', '1 milhão', '1 milhão', '1,4 milhão', '2 milhões', '2 milhões']);
  assert.deepEqual([139400, 1400000, 2000000].map((n) => humanCount(n, english)), ['139K', '1.4 million', '2 million']);
});

test('o uso do tutor: tudo, sem cache e nada informado', () => {
  assert.equal(usageLine({input: token(139400), output: token(17000), cache: token(573200)}, pt),
    '139 mil tokens lidos · 17 mil escritos · 573 mil reaproveitados do cache');
  assert.equal(usageLine({input: token(120), output: token(30), cache: missing}, pt), '120 tokens lidos · 30 escritos');
  assert.equal(usageLine({input: missing, output: missing, cache: missing}, pt), 'O motor do tutor não informou o uso de tokens neste período.');
  assert.equal(usageLine({input: token(120), output: token(30), cache: missing}, english), '120 tokens read · 30 written');
});

test('a frase do período: com sessões, uma sessão, sem sessão fechada e nada', () => {
  assert.equal(headline(12000, 6, pt), '3 h 20 min de estudo em 6 sessões');
  assert.equal(headline(3900, 1, pt), '1 h 05 min de estudo em 1 sessão');
  assert.equal(headline(1500, 0, pt), '25 min de estudo');
  assert.equal(headline(0, 0, pt), 'Nada estudado neste período');
  assert.equal(headline(0, 0, pt, true), 'Nada contado: o cronômetro está pausado', '#70: a pausa do aluno explica o vazio');
  assert.equal(headline(1500, 0, pt, true), '25 min de estudo', 'com tempo, a pausa não esconde o número');
  assert.equal(headline(12000, 6, english), '3 h 20 min of study in 6 sessions');
  assert.equal(headline(0, 0, english), 'Nothing studied in this period');
});

test('a linha de apoio: perguntas ao tutor e o melhor dia', () => {
  assert.equal(supportLine(19, 'sexta', 65, pt), '19 perguntas ao tutor · melhor dia: sexta, 65 min');
  assert.equal(supportLine(1, 'sexta', 0, pt), '1 pergunta ao tutor');
  assert.equal(supportLine(0, '', 0, pt), 'nenhuma pergunta ao tutor');
  assert.equal(supportLine(19, weekdayName(5, english), 65, english), '19 questions to the tutor · best day: Friday, 65 min');
});

test('o cronômetro: contando traz a duração da sessão, pausado não', () => {
  assert.equal(timerLine(true, '12 min', pt), 'Contando agora · 12 min nesta sessão');
  assert.equal(timerLine(false, '12 min', pt), 'Pausado · nada está sendo contado');
  assert.equal(timerLine(true, statsCore.durationLabel(720), english), 'Counting now · 12 min in this session');
});

test('o dia da semana por extenso segue o idioma e recusa índice fora de 0–6', () => {
  assert.equal(weekdayName(0, pt), 'domingo');
  assert.equal(weekdayName(6, english), 'Saturday');
  assert.throws(() => weekdayName(7, pt), /7.*0–6/);
});
