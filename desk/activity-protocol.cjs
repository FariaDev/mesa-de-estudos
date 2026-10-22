'use strict';

const path = require('node:path');
/* Núcleo do quadro (#42): tokens, paleta e espelho MCP Apps. */
const activityView = require('./src/activity-view.mjs');

/* Atividades — o protocolo `mesa-activity://` (artefato, KaTeX, bibliotecas),
   tema e acento na URL, arquivos servidos e as regras para encerrar o processo
   de uma atividade travada.
   Saiu de activity-runtime.cjs na #43 fase 2. */

const ACTIVITY_SCHEME = 'mesa-activity';
const ARTIFACT_HOST = 'artifact';
const KATEX_HOST = 'katex';
const MAX_REGISTRY = 400;
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
function activityArtifactUrl(id, version, theme = 'system', accent = '') {
  const name = theme === 'dark' || theme === 'light' ? theme : 'system';
  const tone = accent ? `&accent=${activityView.accentOf(accent)}` : '';
  return `${ACTIVITY_SCHEME}://${ARTIFACT_HOST}/${String(id)}/${String(version)}/index.html?theme=${name}${tone}`;
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
  if (url.host === ARTIFACT_HOST) {
    const match = /^\/([a-z0-9][a-z0-9-]{2,63})\/(\d{1,7})\/index\.html$/.exec(url.pathname);
    if (!match) return null;
    if (url.hash || url.username || url.password || url.port) return null;
    const theme = allowedTheme(url);
    if (theme === null) return null;
    const accent = allowedAccent(url);
    if (accent === null) return null;
    for (const key of url.searchParams.keys()) {
      if (key !== 'theme' && key !== 'accent') return null;
    }
    return {kind: 'artifact', id: match[1], version: Number(match[2]), theme: theme || 'system', accent: accent || 'blue'};
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

module.exports = {ACTIVITY_SCHEME, ARTIFACT_HOST, KATEX_HOST, MAX_REGISTRY, KATEX_DIST, LIB_HOST, LIB_FILES, canTerminateActivityProcess, canTerminateSharedStalledProcess, collectActivityFrames, activityArtifactUrl, parseActivityUrl, katexFile};
