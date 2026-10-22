import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/generated/activityview.core.js';

/* Núcleo do quadro de visualizações e atividades (#42, parte B). As leis do
   Bend fixam os cenários; aqui fica o que só se mede com conta de cor: a
   paleta categórica lê sobre o fundo (contraste ≥ 3:1, o mínimo de objeto
   gráfico) e as vizinhas se separam em luminosidade (ΔL* ≥ 10), nos dois temas
   e nos seis acentos — vale também para a impressão em cinza. */

const list = (l) => {const out = []; for (let c = l; c && c.$ === 'Con'; c = c.tail) out.push(c.head); return out;};
const tokens = (theme, accent) => Object.fromEntries(list(core.themeTokens(theme, accent)).map((t) => [t.name, t.value]));
const lin = (v) => {v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;};
const luminance = (hex) => {const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b;};
const lightness = (hex) => {const y = luminance(hex); return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : y * 24389 / 27;};
const contrast = (a, b) => {const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);};
const ACCENTS = list(core.accentIds());

test('paleta: seis cores, legíveis sobre o fundo e separadas em luminosidade', () => {
  assert.deepEqual(ACCENTS, ['blue', 'violet', 'green', 'orange', 'pink', 'graphite']);
  for (const theme of ['light', 'dark']) {
    for (const accent of ACCENTS) {
      const t = tokens(theme, accent);
      const colors = [1, 2, 3, 4, 5, 6].map((i) => t[`--mesa-chart-${i}`]);
      const tag = `${theme}/${accent}`;
      assert.equal(new Set(colors).size, 6, `${tag}: seis cores distintas (${colors})`);
      assert.equal(colors[0], t['--mesa-accent-text'], `${tag}: a primeira é o acento`);
      for (const color of colors) assert.ok(contrast(color, t['--mesa-bg']) >= 3, `${tag}: ${color} contra ${t['--mesa-bg']} = ${contrast(color, t['--mesa-bg']).toFixed(2)}`);
      for (let i = 1; i < colors.length; i++) {
        const gap = Math.abs(lightness(colors[i]) - lightness(colors[i - 1]));
        assert.ok(gap >= 10, `${tag}: chart-${i} × chart-${i + 1} com ΔL* ${gap.toFixed(1)}`);
      }
    }
  }
});

test('tokens: os nomes do T3 adaptados à Mesa e o espelho MCP Apps', () => {
  const t = tokens('dark', 'blue');
  for (const name of ['--mesa-bg', '--mesa-fg', '--mesa-muted', '--mesa-card', '--mesa-border', '--mesa-input', '--mesa-ring',
    '--mesa-accent', '--mesa-accent-fg', '--mesa-good', '--mesa-good-surface', '--mesa-warn', '--mesa-warn-surface', '--mesa-bad',
    '--mesa-bad-surface', '--mesa-code-bg', '--mesa-code-fg', '--mesa-radius', '--mesa-font-sans', '--mesa-font-serif', '--mesa-font-mono',
    '--mesa-surface', '--mesa-hover',
    '--color-background-primary', '--color-text-primary', '--color-border-primary', '--color-ring-primary', '--font-sans', '--font-mono', '--border-radius-md']) {
    assert.ok(t[name], `${name} presente`);
  }
  assert.equal(t['--color-background-primary'], t['--mesa-bg']);
  assert.equal(t['--color-text-secondary'], t['--mesa-muted']);
  assert.match(t['--mesa-font-serif'], /STIX Two Text/, 'a serifa é a dos PDFs do tutor (#39)');
  for (const theme of ['light', 'dark']) for (const accent of ACCENTS) {
    const x = tokens(theme, accent);
    assert.ok(contrast(x['--mesa-fg'], x['--mesa-bg']) >= 7, `${theme}/${accent}: texto legível`);
    assert.ok(contrast(x['--mesa-accent-fg'], x['--mesa-accent']) >= 4.5, `${theme}/${accent}: texto sobre o acento`);
  }
});

test('rootCss: regra :root pronta, com esquema de cor e sem caractere que quebre a folha', () => {
  const css = core.rootCss('light', 'green');
  assert.match(css, /^:root\{color-scheme:light;--mesa-bg:#f4f4f4;/);
  assert.ok(css.endsWith('}'));
  assert.equal(/[<>{]/.test(css.slice(6, -1)), false);
});

test('altura inicial pelos pares medidos', () => {
  const pairs = (xs) => xs.reduceRight((tail, [width, height]) => ({$: 'Con', head: {$: 'HeightPair', width, height}, tail}), {$: 'Nil'});
  const measured = pairs([[320, 610], [375, 540], [430, 500], [520, 460], [640, 420]]);
  assert.equal(core.initialHeight(measured, 400), 540, 'entre 375 e 430: a mais alta das vizinhas');
  assert.equal(core.initialHeight(measured, 430), 500);
  assert.equal(core.initialHeight(measured, 900), 420);
  assert.equal(core.initialHeight({$: 'Nil'}, 400), 0);
  assert.deepEqual(list(core.measureWidths()).map(Number), [320, 375, 430, 520, 640, 728, 860, 1000, 1144]);
});
