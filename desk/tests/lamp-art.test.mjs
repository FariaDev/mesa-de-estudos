import test from 'node:test';
import assert from 'node:assert/strict';
import {LAMP_ACCENTS, tinyLampSvg} from '../scripts/lamp-art.mjs';

/* #101: só o 16 px sai de um SVG simplificado, sem mesa nem gavetas. Do 32 px
   para cima, a arte é a PNG-mestra redimensionada. */

test('16 px tem cúpula, braço e base grossos, sem a grade', () => {
  for (const accent of Object.keys(LAMP_ACCENTS)) {
    const svg = tinyLampSvg(accent);
    assert.match(svg, /lamp-tiny-shade/, `${accent}: a cúpula`);
    assert.match(svg, /stroke-width="92"/, `${accent}: o braço grosso`);
    assert.match(svg, /rx="38"/, `${accent}: a base`);
    assert.doesNotMatch(svg, /fill-opacity=".12"/, `${accent}: sem grade`);
  }
});

test('acento inválido dá erro com o valor e os esperados', () => {
  assert.throws(() => tinyLampSvg('teal'), /Acento da luminária desconhecido: "teal"; esperado um de blue, violet, green, orange, pink, graphite/);
});
