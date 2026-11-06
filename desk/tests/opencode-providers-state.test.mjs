/* Estados da entrada por provedor do OpenCode (#login no app): a lista vira
   linhas com estado e plano, nada de credencial; a tentativa OAuth vira um
   prazo e um URL só de http(s); e a frase de erro perde chave/token. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationList, loginPlan, providerLoginAction, normalizeAttempt, normalizeAttemptStatus, providerView, providersResult, safeReason} from '../src/opencode-providers-state.mjs';

const integration = (id, extra = {}) => ({id, name: id.toUpperCase(), methods: [], connections: [], ...extra});
const keyMethod = (id = '') => ({...(id ? {id} : {}), type: 'key', label: 'API key'});
const oauthMethod = (id, label = 'Browser') => ({id, type: 'oauth', label});

test('lista crua e envelope {data} viram as mesmas integrações', () => {
  const data = [integration('openai', {methods: [oauthMethod('chatgpt-token-sharing')]})];
  assert.deepEqual(integrationList({data}), integrationList(data));
  assert.equal(integrationList({data})[0].id, 'openai');
});

test('conexão vira estado; credencial expirada vence; ambiente aparece marcado', () => {
  const payload = {data: [
    integration('openai', {methods: [oauthMethod('chatgpt-token-sharing')], connections: [{type: 'credential', id: 'c1', label: 'conta', method: 'oauth'}]}),
    integration('xai', {methods: [oauthMethod('device')], connections: [{type: 'credential', id: 'c2', label: 'conta', method: 'oauth', status: {status: 'needs_auth', message: 'x'}}]}),
    integration('anthropic', {methods: [keyMethod()], connections: [{type: 'env', name: 'ANTHROPIC_API_KEY'}]}),
  ]};
  const {providers} = providerView(payload);
  assert.equal(providers.find((row) => row.id === 'openai').status, 'connected');
  assert.equal(providers.find((row) => row.id === 'xai').status, 'expired');
  const other = providerView(payload).others.find((row) => row.id === 'anthropic');
  assert.equal(other.status, 'connected');
  assert.equal(other.environment, true);
});

test('ChatGPT e Grok usam o OAuth preferido; a chave fica como alternativa', () => {
  const payload = {data: [
    integration('openai', {methods: [keyMethod(), oauthMethod('chatgpt-browser'), oauthMethod('chatgpt-token-sharing', 'Sign in with ChatGPT')]}),
    integration('xai', {methods: [keyMethod('manual'), oauthMethod('device', 'SuperGrok')]}),
  ]};
  const {providers} = providerView(payload);
  const chatgpt = providers.find((row) => row.id === 'openai');
  const grok = providers.find((row) => row.id === 'xai');
  assert.equal(chatgpt.plan.kind, 'oauth');
  assert.equal(chatgpt.plan.methodID, 'chatgpt-token-sharing');
  assert.equal(grok.plan.methodID, 'device');
  assert.ok(chatgpt.methods.some((method) => method.type === 'key' && method.usable));
});

test('chave de API é o plano quando não há OAuth sem formulário', () => {
  const plan = loginPlan(integrationList({data: [integration('anthropic', {methods: [keyMethod('manual')]})]})[0]);
  assert.equal(plan.kind, 'key');
  assert.equal(plan.methodID, 'manual');
  /* Plano só de chave ia para `/connect/oauth` e falhava: não havia campo. */
  assert.equal(providerLoginAction(plan), 'key');
  assert.equal(providerLoginAction({kind: 'oauth', methodID: 'm'}), 'login');
  assert.equal(providerLoginAction({kind: 'unsupported', methodID: ''}), '');
});

test('método com formulário ou comando fica de fora e mostra o comando com --method', () => {
  const payload = {data: [integration('azure', {methods: [
    {id: 'entra', type: 'key', label: 'Azure', form: [{key: 'resourceName', type: 'string'}]},
    {id: 'aws-profile', type: 'external', label: 'AWS profile'},
  ]})]};
  const row = providerView(payload).others.find((item) => item.id === 'azure');
  assert.equal(row.plan.kind, 'unsupported');
  assert.match(row.command, /^auth login azure --method /);
});

test('os outros vêm conectados primeiro, sem duplicar os dois curados', () => {
  const payload = {data: [
    integration('zebra', {methods: [keyMethod()]}),
    integration('openai', {methods: [oauthMethod('chatgpt-token-sharing')]}),
    integration('alpha', {methods: [keyMethod()], connections: [{type: 'credential', id: 'c', label: 'conta', method: 'key'}]}),
  ]};
  const {providers, others} = providerView(payload);
  assert.deepEqual(providers.map((row) => row.id), ['openai', 'xai']);
  assert.deepEqual(others.map((row) => row.id), ['alpha', 'zebra']);
});

test('frase de erro não carrega chave, Bearer, token de query nem quebra de linha', () => {
  const raw = 'invalid key sk-abc123456789\nAuthorization: Bearer abc.def\nhttps://x.test/cb?code=SEGREDO&state=1';
  const clean = safeReason(raw);
  assert.ok(!clean.includes('sk-abc'), clean);
  assert.ok(!clean.includes('abc.def'), clean);
  assert.ok(!clean.includes('SEGREDO'), clean);
  assert.ok(!clean.includes('\n'), clean);
});

test('tentativa OAuth normaliza URL, modo e prazo, e recusa ftp', () => {
  const now = 1_000_000;
  const attempt = normalizeAttempt({data: {
    attemptID: 'con_1',
    url: 'https://auth.example/start?code=abc',
    instructions: 'Enter ABC',
    mode: 'code',
    time: {created: now - 60_000, expires: now + 120_000},
  }}, now);
  assert.equal(attempt?.attemptID, 'con_1');
  assert.equal(attempt?.mode, 'code');
  assert.equal(attempt?.expiresInMs, 120_000);
  assert.equal(normalizeAttempt({data: {attemptID: 'con_2', url: 'ftp://x/y', time: {created: now, expires: now + 1000}}}, now)?.url, '');
});

test('estado da tentativa só aceita os quatro nomes e preserva a mensagem sanitizada', () => {
  assert.equal(normalizeAttemptStatus({data: {status: 'pending'}}).status, 'pending');
  assert.equal(normalizeAttemptStatus({data: {status: 'complete'}}).status, 'complete');
  const failed = normalizeAttemptStatus({data: {status: 'failed', message: 'bad key sk-segredo123456'}});
  assert.equal(failed.status, 'failed');
  assert.ok(!failed.message.includes('sk-segredo'));
  assert.equal(normalizeAttemptStatus({data: {status: 'weird'}}).status, 'failed');
});


test('retorno do host vira vista só com estados conhecidos e listas', () => {
  const view = providersResult({state: 'ready', providers: [{id: 'openai'}], others: undefined, binary: '/o', platform: 'linux'});
  assert.equal(view.state, 'ready');
  assert.deepEqual(view.providers.map((row) => row.id), ['openai']);
  assert.deepEqual(view.others, []);
  assert.equal(view.binary, '/o');
  assert.equal(providersResult({state: 'explodiu'}).state, 'unreachable');
  assert.deepEqual(providersResult(null).providers, []);
});
