import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fakeClock, fakeNetwork} from './fake-phone-upload.mjs';

/* Fila de fotos da página do celular (#36), rodada com rede e relógio falsos.
   Cada teste diz qual regra da #36 prova: o envio que não responde é abortado
   e refeito; a foto escolhida durante um envio não se perde; `busy` volta a
   `false` depois de erro; a cópia que vai para a página funciona sozinha. */
const require = createRequire(import.meta.url);
const {createPhotoUploader, UPLOAD_LIMITS} = require('../phone-upload.cjs');

const MB = 1048576;
const flush = () => new Promise((resolve) => setImmediate(resolve));
/* Foto falsa: a fila só lê o tamanho. */
const photo = (bytes = MB) => ({size: bytes});

function setup({network = fakeNetwork(), clock = fakeClock(), sentHook = () => {}, create = createPhotoUploader} = {}) {
  const events = [];
  const uploader = create({
    post: network.post,
    newController: () => new AbortController(),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    limits: UPLOAD_LIMITS,
    on: {
      added: (item) => events.push({name: 'added', item}),
      sent: (item, done, total) => { events.push({name: 'sent', item, done, total}); sentHook(); },
      dropped: (item) => events.push({name: 'dropped', item}),
      phase: (name, detail) => events.push({name: `phase:${name}`, ...detail}),
    },
  });
  const count = (name) => events.filter((event) => event.name === name).length;
  return {uploader, network, clock, events, count};
}

test('um envio que não responde é abortado no prazo e refeito, uma vez', async () => {
  const {uploader, network, clock, count, events} = setup();
  const sending = uploader.enqueue([photo()]);
  await flush();
  assert.equal(network.calls.length, 1);
  clock.fire();
  await flush();
  assert.equal(network.calls[0].signal.aborted, true, 'o primeiro pedido foi abortado');
  assert.equal(network.calls.length, 2, 'uma tentativa automática a mais');
  network.calls[1].answer('ok');
  await sending;
  assert.equal(count('sent'), 1);
  assert.equal(count('phase:offline'), 0, 'o aborto não cai em offline enquanto a segunda tentativa anda');
  assert.equal(events.at(-1).name, 'phase:sent');
  assert.equal(uploader.busy(), false);
});

test('regressão #36: o reenvio da mesma foto leva o mesmo id; outra foto leva outro', async () => {
  const {uploader, network, clock} = setup();
  const sending = uploader.enqueue([photo(), photo()]);
  await flush();
  const firstId = network.calls[0].id;
  assert.match(firstId, /^[0-9a-f]{24}$/, 'id aleatório por foto');
  clock.fire();
  await flush();
  assert.equal(network.calls[1].id, firstId, 'a tentativa repetida carrega o mesmo id (o servidor não duplica)');
  network.calls[1].answer('ok');
  await flush();
  assert.notEqual(network.calls[2].id, firstId, 'a segunda foto ganha um id próprio');
  network.calls[2].answer('ok');
  await sending;
});

test('regressão #36: a foto escolhida durante um envio entra na fila e sai depois, na ordem', async () => {
  const {uploader, network, count} = setup();
  const first = photo(), second = photo();
  const sending = uploader.enqueue([first]);
  await flush();
  const late = uploader.enqueue([second]);
  assert.equal(network.calls.length, 1, 'a segunda espera o primeiro envio terminar');
  network.calls[0].answer('ok');
  await flush();
  assert.equal(network.calls[1].file, second, 'a foto que chegou tarde sai em seguida');
  network.calls[1].answer('ok');
  await Promise.all([sending, late]);
  assert.equal(count('sent'), 2, 'nenhuma foto se perde');
});

test('regressão #36: depois de duas falhas de rede a fila para em offline, com busy em false, e o "Tentar de novo" retoma', async () => {
  const {uploader, network, count, events} = setup();
  const sending = uploader.enqueue([photo()]);
  await flush();
  network.calls[0].answer('network');
  await flush();
  network.calls[1].answer('network');
  await sending;
  assert.equal(uploader.busy(), false, 'busy não fica preso depois do erro');
  assert.equal(events.at(-1).name, 'phase:offline');
  assert.equal(count('dropped'), 0, 'a foto não some: fica na fila para o retry');
  const retry = uploader.resume();
  await flush();
  assert.equal(network.calls.length, 3, 'o retry manda a foto de novo');
  network.calls[2].answer('ok');
  await retry;
  assert.equal(count('sent'), 1);
  assert.equal(uploader.busy(), false);
});

test('regressão #36: erro dentro de um callback não deixa busy preso', async () => {
  const {uploader, network} = setup({sentHook: () => { throw new Error('bandeja caiu'); }});
  const sending = uploader.enqueue([photo()]);
  await flush();
  network.calls[0].answer('ok');
  await assert.rejects(sending, /bandeja caiu/);
  assert.equal(uploader.busy(), false, 'o finally devolveu busy a false');
  const again = uploader.enqueue([photo()]);
  await flush();
  assert.equal(network.calls.length, 2, 'a fila volta a enviar depois do erro');
  network.calls[1].answer('ok');
  await assert.rejects(again, /bandeja caiu/);
});

test('recusa de tipo ou tamanho pula só aquela foto; sessão cheia esvazia a fila', async () => {
  const {uploader, network, count, events} = setup();
  const sending = uploader.enqueue([photo(), photo(), photo()]);
  await flush();
  network.calls[0].answer({status: 415, reason: 'type'});
  await flush();
  network.calls[1].answer('ok');
  await flush();
  network.calls[2].answer('ok');
  await sending;
  assert.equal(count('sent'), 2, 'as outras duas saíram');
  assert.equal(count('dropped'), 1, 'só a recusada saiu da bandeja');
  assert.equal(events.at(-1).name, 'phase:refused');
  assert.equal(events.at(-1).verdict.status, 415);
});

test('recusa de sessão cheia (413 "full") esvazia o resto da fila sem novo pedido', async () => {
  const {uploader, network, count} = setup();
  const sending = uploader.enqueue([photo(), photo()]);
  await flush();
  network.calls[0].answer({status: 413, reason: 'full'});
  await sending;
  assert.equal(network.calls.length, 1, 'a segunda não é enviada');
  assert.equal(count('dropped'), 2, 'as duas saem da bandeja');
});

test('voltar à página aborta o envio pendurado e reenvia; sem envio, não faz nada', async () => {
  const {uploader, network} = setup();
  const sending = uploader.enqueue([photo()]);
  await flush();
  const woke = uploader.wake();
  await flush();
  assert.equal(network.calls[0].signal.aborted, true, 'o envio de antes de bloquear foi abortado');
  assert.equal(network.calls.length, 2, 'e a foto foi refeita');
  network.calls[1].answer('ok');
  await Promise.all([sending, woke]);
  await uploader.wake();
  assert.equal(network.calls.length, 2, 'sem fila, voltar à página não manda nada');
});

test('o prazo cresce com o tamanho (20 s + 1 s por MB) e para no teto de 60 s', async () => {
  const {uploader, network, clock} = setup();
  const empty = uploader.enqueue([photo(0)]);
  await flush();
  assert.deepEqual(clock.delays(), [20000]);
  network.calls[0].answer('ok');
  await empty;
  const ten = uploader.enqueue([photo(10 * MB)]);
  await flush();
  assert.deepEqual(clock.delays(), [30000]);
  network.calls[1].answer('ok');
  await ten;
  const huge = uploader.enqueue([photo(100 * MB)]);
  await flush();
  assert.deepEqual(clock.delays(), [60000], 'nada passa do teto');
  network.calls[2].answer('ok');
  await huge;
});

test('a cópia que vai para a página roda sozinha: sem nada do módulo, só com o que o script põe', async () => {
  const source = createPhotoUploader.toString();
  assert.doesNotMatch(source, /require\(|<\/script|UPLOAD_LIMITS/, 'o corpo não cita o módulo nem fecha o <script>');
  const inPage = vm.runInNewContext(`(${source})`, {});
  const {uploader, network, count} = setup({create: inPage});
  const sending = uploader.enqueue([photo()]);
  await flush();
  network.calls[0].answer('ok');
  await sending;
  assert.equal(count('sent'), 1);
});
