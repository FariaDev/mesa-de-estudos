'use strict';

/* Runtime de atividades: documento servido por origem própria, contenção e
   observação de frames. Decide a superfície com o spike `hunt-activity-spike.mjs`:
 *
 *   - iframe `sandbox="allow-scripts"` + protocolo `mesa-activity:` dedicado;
 *   - o Chromium isola o frame em OUTRO processo (OOPIF) mesmo com a janela
 *     escondida: um laço no artefato trava só o próprio frame — o spike mediu
 *     "frame executeJavaScript = BLOCKED" com o host respondendo e o frame
 *     podendo ser removido;
 *   - CSP `default-src 'none'` + `connect-src 'none'` zerou TODOS os canais HTTP
 *     (fetch/XHR/WS/ES/beacon/img/ping/frame/arquivo);
 *   - WebRTC/STUN escapa da CSP: o prelude do wrapper (`LOCKDOWN_SCRIPT`) retira
 *     RTCPeerConnection/WebTransport/mediaDevices ANTES do js do modelo e zerou
 *     os datagramas UDP no spike;
 *   - `will-frame-navigate` autoriza só a PRIMEIRA carga do artefato exato e
 *     nega qualquer navegação posterior do frame (aba do host já nega o topo);
 *   - `installSessionGuards` cancela http(s)/ws(s)/ftp com origem em frame
 *     `mesa-activity:` como barreira de sessão complementar.
 *
 * O documento é montado pelo host (html/css/js do modelo, nunca um documento
 * completo); nenhum preload é injetado, nenhum arquivo é lido de caminho
 * escolhido pelo modelo e nada é servido fora do registro publicado. */

const fs = require('node:fs');
const path = require('node:path');
const {specHash, normalizeSpec} = require('./activity-store.cjs');
const {invalidValue} = require('./src/error-detail.mjs');
const {ACTIVITY_SCHEME, ARTIFACT_HOST, KATEX_DIST, KATEX_HOST, LIB_FILES, LIB_HOST, MAX_REGISTRY, activityArtifactUrl, canTerminateActivityProcess, canTerminateSharedStalledProcess, collectActivityFrames, katexFile, parseActivityUrl} = require('./activity-protocol.cjs');
const {DANGEROUS_TAGS, LOCKDOWN_SCRIPT} = require('./activity-lockdown-script.cjs');
const {HOST_CSS, RUNTIME_SCRIPT} = require('./activity-page-script.cjs');
const {buildActivityDocument, cspFor} = require('./activity-document.cjs');

function createActivityRuntime({onWatchdog} = {}) {
  const registry = new Map();
  const watchdogEvent = (event) => {
    try { if (typeof onWatchdog === 'function') onWatchdog(event); } catch { /* log é observabilidade */ }
    return event;
  };
  const keyOf = (id, version) => `${id}@${version}`;

  const remember = (item, spec) => {
    if (!item || typeof item.id !== 'string') return null;
    const version = Number(item.version);
    if (!Number.isInteger(version) || version < 1) return null;
    let normalized;
    try {
      normalized = normalizeSpec(spec);
    } catch {
      return null;
    }
    const hash = specHash(normalized);
    if (item.hash && item.hash !== hash) return null;
    const key = keyOf(item.id, version);
    if (registry.has(key)) registry.delete(key);
    registry.set(key, {id: item.id, version, hash, spec: normalized, conversationId: item.conversationId || ''});
    while (registry.size > MAX_REGISTRY) registry.delete(registry.keys().next().value);
    return {id: item.id, version, hash};
  };

  const has = (id, version) => registry.has(keyOf(id, version));
  /* A prévia do tutor registra um documento temporário e o tira depois (#42):
     nada vai para o disco. */
  const forget = (id, version) => registry.delete(keyOf(id, Number(version)));
  const get = (id, version) => registry.get(keyOf(id, version)) || null;
  const forgetConversation = (conversationId) => {
    for (const [key, entry] of registry) {
      if (entry.conversationId === conversationId) registry.delete(key);
    }
  };

  const artifactResponse = (parsed) => {
    const entry = get(parsed.id, parsed.version);
    if (!entry) return new Response('atividade não publicada', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});
    const theme = parsed.theme || 'system';
    const html = buildActivityDocument(entry.spec, {id: entry.id, version: entry.version, hash: entry.hash, theme, accent: parsed.accent || 'blue'});
    return new Response(html, {status: 200, headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'}});
  };

  const katexResponse = (parsed) => {
    const file = katexFile(parsed.relative);
    if (!file) return new Response('não encontrado', {status: 404});
    let resolved;
    try {
      resolved = fs.realpathSync(file);
    } catch {
      return new Response('não encontrado', {status: 404});
    }
    if (!resolved.startsWith(fs.realpathSync(KATEX_DIST) + path.sep) || !fs.statSync(resolved).isFile()) {
      return new Response('não encontrado', {status: 404});
    }
    const extension = path.extname(resolved).toLowerCase();
    const type = extension === '.css' ? 'text/css' : extension === '.js' ? 'text/javascript' : extension === '.woff2' ? 'font/woff2' : extension === '.woff' ? 'font/woff' : 'font/ttf';
    return new Response(fs.readFileSync(resolved), {status: 200, headers: {'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store'}});
  };

  const libResponse = (parsed) => {
    const file = LIB_FILES.get(parsed.relative);
    if (!file || !fs.existsSync(file)) return new Response('não encontrado', {status: 404});
    return new Response(fs.readFileSync(file), {status: 200, headers: {'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store'}});
  };

  const protocolHandler = (request) => {
    const parsed = parseActivityUrl(request && request.url);
    if (!parsed) return new Response('não encontrado', {status: 404});
    if (parsed.kind === 'artifact') return artifactResponse(parsed);
    if (parsed.kind === 'lib') return libResponse(parsed);
    return katexResponse(parsed);
  };

  const installProtocol = (session) => {
    if (!session || !session.protocol || typeof session.protocol.handle !== 'function') throw new Error(invalidValue('session', session, '{protocol: {handle}}'));
    session.protocol.handle(ACTIVITY_SCHEME, protocolHandler);
  };

  /* Primeira navegação do frame só vale para o artefato exato publicado;
     depois disso o frame é imutável. A checagem é SEM estado (URL atual do
     frame ainda vazia/about:blank) justamente porque o Chromium pode reusar a
     instância/routing do frame depois de removido — um WeakSet por frame
     negava a carga legítima de uma montagem nova. `about:blank` inicial é
     ignorado. */
  /* Watchdog de contenção: um laço/JS travado no artefato bloqueia a thread do
     PRÓPRIO processo OOPIF; o frame removido pode ter o processo reusado pelo
     próximo artefato (medido: laço parado deixou um processo a 12% e a próxima
     atividade nunca carregava). O runtime faz ping por `executeJavaScript` com
     timeout, e MATA o processo do frame depois de 3 falhas seguidas — e também
     quando um frame some da árvore tendo ficado >1,5 s sem responder. Nunca
     mata o processo do renderer principal da janela. */
  const attachWindow = (win, {watchdog = true} = {}) => {
    if (!win || (!win.webContents && !win)) return;
    const wc = win.webContents || win;
    const tracked = new Map();
    const killed = new WeakSet();
    let timer = null;
    let busy = false;
    const mainPid = () => {
      try { return typeof wc.getOSProcessId === 'function' ? wc.getOSProcessId() : 0; } catch { return 0; }
    };
    const processMetric = (pid) => {
      try { return require('electron').app.getAppMetrics().find(metric=>metric.pid===pid&&metric.type==='Tab')||null; }
      catch { return null; }
    };
    const identifyProcess = (entry,pid) => {
      if(entry.pid===pid&&entry.creationTime>0)return;
      entry.pid=pid;
      entry.creationTime=processMetric(pid)?.creationTime||0;
    };
    /* Duas confirmações de travamento: 3 pings seguidos sem resposta E pelo
       menos 2,5 s desde o último sucesso. Um timeout transitório isolado não
       mata nada. */
    const confirmedStall = (entry, at) => !!entry && entry.misses >= 3 && at - entry.lastOk >= 2500;
    const detachedStall = (entry, at) => !!entry && entry.misses >= 2 && at - entry.lastOk >= 2500;
    const framesOn = (pid) => collectActivityFrames(pid, () => require('electron').webContents.getAllWebContents());
    /* Decide e executa a terminação. O caminho destacado continua exigindo a
       guarda de PID; o caminho compartilhado exige que todos os outros frames
       do pid estejam confirmados travados. */
    const terminateEntry = (entry, at) => {
      try {
        const metric = processMetric(entry && entry.pid);
        const guardMainPid = mainPid();
        if (!canTerminateActivityProcess({entry, mainPid: guardMainPid, metric, livePids: []})) return {ok: false, reason: 'guard'};
        /* A prova de "não há outro frame no pid" só vale com enumeração
           completa; qualquer exceção/PID desconhecido nega o kill. */
        const snapshot = framesOn(entry.pid);
        if (!snapshot.complete) return {ok: false, reason: 'enumeration'};
        const others = snapshot.frames.filter((frame) => frame !== entry.frame);
        if (others.length > 0) {
          const stalledOthers = others.map((frame) => ({stalled: confirmedStall(tracked.get(frame), at)}));
          if (!canTerminateSharedStalledProcess({entry, mainPid: guardMainPid, metric, others: stalledOthers})) return {ok: false, reason: 'shared-live'};
        }
        process.kill(entry.pid, 'SIGKILL');
        return {ok: true, reason: others.length > 0 ? 'shared-stalled' : 'detached-unresponsive'};
      } catch { return {ok: false, reason: 'error'}; }
    };
    const liveArtifactFrames = () => {
      try {
        const rootFrame = wc.mainFrame;
        if (!rootFrame) return [];
        const frames = rootFrame.framesInSubtree || rootFrame.frames || [];
        return [...frames].filter((frame) => String(frame.url || '').startsWith(`${ACTIVITY_SCHEME}://`));
      } catch { return []; }
    };
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const live = liveArtifactFrames();
        const nowAt = Date.now();
        const frameFacts = (frame) => {
          try {
            const url = String(frame.url || '');
            const osPid = typeof frame.osProcessId === 'number' && frame.osProcessId > 0 ? frame.osProcessId : 0;
            return {url, osPid};
          } catch { return {url: '', osPid: 0}; }
        };
        for (const [frame, entry] of [...tracked]) {
          const facts = frameFacts(frame);
          if (facts.osPid) identifyProcess(entry,facts.osPid);
          if (!live.includes(frame)) {
            /* Só mata ao destacar com evidência de travamento (dois pings
               falhos e 2,5 s sem sucesso — timeout transitório não basta). O
               Chromium pode já ter reusado o processo para outra montagem; a
               guarda de pid/creationTime confere a posse atual. */
            if (detachedStall(entry, nowAt)) {
              const result = terminateEntry(entry, nowAt);
              watchdogEvent(result.ok
                ? {type: 'kill', pid: entry.pid, mainPid: mainPid(), reason: result.reason, url: facts.url}
                : {type: 'kill-failed', pid: entry.pid, reason: result.reason, url: facts.url});
            }
            tracked.delete(frame);
          }
        }
        for (const frame of live) {
          if (killed.has(frame)) continue;
          const facts = frameFacts(frame);
          let entry = tracked.get(frame);
          if (!entry) {
            /* `processId` do WebFrameMain é o id interno do Chromium; o que se
               pode matar é o pid do SO (`osProcessId`), que pode só aparecer
               depois do commit — daí a atualização a cada tick. */
            entry = {pid: 0, creationTime: 0, lastOk: 0, misses: 0};
            identifyProcess(entry,facts.osPid);
            tracked.set(frame, entry);
          } else if (facts.osPid && facts.osPid !== entry.pid) {
            identifyProcess(entry,facts.osPid);
          }
          if (nowAt - entry.lastOk < 2000) continue;
          const ok = await Promise.race([
            Promise.resolve()
              .then(() => frame.executeJavaScript('1', false))
              .then(() => true)
              .catch(() => false),
            new Promise((resolve) => setTimeout(() => resolve(false), 900)),
          ]);
          if (ok) {
            entry.lastOk = Date.now();
            entry.misses = 0;
          } else {
            entry.misses += 1;
            if (entry.misses === 3) {
              /* Um frame vivo e sem resposta é sinalizado; quando todos os
                 frames do processo estão confirmados travados, o kill é
                 liberado (nenhum host/saudável/desconhecido no pid). */
              watchdogEvent({type: 'stalled', pid: entry.pid, url: String(frame.url || '')});
            }
          }
          if (confirmedStall(entry, Date.now())) {
            const result = terminateEntry(entry, Date.now());
            if (result.ok) {
              killed.add(frame);
              watchdogEvent({type: 'kill', pid: entry.pid, mainPid: mainPid(), reason: result.reason, url: facts.url});
              tracked.delete(frame);
            }
          }
        }
        if (!tracked.size && live.length === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      } finally {
        busy = false;
      }
    };
    const ensureWatchdog = () => {
      if (!watchdog || timer) return;
      watchdogEvent({type: 'ensure'});
      timer = setInterval(() => { tick().catch(() => {}); }, 1200);
    };
    const stopWatchdog = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      tracked.clear();
    };
    wc.on('did-frame-navigate', (_event, _url, _code, _text, isMainFrame) => {
      if (!isMainFrame) ensureWatchdog();
    });
    wc.on('destroyed', stopWatchdog);
    if (typeof win.on === 'function') win.on('closed', stopWatchdog);
    wc.on('will-frame-navigate', (details) => {
      if (details.isMainFrame) return;
      const target = String(details.url || '');
      if (target === 'about:blank') return;
      const frame = details.frame || null;
      if (!frame) {
        details.preventDefault();
        return;
      }
      const current = String(frame.url || '');
      if (current && current !== 'about:blank') {
        details.preventDefault();
        return;
      }
      const parsed = parseActivityUrl(target);
      if (!parsed || parsed.kind !== 'artifact' || !has(parsed.id, parsed.version)) {
        details.preventDefault();
      }
    });
  };

  /* Barreira de sessão: nenhum http(s)/ws(s)/ftp sai de um frame de atividade.
     A CSP do documento é a primeira barreira; esta cobre inclusive o que
     viesse a ser acrescentado fora do wrapper. */
  const installSessionGuards = (session) => {
    if (!session || !session.webRequest || typeof session.webRequest.onBeforeRequest !== 'function') return false;
    session.webRequest.onBeforeRequest(
      {urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*']},
      (details, callback) => {
        let block = false;
        try {
          const frame = details && details.frame;
          if (frame && String(frame.url || '').startsWith(`${ACTIVITY_SCHEME}://`)) block = true;
        } catch { /* sem frame: deixa passar */ }
        callback({cancel: block});
      },
    );
    return true;
  };

  return {
    scheme: ACTIVITY_SCHEME,
    remember,
    has,
    get,
    forgetConversation,
    forget,
    size: () => registry.size,
    protocolHandler,
    installProtocol,
    attachWindow,
    installSessionGuards,
    buildDocument: buildActivityDocument,
    listIds: () => [...registry.values()].map((entry) => ({id: entry.id, version: entry.version})),
  };
}

module.exports = {
  ACTIVITY_SCHEME,
  ARTIFACT_HOST,
  KATEX_HOST,
  LIB_HOST,
  activityArtifactUrl,
  parseActivityUrl,
  buildActivityDocument,
  createActivityRuntime,
  cspFor,
  LOCKDOWN_SCRIPT,
  DANGEROUS_TAGS,
  RUNTIME_SCRIPT,
  HOST_CSS,
  canTerminateActivityProcess,
  canTerminateSharedStalledProcess,
  collectActivityFrames,
};
