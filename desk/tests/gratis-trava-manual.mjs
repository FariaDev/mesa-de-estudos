#!/usr/bin/env node
/* Manual, fora dos corredores (`*-manual.mjs` não casa com `npm test`, `npm
   run hunts` nem `npm run ui`): prova a trava do tutor com o OpenCode 2.2.4
   real, sem credencial (diagnóstico de 2026-11-05).

   Parte 1 (gasta a cota grátis de quem roda, 2 turnos triviais, um por modelo
   recomendado): com o config da Mesa o grátis responde sem chave e sem 429.
   Os dois recomendados de `free-models.json` são testados de verdade; sem o
   binário isolado 2.x, PULA (77).

   Parte 2 (sem cota: provedor falso local): mostra a lista exata que o `serve`
   manda ao modelo com o config da Mesa — só `read`, `skill` e `mesa_*`, nada
   de bash/edit/webfetch/task — e falha se aparecer qualquer outra nativa.
   Também mede o que acontece sem o sentinela: `read: {'*': 'deny'}` sozinho
   retira `read` da lista; foi por isso que a regra `allow` do caminho
   inexistente ficou.

   Parte 3 (sem cota): pede ao provedor falso `read` de arquivo dentro e fora
   do workspace, por symlink, por `..`, por caminho do Windows e pelo sentinela,
   e `skill` de uma skill carregada da config da Mesa. Tudo é negado no
   servidor do OpenCode, nenhum conteúdo chega ao provedor, o sentinela não é
   criado e skills de HOME/projeto/workspace não são carregadas.

   Isolamento obrigatório: `HOME`/XDG temporários, nada de `OPENCODE_*`
   herdado, nenhuma credencial lida ou escrita, sem tocar `~/.opencode` nem
   PATH. Só os servidores que este roteiro subir, parados por PID. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {tempDir} from './temp-dir.mjs';

const require = (await import('node:module')).createRequire(import.meta.url);
const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function skip(reason) { console.log(`PULADO: ${reason}`); process.exit(77); }

const binary = String(process.env.LEARNING_DESK_OPENCODE || '');
if (!binary || !fs.existsSync(binary)) skip('defina LEARNING_DESK_OPENCODE com o binário isolado do OpenCode 2.x');
const {CONFIG, READ_SENTINEL, serveEnv, writeServeConfig} = require(path.join(DESK, 'src/agents/opencode-serve-config.cjs'));
const {startOpenCodeServer} = require(path.join(DESK, 'src/agents/opencode-process.cjs'));
const {OpenCodeAdapter} = require(path.join(DESK, 'src/agents/opencode-adapter.cjs'));
const {createOpenCodeClient} = require(path.join(DESK, 'src/agents/opencode-http.cjs'));
const {openCodePrompt} = require(path.join(DESK, 'src/agents/desk-prompts.cjs'));

const MCP_SERVER = path.join(DESK, 'src', 'extensions', 'mesa-mcp', 'server.mjs');
const MODELS = ['opencode/deepseek-v4.1-flash-free', 'opencode/glm-5.3-flash-free'];
const FORBIDDEN_NATIVES = ['bash', 'shell', 'edit', 'write', 'multiedit', 'apply_patch', 'patch', 'glob', 'grep', 'list', 'task', 'subagent', 'webfetch', 'websearch', 'browser', 'todowrite', 'todoread', 'question', 'execute', 'codemode', 'tool_search'];
const READ_SKILL = 'skill-manual';
const HOME_SKILL = 'skill-home';
const PROJECT_SKILL = 'skill-projeto';
const WORKSPACE_SKILL = 'skill-workspace';

/** Base sem segredo e sem config herdada, com HOME/XDG temporários. */
function cleanBase(iso) {
  const base = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('OPENCODE_') || k === 'OPENCODE') continue;
    if (/(API_KEY|_TOKEN|_SECRET|CREDENTIAL)/.test(k)) continue;
    base[k] = v;
  }
  base.HOME = iso;
  base.XDG_CONFIG_HOME = path.join(iso, '.config');
  base.XDG_DATA_HOME = path.join(iso, '.local/share');
  base.XDG_STATE_HOME = path.join(iso, '.local/state');
  base.XDG_CACHE_HOME = path.join(iso, '.cache');
  return base;
}

/** MCP `mesa` real como o `mesaMcpConfig` monta (ponte falsa só de forma). */
function mcpReal(full) {
  const grant = full ? JSON.stringify({url: 'http://127.0.0.1:9/fake-bridge', token: 'repro-sem-credencial'}) : '';
  const ggb = path.join(tempDir('mesa-ggb'), 'ggb.json');
  fs.writeFileSync(ggb, '{}');
  return {
    type: 'local', command: [process.execPath, MCP_SERVER],
    environment: {
      ELECTRON_RUN_AS_NODE: '1',
      LEARNING_DESK_GGB_BRIDGE: ggb,
      LEARNING_DESK_ACTIVITY_BRIDGE: grant,
      LEARNING_DESK_MATERIAL_BRIDGE: grant,
      LEARNING_DESK_CARD_BRIDGE: grant,
      LEARNING_DESK_TUTOR_LANGUAGE: 'pt-BR',
    },
    enabled: true, codemode: false,
  };
}

/* Provedor OpenAI-compatible falso: registra as ferramentas oferecidas e
   executa, em ordem, as chamadas pedidas (`{name, args}`); depois responde
   texto. Não chama modelo nenhum. */
function fakeProvider(calls = []) {
  const state = {requests: 0, lastTools: null, bodies: [], toolResults: []};
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (!req.url?.includes('/chat/completions')) { res.writeHead(404).end('{}'); return; }
      state.requests += 1;
      let parsed = {};
      try { parsed = JSON.parse(body); } catch {}
      state.bodies.push(parsed);
      state.lastTools = parsed.tools?.map((t) => String(t.function?.name || t.name || ''));
      state.toolResults = (parsed.messages || []).filter((m) => m.role === 'tool').map((m) => String(m.content));
      const chunk = (delta, finish = null) => JSON.stringify({id: 'c', object: 'chat.completion.chunk', created: 1, model: 'm1', choices: [{index: 0, delta, finish_reason: finish}]});
      const call = calls[state.requests - 1];
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive'});
      if (call) {
        res.write(`data: ${chunk({role: 'assistant', tool_calls: [{index: 0, id: `call_${state.requests}`, type: 'function', function: {name: call.name, arguments: JSON.stringify(call.args)}}]})}\n\n`);
        res.write(`data: ${chunk({}, 'tool_calls')}\n\n`);
      } else {
        res.write(`data: ${chunk({role: 'assistant', content: 'OK'})}\n\n`);
        res.write(`data: ${chunk({}, 'stop')}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({server, url: `http://127.0.0.1:${server.address().port}`, state})));
}

/** Um turno trivial; devolve os eventos terminais para as asserções. */
async function oneLiveTurn(env, mcp, label, model) {
  const runtime = tempDir('mesa-repro');
  const ws = path.join(runtime, 'ws');
  fs.mkdirSync(ws, {recursive: true});
  let server = null;
  try {
    server = await startOpenCodeServer({binary, cwd: ws, env, timeoutMs: 30000});
    const ad = new OpenCodeAdapter({
      conversationId: 'repro', sessionId: '', directory: ws, systemPrompt: openCodePrompt({}),
      selection: {model, effort: null},
      acquire: async () => ({baseUrl: server.baseUrl, password: server.password, binary, pid: server.pid}),
      readVersion: async () => 'opencode', log: () => {}, mcpConfig: () => mcp,
    });
    const evts = [];
    ad.on('event', (e) => evts.push(e));
    await ad.send({id: 'u1', text: 'responda so: OK'});
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      if (evts.find((e) => e.type === 'turn_end')) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const err = evts.find((e) => e.type === 'error');
    const end = evts.find((e) => e.type === 'turn_end');
    const warnings = evts.filter((e) => e.type === 'warning').map((e) => e.code || e.message);
    const outcome = err ? `FALHOU: ${String(err.message || '').slice(0, 120)}` : end ? 'OK' : 'SEM-FIM (sem turn_end nem error em 240 s)';
    console.log(`[${label}] ${outcome}${warnings.length ? ` avisos: ${warnings.join(',')}` : ''}`);
    try { ad.stop(); } catch {}
    assert.equal(err, undefined, `${label}: sem erro do provedor`);
    assert.ok(end, `${label}: turno terminou`);
    assert.equal(end.isError, false, `${label}: turno terminou sem erro`);
    return {outcome, warnings};
  } finally {
    try { server?.stop(); } catch {}
    await new Promise((r) => setTimeout(r, 1000));
    fs.rmSync(runtime, {recursive: true, force: true});
  }
}

function writeConfig(directory, overlay, providerUrl) {
  fs.writeFileSync(path.join(directory, 'opencode.json'), JSON.stringify({
    $schema: 'https://opencode.ai/config.json', ...overlay,
    model: 'acme/m1',
    provider: {acme: {npm: '@ai-sdk/openai-compatible', options: {baseURL: `${providerUrl}/v1`, apiKey: 'fake'}, models: {m1: {name: 'M1', tool_call: true}}}},
  }, null, 2));
}

/** Lista que o serve manda ao modelo com cada config (cota zero). */
async function toolLists() {
  const overlays = {
    'vazia': {},
    'mesa': CONFIG,
    'read-deny-so': {permission: {'*': 'deny', 'mesa_*': 'allow', bash: 'deny', shell: 'deny', edit: 'deny', write: 'deny', read: {'*': 'deny'}}},
  };
  const fake = await fakeProvider();
  for (const [name, overlay] of Object.entries(overlays)) {
    const iso = tempDir('mesa-iso');
    const base = cleanBase(iso);
    const cfgDir = tempDir('mesa-cfg');
    writeConfig(cfgDir, overlay, fake.url);
    const runtime = tempDir('mesa-lista');
    const ws = path.join(runtime, 'ws');
    fs.mkdirSync(ws, {recursive: true});
    let server = null;
    try {
      server = await startOpenCodeServer({binary, cwd: ws,
        env: {...base, OPENCODE_CONFIG_DIR: cfgDir, OPENCODE_DISABLE_PROJECT_CONFIG: '1'}, timeoutMs: 30000});
      const ad = new OpenCodeAdapter({conversationId: `lista-${name}`, sessionId: '', directory: ws,
        systemPrompt: 'Voce e um tutor.', selection: {model: 'acme/m1', effort: null},
        acquire: async () => ({baseUrl: server.baseUrl, password: server.password, binary, pid: server.pid}),
        readVersion: async () => 'opencode', log: () => {}, mcpConfig: () => mcpReal(true)});
      const evts = [];
      ad.on('event', (e) => evts.push(e.type));
      await ad.send({id: 'u1', text: 'diga OK'});
      const t0 = Date.now();
      while (Date.now() - t0 < 30000 && !evts.includes('turn_end')) await new Promise((r) => setTimeout(r, 200));
      const tools = fake.state.lastTools || [];
      console.log(`[lista/${name}] ${tools.length} ferramenta(s): ${tools.join(',') || '(nenhuma)'}`);
      if (name === 'mesa') {
        assert.ok(tools.includes('read'), `a Mesa precisa oferecer read; viu ${tools.join(',')}`);
        assert.ok(tools.includes('skill'), `a Mesa mantém skill (negado); viu ${tools.join(',')}`);
        assert.deepEqual(tools.filter((tool) => !tool.startsWith('mesa_')).sort(), ['read', 'skill'], `só read e skill fora do MCP: ${tools.join(',')}`);
        for (const native of FORBIDDEN_NATIVES) assert.equal(tools.includes(native), false, `${native} não chega ao modelo`);
      }
      if (name === 'vazia') {
        assert.ok(tools.includes('read') && tools.includes('shell'), `a config vazia mostra as nativas: ${tools.join(',')}`);
      }
      if (name === 'read-deny-so') {
        assert.equal(tools.includes('read'), false, 'sem a regra allow, o 2.2.4 retira read da lista');
      }
      try { ad.stop(); } catch {}
    } finally {
      try { server?.stop(); } catch {}
      await new Promise((r) => setTimeout(r, 500));
      fs.rmSync(runtime, {recursive: true, force: true});
      fake.state.requests = 0; fake.state.lastTools = null; fake.state.bodies = []; fake.state.toolResults = [];
    }
  }
  fake.server.close();
}

/** Skills plantadas em HOME, projeto, workspace e na config da Mesa. */
function plantSkills(iso, ws, cfgDir) {
  const dirs = {
    [HOME_SKILL]: path.join(iso, '.config', 'opencode', 'skill', HOME_SKILL),
    [PROJECT_SKILL]: path.join(ws, '.opencode', 'skill', PROJECT_SKILL),
    [WORKSPACE_SKILL]: path.join(ws, 'skill', WORKSPACE_SKILL),
    [READ_SKILL]: path.join(cfgDir, 'skill', READ_SKILL),
  };
  for (const [name, dir] of Object.entries(dirs)) {
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: SEGREDO-${name}\n---\n\nCORPO-${name}\n`);
  }
}

/** Prova a recusa de `read` e `skill` no servidor do OpenCode. */
async function readAndSkillDenial() {
  const iso = tempDir('mesa-iso');
  const cfgDir = tempDir('mesa-cfg');
  const runtime = tempDir('mesa-read');
  const ws = path.join(runtime, 'ws');
  fs.mkdirSync(ws, {recursive: true});
  const inside = path.join(ws, 'dentro.txt');
  fs.writeFileSync(inside, 'CONTEUDO-DENTRO');
  const outsideDir = tempDir('mesa-fora');
  const outside = path.join(outsideDir, 'fora.txt');
  fs.writeFileSync(outside, 'CONTEUDO-FORA');
  const symlink = path.join(ws, 'link-fora.txt');
  fs.symlinkSync(outside, symlink);
  const dotdotFile = path.join(runtime, 'fora-via-dotdot.txt');
  fs.writeFileSync(dotdotFile, 'CONTEUDO-DOTDOT');
  const sentinelFile = READ_SENTINEL.replace(/\*$/, 'isca.txt');
  plantSkills(iso, ws, cfgDir);
  const fake = await fakeProvider([
    {name: 'read', args: {path: inside}},
    {name: 'read', args: {path: outside}},
    {name: 'read', args: {path: symlink}},
    {name: 'read', args: {path: `${ws}/../fora-via-dotdot.txt`}},
    {name: 'read', args: {path: 'C:\\mesa-nada-existe\\isca.txt'}},
    {name: 'read', args: {path: sentinelFile}},
    {name: 'skill', args: {id: READ_SKILL}},
  ]);
  writeConfig(cfgDir, CONFIG, fake.url);
  let server = null;
  try {
    server = await startOpenCodeServer({binary, cwd: ws,
      env: {...cleanBase(iso), OPENCODE_CONFIG_DIR: cfgDir, OPENCODE_DISABLE_PROJECT_CONFIG: '1'}, timeoutMs: 30000});
    const ad = new OpenCodeAdapter({conversationId: 'probe-read', sessionId: '', directory: ws,
      systemPrompt: 'Voce e um tutor.', selection: {model: 'acme/m1', effort: null},
      acquire: async () => ({baseUrl: server.baseUrl, password: server.password, binary, pid: server.pid}),
      readVersion: async () => 'opencode', log: () => {}, mcpConfig: () => mcpReal(true)});
    const evts = [];
    ad.on('event', (e) => evts.push(e.type));
    await ad.send({id: 'u1', text: 'leia'});
    const t0 = Date.now();
    while (Date.now() - t0 < 60000 && !evts.includes('turn_end')) await new Promise((r) => setTimeout(r, 200));
    const results = fake.state.toolResults;
    console.log(`[read/skill] ${results.length} resultado(s)`);
    assert.equal(results.length, 7, `todas as chamadas voltaram: ${results.join(' | ')}`);
    assert.match(results[0], /Permission denied: read/, 'arquivo dentro do workspace');
    assert.match(results[1], /Permission denied: external_directory/, 'arquivo fora do workspace');
    assert.match(results[2], /Permission denied: (read|external_directory)/, 'symlink para fora');
    assert.match(results[3], /Permission denied: (read|external_directory)/, 'caminho com ..');
    assert.match(results[4], /Permission denied: (read|external_directory)/, 'caminho do Windows');
    assert.match(results[5], /Permission denied: (read|external_directory)/, 'sentinela');
    assert.match(results[6], /Permission denied: skill/, 'skill carregada é negada');
    const bodies = JSON.stringify(fake.state.bodies);
    for (const secret of ['CONTEUDO-DENTRO', 'CONTEUDO-FORA', 'CONTEUDO-DOTDOT', 'SEGREDO-', 'CORPO-']) {
      assert.equal(bodies.includes(secret), false, `${secret} não chega ao provedor`);
    }
    assert.equal(fs.existsSync('/mesa-nada-existe'), false, 'o sentinela não foi criado');
    const client = createOpenCodeClient({baseUrl: server.baseUrl, password: server.password});
    const skills = await client.request('GET', '/api/skill', {query: {'location[directory]': ws}});
    const ids = (Array.isArray(skills.payload?.data) ? skills.payload.data : []).map((skill) => String(skill.id));
    console.log(`[skills] ${ids.join(',') || '(nenhuma)'}`);
    for (const hidden of [HOME_SKILL, PROJECT_SKILL, WORKSPACE_SKILL]) {
      assert.equal(ids.includes(hidden), false, `${hidden} (HOME/projeto/workspace) não é carregada`);
    }
    assert.ok(ids.includes(READ_SKILL), `a skill da config da Mesa é carregada para provar a recusa: ${ids.join(',')}`);
    try { ad.stop(); } catch {}
  } finally {
    try { server?.stop(); } catch {}
    await new Promise((r) => setTimeout(r, 800));
    fake.server.close();
    fs.rmSync(runtime, {recursive: true, force: true});
    fs.rmSync(outsideDir, {recursive: true, force: true});
  }
}

const iso = tempDir('mesa-iso');
const base = cleanBase(iso);
const mesaDir = writeServeConfig({runtime: tempDir('mesa-cfg')});
if (process.env.MESA_REPRO_SKIP_LIVE === '1') console.log('PULADO: turnos reais grátis (MESA_REPRO_SKIP_LIVE=1)');
else for (const model of MODELS) {
  const turn = await oneLiveTurn(serveEnv(base, mesaDir), mcpReal(true), `mesa ${model}`, model);
  assert.equal(turn.outcome, 'OK', `${model} respondeu sem chave`);
}
await toolLists();
await readAndSkillDenial();
console.log('done');
