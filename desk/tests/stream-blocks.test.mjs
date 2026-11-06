// Stream incremental do tutor: a divisão pura (sem DOM) e a equivalência do
// HTML vivo em TODOS os prefixos do corpus, numa janela Electron de verdade
// (o DOMPurify e o KaTeX do `markdown.mjs` precisam de DOM). O vivo se compara
// com o vivo de uma vez (a fórmula aberta é linha quieta no vivo e texto cru
// no final — D3 da rodada 5). Também conta o trabalho por repintura numa
// resposta longa.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';
import {STREAM_BLOCKS_FIXTURES} from './stream-blocks-fixtures.mjs';
import {splitStreamBlocks, mathSpans, openMathRange} from '../src/stream-blocks.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(DESK, 'tests', 'free-pdf-runner.cjs');
const SANDBOX_LIMIT = /mach_port_rendezvous|bootstrap_check_in|sandbox_extension_issue_file_to_process|Process failed to launch/i;

function scenario(name) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-stream-blocks-${name}-`));
  const run = spawnSync(electronPath, [RUNNER, runtime, name], {
    cwd: DESK, env: testEnv({DESK_TEST: '1'}), encoding: 'utf8', timeout: 180000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const match = /__RESULT__ (\{.*\})\s*$/m.exec(String(run.stdout || ''));
  return {runtime, output, data: match ? JSON.parse(match[1]) : null};
}

test('o corte fica em linha de topo depois de linha em branco', () => {
  for (const fixture of STREAM_BLOCKS_FIXTURES) {
    const split = splitStreamBlocks(fixture.text);
    if (!split.reusable) continue;
    for (const end of split.safeEnds) {
      assert.ok(end > 0 && end <= fixture.text.length, `${fixture.name}: corte fora do texto: ${end}`);
      assert.equal(fixture.text[end - 1], '\n', `${fixture.name}: o corte ${end} não está depois de uma linha`);
      assert.match(fixture.text.slice(end).split('\n', 1)[0], /^[^ \t]/, `${fixture.name}: o corte ${end} começa indentado`);
    }
    assert.ok(split.safeEnds.includes(split.stableEnd), `${fixture.name}: stableEnd fora de safeEnds`);
  }
});

test('lista que recomeça após linha em branco não é cortada no meio', () => {
  assert.equal(splitStreamBlocks('- a\n\n- b\n').reusable, false);
  assert.equal(splitStreamBlocks('1. a\n\n2. b\n').reusable, false);
  assert.equal(splitStreamBlocks('- a\n   - b\n   - c\n').reusable, false);
  const afterParagraph = splitStreamBlocks('Intro.\n\n- a\n- b\n\nFim.\n');
  assert.equal(afterParagraph.reusable, true);
  assert.equal(afterParagraph.stableEnd, 'Intro.\n\n- a\n- b\n\n'.length);
});

test('HTML cru e definição de referência desligam o corte', () => {
  assert.equal(splitStreamBlocks('a\n\n<div>x</div>\n\nb\n').reason, 'raw-html');
  assert.equal(splitStreamBlocks('a\n\n<details>\n\nx\n\n</details>\n\nb\n').reason, 'raw-html');
  assert.equal(splitStreamBlocks('a\n\n[ref]: https://example.com\n\nb\n').reason, 'reference-definition');
  assert.equal(splitStreamBlocks('a\n\nVeja [x][ref].\n\nb\n').reusable, true, 'uso sem definição não muda o Markdown');
});

test('fórmula aberta desliga o corte; fechada pode ficar no prefixo', () => {
  assert.equal(splitStreamBlocks('a\n\n$$x+y').reason, 'open-math');
  assert.equal(splitStreamBlocks('a\n\n\\[x+y').reason, 'open-math');
  const closed = splitStreamBlocks('a\n\n$$x+y$$\n\nb\n');
  assert.equal(closed.reusable, true);
  assert.deepEqual(closed.safeEnds, [3, 'a\n\n$$x+y$$\n\n'.length]);
});

test('cerca aberta não é cortada por dentro, mas o corte anterior vale', () => {
  const split = splitStreamBlocks('a\n\n```js\nconst x = 1;\n\nconst y = 2;');
  assert.equal(split.reusable, true);
  assert.deepEqual(split.safeEnds, [3], 'o único corte é antes da cerca');
  assert.equal(splitStreamBlocks('```js\nconst x = 1;').reusable, false, 'cerca desde o começo não tem corte');
});

test('CRLF: o corte inclui o \\r\\n e o prefixo estável termina em linha em branco', () => {
  const text = '# Título\r\n\r\nParágrafo $x$.\r\n\r\n- item\r\n- item\r\n\r\nFim.\r\n';
  const split = splitStreamBlocks(text);
  assert.equal(split.reusable, true);
  assert.equal(text[split.stableEnd - 1], '\n');
  assert.ok(text.slice(split.stableEnd).startsWith('Fim.'));
});

test('mathSpans acha os mesmos pares que o markup substitui', () => {
  const text = 'a $$x$$ b \\(y\\) c \\[z\\] d $solto$ e';
  const spans = mathSpans(text);
  assert.deepEqual(spans.map((span) => text.slice(span.start, span.end)), ['$$x$$', '\\(y\\)', '\\[z\\]', '$solto$']);
});

test('openMathRange acha a fórmula aberta e ignora preço (auditoria rodada 5, D3)', () => {
  assert.deepEqual(openMathRange('a $$\\int_0^1'), {start: 2, end: 'a $$\\int_0^1'.length});
  assert.deepEqual(openMathRange('a \\[x+y'), {start: 2, end: 'a \\[x+y'.length});
  assert.deepEqual(openMathRange('a \\(x+y'), {start: 2, end: 'a \\(x+y'.length});
  assert.equal(openMathRange('a $$x$$ b'), null, 'fechada não é aberta');
  assert.equal(openMathRange('custa $5 e $6'), null, 'preço não é fórmula');
  assert.equal(openMathRange('a $5'), null, 'cifrão com dígito não abre');
  const single = openMathRange('a $x+y\n\npróximo\n');
  assert.deepEqual(single, {start: 2, end: 'a $x+y'.length}, 'o $ solto só vale até a quebra: o resto continua texto');
  assert.equal(openMathRange(''), null);
});

const result = scenario('stream-blocks');
const skip = !result.data && SANDBOX_LIMIT.test(result.output)
  ? `Electron não inicia neste ambiente (sandbox): ${result.output.split('\n').map((line) => line.trim()).filter(Boolean)[0] || 'sem saída'}`
  : false;

test('para cada prefixo do corpus, o incremental vivo é igual ao vivo de uma vez', {skip}, () => {
  assert.ok(result.data?.ok, `o cenário stream-blocks não devolveu resultado:\n${result.output.slice(-3000)}`);
  for (const fixture of STREAM_BLOCKS_FIXTURES) {
    const got = result.data.cases[fixture.name];
    assert.ok(got, `${fixture.name}: caso ausente`);
    assert.deepEqual(got.failures, [], `${fixture.name}: o incremental divergiu do desenho completo`);
    assert.equal(got.finalSame, true, `${fixture.name}: o desenho final mudou o que o incremental já tinha`);
    assert.equal(got.unsafe, false, `${fixture.name}: sobrou HTML perigoso no corpo`);
  }
});

test('propriedade: cortes aleatórios semeados continuam iguais no vivo', {skip}, () => {
  assert.ok(result.data?.ok, `o cenário stream-blocks não devolveu resultado:\n${result.output.slice(-3000)}`);
  assert.equal(result.data.random.cuts, 120);
  assert.deepEqual(result.data.random.failures, [], 'o incremental divergiu num corte aleatório');
  assert.deepEqual(result.data.rewrite, {reusable: true, openMath: true}, 'texto vivo que muda no começo não pode reaproveitar o prefixo antigo');
});

test('a resposta longa repara poucos blocos por repintura', {skip}, () => {
  const {stats} = result.data.long;
  assert.ok(stats.paints >= 60, `poucas repinturas medidas: ${stats.paints}`);
  assert.ok(stats.stableExtensions >= 20, `o prefixo estável quase não cresceu: ${stats.stableExtensions}`);
  assert.ok(stats.maxBlocksPerIncrementalPaint <= 3, `uma repintura incremental reparseou ${stats.maxBlocksPerIncrementalPaint} blocos`);
  assert.ok(stats.blocksReparsed < stats.paints * 4, `${stats.blocksReparsed} blocos reparseados em ${stats.paints} repinturas`);
});

test('fórmula cortada no meio vira linha quieta no vivo e crua no final (auditoria rodada 5, D3)', {skip}, () => {
  assert.ok(result.data?.ok, `o cenário stream-blocks não devolveu resultado:\n${result.output.slice(-3000)}`);
  const formulaText = 'Veja:\n\n$$\\int_0^1 x^{2}\\,dx=\\frac{1}{3}$$\n\nPronto.\n';
  const {chunks, closedLive, cutLive, cutFinal, price, singleCut} = result.data.formula;
  assert.ok(chunks.length > 4, `poucos pedaços medidos: ${chunks.length}`);
  for (const chunk of chunks) {
    /* Ímpares: delimitador aberto — linha quieta, sem a fonte crua. */
    const open = (formulaText.slice(0, chunk.at).split('$$').length - 1) % 2 === 1;
    if (open) {
      assert.equal(chunk.pending, true, `em ${chunk.at} a fórmula aberta não virou linha quieta`);
      assert.equal(chunk.raw, false, `em ${chunk.at} a fonte crua ($$) apareceu no stream`);
    } else {
      assert.equal(chunk.pending, false, `em ${chunk.at} a linha quieta sobrou com a fórmula fechada`);
    }
  }
  assert.equal(closedLive.pending, false, 'fechou: sem linha quieta');
  assert.equal(closedLive.katex, true, 'fechou: a fórmula renderizou');
  assert.equal(cutLive.pending, true, 'no corte a fórmula aberta é linha quieta');
  assert.equal(cutLive.raw, false, 'no corte a fonte crua não aparece no vivo');
  assert.equal(cutFinal.raw, true, 'no turno terminado o texto aparece como está');
  assert.equal(cutFinal.kept, true, 'no turno terminado nada se perde');
 assert.equal(price.pending, false, 'preço não vira linha quieta');
 assert.equal(price.same, true, 'preço pinta igual no vivo e no final');
 /* O `same` sozinho passa com o bug (vivo e final erram igual virando
    `$5 e $` em fórmula): o texto esperado tem de estar nos dois. */
 assert.ok(price.text.includes('$5')&&price.text.includes('$6'), `o vivo comeu o preço como fórmula: ${JSON.stringify(price.text)}`);
 assert.ok(price.finalText.includes('$5')&&price.finalText.includes('$6'), `o final comeu o preço como fórmula: ${JSON.stringify(price.finalText)}`);
  assert.equal(singleCut.pending, true, 'o $ com cara de fórmula vira linha quieta');
  assert.equal(singleCut.raw, false, 'o $ aberto não mostra a fonte crua');
});
