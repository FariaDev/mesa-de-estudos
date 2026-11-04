import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {ALLOWED_PERMISSIONS, guardPermissions, guardPage, isExternalLink} = require('../web-guards.cjs');

/* Sessão falsa com nome: guarda os handlers que `guardPermissions` instala. */
function fakeSession() {
  return {
    requestHandler: null,
    checkHandler: null,
    setPermissionRequestHandler(handler) { this.requestHandler = handler; },
    setPermissionCheckHandler(handler) { this.checkHandler = handler; },
  };
}

/* Conteúdo web falso: a janela nova e a navegação que `guardPage` prende. */
function fakeContents(url) {
  const listeners = new Map();
  return {
    url,
    openHandler: null,
    setWindowOpenHandler(handler) { this.openHandler = handler; },
    on(event, listener) { listeners.set(event, listener); },
    getURL() { return this.url; },
    navigate(target) {
      const event = {defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }};
      listeners.get('will-navigate')(event, target);
      return event;
    },
  };
}

/* O pedido da página chega pelo handler; a resposta sai pelo callback, como no Electron. */
const ask = (ses, permission) => new Promise((resolve) => ses.requestHandler(null, permission, resolve));
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('guardPermissions: só a cópia passa; câmera, microfone, localização e notificação ficam negadas', async () => {
  const ses = fakeSession();
  guardPermissions(ses);
  assert.deepEqual([...ALLOWED_PERMISSIONS], ['clipboard-sanitized-write']);
  for (const permission of ['media', 'geolocation', 'notifications', 'fullscreen', 'midi']) {
    assert.equal(await ask(ses, permission), false, permission);
    assert.equal(ses.checkHandler(null, permission), false, permission);
  }
  assert.equal(await ask(ses, 'clipboard-sanitized-write'), true);
  assert.equal(ses.checkHandler(null, 'clipboard-sanitized-write'), true);
});

test('guardPermissions: lista própria libera só o que foi pedido', async () => {
  const ses = fakeSession();
  guardPermissions(ses, ['fullscreen']);
  assert.equal(await ask(ses, 'fullscreen'), true);
  assert.equal(await ask(ses, 'clipboard-sanitized-write'), false);
});

test('guardPermissions: sessão sem handler de consulta recebe só o de pedido', async () => {
  const ses = {requestHandler: null, setPermissionRequestHandler(handler) { this.requestHandler = handler; }};
  guardPermissions(ses);
  assert.equal(await ask(ses, 'media'), false);
});

test('guardPage: janela nova nunca abre; só https confirmado vai para o navegador do sistema', async () => {
  const opened = [];
  const asked = [];
  const contents = fakeContents('file:///app/ggb.html');
  guardPage(contents, {openExternal: (url) => opened.push(url), confirmLink: async (url) => { asked.push(url); return true; }});
  assert.deepEqual(contents.openHandler({url: 'https://exemplo.org/doc'}), {action: 'deny'});
  assert.deepEqual(contents.openHandler({url: 'http://exemplo.org/doc'}), {action: 'deny'});
  assert.deepEqual(contents.openHandler({url: 'javascript:alert(1)'}), {action: 'deny'});
  await flush();
  assert.deepEqual(asked, ['https://exemplo.org/doc'], 'só o https passa pela confirmação');
  assert.deepEqual(opened, ['https://exemplo.org/doc']);
});

test('guardPage: link https recusado ou sem confirmação não abre (#81)', async () => {
  const opened = [];
  const refused = fakeContents('file:///app/ggb.html');
  guardPage(refused, {openExternal: (url) => opened.push(url), confirmLink: async () => false});
  refused.openHandler({url: 'https://exemplo.org/doc'});
  await flush();
  assert.deepEqual(opened, [], 'o "Cancelar" do diálogo mantém o navegador fechado');
  const silent = fakeContents('file:///app/ggb.html');
  guardPage(silent, {openExternal: (url) => opened.push(url)});
  silent.openHandler({url: 'https://exemplo.org/doc'});
  await flush();
  assert.deepEqual(opened, [], 'sem o diálogo, na dúvida não abre');
});

test('guardPage: a página não navega para outro documento; o próprio, com #trecho, passa', () => {
  /* Compara o documento, não o origin: em file: o origin é null para todo arquivo. */
  const contents = fakeContents('file:///app/ggb.html');
  guardPage(contents);
  assert.equal(contents.navigate('https://evil.example/').defaultPrevented, true);
  assert.equal(contents.navigate('file:///app/outro.html').defaultPrevented, true);
  assert.equal(contents.navigate('file:///app/ggb.html#pagina').defaultPrevented, false);
});

test('guardPage: sem documento carregado, nenhuma navegação da página passa', () => {
  const contents = fakeContents('');
  guardPage(contents);
  assert.equal(contents.navigate('file:///app/ggb.html').defaultPrevented, true);
});

test('isExternalLink: só https; esquema interno, arquivo e texto solto não abrem nada', () => {
  assert.equal(isExternalLink('https://exemplo.org'), true);
  for (const url of ['http://exemplo.org', 'file:///etc/passwd', 'mesa-ggb://x/ggb.html', 'não é url', '']) {
    assert.equal(isExternalLink(url), false, url);
  }
});
