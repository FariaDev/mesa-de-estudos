'use strict';

/* Electron falso com nome para o `geogebra-host.cjs` (#53): uma janela que
   anota o que o main mandaria ao renderer e uma `WebContentsView` cujo
   `executeJavaScript` roda o código REAL do host contra um `FakeGgbApplet`
   (módulo `vm`), então abertura, restauração e comandos passam pelo caminho de
   verdade, só sem Chromium e sem internet. */
const vm = require('node:vm');

class FakeWebContents {
  constructor(applet, {ready}) {
    this.applet = applet;
    this.ready = ready;
    this.listeners = new Map();
    this.destroyed = false;
    this.loads = [];
    this.urls = [];
    /* Sessão que só anota o que o host liga nela (#55): protocolo e filtro de rede. */
    this.session = {
      handledSchemes: [],
      networkFilter: null,
      protocol: {handle: (scheme) => this.session.handledSchemes.push(scheme)},
      webRequest: {onBeforeRequest: (filter) => { this.session.networkFilter = filter; }},
    };
  }

  on(event, listener) { this.listeners.set(event, listener); }
  isDestroyed() { return this.destroyed; }

  /* O documento carrega "depois": o host só confia no applet depois do evento. */
  async loadFile(file) {
    this.loads.push(file);
    setTimeout(() => this.listeners.get('did-finish-load')?.(), 5);
  }

  async loadURL(url) {
    this.urls.push(url);
    setTimeout(() => this.listeners.get('did-finish-load')?.(), 5);
  }

  executeJavaScript(code) {
    const window = {ggbApplet: this.applet};
    Object.defineProperty(window, '__ggbReady', {get: () => this.ready.value});
    const context = vm.createContext({window, setTimeout, Promise});
    return Promise.resolve(vm.runInContext(code, context));
  }

  async capturePage() {
    return {isEmpty: () => false, toPNG: () => Buffer.from('png-falso')};
  }
}

/** @param {import('./fake-ggb-applet.cjs').FakeGgbApplet} applet @param {{value: boolean}} ready `value` pode virar true depois. */
function createFakeViewClass(applet, ready) {
  return class FakeWebContentsView {
    static instances = [];

    constructor() {
      FakeWebContentsView.instances.push(this);
      this.webContents = new FakeWebContents(applet, {ready});
      this.visible = true;
      this.bounds = null;
    }

    setBounds(bounds) { this.bounds = bounds; }
    setVisible(value) { this.visible = value; }
  };
}

/** Janela que registra os envios ao renderer; `onSend` deixa o teste responder como o renderer faria. */
function createFakeWindow(onSend = () => {}) {
  const sent = [];
  return {
    sent,
    contentView: {addChildView() {}},
    webContents: {send(channel, payload) { sent.push({channel, payload}); onSend(channel, payload); }},
    isDestroyed: () => false,
  };
}

/** `ipcMain` que guarda os handlers para o teste os chamar. */
function createFakeIpcMain() {
  const handlers = new Map();
  return {handlers, handle: (channel, fn) => handlers.set(channel, fn), invoke: (channel, payload) => handlers.get(channel)({}, payload)};
}

module.exports = {createFakeViewClass, createFakeWindow, createFakeIpcMain};
