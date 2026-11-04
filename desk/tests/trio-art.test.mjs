import test from 'node:test';
import assert from 'node:assert/strict';
import {trioSvg, TRIO} from '../src/trio-art.mjs';

/* #64: o trio ∫ Σ ∇ entrega ao componente (src/mascote.mjs) os mesmos grupos
   que ele move, e um grupo por pose/rosto que o trio.css liga por humor. */

const ids = /** @type {Array<'integral'|'sigma'|'nabla'>} */ (Object.keys(TRIO));

test('os três existem e entregam os grupos que o componente move', () => {
  assert.deepEqual(ids, ['integral', 'sigma', 'nabla']);
  for (const id of ids) {
    const svg = trioSvg(id, 't1');
    for (const part of ['mascote-tilt', 'mascote-jump', 'mascote-look', 'mascote-sparks']) assert.match(svg, new RegExp(`class="${part}"`), `${id}: ${part}`);
  }
});

test('cada humor tem o seu grupo: poses, olhos, bocas e sinais', () => {
  const groups = ['tr-pose-descanso', 'tr-pose-pensando', 'tr-pose-dica', 'tr-pose-festa', 'tr-pose-escrevendo', 'tr-eyes-happy', 'tr-eyes-closed', 'tr-lid', 'tr-scan', 'tr-question', 'tr-check', 'tr-bang', 'tr-z', 'tr-mouth-o', 'tr-mouth-worried'];
  for (const id of ids) for (const g of groups) assert.ok(trioSvg(id, 't2').includes(g), `${id}: ${g}`);
  assert.ok(trioSvg('integral', 't3').includes('tr-book'), 'a ∫ lê com o livrinho');
  assert.ok(!trioSvg('sigma', 't4').includes('tr-book'));
});

test('sem SMIL, filtro do pincel com id próprio e personagem desconhecida recusada', () => {
  const svg = trioSvg('nabla', 'abc');
  assert.doesNotMatch(svg, /<animate|<set\b/, 'o movimento é CSS (#63)');
  assert.match(svg, /<filter id="abcp"/);
  assert.match(svg, /filter="url\(#abcp\)"/);
  assert.throws(() => trioSvg(/** @type {any} */ ('folhinha'), 'x'), /desconhecido: "folhinha"; esperado "integral", "sigma" ou "nabla"/);
});

test('a marca pequena sai sem o pincel e o desenho grande mantém o filtro', () => {
  const nitida = trioSvg('integral', 'n1', {pincel: false});
  assert.doesNotMatch(nitida, /<filter\b|filter="url\(/, 'a 20 px o filtro vira deslocamento subpixel e embaça (nitidez do "pensando")');
  assert.match(nitida, /class="mascote-tilt"/, 'sem o pincel, o desenho e os grupos de movimento continuam');
  assert.match(trioSvg('integral', 'n2'), /filter="url\(#n2p\)"/, 'a mascote grande mantém o pincel');
});

test('o rabisco do lápis gira com a ponta como pivô', () => {
  const origin = trioSvg('sigma', 'p1').match(/class="tr-pencil" style="transform-origin:([\d.]+)px ([\d.]+)px"/);
  assert.ok(origin, 'o lápis tem pivô');
  const tip = trioSvg('sigma', 'p1').match(/class="tr-pencil"[^>]*>.*?<path d="M[\d. ]+L[\d. ]+"[^>]*\/>.*?<path d="M[\d.]+ [\d.]+L([\d.]+) ([\d.]+)"/);
  assert.ok(tip, 'o grafite é o segundo traço');
  assert.deepEqual([origin[1], origin[2]], [tip[1], tip[2]], 'pivô na ponta do grafite');
});

/* O "?" do "pensando" encostava no olho e no gancho da ∫: a 20 px o roxo do
   sinal e o da cabeça viravam uma mancha só (2026-10-30). Os pontos do "?"
   (o arco, a haste e o pingo, como em `sinais`) têm de ficar com folga da
   borda do olho direito, descontada a meia espessura dos traços. */
test('o "?" da ∫ fica afastado do olho direito', () => {
  const [x, y] = TRIO.integral.sinal;
  const [ex, ey, r] = TRIO.integral.olhos[1];
  const pontos = [[x - 16, y + 8, 4], [x, y - 8, 4], [x + 16, y + 8, 4], [x + 2, y + 22, 4], [x + 2, y + 30, 4], [x + 2, y + 43, 5.5]];
  const folga = Math.min(...pontos.map(([px, py, w]) => Math.hypot(px - ex, py - ey) - r - 1.75 - w));
  assert.ok(folga >= 8, `folga do "?" ao olho: ${folga.toFixed(1)}`);
  assert.ok(y - 8 - 4 >= -10 && x + 16 + 4 <= 240, 'o "?" cabe no viewBox');
});

/* #100: o desenho não guarda mais cor fixa de corpo; cada parte leva uma
   classe e o trio.css pinta pelo acento (style.css). A tinta, o membro e o
   sinal também vêm das variáveis, e o CSS vence o atributo do SVG. */
test('o desenho não tem cor fixa de corpo; as cores vêm do acento', async () => {
  const {readFileSync} = await import('node:fs');
  for (const id of ids) {
    const svg = trioSvg(id, 'c1');
    assert.doesNotMatch(svg, /#6d4fd8|#8b74ec|#5a3fc4|#3f2a9e|#1a1033/i, `${id}: cor de corpo fixa`);
    for (const part of ['tr-body', 'tr-limb', 'tr-ink', 'tr-sign']) assert.match(svg, new RegExp(part), `${id}: ${part}`);
  }
  const css = readFileSync(new URL('../src/trio.css', import.meta.url), 'utf8');
  assert.match(css, /\.mascote \.tr-body-stroke\{stroke:var\(--trio-corpo\)\}/);
  assert.match(css, /\.mascote \.tr-limb\{stroke:var\(--trio-membro\)\}/);
  assert.match(css, /\.mascote \.tr-ink\{stroke:var\(--trio-tinta\)\}/);
  assert.match(css, /\.mascote \.tr-sign-stroke\{stroke:var\(--trio-sinal\)\}/);
  assert.doesNotMatch(css, /--trio-sinal:light-dark/, 'os tons do sinal moram no style.css');
  const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(style, /--trio-violet-corpo:light-dark\(#6d4fd8,#[0-9a-f]{6}\)/);
});
