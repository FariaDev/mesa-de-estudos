/* Protocolo MCP REAL sobre stdio (processo filho de verdade, SDK oficial):
   initialize → listTools → callTool; schema inválido; escape de caminho;
   pedido extra não amplia raízes/cache/executáveis; setup sem roots; contexto.
   PDFs sintéticos; Poppler real só quando disponível (senão os casos de página
   são pulados com mensagem explícita). Nada de material de curso, rede,
   inferência ou captura real. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {PNG_MAGIC} from '../host/config.mjs';
import {resolvePopplerTools} from '../host/tools.mjs';
import {makeSyntheticPdf} from '../host/testing.mjs';
import {SERVER_VERSION} from '../server/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'server', 'main.mjs');
const TOOLS = resolvePopplerTools();
const popplerReady = (await Promise.all(
  [TOOLS.pdfinfo, TOOLS.pdftocairo].map((tool) => fs.access(tool, fs.constants.X_OK).then(() => true, () => false)),
)).every(Boolean);
const pdfSkip = popplerReady ? false : 'Poppler (pdfinfo/pdftocairo) não está disponível nesta máquina';

async function tempDirs(prefix) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  return {base, root, cache};
}

async function connectServer({args = [], env = {}} = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER, ...args],
    env: {...env},
    stderr: 'pipe',
    cwd: ROOT,
  });
  const stderrChunks = [];
  const client = new Client({name: 'mesa-mcp-test', version: '0.0.0'});
  await client.connect(transport);
  transport.stderr?.on('data', (chunk) => stderrChunks.push(chunk.toString('utf8')));
  return {
    client,
    transport,
    stderrText: () => stderrChunks.join(''),
    async close() {
      try {
        await client.close();
      } catch {
        // processo já encerrado
      }
    },
  };
}

function textOf(result) {
  const block = (result.content || []).find((item) => item.type === 'text');
  return block ? block.text : '';
}

function payloadOf(result) {
  const text = textOf(result);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function call(client, name, args = {}) {
  return client.callTool({name, arguments: args});
}

test('stdio: initialize/listTools com nomes e anotações honestas', async () => {
  const session = await connectServer();
  try {
    const version = session.client.getServerVersion();
    assert.equal(version.name, 'mesa-study');
    assert.equal(version.version, SERVER_VERSION);
    assert.ok(session.client.getServerCapabilities()?.tools, 'capability tools precisa existir');

    const {tools} = await session.client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    assert.deepEqual([...byName.keys()].sort(), ['mesa_capture', 'mesa_context', 'mesa_library', 'mesa_open', 'mesa_page', 'mesa_status', 'mesa_windows']);

    assert.equal(byName.get('mesa_status').annotations?.readOnlyHint, true);
    assert.equal(byName.get('mesa_windows').annotations?.readOnlyHint, true);
    assert.equal(byName.get('mesa_page').annotations?.readOnlyHint, false, 'mesa_page escreve cache/estado');
    assert.equal(byName.get('mesa_capture').annotations?.readOnlyHint, false, 'mesa_capture escreve cache/estado');
    assert.equal(byName.get('mesa_context').annotations?.readOnlyHint, false, 'mesa_context pode mutar estado');

    const captureDescription = byName.get('mesa_capture').description;
    assert.match(captureDescription, /nunca a tela inteira/);
    assert.match(captureDescription, /proveniência/);
    assert.match(captureDescription, /não verifica consentimento/);
    assert.match(captureDescription, /não existe parâmetro booleano de confirmação/);
  } finally {
    await session.close();
  }
});

test('stdio: sem roots, status mostra setup e mesa_page é recusada', async () => {
  const session = await connectServer();
  try {
    const status = await call(session.client, 'mesa_status');
    assert.equal(status.isError, undefined);
    const meta = payloadOf(status);
    assert.equal(meta.ok, true);
    assert.equal(meta.kind, 'status');
    assert.equal(meta.setup.frozenAtStartup, true);
    assert.equal(meta.setup.roots.configured, false);
    assert.equal(meta.setup.roots.available, false);
    assert.equal(meta.setup.cacheDir.configured, false);
    assert.equal(meta.setup.cacheDir.available, false);
    assert.equal(meta.setup.cacheDir.state, null);
    assert.equal(meta.setup.xournalHelper.configured, false);
    assert.equal(meta.setup.xournalHelper.available, false);
    assert.equal(meta.ready.pdf, false);
    assert.equal(meta.ready.windows, false);
    assert.equal(meta.ready.capture, false);
    assert.ok(Array.isArray(meta.guidance) && meta.guidance.some((line) => line.includes('--root')));
    assert.deepEqual(status.structuredContent, meta);

    const page = await call(session.client, 'mesa_page', {filePath: '/etc/hosts', page: 1});
    assert.equal(page.isError, true);
    const error = payloadOf(page);
    assert.equal(error.ok, false);
    assert.equal(error.error.code, 'ROOTS_NOT_CONFIGURED');

    const windows = await call(session.client, 'mesa_windows');
    assert.equal(windows.isError, true);
    assert.equal(payloadOf(windows).error.code, 'CAPTURE_HELPER_MISSING');
    assert.match(payloadOf(windows).error.message, /--xournal-helper|MESA_XOURNAL_HELPER/);

    // A sessão continua utilizável depois dos erros.
    const again = await call(session.client, 'mesa_status');
    assert.equal(payloadOf(again).ok, true);
  } finally {
    await session.close();
  }
});

test('stdio: configuração congelada aparece no status (raiz real e cache)', async () => {
  const {base, root, cache} = await tempDirs('mesa-mcp-status-');
  const session = await connectServer({args: ['--root', root, '--cache-dir', cache]});
  try {
    const meta = payloadOf(await call(session.client, 'mesa_status'));
    assert.equal(meta.setup.roots.configured, true);
    assert.equal(meta.setup.roots.available, true);
    assert.deepEqual(meta.setup.roots.checks, {valid: 1, missing: 0, changed: 0, notDirectory: 0});
    assert.equal(meta.setup.roots.source, 'flag');
    assert.equal(meta.setup.roots.count, 1);
    assert.equal(meta.setup.roots.paths[0], await fs.realpath(root));
    assert.equal(meta.setup.cacheDir.path, path.resolve(cache));
    assert.equal(meta.setup.cacheDir.available, true);
    assert.equal(meta.setup.cacheDir.state, 'ready');
    assert.equal(meta.setup.xournalHelper.configured, false);
    assert.equal(meta.setup.xournalHelper.available, false);
    assert.equal(meta.setup.capture.platformSupported, process.platform === 'darwin');
    assert.equal(meta.ready.windows, false);
    assert.equal(meta.ready.capture, false);
    assert.equal(meta.ready.pdf, popplerReady);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('stdio: mesa_page devolve image/png completo + metadados e atualiza contexto', {skip: pdfSkip}, async () => {
  const {base, root, cache} = await tempDirs('mesa-mcp-page-');
  const pdf = path.join(root, 'sintetico.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 2}));
  const before = await fs.readFile(pdf);
  const session = await connectServer({args: ['--root', root, '--cache-dir', cache]});
  try {
    const result = await call(session.client, 'mesa_page', {filePath: pdf, page: 1});
    assert.equal(result.isError, undefined, textOf(result));
    assert.equal(result.content[0].type, 'image');
    assert.equal(result.content[0].mimeType, 'image/png');
    const bytes = Buffer.from(result.content[0].data, 'base64');
    assert.ok(bytes.length > 1000);
    assert.ok(bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));

    const meta = payloadOf(result);
    assert.equal(meta.kind, 'page');
    assert.equal(meta.source.type, 'pdf');
    assert.equal(meta.source.document.name, 'sintetico.pdf');
    assert.equal(meta.source.page, 1);
    assert.equal(meta.source.numPages, 2);
    assert.equal(meta.image.bytes, bytes.length);
    assert.equal(meta.image.sha256.length, 64);
    assert.ok(meta.image.width >= 500 && meta.image.height >= 500);
    assert.ok(meta.image.snapshotPath.startsWith(await fs.realpath(cache)));
    assert.equal(meta.preview.vectorSvgInResponse, false);
    assert.deepEqual(result.structuredContent, meta);
    assert.equal(await fs.stat(meta.image.snapshotPath).then((stat) => stat.mode & 0o777), 0o600);

    // PDF permanece intacto.
    assert.ok(before.equals(await fs.readFile(pdf)), 'o PDF autorizado é somente leitura');

    const context = payloadOf(await call(session.client, 'mesa_context', {action: 'get'}));
    assert.equal(context.context.page.page, 1);
    assert.equal(context.context.page.document.name, 'sintetico.pdf');
    assert.equal(context.context.capture, null);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('stdio: schema inválido e ferramenta desconhecida não derrubam a sessão', async () => {
  const session = await connectServer();
  try {
    for (const args of [{}, {filePath: 1, page: 1}, {filePath: '/x.pdf', page: 0}, {filePath: '/x.pdf', page: 1.5}]) {
      const result = await call(session.client, 'mesa_page', args);
      assert.equal(result.isError, true, JSON.stringify(args));
      assert.match(textOf(result), /Invalid arguments/);
    }
    const missing = await call(session.client, 'mesa_teleporte', {});
    assert.equal(missing.isError, true);
    assert.match(textOf(missing), /not found|não/i);

    const status = await call(session.client, 'mesa_status');
    assert.equal(payloadOf(status).ok, true);
  } finally {
    await session.close();
  }
});

test('stdio: escape de caminho e pedido extra nunca ampliam raízes/cache/helper', async () => {
  const {base, root, cache} = await tempDirs('mesa-mcp-escape-');
  await fs.writeFile(path.join(root, 'notas.txt'), 'não é PDF');
  const session = await connectServer({args: ['--root', root, '--cache-dir', cache]});
  try {
    // Fora das raízes.
    const outside = await call(session.client, 'mesa_page', {filePath: '/etc/hosts', page: 1});
    assert.equal(payloadOf(outside).error.code, 'PATH_OUTSIDE_ROOTS');
    // Extensão não-PDF dentro da raiz.
    const wrongExt = await call(session.client, 'mesa_page', {filePath: path.join(root, 'notas.txt'), page: 1});
    assert.equal(payloadOf(wrongExt).error.code, 'NOT_PDF_EXTENSION');
    // Caminho inexistente.
    const missing = await call(session.client, 'mesa_page', {filePath: path.join(root, 'nao-existe.pdf'), page: 1});
    assert.equal(payloadOf(missing).error.code, 'PATH_NOT_FOUND');
    // Symlink dentro da raiz apontando para fora.
    const link = path.join(root, 'escape.pdf');
    await fs.symlink('/etc/hosts', link);
    const symlinked = await call(session.client, 'mesa_page', {filePath: link, page: 1});
    assert.equal(payloadOf(symlinked).error.code, 'PATH_OUTSIDE_ROOTS');
    // Campo extra "roots" não autoriza /etc; campos cacheDir/helperPath são ignorados.
    const injectedRoots = await call(session.client, 'mesa_page', {
      filePath: '/etc/hosts',
      page: 1,
      roots: [path.dirname('/etc/hosts')],
      cacheDir: '/tmp',
      helperPath: '/bin/echo',
    });
    assert.equal(payloadOf(injectedRoots).error.code, 'PATH_OUTSIDE_ROOTS');
    const capture = await call(session.client, 'mesa_capture', {windowId: 1, helperPath: '/bin/echo', confirm: true});
    assert.equal(payloadOf(capture).error.code, 'CAPTURE_HELPER_MISSING');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('stdio: contexto da sessão (set exige note, get e clear)', async () => {
  const {base, root, cache} = await tempDirs('mesa-mcp-context-');
  const session = await connectServer({args: ['--root', root, '--cache-dir', cache]});
  try {
    const initial = payloadOf(await call(session.client, 'mesa_context', {action: 'get'}));
    assert.equal(initial.context.page, null);
    assert.equal(initial.context.capture, null);
    assert.equal(initial.context.note, null);

    const withoutNote = await call(session.client, 'mesa_context', {action: 'set'});
    assert.equal(payloadOf(withoutNote).error.code, 'CONTEXT_INVALID');

    const set = payloadOf(await call(session.client, 'mesa_context', {action: 'set', note: 'Questão ativa sintética'}));
    assert.equal(set.context.note, 'Questão ativa sintética');
    assert.ok(set.context.updatedAt);

    const get = payloadOf(await call(session.client, 'mesa_context', {action: 'get'}));
    assert.equal(get.context.note, 'Questão ativa sintética');

    const cleared = payloadOf(await call(session.client, 'mesa_context', {action: 'clear'}));
    assert.equal(cleared.context.note, null);
    assert.equal(cleared.context.page, null);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('stdio: stdout é só MCP e stderr é genérico (sem caminho de PDF)', {skip: pdfSkip}, async () => {
  const {base, root, cache} = await tempDirs('mesa-mcp-stdout-');
  const pdf = path.join(root, 'material sintetico.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 1}));
  const session = await connectServer({args: ['--root', root, '--cache-dir', cache]});
  try {
    await call(session.client, 'mesa_page', {filePath: pdf, page: 1});
    await call(session.client, 'mesa_page', {filePath: path.join(root, 'ausente.pdf'), page: 1});
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stderr = session.stderrText();
    assert.ok(!stderr.includes('material sintetico'), 'stderr não pode citar o arquivo do PDF');
    assert.ok(!stderr.includes(root), 'stderr não pode citar a raiz');
    for (const line of stderr.split('\n')) {
      if (line.trim() === '') continue;
      assert.match(line, /^\[mesa-study\]/, `linha de stderr inesperada: ${line}`);
    }
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});
