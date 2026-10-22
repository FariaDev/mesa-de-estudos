#!/usr/bin/env node
/* Mede o que a Mesa manda aos dois motores, sem inferência, login nem rede.
 *
 * Monta o pedido de forma determinística com o mesmo código do app
 * (`src/agents/desk-prompts.cjs`, as ferramentas do Claude e as extensões do
 * Pi) e conta caracteres e tokens com um estimador local. O Pi entra pelo SDK
 * instalado (como em `tests/native-*.mjs`): numa pasta temporária, sem as
 * extensões nem o perfil do usuário, só para ler o prompt de sistema e o
 * esquema das ferramentas. Sem o Pi instalado, a parte dele é pulada.
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

const desk = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(desk, 'package.json'));
const prompts = require('./src/agents/desk-prompts.cjs');
const {buildStudyContext} = require('./studycontext.cjs');

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

/* ---------- Claude: o que o SDK recebe ---------- */
export async function claudeTools(deskDir = desk) {
  const {z} = await import('zod');
  const {createTutorPdfTool} = fromDesk(deskDir, 'src/agents/tutor-pdf.cjs');
  const {createActivityTool, createPreviewTool} = fromDesk(deskDir, 'src/agents/activity-tools.cjs');
  const noop = async () => ({});
  const defs = [await createTutorPdfTool(noop), await createActivityTool(noop), await createPreviewTool(noop)];
  return defs.map((def) => ({
    name: `mcp__mesa__${def.name}`,
    description: def.description,
    input_schema: z.toJSONSchema(z.object(def.inputSchema), {io: 'input', unrepresentable: 'any'}),
  }));
}

/* ---------- Pi: o SDK instalado monta o prompt e as ferramentas ---------- */
export async function piRequest({materialTools, deskDir = desk}) {
  const {resolvePi} = require('./pi.cjs');
  let bin;
  try {
    bin = resolvePi({deskDir: desk});
  } catch {
    return null;
  }
  if (!bin || !fs.existsSync(bin)) return null;
  let pkg = path.dirname(fs.realpathSync(bin));
  while (!fs.existsSync(path.join(pkg, 'package.json'))) pkg = path.dirname(pkg);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-measure-'));
  const agentDir = path.join(root, 'agent');
  fs.mkdirSync(agentDir);
  const saved = {...process.env};
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.LEARNING_DESK_ACTIVITY_BRIDGE = materialTools ? JSON.stringify({url: 'http://127.0.0.1:9/activity', token: 'x'}) : '';
  process.env.LEARNING_DESK_MATERIAL_BRIDGE = materialTools ? JSON.stringify({url: 'http://127.0.0.1:9/pdf', token: 'x'}) : '';
  try {
    const sdk = await import(pathToFileURL(path.join(pkg, 'dist', 'index.js')));
    const {buildSystemPromptSections} = await import(pathToFileURL(path.join(pkg, 'dist', 'core', 'system-prompt.js')));
    const settingsManager = sdk.SettingsManager.create(root, agentDir);
    const extensions = materialTools ? ['tutor-pdf', 'mesa-activity', 'mesa-figure'].map((name) => path.join(deskDir, 'src', 'extensions', name)) : [];
    const resourceLoader = new sdk.DefaultResourceLoader({
      cwd: root, agentDir, settingsManager, noExtensions: true, noSkills: true, noPromptTemplates: true, noProjectContext: true,
      appendSystemPrompt: [fromDesk(deskDir, 'src/agents/desk-prompts.cjs').piPrompt({materialTools})], additionalExtensionPaths: extensions,
    });
    await resourceLoader.reload();
    const model = {id: 'fixture', name: 'Sem inferência', provider: 'fixture', api: 'openai-completions', baseUrl: 'http://127.0.0.1:9', reasoning: false, input: ['text'], cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: 100000, maxTokens: 1000};
    const {session} = await sdk.createAgentSession({cwd: root, agentDir, model, resourceLoader, settingsManager, sessionManager: sdk.SessionManager.inMemory()});
    await session.bindExtensions({});
    const sections = buildSystemPromptSections(session._baseSystemPromptOptions);
    const tools = session.agent.state.tools.map((tool) => ({name: tool.name, description: tool.description, input_schema: tool.parameters}));
    session.dispose?.();
    return {version: JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version, sections, tools};
  } finally {
    for (const key of ['PI_CODING_AGENT_DIR', 'LEARNING_DESK_ACTIVITY_BRIDGE', 'LEARNING_DESK_MATERIAL_BRIDGE']) {
      if (key in saved) process.env[key] = saved[key];
      else delete process.env[key];
    }
    fs.rmSync(root, {recursive: true, force: true});
  }
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
  const piActivity = activityGuide.publishedText(bridgeReply, 'visualizacao');
  return {
    'PDF preparado — Claude': claudePdf.content[0].text,
    'PDF preparado — Pi': pdfGuide.resultText(PDF_RESULT),
    'Quadro mostrado — Claude': claudeActivity.content[0].text,
    'Quadro mostrado — Pi': piActivity,
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
  const out = {claude: {}, pi: {}, results: {}, context: {}};
  const tools = await claudeTools();
  out.claude.tools = Object.fromEntries(tools.map((tool) => [tool.name, toolSize(tool)]));
  out.claude.toolsTotal = sum(Object.values(out.claude.tools));
  out.claude.systemCourse = size(prompts.claudePrompt({profile, tools: true}));
  out.claude.systemFree = size(prompts.claudePrompt({tools: true}));
  out.claude.systemSidechat = size(prompts.claudePrompt({profile}));
  out.claude.prefixCourse = sum([out.claude.systemCourse, out.claude.toolsTotal]);
  out.claude.toolPrompts = size(prompts.mainSessionPrompt());

  const pi = await piRequest({materialTools: true});
  if (pi) {
    out.pi.version = pi.version;
    out.pi.sections = Object.fromEntries(Object.entries(pi.sections).map(([name, text]) => [name, size(text)]));
    out.pi.system = sum(Object.values(out.pi.sections));
    out.pi.tools = Object.fromEntries(pi.tools.map((tool) => [tool.name, toolSize(tool)]));
    out.pi.mesaTools = sum(Object.entries(out.pi.tools).filter(([name]) => name.startsWith('mesa_')).map(([, value]) => value));
    out.pi.builtinTools = sum(Object.entries(out.pi.tools).filter(([name]) => !name.startsWith('mesa_')).map(([, value]) => value));
    out.pi.prefix = sum([out.pi.system, out.pi.mesaTools, out.pi.builtinTools]);
    out.pi.mesaPart = sum([out.pi.sections.addendum, out.pi.mesaTools]);
    const side = await piRequest({materialTools: false});
    out.pi.sidechatAddendum = side ? side.sections.addendum && size(side.sections.addendum) : null;
  } else out.pi = null;

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
  if (data.pi) {
    for (const [name, value] of Object.entries(data.pi.sections)) lines.push(row(`**Pi ${data.pi.version}** — seção ${name}`, value));
    for (const [name, value] of Object.entries(data.pi.tools)) lines.push(row(`Pi — ferramenta ${name}`, value));
    lines.push(row('**Pi — prefixo (sistema + ferramentas, sem o perfil do usuário)**', data.pi.prefix));
    lines.push(row('Pi — parte da Mesa (adendo + ferramentas mesa_*)', data.pi.mesaPart));
    lines.push(row('Pi — adendo do chat lateral', data.pi.sidechatAddendum));
  } else lines.push('| Pi | não instalado | — |');
  for (const [name, value] of Object.entries(data.results)) lines.push(row(`Resultado: ${name}`, value));
  for (const [name, value] of Object.entries(data.context)) lines.push(row(name, value));
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = await measure();
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify(data, null, 2) + '\n' : markdown(data) + '\n');
}
