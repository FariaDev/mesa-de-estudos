'use strict';

/* Fixture da prova do watchdog: um site (e um processo) por REVISÃO (#89),
   então o laço trava só o próprio frame e as outras revisões/atividades
   respondem. Depois do Parar, o watchdog mata só o processo destacado. A cena
   compartilhada monta a MESMA revisão duas vezes (mesmo host) para provar que
   o isolamento é por revisão, não por card. Um host de 78 caracteres prova o
   teto id+versão no Chromium (#89). Nada de app pessoal. */

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
  /* Duas revisões da MESMA atividade (#89): a v1 entra em laço real e a v2
     fica saudável; hosts (e processos) distintos. */
  const revLoop = await store.publish({conversationId, generation: 1, toolCallId: 'wd-rev-loop', spec: specs.loop});
  activityRuntime.remember(revLoop, specs.loop);
  const revHealthy = await store.publish({conversationId, generation: 1, toolCallId: 'wd-rev-healthy', activityId: revLoop.id, spec: specs['healthy-b']});
  activityRuntime.remember(revHealthy, specs['healthy-b']);
  urls['rev-loop'] = activityArtifactUrl(revLoop.id, revLoop.version, 'system');
  urls['rev-healthy'] = activityArtifactUrl(revHealthy.id, revHealthy.version, 'system');
  let nextCounter = 0;
  const publishWith = async (spec) => {
    nextCounter += 1;
    const item = await store.publish({conversationId, generation: 1, toolCallId: `wd-next-${nextCounter}`, spec});
    activityRuntime.remember(item, spec);
    return activityArtifactUrl(item.id, item.version, 'system');
  };
  const publishNext = async () => {
    const spec = {title: `nova ${nextCounter + 1}`, objective: 'n', alternativeMarkdown: 'n', html: '<p>n</p>', css: '', katex: false, js: nextJs};
    return publishWith(spec);
  };
  /* Host no teto por construção (#89): id máximo do store + `--v` + 7 dígitos
     = 78. O Chromium precisa carregar esse host no esquema (justificativa). */
  const publishLongHost = () => {
    const id = `act-${'a'.repeat(64)}`;
    const spec = {...specs['healthy-b'], title: 'host longo'};
    activityRuntime.remember({id, version: 1000000}, spec);
    return activityArtifactUrl(id, 1000000, 'system');
  };
  /* Laço numa atividade NOVA (site e processo próprios) para o Parar rápido. */
  const publishLoop = async () => {
    const spec = {...specs.loop, title: `laço rápido ${nextCounter + 1}`};
    return publishWith(spec);
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
      return main.framesInSubtree.map((frame) => ({url: String(frame.url || ''), osPid: frame.osProcessId}));
    } catch (error) { return [{error: 'framesInSubtree:' + String((error && error.message) || error)}]; }
  };
  const metrics = () => {
    try { return require('electron').app.getAppMetrics().map((m) => ({pid: m.pid, type: m.type, cpu: Math.round((m.cpu && m.cpu.percentCPUUsage) || 0), creationTime: m.creationTime})); } catch { return []; }
  };
  const activityFrames = () => {
    try { return [...win.webContents.mainFrame.framesInSubtree]; } catch (error) { return []; }
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
    /* Responde só se a thread daquele frame estiver livre (o laço no próprio
       processo não pode contaminar a leitura — #88). */
    probe: async (needle) => {
      const frame = activityFrames().find((candidate) => {
        try { return String(candidate.url || '').includes(needle); } catch (error) { return false; }
      });
      if (!frame) return 'missing';
      return Promise.race([
        frame.executeJavaScript('1', false).then(() => 'ok').catch(() => 'error'),
        sleep(1500).then(() => 'timeout'),
      ]);
    },
    frames: frameInfo,
    metrics,
    watchdog: () => watchdogLog.slice(),
    publishNext,
    publishLoop,
    publishLongHost,
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
