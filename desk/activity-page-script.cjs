'use strict';

/* Atividades — o runtime da página (ponte com o host, altura, erros), o CSS
   do host e o tema do Chart.js.
   Saiu de activity-runtime.cjs na #43 fase 2. */

/* API do artefato e protocolo de mensagens. O host valida tudo de novo; isto
   aqui só serializa e limita a frequência de altura. */
const RUNTIME_SCRIPT = `(() => {
  const meta = window.__MESA_ACTIVITY__ || {};
  const listeners = [];
  let lastState = null;
  let lastAttempt = null;
  let heightTimer = 0;
  let readySent = false;
  let initialized = false;
  const send = (type, payload) => {
    try {
      parent.postMessage({v: 1, type, id: meta.id, version: meta.version, hash: meta.hash, payload: payload === undefined ? null : payload}, '*');
    } catch (error) { /* frame removido */ }
  };
  /* Ponte no protocolo MCP Apps (#42): JSON-RPC por postMessage, com os nomes
     do ext-apps (size-changed, host-context-changed, open-link) e o log no
     \`notifications/message\` do MCP. O contrato \`window.mesa.*\` segue igual. */
  const rpc = (method, params, id) => {
    try {
      const message = {jsonrpc: '2.0', method, params};
      if (id !== undefined) message.id = id;
      parent.postMessage(message, '*');
    } catch (error) { /* frame removido */ }
  };
  const sizeChanged = (height) => rpc('ui/notifications/size-changed', {height});
  const themeStyle = () => document.getElementById('mesa-theme');
  /* Tela cheia (#52): um documento que é só uma figura (SVG ou imagem, com ou
     sem legenda) cresce até caber. O quadro marca a caixa, a mídia e a legenda
     e o CSS do HOST_CSS faz o resto; documento com outra coisa (controles,
     texto, gráfico) segue o próprio layout. */
  const FIGURE_MEDIA = /^(svg|img)$/i;
  const FIGURE_CAPTION = /^(figcaption|p|small|div|span)$/i;
  const visibleKids = (parent) => Array.prototype.filter.call(parent.children, (el) => !/^(script|style|template)$/i.test(el.tagName) && !el.hidden);
  const figureParts = (root) => {
    const kids = visibleKids(root);
    if (kids.length === 1 && /^figure$/i.test(kids[0].tagName)) {
      const inner = visibleKids(kids[0]);
      const media = inner[0];
      const caption = inner[1];
      if (!media || !FIGURE_MEDIA.test(media.tagName) || inner.length > 2) return null;
      if (caption && !/^figcaption$/i.test(caption.tagName)) return null;
      return {box: kids[0], media, caption: caption || null};
    }
    const media = kids[0];
    const caption = kids[1];
    if (!media || !FIGURE_MEDIA.test(media.tagName) || kids.length > 2) return null;
    if (caption && (!FIGURE_CAPTION.test(caption.tagName) || caption.querySelector('svg,img,button,input,select,textarea,canvas'))) return null;
    return {box: root, media, caption: caption || null};
  };
  /* SVG só com width/height não escala: o viewBox dele é o tamanho que já tinha. */
  const giveViewBox = (media) => {
    if (!/^svg$/i.test(media.tagName) || media.getAttribute('viewBox')) return;
    const width = parseFloat(media.getAttribute('width'));
    const height = parseFloat(media.getAttribute('height'));
    if (width > 0 && height > 0) media.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  };
  const markFigure = () => {
    const root = document.getElementById('mesa-activity-root');
    const html = document.documentElement;
    for (const el of document.querySelectorAll('[data-figure-box],[data-figure-media],[data-figure-caption]')) {
      el.removeAttribute('data-figure-box'); el.removeAttribute('data-figure-media'); el.removeAttribute('data-figure-caption');
    }
    delete html.dataset.figure;
    const parts = root && figureParts(root);
    if (!parts) return;
    giveViewBox(parts.media);
    parts.box.setAttribute('data-figure-box', '');
    parts.media.setAttribute('data-figure-media', '');
    if (parts.caption) parts.caption.setAttribute('data-figure-caption', '');
    html.dataset.figure = 'on';
  };
  /* Tela cheia com conteúdo misto (relato de 2026-10-20: gráfico + controles
     + texto ficava enorme e solto). O texto e os controles seguem no tamanho
     de sempre numa coluna de leitura (HOST_CSS); o gráfico só cresce junto.
     O tutor costuma dar altura fixa ao contêiner do Chart.js, e esticado até
     a coluna ele achataria: guardamos a proporção que o contêiner tinha no
     quadro e, na tela cheia, a altura segue a largura. A proporção é lida na
     medição de altura do quadro (fora da tela cheia), não na entrada: quando
     o 'displayMode' chega, o iframe já pode estar no tamanho novo. */
  const chartBoxes = () => {
    const all = window.Chart && window.Chart.instances ? Object.values(window.Chart.instances) : [];
    return all.map((chart) => chart && chart.canvas && chart.canvas.parentElement).filter(Boolean);
  };
  const rememberChartRatios = () => {
    if (document.documentElement.dataset.display === 'fullscreen') return;
    for (const box of chartBoxes()) {
      const rect = box.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      box.setAttribute('data-mesa-ratio', '');
      box.style.setProperty('--mesa-ratio', String(rect.width / rect.height));
    }
  };
  const applyDisplayMode = (mode) => {
    if (mode !== 'fullscreen' && mode !== 'inline') return;
    document.documentElement.dataset.display = mode;
    if (mode === 'fullscreen') markFigure();
  };
  const applyHostContext = (params) => {
    if (!params || typeof params !== 'object') return;
    if (params.theme === 'dark' || params.theme === 'light') document.documentElement.dataset.theme = params.theme;
    applyDisplayMode(params.displayMode);
    const variables = params.styles && params.styles.variables;
    const style = themeStyle();
    if (!style || !variables || typeof variables !== 'object') return;
    let css = ':root{color-scheme:' + (params.theme === 'dark' ? 'dark' : 'light') + ';';
    for (const name of Object.keys(variables)) {
      if (!/^--[a-z0-9-]+$/.test(name)) continue;
      css += name + ':' + String(variables[name]).replace(/[;{}<>]/g, '') + ';';
    }
    style.textContent = css + '}';
    /* Quem desenha em canvas (Chart.js, canvas puro) relê as cores aqui. */
    try { window.dispatchEvent(new Event('mesa-theme')); } catch (error) { /* sem evento */ }
  };
  /* Console e exceções voltam ao host como log do MCP (a prévia do tutor os
     devolve; o quadro da conversa ignora). Teto por documento. */
  let logged = 0;
  const text = (value) => {
    if (value instanceof Error) return String(value.stack || value.message || value);
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (error) { return String(value); }
  };
  const log = (level, logger, data) => {
    if (logged >= 200) return;
    logged += 1;
    rpc('notifications/message', {level, logger, data: String(data).slice(0, 2000)});
  };
  for (const [method, level] of [['log', 'info'], ['info', 'info'], ['debug', 'debug'], ['warn', 'warning'], ['error', 'error']]) {
    const original = console[method];
    console[method] = function () {
      const args = Array.prototype.slice.call(arguments);
      log(level, 'console.' + method, args.map(text).join(' '));
      if (typeof original === 'function') return original.apply(console, args);
    };
  }
  let linkId = 0;
  document.addEventListener('click', (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const anchor = path.find((node) => node && node.tagName === 'A' && node.getAttribute && node.getAttribute('href'));
    if (!anchor) return;
    let url;
    try { url = new URL(anchor.getAttribute('href'), 'https://invalid.local/'); } catch (error) { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.hostname === 'invalid.local') return;
    event.preventDefault();
    if (event.isTrusted) rpc('ui/open-link', {url: url.href}, 'mesa-link-' + (++linkId));
  }, true);
  /* O ponteiro sobre o quadro não chega ao documento da Mesa (o quadro roda em
     outro processo): o quadro avisa a entrada e a saída, e o host mostra as
     ferramentas do canto. Extensão \`mesa/\`, fora do MCP Apps. */
  let pointerAt = 0;
  document.addEventListener('pointermove', () => {
    const at = Date.now();
    if (at - pointerAt < 250) return;
    pointerAt = at;
    rpc('mesa/notifications/pointer', {inside: true});
  }, {passive: true});
  document.documentElement.addEventListener('pointerleave', () => { pointerAt = 0; rpc('mesa/notifications/pointer', {inside: false}); }, {passive: true});
  /* Esc com o foco dentro do quadro: se o documento não usou a tecla, o
     quadro pede ao host para sair da tela cheia (\`ui/request-display-mode\`). */
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !event.isTrusted) return;
    rpc('ui/request-display-mode', {mode: 'inline'}, 'mesa-mode-' + (++linkId));
  });
  const statePayload = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) return null;
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  };
  const applyTheme = (value) => {
    if (value === 'dark' || value === 'light' || value === 'system') document.documentElement.dataset.theme = value;
  };
  const sendReady = () => {
    if (readySent) return;
    readySent = true;
    send('ready', {height: measure()});
  };
  window.mesa = Object.freeze({
    v: 1,
    id: meta.id,
    version: meta.version,
    hash: meta.hash,
    ready: sendReady,
    state: (value) => { lastState = statePayload(value); send('state', lastState); return lastState; },
    getState: () => lastState,
    attempt: (value) => { lastAttempt = statePayload(value); send('attempt', lastAttempt); return lastAttempt; },
    getAttempt: () => lastAttempt,
    height: (value) => { const number = Number(value); sizeChanged(Number.isFinite(number) ? Math.round(number) : 0); },
    error: (message) => send('error', {message: String(message === undefined ? '' : message).slice(0, 400)}),
    onMessage: (fn) => { if (typeof fn === 'function') listeners.push(fn); },
  });
  /* Altura do CONTEÚDO, não do quadro: documentElement nunca é menor que o
     iframe, então medir scrollHeight/clientHeight do html impedia a
     atividade de encolher (sobrava um vão fixo). O corpo tem altura automática;
     só o que transborda o quadro (posicionamento absoluto) cresce além dele. */
  const measure = () => {
    const root = document.documentElement;
    const body = document.body;
    let height = 0;
    if (body) {
      const style = window.getComputedStyle(body);
      height = body.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
    }
    if (root.scrollHeight > root.clientHeight) height = Math.max(height, root.scrollHeight);
    height = Math.ceil(height);
    return height > 0 ? height : 0;
  };
  let lastHeight = 0;
  window.addEventListener('message', (event) => {
    const data = event && event.data;
    if (data && data.jsonrpc === '2.0' && data.method === 'ui/notifications/host-context-changed' && event.source === parent) {
      applyHostContext(data.params);
      return;
    }
    if (!data || data.v !== 1 || data.type === undefined) return;
    if (data.id !== meta.id || Number(data.version) !== Number(meta.version)) return;
    if (data.type === 'init') {
      applyTheme(data.payload && data.payload.theme);
      /* Só o primeiro init carrega estado; reinit não pode regredir o que o
         artefato já mudou depois do primeiro load. */
      if (!initialized && data.payload && data.payload.state && typeof data.payload.state === 'object') {
        lastState = statePayload(data.payload.state);
        initialized = true;
      }
    } else if (data.type === 'theme') {
      applyTheme(data.payload && data.payload.theme);
    }
    for (const fn of listeners) {
      try { fn({type: data.type, payload: data.payload === undefined ? null : data.payload, state: lastState, attempt: lastAttempt}); } catch (error) { send('error', {message: String(error && error.message || error)}); }
    }
  });
  window.addEventListener('error', (event) => {
    const message = String(event && event.message || 'erro no artefato');
    const where = event && event.lineno ? ' (linha ' + event.lineno + (event.colno ? ', coluna ' + event.colno : '') + ')' : '';
    log('error', 'exception', message + where + (event && event.error && event.error.stack ? '\\n' + event.error.stack : ''));
    send('error', {message});
  });
  window.addEventListener('unhandledrejection', (event) => {
    log('error', 'exception', 'promessa rejeitada: ' + text(event && event.reason));
    send('error', {message: 'promessa rejeitada no artefato'});
  });
  const scheduleHeight = () => {
    if (heightTimer) return;
    heightTimer = setTimeout(() => {
      heightTimer = 0;
      rememberChartRatios();
      const height = measure();
      if (Math.abs(height - lastHeight) < 2) return;
      lastHeight = height;
      sizeChanged(height);
    }, 160);
  };
  window.addEventListener('load', () => { scheduleHeight(); sendReady(); });
  window.addEventListener('resize', scheduleHeight);
  if (document.readyState === 'complete') { scheduleHeight(); sendReady(); }
  if (typeof ResizeObserver === 'function' && document.documentElement) {
    try {
      const observer = new ResizeObserver(scheduleHeight);
      observer.observe(document.documentElement);
      const watchBody = () => { if (document.body) observer.observe(document.body); };
      watchBody();
      document.addEventListener('DOMContentLoaded', () => { watchBody(); scheduleHeight(); }, {once: true});
    } catch (error) { /* sem observer */ }
  }
})();`;
/* Folha de base do quadro: o HTML do modelo já nasce com a cara da Mesa
   (botões, campos, sliders, tabelas, tipografia) sem esforço. Tudo em
   `:where()` (especificidade 0): qualquer css do modelo vence sem `!important`.
   Só estilo e tokens `--mesa-*`: nada de rede, fonte remota ou script. */
const HOST_CSS = `html{background:var(--mesa-bg);color:var(--mesa-fg);font:13px/1.5 var(--mesa-font-sans);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;scrollbar-width:none}
html::-webkit-scrollbar{display:none}
body{margin:0;padding:0;background:transparent;display:flow-root}
:where(:focus-visible){outline:2px solid var(--mesa-ring)}
:focus-visible{outline-offset:-2px}
#mesa-activity-root{min-height:36px}
:where(h1,h2,h3,h4){margin:0 0 6px;font-weight:600;line-height:1.3;color:var(--mesa-fg)}
:where(h1){font-size:16px}:where(h2){font-size:15px}:where(h3,h4){font-size:13px}
:where(p,ul,ol,figure){margin:0 0 8px}
:where(small,figcaption,.muted){color:var(--mesa-muted);font-size:12px}
:where(html[data-figure=on][data-display=fullscreen] #mesa-activity-root){height:100vh;box-sizing:border-box}
:where(html[data-figure=on][data-display=fullscreen] [data-figure-box]){display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;height:100%;min-height:0;margin:0;box-sizing:border-box}
:where(html[data-figure=on][data-display=fullscreen] #mesa-activity-root[data-figure-box]){height:100vh}
:where(html[data-figure=on][data-display=fullscreen] [data-figure-media]){flex:1 1 0;min-height:0;width:100%;max-width:100%;height:auto;object-fit:contain}
:where(html[data-figure=on][data-display=fullscreen] [data-figure-caption]){flex:none;margin:0;max-width:100%;text-align:center;font-size:14px;overflow-wrap:anywhere}
:where(html[data-display=fullscreen]:not([data-figure=on])){display:grid;align-content:safe center;min-height:100vh}
:where(html[data-display=fullscreen]:not([data-figure=on]) #mesa-activity-root){box-sizing:border-box;width:min(100%,760px);margin-inline:auto;padding-block:16px}
:where(html[data-display=fullscreen]:not([data-figure=on]) [data-mesa-ratio]){height:auto!important;aspect-ratio:var(--mesa-ratio);width:min(100%,calc(60vh * var(--mesa-ratio)))!important;margin-inline:auto!important}
:where(a){color:var(--mesa-accent-text)}
:where(code,kbd,samp,output){font:12px/1.4 var(--mesa-font-mono)}
:where(pre){margin:0 0 8px;padding:12px;border-radius:var(--mesa-radius);background:var(--mesa-code-bg);color:var(--mesa-code-fg);overflow:auto}
:where(output){color:var(--mesa-fg);font-weight:600}
:where(hr){border:0;border-top:1px solid var(--mesa-border);margin:10px 0}
:where(label){display:inline-flex;flex-direction:column;gap:4px;font-size:12px;color:var(--mesa-muted)}
:where(button,input,select,textarea){box-sizing:border-box;font:inherit;color:var(--mesa-fg)}
:where(button){display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;border:1px solid var(--mesa-border);border-radius:var(--mesa-radius);background:var(--mesa-card);cursor:pointer}
:where(button:hover){background:var(--mesa-hover)}
:where(button:disabled){opacity:.45;cursor:default}
:where(button.primary,button[data-primary],button[type=submit]){border-color:transparent;background:var(--mesa-accent);color:var(--mesa-accent-fg);font-weight:500}
:where(button.primary:hover,button[data-primary]:hover,button[type=submit]:hover){background:var(--mesa-accent);filter:brightness(1.08)}
:where(button.ghost){border-color:transparent;background:transparent;color:var(--mesa-muted)}
:where(button.ghost:hover){background:var(--mesa-hover);color:var(--mesa-fg)}
:where(input[type=text],input[type=number],input[type=search],input[type=email],input:not([type]),select){height:30px;padding:0 10px;border:1px solid var(--mesa-border);border-radius:var(--mesa-radius);background:var(--mesa-card);min-width:0}
:where(textarea){padding:6px 10px;border:1px solid var(--mesa-border);border-radius:var(--mesa-radius);background:var(--mesa-card);min-height:60px;resize:vertical}
:where(input[type=range]){width:100%;height:24px;margin:0;accent-color:var(--mesa-accent)}
:where(input[type=checkbox],input[type=radio]){accent-color:var(--mesa-accent)}
:where(button,input,select,textarea):focus-visible{outline:2px solid var(--mesa-accent);outline-offset:1px}
:where(table){width:100%;border-collapse:collapse;font-size:12px;margin:0 0 8px}
:where(th,td){padding:6px 8px;border-bottom:1px solid var(--mesa-border);text-align:left}
:where(th){font-weight:600;color:var(--mesa-muted)}
:where(details){margin:0 0 8px}
:where(summary){cursor:pointer;color:var(--mesa-muted)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms !important;transition-duration:.001ms !important}}`;
/* O Chart.js embutido nasce com as cores e a fonte dos tokens e as relê a cada
   troca de tema ou acento (\`mesa-theme\`): texto, grade e fonte seguem a
   Mesa sem o tutor fazer nada; as cores das séries são dele (--mesa-chart-N). */
const CHART_THEME_SCRIPT = `(function(){if(!window.Chart)return;var css=function(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();};var apply=function(){Chart.defaults.color=css('--mesa-muted');Chart.defaults.borderColor=css('--mesa-border');Chart.defaults.font.family=css('--mesa-font-sans');Chart.defaults.font.size=12;Chart.defaults.animation=false;};apply();window.addEventListener('mesa-theme',function(){apply();var all=Chart.instances||{};Object.keys(all).forEach(function(k){var c=all[k];try{var o=c.options||{},sc=o.scales||{};Object.keys(sc).forEach(function(id){var x=sc[id];if(!x)return;if(x.grid)x.grid.color=Chart.defaults.borderColor;if(x.border)x.border.color=Chart.defaults.borderColor;if(x.ticks)x.ticks.color=Chart.defaults.color;if(x.title)x.title.color=Chart.defaults.color;});if(o.plugins&&o.plugins.legend&&o.plugins.legend.labels)o.plugins.legend.labels.color=Chart.defaults.color;if(o.plugins&&o.plugins.title)o.plugins.title.color=Chart.defaults.color;c.update('none');}catch(e){}});});})();`;

module.exports = {RUNTIME_SCRIPT, HOST_CSS, CHART_THEME_SCRIPT};
