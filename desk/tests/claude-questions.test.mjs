/* Perguntas estruturadas do Claude Code, aviso de limite e avisos de atividade
 * (desk/src/claude-questions.mjs).
 *
 * Tudo sintético: nenhum SDK, binário, credencial, sessão, rede ou inferência;
 * nenhum arquivo do runtime é lido/escrito. O módulo é puro (sem DOM), então o
 * teste importa direto. O último teste ancora os códigos canônicos no
 * adaptador real (somente leitura) para o contrato não divergir em silêncio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

import * as core from '../src/claude-questions.mjs';
import {
  ACTIVITY_NOTICE_CODES,
  MAX_ANSWER_CHARS,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MAX_TEXT_CHARS,
  RATE_LIMIT_CODES,
  claudeActivityNotice,
  claudeLimitNotice,
  compileQuestionAnswers,
  deskErrorIsFatal,
  limitNoticeState,
  questionRequest,
  questionSubmitAction,
} from '../src/claude-questions.mjs';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const CANONICAL = deepFreeze({
  id: 'q-1',
  method: 'question',
  title: 'Pergunta do Claude Code',
  message: 'Preciso de duas decisões',
  questions: [
    {
      id: 'Qual caminho seguir?',
      header: 'Rota',
      question: 'Qual caminho seguir?',
      options: [
        {label: 'Curto', description: 'menos passos'},
        {label: 'Longo', description: ''},
      ],
      multiSelect: false,
    },
    {
      id: 'Quais fontes usar?',
      header: 'Fontes',
      question: 'Quais fontes usar?',
      options: [
        {label: 'PDF do curso', description: 'material da matéria'},
        {label: 'Anotações', description: 'rascunho .xopp'},
      ],
      multiSelect: true,
    },
  ],
});

test('questionRequest preserva o pedido canônico exatamente (rótulos com espaço, ordem, multiSelect)', () => {
  const request = questionRequest(CANONICAL);
  assert.equal(request.ok, true);
  assert.equal(request.reason, null);
  assert.equal(request.questions.length, 2);
  assert.deepEqual(request.questions, [
    {
      header: 'Rota',
      question: 'Qual caminho seguir?',
      options: [
        {label: 'Curto', description: 'menos passos'},
        {label: 'Longo', description: ''},
      ],
      multiSelect: false,
    },
    {
      header: 'Fontes',
      question: 'Quais fontes usar?',
      options: [
        {label: 'PDF do curso', description: 'material da matéria'},
        {label: 'Anotações', description: 'rascunho .xopp'},
      ],
      multiSelect: true,
    },
  ]);

  /* A lista crua (sem o envelope do evento) também é aceita — é o campo
     `questions` do `extension_ui_request`. */
  assert.deepEqual(questionRequest(CANONICAL.questions).questions, request.questions);
  /* multiSelect só liga com o booleano exato: 1/"true" não viram verdadeiro. */
  const loose = questionRequest([{question: 'Q?', options: [], multiSelect: 1}]);
  assert.equal(loose.questions[0].multiSelect, false);
  /* Header ausente ganha o mesmo rótulo neutro do adaptador, sem inventar
     pergunta: o texto da pergunta continua o do pedido. */
  const noHeader = questionRequest([{question: '  Q com espaços  ', options: []}]);
  assert.deepEqual(noHeader.questions[0], {header: 'Pergunta 1', question: '  Q com espaços  ', options: [], multiSelect: false});
});

test('questionRequest recusa pedido impossível de responder inteiro (nada de resposta parcial)', () => {
  const cases = [
    [undefined, 'empty'],
    [null, 'empty'],
    [[], 'empty'],
    [{}, 'empty'],
    [{questions: []}, 'empty'],
    [{questions: 'q'}, 'empty'],
    [[null], 'invalid'],
    [[{}], 'invalid'],
    [[{question: '   '}], 'invalid'],
    [[{question: 'Q?', options: [{description: 'sem label'}]}], 'invalid'],
    [[{question: 'Q?', options: [null]}], 'invalid'],
    [[{question: 'Q?', options: 'x'}], 'valid-options-optional'],
    [[{question: 'Q?', options: [{label: '   '}]}], 'invalid'],
  ];
  for (const [source, reason] of cases) {
    const request = questionRequest(source);
    if (reason === 'valid-options-optional') {
      /* `options` ausente/estranho não derruba: a pergunta fica só com texto
         livre (o adaptador não exige opções). */
      assert.equal(request.ok, true, `fonte ${JSON.stringify(source)}`);
      assert.deepEqual(request.questions[0].options, []);
      continue;
    }
    assert.equal(request.ok, false, `fonte ${JSON.stringify(source)}`);
    assert.equal(request.reason, reason, `fonte ${JSON.stringify(source)}`);
    assert.deepEqual(request.questions, []);
  }
});

test('questionRequest cabe no teto de conteúdo (pergunta/opção/descrição)', () => {
  const many = Array.from({length: MAX_QUESTIONS + 1}, (_, index) => ({question: `Q${index}?`}));
  assert.equal(questionRequest(many).reason, 'bounded');
  assert.equal(questionRequest(many.slice(0, MAX_QUESTIONS)).ok, true);

  const manyOptions = [{question: 'Q?', options: Array.from({length: MAX_OPTIONS + 1}, (_, index) => ({label: `O${index}`}))}];
  assert.equal(questionRequest(manyOptions).reason, 'bounded');
  assert.equal(questionRequest([{question: 'Q?', options: manyOptions[0].options.slice(0, MAX_OPTIONS)}]).ok, true);

  assert.equal(questionRequest([{question: 'x'.repeat(MAX_TEXT_CHARS + 1)}]).reason, 'bounded');
  assert.equal(questionRequest([{question: 'Q?', header: 'x'.repeat(MAX_TEXT_CHARS + 1)}]).reason, 'bounded');
  assert.equal(questionRequest([{question: 'Q?', options: [{label: 'x'.repeat(MAX_TEXT_CHARS + 1)}]}]).reason, 'bounded');
  assert.equal(questionRequest([{question: 'Q?', options: [{label: 'ok', description: 'x'.repeat(MAX_TEXT_CHARS + 1)}]}]).reason, 'bounded');
});

test('compileQuestionAnswers: opção única vira string; multiSelect vira lista sem repetição', () => {
  const compiled = compileQuestionAnswers(CANONICAL.questions, [
    {selected: ['Longo'], text: ''},
    {selected: ['PDF do curso', 'Anotações', 'PDF do curso'], text: ''},
  ]);
  assert.equal(compiled.ok, true);
  assert.deepEqual(compiled.errors, []);
  assert.deepEqual(compiled.answers, {
    'Qual caminho seguir?': 'Longo',
    'Quais fontes usar?': ['PDF do curso', 'Anotações'],
  });
});

test('compileQuestionAnswers: texto livre vence opções, é trimado e vale para única e múltipla', () => {
  const single = compileQuestionAnswers(CANONICAL.questions, [
    {selected: ['Curto'], text: '  pelo mapa  '},
    {selected: [], text: ''},
  ]);
  /* Texto presente na 1ª; a 2ª sem resposta continua faltando. */
  assert.equal(single.ok, false);
  assert.equal(single.answers, null);
  assert.deepEqual(single.errors.map((error) => error.index), [1]);

  const multi = compileQuestionAnswers([CANONICAL.questions[1]], [{selected: ['PDF do curso'], text: ' outras'}]);
  assert.equal(multi.ok, true);
  assert.deepEqual(multi.answers, {'Quais fontes usar?': 'outras'});
});

test('compileQuestionAnswers: exige ao menos uma resposta por pergunta e ignora seleção desconhecida', () => {
  const questions = CANONICAL.questions;
  const empty = compileQuestionAnswers(questions, []);
  assert.equal(empty.ok, false);
  assert.equal(empty.answers, null);
  assert.deepEqual(empty.errors.map((error) => [error.index, error.code]), [[0, 'missing'], [1, 'missing']]);

  const unknown = compileQuestionAnswers([questions[0]], [{selected: ['Inexistente'], text: ''}]);
  assert.equal(unknown.ok, false);
  assert.deepEqual(unknown.errors, [{index: 0, code: 'missing', message: 'Escolha uma opção ou escreva uma resposta.'}]);

  const many = compileQuestionAnswers([questions[0]], [{selected: ['Curto', 'Longo'], text: ''}]);
  assert.equal(many.ok, false);
  assert.deepEqual(many.errors, [{index: 0, code: 'multiple', message: 'Escolha apenas uma opção.'}]);

  const long = compileQuestionAnswers([questions[0]], [{selected: [], text: 'x'.repeat(MAX_ANSWER_CHARS + 1)}]);
  assert.equal(long.ok, false);
  assert.deepEqual(long.errors.map((error) => error.code), ['long']);

  /* Pergunta sem opções: só texto livre responde. */
  const open = compileQuestionAnswers([{question: 'Comente.', options: [], multiSelect: false}], [{selected: [], text: 'ok'}]);
  assert.equal(open.ok, true);
  assert.deepEqual(open.answers, {'Comente.': 'ok'});
  assert.equal(compileQuestionAnswers([{question: 'Comente.', options: []}], [{selected: [], text: '  '}]).ok, false);

  /* Sem perguntas não há resposta válida (não fecha diálogo vazio). */
  assert.equal(compileQuestionAnswers([], []).ok, false);
});

test('compileQuestionAnswers: texto de pergunta vira chave PRÓPRIA mesmo sendo __proto__/constructor (sem perder resposta)', () => {
  const questions = [
    {question: '__proto__', options: [], multiSelect: false},
    {question: 'constructor', options: [], multiSelect: false},
    {question: 'toString', options: [], multiSelect: false},
    {question: 'hasOwnProperty', options: [{label: 'sim', description: ''}], multiSelect: true},
  ];
  const compiled = compileQuestionAnswers(questions, [
    {selected: [], text: 'resposta proto'},
    {selected: [], text: 'resposta construtor'},
    {selected: [], text: 'resposta tostring'},
    {selected: ['sim'], text: ''},
  ]);
  assert.equal(compiled.ok, true);
  /* A chave `__proto__` não pode sumir pelo setter do protótipo: precisa ser
     propriedade própria, enumerável e de valor. */
  assert.deepEqual(Object.keys(compiled.answers), ['__proto__', 'constructor', 'toString', 'hasOwnProperty']);
  const proto = Object.getOwnPropertyDescriptor(compiled.answers, '__proto__');
  assert.deepEqual({enumerable: proto.enumerable, writable: proto.writable, configurable: proto.configurable, value: proto.value}, {enumerable: true, writable: true, configurable: true, value: 'resposta proto'});
  assert.equal(compiled.answers.__proto__, 'resposta proto');
  assert.equal(compiled.answers.constructor, 'resposta construtor');
  assert.equal(compiled.answers.toString, 'resposta tostring');
  assert.deepEqual(compiled.answers.hasOwnProperty, ['sim']);
  /* Continua sendo um objeto simples (protótipo intacto): o IPC/JSON não vê
     nada de anômalo. */
  assert.equal(Object.getPrototypeOf(compiled.answers), Object.prototype);
  const roundTrip = JSON.parse(JSON.stringify(compiled.answers));
  assert.equal(Object.getOwnPropertyDescriptor(roundTrip, '__proto__').value, 'resposta proto');
  assert.deepEqual(Object.keys(roundTrip), Object.keys(compiled.answers));
});

test('questionSubmitAction: Cancelar fecha SEMPRE (mesmo vazio); só o Responder exige respostas; Enter cai no Responder', () => {
  const questions = CANONICAL.questions;
  /* Cancelar com formulário vazio: nenhuma validação, nenhum erro. */
  assert.deepEqual(questionSubmitAction(questions, [], 'cancel'), {action: 'cancel', answers: null, errors: []});
  /* O caminho do Responder (o keydown do Enter clica `#dialog-ok`) exige. */
  const missing = questionSubmitAction(questions, [], 'ok');
  assert.equal(missing.action, 'invalid');
  assert.equal(missing.answers, null);
  assert.deepEqual(missing.errors.map((error) => [error.index, error.code]), [[0, 'missing'], [1, 'missing']]);
  /* Sem submitter identificado (requestSubmit() direto), mantém o exigente. */
  assert.equal(questionSubmitAction(questions, [], null).action, 'invalid');
  assert.equal(questionSubmitAction(questions, [], undefined).action, 'invalid');
  /* Respondido por completo devolve o mesmo formato do compile. */
  const answers = questionSubmitAction(questions, [
    {selected: ['Longo'], text: ''},
    {selected: ['Anotações'], text: ''},
  ], 'ok');
  assert.equal(answers.action, 'answers');
  assert.deepEqual(answers.errors, []);
  assert.deepEqual(answers.answers, {'Qual caminho seguir?': 'Longo', 'Quais fontes usar?': ['Anotações']});
  /* Cancelar depois de responder também cancela (não responde pela metade). */
  assert.equal(questionSubmitAction(questions, [{selected: ['Longo'], text: ''}, {selected: [], text: ''}], 'cancel').action, 'cancel');
  /* Sem perguntas, o cancelar continua cancelando; o Responder não fecha. */
  assert.equal(questionSubmitAction([], [], 'cancel').action, 'cancel');
  assert.equal(questionSubmitAction([], [], 'ok').action, 'invalid');
});

test('claudeLimitNotice classifica código e metadados canônicos, sem mutar a entrada', () => {
  const blocked = claudeLimitNotice(deepFreeze({
    type: 'desk_warn',
    code: RATE_LIMIT_CODES.blocked,
    message: 'Limite atingido (janela de 5 horas). A execução fica pausada até o limite reiniciar em 20min.',
    rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 1770000000, blocked: true, window: 'janela de 5 horas'},
  }));
  assert.deepEqual(blocked, {
    kind: 'blocked',
    key: 'blocked:five_hour:t:1770000000000',
    message: 'Limite atingido (janela de 5 horas). A execução fica pausada até o limite reiniciar em 20min.',
    window: 'five_hour:t:1770000000000',
    type: 'five_hour',
    reset: 't:1770000000000',
  });

  const warning = claudeLimitNotice({code: RATE_LIMIT_CODES.warning, message: 'Atenção: perto do limite.'});
  assert.deepEqual(warning, {
    kind: 'warning',
    key: 'warning:Atenção: perto do limite.:unknown',
    message: 'Atenção: perto do limite.',
    window: 'Atenção: perto do limite.:unknown',
    type: '',
    reset: '',
  });

  const overage = claudeLimitNotice({rateLimit: {status: 'rejected', type: 'seven_day', resetsAt: 123, blocked: false}});
  assert.equal(overage.kind, 'overage');
  assert.equal(overage.message, 'Limite atingido, mas a execução continua usando overage.');
  assert.equal(overage.reset, 't:123000');

  const statusWarning = claudeLimitNotice({rateLimit: {status: 'allowed_warning', type: 'five_hour'}});
  assert.equal(statusWarning.kind, 'warning');
  assert.equal(statusWarning.window, 'five_hour:unknown');

  /* `type` ausente cai no rótulo humano da janela, sem inventar identidade. */
  const labelled = claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, rateLimit: {status: 'rejected', window: 'janela de 5 horas', blocked: true}});
  assert.equal(labelled.type, 'janela de 5 horas');

  /* Liberação: RESUMED (transição nativa), CLEARED (compatibilidade) e
     `status:'allowed'` têm o mesmo efeito e preservam tipo/reset. */
  const resumed = claudeLimitNotice({
    code: RATE_LIMIT_CODES.resumed,
    message: 'Limite de uso liberado (janela de 5 horas).',
    rateLimit: {status: 'allowed', type: 'five_hour', resetsAt: 1770000000, blocked: false, resumed: true},
  });
  assert.deepEqual(resumed, {kind: 'cleared', key: 'cleared', message: '', window: '', type: 'five_hour', reset: 't:1770000000000'});
  assert.deepEqual(claudeLimitNotice({code: RATE_LIMIT_CODES.cleared}), {kind: 'cleared', key: 'cleared', message: '', window: '', type: '', reset: ''});
  assert.deepEqual(claudeLimitNotice({rateLimit: {status: 'allowed', type: 'five_hour'}}), {kind: 'cleared', key: 'cleared', message: '', window: '', type: 'five_hour', reset: ''});
  assert.deepEqual(claudeLimitNotice({rateLimit: {resumed: true, type: 'seven_day'}}), {kind: 'cleared', key: 'cleared', message: '', window: '', type: 'seven_day', reset: ''});

  assert.equal(claudeLimitNotice({type: 'desk_warn', message: 'linha torta no stdout do Pi'}), null);
  assert.equal(claudeLimitNotice({code: 'CLAUDE_OUTRA_COISA', message: 'x'}), null);
  assert.equal(claudeLimitNotice(null), null);
  assert.equal(claudeLimitNotice('texto'), null);

  /* Mesma janela/reset ⇒ mesma chave (o chat deduplica); janela nova ⇒ chave
     nova; sem metadados, a mensagem identifica a janela. */
  const again = claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, message: blocked.message, rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 1770000000, blocked: true}});
  assert.equal(again.key, blocked.key);
  const later = claudeLimitNotice({rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 1770009999, blocked: true}});
  assert.notEqual(later.key, blocked.key);
  const iso = claudeLimitNotice({rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: new Date(1770000000 * 1000).toISOString(), blocked: true}});
  assert.equal(iso.reset, blocked.reset, 'ISO do mesmo instante e epoch nativo compartilham a identidade de reset');
  assert.equal(iso.key, blocked.key);
});

test('limitNoticeState: limpar uma janela liberada NÃO esconde a outra janela rejeitada', () => {
  const blocked = claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, message: 'Bloqueado (5h).', rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 100, blocked: true}});
  const warning = claudeLimitNotice({code: RATE_LIMIT_CODES.warning, message: 'Perto do limite (7d).', rateLimit: {status: 'allowed_warning', type: 'seven_day', resetsAt: 200}});
  const first = limitNoticeState([], blocked, 'conversa-1');
  assert.equal(first.visible.key, blocked.key);
  assert.equal(first.entries.length, 1);
  const both = limitNoticeState(first.entries, warning, 'conversa-1');
  assert.equal(both.entries.length, 2);
  /* O mais grave visível continua sendo o bloqueio. */
  assert.equal(both.visible.key, blocked.key);
  /* Liberar a janela de aviso nem toca no bloqueio. */
  const stillBlocked = limitNoticeState(both.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.resumed, rateLimit: {status: 'allowed', type: 'seven_day'}}), 'conversa-1');
  assert.equal(stillBlocked.entries.length, 1);
  assert.equal(stillBlocked.visible.key, blocked.key);
  /* Liberar a janela bloqueada deixa a outra visível (nada some à toa). */
  const remaining = limitNoticeState(stillBlocked.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.resumed, rateLimit: {status: 'allowed', type: 'five_hour'}}), 'conversa-1');
  assert.deepEqual(remaining.entries, []);
  assert.equal(remaining.visible, null);

  /* Reset diferente na MESMA janela não é limpo por engano. */
  const stored = limitNoticeState([], blocked, 'c');
  const wrongReset = limitNoticeState(stored.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.resumed, rateLimit: {status: 'allowed', type: 'five_hour', resetsAt: 999}}), 'c');
  assert.equal(wrongReset.entries.length, 1);
  /* ISO do mesmo instante do reset numérico LIMPA a janela. */
  const isoCleared = limitNoticeState(stored.entries, claudeLimitNotice({rateLimit: {status: 'allowed', type: 'five_hour', resetsAt: new Date(100 * 1000).toISOString()}}), 'c');
  assert.deepEqual(isoCleared.entries, []);

  /* Liberação sem tipo limpa todas as janelas da conversa, sem tocar em outra. */
  const other = limitNoticeState(both.entries, warning, 'outra-conversa');
  assert.equal(other.entries.length, 3);
  const clearedAll = limitNoticeState(other.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.cleared}), 'conversa-1');
  assert.equal(clearedAll.entries.length, 1);
  assert.equal(clearedAll.entries[0].conversationId, 'outra-conversa');
  assert.equal(clearedAll.visible, null, 'a conversa limpa não vê aviso alheio');

  /* Substituir a mesma janela troca mensagem/chave sem duplicar entrada. */
  const replaced = limitNoticeState(stored.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, message: 'Bloqueio repetido.', rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 100, blocked: true}}), 'c');
  assert.equal(replaced.entries.length, 1);
  assert.equal(replaced.visible.message, 'Bloqueio repetido.');
  /* A entrada original não é mutada. */
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0].message, 'Bloqueado (5h).');
});

test('claudeActivityNotice: retry/overload/fallback/recusa viram faixa+toast concisos e deduplicáveis', () => {
  const retry = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'Retry nativo.', detail: {attempt: 2, maxRetries: 5, retryDelayMs: 1500, errorStatus: null}});
  assert.deepEqual(retry, {
    kind: 'retry',
    code: 'CLAUDE_API_RETRY',
    key: 'retry:2::O Claude Code está repetindo a chamada à API (tentativa 2 de 5).',
    message: 'O Claude Code está repetindo a chamada à API (tentativa 2 de 5).',
  });
  /* O mesmo attempt deduplica; o attempt seguinte tem chave nova. */
  const retryAgain = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'x', detail: {attempt: 2, maxRetries: 5}});
  assert.equal(retryAgain.key, retry.key);
  const retryNext = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'x', detail: {attempt: 3, maxRetries: 5}});
  assert.notEqual(retryNext.key, retry.key);
  /* Sem detail, o texto do adaptador continua valendo. */
  const retryText = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'O Claude Code está repetindo uma chamada à API.'});
  assert.equal(retryText.message, 'O Claude Code está repetindo uma chamada à API.');
  /* dedupeKey do host vence a composição local. */
  const deduped = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, detail: {attempt: 9, maxRetries: 9, dedupeKey: 'api_retry:9:529:none'}});
  assert.match(deduped.key, /api_retry:9:529:none/);

  const overloaded = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.overloaded, message: 'API sobrecarregada (529).'});
  assert.equal(overloaded.kind, 'overloaded');
  assert.equal(overloaded.message, 'API sobrecarregada (529).');
  assert.equal(claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.overloaded}).message, 'A API do Claude está sobrecarregada; a execução tenta de novo.');

  const fallback = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.fallback, message: 'Modelo de segurança respondeu.', detail: {retractedMessageUuids: ['u1'], retractedCount: 1}});
  assert.equal(fallback.kind, 'fallback');
  assert.equal(fallback.message, 'Modelo de segurança respondeu.');
  const fallbackModel = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.fallback, detail: {fallbackModel: 'claude-sonnet'}});
  assert.equal(fallbackModel.message, 'Modelo alternativo em uso: claude-sonnet.');

  const refusal = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.refusal, message: 'o modelo recusou a solicitação (cyber)'});
  assert.equal(refusal.kind, 'refusal');
  assert.equal(refusal.message, 'o modelo recusou a solicitação (cyber)');
  assert.equal(claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.refusal}).message, 'O modelo recusou a solicitação.');

  /* Aviso de limite não é aviso de atividade (e vice-versa): cada classificador
     só responde pelo seu contrato. */
  assert.equal(claudeActivityNotice({code: RATE_LIMIT_CODES.blocked, message: 'x'}), null);
  assert.equal(claudeLimitNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'x'}), null);
  assert.equal(claudeActivityNotice({type: 'desk_warn', message: 'linha torta'}), null);
  assert.equal(claudeActivityNotice(null), null);
});

test('deskErrorIsFatal: só o `fatal:false` exato deixa o turno seguir sem derrubar conexão/busy/fila', () => {
  assert.equal(deskErrorIsFatal(undefined), true);
  assert.equal(deskErrorIsFatal(null), true);
  assert.equal(deskErrorIsFatal({}), true);
  assert.equal(deskErrorIsFatal({fatal: true}), true);
  assert.equal(deskErrorIsFatal({fatal: false}), false);
  assert.equal(deskErrorIsFatal({fatal: 'false'}), true, 'só o booleano exato vale');
  assert.equal(deskErrorIsFatal({fatal: 0}), true);
});

test('a lista de perguntas nunca sai do formato do contrato (id = texto, answers = string|lista)', () => {
  /* O adaptador responde `{id, answers}`; aqui prova-se que o formato gerado
     pelo formulário casa com o validador do adaptador: pergunta conhecida,
     nenhuma faltando, nenhuma string vazia. */
  const request = questionRequest(CANONICAL);
  const compiled = compileQuestionAnswers(request.questions, [
    {selected: ['Curto'], text: ''},
    {selected: ['Anotações'], text: ''},
  ]);
  assert.equal(compiled.ok, true);
  const keys = Object.keys(compiled.answers);
  assert.deepEqual(keys, request.questions.map((question) => question.question));
  for (const [question, value] of Object.entries(compiled.answers)) {
    assert.ok(request.questions.some((entry) => entry.question === question));
    const values = Array.isArray(value) ? value : [value];
    assert.ok(values.length > 0);
    for (const entry of values) assert.equal(typeof entry, 'string');
  }
});

test('módulo é puro: sem imports, DOM, timers, rede ou ambiente', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/claude-questions.mjs', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const banned of ['require(', 'import(', 'import ', 'document.', 'window.', 'setTimeout', 'setInterval', 'fetch(', 'process.env', 'node:fs', 'node:net', 'node:http', 'localStorage']) {
    assert.equal(source.includes(banned), false, `não pode conter ${banned}`);
  }
  for (const name of [
    'MAX_QUESTIONS', 'MAX_OPTIONS', 'MAX_TEXT_CHARS', 'MAX_ANSWER_CHARS', 'RATE_LIMIT_CODES', 'ACTIVITY_NOTICE_CODES',
    'questionRequest', 'compileQuestionAnswers', 'questionSubmitAction', 'claudeLimitNotice', 'limitNoticeState',
    'claudeActivityNotice', 'deskErrorIsFatal',
  ]) {
    assert.ok(name in core, `exporta ${name}`);
  }
});

test('contrato do aviso de limite casa com os códigos do adaptador pinado', {skip: !existsSync(fileURLToPath(new URL('../src/agents/claude-adapter.cjs', import.meta.url)))}, () => {
  /* Somente leitura: ancora os códigos do módulo no adaptador real (donde vêm
     os eventos `warning`) para uma renomeação não passar em silêncio. */
  const source = readFileSync(fileURLToPath(new URL('../src/agents/claude-adapter.cjs', import.meta.url)), 'utf8');
  assert.match(source, /CLAUDE_RATE_LIMITED/);
  assert.match(source, /CLAUDE_RATE_LIMIT_WARNING/);
  assert.match(source, /CLAUDE_RATE_LIMIT_OVERAGE/);
  assert.match(source, /CLAUDE_RATE_LIMIT_RESUMED/);
  assert.match(source, /CLAUDE_API_RETRY/);
  assert.match(source, /CLAUDE_OVERLOADED/);
  assert.match(source, /CLAUDE_MODEL_REFUSAL/);
  assert.equal(RATE_LIMIT_CODES.blocked, 'CLAUDE_RATE_LIMITED');
  assert.equal(RATE_LIMIT_CODES.warning, 'CLAUDE_RATE_LIMIT_WARNING');
  assert.equal(RATE_LIMIT_CODES.overage, 'CLAUDE_RATE_LIMIT_OVERAGE');
  assert.equal(RATE_LIMIT_CODES.resumed, 'CLAUDE_RATE_LIMIT_RESUMED');
  assert.equal(ACTIVITY_NOTICE_CODES.retry, 'CLAUDE_API_RETRY');
  assert.equal(ACTIVITY_NOTICE_CODES.overloaded, 'CLAUDE_OVERLOADED');
  assert.equal(ACTIVITY_NOTICE_CODES.refusal, 'CLAUDE_MODEL_REFUSAL');
});
