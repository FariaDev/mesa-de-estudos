// Testes do template de material: tokenizador de matemática (cifrão/dinheiro,
// escape, código inline/cercado/indentado), títulos por estrutura Markdown,
// erros × avisos do KaTeX e as provas reais no Electron (multipágina, fontes,
// fórmula larga ajustada, overflow bloqueado e equação inválida barrada antes
// de abrir janela). Nenhum dado pessoal: fixtures sintéticas em tests/fixtures.
//
// Node puro: `node --test tests/material-template.test.mjs`.
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
import {
  MATERIAL_TEMPLATE_VERSION,
  tokenizeMaterial,
  prepareMaterialMarkdown,
  checkMaterialMath,
  materialRevision,
} from '../src/materials/template.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(DESK, 'tests', 'free-pdf-runner.cjs');
const SANDBOX_LIMIT = /mach_port_rendezvous|bootstrap_check_in|sandbox_extension_issue_file_to_process|Process failed to launch/i;
const SCENARIO_TIMEOUT = 300000;

/* ---------- Node puro: tokenizador ---------- */

const mathSegments = (markdown) => tokenizeMaterial(markdown).filter((segment) => segment.type === 'math');

test('tokenizador extrai $…$, $$…$$, \\(…\\) e \\[…\\]', () => {
  assert.deepEqual(mathSegments('valor $x+1$ fim').map((segment) => segment.tex), ['x+1']);
  assert.deepEqual(mathSegments('$$a=1$$').map((segment) => [segment.display, segment.tex]), [[true, 'a=1']]);
  assert.deepEqual(mathSegments('\\(y\\)').map((segment) => segment.tex), ['y']);
  assert.deepEqual(mathSegments('\\[z\\]').map((segment) => segment.display), [true]);
});

test('tokenizador não trata dinheiro como matemática', () => {
  assert.equal(mathSegments('O desconto era $5 e o outro $10.').length, 0);
  assert.equal(mathSegments('Custa $10,00 e recebeu $3,50.').length, 0);
  assert.equal(mathSegments('$5 no início').length, 0, 'cifrão sem fechamento não é math');
  assert.deepEqual(mathSegments('$5 + 3 = 8$').map((segment) => segment.tex), ['5 + 3 = 8'], 'expressão inteira continua matemática');
});

test('tokenizador respeita escape e delimitador incompleto', () => {
  assert.equal(mathSegments('preço \\$5 e \\$10').length, 0);
  assert.equal(mathSegments('fórmula $x+1').length, 0, 'delimitador incompleto fica texto');
  assert.equal(mathSegments('$$a=1').length, 0, 'display incompleto fica texto');
});

test('tokenizador ignora matemática em código inline, cercado e indentado', () => {
  assert.equal(mathSegments('use `$x$` no texto').length, 0);
  assert.equal(mathSegments('```\n# $x$ e $$y$$\n```\n').length, 0);
  assert.equal(mathSegments('    $$ z $$\n').length, 0);
  assert.equal(mathSegments('texto\n\n    $w$\n\nfim').length, 0, 'código indentado após linha em branco');
  assert.deepEqual(mathSegments('texto $a$ e `$b$` e $c$').map((segment) => segment.tex), ['a', 'c']);
});

test('tokenizador preserva os offsets para diagnóstico', () => {
  const markdown = 'linha\n\ntexto $x+1$ fim';
  const [segment] = mathSegments(markdown);
  assert.equal(markdown.slice(segment.start, segment.end), '$x+1$');
});

/* P1-1: a proteção de código vem da árvore do marked, não da linha crua. */
test('tokenizador entende lista e citação: código protegido e fórmula acompanhada', () => {
  /* Continuação de item de lista é parágrafo, não código indentado. */
  assert.deepEqual(mathSegments('- item\n\n    $x+1$ continuação\n').map((s) => s.tex), ['x+1']);
  assert.deepEqual(checkMaterialMath('- item\n\n    $x+1$ continuação\n').errors, []);
  /* Código (indentado ou cercado) dentro de citação/lista continua protegido. */
  assert.equal(mathSegments('> Exemplo de código:\n>\n>     $\\frac{1}{$\n').length, 0);
  assert.equal(checkMaterialMath('> Exemplo de código:\n>\n>     $\\frac{1}{$\n').errors.length, 0);
  assert.equal(mathSegments('> ```\n> $z$\n> ```\n').length, 0);
  assert.equal(mathSegments('> > ```\n> > $z$\n> > ```\n').length, 0, 'citação dentro de citação');
  assert.equal(mathSegments('> - item\n>\n>     ```\n>     $x$\n>     ```\n').length, 0, 'cerca em lista dentro de citação');
  assert.equal(mathSegments('- item\n\n    > ```\n    > $y$\n    > ```\n').length, 0, 'citação dentro de lista');
  assert.equal(mathSegments('1. primeiro\n\n       $code$\n').length, 0, 'código de 8 espaços em lista ordenada');
  assert.deepEqual(mathSegments('1. primeiro\n\n    $ok$\n').map((s) => s.tex), ['ok'], 'continuação de lista ordenada é parágrafo');
  assert.equal(mathSegments('- item\n\n    ```\n    $y$\n    ```\n').length, 0);
  assert.equal(mathSegments('- item\n\n        $q$\n').length, 0, 'código de 8 espaços no item');
  assert.equal(mathSegments('texto\n\n    $$y$$\n').length, 0, 'código indentado de topo continua protegido');
  /* Fórmula fora do código continua achada quando os contêineres se misturam. */
  assert.deepEqual(
    mathSegments('> texto $a$\n>\n> ```\n> $b$\n> ```\n\n- item\n\n    $c$ continuação\n').map((s) => s.tex),
    ['a', 'c'],
  );
  /* Citação com lista e item aninhados não esconde a matemática do texto. */
  assert.deepEqual(mathSegments('> - item\n>   - sub\n>\n>     $w$\n').map((s) => s.tex), ['w']);
});

/* Residual r6: tab no recuo de contêiner — o marked expande o tab do item no
   `raw`; o locateRaw mapeia a fonte original sem normalizar o corpo inteiro. */
test('tokenizador entende recuo com tab: lista, ordenada, citação e cerca', () => {
  assert.deepEqual(mathSegments('- item\n\n\t$x+1$ continuação\n').map((s) => s.tex), ['x+1']);
  assert.deepEqual(checkMaterialMath('- item\n\n\t$x+1$ continuação\n').errors, []);
  assert.deepEqual(mathSegments('1. primeiro\n\n\t$x+1$ continuação\n').map((s) => s.tex), ['x+1']);
  assert.deepEqual(mathSegments('> Exemplo:\n>\n>\t$x+1$ continuação\n').map((s) => s.tex), ['x+1']);
  assert.deepEqual(mathSegments('1. primeiro\n\t1. sub\n\n\t\t$x+1$ continuação\n').map((s) => s.tex), ['x+1']);
  /* Cerca e código indentado com tab continuam protegidos. */
  assert.equal(mathSegments('- item\n\n\t```\n\t$y$\n\t```\n').length, 0);
  assert.equal(mathSegments('> texto\n>\n>\t```\n>\t$z$\n>\t```\n').length, 0);
  assert.equal(mathSegments('- item\n\n\t\t$code$\n').length, 0, 'código de dois tabs no item');
  /* Um segundo bloco com tab também é tokenizado: o fallback não pode engolir
     o documento inteiro. */
  assert.deepEqual(mathSegments('- item\n\n\t$x$\n\n\t$w$\n').map((s) => s.tex), ['x', 'w']);
  /* Fórmula em outro bloco não some por causa do tab. */
  assert.deepEqual(
    mathSegments('- item\n\n\t```\n\t$code$\n\t```\n\nOutra $z$.\n').map((s) => s.tex),
    ['z'],
  );
});

/* ---------- Node puro: títulos ---------- */

test('título repetido no primeiro bloco é removido e os headings descem um nível', () => {
  const result = prepareMaterialMarkdown({title: 'Limites', markdown: '# Limites\n\nTexto.\n\n## Seção\n\n### Detalhe\n'});
  assert.equal(result.markdown, '\n\nTexto.\n\n### Seção\n\n#### Detalhe\n');
  assert.ok(result.diagnostics.some((entry) => entry.code === 'title-deduped'));
  assert.ok(result.diagnostics.some((entry) => entry.code === 'headings-shifted'));
});

test('título diferente é mantido, mas todos os headings descem', () => {
  const result = prepareMaterialMarkdown({title: 'Outro', markdown: '# Limites\n\n## Seção\n'});
  assert.match(result.markdown, /^## Limites/);
  assert.match(result.markdown, /### Seção/);
});

test('heading dentro de código ou de display math não é tocado', () => {
  const source = '```md\n# dentro do código\n```\n\n# Título\n\n$$ # não é heading $$\n';
  const result = prepareMaterialMarkdown({title: 'Título', markdown: source});
  assert.match(result.markdown, /# dentro do código/);
  assert.match(result.markdown, /\$\$ # não é heading \$\$/);
  assert.doesNotMatch(result.markdown, /^# Título/m);
});

test('setext é tratado pela estrutura Markdown', () => {
  const result = prepareMaterialMarkdown({title: 'Resumo', markdown: 'Resumo\n======\n\nTexto.'});
  assert.equal(result.markdown, '\n\nTexto.');
});

/* P2-1: headings dentro de citação/lista também descem para existir um H1 só. */
test('headings aninhados em citação e item de lista descem', () => {
  const quoted = prepareMaterialMarkdown({title: 'Limites', markdown: '# Limites\n\n> # Sub bloco\n\n## Depois\n'});
  assert.equal(quoted.markdown, '\n\n> ## Sub bloco\n\n### Depois\n');
  const listed = prepareMaterialMarkdown({title: 'X', markdown: 'texto\n\n- item\n\n    # Sub\n\n  - nested\n\n## fim\n'});
  assert.match(listed.markdown, /^    ## Sub$/m);
  assert.match(listed.markdown, /^### fim$/m);
  const mixed = prepareMaterialMarkdown({title: 'X', markdown: '## Fora\n\n> texto\n>\n> # Dentro\n\n- lista\n\n    ## Em lista\n'});
  assert.match(mixed.markdown, /^### Fora$/m);
  assert.match(mixed.markdown, /^> ## Dentro$/m);
  assert.match(mixed.markdown, /^    ### Em lista$/m);
  assert.equal((mixed.markdown.match(/^# /gm) || []).length, 0, 'nenhum H1 de conteúdo ficou de pé');
});

/* Residual r6: heading com recuo por tab desce preservando o recuo da fonte
   (o raw do marked expande o tab, então o lead vem da fonte, não do raw). */
test('heading com recuo por tab desce preservando o contêiner', () => {
  const listed = prepareMaterialMarkdown({title: 'X', markdown: '- item\n\n\t# Sub\n'});
  assert.equal(listed.markdown, '- item\n\n\t## Sub\n');
  assert.ok(listed.diagnostics.some((entry) => entry.code === 'headings-shifted'));
  assert.ok(!listed.diagnostics.some((entry) => entry.code === 'heading-rewrite-skipped'));
  const nested = prepareMaterialMarkdown({title: 'X', markdown: '1. primeiro\n\t1. sub\n\n\t\t# Deep\n'});
  assert.equal(nested.markdown, '1. primeiro\n\t1. sub\n\n\t\t## Deep\n');
});

/* P2-2: CRLF/CR não podem pular a reescrita por diferença de raw × fonte. */
test('CRLF e CR são normalizados e a reescrita de títulos não é pulada', () => {
  const crlf = prepareMaterialMarkdown({title: 'Limites', markdown: '# Limites\r\n\r\nTexto.\r\n'});
  assert.equal(crlf.markdown, '\n\nTexto.\n');
  assert.ok(!crlf.diagnostics.some((entry) => entry.code === 'heading-rewrite-skipped'));
  assert.ok(crlf.diagnostics.some((entry) => entry.code === 'title-deduped'));
  assert.ok(!crlf.diagnostics.some((entry) => entry.code === 'headings-shifted'), 'nada a descer além do título');
  const cr = prepareMaterialMarkdown({title: 'None', markdown: '## Seção\rTexto.\r'});
  assert.equal(cr.markdown, '### Seção\nTexto.\n');
  const math = checkMaterialMath('Valor $x$.\r\nOutro $y$.\r\n');
  assert.deepEqual(math.segments.filter((segment) => segment.type === 'math').map((segment) => segment.tex), ['x', 'y']);
  assert.deepEqual(math.errors, []);
});

test('sem título nada é removido nem deslocado', () => {
  const source = '# A\n\n## B\n';
  assert.equal(prepareMaterialMarkdown({title: '', markdown: source}).markdown, source);
});

/* ---------- Node puro: matemática (erro × aviso) ---------- */

test('checkMaterialMath aceita o subconjunto útil de LaTeX', () => {
  const markdown = [
    '$$\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}$$',
    '$$g(x)=\\begin{cases} x^2, & x \\ge 0 \\\\ -x, & x < 0 \\end{cases}$$',
    '$$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$',
    '$$\\begin{array}{cc} a & b \\end{array}$$',
    '$$\\begin{gathered} x=1 \\\\ y=2 \\end{gathered}$$',
    '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} \\tag{1}$$',
  ].join('\n\n');
  const result = checkMaterialMath(markdown);
  assert.deepEqual(result.errors, []);
});

test('checkMaterialMath detecta erro de parsing e comando sem suporte', () => {
  for (const markdown of ['$$\\frac{1}{$$', '$$\\label{x}$$', '$$\\vspace{1cm}$$', '$$\\begin{theorem} x \\end{theorem}$$']) {
    const result = checkMaterialMath(markdown);
    assert.ok(result.errors.length >= 1, `esperava erro em ${markdown}`);
    assert.equal(result.errors[0].severity, 'error');
  }
});

test('avisos strict não bloqueiam (unicode válido e quebra de linha em display)', () => {
  const unicode = checkMaterialMath('$café$ e $x \\ne y$');
  assert.deepEqual(unicode.errors, []);
  assert.ok(unicode.warnings.some((entry) => entry.code === 'unicodeTextInMathMode'));
  const newline = checkMaterialMath('$$a\\\\\\\\b$$');
  assert.deepEqual(newline.errors, []);
  assert.ok(newline.warnings.some((entry) => entry.code === 'newLineInDisplayMode'));
});

test('cifrão monetário não gera erro de matemática', () => {
  const result = checkMaterialMath('O desconto era $5 e o outro $10.');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

/* Residual r6: se a árvore não reconstrói a fonte (caso realmente
   inlocalizável), o diagnóstico avisa mesmo sem título — nada de silêncio. */
test('fallback da proteção de código avisa independente do título', () => {
  const unlocatable = '- item\n\n\t$x+1$ continuação\n- ';
  assert.deepEqual(prepareMaterialMarkdown({title: '', markdown: unlocatable}).diagnostics, [], 'sem título a reescrita nem tenta');
  const withTitle = prepareMaterialMarkdown({title: 'T', markdown: unlocatable});
  assert.ok(withTitle.diagnostics.some((entry) => entry.code === 'heading-rewrite-skipped'));
  for (const markdown of [unlocatable, '- item\n\n\t$x$\n- ']) {
    const guard = checkMaterialMath(markdown).diagnostics.find((entry) => entry.code === 'code-protection-fallback');
    assert.ok(guard, `esperava warning de fallback em ${JSON.stringify(markdown)}`);
    assert.equal(guard.severity, 'warning');
  }
  /* O caso corrigido não cai no fallback nem perde a fórmula. */
  const fixed = checkMaterialMath('- item\n\n\t$x+1$ continuação\n');
  assert.deepEqual(fixed.errors, []);
  assert.equal(fixed.diagnostics.some((entry) => entry.code === 'code-protection-fallback'), false);
  assert.deepEqual(fixed.segments.filter((segment) => segment.type === 'math').map((segment) => segment.tex), ['x+1']);
});

/* ---------- Node puro: revisão ---------- */

test('materialRevision muda com título, conteúdo ou versão do template', () => {
  const base = materialRevision({title: 'A', markdown: 'texto'});
  assert.equal(base, materialRevision({title: 'A', markdown: 'texto'}));
  assert.notEqual(base, materialRevision({title: 'B', markdown: 'texto'}));
  assert.notEqual(base, materialRevision({title: 'A', markdown: 'texto 2'}));
  assert.match(base, new RegExp(`^${MATERIAL_TEMPLATE_VERSION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`));
});

/* ---------- Electron: template real ---------- */

function scenario(name, {timeout = SCENARIO_TIMEOUT} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-material-${name}-`));
  const run = spawnSync(electronPath, [RUNNER, runtime, name], {
    cwd: DESK,
    env: testEnv({DESK_TEST: '1'}),
    encoding: 'utf8',
    timeout,
    /* Electron preso no fechamento ignora SIGTERM, e o spawnSync esperaria. */
    killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const match = /__RESULT__ (\{.*\})\s*$/m.exec(String(run.stdout || ''));
  let data = null;
  let parseError = '';
  if (match) {
    try { data = JSON.parse(match[1]); } catch (error) { parseError = error.message; }
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
  assert.ok(result.data, `${label}: runner de material não devolveu resultado (status ${result.status}, parseError ${result.parseError || 'n/a'}):\n${String(result.output).slice(-4000)}`);
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
  return {numPages: document.numPages, pages, text: pages.join('\n')};
}

test('documento longo: H1 único, ordem, fontes, tabela multipágina e PDF válido', {skip, timeout: SCENARIO_TIMEOUT}, async (t) => {
  const result = scenario('template-long');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'template-long');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.equal(data.windows, 1, 'abriu exatamente a janela de impressão');
  assert.equal(data.templateHash, MATERIAL_TEMPLATE_VERSION);
  const inspected = data.inspected;
  assert.ok(inspected, 'a página foi inspecionada antes do print');
  assert.equal(inspected.h1Count, 1, 'um único H1 (o título do campo)');
  assert.equal(inspected.title, 'Limites e derivadas');
  assert.equal(inspected.placeholderLeak, false, 'nenhum placeholder vazou');
  assert.equal(inspected.overflowNodes, 0);
  assert.match(inspected.bodyFont, /Georgia|serif/i, 'corpo serifado do template');
  assert.match(inspected.katexFont, /KaTeX/i, 'matemática na fonte do KaTeX');
  assert.equal(inspected.fontStatus, 'loaded');
  assert.ok(inspected.katexFaces > 0, 'faces do KaTeX carregadas antes do print');
  assert.ok(inspected.headings[0].startsWith('H1:'), 'a ordem começa no título');
  assert.ok(inspected.headings.some((entry) => entry.startsWith('H3:')));
  /* P1-1/P2-1/P2-3 no documento real: lista, citação, atributos e headings. */
  assert.ok(inspected.listKatex >= 3, 'fórmulas em continuações de lista (inclusive com tab) renderizam');
  assert.ok(inspected.anchors.some((anchor) => anchor.href === '$a$'), 'href guarda o texto matemático, não o HTML do KaTeX');
  assert.ok(inspected.anchors.every((anchor) => !/<|katex/i.test(anchor.href)), 'nenhum href corrompido');
  assert.equal(inspected.anchors.some((anchor) => anchor.html.includes('MATHPLACEHOLDER')), false);
  assert.ok(inspected.divTitles.includes('$b$'), 'title guarda o texto matemático');
  assert.equal(inspected.innerHtmlLeak, false, 'nenhum placeholder sobrou em atributo');
  assert.ok(inspected.headings.some((entry) => entry.startsWith('H2:') && /Citado desce/.test(entry)), 'heading citado desce um nível');
  /* Residual r6: H1 cru do conteúdo desce para H2 mantendo atributos e filhos. */
  assert.ok(inspected.rawTitle, 'o H1 cru foi encontrado no DOM');
  assert.equal(inspected.rawTitle.tag, 'H2', 'H1 cru do conteúdo vira H2 (título único)');
  assert.match(inspected.rawTitle.html, /^<h2[^>]*id="raw-title"/i);
  assert.match(inspected.rawTitle.html, /class="extra"/);
  assert.match(inspected.rawTitle.html, /<em>H1<\/em>/);
  assert.equal(/onclick/i.test(inspected.rawTitle.html), false, 'atributo perigoso do H1 cru continua removido');
  assert.ok(inspected.headings.some((entry) => entry.startsWith('H2:') && /Outro H1/.test(entry)), 'o H1 cru rebaixado aparece como H2');
  assert.ok(Array.isArray(data.diagnostics) && data.diagnostics.some((entry) => entry.code === 'title-deduped'));
  assert.equal((data.diagnostics || []).some((entry) => entry.code === 'code-protection-fallback'), false, 'a árvore reconstrói a fonte; sem fallback heurístico');

  assert.ok(fs.existsSync(data.path));
  assert.equal(fs.readFileSync(data.path).subarray(0, 5).toString('latin1'), '%PDF-');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(data.path)).digest('hex'), data.sha256);
  const pdf = await readPdf(data.path);
  assert.ok(pdf.numPages >= 3, `esperava 3+ páginas, veio ${pdf.numPages}`);
  const titleMatches = pdf.text.match(/Limites e derivadas/g) || [];
  assert.equal(titleMatches.length, 1, 'o título aparece uma vez no texto');
  assert.match(pdf.text, /Objetivo/);
  assert.match(pdf.text, /Tabela longa/);
  assert.match(pdf.text, /Continuação/);
  assert.match(pdf.text, /Fim do documento longo/);
  assert.match(pdf.text, /x\s*\+\s*1/, 'fórmula da continuação do item virou glifos no PDF');
  assert.doesNotMatch(pdf.text, /\$x\+1\$/, 'continuação da lista não saiu como código literal');
  assert.match(pdf.text, /u\s*\+\s*1/, 'fórmula da continuação com tab virou glifos');
  assert.doesNotMatch(pdf.text, /\$u\+1\$/, 'tab no recuo não deixou a fórmula literal');
  assert.match(pdf.text, /v\s*\+\s*1/, 'fórmula da ordenada aninhada com tab virou glifos');
  assert.match(pdf.text, /q\s*\+\s*1/, 'fórmula citada com tab virou glifos');
  assert.match(pdf.text, /z\s*\+\s*1/, 'fórmula em bloco separado não sumiu');
  assert.match(pdf.text, /\$nao_e_math_tab\$/, 'cerca com tab saiu como código literal, não como matemática');
  assert.match(pdf.text, /Outro\s+H1/, 'HTML cru mantém o texto do H1 rebaixado');
  assert.match(pdf.text, /\$nao_e_math\$/, 'código citado saiu como código literal, não como matemática');
  assert.doesNotMatch(pdf.text, /\$\$|\\begin\{/, 'nenhum delimitador LaTeX cru vazou');
  const headerPages = pdf.pages.filter((page) => /Comentário de conferência do resultado/.test(page)).length;
  assert.ok(headerPages >= 2, `cabeçalho da tabela deve repetir na quebra de página (apareceu em ${headerPages})`);
});

test('fórmula larga: ajuste moderado com diagnóstico e sem recorte', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('template-wide');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'template-wide');
  assert.equal(data.ok, true, JSON.stringify(data));
  assert.equal(data.windows, 1);
  const fit = (data.diagnostics || []).filter((entry) => entry.code === 'math-scaled');
  assert.ok(fit.length >= 1, 'todo ajuste de escala vira diagnóstico');
  assert.ok(fit[0].scale < 1 && fit[0].scale > 0.5, `fator moderado (${fit[0].scale})`);
  assert.equal(data.inspected.overflowNodes, 0);
  assert.ok(data.files.length === 1, 'o PDF da fórmula ajustável foi gravado');
});

test('fórmula impossível: bloqueia antes de imprimir, sem arquivo', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('template-overflow');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'template-overflow');
  assert.equal(data.ok, false, JSON.stringify(data));
  assert.equal(data.code, 'OVERFLOW');
  assert.equal(data.windows, 1, 'a medição pós-fontes acontece na página antes de bloquear');
  assert.deepEqual(data.files, [], 'nada é gravado');
  assert.ok(data.diagnostics.some((entry) => entry.code === 'math-wide' && entry.severity === 'error'));
});

test('equação inválida: bloqueia antes de imprimir, sem arquivo', {skip, timeout: SCENARIO_TIMEOUT}, (t) => {
  const result = scenario('template-invalid');
  t.after(() => fs.rmSync(result.runtime, {recursive: true, force: true}));
  const data = expectData(result, 'template-invalid');
  assert.equal(data.ok, false, JSON.stringify(data));
  assert.equal(data.code, 'MATH');
  assert.equal(data.windows, 0, 'nenhuma janela de impressão é aberta para matemática inválida');
  assert.deepEqual(data.files, [], 'nada é gravado');
  assert.ok(data.diagnostics.filter((entry) => entry.severity === 'error').length >= 1);
});
