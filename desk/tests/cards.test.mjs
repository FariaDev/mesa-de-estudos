/* Cartões `quiz`/`perguntar` (#92): validação, correção escondida, rascunho,
   envio no máximo uma vez e a rota `/card` da ponte. Sem Electron: o store é
   real num runtime temporário e o envio é fake. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {normalizeQuiz, normalizeAsk, normalizeQuizAnswer, normalizeAskAnswer} = await import('../src/cards/input.mjs');
const {publicCard, resultText} = await import('../src/cards/result.mjs');
const {createCardSession} = require('../card-session.cjs');
const cardStore = require('../card-store.cjs');
const quizCore = require('../src/generated/quizcard.core.js').default;
const {createActivityBridge} = require('../activity-bridge.cjs');
const {createCardTools} = require('../src/agents/card-tools.cjs');
const {registerTutorPromptHost} = require('../tutor-prompt-host.cjs');
const {mesaTools} = await import('../src/extensions/mesa-mcp/tools.mjs');
const {showCard} = await import('../src/cards/client.mjs');

function runtime() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-cards-'));
}

function quiz(overrides = {}) {
  return {question: 'Quanto é 2+2?', options: [{label: '3'}, {label: '4'}], correctAnswer: '4', explanation: 'Quatro.', ...overrides};
}

function sessionFor(tag, sendText = async () => ({sent: true, streaming: false})) {
  const dir = runtime();
  const sent = [];
  const events = [];
  const cards = createCardSession({
    runtime: dir,
    conversation: () => `/principal/${tag}.jsonl`,
    sendText: async (text) => { sent.push(text); return sendText(text); },
    emit: (payload) => events.push(payload),
  });
  return {dir, cards, sent, events, session: `/principal/${tag}.jsonl`};
}

test('quiz esconde a resposta certa até responder e conclui uma vez só', async () => {
  const h = sessionFor('quiz');
  const shown = h.cards.show({kind: 'quiz', args: quiz()});
  const before = h.cards.list()[0];
  assert.equal(before.correctIndices, undefined);
  assert.equal(before.explanation, undefined);
  assert.equal(before.answered, false);
  assert.equal(h.events.at(-1).type, 'shown');

  const answered = h.cards.answer({id: shown.id, answer: {selected: [2]}});
  assert.equal(answered.correct, true);
  assert.deepEqual(answered.correctIndices, [2]);
  assert.equal(answered.explanation, 'Quatro.');
  assert.deepEqual(answered.answer.selected, [2]);

  const first = await h.cards.conclude(shown.id);
  assert.equal(first.ok, true);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0], /Resultado do cartão/);
  assert.match(h.sent[0], /acertou/);
  assert.equal(h.cards.list()[0].sendState, 'sent');

  const second = await h.cards.conclude(shown.id);
  assert.equal(second.ok, false);
  assert.equal(h.sent.length, 1, 'não reenvia');
});

test('resposta errada, não sei, dispensa e rascunho sobrevivem ao disco', async () => {
  const h = sessionFor('estado');
  const shown = h.cards.show({kind: 'quiz', args: quiz()});
  h.cards.draft({id: shown.id, draft: {selected: [1]}});
  const reopened = createCardSession({runtime: h.dir, conversation: () => h.session, sendText: async () => ({sent: true})});
  assert.deepEqual(reopened.list()[0].draft.selected, [1]);

  const wrong = reopened.answer({id: shown.id, answer: {selected: [1]}});
  assert.equal(wrong.correct, false);
  assert.deepEqual(wrong.correctIndices, [2]);
  assert.deepEqual(reopened.list()[0].draft, {});

  const dont = h.cards.show({kind: 'quiz', args: quiz()});
  const unknown = h.cards.answer({id: dont.id, answer: {dontKnow: true}});
  assert.equal(unknown.correct, false);
  assert.equal(unknown.answered, true);

  const dismissed = h.cards.show({kind: 'quiz', args: quiz()});
  h.cards.dismiss({id: dismissed.id});
  const refused = await h.cards.conclude(dismissed.id);
  assert.equal(refused.ok, false);
  assert.equal(h.sent.length, 0, 'dispensado não envia');
});

test('cartão malformado no disco é ignorado sem derrubar a conversa, com log', async () => {
  const dir = runtime();
  const session = path.join(dir, 'pi-malformado.jsonl');
  const file = cardStore.fileOf(dir, session);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const good = {schemaVersion: 1, id: 'card-11111111-1111-4111-8111-111111111111', kind: 'quiz', session, createdAt: 1, state: quizCore.newCard(), answer: {}, question: 'ok?', options: [{label: 'a', value: 'a'}], correctValues: ['a'], multiSelect: false, explanation: ''};
  fs.writeFileSync(file, JSON.stringify({schemaVersion: 1, session, cards: [
    {...good, id: 'card-22222222-2222-4222-8222-222222222222', kind: 'ask', questions: [{question: 'sem options'}]},
    {...good, id: 'card-33333333-3333-4333-8333-333333333333', kind: 'quiz', options: 'não é lista'},
    good,
  ]}));
  const logs = [];
  const cards = createCardSession({runtime: dir, conversation: () => session, sendText: async () => ({sent: true}), appendLog: (area, line) => logs.push({area, line})});
  const list = cards.list();
  assert.equal(list.length, 1, 'só o cartão válido volta');
  assert.equal(list[0].id, good.id);
  assert.ok(logs.some(({area, line}) => area === 'card' && /inválido/.test(line)), 'o arquivo ruim fica registrado no log');
});

test('evento do cartão carrega a conversa dona mesmo se ela trocar durante o envio', async () => {
  const dir = runtime();
  let current = '/principal/A.jsonl';
  let finish;
  const events = [];
  const cards = createCardSession({
    runtime: dir,
    conversation: () => current,
    sendText: () => new Promise((resolve) => { finish = resolve; }),
    emit: (payload) => events.push(payload),
  });
  const shown = cards.show({kind: 'quiz', args: quiz()});
  assert.equal(events.at(-1).conversationId, current, 'shown já diz de quem é o cartão');
  cards.answer({id: shown.id, answer: {selected: [2]}});
  const pending = cards.conclude(shown.id);
  await new Promise((resolve) => setImmediate(resolve));
  current = '/principal/B.jsonl';
  finish({sent: true});
  await pending;
  const update = events.at(-1);
  assert.equal(update.type, 'update');
  assert.equal(update.conversationId, '/principal/A.jsonl', 'o desfecho é da conversa dona, nunca da aberta');
});

test('segunda resposta via IPC é ignorada (answered/sending não reescrevem)', async () => {
  const h = sessionFor('duplicada');
  const shown = h.cards.show({kind: 'quiz', args: quiz()});
  const first = h.cards.answer({id: shown.id, answer: {selected: [2]}});
  assert.equal(first.correct, true);
  const second = h.cards.answer({id: shown.id, answer: {selected: [1]}});
  assert.deepEqual(second.answer.selected, [2], 'a primeira resposta fica');
  assert.equal(second.correct, true);
  const reopened = createCardSession({runtime: h.dir, conversation: () => h.session, sendText: async () => ({sent: true})});
  assert.deepEqual(reopened.list()[0].answer.selected, [2], 'o disco também não muda');
  await reopened.conclude(shown.id);
  const late = reopened.answer({id: shown.id, answer: {selected: [1]}});
  assert.deepEqual(late.answer.selected, [2], 'depois de reservar o envio, resposta tardia não muda nada');
});

test('perguntar aceita opções ou texto livre e o resultado lista cada pergunta', async () => {
  const h = sessionFor('ask');
  const shown = h.cards.show({kind: 'ask', args: {questions: [
    {header: 'Ritmo', question: 'Como você resolveu?', options: [{label: 'Por partes'}], multiSelect: false},
    {question: 'Quer outro exemplo?', options: [{label: 'Sim'}, {label: 'Não'}], multiSelect: false},
  ]}});
  const answered = h.cards.answer({id: shown.id, answer: {answers: [{selected: ['Por partes'], text: ''}, {selected: [], text: 'Agora não'}]}});
  assert.equal(answered.answered, true);
  const result = await h.cards.conclude(shown.id);
  assert.equal(result.ok, true);
  assert.match(h.sent[0], /Pergunta 1: Como você resolveu\?/);
  assert.match(h.sent[0], /Resposta: Agora não/);
});

test('falha comprovada reabre o envio; incerteza fica reservada e não reenvia', async () => {
  const refused = sessionFor('recusa', async () => ({sent: false, retryable: true, uncertain: false, error: 'recusado'}));
  const shown = refused.cards.show({kind: 'quiz', args: quiz()});
  refused.cards.answer({id: shown.id, answer: {selected: [2]}});
  const first = await refused.cards.conclude(shown.id);
  assert.equal(first.ok, false);
  assert.equal(first.retryable, true);
  assert.equal(refused.cards.list()[0].sendState, 'notSent');
  await refused.cards.conclude(shown.id);
  assert.equal(refused.sent.length, 2, 'recusa comprovada permite repetir');

  const uncertain = sessionFor('incerto', async () => ({sent: false, retryable: false, uncertain: true, error: 'sem confirmação'}));
  const card = uncertain.cards.show({kind: 'quiz', args: quiz()});
  uncertain.cards.answer({id: card.id, answer: {selected: [2]}});
  const failed = await uncertain.cards.conclude(card.id);
  assert.equal(failed.ok, false);
  assert.equal(uncertain.cards.list()[0].sendState, 'sending');
  assert.equal((await uncertain.cards.conclude(card.id)).ok, false);
  assert.equal(uncertain.sent.length, 1, 'incerteza nunca reenvia sozinha');
});

test('sendText que lança não deixa o cartão preso em Enviando: volta a não enviado e pode reenviar', async () => {
  let attempts = 0;
  const dir = runtime();
  const cards = createCardSession({
    runtime: dir,
    conversation: () => '/principal/falha.jsonl',
    sendText: async () => { attempts += 1; throw Error('connect falhou antes da escrita'); },
  });
  const shown = cards.show({kind: 'quiz', args: quiz()});
  cards.answer({id: shown.id, answer: {selected: [2]}});
  const first = await cards.conclude(shown.id);
  assert.equal(first.ok, false);
  assert.equal(first.retryable, true, 'nada foi escrito: pode reenviar');
  assert.equal(cards.list()[0].sendState, 'notSent');
  assert.equal(cards.list()[0].dismissed, false);
  const second = await cards.conclude(shown.id);
  assert.equal(second.ok, false);
  assert.equal(attempts, 2, 'o botão Reenviar tenta de novo');
});

test('registro nativo ausente e troca de conversa são recusa comprovada (pode reenviar)', async () => {
  const dir = runtime();
  const ipcMain = {handle: () => {}};
  const live = {session: path.join(dir, 'conversations', 'claude-11111111-1111-4111-8111-111111111111.json'), bridge: null, languageHost: {t: (key) => key === 'quiz.wrongConversation' ? 'A conversa mudou; o resultado do cartão não foi enviado.' : key}};
  const host = registerTutorPromptHost({
    ipcMain, live, runtime: dir, FREE_ID: 'mesa-free', allowedXopp: new Set(),
    ggb: {newRequest() {}}, appendLog: () => {}, engine: () => 'claude',
    connect: async () => { throw Error('não deveria conectar sem registro'); },
    promptImages: () => [], validPdf: () => '', authorizePdfs: () => [],
    assertNoFreeMutation: () => {}, assertNoNav: () => {},
  });
  const missing = await host.sendText('[Resultado do cartão: card-x]');
  assert.equal(missing.sent, false);
  assert.equal(missing.retryable, true, 'registro apagado nada escreveu: o cartão pode reenviar');

  const other = await host.sendText('[Resultado do cartão: card-x]', {conversationId: '/outra/conversa.jsonl'});
  assert.equal(other.sent, false);
  assert.equal(other.retryable, true);
  assert.match(other.error, /conversa mudou/i);
});

test('troca de sessão em voo segura o resultado do cartão para reenviar', async () => {
  const dir = runtime();
  const ipcMain = {handle: () => {}};
  let blocked = true;
  const live = {session: path.join(dir, 'conversations', 'claude-11111111-1111-4111-8111-111111111111.json'), bridge: null, languageHost: {t: (key) => key}};
  const host = registerTutorPromptHost({
    ipcMain, live, runtime: dir, FREE_ID: 'mesa-free', allowedXopp: new Set(),
    ggb: {newRequest() {}}, appendLog: () => {}, engine: () => 'claude',
    connect: async () => { throw Error('não deveria conectar durante a troca'); },
    promptImages: () => [], validPdf: () => '', authorizePdfs: () => [],
    assertNoFreeMutation: () => {}, assertNoNav: () => { if (blocked) throw Error('Uma troca de sessão está em andamento.'); },
  });
  const held = await host.sendText('[Resultado do cartão: card-x]', {conversationId: live.session});
  assert.equal(held.sent, false, 'não escreve no meio da troca');
  assert.equal(held.retryable, true, 'o cartão pode tentar de novo');
  assert.match(held.error, /troca de sessão/);
  blocked = false;
  const missing = await host.sendText('[Resultado do cartão: card-x]', {conversationId: live.session});
  assert.equal(missing.sent, false);
  assert.equal(missing.retryable, true, 'depois da troca, o registro ausente continua reenviável');
});

test('normalização recusa quiz/pergunta incompletos e aceita resposta livre', () => {
  assert.throws(() => normalizeQuiz({question: 'x', options: [{label: 'a'}], correctAnswer: 'a'}), /options/);
  assert.throws(() => normalizeQuiz(quiz({correctAnswer: '5'})), /correctAnswer/);
  assert.throws(() => normalizeQuiz(quiz({options: [{label: 'a', value: 'x'}, {label: 'b', value: 'x'}], correctAnswer: 'x'})), /valor único/);
  const ask = normalizeAsk({questions: [{question: 'Como?', options: [{label: 'A', description: 'd'}]}]});
  assert.deepEqual(ask.questions[0].options, [{label: 'A', description: 'd'}]);
  assert.throws(() => normalizeAsk({questions: []}), /questions/);
  const card = normalizeQuiz(quiz());
  assert.deepEqual(normalizeQuizAnswer(card, {selected: [2]}), {selected: [2], dontKnow: false});
  assert.throws(() => normalizeQuizAnswer(card, {selected: [1, 2]}), /um índice/);
  assert.throws(() => normalizeAskAnswer(normalizeAsk({questions: [{question: 'x'}]}), {answers: [{selected: [], text: ''}]}), /um rótulo/);
});

test('a ponte /card devolve shown e encaminha escopo/args; sem host a rota não existe', async () => {
  const calls = [];
  const bridge = createActivityBridge({publish: async () => ({}), card: async (scope, raw, caller) => {
    calls.push({scope, raw, caller});
    return {id: 'card-1'};
  }});
  await bridge.start();
  const grant = bridge.grant({conversationId: '/principal/s.jsonl', courseId: 'C'}, {engine: 'pi'});
  try {
    const response = await fetch(grant.url.replace(/\/activity$/, '/card'), {
      method: 'POST', headers: {'content-type': 'application/json', 'x-mesa-token': grant.token},
      body: JSON.stringify({kind: 'quiz', args: quiz()}),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {shown: true, id: 'card-1'});
    assert.equal(calls[0].scope.conversationId, '/principal/s.jsonl');
    assert.equal(calls[0].raw.kind, 'quiz');
    const forged = await fetch(grant.url.replace(/\/activity$/, '/card'), {method: 'POST', headers: {'content-type': 'application/json', 'x-mesa-token': 'outro'}, body: '{}'});
    assert.equal(forged.status, 403);
  } finally { bridge.close(); }
  const plain = createActivityBridge({publish: async () => ({})});
  await plain.start();
  const grant2 = plain.grant({conversationId: '/principal/s.jsonl'});
  try {
    const missing = await fetch(grant2.url.replace(/\/activity$/, '/card'), {method: 'POST', headers: {'content-type': 'application/json', 'x-mesa-token': grant2.token}, body: '{}'});
    assert.equal(missing.status, 404);
  } finally { plain.close(); }
});

test('o portão de publicCard é a lei do núcleo (revealAllowed), não uma cópia do campo', () => {
  const state = {answered: false, correct: false, dismissed: false, send: {$: 'SendState.NotSent'}, choice: ''};
  const stored = {id: 'card-x', kind: 'quiz', createdAt: 1, state, options: [{label: 'a', value: 'a'}], correctValues: ['a'], explanation: 'SEGREDO'};
  const original = quizCore.revealAllowed;
  let calls = 0;
  quizCore.revealAllowed = (card) => { calls += 1; return original(card); };
  try {
    const hidden = publicCard(stored);
    assert.ok(calls > 0, 'publicCard chama a função provada do núcleo');
    assert.equal(hidden.explanation, undefined);
    assert.equal(hidden.correctIndices, undefined);
  } finally {
    quizCore.revealAllowed = original;
  }
});

test('resultText e publicCard não vazam a explicação antes da resposta', () => {
  const normalized = normalizeQuiz(quiz());
  assert.equal(normalized.correctValues[0], '4');
  const state = {answered: false, correct: false, dismissed: false, send: {$: 'SendState.NotSent'}, choice: ''};
  const stored = {id: 'card-x', kind: 'quiz', createdAt: 1, state, options: normalized.options, correctValues: normalized.correctValues};
  assert.equal(publicCard(stored).explanation, undefined);
  assert.match(resultText({...stored, question: '2+2?', explanation: 'Quatro.', answer: {selected: [2]}, state: {...state, answered: true, correct: true}}), /Explicação: Quatro/);
});

test('o cliente showCard manda kind/args para /card e recusa antes da rede', async () => {
  const calls = [];
  const fake = async (url, options) => {
    calls.push({url, body: JSON.parse(options.body)});
    return {ok: true, json: async () => ({shown: true, id: 'card-1'})};
  };
  const result = await showCard({url: 'http://127.0.0.1:9/activity', token: 't'}, 'quiz', quiz(), {fetchImpl: fake});
  assert.deepEqual(result, {shown: true, id: 'card-1'});
  assert.equal(calls[0].url, 'http://127.0.0.1:9/card');
  assert.equal(calls[0].body.kind, 'quiz');
  assert.equal(calls[0].body.args.correctAnswer, '4');
  await assert.rejects(() => showCard(null, 'quiz', quiz(), {fetchImpl: fake}), /sessão principal/);
  await assert.rejects(() => showCard({url: 'http://127.0.0.1:9/activity', token: 't'}, 'quiz', {question: 'x'}, {fetchImpl: fake}), /options/);
});

test('Claude e OpenCode registram quiz/perguntar e devolvem o cartão sem esperar', async () => {
  const shown = [];
  const claude = await createCardTools(async (kind, args) => { shown.push({kind, args}); return {id: `card-${kind}`}; });
  const quizCall = await claude[0].handler({...quiz()}, {});
  assert.equal(quizCall.isError, undefined);
  assert.match(quizCall.content[0].text, /Mostrado ao aluno/);
  assert.deepEqual(quizCall.details, {cardId: 'card-quiz'});
  assert.equal(shown[0].kind, 'quiz');
  const ask = await claude[1].handler({questions: [{question: 'Como?'}]}, {});
  assert.equal(ask.details.cardId, 'card-ask');

  const fetched = [];
  const fake = async (url, options) => { fetched.push(JSON.parse(options.body)); return {ok: true, json: async () => ({shown: true, id: 'card-oc'})}; };
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    const tools = mesaTools({LEARNING_DESK_PDF_ONLY: '1', LEARNING_DESK_CARD_BRIDGE: JSON.stringify({url: 'http://127.0.0.1:9/activity', token: 't'})});
    assert.deepEqual(tools.map((tool) => tool.name), ['calcular', 'quiz', 'perguntar']);
    const result = await tools.find((tool) => tool.name === 'quiz').call(quiz());
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.details, {cardId: 'card-oc'});
    assert.equal(fetched[0].kind, 'quiz');
  } finally { globalThis.fetch = original; }
});

test('arquivo de cartões com JSON quebrado fica no log e não derruba a conversa', () => {
  const dir = runtime();
  const session = path.join(dir, 'pi-json-quebrado.jsonl');
  const file = cardStore.fileOf(dir, session);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, '{isto não é json');
  const logs = [];
  const cards = createCardSession({runtime: dir, conversation: () => session, sendText: async () => ({sent: true}), appendLog: (area, line) => logs.push({area, line})});
  assert.deepEqual(cards.list(), []);
  assert.ok(logs.some(({area, line}) => area === 'card' && /inválido/.test(line)), 'JSON quebrado também é registrado');
});
