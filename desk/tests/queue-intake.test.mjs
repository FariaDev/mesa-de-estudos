/* Regressão da auditoria de máquinas de estado (fila #1): com a fila segurada,
   um envio direto que o host não confirma não pode soltar a fila. Antes, o
   `submit` chamava `release()` ANTES de saber o desfecho; a fila continuava
   com itens, mas `held=false` tirava o "Enviar agora" da faixa — só o "Limpar"
   recuperava. O envio aceito continua soltando a fila. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQueueIntake} from '../src/queue-intake.mjs';
import {fakeChatSend, UNCERTAIN, REFUSED, ACCEPTED} from './fixtures/fake-chat-send.mjs';
import {fakeHeldQueue} from './fixtures/fake-held-queue.mjs';

function harness(hostOutcomes) {
  const queue = fakeHeldQueue(['guardada']);
  const fake = fakeChatSend(hostOutcomes);
  const heldWhenSent = [];
  const intake = createQueueIntake({
    enqueue: (text) => queue.enqueue(text),
    release: () => queue.release(),
    isHeld: () => queue.held,
    rehold: () => queue.rehold(),
    send: (...args) => {
      heldWhenSent.push(queue.held);
      return fake.send(...args);
    },
    isComposerCommand: () => false,
    state: () => ({attachments: [], pdfAttachments: [], connected: true, busy: false, switching: false}),
    prompt: () => null,
    connect: async () => {},
  });
  return {queue, fake, intake, heldWhenSent};
}

for (const [name, outcome] of [['incerto', UNCERTAIN], ['recusado', REFUSED]]) {
  test(`envio ${name} não solta a fila guardada: o item fica e "Enviar agora" continua`, async () => {
    const {queue, fake, intake} = harness([outcome]);
    await intake.submit('nova mensagem');
    assert.equal(fake.calls[0].text, 'nova mensagem', 'o envio direto levou a mensagem nova');
    assert.deepEqual(fake.calls[0].outcome, outcome, 'o host devolveu o desfecho sem aceite');
    assert.deepEqual(queue.items, ['guardada'], 'a mensagem guardada continua na fila');
    assert.equal(queue.held, true, 'a fila continua segurada');
    assert.equal(queue.canSendNow(), true, 'a faixa ainda oferece "Enviar agora"');
  });
}

test('envio aceito solta a fila guardada', async () => {
  const {queue, intake} = harness([ACCEPTED]);
  await intake.submit('nova mensagem');
  assert.deepEqual(queue.items, ['guardada'], 'a fila guardada não é descartada');
  assert.equal(queue.held, false, 'o envio aceito libera a fila');
  assert.equal(queue.canSendNow(), false, 'sem fila segurada, "Enviar agora" sai da faixa');
});

test('a fila solta antes do envio: o fim de um turno rápido já a encontra livre', async () => {
  const {queue, intake, heldWhenSent} = harness([ACCEPTED]);
  await intake.submit('nova mensagem');
  assert.deepEqual(heldWhenSent, [false], 'segurar até o aceite faria o fim do turno pular a fila');
  assert.equal(queue.held, false);
});

test('fila que não estava segurada não volta a segurar no envio recusado', async () => {
  const queue = fakeHeldQueue([]);
  const fake = fakeChatSend([REFUSED]);
  const intake = createQueueIntake({
    enqueue: (text) => queue.enqueue(text), release: () => queue.release(),
    isHeld: () => queue.held, rehold: () => queue.rehold(), send: fake.send,
    isComposerCommand: () => false,
    state: () => ({attachments: [], pdfAttachments: [], connected: true, busy: false, switching: false}),
    prompt: () => null, connect: async () => {},
  });
  await intake.submit('nova mensagem');
  assert.equal(queue.held, false);
});
