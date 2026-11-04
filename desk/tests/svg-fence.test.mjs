import test from 'node:test';
import assert from 'node:assert/strict';
import {svgFence} from '../src/figures/svg-fence.mjs';
import {MAX_SVG_CHARS} from '../src/extensions/mesa-figure/guide.mjs';

test('cerca svg: corpo único vira figura, mesmo com linha em branco', () => {
  const html = svgFence('<svg viewBox="0 0 10 10">\n\n<rect width="10" height="10" fill="var(--plot-1)"/>\n</svg>', 'svg');
  assert.match(html.html, /^<div class="figure" data-figure="svg"><svg/);
  assert.match(html.html, /var\(--plot-1\)/);
});

test('xml/html só aceitam o corpo inteiro como um <svg>', () => {
  assert.ok(svgFence('<svg viewBox="0 0 1 1"></svg>', 'xml'));
  assert.ok(svgFence('<svg viewBox="0 0 1 1"></svg>', 'html'));
  assert.equal(svgFence('<not-svg/>', 'xml'), null);
  assert.equal(svgFence('<svg></svg><script>x</script>', 'svg'), null);
  assert.equal(svgFence('<svg></svg><svg></svg>', 'svg'), null);
});

test('svg inválido, vazio ou acima do limite continua código', () => {
  assert.equal(svgFence('', 'svg'), null);
  assert.equal(svgFence('<rect/>', 'svg'), null);
  assert.equal(svgFence(`<svg>${'x'.repeat(MAX_SVG_CHARS)}</svg>`, 'svg'), null);
  assert.equal(svgFence('<svg></svg>', 'js'), null);
});
