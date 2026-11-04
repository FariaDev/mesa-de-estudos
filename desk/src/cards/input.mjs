/* Entrada dos cartões `quiz` e `perguntar` — UMA validação para os três
   motores (#92). O guia de cada ferramenta (`mesa-quiz/guide.mjs` e
   `mesa-perguntar/guide.mjs`) declara os campos; este módulo confere o que o
   modelo mandou ANTES de a Mesa registrar o cartão. A mensagem de erro diz o
   valor recebido e o formato esperado, e nada vira cartão pela metade.

   Puro: sem DOM, disco ou IPC. O host usa a mesma função para revalidar o
   pedido que chega pela ponte; o renderer usa `normalizeAskAnswer` para não
   aceitar resposta incompleta. */

import {invalidValue} from '../error-detail.mjs';

const QUIZ_MIN_OPTIONS = 2;
const QUIZ_MAX_OPTIONS = 10;
const ASK_MAX_QUESTIONS = 8;
const ASK_MAX_OPTIONS = 8;
const MAX_QUESTION = 4000;
const MAX_HEADER = 200;
const MAX_LABEL = 1000;
const MAX_VALUE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_DETAILS = 2000;
const MAX_NOTE = 2000;
const MAX_EXPLANATION = 20000;
const MAX_ANSWER_TEXT = 4000;

const text = (value) => (typeof value === 'string' ? value : '');
const trimmed = (value) => text(value).trim();
const fail = (label, value, expected) => {
  throw Error(invalidValue(label, value, expected));
};

function boundedText(label, value, {min = 0, max, trim = true} = {}) {
  if (typeof value !== 'string') fail(label, value, `string(${min}..${max})`);
  const out = trim ? value.trim() : value;
  if (out.length < min || out.length > max) fail(label, value, `string(${min}..${max})`);
  return out;
}

function optionalText(label, value, max) {
  if (value === undefined || value === null) return '';
  return boundedText(label, value, {min: 0, max});
}

/* Lista de opções do quiz: `label` aparece no cartão e `value` é o que a
   resposta certa cita. Valor ausente cai no próprio rótulo (o formato antigo
   já mandava os dois). */
function quizOptions(raw) {
  if (!Array.isArray(raw) || raw.length < QUIZ_MIN_OPTIONS || raw.length > QUIZ_MAX_OPTIONS) {
    fail('options', raw, `array(${QUIZ_MIN_OPTIONS}..${QUIZ_MAX_OPTIONS}) de {label, value}`);
  }
  const values = new Set();
  return raw.map((option, index) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) fail(`options[${index}]`, option, 'object {label, value}');
    const label = boundedText(`options[${index}].label`, option.label, {min: 1, max: MAX_LABEL});
    const value = option.value === undefined || option.value === null || option.value === ''
      ? label
      : boundedText(`options[${index}].value`, option.value, {min: 1, max: MAX_VALUE});
    if (values.has(value)) fail(`options[${index}].value`, option.value, 'valor único entre as opções');
    values.add(value);
    return {label, value};
  });
}

function correctValuesOf(raw, options, multiSelect) {
  const values = new Set(options.map((option) => option.value));
  const source = Array.isArray(raw) ? raw : [raw];
  if (source.length === 0) fail('correctAnswer', raw, multiSelect ? 'array(1..) de valores das opções' : 'um valor das opções');
  if (!multiSelect && source.length !== 1) fail('correctAnswer', raw, 'um valor das opções (multiSelect:false)');
  const out = source.map((value, index) => {
    const clean = boundedText(multiSelect ? `correctAnswer[${index}]` : 'correctAnswer', value, {min: 1, max: MAX_VALUE});
    if (!values.has(clean)) fail(`correctAnswer[${index}]`, value, `um dos valores das opções (${[...values].join(', ')})`);
    return clean;
  });
  return [...new Set(out)];
}

/**
 * Normaliza e valida o pedido da ferramenta `quiz`.
 * @param {unknown} raw argumentos do modelo
 * @returns {{kind: 'quiz', question: string, details: string, note: string, explanation: string, options: Array<{label: string, value: string}>, multiSelect: boolean, correctValues: string[]}}
 * @example normalizeQuiz({question: '2+2?', options: [{label: '3'}, {label: '4'}], correctAnswer: '4'})
 */
export function normalizeQuiz(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('quiz', raw, 'object {question, options, correctAnswer}');
  const question = boundedText('question', raw.question, {min: 1, max: MAX_QUESTION});
  const options = quizOptions(raw.options);
  const multiSelect = raw.multiSelect === true;
  const correctValues = correctValuesOf(raw.correctAnswer, options, multiSelect);
  return {
    kind: 'quiz',
    question,
    details: optionalText('details', raw.details, MAX_DETAILS),
    note: optionalText('note', raw.note, MAX_NOTE),
    explanation: optionalText('explanation', raw.explanation, MAX_EXPLANATION),
    options,
    multiSelect,
    correctValues,
  };
}

/* Uma pergunta de `perguntar`: opções são opcionais (sem opções, o cartão
   aceita resposta livre) e o texto livre sempre pode substituir a marcação. */
function askOptions(raw, questionIndex) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > ASK_MAX_OPTIONS) fail(`questions[${questionIndex}].options`, raw, `array(0..${ASK_MAX_OPTIONS}) de {label, description}`);
  const labels = new Set();
  return raw.map((option, index) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) fail(`questions[${questionIndex}].options[${index}]`, option, 'object {label, description}');
    const label = boundedText(`questions[${questionIndex}].options[${index}].label`, option.label, {min: 1, max: MAX_LABEL});
    if (labels.has(label)) fail(`questions[${questionIndex}].options[${index}].label`, option.label, 'rótulo único na pergunta');
    labels.add(label);
    return {label, description: optionalText(`questions[${questionIndex}].options[${index}].description`, option.description, MAX_DESCRIPTION)};
  });
}

/**
 * Normaliza e valida o pedido da ferramenta `perguntar`.
 * @param {unknown} raw argumentos do modelo
 * @returns {{kind: 'ask', questions: Array<{question: string, header: string, options: Array<{label: string, description: string}>, multiSelect: boolean}>}}
 * @example normalizeAsk({questions: [{question: 'Como você resolveu?', options: []}]})
 */
export function normalizeAsk(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('perguntar', raw, 'object {questions}');
  const list = raw.questions;
  if (!Array.isArray(list) || list.length < 1 || list.length > ASK_MAX_QUESTIONS) {
    fail('questions', list, `array(1..${ASK_MAX_QUESTIONS}) de {question, header?, options?, multiSelect?}`);
  }
  const questions = list.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`questions[${index}]`, item, 'object {question, header?, options?, multiSelect?}');
    return {
      header: optionalText(`questions[${index}].header`, item.header, MAX_HEADER),
      question: boundedText(`questions[${index}].question`, item.question, {min: 1, max: MAX_QUESTION}),
      options: askOptions(item.options, index),
      multiSelect: item.multiSelect === true,
    };
  });
  return {kind: 'ask', questions};
}

/* Resposta do quiz: índices 1-based (o formato do resultado antigo), sem
   repetição e dentro das opções. `dontKnow` dispensa a seleção. */
export function normalizeQuizAnswer(card, raw) {
  const dontKnow = raw?.dontKnow === true;
  if (dontKnow) return {selected: [], dontKnow: true};
  if (!Array.isArray(raw?.selected) || raw.selected.length === 0) fail('selected', raw?.selected, 'array(1..) de índices das opções');
  const seen = new Set();
  const selected = raw.selected.map((value, index) => {
    if (!Number.isInteger(value) || value < 1 || value > card.options.length) fail(`selected[${index}]`, value, `inteiro 1..${card.options.length}`);
    if (seen.has(value)) fail(`selected[${index}]`, value, 'índice único');
    seen.add(value);
    return value;
  });
  if (!card.multiSelect && selected.length !== 1) fail('selected', raw.selected, 'um índice (resposta única)');
  return {selected, dontKnow: false};
}

/* Resposta de `perguntar`: uma por pergunta, na ordem. Texto livre vence as
   opções marcadas (a mesma regra da interface antiga). */
export function normalizeAskAnswer(card, raw) {
  const list = Array.isArray(raw?.answers) ? raw.answers : null;
  if (!list || list.length !== card.questions.length) fail('answers', raw?.answers, `array(${card.questions.length}) com uma resposta por pergunta`);
  return list.map((answer, index) => {
    const question = card.questions[index];
    const labels = new Set(question.options.map((option) => option.label));
    const selectedRaw = Array.isArray(answer?.selected) ? answer.selected : [];
    const selected = [...new Set(selectedRaw.filter((label) => typeof label === 'string' && labels.has(label)))];
    const free = trimmed(answer?.text);
    if (free.length > MAX_ANSWER_TEXT) fail(`answers[${index}].text`, answer?.text, `string(0..${MAX_ANSWER_TEXT})`);
    if (!question.multiSelect && selected.length > 1) fail(`answers[${index}].selected`, answer.selected, 'um rótulo');
    if (!free && selected.length === 0) fail(`answers[${index}]`, answer, 'um rótulo marcado ou texto livre');
    return {selected: free ? [] : selected, text: free};
  });
}

export const CARD_LIMITS = Object.freeze({
  QUIZ_MIN_OPTIONS,
  QUIZ_MAX_OPTIONS,
  ASK_MAX_QUESTIONS,
  ASK_MAX_OPTIONS,
  MAX_QUESTION,
  MAX_HEADER,
  MAX_LABEL,
  MAX_VALUE,
  MAX_DESCRIPTION,
  MAX_DETAILS,
  MAX_NOTE,
  MAX_EXPLANATION,
  MAX_ANSWER_TEXT,
});
