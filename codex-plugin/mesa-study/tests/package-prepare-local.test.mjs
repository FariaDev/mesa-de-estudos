/* Testes do prepare-local: staging estático com caminhos absolutos, escapes
   de TOML/JSON, recusas sem sobrescrita, zero raízes, bloqueio claro até
   npm ci, symlinks, limpeza do parcial e neutralidade quanto a HOME/config
   global. Fixtures sintéticas sob o tmpdir; a árvore real só é lida. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  DEFAULT_CACHE_DIR_NAME,
  TOML_FILE,
  cleanupPartial,
  defaultNodeLauncher,
  normalizeConfig,
  isAncestorOrEqual,
  ownedEntry,
  tomlString,
} from '../scripts/prepare-local.mjs';
import {buildPlaceholderPng} from '../scripts/make-assets.mjs';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(pluginRoot, 'scripts/prepare-local.mjs');

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function mkdirp(target) {
  fs.mkdirSync(target, {recursive: true});
  return target;
}

function writeFile(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, content);
  return target;
}

function makeExecutable(root, relative) {
  const target = writeFile(root, relative, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(target, 0o755);
  return target;
}

/* FIFO é uma entrada que a cópia recusa (não é arquivo/diretório/symlink):
   serve para falhar NO MEIO de um diretório já iniciado. */
function makeFifo(target) {
  const result = spawnSync('mkfifo', [target], {encoding: 'utf8'});
  return result.status === 0;
}

function makeSourceFixture({withModules = true, withMain = true} = {}) {
  const root = tempDir('mesa origem ç ');
  writeFile(root, '.codex-plugin/plugin.json', JSON.stringify({
    name: 'mesa-study',
    version: '0.1.0',
    skills: './skills/',
    mcpServers: './.mcp.json',
    interface: {displayName: 'Mesa'},
  }));
  writeFile(root, '.mcp.json', JSON.stringify({
    mcpServers: {mesa: {command: 'node', args: ['./server/main.mjs'], cwd: './', env_vars: ['MESA_STUDY_ROOTS']}},
  }));
  if (withMain) writeFile(root, 'server/main.mjs', '// fixture\n');
  writeFile(root, 'ui/desk.html', '<!doctype html><title>Mesa fixture</title>');
  writeFile(root, 'host/errors.mjs', 'export class HostError extends Error {}\n');
  writeFile(root, 'skills/mesa/SKILL.md', '---\nname: mesa\ndescription: fixture\n---\n');
  writeFile(root, 'package.json', JSON.stringify({name: 'mesa-study-codex', version: '0.1.0-experimental', type: 'module'}));
  writeFile(root, 'package-lock.json', JSON.stringify({name: 'mesa-study-codex', lockfileVersion: 3}));
  writeFile(root, 'README.md', '# fixture\n');
  writeFile(root, 'scripts/doctor.mjs', '// fixture\n');
  writeFile(root, 'assets/icon.png', buildPlaceholderPng(48));
  writeFile(root, 'assets/logo.png', buildPlaceholderPng(48));
  if (withModules) {
    writeFile(root, 'node_modules/@modelcontextprotocol/sdk/package.json', '{"name":"@modelcontextprotocol/sdk","version":"1.32.0"}');
    writeFile(root, 'node_modules/zod/package.json', '{"name":"zod","version":"4.6.5"}');
    fs.mkdirSync(path.join(root, 'node_modules/.bin'), {recursive: true});
    fs.symlinkSync('../@modelcontextprotocol/sdk', path.join(root, 'node_modules/.bin/sdk'), 'dir');
  }
  return root;
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', env: {...process.env, ...env}});
}

function readReport(result) {
  assert.ok(result.stdout.trim().length > 0, `stdout vazio; stderr: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function snapshot(root) {
  const entries = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(dir, entry.name);
      entries.push(`${path.relative(root, target)}${entry.isDirectory() ? '/' : ''}`);
      if (entry.isDirectory()) walk(target);
    }
  };
  walk(root);
  return entries;
}

test('staging: copia o pacote e grava .mcp.json/TOML com caminhos absolutos', () => {
  const source = makeSourceFixture();
  const base = tempDir('mesa staging ç ');
  const dest = path.join(base, 'destino "novo" Ω');
  const pdfRoot = mkdirp(path.join(base, 'pdfs com espaço ç'));
  const weirdRoot = mkdirp(path.join(base, 'raiz "aspas" \\ teste'));
  const helper = makeExecutable(base, 'helper ç.sh');
  const home = tempDir('mesa home ç ');
  const beforeSource = snapshot(source);

  const result = run(
    ['--dest', dest, '--source', source, '--root', pdfRoot, '--root', weirdRoot, '--xournal-helper', helper],
    {HOME: home, CODEX_HOME: path.join(home, '.codex'), XDG_CONFIG_HOME: path.join(home, '.config')},
  );
  assert.equal(result.status, 0, result.stderr);
  const parsed = readReport(result);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.nodeModules.copied, true);
  assert.deepEqual(parsed.blocked, []);
  assert.deepEqual(parsed.config.roots, [fs.realpathSync(pdfRoot), fs.realpathSync(weirdRoot)]);
  assert.equal(parsed.config.cacheDir, path.join(dest, DEFAULT_CACHE_DIR_NAME));
  assert.equal(parsed.config.cacheDirSource, 'default');
  assert.equal(parsed.config.xournalHelper, helper);

  for (const relative of [
    '.codex-plugin/plugin.json',
    'server/main.mjs',
    'ui/desk.html',
    'host/errors.mjs',
    'skills/mesa/SKILL.md',
    'package.json',
    'package-lock.json',
    'assets/icon.png',
    'scripts/doctor.mjs',
  ]) {
    assert.ok(fs.existsSync(path.join(dest, relative)), `copiado: ${relative}`);
  }

  const link = path.join(dest, 'node_modules/.bin/sdk');
  assert.ok(fs.lstatSync(link).isSymbolicLink(), 'symlink do node_modules é preservado, não seguido');
  assert.equal(fs.readlinkSync(link), '../@modelcontextprotocol/sdk', 'texto do symlink preservado (não reescrito para a origem)');
  assert.ok(fs.realpathSync(link).startsWith(fs.realpathSync(path.join(dest, 'node_modules'))));

  const mcp = JSON.parse(fs.readFileSync(path.join(dest, '.mcp.json'), 'utf8'));
  const mesa = mcp.mcpServers.mesa;
  const expectedNode = defaultNodeLauncher();
  assert.equal(mesa.command, expectedNode);
  assert.ok(path.isAbsolute(expectedNode));
  fs.accessSync(expectedNode, fs.constants.X_OK);
  assert.equal(mesa.cwd, dest);
  assert.equal(mesa.args[0], path.join(dest, 'server', 'main.mjs'));
  assert.deepEqual(mesa.args.slice(1), [
    '--root', fs.realpathSync(pdfRoot),
    '--root', fs.realpathSync(weirdRoot),
    '--cache-dir', path.join(dest, DEFAULT_CACHE_DIR_NAME),
    '--xournal-helper', helper,
  ]);
  assert.equal(typeof mesa.env_vars, 'undefined', 'staging não depende de env_vars');
  assert.ok(!fs.readFileSync(path.join(dest, '.mcp.json'), 'utf8').includes('"./server/main.mjs"'), 'nada de caminho relativo do modelo');
  assert.equal(mcp.mcpServers.mesa.args[4], fs.realpathSync(weirdRoot), 'JSON preserva o caminho com aspas e barra invertida');

  const toml = fs.readFileSync(path.join(dest, TOML_FILE), 'utf8');
  assert.ok(toml.startsWith('# Mesa de Estudos'));
  assert.ok(toml.includes('[mcp_servers.mesa]'));
  assert.ok(toml.includes(`command = ${tomlString(expectedNode)}`));
  assert.ok(toml.includes(`cwd = ${tomlString(dest)}`));
  assert.ok(toml.includes('\\"aspas\\"'), 'aspas escapadas no TOML');
  assert.ok(toml.includes('\\\\ teste'), 'barra invertida escapada no TOML');

  const marketplace = JSON.parse(fs.readFileSync(path.join(dest, '.agents/plugins/marketplace.json'), 'utf8'));
  assert.equal(marketplace.name, 'mesa-study-local');
  assert.equal(typeof marketplace.interface?.displayName, 'string');
  assert.equal(marketplace.plugins.length, 1);
  const marketplaceEntry = marketplace.plugins[0];
  assert.equal(marketplaceEntry.name, 'mesa-study');
  assert.equal(marketplaceEntry.source?.source, 'local');
  assert.equal(marketplaceEntry.source?.path, './', 'source relativo à RAIZ DO MARKETPLACE = o próprio destino');
  assert.equal(marketplaceEntry.policy?.installation, 'AVAILABLE');
  assert.equal(marketplaceEntry.policy?.authentication, 'ON_INSTALL');
  assert.equal(typeof marketplaceEntry.category, 'string');
  assert.equal(path.resolve(dest, marketplaceEntry.source.path), dest);
  assert.ok(fs.existsSync(path.join(dest, '.codex-plugin/plugin.json')), 'o plugin está na raiz do marketplace gerado');
  assert.deepEqual(parsed.generated, ['.mcp.json', TOML_FILE, '.agents/plugins/marketplace.json']);
  assert.equal(parsed.marketplace.name, 'mesa-study-local');
  assert.equal(parsed.marketplace.sourcePath, './');
  assert.ok(parsed.nextSteps.some((step) => step.includes('mesa-study-local')), 'o relatório ensina a ativar o marketplace gerado');
  assert.ok(parsed.nextSteps.some((step) => step.includes('Mantenha esta cópia')), 'o relatório avisa que os args absolutos exigem manter a cópia');

  assert.deepEqual(snapshot(source), beforeSource, 'a origem não é alterada');
  assert.deepEqual(fs.readdirSync(home), [], 'HOME/CODEX_HOME/XDG fake intocados');
});

test('staging: zero raízes é permitido e o relatório explica o limite', () => {
  const source = makeSourceFixture();
  const dest = path.join(tempDir('mesa staging ç '), 'destino');
  const result = run(['--dest', dest, '--source', source]);
  assert.equal(result.status, 0, result.stderr);
  const parsed = readReport(result);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.config.roots, []);
  assert.equal(parsed.config.rootsSource, 'none');
  const mesa = JSON.parse(fs.readFileSync(path.join(dest, '.mcp.json'), 'utf8')).mcpServers.mesa;
  assert.ok(!mesa.args.includes('--root'));
  assert.ok(parsed.nextSteps.some((step) => step.includes('Zero raízes')));
  assert.ok(fs.existsSync(path.join(dest, '.agents/plugins/marketplace.json')), 'marketplace standalone também sai com zero raízes');
});

test('staging: destino não vazio/symlink/file é recusado sem sobrescrever', () => {
  const source = makeSourceFixture();
  const base = tempDir('mesa staging ç ');

  const notEmpty = path.join(base, 'cheio');
  fs.mkdirSync(notEmpty);
  const sentinel = path.join(notEmpty, 'sentinel.txt');
  fs.writeFileSync(sentinel, 'preservar');
  const full = run(['--dest', notEmpty, '--source', source]);
  assert.equal(full.status, 1);
  assert.match(full.stderr, /não está vazio/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preservar');
  assert.deepEqual(fs.readdirSync(notEmpty), ['sentinel.txt']);

  const real = path.join(base, 'real');
  fs.mkdirSync(real);
  const link = path.join(base, 'link');
  fs.symlinkSync(real, link, 'dir');
  const symlink = run(['--dest', link, '--source', source]);
  assert.equal(symlink.status, 1);
  assert.match(symlink.stderr, /symlink/);
  assert.deepEqual(fs.readdirSync(real), []);

  const file = path.join(base, 'arquivo.txt');
  fs.writeFileSync(file, 'sou arquivo');
  const fileRun = run(['--dest', file, '--source', source]);
  assert.equal(fileRun.status, 1);
  assert.match(fileRun.stderr, /não é diretório/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'sou arquivo');
});

test('staging: raízes placeholder/amplas/relativas/arquivo são recusadas', () => {
  const source = makeSourceFixture();
  const base = tempDir('mesa staging ç ');
  const dest = () => path.join(base, `destino-${Math.random().toString(16).slice(2)}`);
  const fileAsRoot = writeFile(base, 'avulso.pdf', '%PDF-');

  const cases = [
    ['<pasta>', /placeholder/],
    ['', /placeholder|vazio/],
    ['/', /ampla demais/],
    [os.homedir(), /ampla demais/],
    [path.dirname(fs.realpathSync(source)), /checkout inteiro/],
    ['relativa', /absoluto/],
    [fileAsRoot, /não é diretório/],
  ];
  for (const [rootArg, pattern] of cases) {
    const result = run(['--dest', dest(), '--source', source, '--root', rootArg]);
    assert.equal(result.status, 1, `esperava recusa para raiz ${JSON.stringify(rootArg)}`);
    assert.match(result.stderr, pattern);
  }
});

test('staging: destino dentro da origem é recusado', () => {
  const source = makeSourceFixture();
  const inside = path.join(source, 'staging');
  const result = run(['--dest', inside, '--source', source]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fora da árvore da origem/);
  assert.equal(fs.existsSync(inside), false);
});

test('staging: node_modules ausente bloqueia com npm ci (código 2)', () => {
  const source = makeSourceFixture({withModules: false});
  const dest = path.join(tempDir('mesa staging ç '), 'destino');
  const result = run(['--dest', dest, '--source', source]);
  assert.equal(result.status, 2);
  const parsed = readReport(result);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.nodeModules.copied, false);
  assert.ok(parsed.blocked.some((item) => item.includes('npm ci')));
  assert.ok(parsed.nextSteps.some((step) => step.includes('npm ci')));
  assert.ok(fs.existsSync(path.join(dest, '.mcp.json')));
  assert.equal(fs.existsSync(path.join(dest, 'node_modules')), false);
});

test('staging: arquivo de runtime ausente na origem bloqueia com código 2', () => {
  const source = makeSourceFixture({withMain: false});
  const dest = path.join(tempDir('mesa staging ç '), 'destino');
  const result = run(['--dest', dest, '--source', source]);
  assert.equal(result.status, 2);
  const parsed = readReport(result);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.blocked.some((item) => item.includes('server/main.mjs')));
  assert.equal(parsed.nodeModules.copied, true, 'o resto do staging continua útil');
});

test('staging: destinos aninhados novos e limpeza do parcial em falha de cópia', (t) => {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('chmod 000 não bloqueia root; cenário de falha não se aplica');
    return;
  }
  const source = makeSourceFixture({withModules: false});
  const base = tempDir('mesa staging ç ');
  const nested = path.join(base, 'novo', 'a', 'b');
  const okRun = run(['--dest', nested, '--source', source]);
  assert.equal(okRun.status, 2, okRun.stderr);
  assert.ok(fs.existsSync(path.join(nested, '.mcp.json')), 'cria a cadeia nova de diretórios');

  const source2 = makeSourceFixture({withModules: false});
  const nested2 = path.join(base, 'falha', 'a', 'b');
  const locked = path.join(source2, 'server');
  fs.chmodSync(locked, 0o000);
  let failure;
  try {
    failure = run(['--dest', nested2, '--source', source2]);
  } finally {
    fs.chmodSync(locked, 0o755);
  }
  assert.equal(failure.status, 1);
  assert.equal(fs.existsSync(nested2), false, 'staging parcial é removido');
  assert.equal(fs.existsSync(path.join(base, 'falha')), false, 'só os diretórios criados por nós são removidos');
});

test('staging: falha no meio da cópia em destino vazio pré-existente não deixa resíduo', (t) => {
  const source = makeSourceFixture({withModules: false});
  writeFile(source, 'server/a-antes-da-falha.txt', 'copiado antes de encontrar o FIFO\n');
  if (!makeFifo(path.join(source, 'server', 'z-fifo'))) {
    t.skip('mkfifo indisponível');
    return;
  }
  const dest = path.join(tempDir('mesa staging ç '), 'vazio pré-existente Ω');
  fs.mkdirSync(dest);
  const result = run(['--dest', dest, '--source', source]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /não suportada/);
  assert.ok(fs.existsSync(dest), 'destino pré-existente continua existindo');
  assert.deepEqual(fs.readdirSync(dest), [], 'nenhum resíduo nosso fica no destino vazio anterior');

  // Retry no MESMO destino (agora sem o FIFO) precisa funcionar: o vazio foi devolvido.
  fs.rmSync(path.join(source, 'server', 'z-fifo'));
  const retry = run(['--dest', dest, '--source', source]);
  assert.equal(retry.status, 2, retry.stderr);
  assert.ok(fs.existsSync(path.join(dest, '.mcp.json')), 'o staging seguinte não ficou refém do resíduo');

  // Destino novo/aninhado: a limpeza remove também a cadeia criada por nós.
  const base2 = tempDir('mesa staging fifo ç ');
  const source2 = makeSourceFixture({withModules: false});
  writeFile(source2, 'server/a-antes-da-falha.txt', 'parcial\n');
  if (!makeFifo(path.join(source2, 'server', 'z-fifo'))) {
    t.skip('mkfifo indisponível');
    return;
  }
  const nested = path.join(base2, 'novo', 'a', 'b');
  const failure = run(['--dest', nested, '--source', source2]);
  assert.equal(failure.status, 1, failure.stderr);
  assert.equal(fs.existsSync(nested), false, 'destino novo parcial é removido');
  assert.equal(fs.existsSync(path.join(base2, 'novo')), false, 'ancestrais criados por nós saem');
});

test('limpeza: só o que está no diário sai; alheio e nó trocado ficam', async () => {
  const base = tempDir('mesa limpeza ç ');
  const dest = path.join(base, 'destino pré-existente');
  fs.mkdirSync(dest);
  const ownedDir = path.join(dest, 'pacote');
  fs.mkdirSync(ownedDir);
  const ownedFile = writeFile(ownedDir, 'meu.txt', 'meu');
  const foreign = writeFile(ownedDir, 'alheio.txt', 'alheio');

  await cleanupPartial(dest, [ownedEntry(ownedDir, 'dir'), ownedEntry(ownedFile, 'file')], false, []);
  assert.equal(fs.existsSync(ownedFile), false, 'arquivo do diário é removido');
  assert.equal(fs.readFileSync(foreign, 'utf8'), 'alheio', 'arquivo alheio é preservado');
  assert.ok(fs.existsSync(ownedDir), 'diretório com alheio não cai (rmdir, nunca rm -rf)');
  assert.ok(fs.existsSync(dest), 'destino que já existia nunca é apagado');

  // Nó trocado por outra pessoa (arquivo -> diretório): tipo/identidade não batem.
  const replaced = writeFile(dest, 'trocado.txt', 'original');
  const replacedEntry = ownedEntry(replaced, 'file');
  fs.rmSync(replaced);
  fs.mkdirSync(replaced);
  writeFile(replaced, 'outro.txt', 'de outra pessoa');
  await cleanupPartial(dest, [replacedEntry], false, []);
  assert.equal(fs.readFileSync(path.join(replaced, 'outro.txt'), 'utf8'), 'de outra pessoa');

  // Destino criado por nós: se esvaziou, some junto com os ancestrais que criamos.
  const nested = path.join(base, 'novo', 'a', 'b');
  fs.mkdirSync(nested, {recursive: true});
  const nestedDir = path.join(nested, 'x');
  fs.mkdirSync(nestedDir);
  const nestedFile = writeFile(nestedDir, 'y.txt', 'y');
  await cleanupPartial(
    nested,
    [ownedEntry(nestedDir, 'dir'), ownedEntry(nestedFile, 'file')],
    true,
    [path.join(base, 'novo', 'a'), path.join(base, 'novo')],
  );
  assert.equal(fs.existsSync(nested), false);
  assert.equal(fs.existsSync(path.join(base, 'novo')), false);
});

test('staging: --max-image-bytes vira flag absoluta no .mcp.json e no TOML', () => {
  const source = makeSourceFixture();
  const dest = path.join(tempDir('mesa staging ç '), 'destino');
  const result = run(['--dest', dest, '--source', source, '--max-image-bytes', '1048576']);
  assert.equal(result.status, 0, result.stderr);
  const parsed = readReport(result);
  assert.equal(parsed.config.maxImageBytes, 1048576);
  const args = JSON.parse(fs.readFileSync(path.join(dest, '.mcp.json'), 'utf8')).mcpServers.mesa.args;
  const index = args.indexOf('--max-image-bytes');
  assert.ok(index !== -1, 'flag presente nos args do staging');
  assert.equal(args[index + 1], '1048576');
  assert.ok(fs.readFileSync(path.join(dest, TOML_FILE), 'utf8').includes('--max-image-bytes'));
});

test('CLI: --help sai 0; --dest ausente sai 1', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Uso: node scripts\/prepare-local\.mjs/);
  const missing = run([]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--dest é obrigatório/);
});

test('unidades: TOML, ancestralidade e normalização da configuração', () => {
  assert.equal(tomlString('simples'), '"simples"');
  assert.equal(tomlString('a"b\\c\nd\te'), '"a\\"b\\\\c\\nd\\te"');
  assert.equal(tomlString('ação Ω'), '"ação Ω"');
  assert.equal(tomlString('\u0001'), '"\\u0001"');

  assert.equal(isAncestorOrEqual('/a', '/a/b'), true);
  assert.equal(isAncestorOrEqual('/a', '/a'), true);
  assert.equal(isAncestorOrEqual('/a', '/ab'), false);

  const base = tempDir('mesa unidades ç ');
  const destRoot = path.join(base, 'destino');
  const sourceRoot = fs.realpathSync(mkdirp(path.join(base, 'plugin')));
  const pdfRoot = mkdirp(path.join(base, 'pdfs'));
  const alias = path.join(base, 'alias pdfs');
  fs.symlinkSync(pdfRoot, alias, 'dir');
  const helper = makeExecutable(base, 'helper.sh');

  const zero = normalizeConfig({roots: [], destRoot, sourceRoot, home: path.join(base, 'home')});
  assert.deepEqual(zero.errors, []);
  assert.deepEqual(zero.roots, []);
  assert.equal(zero.cacheDir, path.join(destRoot, DEFAULT_CACHE_DIR_NAME));
  assert.equal(zero.cacheDirSource, 'default');

  const dedupe = normalizeConfig({roots: [pdfRoot, alias], destRoot, sourceRoot, home: path.join(base, 'home')});
  assert.deepEqual(dedupe.errors, []);
  assert.equal(dedupe.roots.length, 1, 'realpath deduplica');
  assert.equal(dedupe.roots[0], fs.realpathSync(pdfRoot));

  const bad = (options) => normalizeConfig({destRoot, sourceRoot, home: path.join(base, 'home'), ...options}).errors;
  assert.ok(bad({roots: ['relativa']}).length > 0);
  assert.ok(bad({roots: ['<x>']}).length > 0);
  assert.ok(bad({roots: [path.parse('/').root]}).length > 0);
  assert.ok(bad({roots: [path.join(base, 'home')]}).length > 0);
  assert.ok(bad({roots: [path.dirname(sourceRoot)]}).length > 0);
  assert.ok(bad({roots: ['/caminho/inexistente']}).length === 0, 'raiz inexistente é permitida com aviso');
  const warning = normalizeConfig({roots: ['/caminho/inexistente'], destRoot, sourceRoot, home: path.join(base, 'home')});
  assert.ok(warning.notes.some((item) => item.includes('ainda não existe')));

  const cache = normalizeConfig({roots: [], cacheDir: path.join(base, 'cache'), destRoot, sourceRoot, home: path.join(base, 'home')});
  assert.equal(cache.cacheDir, path.join(base, 'cache'));
  assert.equal(cache.cacheDirSource, 'flag');
  assert.ok(bad({cacheDir: 'relativo'}).length > 0);
  assert.ok(bad({cacheDir: '/<cache>'}).length > 0);

  const helperOk = normalizeConfig({roots: [], xournalHelper: helper, destRoot, sourceRoot, home: path.join(base, 'home')});
  assert.equal(helperOk.xournalHelper, helper);
  assert.ok(bad({xournalHelper: 'relativo'}).length > 0);
  const notExecutable = writeFile(base, 'helper.txt', 'x');
  assert.ok(bad({xournalHelper: notExecutable}).length > 0);
  assert.ok(bad({xournalHelper: path.join(base, 'ausente')}).length > 0);

  assert.equal(normalizeConfig({roots: [], maxImageBytes: '8388608', destRoot, sourceRoot}).maxImageBytes, 8388608);
  assert.ok(bad({maxImageBytes: '10'}).length > 0);
  assert.ok(normalizeConfig({roots: [], maxImageBytes: null, destRoot, sourceRoot}).maxImageBytes === null);

  const fakeBin = mkdirp(path.join(base, 'bin'));
  const fakeNode = writeFile(base, 'bin/node', '#!/bin/sh\n');
  fs.chmodSync(fakeNode, 0o755);
  assert.equal(defaultNodeLauncher({env: {PATH: fakeBin}, execPath: '/nao/usar'}), fakeNode);
  assert.equal(defaultNodeLauncher({env: {PATH: ''}, execPath: '/nao/usar'}), '/nao/usar');
  assert.equal(defaultNodeLauncher({env: {PATH: path.join(base, 'vazio')}, execPath: '/nao/usar'}), '/nao/usar');
  assert.ok(path.isAbsolute(defaultNodeLauncher()));
});

test('staging: --tutor-file/--learner-file/--state-file viram flags absolutas; inválidos recusam', () => {
  const source = makeSourceFixture();
  const base = tempDir('mesa staging perfis ç ');
  const home = tempDir('mesa home ç ');
  const env = {HOME: home, CODEX_HOME: path.join(home, '.codex'), XDG_CONFIG_HOME: path.join(home, '.config')};
  const dest = path.join(base, 'destino perfis');
  const cache = path.join(base, 'cache externo');
  const tutor = writeFile(base, 'TUTOR.md', '# Tutor\n');
  const learner = writeFile(base, 'LEARNER.md', '# Learner\n');
  const stateFile = path.join(cache, 'estado.json');
  const canonicalCache = path.join(fs.realpathSync(base), 'cache externo');
  const canonicalState = path.join(canonicalCache, 'estado.json');

  const result = run([
    '--dest', dest, '--source', source,
    '--cache-dir', cache,
    '--tutor-file', tutor, '--learner-file', learner, '--state-file', stateFile,
  ], env);
  assert.equal(result.status, 0, result.stderr);
  const parsed = readReport(result);
  assert.equal(parsed.config.tutorFile, fs.realpathSync(tutor));
  assert.equal(parsed.config.learnerFile, fs.realpathSync(learner));
  assert.equal(parsed.config.stateFile, canonicalState);
  assert.ok(fs.existsSync(path.join(dest, '.mcp.json')));

  const args = JSON.parse(fs.readFileSync(path.join(dest, '.mcp.json'), 'utf8')).mcpServers.mesa.args;
  for (const [flag, value] of [
    ['--tutor-file', fs.realpathSync(tutor)],
    ['--learner-file', fs.realpathSync(learner)],
    ['--state-file', canonicalState],
  ]) {
    const index = args.indexOf(flag);
    assert.notEqual(index, -1, `${flag} presente nos args`);
    assert.equal(args[index + 1], value, `${flag} com caminho absoluto canônico`);
  }
  const toml = fs.readFileSync(path.join(dest, TOML_FILE), 'utf8');
  assert.ok(toml.includes('--tutor-file'));
  assert.ok(toml.includes('--learner-file'));
  assert.ok(toml.includes('--state-file'));

  /* state fora do cache: recusa antes de criar o destino. */
  const dest2 = path.join(base, 'destino fora');
  const badState = run([
    '--dest', dest2, '--source', source, '--cache-dir', cache,
    '--state-file', path.join(base, 'fora.json'),
  ], env);
  assert.equal(badState.status, 1);
  assert.match(badState.stderr, /state-file/);
  assert.equal(fs.existsSync(dest2), false);

  /* tutor symlink: recusa como o servidor. */
  const link = path.join(base, 'LINK.md');
  fs.symlinkSync(tutor, link);
  const dest3 = path.join(base, 'destino link');
  const badTutor = run(['--dest', dest3, '--source', source, '--tutor-file', link], env);
  assert.equal(badTutor.status, 1);
  assert.match(badTutor.stderr, /tutor-file/);
  assert.equal(fs.existsSync(dest3), false);

  /* tutor acima do teto: recusa sem copiar nada. */
  const big = path.join(base, 'BIG.md');
  fs.writeFileSync(big, Buffer.alloc(65537, 0x61));
  const dest4 = path.join(base, 'destino grande');
  const badBig = run(['--dest', dest4, '--source', source, '--learner-file', big], env);
  assert.equal(badBig.status, 1);
  assert.match(badBig.stderr, /learner-file/);
  assert.equal(fs.existsSync(dest4), false);
});
