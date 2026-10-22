// Pixels da janela como o usuário vê, com as views nativas por cima (#52).
// `webContents.capturePage` só pinta a página: o GeoGebra é um WebContentsView
// sobre ela e não sai ali. Aqui a janela inteira vem do compositor do macOS
// (`screencapture -l`), então a prova é o que está de fato na tela.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pageWindow} from './helpers.mjs';

/**
 * @typedef {{x:number,y:number}} CssPoint ponto em px CSS da página
 * @typedef {{file:string,scale:number,offsetY:number}} WindowShot
 */

/**
 * Captura a janela da página (com a barra de título e as views filhas).
 * @param {import('playwright').ElectronApplication} app
 * @param {import('playwright').Page} page
 * @param {string} file PNG de saída
 * @returns {Promise<WindowShot>} escala (px da imagem por px CSS) e o recuo da barra de título
 * @example const shot=await captureWindow(app,page,'/tmp/janela.png');
 */
export async function captureWindow(app, page, file) {
  const id = await (await pageWindow(app, page)).evaluate((win) => win.getMediaSourceId());
  const windowId = /^window:(\d+):/.exec(id)?.[1];
  if (!windowId) throw new Error(`id de janela inesperado: ${JSON.stringify(id)}; esperado "window:<número>:<n>"`);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  execFileSync('screencapture', ['-x', '-o', '-l', windowId, file]);
  const inner = await page.evaluate(() => ({w: innerWidth, h: innerHeight}));
  const size = await app.evaluate(({nativeImage}, source) => nativeImage.createFromPath(source).getSize(), file);
  if (!size.width) throw new Error(`captura vazia em ${file}: dê permissão de Gravação de Tela ao terminal que roda o teste`);
  const scale = size.width / inner.w;
  return {file, scale, offsetY: size.height - inner.h * scale};
}

/**
 * Lê pixels RGB de uma captura, em coordenadas CSS da página.
 * @param {import('playwright').ElectronApplication} app
 * @param {WindowShot} shot
 * @param {CssPoint[]} points
 * @returns {Promise<number[][]>} `[r,g,b]` por ponto
 * @example const [rgb]=await pixelsAt(app,shot,[{x:700,y:400}]);
 */
export function pixelsAt(app, shot, points) {
  return app.evaluate(({nativeImage}, {file, scale, offsetY, points: wanted}) => {
    const image = nativeImage.createFromPath(file);
    const {width, height} = image.getSize();
    const bitmap = image.toBitmap();
    return wanted.map(({x, y}) => {
      const px = Math.min(width - 1, Math.max(0, Math.round(x * scale)));
      const py = Math.min(height - 1, Math.max(0, Math.round(y * scale + offsetY)));
      const at = (py * width + px) * 4;
      return [bitmap[at + 2], bitmap[at + 1], bitmap[at]];
    });
  }, {...shot, points});
}

/** Distância máxima entre dois RGB, canal a canal. */
export const rgbDistance = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));

