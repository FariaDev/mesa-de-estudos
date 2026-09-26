/* Fila e bandeja guardadas no disco (Mesa).
 *
 * O caminho real: o renderer manda itens/anexos por IPC, `pending.cjs` corta
 * pelo teto do núcleo (`core/pending.bend`) e grava `runtime/pending.json`; o
 * boot seguinte hidrata a faixa e a bandeja. Aqui o teste fala direto com o
 * módulo (sem Electron e sem Pi), em runtime temporário.
 *
 * O que NÃO é testado aqui: o DOM da faixa (isso é do `hunt-queue.mjs`) e a
 * conversa real com o Pi.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const pending = require('../pending.cjs');

const SESSION = 'pi-1700000000000.jsonl';

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-pending-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const fileOf = (runtime) => join(runtime, pending.FILENAME);
const readStore = (runtime) => JSON.parse(readFileSync(fileOf(runtime), 'utf8'));
/* Anexo na forma da bandeja do composer (o que o renderer manda por IPC). */
const png = (chars = 16) => ({dataUrl: `data:image/png;base64,${'A'.repeat(chars)}`, mimeType: 'image/png', name: 'captura.png', capturedAt: 1, exercise: 'Lista 2'});

test('a fila guarda ordem, texto, referências e anexos do item', () => {
  withRuntime((runtime) => {
    const session = join(runtime, SESSION);
    const out = pending.saveQueue(runtime, session, [
      {text: 'primeira', refs: [{path: '/tmp/a.pdf', page: 3}], images: [png()]},
      {text: 'segunda', refs: [{path: '/tmp/b.pdf', page: 0}], images: []},
    ], false);
    assert.equal(out.items.length, 2);
    assert.equal(out.dropped, 0);
    const store = readStore(runtime)[session];
    assert.deepEqual(store.items.map((item) => item.text), ['primeira', 'segunda'], 'a ordem da fila é a que fica');
    assert.deepEqual(store.items[0].refs, [{path: '/tmp/a.pdf', page: 3}]);
    assert.equal(store.items[1].refs[0].page, 1, 'página 0 vira 1 (a forma do #page=N)');
    assert.equal(store.items[0].images.length, 1);
    assert.equal(store.held, false);
    assert.equal(existsSync(`${fileOf(runtime)}.tmp`), false, 'gravação atômica não deixa o tmp para trás');
    assert.ok(statSync(fileOf(runtime)).size > 0);
  });
});

test('item sem texto e sem anexo não entra na fila', () => {
  withRuntime((runtime) => {
    const session = join(runtime, SESSION);
    const out = pending.saveQueue(runtime, session, [
      {text: '   ', images: []},
      {text: '', images: [png()]},
      {text: 'fica', refs: [], images: []},
    ], false);
    assert.deepEqual(out.items.map((item) => item.text), ['', 'fica'], 'o vazio cai; o que tem anexo fica');
    assert.equal(out.items[0].images.length, 1);
  });
});

test('o save da bandeja não apaga a fila nem a guarda dela', () => {
  withRuntime((runtime) => {
    const session = join(runtime, SESSION);
    pending.saveQueue(runtime, session, [{text: 'na fila', refs: [], images: []}], true);
    const out = pending.saveTray(runtime, session, [png()]);
    assert.equal(out.held, true, 'held é do arquivo: o save da bandeja preserva o que estava lá');
    assert.deepEqual(out.items.map((item) => item.text), ['na fila'], 'a fila não é tocada pelo save da bandeja');
    assert.equal(out.attachments.length, 1);
    assert.equal(pending.readPending(runtime, session).attachments.length, 1);
  });
});

test('fila lida por outra execução não é "live" (o renderer a marca recuperada)', () => {
  withRuntime((runtime) => {
    const session = join(runtime, SESSION);
    mkdirSync(runtime, {recursive: true});
    /* Arquivo escrito "por outra execução": nada foi salvo por esta. */
    writeFileSync(fileOf(runtime), JSON.stringify({[session]: {items: [{id: 'a', text: 'pendente', refs: [], images: []}], attachments: [], held: false}}));
    const read = pending.readPending(runtime, session);
    assert.equal(read.live, false);
    assert.equal(read.held, false);
    assert.deepEqual(read.items.map((item) => item.text), ['pendente']);
    pending.saveQueue(runtime, session, read.items, true);
    const mine = pending.readPending(runtime, session);
    assert.equal(mine.live, true, 'depois do primeiro save da execução, a conversa é desta execução');
    assert.equal(mine.held, true);
  });
});

test('leitura tolerante: arquivo torto, gigante, lista no lugar do objeto e chave estranha', () => {
  withRuntime((runtime) => {
    const session = join(runtime, SESSION);
    assert.deepEqual(pending.readPending(runtime, session), {items: [], attachments: [], held: false, live: false}, 'sem arquivo não há nada guardado');

    mkdirSync(runtime, {recursive: true});
    writeFileSync(fileOf(runtime), '{isso não é json');
    assert.deepEqual(pending.readPending(runtime, session).items, [], 'JSON torto vira vazio');

    writeFileSync(fileOf(runtime), JSON.stringify([{items: []}]));
    assert.deepEqual(pending.readPending(runtime, session).items, [], 'lista no lugar do objeto vira vazio');

    writeFileSync(fileOf(runtime), JSON.stringify({
      ['__proto__']: {items: []},
      [session]: {items: [{id: 'a', text: 'ok', refs: [], images: []}], attachments: []},
      outra: 'não é entrada',
    }));
    const read = pending.readPending(runtime, session);
    assert.deepEqual(read.items.map((item) => item.text), ['ok'], 'a entrada boa sobrevive ao lado do lixo');
    assert.equal(read.held, false);

    /* Data URL solto (arquivo editado à mão) ainda é um anexo. */
    const loose = pending.saveTray(runtime, session, [png().dataUrl]);
    assert.equal(loose.attachments.length, 1);
    assert.equal(loose.attachments[0].dataUrl, png().dataUrl);

    writeFileSync(fileOf(runtime), ' '.repeat(pending.MAX_STORED_BYTES + 1));
    assert.deepEqual(pending.readPending(runtime, session).items, [], 'arquivo acima do teto é recusado na leitura');
  });
});

test('teto de disco: a fila entra primeiro e a bandeja perde as últimas imagens', () => {
  withRuntime((runtime) => {
    const session = join(runtime, SESSION);
    /* Quatro imagens de 12 MiB (em chars) passam pelo teto do núcleo: 48 MiB.
       O arquivo inteiro cabe em 40 MiB, então a bandeja perde as últimas. */
    const big = png(12 * 1024 * 1024);
    const out = pending.saveTray(runtime, session, [big, big, big, big]);
    assert.equal(out.trayDropped, true, 'o que não coube é avisado (não é descartado em silêncio)');
    assert.ok(out.attachments.length < 4, 'a bandeja encolhe até caber');
    assert.ok(statSync(fileOf(runtime)).size <= pending.MAX_STORED_BYTES);
    assert.equal(pending.readPending(runtime, session).attachments.length, out.attachments.length, 'o que ficou no arquivo é o que o renderer recebe');

    /* Com a fila ocupando espaço, é ela que fica: a bandeja é quem encolhe. */
    const before = pending.saveTray(runtime, session, [big, big, big, big]);
    const queue = pending.saveQueue(runtime, session, [
      {text: 'a', refs: [], images: [big]},
      {text: 'b', refs: [], images: [big]},
    ], true);
    assert.equal(queue.items.length, 2, 'a fila inteira fica quando ela sozinha cabe');
    assert.ok(queue.attachments.length < before.attachments.length, 'a bandeja cede espaço para a fila');
  });
});

test('poda: a conversa cujo arquivo sumiu sai do pending.json', () => {
  withRuntime((runtime) => {
    const alive = join(runtime, 'pi-alive.jsonl');
    const gone = join(runtime, 'pi-gone.jsonl');
    writeFileSync(alive, '');
    pending.saveQueue(runtime, gone, [{text: 'some', refs: [], images: []}], false);
    pending.saveQueue(runtime, alive, [{text: 'fica', refs: [], images: []}], false);
    const store = readStore(runtime);
    assert.deepEqual(Object.keys(store), [alive], 'só a conversa que ainda existe no disco fica');
    assert.deepEqual(store[alive].items.map((item) => item.text), ['fica']);
    assert.equal(pending.readPending(runtime, gone).items.length, 0);
  });
});
