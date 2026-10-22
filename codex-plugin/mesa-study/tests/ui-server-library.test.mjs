/* Biblioteca de PDFs do servidor MCP (mesa_library / mesa_open.library):
   varredura em FLUXO, limitada e congelada das raízes autorizadas.

   O que estes testes SÃO:
   - árvores sintéticas em diretórios temporários reais (com symlinks reais) e
     o algoritmo puro `listLibraryPdfs` com limites e corridas injetadas pelo
     MESMO formato do IO real (`opendir`/`lstat`/`realpath`);
   - protocolo MCP real (SDK oficial, transporte in-memory) para o handler.

   O que estes testes NÃO SÃO:
   - não abrem o app Codex, não carregam o plugin, não usam modelo/rede,
     Poppler ou material de curso. Só nomes e caminhos sintéticos. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {makeSyntheticPdf} from '../host/testing.mjs';
import {parseStartupConfig} from '../server/config.mjs';
import {createMcpServer} from '../server/server.mjs';
import {LIBRARY_LIMITS, isExcludedLibraryName, listLibraryPdfs} from '../server/library.mjs';

async function tempBase(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function connectInProcess({config, deps = {}}) {
  const {server} = createMcpServer({config, deps});
  const client = new Client({name: 'mesa-library-test', version: '0.0.0'});
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

function payloadOf(result) {
  const block = (result.content || []).find((item) => item.type === 'text');
  try {
    return JSON.parse(block.text);
  } catch {
    return null;
  }
}

function hasImage(result) {
  return (result.content || []).some((item) => item.type === 'image');
}

function fakeDirent(name, kind) {
  return {
    name,
    isSymbolicLink: () => kind === 'symlink',
    isDirectory: () => kind === 'directory',
    isFile: () => kind === 'file',
  };
}

/* Diretório falso com o MESMO contrato do `fs.Dir`: read() devolve Dirent ou
   null e close() encerra. Serve para injetar ordem/corrida/falha sem mentir
   sobre o formato que a implementação usa de verdade. */
function fakeDir(entries, {onRead, onClose} = {}) {
  const queue = [...entries];
  const state = {closes: 0};
  return {
    state,
    async read() {
      if (typeof onRead === 'function') await onRead();
      return queue.length === 0 ? null : queue.shift();
    },
    async close() {
      state.closes += 1;
      if (typeof onClose === 'function') await onClose();
    },
  };
}

async function writePdf(file) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, makeSyntheticPdf({pages: 1}));
}

/* ---------- conteúdo da varredura ---------- */

test('biblioteca: só PDFs regulares dentro da raiz; ocultos, internos e symlinks ficam fora', async () => {
  const base = await tempBase('mesa-lib-conteudo-');
  const root = path.join(base, 'raiz');
  const outside = path.join(base, 'fora');
  try {
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await writePdf(path.join(root, 'B.pdf'));
    await writePdf(path.join(root, 'a.pdf'));
    await writePdf(path.join(root, 'sub', 'D.pdf'));
    await writePdf(path.join(root, 'sub', 'rascunho.txt'));
    await writePdf(path.join(root, '.pasta-oculta', 'C.pdf'));
    await writePdf(path.join(root, '_interno', 'D.pdf'));
    await writePdf(path.join(root, '.oculto.pdf'));
    await writePdf(path.join(root, '_state.pdf'));
    await writePdf(path.join(outside, 'escapou.pdf'));
    await writePdf(path.join(outside, 'linkdir', 'E.pdf'));
    await fs.symlink(path.join(outside, 'escapou.pdf'), path.join(root, 'link-fora.pdf'));
    await fs.symlink(path.join(outside, 'linkdir'), path.join(root, 'link-dir'));
    await fs.symlink(path.join(root, 'B.pdf'), path.join(root, 'sub', 'link-interno.pdf'));
    await fs.writeFile(path.join(root, 'notas.txt'), 'não é PDF');

    const realRoot = await fs.realpath(root);
    const found = await listLibraryPdfs({roots: [realRoot]});
    assert.equal(found.truncated, false, 'symlink/oculto é política, não truncamento');
    assert.deepEqual(found.files.map((file) => file.name), ['B.pdf', 'D.pdf', 'a.pdf']);
    assert.deepEqual(found.files.map((file) => file.filePath), [
      path.join(realRoot, 'B.pdf'),
      path.join(realRoot, 'sub', 'D.pdf'),
      path.join(realRoot, 'a.pdf'),
    ]);
    for (const file of found.files) {
      assert.equal(path.isAbsolute(file.filePath), true);
      const real = await fs.realpath(file.filePath);
      assert.ok(real === realRoot || real.startsWith(realRoot + path.sep), `${file.filePath} precisa estar dentro da raiz`);
      assert.equal(real.includes(`${path.sep}fora${path.sep}`), false, 'nada do alvo externo entra');
    }

    // Nenhum arquivo é aberto/lido pela listagem: um PDF só-leitura ainda
    // aparece (o que a varredura toca é o diretório).
    const trancado = path.join(root, 'trancado.pdf');
    await writePdf(trancado);
    await fs.chmod(trancado, 0o000);
    const again = await listLibraryPdfs({roots: [realRoot]});
    assert.ok(again.files.some((file) => file.name === 'trancado.pdf'));
    assert.deepEqual(Object.keys(again.files[0]).sort(), ['filePath', 'name'], 'a entrada não carrega bytes nem estatísticas');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: saída ordenada mesmo com o fluxo de diretório fora de ordem', async () => {
  const base = await tempBase('mesa-lib-ordem-');
  const root = path.join(base, 'raiz');
  try {
    await writePdf(path.join(root, 'a.pdf'));
    await writePdf(path.join(root, 'b.pdf'));
    await writePdf(path.join(root, 'c.pdf'));
    const realRoot = await fs.realpath(root);

    // O diretório entrega c, a, b; a lista devolvida é ordenada e determinística.
    const shuffledOpen = async (dir) => {
      if (dir !== realRoot) return fs.opendir(dir);
      return fakeDir([fakeDirent('c.pdf', 'file'), fakeDirent('a.pdf', 'file'), fakeDirent('b.pdf', 'file')]);
    };
    const found = await listLibraryPdfs({roots: [realRoot], openDir: shuffledOpen});
    assert.deepEqual(found.files.map((file) => file.name), ['a.pdf', 'b.pdf', 'c.pdf']);
    assert.equal(found.truncated, false);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* ---------- limites explícitos e truncamento honesto ---------- */

test('biblioteca: tetos de arquivos/entradas/profundidade marcam truncated sem fingir completude', async () => {
  const base = await tempBase('mesa-lib-limites-');
  const root = path.join(base, 'raiz');
  const exato = path.join(base, 'exato');
  try {
    await writePdf(path.join(root, 'a.pdf'));
    await writePdf(path.join(root, 'b.pdf'));
    await writePdf(path.join(root, 'sub', 'c.pdf'));
    await writePdf(path.join(exato, 'x.pdf'));
    await writePdf(path.join(exato, 'y.pdf'));
    const realRoot = await fs.realpath(root);
    const realExato = await fs.realpath(exato);

    assert.deepEqual(LIBRARY_LIMITS, {maxFiles: 200, maxEntries: 4000, maxDepth: 6});

    const capped = await listLibraryPdfs({roots: [realRoot], limits: {maxFiles: 1}});
    assert.equal(capped.truncated, true, 'cortou em maxFiles');
    assert.equal(capped.files.length, 1);

    const zeroFiles = await listLibraryPdfs({roots: [realRoot], limits: {maxFiles: 0}});
    assert.equal(zeroFiles.truncated, true);
    assert.deepEqual(zeroFiles.files, []);

    const fewEntries = await listLibraryPdfs({roots: [realRoot], limits: {maxEntries: 2}});
    assert.equal(fewEntries.truncated, true);
    assert.ok(fewEntries.visited <= 2, 'não visita mais entradas que o teto');

    // Teto exatamente igual ao tamanho do diretório: a sonda pós-teto prova o
    // fim do fluxo, então NÃO é truncamento.
    const exactCap = await listLibraryPdfs({roots: [realExato], limits: {maxEntries: 2}});
    assert.equal(exactCap.truncated, false);
    assert.deepEqual(exactCap.files.map((file) => file.name), ['x.pdf', 'y.pdf']);

    const shallow = await listLibraryPdfs({roots: [realRoot], limits: {maxDepth: 0}});
    assert.equal(shallow.truncated, true, 'a subárvore não varrida é truncamento');
    assert.deepEqual(shallow.files.map((file) => file.name), ['a.pdf', 'b.pdf']);

    // Sem o teto, a mesma árvore não é truncada.
    const full = await listLibraryPdfs({roots: [realRoot]});
    assert.equal(full.truncated, false);
    assert.deepEqual(full.files.map((file) => file.name), ['a.pdf', 'b.pdf', 'c.pdf']);

    assert.equal(isExcludedLibraryName('.x'), true);
    assert.equal(isExcludedLibraryName('_x'), true);
    assert.equal(isExcludedLibraryName('x.pdf'), false);
    assert.equal(isExcludedLibraryName(''), true);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: diretório ilegível não derruba a varredura (truncated explícito)', async (t) => {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('rodando como root: permissão de diretório não bloqueia a leitura');
    return;
  }
  const base = await tempBase('mesa-lib-ilegivel-');
  const root = path.join(base, 'raiz');
  try {
    await writePdf(path.join(root, 'ok.pdf'));
    await writePdf(path.join(root, 'bloqueada', 'dentro.pdf'));
    const realRoot = await fs.realpath(root);
    await fs.chmod(path.join(root, 'bloqueada'), 0o000);
    try {
      const found = await listLibraryPdfs({roots: [realRoot]});
      assert.equal(found.truncated, true);
      assert.deepEqual(found.files.map((file) => file.name), ['ok.pdf']);
    } finally {
      await fs.chmod(path.join(root, 'bloqueada'), 0o700);
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* ---------- R2: fluxo limitado de verdade (IO/teto/fechamento) ---------- */

test('biblioteca: varredura para no teto sem ler o diretório inteiro e fecha o fluxo', async () => {
  const base = await tempBase('mesa-lib-fluxo-teto-');
  const root = path.join(base, 'raiz');
  try {
    await fs.mkdir(root);
    for (let i = 0; i < 400; i += 1) {
      await fs.writeFile(path.join(root, `f${String(i).padStart(4, '0')}.txt`), 'x');
    }
    const realRoot = await fs.realpath(root);

    let reads = 0;
    let closes = 0;
    const countingOpen = async (dir) => {
      const handle = await fs.opendir(dir);
      return {
        async read() {
          reads += 1;
          return handle.read();
        },
        async close() {
          closes += 1;
          await handle.close();
        },
      };
    };
    const found = await listLibraryPdfs({roots: [realRoot], limits: {maxEntries: 10}, openDir: countingOpen});
    assert.equal(found.visited, 10, 'visita exatamente o teto');
    assert.equal(found.truncated, true);
    assert.equal(closes, 1, 'o fluxo foi fechado uma vez');
    assert.ok(reads <= 11, `leu ${reads} entradas: no máximo o teto + a sonda de fim`);
    assert.ok(reads < 400, 'não enumerou o diretório inteiro antes de cortar');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: erro de leitura no meio do fluxo fecha o diretório e marca truncated', async () => {
  const base = await tempBase('mesa-lib-fluxo-erro-');
  const root = path.join(base, 'raiz');
  try {
    await writePdf(path.join(root, 'ok.pdf'));
    const realRoot = await fs.realpath(root);
    let closes = 0;
    const failingOpen = async () => ({
      async read() {
        throw new Error('falha sintética de leitura de diretório');
      },
      async close() {
        closes += 1;
      },
    });
    const found = await listLibraryPdfs({roots: [realRoot], openDir: failingOpen});
    assert.equal(found.truncated, true);
    assert.deepEqual(found.files, []);
    assert.equal(closes, 1, 'o fluxo foi fechado mesmo no erro');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: falha de leitura no close não derruba a varredura nem engole truncated', async () => {
  const base = await tempBase('mesa-lib-fluxo-close-');
  const root = path.join(base, 'raiz');
  try {
    await writePdf(path.join(root, 'ok.pdf'));
    const realRoot = await fs.realpath(root);
    const brokenClose = async (dir) => {
      const handle = await fs.opendir(dir);
      return {
        read: () => handle.read(),
        async close() {
          await handle.close();
          throw new Error('falha sintética de close');
        },
      };
    };
    const found = await listLibraryPdfs({roots: [realRoot], openDir: brokenClose});
    assert.deepEqual(found.files.map((file) => file.name), ['ok.pdf']);
    assert.equal(found.truncated, false);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* ---------- R1: corridas de identidade/realpath (sem listar alvo externo) ---------- */

test('biblioteca: raiz trocada por symlink entre o lstat e a abertura não lista o alvo externo', async () => {
  const base = await tempBase('mesa-lib-corrida-abre-');
  const root = path.join(base, 'raiz');
  const outside = path.join(base, 'fora');
  try {
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await writePdf(path.join(root, 'interno.pdf'));
    await writePdf(path.join(outside, 'escapou.pdf'));
    const realRoot = await fs.realpath(root);

    // A troca acontece DEPOIS do lstat e ANTES do opendir: a revalidação
    // pós-abertura (dev+ino/symlink) precisa recusar o diretório aberto.
    const swappingOpen = async (dir) => {
      if (dir === realRoot) {
        await fs.rm(realRoot, {recursive: true, force: true});
        await fs.symlink(outside, realRoot, 'dir');
      }
      return fs.opendir(dir);
    };
    const found = await listLibraryPdfs({roots: [realRoot], openDir: swappingOpen});
    assert.deepEqual(found.files, [], 'nenhum caminho do alvo externo entra');
    assert.equal(found.truncated, true, 'a listagem fica honestamente incompleta');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: raiz trocada por symlink depois da abertura não lista o alvo externo', async () => {
  const base = await tempBase('mesa-lib-corrida-leitura-');
  const root = path.join(base, 'raiz');
  const outside = path.join(base, 'fora');
  try {
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await writePdf(path.join(root, 'interno.pdf'));
    await writePdf(path.join(outside, 'escapou.pdf'));
    const realRoot = await fs.realpath(root);

    // A troca acontece na PRIMEIRA leitura do fluxo (a janela lstat→readdir do
    // achado R1): as entradas passam a vir do diretório externo e os caminhos
    // montados sob a raiz resolvem para fora. A revalidação por entrada
    // (lstat+realpath dentro da raiz) precisa descartar todas.
    const racingOpen = async (dir) => {
      if (dir !== realRoot) return fs.opendir(dir);
      const realHandle = await fs.opendir(dir);
      let swapped = false;
      let outsideHandle = null;
      return {
        async read() {
          if (!swapped) {
            swapped = true;
            await fs.rm(realRoot, {recursive: true, force: true});
            await fs.symlink(outside, realRoot, 'dir');
            outsideHandle = await fs.opendir(outside);
          }
          return outsideHandle.read();
        },
        async close() {
          await realHandle.close();
          if (outsideHandle) await outsideHandle.close();
        },
      };
    };
    const found = await listLibraryPdfs({roots: [realRoot], openDir: racingOpen});
    assert.deepEqual(found.files, [], 'nada do alvo externo entra');
    assert.equal(found.truncated, true);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: entrada candidata revalidada - symlink estável é pulado, troca de tipo trunca', async () => {
  const base = await tempBase('mesa-lib-candidato-');
  const root = path.join(base, 'raiz');
  const outside = path.join(base, 'fora');
  try {
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await writePdf(path.join(outside, 'escapou.pdf'));
    await fs.symlink(path.join(outside, 'escapou.pdf'), path.join(root, 'link-fora.pdf'));
    const realRoot = await fs.realpath(root);

    // Symlink reportado como symlink pelo fluxo: política, sem truncar.
    const truthfulOpen = async () => fakeDir([fakeDirent('link-fora.pdf', 'symlink')]);
    const policy = await listLibraryPdfs({roots: [realRoot], openDir: truthfulOpen});
    assert.deepEqual(policy.files, []);
    assert.equal(policy.truncated, false);

    // O fluxo diz "arquivo regular", mas no disco o nome virou symlink para
    // fora antes da aceitação: descarta e marca a corrida.
    const lyingOpen = async () => fakeDir([fakeDirent('link-fora.pdf', 'file')]);
    const raced = await listLibraryPdfs({roots: [realRoot], openDir: lyingOpen});
    assert.deepEqual(raced.files, []);
    assert.equal(raced.truncated, true);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: raiz que muda no fim (close) descarta os arquivos e marca truncated', async () => {
  const base = await tempBase('mesa-lib-corrida-fim-');
  const root = path.join(base, 'raiz');
  const outside = path.join(base, 'fora');
  try {
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await writePdf(path.join(root, 'bom.pdf'));
    await writePdf(path.join(outside, 'escapou.pdf'));
    const realRoot = await fs.realpath(root);

    // A raiz é trocada por symlink no close do fluxo: a varredura já viu e
    // aceitou bom.pdf, mas o retorno precisa reconferir a identidade da raiz.
    const closingSwap = async (dir) => {
      const handle = await fs.opendir(dir);
      return {
        read: () => handle.read(),
        async close() {
          await handle.close();
          if (dir === realRoot) {
            await fs.rm(realRoot, {recursive: true, force: true});
            await fs.symlink(outside, realRoot, 'dir');
          }
        },
      };
    };
    const found = await listLibraryPdfs({roots: [realRoot], openDir: closingSwap});
    assert.deepEqual(found.files, [], 'a lista não sobrevive à troca da raiz');
    assert.equal(found.truncated, true);

    // O caminho devolvido nunca aponta para fora da raiz congelada.
    assert.ok(found.files.every((file) => file.filePath === realRoot || file.filePath.startsWith(realRoot + path.sep)));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('biblioteca: raiz substituída por outro diretório no meio da varredura é descartada', async () => {
  const base = await tempBase('mesa-lib-corrida-identidade-');
  const root = path.join(base, 'raiz');
  try {
    await fs.mkdir(root);
    await writePdf(path.join(root, 'antes.pdf'));
    const realRoot = await fs.realpath(root);

    // Substitui por OUTRO diretório no mesmo caminho (sem symlink): o realpath
    // continua "dentro", mas a identidade dev+ino muda e o retorno descarta.
    const swappingOpen = async (dir) => {
      const handle = await fs.opendir(dir);
      return {
        async read() {
          await fs.rename(realRoot, `${realRoot}-velha`);
          await fs.mkdir(realRoot);
          await writePdf(path.join(realRoot, 'depois.pdf'));
          return handle.read();
        },
        close: () => handle.close(),
      };
    };
    const found = await listLibraryPdfs({roots: [realRoot], openDir: swappingOpen});
    assert.deepEqual(found.files, []);
    assert.equal(found.truncated, true);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

/* ---------- handler MCP: contrato, identidade congelada e pedidos extras ---------- */

test('mesa_library: contrato {ok,kind,files,truncated}, campos extras descartados e sem raízes recusa', async () => {
  const base = await tempBase('mesa-lib-handler-');
  const root = path.join(base, 'raiz');
  const target = path.join(base, 'alvo');
  const cache = path.join(base, 'cache');
  try {
    await fs.mkdir(root);
    await fs.mkdir(target);
    await fs.mkdir(cache);
    await writePdf(path.join(root, 'exercicio.pdf'));
    await writePdf(path.join(target, 'nao-autorizado.pdf'));

    const {config} = parseStartupConfig({argv: ['--root', root, '--cache-dir', cache]});
    const session = await connectInProcess({config});
    try {
      const result = await session.client.callTool({name: 'mesa_library', arguments: {}});
      assert.equal(result.isError, undefined);
      assert.equal(hasImage(result), false, 'listar não devolve imagem');
      const meta = payloadOf(result);
      assert.deepEqual(Object.keys(meta).sort(), ['files', 'kind', 'ok', 'truncated']);
      assert.equal(meta.ok, true);
      assert.equal(meta.kind, 'library');
      assert.deepEqual(meta.files, [{filePath: path.join(await fs.realpath(root), 'exercicio.pdf'), name: 'exercicio.pdf'}]);
      assert.equal(meta.truncated, false);
      assert.deepEqual(result.structuredContent, meta);

      // Campos extras não ampliam a lista (o schema descarta).
      const extra = await session.client.callTool({
        name: 'mesa_library',
        arguments: {roots: [target], cacheDir: base, maxFiles: 9999},
      });
      assert.equal(extra.isError, undefined);
      assert.deepEqual(payloadOf(extra).files, meta.files);
    } finally {
      await session.close();
    }

    const noRoots = await connectInProcess({config: parseStartupConfig({argv: []}).config});
    try {
      const refused = await noRoots.client.callTool({name: 'mesa_library', arguments: {}});
      assert.equal(refused.isError, true);
      assert.equal(payloadOf(refused).error.code, 'ROOTS_NOT_CONFIGURED');
    } finally {
      await noRoots.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('mesa_library/mesa_open: raiz válida + raiz pulada marca truncated na biblioteca', async () => {
  const base = await tempBase('mesa-lib-trunc-mix-');
  const validRoot = path.join(base, 'valida');
  const changedRoot = path.join(base, 'trocada');
  const missingRoot = path.join(base, 'ausente');
  const fileRoot = path.join(base, 'vira-arquivo');
  const target = path.join(base, 'alvo');
  const cache = path.join(base, 'cache');
  try {
    await fs.mkdir(validRoot);
    await fs.mkdir(changedRoot);
    await fs.mkdir(fileRoot);
    await fs.mkdir(target);
    await fs.mkdir(cache);
    await writePdf(path.join(validRoot, 'ok.pdf'));
    await writePdf(path.join(changedRoot, 'trocado.pdf'));
    await writePdf(path.join(target, 'alvo.pdf'));
    await writePdf(path.join(fileRoot, 'arquivo.pdf'));

    const {config} = parseStartupConfig({
      argv: ['--root', validRoot, '--root', changedRoot, '--root', missingRoot, '--root', fileRoot, '--cache-dir', cache],
    });
    const session = await connectInProcess({config});
    try {
      // Depois do startup: uma raiz vira symlink, outra vira arquivo e a
      // terceira nunca existiu; só a válida continua autorizando.
      await fs.rm(changedRoot, {recursive: true, force: true});
      await fs.symlink(target, changedRoot, 'dir');
      await fs.rm(fileRoot, {recursive: true, force: true});
      await fs.writeFile(fileRoot, 'agora é arquivo');

      const lib = payloadOf(await session.client.callTool({name: 'mesa_library', arguments: {}}));
      assert.equal(lib.ok, true);
      assert.equal(lib.truncated, true, 'raiz pulada deixa a listagem incompleta');
      assert.deepEqual(lib.files, [{filePath: path.join(await fs.realpath(validRoot), 'ok.pdf'), name: 'ok.pdf'}]);
      assert.deepEqual(lib.files, payloadOf(await session.client.callTool({name: 'mesa_library', arguments: {}})).files);

      const open = await session.client.callTool({name: 'mesa_open', arguments: {}});
      assert.equal(open.isError, undefined);
      assert.equal(open.structuredContent.kind, 'desk');
      assert.equal(open.structuredContent.page, null);
      assert.equal(open.structuredContent.library.truncated, true);
      assert.deepEqual(open.structuredContent.library.files, lib.files);
      assert.deepEqual(open.structuredContent.status.setup.roots.checks, {valid: 1, missing: 1, changed: 1, notDirectory: 1});
      assert.equal(open.structuredContent.status.setup.roots.available, true);
    } finally {
      await session.close();
    }

    // Todas as raízes ausentes: a biblioteca RECUSA e o painel abre vazio (o
    // status explica a ausência) — sem autorizar nada.
    const onlyMissing = await connectInProcess({
      config: parseStartupConfig({argv: ['--root', path.join(base, 'a'), '--root', path.join(base, 'b'), '--cache-dir', cache]}).config,
    });
    try {
      const refused = await onlyMissing.client.callTool({name: 'mesa_library', arguments: {}});
      assert.equal(refused.isError, true);
      assert.equal(payloadOf(refused).error.code, 'ROOT_NOT_FOUND');
      const opened = await onlyMissing.client.callTool({name: 'mesa_open', arguments: {}});
      assert.equal(opened.isError, undefined);
      assert.deepEqual(opened.structuredContent.library, {files: [], truncated: false});
      assert.equal(opened.structuredContent.status.setup.roots.checks.missing, 2);
    } finally {
      await onlyMissing.close();
    }

    // Todas viraram arquivo: recusa específica ROOT_NOT_DIRECTORY e painel vazio.
    const fileA = path.join(base, 'arquivo-a');
    const fileB = path.join(base, 'arquivo-b');
    await fs.writeFile(fileA, 'a');
    await fs.writeFile(fileB, 'b');
    const onlyFiles = await connectInProcess({
      config: parseStartupConfig({argv: ['--root', fileA, '--root', fileB, '--cache-dir', cache]}).config,
    });
    try {
      const refused = await onlyFiles.client.callTool({name: 'mesa_library', arguments: {}});
      assert.equal(refused.isError, true);
      assert.equal(payloadOf(refused).error.code, 'ROOT_NOT_DIRECTORY');
      const opened = await onlyFiles.client.callTool({name: 'mesa_open', arguments: {}});
      assert.equal(opened.isError, undefined);
      assert.deepEqual(opened.structuredContent.library, {files: [], truncated: false});
      assert.equal(opened.structuredContent.status.setup.roots.checks.notDirectory, 2);
    } finally {
      await onlyFiles.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('mesa_library/mesa_open: raiz trocada por symlink depois do startup não autoriza o alvo', async () => {
  const base = await tempBase('mesa-lib-troca-raiz-');
  const root = path.join(base, 'raiz');
  const target = path.join(base, 'alvo');
  const cache = path.join(base, 'cache');
  try {
    await fs.mkdir(root);
    await fs.mkdir(target);
    await fs.mkdir(cache);
    await writePdf(path.join(root, 'sintetico.pdf'));
    const targetPdf = path.join(target, 'alvo.pdf');
    await writePdf(targetPdf);
    const targetBytes = await fs.readFile(targetPdf);

    const {config} = parseStartupConfig({argv: ['--root', root, '--cache-dir', cache]});
    const session = await connectInProcess({config});
    try {
      // Antes da troca, a raiz autoriza.
      const before = await session.client.callTool({name: 'mesa_library', arguments: {}});
      assert.equal(before.isError, undefined);
      assert.equal(payloadOf(before).files.length, 1);

      await fs.rm(root, {recursive: true, force: true});
      await fs.symlink(target, root, 'dir');

      const swapped = await session.client.callTool({name: 'mesa_library', arguments: {}});
      assert.equal(swapped.isError, true);
      assert.equal(payloadOf(swapped).error.code, 'ROOT_CHANGED');
      assert.equal(hasImage(swapped), false);

      // mesa_open sem filePath continua abrindo o painel: library vazia e o
      // status explica a troca (raiz trocada nunca vira autorização).
      const open = await session.client.callTool({name: 'mesa_open', arguments: {}});
      assert.equal(open.isError, undefined);
      assert.equal(open.structuredContent.kind, 'desk');
      assert.deepEqual(open.structuredContent.library, {files: [], truncated: false});
      assert.equal(open.structuredContent.page, null);
      assert.equal(open.structuredContent.status.setup.roots.available, false);
      assert.deepEqual(open.structuredContent.status.setup.roots.checks, {valid: 0, missing: 0, changed: 1, notDirectory: 0});

      // Nem pelo caminho direto do alvo, nem pelo caminho da raiz trocada.
      for (const filePath of [targetPdf, path.join(root, 'alvo.pdf')]) {
        const refused = await session.client.callTool({name: 'mesa_open', arguments: {filePath, page: 1}});
        assert.equal(refused.isError, true);
        assert.equal(payloadOf(refused).error.code, 'ROOT_CHANGED');
        assert.equal(hasImage(refused), false, 'nenhum PNG do alvo novo');
      }
      assert.ok(targetBytes.equals(await fs.readFile(targetPdf)), 'o PDF do alvo não foi tocado');
    } finally {
      await session.close();
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});
