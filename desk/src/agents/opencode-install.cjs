// @ts-check
'use strict';

/* Instalação do OpenCode 2.x pela própria Mesa. O binário que o tutor usa é
   o `opencode` do caminho `~/.opencode/bin`. A Mesa baixa o pacote npm fixado
   (2.2.4, o testado pelo portão), confere a integridade SRI publicada pelo
   registro e coloca o binário já verificado nesse destino, criando o atalho
   `opencode2`. Não há script remoto: o mesmo caminho vale no macOS, no Linux
   e no Windows (`%USERPROFILE%\.opencode\bin\opencode.exe`), sem depender do
   "latest" (hoje 1.x no GitHub) nem de Git Bash.

   A troca é atômica (temporário na mesma pasta + `rename`), porque um
   `opencode serve` pode estar rodando DESTE arquivo — sobrescrever por cima
   daria ETXTBSY no Linux e assinatura invalidada no macOS. Plataforma ou
   arquitetura fora da lista vira erro com instrução, nunca um botão que
   falha sem explicação. */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const {versionOf} = require('./opencode-version.cjs');
const {message} = require('../i18n.mjs');

const PINNED_VERSION = '2.2.4';
const REGISTRY_URL = 'https://registry.npmjs.org';
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
const VERSION_TIMEOUT_MS = 15000;

class OpenCodeInstallError extends Error {
  /** @param {string} code @param {string} key @param {Record<string, string|number>} [args] @param {unknown} [cause] */
  constructor(code, key, args = {}, cause = null) {
    super(message(key, args));
    this.name = 'OpenCodeInstallError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Alvo do pacote npm no mesmo formato do instalador v2 (`linux-x64`,
 * `darwin-arm64`, `windows-x64`), com baseline e musl quando o hardware pede.
 * @param {{platform?: NodeJS.Platform, arch?: string, readFile?: typeof fs.readFileSync, runSync?: typeof spawnSync}} [options]
 * @returns {string} vazio quando a combinação não é suportada
 * @example openCodeTarget({platform: 'linux', arch: 'x64', readFile: () => 'avx2'}) // 'linux-x64'
 */
function openCodeTarget({platform = process.platform, arch = process.arch, readFile = fs.readFileSync, runSync = spawnSync} = {}) {
  const osName = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'darwin' : platform === 'linux' ? 'linux' : '';
  if (!osName) return '';
  const cpu = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : '';
  if (!cpu) return '';
  let target = `${osName}-${cpu}`;
  if (cpu === 'x64' && !hasAvx2({osName, readFile, runSync})) target += '-baseline';
  if (osName === 'linux' && isMusl({readFile, runSync})) target += '-musl';
  return target;
}

/** @param {{osName: string, readFile: typeof fs.readFileSync, runSync: typeof spawnSync}} input */
function hasAvx2({osName, readFile, runSync}) {
  if (osName === 'linux') {
    try { return /\bavx2\b/i.test(String(readFile('/proc/cpuinfo', 'utf8'))); } catch { return false; }
  }
  if (osName === 'darwin') {
    try { return String(runSync('sysctl', ['-n', 'hw.optional.avx2_0'], {encoding: 'utf8', timeout: 5000}).stdout || '').trim() === '1'; } catch { return false; }
  }
  if (osName === 'windows') {
    const command = '(Add-Type -MemberDefinition "[DllImport(\\"kernel32.dll\\")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);" -Name Kernel32 -Namespace Win32 -PassThru)::IsProcessorFeaturePresent(40)';
    try {
      const result = runSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {encoding: 'utf8', timeout: 10000});
      return /^(true|1)$/i.test(String(result.stdout || '').trim());
    } catch { return false; }
  }
  return true;
}

/** @param {{readFile: typeof fs.readFileSync, runSync: typeof spawnSync}} input */
function isMusl({readFile, runSync}) {
  try { if (readFile('/etc/alpine-release', 'utf8')) return true; } catch { /* não é Alpine */ }
  try { return /musl/i.test(String(runSync('ldd', ['--version'], {encoding: 'utf8', timeout: 5000}).stdout || '')); } catch { return false; }
}

/**
 * O instalador automático tem caminho confiável nesta plataforma?
 * @param {{platform?: NodeJS.Platform, arch?: string, readFile?: typeof fs.readFileSync, runSync?: typeof spawnSync}} [options]
 * @returns {boolean}
 * @example openCodeInstallSupported({platform: 'linux', arch: 'x64'}) // true
 */
function openCodeInstallSupported(options = {}) {
  return !!openCodeTarget(options);
}

/** @param {string} target */
function packageNames(target) {
  return [`@opencode/cli-${target}`, `@opencode-ai/cli-${target}`];
}

/** @param {string} name @param {string} version */
function registryUrl(name, version) {
  return `${REGISTRY_URL}/${name.replace('/', '%2f')}/${version}`;
}

/**
 * Acha o pacote fixado e a integridade SRI publicada; o pacote novo e o legado
 * são tentados na mesma ordem do instalador v2.
 * @param {{target: string, version: string, fetchImpl: typeof globalThis.fetch, timeoutMs: number}} input
 * @returns {Promise<{name: string, tarball: string, integrity: string}>}
 */
async function resolvePackage({target, version, fetchImpl, timeoutMs}) {
  let lastStatus = 0;
  for (const name of packageNames(target)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(registryUrl(name, version), {headers: {accept: 'application/json'}, signal: controller.signal, redirect: 'follow'});
    } catch (error) {
      throw new OpenCodeInstallError('network', 'err.opencode.install.network', {cause: String(error?.message || error)}, error);
    } finally { clearTimeout(timer); }
    lastStatus = response.status;
    if (response.status === 404) continue;
    if (!response.ok) throw new OpenCodeInstallError('network', 'err.opencode.install.network', {cause: `HTTP ${response.status}`});
    let metadata;
    try { metadata = await response.json(); } catch { throw new OpenCodeInstallError('integrity', 'err.opencode.install.noIntegrity', {package: name}); }
    const integrity = String(metadata?.dist?.integrity || '');
    const tarball = String(metadata?.dist?.tarball || '');
    if (!/^sha(256|384|512)-[A-Za-z0-9+/=]+$/.test(integrity) || !tarball) {
      throw new OpenCodeInstallError('integrity', 'err.opencode.install.noIntegrity', {package: name});
    }
    return {name, tarball, integrity};
  }
  throw new OpenCodeInstallError('version', 'err.opencode.install.versionMissing', {version, target, status: lastStatus});
}

/**
 * Baixa o tarball, calcula o hash enquanto grava e recusa se o SRI não bater.
 * @param {{url: string, integrity: string, file: string, fetchImpl: typeof globalThis.fetch,
 *   onProgress: (progress: {phase: string, percent: number}) => void, timeoutMs: number}} input
 * @returns {Promise<void>}
 */
async function downloadVerified({url, integrity, file, fetchImpl, onProgress, timeoutMs}) {
  const [algorithm, expected] = integrity.split('-', 2);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let stream = null;
  try {
    let response;
    try {
      response = await fetchImpl(url, {signal: controller.signal, redirect: 'follow'});
    } catch (error) {
      throw new OpenCodeInstallError('network', 'err.opencode.install.download', {cause: String(error?.message || error)}, error);
    }
    if (!response.ok) throw new OpenCodeInstallError('network', 'err.opencode.install.download', {cause: `HTTP ${response.status}`});
    const total = Number(response.headers?.get?.('content-length')) || 0;
    const hash = crypto.createHash(algorithm);
    stream = fs.createWriteStream(file);
    let received = 0;
    let lastPercent = -1;
    for await (const chunk of response.body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buffer);
      received += buffer.length;
      if (!stream.write(buffer)) await new Promise((resolve, reject) => {
        const cleanup = () => { stream.off('drain', onDrain); stream.off('error', onError); };
        const onDrain = () => { cleanup(); resolve(undefined); };
        const onError = (error) => { cleanup(); reject(error); };
        stream.once('drain', onDrain); stream.once('error', onError);
      });
      const percent = total ? Math.min(99, Math.floor((received * 100) / total)) : -1;
      if (percent !== lastPercent) { lastPercent = percent; onProgress({phase: 'download', percent}); }
    }
    await new Promise((resolve, reject) => { stream.end(resolve); stream.once('error', reject); });
    stream = null;
    const actual = `${algorithm}-${hash.digest('base64')}`;
    if (actual !== integrity) throw new OpenCodeInstallError('integrity', 'err.opencode.install.integrity', {expected, received: actual});
  } finally {
    clearTimeout(timer);
    if (stream) { try { stream.destroy(); } catch { /* já fechou */ } }
  }
}

/**
 * O `tar` do sistema (o instalador v2 também exige `tar`); o mesmo pacote do
 * OpenCode já vem nesse formato.
 * @param {{archive: string, directory: string, runCommand: (file: string, args: string[]) => Promise<unknown>}} input
 * @returns {Promise<void>}
 */
async function extractPackage({archive, directory, runCommand}) {
  try {
    await runCommand('tar', ['-xzf', archive, '-C', directory]);
  } catch (error) {
    throw new OpenCodeInstallError('extract', 'err.opencode.install.extract', {cause: String(error?.message || error)}, error);
  }
}

/** @param {string} directory @param {NodeJS.Platform} platform */
function extractedBinary(directory, platform) {
  const candidates = [
    path.join(directory, 'package', 'bin', platform === 'win32' ? 'opencode.exe' : 'opencode'),
    path.join(directory, 'package', 'bin', 'opencode'),
  ];
  return candidates.find((file) => { try { return fs.statSync(file).isFile(); } catch { return false; } }) || '';
}

/**
 * O destino fixo do OpenCode: `~/.opencode/bin/opencode` e o atalho
 * `opencode2` (no Windows, `.exe` e `opencode2.cmd`). O binário novo é copiado
 * para um temporário na MESMA pasta e só então renomeado sobre o destino: um
 * processo que está rodando o `opencode` continua lendo o arquivo antigo. Um
 * symlink de destino é preservado quando aponta para dentro da própria pasta;
 * link para fora vira erro explícito, sem escrever através dele. No Windows,
 * arquivo em uso não aceita sobrescrita: o antigo é renomeado para
 * `opencode.exe.old-<timestamp>` e, se ainda falhar, a instalação devolve o
 * antigo ao lugar e pede para fechar os programas que usam o OpenCode. Falha
 * no meio deixa o destino anterior intacto e não sobra temporário.
 * @param {{binary: string, home: string, platform: NodeJS.Platform,
 *   mkdir?: typeof fsp.mkdir, copyFile?: typeof fsp.copyFile, chmod?: typeof fsp.chmod,
 *   writeFile?: typeof fsp.writeFile, rename?: typeof fsp.rename, lstat?: typeof fsp.lstat,
 *   realpath?: typeof fsp.realpath, unlink?: typeof fsp.unlink,
 *   timestamp?: () => number}} input
 * @returns {Promise<string>} caminho instalado (o symlink, quando houver)
 */
async function placeBinary({binary, home, platform, mkdir = fsp.mkdir, copyFile = fsp.copyFile,
  chmod = fsp.chmod, writeFile = fsp.writeFile, rename = fsp.rename, lstat = fsp.lstat,
  realpath = fsp.realpath, unlink = fsp.unlink, timestamp = Date.now}) {
  const directory = path.join(home, '.opencode', 'bin');
  await mkdir(directory, {recursive: true});
  const installed = path.join(directory, platform === 'win32' ? 'opencode.exe' : 'opencode');
  let destination = installed;
  try {
    const info = await lstat(installed);
    if (info.isSymbolicLink()) {
      const target = await realpath(installed);
      const root = await realpath(directory);
      if (path.dirname(target) !== root) throw new OpenCodeInstallError('symlink', 'err.opencode.install.symlink');
      destination = target;
    }
  } catch (error) {
    if (error instanceof OpenCodeInstallError) throw error;
    if (error?.code !== 'ENOENT') throw placeError(error);
  }
  const stamp = `${process.pid}-${timestamp()}`;
  const temp = path.join(path.dirname(destination), `.opencode-new-${stamp}`);
  try {
    await copyFile(binary, temp);
    if (platform !== 'win32') await chmod(temp, 0o755);
    if (platform === 'win32') await replaceWindows({destination, temp, rename, unlink, timestamp});
    else await rename(temp, destination);
    const shim = path.join(directory, platform === 'win32' ? 'opencode2.cmd' : 'opencode2');
    const shimText = platform === 'win32'
      ? '@echo off\r\n"%~dp0opencode.exe" %*\r\nexit /b %errorlevel%\r\n'
      : '#!/bin/sh\nexec "$(dirname "$0")/opencode" "$@"\n';
    const shimTemp = path.join(directory, `.opencode-shim-${stamp}`);
    try {
      await writeFile(shimTemp, shimText, {mode: 0o755});
      if (platform !== 'win32') await chmod(shimTemp, 0o755);
      if (platform === 'win32') await replaceWindows({destination: shim, temp: shimTemp, rename, unlink, timestamp});
      else await rename(shimTemp, shim);
    } finally {
      try { await unlink(shimTemp); } catch { /* já renomeado */ }
    }
  } catch (error) {
    if (error instanceof OpenCodeInstallError) throw error;
    throw placeError(error);
  } finally {
    try { await unlink(temp); } catch { /* já renomeado ou nunca criado */ }
  }
  return installed;
}

/** @param {unknown} error */
function placeError(error) {
  const cause = String(/** @type {NodeJS.ErrnoException} */ (error)?.code || 'erro');
  const code = cause === 'ENOSPC' ? 'space' : cause === 'EACCES' || cause === 'EPERM' ? 'permission' : 'place';
  return new OpenCodeInstallError(code, 'err.opencode.install.place', {cause});
}

/**
 * Windows: `rename` sobre arquivo em uso falha. O antigo vira `.old-<timestamp>`
 * e o novo entra no lugar; se o novo não puder entrar, o antigo volta. O
 * `.old` que um processo ainda usa fica no disco e não impede a instalação.
 * @param {{destination: string, temp: string, rename: typeof fsp.rename,
 *   unlink: typeof fsp.unlink, timestamp: () => number}} input
 * @returns {Promise<void>}
 */
async function replaceWindows({destination, temp, rename, unlink, timestamp}) {
  const old = `${destination}.old-${timestamp()}`;
  let moved = false;
  try {
    await rename(destination, old);
    moved = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new OpenCodeInstallError('busy', 'err.opencode.install.busy');
  }
  try {
    await rename(temp, destination);
  } catch {
    if (moved) { try { await rename(old, destination); } catch { /* preserva o .old */ } }
    throw new OpenCodeInstallError('busy', 'err.opencode.install.busy');
  }
  if (moved) { try { await unlink(old); } catch { /* em uso: fica como .old */ } }
}

/**
 * Roda um comando e devolve stdout/stderr; erro inclui o código e a última
 * linha útil, sem caminho pessoal nem segredo.
 * @param {string} file @param {string[]} args
 * @param {{timeoutMs?: number, spawnProcess?: typeof spawn}} [options]
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCommand(file, args, {timeoutMs = INSTALL_TIMEOUT_MS, spawnProcess = spawn} = {}) {
  return runScript({file, args, input: '', timeoutMs, spawnProcess});
}

/**
 * @param {{file: string, args: string[], input: string, env?: NodeJS.ProcessEnv, timeoutMs: number,
 *   spawnProcess?: typeof spawn}} input
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runScript({file, args, input, env = process.env, timeoutMs, spawnProcess = spawn}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const child = spawnProcess(file, args, {env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* já saiu */ }
      finish(new OpenCodeInstallError('timeout', 'err.opencode.install.timeout', {seconds: Math.round(timeoutMs / 1000)}));
    }, timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { stdout = (stdout + chunk).slice(-8000); });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => { stderr = (stderr + chunk).slice(-8000); });
    child.on('error', (error) => { const cause = /** @type {NodeJS.ErrnoException} */ (error); finish(new OpenCodeInstallError('command', 'err.opencode.install.start', {cause: cause.code || cause.message}, error)); });
    child.on('close', (code) => {
      if (code === 0) return finish(null, {stdout, stderr});
      const detail = String(stderr || stdout || '').trim().split('\n').filter(Boolean).at(-1) || `código ${code}`;
      finish(new OpenCodeInstallError('command', 'err.opencode.install.command', {code: String(code), detail: detail.slice(0, 300)}));
    });
    /* O comando pode sair sem ler stdin: o EPIPE chega como evento e, sem ouvinte,
       viraria exceção não tratada no processo principal. */
    child.stdin?.on('error', () => {});
    try { child.stdin?.end(input); } catch { /* o comando pode não ler stdin */ }
  });
}

/**
 * A versão do binário instalado; '' quando ele não responde.
 * @param {string} binary @param {{timeoutMs?: number, spawnProcess?: typeof spawn}} [options]
 * @returns {Promise<string>}
 */
function installedVersion(binary, {timeoutMs = VERSION_TIMEOUT_MS, spawnProcess = spawn} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    let output = '';
    let child;
    try { child = spawnProcess(binary, ['--version'], {stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true}); } catch { finish(''); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* já saiu */ } finish(''); }, timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { output = (output + chunk).slice(0, 4096); });
    child.on('error', () => finish(''));
    child.on('close', () => finish(output.trim()));
  });
}

/**
 * Instala o OpenCode fixado e devolve o caminho e a versão conferida.
 * Dependências entram por parâmetro para o teste não tocar na rede, no disco
 * real nem no HOME da pessoa.
 * @param {{home?: string, platform?: NodeJS.Platform, arch?: string,
 *   version?: string, onProgress?: (progress: {phase: string, percent?: number}) => void,
 *   fetchImpl?: typeof globalThis.fetch, readFile?: typeof fs.readFileSync, runSync?: typeof spawnSync,
 *   existsSync?: typeof fs.existsSync, mkdtemp?: typeof fsp.mkdtemp, rm?: typeof fsp.rm,
 *   mkdir?: typeof fsp.mkdir, copyFile?: typeof fsp.copyFile, chmod?: typeof fsp.chmod,
 *   writeFile?: typeof fsp.writeFile, rename?: typeof fsp.rename, lstat?: typeof fsp.lstat,
 *   realpath?: typeof fsp.realpath, unlink?: typeof fsp.unlink, spawnProcess?: typeof spawn,
 *   downloadTimeoutMs?: number, installTimeoutMs?: number}} [options]
 * @returns {Promise<{ok: true, binary: string, version: string}>}
 * @example await installOpenCode({home: '/tmp/home', fetchImpl: fakeFetch})
 */
async function installOpenCode({
  home = os.homedir(), platform = process.platform, arch = process.arch,
  version = PINNED_VERSION, onProgress = () => {}, fetchImpl = globalThis.fetch,
  readFile = fs.readFileSync, runSync = spawnSync, existsSync = fs.existsSync,
  mkdtemp = fsp.mkdtemp, rm = fsp.rm, mkdir = fsp.mkdir, copyFile = fsp.copyFile,
  chmod = fsp.chmod, writeFile = fsp.writeFile, rename = fsp.rename, lstat = fsp.lstat,
  realpath = fsp.realpath, unlink = fsp.unlink, spawnProcess = spawn,
  downloadTimeoutMs = DOWNLOAD_TIMEOUT_MS, installTimeoutMs = INSTALL_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new OpenCodeInstallError('network', 'err.opencode.install.network', {cause: 'fetch indisponível'});
  const target = openCodeTarget({platform, arch, readFile, runSync});
  if (!target) throw new OpenCodeInstallError('unsupported', 'err.opencode.install.unsupported', {platform, arch});
  onProgress({phase: 'prepare'});
  const packageInfo = await resolvePackage({target, version, fetchImpl, timeoutMs: 30000});
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mesa-opencode-install-'));
  try {
    const archive = path.join(directory, 'opencode.tgz');
    onProgress({phase: 'download', percent: 0});
    await downloadVerified({url: packageInfo.tarball, integrity: packageInfo.integrity, file: archive, fetchImpl, onProgress, timeoutMs: downloadTimeoutMs});
    onProgress({phase: 'extract'});
    await extractPackage({archive, directory, runCommand: (file, args) => runCommand(file, args, {timeoutMs: installTimeoutMs, spawnProcess})});
    const binary = extractedBinary(directory, platform);
    if (!binary) throw new OpenCodeInstallError('binary', 'err.opencode.install.binary');
    onProgress({phase: 'install'});
    await placeBinary({binary, home, platform, mkdir, copyFile, chmod, writeFile, rename, lstat, realpath, unlink});
    onProgress({phase: 'verify'});
    const installed = path.join(home, '.opencode', 'bin', platform === 'win32' ? 'opencode.exe' : 'opencode');
    if (!existsSync(installed)) throw new OpenCodeInstallError('verify', 'err.opencode.install.verify');
    const reported = await installedVersion(installed, {spawnProcess});
    const parsed = versionOf(reported);
    if (!parsed || parsed.text !== version) {
      throw new OpenCodeInstallError('version', 'err.opencode.install.version', {received: reported || 'sem resposta', expected: version});
    }
    onProgress({phase: 'done', percent: 100});
    return {ok: true, binary: installed, version: parsed.text};
  } finally {
    try { await rm(directory, {recursive: true, force: true}); } catch { /* temporário do sistema */ }
  }
}

module.exports = {
  runCommand,
  PINNED_VERSION,
  OpenCodeInstallError,
  openCodeTarget,
  openCodeInstallSupported,
  installOpenCode,
  placeBinary,
};
