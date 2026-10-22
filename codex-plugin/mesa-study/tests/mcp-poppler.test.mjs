/* Poppler REAL com PDFs sintéticos (nada de material de curso, rede ou
   inferência), através do servidor MCP stdio:
   - caminho com espaços e caracteres não-ASCII;
   - prévia vetorial acima do teto vira aviso explícito, sem truncar o PNG;
   - teto de imagem (image/png) excedido vira erro explícito IMAGE_TOO_LARGE
     SEM truncar: o arquivo completo permanece no cache privado.
   Sem Poppler, os testes são pulados com mensagem explícita. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {PNG_MAGIC, SVG_CHAR_LIMIT} from '../host/config.mjs';
import {resolvePopplerTools} from '../host/tools.mjs';
import {runProcess} from '../host/proc.mjs';
import {makeSyntheticPdf, makeSyntheticTextPdf} from '../host/testing.mjs';
import {MIN_MAX_IMAGE_BYTES} from '../server/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'server', 'main.mjs');
const TOOLS = resolvePopplerTools();
const popplerReady = (await Promise.all(
  [TOOLS.pdfinfo, TOOLS.pdftocairo].map((tool) => fs.access(tool, fs.constants.X_OK).then(() => true, () => false)),
)).every(Boolean);
const pdfSkip = popplerReady ? false : 'Poppler (pdfinfo/pdftocairo) não está disponível nesta máquina';

async function connectServer(args) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER, ...args],
    stderr: 'pipe',
    cwd: ROOT,
  });
  const client = new Client({name: 'mesa-poppler-test', version: '0.0.0'});
  await client.connect(transport);
  return {
    client,
    async close() {
      try {
        await client.close();
      } catch {
        // encerrado
      }
    },
  };
}

function payloadOf(result) {
  const block = (result.content || []).find((item) => item.type === 'text');
  try {
    return JSON.parse(block.text);
  } catch {
    return null;
  }
}

test('Poppler real: caminho com espaços e não-ASCII renderiza image/png completo', {skip: pdfSkip}, async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa mcp poppler ção-'));
  const root = path.join(base, 'Raízes de teste com espaços');
  const cache = path.join(base, 'cache privado ção');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  const pdf = path.join(root, 'Página sintética com espaços ção.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 3, texts: ['Página um ção', 'Página dois ação', 'Página três']}));
  const before = createHash('sha256').update(await fs.readFile(pdf)).digest('hex');
  const session = await connectServer(['--root', root, '--cache-dir', cache]);
  try {
    const result = await session.client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 2}});
    assert.equal(result.isError, undefined, JSON.stringify(payloadOf(result)));
    assert.equal(result.content[0].type, 'image');
    assert.equal(result.content[0].mimeType, 'image/png');
    const bytes = Buffer.from(result.content[0].data, 'base64');
    assert.ok(bytes.length > 1000);
    assert.ok(bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));
    const meta = payloadOf(result);
    assert.equal(meta.source.document.name, 'Página sintética com espaços ção.pdf');
    assert.equal(meta.source.page, 2);
    assert.equal(meta.source.numPages, 3);
    assert.equal(meta.image.width, bytes.readUInt32BE(16));
    assert.equal(meta.image.sha256, createHash('sha256').update(bytes).digest('hex'));
    const onDisk = await fs.readFile(meta.image.snapshotPath);
    assert.ok(onDisk.equals(bytes), 'o bloco image/png é o MESMO arquivo do cache');

    const after = createHash('sha256').update(await fs.readFile(pdf)).digest('hex');
    assert.equal(after, before, 'o PDF precisa permanecer intacto');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('Poppler real: prévia SVG acima do teto vira aviso e o PNG continua completo', {skip: pdfSkip}, async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-mcp-preview-'));
  const root = path.join(base, 'root');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  const pdf = path.join(root, 'sintetico-55-linhas.pdf');
  await fs.writeFile(pdf, makeSyntheticTextPdf({lines: 55}));

  // Prova independente (fora do servidor) de que esta página estoura o teto.
  const rawSvg = path.join(base, 'cru.svg');
  const raw = await runProcess([TOOLS.pdftocairo, '-svg', '-f', '1', '-l', '1', pdf, rawSvg], {
    timeoutMs: 20000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(raw.ok, true, raw.stderr);
  const rawText = await fs.readFile(rawSvg, 'utf8');
  assert.ok(rawText.length > SVG_CHAR_LIMIT, `página precisa exceder ${SVG_CHAR_LIMIT} chars (veio ${rawText.length})`);

  const session = await connectServer(['--root', root, '--cache-dir', cache]);
  try {
    const result = await session.client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 1}});
    assert.equal(result.isError, undefined);
    const meta = payloadOf(result);
    assert.equal(meta.preview.vectorSvgInResponse, false);
    assert.equal(typeof meta.preview.warning, 'string');
    assert.match(meta.preview.warning, new RegExp(String(SVG_CHAR_LIMIT)));
    assert.doesNotMatch(meta.preview.warning, /fiel|fielmente|idêntic/i);
    assert.equal(result.content[0].type, 'image');
    const png = Buffer.from(result.content[0].data, 'base64');
    assert.ok(png.length > 1000);
    assert.ok(png.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));
    assert.equal((await fs.stat(meta.image.snapshotPath)).mode & 0o777, 0o600);
    const leftovers = await fs.readdir(meta.image.snapshotPath.replace(/\/snapshot\.png$/, ''));
    assert.ok(!leftovers.includes('page.svg'), 'o SVG excedente não pode sobrar na pasta própria');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('Poppler real: PNG acima do teto de imagem falha explícito e não trunca', {skip: pdfSkip}, async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-mcp-bound-'));
  const root = path.join(base, 'root');
  const cacheA = path.join(base, 'cache-a');
  const cacheB = path.join(base, 'cache-b');
  await fs.mkdir(root);
  await fs.mkdir(cacheA);
  await fs.mkdir(cacheB);
  // Fixture densa: um PNG sintético minúsculo (< teto mínimo de 4 KiB) não
  // permitiria exercitar IMAGE_TOO_LARGE; com a página de texto longo o
  // caminho do teto é realmente exercitado.
  const pdf = path.join(root, 'sintetico.pdf');
  await fs.writeFile(pdf, makeSyntheticTextPdf({lines: 55}));

  const probe = await connectServer(['--root', root, '--cache-dir', cacheA]);
  let measured;
  try {
    const result = await probe.client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 1}});
    assert.equal(result.isError, undefined);
    measured = payloadOf(result).image.bytes;
  } finally {
    await probe.close();
  }
  if (measured <= MIN_MAX_IMAGE_BYTES) {
    // Skip honesto (não um "passa" vazio): sem um PNG maior que o teto mínimo
    // o caso IMAGE_TOO_LARGE não pode ser exercitado.
    t.skip(`a página sintética rendeu ${measured} B, abaixo do teto mínimo de ${MIN_MAX_IMAGE_BYTES} B`);
    return;
  }

  const limit = Math.max(MIN_MAX_IMAGE_BYTES, measured - 1);
  const session = await connectServer(['--root', root, '--cache-dir', cacheB, '--max-image-bytes', String(limit)]);
  try {
    const result = await session.client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 1}});
    assert.equal(result.isError, true, 'PNG acima do teto precisa falhar');
    const error = payloadOf(result);
    assert.equal(error.error.code, 'IMAGE_TOO_LARGE');
    assert.equal(error.error.detail.bytes, measured);
    assert.equal(error.error.detail.limit, limit);
    assert.equal((result.content || []).some((block) => block.type === 'image'), false);
    const text = (result.content || []).find((block) => block.type === 'text').text;
    assert.ok(text.length < 2000, 'erro não pode carregar base64/truncamento');
    assert.doesNotMatch(text, /data:image|base64/i);

    // O arquivo completo permanece no cache privado, byte a byte, sem truncar.
    const dirs = (await fs.readdir(cacheB)).filter((name) => name.startsWith('mesa-study-'));
    assert.equal(dirs.length, 1, 'a pasta própria da página precisa permanecer');
    const snapshot = path.join(cacheB, dirs[0], 'snapshot.png');
    const stat = await fs.stat(snapshot);
    assert.equal(stat.size, measured, 'nada pode ser truncado no cache');
    assert.equal(stat.mode & 0o777, 0o600);
    assert.ok((await fs.readFile(snapshot)).subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});
