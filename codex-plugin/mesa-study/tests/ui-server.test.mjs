/* Servidor MCP da Mesa: contrato do painel MCP Apps (mesa_open + resource
   ui://mesa-study/desk-v1.html) e fallback de um host SEM UI.

   O que estes testes SÃO:
   - protocolo MCP real com o SDK oficial sobre transporte in-memory;
   - PDF sintético e Poppler real quando instalado (os casos de render são
     pulados com motivo explícito quando ele falta);
   - o cliente desta sessão NÃO anuncia a extensão `io.modelcontextprotocol/ui`:
     `tools/list` e o resultado de mesa_open são exatamente o que um host sem
     MCP Apps recebe (imagem + metadados no content, nunca "só UI").

   O que estes testes NÃO SÃO:
   - não abrem o app Codex, não carregam o plugin, não usam modelo/rede e não
     capturam tela;
   - a ponte postMessage do iframe (ui/initialize, tools/call, ui/message) é
     testada em tests/ui-client.test.mjs com um host SIMULADO; a exibição do
     painel dentro do Codex real continua pendente de teste manual. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {makeSyntheticPdf} from '../host/testing.mjs';
import {PNG_MAGIC} from '../host/config.mjs';
import {resolvePopplerTools} from '../host/tools.mjs';
import {parseStartupConfig} from '../server/config.mjs';
import {createMcpServer} from '../server/server.mjs';
import {
  DESK_RESOURCE_MIME,
  DESK_RESOURCE_URI,
  MAX_DESK_HTML_BYTES,
  readDeskHtml,
} from '../server/ui.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESK_FILE = path.join(ROOT, 'ui', 'desk.html');
const TOOLS = resolvePopplerTools();
const popplerReady = (await Promise.all(
  [TOOLS.pdfinfo, TOOLS.pdftocairo].map(
    (tool) => fs.access(tool, fs.constants.X_OK).then(() => true, () => false),
  ),
)).every(Boolean);
const pdfSkip = popplerReady ? false : 'Poppler (pdfinfo/pdftocairo) não está disponível nesta máquina';

const SEVEN_TOOLS = ['mesa_status', 'mesa_open', 'mesa_library', 'mesa_page', 'mesa_windows', 'mesa_capture', 'mesa_context'];

async function tempBase(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function connectInProcess({config, deps = {}}) {
  const {server} = createMcpServer({config, deps});
  const client = new Client({name: 'mesa-ui-server-test', version: '0.0.0'});
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return {
    client,
    async close() {
      try {
        await client.close();
        await server.close();
      } catch {
        // sessão já encerrada
      }
    },
  };
}

function textOf(result) {
  const block = (result.content || []).find((item) => item.type === 'text');
  return block ? block.text : '';
}

function payloadOf(result) {
  try {
    return JSON.parse(textOf(result));
  } catch {
    return null;
  }
}

function imageOf(result) {
  return (result.content || []).find((item) => item.type === 'image');
}

/* ---------- catálogo de ferramentas e metadados de UI ---------- */

test('tools/list: sete ferramentas e só mesa_open declara o recurso MCP Apps', async () => {
  const {config} = parseStartupConfig({argv: []});
  const session = await connectInProcess({config});
  try {
    const {tools} = await session.client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), SEVEN_TOOLS);

    const open = tools.find((tool) => tool.name === 'mesa_open');
    assert.equal(open._meta?.ui?.resourceUri, DESK_RESOURCE_URI, 'render tool precisa do recurso padrão');
    assert.deepEqual(open._meta?.ui?.visibility, ['model', 'app']);
    assert.equal(open._meta?.['openai/outputTemplate'], DESK_RESOURCE_URI, 'alias de compatibilidade documentado');

    for (const tool of tools) {
      if (tool.name === 'mesa_open') continue;
      assert.equal(tool._meta, undefined, `${tool.name} é data tool e não pode declarar template de UI`);
    }

    const schema = open.inputSchema;
    assert.deepEqual(Object.keys(schema.properties || {}).sort(), ['filePath', 'page']);
    assert.deepEqual(schema.required || [], [], 'filePath/page são opcionais em mesa_open');
    assert.match(open.description, /painel/i);
    assert.match(open.description, /ÚNICO render tool|único render tool/i);
    assert.match(open.description, /não captura a tela|sem captura/i);

    // Anotações honestas das ferramentas novas.
    assert.equal(tools.find((tool) => tool.name === 'mesa_library').annotations?.readOnlyHint, true);
    assert.equal(tools.find((tool) => tool.name === 'mesa_open').annotations?.readOnlyHint, false);
    assert.equal(tools.find((tool) => tool.name === 'mesa_page').annotations?.readOnlyHint, false);
  } finally {
    await session.close();
  }
});

test('resources/read: HTML versionado com MIME, _meta/CSP do contrato e sem rede', async () => {
  const {config} = parseStartupConfig({argv: []});
  const session = await connectInProcess({config});
  try {
    const read = await session.client.readResource({uri: DESK_RESOURCE_URI});
    assert.equal(read.contents.length, 1);
    const content = read.contents[0];
    assert.equal(content.uri, DESK_RESOURCE_URI);
    assert.equal(content.mimeType, DESK_RESOURCE_MIME);
    assert.equal(content.mimeType, 'text/html;profile=mcp-app');

    const onDisk = await fs.readFile(DESK_FILE, 'utf8');
    assert.equal(content.text, onDisk, 'o read serve o ui/desk.html real, inline');
    assert.ok(content.text.length > 1000, 'HTML do painel não pode vir vazio');

    assert.equal(content._meta?.ui?.prefersBorder, true);
    assert.deepEqual(content._meta?.ui?.csp?.connectDomains, [], 'painel não conecta a nenhum domínio');
    assert.deepEqual(content._meta?.ui?.csp?.resourceDomains, [], 'painel não carrega recursos externos');

    assert.match(content.text, /^<!doctype html>/i);
    assert.match(content.text, /<script data-mesa-desk>/);
    for (const forbidden of [/https?:\/\//, /<iframe\b/i, /\bfetch\s*\(/, /\bimport\s*\(/, /\brequire\s*\(/]) {
      assert.doesNotMatch(content.text, forbidden, `HTML não pode depender de ${forbidden}`);
    }
  } finally {
    await session.close();
  }
});

test('HTML ausente/inválido não derruba as ferramentas e o read falha com erro claro', async () => {
  const base = await tempBase('mesa-ui-html-');
  const {config} = parseStartupConfig({argv: []});
  try {
    const missing = path.join(base, 'nao-existe.html');
    const session = await connectInProcess({config, deps: {uiFile: missing}});
    try {
      // As ferramentas seguem de pé, inclusive o render tool sem filePath.
      const {tools} = await session.client.listTools();
      assert.deepEqual(tools.map((tool) => tool.name), SEVEN_TOOLS);
      const status = await session.client.callTool({name: 'mesa_status', arguments: {}});
      assert.equal(status.isError, undefined);
      assert.equal(payloadOf(status).ok, true);
      const open = await session.client.callTool({name: 'mesa_open', arguments: {}});
      assert.equal(open.isError, undefined);
      assert.equal(open.structuredContent.kind, 'desk');
      assert.equal(open.structuredContent.page, null);

      await assert.rejects(
        session.client.readResource({uri: DESK_RESOURCE_URI}),
        (error) => {
          assert.match(String(error?.message || ''), /ui\/desk\.html|não está disponível|UI_RESOURCE_MISSING/i);
          return true;
        },
        'read sem o arquivo precisa falhar, não servir HTML vazio',
      );

      // A sessão continua utilizável depois do read falho.
      const after = await session.client.callTool({name: 'mesa_status', arguments: {}});
      assert.equal(after.isError, undefined);
    } finally {
      await session.close();
    }

    // Erros de conteúdo também são explícitos e estáveis (unidade da leitura).
    const empty = path.join(base, 'vazio.html');
    await fs.writeFile(empty, '   \n');
    await assert.rejects(readDeskHtml({uiFile: empty}), (error) => error.code === 'UI_RESOURCE_INVALID');

    const notDesk = path.join(base, 'outro.html');
    await fs.writeFile(notDesk, '<!doctype html><title>outra página</title>');
    await assert.rejects(readDeskHtml({uiFile: notDesk}), (error) => error.code === 'UI_RESOURCE_INVALID');

    const big = path.join(base, 'grande.html');
    await fs.writeFile(big, `<!doctype html><script data-mesa-desk></script>${'x'.repeat(MAX_DESK_HTML_BYTES)}`);
    await assert.rejects(readDeskHtml({uiFile: big}), (error) => error.code === 'UI_RESOURCE_TOO_LARGE');

    await assert.rejects(readDeskHtml({uiFile: path.join(base, 'sumiu.html')}), (error) => error.code === 'UI_RESOURCE_MISSING');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* ---------- mesa_open sem PDF ---------- */

test('mesa_open sem filePath: status + biblioteca, nenhuma página e nenhum PDF lido', async () => {
  const base = await tempBase('mesa-ui-open-');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  const pdf = path.join(root, 'sintetico.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 2}));
  await fs.writeFile(path.join(root, 'notas.txt'), 'não é PDF');
  await fs.writeFile(path.join(root, '.oculto.pdf'), makeSyntheticPdf({pages: 1}));

  const {config} = parseStartupConfig({argv: ['--root', root, '--cache-dir', cache]});
  const session = await connectInProcess({config});
  try {
    const result = await session.client.callTool({name: 'mesa_open', arguments: {}});
    assert.equal(result.isError, undefined);
    const meta = payloadOf(result);
    assert.equal(meta.ok, true);
    assert.equal(meta.kind, 'desk');
    assert.equal(meta.status.kind, 'status');
    assert.equal(meta.page, null, 'sem filePath não há página');
    const expectedPath = path.join(await fs.realpath(root), 'sintetico.pdf');
    assert.deepEqual(meta.library, {
      files: [{filePath: expectedPath, name: 'sintetico.pdf'}],
      truncated: false,
    });
    assert.equal(imageOf(result), undefined, 'abrir o painel não devolve imagem');
    assert.equal(JSON.parse(textOf(result)).kind, 'desk', 'o bloco text repete o structuredContent');
    assert.equal(result.structuredContent.kind, 'desk');

    // O cache do host não é criado por abrir o painel sem PDF.
    await assert.rejects(fs.stat(cache), (error) => error.code === 'ENOENT');

    const pageOnly = await session.client.callTool({name: 'mesa_open', arguments: {page: 1}});
    assert.equal(pageOnly.isError, true);
    assert.equal(payloadOf(pageOnly).error.code, 'OPEN_INVALID');
    assert.equal(imageOf(pageOnly), undefined);
    assert.equal('structuredContent' in pageOnly, false);

    // Campos extras não ampliam raízes/cache nem viram argumentos da página.
    const extra = await session.client.callTool({
      name: 'mesa_open',
      arguments: {roots: [path.dirname(pdf)], cacheDir: base, helperPath: '/bin/false', page: 99},
    });
    assert.equal(extra.isError, true, 'page sem filePath continua recusado mesmo com campos extras');
    assert.equal(payloadOf(extra).error.code, 'OPEN_INVALID');
    const extraQuiet = await session.client.callTool({name: 'mesa_open', arguments: {roots: [base], confirm: true}});
    assert.equal(extraQuiet.isError, undefined);
    assert.deepEqual(extraQuiet.structuredContent.library, meta.library, 'raízes do pedido são descartadas');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* ---------- mesa_open com PDF (Poppler real) ---------- */

test('mesa_open com filePath: PNG real completo, página e contexto iguais aos de mesa_page', {skip: pdfSkip, timeout: 60000}, async () => {
  const base = await tempBase('mesa-ui-open-pdf-');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  const pdf = path.join(root, 'exercicio sintético.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 2, texts: ['Página um: 2 + 3 = ?', 'Página dois']}));

  const {config} = parseStartupConfig({argv: ['--root', root, '--cache-dir', cache]});
  const session = await connectInProcess({config});
  try {
    const result = await session.client.callTool({name: 'mesa_open', arguments: {filePath: pdf, page: 2}});
    assert.equal(result.isError, undefined, textOf(result));

    const meta = payloadOf(result);
    assert.equal(meta.kind, 'desk');
    assert.equal(meta.page.kind, 'page');
    assert.equal(meta.page.source.page, 2);
    assert.equal(meta.page.source.numPages, 2);
    assert.equal(meta.page.source.document.name, 'exercicio sintético.pdf');
    assert.equal(meta.status.kind, 'status');
    assert.equal(meta.library.truncated, false);

    const image = imageOf(result);
    assert.ok(image, 'mesa_open com filePath precisa devolver o bloco image/png');
    assert.equal(image.mimeType, 'image/png');
    const bytes = Buffer.from(image.data, 'base64');
    assert.ok(bytes.length > 1000);
    assert.ok(bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC), 'bytes precisam ser PNG de verdade');
    assert.equal(bytes.length, meta.page.image.bytes, 'o bloco devolve o arquivo COMPLETO');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.page.image.sha256);
    assert.ok(Number.isInteger(meta.page.image.width) && meta.page.image.width > 0);
    assert.ok(Number.isInteger(meta.page.image.height) && meta.page.image.height > 0);
    assert.equal(meta.page.image.bytes <= config.maxImageBytes, true);
    assert.deepEqual(result.structuredContent, meta, 'structuredContent sem bytes de imagem');
    assert.equal(JSON.stringify(result.structuredContent).includes('data:image'), false);

    // O contexto é o MESMO handler/store de mesa_page.
    const context = await session.client.callTool({name: 'mesa_context', arguments: {}});
    assert.equal(context.structuredContent.context.page.page, 2);
    assert.equal(context.structuredContent.context.page.document.path, meta.page.source.document.path);

    // O PDF original permanece byte a byte.
    assert.equal(meta.page.source.document.path, await fs.realpath(pdf));
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* ---------- falha de render ---------- */

test('mesa_open: falha nunca devolve imagem antiga e não substitui o contexto', {skip: pdfSkip, timeout: 60000}, async () => {
  const base = await tempBase('mesa-ui-open-fail-');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  const outside = path.join(base, 'fora.pdf');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  const pdf = path.join(root, 'sintetico.pdf');
  const pdfBytes = makeSyntheticPdf({pages: 1});
  await fs.writeFile(pdf, pdfBytes);
  await fs.writeFile(outside, pdfBytes);
  const notPdf = path.join(root, 'notas.txt');
  await fs.writeFile(notPdf, 'não é PDF');

  const {config} = parseStartupConfig({argv: ['--root', root, '--cache-dir', cache]});
  const session = await connectInProcess({config});
  try {
    const good = await session.client.callTool({name: 'mesa_open', arguments: {filePath: pdf, page: 1}});
    assert.equal(good.isError, undefined);
    const goodSnapshot = payloadOf(good).page.image.snapshotPath;

    for (const [args, code] of [
      [{filePath: outside, page: 1}, 'PATH_OUTSIDE_ROOTS'],
      [{filePath: notPdf, page: 1}, 'NOT_PDF_EXTENSION'],
      [{filePath: path.join(root, 'nao-existe.pdf'), page: 1}, 'PATH_NOT_FOUND'],
    ]) {
      const failed = await session.client.callTool({name: 'mesa_open', arguments: args});
      assert.equal(failed.isError, true, `esperava erro para ${code}`);
      assert.equal(payloadOf(failed).error.code, code);
      assert.equal(imageOf(failed), undefined, `${code}: nenhum PNG (nem o anterior) no erro`);
      assert.equal('structuredContent' in failed, false, `${code}: erro não tem structuredContent`);
      assert.equal(textOf(failed).includes(goodSnapshot), false, `${code}: erro não reaproveita metadados antigos`);
    }

    const context = await session.client.callTool({name: 'mesa_context', arguments: {}});
    assert.equal(context.structuredContent.context.page.page, 1);
    assert.equal(context.structuredContent.context.page.snapshotPath, goodSnapshot, 'o contexto mantém a última renderização bem-sucedida');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('mesa_open: PNG acima do teto falha sem truncar e sem devolver imagem', {skip: pdfSkip, timeout: 60000}, async () => {
  const base = await tempBase('mesa-ui-open-large-');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  const pdf = path.join(root, 'pagina.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 1}));

  const {config} = parseStartupConfig({argv: ['--root', root, '--cache-dir', cache, '--max-image-bytes', '4096']});
  assert.equal(config.maxImageBytes, 4096);
  const session = await connectInProcess({config});
  try {
    const result = await session.client.callTool({name: 'mesa_open', arguments: {filePath: pdf, page: 1}});
    assert.equal(result.isError, true);
    const payload = payloadOf(result);
    assert.equal(payload.error.code, 'IMAGE_TOO_LARGE');
    assert.equal(imageOf(result), undefined);
    assert.ok(payload.error.detail.bytes > 4096, 'detalhe diz o tamanho real do PNG');
    assert.equal(payload.error.detail.limit, 4096);

    // Nada foi truncado: o arquivo completo continua no cache privado.
    const cached = await fs.readFile(payload.error.detail.path);
    assert.equal(cached.length, payload.error.detail.bytes);
    assert.ok(cached.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});
