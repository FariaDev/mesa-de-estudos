'use strict';

/* Núcleo do quadro (#42): tokens, paleta e espelho MCP Apps. */
const activityView = require('./src/activity-view.mjs');
const {normalizeSpec} = require('./activity-store.cjs');
const {ACTIVITY_SCHEME, KATEX_HOST, LIB_HOST} = require('./activity-protocol.cjs');
const {CHART_THEME_SCRIPT, HOST_CSS, RUNTIME_SCRIPT} = require('./activity-page-script.cjs');
const {LOCKDOWN_SCRIPT} = require('./activity-lockdown-script.cjs');

/* Atividades — o documento servido: escapes, CSP e a montagem do HTML com
   prelude, runtime e o conteúdo do modelo.
   Saiu de activity-runtime.cjs na #43 fase 2. */

const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeInlineScript = (value) => String(value).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\u0021--');
const escapeInlineStyle = (value) => String(value).replace(/<\/style/gi, '<\\/style');
function cspFor(katex, charts = false) {
  const scheme = katex || charts ? ` ${ACTIVITY_SCHEME}:` : '';
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline'${scheme}`,
    `style-src 'unsafe-inline'${scheme}`,
    'img-src data:',
    `font-src data:${scheme}`,
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "worker-src 'none'",
    'trusted-types default mesa-activity-policy',
    "require-trusted-types-for 'script'",
  ].join('; ');
}
/* Documento completo do artefato, montado pelo host. O modelo contribui com
   html/css/js; o wrapper (CSP, prelude, API e runtime) é sempre do host.
   ORDEM OBRIGATÓRIA: o CSP e o `LOCKDOWN_SCRIPT` vêm antes de QUALQUER HTML do
   modelo. O html NÃO é interpolado como markup pelo parser (um `<iframe
   srcdoc>` no HTML cru escaparia do prelude): ele entra como string JSON e é
   inserido pelo host via `innerHTML`, que passa pelo sanitizador do prelude.
   `window.mesa`/`__MESA_ACTIVITY__` também vêm antes do conteúdo para o `js`
   do modelo poder usá-los. */
function buildActivityDocument(spec, {id, version, hash, theme = 'system', accent = 'blue'} = {}) {
  const clean = normalizeSpec(spec);
  const katex = clean.katex === true;
  const charts = clean.charts === true;
  const chartTail = charts ? `<script src="${ACTIVITY_SCHEME}://${LIB_HOST}/chart.umd.min.js"></script>\n<script>${CHART_THEME_SCRIPT}</script>` : '';
  const themeCss = activityView.documentThemeCss(theme, accent);
  const katexHead = katex ? `<link rel="stylesheet" href="${ACTIVITY_SCHEME}://${KATEX_HOST}/katex.min.css">` : '';
  const katexTail = katex ? `<script src="${ACTIVITY_SCHEME}://${KATEX_HOST}/katex.min.js"></script>` : '';
  const themeName = theme === 'dark' || theme === 'light' ? theme : 'system';
  return `<!doctype html>
<html lang="pt-BR" data-theme="${themeName}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(cspFor(katex, charts))}">
<script>${LOCKDOWN_SCRIPT}</script>
<script>window.__MESA_ACTIVITY__=${JSON.stringify({v: 1, id, version, hash})};</script>
<script>${RUNTIME_SCRIPT}</script>
<title>${escapeHtml(clean.title)}</title>
<style id="mesa-theme">${escapeInlineStyle(themeCss)}</style>
<style>${HOST_CSS}</style>
${katexHead}
<style>${escapeInlineStyle(clean.css)}</style>
</head>
<body>
<div id="mesa-activity-root"></div>
<script>window.__MESA_ACTIVITY_HTML__=${escapeInlineScript(JSON.stringify(clean.html))};</script>
<script>(function(){var root=document.getElementById('mesa-activity-root');var html=window.__MESA_ACTIVITY_HTML__;try{delete window.__MESA_ACTIVITY_HTML__;}catch(error){window.__MESA_ACTIVITY_HTML__=undefined;}if(root&&typeof html==='string')root.innerHTML=html;})();</script>
${katexTail}
${chartTail}
<script>${escapeInlineScript(clean.js)}</script>
</body>
</html>`;
}

module.exports = {cspFor, buildActivityDocument};
