#!/usr/bin/env node
/* Mede o que a Mesa manda aos dois motores, sem inferência, login nem rede.
 *
 * Monta o pedido de forma determinística com o mesmo código do app
 * (`src/agents/desk-prompts.cjs`, as ferramentas do Claude e do OpenCode) e
 * conta caracteres e tokens com um estimador local.
 *
 *   node scripts/measure-prompts.mjs          # tabela em Markdown
 *   node scripts/measure-prompts.mjs --json   # números para comparar
 *
 * O estimador não é o tokenizador do Claude: corta palavras em pedaços de até
 * 4 bytes UTF-8 e conta pontuação e quebras de linha à parte. Serve para
 * comparar antes e depois com a mesma régua; o valor absoluto erra ~15%. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';

const desk = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(desk, 'package.json'));
const prompts = require('./src/agents/desk-prompts.cjs');
const {buildStudyContext} = require('./studycontext.cjs');
/* Ponte de mentira comum às medições dos motores: só o formato que os
   registros conferem, sem abrir porta nem chamar ninguém. */
const FAKE_GRANT = {url: 'http://127.0.0.1:9/activity', token: 'medicao'};
const FAKE_CARD_GRANT = {url: 'http://127.0.0.1:9/activity', token: 'medicao'};

/* `deskDir` aponta para outra cópia do desk (o "antes" que
   `prompts-leitura.mjs` extrai do git); as dependências vêm sempre deste. */
const fromDesk = (deskDir, rel) => require(path.join(deskDir, rel));

export function estimateTokens(text) {
  let tokens = 0;
  for (const [piece] of String(text).matchAll(/\s*\p{L}+|\s*\p{N}{1,3}|\s*[^\s\p{L}\p{N}]{1,2}|\s+/gu)) {
    const core = piece.trimStart();
    if (!core) tokens += (piece.match(/\n/g) || []).length || 1;
    else if (/\p{L}/u.test(core)) tokens += Math.max(1, Math.ceil(Buffer.byteLength(core) / 4));
    else tokens += 1;
  }
  return tokens;
}

const size = (text) => ({chars: String(text).length, tokens: estimateTokens(text)});

/* Perfil de estudo dos templates do repositório (o que uma matéria sem
   TUTOR/LEARNER próprios recebe). */
export function templateProfile(deskDir = desk) {
  return ['TUTOR.md', 'LEARNER.md'].map((name) => ({name, text: fs.readFileSync(path.join(deskDir, 'templates', name), 'utf8')}));
}
const profile = templateProfile();

/* ---------- Claude: o que o SDK recebe ----------
   A lista sai do MESMO servidor MCP que a sessão monta (`createStudyToolsServer`),
   pelo protocolo MCP em memória: uma ferramenta nova entra no medidor sozinha
   (auditoria M5). Sem rede, login ou modelo. */
export async function claudeTools(deskDir = desk) {
  const {createStudyToolsServer} = fromDesk(deskDir, 'src/agents/study-tools.cjs');
  const noop = async () => ({});
  const server = await createStudyToolsServer({
    createMaterial: noop, createActivity: noop, previewActivity: noop, viewFigure: noop,
    geogebra: {run: noop, state: noop, screenshot: noop}, readPdf: noop, searchMaterial: noop, proposeReview: noop,
    listMaterials: noop, saveNote: noop, showCard: noop,
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'mesa-measure', version: '1.0.0'});
  await server.instance.connect(b);
  await client.connect(a);
  try {
    const listed = (await client.listTools()).tools;
    return listed.map((tool) => ({name: `mcp__mesa__${tool.name}`, description: tool.description, input_schema: tool.inputSchema}));
  } finally {
    await client.close();
    await server.instance.close();
  }
}

/* ---------- OpenCode: o que o MCP `mesa` registra ---------- */
/**
 * Ferramentas do MCP `mesa` no OpenCode, principal e chat lateral (`pdfOnly`).
 * @param {string} [deskDir]
 * @returns {Promise<{main: object[], side: object[]}|null>} `null` num `desk` anterior ao #57
 * @example (await openCodeTools()).main.map((tool) => tool.name) // ['geogebra', ...]
 */
export async function openCodeTools(deskDir = desk) {
  const file = path.join(deskDir, 'src', 'extensions', 'mesa-mcp', 'tools.mjs');
  if (!fs.existsSync(file)) return null;
  const {mesaTools} = await import(pathToFileURL(file).href);
  const env = {
    LEARNING_DESK_GGB_BRIDGE: path.join(os.tmpdir(), 'mesa-measure-ggb.json'),
    LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(FAKE_GRANT),
    LEARNING_DESK_CARD_BRIDGE: JSON.stringify(FAKE_CARD_GRANT),
    LEARNING_DESK_MATERIAL_BRIDGE: JSON.stringify({url: 'http://127.0.0.1:9/pdf', token: 'medicao'}),
    LEARNING_DESK_TUTOR_LANGUAGE: 'pt-BR',
  };
  const shape = (tool) => ({name: tool.name, description: tool.description, input_schema: tool.inputSchema});
  return {main: mesaTools(env).map(shape), side: mesaTools({...env, LEARNING_DESK_PDF_ONLY: '1'}).map(shape)};
}

/* ---------- Resultados de ferramenta que voltam ao modelo ---------- */
const PDF_RESULT = {
  prepared: true, reviewRequired: true, title: 'Lista 3 — Derivadas', model: 'lista',
  options: {colunas: 'auto', gabarito: false, rodape: ''}, diagnostics: [], templateHash: 'sha256:' + 'a'.repeat(64),
  message: 'Conteúdo pronto no diálogo de PDF. O usuário deve revisar e clicar em Salvar PDF e abrir. O arquivo PDF ainda não foi salvo.',
};
const ACTIVITY_ITEM = {
  id: 'act-0a1b2c3d4e', version: 1, hash: 'sha256:' + 'b'.repeat(64),
  conversationId: '/Users/aluno/Library/Application Support/Mesa de Estudos/runtime/claude/2026-10-15T12-00-00-000Z_0a1b2c3d.json',
  generation: 1, toolCallId: 'toolu_01ABCDEFGHIJKLMNOPQRSTUV', callRef: '3f2c9d1e-7b4a-4c1e-9f0a-1b2c3d4e5f60', kind: 'activity',
  title: 'Queda livre: posição × tempo', objective: 'Prever a posição depois de 2 s e conferir no gráfico.', createdAt: 1760529600000,
  bytes: 9421, katex: false, view: 'visualizacao',
  heights: [[320, 412], [375, 398], [430, 380], [520, 360], [640, 352], [728, 352], [860, 352], [1000, 352], [1144, 352]],
  reused: false, revision: false, scopeRef: 'c0ffee00-1111-4222-8333-944455556666',
};

async function toolResults() {
  const {createTutorPdfTool} = require('./src/agents/tutor-pdf.cjs');
  const {createActivityTool} = require('./src/agents/activity-tools.cjs');
  const pdfGuide = await import(pathToFileURL(path.join(desk, 'src', 'extensions', 'tutor-pdf', 'guide.mjs')));
  const activityGuide = await import(pathToFileURL(path.join(desk, 'src', 'extensions', 'mesa-activity', 'guide.mjs')));
  const claudePdf = await (await createTutorPdfTool(async () => PDF_RESULT)).handler({title: PDF_RESULT.title, markdown: '1. x'}, {});
  const claudeActivity = await (await createActivityTool(async () => ACTIVITY_ITEM)).handler({title: 't', objective: 'o', alternativeMarkdown: 'a', kind: 'visualizacao'}, {});
  const bridgeReply = {published: true, id: ACTIVITY_ITEM.id, version: 1, hash: ACTIVITY_ITEM.hash, kind: 'activity', title: ACTIVITY_ITEM.title, reused: false, reviewRequired: false};
  const openCodeActivity = activityGuide.publishedText(bridgeReply, 'visualizacao');
  return {
    'PDF preparado — Claude': claudePdf.content[0].text,
    'PDF preparado — OpenCode': pdfGuide.resultText(PDF_RESULT),
    'Quadro mostrado — Claude': claudeActivity.content[0].text,
    'Quadro mostrado — OpenCode': openCodeActivity,
  };
}

/* ---------- Contexto que vai junto da mensagem ---------- */
function contextBlocks() {
  const refs = ['/Users/aluno/Cálculo I/Listas/Lista 3 — Derivadas.pdf#page=4', '/Users/aluno/Cálculo I/Formulário.pdf#page=2'];
  const base = {course: 'Cálculo I', study: {title: 'Questão 7b', xopp: '/Users/aluno/Cálculo I/Rascunhos/lista3-q7.xopp'}, refs};
  const first = buildStudyContext(base);
  const again = buildStudyContext({...base, previousKey: first.key});
  const capture = buildStudyContext({...base, previousKey: first.key, capture: {capturedAt: Date.UTC(2026, 9, 15, 13, 5), exercise: 'Questão 7b', app: 'Xournal++'}});
  return {
    'Contexto — primeiro turno (matéria, questão, rascunho, 2 refs)': first.text,
    'Contexto — turno seguinte, nada mudou': again.text,
    'Contexto — mesmo contexto + captura do Conferir': capture.text,
  };
}

const sum = (items) => items.reduce((acc, item) => ({chars: acc.chars + item.chars, tokens: acc.tokens + item.tokens}), {chars: 0, tokens: 0});
const toolSize = (tool) => size(JSON.stringify(tool));

export async function measure() {
  const out = {claude: {}, opencode: {}, results: {}, context: {}};
  const tools = await claudeTools();
  out.claude.tools = Object.fromEntries(tools.map((tool) => [tool.name, toolSize(tool)]));
  out.claude.toolsTotal = sum(Object.values(out.claude.tools));
  out.claude.systemCourse = size(prompts.claudePrompt({profile, tools: true}));
  out.claude.systemFree = size(prompts.claudePrompt({tools: true}));
  out.claude.systemSidechat = size(prompts.claudePrompt({profile}));
  out.claude.prefixCourse = sum([out.claude.systemCourse, out.claude.toolsTotal]);
  out.claude.toolPrompts = size(prompts.mainSessionPrompt());

  const openCode = await openCodeTools();
  if (openCode) {
    out.opencode.tools = Object.fromEntries(openCode.main.map((tool) => [tool.name, toolSize(tool)]));
    out.opencode.toolsTotal = sum(Object.values(out.opencode.tools));
    out.opencode.sideTools = Object.fromEntries(openCode.side.map((tool) => [tool.name, toolSize(tool)]));
    out.opencode.sideToolsTotal = sum(Object.values(out.opencode.sideTools));
    out.opencode.systemCourse = size(prompts.openCodePrompt({profile}));
    out.opencode.systemFree = size(prompts.openCodePrompt({review: false}));
    out.opencode.systemSidechat = size(prompts.openCodePrompt({sidechat: true}));
    out.opencode.prefixCourse = sum([out.opencode.systemCourse, out.opencode.toolsTotal]);
    out.opencode.prefixSidechat = sum([out.opencode.systemSidechat, out.opencode.sideToolsTotal]);
  } else out.opencode = null;

  out.results = Object.fromEntries(Object.entries(await toolResults()).map(([name, text]) => [name, size(text)]));
  out.context = Object.fromEntries(Object.entries(contextBlocks()).map(([name, text]) => [name, size(text)]));
  return out;
}

function row(label, value) {
  return value ? `| ${label} | ${value.chars.toLocaleString('pt-BR')} | ${value.tokens.toLocaleString('pt-BR')} |` : `| ${label} | — | — |`;
}

function markdown(data) {
  const lines = ['| Parte | Caracteres | Tokens (aprox.) |', '|---|---:|---:|'];
  lines.push(row('**Claude** — sistema, matéria (base + TUTOR/LEARNER + ferramentas)', data.claude.systemCourse));
  lines.push(row('Claude — sistema, aba Livre', data.claude.systemFree));
  lines.push(row('Claude — sistema, chat lateral', data.claude.systemSidechat));
  lines.push(row('Claude — sessão principal no sistema (citação e o que oferecer)', data.claude.toolPrompts));
  for (const [name, value] of Object.entries(data.claude.tools)) lines.push(row(`Claude — ferramenta ${name}`, value));
  lines.push(row('**Claude — prefixo da Mesa (sistema + ferramentas mesa)**', data.claude.prefixCourse));
  if (data.opencode) {
    for (const [name, value] of Object.entries(data.opencode.tools)) lines.push(row(`**OpenCode** — ferramenta ${name}`, value));
    lines.push(row('OpenCode — ferramentas da sessão principal', data.opencode.toolsTotal));
    for (const [name, value] of Object.entries(data.opencode.sideTools)) lines.push(row(`OpenCode — ferramenta do chat lateral ${name}`, value));
    lines.push(row('OpenCode — sistema, matéria (base + perfil)', data.opencode.systemCourse));
    lines.push(row('OpenCode — sistema, aba Livre', data.opencode.systemFree));
    lines.push(row('OpenCode — sistema, chat lateral', data.opencode.systemSidechat));
    lines.push(row('**OpenCode — prefixo da Mesa, matéria (sistema + ferramentas)**', data.opencode.prefixCourse));
    lines.push(row('OpenCode — prefixo do chat lateral (sistema + ler_pdf)', data.opencode.prefixSidechat));
  } else lines.push('| OpenCode | não medido | — |');
  for (const [name, value] of Object.entries(data.results)) lines.push(row(`Resultado: ${name}`, value));
  for (const [name, value] of Object.entries(data.context)) lines.push(row(name, value));
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = await measure();
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify(data, null, 2) + '\n' : markdown(data) + '\n');
}
