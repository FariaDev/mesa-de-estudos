import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {prepareLocal} from '../scripts/prepare-local.mjs';
import {makeSyntheticPdf} from '../host/testing.mjs';
import {resolvePopplerTools} from '../host/tools.mjs';

const DESK_URI = 'ui://mesa-study/desk-v1.html';
const DESK_MIME = 'text/html;profile=mcp-app';
const SEVEN_TOOLS = ['mesa_status', 'mesa_open', 'mesa_library', 'mesa_page', 'mesa_windows', 'mesa_capture', 'mesa_context'];

const tools = resolvePopplerTools();
const popplerReady = (await Promise.all([tools.pdfinfo, tools.pdftocairo].map(
  file => fs.access(file, fs.constants.X_OK).then(() => true, () => false),
))).every(Boolean);

// This starts the generated package through its actual launch configuration.
// It does not load a plugin in Codex or send an image to an inference provider.
test('pacote preparado: configuração gerada inicia MCP, renderiza e preserva o PDF', {
  skip: popplerReady ? false : 'Poppler indisponível', timeout: 60000,
}, async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa staging integração '));
  const pdfRoot = path.join(base, 'PDFs sintéticos ção');
  const dest = path.join(base, 'Pacote com espaços');
  const outside = path.join(base, 'fora.pdf');
  let client;
  try {
    await fs.mkdir(pdfRoot);
    const pdf = path.join(pdfRoot, 'Exercício sintético.pdf');
    const bytes = makeSyntheticPdf({texts: ['Synthetic exercise: 2 + 3 = ?', 'Page two']});
    await fs.writeFile(pdf, bytes);
    await fs.writeFile(outside, bytes);
    const report = await prepareLocal({dest, roots: [pdfRoot], node: process.execPath});
    assert.equal(report.ok, true, JSON.stringify(report.blocked));
    const catalog = JSON.parse(await fs.readFile(path.join(dest, '.agents/plugins/marketplace.json'), 'utf8'));
    const entry = catalog.plugins.find(plugin => plugin.name === 'mesa-study');
    assert.ok(entry, 'O catálogo deve oferecer o pacote configurado');
    const catalogSource = path.resolve(dest, entry.source.path);
    assert.equal(catalogSource, dest);
    const packedDeskHtml = await fs.readFile(path.join(catalogSource, 'ui', 'desk.html'), 'utf8');
    const manifest = JSON.parse(await fs.readFile(path.join(catalogSource, '.mcp.json'), 'utf8'));
    const launch = manifest.mcpServers.mesa;
    client = new Client({name: 'mesa-stage-integration', version: '0.0.0'});
    const transport = new StdioClientTransport({
      command: launch.command, args: launch.args, cwd: launch.cwd, stderr: 'pipe',
      env: {PATH: path.dirname(process.execPath)},
    });
    await client.connect(transport);

    // Catálogo: as sete ferramentas e só mesa_open ligada ao recurso MCP Apps.
    const listed = (await client.listTools()).tools;
    assert.deepEqual(listed.map(tool => tool.name), SEVEN_TOOLS);
    const openTool = listed.find(tool => tool.name === 'mesa_open');
    assert.equal(openTool._meta?.ui?.resourceUri, DESK_URI);
    assert.equal(openTool._meta?.['openai/outputTemplate'], DESK_URI);
    for (const tool of listed) {
      if (tool.name === 'mesa_open') continue;
      assert.equal(tool._meta, undefined, `${tool.name} não pode declarar template de UI`);
    }

    // Resource real do pacote: o HTML preparado, servido inline com MIME/meta.
    const resource = await client.readResource({uri: DESK_URI});
    assert.equal(resource.contents.length, 1);
    assert.equal(resource.contents[0].uri, DESK_URI);
    assert.equal(resource.contents[0].mimeType, DESK_MIME);
    assert.equal(resource.contents[0].text, packedDeskHtml);
    assert.equal(resource.contents[0]._meta?.ui?.prefersBorder, true);

    const status = (await client.callTool({name: 'mesa_status', arguments: {}})).structuredContent;
    assert.equal(status.ready.pdf, true);
    assert.equal(status.setup.roots.count, 1);

    // mesa_open sem filePath abre o painel sem ler PDF nenhum.
    const opened = await client.callTool({name: 'mesa_open', arguments: {}});
    assert.equal(opened.isError, undefined);
    assert.equal(opened.structuredContent.kind, 'desk');
    assert.equal(opened.structuredContent.status.kind, 'status');
    assert.equal(opened.structuredContent.page, null);
    const library = opened.structuredContent.library;
    assert.deepEqual(library.files.map(file => file.name), ['Exercício sintético.pdf']);
    assert.equal(library.truncated, false);
    assert.equal(opened.content.some(block => block.type === 'image'), false, 'abrir o painel não devolve imagem');

    // mesa_library pelo servidor empacotado enxerga só a raiz autorizada.
    const listedLibrary = await client.callTool({name: 'mesa_library', arguments: {}});
    assert.equal(listedLibrary.isError, undefined);
    assert.deepEqual(listedLibrary.structuredContent.files, library.files);

    // mesa_page continua data tool e renderiza a página real.
    const rendered = await client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 2}});
    assert.equal(rendered.isError, undefined);
    const image = rendered.content.find(block => block.type === 'image');
    assert.equal(image.mimeType, 'image/png');
    const imageBytes = Buffer.from(image.data, 'base64');
    assert.ok(imageBytes.length > 1000);
    assert.equal(
      rendered.structuredContent.image.bytes,
      imageBytes.length,
      'o bloco devolve o PNG completo',
    );
    assert.equal(rendered.structuredContent.source.page, 2);
    assert.equal(rendered.structuredContent.source.numPages, 2);

    // mesa_open com filePath usa o MESMO handler: mesma página, mesmos bytes.
    const openedPage = await client.callTool({name: 'mesa_open', arguments: {filePath: pdf, page: 2}});
    assert.equal(openedPage.isError, undefined);
    const openImage = openedPage.content.find(block => block.type === 'image');
    assert.equal(openImage.data, image.data, 'mesa_open renderiza exatamente a mesma página');
    assert.equal(openedPage.structuredContent.kind, 'desk');
    assert.equal(openedPage.structuredContent.page.image.sha256, rendered.structuredContent.image.sha256);

    assert.deepEqual(await fs.readFile(pdf), bytes);

    const escape = await client.callTool({name: 'mesa_open', arguments: {filePath: outside, page: 1}});
    assert.equal(escape.isError, true);
    assert.equal(JSON.parse(escape.content[0].text).error.code, 'PATH_OUTSIDE_ROOTS');
    assert.equal(escape.content.some(block => block.type === 'image'), false, 'erro não devolve imagem');

    const context = (await client.callTool({name: 'mesa_context', arguments: {}})).structuredContent;
    assert.equal(context.context.page.page, 2);
    const absent = await client.callTool({name: 'mesa_capture', arguments: {windowId: 123}});
    assert.equal(absent.isError, true);
    assert.equal(JSON.parse(absent.content[0].text).error.code, 'CAPTURE_HELPER_MISSING');
    assert.ok(absent.content.every(block => block.type !== 'image'));
  } finally {
    if (client) await client.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});
