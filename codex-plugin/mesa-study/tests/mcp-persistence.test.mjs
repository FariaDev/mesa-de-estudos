/* Checkpoint de retomada opt-in (--state-file / MESA_STUDY_STATE_FILE):
   - startup exige cacheDir e filho DIRETO do cache, .json; fora/symlink/
     não-arquivo recusam STARTUP_INVALID;
   - sem flag, nada é gravado (nenhuma persistência por padrão);
   - gravação atômica 0600 de JSON pequeno (versão/kind/updatedAt/page/note),
     SEM imagem/captura/histórico; falha de persistência não derruba a
     operação e nunca é reportada como "salvo";
   - reinício só devolve resumeCandidate: context.page/capture continuam
     nulos, nenhuma imagem é anexada e a retomada de verdade é um novo
     mesa_page (checagens de raiz/arquivo de novo);
   - corrompido/tampered/oversize/fora das raízes é ignorado com erro claro;
   - clear apaga SÓ o checkpoint, explicitamente.
   Fixtures sintéticas; nada de material pessoal ou de curso. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {parseStartupConfig} from '../server/config.mjs';
import {createMcpServer} from '../server/server.mjs';
import {MAX_STATE_BYTES, STATE_KIND, STATE_VERSION, evaluateCandidate, loadCheckpoint} from '../server/persistence.mjs';
import {resolvePopplerTools} from '../host/tools.mjs';
import {makeSyntheticPdf} from '../host/testing.mjs';

const TOOLS = resolvePopplerTools();
const popplerReady = (await Promise.all(
  [TOOLS.pdfinfo, TOOLS.pdftocairo].map((tool) => fs.access(tool, fs.constants.X_OK).then(() => true, () => false)),
)).every(Boolean);
const pdfSkip = popplerReady ? false : 'Poppler (pdfinfo/pdftocairo) não está disponível nesta máquina';
const rootSkip = process.getuid?.() === 0 ? 'root ignora permissão de diretório' : false;

async function tempBase(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function payloadOf(result) {
  const block = (result.content || []).find((item) => item.type === 'text');
  return JSON.parse(block.text);
}

async function connectInProcess(config) {
  const {server} = createMcpServer({config});
  const client = new Client({name: 'mesa-persist-inproc', version: '0.0.0'});
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
    async call(name, args = {}) {
      return client.callTool({name, arguments: args});
    },
  };
}

function configFor({root, cache, stateFile}) {
  const argv = [];
  if (root) argv.push('--root', root);
  if (cache) argv.push('--cache-dir', cache);
  if (stateFile) argv.push('--state-file', stateFile);
  return parseStartupConfig({argv, env: {}}).config;
}

function checkpointFile({pdfPath, page = 1, note = null}) {
  return {
    version: STATE_VERSION,
    kind: STATE_KIND,
    updatedAt: new Date().toISOString(),
    page: pdfPath ? {path: pdfPath, page} : null,
    note,
  };
}

test('checkpoint: startup exige cacheDir e filho direto .json; fora/symlink recusam', async () => {
  const base = await tempBase('mesa state cfg ');
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache);
  try {
    const ok = parseStartupConfig({
      argv: ['--cache-dir', cache, '--state-file', path.join(cache, 'estado.json')],
      env: {},
    }).config;
    assert.equal(ok.stateFile.configured, true);
    assert.equal(ok.stateFile.source, 'flag');
    assert.equal(ok.stateFile.path, path.join(await fs.realpath(cache), 'estado.json'));
    assert.equal(ok.limits.maxStateBytes, MAX_STATE_BYTES);

    /* Sem cacheDir configurado: recusa (o checkpoint mora no cache privado). */
    assert.throws(
      () => parseStartupConfig({argv: ['--state-file', path.join(cache, 'estado.json')], env: {}}),
      (error) => error.code === 'STARTUP_INVALID' && /cache-dir|cacheDir/.test(error.message),
    );
    /* Fora do cache (inclusive subpasta): recusa. */
    for (const target of [path.join(base, 'fora.json'), path.join(cache, 'sub', 'estado.json')]) {
      assert.throws(
        () => parseStartupConfig({argv: ['--cache-dir', cache, '--state-file', target], env: {}}),
        (error) => error.code === 'STARTUP_INVALID',
        `${target} precisa recusar`,
      );
    }
    /* Extensão: só .json. */
    assert.throws(
      () => parseStartupConfig({argv: ['--cache-dir', cache, '--state-file', path.join(cache, 'estado.txt')], env: {}}),
      (error) => error.code === 'STARTUP_INVALID' && /\.json/.test(error.message),
    );
    /* Symlink existente nunca é seguido. */
    const alvo = path.join(base, 'alvo.json');
    await fs.writeFile(alvo, '{}');
    const link = path.join(cache, 'link.json');
    await fs.symlink(alvo, link);
    assert.throws(
      () => parseStartupConfig({argv: ['--cache-dir', cache, '--state-file', link], env: {}}),
      (error) => error.code === 'STARTUP_INVALID' && /symlink/.test(error.message),
    );

    /* Env equivalente; flag vence env inválido. */
    const byEnv = parseStartupConfig({
      argv: ['--cache-dir', cache],
      env: {MESA_STUDY_STATE_FILE: path.join(cache, 'estado.json')},
    }).config;
    assert.equal(byEnv.stateFile.source, 'env');
    const flagWins = parseStartupConfig({
      argv: ['--cache-dir', cache, '--state-file', path.join(cache, 'estado.json')],
      env: {MESA_STUDY_STATE_FILE: path.join(base, 'fora.json')},
    }).config;
    assert.equal(flagWins.stateFile.source, 'flag');
    assert.equal(flagWins.stateFile.path, path.join(await fs.realpath(cache), 'estado.json'));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: status/context diagnosticam configurado×disponível; sem flag nada é gravado', async () => {
  const base = await tempBase('mesa state diag ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const stateFile = path.join(cache, 'estado.json');
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      const status = payloadOf(await session.call('mesa_status'));
      assert.equal(status.persistence.configured, true);
      assert.equal(status.persistence.source, 'flag');
      assert.equal(status.persistence.path, path.join(await fs.realpath(cache), 'estado.json'));
      assert.equal(status.persistence.available, true);
      assert.equal(status.persistence.state, 'missing');
      assert.deepEqual(status.persistence.checkpoint, {present: false});
      assert.match(status.persistence.concurrency, /última gravação bem-sucedida vence/);
      assert.ok(!JSON.stringify(status).includes('snapshotPath'));

      const context = payloadOf(await session.call('mesa_context'));
      assert.equal(context.resumeCandidate, null);
      assert.equal(context.context.page, null);
      assert.equal(context.context.capture, null);
      assert.equal(context.persistence.state, 'missing');
      assert.equal(context.persistence.operation, null);
      assert.equal(await fs.stat(stateFile).then(() => true, () => false), false, 'diagnóstico não cria o checkpoint');
    } finally {
      await session.close();
    }

    /* Sem --state-file: nada de persistência e nada é gravado. */
    const plain = await connectInProcess(configFor({root, cache}));
    try {
      const plainStatus = payloadOf(await plain.call('mesa_status'));
      assert.equal(plainStatus.persistence.configured, false);
      assert.equal(plainStatus.persistence.state, null);
      assert.equal(plainStatus.persistence.operation, null);
      const set = payloadOf(await plain.call('mesa_context', {action: 'set', note: 'sem checkpoint'}));
      assert.equal(set.persistence.configured, false);
      assert.equal(set.persistence.operation.saved, null);
      assert.equal(set.context.note, 'sem checkpoint');
      assert.deepEqual(await fs.readdir(cache), [], 'sem flag, nenhum arquivo novo no cache');
    } finally {
      await plain.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: set grava JSON pequeno 0600 atômico, só referências permitidas', async () => {
  const base = await tempBase('mesa state shape ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const stateFile = path.join(cache, 'estado.json');
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      const result = await session.call('mesa_context', {action: 'set', note: 'revisar limites'});
      assert.equal(result.isError, undefined);
      const meta = payloadOf(result);
      assert.equal(meta.persistence.operation.action, 'set');
      assert.equal(meta.persistence.operation.saved, true);
      assert.equal(meta.persistence.operation.error, null);
      assert.ok(meta.persistence.operation.savedAt);

      const raw = await fs.readFile(stateFile, 'utf8');
      const parsed = JSON.parse(raw);
      assert.deepEqual(Object.keys(parsed).sort(), ['kind', 'note', 'page', 'updatedAt', 'version']);
      assert.equal(parsed.version, STATE_VERSION);
      assert.equal(parsed.kind, STATE_KIND);
      assert.equal(parsed.page, null);
      assert.equal(parsed.note, 'revisar limites');
      assert.ok(Buffer.byteLength(raw, 'utf8') <= MAX_STATE_BYTES);
      assert.equal((await fs.stat(stateFile)).mode & 0o777, 0o600, 'checkpoint 0600');
      const entries = await fs.readdir(cache);
      assert.ok(!entries.some((name) => name.endsWith('.tmp')), 'sem temporário órfão');

      /* O ativo do processo continua a nota; o candidato sem página é explícito. */
      const context = payloadOf(await session.call('mesa_context'));
      assert.equal(context.context.note, 'revisar limites');
      assert.equal(context.resumeCandidate.available, false);
      assert.equal(context.resumeCandidate.reason, 'no-page');
      assert.equal(context.resumeCandidate.note, 'revisar limites');
      assert.equal(context.persistence.checkpoint.present, true);
      assert.ok(contextResultHasNoImage(await session.call('mesa_context')));
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

function contextResultHasNoImage(result) {
  return (result.content || []).every((block) => block.type !== 'image');
}

test('checkpoint: cacheDir ausente é criado 0700 no primeiro set; checkpoint 0600', async () => {
  const base = await tempBase('mesa state cache novo ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache-ainda-nao-existe');
  await fs.mkdir(root);
  try {
    const stateFile = path.join(cache, 'estado.json');
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      const status = payloadOf(await session.call('mesa_status'));
      assert.equal(status.persistence.configured, true);
      assert.equal(status.persistence.available, true);
      assert.equal(status.persistence.state, 'missing');
      assert.equal(await fs.stat(cache).then(() => true, () => false), false, 'status não cria o cache');

      const set = payloadOf(await session.call('mesa_context', {action: 'set', note: 'primeiro checkpoint'}));
      assert.equal(set.persistence.operation.saved, true);
      assert.equal((await fs.stat(cache)).mode & 0o777, 0o700, 'cache criado 0700');
      assert.equal((await fs.stat(stateFile)).mode & 0o777, 0o600, 'checkpoint 0600');
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: corrompido/tampered/oversize é ignorado com erro claro, sem imagem de fallback', async () => {
  const base = await tempBase('mesa state corrupt ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const stateFile = path.join(cache, 'estado.json');
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      /* JSON quebrado. */
      await fs.writeFile(stateFile, '{');
      const broken = await session.call('mesa_context');
      const brokenMeta = payloadOf(broken);
      assert.equal(brokenMeta.resumeCandidate.state, 'invalid');
      assert.equal(brokenMeta.resumeCandidate.available, false);
      assert.equal(brokenMeta.resumeCandidate.error.code, 'STATE_INVALID');
      assert.equal(brokenMeta.context.page, null);
      assert.equal(brokenMeta.context.capture, null);
      assert.ok(contextResultHasNoImage(broken));

      /* Campo extra (captura/imagem/histórico) recusa o arquivo inteiro. */
      await fs.writeFile(stateFile, JSON.stringify({
        ...checkpointFile({pdfPath: null}),
        capture: {windowId: '3', snapshotPath: '/nao/deve/vazar.png'},
        history: ['a'],
      }));
      const tampered = await session.call('mesa_context');
      const tamperedMeta = payloadOf(tampered);
      assert.equal(tamperedMeta.resumeCandidate.state, 'invalid');
      assert.match(tamperedMeta.resumeCandidate.error.message, /capture/);
      assert.ok(!JSON.stringify(tampered).includes('/nao/deve/vazar.png'));
      assert.ok(!JSON.stringify(tampered).includes('windowId'));
      assert.ok(contextResultHasNoImage(tampered));

      /* Acima do teto. */
      await fs.writeFile(stateFile, Buffer.alloc(MAX_STATE_BYTES + 1, 0x78));
      const oversize = payloadOf(await session.call('mesa_context'));
      assert.equal(oversize.resumeCandidate.state, 'oversize');
      assert.equal(oversize.resumeCandidate.available, false);
      assert.equal(oversize.resumeCandidate.error.code, 'STATE_OVERSIZE');
      const oversizeStatus = payloadOf(await session.call('mesa_status'));
      assert.equal(oversizeStatus.persistence.state, 'oversize');
      assert.equal(oversizeStatus.persistence.available, false);
      assert.equal(oversizeStatus.persistence.checkpoint.present, false);

      /* Um set explícito sobrescreve o lixo com checkpoint válido. */
      const repaired = payloadOf(await session.call('mesa_context', {action: 'set', note: 'volta limpo'}));
      assert.equal(repaired.persistence.operation.saved, true);
      assert.equal(repaired.resumeCandidate.state, 'ready');
      assert.equal(repaired.resumeCandidate.note, 'volta limpo');
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: reinício só oferece resumeCandidate; raiz trocada/outra raiz recusam claramente', async () => {
  const base = await tempBase('mesa state resume ');
  const rootA = path.join(base, 'raizA');
  const rootOutra = path.join(base, 'raizOutra');
  const cache = path.join(base, 'cache');
  await fs.mkdir(rootA);
  await fs.mkdir(rootOutra);
  await fs.mkdir(cache);
  try {
    const pdf = path.join(rootA, 'doc-sintetico.pdf');
    await fs.writeFile(pdf, '%PDF-1.4\n% sintético\n');
    const pdfReal = await fs.realpath(pdf);
    const stateFile = path.join(cache, 'estado.json');
    await fs.writeFile(stateFile, JSON.stringify(checkpointFile({pdfPath: pdfReal, page: 3, note: 'retomar daqui'})));

    const session = await connectInProcess(configFor({root: rootA, cache, stateFile}));
    try {
      const context = payloadOf(await session.call('mesa_context'));
      assert.equal(context.context.page, null, 'reinício NUNCA restaura context.page');
      assert.equal(context.context.note, null, 'reinício não restaura nota ativa');
      assert.equal(context.context.capture, null, 'reinício nunca restaura captura');
      assert.equal(context.resumeCandidate.available, true);
      assert.equal(context.resumeCandidate.page, 3);
      assert.equal(context.resumeCandidate.document.path, pdfReal);
      assert.equal(context.resumeCandidate.note, 'retomar daqui');
      assert.match(context.resumeCandidate.provenance, /nunca.*automaticamente|nenhuma imagem/i);

      /* Troca a raiz congelada por symlink: o candidato deixa de ser retomável. */
      const rootB = path.join(base, 'raizB');
      await fs.rename(rootA, rootB);
      await fs.symlink(rootB, rootA);
      const changed = payloadOf(await session.call('mesa_context'));
      assert.equal(changed.resumeCandidate.available, false);
      assert.equal(changed.resumeCandidate.reason, 'roots-changed');
      assert.equal(changed.resumeCandidate.page, 3, 'a referência continua visível, mas não retomável');
      assert.ok((await session.call('mesa_context')).content.every((block) => block.type !== 'image'));
    } finally {
      await session.close();
    }

    /* Outra raiz válida (sem o documento) recusa sem tocar no arquivo. */
    const other = await connectInProcess(configFor({root: rootOutra, cache, stateFile}));
    try {
      const context = payloadOf(await other.call('mesa_context'));
      assert.equal(context.resumeCandidate.available, false);
      assert.equal(context.resumeCandidate.reason, 'outside-roots');
      assert.equal(context.context.page, null);
    } finally {
      await other.close();
    }

    /* Caminho absoluto fora das raízes no checkpoint (tampered) também recusa. */
    await fs.writeFile(stateFile, JSON.stringify(checkpointFile({pdfPath: '/etc/hosts', page: 1})));
    const tampered = await connectInProcess(configFor({root: rootOutra, cache, stateFile}));
    try {
      const context = payloadOf(await tampered.call('mesa_context'));
      assert.equal(context.resumeCandidate.available, false);
      assert.equal(context.resumeCandidate.reason, 'outside-roots');
    } finally {
      await tampered.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: render grava referência; reinício exige mesa_page explícito para retomar', {skip: pdfSkip}, async () => {
  const base = await tempBase('mesa state render ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const pdf = path.join(root, 'exercicio sintetico.pdf');
    await fs.writeFile(pdf, makeSyntheticPdf({pages: 2}));
    const pdfReal = await fs.realpath(pdf);
    const stateFile = path.join(cache, 'estado.json');
    const config = configFor({root, cache, stateFile});

    const first = await connectInProcess(config);
    try {
      const rendered = await first.call('mesa_page', {filePath: pdf, page: 2});
      assert.equal(rendered.isError, undefined);
      const meta = payloadOf(rendered);
      assert.equal(meta.context.persistence.configured, true);
      assert.equal(meta.context.persistence.saved, true);
      assert.equal(meta.context.persistence.error, null);
      const stored = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      assert.deepEqual(stored.page, {path: pdfReal, page: 2});
      assert.equal(stored.note, null);
      assert.ok(!('snapshotPath' in stored) && !('capture' in stored) && !('image' in stored));
      const live = payloadOf(await first.call('mesa_context'));
      assert.equal(live.resumeCandidate.available, true);
      assert.equal(live.resumeCandidate.page, 2);
    } finally {
      await first.close();
    }

    /* "Reinício": processo/sessão nova, mesmo config. Nada de página ativa. */
    const second = await connectInProcess(config);
    try {
      const contextResult = await second.call('mesa_context');
      const context = payloadOf(contextResult);
      assert.equal(context.context.page, null);
      assert.equal(context.context.capture, null);
      assert.equal(context.resumeCandidate.available, true);
      assert.equal(context.resumeCandidate.page, 2);
      assert.equal(context.resumeCandidate.document.path, pdfReal);
      assert.ok(contextResultHasNoImage(contextResult));

      const opened = await second.call('mesa_open');
      assert.equal(opened.isError, undefined);
      assert.equal(opened.structuredContent.page, null, 'mesa_open sem filePath não restaura página');
      assert.equal(opened.structuredContent.status.persistence.checkpoint.present, true);
      assert.equal(opened.structuredContent.status.persistence.checkpoint.resumable, true);

      /* Retomada explícita: mesa_page refaz todas as checagens. */
      const resumed = await second.call('mesa_page', {
        filePath: context.resumeCandidate.document.path,
        page: context.resumeCandidate.page,
      });
      assert.equal(resumed.isError, undefined);
      assert.equal(payloadOf(resumed).source.page, 2);
      assert.equal(payloadOf(await second.call('mesa_context')).context.page.page, 2);
    } finally {
      await second.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: falha de persistência não derruba a operação nem mente "salvo"', {skip: rootSkip}, async () => {
  const base = await tempBase('mesa state hard ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const stateFile = path.join(cache, 'estado.json');
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      await fs.chmod(cache, 0o500);
      const result = await session.call('mesa_context', {action: 'set', note: 'nota com cache sem escrita'});
      assert.equal(result.isError, undefined, 'a nota não pode falhar por causa do checkpoint');
      const meta = payloadOf(result);
      assert.equal(meta.context.note, 'nota com cache sem escrita');
      assert.equal(meta.persistence.operation.saved, false);
      assert.equal(meta.persistence.operation.savedAt, null);
      assert.ok(meta.persistence.operation.error);
      assert.match(meta.persistence.operation.error.code, /^STATE_/);
      assert.equal(await fs.stat(stateFile).then(() => true, () => false), false);
    } finally {
      await fs.chmod(cache, 0o700);
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: render continua sucesso com checkpoint symlink; clear recusa e não segue o link', {skip: pdfSkip}, async () => {
  const base = await tempBase('mesa state symlink ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const pdf = path.join(root, 'doc.pdf');
    await fs.writeFile(pdf, makeSyntheticPdf({pages: 1}));
    const stateFile = path.join(cache, 'estado.json');
    const alvo = path.join(base, 'alvo.json');
    await fs.writeFile(alvo, '{"intacto":true}');
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      /* Symlink criado DEPOIS do startup (o startup aceitou o caminho). */
      await fs.symlink(alvo, stateFile);
      const rendered = await session.call('mesa_page', {filePath: pdf, page: 1});
      assert.equal(rendered.isError, undefined, 'falha de persistência não pode virar falha do render');
      assert.ok((rendered.content || []).some((block) => block.type === 'image'), 'a imagem do render continua');
      const meta = payloadOf(rendered);
      assert.equal(meta.context.persistence.saved, false);
      assert.equal(meta.context.persistence.error.code, 'STATE_SYMLINK');
      assert.equal(await fs.readFile(alvo, 'utf8'), '{"intacto":true}', 'o symlink não é seguido nem sobrescrito');

      const contextResult = await session.call('mesa_context');
      const context = payloadOf(contextResult);
      assert.equal(context.resumeCandidate.available, false);
      assert.equal(context.resumeCandidate.state, 'symlink');
      assert.equal(context.resumeCandidate.error.code, 'STATE_SYMLINK');
      assert.ok(contextResultHasNoImage(contextResult));

      const cleared = payloadOf(await session.call('mesa_context', {action: 'clear'}));
      assert.equal(cleared.context.page, null);
      assert.equal(cleared.persistence.operation.cleared, false);
      assert.equal(cleared.persistence.operation.error.code, 'STATE_SYMLINK');
      assert.equal(await fs.readFile(alvo, 'utf8'), '{"intacto":true}');
      assert.equal((await fs.lstat(stateFile)).isSymbolicLink(), true);
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: clear apaga SÓ o checkpoint explicitamente; resto do cache fica intacto', async () => {
  const base = await tempBase('mesa state clear ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const stateFile = path.join(cache, 'estado.json');
    const outro = path.join(cache, 'outro-arquivo.json');
    await fs.writeFile(outro, '{"preservar":true}');
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      await session.call('mesa_context', {action: 'set', note: 'vai sumir'});
      assert.equal(await fs.stat(stateFile).then(() => true, () => false), true);

      const cleared = payloadOf(await session.call('mesa_context', {action: 'clear'}));
      assert.equal(cleared.persistence.operation.action, 'clear');
      assert.equal(cleared.persistence.operation.cleared, true);
      assert.equal(cleared.persistence.operation.removed, true);
      assert.equal(cleared.context.note, null);
      assert.equal(await fs.stat(stateFile).then(() => true, () => false), false, 'checkpoint removido');
      assert.equal(await fs.readFile(outro, 'utf8'), '{"preservar":true}', 'outro arquivo do cache intacto');
      assert.equal(cleared.resumeCandidate, null);
      assert.equal(cleared.persistence.state, 'missing');

      /* clear sem checkpoint existente é idempotente e honesto. */
      const again = payloadOf(await session.call('mesa_context', {action: 'clear'}));
      assert.equal(again.persistence.operation.cleared, true);
      assert.equal(again.persistence.operation.removed, false);
      assert.equal(await fs.readFile(outro, 'utf8'), '{"preservar":true}');
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* --- F1: confinamento do candidato por lexical + realpath, sem lstat externo --- */

function fakeLeaf({dev = 1, ino = 1, size = 0, mtimeMs = 1700000000000, symlink = false, kind = 'file'} = {}) {
  return {
    dev,
    ino,
    size,
    mtimeMs,
    isSymbolicLink: () => symlink,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'directory',
  };
}

test('resumeCandidate: `..` textual e symlink de diretório fora da raiz recusam antes de qualquer lstat', async () => {
  const base = await tempBase('mesa cand confine ');
  const root = path.join(base, 'raiz');
  const fora = path.join(base, 'fora');
  await fs.mkdir(root);
  await fs.mkdir(fora);
  try {
    await fs.writeFile(path.join(fora, 'alvo.pdf'), '%PDF-1.4\n% sintético\n');
    await fs.symlink(fora, path.join(root, 'atalho'));
    const rootReal = await fs.realpath(root);
    const lstatCalls = [];
    const io = {
      lstat: async (target) => {
        lstatCalls.push(target);
        return fs.lstat(target);
      },
      realpath: (target) => fs.realpath(target),
    };
    const checkpointFor = (docPath) => ({
      updatedAt: new Date().toISOString(),
      page: {path: docPath, page: 1},
      note: null,
    });

    /* `..` textual: recusa LEXICAL, sem tocar no filesystem do documento. */
    const dotdotPath = `${rootReal}/../fora/alvo.pdf`;
    const dotdot = await evaluateCandidate({checkpoint: checkpointFor(dotdotPath), roots: [rootReal], io});
    assert.equal(dotdot.available, false);
    assert.equal(dotdot.reason, 'outside-roots');
    assert.equal(lstatCalls.length, 0, 'nada de lstat para caminho lexical fora das raízes');
    assert.equal(dotdot.document.path, path.join(path.dirname(rootReal), 'fora', 'alvo.pdf'));

    /* Symlink de DIRETÓRIO dentro da raiz apontando para fora: o lexical passa,
       o realpath escapa e a recusa continua ANTES do lstat. */
    const viaLink = await evaluateCandidate({
      checkpoint: checkpointFor(path.join(rootReal, 'atalho', 'alvo.pdf')),
      roots: [rootReal],
      io,
    });
    assert.equal(viaLink.available, false);
    assert.equal(viaLink.reason, 'outside-roots');
    assert.equal(lstatCalls.length, 0, 'nada de lstat para alvo de symlink fora das raízes');
    assert.equal(viaLink.document.path, await fs.realpath(path.join(fora, 'alvo.pdf')));

    /* Caminho válido continua available:ready e usa o caminho resolvido. */
    const real = path.join(rootReal, 'doc.pdf');
    await fs.writeFile(real, '%PDF-1.4\n% sintético\n');
    const ok = await evaluateCandidate({checkpoint: checkpointFor(real), roots: [rootReal], io});
    assert.equal(ok.available, true);
    assert.equal(ok.reason, 'ready');
    assert.equal(ok.document.path, await fs.realpath(real));
    assert.equal(ok.document.name, 'doc.pdf');
    assert.equal(lstatCalls.at(-1), await fs.realpath(real), 'o lstat é só do caminho já confinado');

    /* `..` interno normaliza e continua ready. */
    const normalized = await evaluateCandidate({
      checkpoint: checkpointFor(`${rootReal}/sub/../doc.pdf`),
      roots: [rootReal],
      io,
    });
    assert.equal(normalized.reason, 'ready');
    assert.equal(normalized.document.path, await fs.realpath(real));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('checkpoint: caminho tampered não vira candidato e mesa_page recusa o mesmo caminho', async () => {
  const base = await tempBase('mesa cand mesa ');
  const root = path.join(base, 'raiz');
  const fora = path.join(base, 'fora');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(fora);
  await fs.mkdir(cache);
  try {
    await fs.writeFile(path.join(fora, 'alvo.pdf'), '%PDF-1.4\n% sintético\n');
    await fs.symlink(fora, path.join(root, 'atalho'));
    const rootReal = await fs.realpath(root);
    const stateFile = path.join(cache, 'estado.json');

    for (const [label, tampered] of [
      ['.. textual', `${rootReal}/../fora/alvo.pdf`],
      ['symlink interno', path.join(rootReal, 'atalho', 'alvo.pdf')],
    ]) {
      await fs.writeFile(stateFile, JSON.stringify(checkpointFile({pdfPath: tampered, page: 1})));
      const session = await connectInProcess(configFor({root: rootReal, cache, stateFile}));
      try {
        const context = payloadOf(await session.call('mesa_context'));
        assert.equal(context.resumeCandidate.available, false, label);
        assert.equal(context.resumeCandidate.reason, 'outside-roots', label);
        const page = await session.call('mesa_page', {filePath: tampered, page: 1});
        assert.equal(page.isError, true, `${label}: mesa_page precisa recusar`);
        const error = JSON.parse(page.content[0].text);
        assert.equal(error.error.code, 'PATH_OUTSIDE_ROOTS', label);
      } finally {
        await session.close();
      }
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* --- F3: cacheDir inseguro não é lido nem vira candidato --- */

test('checkpoint: cacheDir 0777 não é lido, nem vira candidato; set falha sem mentir', async () => {
  const base = await tempBase('mesa state cacheperm ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const pdf = path.join(root, 'doc.pdf');
    await fs.writeFile(pdf, '%PDF-1.4\n');
    const stateFile = path.join(cache, 'estado.json');
    /* Conteúdo inválido de propósito: se o gate não existisse, o candidato
       sairia daqui como `invalid`; cache-unavailable prova que nada foi lido. */
    await fs.writeFile(stateFile, '{isto não é um checkpoint');
    await fs.chmod(cache, 0o777);
    const session = await connectInProcess(configFor({root, cache, stateFile}));
    try {
      const context = payloadOf(await session.call('mesa_context'));
      assert.equal(context.resumeCandidate.available, false);
      assert.equal(context.resumeCandidate.state, 'cache-unavailable');
      assert.equal(context.resumeCandidate.reason, 'cache-unavailable');
      assert.equal(context.resumeCandidate.error.code, 'STATE_CACHE_UNAVAILABLE');
      assert.equal(context.persistence.available, false);
      assert.equal(context.persistence.state, 'cache-unavailable');
      assert.equal(context.persistence.checkpoint.present, false);

      const status = payloadOf(await session.call('mesa_status'));
      assert.equal(status.persistence.available, false);
      assert.equal(status.persistence.state, 'cache-unavailable');
      assert.equal(status.persistence.checkpoint.present, false);
      assert.equal(status.persistence.error.code, 'STATE_CACHE_UNAVAILABLE');

      const set = payloadOf(await session.call('mesa_context', {action: 'set', note: 'não grava'}));
      assert.equal(set.context.note, 'não grava', 'a nota da sessão não depende do checkpoint');
      assert.equal(set.persistence.operation.saved, false);
      assert.equal(set.persistence.operation.error.code, 'CACHE_DIR_PERMISSIONS');
    } finally {
      await fs.chmod(cache, 0o700);
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* --- F2: leitura limitada do checkpoint (descritor + maxBytes+1) --- */

test('checkpoint: leitura limitada recusa crescimento e troca de identidade sem corpo', async () => {
  const base = await tempBase('mesa state bounded ');
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache);
  try {
    const stateFile = path.join(cache, 'estado.json');
    await fs.writeFile(stateFile, JSON.stringify(checkpointFile({pdfPath: null, note: 'x'})));

    const crescimento = fakeLeaf({dev: 1, ino: 2, size: 4});
    const ioCresce = {
      lstat: (target) => (target === cache ? fakeLeaf({kind: 'directory'}) : crescimento),
      realpath: async (target) => fs.realpath(target),
      open: async () => ({
        stat: async () => crescimento,
        read: async (buffer, offset, length) => {
          buffer.fill(0x78, offset, offset + length);
          return {bytesRead: length};
        },
        close: async () => {},
      }),
    };
    const oversize = await loadCheckpoint({stateFile, cacheDir: cache, io: ioCresce});
    assert.equal(oversize.state, 'oversize');
    assert.equal(oversize.checkpoint, null);
    assert.equal(oversize.error.code, 'STATE_OVERSIZE');

    const antes = fakeLeaf({dev: 1, ino: 10, size: 4});
    const depois = fakeLeaf({dev: 1, ino: 11, size: 4});
    let reads = 0;
    const ioTroca = {
      lstat: (target) => (target === cache ? fakeLeaf({kind: 'directory'}) : antes),
      realpath: async (target) => fs.realpath(target),
      open: async () => ({
        stat: async () => depois,
        read: async () => {
          reads += 1;
          return {bytesRead: 0};
        },
        close: async () => {},
      }),
    };
    const changed = await loadCheckpoint({stateFile, cacheDir: cache, io: ioTroca});
    assert.equal(changed.state, 'changed');
    assert.equal(changed.checkpoint, null);
    assert.equal(changed.error.code, 'STATE_CHANGED');
    assert.equal(reads, 0, 'identidade trocada não lê conteúdo');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* --- F4: nota do checkpoint sobrevive à retomada explícita do MESMO doc+página --- */

test('checkpoint: render do MESMO documento+página após reinício preserva a nota; outro documento não herda', {skip: pdfSkip}, async () => {
  const base = await tempBase('mesa state note ');
  const root = path.join(base, 'raiz');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const pdf = path.join(root, 'doc.pdf');
    const outro = path.join(root, 'outro.pdf');
    await fs.writeFile(pdf, makeSyntheticPdf({pages: 2}));
    await fs.writeFile(outro, makeSyntheticPdf({pages: 1}));
    const pdfReal = await fs.realpath(pdf);
    const stateFile = path.join(cache, 'estado.json');
    const config = configFor({root, cache, stateFile});

    const first = await connectInProcess(config);
    try {
      const rendered = payloadOf(await first.call('mesa_page', {filePath: pdf, page: 2}));
      assert.equal(rendered.context.persistence.saved, true);
      const annotated = payloadOf(await first.call('mesa_context', {action: 'set', note: 'retomar daqui'}));
      assert.equal(annotated.persistence.operation.saved, true);
      const stored = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      assert.deepEqual(stored.page, {path: pdfReal, page: 2});
      assert.equal(stored.note, 'retomar daqui');
    } finally {
      await first.close();
    }

    /* Reinício: retomada explícita do MESMO doc+página preserva a nota no
       checkpoint, sem virar nota ativa do processo nem restaurar captura. */
    const second = await connectInProcess(config);
    try {
      const context = payloadOf(await second.call('mesa_context'));
      assert.equal(context.context.note, null, 'a nota não vira ativa sozinha');
      assert.equal(context.resumeCandidate.note, 'retomar daqui');
      assert.equal(context.resumeCandidate.available, true);

      const resumed = payloadOf(await second.call('mesa_page', {filePath: pdf, page: 2}));
      assert.equal(resumed.source.page, 2);
      assert.equal(resumed.context.persistence.saved, true);
      const stored = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      assert.deepEqual(stored.page, {path: pdfReal, page: 2});
      assert.equal(stored.note, 'retomar daqui', 'mesmo doc+página preserva a nota antiga');
      const after = payloadOf(await second.call('mesa_context'));
      assert.equal(after.context.note, null, 'a nota persiste no disco, não vira nota ativa');
      assert.equal(after.context.capture, null);
    } finally {
      await second.close();
    }

    /* Outra PÁGINA do mesmo documento não herda a nota. */
    const third = await connectInProcess(config);
    try {
      assert.equal(payloadOf(await third.call('mesa_context')).resumeCandidate.note, 'retomar daqui');
      await third.call('mesa_page', {filePath: pdf, page: 1});
      let stored = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      assert.deepEqual(stored.page, {path: pdfReal, page: 1});
      assert.equal(stored.note, null, 'outra página não herda a nota antiga');

      /* Reanota a página 2; a sessão seguinte (nota ativa nula) é que prova
         que outro DOCUMENTO não herda a nota guardada. */
      await third.call('mesa_page', {filePath: pdf, page: 2});
      await third.call('mesa_context', {action: 'set', note: 'nota do doc A'});
      stored = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      assert.deepEqual(stored.page, {path: pdfReal, page: 2});
      assert.equal(stored.note, 'nota do doc A');
    } finally {
      await third.close();
    }

    const fourth = await connectInProcess(config);
    try {
      assert.equal(payloadOf(await fourth.call('mesa_context')).context.note, null);
      await fourth.call('mesa_page', {filePath: outro, page: 1});
      const stored = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      assert.deepEqual(stored.page, {path: await fs.realpath(outro), page: 1});
      assert.equal(stored.note, null, 'outro documento não herda a nota antiga');
    } finally {
      await fourth.close();
    }

    /* action=clear continua apagando só o checkpoint. */
    const fifth = await connectInProcess(config);
    try {
      const cleared = payloadOf(await fifth.call('mesa_context', {action: 'clear'}));
      assert.equal(cleared.persistence.operation.cleared, true);
      assert.equal(await fs.stat(stateFile).then(() => true, () => false), false);
    } finally {
      await fifth.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});
