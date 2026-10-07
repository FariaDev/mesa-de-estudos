/* Testes do chat lateral (backend puro): isolamento, escopo/id antigo,
   cancelamento independente, persistência/contexto e entregas ambíguas.
   Nenhum Electron, nenhum motor real: os canais são fakes injetados; o Pi real
   de teste (fake-pi.mjs) fica em sidechat-pi.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createSideChatManager, conversationList, normalizeRefs, MAX_DRAFT, descriptorPath, sidechatsDir} = require('../sidechat.cjs');

const PDF = '/biblioteca/Limites.pdf';
const PDF2 = '/biblioteca/Formulario.pdf';

function newRuntime(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `mesa-sidechat-${tag}-`));
}

class FakeEngine {
  constructor({id, onEvent, behavior = 'ok'}) {
    this.id = id;
    this.onEvent = onEvent;
    this.behavior = behavior;
    this.prompts = [];
    this.aborts = 0;
    this.responses = [];
    this.closes = 0;
    this.busy = false;
    this.uncertain = false;
    this.release = null;
    this.reject = null;
    this.history = [];
  }
  emit(event) {
    this.onEvent(event);
  }
  async prompt({text, readPaths = [], running}) {
    this.prompts.push({text, readPaths, running});
    if (this.behavior === 'refuse') {
      const error = Error('recusa de teste antes do aceite');
      error.notSent = true;
      throw error;
    }
    if (this.behavior === 'ambiguous') throw Error('transmissão sem confirmação');
    if (this.behavior === 'hang') {
      this.busy = true;
      return new Promise((resolve, reject) => {
        this.release = resolve;
        this.reject = reject;
      });
    }
    this.busy = true;
    if (this.behavior === 'echo-before') {
      /* Pi real emite `message_end` role=user com o texto que foi ao motor. */
      this.emit({type: 'message_end', message: {role: 'user', content: [{type: 'text', text}]}});
      return {accepted: true};
    }
    if (this.behavior === 'echo-assistant-before') {
      this.emit({type: 'message_end', message: {role: 'user', content: [{type: 'text', text}]}});
      this.emit({type: 'message_end', message: {role: 'assistant', content: [{type: 'text', text: 'resposta antes do aceite'}]}});
      return {accepted: true};
    }
    if (this.behavior === 'instant') {
      /* Turno inteiro síncrono: eco do usuário, assistant e settled ANTES de a
         promessa do envio resolver. */
      this.emit({type: 'message_end', message: {role: 'user', content: [{type: 'text', text}]}});
      this.emit({type: 'message_end', message: {role: 'assistant', content: [{type: 'text', text: 'turno inteiro'}]}});
      this.busy = false;
      this.emit({type: 'agent_settled'});
      return {accepted: true};
    }
    return {accepted: true};
  }
  async abort() {
    this.aborts += 1;
    this.busy = false;
    return {aborted: true};
  }
  respond(data) {
    this.responses.push(data);
    return {ok: true};
  }
  close() {
    this.closes += 1;
    this.busy = false;
    if (this.reject) this.reject(Error('canal encerrado'));
  }
  isBusy() {
    return this.busy;
  }
  isUncertain() {
    return this.uncertain === true;
  }
  messages() {
    return this.history;
  }
}

function harness({tag = 'geral', engine = 'pi'} = {}) {
  const runtime = newRuntime(tag);
  const state = {session: '/principal/pi-1.jsonl', courseId: 'Calculo I', engine};
  const allowed = new Set([PDF, PDF2]);
  const emitted = [];
  const engines = new Map();
  const behaviors = new Map();
  let defaultBehavior = 'ok';
  let clock = 1000;
  let snapshots = 0;
  const deps = {
    runtime,
    current: () => ({...state}),
    snapshot: ({refs}) => {
      snapshots += 1;
      const at = ++clock;
      const key = JSON.stringify([state.session, refs.map((ref) => `${ref.path}#${ref.page}`), at]);
      const digest = `[Contexto do chat lateral]\n- conversa principal: ${state.session}\n[Chat principal até aqui]\nvocê: resumo ${at}`;
      return {mainSession: state.session, refs, study: {title: 'Lista 1', xopp: ''}, at, digest, key};
    },
    validPdf: (value) => {
      if (!allowed.has(value)) throw Error('Escolha um PDF pela biblioteca ou pelo seletor.');
      return value;
    },
    createEngine: ({id, engine: engineName, descriptor, onEvent}) => {
      const channel = new FakeEngine({id, onEvent, behavior: behaviors.get(id) || defaultBehavior});
      channel.engineName = engineName;
      channel.descriptor = descriptor;
      engines.set(id, channel);
      return channel;
    },
    emit: (payload) => emitted.push(payload),
    log: () => {},
    now: () => ++clock,
  };
  const manager = createSideChatManager(deps);
  return {
    runtime,
    state,
    allowed,
    emitted,
    engines,
    manager,
    deps,
    behaviors,
    snapshotCalls: () => snapshots,
    setDefaultBehavior: (value) => {
      defaultBehavior = value;
    },
  };
}

function waitFor(predicate, timeoutMs = 2000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve(true);
      if (Date.now() - start > timeoutMs) return reject(Error('waitFor: tempo esgotado'));
      setTimeout(check, 5);
    };
    check();
  });
}

test('open cria o chat lateral com contexto, sem iniciar motor, e persiste índice/descritor', () => {
  const h = harness({tag: 'open'});
  const payload = h.manager.open({refs: [{path: PDF, page: 7}]});
  assert.match(payload.id, /^sc-/);
  assert.equal(payload.engine, 'pi');
  assert.deepEqual(payload.messages, []);
  assert.equal(payload.draft, '');
  assert.equal(payload.busy, false);
  assert.equal(payload.uncertain, false);
  assert.equal(payload.context.mainSession, h.state.session);
  assert.deepEqual(payload.context.refs, [{path: PDF, page: 7}]);
  assert.equal(payload.context.study.title, 'Lista 1');
  assert.equal(h.engines.size, 0, 'abrir não pode iniciar o motor');
  const descriptor = h.manager.peek(payload.id);
  assert.equal(descriptor.delivery, null);
  assert.ok(descriptor.context.digest.includes('[Contexto do chat lateral]'));
  assert.ok(fs.existsSync(descriptorPath(h.runtime, payload.id)));
  const index = JSON.parse(fs.readFileSync(path.join(sidechatsDir(h.runtime), 'index.json'), 'utf8'));
  assert.equal(index.mapping[h.state.session], payload.id);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('prompt persiste transmitting antes de escrever, manda o contexto uma vez e aceita o envio seguinte ocioso', async () => {
  const h = harness({tag: 'prompt'});
  const opened = h.manager.open({refs: [{path: PDF, page: 3}]});
  const engine = h.manager;
  const result = await engine.prompt({id: opened.id, text: 'Explica o passo 2'});
  assert.deepEqual(result, {sent: true, id: opened.id, engine: 'pi', streaming: true});
  const channel = h.engines.get(opened.id);
  assert.equal(channel.prompts.length, 1);
  assert.ok(channel.prompts[0].text.includes('[Contexto do chat lateral]'), 'o primeiro envio leva o contexto');
  assert.ok(channel.prompts[0].text.endsWith('Explica o passo 2'));
  assert.deepEqual(channel.prompts[0].readPaths, [PDF]);
  const afterFirst = h.manager.peek(opened.id);
  assert.equal(afterFirst.delivery.status, 'accepted');
  /* Sem fila/follow-up: o próximo envio só sai depois do terminal do turno
     (aqui simulado como no Pi real: settled com a ponte já ociosa). */
  channel.busy = false;
  channel.emit({type: 'agent_settled'});
  assert.equal(h.manager.peek(opened.id).delivery.status, 'settled');
  const second = await engine.prompt({id: opened.id, text: 'E o passo 3?'});
  assert.equal(second.sent, true);
  assert.equal(channel.prompts[1].text, 'E o passo 3?', 'contexto igual não é reenviado');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('o envio é marcado como transmitting no disco ANTES de o motor ser chamado', async () => {
  const h = harness({tag: 'before-send'});
  const opened = h.manager.open({});
  const observed = [];
  const originalPrompt = FakeEngine.prototype.prompt;
  FakeEngine.prototype.prompt = async function patched(...args) {
    observed.push(h.manager.peek(opened.id).delivery.status);
    return originalPrompt.apply(this, args);
  };
  try {
    await h.manager.prompt({id: opened.id, text: 'oi'});
  } finally {
    FakeEngine.prototype.prompt = originalPrompt;
  }
  assert.deepEqual(observed, ['transmitting']);
  assert.equal(h.manager.peek(opened.id).delivery.status, 'accepted');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('recusa comprovada mantém o contexto pendente para a próxima tentativa', async () => {
  const h = harness({tag: 'refuse'});
  const opened = h.manager.open({});
  h.behaviors.set(opened.id, 'refuse');
  const refused = await h.manager.prompt({id: opened.id, text: 'primeira'});
  assert.deepEqual(refused, {sent: false, retryable: true, uncertain: false, error: 'recusa de teste antes do aceite'});
  const descriptor = h.manager.peek(opened.id);
  assert.equal(descriptor.delivery.status, 'refused');
  assert.equal(descriptor.contextDeliveredKey, '', 'recusa não marca o contexto como entregue');
  assert.deepEqual(descriptor.messages, [], 'recusa comprovada não entra no histórico de exibição');
  h.engines.get(opened.id).behavior = 'ok';
  const second = await h.manager.prompt({id: opened.id, text: 'segunda'});
  assert.equal(second.sent, true);
  const channel = h.engines.get(opened.id);
  assert.ok(channel.prompts[1].text.includes('[Contexto do chat lateral]'), 'a tentativa nova leva o contexto de novo');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('entrega ambígua vira incerta, sobrevive ao reinício e nunca é reenviada sozinha', async () => {
  const h = harness({tag: 'ambiguous'});
  const opened = h.manager.open({});
  h.behaviors.set(opened.id, 'ambiguous');
  const result = await h.manager.prompt({id: opened.id, text: 'talvez chegou'});
  assert.equal(result.sent, false);
  assert.equal(result.retryable, false);
  assert.equal(result.uncertain, true);
  assert.equal(h.manager.peek(opened.id).delivery.status, 'uncertain');
  h.manager.suspend('reinício');
  const restarted = createSideChatManager(h.deps);
  const payload = restarted.read({id: opened.id});
  assert.equal(payload.uncertain, true);
  assert.equal(payload.delivery.status, 'uncertain');
  assert.equal(payload.messages.length, 1, 'a mensagem explícita continua no histórico de exibição');
  assert.equal(h.engines.get(opened.id).prompts.length, 1, 'ler depois do reinício não chama o motor de novo');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('Claude com entrega incerta bloqueia novo envio sem cair para Pi', async () => {
  const h = harness({tag: 'claude-uncertain', engine: 'claude'});
  const opened = h.manager.open({});
  assert.equal(opened.engine, 'claude');
  const descriptor = h.manager.peek(opened.id);
  descriptor.delivery = {id: 'm1', status: 'uncertain', at: 1};
  fs.writeFileSync(descriptorPath(h.runtime, opened.id), JSON.stringify(descriptor));
  h.manager.suspend('limpar');
  const restarted = createSideChatManager(h.deps);
  const blocked = await restarted.prompt({id: opened.id, text: 'de novo'});
  assert.equal(blocked.sent, false);
  assert.equal(blocked.retryable, false);
  assert.equal(blocked.uncertain, true);
  assert.equal(h.engines.size, 0, 'bloqueado não cria motor nenhum (nem Pi)');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('id de outra conversa/matéria é recusado e evento antigo não infecta a conversa nova', async () => {
  const h = harness({tag: 'stale'});
  const first = h.manager.open({});
  await h.manager.prompt({id: first.id, text: 'na conversa 1'});
  const firstChannel = h.engines.get(first.id);
  h.state.session = '/principal/pi-2.jsonl';
  assert.throws(() => h.manager.read({id: first.id}), /não pertence à conversa atual/);
  const staleBefore = h.emitted.filter((payload) => payload.id === first.id).length;
  firstChannel.emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'stale'}});
  assert.equal(h.emitted.filter((payload) => payload.id === first.id).length, staleBefore, 'canal da conversa antiga não entrega evento');
  const second = h.manager.open({});
  assert.notEqual(second.id, first.id);
  await h.manager.prompt({id: second.id, text: 'na conversa 2'});
  const secondChannel = h.engines.get(second.id);
  assert.ok(secondChannel, 'o canal do novo chat nasce no primeiro envio');
  secondChannel.emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'nova'}});
  assert.equal(h.emitted.filter((payload) => payload.id === second.id).length, 1);
  assert.equal(h.emitted.filter((payload) => payload.id === first.id).length, staleBefore);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('eventos só saem pelo canal ativo da conversa atual', async () => {
  const h = harness({tag: 'events'});
  const opened = h.manager.open({});
  await h.manager.prompt({id: opened.id, text: 'oi'});
  const channel = h.engines.get(opened.id);
  channel.emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'olá'}});
  channel.emit({type: 'message_end', message: {role: 'assistant', content: [{type: 'text', text: 'olá'}]}});
  channel.emit({type: 'agent_settled'});
  assert.deepEqual(h.emitted.map((payload) => payload.event.type), ['message_update', 'message_end', 'agent_settled']);
  assert.equal(h.emitted[1].id, opened.id);
  assert.equal(h.emitted[1].engine, 'pi');
  const descriptor = h.manager.peek(opened.id);
  assert.equal(descriptor.delivery.status, 'settled');
  assert.deepEqual(descriptor.messages.at(-1), {role: 'assistant', content: [{type: 'text', text: 'olá'}]});
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('abort cancela só o canal lateral e preserva histórico/draft do principal', async () => {
  const h = harness({tag: 'abort'});
  const opened = h.manager.open({});
  await h.manager.save({id: opened.id, draft: 'rascunho do lateral'});
  await h.manager.prompt({id: opened.id, text: 'mensagem'});
  const channel = h.engines.get(opened.id);
  const result = await h.manager.abort({id: opened.id});
  assert.deepEqual(result, {aborted: true, result: {aborted: true}});
  assert.equal(channel.aborts, 1);
  assert.equal(h.state.session, '/principal/pi-1.jsonl', 'a sessão principal não muda');
  assert.equal(h.manager.read({id: opened.id}).draft, 'rascunho do lateral');
  const beforeClose = h.manager.peek(opened.id);
  assert.equal(beforeClose.messages.length, 1, 'o histórico do lateral é preservado no abort');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('suspend marca envio em voo como incerto, fecha o canal e não perde o descritor', async () => {
  const h = harness({tag: 'suspend'});
  const opened = h.manager.open({});
  h.behaviors.set(opened.id, 'hang');
  const pending = h.manager.prompt({id: opened.id, text: 'em voo'});
  await waitFor(() => h.manager.peek(opened.id).delivery?.status === 'transmitting');
  const channel = h.engines.get(opened.id);
  const {closed} = h.manager.suspend('troca de matéria');
  assert.equal(closed, 1);
  assert.equal(channel.closes, 1);
  await pending;
  const descriptor = h.manager.peek(opened.id);
  assert.equal(descriptor.delivery.status, 'uncertain');
  assert.ok(fs.existsSync(descriptorPath(h.runtime, opened.id)), 'o descritor antigo continua recuperável');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('contexto explícito troca refs validadas, reenvia o bloco novo e recusa PDF fora da biblioteca', async () => {
  const h = harness({tag: 'context'});
  const opened = h.manager.open({refs: [{path: PDF, page: 1}]});
  await h.manager.prompt({id: opened.id, text: 'primeira'});
  const channel = h.engines.get(opened.id);
  channel.busy = false;
  channel.emit({type: 'agent_settled'});
  const updated = h.manager.context({id: opened.id, refs: [{path: PDF2, page: 9}]});
  assert.deepEqual(updated.context.refs, [{path: PDF2, page: 9}]);
  await h.manager.prompt({id: opened.id, text: 'segunda'});
  assert.ok(channel.prompts[1].text.includes('[Contexto do chat lateral]'), 'atualização explícita reenvia o bloco');
  assert.deepEqual(channel.prompts[1].readPaths, [PDF2]);
  assert.throws(() => h.manager.context({id: opened.id, refs: [{path: '/invasor.pdf', page: 1}]}), /biblioteca|seletor/);
  assert.throws(() => h.manager.open({refs: [{path: PDF, page: 1}, {path: PDF2, page: 2}, {path: PDF, page: 3}]}), /no máximo duas/);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('draft é próprio, limitado e sobrevive ao reinício', () => {
  const h = harness({tag: 'draft'});
  const opened = h.manager.open({});
  const big = 'x'.repeat(MAX_DRAFT + 50);
  const saved = h.manager.save({id: opened.id, draft: big});
  assert.equal(saved.draft.length, MAX_DRAFT);
  assert.throws(() => h.manager.save({id: opened.id, draft: 42}), /Rascunho inválido/);
  h.manager.suspend('reinício');
  const restarted = createSideChatManager(h.deps);
  assert.equal(restarted.read({id: opened.id}).draft.length, MAX_DRAFT);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('mensagem grande demais e id inválido são recusados antes de qualquer escrita', async () => {
  const h = harness({tag: 'limits'});
  const opened = h.manager.open({});
  await assert.rejects(() => h.manager.prompt({id: opened.id, text: 'x'.repeat(MAX_DRAFT + 1)}), /grande demais/);
  await assert.rejects(() => h.manager.prompt({id: 'sc-nope', text: 'oi'}), /Chat lateral inválido|não encontrado/);
  assert.equal(h.engines.size, 0);
  assert.equal(h.manager.peek(opened.id).delivery, null);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('permissões/perguntas são roteadas ao canal certo e ids alheios são recusados', async () => {
  const h = harness({tag: 'permissions'});
  const opened = h.manager.open({});
  await h.manager.prompt({id: opened.id, text: 'com permissão'});
  const channel = h.engines.get(opened.id);
  channel.emit({type: 'extension_ui_request', id: 'pedido-1', method: 'confirm', title: 'Permitir?'});
  const ok = h.manager.respond({id: opened.id, response: {id: 'pedido-1', confirmed: true}});
  assert.deepEqual(ok, {ok: true});
  assert.deepEqual(channel.responses, [{id: 'pedido-1', confirmed: true}]);
  assert.throws(() => h.manager.respond({id: opened.id, response: {id: 'pedido-2', confirmed: true}}), /Nenhum|pendente/);
  h.manager.suspend('troca');
  assert.throws(() => h.manager.respond({id: opened.id, response: {id: 'pedido-1', confirmed: true}}), /Nenhum pedido pendente/);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('fresh cria um chat novo para a mesma conversa sem apagar o antigo', () => {
  const h = harness({tag: 'fresh'});
  const first = h.manager.open({});
  h.manager.save({id: first.id, draft: 'antigo'});
  const second = h.manager.open({fresh: true});
  assert.notEqual(second.id, first.id);
  assert.ok(fs.existsSync(descriptorPath(h.runtime, first.id)), 'o antigo fica preservado');
  const index = JSON.parse(fs.readFileSync(path.join(sidechatsDir(h.runtime), 'index.json'), 'utf8'));
  assert.equal(index.mapping[h.state.session], second.id);
  h.manager.suspend('reinício');
  const restarted = createSideChatManager(h.deps);
  assert.equal(restarted.open({}).id, second.id, 'sem fresh, retoma o apontado no índice');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('o chat lateral nunca escreve na sessão do principal', async () => {
  const h = harness({tag: 'main-untouched'});
  const mainFile = path.join(h.runtime, 'principal.jsonl');
  const original = '{"type":"message","message":{"role":"user","content":[{"type":"text","text":"histórico do principal"}]}}\n';
  fs.writeFileSync(mainFile, original);
  h.state.session = mainFile;
  const opened = h.manager.open({refs: [{path: PDF, page: 1}]});
  await h.manager.prompt({id: opened.id, text: 'pergunta lateral'});
  await h.manager.save({id: opened.id, draft: 'rascunho lateral'});
  h.manager.context({id: opened.id, refs: [{path: PDF2, page: 2}]});
  assert.equal(fs.readFileSync(mainFile, 'utf8'), original, 'a sessão principal fica byte a byte');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('fresh com canal antigo ativo fecha o antigo e não deixa evento velho vazar', async () => {
  const h = harness({tag: 'fresh-active'});
  const first = h.manager.open({});
  await h.manager.prompt({id: first.id, text: 'primeira'});
  const firstChannel = h.engines.get(first.id);
  const second = h.manager.open({fresh: true});
  assert.equal(firstChannel.closes, 1, 'o canal antigo é fechado ao abrir um novo');
  const staleBefore = h.emitted.filter((payload) => payload.id === first.id).length;
  firstChannel.emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'velho'}});
  assert.equal(h.emitted.filter((payload) => payload.id === first.id).length, staleBefore);
  await h.manager.prompt({id: second.id, text: 'segunda'});
  const secondChannel = h.engines.get(second.id);
  secondChannel.emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'novo'}});
  assert.equal(h.emitted.filter((payload) => payload.id === second.id).length, 1, 'o canal novo entrega eventos');
  assert.equal(h.manager.peek(first.id).delivery.status, 'accepted', 'aceite antigo não regride');
  assert.ok(fs.existsSync(descriptorPath(h.runtime, first.id)), 'o chat antigo fica preservado');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('fresh com envio em voo marca o chat antigo como incerto', async () => {
  const h = harness({tag: 'fresh-inflight'});
  const first = h.manager.open({});
  h.behaviors.set(first.id, 'hang');
  const pending = h.manager.prompt({id: first.id, text: 'em voo'});
  await waitFor(() => h.manager.peek(first.id).delivery?.status === 'transmitting');
  const second = h.manager.open({fresh: true});
  assert.notEqual(second.id, first.id);
  assert.equal(h.manager.peek(first.id).delivery.status, 'uncertain', 'envio em voo não fica transmitting para sempre');
  await pending;
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('reabrir retoma o snapshot original; só context() atualiza explicitamente', async () => {
  const h = harness({tag: 'resume-snapshot'});
  const first = h.manager.open({refs: [{path: PDF, page: 7}]});
  const original = h.manager.peek(first.id);
  assert.equal(h.snapshotCalls(), 1, 'a abertura copia o principal uma vez');
  /* O principal avançou: um snapshot novo teria at/key/digest diferentes. */
  const again = h.manager.open({refs: [{path: PDF2, page: 9}]});
  assert.equal(again.id, first.id, 'sem fresh, retoma o mesmo chat');
  assert.equal(h.snapshotCalls(), 1, 'reabrir NÃO recopia o principal');
  assert.deepEqual(again.context.refs, [{path: PDF, page: 7}], 'refs continuam as da abertura');
  assert.equal(again.context.at, original.context.at);
  const after = h.manager.peek(first.id);
  assert.equal(after.context.key, original.context.key, 'a chave do snapshot não muda ao reabrir');
  assert.equal(after.context.digest, original.context.digest, 'o digest não muda ao reabrir');
  h.manager.suspend('reinício');
  const restarted = createSideChatManager(h.deps);
  const resumed = restarted.open({refs: [{path: PDF2, page: 9}]});
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.context.at, original.context.at, 'o reinício também não recopia');
  assert.equal(h.snapshotCalls(), 1);
  await restarted.prompt({id: first.id, text: 'primeira'});
  const channel = h.engines.get(first.id);
  assert.ok(channel.prompts[0].text.includes(original.context.digest), 'o primeiro envio leva o snapshot original');
  channel.busy = false;
  channel.emit({type: 'agent_settled'});
  const updated = restarted.context({id: first.id, refs: [{path: PDF2, page: 9}]});
  assert.equal(h.snapshotCalls(), 2, 'context() é a atualização explícita');
  assert.equal(updated.context.at > original.context.at, true);
  assert.deepEqual(updated.context.refs, [{path: PDF2, page: 9}]);
  await restarted.prompt({id: first.id, text: 'segunda'});
  assert.ok(channel.prompts[1].text.includes('[Contexto do chat lateral]'), 'a atualização explícita reenvia o bloco');
  assert.ok(channel.prompts[1].text.includes(restarted.peek(first.id).context.digest), 'o bloco reenviado é o snapshot atualizado');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('open recupera transmitting de execução anterior e libera novo envio (não só read)', async () => {
  const h = harness({tag: 'open-recover'});
  const first = h.manager.open({});
  h.behaviors.set(first.id, 'hang');
  const pending = h.manager.prompt({id: first.id, text: 'em voo'});
  await waitFor(() => h.manager.peek(first.id).delivery?.status === 'transmitting');
  h.manager.suspend('queda simulada');
  await pending.catch(() => {});
  const onDisk = h.manager.peek(first.id);
  onDisk.delivery = {id: onDisk.delivery.id, status: 'transmitting', at: onDisk.delivery.at};
  fs.writeFileSync(descriptorPath(h.runtime, first.id), JSON.stringify(onDisk));
  const enginesBefore = h.engines.size;
  const restarted = createSideChatManager(h.deps);
  const recovered = restarted.open({});
  assert.equal(recovered.id, first.id, 'open retoma o descritor do índice');
  assert.equal(recovered.uncertain, true, 'open recupera a entrega em voo (nunca fica transmitting eterno)');
  assert.equal(recovered.delivery.status, 'uncertain');
  assert.equal(recovered.busy, false);
  assert.equal(h.engines.size, enginesBefore, 'recuperar no open não inicia motor');
  assert.equal(h.snapshotCalls(), 1, 'recuperar no open não recopia o principal');
  h.behaviors.set(first.id, 'ok');
  const sent = await restarted.prompt({id: first.id, text: 'depois da queda'});
  assert.equal(sent.sent, true, 'depois de recuperar, o envio explícito é permitido no Pi');
  assert.equal(sent.streaming, true);
  assert.equal(restarted.peek(first.id).delivery.status, 'accepted');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('reabrir com envio vivo NÃO marca a entrega como incerta', async () => {
  const h = harness({tag: 'live-reopen'});
  const first = h.manager.open({});
  h.behaviors.set(first.id, 'hang');
  const pending = h.manager.prompt({id: first.id, text: 'em voo vivo'});
  await waitFor(() => h.manager.peek(first.id).delivery?.status === 'transmitting');
  const reopened = h.manager.open({});
  assert.equal(reopened.id, first.id);
  assert.equal(reopened.delivery.status, 'transmitting');
  assert.equal(reopened.uncertain, false, 'o envio vivo do próprio processo não é tocado');
  assert.equal(reopened.busy, true);
  h.engines.get(first.id).release({accepted: true});
  const result = await pending;
  assert.equal(result.sent, true);
  assert.equal(h.manager.peek(first.id).delivery.status, 'accepted');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('aceite Claude em voo de execução anterior hidrata uncertain no open/read sem iniciar processo', async () => {
  const h = harness({tag: 'claude-hydrate', engine: 'claude'});
  const opened = h.manager.open({});
  h.manager.save({id: opened.id, draft: 'rascunho incerto'});
  /* Simula a queda no meio de um aceite: o descritor do lado e o NATIVO ficam
     `accepted`, sem canal vivo (o processo morreu antes do agent_settled). */
  const side = h.manager.peek(opened.id);
  side.delivery = {id: 'm-1', status: 'accepted', at: 1};
  fs.writeFileSync(descriptorPath(h.runtime, opened.id), JSON.stringify(side));
  const native = JSON.parse(fs.readFileSync(side.claude, 'utf8'));
  native.delivery = {id: 'm-1', status: 'accepted'};
  /* O histórico exibido do Claude vem do descritor NATIVO (cache do adaptador). */
  native.messages = [{role: 'user', content: [{type: 'text', text: 'fala anterior'}]}];
  fs.writeFileSync(side.claude, JSON.stringify(native));
  h.manager.suspend('queda simulada');
  const restarted = createSideChatManager(h.deps);
  const resumed = restarted.open({});
  assert.equal(resumed.id, opened.id, 'retoma o mesmo chat lateral');
  assert.equal(resumed.uncertain, true, 'a incerteza do aceite em voo aparece no payload do open');
  assert.equal(resumed.delivery.status, 'uncertain', 'payload e ledger dizem a mesma coisa');
  assert.equal(resumed.busy, false);
  assert.equal(resumed.draft, 'rascunho incerto', 'o rascunho é preservado');
  assert.deepEqual(resumed.messages.map((message) => message.content[0].text), ['fala anterior'], 'o histórico é preservado');
  assert.equal(h.engines.size, 0, 'hidratar incerteza NÃO inicia processo');
  assert.equal(JSON.parse(fs.readFileSync(descriptorPath(h.runtime, opened.id), 'utf8')).delivery.status, 'uncertain');
  assert.equal(JSON.parse(fs.readFileSync(side.claude, 'utf8')).delivery.status, 'uncertain', 'o nativo também fica incerto');
  const blocked = await restarted.prompt({id: opened.id, text: 'nova mensagem'});
  assert.deepEqual(blocked, {
    sent: false,
    retryable: false,
    uncertain: true,
    error: 'A entrega anterior está incerta; abra um novo chat lateral para continuar sem repetir a mensagem.',
  });
  assert.equal(h.engines.size, 0, 'a recusa não cria canal nenhum (nem Pi)');
  const fresh = restarted.open({fresh: true});
  assert.notEqual(fresh.id, opened.id, 'fresh continua disponível para continuar sem repetir');
  assert.equal(fresh.uncertain, false);
  assert.ok(fs.existsSync(descriptorPath(h.runtime, opened.id)), 'o chat incerto continua preservado em disco');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('canal Claude vivo manda na incerteza: nativo em voo não contamina o payload', async () => {
  const h = harness({tag: 'claude-live-uncertain', engine: 'claude'});
  const opened = h.manager.open({});
  await h.manager.prompt({id: opened.id, text: 'primeira'});
  const channel = h.engines.get(opened.id);
  const nativePath = h.manager.peek(opened.id).claude;
  const native = JSON.parse(fs.readFileSync(nativePath, 'utf8'));
  native.delivery = {id: 'n-1', status: 'accepted'};
  fs.writeFileSync(nativePath, JSON.stringify(native));
  assert.equal(h.manager.read({id: opened.id}).uncertain, false, 'com canal vivo o nativo não é consultado');
  channel.uncertain = true;
  assert.equal(h.manager.read({id: opened.id}).uncertain, true, 'a incerteza do canal vivo aparece no payload');
  const blocked = await h.manager.prompt({id: opened.id, text: 'segunda'});
  assert.equal(blocked.sent, false);
  assert.equal(blocked.uncertain, true);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('settled Claude não vira incerto na hidratação (nativo accepted defasado não rebaixa o lado)', () => {
  const h = harness({tag: 'claude-settled-hydrate', engine: 'claude'});
  const opened = h.manager.open({});
  const side = h.manager.peek(opened.id);
  side.delivery = {id: 'm-1', status: 'settled', at: 1};
  fs.writeFileSync(descriptorPath(h.runtime, opened.id), JSON.stringify(side));
  const native = JSON.parse(fs.readFileSync(side.claude, 'utf8'));
  native.delivery = {id: 'm-1', status: 'accepted'};
  fs.writeFileSync(side.claude, JSON.stringify(native));
  h.manager.suspend('reinício');
  const restarted = createSideChatManager(h.deps);
  const resumed = restarted.read({id: opened.id});
  assert.equal(resumed.delivery.status, 'settled');
  assert.equal(resumed.uncertain, false, 'entrega settled do lado não é rebaixada para incerta');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('canal ocupado recusa o novo envio nos dois motores e o terminal do turno anterior não mascara o seguinte', async () => {
  const h = harness({tag: 'busy-refuse'});
  const opened = h.manager.open({});
  h.behaviors.set(opened.id, 'hang');
  const first = h.manager.prompt({id: opened.id, text: 'A'});
  await waitFor(() => h.manager.peek(opened.id).delivery?.status === 'transmitting');
  const channel = h.engines.get(opened.id);
  /* Enquanto o aceite de A não fechou, B nem sai do manager. */
  const early = await h.manager.prompt({id: opened.id, text: 'B cedo demais'});
  assert.equal(early.sent, false);
  assert.equal(early.retryable, true);
  assert.match(early.error, /aguarde/i);
  assert.equal(channel.prompts.length, 1, 'o envio recusado não chega ao motor');
  assert.equal(h.manager.peek(opened.id).messages.length, 1, 'a fala recusada não entra no histórico');
  channel.release({accepted: true});
  assert.equal((await first).sent, true);
  /* A foi aceito mas o turno segue: busy manda e o Pi também recusa (Aguarde). */
  assert.equal(channel.isBusy(), true);
  const busy = await h.manager.prompt({id: opened.id, text: 'B com turno rodando'});
  assert.equal(busy.sent, false);
  assert.equal(busy.retryable, true);
  assert.equal(busy.error, 'Aguarde o turno atual antes de enviar outra mensagem.');
  assert.equal(channel.prompts.length, 1, 'sem follow-up: A continua sendo o único envio');
  /* O terminal de A chega só depois; só então B entra e o terminal REAL de B
     (incerto) é o que fica no ledger. */
  channel.busy = false;
  channel.emit({type: 'agent_settled'});
  assert.equal(h.manager.peek(opened.id).delivery.status, 'settled', 'o terminal de A fecha a entrega de A');
  channel.behavior = 'ok';
  const second = await h.manager.prompt({id: opened.id, text: 'B'});
  assert.equal(second.sent, true);
  channel.emit({type: 'agent_settled', uncertain: true});
  assert.equal(h.manager.peek(opened.id).delivery.status, 'uncertain', 'a incerteza do B não é mascarada pelo terminal de A');
  assert.equal(h.manager.read({id: opened.id}).uncertain, true);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('close que não liquida a promessa: suspend mantém incerto e o ACK tardio não regrava', async () => {
  const h = harness({tag: 'late-ack'});
  const opened = h.manager.open({});
  h.behaviors.set(opened.id, 'hang');
  const pending = h.manager.prompt({id: opened.id, text: 'em voo'});
  await waitFor(() => h.manager.peek(opened.id).delivery?.status === 'transmitting');
  const channel = h.engines.get(opened.id);
  channel.close = () => {
    channel.closes += 1; /* fecha sem liquidar a promessa (janela real do Claude) */
  };
  const {closed} = h.manager.suspend('troca de matéria');
  assert.equal(closed, 1);
  assert.equal(h.manager.peek(opened.id).delivery.status, 'uncertain');
  channel.release({accepted: true});
  const late = await pending;
  assert.deepEqual(late, {
    sent: false,
    retryable: false,
    uncertain: true,
    error: 'O envio foi interrompido antes da confirmação; a mensagem não é repetida automaticamente.',
  });
  const after = h.manager.peek(opened.id);
  assert.equal(after.delivery.status, 'uncertain', 'o ACK tardio não regride para accepted');
  assert.equal(after.contextDeliveredKey, '', 'o ACK tardio não consome o contexto');
  assert.equal(after.messages.length, 1, 'a fala do usuário é preservada');
  const restarted = createSideChatManager(h.deps);
  assert.equal(restarted.read({id: opened.id}).uncertain, true, 'o reinício mantém a incerteza');
  assert.equal(h.engines.size, 1, 'nenhum processo é reaberto pelo ACK tardio');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('recusa tardia depois do suspend não altera o prompt novo nem o contexto', async () => {
  const h = harness({tag: 'late-reject'});
  const first = h.manager.open({});
  h.behaviors.set(first.id, 'hang');
  const pending = h.manager.prompt({id: first.id, text: 'A'});
  await waitFor(() => h.manager.peek(first.id).delivery?.status === 'transmitting');
  const oldChannel = h.engines.get(first.id);
  oldChannel.close = () => {
    oldChannel.closes += 1;
  };
  h.manager.suspend('troca');
  h.behaviors.set(first.id, 'ok');
  const sent = await h.manager.prompt({id: first.id, text: 'B'});
  assert.equal(sent.sent, true);
  const newChannel = h.engines.get(first.id);
  assert.notEqual(newChannel, oldChannel, 'o envio novo nasceu num canal novo');
  assert.equal(h.manager.peek(first.id).delivery.status, 'accepted');
  oldChannel.reject(Error('canal encerrado'));
  const late = await pending;
  assert.equal(late.sent, false);
  assert.equal(late.uncertain, true);
  const after = h.manager.peek(first.id);
  assert.equal(after.delivery.status, 'accepted', 'o desfecho tardio de A não toca a entrega de B');
  assert.deepEqual(after.messages.map((message) => message.content[0].text), ['A', 'B']);
  assert.ok(after.contextDeliveredKey, 'o contexto entregue pelo B é preservado');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('eco user do motor entra uma vez, em ordem, sem o bloco de contexto; reabrir preserva', async () => {
  const h = harness({tag: 'echo-before'});
  const opened = h.manager.open({refs: [{path: PDF, page: 2}]});
  h.behaviors.set(opened.id, 'echo-assistant-before');
  const result = await h.manager.prompt({id: opened.id, text: 'minha pergunta'});
  assert.equal(result.sent, true);
  const after = h.manager.peek(opened.id);
  assert.deepEqual(after.messages.map((message) => message.role), ['user', 'assistant'], 'ordem user antes de assistant mesmo com eventos antes do aceite');
  assert.equal(after.messages[0].content[0].text, 'minha pergunta', 'a fala guardada é o texto original');
  assert.ok(!JSON.stringify(after.messages).includes('[Contexto do chat lateral]'), 'o bloco interno não entra no histórico de exibição');
  assert.deepEqual(h.emitted.filter((payload) => payload.event?.type === 'message_end' && payload.event?.message?.role === 'user'), [], 'o eco user não é reemitido para a UI');
  assert.ok(!JSON.stringify(h.emitted).includes('[Contexto do chat lateral]'), 'nenhum evento expõe o digest do principal');
  h.manager.suspend('reinício');
  const restarted = createSideChatManager(h.deps);
  const resumed = restarted.read({id: opened.id});
  assert.deepEqual(resumed.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(resumed.messages[0].content[0].text, 'minha pergunta');
  assert.ok(!JSON.stringify(resumed.messages).includes('[Contexto do chat lateral]'));
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('eco user depois do aceite não duplica a fala', async () => {
  const h = harness({tag: 'echo-after'});
  const opened = h.manager.open({});
  await h.manager.prompt({id: opened.id, text: 'primeira'});
  const channel = h.engines.get(opened.id);
  channel.emit({type: 'message_end', message: {role: 'user', content: [{type: 'text', text: '[Contexto do chat lateral]\n…\n\nprimeira'}]}});
  channel.emit({type: 'message_end', message: {role: 'assistant', content: [{type: 'text', text: 'ok'}]}});
  const payload = h.manager.read({id: opened.id});
  assert.deepEqual(payload.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(payload.messages[0].content[0].text, 'primeira');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('turno inteiro síncrono antes do aceite: streaming=false e entrega settled, não accepted', async () => {
  const h = harness({tag: 'settled-first'});
  const opened = h.manager.open({});
  h.behaviors.set(opened.id, 'instant');
  const result = await h.manager.prompt({id: opened.id, text: 'tudo de uma vez'});
  assert.deepEqual(result, {sent: true, id: opened.id, engine: 'pi', streaming: false});
  assert.equal(h.emitted.some((payload) => payload.event?.type === 'agent_settled'), true, 'o evento terminal continua chegando à UI mesmo antes do aceite');
  const descriptor = h.manager.peek(opened.id);
  assert.equal(descriptor.delivery.status, 'settled', 'settled antes do aceite não vira accepted contraditório');
  assert.deepEqual(descriptor.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(h.manager.read({id: opened.id}).busy, false);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('cache Claude projeta a fala sem o envelope de contexto, sem reescrever o descritor', async () => {
  const h = harness({tag: 'claude-display', engine: 'claude'});
  const opened = h.manager.open({refs: [{path: PDF, page: 1}]});
  await h.manager.prompt({id: opened.id, text: 'minha pergunta'});
  const channel = h.engines.get(opened.id);
  const digest = h.manager.peek(opened.id).context.digest;
  assert.ok(channel.prompts[0].text.startsWith(digest), 'o motor recebe o texto com o contexto');
  assert.ok(channel.prompts[0].text.includes('[Fim do contexto do chat lateral]'), 'o envelope fecha o bloco interno');
  /* O cache do motor guarda o texto que foi enviado (com envelope). */
  channel.history.push({role: 'user', content: [{type: 'text', text: `${digest}\n[Fim do contexto do chat lateral]\n\nminha pergunta`}]});
  channel.history.push({role: 'assistant', content: [{type: 'text', text: 'resposta'}]});
  const payload = h.manager.read({id: opened.id});
  assert.equal(payload.messages[0].content[0].text, 'minha pergunta', 'a UI recebe só a fala');
  assert.equal(payload.messages[1].content[0].text, 'resposta');
  assert.ok(!JSON.stringify(payload.messages).includes('[Contexto do chat lateral]'));
  assert.ok(channel.history[0].content[0].text.includes('[Contexto do chat lateral]'), 'o cache do motor fica intacto (história nativa não é reescrita)');
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('refs do snapshot que saíram da biblioteca recusam o envio Claude sem trocar o contexto', async () => {
  const h = harness({tag: 'stale-refs', engine: 'claude'});
  const opened = h.manager.open({refs: [{path: PDF, page: 1}]});
  h.allowed.delete(PDF);
  const blocked = await h.manager.prompt({id: opened.id, text: 'com a ref antiga'});
  assert.equal(blocked.sent, false);
  assert.equal(blocked.retryable, true);
  assert.match(blocked.error, /atualize o contexto/i);
  assert.equal(h.engines.size, 0, 'ref fora da biblioteca nem inicia o motor Claude');
  assert.equal(h.manager.peek(opened.id).delivery, null, 'a recusa não marca entrega');
  const updated = h.manager.context({id: opened.id, refs: [{path: PDF2, page: 2}]});
  assert.deepEqual(updated.context.refs, [{path: PDF2, page: 2}], 'a troca é explícita, nunca silenciosa');
  const sent = await h.manager.prompt({id: opened.id, text: 'com a ref nova'});
  assert.equal(sent.sent, true);
  assert.deepEqual(h.engines.get(opened.id).prompts[0].readPaths, [PDF2]);
  fs.rmSync(h.runtime, {recursive: true, force: true});
});

test('conversationList mapeia as conversas da matéria sem iniciar agente', () => {
  const sessions = [
    {path: '/s/pi-1.jsonl', label: '01/10, 10:00 · Limites', preview: 'uma prévia', started: 5, engine: 'pi'},
    {path: '/s/claude-x.json', label: 'Claude Code · 02/10', preview: 'outra', started: 6, engine: 'claude'},
    {path: '', label: 'vazia'},
  ];
  assert.deepEqual(conversationList(sessions), [
    {id: '/s/pi-1.jsonl', title: '01/10, 10:00 · Limites', preview: 'uma prévia', at: 5, engine: 'pi'},
    {id: '/s/claude-x.json', title: 'Claude Code · 02/10', preview: 'outra', at: 6, engine: 'claude'},
  ]);
  const long = conversationList([{path: '/s/p.jsonl', label: 'x', preview: 'y'.repeat(500), started: 1}])[0];
  assert.equal(long.preview.length, 200);
});

test('normalizeRefs valida a forma do IPC', () => {
  assert.deepEqual(normalizeRefs(undefined), []);
  assert.deepEqual(normalizeRefs([{path: PDF}]), [{path: PDF, page: 1}]);
  assert.throws(() => normalizeRefs('nope'), /Referências inválidas/);
  assert.throws(() => normalizeRefs([{page: 1}]), /Referência inválida/);
  assert.throws(() => normalizeRefs([{path: PDF, page: 0}]), /página fora/);
});
