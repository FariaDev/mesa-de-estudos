#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {bigCatalog} from './fake-pi-catalog.mjs';

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

const DEFAULT_INTEGRATIONS = [
  {id: 'openai', name: 'OpenAI', methods: [
    {type: 'key'},
    {type: 'env', names: ['OPENAI_API_KEY']},
    {id: 'chatgpt-token-sharing', type: 'oauth', label: 'Sign in with ChatGPT'},
    {id: 'chatgpt-browser', type: 'oauth', label: 'Codex browser (legacy)'},
  ]},
  {id: 'xai', name: 'xAI', methods: [
    {type: 'key', label: 'Manually enter API Key'},
    {type: 'env', names: ['XAI_API_KEY']},
    {id: 'device', type: 'oauth', label: 'SuperGrok Subscription'},
  ]},
  {id: 'opencode-go', name: 'OpenCode Go', methods: [{type: 'key'}, {type: 'env', names: ['OPENCODE_API_KEY']}]},
  {id: 'anthropic', name: 'Anthropic', methods: [{type: 'key'}, {type: 'env', names: ['ANTHROPIC_API_KEY']}]},
];
const DEFAULT_MODELS = [
  {id: 'deepseek-v4.1-flash-free', providerID: 'opencode', name: 'DeepSeek V4.1 Flash Free', capabilities: {input: ['text', 'image']}, variants: [{id: 'low'}, {id: 'high'}, {id: 'max'}], cost: [{input: 0, output: 0}], limit: {context: 200000}},
  {id: 'big-pickle', providerID: 'opencode', name: 'Big Pickle', capabilities: {input: ['text', 'image']}, variants: [], cost: [{input: 0, output: 0}], limit: {context: 200000}},
  {id: 'gpt-5.5', providerID: 'opencode', name: 'GPT 5.5', capabilities: {input: ['text', 'image']}, variants: [{id: 'high'}], cost: [{input: 1.25, output: 10}], limit: {context: 400000}},
];
/* Catálogo grande no formato do Zen, como o `opencode models` da pessoa: usado
   pelo seletor (#59) para agrupar, filtrar e guardar recentes. */
const MANY_MODELS = [['xai', 'grok-4', 'Grok 4'], ['xai', 'grok-4-fast', 'Grok 4 Fast'], ['anthropic', 'sonnet-5', 'Sonnet 5'], ['openai', 'gpt-5.5-pro', 'GPT 5.5 Pro'], ['meu-provedor', 'caseiro', 'Modelo caseiro']];
/** Modelos do modo executável: o padrão do fake e as variações pedidas por
 *  variável de ambiente, todas no formato de `GET /api/model`. */
function modelsFromEnv(env = process.env) {
  const models = DEFAULT_MODELS.map((model) => ({...model, variants: model.variants.map((variant) => ({...variant}))}));
  if (env.FAKE_OPENCODE_SECOND_MODEL === '1') {
    models.push({id: 'big-pickle-vision', providerID: 'opencode', name: 'Big Pickle com visão', capabilities: {input: ['text', 'image']}, variants: [{id: 'low'}, {id: 'high'}], cost: [{input: 0, output: 0}], limit: {context: 200000}});
  }
  /* Modelo só-texto para o aviso de anexo sem visão (`attach.noVision`): sem
     `image` nas capacidades, a Mesa avisa em vez de fingir que o modelo vê. */
  if (env.FAKE_OPENCODE_TEXT_ONLY === '1') {
    models.push({id: 'text-only', providerID: 'opencode', name: 'Text Only', capabilities: {input: ['text']}, variants: [], cost: [{input: 0, output: 0}], limit: {context: 200000}});
  }
  const many = Number(env.FAKE_OPENCODE_MANY_MODELS || 0);
  if (many >= 1) models.push(...MANY_MODELS.map(([providerID, id, name]) => ({id, providerID, name, capabilities: {input: ['text', 'image']}, variants: [{id: 'low'}, {id: 'high'}], cost: [{input: 1, output: 2}], limit: {context: 200000}})));
  if (many > 1) {
    /* Mesmo catálogo sintético do antigo fake-pi (OpenRouter com "Fabricante:
       Modelo", :free, mais openai-codex/opencode-go/commandcode/xai): os testes
       do seletor comparam trilho, subgrupos e busca nesse formato real. */
    const reasoning = env.FAKE_PI_REASONING === '1' || env.FAKE_OPENCODE_REASONING === '1';
    models.push(...bigCatalog(Math.max(0, many - models.length), {reasoning}).map((model) => ({
      id: model.id,
      providerID: model.provider,
      name: model.name,
      capabilities: {input: model.input},
      variants: reasoning ? [{id: 'low'}, {id: 'high'}] : [],
      cost: [{input: model.cost.input, output: model.cost.output}],
      limit: {context: model.contextWindow || 200000},
    })));
  }
  return models;
}
/* O 403 do grátis do Zen como o `opencode serve` 2.0.32 o emite no SSE
   (medido em 2026-10-20): `session.step.failed` e `session.execution.failed`
   com o mesmo erro. */
export const FREE_TIER_403 = Object.freeze({type: 'provider.auth', status: 403,
  message: "OpenCode's free tier can only be used from within OpenCode. Download it at https://opencode.ai and keep building.",
  response: {body: '{"type":"error","error":{"type":"FreeTierError","message":"OpenCode\'s free tier can only be used from within OpenCode."}}'}});
/* O limite do grátis como o `opencode serve` 2.2.4 o emite no SSE (medido em
   2026-11-05, modelo grátis sem credencial e travas da Mesa): `session.step.failed`
   e `session.execution.failed` com o mesmo erro `provider.free-limit` (429,
   `FreeUsageLimitError`). O texto curto do provedor vai para a frase da Mesa;
   o resto (corpo, `retryAfterMs`) fica fora da tela. */
export const FREE_LIMIT_429 = Object.freeze({type: 'provider.free-limit',
  message: 'Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.',
  status: 429,
  response: {body: '{"type":"error","error":{"type":"FreeUsageLimitError","message":"Free usage limit reached. Free models work in OpenCode (https://opencode.ai); subscribe to OpenCode Go to keep going: https://opencode.ai/go"}}'},
  retryAfterMs: 66813000});
/* Falha de transporte do provedor como o `opencode serve` 2.2.4 a emite no SSE
   (medido em 2026-11-05 com provedor OpenAI-compatible local em porta fechada
   e com certificado autoassinado): `session.step.failed` e
   `session.execution.failed` com o MESMO erro plano `{type, message}`, sem
   `data` e sem `cause`; o código do erro abre a mensagem. */
export const PROVIDER_TRANSPORT_ECONNREFUSED = Object.freeze({type: 'provider.transport',
  message: 'ECONNREFUSED: Unable to connect. Is the computer able to access the url?'});
export const PROVIDER_TRANSPORT_SELF_SIGNED = Object.freeze({type: 'provider.transport',
  message: 'DEPTH_ZERO_SELF_SIGNED_CERT: self signed certificate'});
const DEFAULT_COMMANDS = [{name: 'init', description: 'guided AGENTS.md setup'}, {name: 'review', description: 'review changes'}];

/* Stream longo da sonda de desempenho (`tests/perf-probe.mjs --only=stream`):
   12 parágrafos, 24 fórmulas, lista, cerca de código e títulos, do mesmo jeito
   que o `fake-pi.mjs` emitia antes de o motor Pi sair. */
export function longStreamText() {
  const paragraphs = Array.from({length: 12}, (_, i) => [
    `## Passo ${i + 1}`,
    `A ideia central é aplicar $f(x)=x^{${i + 1}}+${i}$ e conferir o sinal.`,
    '- derive termo a termo\n- simplifique antes de substituir\n- confira a unidade no fim',
    `$$\\int_0^1 x^{${i + 1}}\\,dx=\\frac{1}{${i + 2}}$$`,
    `Um trecho de código para fixar:\n\n\`\`\`js\nconst derivada = (x) => ${i + 1} * x ** ${i};\n\`\`\``,
  ].join('\n\n'));
  return paragraphs.join('\n\n') + '\n\nFim da resposta longa do tutor.';
}

/**
 * Sobe o servidor falso numa porta efêmera.
 * @param {{password?: string, models?: object[], integrations?: object[], connections?: Record<string, object[]>, oauthOutcome?: 'complete'|'pending'|'failed'|'expired'|'short', oauthPolls?: number, oauthMode?: 'auto'|'code', keyOutcome?: 'accept'|'reject', loginModels?: object[], commands?: object[], reply?: (text: string) => string,
 *   promptStatus?: number, dropAfterAccept?: boolean, ask?: boolean, permission?: {action: string, resources?: string[], metadata?: object},
 *   permissionEvent?: 'asked'|'v2', permissionReply?: 'decision'|'reply',
 *   tool?: {name: string, input: object, output: string}, mcpCall?: {name: string, input: object},
  *   tokens?: object, failTurn?: 'free-tier'|'free-limit'|'desk-error', turnDelayMs?: number, stream?: {deltas?: number, delayMs?: number}, log?: (entry: object) => void,
 *   queueLog?: (entry: object) => void, refusalLog?: (entry: object) => void,
 *   promptLog?: (value: string) => void, chaos?: string[], reviewDraft?: string, reviewDelayMs?: number,
 *   mcpBefore?: string, mcpAfter?: string}} [options]
 * @example const serve = await createFakeOpencodeServe({password: 'p'}); // serve.url, serve.requests, serve.close()
 */
export async function createFakeOpencodeServe(options = {}) {
  const {password = '', models = DEFAULT_MODELS, commands = DEFAULT_COMMANDS, reply = (text) => `Resposta do OpenCode falso: ${text.slice(-40)}`,
    log = () => {}, queueLog = () => {}, refusalLog = () => {}, promptLog = () => {}, reviewDraft = '', reviewDelayMs = 0, mcpBefore = '', mcpAfter = ''} = options;
  const state = {promptStatus: options.promptStatus || 200, instructionsStatus: options.instructionsStatus || 0, instructionMaxBytes: options.instructionMaxBytes || 0, dropAfterAccept: !!options.dropAfterAccept, ask: !!options.ask, permission: options.permission || null, permissionEvent: options.permissionEvent || 'asked', permissionReply: options.permissionReply || 'decision', tool: options.tool || null, steps: options.steps || null, mcpCall: options.mcpCall || null, mcpStatus: options.mcpStatus || 'connected', mcpPendingFile: options.mcpPendingFile || '', failTurn: options.failTurn || '', pageSize: options.pageSize || 0, turnDelay: options.turnDelayMs ?? 10, stream: options.stream || null, mcpCalls: Array.isArray(options.mcpCalls) ? [...options.mcpCalls] : null, tokens: options.tokens || {input: 900, output: 100, reasoning: 0, cache: {read: 0, write: 0}}, chaos: new Set(Array.isArray(options.chaos) ? options.chaos : []), refusePrefix: options.refusePrefix || '', reviewDraft: String(reviewDraft || ''), reviewDelay: reviewDelayMs, mcpBefore: String(mcpBefore || ''), mcpAfter: String(mcpAfter || '')};
  const requests = [];
  const sessions = new Map();
  const mcp = new Map();
  const integrations = (options.integrations || DEFAULT_INTEGRATIONS).map((item) => ({...item, methods: Array.isArray(item.methods) ? item.methods : []}));
  const connections = {};
  for (const [id, list] of Object.entries(options.connections || {})) connections[id] = Array.isArray(list) ? [...list] : [];
  const attempts = new Map();
  const auth = {oauthOutcome: options.oauthOutcome || 'complete', oauthPolls: options.oauthPolls ?? 1, oauthMode: options.oauthMode || 'auto', keyOutcome: options.keyOutcome || 'accept', loginModels: Array.isArray(options.loginModels) ? options.loginModels : []};
  const authModels = new Map();
  const streams = new Set();
  const pendingAsk = new Map();
  const json = (res, status, payload) => { res.writeHead(status, {'content-type': 'application/json'}); res.end(status === 204 ? '' : JSON.stringify(payload)); };
  const authorized = (req) => !password || req.headers.authorization === `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
  const emit = (type, data) => { const block = `data: ${JSON.stringify({id: `evt_${Math.random().toString(36).slice(2)}`, type, data})}\n\n`; for (const res of streams) res.write(block); };
  const mcpKey = (directory, name) => `${directory}\0${name}`;

  /* Turnos em voo: o log da fila precisa saber se o prompt chegou com o motor
     ocupado, e o steer derruba o turno anterior (como o servidor real). */
  function clearTurn(session) {
    for (const timer of session.timers || []) clearTimeout(timer);
    session.timers = [];
  }
  function later(session, ms, fn) {
    const timer = setTimeout(() => {
      session.timers = (session.timers || []).filter((item) => item !== timer);
      fn();
    }, ms);
    session.timers = [...(session.timers || []), timer];
    return timer;
  }
  function beginTurn(session) {
    session.busy = true;
    session.turn = `${Date.now()}`;
  }
  function endTurn(session) {
    clearTurn(session);
    session.busy = false;
    session.turn = '';
  }

  /* A chamada de ferramenta fica na mensagem do assistente como o servidor v2
     a grava (`SessionMessageAssistantTool` do SDK oficial): `{type:'tool', id,
     name, state:{status, input, content}}`. Sem isso o histórico do fake não
     teria o que o histórico real tem. */
  function finishTurn(session, text, assistantID, toolPart = null) {
    const answer = reply(text);
    emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: answer.slice(0, 8)});
    emit('session.text.ended', {sessionID: session.id, assistantMessageID: assistantID, text: answer});
    const content = [...(toolPart ? [toolPart] : []), {type: 'text', text: answer}];
    session.messages.push({id: assistantID, type: 'assistant', content, time: {created: Date.now()}, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
    endTurn(session);
    emit('session.execution.succeeded', {sessionID: session.id});
  }

  /** Fala simples do assistente: um passo com texto e o fim do turno. */
  function answer(session, text, assistantID) {
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.text.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: text.slice(0, 8)});
    emit('session.text.ended', {sessionID: session.id, assistantMessageID: assistantID, text});
    session.messages.push({id: assistantID, type: 'assistant', content: [{type: 'text', text}], time: {created: Date.now()}, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
    emit('session.step.ended', {sessionID: session.id, assistantMessageID: assistantID});
    endTurn(session);
    emit('session.execution.succeeded', {sessionID: session.id});
  }

  /* Turno longo do item 15 (chat-follow): pensamento recolhido + ferramenta +
     texto que passa da vista, com uma imagem opcional que carrega depois. */
  function longTurn(session, text, assistantID) {
    const image = process.env.FAKE_OPENCODE_LONG_IMAGE ? `\n\n![Figura de teste](${process.env.FAKE_OPENCODE_LONG_IMAGE})` : '';
    const body = Array.from({length: 60}, (_, i) => `Parágrafo ${i + 1}: a resposta longa continua para provar que a conversa acompanha o fim do turno.`).join('\n\n') + image;
    const thought = 'Vou montar uma resposta longa com uma ferramenta no meio.';
    const callID = 'long-tool';
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.reasoning.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: thought});
    emit('session.reasoning.ended', {sessionID: session.id, assistantMessageID: assistantID, text: thought});
    emit('session.tool.input.started', {sessionID: session.id, assistantMessageID: assistantID, id: callID, name: 'web_search'});
    emit('session.tool.called', {sessionID: session.id, assistantMessageID: assistantID, id: callID, input: {query: 'resposta longa'}});
    emit('session.tool.success', {sessionID: session.id, assistantMessageID: assistantID, id: callID, content: [{type: 'text', text: 'resultado de teste'}]});
    emit('session.step.ended', {sessionID: session.id, assistantMessageID: assistantID});
    const finish = () => {
      const toolPart = {type: 'tool', id: callID, name: 'web_search', state: {status: 'completed', input: {query: 'resposta longa'}, content: [{type: 'text', text: 'resultado de teste'}], structured: {}}, time: {created: Date.now(), completed: Date.now()}};
      const finalID = `${assistantID}b`;
      emit('session.step.started', {sessionID: session.id, assistantMessageID: finalID});
      emit('session.text.delta', {sessionID: session.id, assistantMessageID: finalID, delta: body.slice(0, 8)});
      emit('session.text.ended', {sessionID: session.id, assistantMessageID: finalID, text: body});
      session.messages.push({id: finalID, type: 'assistant', content: [toolPart, {type: 'text', text: body}], time: {created: Date.now()}, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
      emit('session.step.ended', {sessionID: session.id, assistantMessageID: finalID});
      endTurn(session);
      emit('session.execution.succeeded', {sessionID: session.id});
    };
    const hold = Number(process.env.FAKE_OPENCODE_LONG_HOLD_MS || 0);
    if (hold) later(session, hold, finish); else finish();
  }

  /* Diário com pensamento e busca, como o Pi de teste do hunt-chat. */
  function worklogTurn(session, assistantID) {
    const thought = 'Vou considerar a pergunta com calma.';
    const callID = 'search-pensar';
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.reasoning.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: thought});
    emit('session.reasoning.ended', {sessionID: session.id, assistantMessageID: assistantID, text: thought});
    emit('session.tool.input.started', {sessionID: session.id, assistantMessageID: assistantID, id: callID, name: 'web_search'});
    emit('session.tool.called', {sessionID: session.id, assistantMessageID: assistantID, id: callID, input: {query: 'kojima xbox'}});
    const output = [{type: 'text', text: '1. [OD](https://example.com/od)'}];
    emit('session.tool.success', {sessionID: session.id, assistantMessageID: assistantID, id: callID, content: output});
    emit('session.step.ended', {sessionID: session.id, assistantMessageID: assistantID});
    const text = 'É o OD.';
    const finalID = `${assistantID}b`;
    emit('session.step.started', {sessionID: session.id, assistantMessageID: finalID});
    emit('session.text.delta', {sessionID: session.id, assistantMessageID: finalID, delta: text});
    emit('session.text.ended', {sessionID: session.id, assistantMessageID: finalID, text});
    emit('session.step.ended', {sessionID: session.id, assistantMessageID: finalID});
    session.messages.push({id: finalID, type: 'assistant', content: [{type: 'thinking', thinking: thought}, {type: 'tool', id: callID, name: 'web_search', state: {status: 'completed', input: {query: 'kojima xbox'}, content: output, structured: {}}, time: {created: Date.now(), completed: Date.now()}}, {type: 'text', text}], time: {created: Date.now()}, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
    endTurn(session);
    emit('session.execution.succeeded', {sessionID: session.id});
  }

  function failFreeTier(session, assistantID) {
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.step.failed', {sessionID: session.id, assistantMessageID: assistantID, error: FREE_TIER_403});
    emit('session.execution.failed', {sessionID: session.id, error: FREE_TIER_403});
  }

  /* Sem rede (auditoria rodada 4, sem-conexão): o fetch do provedor morre no
     DNS, como o Node real (`fetch failed` com causa `EAI_AGAIN`). */
  function failNetwork(session, assistantID) {
    const error = {message: 'fetch failed', cause: {code: 'EAI_AGAIN', message: 'getaddrinfo EAI_AGAIN api.openai.com'}};
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.step.failed', {sessionID: session.id, assistantMessageID: assistantID, error});
    emit('session.execution.failed', {sessionID: session.id, error});
  }

  /* O limite do grátis só vale para modelo grátis (medido no 2.2.4 real: o
     pago responde): com outro modelo na sessão, o turno responde normal. Sem
     modelo na sessão (padrão do servidor), vale como grátis. */
  function isFreeSessionModel(session) {
    const ref = session.model || null;
    if (!ref || typeof ref !== 'object') return true;
    const found = models.find((model) => String(model.providerID) === String(ref.providerID || '') && String(model.id) === String(ref.id || ''));
    if (!found) return /free/i.test(String(ref.id || ''));
    const cost = Array.isArray(found.cost) ? found.cost[0] : found.cost;
    return Number(cost?.input) === 0 && Number(cost?.output) === 0;
  }

  function failFreeLimit(session, text, assistantID) {
    if (!isFreeSessionModel(session)) { finishTurn(session, text, assistantID); return; }
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.step.failed', {sessionID: session.id, assistantMessageID: assistantID, error: FREE_LIMIT_429});
    emit('session.execution.failed', {sessionID: session.id, error: FREE_LIMIT_429});
  }

  /* Resposta em VÁRIOS passos (#112), como o 2.2.4 real: cada passo do modelo
     tem o seu `assistantMessageID`, com texto → ferramenta → texto. O teste de
     janela usa este roteiro para provar que a fala do passo anterior não
     reaparece no fim do turno. */
  function runSteps(session, steps, index = 0) {
    if (index >= steps.length) { endTurn(session); emit('session.execution.succeeded', {sessionID: session.id}); return; }
    const step = steps[index];
    const assistantID = `msg_s${index}${Math.random().toString(36).slice(2, 10)}`;
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    if (step.text) {
      emit('session.text.started', {sessionID: session.id, assistantMessageID: assistantID});
      emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: step.text.slice(0, 8)});
      emit('session.text.ended', {sessionID: session.id, assistantMessageID: assistantID, text: step.text});
    }
    let toolPart = null;
    if (step.tool) {
      const callID = String(step.tool.id || `call_${Math.random().toString(36).slice(2, 8)}`);
      const output = [{type: 'text', text: step.tool.output || 'ok'}];
      emit('session.tool.input.started', {sessionID: session.id, assistantMessageID: assistantID, id: callID, name: step.tool.name});
      emit('session.tool.called', {sessionID: session.id, assistantMessageID: assistantID, id: callID, input: step.tool.input || {}});
      emit('session.tool.success', {sessionID: session.id, assistantMessageID: assistantID, id: callID, content: output});
      toolPart = {type: 'tool', id: callID, name: step.tool.name, state: {status: 'completed', input: step.tool.input || {}, content: output, structured: {}}, time: {created: Date.now(), completed: Date.now()}};
    }
    session.messages.push({id: assistantID, type: 'assistant', content: [...(step.text ? [{type: 'text', text: step.text}] : []), ...(toolPart ? [toolPart] : [])], time: {created: Date.now()}, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
    emit('session.step.ended', {sessionID: session.id, assistantMessageID: assistantID});
    later(session, state.turnDelay, () => runSteps(session, steps, index + 1));
  }

  /* Ferramenta do MCP `mesa` (#70), como o 2.0.32 faz: sem `codemode: false`
     no registro, o modelo só a alcança por dentro da `execute` (é o nome que o
     SSE mostra); com ele, o nome é `mesa_<ferramenta>`. A chamada vai de
     verdade ao servidor registrado, depois do `tool.called`. */
  async function mcpTurn(session, text, assistantID, call = state.mcpCall) {
    const {name, input} = call;
    /* Texto antes e depois da ferramenta (#42): o quadro precisa achar o lugar
       dele no meio da fala do tutor, não só no fim da mensagem. */
    const beforeID = state.mcpBefore ? `${assistantID}b` : '';
    const afterID = state.mcpBefore ? `${assistantID}a` : assistantID;
    if (state.mcpBefore) {
      emit('session.step.started', {sessionID: session.id, assistantMessageID: beforeID});
      emit('session.text.started', {sessionID: session.id, assistantMessageID: beforeID});
      emit('session.text.ended', {sessionID: session.id, assistantMessageID: beforeID, text: state.mcpBefore});
      emit('session.step.ended', {sessionID: session.id, assistantMessageID: beforeID});
    }
    /* O MCP é POR PASTA no servidor real: o mesmo nome `mesa` convive entre a
       sessão principal e o chat lateral. Chave sem a pasta fazia o cartão do
       lateral cair na conversa principal (#74). */
    const config = mcp.get(mcpKey(session.location?.directory || '', 'mesa'));
    const direct = config?.codemode === false;
    const callID = String(call.id || `call_${Math.random().toString(36).slice(2, 8)}`);
    const toolName = direct ? `mesa_${name}` : 'execute';
    const toolInput = direct ? input : {code: `await tools.mesa.${name}(${JSON.stringify(input)})`};
    emit('session.tool.input.started', {sessionID: session.id, id: callID, name: toolName});
    emit('session.tool.called', {sessionID: session.id, id: callID, input: toolInput});
    const result = config ? await callMcpTool(config, name, input) : 'MCP mesa não registrado.';
    if (process.env.FAKE_OPENCODE_MCP_LOG) { try { fs.appendFileSync(process.env.FAKE_OPENCODE_MCP_LOG, `${JSON.stringify({name, result})}\n`); } catch { /* log opcional */ } }
    const output = [{type: 'text', text: result}];
    emit('session.tool.success', {sessionID: session.id, id: callID, content: output});
    const toolPart = {type: 'tool', id: callID, name: toolName, state: {status: 'completed', input: toolInput, content: output, structured: {}}, time: {created: Date.now(), completed: Date.now()}};
    const answer = state.mcpAfter || reply(text);
    emit('session.step.started', {sessionID: session.id, assistantMessageID: afterID});
    emit('session.text.started', {sessionID: session.id, assistantMessageID: afterID});
    emit('session.text.delta', {sessionID: session.id, assistantMessageID: afterID, delta: answer.slice(0, 8)});
    emit('session.text.ended', {sessionID: session.id, assistantMessageID: afterID, text: answer});
    emit('session.step.ended', {sessionID: session.id, assistantMessageID: afterID});
    const content = [...(state.mcpBefore ? [{type: 'text', text: state.mcpBefore}] : []), toolPart, {type: 'text', text: answer}];
    session.messages.push({id: assistantID, type: 'assistant', content, time: {created: Date.now()}, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
    endTurn(session);
    emit('session.execution.succeeded', {sessionID: session.id});
  }

  /* Resposta longa token a token, como o `opencode serve` real emite
     `session.text.delta`: a sonda mede a repintura da conversa durante o
     stream. O `session.text.ended` fecha com o texto inteiro (o leitor só
     entrega o sufixo que faltar). */
  function streamTurn(session, assistantID) {
    const full = longStreamText();
    const chunks = Math.max(1, Number(state.stream?.deltas) || 240);
    const step = Math.max(1, Math.ceil(full.length / chunks));
    const delay = Math.max(0, Number(state.stream?.delayMs) || 25);
    emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
    emit('session.text.started', {sessionID: session.id, assistantMessageID: assistantID});
    let at = 0;
    const timer = setInterval(() => {
      if (at >= full.length) {
        clearInterval(timer);
        emit('session.text.ended', {sessionID: session.id, assistantMessageID: assistantID, text: full});
        session.messages.push({id: assistantID, type: 'assistant', content: [{type: 'text', text: full}], time: {created: Date.now()}, tokens: state.tokens, model: session.model || {id: models[0]?.id, providerID: 'opencode'}});
        emit('session.step.ended', {sessionID: session.id, assistantMessageID: assistantID});
        endTurn(session);
        emit('session.execution.succeeded', {sessionID: session.id});
        return;
      }
      emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: full.slice(at, at + step)});
      at += step;
    }, delay);
  }

  function runTurn(session, text) {
    const assistantID = `msg_a${Math.random().toString(36).slice(2, 10)}`;
    if (state.stream && /stream longo/i.test(text)) { later(session, state.turnDelay, () => streamTurn(session, assistantID)); return; }
    const chaos = (name) => {
      if (!state.chaos.has(name)) return false;
      state.chaos.delete(name);
      return true;
    };
    if (/^\[Resultado do cartão:/.test(text)) { later(session, state.turnDelay, () => answer(session, 'Recebi o resultado do cartão.', assistantID)); return; }
    /* Rascunho de revisão (#93): o contexto do diálogo chega como JSON; a
       sessão temporária não tem MCP e a resposta é só o JSON do rascunho. */
    if (state.reviewDraft && /^\{"question"/.test(text)) { later(session, state.reviewDelay, () => answer(session, state.reviewDraft, assistantID)); return; }
    const mcpCall = state.mcpCalls ? state.mcpCalls.shift() : state.mcpCall;
    if (mcpCall) { later(session, state.turnDelay, () => mcpTurn(session, text, assistantID, mcpCall)); return; }
    if (state.dropAfterAccept) { later(session, 15, () => { for (const res of streams) res.destroy(); }); return; }
    if (state.failTurn === 'free-tier') { later(session, state.turnDelay, () => failFreeTier(session, assistantID)); return; }
    if (state.failTurn === 'free-limit') { later(session, state.turnDelay, () => failFreeLimit(session, text, assistantID)); return; }
    if (state.failTurn === 'network') { later(session, state.turnDelay, () => failNetwork(session, assistantID)); return; }
    if (chaos('stream-abort')) {
      later(session, state.turnDelay, () => {
        emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: 'A resposta começou e vai'});
        for (const res of streams) res.destroy();
      });
      return;
    }
    if (chaos('desk-error')) {
      later(session, state.turnDelay, () => {
        emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
        emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: 'Começou a responder…'});
        const error = {message: 'Falha de teste no meio da resposta.'};
        emit('session.step.failed', {sessionID: session.id, assistantMessageID: assistantID, error});
        emit('session.execution.failed', {sessionID: session.id, error});
        endTurn(session);
      });
      return;
    }
    if (chaos('stall')) {
      later(session, state.turnDelay, () => {
        emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
        emit('session.text.delta', {sessionID: session.id, assistantMessageID: assistantID, delta: 'Vou travar agora…'});
      });
      return;
    }
    if (state.steps) { later(session, state.turnDelay, () => runSteps(session, state.steps)); return; }
    if (/falha do provedor/i.test(text)) {
      later(session, state.turnDelay, () => {
        emit('session.step.started', {sessionID: session.id, assistantMessageID: assistantID});
        const error = {message: 'Erro de teste do provedor.'};
        emit('session.step.failed', {sessionID: session.id, assistantMessageID: assistantID, error});
        emit('session.execution.failed', {sessionID: session.id, error});
        endTurn(session);
      });
      return;
    }
    if (/resposta longa/i.test(text)) { later(session, state.turnDelay, () => longTurn(session, text, assistantID)); return; }
    if (/pensar profundo/i.test(text)) { later(session, state.turnDelay, () => worklogTurn(session, assistantID)); return; }
    if (/teorema/i.test(text)) { later(session, state.turnDelay, () => answer(session, 'A identidade de Pitágoras: $a^2 + b^2 = c^2$ vale em triângulos retângulos.\n\n$$E = mc^2$$', assistantID)); return; }
    let toolPart = null;
    if (state.tool) {
      const callID = String(state.tool.id || `call_${Math.random().toString(36).slice(2, 8)}`);
      const output = [{type: 'text', text: state.tool.output}];
      emit('session.tool.input.started', {sessionID: session.id, id: callID, name: state.tool.name});
      emit('session.tool.called', {sessionID: session.id, id: callID, input: state.tool.input});
      emit('session.tool.success', {sessionID: session.id, id: callID, content: output});
      toolPart = {type: 'tool', id: callID, name: state.tool.name, state: {status: 'completed', input: state.tool.input, content: output, structured: {}}, time: {created: Date.now(), completed: Date.now()}};
    }
    if (state.permission) {
      const id = `per_${Math.random().toString(36).slice(2, 8)}`;
      pendingAsk.set(id, () => finishTurn(session, text, assistantID, toolPart));
      emit(state.permissionEvent === 'v2' ? 'permission.v2.asked' : 'permission.asked', {sessionID: session.id, id, ...state.permission});
      return;
    }
    if (state.ask) {
      const id = `per_${Math.random().toString(36).slice(2, 8)}`;
      pendingAsk.set(id, () => finishTurn(session, text, assistantID, toolPart));
      emit('permission.asked', {sessionID: session.id, id, action: 'read', resources: ['/fora/x.pdf']});
      return;
    }
    later(session, state.turnDelay, () => finishTurn(session, text, assistantID, toolPart));
  }

  function sessionRoute(req, res, body, session, tail) {
    if (req.method === 'GET' && tail === '') return json(res, 200, {data: {id: session.id, model: session.model}});
    /* O 2.2.4 real só encontra a sessão com `?location[directory]=…`; sem a
       query o DELETE responde 404 e a sessão fica (#93). O fake cobra o mesmo
       contrato para o teste provar a chamada certa. */
    if (req.method === 'DELETE' && tail.startsWith('?')) {
      const location = new URLSearchParams(tail.slice(1)).get('location[directory]');
      if (!location) return json(res, 404, {_tag: 'SessionNotFound'});
      sessions.delete(session.id);
      return json(res, 204);
    }
    if (req.method === 'PATCH' && tail === '') return json(res, 204);
    if (req.method === 'POST' && tail === '/model') { session.model = body?.model; return json(res, 204); }
    if (req.method === 'GET' && tail.startsWith('/message')) {
      const list = tail.includes('order=desc') ? [...session.messages].reverse() : session.messages;
      if (!state.pageSize) return json(res, 200, {data: list, cursor: {previous: null, next: null}});
      /* Paginado como o servidor real: o cursor aqui é só o índice. */
      const start = Number(new URLSearchParams(tail.split('?')[1] || '').get('cursor') || 0);
      const end = start + state.pageSize;
      return json(res, 200, {data: list.slice(start, end), cursor: {previous: null, next: end < list.length ? String(end) : null}});
    }
    if (req.method === 'POST' && tail === '/interrupt') {
      /* Interromper cancela o turno em voo de verdade: sem isso o timer longo
         do fake (fila) respondia depois do Parar e sujava a janela. */
      clearTurn(session);
      session.busy = false;
      session.turn = '';
      emit('session.execution.interrupted', {sessionID: session.id});
      return json(res, 204);
    }
    if (req.method === 'POST' && tail === '/prompt') {
      const text = String(body?.text || '');
      if (state.promptStatus !== 200) return json(res, state.promptStatus, {_tag: 'Refused'});
      /* Recusa de teste ANTES do aceite, como o servidor recusa modelo/chave. */
      if (state.refusePrefix && text.startsWith(state.refusePrefix)) {
        refusalLog({at: Date.now(), message: text});
        return json(res, 409, {_tag: 'Refused', message: 'Recusa de teste antes do aceite'});
      }
      const id = String(body?.id || `msg_${Date.now()}`);
      queueLog({message: text, streamingBehavior: body?.delivery === 'steer' ? 'steer' : 'followUp', inFlight: !!session.busy, images: Array.isArray(body?.files) ? body.files.length : 0});
      const steer = body?.delivery === 'steer' && session.busy;
      if (steer) clearTurn(session);
      session.messages.push({id, type: 'user', text, time: {created: Date.now()}});
      json(res, 200, {data: {type: 'user', id, sessionID: session.id, delivery: body?.delivery || 'queue'}});
      beginTurn(session);
      if (steer) {
        /* O steer interrompe o turno em voo: o mesmo turno segue e responde. */
        later(session, 80, () => finishTurn(session, text, `msg_a${Math.random().toString(36).slice(2, 10)}`));
        return;
      }
      runTurn(session, text);
      return;
    }
    if (req.method === 'POST' && tail === '/command') {
      if (!commands.some((item) => item.name === body?.name)) return json(res, 404, {_tag: 'CommandNotFound'});
      json(res, 204);
      beginTurn(session);
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
      /* O 1.19.5 (v2) só entende `reply`; o 2.0.32 usa `decision`. */
      if (state.permissionReply === 'reply' && typeof body?.reply !== 'string') return json(res, 400, {_tag: 'InvalidRequestError'});
      const resume = pendingAsk.get(decodeURIComponent(permission[1]));
      if (!resume) return json(res, 404, {_tag: 'NotFound'});
      pendingAsk.delete(decodeURIComponent(permission[1]));
      json(res, 204);
      if ((body?.decision || body?.reply) === 'reject') emit('session.execution.failed', {sessionID: session.id, error: {message: 'rejected'}});
      else resume();
      return;
    }
    json(res, 404, {_tag: 'RouteNotFound'});
  }

  function instructionValue(body) {
    if (typeof body?.value === 'string') return body.value;
    if (body?.value && typeof body.value.text === 'string') return body.value.text;
    return '';
  }

  /* Canal experimental de instruções (v2). `instructionsStatus` simula o binário
     2.0.32, que não tem a rota. */
  function instructionsRoute(req, res, body) {
    const match = /^\/api\/experimental\/session\/([^/]+)\/instructions\/entries(?:\/([^/?]+))?$/.exec(String(req.url || '').split('?')[0]);
    if (!match) return false;
    if (state.instructionsStatus) { json(res, state.instructionsStatus, {_tag: 'RouteNotFound'}); return true; }
    const session = sessions.get(decodeURIComponent(match[1]));
    if (!session) { json(res, 404, {_tag: 'SessionNotFoundError'}); return true; }
    if (!session.instructions) session.instructions = new Map();
    const key = match[2] ? decodeURIComponent(match[2]) : '';
    if (req.method === 'GET' && !key) {
      json(res, 200, {data: [...session.instructions].map(([entryKey, value]) => ({key: entryKey, value}))});
      return true;
    }
    if (req.method === 'PUT' && key) {
      const value = instructionValue(body);
      const bytes = Buffer.byteLength(value);
      if (state.instructionMaxBytes && bytes > state.instructionMaxBytes) {
        json(res, 413, {_tag: 'InstructionEntryValueTooLargeError', actualBytes: bytes, maxBytes: state.instructionMaxBytes});
        return true;
      }
      session.instructions.set(key, value);
      promptLog(value);
      json(res, 204);
      return true;
    }
    if (req.method === 'DELETE' && key) { session.instructions.delete(key); json(res, 204); return true; }
    json(res, 404, {_tag: 'RouteNotFound'});
    return true;
  }

  function authModelsFor() {
    const out = [...models];
    for (const list of authModels.values()) out.push(...list);
    return out;
  }

  function addConnection(id) {
    connections[id] = [...(connections[id] || []), {type: 'credential', id: `cred_${id}`, label: 'Fake account', method: 'oauth'}];
    if (auth.loginModels.length) authModels.set(id, auth.loginModels);
  }

  function integrationRoute(req, res, body, bare) {
    if (req.method === 'GET' && bare === '/api/integration') {
      return json(res, 200, {location: {directory: process.cwd()}, data: integrations.map((item) => ({...item, connections: connections[item.id] || []}))});
    }
    const key = /^\/api\/integration\/([^/]+)\/connect\/key$/.exec(bare);
    if (req.method === 'POST' && key) {
      const id = decodeURIComponent(key[1]);
      if (!integrations.some((item) => item.id === id)) return json(res, 404, {_tag: 'IntegrationNotFoundError'});
      if (auth.keyOutcome === 'reject') return json(res, 401, {_tag: 'InvalidCredentialError', message: 'invalid api key sk-fake-secret-123456'});
      connections[id] = [...(connections[id] || []), {type: 'credential', id: `cred_${id}_key`, label: body?.label || 'API key', method: 'key'}];
      if (auth.loginModels.length) authModels.set(id, auth.loginModels);
      return json(res, 200, {data: {id: `cred_${id}_key`, integrationID: id, label: body?.label || 'API key', active: true, value: {type: 'key', key: '[oculto]'}}});
    }
    const oauth = /^\/api\/integration\/([^/]+)\/connect\/oauth$/.exec(bare);
    if (req.method === 'POST' && oauth) {
      const id = decodeURIComponent(oauth[1]);
      const item = integrations.find((entry) => entry.id === id);
      const method = item?.methods.find((entry) => entry.id === body?.methodID && entry.type === 'oauth');
      if (!method) return json(res, 400, {_tag: 'InvalidRequestError', message: 'unknown method'});
      const attemptID = `con_${Math.random().toString(36).slice(2)}`;
      const now = Date.now();
      const expires = auth.oauthOutcome === 'short' ? now + 900 : now + 10 * 60 * 1000;
      attempts.set(attemptID, {integrationID: id, polls: 0, expires, time: {created: now, expires}});
      return json(res, 200, {location: {directory: process.cwd()}, data: {
        attemptID,
        url: `https://auth.example.test/${id}?code=FAKE-${attemptID}`,
        instructions: `Enter code FAKE-${attemptID}`,
        mode: auth.oauthMode,
        time: {created: now, expires},
      }});
    }
    const attempt = /^\/api\/integration\/([^/]+)\/connect\/oauth\/([^/]+)(\/complete)?$/.exec(bare);
    if (!attempt) return false;
    const id = decodeURIComponent(attempt[1]);
    const attemptID = decodeURIComponent(attempt[2]);
    const found = attempts.get(attemptID);
    if (!found) return json(res, 404, {_tag: 'AttemptNotFoundError'});
    if (req.method === 'DELETE' && !attempt[3]) { attempts.delete(attemptID); return json(res, 204); }
    if (req.method === 'POST' && attempt[3] === '/complete') {
      attempts.delete(attemptID);
      addConnection(id);
      return json(res, 200, {data: {status: 'complete', time: found.time}});
    }
    if (req.method !== 'GET') return json(res, 405, {_tag: 'MethodNotAllowed'});
    if (auth.oauthOutcome === 'failed') return json(res, 200, {data: {status: 'failed', message: 'invalid key sk-fake-secret-123456', time: found.time}});
    if (auth.oauthOutcome === 'expired' || Date.now() > found.expires) return json(res, 200, {data: {status: 'expired', time: found.time}});
    if (auth.oauthOutcome === 'pending') return json(res, 200, {data: {status: 'pending', time: found.time}});
    found.polls += 1;
    if (found.polls < auth.oauthPolls) return json(res, 200, {data: {status: 'pending', time: found.time}});
    attempts.delete(attemptID);
    addConnection(id);
    return json(res, 200, {data: {status: 'complete', time: found.time}});
  }

  function route(req, res, body) {
    if (instructionsRoute(req, res, body)) return;
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
    if (integrationRoute(req, res, body, bare) !== false) return;
    if (req.method === 'GET' && bare === '/api/model') return json(res, 200, {location: {directory: process.cwd()}, data: authModelsFor()});
    if (req.method === 'GET' && bare === '/api/command') return json(res, 200, {location: {directory: process.cwd()}, data: commands});
    if (req.method === 'GET' && url.startsWith('/api/mcp')) { const pending = state.mcpPendingFile && fs.existsSync(state.mcpPendingFile); return json(res, 200, {data: [...new Set([...mcp.keys()].map((key) => key.split('\0')[1]))].map((name) => ({name, status: {status: pending ? 'pending' : state.mcpStatus}}))}); }
    const mcpPut = /^\/api\/experimental\/mcp\/([^/?]+)/.exec(url);
    if (req.method === 'PUT' && mcpPut) {
      const directory = new URLSearchParams(url.split('?')[1] || '').get('location[directory]') || '';
      mcp.set(mcpKey(directory, decodeURIComponent(mcpPut[1])), body?.config);
      return json(res, 200, {data: {}});
    }
    if (req.method === 'POST' && url === '/api/session') {
      const id = String(body?.id || `ses_${Math.random().toString(36).slice(2)}`);
      if (!sessions.has(id)) sessions.set(id, {id, model: body?.model || null, location: body?.location || null, permissions: body?.permissions || null, messages: [], instructions: new Map()});
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
    url: `http://127.0.0.1:${port}`, requests, sessions, mcp, state, emit, integrations, connections, attempts,
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

/* Sessões já existentes para o teste de histórico (#115): o arquivo apontado
   por FAKE_OPENCODE_SEED tem `{sessions:{<ses_…>:{messages:[…]}}}`. Sem isso o
   servidor falso só conhece a sessão depois do primeiro `POST /api/session`, e
   não dá para comparar cache do descritor × histórico nativo na abertura. */
function seedSessions(serve, file) {
  if (!file) return;
  const seed = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [id, entry] of Object.entries(seed.sessions || {})) {
    const messages = Array.isArray(entry) ? entry : entry?.messages || [];
    serve.sessions.set(id, {id, model: entry?.model || null, location: null, permissions: null, messages, instructions: new Map()});
  }
}

/* Modo executável: `fake-opencode.mjs serve --hostname 127.0.0.1 --port 0`,
   como a Mesa lança o binário. FAKE_OPENCODE_LOG grava os pedidos (JSONL) e o
   ambiente que importa — se a chave chegou, NUNCA o valor dela. */
async function runAsBinary(argv) {
  /* A triagem chama o CLI como a pessoa: `--version` e `models`. A guarda só
     nasce no modo `serve`: um timer aqui seguraria esses comandos curtos
     abertos para sempre. */
  if (argv[0] === '--version') { process.stdout.write('2.2.4\n'); return; }
  if (argv[0] === 'models') {
    for (const model of modelsFromEnv()) process.stdout.write(`${model.providerID}/${model.id}\n`);
    return;
  }
  if (argv[0] !== 'serve') { process.stderr.write(`fake-opencode: subcomando ${JSON.stringify(argv[0])} não existe; esperado "serve"\n`); process.exit(2); }
  /* Defesa do harness (#105): servo órfão depois que o app/teste morre não
     pode ficar vivo. O `opencode serve` real não faz isto; o fake faz para o
     teste não depender da guarda de quem o subiu. `FAKE_OPENCODE_IGNORE_PARENT_DEATH`
     desliga só no teste que encena a queda do dono de propósito. */
  const parentPid = process.ppid;
  const ownerPid = Number(process.env.MESA_TEST_OWNER_PID || 0);
  const ownerAlive = () => {
    try { process.kill(ownerPid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
  };
  if (process.env.FAKE_OPENCODE_IGNORE_PARENT_DEATH !== '1') {
    setInterval(() => {
      if (process.ppid !== parentPid || (ownerPid > 0 && !ownerAlive())) process.exit(0);
    }, 500);
  }
  const logFile = process.env.FAKE_OPENCODE_LOG || '';
  const write = (entry) => { if (logFile) fs.appendFileSync(logFile, JSON.stringify(entry) + '\n'); };
  write({start: true, argv, cwd: process.cwd(), keyPresent: !!process.env.OPENCODE_API_KEY, serverPasswordInherited: 'OPENCODE_SERVER_PASSWORD' in process.env});
  /* O host exige o sinal de carga do plugin da jaula (#89); o servidor falso
     faz o papel do plugin para os testes de janela não rodarem sem jaula. */
  const append = (file, entry) => {
    if (!file) return;
    try { fs.appendFileSync(file, `${JSON.stringify(entry)}\n`); } catch { /* o log do teste não derruba o motor */ }
  };
  const replyText = process.env.FAKE_OPENCODE_REPLY || '';
  const serve = await createFakeOpencodeServe({password: process.env.OPENCODE_PASSWORD || '', log: write,
    oauthOutcome: process.env.FAKE_OPENCODE_OAUTH || 'complete',
    oauthPolls: Number(process.env.FAKE_OPENCODE_OAUTH_POLLS || 1),
    oauthMode: process.env.FAKE_OPENCODE_OAUTH_MODE || 'auto',
    keyOutcome: process.env.FAKE_OPENCODE_KEY || 'accept',
    loginModels: process.env.FAKE_OPENCODE_LOGIN_MODELS ? JSON.parse(process.env.FAKE_OPENCODE_LOGIN_MODELS) : [],
    ...(process.env.FAKE_OPENCODE_MANY_MODELS || process.env.FAKE_OPENCODE_SECOND_MODEL || process.env.FAKE_OPENCODE_TEXT_ONLY ? {models: modelsFromEnv()} : {}),
    ...(replyText ? {reply: (text) => process.env.FAKE_OPENCODE_REPLY_ECHO === '1' ? `${replyText}${text.slice(-40)}` : replyText} : {}),
    ask: process.env.FAKE_OPENCODE_ASK === '1', mcpCall: process.env.FAKE_OPENCODE_MCP_CALL ? JSON.parse(process.env.FAKE_OPENCODE_MCP_CALL) : null, mcpCalls: process.env.FAKE_OPENCODE_MCP_CALLS ? JSON.parse(process.env.FAKE_OPENCODE_MCP_CALLS) : null, failTurn: ['free-tier', 'free-limit', 'network'].includes(process.env.FAKE_OPENCODE_FAIL) ? process.env.FAKE_OPENCODE_FAIL : undefined, promptStatus: Number(process.env.FAKE_OPENCODE_PROMPT_STATUS || 200),
    turnDelayMs: Number(process.env.FAKE_OPENCODE_QUEUE_HOLD_MS || 0) || undefined,
    chaos: String(process.env.FAKE_OPENCODE_CHAOS || '').split(',').map((item) => item.trim()).filter(Boolean),
    refusePrefix: process.env.FAKE_OPENCODE_REFUSAL_LOG ? 'falhar' : '',
    queueLog: (entry) => append(process.env.FAKE_OPENCODE_QUEUE_LOG, entry),
    refusalLog: (entry) => append(process.env.FAKE_OPENCODE_REFUSAL_LOG, entry),
    promptLog: (value) => { if (process.env.FAKE_OPENCODE_PROMPT_LOG) fs.writeFileSync(process.env.FAKE_OPENCODE_PROMPT_LOG, value); },
    reviewDraft: process.env.FAKE_OPENCODE_REVIEW_DRAFT || '', reviewDelayMs: Number(process.env.FAKE_OPENCODE_REVIEW_DELAY || 0),
    mcpBefore: process.env.FAKE_OPENCODE_MCP_BEFORE || '', mcpAfter: process.env.FAKE_OPENCODE_MCP_AFTER || '',
    mcpPendingFile: process.env.FAKE_OPENCODE_MCP_PENDING_FILE || '',
    stream: process.env.FAKE_OPENCODE_STREAM === 'long' ? {deltas: Number(process.env.FAKE_OPENCODE_STREAM_DELTAS || 240), delayMs: Number(process.env.FAKE_OPENCODE_STREAM_DELTA_MS || 25)} : null,
    steps: process.env.FAKE_OPENCODE_STEPS ? JSON.parse(process.env.FAKE_OPENCODE_STEPS) : null});
  seedSessions(serve, process.env.FAKE_OPENCODE_SEED || '');
  process.stdout.write(`server listening on ${serve.url}\n`);
  setInterval(() => {}, 1 << 30);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runAsBinary(process.argv.slice(2));
