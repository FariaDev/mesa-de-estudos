// @ts-check
/* Quanto o renderer carrega ANTES do primeiro desenho (#desempenho): percorre
   só os imports estáticos de `renderer.mjs` (ESM resolve tudo antes de rodar o
   primeiro módulo), soma os bytes dos arquivos e lista os maiores. Import
   dinâmico (`import(...)`) não entra no caminho de partida: o script o lista à
   parte, para conferir o que já ficou para depois.
 *
 * Uso em desk/: node scripts/measure-boot.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_IMPORT = /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Resolve um especificador relativo para o arquivo real. Sem extensão, tenta
 * as extensões que o repositório usa. Especificador de pacote fica fora do
 * grafo (o caminho relativo a `node_modules/` entra como qualquer outro).
 * @param {string} fromFile @param {string} specifier
 * @returns {string | null} */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.mjs`, `${base}.js`, `${base}.json`,
    path.join(base, 'index.mjs'), path.join(base, 'index.js')];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

/** @param {string} file @returns {string[]} */
function staticSpecifiers(file) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(STATIC_IMPORT)].map((match) => match[1]).filter(Boolean);
}

/** @param {string} file @returns {string[]} */
function dynamicSpecifiers(file) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(DYNAMIC_IMPORT)].map((match) => match[1]).filter(Boolean);
}

/** Percorre o grafo estático a partir de uma entrada ESM.
 * @param {string} entry
 * @returns {{modules: string[], files: string[], missing: string[], bytes: number}} */
function walkStatic(entry) {
  const pending = [path.resolve(entry)];
  const files = [];
  const missing = [];
  const seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!fs.existsSync(file)) {
      missing.push(file);
      continue;
    }
    files.push(file);
    for (const specifier of staticSpecifiers(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved) pending.push(resolved);
    }
  }
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const modules = files.map((file) => path.relative(DESK, file)).sort();
  return {modules, files, missing: missing.map((file) => path.relative(DESK, file)), bytes};
}

/** Bytes de um caminho citado no HTML, resolvido a partir de `desk/`.
 * @param {string} href @returns {number} */
function assetBytes(href) {
  const file = path.resolve(DESK, href);
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
}

/** Payload do HTML de partida: scripts e folhas de estilo.
 * @param {string} htmlFile */
function htmlPayload(htmlFile) {
  if (!fs.existsSync(htmlFile)) return {bytes: 0, stylesheets: 0, styleBytes: 0, scripts: 0, scriptBytes: 0};
  const html = fs.readFileSync(htmlFile, 'utf8');
  const styles = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi)].map((match) => match[1]);
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  return {
    bytes: fs.statSync(htmlFile).size,
    stylesheets: styles.length,
    styleBytes: styles.reduce((sum, href) => sum + assetBytes(href), 0),
    scripts: scripts.length,
    scriptBytes: scripts.reduce((sum, src) => sum + assetBytes(src), 0),
  };
}

/** Relatório determinístico do payload de partida do renderer.
 * @param {{root?: string, entry?: string, html?: string}} [options]
 * @returns {{entry: string, modules: number, moduleFiles: string[], bytes: number, missing: string[],
 *   top: Array<{file: string, bytes: number}>, dynamic: Array<{file: string, bytes: number}>,
 *   html: ReturnType<typeof htmlPayload>}}
 * @example measureBoot(); // {modules: 193, bytes: 5048995, top: [...]}
 */
export function measureBoot({root = DESK, entry = 'renderer.mjs', html = 'index.html'} = {}) {
  const graph = walkStatic(path.resolve(root, entry));
  const dynamic = new Set();
  for (const file of graph.files) {
    for (const specifier of dynamicSpecifiers(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved && !graph.files.includes(resolved)) dynamic.add(resolved);
    }
  }
  const top = graph.files
    .map((file) => ({file: path.relative(root, file), bytes: fs.statSync(file).size}))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 15);
  const dynamicRows = [...dynamic]
    .map((file) => ({file: path.relative(root, file), bytes: fs.statSync(file).size}))
    .sort((left, right) => right.bytes - left.bytes);
  return {
    entry,
    modules: graph.modules.length,
    moduleFiles: graph.modules,
    bytes: graph.bytes,
    missing: graph.missing,
    top,
    dynamic: dynamicRows,
    html: htmlPayload(path.resolve(root, html)),
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const report = measureBoot();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`renderer: ${report.modules} módulos, ${report.bytes} bytes`);
    console.log(`index.html: ${report.html.bytes} bytes; CSS ${report.html.styleBytes} em ${report.html.stylesheets} folhas`);
    console.log('maiores:');
    for (const row of report.top) console.log(String(row.bytes).padStart(8), row.file);
    if (report.dynamic.length) {
      console.log('adiados (import dinâmico):');
      for (const row of report.dynamic.slice(0, 10)) console.log(String(row.bytes).padStart(8), row.file);
    }
  }
}
