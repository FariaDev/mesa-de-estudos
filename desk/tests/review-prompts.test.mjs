import test from 'node:test';
import assert from 'node:assert/strict';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../locales/pt-BR.json' with {type: 'json'};
import en from '../locales/en.json' with {type: 'json'};
import {reviewPrompt} from '../src/review-prompts.mjs';

const inPortuguese = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'}).t;
const inEnglish = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'en'}).t;
const full = {question: 'Limites no infinito', attempt: 'dividi por x²', difficulty: 'não vi a fatoração', ref: {name: 'Limites.pdf', page: 3, path: '/p/Limites.pdf'}};
const thin = {question: 'Derivadas', attempt: '', difficulty: '', ref: {name: '', page: 1, path: ''}};

test('em português: refazer leva a tentativa, a dificuldade e a referência', () => {
  assert.equal(
    reviewPrompt(full, 'redo', inPortuguese),
    'Vou refazer este exercício:\nLimites no infinito\nO que eu tentei: dividi por x²\nOnde eu travei: não vi a fatoração\nReferência: Limites.pdf, p. 3'
  );
});

test('em português: o parecido não leva a tentativa, e sem nada extra sobra só a questão', () => {
  assert.equal(
    reviewPrompt(full, 'similar', inPortuguese),
    'Quero um exercício semelhante a este, com outros números:\nLimites no infinito\nOnde eu travei: não vi a fatoração\nReferência: Limites.pdf, p. 3'
  );
  assert.equal(reviewPrompt(thin, 'similar', inPortuguese), 'Quero um exercício semelhante a este, com outros números:\nDerivadas');
});

test('em inglês o prompt sai em inglês; sem nome de arquivo sobra a página', () => {
  assert.equal(
    reviewPrompt(full, 'redo', inEnglish),
    'I am going to redo this exercise:\nLimites no infinito\nWhat I tried: dividi por x²\nWhere I got stuck: não vi a fatoração\nReference: Limites.pdf, p. 3'
  );
  assert.equal(reviewPrompt({...full, ref: {name: '', page: 5, path: '/p/x.pdf'}}, 'similar', inEnglish).split('\n').pop(), 'Reference: p. 5');
});

test('tipo desconhecido diz o valor recebido e o esperado', () => {
  assert.throws(() => reviewPrompt(thin, 'outro'), /"outro".*"redo" ou "similar"/);
});
