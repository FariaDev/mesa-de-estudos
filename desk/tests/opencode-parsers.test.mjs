/* Leitores puros do OpenCode v2.0.32: blocos SSE, query, comandos slash e o
 * rastreador de compactação. Sem rede: o SSE é texto e os eventos entram à mão. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {parseSseBlock, queryString, wireItem, isRefusal} = require('../src/agents/opencode-http.cjs');
const {commandList, parseSlashCommand} = require('../src/agents/opencode-commands.cjs');
const {CompactionTracker} = require('../src/agents/opencode-compaction.cjs');

/* ---------- SSE ---------- */

test('parseSseBlock lê o data JSON e ignora heartbeat, lixo e bloco sem tipo', () => {
  assert.deepEqual(
    parseSseBlock('data: {"type":"session.idle","data":{"sessionID":"ses_1"}}'),
    {type: 'session.idle', data: {sessionID: 'ses_1'}},
  );
  assert.equal(parseSseBlock(': heartbeat'), null);
  assert.equal(parseSseBlock('data: nao-e-json'), null);
  assert.equal(parseSseBlock('data: {"data":{}}'), null);
  assert.deepEqual(parseSseBlock('data: {"type":"x","data":"nao-objeto"}'), {type: 'x', data: {}});
});

/* ---------- query da pasta ---------- */

test('queryString monta a query deepObject e ignora valor vazio', () => {
  assert.equal(
    queryString({'location[directory]': '/tmp/w'}),
    '?location%5Bdirectory%5D=%2Ftmp%2Fw',
  );
  assert.equal(queryString({}), '');
  assert.equal(queryString(undefined), '');
  assert.equal(queryString({'location[directory]': ''}), '');
});

/* ---------- comandos slash ---------- */

test('commandList normaliza o catálogo e descarta item sem nome', () => {
  const payload = {
    location: {},
    data: [
      {name: '/review', description: 'Revisa'},
      {name: ' compact ', description: 'Compacta'},
      {name: '   ', description: 'sem nome'},
    ],
  };
  assert.deepEqual(commandList(payload), [
    {name: 'review', description: 'Revisa'},
    {name: 'compact', description: 'Compacta'},
  ]);
  assert.deepEqual(commandList([{name: 'raw'}]), [{name: 'raw', description: ''}]);
  assert.deepEqual(commandList(null), []);
});

test('parseSlashCommand separa o comando conhecido do argumento', () => {
  const known = [{name: 'review', description: 'Revisa'}];
  assert.deepEqual(parseSlashCommand('/review a prova', known), {name: 'review', text: 'a prova'});
  assert.deepEqual(parseSlashCommand('  /review  ', known), {name: 'review', text: ''});
  assert.equal(parseSlashCommand('/outro a prova', known), null);
  assert.equal(parseSlashCommand('sem barra', known), null);
});

/* ---------- compactação ---------- */

test('begin devolve o mesmo pedido enquanto há um em voo', async () => {
  const tracker = new CompactionTracker();
  const first = tracker.begin();
  assert.equal(tracker.begin(), first);

  tracker.receive('compaction_end', {text: 'fim'});
  const settled = await first.promise;
  assert.equal(settled.status, 'ended');
  assert.equal(settled.summary, 'fim');
});

test('compaction_delta acumula até o end', async () => {
  const tracker = new CompactionTracker();
  const waiter = tracker.begin();
  tracker.receive('compaction_delta', {text: 'resumo '});
  tracker.receive('compaction_delta', {text: 'cresce'});
  tracker.receive('compaction_end', {});

  const settled = await waiter.promise;
  assert.equal(settled.status, 'ended');
  assert.equal(settled.summary, 'resumo cresce');
});

test('compaction_end resolve com ended e o texto do evento', async () => {
  const tracker = new CompactionTracker();
  const waiter = tracker.begin();
  tracker.receive('compaction_end', {text: 'resumo inteiro'});

  const settled = await waiter.promise;
  assert.equal(settled.status, 'ended');
  assert.equal(settled.summary, 'resumo inteiro');
});

test('compaction_failed resolve failed com o erro marcado como notSent false', async () => {
  const tracker = new CompactionTracker();
  const waiter = tracker.begin();
  tracker.receive('compaction_failed', {message: 'falhou'});

  const settled = await waiter.promise;
  assert.equal(settled.status, 'failed');
  assert.equal(settled.error.message, 'falhou');
  assert.equal(settled.error.notSent, false);
});

test('abandon resolve abandoned', async () => {
  const tracker = new CompactionTracker();
  const waiter = tracker.begin();
  tracker.abandon(waiter);

  const settled = await waiter.promise;
  assert.equal(settled.status, 'abandoned');
});

test('timeout pequeno resolve timeout', async () => {
  const tracker = new CompactionTracker({timeoutMs: 10});
  const waiter = tracker.begin();

  const settled = await waiter.promise;
  assert.equal(settled.status, 'timeout');
});

test('wireItem abre o envelope {data} e isRefusal só aceita a recusa comprovada', () => {
  assert.deepEqual(wireItem({data: {type: 'user', id: 'msg_1'}}), {type: 'user', id: 'msg_1'});
  assert.deepEqual(wireItem({type: 'compaction'}), {type: 'compaction'});
  assert.deepEqual(wireItem(null), {});
  assert.deepEqual([400, 401, 404, 409, 500, 200].map(isRefusal), [true, true, true, true, false, false]);
});
