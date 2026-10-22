/* Smoke REAL do Poppler com PDF sintético gerado pelo próprio teste.
   Nenhum material de curso, nenhuma rede, nenhuma inferência.
   Se as ferramentas fixas não existirem, o teste é pulado (skip). */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pageOperation} from '../host/page.mjs';
import {resolvePopplerTools} from '../host/tools.mjs';
import {runProcess} from '../host/proc.mjs';
import {PNG_MAGIC, SVG_CHAR_LIMIT} from '../host/config.mjs';
import {makeSyntheticPdf, makeSyntheticTextPdf} from '../host/testing.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'host', 'cli.mjs');
const TOOLS = resolvePopplerTools();

const toolsReady = (await Promise.all(
  [TOOLS.pdfinfo, TOOLS.pdftocairo]
    .map((tool) => fs.access(tool, fs.constants.X_OK).then(() => true, () => false)),
)).every(Boolean);

/* qpdf é usado SÓ para gerar PDFs sintéticos COM senha (nunca instalado
   aqui). Sem ele, os testes de senha real são pulados. */
const QPDF_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
const QPDF = await (async () => {
  for (const dir of QPDF_DIRS) {
    const candidate = path.join(dir, 'qpdf');
    try {
      await fs.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // tenta o próximo diretório conhecido
    }
  }
  return null;
})();
const qpdfReady = toolsReady && QPDF !== null;

async function setup() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-poppler-'));
  const root = path.join(base, 'root');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(cache);
  return {base, root, cache};
}

test('smoke real Poppler: página 2 de PDF sintético vira SVG + PNG', {skip: !toolsReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const pdfPath = path.join(root, 'sintetico.pdf');
    await fs.writeFile(pdfPath, makeSyntheticPdf({pages: 3}));
    const before = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');

    const result = await pageOperation({
      op: 'page', path: pdfPath, page: 2, roots: [root], cacheDir: cache,
    }, {});

    assert.equal(result.ok, true);
    assert.equal(result.kind, 'page');
    assert.equal(result.page, 2);
    assert.equal(result.numPages, 3);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.document.name, 'sintetico.pdf');
    assert.equal(result.document.path, await fs.realpath(pdfPath));
    assert.match(result.svg, /<svg/);
    assert.ok(result.svg.length <= SVG_CHAR_LIMIT, `svg com ${result.svg.length} chars excede ${SVG_CHAR_LIMIT}`);

    const png = await fs.readFile(result.snapshotPath);
    assert.ok(png.length > 1000);
    assert.ok(png.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.ok(width >= 500 && height >= 500, `PNG ${width}x${height} pequeno demais`);
    assert.equal((await fs.stat(result.snapshotPath)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.dirname(result.snapshotPath))).mode & 0o777, 0o700);

    const after = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');
    assert.equal(after, before, 'o PDF precisa permanecer intacto (somente leitura)');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('smoke real Poppler: página fora do intervalo é recusada', {skip: !toolsReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const pdfPath = path.join(root, 'sintetico.pdf');
    await fs.writeFile(pdfPath, makeSyntheticPdf({pages: 3}));
    await assert.rejects(
      pageOperation({op: 'page', path: pdfPath, page: 4, roots: [root], cacheDir: cache}, {}),
      (error) => error.code === 'PAGE_OUT_OF_RANGE' && error.detail.numPages === 3,
    );
    const leftovers = (await fs.readdir(cache)).filter((name) => name.startsWith('mesa-study-'));
    assert.equal(leftovers.length, 0);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('smoke real Poppler: SVG acima do teto vira PNG com previewWarning (sem truncar, PDF intacto)', {skip: !toolsReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const pdfPath = path.join(root, 'sintetico-55-linhas.pdf');
    await fs.writeFile(pdfPath, makeSyntheticTextPdf({lines: 55}));
    const before = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');

    // Prova independente de que ESTA página realmente estoura o teto de SVG.
    const rawSvg = path.join(base, 'cru.svg');
    const raw = await runProcess([TOOLS.pdftocairo, '-svg', '-f', '1', '-l', '1', pdfPath, rawSvg], {
      timeoutMs: 20000, maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(raw.ok, true, raw.stderr);
    const rawText = await fs.readFile(rawSvg, 'utf8');
    assert.ok(
      rawText.length > SVG_CHAR_LIMIT,
      `a página sintética precisa exceder ${SVG_CHAR_LIMIT} chars (veio ${rawText.length})`,
    );

    const result = await pageOperation({op: 'page', path: pdfPath, page: 1, roots: [root], cacheDir: cache}, {});
    assert.equal(result.ok, true);
    assert.equal(result.kind, 'page');
    assert.equal(result.svg, null);
    assert.equal(typeof result.previewWarning, 'string');
    assert.ok(result.previewWarning.length > 0 && result.previewWarning.length <= 300);
    assert.match(result.previewWarning, new RegExp(String(SVG_CHAR_LIMIT)));
    assert.doesNotMatch(result.previewWarning, /fiel|fielmente|idêntic/i);

    // PNG disponível, privado e com dimensões reais, mesmo com a prévia omitida.
    const png = await fs.readFile(result.snapshotPath);
    assert.ok(png.length > 1000);
    assert.ok(png.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC));
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.ok(width >= 500 && height >= 500, `PNG ${width}x${height} pequeno demais`);
    assert.equal((await fs.stat(result.snapshotPath)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.dirname(result.snapshotPath))).mode & 0o777, 0o700);
    assert.equal(
      await fs.stat(path.join(path.dirname(result.snapshotPath), 'page.svg')).then(() => true, () => false),
      false,
      'o SVG excedente não pode sobrar na pasta própria',
    );

    const after = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');
    assert.equal(after, before, 'o PDF precisa permanecer intacto (somente leitura)');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('smoke real Poppler: arquivo .pdf sem cabeçalho %PDF- é recusado', {skip: !toolsReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const bogus = path.join(root, 'falso.pdf');
    await fs.writeFile(bogus, Buffer.alloc(256, 0x41));
    await assert.rejects(
      pageOperation({op: 'page', path: bogus, page: 1, roots: [root], cacheDir: cache}, {}),
      (error) => error.code === 'PDF_HEADER_INVALID',
    );
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('smoke real Poppler: CLI completo em subprocesso devolve uma linha JSON', {skip: !toolsReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const pdfPath = path.join(root, 'sintetico.pdf');
    await fs.writeFile(pdfPath, makeSyntheticPdf({pages: 2}));
    const request = JSON.stringify({op: 'page', path: pdfPath, page: 1, roots: [root], cacheDir: cache});
    const ok = spawnSync(process.execPath, [CLI, request], {encoding: 'utf8', timeout: 120000});
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout.trimEnd().includes('\n'), false);
    const payload = JSON.parse(ok.stdout.trimEnd());
    assert.equal(payload.ok, true);
    assert.equal(payload.kind, 'page');
    assert.equal(payload.numPages, 2);
    assert.ok(await fs.stat(payload.snapshotPath));

    const bad = JSON.stringify({op: 'page', path: pdfPath, page: 9, roots: [root], cacheDir: cache});
    const failed = spawnSync(process.execPath, [CLI, bad], {encoding: 'utf8', timeout: 120000});
    assert.equal(failed.status, 1);
    assert.equal(failed.stdout.trimEnd().includes('\n'), false);
    assert.equal(JSON.parse(failed.stdout.trimEnd()).error.code, 'PAGE_OUT_OF_RANGE');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('smoke real Poppler: root obsoleta é pulada e a página da root válida renderiza', {skip: !toolsReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const pdfPath = path.join(root, 'sintetico.pdf');
    await fs.writeFile(pdfPath, makeSyntheticPdf({pages: 3}));
    const before = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');
    const stale = path.join(base, 'pendrive-removido');

    for (const roots of [[stale, root], [root, stale]]) {
      const result = await pageOperation({op: 'page', path: pdfPath, page: 2, roots, cacheDir: cache}, {});
      assert.equal(result.ok, true);
      assert.equal(result.page, 2);
      assert.equal(result.numPages, 3);
      assert.match(result.svg, /<svg/);
      assert.ok(await fs.stat(result.snapshotPath));
    }

    const after = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');
    assert.equal(after, before, 'o PDF precisa permanecer intacto (somente leitura)');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('smoke real PDF com senha (qpdf): PDF_ENCRYPTED, PDF intacto e pasta limpa', {skip: !qpdfReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const plain = path.join(base, 'plain.pdf');
    await fs.writeFile(plain, makeSyntheticPdf({pages: 2}));
    const pdfPath = path.join(root, 'protegido.pdf');
    const encrypted = spawnSync(
      QPDF,
      ['--encrypt', 'senha-de-usuario', 'senha-de-dono', '256', '--', plain, pdfPath],
      {encoding: 'utf8', timeout: 30000},
    );
    assert.equal(encrypted.status, 0, encrypted.stderr);
    const before = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');

    await assert.rejects(
      pageOperation({op: 'page', path: pdfPath, page: 1, roots: [root], cacheDir: cache}, {}),
      (error) => error.code === 'PDF_ENCRYPTED' && /senha/.test(error.message) && !/password/i.test(error.message),
    );

    const after = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');
    assert.equal(after, before, 'o PDF com senha precisa permanecer intacto');
    const leftovers = (await fs.readdir(cache)).filter((name) => name.startsWith('mesa-study-'));
    assert.equal(leftovers.length, 0, 'nada pode ficar para trás depois do PDF_ENCRYPTED');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('smoke real PDF com senha vazia de usuário (qpdf): abre e renderiza', {skip: !qpdfReady}, async () => {
  const {base, root, cache} = await setup();
  try {
    const plain = path.join(base, 'plain.pdf');
    await fs.writeFile(plain, makeSyntheticPdf({pages: 2}));
    const pdfPath = path.join(root, 'protegido-aberto.pdf');
    const encrypted = spawnSync(
      QPDF,
      ['--encrypt', '', 'senha-de-dono', '256', '--', plain, pdfPath],
      {encoding: 'utf8', timeout: 30000},
    );
    assert.equal(encrypted.status, 0, encrypted.stderr);
    const before = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');

    const result = await pageOperation({op: 'page', path: pdfPath, page: 1, roots: [root], cacheDir: cache}, {});
    assert.equal(result.ok, true);
    assert.equal(result.numPages, 2);
    assert.match(result.svg, /<svg/);
    assert.ok(await fs.stat(result.snapshotPath));

    const after = createHash('sha256').update(await fs.readFile(pdfPath)).digest('hex');
    assert.equal(after, before, 'o PDF precisa permanecer intacto (somente leitura)');
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});
