/* Captura da janela do Xournal++:
   A) protocolo stdio REAL com HELPER FALSO (script sintético executável):
      listagem somente Xournal++, erros de seleção e de helper. Nenhuma
      captura real é possível nesse caminho: a seleção falha antes do
      screencapture e o helper é falso.
   B) em processo, com `run` INJETADO: sucesso de captura (PNG sintético),
      revalidação pós-captura, ausência de reuso de imagem antiga e teto de
      imagem. O screencapture é um caminho FALSO interceptado pelo run — a
      tela real nunca é tocada. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {PNG_MAGIC} from '../host/config.mjs';
import {makeFakePng} from '../host/testing.mjs';
import {parseStartupConfig} from '../server/config.mjs';
import {createMcpServer} from '../server/server.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'server', 'main.mjs');
const WINDOW = {id: 3, app: 'Xournal++', title: 'Resolução', bounds: {Width: 900, Height: 700}};

async function writeFakeHelper(dir, {name, windows = [], permission = true, exit = false, log}) {
  const file = path.join(dir, `${name}.mjs`);
  const body = exit
    ? 'process.exit(1);'
    : `process.stdout.write(${JSON.stringify(JSON.stringify({permission, windows}))});`;
  const source = [
    '#!/usr/bin/env node',
    "import fs from 'node:fs';",
    `try { fs.appendFileSync(${JSON.stringify(log)}, 'x'); } catch {}`,
    body,
    '',
  ].join('\n');
  await fs.writeFile(file, source, {mode: 0o755});
  await fs.chmod(file, 0o755);
  return file;
}

async function connectServer({args = [], env = {}} = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER, ...args],
    env: {...env},
    stderr: 'pipe',
    cwd: ROOT,
  });
  const client = new Client({name: 'mesa-capture-test', version: '0.0.0'});
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

function textOf(result) {
  const block = (result.content || []).find((item) => item.type === 'text');
  return block ? block.text : '';
}

async function countLogLines(file) {
  try {
    return (await fs.readFile(file, 'utf8')).length;
  } catch {
    return 0;
  }
}

test('stdio+helper falso: mesa_windows lista só Xournal++ e não captura', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-capture-windows-'));
  const cache = path.join(base, 'cache');
  const log = path.join(base, 'helper.log');
  await fs.mkdir(cache);
  const helper = await writeFakeHelper(base, {
    name: 'janelas-fake',
    log,
    windows: [WINDOW, {id: 9, app: 'Firefox', title: 'Docs', bounds: {Width: 800, Height: 600}}],
  });
  const session = await connectServer({
    args: ['--cache-dir', cache, '--xournal-helper', helper],
    env: {MESA_FAKE_HELPER_LOG: log},
  });
  try {
    const result = await session.client.callTool({name: 'mesa_windows', arguments: {}});
    assert.equal(result.isError, undefined, JSON.stringify(payloadOf(result)));
    const meta = payloadOf(result);
    assert.equal(meta.kind, 'windows');
    assert.equal(meta.count, 1);
    assert.equal(meta.windows[0].id, '3');
    assert.equal(meta.windows[0].app, 'Xournal++');
    assert.match(meta.provenance, /Nenhuma captura foi feita/);
    assert.equal(await countLogLines(log), 1, 'uma única listagem; nenhuma captura');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('stdio+helper falso: erros de seleção do mesa_capture (sem screencapture)', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-capture-select-'));
  const cache = path.join(base, 'cache');
  const log = path.join(base, 'helper.log');
  await fs.mkdir(cache);
  const helper = await writeFakeHelper(base, {name: 'janelas-fake', log, windows: [WINDOW]});
  const env = {MESA_FAKE_HELPER_LOG: log};
  const session = await connectServer({args: ['--cache-dir', cache, '--xournal-helper', helper], env});
  try {
    // windowId ausente: recusado pelo schema, helper nem é chamado.
    const missing = await session.client.callTool({name: 'mesa_capture', arguments: {}});
    assert.equal(missing.isError, true);
    assert.match(textOf(missing), /Invalid arguments/);
    assert.equal(await countLogLines(log), 0);

    // windowId fora da lista: falha de seleção antes de qualquer captura.
    const absent = await session.client.callTool({name: 'mesa_capture', arguments: {windowId: 999}});
    assert.equal(absent.isError, true);
    assert.equal(payloadOf(absent).error.code, 'CAPTURE_WINDOW_INVALID');
    assert.equal(await countLogLines(log), 1, 'só a listagem da seleção');

    // windowId fora da faixa: recusado antes do helper.
    const zero = await session.client.callTool({name: 'mesa_capture', arguments: {windowId: 0}});
    assert.equal(zero.isError, true);
    assert.equal(payloadOf(zero).error.code, 'CAPTURE_WINDOW_INVALID');
    assert.equal(await countLogLines(log), 1);

    // Tipo inválido: recusado pelo schema.
    const fractional = await session.client.callTool({name: 'mesa_capture', arguments: {windowId: 4.5}});
    assert.equal(fractional.isError, true);
    assert.match(textOf(fractional), /Invalid arguments/);
    assert.equal(await countLogLines(log), 1);

    // Lista vazia com id explícito.
    const emptyHelper = await writeFakeHelper(base, {name: 'vazio', log, windows: []});
    const empty = await connectServer({args: ['--cache-dir', cache, '--xournal-helper', emptyHelper], env});
    try {
      const result = await empty.client.callTool({name: 'mesa_capture', arguments: {windowId: 3}});
      assert.equal(result.isError, true);
      assert.equal(payloadOf(result).error.code, 'CAPTURE_WINDOW_INVALID');
    } finally {
      await empty.close();
    }
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('stdio+helper falso: anomalias do helper e permissão', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-capture-anomaly-'));
  const cache = path.join(base, 'cache');
  const env = {MESA_FAKE_HELPER_LOG: path.join(base, 'helper.log')};
  await fs.mkdir(cache);
  const cases = [
    {
      name: 'id-invalido',
      helper: await writeFakeHelper(base, {
        name: 'id-invalido',
        log: env.MESA_FAKE_HELPER_LOG,
        windows: [{...WINDOW, id: 'abc'}],
      }),
      code: 'CAPTURE_WINDOW_INVALID',
    },
    {
      name: 'sem-permissao',
      helper: await writeFakeHelper(base, {name: 'sem-permissao', log: env.MESA_FAKE_HELPER_LOG, permission: false}),
      code: 'CAPTURE_PERMISSION',
    },
    {
      name: 'quebrado',
      helper: await writeFakeHelper(base, {name: 'quebrado', log: env.MESA_FAKE_HELPER_LOG, exit: true}),
      code: 'CAPTURE_HELPER_FAILED',
    },
  ];
  try {
    for (const entry of cases) {
      const session = await connectServer({args: ['--cache-dir', cache, '--xournal-helper', entry.helper], env});
      try {
        const result = await session.client.callTool({name: 'mesa_windows', arguments: {}});
        assert.equal(result.isError, true, entry.name);
        assert.equal(payloadOf(result).error.code, entry.code, entry.name);
      } finally {
        await session.close();
      }
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

async function connectInProcess({config, deps}) {
  const {server} = createMcpServer({config, deps});
  const client = new Client({name: 'mesa-capture-inproc', version: '0.0.0'});
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

test('em processo (run injetado): captura escolhida, revalidada e sem tela inteira', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-capture-fake-'));
  const cache = path.join(base, 'cache');
  const helper = path.join(base, 'helper-fake.mjs');
  const screencapture = path.join(base, 'screencapture-FALSO');
  await fs.mkdir(cache);

  let helperCalls = 0;
  let mode = 'ok';
  const calls = [];
  const run = async (argv) => {
    calls.push([...argv]);
    if (argv[0] === helper) {
      helperCalls += 1;
      const windows = mode === 'absent'
        ? []
        : [mode === 'changed' && helperCalls >= 3 ? {...WINDOW, ownerPID: 200} : {...WINDOW, ownerPID: 100}];
      return {ok: true, code: 0, stdout: JSON.stringify({permission: true, windows}), stderr: '', timedOut: false, missing: false};
    }
    if (argv[0] === screencapture) {
      await fs.writeFile(argv[argv.length - 1], makeFakePng({bytes: 512, width: 640, height: 480}));
      return {ok: true, code: 0, stdout: '', stderr: '', timedOut: false, missing: false};
    }
    return {ok: false, code: 127, stdout: '', stderr: '', timedOut: false, missing: true};
  };

  const config = parseStartupConfig({
    argv: ['--cache-dir', cache, '--xournal-helper', helper],
    env: {},
  }).config;
  const session = await connectInProcess({
    config,
    deps: {run, screencapturePath: screencapture, nowDate: () => new Date('2026-10-05T12:00:00.000Z')},
  });
  try {
    const result = await session.client.callTool({name: 'mesa_capture', arguments: {windowId: '3'}});
    assert.equal(result.isError, undefined, JSON.stringify(payloadOf(result)));
    assert.equal(result.content[0].type, 'image');
    const bytes = Buffer.from(result.content[0].data, 'base64');
    assert.ok(bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));
    const meta = payloadOf(result);
    assert.equal(meta.kind, 'capture');
    assert.equal(meta.source.type, 'xournal-window');
    assert.equal(meta.source.window.id, '3');
    assert.equal(meta.source.capturedAt, '2026-10-05T12:00:00.000Z');
    assert.equal(meta.image.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.match(meta.provenance, /nunca a tela inteira/);
    assert.match(meta.provenance, /deve responder a um pedido explícito/);
    assert.match(meta.provenance, /não verifica consentimento/);
    assert.match(meta.provenance, /captura atual desta chamada/);
    assert.doesNotMatch(meta.provenance, /solicitada explicitamente/i, 'o servidor não pode afirmar consentimento que não confere');

    // Captura de janela específica: sempre `-l<id>`, nunca tela inteira.
    const captureCalls = calls.filter((argv) => argv[0] === screencapture);
    assert.equal(captureCalls.length, 1);
    assert.deepEqual(captureCalls[0].slice(0, 4), [screencapture, '-x', '-o', '-l3']);
    for (const argv of captureCalls) {
      assert.ok(argv.some((arg) => /^-l\d+$/.test(arg)), 'captura precisa ser por janela (-lID)');
      assert.ok(!argv.includes('-w') && !argv.includes('-R'), 'nunca captura interativa/tela inteira');
    }
    assert.equal(helperCalls, 3, 'seleção + revalidação antes + revalidação depois');

    const afterSuccess = payloadOf(await session.client.callTool({name: 'mesa_context', arguments: {action: 'get'}}));
    assert.equal(afterSuccess.context.capture.window.id, '3');

    // Revalidação pós-captura detecta a janela mudou: erro, nada fica no cache,
    // nenhum imageblock e o contexto não é reescrito com a falha.
    mode = 'changed';
    helperCalls = 0; // a 3ª listagem DESTA captura vê ownerPID diferente
    const changed = await session.client.callTool({name: 'mesa_capture', arguments: {windowId: 3}});
    assert.equal(changed.isError, true);
    assert.equal(payloadOf(changed).error.code, 'CAPTURE_WINDOW_CHANGED');
    assert.equal((changed.content || []).some((block) => block.type === 'image'), false);
    const leftovers = (await fs.readdir(cache)).filter((name) => name.startsWith('mesa-study-'));
    assert.equal(leftovers.length, 1, 'só a pasta da captura bem-sucedida permanece');
    const contextAfterFailure = payloadOf(await session.client.callTool({name: 'mesa_context', arguments: {action: 'get'}}));
    assert.equal(
      contextAfterFailure.context.capture.window.id,
      '3',
      'contexto preserva a última captura BEM-SUCEDIDA, sem usá-la como imagem da tentativa que falhou',
    );

    // Janela sumiu: erro de seleção, sem screencapture novo e sem imagem antiga.
    mode = 'absent';
    const beforeAbsent = calls.filter((argv) => argv[0] === screencapture).length;
    const absent = await session.client.callTool({name: 'mesa_capture', arguments: {windowId: 3}});
    assert.equal(absent.isError, true);
    assert.equal(payloadOf(absent).error.code, 'CAPTURE_WINDOW_INVALID');
    assert.equal((absent.content || []).some((block) => block.type === 'image'), false);
    assert.equal(calls.filter((argv) => argv[0] === screencapture).length, beforeAbsent, 'seleção falhou antes de capturar');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('em processo (run injetado): teto de imagem não trunca a captura', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-capture-bound-'));
  const cache = path.join(base, 'cache');
  const helper = path.join(base, 'helper-fake.mjs');
  const screencapture = path.join(base, 'screencapture-FALSO');
  await fs.mkdir(cache);
  const run = async (argv) => {
    if (argv[0] === helper) {
      return {ok: true, code: 0, stdout: JSON.stringify({permission: true, windows: [WINDOW]}), stderr: '', timedOut: false, missing: false};
    }
    await fs.writeFile(argv[argv.length - 1], makeFakePng({bytes: 8192, width: 640, height: 480}));
    return {ok: true, code: 0, stdout: '', stderr: '', timedOut: false, missing: false};
  };
  const config = parseStartupConfig({
    argv: ['--cache-dir', cache, '--xournal-helper', helper, '--max-image-bytes', '4096'],
    env: {},
  }).config;
  const session = await connectInProcess({config, deps: {run, screencapturePath: screencapture}});
  try {
    const result = await session.client.callTool({name: 'mesa_capture', arguments: {windowId: 3}});
    assert.equal(result.isError, true);
    assert.equal(payloadOf(result).error.code, 'IMAGE_TOO_LARGE');
    assert.equal((result.content || []).some((block) => block.type === 'image'), false);
    const dirs = (await fs.readdir(cache)).filter((name) => name.startsWith('mesa-study-'));
    assert.equal(dirs.length, 1);
    const snapshot = path.join(cache, dirs[0], 'snapshot.png');
    assert.equal((await fs.stat(snapshot)).size, 8192, 'o PNG completo permanece no cache');
    const context = payloadOf(await session.client.callTool({name: 'mesa_context', arguments: {action: 'get'}}));
    assert.equal(context.context.capture, null, 'falha não atualiza o contexto');
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});
