// @ts-check
'use strict';

/* Cartões `quiz`/`perguntar` no disco (#92): UM lugar para os três motores,
   chaveado pelo caminho da conversa (JSONL do Pi ou descritor nativo). O
   cartão mostra a ferramenta e volta; o aluno responde depois, fecha o app,
   troca de sessão e volta — o cartão e o rascunho continuam aqui.

   O estado de domínio (resposta certa escondida, envio no máximo uma vez) é o
   do `core/quizcard.bend`; este arquivo só faz o I/O e mede o acerto. Escrita
   atômica, leitura tolerante: arquivo torto não derruba a conversa e nunca é
   apagado por leitura. `sentAt`/reserva de envio vivem no próprio estado do
   núcleo, então uma execução que morreu entre "reservei" e "confirmei" volta
   como `sending` e não reenvia sozinha. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const quizCore = require('./src/generated/quizcard.core.js').default;
const {normalizeQuizAnswer, normalizeAskAnswer} = require('./src/cards/input.mjs');
const {publicCard, resultText} = require('./src/cards/result.mjs');
const {isPlainObject} = require('./plain-object.cjs');

const SCHEMA_VERSION = 1;
const DIR = 'cards';
const MAX_CARDS = 200;

const cardId = () => `card-${crypto.randomUUID()}`;
const keyOf = (session) => crypto.createHash('sha256').update(String(session || '')).digest('hex').slice(0, 40);
const fileOf = (runtime, session) => path.join(runtime, DIR, `${keyOf(session)}.json`);

function writeAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, JSON.stringify(value));
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch {}
    throw error;
  }
}

/* O estado vem do próprio núcleo; validar a FORMA dele aqui é o que impede um
   arquivo editado à mão de virar um cartão pela metade. */
function normalizeState(raw) {
  if (!isPlainObject(raw)) return quizCore.newCard();
  const send = isPlainObject(raw.send) ? String(raw.send.$ || '') : '';
  if (!['SendState.NotSent', 'SendState.Sending', 'SendState.Sent'].includes(send)) return quizCore.newCard();
  if (typeof raw.answered !== 'boolean' || typeof raw.correct !== 'boolean' || typeof raw.dismissed !== 'boolean') return quizCore.newCard();
  return {
    $: 'Card',
    answered: raw.answered,
    correct: raw.correct,
    dismissed: raw.dismissed,
    send: {$: send},
    choice: typeof raw.choice === 'string' ? raw.choice : '',
  };
}

const validText = (value) => typeof value === 'string' && value.length > 0;
const validOption = (option) => isPlainObject(option) && validText(option.label)
  && (option.value === undefined || typeof option.value === 'string');

/* O cartão guardado alimenta `publicCard`, que percorre opções e perguntas.
   Forma estrita aqui é o que impede um arquivo editado à mão de derrubar a
   abertura da conversa: o cartão ruim é IGNORADO, não vira cartão pela metade. */
function validCard(raw) {
  if (!isPlainObject(raw) || raw.schemaVersion !== SCHEMA_VERSION) return false;
  const card = /** @type {Record<string, any>} */ (raw);
  if (typeof card.id !== 'string' || !/^card-[0-9a-f-]{36}$/.test(card.id)) return false;
  if (card.kind !== 'quiz' && card.kind !== 'ask') return false;
  if (typeof card.session !== 'string' || !card.session || card.session.length > 4096) return false;
  if (!Number.isFinite(card.createdAt) || card.createdAt <= 0) return false;
  if (card.kind === 'quiz') {
    if (!validText(card.question)) return false;
    if (!Array.isArray(card.options) || !card.options.length || !card.options.every(validOption)) return false;
    if (!Array.isArray(card.correctValues) || !card.correctValues.every((value) => typeof value === 'string')) return false;
    for (const field of ['details', 'note', 'explanation']) {
      if (card[field] !== undefined && typeof card[field] !== 'string') return false;
    }
  } else {
    if (!Array.isArray(card.questions) || !card.questions.length) return false;
    for (const question of card.questions) {
      if (!isPlainObject(question) || !validText(question.question)) return false;
      if (question.header !== undefined && typeof question.header !== 'string') return false;
      if (!Array.isArray(question.options) || !question.options.every(validOption)) return false;
    }
  }
  return true;
}

/** @type {(area: string, line: string) => void} */
let invalidLog = () => {};
const loggedInvalid = new Set();
function reportInvalid(session, card, index) {
  const id = isPlainObject(card) && typeof card.id === 'string' ? card.id : `#${index + 1}`;
  const key = `${session}|${id}`;
  if (loggedInvalid.has(key)) return;
  loggedInvalid.add(key);
  const kind = isPlainObject(card) && typeof card.kind === 'string' ? card.kind : 'desconhecido';
  try { invalidLog('card', `cartão inválido ignorado (${kind}, ${id}); esperado quiz/perguntar completo`); } catch {}
}

/* Leitura tolerante: arquivo ausente/torto devolve lista vazia; nada é
   apagado aqui. O arquivo é reescrito na próxima mudança. Cartão que não passa
   na forma estrita é ignorado com uma linha no log. */
function readAll(runtime, session) {
  const file = fileOf(runtime, session);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') reportInvalid(session, null, 0);
    return [];
  }
  if (!isPlainObject(raw) || raw.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.cards)) return [];
  const out = [];
  raw.cards.forEach((card, index) => {
    if (!validCard(card) || card.session !== session) { reportInvalid(session, card, index); return; }
    out.push({...card, state: normalizeState(card.state), answer: isPlainObject(card.answer) ? card.answer : {}});
  });
  return out;
}

/** Liga o log de cartões ignorados (uma vez por processo).
 * @param {(area: string, line: string) => void} fn */
function setInvalidLog(fn) { invalidLog = typeof fn === 'function' ? fn : () => {}; }

function writeAll(runtime, session, cards) {
  const file = fileOf(runtime, session);
  if (!cards.length) {
    try { fs.unlinkSync(file); } catch {}
    return;
  }
  writeAtomic(file, {schemaVersion: SCHEMA_VERSION, session, cards});
}

function trim(cards) {
  if (cards.length <= MAX_CARDS) return cards;
  const keep = cards.slice(-MAX_CARDS);
  return keep;
}

/**
 * Lista pública dos cartões de uma conversa, na ordem de criação. Antes da
 * resposta, a resposta certa e a explicação não saem daqui.
 * @param {string} runtime
 * @param {string} session caminho da conversa (Pi JSONL ou descritor nativo/sidechat)
 * @returns {object[]}
 * @example listCards(runtime, '/r/pi-1.jsonl')
 */
function listCards(runtime, session) {
  return readAll(runtime, session).map(publicCard);
}

/**
 * Registra o cartão validado pelas ferramentas.
 * @param {string} runtime
 * @param {string} session
 * @param {any} normalized saída de `normalizeQuiz`/`normalizeAsk`
 * @returns {any} cartão público
 */
function createCard(runtime, session, normalized) {
  const cards = readAll(runtime, session);
  const card = {
    schemaVersion: SCHEMA_VERSION,
    id: cardId(),
    kind: normalized.kind,
    session,
    createdAt: Date.now(),
    state: quizCore.newCard(),
    answer: {},
    ...(normalized.kind === 'quiz' ? {
      question: normalized.question,
      details: normalized.details,
      note: normalized.note,
      explanation: normalized.explanation,
      options: normalized.options,
      multiSelect: normalized.multiSelect,
      correctValues: normalized.correctValues,
    } : {
      questions: normalized.questions,
    }),
  };
  writeAll(runtime, session, trim([...cards, card]));
  return publicCard(card);
}

function findCard(runtime, session, id) {
  return readAll(runtime, session).find((card) => card.id === id) || null;
}

function replace(runtime, session, card) {
  const cards = readAll(runtime, session).map((item) => (item.id === card.id ? card : item));
  writeAll(runtime, session, trim(cards));
}

/**
 * Guarda o rascunho (respostas parciais) sem marcar o cartão como respondido.
 * @param {string} runtime @param {string} session @param {string} id @param {object} draft
 * @returns {object|null} cartão público
 */
function saveDraft(runtime, session, id, draft) {
  const card = findCard(runtime, session, id);
  if (!card || card.state.answered || card.state.dismissed) return card ? publicCard(card) : null;
  card.draft = isPlainObject(draft) ? draft : {};
  replace(runtime, session, card);
  return publicCard(card);
}

function answerOf(card, raw) {
  if (card.kind === 'quiz') {
    const answer = normalizeQuizAnswer(card, raw);
    const correct = new Set((card.options || []).map((option, index) => (
      (card.correctValues || []).includes(option.value) ? index + 1 : null
    )).filter(Boolean));
    const selected = new Set(answer.selected);
    const hit = !answer.dontKnow && selected.size === correct.size && [...selected].every((index) => correct.has(index));
    return {answer: {...answer, text: ''}, correct: hit, choice: JSON.stringify(answer)};
  }
  const answers = normalizeAskAnswer(card, raw);
  return {answer: {answers}, correct: false, choice: JSON.stringify(answers)};
}

/**
 * Responde o cartão uma vez. Cartão já respondido não muda (a correção fica).
 * @param {string} runtime @param {string} session @param {string} id @param {object} raw
 * @returns {object|null} cartão público
 */
function answerCard(runtime, session, id, raw) {
  const card = findCard(runtime, session, id);
  if (!card) return null;
  /* Uma resposta só vale uma vez: IPC repetido (duplo clique, corrida com o
     reload) não reescreve a prova que o tutor vai receber. */
  if (card.state.answered || card.state.send?.$ === 'SendState.Sending') return publicCard(card);
  const {answer, correct, choice} = answerOf(card, raw);
  card.answer = answer;
  card.state = quizCore.answerCard(card.state, choice, correct);
  card.draft = {};
  replace(runtime, session, card);
  return publicCard(card);
}

/** Reserva o envio; não envia. @returns {any} */
function beginSend(runtime, session, id) {
  const card = findCard(runtime, session, id);
  if (!card) return {ok: false, code: 'missing'};
  const result = quizCore.concludeCard(card.state);
  if (result.$ !== 'Conclude.Start') {
    return {ok: false, code: String(result.$ || '').replace('Conclude.', '').toLowerCase(), card: publicCard(card)};
  }
  card.state = result.card;
  delete card.sendError;
  replace(runtime, session, card);
  return {ok: true, card: publicCard(card), text: resultText(card)};
}

/** Confirma o envio reservado; `Sending → Sent`. */
function confirmSend(runtime, session, id) {
  const card = findCard(runtime, session, id);
  if (!card) return null;
  card.state = quizCore.confirmSend(card.state);
  delete card.sendError;
  replace(runtime, session, card);
  return publicCard(card);
}

/** Recusa comprovada volta a `notSent`; incerteza continua `sending`. */
function abortSend(runtime, session, id, provenNotSent, error = '') {
  const card = findCard(runtime, session, id);
  if (!card) return null;
  card.state = quizCore.abortSend(card.state, provenNotSent === true);
  /* O motivo sobrevive ao reload: o cartão volta com Reenviar, não com um
     "Concluir" que esconde a tentativa que falhou. */
  if (error) card.sendError = String(error);
  else delete card.sendError;
  replace(runtime, session, card);
  return publicCard(card);
}

/** Dispensa sem chamar o tutor. */
function dismissCard(runtime, session, id) {
  const card = findCard(runtime, session, id);
  if (!card) return null;
  card.state = quizCore.dismissCard(card.state);
  replace(runtime, session, card);
  return publicCard(card);
}

module.exports = {
  SCHEMA_VERSION,
  DIR,
  fileOf,
  listCards,
  createCard,
  findCard,
  saveDraft,
  answerCard,
  beginSend,
  confirmSend,
  abortSend,
  dismissCard,
  publicCard,
  resultText,
  setInvalidLog,
};
