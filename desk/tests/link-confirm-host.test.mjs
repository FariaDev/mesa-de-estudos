/* Link externo de view web (#81): o main pergunta ao renderer, o diálogo
   `#link-dialog` decide e só o "Abrir" libera o navegador. O `send` é um fake
   com nome: guarda o pedido e deixa o teste responder. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createLinkConfirmHost} = require('../link-confirm-host.cjs');

function harness({sendOk = true} = {}) {
  const sent = [];
  const host = createLinkConfirmHost({
    send(channel, payload) { sent.push({channel, payload}); return sendOk; },
    allowSender: (event) => event?.ok === true,
    newId: () => 'pedido-1',
  });
  const ipcHandlers = new Map();
  host.register({handle: (channel, fn) => ipcHandlers.set(channel, fn)});
  return {host, sent, respond: (event, payload) => ipcHandlers.get('link-confirm-respond')(event, payload)};
}

test('só o "Abrir" do diálogo resolve o pedido como true', async () => {
  const box = harness();
  const asked = box.host.confirm('https://exemplo.com/ajuda');
  assert.deepEqual(box.sent, [{channel: 'link-confirm', payload: {id: 'pedido-1', url: 'https://exemplo.com/ajuda'}}]);
  assert.deepEqual(box.respond({ok: true}, {id: 'pedido-1', ok: true}), {ok: true});
  assert.equal(await asked, true);
  assert.equal(box.host.pending.size, 0);
});

test('link que não é https não chega ao renderer', async () => {
  const box = harness();
  assert.equal(await box.host.confirm('http://exemplo.com/'), false);
  assert.equal(await box.host.confirm('file:///etc/passwd'), false);
  assert.deepEqual(box.sent, []);
});

test('recusa, resposta velha e remetente estranho não abrem', async () => {
  const box = harness();
  const refused = box.host.confirm('https://exemplo.com/a');
  assert.deepEqual(box.respond({ok: true}, {id: 'pedido-1', ok: false}), {ok: true});
  assert.equal(await refused, false);
  assert.deepEqual(box.respond({ok: true}, {id: 'pedido-1', ok: true}), {ok: false, stale: true});
  const second = box.host.confirm('https://exemplo.com/b');
  assert.throws(() => box.respond({ok: false}, {id: 'pedido-1', ok: true}), /err\.ipc\.senderDenied/);
  box.host.cancelAll();
  assert.equal(await second, false);
});

test('renderer recarregado ou janela que sumiu fecha o pedido como não', async () => {
  const box = harness();
  const pending = box.host.confirm('https://exemplo.com/a');
  box.host.cancelAll();
  assert.equal(await pending, false);
  assert.equal(box.host.pending.size, 0);
  const gone = harness({sendOk: false});
  assert.equal(await gone.host.confirm('https://exemplo.com/a'), false);
  assert.equal(gone.host.pending.size, 0, 'sem janela não fica pedido pendurado');
});
