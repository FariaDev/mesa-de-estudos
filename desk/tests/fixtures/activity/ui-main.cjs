'use strict';

/* Harness sintético da UI de atividades: store e runtime REAIS no main,
   preload mínimo no formato que o pai vai integrar (incluindo `scopeRef` opaco
   por geração/conversa), host page que importa o `src/activity.mjs` real.
   Nenhum app pessoal, nenhum provedor. */

const {app, BrowserWindow, ipcMain, protocol, session} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {createActivityStore} = require('../../../activity-store.cjs');
const {createActivityRuntime, ACTIVITY_SCHEME} = require('../../../activity-runtime.cjs');
const {createActivityBridge, createCallRegistry, createActivityService, paramsHashOfToolInput} = require('../../../activity-bridge.cjs');

const DIR = __dirname;
const runtime = process.env.ACTIVITY_RUNTIME || fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-activity-ui-'));
let win = null;
let globalUi = null;

protocol.registerSchemesAsPrivileged([{
  scheme: ACTIVITY_SCHEME,
  privileges: {standard: true, secure: true, stream: true, supportFetchAPI: false, corsEnabled: false},
}]);

const reply = (payload) => JSON.parse(JSON.stringify(payload));

app.whenReady().then(async () => {
  const {MRUV_SPEC, CALC_SPEC, FREE_SPEC, LOOP_SPEC, FLOOD_SPEC, BIG_STATE_SPEC} = await import(path.join(DIR, 'specs.mjs'));
  const specs = {MRUV_SPEC, CALC_SPEC, FREE_SPEC, LOOP_SPEC, FLOOD_SPEC, BIG_STATE_SPEC};
  const store = createActivityStore({runtime});
  const watchdogLog = [];
  const activityRuntime = createActivityRuntime({store, onWatchdog: (event) => watchdogLog.push(event)});
  const registry = createCallRegistry();
  let conversationId = path.join(runtime, 'pi-ui.jsonl');
  let generation = 1;
  let scopeRef = 'scopeRef-ui-1';
  let saveCount = 0;
  let failSaves = 0;
  let lastReadPayload = null;
  let lastStatePayload = null;

  const currentScope = () => ({conversationId, generation, courseId: null, scopeRef});
  const assertScope = (payload) => {
    if (!payload || payload.scopeRef !== scopeRef) throw new Error('scopeRef não confere com a conversa atual.');
  };
  const service = createActivityService({
    store,
    runtime: activityRuntime,
    registry,
    isScopeActive: (candidate) => candidate && candidate.conversationId === conversationId && Number(candidate.generation) === generation,
    emit: (event) => {
      if (win && !win.isDestroyed()) win.webContents.send('activity-event', event);
    },
  });
  const bridge = createActivityBridge({publish: (grantScope, spec, caller) => service.publish(grantScope, spec, caller)});
  await bridge.start();
  let grant = bridge.grant({...currentScope()});

  activityRuntime.installProtocol(session.defaultSession);
  activityRuntime.installSessionGuards(session.defaultSession);

  ipcMain.handle('activity-list', () => ({items: store.list({conversationId}).map((item) => ({...item, scopeRef}))}));
  ipcMain.handle('activity-read', (_event, payload) => {
    assertScope(payload);
    lastReadPayload = {...payload};
    const {item, spec} = store.read({conversationId, id: payload.id, version: payload.version});
    activityRuntime.remember(item, spec);
    return {item: {...item, scopeRef}, spec};
  });
  ipcMain.handle('activity-state-get', (_event, payload) => {
    assertScope(payload);
    return store.stateGet({conversationId, id: payload.id, version: payload.version, hash: payload.hash});
  });
  ipcMain.handle('activity-state-save', (_event, payload) => {
    assertScope(payload);
    if (failSaves > 0) {
      failSaves -= 1;
      throw new Error('falha sintética de gravação');
    }
    lastStatePayload = {id: payload.id, version: payload.version, hash: payload.hash, scopeRef: payload.scopeRef};
    saveCount += 1;
    return store.stateSave({conversationId, id: payload.id, version: payload.version, hash: payload.hash, state: payload.state});
  });
  ipcMain.handle('activity-scope', () => currentScope());

  win = new BrowserWindow({
    show: false,
    width: 980,
    height: 760,
    webPreferences: {
      preload: path.join(DIR, 'ui-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  activityRuntime.attachWindow(win);
  const navLog = [];
  win.webContents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame) return;
    navLog.push({url: event.url, prevented: event.defaultPrevented === true, current: event.frame ? String(event.frame.url || '') : null, at: Date.now()});
  });

  globalUi = {
    runtime,
    store,
    activityRuntime,
    bridge,
    registry,
    service,
    specs,
    get scope() { return currentScope(); },
    setConversation(next) {
      conversationId = next;
      generation += 1;
      scopeRef = `scopeRef-ui-${generation}`;
      grant = bridge.grant({...currentScope()});
    },
    publishThroughBridge: async (name, {toolCallId = 'call-ui'} = {}) => {
      const spec = specs[name];
      const response = await fetch(grant.url, {
        method: 'POST',
        headers: {'content-type': 'application/json', 'x-mesa-token': grant.token},
        body: JSON.stringify({...spec, toolCallId}),
      });
      return {status: response.status, data: await response.json()};
    },
    publishThroughTool: async (name, {toolCallId = 'toolu-ui'} = {}) => {
      const spec = specs[name];
      const callRef = `ref-${Math.random().toString(16).slice(2, 12)}`;
      const input = {...spec};
      registry.registerCall({callRef, toolCallId, conversationId, generation, paramsHash: paramsHashOfToolInput(input), scopeRef});
      const result = await service.publishFromTool({...registry.injectRef(input, callRef)});
      return reply({id: result.id, version: result.version, hash: result.hash, toolCallId: result.toolCallId});
    },
    publishSilently: async (name, {toolCallId = 'call-silent'} = {}) => {
      const spec = specs[name];
      const item = await store.publish({conversationId, generation, toolCallId, spec});
      activityRuntime.remember(item, spec);
      return reply({...item, scopeRef});
    },
    stateOf: (id, version, hash) => store.stateGet({conversationId, id, version, hash}),
    list: () => store.list({conversationId}).map((item) => ({...item, scopeRef})),
    saveCount: () => saveCount,
    watchdogLog: () => watchdogLog.slice(),
    navLog: () => navLog.slice(),
    failNextSave: (count = 1) => { failSaves = count; },
    lastReadPayload: () => lastReadPayload,
    lastStatePayload: () => lastStatePayload,
    sendEvent: (payload) => {
      if (win && !win.isDestroyed()) win.webContents.send('activity-event', payload);
    },
    close: () => app.quit(),
  };
  global.__ui = globalUi;
  win.loadFile(path.join(DIR, 'ui-host.html')).catch((error) => {
    console.error('ui-main falhou ao carregar:', error);
    app.exit(1);
  });
}).catch((error) => {
  console.error('ui-main falhou:', error);
  app.exit(1);
});
