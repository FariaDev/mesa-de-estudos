/* Testes do doctor: parser do setup, prontidão, leitura somente (nada é
   criado/alterado), CLI, paridade da resolução do Poppler com o host e
   neutralidade quanto a configurações globais (HOME falso intocado). */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ENV, parseSetup, parseNodeVersion, runDoctor, resolveFixedDirTool, versionAtLeast} from '../scripts/doctor.mjs';
import {resolvePopplerTool} from '../host/tools.mjs';
import {inspectCacheDir} from '../server/checks.mjs';

test('doctor: cache ausente sob arquivo ou ancestral sem escrita nunca fica pronto', () => {
  const root = makePackageFixture();
  const base = tempDir('mesa cache indisponível ');
  const pdfRoot = mkdirp(path.join(base, 'pdfs'));
  const file = writeFile(base, 'arquivo', 'synthetic');
  const locked = mkdirp(path.join(base, 'sem escrita'));
  try {
    for (const parent of [file, locked]) {
      const cache = path.join(parent, 'cache');
      const io = fsIo();
      const normalAccess = io.access;
      // Simulates a denied access check independently of the test user's UID.
      io.access = (target, mode) => {
        if (target === locked && mode === fs.constants.W_OK) {
          throw Object.assign(new Error('permission denied'), {code: 'EACCES'});
        }
        return normalAccess(target, mode);
      };
      const result = runDoctor({root, env: {
        [ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: cache,
      }, io});
      const serverCheck = inspectCacheDir(cache, {access: io.access});
      assert.equal(serverCheck.available, false);
      assert.equal(result.ok, false);
      assert.equal(result.ready.pdf, false);
      assert.equal(result.checks.setup.cacheDir.ready, false);
      assert.ok(result.blocked.some(item => item.includes('cacheDir')));
      assert.equal(fs.existsSync(cache), false, 'diagnóstico não cria o cache');
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
    fs.rmSync(root, {recursive: true, force: true});
  }
});

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doctorScript = path.join(pluginRoot, 'scripts/doctor.mjs');

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

function makePackageFixture() {
  const root = tempDir('mesa doctor ç ');
  writeFile(root, '.codex-plugin/plugin.json', JSON.stringify({
    name: 'mesa-study',
    version: '0.1.0',
    skills: './skills/',
    mcpServers: './.mcp.json',
    interface: {displayName: 'Mesa', shortDescription: 'Teste', longDescription: 'Teste', developerName: 'Teste', category: 'Education & Research', capabilities: []},
  }));
  writeFile(root, '.mcp.json', JSON.stringify({
    mcpServers: {mesa: {command: 'node', args: ['./server/main.mjs'], cwd: './', env_vars: ['MESA_STUDY_ROOTS']}},
  }));
  writeFile(root, 'server/main.mjs', '// fixture\n');
  writeFile(root, 'ui/desk.html', '<!doctype html><title>Mesa fixture</title>');
  writeFile(root, 'host/errors.mjs', 'export class HostError extends Error {}\n');
  writeFile(root, 'skills/mesa/SKILL.md', '---\nname: mesa\ndescription: fixture\n---\n');
  writeFile(root, 'assets/icon.png', 'png-placeholder');
  writeFile(root, 'assets/logo.png', 'png-placeholder');
  writeFile(root, 'node_modules/@modelcontextprotocol/sdk/package.json', '{"name":"@modelcontextprotocol/sdk","version":"1.32.0"}');
  writeFile(root, 'node_modules/zod/package.json', '{"name":"zod","version":"4.6.5"}');
  return root;
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

/* io determinístico: finge Poppler presente/ausente sem depender da máquina;
   o resto do disco é o real. */
function fsIo({poppler = true, exec} = {}) {
  const isTool = (target) => /(pdfinfo|pdftocairo)$/.test(String(target));
  return {
    stat: (target) => (isTool(target) ? {isFile: () => poppler} : fs.statSync(target)),
    access: (target, mode) => {
      if (isTool(target)) {
        if (!poppler) throw new Error('ENOENT');
        return;
      }
      fs.accessSync(target, mode);
    },
    exec: exec || ((binary) => (binary === 'node' ? 'v22.19.0\n' : `${path.basename(binary)} version 25.09.1\n`)),
  };
}

function makeExecutable(root, relative) {
  const target = writeFile(root, relative, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(target, 0o755);
  return target;
}

test('parseSetup: JSON de raízes, cache e helper sem criar nada', () => {
  const base = tempDir('mesa setup ç ');
  const existing = mkdirp(path.join(base, 'pdfs com espaço'));
  const missing = path.join(base, 'ainda não existe');
  const cache = path.join(base, 'cache que não deve nascer');
  const setup = parseSetup({
    [ENV.roots]: JSON.stringify([existing, missing, existing]),
    [ENV.cacheDir]: cache,
    [ENV.maxImageBytes]: '1048576',
  });
  assert.equal(setup.roots.configured, true);
  assert.equal(setup.roots.valid, true);
  assert.equal(setup.roots.count, 2, 'deduplica realpath');
  assert.equal(setup.roots.ready, true);
  assert.deepEqual(setup.roots.missing, [missing]);
  assert.equal(setup.cacheDir.configured, true);
  assert.equal(setup.cacheDir.absolute, true);
  assert.equal(setup.cacheDir.exists, false);
  assert.equal(fs.existsSync(cache), false, 'doctor não cria o cacheDir');
  assert.equal(setup.maxImageBytes.valid, true);

  const invalid = parseSetup({[ENV.roots]: '{'});
  assert.equal(invalid.roots.valid, false);
  assert.match(invalid.roots.error, /JSON/);

  const relativeRoot = parseSetup({[ENV.roots]: JSON.stringify(['relativa'])});
  assert.equal(relativeRoot.roots.valid, false);
  assert.match(relativeRoot.roots.error, /não absoluto|absoluto/);

  const relativeHelper = parseSetup({[ENV.xournalHelper]: 'relativo'});
  assert.equal(relativeHelper.xournalHelper.executable, false);
  assert.equal(relativeHelper.xournalHelper.ready, false);

  const executableHelper = makeExecutable(base, 'helper ç.sh');
  const goodHelper = parseSetup({[ENV.xournalHelper]: executableHelper});
  assert.equal(goodHelper.xournalHelper.executable, true);
  assert.equal(goodHelper.xournalHelper.ready, true);

  const strangeMax = parseSetup({[ENV.maxImageBytes]: '2'});
  assert.equal(strangeMax.maxImageBytes.valid, false);

  const zero = parseSetup({});
  assert.equal(zero.roots.configured, false);
  assert.equal(zero.roots.ready, false, 'zero raízes é permitido, mas PDF fica desabilitado');
});

test('runDoctor: pacote completo, raízes e cache configurados, tudo pronto', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa pdfs ç '), 'materiais'));
  const cache = path.join(root, 'cache que não deve nascer');
  const before = snapshot(root);
  const result = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: cache},
    platform: 'darwin',
    io: fsIo(),
  });
  assert.equal(result.ok, true, JSON.stringify(result.blocked));
  assert.equal(result.ready.pdf, true);
  assert.equal(result.checks.launcher.available, true);
  assert.equal(result.checks.launcher.version, '22.19.0');
  assert.equal(result.checks.poppler.tools.pdfinfo.version, '25.09.1');
  assert.equal(result.checks.package.ok, true);
  assert.equal(result.checks.dependencies.installed, true);
  assert.equal(result.checks.poppler.available, true);
  assert.equal(result.checks.setup.roots.ready, true);
  assert.equal(result.blocked.length, 0);
  assert.equal(fs.existsSync(cache), false, 'doctor não cria o cacheDir');
  assert.deepEqual(snapshot(root), before, 'doctor não escreve no pacote');
});

test('runDoctor: pacote incompleto (assets/manifestos) não passa como pronto', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa pdfs ç '), 'materiais'));
  const env = {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')};
  const before = snapshot(root);

  fs.rmSync(path.join(root, 'assets/logo.png'));
  const noLogo = runDoctor({root, env, io: fsIo()});
  assert.equal(noLogo.checks.package.ok, false, 'assets faltando entram em issues e derrubam package.ok');
  assert.ok(noLogo.checks.package.issues.some((item) => item.includes('assets')));
  assert.ok(noLogo.blocked.some((item) => item.includes('assets')));
  assert.equal(noLogo.ready.pdf, false);
  assert.equal(noLogo.ok, false, 'ok exige zero bloqueios (não só ready.pdf)');

  const pluginPath = path.join(root, '.codex-plugin/plugin.json');
  const manifest = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
  manifest.name = 'outro-plugin';
  fs.writeFileSync(pluginPath, JSON.stringify(manifest));
  const wrongName = runDoctor({root, env, io: fsIo()});
  assert.equal(wrongName.checks.package.ok, false);
  assert.ok(wrongName.checks.package.issues.some((item) => item.includes('name')));
  assert.equal(wrongName.ok, false);

  fs.writeFileSync(pluginPath, '{"name":');
  const brokenJson = runDoctor({root, env, io: fsIo()});
  assert.equal(brokenJson.checks.package.ok, false);
  assert.ok(brokenJson.checks.package.issues.some((item) => item.includes('inválido')));
  assert.equal(brokenJson.ok, false);
  assert.notDeepEqual(snapshot(root), before, 'o doctor só lê; as mudanças são do próprio teste');
});

test('runDoctor: cacheDir existente inseguro bloqueia (symlink/file/perms/dono)', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa pdfs ç '), 'materiais'));
  const base = tempDir('mesa cache ç ');
  const rootsEnv = {[ENV.roots]: JSON.stringify([pdfRoot])};

  const fileCache = writeFile(base, 'cache-arquivo', 'sou arquivo');
  const asFile = runDoctor({root, env: {...rootsEnv, [ENV.cacheDir]: fileCache}, io: fsIo()});
  assert.equal(asFile.checks.setup.cacheDir.ready, false);
  assert.equal(asFile.ready.pdf, false);
  assert.equal(asFile.ok, false);
  assert.ok(asFile.blocked.some((item) => item.includes('cacheDir')));

  const realDir = mkdirp(path.join(base, 'cache-real'));
  fs.chmodSync(realDir, 0o700);
  const linkCache = path.join(base, 'cache-link');
  fs.symlinkSync(realDir, linkCache, 'dir');
  const asLink = runDoctor({root, env: {...rootsEnv, [ENV.cacheDir]: linkCache}, io: fsIo()});
  assert.equal(asLink.checks.setup.cacheDir.symlink, true);
  assert.equal(asLink.checks.setup.cacheDir.ready, false);
  assert.equal(asLink.ok, false);

  const openDir = mkdirp(path.join(base, 'cache-0777'));
  fs.chmodSync(openDir, 0o777);
  const asOpen = runDoctor({root, env: {...rootsEnv, [ENV.cacheDir]: openDir}, io: fsIo()});
  assert.equal(asOpen.checks.setup.cacheDir.ready, false);
  assert.equal(asOpen.ok, false);
  assert.ok(asOpen.blocked.some((item) => item.includes('0700')));

  const readableDir = mkdirp(path.join(base, 'cache-0755'));
  fs.chmodSync(readableDir, 0o755);
  const asReadable = runDoctor({root, env: {...rootsEnv, [ENV.cacheDir]: readableDir}, io: fsIo()});
  assert.equal(asReadable.checks.setup.cacheDir.ready, true, 'o host só recusa escrita por grupo/outros (0755 passa)');

  const privateDir = mkdirp(path.join(base, 'cache-0700'));
  fs.chmodSync(privateDir, 0o700);
  const asPrivate = runDoctor({root, env: {...rootsEnv, [ENV.cacheDir]: privateDir}, io: fsIo()});
  assert.equal(asPrivate.checks.setup.cacheDir.ready, true, JSON.stringify(asPrivate.blocked));
  assert.equal(asPrivate.ok, true);

  const foreignUid = runDoctor({
    root,
    env: {...rootsEnv, [ENV.cacheDir]: privateDir},
    io: {...fsIo(), getuid: () => (typeof process.getuid === 'function' ? process.getuid() : 0) + 4242},
  });
  assert.equal(foreignUid.checks.setup.cacheDir.ready, false);
  assert.equal(foreignUid.ok, false);
  assert.ok(foreignUid.blocked.some((item) => item.includes('outro usuário')));
});

test('runDoctor: maxImageBytes e helper inválidos bloqueiam como no servidor', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa pdfs ç '), 'materiais'));
  const base = {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')};

  for (const raw of ['2', '33554433', 'abc', '1.5', '  ']) {
    const result = runDoctor({root, env: {...base, [ENV.maxImageBytes]: raw}, io: fsIo()});
    assert.equal(result.ok, false, `max=${JSON.stringify(raw)} não pode passar`);
    assert.equal(result.checks.setup.maxImageBytes.valid, false);
    assert.ok(result.blocked.some((item) => item.includes(ENV.maxImageBytes)));
    assert.ok(!result.warnings.some((item) => item.includes('padrão')), 'não afirmar fallback para o padrão');
  }

  const validMax = runDoctor({root, env: {...base, [ENV.maxImageBytes]: '1048576'}, io: fsIo()});
  assert.equal(validMax.ok, true, JSON.stringify(validMax.blocked));

  const relativeHelper = runDoctor({root, env: {...base, [ENV.xournalHelper]: 'relativo'}, io: fsIo()});
  assert.equal(relativeHelper.ok, false);
  assert.equal(relativeHelper.checks.setup.xournalHelper.valid, false);
  assert.ok(relativeHelper.blocked.some((item) => item.includes(ENV.xournalHelper)));
  assert.equal(relativeHelper.ready.capture, false);

  const longHelper = runDoctor({
    root,
    env: {...base, [ENV.xournalHelper]: `/${'a'.repeat(4096)}`},
    io: fsIo(),
  });
  assert.equal(longHelper.ok, false);
  assert.equal(longHelper.checks.setup.xournalHelper.valid, false);
  assert.ok(longHelper.blocked.some((item) => item.includes('caracteres')));
});

test('runDoctor: raízes acima do teto do servidor bloqueiam antes de existir', () => {
  const root = makePackageFixture();
  const tooMany = Array.from({length: 65}, (_, index) => `/raiz/falsa/${index}`);
  const result = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify(tooMany), [ENV.cacheDir]: path.join(root, 'cache')},
    io: fsIo(),
  });
  assert.equal(result.checks.setup.roots.valid, false);
  assert.match(result.checks.setup.roots.error, /64/);
  assert.equal(result.ok, false);
  assert.ok(result.blocked.some((item) => item.includes('64')));
});

test('runDoctor: camadas pendentes são reportadas, não escondidas', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa pdfs ç '), 'materiais'));
  const popplerIo = fsIo();

  const oldNode = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')},
    nodeVersion: '20.11.0',
    io: popplerIo,
  });
  assert.equal(oldNode.ok, false);
  assert.ok(oldNode.blocked.some((item) => item.includes('anterior a 22.19.0')));

  const noLauncher = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')},
    io: fsIo({exec: (binary) => {
      if (binary === 'node') throw Object.assign(new Error('ENOENT'), {code: 'ENOENT'});
      return '25.09.1\n';
    }}),
  });
  assert.equal(noLauncher.ok, false);
  assert.ok(noLauncher.blocked.some((item) => item.includes('`node`')));

  const noPoppler = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')},
    io: fsIo({poppler: false}),
  });
  assert.equal(noPoppler.ok, false);
  assert.equal(noPoppler.checks.poppler.available, false);
  assert.ok(noPoppler.blocked.some((item) => item.includes('Poppler')));

  fs.rmSync(path.join(root, 'node_modules'), {recursive: true});
  const noDeps = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')},
    io: popplerIo,
  });
  assert.equal(noDeps.ok, false);
  assert.deepEqual(noDeps.checks.dependencies.missing, ['@modelcontextprotocol/sdk', 'zod']);
  assert.ok(noDeps.blocked.some((item) => item.includes('npm ci')));

  fs.rmSync(path.join(root, 'server/main.mjs'));
  const noServer = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')},
    io: popplerIo,
  });
  assert.equal(noServer.ok, false);
  assert.ok(noServer.checks.package.missing.includes('server/main.mjs'));
  assert.ok(noServer.blocked.some((item) => item.includes('server/main.mjs')));
});

test('runDoctor: raízes ausentes/inválidas e captura opcional', () => {
  const root = makePackageFixture();
  const zero = runDoctor({
    root,
    env: {[ENV.cacheDir]: path.join(root, 'cache')},
    io: fsIo(),
  });
  assert.equal(zero.ok, false);
  assert.ok(zero.blocked.some((item) => item.includes('Nenhuma raiz')));

  const badJson = runDoctor({root, env: {[ENV.roots]: '{'}, io: fsIo()});
  assert.ok(badJson.blocked.some((item) => item.includes('JSON')));

  const missingRoot = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify(['/caminho/que/nao/existe']), [ENV.cacheDir]: path.join(root, 'cache')},
    io: fsIo(),
  });
  assert.ok(missingRoot.blocked.some((item) => item.includes('Nenhuma raiz')));
  assert.equal(missingRoot.checks.setup.roots.missing.length, 1);

  const helper = makeExecutable(root, 'helper do xournal.sh');
  const withCapture = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([fs.mkdtempSync(path.join(os.tmpdir(), 'mesa pdf ç '))]), [ENV.cacheDir]: path.join(root, 'cache'), [ENV.xournalHelper]: helper},
    platform: 'darwin',
    io: fsIo(),
  });
  assert.equal(withCapture.ready.pdf, true);
  assert.equal(withCapture.ready.capture, true);
  assert.equal(withCapture.warnings.length, 0);

  const textHelper = writeFile(root, 'helper.txt', 'não executável');
  const notExecutable = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([fs.mkdtempSync(path.join(os.tmpdir(), 'mesa pdf ç '))]), [ENV.cacheDir]: path.join(root, 'cache'), [ENV.xournalHelper]: textHelper},
    platform: 'darwin',
    io: fsIo(),
  });
  assert.equal(notExecutable.ready.capture, false);
  assert.ok(notExecutable.warnings.some((item) => item.includes('não executável')));
});

test('runDoctor: sem helper a captura fica desligada sem bloquear o PDF', () => {
  const root = makePackageFixture();
  const pdfRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa pdf ç '));
  const result = runDoctor({
    root,
    env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: path.join(root, 'cache')},
    io: fsIo(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.ready.capture, false);
  assert.ok(result.warnings.some((item) => item.includes('Helper do Xournal++')));
});

test('CLI: JSON no stdout, código 2 com raízes pendentes e nada criado', () => {
  const root = makePackageFixture();
  const cache = path.join(root, 'cache que não deve nascer');
  const before = snapshot(root);
  const home = tempDir('mesa home ç ');
  const result = spawnSync(process.execPath, [doctorScript, '--root', root], {
    encoding: 'utf8',
    env: {...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), [ENV.roots]: '[]', [ENV.cacheDir]: cache},
  });
  assert.equal(result.status, 2);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.ok(result.stderr.includes('doctor'));
  assert.equal(fs.existsSync(cache), false);
  assert.deepEqual(snapshot(root), before);
  assert.deepEqual(fs.readdirSync(home), [], 'doctor não grava em HOME/CODEX_HOME');
});

test('CLI: --help sai 0 com uso', () => {
  const result = spawnSync(process.execPath, [doctorScript, '--help'], {encoding: 'utf8'});
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Uso: node scripts\/doctor\.mjs/);
});

test('CLI: raízes e cache reais dão o código coerente com a prontidão', () => {
  const root = makePackageFixture();
  const pdfRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa pdf ç '));
  const cache = path.join(root, 'cache');
  const result = spawnSync(process.execPath, [doctorScript, '--root', root], {
    encoding: 'utf8',
    env: {...process.env, [ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: cache},
  });
  const parsed = JSON.parse(result.stdout);
  assert.equal(result.status, parsed.ok ? 0 : 2);
  if (parsed.checks.poppler.available && parsed.checks.node.supported) {
    assert.equal(parsed.ok, true);
    assert.equal(result.status, 0);
  }
  assert.equal(fs.existsSync(cache), false);
});

test('paridade: resolução do Poppler igual à do host', () => {
  assert.equal(resolveFixedDirTool('pdfinfo'), resolvePopplerTool('pdfinfo'));
  assert.equal(resolveFixedDirTool('pdftocairo'), resolvePopplerTool('pdftocairo'));
});

test('versões do Node: parser e comparação', () => {
  assert.deepEqual(parseNodeVersion('v22.19.0'), [22, 19, 0]);
  assert.equal(parseNodeVersion('sem versão'), null);
  assert.equal(versionAtLeast([22, 19, 0], [22, 19, 0]), true);
  assert.equal(versionAtLeast([22, 18, 9], [22, 19, 0]), false);
  assert.equal(versionAtLeast([26, 10, 0], [22, 19, 0]), true);
});
