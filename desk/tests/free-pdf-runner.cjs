'use strict';

/* Wrapper isolado do serviço de PDF: roda DENTRO do Electron (main), exercita
   `material-pdf.cjs`/`free-workspaces.cjs` num runtime temporário e devolve um
   JSON entre as linhas `__RESULT__`. O teste em Node (`free-material-pdf.test.mjs`)
   lê o PDF real, extrai texto/páginas com pdfjs e confere o resultado.

   Uso: electron tests/free-pdf-runner.cjs <runtimeDir> <scenario> */

const {app} = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const store = require('../free-workspaces.cjs');
const materialPdf = require('../material-pdf.cjs');

const runtime = String(process.argv[2] || '');
const scenario = String(process.argv[3] || '');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/* A janela de impressão é destruída quando o PDF termina (e a de cancelamento
   ainda antes); sem este ouvinte o Electron encerraria o app no
   `window-all-closed` e o runner morreria antes de gravar o resultado. */
app.on('window-all-closed', () => {});

function longMarkdown() {
  const parts = [
    '# Limites e continuidade',
    '',
    'A derivada de $f(x)=x^2$ no ponto $a$ é $f\'(a)=2a$. O limite',
    '',
    '$$\\lim_{h\\to 0}\\frac{f(a+h)-f(a)}{h}=f\'(a)$$',
    '',
    'define a reta tangente; a integral',
    '',
    '$$\\int_0^1 x^2\\,dx=\\frac{1}{3}$$',
    '',
  ];
  for (let index = 0; index < 70; index += 1) {
    parts.push(`Parágrafo ${index + 1}. A função $g(x)=x^3-3x$ tem derivada $g\'(x)=3x^2-3$ e pontos críticos em $x=\\pm 1$. A leitura do gráfico confirma concavidade e o teste da segunda derivada.`);
    parts.push('');
    if (index % 7 === 3) parts.push('```js', 'const f = (x) => x * x;', 'console.log(f(3));', '```', '');
  }
  parts.push('| x | f(x) |', '| --- | --- |', '| 0 | 0 |', '| 1 | 1 |', '| 2 | 4 |', '');
  return parts.join('\n');
}

async function scenarioRender() {
  store.ensureWorkspace(runtime, {sessionId: 'render-sess', title: 'Render'});
  const saved = await store.saveMaterial(runtime, 'render-sess', {
    title: 'Limites e derivadas',
    markdown: longMarkdown(),
    timeoutMs: 60000,
  });
  const stat = fs.statSync(saved.material.path);
  return {
    ok: true,
    path: saved.material.path,
    name: saved.material.name,
    bytes: saved.material.bytes,
    sha256: saved.material.sha256,
    statBytes: stat.size,
    listed: store.findWorkspace(runtime, 'render-sess').materials.map((material) => material.name),
    payload: store.workspacePayload(saved.workspace),
  };
}

async function scenarioRadical() {
  const dir = path.join(runtime, 'radicais');
  fs.mkdirSync(dir);
  let vectors = [];
  const inspect = (_event, win) => {
    const print = win.webContents.printToPDF.bind(win.webContents);
    win.webContents.printToPDF = async (options) => {
      vectors = await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.katex svg')).map(el=>{const rect=el.getBoundingClientRect();return {display:getComputedStyle(el).display,width:rect.width,height:rect.height};})`);
      return print(options);
    };
  };
  app.once('browser-window-created', inspect);
  try {
    const saved = await materialPdf.savePdf({dir, stem: 'Radical', markdown: '$$\\sqrt{25}=5$$'});
    return {ok: true, path: saved.path, vectors};
  } finally { app.removeListener('browser-window-created', inspect); }
}

async function scenarioNetwork() {
  let hits = 0;
  const server = http.createServer((_request, response) => {
    hits += 1;
    response.end('x');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    store.ensureWorkspace(runtime, {sessionId: 'net-sess'});
    const markdown = `# Probe\n\n<img src="http://127.0.0.1:${port}/ping.png">\n\nTexto final do material.\n`;
    const saved = await store.saveMaterial(runtime, 'net-sess', {title: 'Probe', markdown, timeoutMs: 60000});
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {ok: true, hits, path: saved.material.path};
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function scenarioAbort() {
  store.ensureWorkspace(runtime, {sessionId: 'abort-sess'});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25);
  let code = '';
  try {
    await store.saveMaterial(runtime, 'abort-sess', {
      title: 'Abortado',
      markdown: longMarkdown(),
      signal: controller.signal,
      timeoutMs: 60000,
    });
    code = 'NO_ERROR';
  } catch (error) {
    code = String(error.code || error.name || 'erro');
  } finally {
    clearTimeout(timer);
  }
  const dir = path.join(store.workspaceDir(runtime, 'abort-sess'), 'materials');
  const leftovers = fs.readdirSync(dir);
  return {ok: code === 'ABORTED' && leftovers.length === 0, code, leftovers, materials: store.findWorkspace(runtime, 'abort-sess').materials.length};
}

async function scenarioWriteFail() {
  store.ensureWorkspace(runtime, {sessionId: 'fail-sess'});
  const dir = path.join(store.workspaceDir(runtime, 'fail-sess'), 'materials');
  fs.chmodSync(dir, 0o555);
  let code = '';
  try {
    await materialPdf.savePdf({dir, stem: 'Falha', markdown: '# Falha\n\nTexto.', timeoutMs: 60000});
    code = 'NO_ERROR';
  } catch (error) {
    code = String(error.code || error.name || 'erro');
  } finally {
    fs.chmodSync(dir, 0o755);
  }
  return {ok: code === 'WRITE', code, leftovers: fs.readdirSync(dir)};
}

async function scenarioUnique() {
  store.ensureWorkspace(runtime, {sessionId: 'unique-sess'});
  const dir = path.join(store.workspaceDir(runtime, 'unique-sess'), 'materials');
  const markdown = '# Concorrência\n\nDois PDFs com o mesmo título.';
  const [one, two] = await Promise.all([
    materialPdf.savePdf({dir, stem: 'Mesmo', markdown, timeoutMs: 60000}),
    materialPdf.savePdf({dir, stem: 'Mesmo', markdown, timeoutMs: 60000}),
  ]);
  const valid = (entry) => fs.readFileSync(entry.path).subarray(0, 5).toString('latin1') === '%PDF-';
  return {ok: one.name !== two.name && valid(one) && valid(two), names: [one.name, two.name], bytes: [one.bytes, two.bytes]};
}

async function scenarioPayload() {
  const codes = {};
  for (const [name, options] of [
    ['not-string', {markdown: 42}],
    ['empty', {markdown: '   '}],
    ['huge', {markdown: 'x'.repeat(Number(store.maxDraftChars()) + 1)}],
  ]) {
    try {
      await materialPdf.renderPdf(options);
      codes[name] = 'NO_ERROR';
    } catch (error) {
      codes[name] = String(error.code || error.name || 'erro');
    }
  }
  return {ok: codes['not-string'] === 'BAD_PAYLOAD' && codes.empty === 'BAD_PAYLOAD' && codes.huge === 'TOO_BIG', codes};
}

async function scenarioInject() {
  store.ensureWorkspace(runtime, {sessionId: 'inject-sess'});
  const workspaceDir = store.workspaceDir(runtime, 'inject-sess');
  const materialsDir = path.join(workspaceDir, 'materials');
  const fake = {
    async savePdf({dir, stem}) {
      const file = path.join(dir, `${stem || 'Material'}.pdf`);
      fs.writeFileSync(file, '%PDF-1.4\nfake\n%%EOF\n');
      fs.writeFileSync(path.join(workspaceDir, 'workspace.json'), '{quebrado');
      return {name: path.basename(file), path: file, bytes: fs.statSync(file).size, sha256: sha256(file)};
    },
  };
  let code = '';
  try {
    await store.saveMaterial(runtime, 'inject-sess', {title: 'Falha de metadata', markdown: '# x', pdf: fake});
    code = 'NO_ERROR';
  } catch (error) {
    code = String(error.code || error.name || 'erro');
  }
  return {ok: code === 'CORRUPT' && fs.readdirSync(materialsDir).length === 0, code, leftovers: fs.readdirSync(materialsDir)};
}

async function run() {
  switch (scenario) {
    case 'render': return scenarioRender();
    case 'radical': return scenarioRadical();
    case 'network': return scenarioNetwork();
    case 'abort': return scenarioAbort();
    case 'writefail': return scenarioWriteFail();
    case 'unique': return scenarioUnique();
    case 'payload': return scenarioPayload();
    case 'inject': return scenarioInject();
    default: return {ok: false, error: {code: 'BAD_SCENARIO', message: `cenário desconhecido: ${scenario}`}};
  }
}

app.whenReady().then(async () => {
  let result;
  try {
    result = await run();
  } catch (error) {
    result = {ok: false, error: {name: error.name, code: error.code || '', message: error.message, stack: String(error.stack || '').split('\n').slice(0, 8).join('\n')}};
  }
  process.stdout.write(`\n__RESULT__ ${JSON.stringify(result)}\n`);
  app.exit(result.ok ? 0 : 1);
});
