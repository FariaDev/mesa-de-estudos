#!/usr/bin/env node
/* Build EXPLÍCITO do helper nativo do plugin (`native/windows`).
   - única forma de gerar o binário: captura, doctor e hooks NUNCA compilam;
   - executa só `/usr/bin/xcrun swiftc` com lista fixa de argumentos via
     execFile (host/proc.mjs), sem shell e sem caminho vindo de fora;
   - a raiz do plugin é resolvida (realpath) e `native/` precisa ser uma
     pasta REAL dentro dela: symlink em `native/` (ou realpath divergente) é
     recusado antes de ler, escrever ou executar qualquer coisa; os caminhos
     usados vêm da pasta resolvida;
   - compila numa pasta temporária dentro de native/ e publica com link que
     NUNCA sobrescreve: alvo existente (arquivo, diretório ou symlink) é
     recusado com recuperação manual, sem comandos destrutivos inventados;
   - `link` é atômico contra sobrescrever aquele alvo, mas não promete vencer
     uma corrida ativa no sistema de arquivos: a checagem imediatamente antes
     do mkdtemp e o EEXIST do link reduzem a janela, sem prova de corrida;
   - falha limpa a pasta temporária (inclusive falha de chmod do staging) e
     não deixa alvo parcial;
   - import-safe/testável: `buildHelper`/`runBuildHelper` não rodam ao importar.
   Uso: node scripts/build-helper.mjs [--help]  (nenhum outro argumento). */

import fs from 'node:fs/promises';
import path from 'node:path';
import {runProcess} from '../host/proc.mjs';
import {ScriptError, isMainEntry, pluginRootFrom, scriptErrorMessage, scriptErrorPayload, tailText} from './shared.mjs';

export const XCRUN_PATH = '/usr/bin/xcrun';
export const SOURCE_RELATIVE = Object.freeze(['native', 'windows.swift']);
export const TARGET_RELATIVE = Object.freeze(['native', 'windows']);
const NATIVE_RELATIVE = Object.freeze(['native']);
export const BUILD_TIMEOUT_MS = 120000;
export const BUILD_MAX_BUFFER = 1024 * 1024;

export function buildHelperUsage() {
  return [
    'Uso: node scripts/build-helper.mjs [--help]',
    '',
    'Compila native/windows.swift e publica o binário em native/windows (dentro do plugin).',
    'Este é o único caminho: captura, doctor e hooks nunca compilam sozinhos.',
    '',
    'Regras de segurança:',
    '  - `/usr/bin/xcrun swiftc` com argumentos fixos, sem shell;',
    '  - a raiz do plugin é resolvida (realpath) e native/ precisa ser uma pasta',
    '    real dentro dela; link simbólico em native/ é recusado;',
    '  - nunca sobrescreve alvo existente (arquivo, diretório ou symlink);',
    '  - se native/windows já existir, o build recusa e indica recuperação',
    '    manual; nada é apagado sozinho.',
  ].join('\n');
}

/* Nenhuma opção além de --help: caminhos são fixos dentro do plugin. */
export function parseBuildArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  if (args.includes('--help') || args.includes('-h')) {
    if (args.length !== 1) throw new ScriptError('USAGE', 'Use --help sozinho.');
    return {help: true};
  }
  if (args.length > 0) {
    throw new ScriptError('USAGE', `Argumento desconhecido: ${String(args[0])}. Este script não aceita opções além de --help.`);
  }
  return {help: false};
}

/* Facade de fs injetável (testes de falha de chmod/realpath); cada método cai
   no fs/promises real quando não for injetado. */
function fsMethod(fileSystem, name) {
  return fileSystem && typeof fileSystem[name] === 'function' ? fileSystem[name] : fs[name];
}

async function lstatOrNull(lstat, target) {
  try {
    return await lstat(target);
  } catch {
    return null;
  }
}

function describeExisting(stat) {
  if (stat.isSymbolicLink()) return 'symlink';
  if (stat.isDirectory()) return 'directory';
  return 'file';
}

/* Recuperação manual, sem comandos inventados: o script nunca apaga nem
   sobrescreve nada por conta própria. */
function manualRecovery(kind) {
  if (kind === 'directory') {
    return 'Nada foi sobrescrito. Confira o conteúdo dessa pasta; se ela não for intencional, remova-a manualmente e rode o build de novo.';
  }
  if (kind === 'symlink') {
    return 'O link não foi seguido. Remova o link manualmente e rode o build de novo para publicar um binário real.';
  }
  return 'Nada foi sobrescrito. Mova ou apague o arquivo existente manualmente e rode o build de novo.';
}

/* `native/` precisa ser uma pasta REAL dentro da raiz canônica do plugin.
   Symlink (ou realpath divergente) é recusado ANTES de qualquer leitura,
   escrita ou execução: senão staging e publicação iriam parar fora do
   plugin. É chamado antes de checar a fonte e de novo imediatamente antes do
   mkdtemp — a segunda chamada reduz a janela, mas não vence uma corrida. */
async function assertNativeDirSafe(canonicalRoot, nativeDir, {lstat, realpath}) {
  const nativeStat = await lstatOrNull(lstat, nativeDir);
  if (!nativeStat) return; // sem native/, a fonte ausente explica o erro
  if (nativeStat.isSymbolicLink()) {
    throw new ScriptError(
      'BUILD_NATIVE_DIR_SYMLINK',
      `A pasta native/ do plugin é um link simbólico (${nativeDir}); o build não segue esse link. Substitua-o por uma pasta real dentro do plugin e rode de novo.`,
      {nativeDir},
    );
  }
  if (!nativeStat.isDirectory()) {
    throw new ScriptError('BUILD_NATIVE_DIR_INVALID', `native/ existe mas não é uma pasta: ${nativeDir}.`, {nativeDir});
  }
  const expected = path.join(canonicalRoot, ...NATIVE_RELATIVE);
  const resolvedNative = await realpath(nativeDir).catch(() => null);
  if (resolvedNative !== expected) {
    throw new ScriptError(
      'BUILD_NATIVE_DIR_ESCAPE',
      `native/ resolve para ${resolvedNative || 'um caminho desconhecido'} em vez de ${expected}; o build não escreve fora da raiz do plugin. Substitua native/ por uma pasta real dentro do plugin.`,
      {nativeDir, resolvedNative},
    );
  }
}

/* Compila e publica. Devolve {ok, kind, source, target, bytes, mode}.
   Lança ScriptError com código estável em qualquer recusa/falha. */
export async function buildHelper({
  root = pluginRootFrom(import.meta.url),
  run = runProcess,
  platform = process.platform,
  fs: fileSystem,
} = {}) {
  if (platform !== 'darwin') {
    throw new ScriptError(
      'BUILD_PLATFORM_UNSUPPORTED',
      `O helper nativo é macOS (xcrun swiftc); plataforma atual: ${platform}.`,
      {platform},
    );
  }

  const lstat = fsMethod(fileSystem, 'lstat');
  const realpath = fsMethod(fileSystem, 'realpath');
  const mkdtemp = fsMethod(fileSystem, 'mkdtemp');
  const chmod = fsMethod(fileSystem, 'chmod');
  const link = fsMethod(fileSystem, 'link');
  const rm = fsMethod(fileSystem, 'rm');

  // Raiz canônica do plugin; os caminhos operados saem dela, nunca da forma
  // (possivelmente com symlink) como o chamador passou.
  const requestedRoot = path.resolve(root);
  let pluginRoot;
  try {
    pluginRoot = await realpath(requestedRoot);
  } catch {
    pluginRoot = requestedRoot; // raiz inexistente: a fonte ausente explica
  }
  const nativeDir = path.join(pluginRoot, ...NATIVE_RELATIVE);
  await assertNativeDirSafe(pluginRoot, nativeDir, {lstat, realpath});
  const source = path.join(pluginRoot, ...SOURCE_RELATIVE);
  const target = path.join(pluginRoot, ...TARGET_RELATIVE);

  const sourceStat = await lstatOrNull(lstat, source);
  if (!sourceStat) {
    throw new ScriptError('BUILD_SOURCE_MISSING', `Fonte Swift não encontrada: ${source}.`, {source});
  }
  if (sourceStat.isSymbolicLink()) {
    throw new ScriptError('BUILD_SOURCE_SYMLINK', `A fonte ${source} é um link simbólico; use o arquivo real do plugin.`, {source});
  }
  if (!sourceStat.isFile()) {
    throw new ScriptError('BUILD_SOURCE_INVALID', `A fonte ${source} não é um arquivo regular.`, {source});
  }

  // Recusa TUDO que já exista no alvo (inclusive symlink) antes de compilar.
  const existing = await lstatOrNull(lstat, target);
  if (existing) {
    const kind = describeExisting(existing);
    const code = kind === 'symlink' ? 'BUILD_TARGET_SYMLINK' : 'BUILD_TARGET_EXISTS';
    throw new ScriptError(code, `O alvo ${target} já existe (${kind}). ${manualRecovery(kind)}`, {target, kind});
  }

  // Revalidação imediatamente antes da primeira escrita.
  await assertNativeDirSafe(pluginRoot, nativeDir, {lstat, realpath});

  let stagingDir;
  try {
    stagingDir = await mkdtemp(path.join(nativeDir, '.build-'));
    await chmod(stagingDir, 0o700);
  } catch {
    // mkdtemp pode ter criado a pasta antes de o chmod falhar: limpa aqui,
    // antes de relançar, para não vazar staging (o finally não cobre este ponto).
    if (stagingDir) await rm(stagingDir, {recursive: true, force: true}).catch(() => {});
    throw new ScriptError('BUILD_STAGING_FAILED', `Não foi possível preparar a pasta temporária em ${nativeDir}.`, {nativeDir});
  }

  const staged = path.join(stagingDir, 'windows');
  try {
    let result;
    try {
      result = await run([XCRUN_PATH, 'swiftc', source, '-o', staged], {
        timeoutMs: BUILD_TIMEOUT_MS,
        maxBuffer: BUILD_MAX_BUFFER,
      });
    } catch (error) {
      throw new ScriptError(
        'BUILD_RUN_FAILED',
        `Não foi possível executar ${XCRUN_PATH} swiftc: ${tailText(error && error.message)}`,
        {xcrun: XCRUN_PATH},
      );
    }
    if (!result || !result.ok) {
      if (result && result.missing) {
        throw new ScriptError(
          'BUILD_TOOL_MISSING',
          `xcrun não encontrado em ${XCRUN_PATH}. Instale as Command Line Tools da Apple (xcode-select --install) e rode de novo.`,
          {xcrun: XCRUN_PATH},
        );
      }
      if (result && result.timedOut) {
        throw new ScriptError('BUILD_TIMEOUT', `A compilação excedeu ${BUILD_TIMEOUT_MS} ms.`, {timeoutMs: BUILD_TIMEOUT_MS});
      }
      throw new ScriptError(
        'BUILD_FAILED',
        `xcrun swiftc falhou (exit ${result && result.code !== undefined ? result.code : '?'}): ${tailText(result && result.stderr) || 'sem stderr'}`,
        {stderr: tailText(result && result.stderr)},
      );
    }

    const stagedStat = await lstatOrNull(lstat, staged);
    if (!stagedStat || !stagedStat.isFile() || stagedStat.isSymbolicLink()) {
      throw new ScriptError('BUILD_OUTPUT_INVALID', 'A compilação não produziu um executável regular.', {staged});
    }
    await chmod(staged, 0o755);

    // Publicação sem sobrescrita: o link falha com EEXIST se o alvo aparecer
    // durante a compilação (corrida real entre processos).
    try {
      await link(staged, target);
    } catch (error) {
      if (error && error.code === 'EEXIST') {
        throw new ScriptError(
          'BUILD_TARGET_EXISTS',
          `O alvo ${target} apareceu durante a compilação. ${manualRecovery('file')}`,
          {target, kind: 'file'},
        );
      }
      throw new ScriptError('BUILD_PUBLISH_FAILED', `Não foi possível publicar ${target}: ${tailText(error && error.code, 120)}.`, {target});
    }

    return {ok: true, kind: 'build-helper', source, target, bytes: stagedStat.size, mode: '0755'};
  } finally {
    await rm(stagingDir, {recursive: true, force: true}).catch(() => {});
  }
}

export async function runBuildHelper(argv, {
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
  deps = {},
} = {}) {
  let parsed;
  try {
    parsed = parseBuildArgs(argv);
  } catch (error) {
    stderr(`${scriptErrorMessage(error)}\n`);
    return 2;
  }
  if (parsed.help) {
    stdout(`${buildHelperUsage()}\n`);
    return 0;
  }
  try {
    const result = await buildHelper(deps);
    stdout(`${JSON.stringify({...result, note: 'Publicado com link atômico; captura/doctor nunca compilam sozinhos.'})}\n`);
    return 0;
  } catch (error) {
    stdout(`${JSON.stringify(scriptErrorPayload(error))}\n`);
    return 1;
  }
}

if (isMainEntry(process.argv[1], import.meta.url)) {
  process.exitCode = await runBuildHelper(process.argv.slice(2));
}
