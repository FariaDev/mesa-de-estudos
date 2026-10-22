import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import overlayCore from '../src/generated/overlay.core.js';

/* A view nativa do GeoGebra fica acima do DOM; a regra que a esconde nas
   sobreposições de página inteira é do núcleo (`core/overlay.bend`, #52) e a
   lista de seletores é uma só em `src/ggb.mjs`. */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(here, relative), 'utf8');

test('viewState: aba inativa fica fora; ativa sem sobreposição aparece; com qualquer uma se cobre', () => {
  assert.equal(overlayCore.viewState(false, 0).$, 'ViewOff');
  assert.equal(overlayCore.viewState(false, 3).$, 'ViewOff');
  assert.equal(overlayCore.viewState(true, 0).$, 'ViewShown');
  for (const count of [1, 2, 5]) assert.equal(overlayCore.viewState(true, count).$, 'ViewCovered', `${count} sobreposições`);
});

test('OVERLAY_SELECTOR cobre diálogo, paleta de comandos e tela cheia do quadro', () => {
  const source = read('../src/ggb.mjs');
  const selector = /export const OVERLAY_SELECTOR='([^']+)'/.exec(source)?.[1];
  assert.ok(selector, 'src/ggb.mjs exporta OVERLAY_SELECTOR; esperado uma string entre aspas simples');
  const parts = selector.split(',');
  assert.deepEqual(parts, ['dialog[open]', '#command-palette:not([hidden])', '.activity-fullscreen']);
});
