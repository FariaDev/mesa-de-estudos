/* Paridade doctor × configuração REAL de inicialização do servidor
   (server/config.mjs), sem app, sem modelo e sem processo stdio: para cada
   ambiente, o veredito de parseStartupConfig (STARTUP_INVALID ou aceito) é
   comparado com o do doctor.

   Direção garantida: entrada que o servidor recusa NUNCA vira "PDF pronto" no
   doctor. Onde o doctor é mais restrito (zero raízes, raiz inexistente), o
   teste documenta o porquê: o servidor sobe, mas a leitura de PDF não
   funcionaria. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ENV, parseSetup, runDoctor} from '../scripts/doctor.mjs';
import {MAX_PATH_CHARS, MAX_ROOTS} from '../host/config.mjs';
import {parseStartupConfig} from '../server/config.mjs';

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
  const root = tempDir('mesa paridade ç ');
  writeFile(root, '.codex-plugin/plugin.json', JSON.stringify({
    name: 'mesa-study',
    version: '0.1.0-experimental',
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

/* io determinístico: Poppler presente, node respondendo; o resto é o disco real. */
function fsIo({poppler = true, getuid} = {}) {
  const isTool = (target) => /(pdfinfo|pdftocairo)$/.test(String(target));
  const io = {
    stat: (target) => (isTool(target) ? {isFile: () => poppler} : fs.statSync(target)),
    access: (target, mode) => {
      if (isTool(target)) {
        if (!poppler) throw new Error('ENOENT');
        return;
      }
      fs.accessSync(target, mode);
    },
    exec: (binary) => (binary === 'node' ? 'v22.19.0\n' : `${path.basename(binary)} version 25.09.1\n`),
  };
  if (typeof getuid === 'function') io.getuid = getuid;
  return io;
}

/* Veredito do parser real do servidor, sem iniciar o processo. */
function serverVerdict(env) {
  try {
    const parsed = parseStartupConfig({argv: [], env});
    return {accepted: true, config: parsed.config};
  } catch (error) {
    return {accepted: false, code: error.code, message: error.message};
  }
}

function doctorFor(env, {root, io = fsIo()} = {}) {
  return runDoctor({root, env, platform: 'darwin', io});
}

test('paridade: entrada recusada pelo servidor nunca vira PDF pronto no doctor', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa paridade pdfs ç '), 'materiais'));
  const baseEnv = {
    [ENV.roots]: JSON.stringify([pdfRoot]),
    [ENV.cacheDir]: path.join(tempDir('mesa paridade cache ç '), 'cache'),
  };
  const tooManyRoots = Array.from({length: MAX_ROOTS + 1}, (_, index) => `/raiz/falsa/${index}`);

  const cases = [
    {label: 'roots JSON inválido', env: {...baseEnv, [ENV.roots]: '{'}},
    {label: 'roots não-array', env: {...baseEnv, [ENV.roots]: '{}'}},
    {label: 'root não-string', env: {...baseEnv, [ENV.roots]: JSON.stringify([123])}},
    {label: 'root relativa', env: {...baseEnv, [ENV.roots]: JSON.stringify(['relativa'])}},
    {label: 'roots acima do teto', env: {...baseEnv, [ENV.roots]: JSON.stringify(tooManyRoots)}},
    {label: 'cacheDir relativo', env: {...baseEnv, [ENV.cacheDir]: 'relativo'}},
    {label: 'max abaixo do mínimo', env: {...baseEnv, [ENV.maxImageBytes]: '2'}},
    {label: 'max não-numérico', env: {...baseEnv, [ENV.maxImageBytes]: 'abc'}},
    {label: 'max só espaços', env: {...baseEnv, [ENV.maxImageBytes]: '  '}},
    {label: 'helper relativo', env: {...baseEnv, [ENV.xournalHelper]: 'relativo'}},
    {label: 'helper longo demais', env: {...baseEnv, [ENV.xournalHelper]: `/${'a'.repeat(MAX_PATH_CHARS)}`}},
  ];

  for (const {label, env} of cases) {
    const verdict = serverVerdict(env);
    assert.equal(verdict.accepted, false, `servidor deveria recusar (${label})`);
    assert.equal(verdict.code, 'STARTUP_INVALID', label);

    const result = doctorFor(env, {root});
    assert.equal(result.ok, false, `doctor não pode declarar pronto (${label}); bloqueios: ${JSON.stringify(result.blocked)}`);
    assert.ok(result.blocked.length > 0, label);
    assert.ok(
      result.blocked.some((item) => item.includes(ENV.roots) || item.includes('Raiz') || item.includes('raízes') ||
        item.includes('cacheDir') || item.includes(ENV.maxImageBytes) || item.includes(ENV.xournalHelper)),
      `bloqueio precisa apontar a entrada inválida (${label}): ${JSON.stringify(result.blocked)}`,
    );
    assert.equal(result.ready.pdf, false, label);
  }
});

test('paridade: flags por campo do parser do doctor reproduzem o servidor', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa paridade pdfs ç '), 'materiais'));
  const baseEnv = {
    [ENV.roots]: JSON.stringify([pdfRoot]),
    [ENV.cacheDir]: path.join(tempDir('mesa paridade cache ç '), 'cache'),
  };

  const invalidMax = parseSetup({...baseEnv, [ENV.maxImageBytes]: '2'});
  assert.equal(invalidMax.maxImageBytes.configured, true);
  assert.equal(invalidMax.maxImageBytes.valid, false);
  assert.match(invalidMax.maxImageBytes.error, /STARTUP_INVALID/);

  const relativeCache = parseSetup({...baseEnv, [ENV.cacheDir]: 'relativo'});
  assert.equal(relativeCache.cacheDir.absolute, false);
  assert.equal(relativeCache.cacheDir.ready, false);

  const tooMany = parseSetup({...baseEnv, [ENV.roots]: JSON.stringify(Array.from({length: MAX_ROOTS + 1}, (_, i) => `/r/${i}`))});
  assert.equal(tooMany.roots.valid, false);
  assert.ok(tooMany.roots.error.includes(String(MAX_ROOTS)));

  const relativeHelper = parseSetup({...baseEnv, [ENV.xournalHelper]: 'relativo'});
  assert.equal(relativeHelper.xournalHelper.valid, false);
  assert.equal(relativeHelper.xournalHelper.executable, false);
});

test('paridade: ambiente aceito pelo servidor e completo dá doctor pronto', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa paridade pdfs ç '), 'materiais'));
  const cache = path.join(tempDir('mesa paridade cache ç '), 'ainda não existe');
  const env = {
    [ENV.roots]: JSON.stringify([pdfRoot]),
    [ENV.cacheDir]: cache,
    [ENV.maxImageBytes]: '1048576',
  };

  const verdict = serverVerdict(env);
  assert.equal(verdict.accepted, true);
  assert.equal(verdict.config.roots.length, 1);
  assert.equal(verdict.config.cacheDir, cache);
  assert.equal(verdict.config.maxImageBytes, 1048576);

  const result = doctorFor(env, {root});
  assert.equal(result.ok, true, JSON.stringify(result.blocked));
  assert.equal(result.ready.pdf, true);
  assert.equal(result.checks.setup.roots.count, 1);
  assert.equal(result.checks.setup.cacheDir.ready, true);
  assert.equal(result.checks.setup.maxImageBytes.value, 1048576);
  assert.equal(fs.existsSync(cache), false, 'o doctor não cria o cacheDir');

  // Dedupe por realpath: o servidor congela uma raiz; o doctor conta uma.
  const alias = path.join(path.dirname(pdfRoot), 'alias da raiz');
  fs.symlinkSync(pdfRoot, alias, 'dir');
  const aliasEnv = {...env, [ENV.roots]: JSON.stringify([pdfRoot, alias])};
  assert.equal(serverVerdict(aliasEnv).config.roots.length, 1);
  assert.equal(parseSetup(aliasEnv).roots.count, 1);
});

test('paridade: onde o doctor é mais restrito, o motivo é a leitura de PDF', () => {
  const root = makePackageFixture();
  const base = tempDir('mesa paridade ç ');
  const missingRoot = path.join(base, 'ainda não existe');
  const cache = path.join(base, 'cache');

  // O servidor aceita subir com raiz ausente (o host a ignora) e sem cache;
  // o doctor bloqueia porque mesa_page não funcionaria.
  const missingOnly = {[ENV.roots]: JSON.stringify([missingRoot]), [ENV.cacheDir]: cache};
  assert.equal(serverVerdict(missingOnly).accepted, true);
  const missingResult = doctorFor(missingOnly, {root});
  assert.equal(missingResult.ok, false);
  assert.ok(missingResult.blocked.some((item) => item.includes('Nenhuma raiz')));
  assert.equal(missingResult.checks.setup.roots.missing.length, 1);

  const zeroRoots = {[ENV.roots]: '[]', [ENV.cacheDir]: cache};
  assert.equal(serverVerdict(zeroRoots).accepted, true);
  assert.equal(serverVerdict(zeroRoots).config.roots.length, 0);
  const zeroResult = doctorFor(zeroRoots, {root});
  assert.equal(zeroResult.ok, false);
  assert.ok(zeroResult.blocked.some((item) => item.includes('Nenhuma raiz')));

  const noCache = {[ENV.roots]: JSON.stringify([mkdirp(path.join(base, 'pdfs'))])};
  assert.equal(serverVerdict(noCache).accepted, true);
  assert.equal(serverVerdict(noCache).config.cacheDir, null);
  const noCacheResult = doctorFor(noCache, {root});
  assert.equal(noCacheResult.ok, false);
  assert.ok(noCacheResult.blocked.some((item) => item.includes('cacheDir')));

  // max vazio: o servidor aplica o padrão; o doctor concorda e não bloqueia.
  const emptyMax = {[ENV.roots]: JSON.stringify([mkdirp(path.join(base, 'pdfs2'))]), [ENV.cacheDir]: cache, [ENV.maxImageBytes]: ''};
  const defaults = serverVerdict(emptyMax);
  assert.equal(defaults.accepted, true);
  assert.equal(defaults.config.maxImageBytes, 8 * 1024 * 1024);
  const emptyMaxResult = doctorFor(emptyMax, {root});
  assert.equal(emptyMaxResult.checks.setup.maxImageBytes.valid, true);
  assert.equal(emptyMaxResult.ok, true, JSON.stringify(emptyMaxResult.blocked));

  // Cache existente mas inseguro: o STARTUP aceita (só exige caminho absoluto),
  // porém o host recusaria na primeira escrita (host/output.mjs); o doctor
  // bloqueia — ser mais restrito aqui evita "PDF pronto" que quebra na prática.
  const unsafeCache = path.join(base, 'cache-arquivo');
  fs.writeFileSync(unsafeCache, 'arquivo, não diretório');
  const unsafeEnv = {[ENV.roots]: JSON.stringify([mkdirp(path.join(base, 'pdfs3'))]), [ENV.cacheDir]: unsafeCache};
  assert.equal(serverVerdict(unsafeEnv).accepted, true);
  const unsafeResult = doctorFor(unsafeEnv, {root});
  assert.equal(unsafeResult.ok, false);
  assert.equal(unsafeResult.checks.setup.cacheDir.ready, false);
  assert.ok(unsafeResult.blocked.some((item) => item.includes('cacheDir')));
});

test('CLI: max inválido sai código 2 (nunca 0 "PDF pronto")', () => {
  const root = makePackageFixture();
  const pdfRoot = mkdirp(path.join(tempDir('mesa paridade pdfs ç '), 'materiais'));
  const result = spawnSync(process.execPath, [doctorScript, '--root', root], {
    encoding: 'utf8',
    env: {
      ...process.env,
      [ENV.roots]: JSON.stringify([pdfRoot]),
      [ENV.cacheDir]: path.join(tempDir('mesa paridade cache ç '), 'cache'),
      [ENV.maxImageBytes]: '2',
    },
  });
  assert.equal(result.status, 2, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.ready.pdf, false);
  assert.ok(parsed.blocked.some((item) => item.includes(ENV.maxImageBytes)));
});

test('paridade: perfis e checkpoint recusados pelo servidor nunca viram PDF pronto no doctor', () => {
  const root = makePackageFixture();
  const base = tempDir('mesa paridade perfis ç ');
  const pdfRoot = mkdirp(path.join(base, 'pdfs'));
  const cache = mkdirp(path.join(base, 'cache'));
  const baseEnv = {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.cacheDir]: cache};

  const goodTutor = writeFile(base, 'TUTOR.md', '# Tutor\n');
  const realTutor = writeFile(base, 'REAL.md', '# real\n');
  const linkTutor = path.join(base, 'LINK.md');
  fs.symlinkSync(realTutor, linkTutor);
  const dirTutor = mkdirp(path.join(base, 'PASTA.md'));
  const bigTutor = path.join(base, 'BIG.md');
  fs.writeFileSync(bigTutor, Buffer.alloc(65537, 0x61));
  const badTutor = path.join(base, 'BAD.md');
  fs.writeFileSync(badTutor, Buffer.from([0xff, 0xfe, 0x00]));
  const stateIn = path.join(cache, 'estado.json');
  const stateOut = path.join(base, 'fora.json');
  const stateLinkTarget = writeFile(base, 'alvo.json', '{}');
  const stateLink = path.join(cache, 'link.json');
  fs.symlinkSync(stateLinkTarget, stateLink);

  const refusals = [
    {label: 'tutor symlink', env: {...baseEnv, [ENV.tutorFile]: linkTutor}},
    {label: 'tutor diretório', env: {...baseEnv, [ENV.tutorFile]: dirTutor}},
    {label: 'tutor acima do teto', env: {...baseEnv, [ENV.tutorFile]: bigTutor}},
    {label: 'learner não-UTF8', env: {...baseEnv, [ENV.learnerFile]: badTutor}},
    {label: 'state fora do cache', env: {...baseEnv, [ENV.stateFile]: stateOut}},
    {label: 'state sem cache', env: {[ENV.roots]: JSON.stringify([pdfRoot]), [ENV.stateFile]: stateIn}},
    {label: 'state não-json', env: {...baseEnv, [ENV.stateFile]: path.join(cache, 'estado.txt')}},
    {label: 'state symlink', env: {...baseEnv, [ENV.stateFile]: stateLink}},
  ];
  for (const {label, env} of refusals) {
    const verdict = serverVerdict(env);
    assert.equal(verdict.accepted, false, `servidor deveria recusar (${label})`);
    assert.equal(verdict.code, 'STARTUP_INVALID', label);
    const result = doctorFor(env, {root});
    assert.equal(result.ok, false, `doctor não pode declarar pronto (${label}): ${JSON.stringify(result.blocked)}`);
    assert.equal(result.ready.pdf, false, label);
    assert.ok(result.blocked.length > 0, label);
  }

  const accepted = {...baseEnv, [ENV.tutorFile]: goodTutor, [ENV.stateFile]: stateIn};
  const verdict = serverVerdict(accepted);
  assert.equal(verdict.accepted, true);
  const result = doctorFor(accepted, {root});
  assert.equal(result.ok, true, JSON.stringify(result.blocked));
  assert.equal(result.checks.setup.studyProfile.tutor.state, 'ready');
  assert.equal(result.checks.setup.studyProfile.tutor.available, true);
  assert.equal(result.checks.setup.stateFile.valid, true);
  assert.equal(result.checks.setup.stateFile.state, 'missing');
  assert.equal(result.checks.setup.stateFile.withinCache, true);
  assert.equal(fs.existsSync(stateIn), false, 'o doctor não cria o checkpoint');

  const missingProfile = {...baseEnv, [ENV.tutorFile]: path.join(base, 'ainda-nao-existe.md')};
  assert.equal(serverVerdict(missingProfile).accepted, true);
  const missingResult = doctorFor(missingProfile, {root});
  assert.equal(missingResult.ok, true, JSON.stringify(missingResult.blocked));
  assert.equal(missingResult.checks.setup.studyProfile.tutor.state, 'missing');
  assert.ok(missingResult.warnings.some((item) => item.includes('tutor')));
});
