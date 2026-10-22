/* O motivo da coluna do tutor (src/tutor-reason.mjs): a frase de sempre (#23)
   e o Claude Code fora da faixa, que chega como mensagem do catálogo com o
   conserto (#51). Sem DOM: a árvore sai do núcleo e a tradução do i18n. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {reasonText, reasonFacts} from '../src/tutor-reason.mjs';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import tutorStateCore from '../src/generated/tutorstate.core.js';

const require = createRequire(import.meta.url);
const env = require('../src/agents/claude-environment.cjs');

test('regressão #51: o nome da classe do erro não chega à coluna', () => {
  assert.equal(reasonText('ClaudeAdapterError: Claude Code sem login ativo. Faça login e tente de novo.'), 'Claude Code sem login ativo.');
  assert.equal(reasonText('Error: Pi não encontrado. Rode npm run setup. Outra coisa.'), 'Pi não encontrado. Rode npm run setup.');
  assert.equal(reasonText('error: algo'), 'algo');
});

test('motivo comum: a frase de sempre, sem conserto', () => {
  assert.deepEqual(reasonFacts('O tutor parou (7). A sessão foi preservada.'), {reason: 'O tutor parou (7).', fix: ''});
  assert.deepEqual(reasonFacts(undefined), {reason: '', fix: ''});
});

test('Claude Code fora da faixa: a mensagem vai inteira e o conserto vem do núcleo', () => {
  const below = env.claudeFit('2.1.250');
  const series = env.claudeFit('2.2.0');
  const unreadable = env.claudeFit(null);
  assert.deepEqual(reasonFacts(below.notice), {reason: below.notice, fix: 'update'});
  assert.deepEqual(reasonFacts(series.notice), {reason: series.notice, fix: 'about'});
  assert.deepEqual(reasonFacts(unreadable.notice), {reason: unreadable.notice, fix: 'update'});
});

test('a frase da coluna traz a versão encontrada e a faixa, nos dois idiomas, sem "pareamento"', () => {
  const {notice} = env.claudeFit('2.1.250');
  const {minimum} = env.CLAUDE_RANGE;
  const pt = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'}).text(notice);
  const english = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'en'}).text(notice);
  assert.equal(pt, `Atualize o Claude Code: a versão 2.1.250 é anterior à faixa que a Mesa aceita (${minimum} a 2.1.x).`);
  assert.equal(english, `Update Claude Code: version 2.1.250 is older than the range the Mesa accepts (${minimum} to 2.1.x).`);
  for (const text of [pt, english]) assert.doesNotMatch(text, /pareamento|ponte|bridge|SDK|\bPi\b|conversa|chat/i);
});

test('a árvore do erro com conserto tem o botão na frente, com o handler do host', () => {
  const {notice} = env.claudeFit('2.1.250');
  const {reason, fix} = reasonFacts(notice);
  const tree = tutorStateCore.stateViewFix('error', reason, fix, false, '', '', '');
  const json = JSON.stringify(tree);
  assert.match(json, /"state-claude-update"/);
  assert.match(json, /"UpdateClaude"/);
  assert.doesNotMatch(json, /OpenPiSettings/, 'Ajustes do Pi não consertam o Claude Code');
  const about = JSON.stringify(tutorStateCore.stateViewFix('error', env.claudeFit('2.2.0').notice, 'about', false, '', '', ''));
  assert.match(about, /"OpenAbout"/);
});
