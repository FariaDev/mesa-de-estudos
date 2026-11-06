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

test('parseActivityUrl aceita o host com id+versão e recusa formatos antigos (#89)', () => {
  /* #89: o host carrega id E versão — cada revisão da mesma atividade tem
     site (e processo) próprios; o caminho é só `/index.html`. */
  assert.deepEqual(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html?theme=dark'), {kind: 'artifact', id: 'act-abc12345', version: 3, theme: 'dark', accent: 'blue'});
  assert.deepEqual(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html'), {kind: 'artifact', id: 'act-abc12345', version: 3, theme: 'system', accent: 'blue'});
  /* A prévia do tutor usa um id temporário `pv-`; o mesmo formato de host. */
  assert.deepEqual(parseActivityUrl('mesa-activity://pv-abc12345--v1/index.html'), {kind: 'artifact', id: 'pv-abc12345', version: 1, theme: 'system', accent: 'blue'});
  /* #42: o acento entra no query (um dos seis da Mesa) para o quadro nascer pintado. */
  assert.deepEqual(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html?theme=light&accent=green'), {kind: 'artifact', id: 'act-abc12345', version: 3, theme: 'light', accent: 'green'});
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html?theme=light&accent=ciano'), null);
  assert.deepEqual(parseActivityUrl('mesa-activity://lib/chart.umd.min.js'), {kind: 'lib', relative: 'chart.umd.min.js'});
  assert.equal(parseActivityUrl('mesa-activity://lib/chart.umd.min.js?x=1'), null);
  assert.equal(activityArtifactUrl('act-abc12345', 2, 'dark', 'pink'), 'mesa-activity://act-abc12345--v2/index.html?theme=dark&accent=pink');
  /* Ids que contêm `-` (e até um sufixo `--v<n>` no próprio id): a versão é
     o ÚLTIMO `--v<dígitos>` do host, sem ambiguidade. */
  assert.deepEqual(parseActivityUrl('mesa-activity://act-abc-def--v3/index.html'), {kind: 'artifact', id: 'act-abc-def', version: 3, theme: 'system', accent: 'blue'});
  assert.deepEqual(parseActivityUrl('mesa-activity://act-abc--v2--v3/index.html'), {kind: 'artifact', id: 'act-abc--v2', version: 3, theme: 'system', accent: 'blue'});
  assert.equal(activityArtifactUrl('act-abc--v2', 3), 'mesa-activity://act-abc--v2--v3/index.html?theme=system');
  /* Teto do host: id máximo do store (68) + `--v` + 7 dígitos = 78. O
     Chromium aceita esse host no esquema (hunt do watchdog, #89). */
  const longId = `act-${'a'.repeat(64)}`;
  assert.equal(`${longId}--v1000000`.length, 78);
  assert.deepEqual(parseActivityUrl(`mesa-activity://${longId}--v1000000/index.html`), {kind: 'artifact', id: longId, version: 1000000, theme: 'system', accent: 'blue'});
  assert.equal(parseActivityUrl(`mesa-activity://act-${'a'.repeat(65)}--v1/index.html`), null, 'id acima do store');
  assert.equal(parseActivityUrl(`mesa-activity://${longId}--v1x/index.html`), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html?theme=blue'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html?theme=dark&x=1'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html#x'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3/index.html').version, 3);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345/3/index.html'), null, 'formato da #88 (versão no caminho) é recusado');
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3/3/index.html'), null, 'versão no caminho além do host');
  assert.equal(parseActivityUrl('mesa-activity://artifact/act-abc12345/3/index.html'), null, 'formato antigo (host fixo) é recusado');
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345/index.html'), null, 'sem versão no host');
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v/index.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--vx/index.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v0/index.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v01/index.html'), null, 'zero à esquerda');
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v1000001/index.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v12345678/index.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://outro/act-abc12345/3/index.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3/outro.html'), null);
  assert.equal(parseActivityUrl('mesa-activity://act-a--v3/index.html'), null, 'id curto demais');
  assert.equal(parseActivityUrl('mesa-activity://act-abc_123--v3/index.html'), null, 'id com underscore');
  assert.equal(parseActivityUrl('mesa-activity://act-abc12345--v3:80/index.html'), null, 'porta');
  assert.equal(parseActivityUrl('mesa-activity://user:pass@act-abc12345--v3/index.html'), null, 'credenciais');
  assert.equal(parseActivityUrl('https://act-abc12345--v3/index.html'), null);
  assert.deepEqual(parseActivityUrl('mesa-activity://katex/katex.min.css'), {kind: 'katex', relative: 'katex.min.css'});
  assert.equal(activityArtifactUrl('act-abc12345', 2, 'dark'), 'mesa-activity://act-abc12345--v2/index.html?theme=dark');
});

test('buildActivityUrl usa o host com id+versão e a origem exata (#89)', async () => {
  const {buildActivityUrl, activityOrigin} = await import('../src/activity-messages.mjs');
  assert.equal(buildActivityUrl({id: 'act-abc12345', version: 2}, 'dark', 'pink'), 'mesa-activity://act-abc12345--v2/index.html?theme=dark&accent=pink');
  assert.equal(buildActivityUrl({id: 'act-abc12345', version: 1}), 'mesa-activity://act-abc12345--v1/index.html?theme=system');
  assert.equal(activityOrigin({id: 'act-abc12345', version: 2}), 'mesa-activity://act-abc12345--v2');
});

test('activityOriginAllowed aceita só origem opaca/vazia ou a exata da revisão (#89)', async () => {
  const {activityOriginAllowed} = await import('../src/activity-messages.mjs');
  const item = {id: 'act-abc12345', version: 2};
  assert.equal(activityOriginAllowed('null', item), true, 'origem opaca do sandbox');
  assert.equal(activityOriginAllowed('', item), true, 'origem não preenchida');
  assert.equal(activityOriginAllowed('mesa-activity://act-abc12345--v2', item), true, 'origem exata desta revisão');
  assert.equal(activityOriginAllowed('mesa-activity://act-abc12345--v1', item), false, 'outra revisão da mesma atividade');
  assert.equal(activityOriginAllowed('mesa-activity://act-outra--v2', item), false, 'outra atividade');
  assert.equal(activityOriginAllowed('mesa-activity://katex', item), false, 'outro host do esquema');
  assert.equal(activityOriginAllowed('https://x', item), false, 'fora do esquema');
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
  assert.match(systemDoc, /<style id="mesa-theme">:root\{color-scheme:light;--mesa-bg:#ffffff;/);
  assert.match(systemDoc, /color-scheme:dark/);
  /* #42: os tokens vêm do núcleo, com o espelho MCP Apps e a paleta. */
  const dark = buildActivityDocument(SPEC, {id: 'act-abc12345', version: 1, hash: 'sha256:x', theme: 'dark', accent: 'violet'});
  assert.match(dark, /--mesa-bg:#191919;/);
  assert.match(dark, /--mesa-chart-1:#a78bfa;/);
  assert.match(dark, /--color-background-primary:#191919;/);
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
    "appendChild', guardOne",
    "insertBefore', guardOne",
    "replaceChildren', guardMany",
    "insertAdjacentHTML', setAdjacentHTML",
    "outerHTML', setOuterHTML",
    "insertNode', guardOne",
    'argIsLink',
    'guardMany',
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
    /* 'link' do modelo sai em todo sink, sem tocar nos 'link' do host. */
    'isLinkName',
    'stripLinks',
    'carregar recursos externos',
    "lock(proto.Element, 'setAttribute'",
    'setAttributeNS',
    'HTMLLinkElement',
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

test('KaTeX embutido em <style>; nenhum link no documento vivo (#76753cd6)', () => {
  const evil = '<link rel="dns-prefetch" href="https://evil.example"><link rel="stylesheet" href="https://evil.example/evil.css">';
  const withKatex = buildActivityDocument({...SPEC, katex: true, html: `<p>x</p>${evil}`}, {id: 'a', version: 1, hash: 'h'});
  /* Regressão do 76753cd6: o <link> do host vinha depois do prelude e o
     MutationObserver o removia junto com os do modelo — o .katex nascia sem
     a fonte KaTeX (prova em janela: fontFamily do sistema, 0 links). */
  const contentAt = withKatex.indexOf('window.__MESA_ACTIVITY_HTML__');
  assert.doesNotMatch(withKatex.slice(0, contentAt), /<link/, 'nenhum link no documento vivo: todo link é do modelo');
  assert.match(withKatex.slice(0, contentAt), /\.katex/, 'o CSS do KaTeX vai embutido em <style>');
  assert.match(withKatex.slice(0, contentAt), /mesa-activity:\/\/katex\/fonts\//, 'as fontes do KaTeX apontam para o esquema (font-src já aceita)');
  assert.doesNotMatch(withKatex.slice(0, contentAt), /url\(fonts\//, 'nenhum url(fonts/) relativo sobra no CSS embutido');
  assert.ok(withKatex.indexOf('evil.example') > contentAt, 'o link do modelo entra só como dado JSON depois do prelude');
  assert.ok(!withKatex.slice(0, contentAt).includes('evil.example'), 'nada do modelo antes do conteúdo');
  /* Sem KaTeX não há CSS KaTeX nem link nenhum: o estilo do wrapper é <style>. */
  const plain = buildActivityDocument({...SPEC, html: '<p>x</p>'}, {id: 'a', version: 1, hash: 'h'});
  assert.doesNotMatch(plain, /<link/, 'documento sem KaTeX não tem link');
  assert.doesNotMatch(plain, /\.katex/, 'documento sem KaTeX não embute o CSS');
});

test('katex opt-in inclui CSS/JS fixos e amplia a CSP só para o esquema', () => {
  const plain = buildActivityDocument({...SPEC, katex: false}, {id: 'a', version: 1, hash: 'h'});
  assert.doesNotMatch(plain, /katex\.min\.js/);
  const withKatex = buildActivityDocument({...SPEC, katex: true}, {id: 'a', version: 1, hash: 'h'});
  const headAt = withKatex.indexOf('window.__MESA_ACTIVITY_HTML__');
  assert.match(withKatex.slice(0, headAt), /\.katex/, 'CSS do KaTeX embutido em <style>, sem link');
  assert.doesNotMatch(withKatex.slice(0, headAt), /<link/, 'nenhum link no documento vivo');
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
  const missing = await runtime.protocolHandler({url: 'mesa-activity://act-inexistente--v1/index.html'});
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
  session.captured.listener({frame: {url: 'mesa-activity://act-abc1--v1/index.html'}}, (result) => decisions.push(result.cancel));
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
  assert.equal(navigate('mesa-activity://act-abc12345--v1/index.html?theme=dark', loaded), false);
  loaded.url = 'mesa-activity://act-abc12345--v1/index.html?theme=dark';
  assert.equal(navigate('mesa-activity://act-abc12345--v1/index.html?theme=dark'), true, 'frame carregado não navega de novo');
  assert.equal(navigate('https://example.com/', next), true);
  assert.equal(navigate('mesa-activity://act-inexistente--v1/index.html', next), true);
  assert.equal(navigate('about:blank', next), false);
  assert.equal(navigate('mesa-activity://act-abc12345--v1/index.html', null), true, 'sem frame, nega');
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
