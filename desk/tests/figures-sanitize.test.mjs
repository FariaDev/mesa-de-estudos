// Figuras do tutor (#60) com Electron de verdade: a mesma sanitização no chat
// (`markdown.mjs`) e no PDF (`materials/template.mjs`), a cerca `plot` nos dois
// e o PDF real com dois gráficos e um SVG. O SVG malicioso é o de
// `figures-fixtures.mjs`; domínio inventado (`evil.example`). Se o Electron
// não inicia neste ambiente (sandbox), os cenários são PULADOS com o motivo.
// Roda da pasta desk: `node --test tests/figures-sanitize.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
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

function scenario(name, extraEnv = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-figures-${name}-`));
  const run = spawnSync(electronPath, [RUNNER, runtime, name], {
    cwd: DESK, env: testEnv({DESK_TEST: '1', ...extraEnv}), encoding: 'utf8', timeout: 180000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const match = /__RESULT__ (\{.*\})\s*$/m.exec(String(run.stdout || ''));
  return {runtime, output, data: match ? JSON.parse(match[1]) : null};
}

const sanitize = scenario('figures-sanitize');
const skip = !sanitize.data && SANDBOX_LIMIT.test(sanitize.output)
  ? `Electron não inicia neste ambiente (sandbox): ${sanitize.output.split('\n').map((line) => line.trim()).filter(Boolean)[0] || 'sem saída'}`
  : false;

function data() {
  assert.ok(sanitize.data?.ok, `o cenário figures-sanitize não devolveu resultado:\n${sanitize.output.slice(-3000)}`);
  return sanitize.data;
}

const BANNED_TAGS = ['script', 'foreignobject', 'use', 'image', 'animate', 'set', 'style', 'iframe'];

for (const where of ['chat', 'pdf']) {
  test(`${where}: SVG malicioso (script, foreignObject, href e url() externos) sai limpo`, {skip}, () => {
    const out = data()[`${where}Malicious`];
    for (const tag of BANNED_TAGS) assert.ok(!out.tags.includes(tag), `${where}: sobrou <${tag}>:\n${out.html}`);
    assert.deepEqual(out.eventAttributes, [], `${where}: sobrou atributo on*`);
    assert.deepEqual(out.links.filter((href) => !href.startsWith('#')), [], `${where}: sobrou href externo`);
    assert.doesNotMatch(out.html, /evil\.example|alert\(|javascript:/i, `${where}: sobrou rastro do conteúdo perigoso:\n${out.html}`);
    for (const tag of ['svg', 'circle', 'rect', 'path', 'text']) assert.ok(out.tags.includes(tag), `${where}: a figura perdeu <${tag}>`);
  });

  test(`${where}: SVG honesto do tutor sobrevive com viewBox e cores do tema`, {skip}, () => {
    const out = data()[`${where}Triangle`];
    assert.ok(out.tags.includes('polygon') && out.tags.includes('text'), out.html);
    assert.match(out.html, /viewBox="0 0 220 140"/);
    assert.match(out.html, /var\(--plot-2\)/);
  });

  test(`${where}: cerca plot vira SVG com a mesma guarda`, {skip}, () => {
    const out = data()[`${where}Plot`];
    assert.equal(out.plots, 1, out.html.slice(0, 400));
    assert.ok(out.tags.includes('path') && out.tags.includes('clippath'), out.html.slice(0, 400));
    assert.deepEqual(out.eventAttributes, []);
    assert.deepEqual(out.links.filter((href) => !href.startsWith('#')), []);
  });

  test(`${where}: cerca plot mal formada vira aviso legível, não some`, {skip}, () => {
    const out = data()[`${where}Broken`];
    assert.equal(out.plots, 0);
    assert.equal(out.warnings.length, 1, out.html);
    assert.match(out.warnings[0], /de zero a dez/, 'o aviso deve citar o que veio');
    assert.match(out.warnings[0], /mín\.\.máx/, 'o aviso deve dizer o formato esperado');
  });
}

test('pdf: a cerca mal formada entra como diagnóstico do material', {skip}, () => {
  const {diagnostics} = data().pdfBroken;
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].kind, 'figure');
  assert.equal(diagnostics[0].code, 'plot-domain');
  assert.equal(diagnostics[0].line, 1);
});

test('pdf: a lista de exemplo com dois plot e um SVG sai em PDF com as figuras e o aviso', {skip}, async () => {
  const outDir = process.env.MESA_FIGURES_OUT ? path.resolve(process.env.MESA_FIGURES_OUT) : fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-figures-pdf-'));
  fs.mkdirSync(outDir, {recursive: true});
  const pdf = scenario('figures-pdf', {MESA_FIGURES_PDF_OUT: outDir});
  const pdfFile = path.join(outDir, 'figuras.pdf');
  assert.ok(pdf.data?.ok, `figures-pdf falhou:\n${pdf.output.slice(-3000)}`);
  assert.ok(pdf.data.bytes > 5000);
  const figureNotes = pdf.data.diagnostics.filter((entry) => entry.kind === 'figure');
  assert.equal(figureNotes.length, 1);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({data: new Uint8Array(fs.readFileSync(pdfFile)), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true});
  const document = await task.promise;
  let text = '';
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    text += `${content.items.map((item) => item.str).join(' ')}\n`;
  }
  await task.destroy();
  for (const label of ['Parábola de exemplo', 'Duas ondas inventadas', 'raiz', 'seno', 'cosseno menor']) assert.match(text, new RegExp(label), `o PDF perdeu o texto da figura: ${label}`);
  assert.match(text, /Triângulo|hipotenusa/);
  assert.match(text, /de\s+zero\s+a\s+dez/, 'o aviso da cerca mal formada precisa aparecer no PDF');
  fs.rmSync(pdf.runtime, {recursive: true, force: true});
});

test('ver o que desenhei: a ferramenta real devolve PNG, avisos e o que o sanitizador removeu', {skip}, () => {
  const outDir = process.env.MESA_FIGURES_OUT ? path.resolve(process.env.MESA_FIGURES_OUT) : fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-figures-ver-'));
  fs.mkdirSync(outDir, {recursive: true});
  const run = scenario('figure-preview', {MESA_FIGURES_PDF_OUT: outDir});
  assert.ok(run.data?.ok, `figure-preview falhou:\n${run.output.slice(-3000)}`);
  const {plot, plotDark, triangle, malicious, broken} = run.data;
  for (const entry of [plot, plotDark, triangle, malicious, broken]) {
    assert.equal(entry.png.signature, 'PNG');
    assert.ok(entry.png.bytes > 1000 && entry.png.height >= 48, JSON.stringify(entry.png));
  }
  assert.deepEqual([plot.plots, plot.svgs, plot.warnings, plot.removed], [1, 0, [], []]);
  assert.equal(plot.width, 560);
  assert.equal(plotDark.theme, 'escuro');
  assert.equal(plotDark.png.width, 480);
  assert.deepEqual([triangle.plots, triangle.svgs, triangle.warnings, triangle.removed], [0, 1, [], []]);
  assert.deepEqual(malicious.removed.filter((name) => ['<script>', '<foreignObject>', '<use>', '<image>', '<animate>', 'atributo onload', 'atributo onclick'].includes(name)).length, 7, `faltou apontar: ${malicious.removed}`);
  assert.ok(malicious.removed.includes('atributo href'), 'o href externo some e o resumo diz');
  assert.equal(malicious.svgs, 1);
  assert.equal(broken.plots, 0);
  assert.match(broken.warnings[0], /de zero a dez/);
  assert.match(broken.warnings[0], /mín\.\.máx/);
  fs.rmSync(run.runtime, {recursive: true, force: true});
});
