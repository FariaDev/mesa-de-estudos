#!/usr/bin/env node
/* Caça do OpenCode 1.19.5 real (#91): o binário estável que o app encontra no
   PATH fala DUAS APIs no `serve`. A v2 (`/api/session`) é a que o adaptador da
   Mesa usa desde a #57; no 1.19.5 ela exige `prompt: {text}` no pedido (o
   `{text}` do 2.x devolve 400 "Missing key at [\"prompt\"]") e NÃO expõe o MCP
   da Mesa. A v1 (`/session`) é a API estável: usa o MCP do `opencode.json`
   (`mcp.mesa`), entrega o turno de forma síncrona e respeita o mesmo config de
   `tools`/`permission`.

   O hunt prova o que a #91 precisa no 1.19.5, com `serve` real e provedor falso:

   1. o `debug config` resolve `tools` false para todas as nativas e
      `permission` em `deny` (com `*: deny` e `mesa_*: allow`);
   2. o MCP `mesa` no config expõe SÓ `mesa_*` ao provedor pela v1 — nenhuma
      nativa, nem `skill`;
   3. um pedido de `bash` do modelo é recusado ("unavailable tool") e não cria
      o arquivo fora da pasta;
   4. o turno completa pela v1 (resposta `finish: stop` com o texto);
   5. o corpo do 400 da v2 com o pedido do adaptador fica registrado, para
      ninguém confundir a incompatibilidade de API com regressão da #91;
   6. o adaptador da Mesa recusa conectar no 1.19.5 antes de qualquer sessão
      ou prompt, com a versão na frase.

   Sem `LEARNING_DESK_OPENCODE_1195` (ou sem o binário 1.19.x em
   `~/.local/bin/opencode`), PULA (77). O runner de hunts entende "PULADO:" e
   não conta como falha. O `LEARNING_DESK_OPENCODE` do portão aponta o 2.2.4 e
   NÃO é usado aqui: o hunt é do binário estável 1.19.x. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {parseMessage} from '../src/i18n.mjs';

const require = (await import('node:module')).createRequire(import.meta.url);
const {NATIVE_TOOLS, serveEnv, writeServeConfig} = require('../src/agents/opencode-serve-config.cjs');
const {mesaMcpConfig} = require('../opencode-tutor-host.cjs');
const {startOpenCodeServer} = require('../src/agents/opencode-process.cjs');
const {createOpenCodeClient} = require('../src/agents/opencode-http.cjs');
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');

function skip(reason) {
  console.log(`PULADO: ${reason}`);
  process.exit(77);
}

function versionOf(binary) {
  try { return execFileSync(binary, ['--version'], {encoding: 'utf8', timeout: 15000}).trim(); } catch { return ''; }
}

function binaryFromEnv() {
  const configured = String(process.env.LEARNING_DESK_OPENCODE_1195 || '');
  const candidate = configured || path.join(os.homedir(), '.local', 'bin', 'opencode');
  return fs.existsSync(candidate) ? candidate : '';
}

/* Provedor OpenAI-compatible mínimo: na primeira requisição o modelo pede
   `bash`; na segunda (depois do resultado) devolve texto. Guarda as ferramentas
   oferecidas e o resultado da ferramenta, que são a prova do config. */
async function createBashProvider(outside) {
  const state = {requests: 0, tools: [], toolMessages: []};
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (req.url?.includes('/models')) {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({object: 'list', data: [{id: 'm1', object: 'model'}]}));
        return;
      }
      if (!req.url?.includes('/chat/completions')) { res.writeHead(404).end('{}'); return; }
      let parsed = {};
      try { parsed = JSON.parse(body); } catch { /* corpo vazio */ }
      state.requests += 1;
      state.tools = Array.isArray(parsed.tools) ? parsed.tools.map((tool) => String(tool.function?.name || tool.name || '')) : [];
      state.toolMessages = (parsed.messages || []).filter((message) => message.role === 'tool');
      const hasToolResult = state.toolMessages.length > 0;
      const chunks = hasToolResult
        ? [chunk({role: 'assistant', content: 'Pronto.'}), chunk({}, 'stop')]
        : [chunk({role: 'assistant', tool_calls: [{index: 0, id: 'call_bash_1', type: 'function', function: {name: 'bash', arguments: JSON.stringify({command: `echo FORA > ${outside}`})}}]}), chunk({}, 'tool_calls')];
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive'});
      for (const item of chunks) res.write(`data: ${JSON.stringify(item)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    state,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

function chunk(delta, finish = null) {
  return {id: 'chatcmpl-hunt-1195', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'm1', choices: [{index: 0, delta, finish_reason: finish}]};
}

function writeProviderConfig(directory, providerUrl) {
  const file = path.join(directory, 'opencode.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  config.model = 'acme/m1';
  config.provider = {acme: {npm: '@ai-sdk/openai-compatible', options: {baseURL: `${providerUrl}/v1`, apiKey: 'fake'}, models: {m1: {name: 'M1', tool_call: true}}}};
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

/* O 1.19.5 lê o MCP do `opencode.json` (chave `mcp`), não da rota
   `/api/experimental/mcp` da v2. `enabled` é do 2.x; o config do 1.19.5 usa
   `disabled` (ausente = ligado), e o `debug config` normaliza para `enabled`. */
function writeMcpConfig(directory) {
  const file = path.join(directory, 'opencode.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const {enabled, ...mcp} = mesaMcpConfig({
    execPath: process.execPath, ggbBridge: '',
    activityGrant: {url: 'http://127.0.0.1:9/activity', token: 't'},
    materialGrant: {url: 'http://127.0.0.1:9/pdf', token: 'm'},
    tutorLanguage: 'pt-BR',
  });
  assert.equal(enabled, true);
  config.mcp = {mesa: {...mcp, codemode: false}};
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

function resolvedConfig(binary, env) {
  return JSON.parse(execFileSync(binary, ['debug', 'config'], {encoding: 'utf8', timeout: 30000, env}));
}

const binary = binaryFromEnv();
if (!binary) skip('defina LEARNING_DESK_OPENCODE_1195 ou instale o 1.19.x em ~/.local/bin/opencode');
const version = versionOf(binary);
if (!/^1\.19\./.test(version)) skip(`${binary} é "${version}" (o hunt exige o 1.19.x estável)`);

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-hunt-oc1195-'));
const workspace = path.join(runtime, 'ws');
const home = path.join(runtime, 'home');
const tmp = path.join(runtime, 'tmp');
fs.mkdirSync(workspace, {recursive: true});
fs.mkdirSync(home, {recursive: true});
fs.mkdirSync(tmp, {recursive: true});
const outside = path.join(os.tmpdir(), `mesa-hunt-1195-fora-${process.pid}.txt`);
fs.rmSync(outside, {force: true});

const provider = await createBashProvider(outside);
let server = null;
try {
  /* ---------- 1. config resolvido: nativas em false, permission em deny ---------- */
  const configDir = writeServeConfig({runtime});
  writeProviderConfig(configDir, provider.url);
  writeMcpConfig(configDir);
  const env = serveEnv({...process.env, HOME: home, XDG_DATA_HOME: path.join(home, '.local', 'share'), XDG_CONFIG_HOME: path.join(home, '.config'), TMPDIR: tmp}, configDir);
  const config = resolvedConfig(binary, env);
  for (const name of NATIVE_TOOLS) assert.equal(config.tools?.[name], false, `${name} em tools:false`);
  for (const action of ['bash', 'shell', 'edit', 'write', 'read']) assert.equal(config.permission?.[action], 'deny', `${action} em deny`);
  assert.equal(config.permission?.['*'], 'deny', 'a regra * fecha o que tools não cobre');
  assert.equal(config.permission?.['mesa_*'], 'allow', 'o MCP mesa fica liberado');
  assert.equal(config.mcp?.mesa?.type, 'local', 'o MCP mesa vai no config do 1.19.5');
  assert.notEqual(config.mcp?.mesa?.enabled, false, 'o MCP mesa está ligado no config resolvido');
  /* O `debug config` do 1.19.5 normaliza o MCP para `enabled` e não mostra
     `codemode`; o arquivo é a fonte do que o servidor lê, e as ferramentas
     `mesa_*` na resposta do provedor provam o modo direto. */
  assert.equal(JSON.parse(fs.readFileSync(path.join(configDir, 'opencode.json'), 'utf8')).mcp?.mesa?.codemode, false);
  assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, '1');

  /* ---------- 2. a v2 do 1.19.5 recusa o pedido do adaptador (400) ---------- */
  server = await startOpenCodeServer({binary, cwd: runtime, env, timeoutMs: 30000});
  const client = createOpenCodeClient({baseUrl: server.baseUrl, password: server.password});
  const v2 = await client.request('POST', '/api/session', {body: {title: 'v2', location: {directory: workspace}, model: {id: 'm1', providerID: 'acme'}}});
  assert.equal(v2.status, 200);
  const v2id = String(v2.payload?.data?.id || '');
  assert.match(v2id, /^ses_/);
  const refused = await client.request('POST', `/api/session/${encodeURIComponent(v2id)}/prompt`, {body: {id: 'msg_v2', text: 'oi', resume: true}});
  assert.equal(refused.status, 400, 'o corpo do 2.x é recusado pela v2 do 1.19.5');
  assert.equal(refused.payload?._tag, 'InvalidRequestError');
  assert.equal(refused.payload?.kind, 'Payload');
  assert.match(String(refused.payload?.message), /Missing key/);
  assert.match(String(refused.payload?.message), /\["prompt"\]/);

  /* ---------- 3. o adaptador recusa o turno antes de abrir sessão ---------- */
  const refusing = new OpenCodeAdapter({
    conversationId: 'hunt-1195', sessionId: '', directory: workspace,
    acquire: async () => ({baseUrl: server.baseUrl, password: server.password, binary, pid: server.pid}),
    log: () => {},
  });
  await assert.rejects(refusing.connect(), (error) => {
    const parsed = parseMessage(error.message);
    return parsed?.key === 'err.opencode.versionUnsupported' && parsed.args.version === '1.19.5' && error.notSent === true;
  });
  assert.equal(refusing.sessionId, '', 'nenhum ses_ foi cunhado antes da recusa');
  refusing.stop();

  /* ---------- 4. a v1 do 1.19.5: só mesa_*, bash recusado, turno completa ---------- */
  const created = await client.request('POST', '/session', {body: {title: 'v1', directory: workspace}});
  assert.equal(created.status, 200);
  const id = String(created.payload?.id || '');
  assert.match(id, /^ses_/);
  const sent = await client.request('POST', `/session/${encodeURIComponent(id)}/message`, {body: {
    parts: [{type: 'text', text: 'liste a pasta'}],
    model: {providerID: 'acme', modelID: 'm1'},
  }, timeoutMs: 60000});
  assert.equal(sent.status, 200);
  assert.equal(sent.payload?.info?.role, 'assistant', 'a v1 devolve a resposta do assistente');
  assert.equal(sent.payload?.info?.finish, 'stop', 'o turno fecha');
  assert.match(JSON.stringify(sent.payload?.parts || []), /Pronto\./);
  assert.equal(provider.state.requests, 2, 'o provedor viu o pedido de ferramenta e o resultado');
  assert.ok(provider.state.tools.length, 'o provedor vê as ferramentas do MCP');
  assert.ok(provider.state.tools.every((name) => name.startsWith('mesa_')), `só Mesa chega ao modelo: ${provider.state.tools.join(', ')}`);
  for (const native of ['bash', 'shell', 'read', 'edit', 'write', 'glob', 'grep', 'list', 'webfetch', 'websearch', 'task', 'skill', 'execute', 'opencode_tool']) {
    assert.equal(provider.state.tools.includes(native), false, `${native} não chega ao modelo`);
  }
  const toolResult = JSON.stringify(provider.state.toolMessages);
  assert.match(toolResult, /unavailable tool/, 'o bash pedido pelo modelo é recusado');
  assert.match(toolResult, /mesa_ler_pdf/, 'a recusa lista as ferramentas da Mesa');
  assert.equal(fs.existsSync(outside), false, 'o arquivo fora da pasta não foi criado');

  console.log('ok hunt opencode 1.19.5: config resolve nativas em false, adaptador recusa a versão 1.x antes de sessão, v1 /session vê só mesa_*, bash recusado e o turno completa; v2 /prompt recusa o corpo do 2.x com 400 Missing key ["prompt"]');
} finally {
  try { server?.stop(); } catch { /* já parado */ }
  await provider.close();
  fs.rmSync(runtime, {recursive: true, force: true});
  fs.rmSync(outside, {force: true});
}
