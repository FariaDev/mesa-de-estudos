'use strict';

const path = require('node:path');
/* Núcleo do quadro (#42): tokens, paleta e espelho MCP Apps. */
const activityView = require('./src/activity-view.mjs');
const {ACTIVITY_SCHEME, activityHost, parseActivityHost} = require('./src/activity-host.mjs');

/* Atividades — o protocolo `mesa-activity://` (artefato, KaTeX, bibliotecas),
   tema e acento na URL, arquivos servidos e as regras para encerrar o processo
   de uma atividade travada.
   Saiu de activity-runtime.cjs na #43 fase 2. */

/* Um site por REVISÃO (#89): o host carrega id e versão
   (`act-<id>--v<versão>` publicado, `pv-<id>--v<versão>` na prévia). Duas
   revisões da mesma atividade ficam em origens diferentes e o Chromium isola
   cada uma no próprio OOPIF; só a MESMA revisão remontada compartilha
   processo. `activity-host.mjs` resolve id/versão sem ambiguidade com ids que
   contêm `-`, e o Chromium aceita o host acima de 63 caracteres neste esquema
   (justificativa medida até 78 no hunt do watchdog). O formato da #88
   (`act-<id>/<versão>/index.html`) e o antigo (`artifact/`) são recusados. */
const KATEX_HOST = 'katex';
const MAX_REGISTRY = 400;
const DETACHED_RETRY_MS = 3000;
/* Processo sem frame só morre visto assim em dois ticks com ≥ 1 s de
   distância (#88): o Chromium pode segurar o processo de um subframe removido
   e reusá-lo se a mesma atividade remonta (rolar a conversa, Parar e Abrir).
   No primeiro tick o frame novo pode ainda não ter feito o commit e não
   aparece no pid; matar ali derrubaria a carga legítima. */
const FRAMELESS_CONFIRM_MS = 1000;
const KATEX_DIST = path.join(__dirname, 'node_modules', 'katex', 'dist');
const KATEX_FILES = new Set(['katex.min.css', 'katex.min.js', 'contrib/auto-render.min.js', 'contrib/mhchem.min.js']);
/* Bibliotecas embutidas para gráficos (#42), servidas pelo próprio esquema —
   nada de rede. Hoje só o Chart.js (MIT, © Chart.js Contributors). */
const LIB_HOST = 'lib';
const LIB_FILES = new Map([['chart.umd.min.js', path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js')]]);
function canTerminateActivityProcess({entry,mainPid,metric,livePids}={}) {
  return !!entry&&Number.isInteger(entry.pid)&&entry.pid>0&&Number.isInteger(mainPid)&&mainPid>0&&entry.pid!==mainPid
    &&Number.isFinite(entry.creationTime)&&entry.creationTime>0&&metric?.type==='Tab'
    &&metric.pid===entry.pid&&metric.creationTime===entry.creationTime&&Array.isArray(livePids)&&!livePids.includes(entry.pid);
}
/* Um processo OOPIF compartilhado por várias atividades só pode ser terminado
   quando TODOS os outros frames vivos do mesmo pid forem também entradas do
   watchdog confirmadas como travadas. Nenhum frame desconhecido/host/saudável
   permite o kill — esta é a diferença em relação ao caminho sem
   compartilhamento, e preserva a guarda de PID/creationTime. */
function canTerminateSharedStalledProcess({entry,mainPid,metric,others}={}) {
  if(!canTerminateActivityProcess({entry,mainPid,metric,livePids:[]}))return false;
  return Array.isArray(others)&&others.length>0&&others.every((item)=>!!item&&item.stalled===true);
}
/* Enumeração COMPLETA ou negada. Qualquer exceção (getAllWebContents,
   isDestroyed, mainFrame, framesInSubtree) ou PID de frame desconhecido (0 ou
   getter lançando) torna a resposta incompleta; o watchdog então RECUSA o
   kill em vez de interpretar a falha como "não há outros frames no pid". */
function collectActivityFrames(pid, enumerateWebContents) {
  const frames = [];
  let complete = true;
  let contentsList;
  try {
    contentsList = typeof enumerateWebContents === 'function' ? enumerateWebContents() : null;
  } catch {
    return {complete: false, frames};
  }
  if (!contentsList) return {complete: false, frames};
  for (const contents of contentsList) {
    try {
      if (!contents) { complete = false; continue; }
      if (typeof contents.isDestroyed === 'function' && contents.isDestroyed()) continue;
      const main = contents.mainFrame;
      if (!main) { complete = false; continue; }
      const subtree = main.framesInSubtree;
      if (!subtree) { complete = false; continue; }
      for (const frame of subtree) {
        let framePid = 0;
        try { framePid = typeof frame.osProcessId === 'number' && frame.osProcessId > 0 ? frame.osProcessId : 0; } catch { framePid = 0; }
        if (!framePid) { complete = false; continue; }
        if (framePid === pid) frames.push(frame);
      }
    } catch { complete = false; }
  }
  return {complete, frames};
}
/* Entrada do watchdog com o PRÓPRIO frame guardado (#88): o filtro de "outros
   frames do pid" compara por identidade. Sem `frame`, o frame da própria
   entrada contaria como outro e o motivo sairia `shared-stalled`. */
function trackedActivityEntry(frame, osPid, creationTime) {
  return {
    frame,
    pid: Number.isInteger(osPid) && osPid > 0 ? osPid : 0,
    creationTime: Number.isFinite(creationTime) && creationTime > 0 ? creationTime : 0,
    lastOk: 0,
    misses: 0,
    detachedAt: 0,
    framelessAt: 0,
  };
}
function activityFramesOtherThan(frames, entry) {
  if (!Array.isArray(frames)) return [];
  return frames.filter((frame) => frame !== (entry && entry.frame));
}
/* Decide o que fazer com um frame rastreado que sumiu da árvore (#88).
   - `frameless`: o pid não tem NENHUM outro frame há `confirmMs` — o processo
     não serve mais e é encerrado, mesmo sem travamento confirmado (Parar cedo
     demais); antes do prazo, `retry`;
   - `stalled`: ainda há outros frames no pid e a entrada destacada passou dos
     dois pings falhos + 2,5 s sem resposta — caminho de travamento de sempre;
   - `retry`: pid ainda desconhecido ou enumeração incompleta; guarda a entrada
     por até `retryMs` sem deixar o timer do watchdog parar;
   - `drop`: enumeração completa sem motivo para kill (ou prazo estourado). */
function detachedActivityDecision({pid, complete, frames, frame, stalled, waitedMs, framelessMs = 0, retryMs = DETACHED_RETRY_MS, confirmMs = FRAMELESS_CONFIRM_MS} = {}) {
  const identified = Number.isInteger(pid) && pid > 0;
  if (!identified || complete !== true || !Array.isArray(frames)) {
    return Number.isFinite(waitedMs) && waitedMs >= retryMs ? 'drop' : 'retry';
  }
  if (frames.filter((candidate) => candidate !== frame).length === 0) return framelessMs >= confirmMs ? 'frameless' : 'retry';
  return stalled === true ? 'stalled' : 'drop';
}
function activityArtifactUrl(id, version, theme = 'system', accent = '') {
  const name = theme === 'dark' || theme === 'light' ? theme : 'system';
  const tone = accent ? `&accent=${activityView.accentOf(accent)}` : '';
  return `${ACTIVITY_SCHEME}://${activityHost(id, version)}/index.html?theme=${name}${tone}`;
}
/* Acento no query (#42): só um dos seis da Mesa; qualquer outro é recusado. */
function allowedAccent(url) {
  const value = url.searchParams.get('accent');
  if (value === null) return '';
  return activityView.ACCENTS.includes(value) ? value : null;
}
/* Tema só entra no query (`?theme=dark|light|system`) para o wrapper já pintar
   com o tema certo; qualquer outro parâmetro é recusado. */
function allowedTheme(url) {
  const search = url.searchParams.get('theme');
  if (search === null) return '';
  if (search === 'dark' || search === 'light' || search === 'system') return search;
  return null;
}
function parseActivityUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return null;
  }
  if (url.protocol !== `${ACTIVITY_SCHEME}:`) return null;
  const host = parseActivityHost(url.host);
  if (host) {
    /* A versão mora no host (#89), não no caminho: o formato da #88 e um
       caminho com versão extra são recusados. */
    if (url.pathname !== '/index.html') return null;
    if (url.hash || url.username || url.password || url.port) return null;
    const theme = allowedTheme(url);
    if (theme === null) return null;
    const accent = allowedAccent(url);
    if (accent === null) return null;
    for (const key of url.searchParams.keys()) {
      if (key !== 'theme' && key !== 'accent') return null;
    }
    return {kind: 'artifact', id: host.id, version: host.version, theme: theme || 'system', accent: accent || 'blue'};
  }
  if (url.host === LIB_HOST) {
    if (url.search || url.hash || url.username || url.password || url.port) return null;
    return {kind: 'lib', relative: url.pathname.replace(/^\/+/, '')};
  }
  if (url.host === KATEX_HOST) {
    if (url.search || url.hash || url.username || url.password || url.port) return null;
    return {kind: 'katex', relative: url.pathname.replace(/^\/+/, '')};
  }
  return null;
}
function katexFile(relative) {
  if (KATEX_FILES.has(relative)) return path.join(KATEX_DIST, relative);
  const font = /^fonts\/[A-Za-z0-9_.-]+\.(?:woff2|woff|ttf)$/.exec(relative);
  if (font) return path.join(KATEX_DIST, relative);
  return null;
}

module.exports = {ACTIVITY_SCHEME, KATEX_HOST, MAX_REGISTRY, KATEX_DIST, LIB_HOST, LIB_FILES, canTerminateActivityProcess, canTerminateSharedStalledProcess, collectActivityFrames, trackedActivityEntry, activityFramesOtherThan, detachedActivityDecision, DETACHED_RETRY_MS, activityArtifactUrl, parseActivityUrl, katexFile};
