/* Guardas de prontidão e identidade do servidor (achados r3 B/C):
   A) status: CONFIGURADO ≠ DISPONÍVEL com checagens somente leitura
      (raízes, cache, helper e plataforma da captura), sem mutar o cache;
   B) raízes congeladas: troca por symlink depois do startup não autoriza o
      alvo novo, raiz-arquivo é recusada e a ausente que vira pasta real/ link
      é tratada pelo canônico do ancestral;
   C) confinamento do PNG: leitura limitada só dentro do cache privado.
   Tudo com fixtures sintéticas; nenhuma captura real e nenhum material
   pessoal. Poppler real só quando disponível (os casos que exigem render
   são pulados com mensagem explícita). */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {SCREENCAPTURE_PATH} from '../host/config.mjs';
import {resolvePopplerTools} from '../host/tools.mjs';
import {makeFakePng, makeSyntheticPdf} from '../host/testing.mjs';
import {parseStartupConfig} from '../server/config.mjs';
import {createMcpServer} from '../server/server.mjs';
import {readBoundedPng} from '../server/png.mjs';

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
  const client = new Client({name: 'mesa-guards-test', version: '0.0.0'});
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

async function connectInProcess({config, deps}) {
  const {server} = createMcpServer({config, deps});
  const client = new Client({name: 'mesa-guards-inproc', version: '0.0.0'});
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return {
    client,
    async close() {
      try {
        await client.close();
        await server.close();
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

function hasImage(result) {
  return (result.content || []).some((block) => block.type === 'image');
}

async function exists(target) {
  return fs.stat(target).then(() => true, () => false);
}

async function tempBase(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('status: configurado ≠ disponível para raiz/helper ausentes e cache criável — sem mutar nada', async () => {
  const base = await tempBase('mesa-guards-status-');
  const helper = path.join(base, 'helper-inexistente');
  const missingRoot = path.join(base, 'raiz-inexistente');
  const cache = path.join(base, 'cache-ainda-ausente');
  const session = await connectServer(['--root', missingRoot, '--cache-dir', cache, '--xournal-helper', helper]);
  try {
    const meta = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.roots.configured, true, 'a flag foi aceita no startup');
    assert.equal(meta.setup.roots.available, false, 'raiz que não existe agora não está disponível');
    assert.equal(meta.setup.roots.checks.missing, 1);
    assert.equal(meta.setup.cacheDir.configured, true);
    assert.equal(meta.setup.cacheDir.available, true, 'cache ausente sob ancestral gravável é criável');
    assert.equal(meta.setup.cacheDir.state, 'absent-creatable');
    assert.equal(meta.setup.xournalHelper.configured, true);
    assert.equal(meta.setup.xournalHelper.available, false, 'string configurada não é executável');
    assert.equal(meta.ready.pdf, false);
    assert.equal(meta.ready.windows, false);
    assert.equal(meta.ready.capture, false);
    assert.ok(meta.guidance.some((line) => /não estão disponíveis/.test(line)), JSON.stringify(meta.guidance));
    assert.ok(meta.guidance.some((line) => /helper declarado não é um arquivo executável/.test(line)));
    // Somente leitura: o status não criou o cache nem a raiz.
    assert.equal(await exists(cache), false, 'status não pode criar o cache');
    assert.equal(await exists(missingRoot), false, 'status não pode criar a raiz');
    // Sem nenhuma raiz viva, a página falha antes de qualquer caminho do host.
    const page = await session.client.callTool({name: 'mesa_page', arguments: {filePath: path.join(missingRoot, 'x.pdf'), page: 1}});
    assert.equal(page.isError, true);
    assert.equal(payloadOf(page).error.code, 'ROOT_NOT_FOUND');
    assert.equal(hasImage(page), false);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('status/uso: cacheDir symlink, arquivo ou gravável por outros não está disponível', async () => {
  const base = await tempBase('mesa-guards-cache-');
  const root = path.join(base, 'raiz');
  const cacheReal = path.join(base, 'cache-real');
  const cacheLink = path.join(base, 'cache-link');
  const cacheFile = path.join(base, 'cache-arquivo');
  const cachePerms = path.join(base, 'cache-perms');
  await fs.mkdir(root);
  await fs.mkdir(cacheReal);
  await fs.mkdir(cachePerms);
  await fs.chmod(cachePerms, 0o777);
  await fs.writeFile(cacheFile, 'não é diretório');
  await fs.symlink(cacheReal, cacheLink, 'dir');
  const pdf = path.join(root, 'sintetico.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 1}));

  const cases = [
    {cache: cacheLink, state: 'symlink', pageCode: 'CACHE_DIR_SYMLINK'},
    {cache: cacheFile, state: 'not-directory', pageCode: 'CACHE_DIR_NOT_DIRECTORY'},
    {cache: cachePerms, state: 'permissions', pageCode: 'CACHE_DIR_PERMISSIONS'},
  ];
  for (const entry of cases) {
    const session = await connectServer(['--root', root, '--cache-dir', entry.cache]);
    try {
      const meta = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
      assert.equal(meta.setup.cacheDir.configured, true, entry.state);
      assert.equal(meta.setup.cacheDir.available, false, entry.state);
      assert.equal(meta.setup.cacheDir.state, entry.state);
      assert.equal(meta.ready.pdf, false, entry.state);
      assert.equal(meta.ready.capture, false, entry.state);
      assert.ok(
        meta.guidance.some((line) => line.includes('cacheDir configurado não está utilizável')),
        `${entry.state}: ${JSON.stringify(meta.guidance)}`,
      );

      const page = await session.client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 1}});
      assert.equal(page.isError, true, entry.state);
      assert.equal(payloadOf(page).error.code, entry.pageCode, entry.state);
      assert.equal(hasImage(page), false, entry.state);
    } finally {
      await session.close();
    }
  }
  // O status não mudou nada: o symlink continua symlink e o arquivo continua arquivo.
  assert.equal((await fs.lstat(cacheLink)).isSymbolicLink(), true);
  assert.equal((await fs.lstat(cacheFile)).isFile(), true);
  await fs.rm(base, {recursive: true, force: true});
});

test('status/captura: helper executável agora marca disponível; plataforma decide a captura', async () => {
  const base = await tempBase('mesa-guards-helper-');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  const helper = path.join(base, 'helper-fake');
  const helperPlain = path.join(base, 'helper-sem-x');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  await fs.writeFile(helper, '#!/bin/sh\nexit 0\n', {mode: 0o755});
  await fs.chmod(helper, 0o755);
  await fs.writeFile(helperPlain, '#!/bin/sh\nexit 0\n', {mode: 0o644});
  await fs.chmod(helperPlain, 0o644);

  const ready = await connectServer(['--root', root, '--cache-dir', cache, '--xournal-helper', helper]);
  try {
    const meta = payloadOf(await ready.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.xournalHelper.configured, true);
    assert.equal(meta.setup.xournalHelper.available, true);
    assert.equal(meta.ready.windows, true);
    const screencaptureReady = await exists(SCREENCAPTURE_PATH);
    assert.equal(meta.setup.capture.platformSupported, process.platform === 'darwin');
    assert.equal(meta.ready.capture, process.platform === 'darwin' && screencaptureReady);
  } finally {
    await ready.close();
  }

  const plain = await connectServer(['--root', root, '--cache-dir', cache, '--xournal-helper', helperPlain]);
  try {
    const meta = payloadOf(await plain.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.xournalHelper.configured, true);
    assert.equal(meta.setup.xournalHelper.available, false, 'arquivo sem bit de execução não está disponível');
    assert.equal(meta.ready.windows, false);
    assert.equal(meta.ready.capture, false);
  } finally {
    await plain.close();
  }

  // Fora do macOS a captura não pode ser prometida, mesmo com helper/ferramenta
  // "presentes" — a plataforma é injetável só em teste (in-process).
  const config = parseStartupConfig({
    argv: ['--root', root, '--cache-dir', cache, '--xournal-helper', helper],
    env: {},
  }).config;
  const inproc = await connectInProcess({config, deps: {platform: 'linux', screencapturePath: helper}});
  try {
    const meta = payloadOf(await inproc.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.capture.platform, 'linux');
    assert.equal(meta.setup.capture.platformSupported, false);
    assert.equal(meta.setup.capture.tool.available, false);
    assert.equal(meta.ready.windows, true, 'a listagem não depende do macOS no teste');
    assert.equal(meta.ready.capture, false, 'captura é do macOS');
  } finally {
    await inproc.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('cache: ausente e criável é aceito e o host cria 0700 no primeiro uso', async () => {
  const base = await tempBase('mesa-guards-cache-create-');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache-novo');
  await fs.mkdir(root);
  const pdf = path.join(root, 'sintetico.pdf');
  await fs.writeFile(pdf, makeSyntheticPdf({pages: 1}));

  const session = await connectServer(['--root', root, '--cache-dir', cache]);
  try {
    const meta = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.cacheDir.available, true);
    assert.equal(meta.setup.cacheDir.state, 'absent-creatable');
    assert.equal(await exists(cache), false, 'o status não cria o cache');

    // A primeira operação do host cria o cache 0700 — ausente não é bloqueio.
    await session.client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 1}});
    const stat = await fs.stat(cache);
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.mode & 0o777, 0o700);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('raízes: root trocada por symlink depois do startup não autoriza o alvo (sem imagem)', async () => {
  const base = await tempBase('mesa-guards-root-swap-');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  const target = path.join(base, 'alvo');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  await fs.mkdir(target);
  await fs.writeFile(path.join(root, 'notas.txt'), 'não é PDF');
  const targetPdf = path.join(target, 'capturado.pdf');
  const pdfBytes = makeSyntheticPdf({pages: 1});
  await fs.writeFile(targetPdf, pdfBytes);

  const session = await connectServer(['--root', root, '--cache-dir', cache]);
  try {
    // Antes da troca a raiz autoriza (o .txt chega na checagem de extensão).
    const before = await session.client.callTool({name: 'mesa_page', arguments: {filePath: path.join(root, 'notas.txt'), page: 1}});
    assert.equal(payloadOf(before).error.code, 'NOT_PDF_EXTENSION');

    await fs.rm(root, {recursive: true, force: true});
    await fs.symlink(target, root, 'dir');

    for (const filePath of [targetPdf, path.join(root, 'capturado.pdf')]) {
      const result = await session.client.callTool({name: 'mesa_page', arguments: {filePath, page: 1}});
      assert.equal(result.isError, true);
      assert.equal(payloadOf(result).error.code, 'ROOT_CHANGED');
      assert.match(payloadOf(result).error.message, /congelado|inicialização/i);
      assert.equal(hasImage(result), false, 'nenhum PNG do alvo novo');
    }
    // O PDF do alvo não foi tocado nem renderizado.
    assert.ok(pdfBytes.equals(await fs.readFile(targetPdf)));

    const meta = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.roots.available, false);
    assert.equal(meta.setup.roots.checks.changed, 1);
    assert.equal(meta.ready.pdf, false);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('raízes: raiz que virou arquivo é recusada como não-diretório', async () => {
  const base = await tempBase('mesa-guards-root-file-');
  const rootFile = path.join(base, 'coisa.pdf');
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache);
  await fs.writeFile(rootFile, makeSyntheticPdf({pages: 1}));

  const session = await connectServer(['--root', rootFile, '--cache-dir', cache]);
  try {
    const meta = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.roots.configured, true);
    assert.equal(meta.setup.roots.available, false);
    assert.equal(meta.setup.roots.checks.notDirectory, 1);
    assert.equal(meta.ready.pdf, false);

    const result = await session.client.callTool({name: 'mesa_page', arguments: {filePath: rootFile, page: 1}});
    assert.equal(result.isError, true);
    assert.equal(payloadOf(result).error.code, 'ROOT_NOT_DIRECTORY');
    assert.equal(hasImage(result), false);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('raízes: com várias roots, a válida continua autorizando e a trocada não', {skip: pdfSkip}, async () => {
  const base = await tempBase('mesa-guards-root-multi-');
  const validRoot = path.join(base, 'raiz-valida');
  const swappedRoot = path.join(base, 'raiz-trocada');
  const missingRoot = path.join(base, 'raiz-ausente');
  const target = path.join(base, 'alvo');
  const cache = path.join(base, 'cache');
  await fs.mkdir(validRoot);
  await fs.mkdir(swappedRoot);
  await fs.mkdir(target);
  await fs.mkdir(cache);
  const validPdf = path.join(validRoot, 'sintetico.pdf');
  await fs.writeFile(validPdf, makeSyntheticPdf({pages: 1}));
  const targetPdf = path.join(target, 'alvo.pdf');
  await fs.writeFile(targetPdf, makeSyntheticPdf({pages: 1}));

  const session = await connectServer(['--root', validRoot, '--root', swappedRoot, '--root', missingRoot, '--cache-dir', cache]);
  try {
    await fs.rm(swappedRoot, {recursive: true, force: true});
    await fs.symlink(target, swappedRoot, 'dir');

    const meta = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.roots.available, true);
    assert.deepEqual(meta.setup.roots.checks, {valid: 1, missing: 1, changed: 1, notDirectory: 0});

    const rendered = await session.client.callTool({name: 'mesa_page', arguments: {filePath: validPdf, page: 1}});
    assert.equal(rendered.isError, undefined, JSON.stringify(payloadOf(rendered)));
    assert.equal(rendered.content[0].type, 'image');

    const changed = await session.client.callTool({name: 'mesa_page', arguments: {filePath: targetPdf, page: 1}});
    assert.equal(changed.isError, true);
    assert.equal(payloadOf(changed).error.code, 'PATH_OUTSIDE_ROOTS', 'a trocada não é repassada ao host');
    assert.equal(hasImage(changed), false);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('raízes: ausente no startup é congelada pelo ancestral e autoriza a pasta real criada depois', {skip: pdfSkip}, async () => {
  const base = await tempBase('mesa-guards-root-later-');
  const cache = path.join(base, 'cache');
  const missingRoot = path.join(base, 'nova-raiz');
  await fs.mkdir(cache);

  const session = await connectServer(['--root', missingRoot, '--cache-dir', cache]);
  try {
    const before = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(before.setup.roots.available, false);
    assert.equal(before.setup.roots.checks.missing, 1);
    // Canônico antecipado: ancestral existente resolvido + cauda ausente.
    assert.deepEqual(before.setup.roots.paths, [path.join(await fs.realpath(base), 'nova-raiz')]);

    await fs.mkdir(missingRoot);
    const pdf = path.join(missingRoot, 'sintetico.pdf');
    await fs.writeFile(pdf, makeSyntheticPdf({pages: 1}));

    const after = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(after.setup.roots.available, true);
    assert.equal(after.setup.roots.checks.valid, 1);

    const rendered = await session.client.callTool({name: 'mesa_page', arguments: {filePath: pdf, page: 1}});
    assert.equal(rendered.isError, undefined, JSON.stringify(payloadOf(rendered)));
    assert.equal(rendered.content[0].type, 'image');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('raízes: ausente no startup que vira symlink para outro alvo não concede o novo alvo', async () => {
  const base = await tempBase('mesa-guards-root-later-link-');
  const cache = path.join(base, 'cache');
  const missingRoot = path.join(base, 'vai-virar-link');
  const target = path.join(base, 'alvo');
  await fs.mkdir(cache);
  await fs.mkdir(target);
  const targetPdf = path.join(target, 'alvo.pdf');
  await fs.writeFile(targetPdf, makeSyntheticPdf({pages: 1}));

  const session = await connectServer(['--root', missingRoot, '--cache-dir', cache]);
  try {
    await fs.symlink(target, missingRoot, 'dir');
    const result = await session.client.callTool({name: 'mesa_page', arguments: {filePath: targetPdf, page: 1}});
    assert.equal(result.isError, true);
    assert.equal(payloadOf(result).error.code, 'ROOT_CHANGED');
    assert.equal(hasImage(result), false);

    const meta = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
    assert.equal(meta.setup.roots.available, false);
    assert.equal(meta.setup.roots.checks.changed, 1);
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('PNG: leitura limitada recusa arquivo fora do cache (inclusive via symlink)', async () => {
  const base = await tempBase('mesa-guards-png-');
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache);
  const inside = path.join(cache, 'dentro.png');
  const outside = path.join(base, 'fora.png');
  await fs.writeFile(inside, makeFakePng({bytes: 512}));
  await fs.writeFile(outside, makeFakePng({bytes: 512}));
  const escape = path.join(cache, 'escape.png');
  await fs.symlink(outside, escape, 'file');

  const ok = await readBoundedPng(inside, {maxBytes: 1024 * 1024, cacheDir: cache});
  assert.ok(ok.bytes > 100);
  assert.equal(ok.path, await fs.realpath(inside));

  for (const filePath of [outside, escape]) {
    await assert.rejects(
      readBoundedPng(filePath, {maxBytes: 1024 * 1024, cacheDir: cache}),
      (error) => error.code === 'IMAGE_INVALID',
      filePath,
    );
  }
  await fs.rm(base, {recursive: true, force: true});
});

test('PNG: arquivo que cresce entre o stat e a leitura não devolve bytes acima do teto', async () => {
  const base = await tempBase('mesa-guards-png-corrida-');
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache);
  const file = path.join(cache, 'cresce.png');
  await fs.writeFile(file, makeFakePng({bytes: 512}));
  const maxBytes = 4 * 1024;
  let grew = false;

  await assert.rejects(
    readBoundedPng(file, {
      maxBytes,
      cacheDir: cache,
      // O teto do stat foi conferido com 512 bytes; o arquivo cresce (escrita
      // concorrente) antes da leitura. O tamanho LIDO precisa ser reconferido:
      // nada acima do teto pode ser devolvido.
      readFile: async (target) => {
        await fs.appendFile(target, Buffer.alloc(maxBytes + 1024, 7));
        grew = true;
        return fs.readFile(target);
      },
    }),
    (error) => {
      assert.equal(error.code, 'IMAGE_TOO_LARGE');
      assert.ok(error.detail.bytes > maxBytes, 'o detalhe informa o tamanho realmente lido');
      assert.equal(error.detail.limit, maxBytes);
      return true;
    },
  );
  assert.equal(grew, true);
  await fs.rm(base, {recursive: true, force: true});
});
