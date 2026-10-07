/* Integração do chat lateral com o Pi de teste (fake-pi.mjs): canal próprio,
   sessão própria, eventos, contexto único e cancelamento. Nada de autenticação
   real — é o mesmo fake dos smokes do app. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createSideChatManager} = require('../sidechat.cjs');
const {createPiSideEngine} = require('../sidechat-engine.cjs');
const FAKE_PI = fileURLToPath(new URL('./fake-pi.mjs', import.meta.url));
const MAIN_SESSION = '/principal/pi-1.jsonl';

function makeDeps({runtime, env = {}}) {
  const emitted = [];
  let clock = 0;
  const deps = {
    runtime,
    current: () => ({session: MAIN_SESSION, courseId: 'Calculo I', engine: 'pi'}),
    snapshot: ({refs}) => ({
      mainSession: MAIN_SESSION,
      refs,
      study: {title: 'Lista 1', xopp: ''},
      at: ++clock,
      digest: '[Contexto do chat lateral]\n- conversa principal: ' + MAIN_SESSION + '\n[Chat principal até aqui]\nvocê: sobre limites',
      key: `chave-${clock}`,
    }),
    validPdf: (value) => value,
    createEngine: ({id, descriptor, onEvent}) => createPiSideEngine({
      id,
      sessionPath: descriptor.session,
      cwd: runtime,
      pi: FAKE_PI,
      env: {...process.env, ...env},
      extraArgs: [],
      promptFile: path.join(runtime, 'prompt.md'),
      onEvent,
      log: () => {},
    }),
    emit: (payload) => emitted.push(payload),
    log: () => {},
    now: () => Date.now(),
    emitted,
  };
  return deps;
}

function waitFor(predicate, timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve(true);
      if (Date.now() - start > timeoutMs) return reject(Error('waitFor: tempo esgotado'));
      setTimeout(check, 10);
    };
    check();
  });
}

test('Pi de teste: turno completo, contexto uma vez, persistência e retomada', {timeout: 30000}, async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-pi-turno-'));
  fs.chmodSync(FAKE_PI, 0o755);
  const deps = makeDeps({runtime});
  const emitted = deps.emitted;
  const manager = createSideChatManager(deps);
  try {
    const opened = manager.open({refs: [{path: '/biblioteca/Limites.pdf', page: 2}]});
    const result = await manager.prompt({id: opened.id, text: 'teorema'});
    /* `streaming` é medido no canal no instante do aceite: a ponte do Pi só
       marca o turno como ativo quando chega o primeiro evento, então aqui ele
       vem false — o que a UI precisa é o fato medido, não um chute. */
    assert.deepEqual(result, {sent: true, id: opened.id, engine: 'pi', streaming: false});
    await waitFor(() => emitted.some((payload) => payload.id === opened.id && payload.event.type === 'agent_settled'));
    const events = emitted.filter((payload) => payload.id === opened.id).map((payload) => payload.event);
    assert.ok(events.some((event) => event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta'), 'deltas chegam normalizados');
    const finished = manager.read({id: opened.id});
    assert.equal(finished.busy, false);
    assert.equal(finished.messages.length, 2);
    assert.equal(finished.messages[0].role, 'user');
    assert.equal(finished.messages[1].role, 'assistant');
    assert.match(finished.messages[1].content[0].text, /Pitágoras/);
    const sessionFile = path.join(runtime, 'sidechats', `${opened.id}.jsonl`);
    assert.ok(fs.existsSync(sessionFile), 'a sessão do Pi lateral tem arquivo próprio');
    const sessionText = fs.readFileSync(sessionFile, 'utf8');
    assert.equal(sessionText.split('[Contexto do chat lateral]').length - 1, 1, 'o contexto foi uma vez só');
    await manager.prompt({id: opened.id, text: 'teorema de novo'});
    await waitFor(() => emitted.filter((payload) => payload.id === opened.id && payload.event.type === 'agent_settled').length >= 2);
    assert.equal(fs.readFileSync(sessionFile, 'utf8').split('[Contexto do chat lateral]').length - 1, 1, 'contexto igual não repete');
    manager.suspend('reinício');
    const restarted = createSideChatManager(deps);
    const resumed = restarted.read({id: opened.id});
    assert.equal(resumed.id, opened.id);
    assert.equal(resumed.messages.length, 4);
  } finally {
    manager.suspend('fim');
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('Pi de teste: open retoma do disco recuperando transmitting e o novo envio sai', {timeout: 30000}, async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-pi-recover-'));
  fs.chmodSync(FAKE_PI, 0o755);
  const deps = makeDeps({runtime});
  const emitted = deps.emitted;
  const manager = createSideChatManager(deps);
  let restarted = null;
  try {
    const opened = manager.open({});
    await manager.prompt({id: opened.id, text: 'teorema'});
    await waitFor(() => emitted.some((payload) => payload.id === opened.id && payload.event.type === 'agent_settled'));
    manager.suspend('fim da primeira execução');
    const file = path.join(runtime, 'sidechats', `${opened.id}.json`);
    const descriptor = JSON.parse(fs.readFileSync(file, 'utf8'));
    descriptor.delivery = {id: descriptor.delivery.id, status: 'transmitting', at: descriptor.delivery.at};
    fs.writeFileSync(file, JSON.stringify(descriptor));
    restarted = createSideChatManager(deps);
    const recovered = restarted.open({});
    assert.equal(recovered.id, opened.id, 'open retoma o mesmo canal do índice');
    assert.equal(recovered.uncertain, true, 'transmitting de outra execução vira incerto no open');
    assert.equal(recovered.delivery.status, 'uncertain');
    assert.equal(recovered.busy, false, 'não fica preso em "aguarde" para sempre');
    const again = await restarted.prompt({id: opened.id, text: 'teorema depois da recuperação'});
    assert.equal(again.sent, true, 'o Pi libera o envio explícito depois da recuperação');
    await waitFor(() => emitted.filter((payload) => payload.id === opened.id && payload.event.type === 'agent_settled').length >= 2);
    const final = restarted.read({id: opened.id});
    assert.equal(final.messages.filter((message) => message.role === 'user').length, 2, 'cada fala do usuário aparece uma vez');
    assert.equal(final.messages.filter((message) => message.role === 'assistant').length, 2);
  } finally {
    manager.suspend('fim');
    restarted?.suspend('fim');
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('Pi de teste: abort é independente e encerra o turno do lateral', {timeout: 30000}, async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-pi-abort-'));
  fs.chmodSync(FAKE_PI, 0o755);
  const queueLog = path.join(runtime, 'queue.log');
  const deps = makeDeps({runtime, env: {FAKE_PI_QUEUE_LOG: queueLog, FAKE_PI_QUEUE_HOLD_MS: '4000'}});
  const emitted = deps.emitted;
  const manager = createSideChatManager(deps);
  try {
    const opened = manager.open({});
    const accepted = await manager.prompt({id: opened.id, text: 'segura o turno'});
    assert.equal(accepted.sent, true);
    const aborted = await manager.abort({id: opened.id});
    assert.equal(aborted.aborted, true);
    await waitFor(() => emitted.some((payload) => payload.id === opened.id && payload.event.type === 'agent_settled'));
    const log = fs.readFileSync(queueLog, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    assert.equal(log.length, 1);
    assert.ok(log[0].message.endsWith('segura o turno'), 'o texto do usuário vai no fim, depois do contexto');
  } finally {
    manager.suspend('fim');
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
