'use strict';

/* Cenários Electron das figuras do tutor (#60), chamados por
   `free-pdf-runner.cjs` (`figures-sanitize`, `figures-pdf`). A sanitização
   precisa de um DOM de verdade (o DOMPurify do chat e do PDF), então roda numa
   janela escondida que importa `markdown.mjs` e `template.mjs`; o PDF sai do
   `material-pdf.cjs` real. O texto dos cenários mora em `figures-fixtures.mjs`
   (tudo inventado). */

const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');

const DESK = path.resolve(__dirname, '..');
const url = (relative) => pathToFileURL(path.join(DESK, relative)).href;

/* Roda `body` na página de teste: `body` recebe `{markup, renderMaterialHtml, fixtures}` e devolve JSON. */
async function inPage(electron, body) {
  const win = new electron.BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
  try {
    await win.loadFile(path.join(__dirname, 'figures-page.html'));
    return await win.webContents.executeJavaScript(`(async () => {
      const {markup} = await import(${JSON.stringify(url('src/markdown.mjs'))});
      const {renderMaterialHtml} = await import(${JSON.stringify(url('src/materials/template.mjs'))});
      const fixtures = await import(${JSON.stringify(url('tests/figures-fixtures.mjs'))});
      const inspect = (html) => {
        const root = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
        const all = [...root.querySelectorAll('*')];
        return {
          html,
          tags: [...new Set(all.map((node) => node.localName.toLowerCase()))],
          links: all.flatMap((node) => ['href', 'xlink:href'].map((name) => node.getAttribute(name))).filter((value) => value !== null),
          eventAttributes: all.flatMap((node) => [...node.attributes].map((attribute) => attribute.name).filter((name) => /^on/i.test(name))),
          plots: root.querySelectorAll('.plot-figure svg').length,
          warnings: [...root.querySelectorAll('.plot-warning')].map((node) => node.textContent),
        };
      };
      ${body}
    })()`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function scenarioSanitize({electron}) {
  const data = await inPage(electron, `
    const wrap = (svg) => 'Antes\\n\\n' + svg + '\\n\\nDepois';
    const plot = (body) => '\\\`\\\`\\\`plot\\n' + body + '\\n\\\`\\\`\\\`';
    const chat = (text) => inspect(markup(text, false));
    const pdf = (text) => { const out = renderMaterialHtml({markdown: text}); return {...inspect(out.html), diagnostics: out.diagnostics}; };
    return {
      ok: true,
      chatMalicious: chat(wrap(fixtures.MALICIOUS_SVG)),
      pdfMalicious: pdf(wrap(fixtures.MALICIOUS_SVG)),
      chatTriangle: chat(wrap(fixtures.TRIANGLE_SVG)),
      pdfTriangle: pdf(wrap(fixtures.TRIANGLE_SVG)),
      chatPlot: chat(plot(fixtures.PLOT_PARABOLA)),
      pdfPlot: pdf(plot(fixtures.PLOT_PARABOLA)),
      chatBroken: chat(plot(fixtures.PLOT_BROKEN)),
      pdfBroken: pdf(plot(fixtures.PLOT_BROKEN)),
    };`);
  return data;
}

async function scenarioPdf({materialPdf, runtime}) {
  const {EXAMPLE_LIST, PLOT_BROKEN} = await import(url('tests/figures-fixtures.mjs'));
  const markdown = `${EXAMPLE_LIST}\n\n\`\`\`plot\n${PLOT_BROKEN}\n\`\`\`\n`;
  const rendered = await materialPdf.renderPdf({title: 'Lista de exemplo', markdown, timeoutMs: 90000});
  const file = path.join(String(process.env.MESA_FIGURES_PDF_OUT || runtime), 'figuras.pdf');
  fs.writeFileSync(file, rendered.buffer);
  return {ok: true, path: file, bytes: rendered.bytes, diagnostics: rendered.diagnostics};
}

/* A ferramenta "ver o que desenhei": o host real, a página real e a captura
   real. Os PNGs vão para `MESA_FIGURES_PDF_OUT` quando definido (capturas do relatório). */
async function scenarioFigurePreview({electron, runtime}) {
  const {createFigurePreview} = require('../figure-preview.cjs');
  const fixtures = await import(url('tests/figures-fixtures.mjs'));
  const {preview} = createFigurePreview({createWindow: undefined});
  const outDir = String(process.env.MESA_FIGURES_PDF_OUT || runtime);
  const cases = {
    plot: {kind: 'plot', source: fixtures.PLOT_PARABOLA},
    plotDark: {kind: 'plot', source: fixtures.PLOT_WAVES, theme: 'escuro', width: 480},
    triangle: {kind: 'svg', source: fixtures.TRIANGLE_SVG, width: 360},
    malicious: {kind: 'svg', source: fixtures.MALICIOUS_SVG, width: 360},
    broken: {kind: 'plot', source: fixtures.PLOT_BROKEN, width: 420},
  };
  const out = {ok: true, electron: Boolean(electron)};
  for (const [name, request] of Object.entries(cases)) {
    const {screenshot, ...report} = await preview(request);
    const png = Buffer.from(screenshot.data, 'base64');
    fs.writeFileSync(path.join(outDir, `ver-figura-${name}.png`), png);
    out[name] = {...report, png: {bytes: png.length, signature: png.subarray(1, 4).toString('latin1'), width: screenshot.width, height: screenshot.height}};
  }
  return out;
}

/** @param {string} name @param {object} context */
function runFiguresScenario(name, context) {
  if (name === 'figures-sanitize') return scenarioSanitize(context);
  if (name === 'figures-pdf') return scenarioPdf(context);
  if (name === 'figure-preview') return scenarioFigurePreview(context);
  return Promise.resolve({ok: false, error: {code: 'BAD_SCENARIO', message: `cenário de figuras desconhecido: ${name}`}});
}

module.exports = {runFiguresScenario};
