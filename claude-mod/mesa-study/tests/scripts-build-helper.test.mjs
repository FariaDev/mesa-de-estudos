/* Testes do build explícito do helper nativo com runner FALSO (nenhum xcrun,
   nenhuma compilação, nenhum binário real). Cobrem ajuda, recusas de alvo,
   limpeza em falha, publicação sem sobrescrita e caminhos do plugin copiado. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  XCRUN_PATH,
  BUILD_TIMEOUT_MS,
  BUILD_MAX_BUFFER,
  buildHelper,
  buildHelperUsage,
  parseBuildArgs,
  runBuildHelper,
} from '../scripts/build-helper.mjs';
import {ScriptError} from '../scripts/shared.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function makePluginRoot({source = '// sintético\n', sourceKind = 'file'} = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-build-helper-'));
  const root = path.join(base, 'plugin');
  const nativeDir = path.join(root, 'native');
  await fs.mkdir(nativeDir, {recursive: true});
  if (source !== null) {
    if (sourceKind === 'file') await fs.writeFile(path.join(nativeDir, 'windows.swift'), source);
    if (sourceKind === 'dir') await fs.mkdir(path.join(nativeDir, 'windows.swift'));
  }
  return {base, root, nativeDir};
}

async function listing(dir) {
  return (await fs.readdir(dir)).sort();
}

async function lstatOrNull(target) {
  return fs.lstat(target).then((value) => value, () => null);
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error instanceof ScriptError && error.code === code, `esperado ${code}`);
}

function makeRunner({calls = [], behavior = 'write', stderr = 'erro sintético do swiftc'} = {}) {
  return async (argv, options) => {
    calls.push({argv, options});
    const staged = argv[argv.indexOf('-o') + 1];
    if (behavior === 'fail') return {ok: false, code: 1, missing: false, timedOut: false, stdout: '', stderr};
    if (behavior === 'missing') return {ok: false, code: null, missing: true, timedOut: false, stdout: '', stderr: ''};
    if (behavior === 'timeout') return {ok: false, code: null, missing: false, timedOut: true, stdout: '', stderr: ''};
    if (behavior === 'throw') throw new Error('spawn quebrado');
    if (behavior === 'no-write') return {ok: true, code: 0, missing: false, timedOut: false, stdout: '', stderr: ''};
    if (behavior === 'race') {
      const target = path.join(path.dirname(path.dirname(staged)), 'windows');
      await fs.writeFile(target, 'racer');
    }
    await fs.writeFile(staged, Buffer.from('synthetic-binary'));
    await fs.chmod(staged, 0o755);
    return {ok: true, code: 0, missing: false, timedOut: false, stdout: '', stderr: ''};
  };
}

test('parseBuildArgs: só --help; qualquer outro argumento é uso inválido', () => {
  assert.deepEqual(parseBuildArgs([]), {help: false});
  assert.deepEqual(parseBuildArgs(['--help']), {help: true});
  assert.deepEqual(parseBuildArgs(['-h']), {help: true});
  for (const bad of [['--force'], ['.'], ['--root', '/tmp'], ['--help', 'x']]) {
    assert.throws(() => parseBuildArgs(bad), (error) => error instanceof ScriptError && error.code === 'USAGE');
  }
});

test('runBuildHelper --help: sai 0, explica o comando e nunca chama o runner', async () => {
  const out = [];
  const err = [];
  const calls = [];
  const code = await runBuildHelper(['--help'], {
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    deps: {root: '/nao/existe', run: makeRunner({calls})},
  });
  assert.equal(code, 0);
  assert.equal(err.length, 0);
  assert.equal(calls.length, 0);
  const text = out.join('');
  assert.match(text, /\/usr\/bin\/xcrun swiftc/);
  assert.match(text, /nunca compilam sozinhos/i);
  assert.match(text, /nunca sobrescreve alvo existente/);
  assert.match(buildHelperUsage(), /captura, doctor e hooks nunca compilam/);
});

test('runBuildHelper: argumento desconhecido sai 2 e nada executa', async () => {
  const err = [];
  const calls = [];
  const code = await runBuildHelper(['--force'], {
    stdout: () => {},
    stderr: (text) => err.push(text),
    deps: {root: '/nao/existe', run: makeRunner({calls})},
  });
  assert.equal(code, 2);
  assert.match(err.join(''), /--force/);
  assert.equal(calls.length, 0);
});

test('buildHelper: sucesso compila em staging 0700, publica 0755 e limpa staging', async () => {
  const {base, root, nativeDir} = await makePluginRoot();
  try {
    const calls = [];
    const result = await buildHelper({root, run: makeRunner({calls})});
    const realNativeDir = await fs.realpath(nativeDir);
    assert.equal(result.ok, true);
    assert.equal(result.kind, 'build-helper');
    assert.equal(result.source, path.join(realNativeDir, 'windows.swift'));
    assert.equal(result.target, path.join(realNativeDir, 'windows'));
    assert.equal(result.mode, '0755');
    assert.ok(result.bytes > 0);

    const stat = await fs.lstat(result.target);
    assert.equal(stat.isFile(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.mode & 0o777, 0o755);
    assert.deepEqual(await fs.readFile(result.target), Buffer.from('synthetic-binary'));
    assert.deepEqual(await listing(nativeDir), ['windows', 'windows.swift']); // staging removido

    assert.equal(calls.length, 1);
    const {argv, options} = calls[0];
    const staged = argv[4];
    assert.deepEqual(argv.slice(0, 4), [XCRUN_PATH, 'swiftc', path.join(realNativeDir, 'windows.swift'), '-o']);
    assert.equal(path.basename(staged), 'windows');
    assert.equal(path.dirname(staged).startsWith(realNativeDir), true);
    assert.notEqual(staged, result.target);
    assert.equal('shell' in options, false); // argv lista fixa, nunca shell
    assert.equal(options.timeoutMs, BUILD_TIMEOUT_MS);
    assert.equal(options.maxBuffer, BUILD_MAX_BUFFER);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: recusa alvo existente (arquivo) e preserva o conteúdo', async () => {
  const {base, root, nativeDir} = await makePluginRoot();
  try {
    const target = path.join(nativeDir, 'windows');
    await fs.writeFile(target, 'do-not-clobber');
    const calls = [];
    await expectCode(buildHelper({root, run: makeRunner({calls})}), 'BUILD_TARGET_EXISTS');
    assert.equal(calls.length, 0);
    assert.equal(await fs.readFile(target, 'utf8'), 'do-not-clobber');
    assert.deepEqual(await listing(nativeDir), ['windows', 'windows.swift']);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: recusa symlink no alvo sem seguir o link', async () => {
  const {base, root, nativeDir} = await makePluginRoot();
  try {
    const outside = path.join(base, 'outside');
    await fs.writeFile(outside, 'outside-intact');
    const target = path.join(nativeDir, 'windows');
    await fs.symlink(outside, target);
    const calls = [];
    const promise = buildHelper({root, run: makeRunner({calls})});
    await assert.rejects(promise, (error) => {
      assert.equal(error.code, 'BUILD_TARGET_SYMLINK');
      assert.equal(error.detail.kind, 'symlink');
      assert.equal(/\brm\b/.test(error.message), false, 'sem sugestão de comando destrutivo');
      assert.match(error.message, /manualmente/);
      return true;
    });
    assert.equal(calls.length, 0);
    assert.equal((await fs.lstat(target)).isSymbolicLink(), true);
    assert.equal(await fs.readFile(outside, 'utf8'), 'outside-intact');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: native/ symlink é recusado sem runner e sem escrever fora do plugin', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-build-helper-native-link-'));
  const root = path.join(base, 'plugin');
  const outside = path.join(base, 'outside-native');
  try {
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'windows.swift'), '// fora do plugin\n');
    await fs.symlink(outside, path.join(root, 'native'));

    const calls = [];
    const error = await buildHelper({root, run: makeRunner({calls})}).then(() => null, (value) => value);
    assert.equal(error.code, 'BUILD_NATIVE_DIR_SYMLINK');
    assert.equal(error.detail.nativeDir, path.join(await fs.realpath(root), 'native'));
    assert.equal(calls.length, 0); // nenhum processo
    assert.deepEqual(await listing(outside), ['windows.swift']); // nenhuma escrita fora do plugin
    assert.equal((await fs.lstat(path.join(root, 'native'))).isSymbolicLink(), true); // link intacto
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: native/ que não é pasta é recusado sem runner', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-build-helper-native-file-'));
  const root = path.join(base, 'plugin');
  try {
    await fs.mkdir(root);
    await fs.writeFile(path.join(root, 'native'), 'arquivo qualquer');
    const calls = [];
    const error = await buildHelper({root, run: makeRunner({calls})}).then(() => null, (value) => value);
    assert.equal(error.code, 'BUILD_NATIVE_DIR_INVALID');
    assert.equal(calls.length, 0);
    assert.equal(await fs.readFile(path.join(root, 'native'), 'utf8'), 'arquivo qualquer');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: raiz com symlink resolve para a pasta real e publica dentro dela', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-build-helper-root-link-'));
  const realRoot = path.join(base, 'real-plugin');
  const linkedRoot = path.join(base, 'linked-plugin');
  try {
    await fs.mkdir(path.join(realRoot, 'native'), {recursive: true});
    await fs.writeFile(path.join(realRoot, 'native', 'windows.swift'), '// sintético\n');
    await fs.symlink(realRoot, linkedRoot);

    const calls = [];
    const result = await buildHelper({root: linkedRoot, run: makeRunner({calls})});
    const canonical = await fs.realpath(realRoot);
    assert.equal(result.source, path.join(canonical, 'native', 'windows.swift'));
    assert.equal(result.target, path.join(canonical, 'native', 'windows'));
    assert.equal((await fs.lstat(result.target)).isFile(), true);
    assert.equal(calls[0].argv[2], path.join(canonical, 'native', 'windows.swift'));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: native/ que resolve para fora da raiz é recusado (fs injetado)', async () => {
  const {base, root, nativeDir} = await makePluginRoot();
  try {
    const canonicalNative = path.join(await fs.realpath(root), 'native');
    const calls = [];
    const fsApi = {
      realpath: async (target) => (target === canonicalNative ? path.join(base, 'outside-native') : fs.realpath(target)),
    };
    const error = await buildHelper({root, fs: fsApi, run: makeRunner({calls})}).then(() => null, (value) => value);
    assert.equal(error.code, 'BUILD_NATIVE_DIR_ESCAPE');
    assert.equal(calls.length, 0);
    assert.equal(await lstatOrNull(path.join(nativeDir, 'windows')), null);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: falha de chmod no staging limpa a pasta e não chama o runner', async () => {
  const {base, root, nativeDir} = await makePluginRoot();
  try {
    const calls = [];
    let createdStaging = null;
    const fsApi = {
      mkdtemp: async (prefix) => {
        createdStaging = await fs.mkdtemp(prefix);
        return createdStaging;
      },
      chmod: async () => {
        throw Object.assign(new Error('EACCES sintético'), {code: 'EACCES'});
      },
    };
    const error = await buildHelper({root, fs: fsApi, run: makeRunner({calls})}).then(() => null, (value) => value);
    assert.equal(error.code, 'BUILD_STAGING_FAILED');
    assert.equal(calls.length, 0);
    assert.notEqual(createdStaging, null);
    assert.equal(await lstatOrNull(createdStaging), null); // staging vazado apareceria aqui
    assert.deepEqual(await listing(nativeDir), ['windows.swift']);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: recusa diretório no alvo (recusa sem sobrescrita)', async () => {
  const {base, root, nativeDir} = await makePluginRoot();
  try {
    await fs.mkdir(path.join(nativeDir, 'windows'));
    const calls = [];
    const error = await buildHelper({root, run: makeRunner({calls})}).then(() => null, (value) => value);
    assert.equal(error.code, 'BUILD_TARGET_EXISTS');
    assert.equal(error.detail.kind, 'directory');
    assert.equal(/\brm\b/.test(error.message), false, 'sem sugestão de comando destrutivo');
    assert.match(error.message, /pasta/);
    assert.equal(calls.length, 0);
    assert.equal((await fs.lstat(path.join(nativeDir, 'windows'))).isDirectory(), true);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: falhas não deixam alvo nem staging (fail/missing/throw/no-write)', async () => {
  for (const [behavior, code] of [['fail', 'BUILD_FAILED'], ['missing', 'BUILD_TOOL_MISSING'], ['throw', 'BUILD_RUN_FAILED'], ['no-write', 'BUILD_OUTPUT_INVALID']]) {
    const {base, root, nativeDir} = await makePluginRoot();
    try {
      const calls = [];
      await expectCode(buildHelper({root, run: makeRunner({calls, behavior})}), code);
      if (behavior !== 'throw') assert.equal(calls.length, 1); // throw acontece dentro do runner
      assert.equal(await lstatOrNull(path.join(nativeDir, 'windows')), null);
      assert.deepEqual(await listing(nativeDir), ['windows.swift']); // staging limpa
    } finally {
      await fs.rm(base, {recursive: true, force: true});
    }
  }
});

test('buildHelper: falha de compilação expõe stderr limitado e timeout específico', async () => {
  const {base, root} = await makePluginRoot();
  try {
    const fail = await buildHelper({root, run: makeRunner({behavior: 'fail', stderr: 'error: cannot find type\n'})})
      .then(() => null, (error) => error);
    assert.equal(fail.code, 'BUILD_FAILED');
    assert.match(fail.message, /cannot find type/);
    assert.equal(fail.detail.stderr, 'error: cannot find type');

    const timeout = await buildHelper({root, run: makeRunner({behavior: 'timeout'})}).then(() => null, (error) => error);
    assert.equal(timeout.code, 'BUILD_TIMEOUT');
    assert.equal(timeout.detail.timeoutMs, BUILD_TIMEOUT_MS);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: corrida de publicação nunca sobrescreve alvo que apareceu', async () => {
  const {base, root, nativeDir} = await makePluginRoot();
  try {
    const calls = [];
    await expectCode(buildHelper({root, run: makeRunner({calls, behavior: 'race'})}), 'BUILD_TARGET_EXISTS');
    assert.equal(calls.length, 1);
    assert.equal(await fs.readFile(path.join(nativeDir, 'windows'), 'utf8'), 'racer');
    assert.deepEqual(await listing(nativeDir), ['windows', 'windows.swift']); // staging limpa
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: fonte ausente/diretório/symlink recusa antes de qualquer execução', async () => {
  const missing = await makePluginRoot({source: null});
  try {
    const calls = [];
    await expectCode(buildHelper({root: missing.root, run: makeRunner({calls})}), 'BUILD_SOURCE_MISSING');
    assert.equal(calls.length, 0);
  } finally {
    await fs.rm(missing.base, {recursive: true, force: true});
  }

  const asDir = await makePluginRoot({sourceKind: 'dir'});
  try {
    await expectCode(buildHelper({root: asDir.root, run: makeRunner({})}), 'BUILD_SOURCE_INVALID');
  } finally {
    await fs.rm(asDir.base, {recursive: true, force: true});
  }

  const asLink = await makePluginRoot({source: null});
  try {
    const real = path.join(asLink.base, 'real.swift');
    await fs.writeFile(real, '// fora do plugin');
    await fs.symlink(real, path.join(asLink.nativeDir, 'windows.swift'));
    await expectCode(buildHelper({root: asLink.root, run: makeRunner({})}), 'BUILD_SOURCE_SYMLINK');
  } finally {
    await fs.rm(asLink.base, {recursive: true, force: true});
  }
});

test('buildHelper: plataforma não-macOS recusa sem executar', async () => {
  const {base, root} = await makePluginRoot();
  try {
    const calls = [];
    await expectCode(buildHelper({root, run: makeRunner({calls}), platform: 'linux'}), 'BUILD_PLATFORM_UNSUPPORTED');
    assert.equal(calls.length, 0);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('buildHelper: plugin COPIADO publica dentro da cópia (nada fora)', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-build-helper-copy-'));
  const copy = path.join(base, 'mesa-study');
  try {
    const sourceHelper = path.join(PLUGIN_ROOT, 'native', 'windows');
    const helperBefore = await lstatOrNull(sourceHelper);
    await fs.cp(PLUGIN_ROOT, copy, {
      recursive: true,
      filter: (source) => source !== sourceHelper && !path.basename(source).startsWith('.build-'),
    });
    const calls = [];
    const result = await buildHelper({root: copy, run: makeRunner({calls})});
    const realCopy = await fs.realpath(copy);
    assert.equal(result.source, path.join(realCopy, 'native', 'windows.swift'));
    assert.equal(result.target, path.join(realCopy, 'native', 'windows'));
    assert.equal((await fs.lstat(result.target)).isFile(), true);
    assert.equal(result.target.startsWith(realCopy), true);
    assert.equal(calls[0].argv[2], path.join(realCopy, 'native', 'windows.swift'));
    // A árvore de origem conserva o helper, inclusive quando já foi compilado.
    const helperAfter = await lstatOrNull(sourceHelper);
    assert.equal(Boolean(helperAfter), Boolean(helperBefore));
    if (helperBefore) {
      assert.equal(helperAfter.ino, helperBefore.ino);
      assert.equal(helperAfter.size, helperBefore.size);
      assert.equal(helperAfter.mtimeMs, helperBefore.mtimeMs);
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('runBuildHelper: sucesso em JSON de uma linha; falha em JSON com código', async () => {
  const {base, root} = await makePluginRoot();
  try {
    const out = [];
    const okCode = await runBuildHelper([], {stdout: (text) => out.push(text), stderr: () => {}, deps: {root, run: makeRunner({})}});
    assert.equal(okCode, 0);
    const payload = JSON.parse(out.join('').trim());
    assert.equal(payload.ok, true);
    assert.equal(payload.kind, 'build-helper');
    assert.equal(payload.target, path.join(await fs.realpath(root), 'native', 'windows'));
    assert.match(payload.note, /link atômico/);
    assert.equal(out.join('').endsWith('\n'), true);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }

  const failRoot = await makePluginRoot({source: null});
  try {
    const out = [];
    const failCode = await runBuildHelper([], {stdout: (text) => out.push(text), stderr: () => {}, deps: {root: failRoot.root, run: makeRunner({})}});
    assert.equal(failCode, 1);
    const payload = JSON.parse(out.join('').trim());
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'BUILD_SOURCE_MISSING');
  } finally {
    await fs.rm(failRoot.base, {recursive: true, force: true});
  }
});

test('build-helper: entrada principal real só aceita --help (nunca compila no teste)', () => {
  const CLI = path.join(PLUGIN_ROOT, 'scripts', 'build-helper.mjs');
  const help = spawnSync(process.execPath, [CLI, '--help'], {encoding: 'utf8', timeout: 30000});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /\/usr\/bin\/xcrun swiftc/);
  assert.equal(help.stderr, '');

  const bad = spawnSync(process.execPath, [CLI, '--force'], {encoding: 'utf8', timeout: 30000});
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--force/);
  assert.equal(bad.stdout, '');
});

test('fontes: native/windows.swift mantém ownerPID e captura/doctor nunca compilam', async () => {
  const swift = await fs.readFile(path.join(PLUGIN_ROOT, 'native', 'windows.swift'), 'utf8');
  assert.match(swift, /kCGWindowOwnerPID/);
  assert.match(swift, /"ownerPID"/);
  assert.match(swift, /CGPreflightScreenCaptureAccess/);
  assert.match(swift, /optionOnScreenOnly/);

  for (const relative of ['host/capture.mjs', 'scripts/doctor.mjs']) {
    const text = await fs.readFile(path.join(PLUGIN_ROOT, relative), 'utf8');
    assert.equal(/xcrun/.test(text), false, `${relative} não pode citar xcrun`);
    assert.equal(/from\s+['"][^'"]*build-helper/.test(text), false, `${relative} não pode importar build-helper`);
    assert.equal(/buildHelper|runBuildHelper/.test(text), false, `${relative} não pode chamar o build do helper`);
  }
  const capture = await fs.readFile(path.join(PLUGIN_ROOT, 'host', 'capture.mjs'), 'utf8');
  assert.match(capture, /node scripts\/build-helper\.mjs/); // só a dica de recuperação
});
