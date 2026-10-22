'use strict';

/* Fixture do hunt de isolamento do runtime REAL de atividades: publica specs
   adversariais (todos os vetores de criação de subframe conhecidos) e um spec
   legítimo (DOM/SVG/canvas), monta cada artefato pelo protocolo `mesa-activity`
   e mede: scripts de filho executados, frames criados, HTTP e UDP/STUN. Nenhum
   app pessoal, nenhum provedor. Uso: `node tests/hunt-activity-isolation.mjs`. */

const {app, BrowserWindow, protocol, session} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const dgram = require('node:dgram');
const {createActivityStore} = require('../../../activity-store.cjs');
const {createActivityRuntime, ACTIVITY_SCHEME, activityArtifactUrl} = require('../../../activity-runtime.cjs');

const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-activity-isolation-'));
protocol.registerSchemesAsPrivileged([{
  scheme: ACTIVITY_SCHEME,
  privileges: {standard: true, secure: true, stream: true, supportFetchAPI: false, corsEnabled: false},
}]);

let win = null;
const state = {udp: 0, udpDetail: [], http: Object.create(null), mounted: [], frames: [], messages: []};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startUdp = () => new Promise((resolve) => {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (message, info) => {
    state.udp += 1;
    if (state.udpDetail.length < 12) state.udpDetail.push({len: message.length, from: `${info.address}:${info.port}`});
  });
  socket.bind(0, '127.0.0.1', () => resolve({socket, port: socket.address().port}));
});

const startHttp = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    state.http[url.pathname] = (state.http[url.pathname] || 0) + 1;
    res.writeHead(200, {'content-type': 'text/plain', 'cache-control': 'no-store'});
    res.end('probe');
  });
  server.listen(0, '127.0.0.1', () => resolve({server, port: server.address().port}));
});

app.whenReady().then(async () => {
  const {socket: udpSocket, port: udpPort} = await startUdp();
  const {server: httpServer, port: httpPort} = await startHttp();

  const child = `<script>
try { top.postMessage({probe:'childRan', rtc: typeof RTCPeerConnection, wt: typeof WebTransport, md: typeof navigator.mediaDevices, path: location.pathname}, '*'); } catch (error) {}
try {
  var pc = new RTCPeerConnection({iceServers: [{urls: 'stun:127.0.0.1:${udpPort}'}]});
  pc.createDataChannel('c');
  pc.createOffer().then(function (offer) { return pc.setLocalDescription(offer); }).then(function () { try { top.postMessage({probe:'childGathering'}, '*'); } catch (error) {} }).catch(function () {});
} catch (error) { try { top.postMessage({probe:'childRtcThrow'}, '*'); } catch (nested) {} }
<\/script>`;
  const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const tag = `<iframe srcdoc="${attr(child)}"></iframe>`;
  const fetchBody = `fetch('http://127.0.0.1:${httpPort}/fetch').then(function(){top.postMessage({probe:'fetchOk'},'*');},function(){top.postMessage({probe:'fetchBlocked'},'*');});`;
  /* Declarative Shadow DOM: a classe que reabria o filho sem lockdown. */
  const dsd = `<div id="h"><template shadowrootmode="open">${tag}</template></div>`;
  const dsdClosed = `<div id="h"><template shadowrootmode="closed">${tag}</template></div>`;
  const dsdClonable = `<div id="h"><template shadowrootmode="open" shadowrootclonable shadowrootdelegatesfocus>${tag}</template></div>`;

  const vectorSources = {
    'srcdoc-property': `var f=document.createElement('iframe');f.id='iso';f.srcdoc=CHILD;document.body.appendChild(f);`,
    'srcdoc-setAttribute': `var f=document.createElement('iframe');f.id='iso';document.body.appendChild(f);f.setAttribute('srcdoc', CHILD);`,
    'srcdoc-innerHTML': `document.body.innerHTML=TAG;`,
    'srcdoc-div-innerHTML': `var d=document.createElement('div');d.innerHTML=TAG;document.body.appendChild(d);`,
    'srcdoc-insertAdjacentHTML': `var d=document.createElement('div');document.body.appendChild(d);d.insertAdjacentHTML('beforeend', TAG);`,
    'srcdoc-outerHTML': `var d=document.createElement('div');document.body.appendChild(d);d.outerHTML='<div id="x">'+TAG+'</div>';`,
    'srcdoc-document-write': `document.write(TAG);`,
    'srcdoc-document-writeln': `document.writeln(TAG);`,
    'srcdoc-nested-deep': `var d=document.createElement('div');d.innerHTML='<div><span>'+TAG+'</span></div>';document.body.appendChild(d);`,
    'srcdoc-createElementNS': `var f=document.createElementNS(null,'iframe');f.srcdoc=CHILD;document.body.appendChild(f);`,
    'srcdoc-svg-foreignObject': `var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');var fo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');svg.appendChild(fo);document.body.appendChild(svg);var d=document.createElement('div');fo.appendChild(d);d.innerHTML=TAG;`,
    'srcdoc-DOMParser': `var doc=new DOMParser().parseFromString(TAG,'text/html');document.body.appendChild(document.adoptNode(doc.querySelector('iframe')));`,
    'srcdoc-contextual-fragment': `var range=document.createRange();range.selectNodeContents(document.body);var fragment=range.createContextualFragment(TAG);document.body.appendChild(fragment);`,
    'srcdoc-range-insertNode': `var doc=new DOMParser().parseFromString(TAG,'text/html');var range=document.createRange();range.selectNodeContents(document.body);range.insertNode(doc.querySelector('iframe'));`,
    'srcdoc-template': `var template=document.createElement('template');template.innerHTML=TAG;document.body.appendChild(template.content);`,
    'srcdoc-setHTMLUnsafe': `var d=document.createElement('div');document.body.appendChild(d);d.setHTMLUnsafe(TAG);`,
    'srcdoc-setHTML': `var d=document.createElement('div');document.body.appendChild(d);d.setHTML(TAG);`,
    'srcdoc-doc-implementation': `var doc=document.implementation.createHTMLDocument('x');doc.body.innerHTML=TAG;document.body.appendChild(document.importNode(doc.body.firstChild,true));`,
    'srcdoc-clone': `var doc=new DOMParser().parseFromString(TAG,'text/html');document.documentElement.appendChild(doc.querySelector('iframe').cloneNode(true));`,
    'srcdoc-execCommand': `var d=document.createElement('div');d.setAttribute('contenteditable','true');document.body.appendChild(d);d.focus();document.execCommand('insertHTML',false,TAG);`,
    'srcdoc-about-blank-write': `var f=document.createElement('iframe');f.id='iso';document.body.appendChild(f);f.contentWindow.document.write(CHILD);`,
    'srcdoc-data-url': `var f=document.createElement('iframe');f.id='iso';f.src='data:text/html,'+encodeURIComponent(CHILD);document.body.appendChild(f);`,
    /* --- R6 P1: declarative shadow DOM por sinks de HTML nomeados --- */
    'dsd-setHTMLUnsafe': `var d=document.createElement('div');document.body.appendChild(d);d.setHTMLUnsafe(DSD);`,
    'dsd-shadowRoot-setHTMLUnsafe': `var d=document.createElement('div');document.body.appendChild(d);var sr=d.attachShadow({mode:'open'});sr.setHTMLUnsafe(DSD);`,
    'dsd-static-parseHTMLUnsafe': `var doc=Document.parseHTMLUnsafe(DSD);var host=doc&&doc.body?doc.body.firstChild:null;if(host){document.body.appendChild(document.adoptNode(host));}`,
    'dsd-createHTMLDocument-setHTMLUnsafe': `var doc=document.implementation.createHTMLDocument('x');var d=doc.createElement('div');doc.body.appendChild(d);d.setHTMLUnsafe(DSD);document.body.appendChild(document.adoptNode(d));`,
    'dsd-setHTMLUnsafe-policy': `var value=window.trustedTypes&&trustedTypes.defaultPolicy?trustedTypes.defaultPolicy.createHTML(DSD):DSD;var d=document.createElement('div');document.body.appendChild(d);d.setHTMLUnsafe(value);`,
    'dsd-closed-setHTMLUnsafe': `var d=document.createElement('div');document.body.appendChild(d);d.setHTMLUnsafe(DSD_CLOSED);`,
    'dsd-clonable-setHTMLUnsafe': `var d=document.createElement('div');document.body.appendChild(d);d.setHTMLUnsafe(DSD_CLONABLE);var host=d.firstChild;if(host){document.body.appendChild(host.cloneNode(true));}`,
    'dsd-import-parseHTMLUnsafe': `var doc=Document.parseHTMLUnsafe(DSD);var host=doc.querySelector('#h');if(host){document.body.appendChild(document.importNode(host,true));}`,
    'dsd-sanitizer-options': `var options={allowElements:['iframe','portal','fencedframe'],allowAttributes:{srcdoc:['iframe'],shadowrootmode:['template']}};var d=document.createElement('div');document.body.appendChild(d);try{d.setHTML(DSD,{sanitizer:new Sanitizer(options)});}catch(error){try{d.setHTMLUnsafe(DSD);}catch(nested){}}`,
    'dsd-poisoned': `try{Object.defineProperty(Element.prototype,'getAttributeNames',{value:function(){return ['srcdoc']},configurable:true});}catch(error){}
      try{Object.defineProperty(Element.prototype,'removeAttribute',{value:function(){},configurable:true});}catch(error){}
      try{Object.defineProperty(HTMLTemplateElement.prototype,'content',{get:function(){return null},configurable:true});}catch(error){}
      try{Object.defineProperty(Element.prototype,'shadowRoot',{get:function(){return null},configurable:true});}catch(error){}
      var d=document.createElement('div');document.body.appendChild(d);try{d.setHTMLUnsafe(DSD);}catch(error){}`,
    'dsd-domparker': `var doc=new DOMParser().parseFromString(DSD,'text/html');var host=doc.body.firstChild;if(host){document.body.appendChild(document.adoptNode(host));}`,
    'dsd-contextual-fragment': `var range=document.createRange();range.selectNodeContents(document.body);var fragment=range.createContextualFragment(DSD);document.body.appendChild(fragment);`,
    'dsd-static-parseHTML': `var doc=Document.parseHTML(DSD);var host=doc.querySelector('#h');if(host){document.body.appendChild(document.importNode(host,true));}`,
    'network-fetch': fetchBody,
    'escape-window-open': `var result=window.open('about:blank');top.postMessage({probe:'windowOpen',detail:String(result)},'*');`,
    'escape-parent-document': `try{var ok=!!top.document;top.postMessage({probe:'parentDocument',detail:String(ok)},'*');}catch(error){top.postMessage({probe:'parentDocument',detail:'blocked'},'*');}`,
    'poison-prototype': `try{Object.defineProperty(Array.prototype,'indexOf',{value:function(){return -1},configurable:true});}catch(error){}
      try{Object.defineProperty(String.prototype,'toLowerCase',{value:function(){return 'div'},configurable:true});}catch(error){}
      try{Object.defineProperty(Node.prototype,'firstChild',{get:function(){return null},configurable:true});}catch(error){}
      try{Object.defineProperty(Node.prototype,'nextSibling',{get:function(){return null},configurable:true});}catch(error){}
      try{Object.defineProperty(Element.prototype,'localName',{get:function(){return 'div'},configurable:true});}catch(error){}
      try{Object.defineProperty(NodeList.prototype,'item',{value:function(){return null},configurable:true});}catch(error){}
      try{Reflect.apply = function(){return null};}catch(error){}
      try{var d=document.createElement('div');d.innerHTML=TAG;document.body.appendChild(d);}catch(error){}
      try{var doc=new DOMParser().parseFromString(TAG,'text/html');document.body.appendChild(doc.body.firstChild);}catch(error){}
      try{var f=document.createElement('iframe');f.srcdoc=CHILD;document.body.appendChild(f);}catch(error){}`,
    'escape-eval': `try{eval('1+1');top.postMessage({probe:'evalRan'},'*');}catch(error){top.postMessage({probe:'evalBlocked'},'*');}`,
  };

  const legitJs = `
    var root=document.getElementById('mesa-activity-root');
    var dom=document.createElement('div');dom.id='dom-ok';dom.textContent='dom';root.appendChild(dom);
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 10 10');var circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('r','5');svg.appendChild(circle);root.appendChild(svg);
    var canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;var ctx=canvas.getContext('2d');ctx.fillStyle='#0f0';ctx.fillRect(0,0,10,10);root.appendChild(canvas);
    var template=document.createElement('template');template.innerHTML='<b id="tmpl-ok">bold</b>';root.appendChild(template.content);
    var adjacent=document.createElement('div');root.appendChild(adjacent);adjacent.insertAdjacentHTML('beforeend','<i id="adj-ok">it</i>');
    var clone=document.createElement('span');clone.id='clone-ok';root.appendChild(clone.cloneNode(true));
    var htmlResult=(function(){var d=document.createElement('div');d.innerHTML='<u id="html-ok">u</u>';root.appendChild(d);return !!root.querySelector('#html-ok');})();
    var shadowHost=document.createElement('div');root.appendChild(shadowHost);var shadowRoot=shadowHost.attachShadow({mode:'open'});shadowRoot.innerHTML='<b id="shadow-ok">s</b>';var shadowOk=!!shadowRoot.querySelector('#shadow-ok');
    var closedHost=document.createElement('div');root.appendChild(closedHost);var closedRoot=closedHost.attachShadow({mode:'closed'});closedRoot.innerHTML='<i id="closed-ok">c</i>';var closedOk=!!closedRoot.querySelector('#closed-ok');
    top.postMessage({probe:'legit',detail:{dom:!!root.querySelector('#dom-ok'),svg:!!root.querySelector('circle'),canvas:!!canvas.width,html:htmlResult,template:!!root.querySelector('#tmpl-ok'),adjacent:!!root.querySelector('#adj-ok'),shadow:shadowOk,closed:closedOk}},'*');
    window.mesa.state({legit:true});window.mesa.ready();`;

  const specs = {};
  for (const [name, body] of Object.entries(vectorSources)) {
    specs[name] = {
      title: `isolamento ${name}`,
      objective: 'Probe adversarial de subframe',
      alternativeMarkdown: 'Probe sintético de isolamento.',
      html: '<p>iso</p>',
      css: '',
      katex: false,
      js: `var CHILD=${JSON.stringify(child)};var TAG=${JSON.stringify(tag)};var DSD=${JSON.stringify(dsd)};var DSD_CLOSED=${JSON.stringify(dsdClosed)};var DSD_CLONABLE=${JSON.stringify(dsdClonable)};(function(){try{${body}}catch(error){try{top.postMessage({probe:'vectorError',vector:${JSON.stringify(name)},msg:String(error&&error.message||error)},'*');}catch(nested){}}})();`,
    };
  }
  specs.legit = {
    title: 'DOM livre legítimo',
    objective: 'Provar que DOM/SVG/canvas continuam funcionando',
    alternativeMarkdown: 'Probe sintético de DOM legítimo.',
    html: '<p>legit</p>',
    css: '.ok{color:var(--mesa-accent)}',
    katex: false,
    js: legitJs,
  };
  /* Script inline no html do modelo: fica inerte no documento (o contrato manda
     usar `js`); se executasse, não poderia criar filho de qualquer forma. */
  specs['html-script'] = {
    title: 'script inline no html',
    objective: 'Probe: script em html não deve executar',
    alternativeMarkdown: 'Probe sintético de script inline.',
    html: '<p>h</p><script>top.postMessage({probe:"htmlScriptRan",rtc:typeof RTCPeerConnection},"*");<\/script>',
    css: '',
    katex: false,
    js: '',
  };

  const store = createActivityStore({runtime: runtimeDir});
  const watchdogLog = [];
  const activityRuntime = createActivityRuntime({store, onWatchdog: (event) => watchdogLog.push(event)});
  activityRuntime.installProtocol(session.defaultSession);
  activityRuntime.installSessionGuards(session.defaultSession);

  const conversationId = path.join(runtimeDir, 'iso.jsonl');
  const urls = {};
  for (const [name, spec] of Object.entries(specs)) {
    const item = await store.publish({conversationId, generation: 1, toolCallId: `iso-${name}`, spec});
    if (!activityRuntime.remember(item, spec)) throw new Error(`spec não registrada: ${name}`);
    urls[name] = activityArtifactUrl(item.id, item.version, 'system');
  }

  win = new BrowserWindow({show: false, width: 1000, height: 760, webPreferences: {contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false}});
  activityRuntime.attachWindow(win);
  const navLog = [];
  win.webContents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame) navLog.push({url: event.url, prevented: event.defaultPrevented === true, at: Date.now()});
  });
  await win.loadURL('data:text/html,<html><body><script>window.__probes=[];window.addEventListener("message",function(e){window.__probes.push(e.data)});window.__mount=function(url){var f=document.createElement("iframe");f.setAttribute("sandbox","allow-scripts");f.setAttribute("referrerpolicy","no-referrer");f.src=url;document.body.appendChild(f);return true};window.__unmount=function(){document.querySelectorAll("iframe").forEach(function(f){f.remove()})};window.__beat=0;setInterval(function(){window.__beat+=1},4);</script></body></html>');

  const frameInfo = () => {
    try {
      return win.webContents.mainFrame.framesInSubtree.map((frame) => ({url: String(frame.url || ''), osPid: frame.osProcessId}));
    } catch { return []; }
  };
  const resetWindow = async () => {
    await win.webContents.executeJavaScript('window.__probes.length=0;window.__unmount();1');
    await sleep(250);
  };
  global.__iso = {
    names: () => Object.keys(specs),
    urls: () => ({...urls}),
    watchdog: () => watchdogLog.slice(),
    navLog: () => navLog.slice(),
    metrics: () => { try { return require('electron').app.getAppMetrics().map((m) => ({pid: m.pid, type: m.type, cpu: Math.round((m.cpu && m.cpu.percentCPUUsage) || 0)})); } catch { return []; } },
    run: async (name, waitMs = 2600) => {
      if (!urls[name]) throw new Error(`vetor desconhecido: ${name}`);
      await resetWindow();
      const before = {udp: state.udp, http: JSON.stringify(state.http)};
      const mounted = await win.webContents.executeJavaScript(`window.__mount(${JSON.stringify(urls[name])})`);
      await sleep(waitMs);
      const probes = await win.webContents.executeJavaScript('window.__probes.slice()');
      const frames = frameInfo();
      const beatA = await win.webContents.executeJavaScript('window.__beat');
      await sleep(150);
      const beatB = await win.webContents.executeJavaScript('window.__beat');
      const udp = state.udp - before.udp;
      const beforeHttp = JSON.parse(before.http);
      const httpDelta = {};
      for (const [key, value] of Object.entries(state.http)) {
        const delta = value - (beforeHttp[key] || 0);
        if (delta) httpDelta[key] = delta;
      }
      await resetWindow();
      return {name, mounted, probes, frames, udp, udpDetail: state.udpDetail.slice(), http: httpDelta, hostResponsive: beatB > beatA, url: urls[name]};
    },
    cleanup: async () => {
      try { win.destroy(); } catch {}
      udpSocket.close();
      httpServer.close();
      fs.rmSync(runtimeDir, {recursive: true, force: true});
    },
  };
  win.webContents.on('did-finish-load', () => console.log('isolation fixture ready'));
}).catch((error) => {
  console.error('isolation fixture falhou:', error);
  app.exit(1);
});
