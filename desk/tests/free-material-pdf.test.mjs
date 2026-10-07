// Teste do serviço de PDF da aba Livre (desk/material-pdf.cjs + print.*) com
// Electron de verdade: o runner isolado (tests/free-pdf-runner.cjs) gera PDFs
// num runtime temporário e este teste lê o PDF real com pdfjs (texto, páginas e
// fontes KaTeX embutidas), além de checar cancelamento, colisão de nome,
// bloqueio de rede e a limpeza quando o metadata falha.
//
// Se o ambiente não deixa o Electron iniciar (sandbox de CI/harness negando o
// mach bootstrap), os cenários são PULADOS com o motivo — nunca "verdes"
// silenciosos. Roda da pasta desk: `node --test tests/free-material-pdf.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(DESK, 'tests', 'free-pdf-runner.cjs');
const SANDBOX_LIMIT = /mach_port_rendezvous|bootstrap_check_in|sandbox_extension_issue_file_to_process|Process failed to launch/i;
const SCENARIO_TIMEOUT = 240000;

function scenario(name, {timeout = SCENARIO_TIMEOUT} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-free-${name}-`));
  const run = spawnSync(electronPath, [RUNNER, runtime, name], {
    cwd: DESK,
    env: testEnv({DESK_TEST: '1'}),
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const match = /__RESULT__ (\{.*\})\s*$/m.exec(String(run.stdout || ''));
  let data = null;
  let parseError = '';
  if (match) {
    try {
      data = JSON.parse(match[1]);
    } catch (error) {
      parseError = error.message;
    }
  }
  return {runtime, output, data, parseError, status: run.status, runError: run.error};
}

const probe = scenario('payload', {timeout: 60000});
const sandboxed = !probe.data && SANDBOX_LIMIT.test(probe.output);
const skip = sandboxed
  ? `Electron não inicia neste ambiente (sandbox): ${String(probe.output).split('\n').map((line) => line.trim()).filter(Boolean)[0] || 'sem saída'}`
  : false;
if (probe.runtime) fs.rmSync(probe.runtime, {recursive: true, force: true});

function expectData(result, label) {
  assert.ok(result.data, `${label}: o runner de PDF não devolveu resultado (status ${result.status}, parseError ${result.parseError || 'n/a'}):\n${String(result.output).slice(-4000)}`);
  return result.data;
}

async function readPdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(fs.readFileSync(file));
  const loadingTask = pdfjs.getDocument({data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true});
  const document = await loadingTask.promise;
  const pages = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  await loadingTask.destroy();
  return {numPages: document.numPages, text: pages.join('\n')};
}

test('payload inválido é recusado sem abrir janela (Node puro)', async () => {
  const materialPdf = require('../material-pdf.cjs');
  await assert.rejects(materialPdf.renderPdf({markdown: 42}), (error) => error.code === 'BAD_PAYLOAD');
  await assert.rejects(materialPdf.renderPdf({markdown: '   '}), (error) => error.code === 'BAD_PAYLOAD');
  await assert.rejects(materialPdf.renderPdf({markdown: 'x'.repeat(materialPdf.MAX_MARKDOWN_CHARS + 1)}), (error) => error.code === 'TOO_BIG');
  await assert.rejects(materialPdf.savePdf({dir: path.join(os.tmpdir(), 'mesa-nao-existe-xyz'), stem: 'x', markdown: '# x'}), (error) => error.code === 'BAD_DIR');
});

test('gera PDF real multipágina, com texto extraível e KaTeX embutido', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('render');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'render');
  assert.equal(data.ok, true, JSON.stringify(data.error || data));
  assert.ok(fs.existsSync(data.path));
  assert.ok(fs.statSync(data.path).size > 1024, 'PDF com conteúdo de verdade');
  assert.equal(data.statBytes, data.bytes);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(data.path)).digest('hex'), data.sha256);
  assert.equal(fs.readFileSync(data.path).subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(fs.readFileSync(data.path).includes(Buffer.from('KaTeX')), 'fonte KaTeX embutida no PDF');
  assert.deepEqual(data.listed, [data.name]);
  assert.equal(data.payload.kind, 'free');
  assert.equal(data.payload.materials.length, 1);
  assert.equal(data.payload.materials[0].kind, 'generated');
  assert.equal(data.payload.materials[0].path, data.path);

  return readPdf(data.path).then((pdf) => {
    assert.ok(pdf.numPages >= 2, `esperava mais de uma página, veio ${pdf.numPages}`);
    assert.match(pdf.text, /Limites/);
    assert.match(pdf.text, /Parágrafo 1\b/);
    assert.doesNotMatch(pdf.text, /\$\$/);
    assert.doesNotMatch(pdf.text, /\\frac/);
  });
});

test('página de impressão não faz nenhuma requisição de rede', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('network');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'network');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.equal(data.hits, 0, 'nenhuma requisição chegou no servidor local');
  assert.ok(fs.existsSync(data.path));
});

test('PDF preserva o desenho vetorial do radical do KaTeX', {skip, timeout: SCENARIO_TIMEOUT}, async (t) => {
  const result = scenario('radical');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'radical');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.ok(data.vectors.length > 0, 'KaTeX gerou o traço SVG do radical');
  assert.ok(data.vectors.every(vector => vector.display !== 'none' && vector.width > 0 && vector.height > 0), 'o radical deve estar visível quando a página é entregue ao printToPDF');
  assert.equal(fs.readFileSync(data.path).subarray(0, 5).toString('latin1'), '%PDF-');
});

test('cancelar a geração não grava arquivo nem material', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('abort');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'abort');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.equal(data.code, 'ABORTED');
  assert.deepEqual(data.leftovers, []);
  assert.equal(data.materials, 0);
});

test('gravação que falha não deixa falso sucesso', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('writefail');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'writefail');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.equal(data.code, 'WRITE');
  assert.deepEqual(data.leftovers, [], 'nem PDF nem temporário');
});

test('duas gravações simultâneas do mesmo título recebem nomes distintos', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('unique');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'unique');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.equal(data.names.length, 2);
  assert.notEqual(data.names[0], data.names[1]);
});

test('falha de metadata desfaz o PDF criado por saveMaterial', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('inject');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'inject');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.equal(data.code, 'CORRUPT');
  assert.deepEqual(data.leftovers, []);
});
