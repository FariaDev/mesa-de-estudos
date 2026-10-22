// A cerca `plot` (#60): expressão, formato, desenho determinístico e aviso de
// cerca mal formada. Node puro; as funções são inventadas (sem material de curso).
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCurve} from '../src/figures/plot-expr.mjs';
import {PlotError} from '../src/figures/plot-error.mjs';
import {parsePlot, LIMITS} from '../src/figures/plot-spec.mjs';
import {renderPlotSvg} from '../src/figures/plot-render.mjs';
import {autoRange, fmt, niceTicks, tickLabel} from '../src/figures/plot-scale.mjs';
import {plotFigure} from '../src/figures/plot-figure.mjs';

const EXAMPLE = [
  'titulo: Custo de produção (exemplo)',
  'x: -1..5',
  'y: -2..10',
  'eixo-x: unidades',
  'eixo-y: custo',
  'funcao: x^2 - 4x + 3 | rotulo=C(x)',
  'funcao: 2x - 1 | rotulo=reta | tracejado',
  'ponto: 1, 0 | rotulo=raiz',
  'linha: x=2',
].join('\n');

test('expressão: precedência, potência à direita, multiplicação implícita e funções', () => {
  assert.equal(compileCurve('2x^2 - 3')(2), 5);
  assert.equal(compileCurve('2^3^2')(0), 512, 'potência associa à direita');
  assert.equal(compileCurve('-x^2')(3), -9, 'o menos unário vale depois da potência');
  assert.equal(compileCurve('(x+1)(x-1)')(3), 8);
  assert.equal(compileCurve('3sin(pi*x)')(0.5), 3);
  assert.equal(compileCurve('x**2 × 2')(3), 18, 'aceita ** e ×');
  assert.equal(compileCurve('sqrt(x)')(9), 3);
  assert.equal(compileCurve('1/x')(0), Infinity);
});

test('expressão: erro diz o trecho recebido e o que se esperava', () => {
  for (const [source, expected] of [['x +', /acaba cedo/], ['2 $ x', /antes de `\$`/], ['foo(x)', /veio `foo`/], ['sin x', /`sin\(\.\.\.\)`/], ['(x+1', /fechando/], ['', /expressão em `x`/]]) {
    assert.throws(() => compileCurve(source, 4), (error) => error instanceof PlotError && error.detail.line === 4 && error.detail.received === source.trim() && expected.test(error.detail.expected), source);
  }
});

test('expressão não executa código: nome fora da lista não chega a objeto algum', () => {
  for (const source of ['constructor', 'process.exit(1)', 'this', 'globalThis', '__proto__(x)']) {
    assert.throws(() => compileCurve(source), PlotError, source);
  }
});

test('formato: o exemplo completo vira a estrutura esperada', () => {
  const spec = parsePlot(EXAMPLE);
  assert.equal(spec.title, 'Custo de produção (exemplo)');
  assert.deepEqual(spec.x, {min: -1, max: 5});
  assert.deepEqual(spec.y, {min: -2, max: 10});
  assert.equal(spec.functions.length, 2);
  assert.equal(spec.functions[0].curve(2), -1);
  assert.equal(spec.functions[1].dashed, true);
  assert.deepEqual(spec.points, [{x: 1, y: 0, label: 'raiz', color: 0}]);
  assert.deepEqual(spec.lines, [{axis: 'x', at: 2, label: ''}]);
  assert.equal(spec.legend, true, 'duas funções rotuladas ligam a legenda');
  assert.equal(spec.height, 300, 'altura em proporção 8:5 da largura de 480');
});

test('formato: aceita f(x)=…, comentário, ponto entre parênteses e domínio com vírgula', () => {
  const spec = parsePlot('# nota\nx: -3, 3\nf: g(x) = x^3\nponto: (1, 1)');
  assert.deepEqual(spec.x, {min: -3, max: 3});
  assert.equal(spec.functions[0].source, 'x^3');
  assert.deepEqual([spec.points[0].x, spec.points[0].y], [1, 1]);
});

test('formato: cada erro diz a linha, o que veio e o que se esperava', () => {
  const cases = [
    ['x: abc\nfuncao: x', 'domain', 1, 'x: abc', /mín\.\.máx/],
    ['x: 3..-3\nfuncao: x', 'domain', 1, 'x: 3..-3', /mín < máx/],
    ['funcao: x\nespessura: 3', 'unknown-key', 2, 'espessura: 3', /chave: valor/],
    ['funcao: x | cor=9', 'option', 1, 'cor=9', /cor=6/],
    ['funcao: x | grosso', 'option', 1, 'grosso', /rotulo=texto/],
    ['ponto: 1', 'point', 1, 'ponto: 1', /ponto: x, y/],
    ['linha: z=2', 'line', 1, 'linha: z=2', /linha: x=2/],
    ['funcao: x\ngrade: talvez', 'flag', 2, 'grade: talvez', /sim/],
    ['funcao: x\nlargura: 9000', 'size', 2, '9000', /largura: 240\.\.720/],
    ['titulo: só título', 'empty', 0, 'nenhuma funcao, ponto ou linha', /ao menos uma/],
    ['funcao: x +', 'expression', 1, 'x +', /acaba cedo/],
  ];
  for (const [source, code, line, received, expected] of cases) {
    assert.throws(() => parsePlot(source), (error) => error instanceof PlotError && error.code === code && error.detail.line === line
      && error.detail.received === received && expected.test(error.detail.expected), `${code}: ${source}`);
  }
});

test('formato: os limites de quantidade e de tamanho valem', () => {
  const seven = Array.from({length: LIMITS.functions + 1}, (_, index) => `funcao: x + ${index}`).join('\n');
  assert.throws(() => parsePlot(seven), (error) => error.code === 'too-many' && error.detail.line === LIMITS.functions + 1);
  assert.throws(() => parsePlot(`funcao: ${'x+'.repeat(LIMITS.source)}x`), (error) => error.code === 'too-long');
});

test('desenho: determinístico, com as séries, o ponto, a reta e a descrição acessível', () => {
  const first = renderPlotSvg(parsePlot(EXAMPLE));
  const second = renderPlotSvg(parsePlot(EXAMPLE));
  assert.equal(first, second, 'mesma entrada, mesmo SVG');
  assert.match(first, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 480 300"/);
  assert.match(first, /role="img" aria-label="Gráfico: Custo de produção \(exemplo\), x de −1 a 5\. Funções: C\(x\) = x\^2 - 4x \+ 3; reta = 2x - 1\. Pontos: \(1, 0\) raiz\. Retas de referência: x=2\."/);
  assert.equal((first.match(/<path /g) || []).length, 2);
  assert.match(first, /stroke-dasharray="6 4"/, 'a função tracejada');
  assert.match(first, /<circle cx="[\d.]+" cy="[\d.]+" r="4"/);
  assert.match(first, /var\(--plot-1,#2563eb\)/);
  assert.doesNotMatch(first, /<script|<foreignObject|\shref=|<image|<style|javascript:|https?:\/\/(?!www\.w3\.org)/i);
  assert.equal(first.includes('NaN') || first.includes('undefined') || first.includes('Infinity'), false);
});

test('desenho: dois gráficos diferentes não dividem o id do clipPath; o mesmo gráfico sim', () => {
  const id = (svg) => /<clipPath id="(plot-[0-9a-f]+)"/.exec(svg)[1];
  const a = renderPlotSvg(parsePlot('x: -1..1\nfuncao: x^2'));
  const b = renderPlotSvg(parsePlot('x: -1..1\nfuncao: x^3'));
  assert.notEqual(id(a), id(b));
  assert.equal(id(a), id(renderPlotSvg(parsePlot('x: -1..1\nfuncao: x^2'))));
  assert.ok(a.includes(`clip-path="url(#${id(a)})"`));
});

test('desenho: assíntota corta o traço em vez de ligar os dois ramos', () => {
  const svg = renderPlotSvg(parsePlot('x: -2..2\ny: -5..5\nfuncao: 1/x'));
  assert.ok((/<path d="([^"]*)"/.exec(svg)[1].match(/M/g) || []).length >= 2, 'há mais de um segmento M');
});

test('desenho: texto do tutor é escapado (rótulo e título)', () => {
  const svg = renderPlotSvg(parsePlot('titulo: <b>"a" & b</b>\nfuncao: x | rotulo=<img src=x onerror=1>'));
  assert.doesNotMatch(svg, /<b>|<img/);
  assert.match(svg, /&lt;b&gt;&quot;a&quot; &amp; b&lt;\/b&gt;/);
});

test('escala: marcas bonitas, rótulos sem ruído e intervalo automático com assíntota', () => {
  assert.deepEqual(niceTicks(0, 10, 5), {step: 2, ticks: [0, 2, 4, 6, 8, 10]});
  assert.deepEqual(niceTicks(-1, 1, 4).ticks, [-1, -0.5, 0, 0.5, 1]);
  assert.equal(fmt(0.30000000000000004), '0.3');
  assert.equal(fmt(-0.001), '0');
  assert.equal(tickLabel(-1.5, 0.5), '−1.5');
  const base = Array.from({length: 100}, (_, index) => index / 10);
  const range = autoRange([...base, 1e5, -1e5]);
  assert.ok(range.max < 20, `assíntota não achata o resto (max=${range.max})`);
  assert.deepEqual(autoRange([]), {min: -1, max: 1});
  assert.deepEqual(autoRange([2, 2]), {min: 1, max: 3});
});

test('aviso: cerca mal formada vira bloco legível com o que veio e o que se esperava', () => {
  const result = plotFigure('x: abc\nfuncao: x^2', 'pt-BR');
  assert.equal(result.svg, '');
  assert.match(result.html, /^<div class="plot-warning" role="note" data-plot-error="domain">/);
  assert.match(result.html, /Linha 1/);
  assert.match(result.html, /veio: x: abc/);
  assert.match(result.html, /esperado: `x: mín\.\.máx`/);
  assert.equal(result.diagnostic.severity, 'warning');
  assert.equal(result.diagnostic.code, 'plot-domain');
  assert.equal(result.diagnostic.line, 1);
});

test('aviso: o idioma inglês traduz o enquadramento; o texto do tutor entra escapado', () => {
  const result = plotFigure('titulo: <i>x</i>\nx: <script>', 'en');
  assert.match(result.html, /The chart could not be drawn/);
  assert.match(result.html, /got: x: &lt;script&gt;/);
  assert.doesNotMatch(result.html, /<script>/);
});

test('figura boa: bloco com SVG e sem diagnóstico', () => {
  const result = plotFigure(EXAMPLE, 'pt-BR');
  assert.equal(result.diagnostic, null);
  assert.ok(result.html.startsWith('<div class="plot-figure" data-figure="plot"><svg '));
  assert.equal(result.html.includes(result.svg), true);
});
