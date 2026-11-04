import test from 'node:test';
import assert from 'node:assert/strict';
import {countsAsHit} from './leak-probe-server.mjs';

/* O filtro não pode esconder vazamento: tudo o que sai do Chromium da Mesa leva
   "Electron/" no User-Agent; a sonda de portas do vizinho não. */
const req = (url, ua) => ({url, headers: ua === undefined ? {} : {'user-agent': ua}});

test('pedido do Electron conta como vazamento em qualquer caminho, inclusive /', () => {
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0 Electron/45.2.0 Safari/537.36';
  for (const url of ['/', '/fetch', '/beacon', '/new-image.png']) assert.equal(countsAsHit(req(url, ua)), true, url);
});

test('sonda de porta de outro programa não conta; a sanidade do teste conta', () => {
  assert.equal(countsAsHit(req('/', 'node')), false);
  assert.equal(countsAsHit(req('/')), false);
  assert.equal(countsAsHit(req('/sanidade')), true);
});
