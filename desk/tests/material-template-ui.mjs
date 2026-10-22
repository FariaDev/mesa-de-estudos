/* Cenários sintéticos do template de material, executados DENTRO do Electron
   pelo `free-pdf-runner.cjs` (o entry do Electron continua CJS porque esta
   versão não resolve `import {app} from 'electron'`). O módulo recebe as peças
   do runner (app, store, materialPdf, runtime) e devolve um JSON pequeno.

   Tudo é sintético: fixtures em `tests/fixtures/`, runtime temporário e nada de
   material pessoal. Nenhuma medição aqui substitui a inspeção visual humana;
   as provas são estruturais (páginas, fontes, medição pós-fontes). */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

/* Mede a página pronta um instante antes do printToPDF (mesmo lugar da prova do
   radical): estrutura, fontes carregadas e o relatório de ajustes. */
async function inspectPage(win) {
  return win.webContents.executeJavaScript(`(() => {
    const doc = document.getElementById('doc');
    const firstParagraph = doc.querySelector('p');
    const firstKatex = doc.querySelector('.katex');
    return {
      h1Count: doc.querySelectorAll('h1').length,
      title: doc.querySelector('h1') ? doc.querySelector('h1').textContent : '',
      headings: [...doc.querySelectorAll('h1,h2,h3')].map((node) => node.tagName + ':' + node.textContent.slice(0, 40)),
      bodyFont: firstParagraph ? getComputedStyle(firstParagraph).fontFamily : '',
      katexFont: firstKatex ? getComputedStyle(firstKatex).fontFamily : '',
      fontStatus: document.fonts.status,
      katexFaces: [...document.fonts].filter((face) => /KaTeX/.test(face.family)).length,
      overflowNodes: doc.querySelectorAll('[data-overflow="1"], [data-math-error]').length,
      mathDisplayCount: doc.querySelectorAll('.math-display').length,
      widthProbe: (() => {
        const display = doc.querySelector('.math-display');
        if (!display) return null;
        const katex = display.querySelector('.katex');
        const html = display.querySelector('.katex-html');
        return {
          displayWidth: Math.round(display.getBoundingClientRect().width),
          katexRect: katex ? Math.round(katex.getBoundingClientRect().width) : null,
          katexClient: katex ? katex.clientWidth : null,
          katexScroll: katex ? katex.scrollWidth : null,
          htmlRect: html ? Math.round(html.getBoundingClientRect().width) : null,
          available: Math.round(document.getElementById('doc').getBoundingClientRect().width),
          applied: null,
        };
      })(),
      report: window.__materialLastReport || null,
      placeholderLeak: doc.textContent.includes('MATHPLACEHOLDER') || doc.textContent.includes('CODEPLACEHOLDER'),
      innerHtmlLeak: /MATHPLACEHOLDER|CODEPLACEHOLDER/.test(doc.innerHTML),
      anchors: [...doc.querySelectorAll('a')].map((node) => ({href: node.getAttribute('href') || '', html: node.outerHTML})),
      divTitles: [...doc.querySelectorAll('div[title]')].map((node) => node.getAttribute('title') || ''),
      listKatex: doc.querySelectorAll('li .katex').length,
      rawTitle: (() => {
        const node = doc.querySelector('#raw-title');
        return node ? {tag: node.tagName, html: node.outerHTML} : null;
      })(),
    };
  })()`);
}

function hookInspect(app, capture) {
  const listener = (_event, win) => {
    const print = win.webContents.printToPDF.bind(win.webContents);
    win.webContents.printToPDF = async (options) => {
      capture.result = await inspectPage(win);
      return print(options);
    };
  };
  app.once('browser-window-created', listener);
  return () => app.removeListener('browser-window-created', listener);
}

/* Casos da revisão dentro do mesmo documento longo: continuação de item de
   lista com fórmula não some, código citado não vira matemática, heading citado
   desce e matemática em atributo (link/title) não corrompe a estrutura. Os
   casos com tab (r6) provam que o recuo expandido no raw do marked é mapeado de
   volta para a fonte, e o `<h1>` cru desce para H2 (título único). */
const NESTED_CASES = [
  '',
  '## Extra de contêineres',
  '',
  '- item com fórmula',
  '',
  '    $x+1$ continuação',
  '',
  '> # Citado desce',
  '',
  '> ```',
  '> $nao_e_math$ e $\\frac{1}{$',
  '> ```',
  '',
  '[link]($a$)',
  '',
  '<div title="$b$">caixa com atributo</div>',
  '',
  '- item com tab',
  '',
  '\t$u+1$ continuação por tab',
  '',
  '1. primeiro',
  '\t1. sub',
  '',
  '\t\t$v+1$ dentro da ordenada',
  '',
  '> citação com tab:',
  '>',
  '>\t$q+1$ continuação citada',
  '',
  '- cerca com tab',
  '',
  '\t```',
  '\t$nao_e_math_tab$',
  '\t```',
  '',
  'Outra $z+1$ em bloco separado.',
  '',
  '<h1 id="raw-title" class="extra" onclick="window.__pwned=true">Outro <em>H1</em></h1>',
  '',
].join('\n');

async function scenarioLong({app, materialPdf, runtime}) {
  const markdown = fixture('material-long.md') + NESTED_CASES;
  const dir = path.join(runtime, 'material-long');
  fs.mkdirSync(dir);
  const capture = {result: null};
  const unhook = hookInspect(app, capture);
  try {
    const saved = await materialPdf.savePdf({dir, stem: 'Longo', title: 'Limites e derivadas', markdown, timeoutMs: 120000});
    return {
      ok: true,
      path: saved.path,
      name: saved.name,
      bytes: saved.bytes,
      sha256: saved.sha256,
      templateHash: saved.templateHash,
      diagnostics: saved.diagnostics || [],
      inspected: capture.result,
    };
  } finally {
    unhook();
  }
}

async function scenarioMath({app, materialPdf, runtime, file, title}) {
  const markdown = fixture(file);
  const capture = {result: null};
  const unhook = hookInspect(app, capture);
  const dir = path.join(runtime, 'material-math');
  fs.mkdirSync(dir, {recursive: true});
  try {
    const saved = await materialPdf.savePdf({dir, stem: title, title, markdown, timeoutMs: 120000});
    return {ok: true, path: saved.path, files: fs.readdirSync(dir), diagnostics: saved.diagnostics || [], inspected: capture.result};
  } catch (error) {
    return {
      ok: false,
      code: String(error.code || error.name || 'erro'),
      message: String(error.message || error),
      diagnostics: (error.details && error.details.diagnostics) || [],
      files: fs.readdirSync(dir),
      inspected: capture.result,
    };
  } finally {
    unhook();
  }
}

let windowCount = 0;
export function countMaterialWindows(app) {
  app.on('browser-window-created', () => { windowCount += 1; });
  return () => windowCount;
}

export async function runMaterialScenario(name, context) {
  const windows = countMaterialWindows(context.app);
  let result;
  switch (name) {
    case 'template-long':
      result = await scenarioLong(context);
      break;
    case 'template-wide':
      result = await scenarioMath({...context, file: 'material-wide.md', title: 'Fórmula larga ajustável'});
      break;
    case 'template-overflow':
      result = await scenarioMath({...context, file: 'material-wide-overflow.md', title: 'Fórmula que não cabe'});
      break;
    case 'template-invalid':
      result = await scenarioMath({...context, file: 'material-invalid.md', title: 'Equação com erro'});
      break;
    default:
      return {ok: false, code: 'BAD_SCENARIO', message: `cenário de material desconhecido: ${name}`};
  }
  return {...result, windows: windows()};
}
