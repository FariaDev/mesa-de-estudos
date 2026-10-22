import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {
  createActivityRuntime,
  parseActivityUrl,
  activityArtifactUrl,
  buildActivityDocument,
  ACTIVITY_SCHEME,
  DANGEROUS_TAGS,
  LOCKDOWN_SCRIPT,
} = require('../activity-runtime.cjs');
const {normalizeSpec, specHash} = require('../activity-store.cjs');

const SPEC = {title: 'MRUV', objective: 'Explorar a', alternativeMarkdown: 's = v t', html: '<p>x</p>', css: '', js: 'window.mesa.state({a:1});'};

test('parseActivityUrl aceita o artefato com tema e recusa o resto', () => {
  assert.deepEqual(parseActivityUrl('mesa-activity://artifact/act-abc12345/3/index.html?theme=dark'), {kind: 'artifact', id: 'act-abc12345', version: 3, theme: 'dark', accent: 'blue'});
  assert.deepEqual(parseActivityUrl('mesa-activity://artifact/act-abc12345/3/index.html'), {kind: 'artifact', id: 'act-abc12345', version: 3, theme: 'system', accent: 'blue'});
  /* #42: o acento entra no query (um dos seis da Mesa) para o quadro nascer pintado. */
  assert.deepEqual(parseActivityUrl('mesa-activity://artifact/act-abc12345/3/index.html?theme=light&accent=green'), {kind: 'artifact', id: 'act-abc12345', version: 3, theme: 'light', accent: 'green'});
  assert.equal(parseActivityUrl('mesa-activity://artifact/act-abc12345/3/index.html?theme=light&accent=ciano'), null);
  assert.deepEqual(parseActivityUrl('mesa-activity://lib/chart.umd.min.js'), {kind: 'lib', relative: 'chart.umd.min.js'});
  assert.equal(parseActivityUrl('mesa-activity://lib/chart.umd.min.js?x=1'), null);
  assert.equal(activityArtifactUrl('act-abc12345', 2, 'dark', 'pink'), 'mesa-activity://artifact/act-abc12345/2/index.html?theme=dark&accent=pink');
  assert.equal(parseActivityUrl('mesa-activity://artifact/act-abc12345/3/index.html?theme=blue'), null);
  assert.equal(parseActivityUrl('mesa-activity://artifact/act-abc12345/3/index.html?theme=dark&x=1'), null);
  assert.equal(parseActivityUrl('mesa-activity://artifact/act-abc12345/index.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://outro/act-abc12345/3/index.html'), null);
  assert.equal(parseActivityUrl('https://artifact/act-abc12345/3/index.html'), null);
  assert.deepEqual(parseActivityUrl('mesa-activity://katex/katex.min.css'), {kind: 'katex', relative: 'katex.min.css'});
  assert.equal(activityArtifactUrl('act-abc12345', 2, 'dark'), 'mesa-activity://artifact/act-abc12345/2/index.html?theme=dark');
});

test('documento montado pelo host: CSP/Trusted Types, prelude ANTES do html e html do modelo entra inerte', () => {
  const maliciousHtml = '<p>antes</p><script>new RTCPeerConnection().createDataChannel("x");window.mesa.state({a:1});</script><p>depois</p>';
  const spec = {...SPEC, html: maliciousHtml, js: 'window.x="</script><script>evil()</script>";', css: 'body{}</style><style>', title: '<b>t</b>'};
  const html = buildActivityDocument(spec, {id: 'act-abc12345', version: 1, hash: 'sha256:x', theme: 'dark'});
  assert.match(html, /<html lang="pt-BR" data-theme="dark">/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /frame-src 'none'/);
  assert.match(html, /trusted-types default mesa-activity-policy/);
  assert.match(html, /require-trusted-types-for 'script'/);
  assert.doesNotMatch(html, /unsafe-eval/);
  assert.ok(html.includes('&lt;b&gt;t&lt;/b&gt;'));
  /* Ordem de segurança: CSP -> lockdown -> API/runtime -> conteúdo do modelo. */
  const metaAt = html.indexOf('Content-Security-Policy');
  const lockdownAt = html.indexOf(LOCKDOWN_SCRIPT);
  const apiAt = html.indexOf('window.__MESA_ACTIVITY__');
  const rootAt = html.indexOf('<div id="mesa-activity-root"></div>');
  const contentAt = html.indexOf('window.__MESA_ACTIVITY_HTML__');
  const modelJsAt = html.lastIndexOf('<script>');
  assert.ok(metaAt >= 0 && lockdownAt > metaAt, 'lockdown depois do CSP');
  assert.ok(apiAt > lockdownAt, 'API depois do lockdown');
  assert.ok(rootAt > apiAt && contentAt > rootAt, 'conteúdo do modelo depois da API e do root');
  assert.ok(modelJsAt > contentAt, 'js do modelo por último');
  /* O html cru NÃO é markup no documento: entra como string JSON e só o
     sanitizador do prelude o transforma em DOM depois do lockdown. */
  assert.ok(!html.includes(`<div id="mesa-activity-root">${maliciousHtml}</div>`), 'html cru não pode ser markup');
  assert.doesNotMatch(html.slice(0, contentAt), /<iframe|<object|<embed/);
  assert.ok(html.indexOf('<p>antes</p>') > contentAt, 'html do modelo entra como dado JSON depois do root');
  assert.ok(html.indexOf('new RTCPeerConnection') > contentAt, 'snippet aparece apenas como dado JSON do html');
  assert.ok(html.includes('window.mesa.state({a:1});<\\/script>'), 'fechamento de script dentro do JSON precisa estar escapado');
  assert.ok(html.indexOf('window.mesa = Object.freeze') < contentAt, 'window.mesa disponível para o js do modelo');
  const modelScript = html.slice(html.lastIndexOf('<script>'));
  assert.doesNotMatch(modelScript, /<\/script><script>evil/);
  assert.match(modelScript, /<\\\/script/);
  /* Auto (system): o wrapper já nasce com o tema e o CSS responde à preferência
     do SO, com color-scheme coerente. */
  const systemDoc = buildActivityDocument(SPEC, {id: 'act-abc12345', version: 1, hash: 'sha256:x', theme: 'system'});
  assert.match(systemDoc, /data-theme="system"/);
  assert.match(systemDoc, /@media \(prefers-color-scheme:dark\)/);
  assert.match(systemDoc, /<style id="mesa-theme">:root\{color-scheme:light;--mesa-bg:#f4f4f4;/);
  assert.match(systemDoc, /color-scheme:dark/);
  /* #42: os tokens vêm do núcleo, com o espelho MCP Apps e a paleta. */
  const dark = buildActivityDocument(SPEC, {id: 'act-abc12345', version: 1, hash: 'sha256:x', theme: 'dark', accent: 'violet'});
  assert.match(dark, /--mesa-bg:#242424;/);
  assert.match(dark, /--mesa-chart-1:#a78bfa;/);
  assert.match(dark, /--color-background-primary:#242424;/);
  assert.doesNotMatch(dark, /chart\.umd/, 'sem gráficos pedidos, a biblioteca não entra');
  const charts = buildActivityDocument({...SPEC, charts: true}, {id: 'act-abc12345', version: 1, hash: 'sha256:x'});
  assert.match(charts, /<script src="mesa-activity:\/\/lib\/chart\.umd\.min\.js"><\/script>/);
  assert.match(charts, /script-src 'unsafe-inline' mesa-activity:/, 'a CSP só abre o esquema local, nunca rede');
  assert.doesNotMatch(charts, /(?:src|href)="https?:/, 'nenhum recurso de rede no documento');
  assert.match(systemDoc, /value === 'system'/);
});

test('prelude cobre os vetores de subframe e Trusted Types', () => {
  assert.deepEqual(DANGEROUS_TAGS, ['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe', 'applet']);
  for (const marker of [
    "createPolicy('mesa-activity-policy'",
    "createPolicy('default'",
    'createElementNS',
    "appendChild', guard",
    "insertBefore', guard",
    "replaceChildren', guard",
    "insertAdjacentHTML', setAdjacentHTML",
    "outerHTML', setOuterHTML",
    "insertNode', guard",
    "document.write'",
    'MutationObserver',
    'RTCPeerConnection',
    'WebTransport',
    'mediaDevices',
    "lock(target, 'setHTML', setSanitizedHTML)",
    "lock(target, 'setHTMLUnsafe', setSanitizedHTML)",
    "lock(Document, 'parseHTML', parseSanitizedDocument)",
    "lock(Document, 'parseHTMLUnsafe', parseSanitizedDocument)",
    'shadowDeclaration',
    'CREATE_HTML_DOCUMENT',
    'descend(',
    "descriptor(proto.Element, 'shadowRoot')",
  ]) {
    assert.ok(LOCKDOWN_SCRIPT.includes(marker), `prelude sem ${marker}`);
  }
  const html = buildActivityDocument(SPEC, {id: 'act-abc12345', version: 1, hash: 'sha256:x'});
  const bootAt = html.indexOf("root.innerHTML=html");
  assert.ok(bootAt > html.indexOf(LOCKDOWN_SCRIPT), 'bootstrap de conteúdo depois do prelude');
});

test('katex opt-in inclui CSS/JS fixos e amplia a CSP só para o esquema', () => {
  const plain = buildActivityDocument({...SPEC, katex: false}, {id: 'a', version: 1, hash: 'h'});
  assert.doesNotMatch(plain, /katex\.min\.js/);
  const withKatex = buildActivityDocument({...SPEC, katex: true}, {id: 'a', version: 1, hash: 'h'});
  assert.match(withKatex, /mesa-activity:\/\/katex\/katex\.min\.css/);
  assert.match(withKatex, /mesa-activity:\/\/katex\/katex\.min\.js/);
  assert.match(withKatex, /script-src 'unsafe-inline' mesa-activity:/);
  assert.match(withKatex, /connect-src 'none'/);
});

test('runtime registra por hash, serve o artefato e nega o resto', async () => {
  const store = {publish: async () => {}};
  const runtime = createActivityRuntime({store});
  const spec = normalizeSpec(SPEC);
  const hash = specHash(spec);
  const item = {id: 'act-abc12345', version: 1, hash, conversationId: 'c'};
  assert.ok(runtime.remember(item, spec));
  assert.equal(runtime.has('act-abc12345', 1), true);
  const response = await runtime.protocolHandler({url: activityArtifactUrl(item.id, item.version, 'dark')});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const body = await response.text();
  assert.match(body, /data-theme="dark"/);
  const missing = await runtime.protocolHandler({url: 'mesa-activity://artifact/act-inexistente/1/index.html'});
  assert.equal(missing.status, 404);
  assert.equal(runtime.remember({...item, hash: 'sha256:outro'}, spec), null);
  assert.equal(runtime.has('act-abc12345', 1), true);
  const forged = runtime.remember({id: 'act-forjado1', version: 1, hash: specHash({...spec, title: 'outro'})}, spec);
  assert.equal(forged, null, 'hash do item precisa bater com a spec');
});

test('katex serve só a lista fixa e nunca escapa do diretório', async () => {
  const runtime = createActivityRuntime({});
  const css = await runtime.protocolHandler({url: 'mesa-activity://katex/katex.min.css'});
  assert.equal(css.status, 200);
  const nope = await runtime.protocolHandler({url: 'mesa-activity://katex/katex.js'});
  assert.equal(nope.status, 404);
  const traversal = await runtime.protocolHandler({url: 'mesa-activity://katex/fonts/../../package.json'});
  assert.equal(traversal.status, 404);
});

test('installProtocol e installSessionGuards ligam nas APIs do host', () => {
  const runtime = createActivityRuntime({});
  let handled = null;
  const session = {
    protocol: {handle: (scheme, listener) => { handled = {scheme, listener}; }},
    webRequest: {onBeforeRequest: (filter, listener) => { session.captured = {filter, listener}; }},
  };
  runtime.installProtocol(session);
  assert.equal(handled.scheme, ACTIVITY_SCHEME);
  assert.equal(typeof handled.listener, 'function');
  assert.equal(runtime.installSessionGuards(session), true);
  const decisions = [];
  session.captured.listener({frame: {url: 'mesa-activity://artifact/act-1/1/index.html'}}, (result) => decisions.push(result.cancel));
  session.captured.listener({frame: {url: 'file:///app/index.html'}}, (result) => decisions.push(result.cancel));
  session.captured.listener({frame: null}, (result) => decisions.push(result.cancel));
  assert.deepEqual(decisions, [true, false, false]);
});

test('attachWindow autoriza a primeira carga do artefato e nega navegação posterior', () => {
  const runtime = createActivityRuntime({});
  const spec = normalizeSpec(SPEC);
  runtime.remember({id: 'act-abc12345', version: 1, hash: specHash(spec)}, spec);
  const wc = new EventEmitter();
  const loaded = {url: 'about:blank'};
  const next = {url: 'about:blank'};
  runtime.attachWindow({webContents: wc});

  const navigate = (url, frameRef) => {
    const details = {url, isMainFrame: false, frame: frameRef, prevented: false, preventDefault() { this.prevented = true; }};
    wc.emit('will-frame-navigate', details);
    return details.prevented;
  };
  assert.equal(navigate('mesa-activity://artifact/act-abc12345/1/index.html?theme=dark', loaded), false);
  loaded.url = 'mesa-activity://artifact/act-abc12345/1/index.html?theme=dark';
  assert.equal(navigate('mesa-activity://artifact/act-abc12345/1/index.html?theme=dark'), true, 'frame carregado não navega de novo');
  assert.equal(navigate('https://example.com/', next), true);
  assert.equal(navigate('mesa-activity://artifact/act-inexistente/1/index.html', next), true);
  assert.equal(navigate('about:blank', next), false);
  assert.equal(navigate('mesa-activity://artifact/act-abc12345/1/index.html', null), true, 'sem frame, nega');
  const top = {url: 'https://example.com', isMainFrame: true, frame: null, prevented: false, preventDefault() { this.prevented = true; }};
  wc.emit('will-frame-navigate', top);
  assert.equal(top.prevented, false, 'o topo continua com o host');
});

test('tela cheia da figura (#52): o documento traz o script de marcação e o CSS sem peso próprio', () => {
  const html = buildActivityDocument(SPEC, {id: 'act-abc12345', version: 1, hash: 'sha256:x', theme: 'light'});
  assert.match(html, /applyDisplayMode/, 'o quadro reage ao displayMode do host');
    const rules = html.split('\n').filter((line) => line.includes('html[data-figure=on]'));
  assert.ok(rules.length >= 3, `regras de tela cheia da figura presentes (${rules.length})`);
  assert.ok(rules.every((line) => line.startsWith(':where(')), `especificidade zero: o autor da atividade sempre vence (${rules.find((l) => !l.startsWith(':where('))})`);
});

test('tela cheia de conteúdo misto: coluna de leitura e gráfico com a proporção do quadro, sem peso próprio', () => {
  const html = buildActivityDocument(SPEC, {id: 'act-abc12345', version: 1, hash: 'sha256:x', theme: 'light'});
  assert.match(html, /rememberChartRatios/, 'o quadro guarda a proporção dos gráficos fora da tela cheia');
  const rules = html.split('\n').filter((line) => line.includes(':not([data-figure=on])'));
  assert.equal(rules.length, 3, `regras da tela cheia mista presentes (${rules.length})`);
  assert.ok(rules.every((line) => line.startsWith(':where(')), `especificidade zero (${rules.find((l) => !l.startsWith(':where('))})`);
  assert.ok(rules.some((line) => /#mesa-activity-root\)\{[^}]*width:min\(100%,760px\);margin-inline:auto/.test(line)), 'largura de leitura centralizada');
  assert.ok(rules.some((line) => /\[data-mesa-ratio\]\)\{[^}]*aspect-ratio:var\(--mesa-ratio\)/.test(line)), 'gráfico com a proporção que tinha');
  assert.ok(!rules.some((line) => /font-size|zoom|scale\(/.test(line)), 'texto e controles não escalam');
});
