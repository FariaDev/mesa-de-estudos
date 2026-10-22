import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {ACTIVITY_TOOL_NAME, ACTIVITY_TOOL_DESCRIPTION, createActivityTool, createActivityServer} = require('../src/agents/activity-tools.cjs');

test('createActivityTool devolve a definição da ferramenta com schema e handler', async () => {
  assert.equal(ACTIVITY_TOOL_NAME, 'mcp__mesa__criar_atividade');
  assert.match(ACTIVITY_TOOL_DESCRIPTION, /alternativeMarkdown/);
  assert.match(ACTIVITY_TOOL_DESCRIPTION, /64 KiB/);
  assert.match(ACTIVITY_TOOL_DESCRIPTION, /offline/);
  const definition = await createActivityTool(async () => ({published: true, id: 'x'}));
  assert.equal(typeof definition.handler, 'function');
  assert.equal(definition.inputSchema.title.safeParse('MRUV').success, true);
  assert.equal(definition.inputSchema.title.safeParse('x'.repeat(161)).success, false);
  assert.equal(definition.inputSchema.objective.safeParse('x'.repeat(301)).success, false);
  assert.equal(definition.inputSchema.alternativeMarkdown.safeParse('x'.repeat(8001)).success, false);
  assert.equal(definition.inputSchema.html.safeParse('x'.repeat(51201)).success, false);
  assert.equal(definition.inputSchema.css.safeParse('x'.repeat(32769)).success, false);
  assert.equal(definition.inputSchema.js.safeParse('x'.repeat(32769)).success, false);
  assert.equal(definition.inputSchema.callRef.safeParse('x'.repeat(81)).success, false);
  assert.equal(definition.inputSchema.activityId.safeParse('act-abc12345').success, true);
  assert.equal(definition.inputSchema.activityId.safeParse('x'.repeat(65)).success, false);
  assert.equal(definition.inputSchema.activityId.safeParse(undefined).success, true);
  assert.equal(definition.inputSchema.katex.safeParse(true).success, true);
});

test('createActivityServer compõe o servidor mesa com a ferramenta (sem API privada)', async () => {
  const server = await createActivityServer(async () => ({published: true, id: 'act-1'}));
  assert.equal(server.type, 'sdk');
  assert.equal(server.name, 'mesa');
  assert.ok(server.instance, 'instância do servidor presente para o SDK montar');
});

test('handler repassa o callRef injetado (nunca assume toolCallId do extra)', async () => {
  const calls = [];
  const definition = await createActivityTool(async (args) => {
    calls.push(args);
    return {published: true, id: 'act-1', title: 't', version: 1, hash: 'sha256:h'};
  });
  const result = await definition.handler({
    title: 'MRUV', objective: 'Explorar', alternativeMarkdown: 'a', html: '<p/>', css: '', js: '', katex: false, callRef: 'ref-injetado',
  }, {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].callRef, 'ref-injetado');
  assert.equal(calls[0].toolCallId, undefined);
  /* O resultado é a frase do guia, a mesma do Pi: id e versão para revisar,
     e o lembrete de não anunciar o quadro. Nada de JSON interno (#40). */
  assert.equal(result.content[0].text, (await import('../src/extensions/mesa-activity/guide.mjs')).publishedText({title: 't', id: 'act-1', version: 1}, undefined));
  assert.match(result.content[0].text, /act-1 v1/);
  assert.match(result.content[0].text, /não a anuncie/);
  assert.equal(result.isError, undefined);
});

test('erro do publicador vira isError com a mensagem, sem stack', async () => {
  const definition = await createActivityTool(async () => {
    const error = new Error('referência de chamada desconhecida; atividade não publicada.');
    error.code = 'BAD_INPUT';
    throw error;
  });
  const result = await definition.handler({title: 't', objective: 'o', alternativeMarkdown: 'a', html: '<p/>', css: '', js: ''}, {});
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /referência de chamada desconhecida/);
});

/* Regressão (#43 fase 3): o erro marcado do host ia ao modelo com a marca U+E000. */
test('createActivityTool devolve ao modelo o erro marcado na língua do tutor', async () => {
  const {message} = await import('../src/i18n.mjs');
  const definition = await createActivityTool(async () => { throw new Error(message('err.activity.sessionChangedNotPublished')); }, {language: 'en'});
  const result = await definition.handler({title: 't', objective: 'o', alternativeMarkdown: 'a', html: '<p/>', css: '', js: ''}, {});
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, 'The session changed; the activity was not published.');
});

/* ---------- #42: tipo, gráficos, prévia e paridade com o Pi ---------- */

const {PREVIEW_TOOL_NAME, PREVIEW_TOOL_DESCRIPTION, createPreviewTool} = require('../src/agents/activity-tools.cjs');
const fs = require('node:fs');
const path = require('node:path');

test('criar_atividade aceita o tipo e a biblioteca de gráficos', async () => {
  const definition = await createActivityTool(async () => ({published: true}));
  assert.equal(definition.inputSchema.kind.safeParse('visualizacao').success, true);
  assert.equal(definition.inputSchema.kind.safeParse('atividade').success, true);
  assert.equal(definition.inputSchema.kind.safeParse('grafico').success, false);
  assert.equal(definition.inputSchema.kind.safeParse(undefined).success, true, 'sem tipo = atividade (as antigas seguem valendo)');
  assert.equal(definition.inputSchema.charts.safeParse(true).success, true);
});

test('as instruções dizem o que a issue pede: prévia antes, quadro solto, tokens, offline e o texto que não repete', () => {
  for (const pattern of [
    /prévia/, /antes de escrever a resposta/, /não o anuncia/, /sem fundo, cartão, borda ou título de banner/,
    /largura fluida/, /altura fixa em px/, /100vh/, /16px de respiro/, /var\(--mesa-radius\)/,
    /--mesa-chart-1 … --mesa-chart-6/, /--color-background-primary/, /--mesa-font-serif/, /offline/, /Chart\.js 4/, /KaTeX/,
    /SVG ou canvas puro/, /imagem PNG gerada/, /Levar ao tutor/,
  ]) assert.match(ACTIVITY_TOOL_DESCRIPTION, pattern);
  assert.match(PREVIEW_TOOL_DESCRIPTION, /print PNG/);
  assert.match(PREVIEW_TOOL_DESCRIPTION, /contentHeight/);
  assert.match(PREVIEW_TOOL_DESCRIPTION, /log, info, warning, error e exceções/);
  assert.match(PREVIEW_TOOL_DESCRIPTION, /Nada é gravado/);
});

test('paridade: a extensão do Pi registra as duas ferramentas com o MESMO texto do Claude', async () => {
  const guide = await import('../src/extensions/mesa-activity/guide.mjs');
  assert.equal(ACTIVITY_TOOL_DESCRIPTION, guide.CREATE_DESCRIPTION);
  assert.equal(PREVIEW_TOOL_DESCRIPTION, guide.PREVIEW_DESCRIPTION);
  /* A extensão do Pi (TS) só lê do guia: nada de texto próprio que diverja. */
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'extensions', 'mesa-activity', 'index.ts'), 'utf8');
  assert.match(source, /name: 'mesa_previsualizar_atividade'[\s\S]*?description: PREVIEW_DESCRIPTION/);
  assert.match(source, /name: 'mesa_criar_atividade'[\s\S]*?description: CREATE_DESCRIPTION/);
  assert.match(source, /from '\.\/guide\.mjs'/);
  assert.equal(PREVIEW_TOOL_NAME, 'mcp__mesa__previsualizar_atividade');
});

test('prévia no Claude: devolve a imagem e o resumo do console; nada de publicação', async () => {
  const calls = [];
  const definition = await createPreviewTool(async (args) => {
    calls.push(args);
    return {previewed: true, width: 390, theme: 'escuro', contentHeight: 240, capturedHeight: 240,
      consoleMessages: [{level: 'log', text: 'ok'}, {level: 'error', text: 'TypeError: x (linha 3)'}],
      screenshot: {mimeType: 'image/png', data: 'iVBORw0KGgo=', width: 390, height: 240}};
  });
  assert.equal(definition.inputSchema.theme.safeParse('escuro').success, true);
  assert.equal(definition.inputSchema.theme.safeParse('dark').success, false);
  assert.equal(definition.inputSchema.width.safeParse(100).success, false);
  assert.equal(definition.inputSchema.title.safeParse(undefined).success, true, 'título opcional na prévia');
  const result = await definition.handler({html: '<p>x</p>', js: 'mesa.ready()', theme: 'escuro', width: 390}, {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].theme, 'escuro');
  assert.deepEqual(result.content[0], {type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png'});
  assert.match(result.content[1].text, /Prévia em 390px \(escuro\): o conteúdo pede 240px/);
  assert.match(result.content[1].text, /\[error\] TypeError: x \(linha 3\)/);
  assert.match(result.content[1].text, /Corrija os 1 erro/);
  const failing = await createPreviewTool(async () => { throw new Error('O documento não ficou pronto a tempo.'); });
  const failed = await failing.handler({html: '<p/>'}, {});
  assert.equal(failed.isError, true);
});

test('o servidor mesa inclui a prévia só junto da ferramenta de mostrar', async () => {
  const study = require('../src/agents/study-tools.cjs');
  const withPreview = await study.createStudyToolsServer({createActivity: async () => ({}), previewActivity: async () => ({})});
  const without = await study.createStudyToolsServer({previewActivity: async () => ({})});
  const names = (server) => [...(server.instance?._registeredTools ? Object.keys(server.instance._registeredTools) : [])];
  assert.deepEqual(names(withPreview).sort(), ['criar_atividade', 'previsualizar_atividade']);
  assert.deepEqual(names(without), []);
  assert.equal(withPreview.name, 'mesa');
});

/* ---------- #40: o esquema que o SDK anuncia é o do guia ---------- */

test('paridade: o esquema anunciado pelo Claude é o descrito no guia (o mesmo que o Pi monta)', async () => {
  const {Client} = await import('@modelcontextprotocol/sdk/client/index.js');
  const {InMemoryTransport} = await import('@modelcontextprotocol/sdk/inMemory.js');
  const guide = await import('../src/extensions/mesa-activity/guide.mjs');
  const fields = await import('../src/extensions/tool-fields.mjs');
  const {ACTIVITY_CALL_REF_FIELD} = require('../activity-bridge.cjs');
  assert.ok(ACTIVITY_CALL_REF_FIELD in guide.CREATE_FIELDS, 'o campo reservado do callRef está no esquema');
  const server = await createActivityServer(async () => ({}), async () => ({}));
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'mesa-activity-contract', version: '1.0.0'});
  await server.instance.connect(b);
  await client.connect(a);
  try {
    const {tools} = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    assert.deepEqual(fields.canonical(byName.criar_atividade.inputSchema), fields.canonicalFields(guide.CREATE_FIELDS));
    assert.deepEqual(fields.canonical(byName.previsualizar_atividade.inputSchema), fields.canonicalFields(guide.PREVIEW_FIELDS));
    assert.equal(byName.criar_atividade.description, guide.CREATE_DESCRIPTION);
    assert.equal(byName.previsualizar_atividade.description, guide.PREVIEW_DESCRIPTION);
  } finally {
    await client.close();
    await server.instance.close();
  }
  /* A extensão do Pi monta o esquema dos mesmos campos (a prova de ponta a
     ponta, com o SDK do Pi instalado, é `tests/native-tool-parity.mjs`). */
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'extensions', 'mesa-activity', 'index.ts'), 'utf8');
  assert.match(source, /parameters: typeboxObject\(Type, PREVIEW_FIELDS\)/);
  assert.match(source, /parameters: typeboxObject\(Type, CREATE_FIELDS\)/);
  assert.match(source, /publishedText\(result, params\.kind\)/);
});
