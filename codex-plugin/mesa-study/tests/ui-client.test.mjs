/* Testes do painel MCP Apps `ui/desk.html` com a ponte hospedeira SIMULADA.
 *
 * O que estes testes são: o script inline do painel rodando de verdade num
 * `node:vm`, com um DOM mínimo e uma ponte `postMessage` de mentira que fala o
 * protocolo MCP Apps (ui/initialize, ui/notifications/tool-result, tools/call,
 * ui/message, ui/update-model-context, ui/resource-teardown). Cobrem handshake,
 * render, navegação, corridas, cancelamento, teardown, timeout, validação de
 * PNG e segurança de texto.
 *
 * O que estes testes NÃO são: validação do Codex real. Nada aqui abre o app,
 * rede, modelo, Xournal++ ou material de curso; a captura é só um JSON
 * devolvido pela ponte simulada. A exibição do painel dentro do Codex continua
 * pendente de teste manual (ver README.md e tests/manual-study.md).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildDeskHtml, DESK_MIME, DESK_URI} from '../ui/desk-html.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESK = path.join(ROOT, 'ui', 'desk.html');
const HTML = fs.readFileSync(DESK, 'utf8');
const SCRIPT = (() => {
  const match = HTML.match(/<script data-mesa-desk>([\s\S]*?)<\/script>/);
  assert.ok(match, 'ui/desk.html precisa do script inline data-mesa-desk');
  return match[1];
})();

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ---------- DOM mínimo ---------- */

class ClassList {
  constructor() { this._set = new Set(); }
  add(...names) { for (const name of names) this._set.add(name); }
  remove(...names) { for (const name of names) this._set.delete(name); }
  contains(name) { return this._set.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this._set.has(name) : Boolean(force);
    if (on) this._set.add(name); else this._set.delete(name);
    return on;
  }
}

class FakeElement extends EventTarget {
  constructor(tagName) {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.classList = new ClassList();
    this.style = {};
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.title = '';
    this.innerHTMLTouched = false;
    this._innerHTML = '';
  }
  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null; }
  removeAttribute(name) { this.attributes.delete(String(name)); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...nodes) { this.children = nodes.slice(); }
  focus() {}
  set innerHTML(value) { this.innerHTMLTouched = true; this._innerHTML = String(value); }
  get innerHTML() { return this._innerHTML; }
}

function makeHarness({standalone = false, resizeObserver = null} = {}) {
  const elements = new Map();
  const created = [];
  const doc = {
    documentElement: new FakeElement('html'),
    getElementById(id) { return elements.get(id) || null; },
    createElement(tagName) { const element = new FakeElement(tagName); created.push(element); return element; },
  };
  const idRe = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  let match;
  while ((match = idRe.exec(HTML))) {
    const attrs = match[2] || '';
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (elements.has(id)) continue;
    const element = new FakeElement(match[1]);
    if (/\bhidden\b/.test(attrs)) element.hidden = true;
    if (/\bdisabled\b/.test(attrs)) element.disabled = true;
    elements.set(id, element);
  }

  const outbox = [];
  const host = {
    postMessage(message, targetOrigin) {
      outbox.push({message: structuredClone(message), targetOrigin});
    },
  };
  const fakeWindow = new EventTarget();
  fakeWindow.parent = standalone ? fakeWindow : host;
  fakeWindow.document = doc;
  fakeWindow.atob = (value) => Buffer.from(String(value), 'base64').toString('latin1');

  const timers = new Map();
  let timerSeq = 0;
  let clock = 0;
  function fakeSetTimeout(callback, delay) {
    if (typeof callback !== 'function') return 0;
    const id = (timerSeq += 1);
    timers.set(id, {callback, at: clock + (Number(delay) || 0)});
    return id;
  }
  function fakeClearTimeout(id) { timers.delete(id); }
  function advance(ms) {
    clock += Number(ms) || 0;
    let fired = true;
    while (fired) {
      fired = false;
      for (const [id, timer] of [...timers.entries()]) {
        if (timer.at <= clock) {
          timers.delete(id);
          fired = true;
          timer.callback();
        }
      }
    }
  }

  const consoleCalls = [];
  const fakeConsole = {
    log(...args) { consoleCalls.push({method: 'log', args}); },
    info(...args) { consoleCalls.push({method: 'info', args}); },
    warn(...args) { consoleCalls.push({method: 'warn', args}); },
    error(...args) { consoleCalls.push({method: 'error', args}); },
  };
  const context = vm.createContext({
    window: fakeWindow,
    document: doc,
    console: fakeConsole,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
  });

  /* ResizeObserver sintético: os testes disparam `fire()` na mão. Sem a opção,
     o contexto NÃO tem ResizeObserver (o painel precisa tolerar isso). */
  let sizeObserver = resizeObserver;
  const observerInstances = [];
  if (resizeObserver) {
    sizeObserver = resizeObserver === true ? 'auto' : resizeObserver;
  }
  if (sizeObserver) {
    context.ResizeObserver = class FakeResizeObserver {
      constructor(callback) { this._callback = callback; observerInstances.push(this); }
      observe(target) { this._target = target; }
      unobserve() {}
      disconnect() { this._disconnected = true; }
      fire() { if (!this._disconnected) this._callback([], this); }
    };
  }

  function dispatch(message, source) {
    const event = Object.assign(new Event('message'), {
      data: structuredClone(message),
      source: source === undefined ? fakeWindow.parent : source,
    });
    fakeWindow.dispatchEvent(event);
  }

  const api = {
    run() { vm.runInContext(SCRIPT, context, {filename: 'ui/desk.html#data-mesa-desk'}); },
    el(id) { return elements.get(id) || null; },
    allElements() { return [...elements.values(), doc.documentElement, ...created]; },
    posted() { return outbox.map((entry) => entry.message); },
    requests(method) { return api.posted().filter((message) => message && message.method === method); },
    lastRequest(method) {
      const list = api.requests(method);
      return list.length > 0 ? list[list.length - 1] : null;
    },
    toolCalls(name) {
      return api.posted().filter((message) => message && message.method === 'tools/call' && message.params && message.params.name === name);
    },
    lastToolCall(name) {
      const list = api.toolCalls(name);
      return list.length > 0 ? list[list.length - 1] : null;
    },
    respond(id, result) { dispatch({jsonrpc: '2.0', id, result}); },
    respondError(id, error) { dispatch({jsonrpc: '2.0', id, error}); },
    notify(method, params) { dispatch({jsonrpc: '2.0', method, params}); },
    hostRequest(method, params, id) { dispatch({jsonrpc: '2.0', id, method, params}); },
    dispatch,
    click(id) {
      const element = api.el(id);
      assert.ok(element, `elemento ${id} existe`);
      element.dispatchEvent(new Event('click'));
    },
    select(id, value) {
      const element = api.el(id);
      assert.ok(element, `select ${id} existe`);
      element.value = value;
      element.dispatchEvent(new Event('change'));
    },
    /* keydown sintético: cancelável (como no navegador) e com `target`
       substituível para simular a tecla dentro de um campo. */
    keydown(props = {}, target) {
      const event = new Event('keydown', {cancelable: true});
      const values = Object.assign({
        key: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false,
      }, props);
      const fakeTarget = values.target;
      delete values.target;
      Object.assign(event, values);
      if (fakeTarget !== undefined) Object.defineProperty(event, 'target', {value: fakeTarget, configurable: true});
      (target || fakeWindow).dispatchEvent(event);
      return event;
    },
    advance,
    observers() { return observerInstances.slice(); },
    consoleCalls() { return consoleCalls.map((call) => ({method: call.method, args: call.args.slice()})); },
    fireResize() { for (const observer of observerInstances) observer.fire(); },
    setSize({scrollHeight = 0, clientWidth = 0} = {}) {
      const root = doc.documentElement;
      root.scrollHeight = scrollHeight;
      root.clientWidth = clientWidth;
    },
    window: fakeWindow,
    doc,
  };
  return api;
}

function tick() { return new Promise((resolve) => setTimeout(resolve, 0)); }

/* ---------- fixtures sintéticas ---------- */

function pngFixture(size = 96) {
  const raw = Buffer.alloc(size, 0x41);
  PNG_MAGIC.copy(raw, 0);
  return {raw, data: raw.toString('base64'), bytes: raw.length};
}

function imageOf(fixture) {
  return {type: 'image', mimeType: 'image/png', data: fixture.data};
}

function statusFixture({maxImageBytes = 8 * 1024 * 1024, ready = {pdf: true, windows: true, capture: true}} = {}) {
  return {
    ok: true,
    kind: 'status',
    server: {name: 'mesa-study', version: '0.2.0-experimental', transport: 'stdio', snapshot: 'host-simulado'},
    setup: {frozenAtStartup: true, roots: {configured: true, source: 'flag', count: 1, paths: ['/raiz'], available: true, checks: {valid: 1, missing: 0, changed: 0, notDirectory: 0}}},
    ready,
    limits: {maxImageBytes, maxPdfBytes: 64 * 1024 * 1024, maxPage: 20000, maxRoots: 64},
    guidance: [],
  };
}

function pageStructured({filePath = '/raiz/exercicio.pdf', name = 'exercicio.pdf', page = 1, numPages = 3, imageBytes} = {}) {
  const image = {mimeType: 'image/png', width: 600, height: 800, sha256: 'a'.repeat(64), renderDpi: 144, snapshotPath: '/cache/pagina.png'};
  if (Number.isInteger(imageBytes)) image.bytes = imageBytes;
  return {
    ok: true,
    kind: 'page',
    source: {type: 'pdf', document: {name, path: filePath}, page, numPages},
    image,
    preview: {vectorSvgInResponse: false, warning: null},
    context: {updated: true, scope: 'process'},
    provenance: 'página sintética de teste',
  };
}

function libraryStructured({files = [], truncated = false} = {}) {
  return {ok: true, kind: 'library', files, truncated};
}

function deskStructured({page = null, library = {files: [{filePath: '/raiz/exercicio.pdf', name: 'exercicio.pdf'}, {filePath: '/raiz/formulario.pdf', name: 'formulario.pdf'}], truncated: false}, status = statusFixture()} = {}) {
  return {ok: true, kind: 'desk', status, library, page};
}

function captureStructured({fixture, windowId = '12', title = 'Resolução'} = {}) {
  return {
    ok: true,
    kind: 'capture',
    source: {type: 'xournal-window', window: {id: String(windowId), app: 'Xournal++', title}, capturedAt: '2026-10-06T10:00:00.000Z'},
    image: {mimeType: 'image/png', bytes: fixture.bytes, width: 800, height: 600, sha256: 'b'.repeat(64), snapshotPath: '/cache/captura.png'},
    context: {updated: true, scope: 'process'},
    provenance: 'captura sintética de teste',
  };
}

const DEFAULT_CAPS = Object.freeze({
  serverTools: {},
  message: {text: {}},
  updateModelContext: {structuredContent: {}},
});

function initResult({caps = DEFAULT_CAPS, context} = {}) {  return {
    protocolVersion: '2026-01-26',
    hostInfo: {name: 'host-simulado', version: '0.0.0'},
    hostCapabilities: caps,
    hostContext: context || {theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen']},
  };
}

async function boot({caps, context, resizeObserver, initialSizeDelay} = {}) {
  const h = makeHarness({resizeObserver});
  h.run();
  const initialize = h.lastRequest('ui/initialize');
  assert.ok(initialize, 'ui/initialize enviado ao montar o painel');
  h.respond(initialize.id, initResult({caps, context}));
  await tick();
  if (initialSizeDelay) h.advance(initialSizeDelay);
  await tick();
  return h;
}

async function bootDesk({desk, content, caps, context, resizeObserver} = {}) {
  const h = await boot({caps, context, resizeObserver});
  h.notify('ui/notifications/tool-input', {arguments: {}});
  h.notify('ui/notifications/tool-result', {
    content: content || [{type: 'text', text: 'meta'}],
    structuredContent: desk,
  });
  await tick();
  return h;
}

async function bootWithPage({page = 2, numPages = 5, filePath = '/raiz/exercicio.pdf', name = 'exercicio.pdf', caps, context} = {}) {
  const fixture = pngFixture();
  const h = await bootDesk({
    caps,
    context,
    desk: deskStructured({page: pageStructured({filePath, name, page, numPages, imageBytes: fixture.bytes})}),
    content: [imageOf(fixture), {type: 'text', text: 'meta'}],
  });
  return {h, fixture};
}

function pageResponse({page, numPages = 5, filePath = '/raiz/exercicio.pdf', name = 'exercicio.pdf', fixture}) {
  return {
    content: [imageOf(fixture), {type: 'text', text: 'meta'}],
    structuredContent: pageStructured({filePath, name, page, numPages, imageBytes: fixture.bytes}),
  };
}

function assertNoInnerHTML(h) {
  for (const element of h.allElements()) {
    assert.equal(element.innerHTMLTouched, false, 'innerHTML nunca é atribuído com dado de ferramenta');
  }
}

function assertOnlyDataPngSrc(h) {
  for (const element of h.allElements()) {
    const src = element.getAttribute('src');
    if (src !== null) {
      assert.ok(src.startsWith('data:image/png;base64,'), `src só pode ser data:image/png — veio ${String(src).slice(0, 60)}`);
    }
  }
}

/* ---------- recurso ---------- */

test('recurso: HTML self-contained, sem rede, com URI/MIME do contrato', () => {
  assert.ok(HTML.trimStart().toLowerCase().startsWith('<!doctype html>'), 'doctype HTML5');
  assert.match(HTML, /<script data-mesa-desk>/, 'script inline marcado');
  assert.ok(!/https?:\/\//i.test(HTML), 'nenhuma URL externa no recurso');
  assert.ok(!/<link\b/i.test(HTML), 'nenhum <link> externo');
  assert.ok(!/@import/i.test(HTML), 'nenhum @import');
  assert.ok(!/\bfetch\s*\(/.test(SCRIPT), 'sem fetch');
  assert.ok(!/XMLHttpRequest|WebSocket/.test(SCRIPT), 'sem rede no script');
  assert.ok(!/[^\w]import\s*\(/.test(SCRIPT), 'sem import dinâmico');
  for (const method of [
    'ui/initialize',
    'ui/notifications/initialized',
    'ui/notifications/tool-result',
    'ui/notifications/tool-cancelled',
    'ui/notifications/host-context-changed',
    'ui/resource-teardown',
    'tools/call',
    'ui/message',
    'ui/update-model-context',
    'ui/request-display-mode',
  ]) {
    assert.ok(SCRIPT.includes(method), `ponte menciona ${method}`);
  }
  assert.ok(SCRIPT.includes('event.source !== window.parent'), 'guarda de origem da ponte');
  assert.equal(DESK_URI, 'ui://mesa-study/desk-v1.html');
  assert.equal(DESK_MIME, 'text/html;profile=mcp-app');
  assert.equal(buildDeskHtml(), HTML, 'buildDeskHtml devolve o recurso versionado');
});

/* ---------- ponte ---------- */

test('ponte: ui/initialize → initialized, tema e tela cheia', async () => {
  const h = makeHarness();
  h.run();
  const initialize = h.lastRequest('ui/initialize');
  assert.ok(initialize);
  assert.equal(initialize.params.protocolVersion, '2026-01-26');
  assert.deepEqual(initialize.params.appInfo, {name: 'mesa-study-desk', version: '1.0.0'});
  assert.deepEqual(initialize.params.appCapabilities.availableDisplayModes, ['inline', 'fullscreen']);
  assert.equal(h.el('mesa-status').textContent, 'Conectando ao aplicativo…');
  assert.equal(h.window.parent, h.window.parent, 'a ponte usa window.parent');

  h.respond(initialize.id, initResult({context: {theme: 'dark', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen']}}));
  await tick();
  assert.equal(h.requests('ui/notifications/initialized').length, 1, 'initialized depois do resultado');
  assert.equal(h.doc.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(h.el('mesa-fullscreen').hidden, false);

  h.dispatch({jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: {theme: 'light'}});
  assert.equal(h.doc.documentElement.getAttribute('data-theme'), 'light');

  h.click('mesa-fullscreen');
  const mode = h.lastRequest('ui/request-display-mode');
  assert.equal(mode.params.mode, 'fullscreen');
  h.respond(mode.id, {mode: 'fullscreen'});
  await tick();
  assert.equal(h.el('mesa-fullscreen').textContent, 'Sair da tela cheia');
});

test('ponte: falha no handshake vira orientação de usuário, sem jargão de protocolo', async () => {
  const h = makeHarness();
  h.run();
  const initialize = h.lastRequest('ui/initialize');
  h.respondError(initialize.id, {code: -32000, message: 'transporte caiu'});
  await tick();
  assert.match(h.el('mesa-error').textContent, /transporte caiu/, 'o motivo real fica visível');
  assert.doesNotMatch(h.el('mesa-error').textContent, /ui\/initialize|JSON-RPC/, 'sem jargão de protocolo no erro');
  assert.match(h.el('mesa-status').textContent, /Reabra a Mesa/, 'status diz o passo seguinte');
  assert.doesNotMatch(h.el('mesa-status').textContent, /tools\/call/, 'nada de detalhe de backend');
  assert.equal(h.el('mesa-help').disabled, true, 'sem handshake, nada de ajuda');
});

test('ponte: mensagem de outra origem ou JSON-RPC inválido é ignorada', async () => {
  const h = await boot();
  h.dispatch({jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: {structuredContent: deskStructured()}}, {outraJanela: true});
  h.dispatch({jsonrpc: '1.0', method: 'ui/notifications/tool-result', params: {structuredContent: deskStructured()}});
  h.dispatch('texto solto');
  await tick();
  assert.equal(h.el('mesa-status').textContent, 'Conectado. Abrindo a Mesa…', 'nada foi aplicado');
  assert.equal(h.el('mesa-library').children.length, 0);
});

/* ---------- desk ---------- */

test('desk: biblioteca, página inicial e imagem sem chamar mesa_page', async () => {
  const fixture = pngFixture();
  const h = await bootDesk({
    desk: deskStructured({
      page: pageStructured({page: 2, numPages: 5, imageBytes: fixture.bytes}),
      library: {files: [{filePath: '/raiz/exercicio.pdf', name: 'exercicio.pdf'}, {filePath: '/raiz/formulario.pdf', name: 'formulario.pdf'}], truncated: true},
    }),
    content: [imageOf(fixture), {type: 'text', text: 'meta'}],
  });

  assert.equal(h.toolCalls('mesa_page').length, 0, 'abrir o desk não dispara mesa_page');
  assert.equal(h.toolCalls('mesa_library').length, 0, 'biblioteca veio no desk');
  assert.equal(h.el('mesa-library').children.length, 2);
  assert.equal(h.el('mesa-library').value, '/raiz/exercicio.pdf');
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data);
  assert.equal(h.el('mesa-image').hidden, false);
  assert.equal(h.el('mesa-page-input').value, '2');
  assert.equal(h.el('mesa-page-total').textContent, '/ 5');
  assert.equal(h.el('mesa-library-note').hidden, false);
  assert.match(h.el('mesa-status').textContent, /Página 2 de 5/);
  assert.equal(h.el('mesa-help').disabled, false);
  assert.equal(h.el('mesa-check-xournal').disabled, false, 'status diz janelas prontas');
  const refs = h.lastRequest('ui/update-model-context');
  assert.equal(refs.params.structuredContent.mesa.filePath, '/raiz/exercicio.pdf');
  assert.equal(refs.params.structuredContent.mesa.page, 2);
  assert.ok(!JSON.stringify(refs.params).includes('data:image'), 'contexto não finge visão de imagem');
  assertNoInnerHTML(h);
  assertOnlyDataPngSrc(h);
});

test('desk sem library/page: uma mesa_library e nenhuma leitura automática', async () => {
  const h = await bootDesk({desk: deskStructured({library: null, page: null})});
  const calls = h.toolCalls('mesa_library');
  assert.equal(calls.length, 1, 'fallback chama mesa_library uma vez');
  assert.equal(h.toolCalls('mesa_page').length, 0, 'sem página não lê PDF nenhum');
  assert.equal(h.el('mesa-image').hidden, true);
  assert.equal(h.el('mesa-placeholder').hidden, false, 'placeholder visível orienta o próximo passo');
  assert.match(h.el('mesa-placeholder').textContent, /Escolha um PDF/);
  assert.equal(h.el('mesa-library').children.length, 0, 'biblioteca ainda carregando');
  assert.match(h.el('mesa-status').textContent, /Mesa aberta/);

  h.respond(calls[0].id, {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: libraryStructured({files: [{filePath: '/r/a.pdf', name: 'a.pdf'}, {filePath: '/r/b.pdf', name: 'b.pdf'}]}),
  });
  await tick();
  assert.equal(h.el('mesa-library').children.length, 3, 'placeholder + 2 PDFs');
  assert.equal(h.toolCalls('mesa_page').length, 0, 'listar não lê PDF');

  const fixture = pngFixture();
  h.select('mesa-library', '/r/b.pdf');
  const page = h.lastToolCall('mesa_page');
  assert.deepEqual(page.params.arguments, {filePath: '/r/b.pdf', page: 1});
  h.respond(page.id, pageResponse({filePath: '/r/b.pdf', name: 'b.pdf', page: 1, numPages: 2, fixture}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data);
  assert.match(h.el('mesa-doc-label').textContent, /b\.pdf/);
  assert.equal(h.el('mesa-page-total').textContent, '/ 2');
});

/* ---------- navegação e corridas ---------- */

test('navegação: próxima/anterior/ir com clamp de página', async () => {
  const {h} = await bootWithPage({page: 2, numPages: 5});

  h.click('mesa-next');
  let call = h.lastToolCall('mesa_page');
  assert.deepEqual(call.params.arguments, {filePath: '/raiz/exercicio.pdf', page: 3});
  h.respond(call.id, pageResponse({page: 3, fixture: pngFixture(128)}));
  await tick();
  assert.equal(h.el('mesa-page-input').value, '3');
  assert.equal(h.el('mesa-prev').disabled, false);
  assert.match(h.el('mesa-doc-label').textContent, /página 3 de 5/);

  h.click('mesa-prev');
  call = h.lastToolCall('mesa_page');
  assert.equal(call.params.arguments.page, 2);
  h.respond(call.id, pageResponse({page: 2, fixture: pngFixture(96)}));
  await tick();

  h.el('mesa-page-input').value = '99';
  h.click('mesa-go');
  call = h.lastToolCall('mesa_page');
  assert.equal(call.params.arguments.page, 5, 'clamp no total conhecido');
  h.respond(call.id, pageResponse({page: 5, fixture: pngFixture(160)}));
  await tick();
  assert.equal(h.el('mesa-next').disabled, true, 'última página desliga Próxima');
  assert.equal(h.el('mesa-prev').disabled, false);
});

test('corrida: resposta obsoleta não sobrescreve a resposta mais nova', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-next');
  const first = h.lastToolCall('mesa_page');
  h.el('mesa-page-input').value = '4';
  h.click('mesa-go');
  const second = h.lastToolCall('mesa_page');
  assert.notEqual(first.id, second.id);

  const newer = pngFixture(140);
  h.respond(second.id, pageResponse({page: 4, fixture: newer}));
  await tick();
  assert.equal(h.el('mesa-page-input').value, '4');

  const stale = pngFixture(100);
  h.respond(first.id, pageResponse({page: 2, fixture: stale}));
  await tick();
  assert.equal(h.el('mesa-page-input').value, '4', 'resposta obsoleta não mexe na página');
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + newer.data);
  assert.match(h.el('mesa-status').textContent, /Página 4 de 5/);
});

test('falha de página: prévia limpa, erro visível e sem imagem velha', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  assert.ok(h.el('mesa-image').getAttribute('src'), 'prévia inicial presente');

  h.click('mesa-next');
  const failed = h.lastToolCall('mesa_page');
  h.respond(failed.id, {
    isError: true,
    content: [{type: 'text', text: JSON.stringify({ok: false, error: {code: 'PAGE_OUT_OF_RANGE', message: 'Página fora do intervalo.'}})}],
  });
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-image').hidden, true);
  assert.match(h.el('mesa-placeholder').textContent, /falhou/i, 'placeholder de falha não finge estado inicial');
  assert.equal(h.el('mesa-error').hidden, false);
  assert.match(h.el('mesa-error').textContent, /PAGE_OUT_OF_RANGE/);
  assert.match(h.el('mesa-status').textContent, /Falha ao carregar/);

  h.click('mesa-next');
  const retry = h.lastToolCall('mesa_page');
  h.respondError(retry.id, {code: -32000, message: 'transporte caiu'});
  await tick();
  assert.match(h.el('mesa-error').textContent, /transporte caiu/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');
});

test('cancelamento: resposta tardia não aplica', async () => {
  const {h, fixture} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');

  h.notify('ui/notifications/tool-cancelled', {reason: 'teste'});
  await tick();
  assert.match(h.el('mesa-status').textContent, /cancelada/i);
  assert.equal(h.el('mesa-busy').hidden, true, 'cancelar some com o estado de carregamento');
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');
  assert.equal(h.el('mesa-help').disabled, false, 'cancelar religa a ajuda sobre a prévia provada');
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data, 'cancelar mantém a última imagem');

  const late = pngFixture(150);
  h.respond(call.id, pageResponse({page: 2, fixture: late}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data, 'resposta cancelada é ignorada');
  assert.equal(h.el('mesa-page-input').value, '1');
});

test('tempo esgotado: pedido sem resposta falha e limpa a prévia', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');

  h.advance(30000);
  await tick();
  assert.match(h.el('mesa-error').textContent, /Tempo esgotado/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');

  h.respond(call.id, pageResponse({page: 2, fixture: pngFixture(120)}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), null, 'resposta depois do timeout não ressuscita');
});

test('teardown: responde à requisição, limpa a prévia e ignora resposta tardia', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');

  h.hostRequest('ui/resource-teardown', {reason: 'teste'}, 77);
  await tick();
  const response = h.posted().find((message) => message && message.id === 77 && !message.method);
  assert.ok(response, 'teardown respondido');
  assert.deepEqual(response.result, {});
  assert.equal(h.el('mesa-status').textContent, 'Painel encerrado.');
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-doc-label').textContent, 'Nenhum PDF selecionado');
  assert.equal(h.el('mesa-library').children.length, 0);

  h.respond(call.id, pageResponse({page: 2, fixture: pngFixture(120)}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), null, 'nada ressuscita depois do teardown');
  assert.equal(h.el('mesa-page-input').value, '');
});

/* ---------- segurança ---------- */

test('segurança: textContent, sem innerHTML, PNG validado e limite de bytes', async () => {
  const evil = '<img src=x onerror="window.__pwned=1">';
  const fixture = pngFixture();
  const h = await bootDesk({
    desk: deskStructured({
      library: {files: [{filePath: '/r/' + evil + '.pdf', name: evil}], truncated: false},
      page: pageStructured({page: 1, numPages: 3, imageBytes: fixture.bytes}),
      status: statusFixture({maxImageBytes: 4096}),
    }),
    content: [imageOf(fixture), {type: 'text', text: 'meta'}],
  });
  const texts = h.el('mesa-library').children.map((child) => child.textContent).join('|');
  assert.ok(texts.includes(evil), 'nome malicioso aparece como texto literal');
  assertNoInnerHTML(h);
  assertOnlyDataPngSrc(h);
  assert.equal(h.window.__pwned, undefined);

  // Imagem JPEG no primeiro bloco image: falha limpa a prévia (sem imagem velha).
  h.notify('ui/notifications/tool-result', {
    content: [{type: 'image', mimeType: 'image/jpeg', data: fixture.data}],
    structuredContent: pageStructured({page: 2, numPages: 3, imageBytes: 99999}),
  });
  await tick();
  assert.match(h.el('mesa-error').textContent, /não é PNG/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null, 'falha limpa a prévia em vez de manter imagem velha');
  assert.equal(h.el('mesa-image').hidden, true);
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false', 'busy liberado na falha');
  assert.equal(h.el('mesa-help').disabled, true, 'sem prévia válida, ajuda desligada');

  // Acima do teto do status (4096): recusada e limpa.
  const big = pngFixture(5000);
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(big)],
    structuredContent: pageStructured({page: 3, numPages: 3, imageBytes: big.bytes}),
  });
  await tick();
  assert.match(h.el('mesa-error').textContent, /excede o limite de 4096/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null);

  // bytes divergentes do metadado: recusada antes de comprometer o contexto.
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(fixture)],
    structuredContent: pageStructured({page: 1, numPages: 3, imageBytes: 999}),
  });
  await tick();
  assert.match(h.el('mesa-error').textContent, /bytes divergentes/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-page-input').value, '1', 'metadados ruins não mexem no contexto antigo');

  h.dispatch({jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: {structuredContent: deskStructured()}}, {outraJanela: true});
  await tick();
  assert.equal(h.el('mesa-page-input').value, '1', 'mensagem de outra origem não aplica');
  assertOnlyDataPngSrc(h);
});

/* ---------- Xournal++ ---------- */

test('biblioteca vazia após página: orienta, identifica última referência e permite nova tentativa explícita', async () => {
  const {h, fixture} = await bootWithPage({page: 2, numPages: 5});
  assert.equal(h.el('mesa-doc-label').textContent, 'exercicio.pdf — página 2 de 5');
  h.notify('ui/notifications/tool-result', {
    content: [],
    structuredContent: deskStructured({page: null, library: {files: [], truncated: false}}),
  });
  await tick();
  assert.equal(h.el('mesa-library-note').hidden, false);
  assert.match(h.el('mesa-library-note').textContent, /Nenhum PDF apareceu.*último PDF.*Ir/);
  assert.equal(h.el('mesa-library').children[0].value, '/raiz/exercicio.pdf');
  assert.equal(h.el('mesa-doc-label').textContent, 'Último PDF: exercicio.pdf — página 2 de 5');
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-help').disabled, true);
  assert.equal(h.toolCalls('mesa_page').length, 0, 'vazio nunca reabre sozinho');

  h.click('mesa-go');
  const call = h.lastToolCall('mesa_page');
  assert.deepEqual(call.params.arguments, {filePath: '/raiz/exercicio.pdf', page: 2});
  h.respond(call.id, {
    content: [imageOf(fixture)],
    structuredContent: pageStructured({page: 2, numPages: 5, imageBytes: fixture.bytes}),
  });
  await tick();
  assert.equal(h.el('mesa-doc-label').textContent, 'exercicio.pdf — página 2 de 5');
  assert.equal(h.el('mesa-context').getAttribute('data-context'), 'page');
  assert.equal(h.el('mesa-help').disabled, false);

  h.notify('ui/notifications/tool-result', {isError: true, content: [{type: 'text', text: 'falha sintética'}]});
  await tick();
  assert.equal(h.el('mesa-doc-label').textContent, 'Último PDF: exercicio.pdf — página 2 de 5');
  assert.equal(h.el('mesa-help').disabled, true);
});

test('conferir Xournal++: listar e capturar só por clique explícito', async () => {
  const fixture = pngFixture(120);
  const h = await bootDesk({desk: deskStructured({library: {files: []}, page: null})});
  assert.equal(h.toolCalls('mesa_windows').length, 0, 'sem auto-listagem');
  assert.equal(h.toolCalls('mesa_capture').length, 0, 'sem auto-captura');
  assert.equal(h.el('mesa-windows-panel').hidden, true);
  assert.equal(h.el('mesa-library-note').hidden, false, 'biblioteca vazia ganha orientação');
  assert.match(h.el('mesa-library-note').textContent, /Nenhum PDF autorizado/);

  h.click('mesa-check-xournal');
  const list = h.lastToolCall('mesa_windows');
  assert.ok(list, 'clique explícito lista janelas');
  assert.equal(h.el('mesa-windows-panel').hidden, false);
  assert.equal(h.toolCalls('mesa_capture').length, 0, 'listar não captura');

  h.respond(list.id, {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: {ok: true, kind: 'windows', windows: [{id: '12', app: 'Xournal++', title: 'Resolução'}, {id: '34', app: 'Xournal++', title: 'Rascunho'}], count: 2, provenance: 'lista sintética'},
  });
  await tick();
  assert.equal(h.el('mesa-windows').children.length, 3);
  assert.equal(h.el('mesa-capture').disabled, true, 'capturar exige escolha');
  assert.match(h.el('mesa-windows-status').textContent, /nunca da tela inteira/);

  h.select('mesa-windows', '12');
  assert.equal(h.el('mesa-capture').disabled, false);
  assert.equal(h.toolCalls('mesa_capture').length, 0, 'escolher janela não captura');

  h.click('mesa-capture');
  const capture = h.lastToolCall('mesa_capture');
  assert.deepEqual(capture.params.arguments, {windowId: '12'});
  assert.equal(h.el('mesa-capture').disabled, true, 'captura em andamento trava o botão do modal');
  assert.equal(h.el('mesa-windows').disabled, true, 'captura em andamento trava a escolha de janela');
  assert.equal(h.el('mesa-busy').hidden, false, 'captura anuncia o próprio estado no leitor');
  assert.equal(h.el('mesa-busy').textContent, 'Capturando a janela…');
  h.respond(capture.id, {content: [imageOf(fixture), {type: 'text', text: 'meta'}], structuredContent: captureStructured({fixture})});
  await tick();
  assert.equal(h.el('mesa-busy').hidden, true, 'chip some quando a captura volta');
  assert.equal(h.toolCalls('mesa_capture').length, 1);
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data);
  assert.match(h.el('mesa-status').textContent, /Captura da janela/);
  assert.match(h.el('mesa-windows-status').textContent, /não é uma prévia só local/);
  assert.equal(h.el('mesa-capture').disabled, false, 'terminou: botão volta');
  assert.equal(h.el('mesa-windows').disabled, false, 'terminou: escolha volta');
  assert.equal(h.el('mesa-help').disabled, false);
  assert.equal(h.el('mesa-doc-label').textContent, 'Xournal++ — Resolução', 'rótulo da janela capturada');
  assert.equal(h.el('mesa-capture-notice').hidden, false, 'aviso de nova captura visível');
  assert.equal(h.el('mesa-capture-notice').textContent, 'Ao pedir conferência, uma nova captura da janela será enviada ao tutor.');

  h.click('mesa-help');
  const help = h.lastRequest('ui/message');
  assert.match(help.params.content[0].text, /mesa_capture/);
  assert.match(help.params.content[0].text, /windowId 12/);
  assert.match(help.params.content[0].text, /nova captura|capturar de novo/i, 'o pedido afirma que a captura será nova, não a do painel');
  assert.ok(!JSON.stringify(help.params).includes('data:image'), 'help não anexa imagem');
});

test('falha de captura: erro visível e prévia limpa', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 3});
  h.click('mesa-check-xournal');
  const list = h.lastToolCall('mesa_windows');
  h.respond(list.id, {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: {ok: true, kind: 'windows', windows: [{id: '55', app: 'Xournal++', title: 'Resolução'}], count: 1},
  });
  await tick();
  h.select('mesa-windows', '55');
  h.click('mesa-capture');
  const capture = h.lastToolCall('mesa_capture');
  h.respond(capture.id, {
    isError: true,
    content: [{type: 'text', text: JSON.stringify({ok: false, error: {code: 'CAPTURE_WINDOW_GONE', message: 'A janela sumiu.'}})}],
  });
  await tick();
  assert.match(h.el('mesa-error').textContent, /CAPTURE_WINDOW_GONE/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-context').getAttribute('data-context'), 'none', 'falha de captura também limpa o contexto');
  assert.match(h.el('mesa-context').textContent, /falhou/i);
  assert.equal(h.el('mesa-windows').disabled, false, 'dá para tentar de novo');
  assert.equal(h.el('mesa-capture').disabled, false);
});

/* ---------- ajuda e contexto ---------- */

test('pedir ajuda: ui/message com referências e sem imagem', async () => {
  const {h} = await bootWithPage({page: 2, numPages: 5});
  h.el('mesa-help-note').value = 'não entendi o passo 2';

  h.click('mesa-help');
  const message = h.lastRequest('ui/message');
  assert.ok(message, 'ui/message enviado');
  assert.equal(message.params.role, 'user');
  assert.ok(Array.isArray(message.params.content), 'content é lista de blocos (SDK ext-apps)');
  const text = message.params.content[0].text;
  assert.match(text, /mesa_page/);
  assert.match(text, /\/raiz\/exercicio\.pdf/);
  assert.match(text, /página 2/i);
  assert.match(text, /não entendi o passo 2/);
  assert.ok(!JSON.stringify(message.params).includes('data:image'), 'pedido não finge visão de imagem');

  h.respond(message.id, {});
  await tick();
  assert.match(h.el('mesa-status').textContent, /Pedido enviado ao tutor/);
});

test('feature detect: sem ui/message, update-model-context ou fullscreen o painel se adapta', async () => {
  const fixture = pngFixture();
  const h = await bootDesk({
    caps: {serverTools: {}},
    context: {theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline']},
    desk: deskStructured({page: pageStructured({page: 1, numPages: 1, imageBytes: fixture.bytes}), library: {files: []}}),
    content: [imageOf(fixture), {type: 'text', text: 'meta'}],
  });
  assert.equal(h.el('mesa-fullscreen').hidden, true, 'sem fullscreen declarado, botão escondido');
  assert.equal(h.requests('ui/request-display-mode').length, 0);
  assert.equal(h.requests('ui/update-model-context').length, 0, 'sem capability, não manda contexto');
  assert.equal(h.el('mesa-help').disabled, true, 'sem ui/message, ajuda desligada');
  assert.match(h.el('mesa-help').title, /não permite enviar mensagens/);
});

/* ---------- gates, ajuda e corridas (r2) ---------- */

test('ajuda: desligada na seleção/carregamento e depois da falha; religada no sucesso', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  assert.equal(h.el('mesa-help').disabled, false, 'página válida habilita a ajuda');

  h.select('mesa-library', '/raiz/formulario.pdf');
  assert.equal(h.el('mesa-help').disabled, true, 'nova seleção sem resposta: ajuda desligada');
  assert.equal(h.el('mesa-page-input').value, '', 'seleção nova não herda a página antiga');
  const failed = h.lastToolCall('mesa_page');
  assert.deepEqual(failed.params.arguments, {filePath: '/raiz/formulario.pdf', page: 1});
  h.respond(failed.id, {
    isError: true,
    content: [{type: 'text', text: JSON.stringify({ok: false, error: {code: 'PAGE_OUT_OF_RANGE', message: 'Página fora do intervalo.'}})}],
  });
  await tick();
  assert.equal(h.el('mesa-help').disabled, true, 'falha mantém a ajuda desligada');
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');

  h.el('mesa-page-input').value = '1';
  h.click('mesa-go');
  const retry = h.lastToolCall('mesa_page');
  const fixture = pngFixture(110);
  h.respond(retry.id, pageResponse({filePath: '/raiz/formulario.pdf', name: 'formulario.pdf', page: 1, numPages: 4, fixture}));
  await tick();
  assert.equal(h.el('mesa-help').disabled, false, 'sucesso religa a ajuda');
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data);
  assert.match(h.el('mesa-doc-label').textContent, /formulario\.pdf — página 1 de 4/);
});

test('falha de bytes divergentes no painel: limpa a prévia, libera busy e desliga a ajuda', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 3});
  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');
  const fixture = pngFixture(120);
  h.respond(call.id, {
    content: [imageOf(fixture)],
    structuredContent: pageStructured({page: 2, numPages: 3, imageBytes: fixture.bytes + 1}),
  });
  await tick();
  assert.match(h.el('mesa-error').textContent, /bytes divergentes/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null, 'sem imagem antiga depois da divergência');
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');
  assert.equal(h.el('mesa-help').disabled, true);
  assert.equal(h.el('mesa-page-input').value, '1', 'contexto antigo preservado (sem commit do meta ruim)');
});

test('serverTools ausente: navegação/check/captura desligadas mesmo com status e biblioteca', async () => {
  const fixture = pngFixture();
  const h = await bootDesk({
    caps: {message: {text: {}}},
    desk: deskStructured({
      page: pageStructured({page: 1, numPages: 3, imageBytes: fixture.bytes}),
      library: {files: [{filePath: '/raiz/exercicio.pdf', name: 'exercicio.pdf'}], truncated: false},
    }),
    content: [imageOf(fixture), {type: 'text', text: 'meta'}],
  });
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data, 'página do mesa_open segue visível');
  assert.equal(h.el('mesa-library').children.length, 1);
  assert.equal(h.el('mesa-library').disabled, true, 'sem tools/call não dá para trocar de PDF');
  assert.match(h.el('mesa-library').title, /não permite chamar as ferramentas/);
  assert.equal(h.el('mesa-prev').disabled, true);
  assert.equal(h.el('mesa-next').disabled, true);
  assert.equal(h.el('mesa-go').disabled, true);
  assert.equal(h.el('mesa-page-input').disabled, true);
  assert.equal(h.el('mesa-check-xournal').disabled, true, 'status pronto não basta sem serverTools');
  assert.match(h.el('mesa-check-xournal').title, /não permite chamar as ferramentas/);
  assert.equal(h.el('mesa-capture').disabled, true);
  assert.equal(h.el('mesa-help').disabled, false, 'ui/message não depende de tools/call');

  h.click('mesa-next');
  h.click('mesa-check-xournal');
  assert.equal(h.toolCalls('mesa_page').length, 0, 'nenhuma chamada sem serverTools');
  assert.equal(h.toolCalls('mesa_windows').length, 0);
  assert.equal(h.toolCalls('mesa_capture').length, 0);
  assert.match(h.el('mesa-windows-status').textContent, /não permite chamar as ferramentas/);
});

test('corrida página × captura: token único invalida resposta obsoleta dos dois tipos', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-check-xournal');
  const list = h.lastToolCall('mesa_windows');
  h.respond(list.id, {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: {ok: true, kind: 'windows', windows: [{id: '12', app: 'Xournal++', title: 'Resolução'}], count: 1},
  });
  await tick();
  h.select('mesa-windows', '12');

  /* captura pendente, navegação troca a posição: a captura obsoleta não repõe */
  h.click('mesa-capture');
  const capture = h.lastToolCall('mesa_capture');
  assert.equal(h.el('mesa-capture').disabled, true, 'captura em andamento trava o botão');
  h.click('mesa-next');
  const page = h.lastToolCall('mesa_page');
  const pageFixture = pngFixture(130);
  h.respond(page.id, pageResponse({page: 2, fixture: pageFixture}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + pageFixture.data);
  assert.match(h.el('mesa-doc-label').textContent, /página 2 de 5/);

  const staleCapture = pngFixture(150);
  h.respond(capture.id, {content: [imageOf(staleCapture), {type: 'text', text: 'meta'}], structuredContent: captureStructured({fixture: staleCapture})});
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + pageFixture.data, 'captura obsoleta ignorada');
  assert.doesNotMatch(h.el('mesa-doc-label').textContent, /Xournal/);
  assert.equal(h.el('mesa-capture-notice').hidden, true, 'sem captura válida, sem aviso');

  /* página pendente, captura responde primeiro: a página obsoleta não repõe */
  h.click('mesa-next');
  const page2 = h.lastToolCall('mesa_page');
  h.click('mesa-capture');
  const capture2 = h.lastToolCall('mesa_capture');
  assert.notEqual(page2.id, capture2.id);
  const captureFixture = pngFixture(170);
  h.respond(capture2.id, {content: [imageOf(captureFixture), {type: 'text', text: 'meta'}], structuredContent: captureStructured({fixture: captureFixture})});
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + captureFixture.data);
  assert.match(h.el('mesa-doc-label').textContent, /Xournal\+\+ — Resolução/);
  assert.equal(h.el('mesa-capture-notice').hidden, false);

  const stalePage = pngFixture(190);
  h.respond(page2.id, pageResponse({page: 3, fixture: stalePage}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + captureFixture.data, 'página obsoleta ignorada');
  assert.match(h.el('mesa-doc-label').textContent, /Xournal\+\+ — Resolução/);
  assert.equal(h.el('mesa-page-input').value, '2', 'página antiga continua no contexto');
});

test('conferência: aviso de nova captura, rótulo da janela e pedido sem anexar imagem', async () => {
  const fixture = pngFixture(120);
  const {h} = await bootWithPage({page: 1, numPages: 3});
  assert.equal(h.el('mesa-capture-notice').hidden, true, 'sem captura, sem aviso');

  h.click('mesa-check-xournal');
  const list = h.lastToolCall('mesa_windows');
  h.respond(list.id, {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: {ok: true, kind: 'windows', windows: [{id: '12', app: 'Xournal++', title: 'Resolução'}], count: 1},
  });
  await tick();
  h.select('mesa-windows', '12');
  h.click('mesa-capture');
  const capture = h.lastToolCall('mesa_capture');
  h.respond(capture.id, {content: [imageOf(fixture), {type: 'text', text: 'meta'}], structuredContent: captureStructured({fixture})});
  await tick();

  assert.equal(h.el('mesa-capture-notice').hidden, false, 'aviso visível antes de pedir ajuda');
  assert.equal(h.el('mesa-capture-notice').textContent, 'Ao pedir conferência, uma nova captura da janela será enviada ao tutor.');
  assert.equal(h.el('mesa-doc-label').textContent, 'Xournal++ — Resolução', 'rótulo da janela atualizado na captura');

  h.click('mesa-help');
  const help = h.lastRequest('ui/message');
  const text = help.params.content[0].text;
  assert.match(text, /mesa_capture/);
  assert.match(text, /windowId 12/);
  assert.match(text, /nova captura|capturar de novo/i, 'o pedido afirma que a captura será nova');
  assert.ok(!JSON.stringify(help.params).includes('data:image'), 'pedido não anexa a imagem do painel');
  h.respond(help.id, {});
  await tick();
  assert.match(h.el('mesa-status').textContent, /Pedido de conferência enviado ao tutor/);

  /* voltar para uma página esconde o aviso e o rótulo da janela */
  h.click('mesa-next');
  const page = h.lastToolCall('mesa_page');
  h.respond(page.id, pageResponse({page: 2, fixture: pngFixture(140)}));
  await tick();
  assert.equal(h.el('mesa-capture-notice').hidden, true);
  assert.doesNotMatch(h.el('mesa-doc-label').textContent, /Xournal/);
});

test('ajuda: um pedido por vez e recusa do SDK tratada como falha honesta', async () => {
  const {h} = await bootWithPage({page: 2, numPages: 5});
  h.click('mesa-help');
  const first = h.lastRequest('ui/message');
  assert.ok(first);
  assert.equal(h.el('mesa-help').disabled, true, 'pedido em andamento desliga o botão');
  assert.match(h.el('mesa-help').title, /Aguardando/);
  h.click('mesa-help');
  h.click('mesa-help');
  assert.equal(h.requests('ui/message').length, 1, 'cliques repetidos não duplicam a mensagem');

  h.respond(first.id, {isError: true});
  await tick();
  assert.match(h.el('mesa-error').textContent, /recusou/i);
  assert.match(h.el('mesa-status').textContent, /não enviado/i);
  assert.equal(h.el('mesa-help').disabled, false, 'recusa libera nova tentativa');

  h.click('mesa-help');
  assert.equal(h.requests('ui/message').length, 2);
  const second = h.lastRequest('ui/message');
  h.respond(second.id, {});
  await tick();
  assert.match(h.el('mesa-status').textContent, /Pedido enviado ao tutor/);
  assert.equal(h.el('mesa-help').disabled, false);
});

test('teardown: pedido de ajuda pendente não vaza e os controles ficam desligados', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 2});
  h.click('mesa-help');
  assert.ok(h.lastRequest('ui/message'), 'pedido pendente');
  h.hostRequest('ui/resource-teardown', {reason: 'teste'}, 91);
  await tick();
  const response = h.posted().find((message) => message && message.id === 91 && !message.method);
  assert.ok(response, 'teardown respondido');
  assert.equal(h.el('mesa-status').textContent, 'Painel encerrado.');
  assert.equal(h.el('mesa-help').disabled, true);
  assert.equal(h.el('mesa-help-pending').hidden, true);
  assert.equal(h.el('mesa-busy').hidden, true);
  assert.equal(h.el('mesa-capture-notice').hidden, true);
});

test('zoom: CSS não encolhe a imagem e o passo é local (sem servidor)', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 3});
  const css = HTML.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const viewportRule = css.match(/\n#mesa-viewport\{([^}]*)\}/)[1];
  const imageRule = css.match(/\n#mesa-image\{([^}]*)\}/)[1];
  assert.match(imageRule, /flex:none/, 'flex-shrink 1 anularia o zoom acima de 100%');
  assert.match(imageRule, /margin:0 auto/, 'centraliza quando cabe e vira 0 no transbordo, sem cortar a borda esquerda');
  assert.ok(!/justify-content:\s*center/.test(viewportRule), 'justify-content:center deixa a borda esquerda inalcançável com overflow (medido no navegador: offsetLeft -93px a 125%)');
  assert.ok(!/justify-content:\s*center/.test(css), 'nenhum nó do recurso usa justify-content:center (mata o caminho de regressão do r1)');
  assert.match(css, /#mesa-root\{[^}]*width:100%/, 'sem width:100% o grid deixa o conteúdo em min-content com max-width');
  const footRule = css.match(/\n\.pdf-foot\{([^}]*)\}/)[1];
  assert.doesNotMatch(footRule, /position:absolute/, 'o rótulo do documento não flutua mais sobre a página');

  assert.equal(h.el('mesa-zoom-value').textContent, 'Ajustada', 'modo de ajuste não finge 100%');
  assert.equal(h.el('mesa-zoom-fit').getAttribute('aria-pressed'), 'true');
  assert.equal(h.el('mesa-image').style.width, '100%');
  h.click('mesa-zoom-in');
  assert.equal(h.el('mesa-image').style.width, '125%');
  assert.equal(h.el('mesa-zoom-value').textContent, '125%');
  assert.equal(h.el('mesa-zoom-fit').getAttribute('aria-pressed'), 'false');
  h.click('mesa-zoom-in');
  assert.equal(h.el('mesa-image').style.width, '150%');
  assert.equal(h.el('mesa-image').style.height, 'auto');
  h.click('mesa-zoom-fit');
  assert.equal(h.el('mesa-image').style.width, '100%');
  assert.equal(h.el('mesa-zoom-value').textContent, 'Ajustada');
  assert.equal(h.el('mesa-zoom-fit').textContent, 'Ajustar');
  assert.equal(h.posted().filter((message) => message && message.method === 'tools/call').length, 0, 'zoom não fala com o servidor');
});

/* ---------- tutoria, contexto e carregamento (r10) ---------- */

test('tutoria: contexto ativo mostra página/captura, limpa na falha e não repete referência velha', async () => {
  const fixture = pngFixture(120);
  const {h} = await bootWithPage({page: 2, numPages: 5, name: 'exercicio.pdf'});
  const ctx = h.el('mesa-context');
  assert.equal(ctx.getAttribute('data-context'), 'page');
  assert.match(ctx.textContent, /exercicio\.pdf · página 2 de 5/);

  h.notify('ui/notifications/tool-result', {
    content: [imageOf(fixture)],
    structuredContent: captureStructured({fixture, windowId: '31', title: 'Rascunho'}),
  });
  await tick();
  assert.equal(ctx.getAttribute('data-context'), 'capture');
  assert.match(ctx.textContent, /Xournal\+\+ — Rascunho/);

  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');
  assert.equal(ctx.getAttribute('data-context'), 'capture', 'em voo o resumo segue o que está exibido');
  h.respond(call.id, {
    isError: true,
    content: [{type: 'text', text: JSON.stringify({ok: false, error: {code: 'PDF_MISSING', message: 'Sumiu.'}})}],
  });
  await tick();
  assert.equal(ctx.getAttribute('data-context'), 'none');
  assert.match(ctx.textContent, /falhou/i);
  assert.doesNotMatch(ctx.textContent, /página \d+/, 'sem página velha fingindo contexto');
  assert.doesNotMatch(ctx.textContent, /Xournal/);
  assert.equal(h.el('mesa-help').disabled, true);
});

test('carregando: chip no leitor mantém a prévia antiga, anuncia busy e desliga a ajuda até o sucesso', async () => {
  const {h, fixture} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');
  assert.equal(h.el('mesa-busy').hidden, false, 'chip de carregamento visível');
  assert.equal(h.el('mesa-busy').textContent, 'Carregando página 2…');
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'true');
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + fixture.data, 'prévia provada continua até o sucesso');
  assert.equal(h.el('mesa-image').hidden, false);
  assert.equal(h.el('mesa-help').disabled, true, 'não dá para pedir ajuda em cima de prévia antiga');
  assert.match(h.el('mesa-help').title, /página|capture uma janela/i);

  const next = pngFixture(140);
  h.respond(call.id, pageResponse({page: 2, fixture: next}));
  await tick();
  assert.equal(h.el('mesa-busy').hidden, true, 'chip some no sucesso');
  assert.equal(h.el('mesa-busy').textContent, '');
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + next.data);
  assert.equal(h.el('mesa-help').disabled, false);
  assert.equal(h.el('mesa-status').textContent, 'Página 2 de 5.', 'status normal é curto, sem prosa do servidor');
});

test('rolagem: zoom preserva a posição; página diferente volta ao topo e reenvio da mesma não', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  const viewport = h.el('mesa-viewport');
  viewport.scrollTop = 42;
  viewport.scrollLeft = 7;
  h.click('mesa-zoom-in');
  assert.equal(viewport.scrollTop, 42, 'zoom não reseta a rolagem');
  assert.equal(viewport.scrollLeft, 7);

  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');
  const fixture = pngFixture(144);
  h.respond(call.id, pageResponse({page: 2, fixture}));
  await tick();
  assert.equal(viewport.scrollTop, 0, 'página diferente volta ao topo');
  assert.equal(viewport.scrollLeft, 0);

  viewport.scrollTop = 33;
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(fixture)],
    structuredContent: pageStructured({page: 2, numPages: 5, imageBytes: fixture.bytes}),
  });
  await tick();
  assert.equal(viewport.scrollTop, 33, 'reenvio da mesma página não mexe na rolagem');
});

test('pedido: estado de envio visível, um ui/message e rascunho preservado na recusa', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 3});
  h.el('mesa-help-note').value = 'não entendi o passo 2';
  h.click('mesa-help');
  assert.equal(h.el('mesa-help-pending').hidden, false, 'envio pendente visível');
  assert.equal(h.el('mesa-help-pending').textContent, 'Enviando o pedido ao tutor…');
  assert.equal(h.el('mesa-help').disabled, true);
  h.click('mesa-help');
  h.click('mesa-help');
  assert.equal(h.requests('ui/message').length, 1, 'um pedido por vez');

  const message = h.lastRequest('ui/message');
  h.respond(message.id, {isError: true});
  await tick();
  assert.equal(h.el('mesa-help-pending').hidden, true, 'pendência some na recusa');
  assert.equal(h.el('mesa-help-note').value, 'não entendi o passo 2', 'rascunho preservado');
  assert.match(h.el('mesa-error').textContent, /recusou/i);
  assert.doesNotMatch(h.el('mesa-status').textContent, /enviado ao tutor/i, 'recusa não inventa entrega');
  assert.equal(h.requests('ui/message').length, 1, 'recusa não reenvia sozinha');

  h.click('mesa-help');
  const retry = h.lastRequest('ui/message');
  assert.equal(h.el('mesa-help-pending').hidden, false);
  h.respond(retry.id, {});
  await tick();
  assert.equal(h.el('mesa-help-pending').hidden, true);
  assert.equal(h.el('mesa-status').textContent, 'Pedido enviado ao tutor.');
});

test('tela cheia: palco extra só quando o host declara e está em fullscreen', async () => {
  const disabled = await bootWithPage({page: 1, numPages: 1, context: {theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline']}});
  assert.equal(disabled.h.doc.documentElement.getAttribute('data-display'), null);
  assert.equal(disabled.h.el('mesa-fullscreen').hidden, true);

  const enabled = await bootWithPage({page: 1, numPages: 1, context: {theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen']}});
  assert.equal(enabled.h.doc.documentElement.getAttribute('data-display'), 'inline');
  enabled.h.dispatch({jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: {displayMode: 'fullscreen'}});
  assert.equal(enabled.h.doc.documentElement.getAttribute('data-display'), 'fullscreen');
  enabled.h.dispatch({jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: {displayMode: 'inline'}});
  assert.equal(enabled.h.doc.documentElement.getAttribute('data-display'), 'inline');
});

/* ---------- teclado e foco (ux) ---------- */

test('teclado: Enter no campo de página vai; setas ← → mudam fora de campos', async () => {
  const {h} = await bootWithPage({page: 2, numPages: 5});

  h.el('mesa-page-input').value = '4';
  const enter = h.keydown({key: 'Enter'}, h.el('mesa-page-input'));
  assert.equal(enter.defaultPrevented, true, 'Enter no campo de página é tratado');
  let call = h.lastToolCall('mesa_page');
  assert.deepEqual(call.params.arguments, {filePath: '/raiz/exercicio.pdf', page: 4});
  h.respond(call.id, pageResponse({page: 4, fixture: pngFixture(120)}));
  await tick();
  assert.equal(h.el('mesa-page-input').value, '4');

  const right = h.keydown({key: 'ArrowRight'});
  assert.equal(right.defaultPrevented, true, 'seta direita muda de página fora de campos');
  call = h.lastToolCall('mesa_page');
  assert.equal(call.params.arguments.page, 5);
  h.respond(call.id, pageResponse({page: 5, fixture: pngFixture(130)}));
  await tick();
  assert.equal(h.el('mesa-next').disabled, true, 'última página: Próxima desligada');

  const blocked = h.keydown({key: 'ArrowRight'});
  assert.equal(blocked.defaultPrevented, false, 'no limite a seta não é sequestrada');
  assert.equal(h.toolCalls('mesa_page').length, 2, 'sem chamada extra no limite');

  const left = h.keydown({key: 'ArrowLeft'});
  assert.equal(left.defaultPrevented, true);
  call = h.lastToolCall('mesa_page');
  assert.equal(call.params.arguments.page, 4);
  h.respond(call.id, pageResponse({page: 4, fixture: pngFixture(140)}));
  await tick();

  /* setas dentro de campos são do texto; modificadores são do sistema; IME não navega */
  assert.equal(h.keydown({key: 'ArrowLeft', target: h.el('mesa-page-input')}).defaultPrevented, false);
  assert.equal(h.keydown({key: 'ArrowRight', target: h.el('mesa-help-note')}).defaultPrevented, false);
  assert.equal(h.keydown({key: 'ArrowLeft', ctrlKey: true}).defaultPrevented, false);
  assert.equal(h.keydown({key: 'ArrowLeft', metaKey: true}).defaultPrevented, false);
  assert.equal(h.keydown({key: 'ArrowLeft', isComposing: true}).defaultPrevented, false);
  assert.equal(h.toolCalls('mesa_page').length, 3, 'nenhuma navegação implícita por tecla');
});

test('teclado: Enter no composer pede ajuda uma vez e preserva a anotação na falha', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 3});
  h.el('mesa-help-note').value = 'não entendi o passo 2';

  assert.ok(!/\.focus\s*\(/.test(SCRIPT), 'o painel nunca chama focus() para não roubar o campo');

  const shiftEnter = h.keydown({key: 'Enter', shiftKey: true}, h.el('mesa-help-note'));
  assert.equal(shiftEnter.defaultPrevented, false, 'Shift+Enter quebra linha');
  const composing = h.keydown({key: 'Enter', isComposing: true}, h.el('mesa-help-note'));
  assert.equal(composing.defaultPrevented, false, 'IME em composição não envia');
  assert.equal(h.requests('ui/message').length, 0);

  const enter = h.keydown({key: 'Enter'}, h.el('mesa-help-note'));
  assert.equal(enter.defaultPrevented, true, 'Enter envia o pedido');
  const message = h.lastRequest('ui/message');
  assert.match(message.params.content[0].text, /não entendi o passo 2/);
  assert.equal(h.el('mesa-help-note').value, 'não entendi o passo 2', 'a anotação fica no campo');
  assert.equal(h.el('mesa-page-input').value, '1', 'pedir ajuda não perde a página');
  assert.match(h.el('mesa-doc-label').textContent, /exercicio\.pdf — página 1 de 3/);
  assert.equal(h.el('mesa-help').disabled, true, 'um pedido por vez');
  assert.equal(h.requests('ui/message').length, 1);

  h.respond(message.id, {isError: true});
  await tick();
  assert.equal(h.requests('ui/message').length, 1, 'falha não reenvia sozinha');
  assert.equal(h.el('mesa-help-note').value, 'não entendi o passo 2', 'a anotação sobrevive à falha');
  assert.match(h.el('mesa-error').textContent, /recusou/i);

  /* sem contexto válido o Enter não sequestra o texto: quebra linha normal */
  const noContext = await bootDesk({desk: deskStructured({page: null, library: {files: []}})});
  assert.equal(noContext.el('mesa-help').disabled, true);
  const plain = noContext.keydown({key: 'Enter'}, noContext.el('mesa-help-note'));
  assert.equal(plain.defaultPrevented, false);
  assert.equal(noContext.requests('ui/message').length, 0);
});

/* ---------- tamanho, época e acessibilidade (r3) ---------- */

test('tamanho: ui/notifications/size-changed avisa o host (e tolera não ter ResizeObserver)', async () => {
  const h = await boot({resizeObserver: true});
  h.setSize({scrollHeight: 512, clientWidth: 861});
  h.advance(100);
  await tick();
  const notice = h.lastRequest('ui/notifications/size-changed');
  assert.ok(notice, 'o painel avisa o tamanho ao host');
  assert.equal(notice.params.height, 512);
  assert.equal(notice.params.width, 861, 'largura medida quando o host não diz o viewport');
  assert.equal(h.requests('ui/notifications/size-changed').length, 1, 'só um aviso inicial');

  h.setSize({scrollHeight: 640, clientWidth: 861});
  h.fireResize();
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 2, 'ResizeObserver reenvia o tamanho');
  assert.equal(h.lastRequest('ui/notifications/size-changed').params.height, 640);

  h.fireResize();
  h.advance(100);
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 2, 'medida idêntica não reavisa (dedupe do observer + timer)');

  const hug = pngFixture();
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(hug)],
    structuredContent: pageStructured({page: 1, numPages: 2, imageBytes: hug.bytes}),
  });
  await tick();
  const noObserver = makeHarness();
  noObserver.setSize({scrollHeight: 400, clientWidth: 800});
  noObserver.run();
  noObserver.respond(noObserver.lastRequest('ui/initialize').id, initResult({}));
  await tick();
  noObserver.advance(100);
  await tick();
  assert.equal(noObserver.lastRequest('ui/notifications/size-changed').params.height, 400, 'sem ResizeObserver o aviso inicial continua');
});

test('tamanho: size-changed nunca sai antes do handshake; o inicial sai depois de initialized', async () => {
  const h = makeHarness({resizeObserver: true});
  h.run();
  const initialize = h.lastRequest('ui/initialize');
  assert.ok(initialize, 'ui/initialize enviado ao montar');
  assert.equal(h.requests('ui/notifications/initialized').length, 0);
  h.setSize({scrollHeight: 480, clientWidth: 820});

  /* Handshake atrasado de propósito: nem o timer de layout nem o observer
     podem falar antes da resposta do host. */
  h.advance(100);
  h.fireResize();
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 0, 'nada de tamanho antes do handshake');
  assert.equal(h.requests('ui/notifications/initialized').length, 0, 'nada de initialized antes da resposta');

  h.respond(initialize.id, initResult({}));
  await tick();
  const posted = h.posted();
  const initializedAt = posted.findIndex((message) => message && message.method === 'ui/notifications/initialized');
  const sizeAt = posted.findIndex((message) => message && message.method === 'ui/notifications/size-changed');
  assert.ok(initializedAt >= 0, 'initialized sai depois da resposta do host');
  assert.ok(sizeAt > initializedAt, 'o primeiro tamanho sai depois de initialized');
  const notice = h.lastRequest('ui/notifications/size-changed');
  assert.equal(notice.params.width, 820);
  assert.equal(notice.params.height, 480);
  assert.equal(h.requests('ui/notifications/size-changed').length, 1, 'aviso inicial único');
});

test('tamanho: medida pré-handshake não conta como enviada; o aviso inicial usa o layout atual e o dedupe segue', async () => {
  const h = makeHarness({resizeObserver: true});
  h.run();
  const initialize = h.lastRequest('ui/initialize');
  h.setSize({scrollHeight: 400, clientWidth: 800});
  h.advance(100);
  h.fireResize();
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 0, 'medida pré-handshake fica quieta');

  /* O layout muda antes do fim do handshake: vale a medida atual, uma vez. */
  h.setSize({scrollHeight: 512, clientWidth: 861});
  h.respond(initialize.id, initResult({}));
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 1, 'só o aviso inicial pós-handshake');
  assert.equal(h.lastRequest('ui/notifications/size-changed').params.width, 861);
  assert.equal(h.lastRequest('ui/notifications/size-changed').params.height, 512);

  h.fireResize();
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 1, 'mesma medida não repete');

  h.setSize({scrollHeight: 600, clientWidth: 861});
  h.fireResize();
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 2, 'medida nova reavisa');
  assert.equal(h.lastRequest('ui/notifications/size-changed').params.height, 600);
});

test('tamanho: teardown para de avisar; scrollHeight gigante é limitado', async () => {
  const h = await boot({resizeObserver: true});
  h.setSize({scrollHeight: 600, clientWidth: 800});
  h.advance(100);
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, 1);

  h.setSize({scrollHeight: 999999, clientWidth: 800});
  h.fireResize();
  await tick();
  assert.equal(h.lastRequest('ui/notifications/size-changed').params.height, 20000, 'teto de altura do contrato');

  h.hostRequest('ui/resource-teardown', {reason: 'teste'}, 55);
  await tick();
  const before = h.requests('ui/notifications/size-changed').length;
  h.fireResize();
  h.advance(500);
  await tick();
  assert.equal(h.requests('ui/notifications/size-changed').length, before, 'painel encerrado não fala mais de tamanho');
});

test('época: resultado do host durante uma navegação descarta a resposta em voo', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-next');
  const stale = h.lastToolCall('mesa_page');
  h.select('mesa-library', '/raiz/formulario.pdf');
  const inFlight = h.lastToolCall('mesa_page');
  assert.notEqual(stale.id, inFlight.id);

  /* O host empurra um mesa_open novo (sem página): o que estava em voo é antigo. */
  h.notify('ui/notifications/tool-result', {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: deskStructured({page: null, library: {files: [{filePath: '/raiz/formulario.pdf', name: 'formulario.pdf'}], truncated: false}}),
  });
  await tick();
  assert.equal(h.el('mesa-image').hidden, true, 'estado novo da mesa sem página limpa a prévia');

  h.respond(inFlight.id, pageResponse({filePath: '/raiz/formulario.pdf', name: 'formulario.pdf', page: 1, numPages: 4, fixture: pngFixture(140)}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), null, 'resposta em voo não volta por cima do estado novo');
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');
  assert.equal(h.el('mesa-page-input').value, '');
});

test('época: captura em voo não repõe por cima de um mesa_open novo', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 3});
  h.click('mesa-check-xournal');
  const list = h.lastToolCall('mesa_windows');
  h.respond(list.id, {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: {ok: true, kind: 'windows', windows: [{id: '21', app: 'Xournal++', title: 'Resolução'}], count: 1},
  });
  await tick();
  h.select('mesa-windows', '21');
  h.click('mesa-capture');
  const capture = h.lastToolCall('mesa_capture');
  assert.equal(h.el('mesa-capture').disabled, true, 'captura em andamento trava o botão');

  h.notify('ui/notifications/tool-result', {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: deskStructured({page: null, library: {files: [], truncated: false}}),
  });
  await tick();
  assert.equal(h.el('mesa-capture').disabled, true, 'painel sem captura válida não deixa capturar');
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');

  const late = pngFixture(130);
  h.respond(capture.id, {content: [imageOf(late), {type: 'text', text: 'meta'}], structuredContent: captureStructured({fixture: late, windowId: '21'})});
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), null, 'captura antiga não ressuscita');
  assert.equal(h.el('mesa-capture-notice').hidden, true);
  assert.equal(h.el('mesa-doc-label').textContent, 'Último PDF: exercicio.pdf — página 1 de 3', 'referência antiga é identificada como última, sem prévia ativa');
  assert.equal(h.el('mesa-help').disabled, true, 'sem prévia válida não há pedido de ajuda');
});

test('época: página em voo não repõe por cima de uma captura nova do host', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 4});
  h.click('mesa-next');
  const page = h.lastToolCall('mesa_page');
  assert.ok(page, 'navegação em andamento');

  const captureFixture = pngFixture(150);
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(captureFixture), {type: 'text', text: 'meta'}],
    structuredContent: captureStructured({fixture: captureFixture, windowId: '7', title: 'Rascunho'}),
  });
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + captureFixture.data);
  assert.equal(h.el('mesa-doc-label').textContent, 'Xournal++ — Rascunho');

  const latePage = pngFixture(170);
  h.respond(page.id, pageResponse({page: 2, fixture: latePage}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + captureFixture.data, 'página antiga não repõe a captura nova');
  assert.equal(h.el('mesa-doc-label').textContent, 'Xournal++ — Rascunho');
  assert.equal(h.el('mesa-page-input').value, '1', 'contexto de página preservado');
});

test('época: falha de prévia desliga a ajuda e torna a chamada em voo obsoleta', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 5});
  h.click('mesa-next');
  const call = h.lastToolCall('mesa_page');

  h.notify('ui/notifications/tool-result', {
    isError: true,
    content: [{type: 'text', text: JSON.stringify({ok: false, error: {code: 'PDF_MISSING', message: 'Sumiu.'}})}],
  });
  await tick();
  assert.match(h.el('mesa-error').textContent, /PDF_MISSING/);
  assert.equal(h.el('mesa-help').disabled, true, 'falha não deixa pedir ajuda com imagem velha');
  assert.equal(h.el('mesa-image').getAttribute('src'), null);

  h.respond(call.id, pageResponse({page: 2, fixture: pngFixture(160)}));
  await tick();
  assert.equal(h.el('mesa-image').getAttribute('src'), null, 'resposta em voo não ressuscita a prévia');
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');
  assert.equal(h.el('mesa-page-input').value, '1');
});

test('época: applyDesk com PNG divergente limpa a prévia e libera o busy (inclusive a ajuda)', async () => {
  const {h} = await bootWithPage({page: 2, numPages: 3});
  const fixture = pngFixture(120);
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(fixture)],
    structuredContent: deskStructured({
      page: pageStructured({page: 3, numPages: 3, imageBytes: fixture.bytes + 7}),
      library: {files: [{filePath: '/raiz/exercicio.pdf', name: 'exercicio.pdf'}], truncated: false},
    }),
  });
  await tick();
  assert.match(h.el('mesa-error').textContent, /bytes divergentes/);
  assert.equal(h.el('mesa-image').getAttribute('src'), null);
  assert.equal(h.el('mesa-image').hidden, true);
  assert.equal(h.el('mesa-viewport').getAttribute('aria-busy'), 'false');
  assert.equal(h.el('mesa-help').disabled, true);
  assert.equal(h.el('mesa-page-input').value, '2', 'contexto antigo preservado');
  assert.equal(h.el('mesa-page-total').textContent, '/ 3');

  const good = pngFixture(180);
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(good)],
    structuredContent: pageStructured({page: 1, numPages: 3, imageBytes: good.bytes}),
  });
  await tick();
  assert.equal(h.el('mesa-help').disabled, false, 'página válida depois da falha religa a ajuda');
  assert.equal(h.el('mesa-image').getAttribute('src'), 'data:image/png;base64,' + good.data);
});

test('ajuda: capability ausente desliga o botão e nenhum clique envia mensagem', async () => {
  const {h} = await bootWithPage({page: 1, numPages: 2, caps: {serverTools: {}}});
  assert.equal(h.el('mesa-help').disabled, true);
  assert.match(h.el('mesa-help').title, /não permite enviar mensagens/);
  h.click('mesa-help');
  h.click('mesa-help');
  assert.equal(h.requests('ui/message').length, 0, 'sem ui/message o painel não envia nada');

  const partial = await bootWithPage({page: 1, numPages: 2, caps: {serverTools: {}, message: {}}});
  assert.equal(partial.h.el('mesa-help').disabled, true, 'message sem text não habilita');
  assert.match(partial.h.el('mesa-help').title, /não permite enviar mensagens/);
});

test('capabilities (schema ext-apps 2026-01-26): message.text e updateModelContext.structuredContent são as modalidades exigidas', async () => {
  /* message.image não declara text: ui/message fica desligado (o painel só
     manda texto). */
  const withoutText = await bootWithPage({page: 1, numPages: 2, caps: {serverTools: {}, message: {image: {}}}});
  assert.equal(withoutText.h.el('mesa-help').disabled, true, 'message.image não declara text');
  assert.match(withoutText.h.el('mesa-help').title, /não permite enviar mensagens/);
  withoutText.h.click('mesa-help');
  assert.equal(withoutText.h.requests('ui/message').length, 0, 'não tenta a mensagem sem a modalidade declarada');

  /* updateModelContext.text não declara structuredContent: o painel só manda
     structuredContent, então não tenta a atualização. */
  const noStructured = await bootWithPage({page: 1, numPages: 2, caps: {serverTools: {}, updateModelContext: {text: {}}}});
  assert.equal(noStructured.h.requests('ui/update-model-context').length, 0, 'structuredContent não declarado não é enviado');
  assert.equal(noStructured.h.toolCalls('mesa_page').length, 0, 'a página veio no mesa_open');

  /* As duas chaves na forma do schema habilitam os dois pedidos. */
  const full = await bootWithPage({page: 1, numPages: 2, caps: {serverTools: {}, message: {text: {}}, updateModelContext: {structuredContent: {}}}});
  assert.equal(full.h.el('mesa-help').disabled, false, 'message.text habilita o pedido');
  assert.ok(full.h.lastRequest('ui/update-model-context'), 'structuredContent declarado é enviado');
  assert.equal(full.h.lastRequest('ui/update-model-context').params.structuredContent.mesa.page, 1);
  full.h.click('mesa-help');
  assert.equal(full.h.requests('ui/message').length, 1, 'ui/message sai com text declarado');
});

test('capabilities: host sem hostCapabilities desliga ferramentas e tenta mensagens com recusa honesta', async () => {
  /* `hostCapabilities` é obrigatório no resultado de ui/initialize no schema
     2026-01-26; `null` modela um host fora do padrão. Ferramentas ficam
     desativadas; mensagens tentam e mostram a recusa como falha honesta. */
  const {h} = await bootWithPage({page: 1, numPages: 2, caps: null});
  assert.equal(h.el('mesa-library').disabled, true, 'ferramentas exigem capacidade declarada');
  assert.equal(h.el('mesa-next').disabled, true);
  h.click('mesa-next');
  assert.equal(h.toolCalls('mesa_page').length, 0, 'host sem capabilities não recebe chamadas de ferramentas');
  assert.equal(h.el('mesa-help').disabled, false, 'sem capabilities o painel tenta o pedido');
  h.click('mesa-help');
  const message = h.lastRequest('ui/message');
  assert.ok(message, 'ui/message tentado mesmo sem hostCapabilities');
  assert.ok(Array.isArray(message.params.content), 'content continua sendo lista de blocos');
  h.respond(message.id, {isError: true});
  await tick();
  assert.match(h.el('mesa-error').textContent, /recusou/i, 'recusa real vira erro honesto');
  assert.match(h.el('mesa-status').textContent, /não enviado/i);
  assert.equal(h.el('mesa-help').disabled, false, 'dá para tentar de novo');
});

test('diagnóstico: handshake registra hostCapabilities cru no console do host (R4, teste real pendente)', async () => {
  const h = makeHarness();
  h.run();
  assert.equal(h.consoleCalls().length, 0, 'nada de diagnóstico antes do handshake');
  h.respond(h.lastRequest('ui/initialize').id, initResult({}));
  await tick();
  const infos = h.consoleCalls().filter((call) => call.method === 'info');
  assert.equal(infos.length, 1, 'uma linha de diagnóstico por handshake');
  const text = JSON.stringify(infos[0].args);
  assert.match(text, /hostCapabilities/, 'o teste real precisa do JSON cru');
  assert.match(text, /serverTools/);
  assert.match(text, /updateModelContext/, 'chave que habilita o contexto estruturado');
  assert.match(text, /message/, 'chave que habilita o pedido de ajuda');
});

test('ajuda: contexto válido atual (captura ou página), sem imagem anexada e um pedido por vez', async () => {
  const fixture = pngFixture(120);
  const {h} = await bootWithPage({page: 2, numPages: 4});

  h.click('mesa-help');
  const pageMessage = h.lastRequest('ui/message');
  assert.match(pageMessage.params.content[0].text, /página 2/);
  assert.match(pageMessage.params.content[0].text, /\/raiz\/exercicio\.pdf/);
  assert.equal(h.el('mesa-help').disabled, true, 'enquanto pendente não dá para reenviar');
  h.click('mesa-help');
  h.click('mesa-help');
  assert.equal(h.requests('ui/message').length, 1, 'duplo clique não duplica o pedido');
  h.respond(pageMessage.id, {});
  await tick();
  assert.equal(h.el('mesa-help').disabled, false, 'resposta libera o próximo pedido');

  h.click('mesa-check-xournal');
  const list = h.lastToolCall('mesa_windows');
  h.respond(list.id, {
    content: [{type: 'text', text: 'meta'}],
    structuredContent: {ok: true, kind: 'windows', windows: [{id: '31', app: 'Xournal++', title: 'Rascunho'}], count: 1},
  });
  await tick();
  h.select('mesa-windows', '31');
  h.click('mesa-capture');
  const capture = h.lastToolCall('mesa_capture');
  h.respond(capture.id, {content: [imageOf(fixture), {type: 'text', text: 'meta'}], structuredContent: captureStructured({fixture, windowId: '31', title: 'Rascunho'})});
  await tick();

  h.click('mesa-help');
  const captureMessage = h.lastRequest('ui/message');
  assert.notEqual(captureMessage.id, pageMessage.id);
  const text = captureMessage.params.content[0].text;
  assert.match(text, /mesa_capture/);
  assert.match(text, /windowId 31/);
  assert.match(text, /Rascunho/);
  assert.match(text, /nova captura|capturar de novo/i, 'pede captura nova, não reaproveita a do painel');
  assert.ok(!text.includes('/raiz/exercicio.pdf'), 'pedido da captura não carrega a referência antiga de PDF');
  assert.ok(!JSON.stringify(captureMessage.params).includes('data:image'), 'a imagem do painel nunca é anexada');
});

test('acessibilidade: rótulos, alerta vivo e avisos anunciados', () => {
  assert.match(HTML, /<img id="mesa-image"[^>]*aria-label="Prévia da página"/, 'imagem com rótulo acessível');
  assert.match(HTML, /<p id="mesa-error" role="alert"/, 'erro anunciado como alerta');
  assert.match(HTML, /<p id="mesa-status"[^>]*aria-live="polite"/, 'status ao vivo');
  assert.match(HTML, /<p id="mesa-status"[^>]*role="status"/, 'status com papel semântico');
  assert.match(HTML, /<p id="mesa-library-note"[^>]*role="status"/, 'nota da biblioteca anunciada');
  assert.match(HTML, /<span id="mesa-windows-status"[^>]*role="status"/, 'estado das janelas anunciado');
  assert.match(HTML, /<p id="mesa-capture-notice"[^>]*role="status"/, 'aviso de nova captura anunciado');
  assert.match(HTML, /<section id="mesa-viewport"[^>]*aria-busy="false"/, 'viewport reporta busy');
  const labelled = HTML.match(/<label for="(mesa-(?:library|page-input|windows|help-note))"[^>]*>/g) || [];
  assert.equal(labelled.length, 4, 'cada controle de formulário tem label associado');
  assert.match(HTML, /<button id="mesa-fullscreen"[^>]*hidden/, 'tela cheia começa escondida até o host declarar o modo');
  assert.match(HTML, /<aside id="mesa-study" aria-labelledby="mesa-study-title"/, 'a Tutoria tem nome acessível pela seção');
  assert.match(HTML, /<h2 id="mesa-study-title">Tutoria<\/h2>/, 'a seção de ajuda tem título visível');
  assert.match(HTML, /<span id="mesa-busy" class="pdf-busy" role="status" aria-live="polite" hidden><\/span>/, 'carregamento do leitor anunciado');
  assert.match(HTML, /<p id="mesa-help-pending" class="composer-pending" role="status" hidden>/, 'envio do pedido anunciado');
  assert.match(HTML, /<button id="mesa-help"[^>]*aria-describedby="mesa-context"/, 'o resumo do contexto descreve o pedido');
});

/* ---------- fora do host ---------- */

test('fora do aplicativo: não fala sozinho nem inventa dados', () => {
  const h = makeHarness({standalone: true});
  h.run();
  assert.equal(h.posted().length, 0, 'nenhuma mensagem sem host');
  assert.match(h.el('mesa-status').textContent, /Fora do aplicativo Codex/);
  assert.equal(h.el('mesa-help').disabled, true);
  assert.equal(h.el('mesa-check-xournal').disabled, true);
});


test('ajuda: confirmação mantém o tipo do pedido mesmo quando a prévia muda', async () => {
  const {h} = await bootWithPage({page: 2, numPages: 4});
  h.click('mesa-help');
  const pageMessage = h.lastRequest('ui/message');
  const fixture = pngFixture(120);
  h.notify('ui/notifications/tool-result', {
    content: [imageOf(fixture)],
    structuredContent: captureStructured({fixture, windowId: '31', title: 'Rascunho'}),
  });
  await tick();
  assert.match(h.el('mesa-doc-label').textContent, /Xournal/);
  h.respond(pageMessage.id, {});
  await tick();
  assert.equal(h.el('mesa-status').textContent, 'Pedido enviado ao tutor.');
  assert.match(pageMessage.params.content[0].text, /página 2/);

  h.click('mesa-help');
  const captureMessage = h.lastRequest('ui/message');
  h.notify('ui/notifications/tool-result', pageResponse({page: 3, fixture: pngFixture(130)}));
  await tick();
  assert.doesNotMatch(h.el('mesa-doc-label').textContent, /Xournal/);
  h.respond(captureMessage.id, {});
  await tick();
  assert.equal(h.el('mesa-status').textContent, 'Pedido de conferência enviado ao tutor.');
  assert.match(captureMessage.params.content[0].text, /windowId 31/);
});
