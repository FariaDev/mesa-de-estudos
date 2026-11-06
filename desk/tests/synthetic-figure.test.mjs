import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {syntheticFigurePng} from './helpers.mjs';

/* Auditoria de UI/UX, rodada 2 (D10): a figura da resposta precisa de um PNG
   sintético visível (640×360), gerado no próprio teste, sem material real. */
test('figura sintética: PNG 640×360 visível, sem material de curso', () => {
  const png = Buffer.from(syntheticFigurePng(), 'base64');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'assinatura do PNG');
  assert.equal(png.readUInt32BE(16), 640, 'largura no IHDR');
  assert.equal(png.readUInt32BE(20), 360, 'altura no IHDR');
  assert.equal(png[24], 8, 'amostra de 8 bits');
  assert.equal(png[25], 2, 'RGB sem alfa');
  const idat = [];
  let at = 8;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.subarray(at + 4, at + 8).toString('latin1');
    if (type === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  assert.ok(idat.length > 0, 'tem dados de imagem');
  const raw = inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, 360 * (640 * 3 + 1), 'linhas com filtro + RGB');
  const colors = new Set();
  for (let y = 0; y < 360; y++) {
    for (let x = 0; x < 640; x++) {
      const i = y * (640 * 3 + 1) + 1 + x * 3;
      colors.add((raw[i] << 16) | (raw[i + 1] << 8) | raw[i + 2]);
    }
  }
  assert.ok(colors.size >= 4, `papel, grade, eixos e curva (${colors.size} tons)`);
});
