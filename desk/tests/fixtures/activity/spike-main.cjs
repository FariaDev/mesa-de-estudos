'use strict';

/* Harness sintético do spike de contenção de atividade (independente do app).
   Uso real: `node tests/hunt-activity-spike.mjs` — o hunt sobe este main com
   Playwright `_electron` e lê `global.__spike`. Nada aqui é produto. */

const {app, BrowserWindow, WebContentsView, protocol} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const dgram = require('node:dgram');

const DIR = __dirname;
const FIXTURE = process.env.SPIKE_FIXTURE || 'probe.html';
const FIXTURE_ID = process.env.SPIKE_ID || FIXTURE;
const SCHEME = 'mesa-activity-spike';

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: {standard: true, secure: true, stream: true, supportFetchAPI: false, corsEnabled: false},
}]);

const httpCounts = Object.create(null);
let udpHits = 0;
let httpServer = null;
let udpServer = null;
let httpPort = 0;
let udpPort = 0;
let win = null;
let view = null;
const navLog = [];
const processLog = [];
const allowedFirstLoad = [];

function serveArtifact(request) {
  let name = 'probe.html';
  try {
    const url = new URL(request.url);
    name = path.basename(url.pathname) || 'probe.html';
  } catch { /* usa o default */ }
  const file = path.join(DIR, name);
  const type = name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : 'text/html';
  const body = fs.readFileSync(file);
  return new Response(body, {headers: {'content-type': `${type}; charset=utf-8`}});
}

function startProbes() {
  httpServer = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    httpCounts[url.pathname] = (httpCounts[url.pathname] || 0) + 1;
    if (url.pathname === '/es') {
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store'});
      res.write('data: hi\n\n');
      setTimeout(() => res.end(), 250);
      return;
    }
    if (url.pathname === '/ws') {
      res.writeHead(400).end();
      return;
    }
    res.writeHead(200, {'content-type': 'text/plain'});
    res.end('ok');
  });
  httpServer.on('upgrade', (req) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    httpCounts[url.pathname] = (httpCounts[url.pathname] || 0) + 1;
    req.socket.destroy();
  });
  udpServer = dgram.createSocket('udp4');
  udpServer.on('message', () => { udpHits += 1; });
  return new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      httpPort = httpServer.address().port;
      udpServer.bind(0, '127.0.0.1', () => {
        udpPort = udpServer.address().port;
        resolve();
      });
    });
  });
}

function frameInfo() {
  if (!win || win.isDestroyed()) return [];
  const out = [];
  for (const frame of win.webContents.mainFrame.frames) {
    out.push({
      url: frame.url,
      processId: frame.processId,
      routingId: frame.routingId,
      osProcessId: (typeof frame.osProcessId === 'number') ? frame.osProcessId : null,
    });
  }
  return out;
}

function metrics() {
  return app.getAppMetrics().map((m) => ({
    pid: m.pid,
    type: m.type,
    cpu: m.cpu ? m.cpu.percentCPUUsage : 0,
    memory: m.memory ? m.memory.workingSetSize : 0,
  }));
}

async function makeWindow() {
  win = new BrowserWindow({
    show: false,
    width: 980,
    height: 760,
    webPreferences: {contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false},
  });
  win.webContents.on('will-frame-navigate', (event) => {
    navLog.push({url: event.url, isMainFrame: event.isMainFrame, frameProcessId: event.frameProcessId, frameRoutingId: event.frameRoutingId});
    if (event.isMainFrame) return;
    const index = allowedFirstLoad.indexOf(event.url);
    if (index >= 0) {
      allowedFirstLoad.splice(index, 1);
      return;
    }
    event.preventDefault();
  });
  win.webContents.on('unresponsive', () => processLog.push({at: Date.now(), type: 'unresponsive'}));
  win.webContents.on('responsive', () => processLog.push({at: Date.now(), type: 'responsive'}));
  win.webContents.on('render-process-gone', (_e, details) => processLog.push({at: Date.now(), type: 'gone', reason: details && details.reason}));
  await win.loadFile(path.join(DIR, 'spike-parent.html'));
}

global.__spike = {
  ready: true,
  counts: () => ({http: {...httpCounts}, udp: udpHits}),
  ports: () => ({http: httpPort, udp: udpPort}),
  url: () => (win && !win.isDestroyed() ? win.webContents.getURL() : ''),
  beat: () => win.webContents.executeJavaScript('window.__beat', true),
  messages: () => win.webContents.executeJavaScript('window.__messages||[]', true),
  clearMessages: () => win.webContents.executeJavaScript('window.__messages=[];true', true),
  mount: (url) => win.webContents.executeJavaScript(`window.mount(${JSON.stringify(url)})`, true),
  mountSafe: (url, ms = 5000) => {
    allowedFirstLoad.push(url);
    return Promise.race([
      win.webContents.executeJavaScript(`window.mount(${JSON.stringify(url)})`, true).catch((error) => 'ERR:' + String(error && error.message || error)),
      new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), ms)),
    ]);
  },
  unmount: () => win.webContents.executeJavaScript('window.unmount()', true),
  beatSafe: (ms = 1200) => Promise.race([
    win.webContents.executeJavaScript('window.__beat', true).catch((error) => 'ERR:' + String(error && error.message || error)),
    new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), ms)),
  ]),
  unmountSafe: (ms = 3000) => Promise.race([
    win.webContents.executeJavaScript('window.unmount()', true).catch((error) => 'ERR:' + String(error && error.message || error)),
    new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), ms)),
  ]),
  frameInfo,
  metrics,
  probeFrame: (ms = 1500) => {
    if (!win || win.isDestroyed()) return Promise.resolve('no-frame');
    const frame = win.webContents.mainFrame.frames[0];
    if (!frame) return Promise.resolve('no-frame');
    return Promise.race([
      frame.executeJavaScript('1+1').then(() => 'ALIVE').catch((error) => 'ERR:' + String(error && error.message || error)),
      new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), ms)),
    ]);
  },
  navLog: () => navLog.slice(),
  processLog: () => processLog.slice(),
  reloadWindow: () => win.webContents.reload(),
  makeView: async (name) => {
    if (view) return {pid: view.webContents.getOSProcessId()};
    view = new WebContentsView({
      webPreferences: {
        partition: `spike-view-${Date.now()}`,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    view.webContents.session.protocol.handle(SCHEME, serveArtifact);
    win.contentView.addChildView(view);
    view.setBounds({x: 10, y: 10, width: 420, height: 300});
    /* Sem await de loadURL: um laço no documento nunca dispara did-finish-load
       (medido); a view é encerrável do main mesmo assim. */
    view.webContents.loadURL(`${SCHEME}://artifact/${name || FIXTURE_ID}?http=${httpPort}&udp=${udpPort}`).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {pid: view.webContents.getOSProcessId(), url: view.webContents.getURL()};
  },
  viewBeat: () => (view ? view.webContents.executeJavaScript('window.__beat||0', true) : 0),
  destroyView: () => {
    if (!view) return false;
    const pid = view.webContents.getOSProcessId();
    try { view.webContents.close(); } catch { /* já foi */ }
    try { win.contentView.removeChildView(view); } catch { /* já foi */ }
    view = null;
    return pid;
  },
  quit: () => app.quit(),
};

app.whenReady().then(async () => {
  protocol.handle(SCHEME, serveArtifact);
  await startProbes();
  await makeWindow();
}).catch((error) => {
  console.error('spike-main falhou:', error);
  app.exit(1);
});
