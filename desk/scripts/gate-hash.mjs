/* Chave do portão do núcleo (`scripts/core-gate.mjs`).

   O hash tem de cobrir EXATAMENTE o que pode mudar o resultado de
   `build:bend` + `test:proof` + `test:parity`. O que entra:

   - `core/**`: o núcleo Bend, as leis, as provas e os scripts dos três passos;
   - os artefatos gerados dos dois apps (`desk/src/generated`, `chat/src/generated`);
   - o runner de paridade (`tests/parity.mjs`), cada verificador
     (`tests/*-parity.mjs` — a MESMA varredura que o runner faz) e tudo o que
     eles importam por caminho relativo: é aí que ficam os hosts comparados
     contra o núcleo (`rpc.cjs`, `state-adapter.cjs`, `src/worklog.mjs`…), e
     mexer num deles muda o veredito da paridade sem tocar em `core/**`;
   - o `package.json`, que define os três passos.

   Fica de fora de propósito o resto de `desk/` e `chat/` (app, testes de
   comportamento, estilo): quem cobre isso é `npm test`, que roda sempre.

   O que a varredura NÃO enxerga: dependência resolvida em tempo de execução
   (caminho montado em string, require condicional). Por isso os verificadores
   declaram seus alvos com literal relativo, e `tests/coregate.test.mjs` fixa
   essa regra. */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.runtime']);
const PARITY_SUFFIX = '-parity.mjs';
/* `from './x.mjs'`, `import './x.mjs'` (efeito colateral), `require('./x.cjs')`,
   `import('../x.mjs')` — literal relativo, que é o que dá para resolver sem
   executar o arquivo. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"](\.[^'"]+)['"]/g;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, {withFileTypes: true});
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/* Ordem das tentativas: primeiro o caminho como veio, depois as extensões que
   o Node resolveria, depois o index de pasta. */
function candidates(file) {
  return [file, `${file}.mjs`, `${file}.cjs`, `${file}.js`, `${file}.json`, path.join(file, 'index.mjs'), path.join(file, 'index.cjs'), path.join(file, 'index.js')];
}

function resolveSpecifier(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of candidates(base)) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* tentativa seguinte */
    }
  }
  return null;
}

function withImports(file, out, root) {
  if (out.has(file)) return;
  out.add(file);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const match of text.matchAll(SPECIFIER)) {
    const target = resolveSpecifier(file, match[1]);
    /* Só o que está na árvore: pacote de `node_modules` não entra na chave. */
    if (target && target.startsWith(root + path.sep)) withImports(target, out, root);
  }
}

/* O runner roda `tests/*-parity.mjs` por varredura; a chave tem de usar a mesma
   regra, senão um verificador novo entra no portão sem invalidar o cache. */
export function parityEntries(desk) {
  const tests = path.join(desk, 'tests');
  let names = [];
  try {
    names = fs.readdirSync(tests);
  } catch {
    names = [];
  }
  const entries = [path.join(tests, 'parity.mjs'), ...names.filter((name) => name.endsWith(PARITY_SUFFIX)).sort().map((name) => path.join(tests, name))];
  return entries.filter((file) => fs.existsSync(file));
}

/** Lista ordenada dos arquivos que a chave cobre. */
export function gateFiles({root, desk}) {
  const files = new Set([
    ...walk(path.join(root, 'core')),
    ...walk(path.join(desk, 'src', 'generated')),
    ...walk(path.join(root, 'chat', 'src', 'generated')),
  ]);
  for (const entry of parityEntries(desk)) withImports(entry, files, root);
  const pkg = path.join(desk, 'package.json');
  if (fs.existsSync(pkg)) files.add(pkg);
  return [...files].sort();
}

/** `{hash, count, files}` — o conteúdo e o NOME de cada arquivo entram no hash. */
export function gateHash({root, desk}) {
  const files = gateFiles({root, desk});
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.relative(root, file));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return {hash: hash.digest('hex'), count: files.length, files};
}
