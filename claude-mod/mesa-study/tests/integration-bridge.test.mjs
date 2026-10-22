// Ponte real Node -> CLI -> Poppler; engine Desktop, captura e modelo não são usados.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createHelper} from '../lib/helper.mjs';
import {makeSyntheticPdf} from '../host/testing.mjs';

const run = promisify(execFile);
const pluginRoot = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const prefixes = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
const ready = (await Promise.all(['pdfinfo', 'pdftocairo'].map(async name => {
  for (const prefix of prefixes) {
    try { await fs.access(path.join(prefix, name), fs.constants.X_OK); return true; } catch {}
  }
  return false;
}))).every(Boolean);

test('ponte real preserva PNG e documento em página simples e página sem prévia', {skip: !ready}, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-mod-bridge-'));
  try {
    const base = await fs.realpath(temp);
    const root = path.join(base, 'pdfs');
    const cacheDir = path.join(base, 'cache');
    await fs.mkdir(root, {mode: 0o700});
    await fs.mkdir(cacheDir, {mode: 0o700});
    // Nome com aspas/metacaracteres confirma o transporte por argv, sem shell.
    const pdf = path.join(root, 'synthetic " quote $(never-execute).pdf');
    const lines = Array.from({length: 55}, (_, i) =>
      `Line ${i + 1}: f(x) = 2 x^2 + 3 x - 5, g(x) = sin(x) + cos(2 x), h(x) = sqrt(x + 1)`);
    await fs.writeFile(pdf, makeSyntheticPdf({texts: ['Simple page', lines], height: 1400, fontSize: 12}));
    const hash = async () => createHash('sha256').update(await fs.readFile(pdf)).digest('hex');
    const before = await hash();
    const calls = [];
    const $ = {
      plugin: {root: pluginRoot},
      fs: {stat: async p => ({kind: (await fs.stat(p)).isDirectory() ? 'dir' : 'file', realPath: await fs.realpath(p)})},
      process: {run: async (argv, options) => {
        calls.push(argv);
        try {
          const output = await run(argv[0], argv.slice(1), {timeout: options.timeoutMs, maxBuffer: 2_000_000});
          return {...output, exitCode: 0};
        } catch (error) {
          if (typeof error.code === 'number') return {exitCode: error.code, stdout: error.stdout, stderr: error.stderr};
          throw error;
        }
      }},
    };
    const helper = createHelper({nodePath: process.execPath, cacheDir});
    const small = await helper.page($, {path: pdf, page: 1, roots: [root]});
    assert.equal(small.ok, true, JSON.stringify(small));
    assert.equal(small.page, 1);
    assert.match(small.svg, /<svg/);
    const large = await helper.page($, {path: pdf, page: 2, roots: [root]});
    assert.equal(large.ok, true, JSON.stringify(large));
    assert.equal(large.page, 2);
    assert.equal(large.svg, null);
    assert.ok(large.previewWarning, 'o aviso do host deve chegar ao consumidor');
    for (const result of [small, large]) {
      assert.equal(result.document.path, pdf);
      assert.equal(result.numPages, 2);
      assert.equal(result.mimeType, 'image/png');
      assert.ok(result.snapshotPath.startsWith(cacheDir + path.sep));
      const image = await fs.readFile(result.snapshotPath);
      assert.equal(image.subarray(1, 4).toString(), 'PNG');
      assert.equal((await fs.stat(result.snapshotPath)).mode & 0o777, 0o600);
    }
    const invalid = await helper.page($, {path: pdf, page: 3, roots: [root]});
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error.code, 'PAGE_OUT_OF_RANGE');
    assert.equal(calls.length, 3, 'sem reenvio automático');
    assert.equal(calls[0][1], path.join(pluginRoot, 'host/cli.mjs'));
    assert.equal(JSON.parse(calls[0][2]).path, pdf);
    assert.equal(await hash(), before, 'PDF original permanece intacto');
  } finally {
    await fs.rm(temp, {recursive: true, force: true});
  }
});
