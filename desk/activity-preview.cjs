'use strict';

/* Prévia das visualizações e atividades do tutor (#42, parte B).

   O tutor manda o mesmo html/css/js que publicaria e recebe um print PNG, a
   altura do conteúdo e o que o documento escreveu no console (log, aviso, erro
   e exceções). A prévia roda numa janela Electron INVISÍVEL e offline, com o
   MESMO quadro da conversa: iframe `sandbox="allow-scripts"`, o documento
   montado pelo runtime (CSP, prelude, sanitizador) e o protocolo
   `mesa-activity:` da sessão — nenhum navegador é baixado e nada sai para a
   rede (as guardas de sessão do runtime valem aqui também).

   Nada é gravado: o documento entra no registro em memória do runtime com um
   id temporário (`pv-…`) e sai dele no fim; o store não é tocado.

   A mesma janela mede o documento nas larguras do núcleo (`measureWidths`)
   antes de uma publicação: os pares largura→altura vão com a versão e o
   quadro nasce com a altura certa para a coluna.

   Desenho reescrito a partir do `html_preview` do T3 Code (pingdotgg/t3code,
   MIT, © T3 Tools Inc.); aqui a "headless" é uma BrowserWindow escondida. */

const crypto = require('node:crypto');
const {activityArtifactUrl} = require('./activity-runtime.cjs');
const {normalizeSpec, specHash} = require('./activity-store.cjs');
const view = require('./src/activity-view.mjs');
const {message} = require('./src/i18n.mjs');
const {invalidValue} = require('./src/error-detail.mjs');

const MIN_WIDTH = 240;
const MAX_WIDTH = 1600;
const MAX_CAPTURE = 4000;
const READY_MS = 10000;
const QUIET_MS = 300;
const SETTLE_MAX_MS = 3000;

const LEVELS = {'console.log': 'log', 'console.debug': 'log', 'console.info': 'info', 'console.warn': 'warning', 'console.error': 'error', exception: 'error'};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Página-hospedeira da prévia: só o iframe e o ouvinte de mensagens. Faz o
   papel do renderer — responde ao `ready` com `init` (sem estado) e com o
   tema completo no `host-context-changed` — e guarda tudo o que o quadro
   mandou para o main ler. */
function hostPage({background}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${background};overflow:hidden}iframe{display:block;border:0;width:100%;height:900px}</style></head><body><iframe sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><script>
window.__mesaPreview={events:[],ready:false};
window.addEventListener('message',function(event){var frame=document.querySelector('iframe');if(!frame||event.source!==frame.contentWindow)return;var data=event.data;window.__mesaPreview.events.push({at:Date.now(),data:data});if(data&&data.v===1&&data.type==='ready'&&window.__mesaPreview.boot&&!window.__mesaPreview.ready){window.__mesaPreview.ready=true;var boot=window.__mesaPreview.boot;frame.contentWindow.postMessage({v:1,type:'init',id:boot.id,version:boot.version,hash:boot.hash,payload:{theme:boot.theme,state:null}},'*');frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/host-context-changed',params:{theme:boot.theme,styles:{variables:boot.variables}}},'*');}});
</script></body></html>`;
}

function cleanWidth(value, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, number));
}

function cleanTheme(value) {
  return value === 'escuro' || value === 'dark' ? 'dark' : 'light';
}

/* O que o tutor manda para a prévia: o conteúdo de uma publicação. Título e
   textos não importam aqui; entram defaults para o normalizador. */
function previewSpec(raw = {}) {
  return normalizeSpec({
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Prévia',
    objective: typeof raw.objective === 'string' && raw.objective.trim() ? raw.objective : 'Prévia',
    alternativeMarkdown: typeof raw.alternativeMarkdown === 'string' && raw.alternativeMarkdown.trim() ? raw.alternativeMarkdown : 'Prévia',
    html: raw.html === undefined ? '' : raw.html,
    css: raw.css === undefined ? '' : raw.css,
    js: raw.js === undefined ? '' : raw.js,
    katex: raw.katex === true,
    kind: raw.kind === 'visualizacao' ? 'visualizacao' : undefined,
    charts: raw.charts === true,
  });
}

/**
 * @param {{runtime?: ReturnType<typeof import('./activity-runtime.cjs').createActivityRuntime>,
 *   createWindow?: (size: {width: number, height: number}) => import('electron').BrowserWindow,
 *   columnWidth?: () => number, readyMs?: number}} [options]
 */
function createActivityPreview({runtime, createWindow, columnWidth = () => 360, readyMs = READY_MS} = {}) {
  if (!runtime || typeof runtime.remember !== 'function' || typeof runtime.forget !== 'function') throw new Error(invalidValue('runtime', runtime, '{remember, forget}'));
  if (typeof createWindow !== 'function') throw new Error(invalidValue('createWindow', createWindow, 'function'));
  let chain = Promise.resolve();
  const serial = (job) => {
    const run = chain.then(job, job);
    chain = run.catch(() => {});
    return run;
  };

  /* Abre a janela escondida com o documento registrado e espera o `ready`. */
  async function open(spec, {theme, accent, width}) {
    const id = `pv-${crypto.randomBytes(6).toString('hex')}`;
    const hash = specHash(spec);
    if (!runtime.remember({id, version: 1, hash}, spec)) throw new Error(message('err.activity.documentInvalid', {id, version: 1}));
    const variables = view.themeTokens(theme, accent);
    const win = createWindow({width, height: 900});
    const close = () => {
      try { if (!win.isDestroyed()) win.destroy(); } catch { /* já fechou */ }
      runtime.forget(id, 1);
    };
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hostPage({background: variables['--mesa-bg']}))}`);
      const boot = {id, version: 1, hash, theme, variables};
      await win.webContents.executeJavaScript(`window.__mesaPreview.boot=${JSON.stringify(boot)};document.querySelector('iframe').src=${JSON.stringify(activityArtifactUrl(id, 1, theme, accent))};true`);
      const until = Date.now() + readyMs;
      while (Date.now() < until) {
        if (await win.webContents.executeJavaScript('window.__mesaPreview.ready')) break;
        await sleep(40);
      }
      if (!(await win.webContents.executeJavaScript('window.__mesaPreview.ready'))) {
        const events = await win.webContents.executeJavaScript('window.__mesaPreview.events.map(function(e){return e.data})');
        const error = new Error(message('err.activity.previewTimeout', {ms: readyMs}));
        error.events = events;
        throw error;
      }
      return {win, close};
    } catch (error) {
      close();
      throw error;
    }
  }

  const events = (win) => win.webContents.executeJavaScript('window.__mesaPreview.events');

  /* Espera o quadro parar de mudar de tamanho: sem `size-changed` novo por um
     instante (com teto). Devolve a última altura reportada. */
  async function settle(win) {
    const started = Date.now();
    let last = Date.now();
    let count = -1;
    let height = 0;
    while (Date.now() - started < SETTLE_MAX_MS) {
      const list = await events(win);
      const sizes = list.filter((entry) => entry.data && entry.data.jsonrpc === '2.0' && entry.data.method === 'ui/notifications/size-changed');
      const ready = list.find((entry) => entry.data && entry.data.v === 1 && entry.data.type === 'ready');
      const latest = sizes.length ? Number(sizes[sizes.length - 1].data.params && sizes[sizes.length - 1].data.params.height) : 0;
      height = latest || height || Number(ready && ready.data.payload && ready.data.payload.height) || 0;
      if (sizes.length !== count) {
        count = sizes.length;
        last = Date.now();
      } else if (Date.now() - last >= QUIET_MS) {
        break;
      }
      await sleep(40);
    }
    return Math.max(0, Math.round(height));
  }

  function consoleOf(list) {
    const out = [];
    for (const entry of list) {
      const data = entry.data;
      if (!data || data.jsonrpc !== '2.0' || data.method !== 'notifications/message' || !data.params) continue;
      const level = LEVELS[String(data.params.logger || '')] || (data.params.level === 'error' ? 'error' : data.params.level === 'warning' ? 'warning' : 'info');
      out.push({level, text: String(data.params.data || '').slice(0, 2000)});
    }
    return out.slice(0, 200);
  }

  /* A prévia: print, altura e console. Não grava nada. */
  function preview(raw = {}, options = {}) {
    return serial(async () => {
      const spec = previewSpec(raw);
      const theme = cleanTheme(options.theme ?? raw.tema ?? raw.theme);
      const accent = view.accentOf(options.accent ?? raw.accent ?? 'blue');
      const width = cleanWidth(options.width ?? raw.largura ?? raw.width, cleanWidth(columnWidth(), 360));
      const {win, close} = await open(spec, {theme, accent, width});
      try {
        const contentHeight = await settle(win);
        const captured = Math.min(MAX_CAPTURE, Math.max(48, contentHeight));
        await win.webContents.executeJavaScript(`document.querySelector('iframe').style.height='${captured}px';true`);
        win.setContentSize(width, captured);
        await sleep(160);
        const image = await win.webContents.capturePage({x: 0, y: 0, width, height: captured});
        const size = image.getSize();
        const scaled = size.width > width ? image.resize({width, height: captured, quality: 'best'}) : image;
        const shot = scaled.getSize();
        const list = await events(win);
        return {
          width,
          contentHeight,
          capturedHeight: captured,
          theme: theme === 'dark' ? 'escuro' : 'claro',
          consoleMessages: consoleOf(list),
          screenshot: {mimeType: 'image/png', data: scaled.toPNG().toString('base64'), width: shot.width, height: shot.height},
        };
      } finally {
        close();
      }
    });
  }

  /* Pares largura→altura nas larguras do núcleo, para a publicação. Falha
     vira `undefined`: o quadro segue a medição viva, como antes do #42. */
  function measure(raw = {}) {
    return serial(async () => {
      const spec = previewSpec(raw);
      const widths = view.measureWidths();
      const {win, close} = await open(spec, {theme: 'light', accent: 'blue', width: widths[0]});
      try {
        const pairs = [];
        for (const width of widths) {
          if (pairs.length) {
            win.setContentSize(width, 900);
            await sleep(60);
          }
          const height = await settle(win);
          pairs.push([width, height]);
        }
        return pairs.every(([, height]) => height > 0) ? pairs : undefined;
      } finally {
        close();
      }
    }).catch(() => undefined);
  }

  return {preview, measure, previewSpec};
}

module.exports = {createActivityPreview, previewSpec, cleanWidth, cleanTheme};
