/* O render de verdade (#114): uma janela escondida do Electron desenha um PDF
   sintético de quadrantes coloridos e o teste compara PIXELS do PNG — giro,
   recorte e ampliação. Sem DISPLAY no Linux o teste é pulado; no macOS a
   janela escondida não precisa dele. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {noisePdf, quadrantsPdf} from './synthetic-pdf.mjs';
import {decodePng, pixelAtFraction} from './png-pixels.mjs';

const DESK = path.resolve(import.meta.dirname, '..');
const MAX_IMAGE_CHARS = 1800000;
const NO_DISPLAY = process.platform === 'linux' && !process.env.DISPLAY;
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const YELLOW = [255, 255, 0];

function colorText([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}

function assertColor(png, fx, fy, expected, label) {
  const pixel = pixelAtFraction(png, fx, fy);
  const distance = Math.abs(pixel.r - expected[0]) + Math.abs(pixel.g - expected[1]) + Math.abs(pixel.b - expected[2]);
  assert.ok(distance <= 24, `${label}: esperado ${colorText(expected)} em (${fx}, ${fy}); veio rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`);
}

async function launchRenderWindow() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-view-render-'));
  const main = path.join(dir, 'main.cjs');
  fs.writeFileSync(main, [
    "const {app, BrowserWindow} = require('electron');",
    "app.setPath('userData', process.env.PDF_RENDER_USER_DATA);",
    'app.whenReady().then(async () => {',
    "  const win = new BrowserWindow({show: false, width: 900, height: 1200, webPreferences: {contextIsolation: true, nodeIntegration: false, sandbox: true}});",
    "  await win.loadFile(process.env.PDF_RENDER_HTML);",
    '});',
    "app.on('window-all-closed', () => app.quit());",
  ].join('\n'));
  const userData = path.join(dir, 'user-data');
  const app = await electron.launch({
    args: [main],
    cwd: DESK,
    env: {...process.env, PDF_RENDER_HTML: path.join(DESK, 'pdf-render.html'), PDF_RENDER_USER_DATA: userData, XDG_CONFIG_HOME: userData, HOME: dir},
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => typeof window.mesaRenderPdfPage === 'function', undefined, {timeout: 30000});
  return {
    async render(pdf, options = {}) {
      await page.evaluate((base64) => {
        window.mesaPdf = {read: async () => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))};
      }, pdf.toString('base64'));
      return page.evaluate((view) => window.mesaRenderPdfPage('/sintetico.pdf', 1, view), options);
    },
    async close() {
      await app.close().catch(() => {});
      fs.rmSync(dir, {recursive: true, force: true});
    },
  };
}

test('giro, recorte e ampliação mudam os pixels e o teto reduz a imagem', {skip: NO_DISPLAY ? 'sem DISPLAY para a janela escondida do Electron' : false, timeout: 180000}, async () => {
  const window = await launchRenderWindow();
  try {
    const quadrants = quadrantsPdf(400);

    const original = decodePng(await window.render(quadrants));
    assert.equal(original.width, 1200, 'a página quadrada sai com 1200 px');
    assert.equal(original.height, 1200);
    assertColor(original, 0.25, 0.25, RED, 'sem giro, canto superior esquerdo');
    assertColor(original, 0.75, 0.25, GREEN, 'sem giro, canto superior direito');
    assertColor(original, 0.25, 0.75, BLUE, 'sem giro, canto inferior esquerdo');
    assertColor(original, 0.75, 0.75, YELLOW, 'sem giro, canto inferior direito');

    const rotations = [
      [90, {tl: BLUE, tr: RED, bl: YELLOW, br: GREEN}],
      [180, {tl: YELLOW, tr: BLUE, bl: GREEN, br: RED}],
      [270, {tl: GREEN, tr: YELLOW, bl: RED, br: BLUE}],
    ];
    for (const [girar, corners] of rotations) {
      const png = decodePng(await window.render(quadrants, {girar}));
      assert.equal(png.width, 1200, `girar ${girar} mantém a largura`);
      assert.equal(png.height, 1200, `girar ${girar} mantém a altura`);
      assertColor(png, 0.25, 0.25, corners.tl, `girar ${girar}, canto superior esquerdo`);
      assertColor(png, 0.75, 0.25, corners.tr, `girar ${girar}, canto superior direito`);
      assertColor(png, 0.25, 0.75, corners.bl, `girar ${girar}, canto inferior esquerdo`);
      assertColor(png, 0.75, 0.75, corners.br, `girar ${girar}, canto inferior direito`);
    }

    const topRight = decodePng(await window.render(quadrants, {recorte: {x: 0.5, y: 0, largura: 0.5, altura: 0.5}}));
    assert.equal(topRight.width, 600, 'o recorte de metade da página sai com metade dos pixels');
    assert.equal(topRight.height, 600);
    assertColor(topRight, 0.25, 0.25, GREEN, 'recorte, quadrante superior esquerdo');
    assertColor(topRight, 0.75, 0.25, GREEN, 'recorte, quadrante superior direito');
    assertColor(topRight, 0.25, 0.75, GREEN, 'recorte, quadrante inferior esquerdo');
    assertColor(topRight, 0.75, 0.75, GREEN, 'recorte, quadrante inferior direito');

    const strip = decodePng(await window.render(quadrants, {recorte: {x: 0, y: 0, largura: 0.5, altura: 0.25}}));
    assert.equal(strip.width, 600);
    assert.equal(strip.height, 300);
    assert.equal(strip.width / strip.height, 2, 'o recorte mantém a proporção pedida');
    assertColor(strip, 0.5, 0.5, RED, 'tira do topo esquerdo');

    const rotatedCrop = decodePng(await window.render(quadrants, {girar: 90, recorte: {x: 0.5, y: 0, largura: 0.5, altura: 0.5}}));
    assert.equal(rotatedCrop.width, 600);
    assert.equal(rotatedCrop.height, 600);
    assertColor(rotatedCrop, 0.5, 0.5, RED, 'recorte acontece depois do giro');

    const amplified = decodePng(await window.render(quadrants, {ampliar: 2}));
    assert.equal(amplified.width, 2400, 'ampliar 2 dobra a resolução');
    assert.equal(amplified.height, 2400);
    assertColor(amplified, 0.25, 0.25, RED, 'ampliada, canto superior esquerdo');

    const noisy = await window.render(noisePdf({width: 600, height: 600}), {ampliar: 3});
    assert.ok(noisy.length <= MAX_IMAGE_CHARS, `o PNG reduzido tem ${noisy.length} caracteres; o teto é ${MAX_IMAGE_CHARS}`);
    const capped = decodePng(noisy);
    assert.ok(capped.width < 3600 && capped.height < 3600, `a imagem foi reduzida para ${capped.width}×${capped.height}`);
    assert.ok(capped.width > 0 && capped.height > 0, 'a imagem reduzida continua válida');
  } finally {
    await window.close();
  }
});
