/* Contrato do CLI: `node host/cli.mjs JSON_STRING`.
   - uma linha JSON no stdout, exit 0 no sucesso e 1 na falha;
   - JSON bounded em argv[2], sem stdin, sem shell;
   - executável de processo nunca vem do pedido (ver host-page/host-capture).
   Os casos de PDF usam executor falso; o smoke real fica em host-poppler. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runCli, parseRequest, isMainEntry} from '../host/cli.mjs';
import {MAX_REQUEST_CHARS} from '../host/config.mjs';
import {makeFakePng, writeValidFakePdf} from '../host/testing.mjs';

const HOST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'host');
const CLI = path.join(HOST_DIR, 'cli.mjs');
const NODE = process.execPath;

function runCliProcess(json) {
  const args = json === undefined ? [CLI] : [CLI, json];
  return spawnSync(NODE, args, {encoding: 'utf8', timeout: 30000});
}

function parseSingleLine(stdout) {
  assert.ok(stdout.endsWith('\n'), 'stdout termina com quebra de linha');
  assert.equal(stdout.trimEnd().includes('\n'), false, 'stdout tem uma única linha');
  return JSON.parse(stdout.trimEnd());
}

test('CLI: sem argumento devolve BAD_REQUEST em uma linha e sai 1', () => {
  const result = runCliProcess();
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  const payload = parseSingleLine(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'BAD_REQUEST');
  assert.ok(typeof payload.error.message === 'string' && payload.error.message.length > 0);
});

test('CLI: JSON inválido/array/longo demais são recusados com exit 1', () => {
  const invalid = runCliProcess('{nao e json');
  assert.equal(invalid.status, 1);
  assert.equal(parseSingleLine(invalid.stdout).error.code, 'BAD_REQUEST');

  const array = runCliProcess(JSON.stringify([1, 2, 3]));
  assert.equal(array.status, 1);
  assert.equal(parseSingleLine(array.stdout).error.code, 'BAD_REQUEST');

  const huge = runCliProcess(`{"op":"page","x":"${'a'.repeat(MAX_REQUEST_CHARS)}"}`);
  assert.equal(huge.status, 1);
  assert.equal(parseSingleLine(huge.stdout).error.code, 'BAD_REQUEST');
});

test('CLI: operação desconhecida devolve UNKNOWN_OP e sai 1', () => {
  const result = runCliProcess(JSON.stringify({op: 'teleporte'}));
  assert.equal(result.status, 1);
  const payload = parseSingleLine(result.stdout);
  assert.equal(payload.error.code, 'UNKNOWN_OP');
});

test('CLI: runCli injetado devolve sucesso em uma linha com exit 0', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-cli-'));
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache);
  try {
    const helperPath = path.join(HOST_DIR, 'capture.mjs');
    const window = {id: 3, app: 'Xournal++', title: 'Resolução', bounds: {Width: 900, Height: 700}};
    const run = async (argv) => {
      if (argv[0] === helperPath) {
        return {ok: true, code: 0, stdout: JSON.stringify({permission: true, windows: [window]}), stderr: '', timedOut: false, missing: false};
      }
      await fs.writeFile(argv[argv.length - 1], makeFakePng({bytes: 256}));
      return {ok: true, code: 0, stdout: '', stderr: '', timedOut: false, missing: false};
    };
    const lines = [];
    const code = await runCli([JSON.stringify({op: 'capture', cacheDir: cache})], {
      deps: {run, helperPath},
      stdout: (line) => lines.push(line),
    });
    assert.equal(code, 0);
    assert.equal(lines.length, 1);
    const payload = parseSingleLine(lines[0]);
    assert.equal(payload.ok, true);
    assert.equal(payload.kind, 'capture');
    assert.ok(payload.snapshotPath.startsWith(await fs.realpath(cache)));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('CLI: runCli injetado devolve falha em uma linha com exit 1', async () => {
  const lines = [];
  const code = await runCli([JSON.stringify({op: 'page'})], {deps: {}, stdout: (line) => lines.push(line)});
  assert.equal(code, 1);
  assert.equal(lines.length, 1);
  const payload = parseSingleLine(lines[0]);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'PATH_NOT_ABSOLUTE');
});

test('parseRequest: exige exatamente um argumento e objeto', () => {
  assert.throws(() => parseRequest([]), (error) => error.code === 'BAD_REQUEST');
  assert.throws(() => parseRequest(['{}', '{}']), (error) => error.code === 'BAD_REQUEST');
  assert.throws(() => parseRequest(['null']), (error) => error.code === 'BAD_REQUEST');
  assert.deepEqual(parseRequest(['{"op":"capture"}']), {op: 'capture'});
});

test('CLI: main detectado por caminho real (symlink de arquivo e de diretório-pai)', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-cli-link-'));
  try {
    const fileLink = path.join(base, 'cli-link.mjs');
    const dirLink = path.join(base, 'host-link');
    try {
      await fs.symlink(CLI, fileLink);
      await fs.symlink(HOST_DIR, dirLink);
    } catch {
      t.skip('symlink não suportado neste ambiente');
      return;
    }

    // Antes da correção: exit 0 e stdout vazio (argv[1] symlinkado nunca
    // batia com import.meta.url). Agora: UMA linha JSON e exit 1 (UNKNOWN_OP).
    for (const entry of [fileLink, path.join(dirLink, 'cli.mjs')]) {
      const result = spawnSync(NODE, [entry, JSON.stringify({op: 'teleporte'})], {encoding: 'utf8', timeout: 30000});
      assert.equal(result.status, 1, `${entry} precisa rodar o main e sair 1`);
      assert.equal(result.stderr, '');
      const payload = parseSingleLine(result.stdout);
      assert.equal(payload.ok, false);
      assert.equal(payload.error.code, 'UNKNOWN_OP');
    }

    // A detecção de main usa caminhos reais; importado como módulo (argv[1] de
    // outro arquivo) o CLI não ativa o runner.
    assert.equal(isMainEntry(CLI), true);
    assert.equal(isMainEntry(fileLink), true);
    assert.equal(isMainEntry(path.join(dirLink, 'cli.mjs')), true);
    assert.equal(isMainEntry(fileURLToPath(import.meta.url)), false);
    assert.equal(isMainEntry(path.join(base, 'nao-existe.mjs')), false);
    assert.equal(isMainEntry(undefined), false);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('CLI: prévia acima do teto vira svg:null + previewWarning, sem truncar o SVG', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-cli-'));
  const root = path.join(base, 'root');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  try {
    const pdf = await writeValidFakePdf(path.join(root, 'doc.pdf'));
    const longSvg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">${'x'.repeat(200000)}</svg>`;
    const run = async (argv) => {
      const tool = path.basename(argv[0]);
      if (tool === 'pdfinfo') {
        return {ok: true, code: 0, stdout: 'Pages: 1\n', stderr: '', timedOut: false, missing: false};
      }
      const output = argv[argv.length - 1];
      if (argv.includes('-svg')) {
        await fs.writeFile(output, longSvg);
      } else {
        await fs.writeFile(`${output}.png`, makeFakePng());
      }
      return {ok: true, code: 0, stdout: '', stderr: '', timedOut: false, missing: false};
    };
    const lines = [];
    const code = await runCli([JSON.stringify({op: 'page', path: pdf, page: 1, roots: [root], cacheDir: cache})], {
      deps: {run},
      stdout: (line) => lines.push(line),
    });
    assert.equal(code, 0);
    const payload = parseSingleLine(lines[0]);
    assert.equal(payload.ok, true);
    assert.equal(payload.svg, null); // serializado como null, nunca truncado
    assert.equal(typeof payload.previewWarning, 'string');
    assert.ok(payload.previewWarning.length > 0 && payload.previewWarning.length <= 300);
    assert.ok(await fs.stat(payload.snapshotPath));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('host não usa shell: só execFile, nenhum shell:true', async () => {
  const entries = await fs.readdir(HOST_DIR);
  const sources = await Promise.all(entries
    .filter((name) => name.endsWith('.mjs'))
    .map(async (name) => ({name, text: await fs.readFile(path.join(HOST_DIR, name), 'utf8')})));
  for (const {name, text} of sources) {
    assert.equal(/shell\s*:\s*true/.test(text), false, `${name} não pode usar shell:true`);
    assert.equal(/node:child_process/.test(text), name === 'proc.mjs', `${name} só pode tocar processos via proc.mjs`);
  }
  const proc = sources.find((source) => source.name === 'proc.mjs');
  assert.ok(proc && /execFile/.test(proc.text));
  assert.ok(/shell:\s*false/.test(proc.text));
  assert.equal(/\bexecSync\b|\bspawnSync\b|\bspawn\(/.test(proc.text), false);
});
