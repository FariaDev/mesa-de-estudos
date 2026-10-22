/* Protocolo `mesa-ggb:` e rede fechada do GeoGebra offline (#55). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const protocol = require('../ggb-pack-protocol.cjs');

function setup(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-proto-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const content = path.join(root, 'GeoGebra');
  fs.mkdirSync(path.join(content, 'HTML5/5.0/web3d'), {recursive: true});
  fs.writeFileSync(path.join(content, 'deployggb.js'), '// deploy');
  fs.writeFileSync(path.join(content, 'HTML5/5.0/web3d/fonte espaçada.woff2'), 'fonte');
  fs.writeFileSync(path.join(root, 'pack.json'), '{"segredo":true}');
  const page = path.join(root, 'ggb.html');
  fs.writeFileSync(page, '<html>página</html>');
  return {root, content, page, handler: protocol.createGgbProtocolHandler({contentDir: content, pageFile: page})};
}
const get = (handler, pathname) => handler({url: `mesa-ggb://app${pathname}`});

test('serve o ggb.html e os arquivos do pacote com o tipo certo', async (t) => {
  const {handler} = setup(t);
  const page = await get(handler, '/ggb.html');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.equal(await page.text(), '<html>página</html>');
  const script = await get(handler, '/pack/deployggb.js');
  assert.match(script.headers.get('content-type'), /^text\/javascript/);
  assert.equal(await script.text(), '// deploy');
  const font = await get(handler, '/pack/HTML5/5.0/web3d/fonte%20espa%C3%A7ada.woff2');
  assert.equal(font.headers.get('content-type'), 'font/woff2');
});

test('recusa o que sai da pasta GeoGebra: ../, barra invertida, NUL, pasta e arquivo ausente', async (t) => {
  const {handler} = setup(t);
  for (const bad of ['/pack/../pack.json', '/pack/%2e%2e/pack.json', '/pack/..%2Fpack.json', '/pack/%2E%2E%2Fpack.json', '/pack/..%5Cpack.json', '/pack/deployggb.js%00', '/pack/', '/pack/HTML5', '/pack/nao-existe.js', '/ggb.html/extra', '/outra', '/']) {
    assert.equal((await get(handler, bad)).status, 404, bad);
  }
  assert.equal((await handler({url: 'mesa-ggb://outro/pack/deployggb.js'})).status, 404, 'outro host');
  assert.equal((await handler({url: 'https://app/pack/deployggb.js'})).status, 404, 'outro esquema');
  assert.equal((await handler({url: 'não é url'})).status, 404);
});

test('link simbólico para fora do pacote não é seguido', async (t) => {
  const {root, content, handler} = setup(t);
  try { fs.symlinkSync(path.join(root, 'pack.json'), path.join(content, 'atalho.json')); } catch (error) { t.skip(`sem symlink: ${error.code}`); return; }
  assert.equal((await get(handler, '/pack/atalho.json')).status, 404);
});

test('blockNetwork recusa http, https, ws e ftp e deixa passar o esquema local, data e blob', () => {
  let listener;
  const session = {webRequest: {onBeforeRequest: (fn) => { listener = fn; }}};
  const blocked = [];
  protocol.blockNetwork(session, (url) => blocked.push(url));
  const decide = (url) => { let answer; listener({url}, (result) => { answer = result; }); return answer.cancel; };
  for (const url of ['http://127.0.0.1:1/x', 'https://www.geogebra.org/apps/deployggb.js', 'ws://localhost/', 'wss://x.test/', 'ftp://x.test/']) assert.equal(decide(url), true, url);
  for (const url of ['mesa-ggb://app/pack/deployggb.js', 'data:text/plain,oi', 'blob:mesa-ggb://app/1']) assert.equal(decide(url), false, url);
  assert.equal(decide('isto não é url'), true, 'URL ilegível é recusada');
  assert.equal(blocked.length, 6);
});

test('installOfflineSession registra o protocolo e fecha a rede na mesma sessão', () => {
  const calls = [];
  const session = {protocol: {handle: (scheme, fn) => calls.push(['handle', scheme, typeof fn])}, webRequest: {onBeforeRequest: () => calls.push(['block'])}};
  protocol.installOfflineSession(session, {contentDir: '/x', pageFile: '/y'});
  assert.deepEqual(calls, [['handle', 'mesa-ggb', 'function'], ['block']]);
});
