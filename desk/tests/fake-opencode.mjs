#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

/* Console falso do OpenCode Zen para os testes (#44): só a lista de modelos
   (`GET /inference/v1/models`), do jeito que o Zen responde — pública sem
   chave e 401 com chave recusada. Registra cada pedido SEM a chave (só se veio
   e se valeu), para o teste provar que a Mesa nunca chamou inferência. */
const DEFAULT_LIVE = ['deepseek-v4.1-flash-free', 'glm-5.3-flash-free', 'big-pickle', 'nemotron-3-ultra-free', 'muse-spark-1.3-contributor-free', 'gpt-5.5'];

/**
 * @param {{validKeys?: string[], billingKeys?: string[], liveIds?: string[]}} [options]
 * @returns {Promise<{url: string, requests: Array<{method: string, path: string, bearer: boolean, valid: boolean}>, close: () => Promise<void>}>}
 * @example const fake = await createFakeOpencode({validKeys: ['sk-teste-1234567890abcdef']});
 */
export async function createFakeOpencode({validKeys = [], billingKeys = [], liveIds = DEFAULT_LIVE} = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const valid = validKeys.includes(bearer);
    requests.push({method: req.method, path: req.url, bearer: bearer !== '', valid});
    if (req.url !== '/inference/v1/models') { res.writeHead(404).end(); return; }
    if (bearer && billingKeys.includes(bearer)) { res.writeHead(402).end('{}'); return; }
    if (bearer && !valid) { res.writeHead(401).end('{}'); return; }
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({object: 'list', data: liveIds.map((id) => ({id, object: 'model'}))}));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  /* `unref`: um teste que esquece o `close()` não segura o processo aberto (o corredor mataria por prazo). */
  server.unref();
  const {port} = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

/* ---------- `opencode serve` falso (#57) ----------

   O contrato medido no `opencode serve` 2.0.32, só no que a Mesa usa: Basic
   auth com `OPENCODE_PASSWORD`; `POST /api/session` idempotente pelo `ses_`;
   prompt 200 com o item `user` da inbox (aceite, o turno segue); SSE em
   `GET /api/event` com quadros `{type, data:{sessionID…}}`; troca de modelo
   204; compactação 200 com o item `compaction` e fim no SSE; comandos 204;
   permissões; MCP registrado em tempo de execução. Nenhum modelo de verdade:
   a resposta é `reply(texto)`. Cada pedido vai para `requests` (e para o
   arquivo `FAKE_OPENCODE_LOG` no modo executável) SEM o cabeçalho de senha. */

const DEFAULT_MODELS = [
  {id: 'deepseek-v4.1-flash-free', providerID: 'opencode', name: 'DeepSeek V4.1 Flash Free', variants: [{id: 'low'}, {id: 'high'}, {id: 'max'}], cost: [{input: 0, output: 0}], limit: {context: 200000}},
  {id: 'big-pickle', providerID: 'opencode', name: 'Big Pickle', variants: [], cost: [{input: 0, output: 0}], limit: {context: 200000}},
  {id: 'gpt-5.5', providerID: 'opencode', name: 'GPT 5.5', variants: [{id: 'high'}], cost: [{input: 1.25, output: 10}], limit: {context: 400000}},
];
/* O 403 do grátis do Zen como o `opencode serve` 2.0.32 o emite no SSE
   (medido em 2026-10-20): `session.step.failed` e `session.execution.failed`
   com o mesmo erro. */
export const FREE_TIER_403 = Object.freeze({type: 'provider.auth', status: 403,
  message: "OpenCode's free tier can only be used from within OpenCode. Download it at https://opencode.ai and keep building.",
  response: {body: '{"type":"error","error":{"type":"FreeTierError","message":"OpenCode\'s free tier can only be used from within OpenCode."}}'}});
const DEFAULT_COMMANDS = [{name: 'init', description: 'guided AGENTS.md setup'}, {name: 'review', description: 'review changes'}];

/**
 * Sobe o servidor falso numa porta efêmera.
 * @param {{password?: string, models?: object[], commands?: object[], reply?: (text: string) => string,
 *   promptStatus?: number, dropAfterAccept?: boolean, ask?: boolean, tool?: {name: string, input: object, output: string}, mcpCall?: {name: string, input: object},
 *   tokens?: object, failTurn?: 'free-tier', log?: (entry: object) => void}} [options]
 * @example const serve = await createFakeOpencodeServe({password: 'p'}); // serve.url, serve.requests, serve.close()
 */
export async function createFakeOpencodeServe(options = {}) {
  const {password = '', models = DEFAULT_MODELS, commands = DEFAULT_COMMANDS, reply = (text) => `Resposta do OpenCode falso: ${text.slice(-40)}`,
    log = () => {}} = options;
  const state = {promptStatus: options.promptStatus || 200, dropAfterAccept: !!options.dropAfterAccept, ask: !!options.ask, tool: options.tool || null, mcpCall: options.mcpCall || null, failTurn: options.failTurn || '', tokens: options.tokens || {input: 900, output: 100, reasoning: 0, cache: {read: 0, write: 0}}};
  const requests = [];
  const sessions = new Map();
  const mcp = new Map();
  const streams = new Set();
  const pendingAsk = new Map();
  const json = (res, status, payload) => { res.writeHead(status, {'content-type': 'application/json'}); res.end(status === 204 ? '' : JSON.stringify(payload)); };
  const authorized = (req) => !password || req.headers.authorization === `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
  const emit = (type, data) => { const block = `data: ${JSON.stringify({id: `evt_${Math.random().toString(36).slice(2)}`, type, data})}\n\n`; for (const res of streams) res.write(block); };

  /* A chamada de ferramenta fica na mensagem do assistente como o servidor v2
     a grava (`SessionMessageAssistantTool` do SDK oficial): `{type:'tool', id,
     name, state:{status, input, content}}`. Sem isso o histórico do fake não
     teria o que o histórico real tem. */
  function finishTurn(session, text, assistantID, toolPart = null) {
    const answer = reply(text);
    emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: answer.slice(0, 8)});
    emit('session.text.ended', {sessionID: session.id, assistantMessageID: assistantID, text: answer});
    const content = [...(toolPart ? [toolPart] : []), {type: 'text', text: answer}];
    session.messages.push({id: assistantID, type: 'assistant', content, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
    emit('session.execution.succeeded', {sessionID: session.id});
  }

  function failFreeTier(session, assistantID) {
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.step.failed', {sessionID: session.id, assistantMessageID: assistantID, error: FREE_TIER_403});
    emit('session.execution.failed', {sessionID: session.id, error: FREE_TIER_403});
  }

  /* Ferramenta do MCP `mesa` (#70), como o 2.0.32 faz: sem `codemode: false`
     no registro, o modelo só a alcança por dentro da `execute` (é o nome que o
     SSE mostra); com ele, o nome é `mesa_<ferramenta>`. A chamada vai de
     verdade ao servidor registrado, depois do `tool.called`. */
  async function mcpTurn(session, text, assistantID) {
    const {name, input} = state.mcpCall;
    const config = mcp.get('mesa');
    const direct = config?.codemode === false;
    const callID = `call_${Math.random().toString(36).slice(2, 8)}`;
    const toolName = direct ? `mesa_${name}` : 'execute';
    const toolInput = direct ? input : {code: `await tools.mesa.${name}(${JSON.stringify(input)})`};
    emit('session.tool.input.started', {sessionID: session.id, id: callID, name: toolName});
    emit('session.tool.called', {sessionID: session.id, id: callID, input: toolInput});
    const output = [{type: 'text', text: config ? await callMcpTool(config, name, input) : 'MCP mesa não registrado.'}];
    emit('session.tool.success', {sessionID: session.id, id: callID, content: output});
    const toolPart = {type: 'tool', id: callID, name: toolName, state: {status: 'completed', input: toolInput, content: output, structured: {}}, time: {created: Date.now(), completed: Date.now()}};
    finishTurn(session, text, assistantID, toolPart);
  }

  function runTurn(session, text) {
    const assistantID = `msg_a${Math.random().toString(36).slice(2, 10)}`;
    if (state.mcpCall) { setTimeout(() => mcpTurn(session, text, assistantID), 10); return; }
    if (state.dropAfterAccept) { setTimeout(() => { for (const res of streams) res.destroy(); }, 15); return; }
    if (state.failTurn === 'free-tier') { setTimeout(() => failFreeTier(session, assistantID), 10); return; }
    let toolPart = null;
    if (state.tool) {
      const callID = `call_${Math.random().toString(36).slice(2, 8)}`;
      const output = [{type: 'text', text: state.tool.output}];
      emit('session.tool.input.started', {sessionID: session.id, id: callID, name: state.tool.name});
      emit('session.tool.called', {sessionID: session.id, id: callID, input: state.tool.input});
      emit('session.tool.success', {sessionID: session.id, id: callID, content: output});
      toolPart = {type: 'tool', id: callID, name: state.tool.name, state: {status: 'completed', input: state.tool.input, content: output, structured: {}}, time: {created: Date.now(), completed: Date.now()}};
    }
    if (state.ask) {
      const id = `per_${Math.random().toString(36).slice(2, 8)}`;
      pendingAsk.set(id, () => finishTurn(session, text, assistantID, toolPart));
      emit('permission.asked', {sessionID: session.id, id, action: 'read', resources: ['/tmp/x.pdf']});
      return;
    }
    setTimeout(() => finishTurn(session, text, assistantID, toolPart), 10);
  }

  function sessionRoute(req, res, body, session, tail) {
    if (req.method === 'GET' && tail === '') return json(res, 200, {data: {id: session.id, model: session.model}});
    if (req.method === 'DELETE' && tail === '') { sessions.delete(session.id); return json(res, 204); }
    if (req.method === 'PATCH' && tail === '') return json(res, 204);
    if (req.method === 'POST' && tail === '/model') { session.model = body?.model; return json(res, 204); }
    if (req.method === 'GET' && tail.startsWith('/message')) {
      const list = tail.includes('order=desc') ? [...session.messages].reverse() : session.messages;
      return json(res, 200, {data: list, cursor: {previous: null, next: null}});
    }
    if (req.method === 'POST' && tail === '/interrupt') { emit('session.execution.interrupted', {sessionID: session.id}); return json(res, 204); }
    if (req.method === 'POST' && tail === '/prompt') {
      if (state.promptStatus !== 200) return json(res, state.promptStatus, {_tag: 'Refused'});
      const id = String(body?.id || `msg_${Date.now()}`);
      session.messages.push({id, type: 'user', text: String(body?.text || '')});
      json(res, 200, {data: {type: 'user', id, sessionID: session.id, delivery: body?.delivery || 'queue'}});
      runTurn(session, String(body?.text || ''));
      return;
    }
    if (req.method === 'POST' && tail === '/command') {
      if (!commands.some((item) => item.name === body?.name)) return json(res, 404, {_tag: 'CommandNotFound'});
      json(res, 204);
      runTurn(session, `/${body.name} ${body.text || ''}`);
      return;
    }
    if (req.method === 'POST' && tail === '/compact') {
      json(res, 200, {data: {type: 'compaction', id: String(body?.id || 'msg_c'), sessionID: session.id}});
      setTimeout(() => {
        emit('session.compaction.started', {sessionID: session.id, inputID: body?.id, reason: 'manual'});
        emit('session.compaction.ended', {sessionID: session.id, reason: 'manual', text: 'Resumo falso da conversa.'});
        session.messages.push({id: `msg_k${Date.now()}`, type: 'compaction', status: 'completed'});
      }, 10);
      return;
    }
    const permission = /^\/permission\/([^/]+)\/reply$/.exec(tail);
    if (req.method === 'POST' && permission) {
      const resume = pendingAsk.get(decodeURIComponent(permission[1]));
      if (!resume) return json(res, 404, {_tag: 'NotFound'});
      pendingAsk.delete(decodeURIComponent(permission[1]));
      json(res, 204);
      if (body?.decision === 'reject') emit('session.execution.failed', {sessionID: session.id, error: {message: 'rejected'}});
      else resume();
      return;
    }
    json(res, 404, {_tag: 'RouteNotFound'});
  }

  function route(req, res, body) {
    const url = String(req.url || '');
    if (req.method === 'GET' && url === '/api/event') {
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache'});
      res.write(`data: ${JSON.stringify({type: 'server.connected', data: {}})}\n\n`);
      streams.add(res);
      res.on('close', () => streams.delete(res));
      return;
    }
    /* As rotas por pasta aceitam `?location[directory]=…` (deepObject). */
    const bare = url.split('?')[0];
    if (req.method === 'GET' && bare === '/api/model') return json(res, 200, {location: {directory: process.cwd()}, data: models});
    if (req.method === 'GET' && bare === '/api/command') return json(res, 200, {location: {directory: process.cwd()}, data: commands});
    if (req.method === 'GET' && url.startsWith('/api/mcp')) return json(res, 200, {data: [...mcp.keys()].map((name) => ({name, status: 'connected'}))});
    const mcpPut = /^\/api\/experimental\/mcp\/([^/?]+)/.exec(url);
    if (req.method === 'PUT' && mcpPut) { mcp.set(decodeURIComponent(mcpPut[1]), body?.config); return json(res, 200, {data: {}}); }
    if (req.method === 'POST' && url === '/api/session') {
      const id = String(body?.id || `ses_${Math.random().toString(36).slice(2)}`);
      if (!sessions.has(id)) sessions.set(id, {id, model: body?.model || null, location: body?.location || null, permissions: body?.permissions || null, messages: []});
      return json(res, 200, {data: {id, model: sessions.get(id).model}});
    }
    const session = /^\/api\/session\/([^/?]+)(.*)$/.exec(url);
    if (session) {
      const found = sessions.get(decodeURIComponent(session[1]));
      if (!found) return json(res, 404, {_tag: 'SessionNotFound'});
      return sessionRoute(req, res, body, found, session[2] || '');
    }
    json(res, 404, {_tag: 'RouteNotFound'});
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body = null;
      if (raw) { try { body = JSON.parse(raw); } catch { body = raw; } }
      const entry = {method: req.method, url: req.url, body, authorized: authorized(req)};
      requests.push(entry);
      log(entry);
      if (!entry.authorized) return json(res, 401, {_tag: 'UnauthorizedError'});
      route(req, res, body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  const {port} = /** @type {import('node:net').AddressInfo} */ (server.address());
  return {
    url: `http://127.0.0.1:${port}`, requests, sessions, mcp, state, emit,
    close: () => new Promise((resolve) => { for (const res of streams) res.destroy(); server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

/**
 * Chama uma ferramenta do MCP registrado como o OpenCode faz: sobe o comando
 * com o ambiente dele, `initialize` e `tools/call` por linhas JSON-RPC.
 * @param {{command: string[], environment?: Record<string, string>}} config
 * @param {string} name @param {object} input
 * @returns {Promise<string>} o texto da resposta (ou do erro)
 */
function callMcpTool(config, name, input) {
  return new Promise((resolve) => {
    const child = spawn(config.command[0], config.command.slice(1), {env: {...process.env, ...config.environment}, stdio: ['pipe', 'pipe', 'ignore']});
    let buffer = '';
    const done = (textOut) => { child.kill(); resolve(textOut); };
    const timer = setTimeout(() => done('MCP sem resposta em 20 s.'), 20000);
    child.on('error', (error) => { clearTimeout(timer); resolve(`MCP não subiu: ${error.message}`); });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        let rpc; try { rpc = JSON.parse(line); } catch { continue; }
        if (rpc.id !== 2) continue;
        clearTimeout(timer);
        done(rpc.error ? `erro ${rpc.error.message}` : (rpc.result?.content || []).map((part) => part.text || '').join('\n'));
      }
    });
    const send = (rpc) => child.stdin.write(JSON.stringify({jsonrpc: '2.0', ...rpc}) + '\n');
    send({id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'fake-opencode', version: '1'}}});
    send({id: 2, method: 'tools/call', params: {name, arguments: input}});
  });
}

/* Modo executável: `fake-opencode.mjs serve --hostname 127.0.0.1 --port 0`,
   como a Mesa lança o binário. FAKE_OPENCODE_LOG grava os pedidos (JSONL) e o
   ambiente que importa — se a chave chegou, NUNCA o valor dela. */
async function runAsBinary(argv) {
  if (argv[0] !== 'serve') { process.stderr.write(`fake-opencode: subcomando ${JSON.stringify(argv[0])} não existe; esperado "serve"\n`); process.exit(2); }
  const logFile = process.env.FAKE_OPENCODE_LOG || '';
  const write = (entry) => { if (logFile) fs.appendFileSync(logFile, JSON.stringify(entry) + '\n'); };
  write({start: true, argv, cwd: process.cwd(), keyPresent: !!process.env.OPENCODE_API_KEY, serverPasswordInherited: 'OPENCODE_SERVER_PASSWORD' in process.env});
  const serve = await createFakeOpencodeServe({password: process.env.OPENCODE_PASSWORD || '', log: write,
    ask: process.env.FAKE_OPENCODE_ASK === '1', mcpCall: process.env.FAKE_OPENCODE_MCP_CALL ? JSON.parse(process.env.FAKE_OPENCODE_MCP_CALL) : null, failTurn: process.env.FAKE_OPENCODE_FAIL === 'free-tier' ? 'free-tier' : undefined, promptStatus: Number(process.env.FAKE_OPENCODE_PROMPT_STATUS || 200)});
  process.stdout.write(`server listening on ${serve.url}\n`);
  setInterval(() => {}, 1 << 30);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runAsBinary(process.argv.slice(2));
