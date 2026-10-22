import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {figureMarkdown, blankLineWarning, removedNames} from '../src/figures/figure-markup.mjs';
import {CHAT_FIGURE_OFFER, FIGURE_CHOICE, FIGURE_DESCRIPTION, FIGURE_FIELDS, MAX_SVG_CHARS, PDF_FIGURE_GUIDE, PLOT_EXAMPLE, PLOT_FORMAT, figureText} from '../src/extensions/mesa-figure/guide.mjs';
import {parsePlot, KEY_NAMES} from '../src/figures/plot-spec.mjs';
import {viewFigure} from '../src/extensions/mesa-figure/client.mjs';
import {figureTool, mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';
import {canonical, canonicalFields} from '../src/extensions/tool-fields.mjs';
import {PLOT_PARABOLA as PARABOLA_BODY, TRIANGLE_SVG as TRIANGLE_BODY} from './figures-fixtures.mjs';
const require = createRequire(import.meta.url);
const {createActivityBridge} = require('../activity-bridge.cjs');
const {createFigurePreview, cleanRequest, cleanWidth, allowedFile} = require('../figure-preview.cjs');
const {createFigureTool, FIGURE_TOOL_NAME} = require('../src/agents/figure-tool.cjs');

const SHOT = {mimeType: 'image/png', data: 'iVBOR', width: 560, height: 300};
const REPORT = {width: 560, theme: 'claro', contentHeight: 300, plots: 1, svgs: 0, warnings: [], removed: [], screenshot: SHOT};

/* Janela falsa e nomeada: o Electron real fica para `figures-sanitize.test.mjs`. */
function createFakeFigureWindow({report = {plots: 1, svgs: 0, warnings: [], removed: [], contentHeight: 300}} = {}) {
  const win = {
    destroyed: false, loaded: [], scripts: [], sizes: [],
    loadFile: async (file) => { win.loaded.push(file); },
    isDestroyed: () => win.destroyed,
    destroy: () => { win.destroyed = true; },
    setContentSize: (width, height) => win.sizes.push([width, height]),
    webContents: {
      executeJavaScript: async (code) => { win.scripts.push(code); return report; },
      capturePage: async ({width, height}) => ({getSize: () => ({width, height}), resize: () => { throw Error('não escala'); }, toPNG: () => Buffer.from('png')}),
    },
  };
  return win;
}

test('figureMarkdown: plot vira cerca de quatro crases e svg segue solto; outro tipo diz o que veio', () => {
  assert.equal(figureMarkdown('plot', 'funcao: x^2'), '````plot\nfuncao: x^2\n````');
  assert.equal(figureMarkdown('svg', '<svg></svg>'), '<svg></svg>');
  assert.throws(() => figureMarkdown('png', 'x'), /recebido "png"; esperado "plot" ou "svg"/);
});

test('blankLineWarning: linha em branco dentro do SVG corta o bloco; SVG inteiro não avisa', () => {
  assert.equal(blankLineWarning(TRIANGLE_BODY), '');
  assert.match(blankLineWarning('<svg viewBox="0 0 1 1">\n\n</svg>'), /linha 2.*cortam o bloco/);
});

test('removedNames: diz o que sumiu, sem repetir, e atributos em linguagem de leitura', () => {
  assert.deepEqual(removedNames(['<svg>', '<script>', '<script>', '@onclick', '<g>'], ['<svg>', '<g>']), ['<script>', 'atributo onclick']);
  assert.deepEqual(removedNames(['<a>', '<a>'], ['<a>']), ['<a>']);
  assert.deepEqual(removedNames(['<svg>'], ['<svg>']), []);
});

test('guia: a escolha diz quando usar plot, SVG e GeoGebra, o tamanho e as cores do tema', () => {
  assert.match(FIGURE_CHOICE, /cerca `plot`/);
  assert.match(FIGURE_CHOICE, new RegExp(`até ${MAX_SVG_CHARS} caracteres`));
  assert.match(FIGURE_CHOICE, /GeoGebra/);
  assert.match(FIGURE_CHOICE, /var\(--plot-1\)/);
  assert.match(FIGURE_CHOICE, /sem linha em branco/);
  assert.ok(FIGURE_DESCRIPTION.includes(FIGURE_CHOICE), 'a descrição da ferramenta leva a mesma escolha');
  assert.equal(FIGURE_FIELDS.source.max, MAX_SVG_CHARS);
});

test('guia do chat e do PDF: dizem quando usar plot, SVG ou GeoGebra, o tamanho e as cores do tema', async () => {
  assert.match(CHAT_FIGURE_OFFER, /cerca `plot`.*SVG simples.*GeoGebra.*ver_figura/);
  for (const pattern of [/cerca `plot`/, new RegExp(`até ${MAX_SVG_CHARS} caracteres`), /viewBox/, /sem linha em branco/, /420 px/, /currentColor/, /var\(--plot-1\)/, /GeoGebra e quadros não saem no PDF/, /relatório do PDF/]) {
    assert.match(PDF_FIGURE_GUIDE, pattern);
  }
  const {TOOL_DESCRIPTION} = await import('../src/extensions/tutor-pdf/guide.mjs');
  assert.ok(TOOL_DESCRIPTION.endsWith(PDF_FIGURE_GUIDE), 'o guia do PDF é parte da descrição de criar_pdf');
});

test('formato da cerca no guia: o exemplo é lido pelo parser e toda chave do parser está descrita', () => {
  const spec = parsePlot(PLOT_EXAMPLE);
  assert.deepEqual([spec.functions.length, spec.points.length, spec.lines.length, spec.title], [2, 1, 1, 'Custo de produção']);
  for (const key of KEY_NAMES) assert.ok(PLOT_FORMAT.includes(key), `o guia não cita a chave ${key}`);
  assert.ok(FIGURE_DESCRIPTION.endsWith(PLOT_FORMAT));
  for (const word of ['sqrt', 'sin', 'ln', 'rotulo=', 'cor=1..6', 'tracejado']) assert.ok(PLOT_FORMAT.includes(word), word);
});

test('figureText: tamanho, avisos, o que o sanitizador removeu e o veredito', () => {
  assert.equal(figureText({...REPORT}).split('\n').at(-1), 'Sem avisos.');
  const bad = figureText({...REPORT, plots: 0, warnings: ['Linha 1 · veio x: abc'], removed: ['<script>']});
  assert.match(bad, /Aviso: Linha 1 · veio x: abc/);
  assert.match(bad, /O sanitizador removeu: <script>\./);
  assert.match(bad, /Corrija antes de mandar\.$/);
  assert.match(figureText({...REPORT, plots: 0, svgs: 0}), /Nada foi desenhado\./);
});

test('host: pede kind e source e diz o que veio; a largura é limitada', () => {
  assert.throws(() => cleanRequest({kind: 'png', source: 'x'}), /recebido "png"; esperado "plot" ou "svg"/);
  assert.throws(() => cleanRequest({kind: 'svg', source: '  '}), /esperado texto de 1 a 8000 caracteres/);
  assert.throws(() => cleanRequest({kind: 'svg', source: 'x'.repeat(8001)}), /8001 caracteres/);
  assert.deepEqual(cleanRequest({kind: 'plot', source: PARABOLA_BODY, theme: 'dark', width: 99999}), {kind: 'plot', source: PARABOLA_BODY, theme: 'escuro', width: 1600});
  assert.equal(cleanWidth(undefined), 560);
  assert.equal(cleanWidth(10), 240);
});

test('host: a sessão da janela só abre arquivos do app', () => {
  const desk = path.resolve(import.meta.dirname, '..');
  assert.equal(allowedFile(path.join(desk, 'src', 'figures', 'figure.html')), true);
  assert.equal(allowedFile(path.join(desk, 'style.css')), true);
  assert.equal(allowedFile(path.join(desk, 'node_modules', 'marked', 'lib', 'marked.esm.js')), true);
  assert.equal(allowedFile(path.join(desk, 'locales', 'pt-BR.json')), true);
  assert.equal(allowedFile(path.join(desk, 'config.cjs')), false);
  assert.equal(allowedFile('/etc/passwd'), false);
});

test('host: abre a página da figura, manda o pedido, captura e fecha a janela', async () => {
  const windows = [];
  const {preview} = createFigurePreview({createWindow: () => { const win = createFakeFigureWindow(); windows.push(win); return win; }});
  const result = await preview({kind: 'plot', source: PARABOLA_BODY, theme: 'escuro', width: 400});
  assert.match(windows[0].loaded[0], /src[\\/]figures[\\/]figure\.html$/);
  assert.match(windows[0].scripts[0], /^window\.mesaFigure\.render\(.*"kind":"plot".*"theme":"escuro".*"width":400/);
  assert.deepEqual(windows[0].sizes, [[400, 300]]);
  assert.equal(windows[0].destroyed, true);
  assert.deepEqual({width: result.width, theme: result.theme, plots: result.plots, contentHeight: result.contentHeight}, {width: 400, theme: 'escuro', plots: 1, contentHeight: 300});
  assert.equal(result.screenshot.mimeType, 'image/png');
  assert.equal(Buffer.from(result.screenshot.data, 'base64').toString(), 'png');
});

test('host: pedido inválido falha sem abrir janela, e uma falha não trava a fila', async () => {
  const windows = [];
  const {preview} = createFigurePreview({createWindow: () => { const win = createFakeFigureWindow(); windows.push(win); return win; }});
  await assert.rejects(preview({kind: 'x', source: 'y'}), /esperado "plot" ou "svg"/);
  assert.equal(windows.length, 0);
  assert.equal((await preview({kind: 'svg', source: TRIANGLE_BODY})).plots, 1);
});

test('ferramenta do Claude: devolve o print e o resumo; erro vira isError no idioma do tutor', async () => {
  const seen = [];
  const tool = await createFigureTool(async (args) => { seen.push(args); return REPORT; });
  const ok = await tool.handler({kind: 'plot', source: PARABOLA_BODY}, {});
  assert.deepEqual(ok.content[0], {type: 'image', data: 'iVBOR', mimeType: 'image/png'});
  assert.match(ok.content[1].text, /^Figura em 560px \(claro\)/);
  assert.deepEqual(seen, [{kind: 'plot', source: PARABOLA_BODY}]);
  const failing = await createFigureTool(async () => { throw new Error(''); }, {language: 'en'});
  const failed = await failing.handler({kind: 'svg', source: TRIANGLE_BODY}, {});
  assert.equal(failed.isError, true);
  assert.match(failed.content[0].text, /Could not draw the figure/);
  assert.equal(FIGURE_TOOL_NAME, 'mcp__mesa__ver_figura');
});

test('o servidor mesa leva ver_figura com o esquema e a descrição do guia', async () => {
  const {Client} = await import('@modelcontextprotocol/sdk/client/index.js');
  const {InMemoryTransport} = await import('@modelcontextprotocol/sdk/inMemory.js');
  const server = await require('../src/agents/study-tools.cjs').createStudyToolsServer({viewFigure: async () => REPORT});
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'mesa-figure-contract', version: '1.0.0'});
  await server.instance.connect(b);
  await client.connect(a);
  try {
    const {tools} = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), ['ver_figura']);
    assert.deepEqual(canonical(tools[0].inputSchema), canonicalFields(FIGURE_FIELDS));
    assert.equal(tools[0].description, FIGURE_DESCRIPTION);
  } finally {
    await client.close();
    await server.instance.close();
  }
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'extensions', 'mesa-figure', 'index.ts'), 'utf8');
  assert.match(source, /name: 'mesa_ver_figura'[\s\S]*?description: FIGURE_DESCRIPTION/);
  assert.match(source, /parameters: typeboxObject\(Type, FIGURE_FIELDS\)/);
  assert.match(source, /figureText\(result\)/);
});

test('OpenCode: a ferramenta ver_figura usa o mesmo esquema, e só existe com a ponte', async () => {
  const calls = [];
  const tool = figureTool({grant: {url: 'http://127.0.0.1:1/activity', token: 't'}, view: async (grant, args) => { calls.push({grant, args}); return REPORT; }});
  assert.equal(tool.name, 'ver_figura');
  assert.equal(tool.description, FIGURE_DESCRIPTION);
  assert.deepEqual(canonical(tool.inputSchema), canonicalFields(FIGURE_FIELDS));
  const result = await tool.call({kind: 'plot', source: PARABOLA_BODY});
  assert.equal(result.content[0].type, 'image');
  assert.equal(calls[0].args.kind, 'plot');
  const grant = JSON.stringify({url: 'http://127.0.0.1:1/activity', token: 't'});
  assert.ok(mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: grant}).some((entry) => entry.name === 'ver_figura'));
  assert.ok(!mesaTools({}).some((entry) => entry.name === 'ver_figura'));
});

test('ponte: /figure leva o pedido ao host e devolve o print; sem o host a rota não existe', async () => {
  const received = [];
  const bridge = createActivityBridge({publish: async () => ({}), figure: async (raw) => { received.push(raw); return REPORT; }});
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'c', generation: 1, engine: 'pi'});
    const result = await viewFigure(grant, {kind: 'plot', source: PARABOLA_BODY, theme: 'escuro', width: 480});
    assert.equal(result.viewed, true);
    assert.equal(result.screenshot.data, 'iVBOR');
    assert.deepEqual(received, [{kind: 'plot', source: PARABOLA_BODY, theme: 'escuro', width: 480}]);
    const forged = await fetch(grant.url.replace(/\/activity$/, '/figure'), {method: 'POST', headers: {'content-type': 'application/json', 'x-mesa-token': 'outro'}, body: '{}'});
    assert.equal(forged.status, 403);
  } finally {
    await bridge.close();
  }
  const plain = createActivityBridge({publish: async () => ({})});
  await plain.start();
  try {
    const grant = plain.grant({conversationId: 'c', generation: 1, engine: 'pi'});
    await assert.rejects(viewFigure(grant, {kind: 'plot', source: PARABOLA_BODY}), /Ver a figura|não está|indispon|unavailable|rota/i);
  } finally {
    await plain.close();
  }
});

test('cliente: sem a concessão da ponte a mensagem diz onde a ferramenta existe', async () => {
  await assert.rejects(viewFigure(null, {kind: 'svg', source: 'x'}), /sessão principal da Mesa/);
  await assert.rejects(viewFigure({url: 'http://example.com/activity', token: 't'}, {kind: 'svg', source: 'x'}), /sessão principal da Mesa/);
});
