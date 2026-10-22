/* Testes do doctor refatorado com executor FALSO (nenhum claude/pdfinfo real,
   nenhum helper executado, nenhum ajuste global lido). Cobrem alvos
   desktop/cli, limites de versão, resolvedor Poppler fixo, helper presente/
   ausente/symlink e caminhos do plugin copiado. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  TARGETS,
  MINIMUMS,
  doctorUsage,
  parseDoctorArgs,
  collectDoctorReport,
  runDoctor,
} from '../scripts/doctor.mjs';
import {ScriptError, atLeastVersion, parseSemverTuple, pluginRootFrom} from '../scripts/shared.mjs';
import {resolvePopplerTools, isExecutableFile} from '../host/tools.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = {pdfinfo: '/opt/homebrew/bin/pdfinfo', pdftocairo: '/opt/homebrew/bin/pdftocairo'};
const ABSENT_HELPER = path.join(os.tmpdir(), 'mesa-doctor-definitely-absent', 'native', 'windows');

const VERSIONS = {
  claude: '2.1.287 (Claude Code)',
  pdfinfo: 'pdfinfo version 26.10.0\nCopyright 2005-2026 The Poppler Developers',
  pdftocairo: 'pdftocairo version 26.10.0\nCopyright 2005-2026 The Poppler Developers',
};

/* Runner falso: registra chamadas e devolve versões sintéticas por binário. */
function makeRun({text = VERSIONS, calls = [], missing = []} = {}) {
  return async (argv, options) => {
    calls.push({argv, options});
    const name = path.basename(argv[0]);
    const key = name === 'claude' || name === 'pdfinfo' || name === 'pdftocairo' ? name : argv[0];
    if (missing.includes(key)) return {ok: false, code: 'ENOENT', missing: true, timedOut: false, stdout: '', stderr: ''};
    const value = text[key];
    if (value === undefined) return {ok: false, code: 1, missing: false, timedOut: false, stdout: '', stderr: 'sem saída'};
    return {ok: true, code: 0, missing: false, timedOut: false, stdout: value, stderr: ''};
  };
}

function baseDeps(overrides = {}) {
  return {
    run: makeRun(),
    tools: TOOLS,
    isExecutable: () => true,
    stat: async () => ({isFile: () => true}),
    platform: 'darwin',
    nodeVersion: '22.19.0',
    helperPath: ABSENT_HELPER,
    now: () => new Date('2026-10-07T12:00:00.000Z'),
    ...overrides,
  };
}

test('parseDoctorArgs: default desktop, --target desktop|cli e --help', () => {
  assert.deepEqual(parseDoctorArgs([]), {help: false, target: 'desktop'});
  assert.deepEqual(parseDoctorArgs(['--target', 'desktop']), {help: false, target: 'desktop'});
  assert.deepEqual(parseDoctorArgs(['--target', 'cli']), {help: false, target: 'cli'});
  assert.deepEqual(parseDoctorArgs(['--target=cli']), {help: false, target: 'cli'});
  assert.deepEqual(parseDoctorArgs(['--help']), {help: true, target: 'desktop'});
  assert.deepEqual(parseDoctorArgs(['-h']), {help: true, target: 'desktop'});

  for (const bad of [['--target'], ['--target', 'x'], ['--target='], ['--target', 'cli', '--target', 'desktop'], ['--nope'], ['-t', 'cli'], ['--help', '--target', 'cli']]) {
    assert.throws(() => parseDoctorArgs(bad), (error) => error instanceof ScriptError && error.code === 'USAGE', `args ${JSON.stringify(bad)}`);
  }
  assert.deepEqual([...TARGETS], ['desktop', 'cli']);
});

test('versionamento: tuple e limites dos mínimos oficiais', () => {
  assert.deepEqual(parseSemverTuple('2.1.287 (Claude Code)'), [2, 1, 287]);
  assert.deepEqual(parseSemverTuple('sem versão'), null);
  assert.equal(atLeastVersion([2, 1, 286], [2, 1, 287]), false);
  assert.equal(atLeastVersion([2, 1, 287], [2, 1, 287]), true);
  assert.equal(atLeastVersion([2, 2, 0], [2, 1, 287]), true);
  assert.equal(atLeastVersion([3, 0, 0], [2, 1, 287]), true);
  assert.equal(atLeastVersion([2, 0, 300], [2, 1, 287]), false);
  assert.equal(atLeastVersion(null, [2, 1, 287]), false);

  assert.equal(MINIMUMS.claudeDesktop, '2.1.286');
  assert.equal(MINIMUMS.claudeCli, '2.1.287');
  assert.equal(MINIMUMS.node, '22.19.0');
});

test('desktop: CLI antigo ou ausente NÃO bloqueia pré-requisitos de PDF', async () => {
  const calls = [];
  const old = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({run: makeRun({text: {...VERSIONS, claude: '2.1.246 (Claude Code)'}, calls})})});
  assert.equal(old.ok, true);
  assert.deepEqual(old.blockers, []);
  assert.equal(old.checks.claudeCli.role, 'informational');
  assert.equal(old.checks.claudeCli.minimum, '2.1.287');
  assert.equal(old.checks.claudeCli.supported, false);
  assert.equal(old.checks.claudeCli.version, '2.1.246');
  assert.ok(old.warnings.some((warning) => warning.code === 'CLI_OLD' && /2\.1\.246/.test(warning.message)));
  assert.equal(old.checks.desktopCode.minimumMods, '2.1.286');
  assert.equal(old.checks.desktopCode.versionKnown, false);
  assert.equal(old.unknowns.desktopCodeVersion.length > 0, true);
  assert.match(old.note, /não significa pronto para uso/);

  const missing = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({run: makeRun({missing: ['claude']})})});
  assert.equal(missing.ok, true);
  assert.equal(missing.checks.claudeCli.available, false);
  assert.equal(missing.checks.claudeCli.ran, false);
  assert.equal(missing.checks.claudeCli.reason, 'NOT_FOUND');
  assert.ok(missing.warnings.some((warning) => warning.code === 'CLI_MISSING'));

  // Timeout com texto de versão no stdout: NÃO vira disponível nem "não encontrado".
  const timedOut = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({
    run: async (argv, options) => (path.basename(argv[0]) === 'claude'
      ? {ok: false, code: null, missing: false, timedOut: true, stdout: VERSIONS.claude, stderr: ''}
      : makeRun()(argv, options)),
  })});
  assert.equal(timedOut.ok, true);
  assert.equal(timedOut.checks.claudeCli.available, false);
  assert.equal(timedOut.checks.claudeCli.ran, true);
  assert.equal(timedOut.checks.claudeCli.reason, 'TIMEOUT');
  const timeoutWarning = timedOut.warnings.find((warning) => warning.code === 'CLI_UNUSABLE');
  assert.ok(timeoutWarning);
  assert.equal(/não encontrado/.test(timeoutWarning.message), false);
  assert.match(timeoutWarning.message, /timeout/);

  // Falha do runner (sem ENOENT) também é "não confirmado", não "não encontrado".
  const failed = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({run: makeRun({text: {...VERSIONS, claude: undefined}})})});
  assert.equal(failed.checks.claudeCli.reason, 'FAILED');
  assert.ok(failed.warnings.some((warning) => warning.code === 'CLI_UNUSABLE' && /falhou/.test(warning.message)));

  // Só binários conhecidos: nada de defaults/security/helper/ajustes globais.
  const allowed = new Set([TOOLS.pdfinfo, TOOLS.pdftocairo, 'claude']);
  for (const call of calls) assert.ok(allowed.has(call.argv[0]), `chamada inesperada: ${call.argv[0]}`);
});

test('cli: limite exato 2.1.287, antigo bloqueia e novo passa', async () => {
  for (const [version, expected] of [['2.1.287 (Claude Code)', true], ['2.1.288', true], ['2.2.0', true], ['2.1.286', false], ['2.0.999', false]]) {
    const report = await collectDoctorReport({target: 'cli', root: PLUGIN_ROOT, deps: baseDeps({run: makeRun({text: {...VERSIONS, claude: version}})})});
    assert.equal(report.ok, expected, `CLI ${version}`);
    assert.equal(report.checks.claudeCli.supported, expected);
    assert.equal(report.checks.claudeCli.role, 'required');
    if (!expected) assert.ok(report.blockers.some((blocker) => /Claude Code CLI/.test(blocker)));
  }

  const missing = await collectDoctorReport({target: 'cli', root: PLUGIN_ROOT, deps: baseDeps({run: makeRun({missing: ['claude']})})});
  assert.equal(missing.ok, false);
  assert.equal(missing.checks.claudeCli.reason, 'NOT_FOUND');
  assert.ok(missing.blockers.some((blocker) => /não encontrado/.test(blocker)));

  // TIMEOUT não pode ser contado como "não encontrado".
  const timedOut = await collectDoctorReport({target: 'cli', root: PLUGIN_ROOT, deps: baseDeps({
    run: async (argv, options) => (path.basename(argv[0]) === 'claude'
      ? {ok: false, code: null, missing: false, timedOut: true, stdout: VERSIONS.claude, stderr: ''}
      : makeRun()(argv, options)),
  })});
  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.checks.claudeCli.available, false);
  assert.equal(timedOut.checks.claudeCli.ran, true);
  const timeoutBlocker = timedOut.blockers.find((blocker) => /Claude Code CLI/.test(blocker));
  assert.equal(/não encontrado/.test(timeoutBlocker), false);
  assert.match(timeoutBlocker, /timeout/);
});

test('poppler: resolvedor fixo + X_OK antes de executar; sem PATH', async () => {
  const calls = [];
  const report = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({
    run: makeRun({calls}),
    isExecutable: (candidate) => candidate === TOOLS.pdfinfo, // pdftocairo não executável
  })});
  assert.equal(report.ok, false);
  assert.equal(report.checks.pdfinfo.available, true);
  assert.equal(report.checks.pdfinfo.ran, true);
  assert.equal(report.checks.pdfinfo.path, TOOLS.pdfinfo);
  assert.equal(report.checks.pdftocairo.available, false);
  assert.equal(report.checks.pdftocairo.ran, false);
  assert.equal(report.checks.pdftocairo.reason, 'NOT_EXECUTABLE');
  assert.deepEqual(report.checks.pdfinfo.searchedDirs, ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']);
  assert.equal(calls.some((call) => call.argv[0] === TOOLS.pdftocairo), false);
  assert.ok(report.blockers.some((blocker) => /pdftocairo/.test(blocker)));

  // Resolvedor real do host: primeiro diretório conhecido com X_OK vence.
  const onlyLocal = (candidate) => candidate === '/usr/local/bin/pdfinfo';
  const tools = resolvePopplerTools({isExecutable: onlyLocal});
  assert.equal(tools.pdfinfo, '/usr/local/bin/pdfinfo');
  assert.equal(tools.pdftocairo, '/opt/homebrew/bin/pdftocairo'); // fallback do 1º diretório
  assert.equal(Object.values(tools).some((toolPath) => !toolPath.startsWith('/')), false); // nunca PATH nu
});

test('poppler: -v que sai != 0 mas imprime versão continua aceito', async () => {
  // Algumas builds de Poppler imprimem -v e saem 99; a versão no texto é a prova.
  const run = async (argv) => {
    const name = path.basename(argv[0]);
    if (name === 'claude') return {ok: true, code: 0, missing: false, timedOut: false, stdout: VERSIONS.claude, stderr: ''};
    return {ok: false, code: 99, missing: false, timedOut: false, stdout: '', stderr: `${name} version 26.10.0\nCopyright`};
  };
  const report = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({run, helperPath: ABSENT_HELPER})});
  assert.equal(report.checks.pdfinfo.available, true);
  assert.equal(report.checks.pdfinfo.ran, true);
  assert.equal(report.checks.pdfinfo.version, '26.10.0');
  assert.equal(report.ok, true);
});

test('poppler: NOT_FOUND (ausente) difere de NOT_EXECUTABLE (presente sem X_OK), sem PATH', async () => {
  const missing = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({
    stat: async () => { throw Object.assign(new Error('ENOENT'), {code: 'ENOENT'}); },
  })});
  assert.equal(missing.checks.pdfinfo.available, false);
  assert.equal(missing.checks.pdfinfo.reason, 'NOT_FOUND');
  assert.equal(missing.checks.pdfinfo.ran, false);
  assert.equal(missing.checks.pdfinfo.path, TOOLS.pdfinfo); // fallback do 1º diretório, nunca PATH nu
  assert.match(missing.checks.pdfinfo.hint, /Poppler/);
  assert.ok(missing.blockers.some((blocker) => /pdfinfo: não encontrado nos diretórios conhecidos/.test(blocker)));

  const notExec = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({isExecutable: () => false})});
  assert.equal(notExec.checks.pdfinfo.available, false);
  assert.equal(notExec.checks.pdfinfo.reason, 'NOT_EXECUTABLE');
  assert.equal(notExec.checks.pdfinfo.ran, false);
  assert.match(notExec.checks.pdfinfo.hint, /existe/);
  assert.ok(notExec.blockers.some((blocker) => /pdfinfo: existe em .* mas não é executável/.test(blocker)));

  const unresolved = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({tools: {pdfinfo: null, pdftocairo: null}})});
  assert.equal(unresolved.checks.pdfinfo.reason, 'UNRESOLVED');
  assert.equal(unresolved.checks.pdfinfo.path, null);

  for (const check of [missing.checks.pdfinfo, notExec.checks.pdfinfo, unresolved.checks.pdfinfo]) {
    if (check.path) assert.equal(check.path.startsWith('/'), true);
    assert.equal(check.ran, false);
  }
});

test('poppler: sonda executada sem versão/estourada/ausente nunca vira disponível', async () => {
  const popplerOutcome = (make) => async (argv, options) => (path.basename(argv[0]) === 'claude'
    ? makeRun()(argv, options)
    : make(path.basename(argv[0])));

  const noVersion = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({
    run: makeRun({text: {...VERSIONS, pdfinfo: 'saída sem número', pdftocairo: 'saída sem número'}}),
  })});
  assert.equal(noVersion.checks.pdfinfo.available, false);
  assert.equal(noVersion.checks.pdfinfo.reason, 'VERSION_UNPARSED');
  assert.equal(noVersion.checks.pdfinfo.ran, true); // executou, só não deu versão
  assert.equal(noVersion.checks.pdftocairo.ran, true);

  const timedOut = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({
    run: popplerOutcome((name) => ({ok: false, code: null, missing: false, timedOut: true, stdout: `${name} version 26.10.0`, stderr: ''})),
  })});
  assert.equal(timedOut.checks.pdfinfo.available, false); // processo morto não vale por texto
  assert.equal(timedOut.checks.pdfinfo.reason, 'TIMEOUT');
  assert.equal(timedOut.checks.pdfinfo.ran, true);
  assert.ok(timedOut.blockers.some((blocker) => /pdfinfo: não respondeu em tempo/.test(blocker)));

  const absent = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({
    run: popplerOutcome((name) => ({ok: false, code: 'ENOENT', missing: true, timedOut: false, stdout: `${name} version 26.10.0`, stderr: ''})),
  })});
  assert.equal(absent.checks.pdfinfo.available, false); // ausente não vale por texto
  assert.equal(absent.checks.pdfinfo.reason, 'NOT_FOUND');
  assert.equal(absent.checks.pdfinfo.ran, false);
});

test('node: mínimo 22.19.0 pelo engines', async () => {
  for (const [version, expected] of [['22.19.0', true], ['22.20.1', true], ['23.0.0', true], ['22.18.9', false], ['20.11.0', false]]) {
    const report = await collectDoctorReport({target: 'desktop', root: PLUGIN_ROOT, deps: baseDeps({nodeVersion: version})});
    assert.equal(report.checks.node.supported, expected, `Node ${version}`);
    assert.equal(report.ok, expected, `Node ${version}`);
    if (!expected) assert.ok(report.blockers.some((blocker) => /Node/.test(blocker)));
  }
});

test('helper: ausente, regular, symlink e diretório — doctor nunca executa', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-doctor-helper-'));
  try {
    const nativeDir = path.join(base, 'native');
    await fs.mkdir(nativeDir);
    const helper = path.join(nativeDir, 'windows');
    const calls = [];

    const absent = await collectDoctorReport({target: 'desktop', root: base, deps: baseDeps({run: makeRun({calls}), isExecutable: isExecutableFile, helperPath: undefined})});
    assert.equal(absent.checks.helper.present, false);
    assert.equal(absent.checks.helper.reason, 'MISSING');
    assert.equal(absent.checks.helper.ran, false);
    assert.equal(absent.checks.helper.buildHint, 'node scripts/build-helper.mjs');
    assert.ok(absent.warnings.some((warning) => warning.code === 'HELPER_MISSING' && /build-helper/.test(warning.message)));
    assert.equal(absent.ok, true); // helper não bloqueia PDFs

    await fs.writeFile(helper, '#!/bin/sh\nexit 0\n');
    await fs.chmod(helper, 0o755);
    const present = await collectDoctorReport({target: 'desktop', root: base, deps: baseDeps({run: makeRun({calls}), isExecutable: isExecutableFile, helperPath: undefined})});
    assert.equal(present.checks.helper.present, true);
    assert.equal(present.checks.helper.executable, true);
    assert.equal(present.checks.helper.symlink, false);
    assert.equal(present.checks.helper.reason, null);
    assert.equal(present.checks.helper.ran, false);

    await fs.chmod(helper, 0o644);
    const notExec = await collectDoctorReport({target: 'desktop', root: base, deps: baseDeps({run: makeRun({calls}), isExecutable: isExecutableFile, helperPath: undefined})});
    assert.equal(notExec.checks.helper.executable, false);
    assert.equal(notExec.checks.helper.reason, 'NOT_EXECUTABLE');
    assert.ok(notExec.warnings.some((warning) => warning.code === 'HELPER_NOT_EXECUTABLE'));

    await fs.rm(helper);
    await fs.symlink('/bin/sh', helper);
    const link = await collectDoctorReport({target: 'desktop', root: base, deps: baseDeps({run: makeRun({calls}), isExecutable: isExecutableFile, helperPath: undefined})});
    assert.equal(link.checks.helper.present, true);
    assert.equal(link.checks.helper.symlink, true);
    assert.equal(link.checks.helper.executable, false);
    assert.equal(link.checks.helper.reason, 'SYMLINK');
    assert.ok(link.warnings.some((warning) => warning.code === 'HELPER_SYMLINK'));

    await fs.rm(helper);
    await fs.mkdir(helper);
    const directory = await collectDoctorReport({target: 'desktop', root: base, deps: baseDeps({run: makeRun({calls}), isExecutable: isExecutableFile, helperPath: undefined})});
    assert.equal(directory.checks.helper.kind, 'directory');
    assert.equal(directory.checks.helper.reason, 'NOT_A_FILE');

    // Em nenhuma variante o helper virou processo.
    assert.equal(calls.some((call) => call.argv[0] === helper || call.argv[0].includes('native/windows')), false);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('runDoctor: help sem tocar em runner, saída JSON e códigos 0/2', async () => {
  const helpOut = [];
  const helpCode = await runDoctor(['--help'], {
    stdout: (text) => helpOut.push(text),
    stderr: () => {},
    deps: {run: async () => { throw new Error('runner não pode ser chamado no --help'); }},
  });
  assert.equal(helpCode, 0);
  assert.match(helpOut.join(''), /--target desktop\|cli/);
  assert.match(doctorUsage(), /NÃO executa o helper/);
  assert.match(doctorUsage(), /NÃO compila nada/);
  assert.match(doctorUsage(), /2\.1\.286/);
  assert.match(doctorUsage(), /2\.1\.287/);

  const usageErr = [];
  const usageCode = await runDoctor(['--target', 'x'], {stdout: () => {}, stderr: (text) => usageErr.push(text), deps: baseDeps()});
  assert.equal(usageCode, 2);
  assert.match(usageErr.join(''), /desktop ou cli/);

  const okOut = [];
  const okCode = await runDoctor(['--target', 'desktop'], {stdout: (text) => okOut.push(text), stderr: () => {}, deps: baseDeps()});
  assert.equal(okCode, 0);
  const report = JSON.parse(okOut.join(''));
  assert.equal(report.ok, true);
  assert.equal(report.target, 'desktop');
  assert.equal(report.generatedAt, '2026-10-07T12:00:00.000Z');

  const failOut = [];
  const failCode = await runDoctor(['--target', 'cli'], {
    stdout: (text) => failOut.push(text),
    stderr: () => {},
    deps: baseDeps({run: makeRun({text: {...VERSIONS, claude: '2.1.286'}})}),
  });
  assert.equal(failCode, 2);
  assert.equal(JSON.parse(failOut.join('')).ok, false);

  const defaultOut = [];
  const defaultCode = await runDoctor([], {stdout: (text) => defaultOut.push(text), stderr: () => {}, deps: baseDeps()});
  assert.equal(defaultCode, 0);
  assert.equal(JSON.parse(defaultOut.join('')).target, 'desktop');
});

test('doctor: entrada principal real (--help/uso inválido) sem tocar em nada', () => {
  const CLI = path.join(PLUGIN_ROOT, 'scripts', 'doctor.mjs');
  const help = spawnSync(process.execPath, [CLI, '--help'], {encoding: 'utf8', timeout: 30000});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--target desktop\|cli/);
  assert.equal(help.stderr, '');

  const bad = spawnSync(process.execPath, [CLI, '--target', 'nope'], {encoding: 'utf8', timeout: 30000});
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /desktop ou cli/);
  assert.equal(bad.stdout, '');
});

test('doctor: caminhos do plugin COPIADO apontam para a cópia, sem executar helper', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-doctor-copy-'));
  const copy = path.join(base, 'mesa-study');
  try {
    await fs.cp(PLUGIN_ROOT, copy, {recursive: true});
    const helper = path.join(copy, 'native', 'windows');
    await fs.writeFile(helper, '#!/bin/sh\nexit 0\n');
    await fs.chmod(helper, 0o755);

    const calls = [];
    const report = await collectDoctorReport({target: 'desktop', root: copy, deps: baseDeps({run: makeRun({calls}), isExecutable: isExecutableFile, helperPath: undefined})});
    assert.equal(report.checks.helper.path, helper);
    assert.equal(report.checks.helper.present, true);
    assert.equal(report.checks.helper.executable, true);
    assert.equal(report.checks.helper.path.startsWith(copy), true);
    assert.equal(report.checks.helper.ran, false);
    assert.equal(calls.some((call) => call.argv[0] === helper), false);
    assert.equal(report.ok, true);
    // O doctor copiado deriva a raiz de si mesmo, não do checkout original.
    const {pathToFileURL} = await import('node:url');
    assert.equal(pluginRootFrom(pathToFileURL(path.join(copy, 'scripts', 'doctor.mjs')).href), await fs.realpath(copy));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});
