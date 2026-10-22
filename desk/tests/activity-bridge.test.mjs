import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {
  createActivityBridge,
  createCallRegistry,
  createActivityService,
  pickPayload,
  paramsHashOfToolInput,
  ACTIVITY_CALL_REF_FIELD,
} = require('../activity-bridge.cjs');
const {createActivityStore, portableIdentity} = require('../activity-store.cjs');
const {createActivityRuntime} = require('../activity-runtime.cjs');

const SPEC = {title: 'MRUV', objective: 'Explorar a', alternativeMarkdown: 's = v t', html: '<p>x</p>', css: '', js: ''};
const payload = (toolCallId = '') => ({...SPEC, katex: false, toolCallId});

function tempRuntime(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `mesa-activity-bridge-${tag}-`));
}

function startService(runtime, {generation = 1} = {}) {
  const store = createActivityStore({runtime});
  const activityRuntime = createActivityRuntime({store});
  const conversationId = path.join(runtime, 'pi-bridge.jsonl');
  const events = [];
  const registry = createCallRegistry();
  const service = createActivityService({
    store,
    runtime: activityRuntime,
    registry,
    isScopeActive: (scope) => scope.conversationId === conversationId,
    emit: (event) => events.push(event),
  });
  const bridge = createActivityBridge({publish: (scope, spec, caller) => service.publish(scope, spec, caller)});
  return {store, activityRuntime, conversationId, events, registry, service, bridge, scope: {conversationId, generation, engine: 'pi'}};
}

async function post(grant, body, {url} = {}) {
  const response = await fetch(url || grant.url, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-mesa-token': grant.token},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return {status: response.status, data};
}

test('ponte publica com escopo capturado, token e caller; retry é idempotente', async () => {
  const runtime = tempRuntime('pi');
  const {store, service, bridge, scope, conversationId, events} = startService(runtime);
  await bridge.start();
  try {
    const grant = bridge.grant(scope);
    const first = await post(grant, payload('call-mruv-1'));
    assert.equal(first.status, 200);
    assert.equal(first.data.published, true);
    assert.equal(first.data.kind, 'activity');
    const items = store.list({conversationId});
    assert.equal(items.length, 1);
    assert.equal(items[0].toolCallId, 'call-mruv-1');
    assert.equal(items[0].generation, 1);
    const again = await post(grant, payload('call-mruv-1'));
    assert.equal(again.status, 200);
    assert.equal(again.data.reused, true);
    assert.equal(again.data.id, first.data.id);
    assert.equal(store.list({conversationId}).length, 1);
    assert.equal(events.length, 2);
    assert.equal(new Set(events.map((event) => event.activity.id)).size, 1);
    assert.equal(events[0].activity.toolCallId, 'call-mruv-1');
    assert.equal(events[0].scope.conversationId, conversationId);
    const second = await post(grant, payload('call-mruv-2'));
    assert.equal(second.data.id === first.data.id, false);
    assert.equal(store.list({conversationId}).length, 2);
  } finally {
    await bridge.close();
    assert.equal(service, service);
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('ponte recusa token ausente, rota errada, content-type errado e corpo grande', async () => {
  const runtime = tempRuntime('guards');
  const {bridge, scope} = startService(runtime, {});
  await bridge.start();
  try {
    const grant = bridge.grant(scope);
    assert.equal((await post({url: grant.url, token: 'inventado'}, payload('x'))).status, 403);
    assert.equal((await post(grant, payload('x'), {url: grant.url.replace('/activity', '/outra')})).status, 404);
    const wrongType = await fetch(grant.url, {method: 'POST', headers: {'content-type': 'text/plain', 'x-mesa-token': grant.token}, body: 'x'});
    assert.equal(wrongType.status, 415);
    const huge = await post(grant, {...payload('huge'), html: 'x'.repeat(320000)});
    assert.equal(huge.status, 413);
  } finally {
    await bridge.close();
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('ponte detecta troca de escopo durante a publicação', async () => {
  const runtime = tempRuntime('scope-change');
  const store = createActivityStore({runtime});
  const activityRuntime = createActivityRuntime({store});
  const conversationId = path.join(runtime, 'pi-bridge2.jsonl');
  let release, entered;
  const blocked = new Promise((resolve) => { release = resolve; });
  /* A troca de escopo tem de acontecer DEPOIS de o pedido passar pelo token
     (senão a resposta certa é 403, não 409): espera a publicação começar. */
  const reached = new Promise((resolve) => { entered = resolve; });
  const service = createActivityService({
    store,
    runtime: activityRuntime,
    registry: createCallRegistry(),
    isScopeActive: () => true,
    emit: () => {},
  });
  const bridge = createActivityBridge({
    publish: async (scope, spec, caller) => {
      entered();
      await blocked;
      return service.publish(scope, spec, caller);
    },
  });
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId, generation: 1});
    const pending = post(grant, payload('call-1'));
    await reached;
    bridge.revoke(grant.token);
    release();
    const result = await pending;
    assert.equal(result.status, 409);
  } finally {
    await bridge.close();
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('registry correla callRef, confere escopo/geração/hash e expira', () => {
  let clock = 1000;
  const registry = createCallRegistry({ttlMs: 100, max: 2, now: () => clock});
  registry.registerCall({callRef: 'ref-aaaaaaaa', toolCallId: 'call-1', conversationId: 'conversa', generation: 4, paramsHash: 'sha256:x', scopeRef: 'scopeRef-1'});
  assert.deepEqual(registry.resolve('ref-aaaaaaaa', {conversationId: 'conversa', generation: 4, paramsHash: 'sha256:x'}), {toolCallId: 'call-1', conversationId: 'conversa', generation: 4, scopeRef: 'scopeRef-1'});
  assert.equal(registry.resolve('ref-aaaaaaaa', {conversationId: 'outra'}), null);
  assert.equal(registry.resolve('ref-aaaaaaaa', {generation: 5}), null);
  assert.equal(registry.resolve('ref-aaaaaaaa', {paramsHash: 'sha256:outro'}), null);
  clock += 101;
  assert.equal(registry.resolve('ref-aaaaaaaa'), null);
  registry.registerCall({callRef: 'ref-bbbbbbbb', toolCallId: 'call-2', conversationId: 'conversa'});
  registry.registerCall({callRef: 'ref-cccccccc', toolCallId: 'call-3', conversationId: 'conversa'});
  registry.registerCall({callRef: 'ref-dddddddd', toolCallId: 'call-4', conversationId: 'conversa'});
  assert.equal(registry.size(), 2);
  const injected = registry.injectRef({title: 't', [ACTIVITY_CALL_REF_FIELD]: 'forjado'}, 'ref-real-123');
  assert.equal(injected[ACTIVITY_CALL_REF_FIELD], 'ref-real-123');
});

test('serviço Claude: handler só aceita callRef registrado e valida o hash do input', async () => {
  const runtime = tempRuntime('claude');
  const {store, service, registry, conversationId, events} = startService(runtime);
  try {
    const input = {...SPEC, katex: false};
    const hash = paramsHashOfToolInput(input);
    registry.registerCall({callRef: 'ref-claude-01', toolCallId: 'toolu_123', conversationId, generation: 1, paramsHash: hash, scopeRef: 'scopeRef-claude'});
    const injected = registry.injectRef(input, 'ref-claude-01');
    const item = await service.publishFromTool(injected);
    assert.equal(item.toolCallId, 'toolu_123');
    assert.equal(item.scopeRef, 'scopeRef-claude');
    assert.equal(events[0].activity.scopeRef, 'scopeRef-claude');
    assert.equal(store.list({conversationId}).length, 1);
    assert.equal(events[0].activity.toolCallId, 'toolu_123');
    await assert.rejects(() => service.publishFromTool({...input, [ACTIVITY_CALL_REF_FIELD]: 'ref-inventado'}), (error) => error.code === 'BAD_INPUT');
    const changed = {...SPEC, html: '<p>mudou</p>', katex: false, [ACTIVITY_CALL_REF_FIELD]: 'ref-claude-01'};
    await assert.rejects(() => service.publishFromTool(changed), (error) => error.code === 'BAD_INPUT');
    assert.equal(store.list({conversationId}).length, 1);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('serviço recusa conversa fora do escopo e chamada sem identidade', async () => {
  const runtime = tempRuntime('no-scope');
  const store = createActivityStore({runtime});
  const activityRuntime = createActivityRuntime({store});
  const service = createActivityService({
    store,
    runtime: activityRuntime,
    registry: createCallRegistry(),
    isScopeActive: () => false,
    emit: () => {},
  });
  try {
    await assert.rejects(
      () => service.publish({conversationId: 'x', generation: 1}, SPEC, {toolCallId: 'call-1'}),
      (error) => error.code === 'STALE',
    );
    const open = createActivityService({store, runtime: activityRuntime, emit: () => {}, isScopeActive: () => true});
    await assert.rejects(
      () => open.publish({conversationId: 'conversa-sem-id'}, SPEC, {}),
      (error) => error.code === 'BAD_INPUT',
    );
    assert.equal(store.list({conversationId: 'conversa-sem-id'}).length, 0);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('pickPayload descarta campos estranhos (nada de caminho/URL do modelo)', () => {
  const picked = pickPayload({...SPEC, katex: true, path: '/etc/passwd', url: 'https://example.com', html: '<p>ok</p>'});
  assert.equal(picked.spec.html, '<p>ok</p>');
  assert.equal(picked.spec.katex, true);
  assert.equal('path' in picked.spec, false);
  assert.equal('url' in picked.spec, false);
  assert.equal(picked.activityId, '');
  assert.equal(portableIdentity('/tmp/runtime-x', '/tmp/runtime-x/pi-a.jsonl').key, 'rel:pi-a.jsonl');
});

test('revisão por activityId: hash cobre o campo, ponte e serviço criam versão imutável', async () => {
  const runtime = tempRuntime('revision');
  const {store, activityRuntime, service, registry, bridge, scope, conversationId} = startService(runtime);
  await bridge.start();
  try {
    const grant = bridge.grant(scope);
    const first = await post(grant, payload('call-rev-1'));
    assert.equal(first.status, 200);
    const activityId = first.data.id;
    const v2 = await post(grant, {...payload('call-rev-2'), activityId, title: 'MRUV revisado'});
    assert.equal(v2.status, 200);
    assert.equal(v2.data.id, activityId);
    assert.equal(v2.data.version, 2);
    assert.equal(store.list({conversationId}).length, 2, 'a versão anterior é preservada');
    assert.equal(activityRuntime.has(activityId, 1), true);
    assert.equal(activityRuntime.has(activityId, 2), true, 'runtime serve as duas versões');
    assert.equal(store.read({conversationId, id: activityId, version: 1}).spec.title, SPEC.title);
    assert.equal(store.read({conversationId, id: activityId, version: 2}).spec.title, 'MRUV revisado');
    /* O activityId participa do paramsHash: trocar a revisão entre hook e
       handler invalida a referência. */
    const h1 = pickPayload({...payload('x')}).paramsHash;
    const h2 = pickPayload({...payload('x'), activityId}).paramsHash;
    assert.notEqual(h1, h2);
    assert.throws(() => pickPayload({...payload('x'), activityId: 'inválido'}), (error) => error.code === 'BAD_INPUT');
    assert.throws(() => pickPayload({...payload('x'), activityId: 'act-'}), (error) => error.code === 'BAD_INPUT');
    const missing = await post(grant, {...payload('call-rev-3'), activityId: 'act-naoexiste1'});
    assert.equal(missing.status, 409);
    assert.equal(store.list({conversationId}).length, 2, 'revisão ausente não cria item');
    /* Caminho Claude: publishFromTool propaga activityId pelo handler. */
    const input = {...SPEC, katex: false, activityId};
    const paramsHash = paramsHashOfToolInput(input);
    registry.registerCall({callRef: 'ref-revisao-01', toolCallId: 'toolu-rev', conversationId, generation: 1, paramsHash, scopeRef: 'scopeRef-rev'});
    const revision = await service.publishFromTool(registry.injectRef(input, 'ref-revisao-01'));
    assert.equal(revision.id, activityId);
    assert.equal(revision.version, 3);
    assert.equal(store.list({conversationId}).length, 3);
  } finally {
    await bridge.close();
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('scopeRef opaco acompanha item/evento e não é persistido', async () => {
  const runtime = tempRuntime('scoperef');
  const store = createActivityStore({runtime});
  const activityRuntime = createActivityRuntime({store});
  const conversationId = path.join(runtime, 'pi-scope.jsonl');
  const events = [];
  const service = createActivityService({
    store,
    runtime: activityRuntime,
    registry: createCallRegistry(),
    isScopeActive: () => true,
    emit: (event) => events.push(event),
  });
  try {
    const item = await service.publish({conversationId, generation: 2, scopeRef: 'scopeRef-opaco'}, SPEC, {toolCallId: 'call-1'});
    assert.equal(item.scopeRef, 'scopeRef-opaco');
    assert.equal(events.length, 1);
    assert.equal(events[0].activity.scopeRef, 'scopeRef-opaco');
    assert.equal(events[0].scope.scopeRef, 'scopeRef-opaco');
    assert.equal(events[0].scope.courseId, null);
    assert.equal(store.list({conversationId})[0].scopeRef, undefined, 'scopeRef não é persistido no store');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

/* Regressão (#43 fase 3): o erro marcado do store ia cru ao modelo, com a marca
   U+E000; agora a ponte o põe no idioma do tutor. */
test('ponte devolve ao tutor o erro marcado já traduzido e diz o que veio', async () => {
  const {createI18n, message} = await import('../src/i18n.mjs');
  const catalogs = {'pt-BR': JSON.parse(fs.readFileSync(new URL('../src/locales/pt-BR.json', import.meta.url), 'utf8')), en: JSON.parse(fs.readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'))};
  const i18n = createI18n({catalogs, language: 'en'});
  const bridge = createActivityBridge({publish: async () => { throw new Error(message('err.activity.sessionChangedNotPublished')); }, tutorText: (raw) => i18n.text(raw)});
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'conv-1', generation: 1});
    const failed = await post(grant, payload('call-x'));
    assert.equal(failed.data.error, 'The session changed; the activity was not published.');
    const response = await fetch(grant.url, {method: 'POST', headers: {'content-type': 'text/plain', 'x-mesa-token': grant.token}, body: 'x'});
    assert.equal((await response.json()).error, 'Invalid content: received "text/plain"; expected application/json.');
  } finally {
    await bridge.close();
  }
});
