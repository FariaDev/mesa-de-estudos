/* O tutor propõe um card; só approved/edited entram no caderno. O diálogo, a
   ponte e os três motores compartilham o mesmo guia. */
import test from 'node:test';
import './keep-loop-alive.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const reviewCore = require('../src/generated/review.core.js').default;
const review = require('../review.cjs');
const {createReviewProposalHost} = require('../review-proposal-host.cjs');
const {createActivityBridge} = require('../activity-bridge.cjs');
const {message} = require('../src/i18n.mjs');
const {canonical, canonicalFields} = await import('../src/extensions/tool-fields.mjs');
const {REVIEW_DESCRIPTION, REVIEW_FIELDS, proposalText} = await import('../src/extensions/mesa-review/guide.mjs');
const {proposeReview} = await import('../src/extensions/mesa-review/client.mjs');
const {proposalDecision, showProposal} = await import('../src/review-proposal.mjs');
const {reviewTool, mesaTools} = await import('../src/extensions/mesa-mcp/tools.mjs');
const {createReviewTool, REVIEW_TOOL_NAME} = require('../src/agents/review-tool.cjs');
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');

const CARD = {question: 'Quanto é a derivada de x²?', attempt: '2x', difficulty: 'a regra'};
const REF = {name: 'Limites', page: 7, path: '/biblioteca/Limites.pdf'};

function fakeWindow() {
  const listeners = new Map();
  const win = {
    destroyed: false,
    sent: [],
    isDestroyed() { return this.destroyed; },
    webContents: {send: (channel, payload) => { win.sent.push({channel, payload}); }},
    on(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
    off(name, fn) { listeners.set(name, (listeners.get(name) || []).filter((item) => item !== fn)); },
    emit(name) { for (const fn of [...(listeners.get(name) || [])]) fn(); },
  };
  return win;
}

function harness({timeoutMs, deliver, windowOf} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-review-proposal-'));
  const win = fakeWindow();
  let current = true;
  const scope = {courseId: 'calc', conversationId: 's', freeSessionId: '', generation: 1};
  const host = createReviewProposalHost({
    window: windowOf || (() => win),
    scopeIsCurrent: (seen) => current && seen.courseId === scope.courseId && seen.generation === scope.generation,
    canReview: (seen) => seen.courseId !== 'mesa-free',
    save(seen, item) {
      if (!current) throw new Error(message('review.error.sessionChanged'));
      review.reviewSave(runtime, {courseId: seen.courseId, mode: 'add', item});
      return review.readItems(runtime, seen.courseId);
    },
    allowSender: (event) => event?.ok === true,
    timeoutMs,
    deliver,
  });
  return {runtime, win, scope, host, setCurrent: (value) => { current = value; }, stored: () => review.readItems(runtime, scope.courseId)};
}

function sentProposal(win) {
  return win.sent.filter((entry) => entry.channel === 'review-proposal');
}

test('proposalEnters só deixa entrar approved e edited', () => {
  assert.equal(reviewCore.proposalEnters('approved'), true);
  assert.equal(reviewCore.proposalEnters('edited'), true);
  for (const status of ['discarded', 'busy', 'pending', 'nope', '']) assert.equal(reviewCore.proposalEnters(status), false);
  assert.equal(Number(reviewCore.maxQuestion()), REVIEW_FIELDS.question.max);
  assert.equal(Number(reviewCore.maxAttempt()), REVIEW_FIELDS.attempt.max);
  assert.equal(Number(reviewCore.maxDifficulty()), REVIEW_FIELDS.difficulty.max);
});

test('proposalDecision separa aprovação, edição e descarte', () => {
  assert.equal(proposalDecision({returnValue: 'ok', dirty: false}), 'approved');
  assert.equal(proposalDecision({returnValue: 'ok', dirty: true}), 'edited');
  assert.equal(proposalDecision({returnValue: 'cancel', dirty: true}), 'discarded');
  assert.equal(proposalDecision(), 'discarded');
});

test('aprovado grava a versão do aluno, com a referência da página e sem o caminho para o agente', async () => {
  const box = harness();
  try {
    const pending = box.host.propose(box.scope, {...CARD, question: '  versão do tutor  ', ref: {path: '/segredo'}});
    assert.equal(sentProposal(box.win).length, 1);
    assert.equal(sentProposal(box.win)[0].payload.ref, undefined);
    const id = sentProposal(box.win)[0].payload.id;
    const ipc = box.host.respond({ok: true}, {id, status: 'approved', item: {question: '  versão do aluno  ', attempt: CARD.attempt, difficulty: CARD.difficulty, ref: REF}});
    const agent = await pending;
    assert.equal(agent.status, 'approved');
    assert.equal(agent.saved, true);
    assert.equal(agent.item.question, 'versão do aluno');
    assert.deepEqual(agent.item.ref, {name: 'Limites', page: 7});
    assert.equal('items' in agent, false);
    assert.equal(ipc.ok, true);
    assert.equal(ipc.items[0].ref.path, REF.path);
    assert.equal(box.stored()[0].ref.path, REF.path);
    assert.equal(box.host.pending.size, 0);
  } finally {
    fs.rmSync(box.runtime, {recursive: true, force: true});
  }
});

test('editado grava o texto do diálogo; descarte, ocupado, lixo e item sem questão não gravam', async () => {
  const box = harness();
  try {
    const edited = box.host.propose(box.scope, CARD);
    const id = sentProposal(box.win)[0].payload.id;
    box.host.respond({ok: true}, {id, status: 'edited', item: {...CARD, question: 'editada', ref: REF}});
    const agent = await edited;
    assert.equal(agent.status, 'edited');
    assert.equal(agent.item.question, 'editada');
    assert.equal(box.stored().length, 1);
    for (const status of ['discarded', 'busy', 'nope']) {
      const job = box.host.propose(box.scope, CARD);
      const proposalId = sentProposal(box.win).at(-1).payload.id;
      const ipc = box.host.respond({ok: true}, {id: proposalId, status, item: {...CARD, ref: REF}});
      const result = await job;
      assert.equal(result.saved, false);
      assert.equal(result.item, null);
      if (status === 'nope') assert.equal(ipc.ok, false);
      assert.equal(box.stored().length, 1);
    }
    const blank = box.host.propose(box.scope, CARD);
    const blankId = sentProposal(box.win).at(-1).payload.id;
    const invalid = box.host.respond({ok: true}, {id: blankId, status: 'approved', item: {question: '   ', ref: REF}});
    assert.equal(invalid.ok, false);
    assert.match(invalid.error, /review\.error\.itemInvalid/);
    assert.equal((await blank).reason, 'invalid');
    assert.equal(box.stored().length, 1);
  } finally {
    fs.rmSync(box.runtime, {recursive: true, force: true});
  }
});

test('uma proposta aberta recusa a seguinte, mesmo sem questão, e não manda outro diálogo', async () => {
  const box = harness();
  try {
    const first = box.host.propose(box.scope, CARD);
    const second = await box.host.propose(box.scope, {question: ''});
    assert.equal(second.status, 'busy');
    assert.equal(sentProposal(box.win).length, 1);
    assert.match(proposalText(second), /diálogo de revisão aberto/);
    box.host.respond({ok: true}, {id: sentProposal(box.win)[0].payload.id, status: 'discarded'});
    await first;
    await assert.rejects(box.host.propose(box.scope, {question: '  '}), /review\.error\.questionRequired/);
    assert.equal(box.host.pending.size, 0);
  } finally {
    fs.rmSync(box.runtime, {recursive: true, force: true});
  }
});

test('janela ausente, entrega falha, prazo, fechamento e cancelamento devolvem pendente sem gravar', async () => {
  const missing = harness({windowOf: () => null});
  try {
    const gone = await missing.host.propose(missing.scope, CARD);
    assert.deepEqual(gone, {proposed: true, status: 'pending', saved: false, item: null, reason: 'window'});
    missing.win.destroyed = true;
    const dead = harness({windowOf: () => missing.win});
    assert.equal((await dead.host.propose(dead.scope, CARD)).reason, 'window');
    fs.rmSync(dead.runtime, {recursive: true, force: true});
    const failed = harness({deliver: () => false});
    assert.equal((await failed.host.propose(failed.scope, CARD)).reason, 'window');
    assert.equal(failed.host.pending.size, 0);
    fs.rmSync(failed.runtime, {recursive: true, force: true});
    /* Prazo: o tutor ouve "pendente", mas o diálogo fica aberto. Fechar perderia
       a edição do aluno; aprovar depois ainda grava. */
    const timed = harness({timeoutMs: 20});
    const waited = await timed.host.propose(timed.scope, CARD);
    assert.equal(waited.reason, 'timeout');
    assert.ok(!timed.win.sent.some((entry) => entry.channel === 'review-proposal-cancel'), 'o prazo não fecha o diálogo');
    assert.equal((await timed.host.propose(timed.scope, CARD)).status, 'busy', 'com o diálogo aberto, outra proposta espera');
    const late = sentProposal(timed.win)[0].payload.id;
    const lateIpc = timed.host.respond({ok: true}, {id: late, status: 'edited', item: {...CARD, question: 'Editada depois do prazo', ref: REF}});
    assert.equal(lateIpc.saved, true);
    assert.equal(timed.stored().length, 1);
    assert.equal(timed.host.pending.size, 0);
    fs.rmSync(timed.runtime, {recursive: true, force: true});
    const closed = harness();
    const closing = closed.host.propose(closed.scope, CARD);
    closed.win.emit('closed');
    assert.equal((await closing).reason, 'window');
    fs.rmSync(closed.runtime, {recursive: true, force: true});
    const aborted = harness();
    const controller = new AbortController();
    const cancelling = aborted.host.propose(aborted.scope, CARD, {signal: controller.signal});
    controller.abort();
    assert.equal((await cancelling).reason, 'cancelled');
    assert.equal(aborted.stored().length, 0);
    assert.ok(!aborted.win.sent.some((entry) => entry.channel === 'review-proposal-cancel'), 'turno abortado não fecha o diálogo');
    aborted.host.respond({ok: true}, {id: sentProposal(aborted.win)[0].payload.id, status: 'discarded'});
    assert.equal(aborted.host.pending.size, 0);
    fs.rmSync(aborted.runtime, {recursive: true, force: true});
    assert.equal(missing.stored().length, 0);
  } finally {
    fs.rmSync(missing.runtime, {recursive: true, force: true});
  }
});

test('aba Livre, sessão velha e remetente estranho não gravam', async () => {
  const free = harness();
  free.scope.courseId = 'mesa-free';
  await assert.rejects(free.host.propose(free.scope, CARD), /review\.error\.free/);
  assert.equal(free.stored().length, 0);
  fs.rmSync(free.runtime, {recursive: true, force: true});
  const box = harness();
  try {
    await assert.rejects(box.host.propose({...box.scope, generation: 9}, CARD), /review\.error\.sessionChanged/);
    const job = box.host.propose(box.scope, CARD);
    const id = sentProposal(box.win)[0].payload.id;
    assert.throws(() => box.host.respond({ok: false}, {id, status: 'approved', item: {...CARD, ref: REF}}), /err\.ipc\.senderDenied/);
    assert.equal(box.host.pending.size, 1);
    box.setCurrent(false);
    const ipc = box.host.respond({ok: true}, {id, status: 'approved', item: {...CARD, ref: REF}});
    assert.equal(ipc.stale, true);
    assert.equal((await job).reason, 'session');
    assert.equal(box.stored().length, 0);
    box.setCurrent(true);
    const hanging = box.host.propose(box.scope, CARD);
    box.host.cancelAll('quit');
    assert.equal((await hanging).reason, 'quit');
    assert.equal(box.host.pending.size, 0);
  } finally {
    fs.rmSync(box.runtime, {recursive: true, force: true});
  }
});

test('o texto ao tutor traz a versão final sem o caminho', () => {
  const text = proposalText({status: 'edited', saved: true, item: {...CARD, ref: REF}});
  assert.match(text, /editou/);
  assert.match(text, new RegExp(CARD.question));
  assert.match(text, /Limites, p\. 7/);
  assert.equal(text.includes(REF.path), false);
  assert.match(proposalText({status: 'pending', reason: 'timeout'}), /ainda não respondeu.*continua aberto/);
  assert.match(proposalText({status: 'discarded'}), /descartou/);
});

test('a ponte /review-proposal devolve o veredito sem o caderno; sem o host a rota não existe', async () => {
  const seen = [];
  const bridge = createActivityBridge({
    publish: async () => ({}),
    reviewProposal: async (scope, raw) => {
      seen.push({scope, raw});
      return {proposed: true, status: 'approved', saved: true, item: {question: raw.question, ref: {name: 'A', page: 1}}, items: [{secret: true}]};
    },
  });
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'c', generation: 1, engine: 'pi'});
    const data = await proposeReview(grant, {...CARD, ref: {path: '/segredo'}});
    assert.equal(data.proposed, true);
    assert.equal(data.items, undefined);
    assert.equal(seen[0].raw.ref, undefined);
    assert.equal(seen[0].scope.conversationId, 'c');
    const forged = await fetch(grant.url.replace(/\/activity$/, '/review-proposal'), {method: 'POST', headers: {'content-type': 'application/json', 'x-mesa-token': 'outro'}, body: '{}'});
    assert.equal(forged.status, 403);
  } finally {
    await bridge.close();
  }
  const plain = createActivityBridge({publish: async () => ({})});
  await plain.start();
  try {
    const grant = plain.grant({conversationId: 'c', generation: 1, engine: 'pi'});
    const missing = await fetch(grant.url.replace(/\/activity$/, '/review-proposal'), {method: 'POST', headers: {'content-type': 'application/json', 'x-mesa-token': grant.token}, body: '{}'});
    assert.equal(missing.status, 404);
  } finally {
    await plain.close();
  }
  await assert.rejects(proposeReview(null, CARD), /sessão principal da Mesa/);
  await assert.rejects(proposeReview({url: 'http://example.com/activity', token: 't'}, CARD), /sessão principal da Mesa/);
});

test('o cliente não mente quando o prazo dele estoura', async () => {
  const bridge = createActivityBridge({publish: async () => ({}), reviewProposal: () => new Promise(() => {})});
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'c', generation: 1, engine: 'pi'});
    const data = await proposeReview(grant, CARD, {timeoutMs: 30});
    assert.deepEqual(data, {proposed: true, status: 'pending', saved: false, item: null, reason: 'timeout'});
  } finally {
    await bridge.close();
  }
});

test('OpenCode: propor_revisao usa o esquema do guia e o chat lateral fica com ler_pdf e buscar_material', async () => {
  const calls = [];
  const tool = reviewTool({grant: {url: 'http://127.0.0.1:1/activity', token: 't'}, propose: async (grant, args) => { calls.push({grant, args}); return {proposed: true, status: 'approved', saved: true, item: {...CARD, ref: {name: 'A', page: 3, path: '/segredo'}}}; }});
  assert.equal(tool.name, 'propor_revisao');
  assert.equal(tool.description, REVIEW_DESCRIPTION);
  assert.deepEqual(canonical(tool.inputSchema), canonicalFields(REVIEW_FIELDS));
  assert.match((await tool.call(CARD)).content[0].text, /A, p\. 3/);
  assert.equal((await tool.call(CARD)).content[0].text.includes('/segredo'), false);
  const grant = JSON.stringify({url: 'http://127.0.0.1:1/activity', token: 't'});
  const names = mesaTools({LEARNING_DESK_GGB_BRIDGE: '/r/ggb.json', LEARNING_DESK_ACTIVITY_BRIDGE: grant}).map((entry) => entry.name);
  assert.deepEqual(names, ['calcular', 'geogebra', 'previsualizar_atividade', 'criar_atividade', 'ver_figura', 'propor_revisao', 'ler_pdf', 'buscar_material', 'listar_materiais']);
  assert.deepEqual(mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: grant, LEARNING_DESK_PDF_ONLY: '1'}).map((entry) => entry.name), ['calcular', 'ler_pdf', 'buscar_material', 'listar_materiais']);
  assert.equal(calls[0].args.question, CARD.question);
});

async function toolNames(server) {
  const {Client} = await import('@modelcontextprotocol/sdk/client/index.js');
  const {InMemoryTransport} = await import('@modelcontextprotocol/sdk/inMemory.js');
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'mesa-review-contract', version: '1.0.0'});
  await server.instance.connect(b);
  await client.connect(a);
  try {
    return (await client.listTools()).tools.map((tool) => tool.name);
  } finally {
    await client.close();
    await server.instance.close();
  }
}

test('Claude: a ferramenta devolve a versão final e o erro marcado vira frase', async () => {
  const tool = await createReviewTool(async (args) => ({proposed: true, status: 'approved', saved: true, item: {question: args.question, attempt: 't', difficulty: 'd', ref: {name: 'A', page: 2, path: '/segredo'}}}));
  const ok = await tool.handler({question: 'Limite', attempt: 't', difficulty: 'd'}, {});
  assert.match(ok.content[0].text, /Limite/);
  assert.equal(ok.content[0].text.includes('/segredo'), false);
  const failing = await createReviewTool(async () => { throw new Error(message('review.error.free')); }, {language: 'en'});
  const failed = await failing.handler({question: 'Limite'}, {});
  assert.equal(failed.isError, true);
  assert.match(failed.content[0].text, /Free tab/);
  assert.equal(failed.content[0].text.includes('\uE000'), false);
  const {createStudyToolsServer} = require('../src/agents/study-tools.cjs');
  assert.deepEqual(await toolNames(await createStudyToolsServer({readPdf: async () => ({})})), ['calcular', 'ler_pdf']);
  assert.deepEqual(await toolNames(await createStudyToolsServer({readPdf: async () => ({}), searchMaterial: async () => ({})})), ['calcular', 'ler_pdf', 'buscar_material']);
  assert.deepEqual(await toolNames(await createStudyToolsServer({readPdf: async () => ({}), proposeReview: async () => ({})})), ['calcular', 'ler_pdf', 'propor_revisao']);
  assert.equal(REVIEW_TOOL_NAME, 'mcp__mesa__propor_revisao');
});

test('Claude: a sessão principal anuncia a ferramenta; o rascunho sem ferramentas não', async () => {
  const sdk = fx.fakeSdk();
  const adapter = new ClaudeAdapter({
    conversationId: 'review-proposal', cwd: process.cwd(), sdkLoader: async () => sdk, timeoutMs: 2000,
    proposeReview: async () => ({proposed: true, status: 'discarded', saved: false, item: null}),
  });
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    assert.ok(options.allowedTools.includes('mcp__mesa__*'));
    assert.equal((await options.canUseTool(REVIEW_TOOL_NAME, {question: 'Q'}, {})).behavior, 'allow');
    const hook = await options.hooks.PreToolUse[0].hooks[0]({tool_name: REVIEW_TOOL_NAME, tool_input: {question: 'Q'}});
    assert.equal(hook.continue, true);
    assert.equal(hook.hookSpecificOutput, undefined);
  } finally {
    adapter.close();
  }
  const quietSdk = fx.fakeSdk();
  const quiet = new ClaudeAdapter({
    conversationId: 'review-draft', cwd: process.cwd(), sdkLoader: async () => quietSdk, timeoutMs: 2000, noTools: true,
    proposeReview: async () => ({}), readPdf: async () => ({}),
  });
  try {
    await quiet._ensureQuery();
    assert.deepEqual(quietSdk.state.queries[0].options.mcpServers, {});
    assert.deepEqual(quietSdk.state.queries[0].options.tools, []);
  } finally {
    quiet.close();
  }
});

/* Diálogo de mentira: `showModal` marca a abertura, e `querySelector` pode falhar. */
function fakeProposalDialog({querySelector = () => null} = {}) {
  return {
    open: false,
    opened: false,
    _proposalId: '',
    showModal() { this.opened = true; },
    querySelector,
  };
}

test('proposta que falha antes do diálogo abrir responde discarded ao host e não fica pendurada', () => {
  const answers = [];
  const dialog = fakeProposalDialog();
  const respond = (answer) => { answers.push(answer); return Promise.resolve({ok: false}); };
  assert.throws(
    () => showProposal(dialog, {id: 'p1', question: 'Q'}, {fill: () => {}, openRef: () => { throw Error('sem página aberta'); }, respond, t: (key) => key}),
    /sem página aberta/,
  );
  assert.deepEqual(answers, [{id: 'p1', status: 'discarded'}]);
  assert.equal(dialog.opened, false);
  assert.equal(dialog._proposalId, '');
});

test('falha depois de marcar a proposta limpa o id pendente e também responde discarded', () => {
  const answers = [];
  const dialog = fakeProposalDialog({querySelector: () => { throw Error('formulário sumiu'); }});
  const respond = (answer) => { answers.push(answer); return Promise.resolve({ok: false}); };
  assert.throws(
    () => showProposal(dialog, {id: 'p2', question: 'Q'}, {fill: () => {}, openRef: () => ({}), respond, t: (key) => key}),
    /formulário sumiu/,
  );
  assert.deepEqual(answers, [{id: 'p2', status: 'discarded'}]);
  assert.equal(dialog._proposalId, '', 'o id da proposta que falhou não fica guardado');
  assert.equal(dialog.opened, false);
});
