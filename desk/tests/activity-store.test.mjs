import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
const require = createRequire(import.meta.url);
const {
  createActivityStore,
  normalizeSpec,
  canonicalSpec,
  specHash,
  portableIdentity,
  ActivityStoreError,
  MAX_VALUES_BYTES,
  MAX_STATE_ENVELOPE_BYTES,
} = require('../activity-store.cjs');

const SPEC = {title: 'MRUV', objective: 'Explorar a', alternativeMarkdown: 's = v t', html: '<p>x</p>', css: '', js: ''};

function tempRuntime(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `mesa-activity-store-${tag}-`));
}

test('normalizeSpec aplica tetos e o hash é determinístico', () => {
  assert.throws(() => normalizeSpec({title: '', objective: 'o', alternativeMarkdown: 'a', html: '<p/>'}), ptMatches(/^Atividade: title recebeu ""; esperado string\(1\.\.160\)\.$/));
  assert.throws(() => normalizeSpec({title: 't', objective: 'o', alternativeMarkdown: 'a', html: '', js: ''}), ptMatches(/html ou js/));
  assert.throws(() => normalizeSpec({title: 't', objective: 'o', alternativeMarkdown: 'a', html: 'x'.repeat(60000)}), ptMatches(/html recebeu string\(60000\); esperado string\(0\.\.51200\)/));
  const first = normalizeSpec({...SPEC, html: '<p>a</p>', katex: true});
  const second = normalizeSpec({katex: true, js: '', css: '', html: '<p>a</p>', alternativeMarkdown: 's = v t', objective: 'Explorar a', title: 'MRUV'});
  assert.equal(canonicalSpec(first), canonicalSpec(second));
  assert.equal(specHash(first), specHash(second));
  assert.match(specHash(first), /^sha256:[0-9a-f]{64}$/);
});

test('publish lista, lê e preserva versões antigas', async () => {
  const runtime = tempRuntime('versions');
  try {
    const store = createActivityStore({runtime});
    const conversationId = path.join(runtime, 'pi-a.jsonl');
    const v1 = await store.publish({conversationId, toolCallId: 'call-1', generation: 3, spec: SPEC});
    assert.equal(v1.version, 1);
    assert.equal(v1.toolCallId, 'call-1');
    const reused = await store.publish({conversationId, toolCallId: 'call-1', generation: 3, spec: SPEC});
    assert.equal(reused.reused, true);
    assert.equal(reused.id, v1.id);
    assert.equal(store.list({conversationId}).length, 1);
    const v2 = await store.publish({conversationId, toolCallId: 'call-2', activityId: v1.id, spec: {...SPEC, title: 'MRUV v2'}});
    assert.equal(v2.id, v1.id);
    assert.equal(v2.version, 2);
    assert.equal(v2.revision, true);
    assert.equal(store.list({conversationId}).length, 2);
    assert.equal(store.read({conversationId, id: v1.id, version: 1}).spec.title, 'MRUV');
    assert.equal(store.read({conversationId, id: v1.id, version: 2}).spec.title, 'MRUV v2');
    assert.throws(() => store.read({conversationId, id: v1.id, version: 9}), (error) => error.code === 'MISSING');
    /* Revisão de id inexistente não cria item novo em silêncio. */
    await assert.rejects(
      () => store.publish({conversationId, toolCallId: 'call-3', activityId: 'act-naoexiste1', spec: SPEC}),
      (error) => error.code === 'MISSING',
    );
    await assert.rejects(
      () => store.publish({conversationId, toolCallId: 'call-4', activityId: '../etc/passwd', spec: SPEC}),
      (error) => error.code === 'BAD_INPUT',
    );
    assert.equal(store.list({conversationId}).length, 2);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('identidade de chamada diferente publica item novo; callRef idempotente', async () => {
  const runtime = tempRuntime('calls');
  try {
    const store = createActivityStore({runtime});
    const conversationId = path.join(runtime, 'pi-b.jsonl');
    const a = await store.publish({conversationId, toolCallId: 'call-x', spec: SPEC});
    const b = await store.publish({conversationId, toolCallId: 'call-y', spec: SPEC});
    assert.notEqual(a.id, b.id);
    const c = await store.publish({conversationId, callRef: 'ref-12345678', spec: SPEC});
    const d = await store.publish({conversationId, callRef: 'ref-12345678', spec: SPEC});
    assert.equal(c.id, d.id);
    assert.equal(d.reused, true);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('stateSave/stateGet guardam por versão/hash e recusam hash velho', async () => {
  const runtime = tempRuntime('state');
  try {
    const store = createActivityStore({runtime});
    const conversationId = path.join(runtime, 'pi-c.jsonl');
    const item = await store.publish({conversationId, toolCallId: 'call-1', spec: SPEC});
    assert.equal(store.stateGet({conversationId, id: item.id, version: 1, hash: item.hash}).state, null);
    await store.stateSave({conversationId, id: item.id, version: 1, hash: item.hash, state: {values: {a: 2}, attempt: {ok: true}}});
    assert.deepEqual(store.stateGet({conversationId, id: item.id, version: 1, hash: item.hash}).state, {values: {a: 2}, attempt: {ok: true}});
    await assert.rejects(
      () => store.stateSave({conversationId, id: item.id, version: 1, hash: 'sha256:outro', state: {}}),
      (error) => error.code === 'STALE',
    );
    await assert.rejects(
      () => store.stateSave({conversationId, id: item.id, version: 1, hash: item.hash, state: {values: {big: 'x'.repeat(MAX_VALUES_BYTES + 1)}}}),
      (error) => error.code === 'TOO_BIG',
    );
    await assert.rejects(
      () => store.stateSave({conversationId, id: item.id, version: 1, hash: item.hash, state: {big: 'x'.repeat(MAX_STATE_ENVELOPE_BYTES + 1)}}),
      (error) => error.code === 'TOO_BIG',
    );
    /* Contrato: values 16 KiB + attempt 4 KiB cabem no envelope de 21 KiB (o
       achado P2 media este caso sendo descartado em silêncio). */
    const bigValues = {blob: 'x'.repeat(13000)};
    const bigAttempt = {blob: 'y'.repeat(3500)};
    await store.stateSave({conversationId, id: item.id, version: 1, hash: item.hash, state: {values: bigValues, attempt: bigAttempt}});
    const big = store.stateGet({conversationId, id: item.id, version: 1, hash: item.hash});
    assert.deepEqual(big.state.values, bigValues);
    assert.deepEqual(big.state.attempt, bigAttempt);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('corrupção fica no disco e vira CORRUPT (nunca silêncio)', async () => {
  const runtime = tempRuntime('corrupt');
  try {
    const store = createActivityStore({runtime});
    const conversationId = path.join(runtime, 'pi-d.jsonl');
    await store.publish({conversationId, toolCallId: 'call-1', spec: SPEC});
    const index = path.join(store.directoryFor(conversationId), 'index.json');
    fs.writeFileSync(index, '{ isso não é json');
    const before = fs.readFileSync(index, 'utf8');
    assert.throws(() => store.list({conversationId}), (error) => error.code === 'CORRUPT');
    await assert.rejects(() => store.publish({conversationId, toolCallId: 'call-2', spec: SPEC}), (error) => error.code === 'CORRUPT');
    assert.equal(fs.readFileSync(index, 'utf8'), before, 'o arquivo corrompido não é sobrescrito');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('índice de outra conversa no diretório canônico vira CORRUPT; varredura ignora', async () => {
  const runtime = tempRuntime('mismatch');
  try {
    const store = createActivityStore({runtime});
    const conversationId = path.join(runtime, 'pi-e.jsonl');
    const identity = portableIdentity(runtime, conversationId);
    const dir = path.join(runtime, 'activities', crypto.createHash('sha256').update(identity.key).digest('hex').slice(0, 24));
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({schema: 1, conversationId: 'outra', portableId: 'id:outra', items: []}));
    assert.throws(() => store.list({conversationId}), (error) => error.code === 'CORRUPT');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('identidade portátil: backup em outro runtime encontra o diretório relocacionado', async () => {
  const root = tempRuntime('relocate');
  try {
    const source = path.join(root, 'source');
    const target = path.join(root, 'target');
    fs.mkdirSync(source);
    fs.mkdirSync(target);
    const sourceConversation = path.join(source, 'pi-reloc.jsonl');
    fs.writeFileSync(sourceConversation, '');
    const store = createActivityStore({runtime: source});
    const item = await store.publish({conversationId: sourceConversation, toolCallId: 'call-1', spec: SPEC});
    await store.stateSave({conversationId: sourceConversation, id: item.id, version: item.version, hash: item.hash, state: {a: 1}});
    fs.cpSync(path.join(source, 'activities'), path.join(target, 'activities'), {recursive: true});
    const restored = createActivityStore({runtime: target});
    const targetConversation = path.join(target, 'pi-reloc.jsonl');
    assert.equal(restored.list({conversationId: targetConversation}).length, 1);
    assert.deepEqual(restored.stateGet({conversationId: targetConversation, id: item.id, version: 1, hash: item.hash}).state, {a: 1});
    assert.equal(portableIdentity(source, sourceConversation).key, portableIdentity(target, targetConversation).key);
    /* Depois do remap, o índice guarda a conversa nova e a identidade portátil. */
    await restored.publish({conversationId: targetConversation, toolCallId: 'call-2', spec: {...SPEC, title: 'MRUV remap'}});
    const index = JSON.parse(fs.readFileSync(path.join(restored.directoryFor(targetConversation), 'index.json'), 'utf8'));
    assert.equal(index.conversationId, targetConversation);
    assert.equal(index.portableId, portableIdentity(target, targetConversation).key);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('índice legado (hash do caminho absoluto, sem portableId) é encontrado após relocação', async () => {
  const root = tempRuntime('legacy');
  try {
    const source = path.join(root, 'source');
    const target = path.join(root, 'target');
    fs.mkdirSync(source);
    fs.mkdirSync(target);
    const sourceConversation = path.join(source, 'pi-legacy.jsonl');
    const legacyIdentity = portableIdentity(source, sourceConversation);
    const dir = path.join(target, 'activities', crypto.createHash('sha256').update(sourceConversation).digest('hex').slice(0, 24));
    fs.mkdirSync(path.join(dir, 'docs'), {recursive: true});
    const item = {id: 'act-legacy01', version: 1, hash: specHash(SPEC), conversationId: sourceConversation, generation: 0, toolCallId: 'call-1', callRef: '', kind: 'activity', title: SPEC.title, objective: SPEC.objective, createdAt: Date.now(), bytes: canonicalSpec(SPEC).length};
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({schema: 1, conversationId: sourceConversation, items: [item]}));
    fs.writeFileSync(path.join(dir, 'docs', `${item.id}-v1.json`), JSON.stringify({schema: 1, hash: item.hash, spec: normalizeSpec(SPEC)}));
    const store = createActivityStore({runtime: target});
    const targetConversation = path.join(target, 'pi-legacy.jsonl');
    assert.equal(store.list({conversationId: targetConversation}).length, 1);
    assert.equal(store.list({conversationId: path.join(target, 'outra.jsonl')}).length, 0);
    assert.equal(legacyIdentity.key, 'rel:pi-legacy.jsonl');
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('limite de itens por conversa recusa nova publicação sem apagar antigas', async () => {
  const runtime = tempRuntime('limit');
  try {
    const store = createActivityStore({runtime});
    const conversationId = path.join(runtime, 'pi-f.jsonl');
    for (let i = 0; i < 200; i += 1) {
      await store.publish({conversationId, toolCallId: `call-${i}`, spec: {...SPEC, title: `MRUV ${i}`}});
    }
    await assert.rejects(
      () => store.publish({conversationId, toolCallId: 'call-final', spec: SPEC}),
      (error) => error instanceof ActivityStoreError && error.code === 'LIMIT',
    );
    assert.equal(store.list({conversationId}).length, 200);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

/* ---------- #42: tipo, gráficos e alturas medidas ---------- */
test('atividades salvas antes do #42 mantêm o hash (o documento antigo continua abrindo)', async () => {
  const {normalizeSpec: normalize, specHash: hash, normalizeHeights} = await import('../activity-store.cjs').then((m) => m.default || m);
  const old = {title: 'MRUV', objective: 'Explorar', alternativeMarkdown: 'a', html: '<p>x</p>', css: '', js: '', katex: false};
  /* O JSON canônico de antes do #42 tinha exatamente estas chaves. */
  const legacy = 'sha256:' + (await import('node:crypto')).createHash('sha256').update(JSON.stringify({title: 'MRUV', objective: 'Explorar', alternativeMarkdown: 'a', html: '<p>x</p>', css: '', js: '', katex: false})).digest('hex');
  assert.equal(hash(old), legacy, 'sem tipo nem gráficos, o hash é o de antes');
  assert.equal(hash({...old, kind: 'atividade'}), legacy, '"atividade" é o padrão: não muda o documento');
  assert.equal(hash({...old, charts: false}), legacy);
  assert.deepEqual(Object.keys(normalize({...old, kind: 'visualizacao', charts: true})), ['title', 'objective', 'alternativeMarkdown', 'html', 'css', 'js', 'katex', 'kind', 'charts']);
  assert.notEqual(hash({...old, kind: 'visualizacao'}), legacy, 'visualização é outro documento');
  assert.deepEqual(normalizeHeights([[640, 300], [320, 500]]), [[320, 500], [640, 300]], 'ordena por largura');
  assert.equal(normalizeHeights([[320, 'x']]), undefined, 'par inválido descarta tudo');
  assert.equal(normalizeHeights(Array.from({length: 25}, (_, i) => [i + 1, 10])), undefined, 'teto de 24 pares');
  assert.equal(normalizeHeights('x'), undefined);
});

test('publicação guarda o tipo e os pares medidos com a versão', () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-activity-store-42-'));
  const store = createActivityStore({runtime});
  const conversationId = path.join(runtime, 'pi-42.jsonl');
  return store.publish({conversationId, toolCallId: 'call-42', spec: {title: 'G', objective: 'o', alternativeMarkdown: 'a', html: '<p/>', kind: 'visualizacao', charts: true}, heights: [[320, 400], [728, 380]]}).then((item) => {
    assert.equal(item.view, 'visualizacao');
    assert.deepEqual(item.heights, [[320, 400], [728, 380]]);
    const read = store.read({conversationId, id: item.id, version: item.version});
    assert.equal(read.spec.kind, 'visualizacao');
    assert.equal(read.spec.charts, true);
    assert.deepEqual(read.item.heights, [[320, 400], [728, 380]]);
    fs.rmSync(runtime, {recursive: true, force: true});
  });
});
