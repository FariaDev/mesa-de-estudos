'use strict';

/* Fixture da prova do watchdog com processo compartilhado: 3 atividades no
   mesmo OOPIF (mesmo esquema), uma delas com laço; Parar deve permitir o kill
   quando TODOS os frames vivos do pid estiverem confirmados travados, e uma
   montagem nova deve carregar no processo seguinte. Nada de app pessoal. */

const {app, BrowserWindow, protocol, session, ipcMain} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {createActivityStore} = require('../../../activity-store.cjs');
const {createActivityRuntime, ACTIVITY_SCHEME, activityArtifactUrl} = require('../../../activity-runtime.cjs');

const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-activity-watchdog-'));
protocol.registerSchemesAsPrivileged([{
  scheme: ACTIVITY_SCHEME,
  privileges: {standard: true, secure: true, stream: true, supportFetchAPI: false, corsEnabled: false},
}]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let win = null;

const healthyJs = (label) => `
  window.mesa.onMessage(function (message) { if (message.type === 'init' && message.state) window.mesa.state(message.state); });
  var el = document.createElement('p'); el.id = 'healthy'; el.textContent = ${JSON.stringify(label)};
  document.getElementById('mesa-activity-root').appendChild(el);
  top.postMessage({probe: 'healthy-ready', label: ${JSON.stringify(label)}}, '*');
  window.mesa.state({label: ${JSON.stringify(label)}});
  window.mesa.ready();`;
const loopJs = `top.postMessage({probe:'loop-started'},'*');while(true){}`;
const nextJs = `top.postMessage({probe:'next-ready'},'*');window.mesa.ready();`;

app.whenReady().then(async () => {
  const specs = {
    'healthy-a': {title: 'saudável A', objective: 'a', alternativeMarkdown: 'a', html: '<p>a</p>', css: '', katex: false, js: healthyJs('a')},
    'healthy-b': {title: 'saudável B', objective: 'b', alternativeMarkdown: 'b', html: '<p>b</p>', css: '', katex: false, js: healthyJs('b')},
    loop: {title: 'laço', objective: 'laço', alternativeMarkdown: 'laço', html: '<p>l</p>', css: '', katex: false, js: loopJs},
  };
  const store = createActivityStore({runtime: runtimeDir});
  const watchdogLog = [];
  const activityRuntime = createActivityRuntime({store, onWatchdog: (event) => watchdogLog.push(event)});
  activityRuntime.installProtocol(session.defaultSession);
  activityRuntime.installSessionGuards(session.defaultSession);
  const conversationId = path.join(runtimeDir, 'wd.jsonl');
  const urls = {};
  for (const [name, spec] of Object.entries(specs)) {
    const item = await store.publish({conversationId, generation: 1, toolCallId: `wd-${name}`, spec});
    activityRuntime.remember(item, spec);
    urls[name] = activityArtifactUrl(item.id, item.version, 'system');
  }
  let nextCounter = 0;
  const publishNext = async () => {
    nextCounter += 1;
    const spec = {title: `nova ${nextCounter}`, objective: 'n', alternativeMarkdown: 'n', html: '<p>n</p>', css: '', katex: false, js: nextJs};
    const item = await store.publish({conversationId, generation: 1, toolCallId: `wd-next-${nextCounter}`, spec});
    activityRuntime.remember(item, spec);
    return activityArtifactUrl(item.id, item.version, 'system');
  };

  win = new BrowserWindow({show: false, width: 1000, height: 760, webPreferences: {preload: path.join(__dirname, 'watchdog-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false}});
ipcMain.handle('wd-ping', (event) => { try { return event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame ? 'ok' : 'denied'; } catch (error) { return 'throw:' + String(error.message || error); } });
  activityRuntime.attachWindow(win);
  await win.loadURL('data:text/html,<html><body><script>window.__probes=[];window.addEventListener("message",function(e){window.__probes.push(e.data)});window.__frames={};window.__mount=function(name,url){var f=document.createElement("iframe");f.setAttribute("sandbox","allow-scripts");f.setAttribute("referrerpolicy","no-referrer");f.dataset.name=name;f.src=url;document.body.appendChild(f);window.__frames[name]=f;return true};window.__unmount=function(name){var f=window.__frames[name];if(f)f.remove();delete window.__frames[name];return true};window.__beat=0;setInterval(function(){window.__beat+=1},4);</script></body></html>');

  const frameInfo = () => {
    let main;
    try { main = win.webContents.mainFrame; } catch (error) { return [{error: 'mainFrame:' + String((error && error.message) || error)}]; }
    if (!main) return [{error: 'mainFrame:null'}];
    try {
      return main.framesInSubtree.map((frame) => ({url: String(frame.url || ''), osPid: frame.osProcessId, name: frame.name || ''}));
    } catch (error) { return [{error: 'framesInSubtree:' + String((error && error.message) || error)}]; }
  };
  const metrics = () => {
    try { return require('electron').app.getAppMetrics().map((m) => ({pid: m.pid, type: m.type, cpu: Math.round((m.cpu && m.cpu.percentCPUUsage) || 0), creationTime: m.creationTime})); } catch { return []; }
  };
  /* Injeção de falha da cena R6 P2: enumeração tem de ser completa ou o kill
     é recusado; nunca pode ser lida como "não há outros frames". */
  const faults = {executeJavaScript: null, executeJavaScriptPatched: false, getAllWebContents: null, stallNeedles: []};
  const frameProto = () => Object.getPrototypeOf(win.webContents.mainFrame);
  const activityFrames = () => [...win.webContents.mainFrame.framesInSubtree];
  const activityPid = () => {
    try {
      const pids = [...new Set(activityFrames().filter((frame) => { try { return String(frame.url || '').startsWith('mesa-activity://'); } catch (error) { return false; } }).map((frame) => { try { return frame.osProcessId; } catch (error) { return 0; } }))];
      return pids.length === 1 ? pids[0] : 0;
    } catch (error) { return 0; }
  };
  const inject = (kind, needle) => {
    const electron = require('electron');
    if (kind === 'stall') {
      if (needle && !faults.stallNeedles.includes(needle)) faults.stallNeedles.push(needle);
      if (!faults.executeJavaScriptPatched) {
        const original = frameProto().executeJavaScript;
        faults.executeJavaScript = original;
        frameProto().executeJavaScript = function (...args) {
          let url;
          try { url = String(this.url || ''); } catch (error) { url = ''; }
          for (const candidate of faults.stallNeedles) {
            if (url.includes(candidate)) throw new Error('injected per-frame stall');
          }
          return original.apply(this, args);
        };
        faults.executeJavaScriptPatched = true;
      }
      return true;
    }
    if (kind === 'getAllWebContents') {
      if (!faults.getAllWebContents) faults.getAllWebContents = electron.webContents.getAllWebContents;
      electron.webContents.getAllWebContents = function () { throw new Error('injected getAllWebContents failure'); };
      return true;
    }
    if (kind === 'framesInSubtree') {
      Object.defineProperty(win.webContents.mainFrame, 'framesInSubtree', {configurable: true, get() { throw new Error('injected framesInSubtree failure'); }});
      return true;
    }
    if (kind === 'osProcessId') {
      let frame;
      try { frame = activityFrames().find((candidate) => { try { return needle && String(candidate.url || '').includes(needle); } catch (error) { return false; } }); } catch (error) { frame = null; }
      Object.defineProperty(frame || win.webContents.mainFrame, 'osProcessId', {configurable: true, get() { throw new Error('injected osProcessId failure'); }});
      return true;
    }
    return false;
  };
  const heal = (kind) => {
    const electron = require('electron');
    if (!kind || kind === 'stall') {
      if (faults.executeJavaScriptPatched) { frameProto().executeJavaScript = faults.executeJavaScript; faults.executeJavaScript = null; faults.executeJavaScriptPatched = false; faults.stallNeedles = []; }
    }
    if (!kind || kind === 'getAllWebContents') {
      if (faults.getAllWebContents) { electron.webContents.getAllWebContents = faults.getAllWebContents; faults.getAllWebContents = null; }
    }
    if (!kind || kind === 'framesInSubtree') {
      try { delete win.webContents.mainFrame.framesInSubtree; } catch (error) { /* já sarado */ }
    }
    if (!kind || kind === 'osProcessId') {
      try {
        for (const frame of activityFrames()) { try { delete frame.osProcessId; } catch (error) { /* já sarado */ } }
      } catch (error) { /* árvore momentaneamente ilegível */ }
    }
    return true;
  };
  global.__wd = {
    urls: () => ({...urls}),
    mount: (name, url) => win.webContents.executeJavaScript(`window.__mount(${JSON.stringify(name)}, ${JSON.stringify(url)})`),
    unmount: (name) => win.webContents.executeJavaScript(`window.__unmount(${JSON.stringify(name)})`),
    probes: () => win.webContents.executeJavaScript('window.__probes.slice()'),
    clearProbes: () => win.webContents.executeJavaScript('window.__probes.length=0;1'),
    beat: async () => {
      const first = await win.webContents.executeJavaScript('window.__beat');
      await sleep(400);
      const second = await win.webContents.executeJavaScript('window.__beat');
      return second - first;
    },
    frames: frameInfo,
    metrics,
    watchdog: () => watchdogLog.slice(),
    publishNext,
    inject,
    heal,
    activityPid,
    pidOf: (needle) => {
      const frame = frameInfo().find((entry) => entry.url.includes(needle));
      return frame ? frame.osPid : 0;
    },
    ping: () => win.webContents.executeJavaScript('window.__ping()', true),
    cleanup: () => {
      try { win.destroy(); } catch {}
      fs.rmSync(runtimeDir, {recursive: true, force: true});
    },
  };
  console.log('watchdog fixture ready', urls);
}).catch((error) => {
  console.error('watchdog fixture falhou:', error);
  app.exit(1);
});
