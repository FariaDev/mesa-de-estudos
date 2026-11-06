import test from 'node:test';
import assert from 'node:assert/strict';
import {svgFence,prefixSvgIds,dropPositionStyle} from '../src/figures/svg-fence.mjs';
import {MAX_SVG_CHARS} from '../src/extensions/mesa-figure/guide.mjs';

/* Sem DOM (Node puro) a cerca falha fechada para código: o caminho real roda
   no Electron e é coberto por `figures-sanitize.test.mjs`, `svg-fence-ui.mjs`
   e `markup-attrs` (cerca com irmão, comentário abrupto, `--!>`, CDATA,
   `foreignObject`, `</svg>` duplo, texto solto, `<svg>` aninhado). Aqui ficam
   só os portões que não precisam de DOM (idioma e tamanho). */
const hasDom = typeof document !== 'undefined';

test('portão de idioma e tamanho vale sem DOM', () => {
  assert.equal(svgFence('', 'svg'), null);
  assert.equal(svgFence('<svg></svg>', 'js'), null);
  assert.equal(svgFence('<svg></svg>', 'md'), null);
  assert.equal(svgFence(`<svg>${'x'.repeat(MAX_SVG_CHARS)}</svg>`, 'svg'), null);
});

test('sem DOM a cerca falha fechada para código', {skip: hasDom}, () => {
  assert.equal(svgFence('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>', 'svg'), null);
  assert.deepEqual(prefixSvgIds('<svg><rect/></svg>'), {svg: '<svg><rect/></svg>', renamed: false});
  assert.equal(dropPositionStyle('<svg><rect style="position:fixed"/>'), '<svg><rect style="position:fixed"/>');
});

test('com DOM: corpo único vira figura, irmão vira código', {skip: !hasDom}, () => {
  const html = svgFence('<svg viewBox="0 0 10 10">\n\n<rect width="10" height="10" fill="var(--plot-1)"/>\n</svg>', 'svg');
  assert.match(html.html, /^<div class="figure" data-figure="svg"><svg/);
  assert.equal(svgFence('<svg></svg><script>x</script>', 'svg'), null);
  assert.equal(svgFence('<svg></svg><svg></svg>', 'svg'), null);
});
