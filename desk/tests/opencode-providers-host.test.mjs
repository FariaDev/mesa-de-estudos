/* Host da entrada por provedor do OpenCode: a lista do `serve`, o login por
   OAuth e por chave, o cancelamento e as recusas — sem tocar no OpenCode real,
   no cofre ou no `auth.json`. O fake nomeado é o `fake-opencode.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';

const require = createRequire(import.meta.url);
const {createOpenCodeProvidersHost} = require('../opencode-providers-host.cjs');

function harness({serveOptions = {}, binary = '/fake/opencode', oldVersion = '', acquireError = null, openExternal} = {}) {
  const calls = {logs: [], opened: [], relinks: 0};
  const handlers = new Map();
  const ipcMain = {handle: (name, fn) => handlers.set(name, fn)};
  let serve = null;
  const acquire = async () => {
    if (acquireError) throw acquireError;
    if (!serve) serve = await createFakeOpencodeServe({password: 'p', ...serveOptions});
    return {baseUrl: serve.url, password: 'p'};
  };
  const host = createOpenCodeProvidersHost({
    ipcMain,
    acquire,
    binary: () => binary,
    oldVersion: () => oldVersion,
    openExternal: openExternal || (async (url) => { calls.opened.push(url); return true; }),
    relinkTutor: async () => { calls.relinks += 1; return {relinked: true}; },
    appendLog: (_area, line) => calls.logs.push(line),
  });
  const call = (name, payload) => handlers.get(name)({}, payload);
  return {host, call, calls, getServe: () => serve, close: async () => { if (serve) await serve.close(); }};
}

test('lista provedores com estado sem devolver credencial', async () => {
  const fake = {
    serveOptions: {connections: {
      openai: [{type: 'credential', id: 'c1', label: 'conta', method: 'oauth'}],
      xai: [{type: 'credential', id: 'c2', label: 'conta', method: 'oauth', status: {status: 'needs_auth', message: 'expired'}}],
      anthropic: [{type: 'env', name: 'ANTHROPIC_API_KEY'}],
    }},
  };
  const h = harness(fake);
  const result = await h.call('opencode-providers');
  assert.equal(result.state, 'ready');
  const rows = new Map(result.providers.map((row) => [row.id, row]));
  assert.equal(rows.get('openai').status, 'connected');
  assert.equal(rows.get('xai').status, 'expired');
  assert.equal(rows.get('openai').plan.methodID, 'chatgpt-token-sharing');
  const anthropic = result.others.find((row) => row.id === 'anthropic');
  assert.equal(anthropic.status, 'connected');
  assert.equal(anthropic.environment, true);
  assert.ok(!/sk-|Bearer|"value"|"access"|"refresh"|"token"/i.test(JSON.stringify(result)), 'a lista não carrega segredo');
  await h.close();
});

test('OpenCode ausente e antigo não sobem servidor', async () => {
  const missing = harness({binary: ''});
  assert.equal((await missing.call('opencode-providers')).state, 'missing');
  const old = harness({binary: '', oldVersion: '1.19.5'});
  const result = await old.call('opencode-providers');
  assert.equal(result.state, 'old');
  assert.equal(result.version, '1.19.5');
});

test('porta recusada vira estado próprio', async () => {
  const error = Object.assign(Error('fetch failed'), {code: 'ECONNREFUSED'});
  const h = harness({acquireError: error});
  assert.equal((await h.call('opencode-providers')).state, 'port');
});

test('OAuth abre o navegador, conclui e religa a ponte', async () => {
  const h = harness({serveOptions: {oauthOutcome: 'complete', oauthPolls: 1}});
  const started = await h.call('opencode-provider-login-start', {integrationID: 'openai', methodID: 'chatgpt-token-sharing'});
  assert.equal(started.ok, true);
  assert.equal(started.kind, 'oauth');
  assert.equal(h.calls.opened.length, 1);
  assert.match(h.calls.opened[0], /^https:\/\/auth\.example\.test\/openai/);
  const done = await h.call('opencode-provider-login-status', {attemptID: started.attemptID});
  assert.equal(done.status, 'complete');
  assert.equal(h.calls.relinks, 1);
  assert.ok(!h.calls.logs.some((line) => line.includes('code=FAKE')), 'o log não guarda o URL de autorização');
  await h.close();
});

test('OAuth de código conclui pelo formulário e religa uma vez', async () => {
  const h = harness({serveOptions: {oauthMode: 'code', oauthOutcome: 'pending'}});
  const started = await h.call('opencode-provider-login-start', {integrationID: 'xai', methodID: 'device'});
  assert.equal(started.ok, true);
  assert.equal(started.mode, 'code');
  const done = await h.call('opencode-provider-login-complete', {attemptID: started.attemptID, code: 'ABCD-EFGH'});
  assert.equal(done.ok, true);
  assert.equal(done.status, 'complete');
  assert.equal(h.calls.relinks, 1);
  assert.ok(!JSON.stringify(done).includes('ABCD-EFGH'), 'o código não volta para a janela');
  await h.close();
});

test('OAuth cancelado faz DELETE e não religa', async () => {
  const h = harness({serveOptions: {oauthOutcome: 'pending'}});
  const started = await h.call('opencode-provider-login-start', {integrationID: 'xai', methodID: 'device'});
  assert.equal(started.ok, true);
  await h.call('opencode-provider-login-cancel', {attemptID: started.attemptID});
  assert.equal((await h.call('opencode-provider-login-status', {attemptID: started.attemptID})).status, 'expired');
  assert.equal(h.calls.relinks, 0);
  const fake = h.getServe();
  assert.ok(fake.requests.some((entry) => entry.method === 'DELETE' && /connect\/oauth/.test(entry.url)));
  await h.close();
});

test('OAuth que falha no provedor não vaza a mensagem crua', async () => {
  const h = harness({serveOptions: {oauthOutcome: 'failed'}});
  const started = await h.call('opencode-provider-login-start', {integrationID: 'openai', methodID: 'chatgpt-token-sharing'});
  const failed = await h.call('opencode-provider-login-status', {attemptID: started.attemptID});
  assert.equal(failed.status, 'failed');
  const everything = JSON.stringify(failed) + h.calls.logs.join('\n');
  assert.ok(!everything.includes('sk-fake-secret-123456'), everything);
  await h.close();
});

test('chave de API entra, conclui e não aparece em log nem no retorno', async () => {
  const key = 'sk-mesa-teste-1234567890abcdef';
  const h = harness();
  const result = await h.call('opencode-provider-login-start', {integrationID: 'opencode-go', key});
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'complete');
  assert.equal(h.calls.relinks, 1);
  const fake = h.getServe();
  assert.ok(fake.connections['opencode-go'].some((connection) => connection.method === 'key'));
  const everything = JSON.stringify(result) + h.calls.logs.join('\n') + JSON.stringify(await h.call('opencode-providers'));
  assert.ok(!everything.includes(key), 'a chave não sai do campo');
  await h.close();
});

test('chave recusada vira outcome rejected, sem eco da chave', async () => {
  const key = 'sk-mesa-recusada-1234567890';
  const h = harness({serveOptions: {keyOutcome: 'reject'}});
  const result = await h.call('opencode-provider-login-start', {integrationID: 'opencode-go', key});
  assert.equal(result.ok, false);
  assert.equal(result.outcome, 'rejected');
  assert.ok(!JSON.stringify(result).includes(key));
  assert.ok(!h.calls.logs.join('\n').includes(key));
  await h.close();
});

test('navegador que não abre volta com browser:false e mantém a tentativa', async () => {
  const h = harness({serveOptions: {oauthOutcome: 'pending'}, openExternal: async () => { throw Error('sem navegador'); }});
  const result = await h.call('opencode-provider-login-start', {integrationID: 'xai', methodID: 'device'});
  assert.equal(result.ok, true);
  assert.equal(result.browser, false);
  assert.ok(result.url, 'o endereço fica na tela para abrir à mão');
  assert.equal((await h.call('opencode-provider-login-status', {attemptID: result.attemptID})).status, 'pending');
  await h.close();
});
