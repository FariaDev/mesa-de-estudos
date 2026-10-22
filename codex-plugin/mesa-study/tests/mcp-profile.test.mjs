/* Perfis de estudo opt-in (--tutor-file/--learner-file e envs):
   - startup congela caminho canônico e recusa symlink/diretório/acima do teto/
     não-UTF8 (STARTUP_INVALID), sem varrer diretório;
   - mesa_context expõe texto + metadados SÓ dos arquivos autorizados;
     mesa_status mostra configurado/disponível/erro SEM corpo;
   - troca depois do startup (symlink/identidade) é recusada sem corpo e sem
     log; arquivo regular novo no mesmo caminho é relido;
   - sem flags, nada muda (nenhum perfil configurado).
   Fixtures sintéticas; nada de material pessoal ou de curso. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {parseStartupConfig, usageText} from '../server/config.mjs';
import {createMcpServer} from '../server/server.mjs';
import {MAX_PROFILE_BYTES, inspectProfilePathSync, readProfile} from '../server/profiles.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'server', 'main.mjs');

async function tempBase(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function payloadOf(result) {
  const block = (result.content || []).find((item) => item.type === 'text');
  return JSON.parse(block.text);
}

async function connectInProcess(config) {
  const {server} = createMcpServer({config});
  const client = new Client({name: 'mesa-profile-inproc', version: '0.0.0'});
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

async function connectStdio({args = [], env = {}} = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER, ...args],
    env: {...env},
    stderr: 'pipe',
    cwd: ROOT,
  });
  const stderrChunks = [];
  const client = new Client({name: 'mesa-profile-stdio', version: '0.0.0'});
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

test('perfis: flags congelam o canônico; env equivalente; flag vence env; ausente nos dois', async () => {
  const base = await tempBase('mesa profile cfg ');
  try {
    const tutor = path.join(base, 'TUTOR.md');
    const learner = path.join(base, 'LEARNER.md');
    await fs.writeFile(tutor, '# Tutor\n');
    await fs.writeFile(learner, '# Learner\n');

    const byFlag = parseStartupConfig({argv: ['--tutor-file', tutor, '--learner-file', learner], env: {}}).config;
    assert.equal(byFlag.studyProfile.tutor.configured, true);
    assert.equal(byFlag.studyProfile.tutor.source, 'flag');
    assert.equal(byFlag.studyProfile.tutor.state, 'ready');
    assert.equal(byFlag.studyProfile.tutor.path, await fs.realpath(tutor));
    assert.equal(byFlag.studyProfile.learner.source, 'flag');
    assert.equal(byFlag.limits.maxProfileBytes, MAX_PROFILE_BYTES);

    const byEnv = parseStartupConfig({
      argv: [],
      env: {MESA_STUDY_TUTOR_FILE: tutor, MESA_STUDY_LEARNER_FILE: learner},
    }).config;
    assert.equal(byEnv.studyProfile.tutor.source, 'env');
    assert.equal(byEnv.studyProfile.learner.source, 'env');
    assert.equal(byEnv.studyProfile.tutor.path, await fs.realpath(tutor));

    /* Flag vence o ambiente DE VERDADE: com --tutor-file válido, um env
       inexistente/inválido nem é lido. */
    const flagWins = parseStartupConfig({
      argv: ['--tutor-file', tutor],
      env: {MESA_STUDY_TUTOR_FILE: path.join(base, 'nao-existe.md')},
    }).config;
    assert.equal(flagWins.studyProfile.tutor.source, 'flag');
    assert.equal(flagWins.studyProfile.tutor.state, 'ready');

    const none = parseStartupConfig({argv: [], env: {}}).config;
    assert.deepEqual(none.studyProfile.tutor, {configured: false, path: null, source: 'none', state: null});
    assert.deepEqual(none.studyProfile.learner, {configured: false, path: null, source: 'none', state: null});

    /* Ajuda menciona as flags e as envs novas (o parser e a ajuda andam juntos). */
    const help = usageText();
    for (const token of ['--tutor-file', '--learner-file', '--state-file', 'MESA_STUDY_TUTOR_FILE', 'MESA_STUDY_STATE_FILE']) {
      assert.ok(help.includes(token), `ajuda precisa citar ${token}`);
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('perfis: startup recusa symlink, diretório, acima do teto e não-UTF8; ausente é aceito', async () => {
  const base = await tempBase('mesa profile recusa ');
  try {
    const real = path.join(base, 'REAL.md');
    await fs.writeFile(real, '# Tutor real\n');
    const link = path.join(base, 'LINK.md');
    await fs.symlink(real, link);
    const dir = path.join(base, 'PASTA.md');
    await fs.mkdir(dir);
    const big = path.join(base, 'BIG.md');
    await fs.writeFile(big, Buffer.alloc(MAX_PROFILE_BYTES + 1, 0x61));
    const bad = path.join(base, 'BAD.md');
    await fs.writeFile(bad, Buffer.from([0xff, 0xfe, 0x00, 0x80]));

    for (const [label, target] of [['symlink', link], ['diretório', dir], ['acima do teto', big], ['não-UTF8', bad]]) {
      assert.throws(
        () => parseStartupConfig({argv: ['--tutor-file', target], env: {}}),
        (error) => error.code === 'STARTUP_INVALID' && /tutor-file/.test(error.message),
        `${label} precisa recusar STARTUP_INVALID`,
      );
    }

    const missing = path.join(base, 'AINDA NAO EXISTE.md');
    const accepted = parseStartupConfig({argv: ['--tutor-file', missing], env: {}}).config;
    assert.equal(accepted.studyProfile.tutor.configured, true);
    assert.equal(accepted.studyProfile.tutor.state, 'missing');
    assert.equal(accepted.studyProfile.tutor.path, path.join(await fs.realpath(base), 'AINDA NAO EXISTE.md'));
    assert.equal(await fs.stat(missing).then(() => true, () => false), false, 'o startup não cria o arquivo');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('perfis: mesa_context expõe texto e metadados SÓ dos autorizados; mesa_status nunca tem corpo', async () => {
  const base = await tempBase('mesa profile corpo ');
  try {
    const tutorText = '# Tutor\nsegredo-tutor-unico-α\n';
    const learnerText = '# Learner\nsegredo-learner-unico-β\n';
    const tutor = path.join(base, 'TUTOR.md');
    const learner = path.join(base, 'LEARNER.md');
    const outro = path.join(base, 'OUTRO.md');
    await fs.writeFile(tutor, tutorText);
    await fs.writeFile(learner, learnerText);
    await fs.writeFile(outro, '# externo\nsegredo-nao-autorizado-γ\n');
    const config = parseStartupConfig({argv: ['--tutor-file', tutor, '--learner-file', learner], env: {}}).config;
    const session = await connectInProcess(config);
    try {
      const status = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
      assert.equal(status.studyProfile.frozenAtStartup, true);
      assert.equal(status.studyProfile.files.tutor.available, true);
      assert.equal(status.studyProfile.files.tutor.state, 'ready');
      assert.equal(status.studyProfile.files.learner.available, true);
      assert.equal('text' in status.studyProfile.files.tutor, false, 'status não pode ter corpo');
      assert.equal('sha256' in status.studyProfile.files.tutor, false);
      assert.equal('bytes' in status.studyProfile.files.tutor, false);
      assert.ok(!JSON.stringify(status).includes('segredo-tutor-unico-α'));
      assert.ok(!JSON.stringify(status).includes('segredo-nao-autorizado-γ'));

      const context = payloadOf(await session.client.callTool({name: 'mesa_context', arguments: {}}));
      assert.equal(context.studyProfile.tutor.text, tutorText);
      assert.equal(context.studyProfile.tutor.bytes, Buffer.byteLength(tutorText));
      assert.match(context.studyProfile.tutor.sha256, /^[0-9a-f]{64}$/);
      assert.ok(context.studyProfile.tutor.updatedAt);
      assert.equal(context.studyProfile.tutor.source, 'flag');
      assert.equal(context.studyProfile.tutor.path, await fs.realpath(tutor));
      assert.equal(context.studyProfile.learner.text, learnerText);
      assert.ok(!JSON.stringify(context).includes('segredo-nao-autorizado-γ'), 'só os arquivos autorizados são expostos');

      /* Sem flags: nenhum perfil configurado e nenhum texto. */
      const plain = parseStartupConfig({argv: [], env: {}}).config;
      const plainSession = await connectInProcess(plain);
      try {
        const plainContext = payloadOf(await plainSession.client.callTool({name: 'mesa_context', arguments: {}}));
        assert.equal(plainContext.studyProfile.tutor.configured, false);
        assert.equal(plainContext.studyProfile.tutor.text, null);
        const plainStatus = payloadOf(await plainSession.client.callTool({name: 'mesa_status', arguments: {}}));
        assert.equal(plainStatus.studyProfile.files.tutor.configured, false);
        assert.ok(plainStatus.studyProfile.guidance.some((line) => line.includes('nenhum --tutor-file')));
      } finally {
        await plainSession.close();
      }
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('perfis: troca por symlink depois do startup é recusada sem corpo; arquivo novo é relido', async () => {
  const base = await tempBase('mesa profile troca ');
  try {
    const tutor = path.join(base, 'TUTOR.md');
    await fs.writeFile(tutor, '# Tutor v1\nconteudo v1\n');
    const config = parseStartupConfig({argv: ['--tutor-file', tutor], env: {}}).config;
    const session = await connectInProcess(config);
    try {
      const first = payloadOf(await session.client.callTool({name: 'mesa_context', arguments: {}}));
      assert.equal(first.studyProfile.tutor.available, true);
      assert.match(first.studyProfile.tutor.text, /conteudo v1/);

      /* Troca o leaf por symlink para um arquivo NÃO autorizado. */
      const alvo = path.join(base, 'alvo-nao-autorizado.md');
      await fs.writeFile(alvo, 'conteudo secreto do alvo');
      await fs.rm(tutor);
      await fs.symlink(alvo, tutor);

      const status = payloadOf(await session.client.callTool({name: 'mesa_status', arguments: {}}));
      assert.equal(status.studyProfile.files.tutor.available, false);
      assert.equal(status.studyProfile.files.tutor.state, 'symlink');
      assert.equal(status.studyProfile.files.tutor.error.code, 'PROFILE_SYMLINK');
      assert.ok(!JSON.stringify(status).includes('conteudo secreto do alvo'));

      const context = payloadOf(await session.client.callTool({name: 'mesa_context', arguments: {}}));
      assert.equal(context.studyProfile.tutor.available, false);
      assert.equal(context.studyProfile.tutor.text, null, 'erro nunca devolve corpo');
      assert.equal(context.studyProfile.tutor.error.code, 'PROFILE_SYMLINK');
      assert.ok(!JSON.stringify(context).includes('conteudo secreto do alvo'));

      /* Restaura um arquivo regular no MESMO caminho congelado: volta a ler. */
      await fs.rm(tutor);
      await fs.writeFile(tutor, '# Tutor v2\nconteudo v2\n');
      const again = payloadOf(await session.client.callTool({name: 'mesa_context', arguments: {}}));
      assert.equal(again.studyProfile.tutor.available, true);
      assert.match(again.studyProfile.tutor.text, /conteudo v2/);
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('perfis: log do servidor real nunca cita o corpo do perfil', async () => {
  const base = await tempBase('mesa profile stderr ');
  const segredo = 'segredo-de-log-que-nao-pode-vazar-δ';
  const tutor = path.join(base, 'TUTOR.md');
  await fs.writeFile(tutor, `# Tutor\n${segredo}\n`);
  const session = await connectStdio({args: ['--tutor-file', tutor], env: {}});
  try {
    await session.client.callTool({name: 'mesa_context', arguments: {}});
    await session.client.callTool({name: 'mesa_status', arguments: {}});
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stderr = session.stderrText();
    assert.ok(!stderr.includes(segredo), 'log não pode citar corpo de perfil');
    for (const line of stderr.split('\n')) {
      if (line.trim() === '') continue;
      assert.match(line, /^\[mesa-study\]/, `linha de stderr inesperada: ${line}`);
    }
  } finally {
    await session.close();
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* --- leitura limitada (F2): corridas determinísticas com IO injetado --- */

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

test('perfis: startup não congela alvo de symlink em corrida (dev+ino divergente vira changed)', () => {
  const regular = fakeLeaf({dev: 1, ino: 10, size: 12});
  const alvoDoSymlink = fakeLeaf({dev: 2, ino: 20, size: 12});
  let readCalls = 0;
  const io = {
    lstat: () => regular,
    realpath: () => '/fora/nao-autorizado.md',
    open: () => 7,
    fstat: () => alvoDoSymlink,
    read: () => {
      readCalls += 1;
      return 0;
    },
    close: () => {},
  };
  const inspection = inspectProfilePathSync('/perfil.md', {io});
  assert.equal(inspection.state, 'changed');
  assert.equal(inspection.canonical, null, 'a identidade congelada não pode ser o alvo da corrida');
  assert.equal(readCalls, 0, 'troca de identidade não lê conteúdo');
});

test('perfis: arquivo que cresce na corrida excede o teto sem ser lido inteiro', () => {
  const antes = fakeLeaf({dev: 1, ino: 11, size: 4});
  const io = {
    lstat: () => antes,
    realpath: () => '/perfil.md',
    open: () => 5,
    fstat: () => antes,
    read: (fd, buffer, offset, length) => {
      buffer.fill(0x61, offset, offset + length);
      return length;
    },
    close: () => {},
  };
  const inspection = inspectProfilePathSync('/perfil.md', {maxBytes: 8, io});
  assert.equal(inspection.state, 'oversize');
  assert.equal(inspection.canonical, null);
});

test('perfis: startup não congela destino de symlink que some durante a leitura', () => {
  const arquivo = fakeLeaf({dev: 1, ino: 70, size: 4});
  let realpathCalls = 0;
  let reads = 0;
  const io = {
    lstat: () => arquivo,
    realpath: () => {
      realpathCalls += 1;
      return realpathCalls === 1 ? '/fora/alvo.md' : '/perfil.md';
    },
    open: () => 9,
    fstat: () => arquivo,
    read: (fd, buffer, offset, length) => {
      reads += 1;
      if (reads > 1) return 0;
      const n = Math.min(length, 4);
      buffer.fill(0x61, offset, offset + n);
      return n;
    },
    close: () => {},
  };
  const inspection = inspectProfilePathSync('/perfil.md', {io});
  assert.equal(inspection.state, 'changed');
  assert.equal(inspection.canonical, null, 'a identidade congelada nunca é o destino intermediário da corrida');
});

test('perfis: readProfile confere o canônico congelado ANTES de ler conteúdo', async () => {
  let openCalls = 0;
  let readCalls = 0;
  const io = {
    lstat: async () => fakeLeaf({dev: 1, ino: 30, size: 5}),
    realpath: async () => '/outro/nao-autorizado.md',
    open: async () => {
      openCalls += 1;
      return {
        stat: async () => fakeLeaf({dev: 1, ino: 30, size: 5}),
        read: async () => {
          readCalls += 1;
          return {bytesRead: 0};
        },
        close: async () => {},
      };
    },
  };
  const profile = await readProfile({
    role: 'tutor',
    filePath: '/autorizado/TUTOR.md',
    canonical: '/autorizado/TUTOR.md',
    io,
  });
  assert.equal(profile.available, false);
  assert.equal(profile.state, 'changed');
  assert.equal(profile.text ?? null, null, 'alvo diferente do congelado nunca devolve corpo');
  assert.equal(openCalls, 0, 'nem abre o arquivo fora do canônico congelado');
  assert.equal(readCalls, 0);
});

test('perfis: readProfile recusa troca de identidade entre lstat e open sem corpo', async () => {
  const io = {
    lstat: async () => fakeLeaf({dev: 1, ino: 40, size: 3}),
    realpath: async () => '/autorizado/TUTOR.md',
    open: async () => ({
      stat: async () => fakeLeaf({dev: 9, ino: 90, size: 3}),
      read: async () => ({bytesRead: 0}),
      close: async () => {},
    }),
  };
  const profile = await readProfile({
    role: 'tutor',
    filePath: '/autorizado/TUTOR.md',
    canonical: '/autorizado/TUTOR.md',
    io,
  });
  assert.equal(profile.available, false);
  assert.equal(profile.state, 'changed');
  assert.equal(profile.text ?? null, null);
});

test('perfis: readProfile limita a leitura em maxBytes+1 quando o arquivo cresce', async () => {
  const antes = fakeLeaf({dev: 1, ino: 50, size: 2});
  const io = {
    lstat: async () => antes,
    realpath: async () => '/perfil.md',
    open: async () => ({
      stat: async () => antes,
      read: async (buffer, offset, length) => {
        buffer.fill(0x62, offset, offset + length);
        return {bytesRead: length};
      },
      close: async () => {},
    }),
  };
  const profile = await readProfile({role: 'learner', filePath: '/perfil.md', canonical: '/perfil.md', maxBytes: 8, io});
  assert.equal(profile.state, 'oversize');
  assert.equal(profile.text ?? null, null);
});

test('perfis: troca de identidade DURANTE a leitura vira changed sem corpo', async () => {
  const antes = fakeLeaf({dev: 1, ino: 60, size: 3});
  const durante = fakeLeaf({dev: 1, ino: 61, size: 3});
  let stats = 0;
  let reads = 0;
  const io = {
    lstat: async () => antes,
    realpath: async () => '/canonico/perfil.md',
    open: async () => ({
      stat: async () => {
        stats += 1;
        return stats === 1 ? antes : durante;
      },
      read: async (buffer, offset, length) => {
        reads += 1;
        if (reads > 1) return {bytesRead: 0};
        const chunk = Buffer.alloc(Math.min(length, 3), 0x61);
        chunk.copy(buffer, offset);
        return {bytesRead: chunk.length};
      },
      close: async () => {},
    }),
  };
  const profile = await readProfile({
    role: 'tutor',
    filePath: '/canonico/perfil.md',
    canonical: '/canonico/perfil.md',
    io,
  });
  assert.equal(profile.state, 'changed');
  assert.equal(profile.text ?? null, null);
  assert.equal(stats, 2, 'fstat depois da leitura revalida a identidade');
});

test('perfis: leitura real continua pronta para arquivo regular estável', async () => {
  const base = await tempBase('mesa profile bounded okay ');
  try {
    const tutor = path.join(base, 'TUTOR.md');
    await fs.writeFile(tutor, '# ok\n');
    const inspection = inspectProfilePathSync(tutor);
    assert.equal(inspection.state, 'ready');
    assert.equal(inspection.canonical, await fs.realpath(tutor));
    assert.equal(inspection.bytes, 5);
    const profile = await readProfile({
      role: 'tutor',
      filePath: tutor,
      canonical: await fs.realpath(tutor),
    });
    assert.equal(profile.available, true);
    assert.equal(profile.text, '# ok\n');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});
