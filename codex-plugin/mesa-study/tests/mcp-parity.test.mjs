/* Paridade do snapshot do host + disciplina do servidor.
   - host/ é cópia byte a byte de claude-mod/mesa-study/host, exceto
     capture.mjs (default do helper declarado); SNAPSHOT.json cita as hashes;
     integridade sempre conferida pelo snapshot fixado; comparação com a
     origem mutável é opt-in MESA_VERIFY_SNAPSHOT_ORIGIN=1;
   - funções puras compartilhadas têm o MESMO comportamento nos dois módulos;
   - servidor: sem shell, sem child_process direto, sem console.log (stdout é
     só MCP), ajuda/erros de inicialização no stderr, exports previsíveis. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseStartupConfig, SERVER_VERSION} from '../server/config.mjs';
import {makeFakePng} from '../host/testing.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST_DIR = path.join(ROOT, 'host');
const SERVER_DIR = path.join(ROOT, 'server');
const ORIGIN_DIR = path.resolve(ROOT, '..', '..', 'claude-mod', 'mesa-study', 'host');
const NODE = process.execPath;
const SERVER = path.join(SERVER_DIR, 'main.mjs');

const originAvailable = await fs
  .stat(path.join(ORIGIN_DIR, 'index.mjs'))
  .then((stat) => stat.isFile(), () => false);
const verifyOrigin = process.env.MESA_VERIFY_SNAPSHOT_ORIGIN === '1';
const originSkip = originAvailable ? false : 'claude-mod/mesa-study/host não está presente neste checkout';

const manifest = JSON.parse(await fs.readFile(path.join(HOST_DIR, 'SNAPSHOT.json'), 'utf8'));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function cutOnce(text, needle, replacement, label) {
  const first = text.indexOf(needle);
  assert.notEqual(first, -1, `paridade: trecho ausente (${label})`);
  assert.equal(text.indexOf(needle, first + 1), -1, `paridade: trecho duplicado (${label})`);
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}

function replaceOnceRegex(text, regex, replacement, label) {
  const matches = text.match(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`));
  assert.equal(matches?.length, 1, `paridade: regex precisa casar 1x (${label})`);
  return text.replace(regex, replacement);
}

test('paridade: todos os arquivos do host (exceto capture.mjs) são byte a byte', async () => {
  const copyFiles = (await fs.readdir(HOST_DIR)).filter((name) => name.endsWith('.mjs')).sort();
  const manifestFiles = [...Object.keys(manifest.files), 'capture.mjs'].sort();
  assert.deepEqual(copyFiles, manifestFiles, 'SNAPSHOT.json precisa listar exatamente os arquivos copiados');
  for (const name of Object.keys(manifest.files)) {
    const copy = await fs.readFile(path.join(HOST_DIR, name));
    assert.equal(sha256(copy), manifest.files[name], `${name}: hash da cópia difere do snapshot`);
    if (verifyOrigin) {
      assert.ok(originAvailable, 'origem exigida pela verificação opt-in');
      const origin = await fs.readFile(path.join(ORIGIN_DIR, name));
      assert.equal(sha256(origin), manifest.files[name], `${name}: a ORIGEM mudou depois do snapshot`);
      assert.ok(copy.equals(origin), `${name}: a cópia precisa ser idêntica à origem`);
    }
  }
});

test('snapshot: capture.mjs ajustado mantém a hash e exige helper explícito', async () => {
  assert.deepEqual(Object.keys(manifest.adjusted), ['capture.mjs']);
  const copy = await fs.readFile(path.join(HOST_DIR, 'capture.mjs'));
  assert.equal(sha256(copy), manifest.adjusted['capture.mjs'].copySha256);
  const text = copy.toString('utf8');
  assert.ok(!text.includes('CAPTURE_HELPER_RELATIVE'));
  assert.ok(text.includes('CAPTURE_HELPER_MISSING'));
  assert.ok(text.includes('MESA_XOURNAL_HELPER'));
});

if (verifyOrigin) {
test('paridade: capture.mjs é o único ajustado e o diff é o default do helper', {skip: originSkip}, async () => {
  const originText = await fs.readFile(path.join(ORIGIN_DIR, 'capture.mjs'), 'utf8');
  const copyText = await fs.readFile(path.join(HOST_DIR, 'capture.mjs'), 'utf8');
  assert.equal(sha256(Buffer.from(originText)), manifest.adjusted['capture.mjs'].originSha256);
  assert.equal(sha256(Buffer.from(copyText)), manifest.adjusted['capture.mjs'].copySha256);

  assert.ok(originText.includes("CAPTURE_HELPER_RELATIVE"), 'origem usa o caminho relativo frágil');
  assert.ok(!copyText.includes('CAPTURE_HELPER_RELATIVE'), 'cópia não pode usar o caminho relativo frágil');
  assert.ok(!copyText.includes("path.resolve(HOST_DIR"), 'cópia não pode resolver caminho relativo ao checkout');
  assert.ok(!copyText.includes("'..', '..', '..'"), 'cópia não pode ter caminho de escape relativo');
  assert.ok(copyText.includes('MESA_XOURNAL_HELPER'), 'cópia precisa declarar o helper por ambiente');

  const ORIGIN_HEADER =
    '   - helper `visual-check/windows` deste checkout, caminho fixo resolvido\n     relativo ao repo (nunca vem do pedido);';
  const COPY_HEADER =
    '   - cópia do host de `claude-mod/mesa-study/host` (ver host/SNAPSHOT.json);\n     único arquivo ajustado: helper DECLARADO na inicialização\n     (`--xournal-helper` / `MESA_XOURNAL_HELPER`, caminho absoluto; nunca vem\n     do pedido JSON). Sem helper declarado, a captura fica indisponível e a\n     leitura de PDF continua funcionando;';
  const COPY_COMMENT =
    '/* Ajuste deliberado do snapshot (o restante do arquivo é idêntico à origem):\n   o helper não é mais resolvido por caminho relativo frágil ao checkout.\n   Ordem: deps.helperPath injetado pelo servidor (que resolve --xournal-helper\n   / MESA_XOURNAL_HELPER na INICIALIZAÇÃO) → MESA_XOURNAL_HELPER absoluto →\n   null (captura indisponível, PDF continua). */\n';
  const COPY_GUARD =
    "  if (typeof helperPath !== 'string' || helperPath.length === 0) {\n    throw new HostError(\n      'CAPTURE_HELPER_MISSING',\n      'Helper de janelas do Xournal++ não configurado. Defina --xournal-helper ou MESA_XOURNAL_HELPER (caminho absoluto); a leitura de PDF continua disponível sem ele.',\n    );\n  }\n";

  let normalizedOrigin = originText;
  normalizedOrigin = cutOnce(normalizedOrigin, ORIGIN_HEADER, '@@HELPER-DOC@@', 'cabeçalho da origem');
  normalizedOrigin = cutOnce(normalizedOrigin, "import {fileURLToPath} from 'node:url';\n", '', 'import fileURLToPath da origem');
  normalizedOrigin = cutOnce(normalizedOrigin, 'const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));\n', '', 'const HOST_DIR da origem');
  normalizedOrigin = cutOnce(normalizedOrigin, "  CAPTURE_HELPER_RELATIVE,\n", '', 'import da constante relativa');
  normalizedOrigin = replaceOnceRegex(
    normalizedOrigin,
    /export function defaultHelperPath\(\) \{\n[\s\S]*?\n\}/,
    '@@DEFAULT-HELPER@@',
    'defaultHelperPath da origem',
  );

  let normalizedCopy = copyText;
  normalizedCopy = cutOnce(normalizedCopy, COPY_HEADER, '@@HELPER-DOC@@', 'cabeçalho da cópia');
  normalizedCopy = cutOnce(normalizedCopy, COPY_COMMENT, '', 'comentário do ajuste');
  normalizedCopy = replaceOnceRegex(
    normalizedCopy,
    /export function defaultHelperPath\(\) \{\n[\s\S]*?\n\}/,
    '@@DEFAULT-HELPER@@',
    'defaultHelperPath da cópia',
  );
  normalizedCopy = cutOnce(normalizedCopy, COPY_GUARD, '', 'guarda de helper ausente');

  assert.equal(normalizedCopy, normalizedOrigin, 'fora do default do helper, capture.mjs precisa ser idêntico à origem');
});

}

if (verifyOrigin) {
test('paridade: funções puras compartilhadas têm o mesmo comportamento', {skip: originSkip}, async () => {
  const copy = await import('../host/capture.mjs');
  const origin = await import(pathToFileURL(path.join(ORIGIN_DIR, 'capture.mjs')).href);

  const shared = Object.keys(copy).filter((name) => typeof copy[name] === 'function' && typeof origin[name] === 'function');
  for (const name of ['isXournalWindow', 'isValidWindowId', 'sameWindowIdentity', 'selectXournalWindow', 'svgPreviewForPng', 'pngSize']) {
    assert.ok(shared.includes(name), `${name} precisa existir nos dois módulos`);
  }

  const windowsFixture = [
    {id: 3, app: 'Xournal++', title: 'Resolução', bounds: {Width: 900, Height: 700}},
    {id: 4, app: 'XournalPP', title: 'Notas', bounds: {Width: 901, Height: 701}},
    {id: 5, app: 'Xournal', title: 'Antigo', bounds: {Width: 901, Height: 701}},
    {id: 6, app: 'Firefox', title: 'Docs', bounds: {Width: 900, Height: 700}},
    {id: 7, app: 'Xournal++', title: 'Pequena', bounds: {Width: 90, Height: 90}},
    {id: 'abc', app: 'Xournal++', title: 'ID ruim', bounds: {Width: 900, Height: 700}},
  ];
  for (const window of windowsFixture) {
    assert.equal(copy.isXournalWindow(window), origin.isXournalWindow(window), `isXournalWindow ${JSON.stringify(window)}`);
  }
  for (const value of [0, 1, 3, 0xffffffff, 0x100000000, 1.5, '3', null, undefined]) {
    assert.equal(copy.isValidWindowId(value), origin.isValidWindowId(value), `isValidWindowId ${value}`);
  }
  for (const pair of [
    [{id: 3, app: 'Xournal++', ownerPID: 10}, {id: 3, app: 'xournal++', ownerPID: 10}],
    [{id: 3, app: 'Xournal++', ownerPID: 10}, {id: 3, app: 'Xournal++', ownerPID: 11}],
    [{id: 3, app: 'Xournal++'}, {id: 3, app: 'Xournal++', ownerPID: 11}],
    [{id: 3, app: 'Xournal++'}, {id: 4, app: 'Xournal++'}],
  ]) {
    assert.equal(copy.sameWindowIdentity(pair[0], pair[1]), origin.sameWindowIdentity(pair[0], pair[1]));
  }
  const runGuard = (module, windows, windowId) => {
    try {
      return {result: module.selectXournalWindow(windows, windowId)};
    } catch (error) {
      return {code: error.code};
    }
  };
  for (const [windows, windowId] of [
    [[windowsFixture[0]], undefined],
    [[windowsFixture[0], windowsFixture[1]], undefined],
    [[windowsFixture[0], windowsFixture[1]], 3],
    [[windowsFixture[0]], 99],
    [[windowsFixture[0], windowsFixture[5]], undefined],
    [[], 3],
  ]) {
    assert.deepEqual(runGuard(copy, windows, windowId), runGuard(origin, windows, windowId));
  }

  const fakePng = makeFakePng({width: 8, height: 6});
  assert.deepEqual(copy.pngSize(fakePng), origin.pngSize(fakePng));
  assert.deepEqual(copy.pngSize(Buffer.alloc(20)), origin.pngSize(Buffer.alloc(20)));
  assert.equal(copy.svgPreviewForPng(fakePng), origin.svgPreviewForPng(fakePng));
  assert.equal(copy.svgPreviewForPng(Buffer.alloc(600000, 7)), origin.svgPreviewForPng(Buffer.alloc(600000, 7)));

  const saved = process.env.MESA_XOURNAL_HELPER;
  try {
    delete process.env.MESA_XOURNAL_HELPER;
    assert.equal(copy.defaultHelperPath(), null);
    process.env.MESA_XOURNAL_HELPER = '/tmp/helper-fake-absoluto';
    assert.equal(copy.defaultHelperPath(), '/tmp/helper-fake-absoluto');
    process.env.MESA_XOURNAL_HELPER = 'relativo/permitido-nao';
    assert.equal(copy.defaultHelperPath(), null);
  } finally {
    if (saved === undefined) delete process.env.MESA_XOURNAL_HELPER;
    else process.env.MESA_XOURNAL_HELPER = saved;
  }
});

}

test('servidor: execução sem shell, sem child_process direto e sem console.log', async () => {
  const serverFiles = (await fs.readdir(SERVER_DIR)).filter((name) => name.endsWith('.mjs'));
  assert.ok(serverFiles.length >= 6);
  for (const name of serverFiles) {
    const text = await fs.readFile(path.join(SERVER_DIR, name), 'utf8');
    assert.equal(/\bconsole\.log\b/.test(text), false, `${name}: console.log violaria o stdout MCP`);
    assert.equal(/node:child_process/.test(text), false, `${name}: processos passam apenas pelo host/proc.mjs`);
    assert.equal(/shell\s*:\s*true/.test(text), false, `${name}: nunca shell:true`);
  }
  const hostFiles = (await fs.readdir(HOST_DIR)).filter((name) => name.endsWith('.mjs'));
  for (const name of hostFiles) {
    const text = await fs.readFile(path.join(HOST_DIR, name), 'utf8');
    assert.equal(/shell\s*:\s*true/.test(text), false, `${name}: nunca shell:true`);
    if (name !== 'proc.mjs') {
      assert.equal(/node:child_process/.test(text), false, `${name}: só proc.mjs toca processos`);
    }
  }
  const proc = await fs.readFile(path.join(HOST_DIR, 'proc.mjs'), 'utf8');
  assert.match(proc, /execFile/);
  assert.match(proc, /shell:\s*false/);
});

test('servidor: --help e erro de inicialização falam no stderr e nunca no stdout', () => {
  const help = spawnSync(NODE, [SERVER, '--help'], {encoding: 'utf8', timeout: 30000});
  assert.equal(help.status, 0);
  assert.equal(help.stdout, '', 'stdout é reservado ao protocolo MCP');
  assert.match(help.stderr, /Uso: node server\/main\.mjs/);
  assert.match(help.stderr, /--root/);

  const bad = spawnSync(NODE, [SERVER, '--root', 'relativo'], {encoding: 'utf8', timeout: 30000});
  assert.equal(bad.status, 2);
  assert.equal(bad.stdout, '');
  const payload = JSON.parse(bad.stderr.split('\n')[0]);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'STARTUP_INVALID');
});

test('servidor: configuração de inicialização válida, env, dedupe e precedência', async () => {
  const fromEnv = parseStartupConfig({
    argv: [],
    env: {
      MESA_STUDY_ROOTS: JSON.stringify(['/tmp', '/tmp', '/usr']),
      MESA_STUDY_CACHE_DIR: '/tmp/mesa-cache',
      MESA_XOURNAL_HELPER: '/tmp/xournal-windows',
      MESA_STUDY_MAX_IMAGE_BYTES: '65536',
    },
  }).config;
  assert.equal(fromEnv.rootsSource, 'env');
  assert.equal(fromEnv.roots.length, 2, 'raízes repetidas são deduplicadas');
  assert.equal(fromEnv.cacheSource, 'env');
  assert.equal(fromEnv.xournalHelperSource, 'env');
  assert.equal(fromEnv.maxImageBytes, 65536);

  const flagWins = parseStartupConfig({
    argv: ['--root', '/usr', '--cache-dir', '/tmp/flag-cache', '--max-image-bytes', '8192'],
    env: {MESA_STUDY_ROOTS: JSON.stringify(['/etc']), MESA_STUDY_CACHE_DIR: '/tmp/env-cache'},
  }).config;
  assert.equal(flagWins.rootsSource, 'flag');
  assert.equal(flagWins.roots.length, 1);
  assert.equal(flagWins.cacheDir, '/tmp/flag-cache');
  assert.equal(flagWins.maxImageBytes, 8192);

  // Flag vence o ambiente DE VERDADE: com --root o env nem é lido, então um
  // MESA_STUDY_ROOTS malformado não derruba o startup por flag.
  const flagBeatsBadEnv = parseStartupConfig({
    argv: ['--root', '/usr'],
    env: {MESA_STUDY_ROOTS: '{não é json'},
  }).config;
  assert.equal(flagBeatsBadEnv.rootsSource, 'flag');
  assert.equal(flagBeatsBadEnv.roots.length, 1);

  // Raiz ainda ausente congela o canônico do ancestral existente mais próximo
  // (ex.: /tmp -> /private/tmp no macOS), sem conceder alvo novo depois.
  const missingRoot = path.join(os.tmpdir(), `mesa-parity-raiz-ausente-${process.pid}-${Date.now()}`);
  const anticipated = parseStartupConfig({argv: ['--root', missingRoot], env: {}}).config;
  assert.deepEqual(anticipated.roots, [path.join(await fs.realpath(os.tmpdir()), path.basename(missingRoot))]);

  const empty = parseStartupConfig({argv: [], env: {}}).config;
  assert.deepEqual(empty.roots, []);
  assert.equal(empty.cacheDir, null);
  assert.equal(empty.xournalHelper, null);
  assert.equal(empty.maxImageBytes, 8 * 1024 * 1024);

  assert.throws(() => parseStartupConfig({argv: [], env: {MESA_STUDY_ROOTS: '{não é json'}}), (error) => error.code === 'STARTUP_INVALID');
  assert.throws(() => parseStartupConfig({argv: [], env: {MESA_STUDY_ROOTS: '"não array"'}}), (error) => error.code === 'STARTUP_INVALID');
  assert.throws(() => parseStartupConfig({argv: ['--max-image-bytes', '1'], env: {}}), (error) => error.code === 'STARTUP_INVALID');
  assert.throws(() => parseStartupConfig({argv: ['--teleporte'], env: {}}), (error) => error.code === 'STARTUP_INVALID');
});

test('servidor: --root vence MESA_STUDY_ROOTS malformado no processo real; sem flag, erro', () => {
  const badEnv = {...process.env, MESA_STUDY_ROOTS: '{oops'};
  const started = spawnSync(NODE, [SERVER, '--root', '/usr'], {
    encoding: 'utf8',
    timeout: 30000,
    input: '',
    env: badEnv,
  });
  assert.equal(started.status, 0, started.stderr);
  assert.doesNotMatch(started.stderr, /STARTUP_INVALID/);
  assert.equal(started.stdout, '', 'stdout é reservado ao protocolo MCP');

  const failed = spawnSync(NODE, [SERVER], {encoding: 'utf8', timeout: 30000, input: '', env: badEnv});
  assert.equal(failed.status, 2);
  assert.equal(failed.stdout, '');
  assert.equal(JSON.parse(failed.stderr.split('\n')[0]).error.code, 'STARTUP_INVALID');
});

test('contrato: exports previsíveis e package.json coerente', async () => {
  const surface = await import('../server/index.mjs');
  for (const name of [
    'parseStartupConfig',
    'usageText',
    'createMcpServer',
    'createToolHandlers',
    'readBoundedPng',
    'listXournalWindows',
    'resolveHelperPath',
    'createContextStore',
    'main',
    'startStdio',
    'isMainEntry',
  ]) {
    assert.equal(typeof surface[name], 'function', `export ausente: ${name}`);
  }
  assert.ok(Array.isArray(surface.TOOL_DEFS), 'TOOL_DEFS precisa listar as ferramentas');
  assert.equal(surface.SERVER_NAME, 'mesa-study');
  assert.equal(surface.SERVER_VERSION, SERVER_VERSION);

  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, SERVER_VERSION);
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@modelcontextprotocol/sdk', 'zod']);
  // O empacotamento pode rodar só a suíte MCP (globo mcp-*) ou todos os
  // testes do diretório; `npm test` precisa cobrir esta suíte com node --test.
  assert.match(pkg.scripts.test, /^node --test tests\/(?:mcp-\*|\*)\.test\.mjs$/);

  const names = surface.TOOL_DEFS.map((def) => def.name);
  assert.deepEqual(names, ['mesa_status', 'mesa_open', 'mesa_library', 'mesa_page', 'mesa_windows', 'mesa_capture', 'mesa_context']);
  for (const def of surface.TOOL_DEFS) {
    assert.ok(def.description.length > 40, `${def.name}: descrição precisa existir`);
    assert.equal(typeof def.annotations.readOnlyHint, 'boolean', `${def.name}: readOnlyHint precisa ser honesto`);
    if (def.name !== 'mesa_open') assert.equal(def._meta, undefined, `${def.name}: só mesa_open declara template de UI`);
  }
});
