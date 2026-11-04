/* Lint só do que o push leva (#86): o `npm run lint` inteiro leva ~13 s, o dos
   arquivos alterados leva o tempo deles. A base é o upstream do branch; sem
   upstream (branch novo), `origin/main`; sem nenhum dos dois, o lint inteiro.
   Uso: `node scripts/lint-changed.mjs` (em `desk/`, chamado pelo pre-push). */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const LINTED = /\.(?:mjs|cjs|js)$/;

/**
 * Filtra a saída de `git diff --name-only --relative` para o que o ESLint olha.
 * @param {string} names uma linha por arquivo, relativa a `desk/`
 * @returns {string[]}
 * @example lintTargets('main.cjs\nREADME.md\n') // ['main.cjs']
 */
export function lintTargets(names) {
  return names.split('\n').map((name) => name.trim()).filter((name) => LINTED.test(name));
}

/**
 * Ambiente do git sem as variáveis que o hook exporta. Com GIT_DIR o
 * `--relative` toma a pasta atual como raiz e devolve `desk/x.mjs`, que o
 * ESLint em `desk/` não acha; sem elas o git acha o clone pela pasta.
 * @param {Record<string, string|undefined>} env
 * @returns {Record<string, string|undefined>}
 * @example gitEnv({GIT_DIR: '.git', PATH: '/bin'}) // {PATH: '/bin'}
 */
export function gitEnv(env) {
  const {GIT_DIR: _dir, GIT_WORK_TREE: _tree, GIT_PREFIX: _prefix, GIT_INDEX_FILE: _index, ...rest} = env;
  return rest;
}

function git(args, cwd) {
  return spawnSync('git', args, {cwd, encoding: 'utf8', env: gitEnv(process.env)});
}

function changedSince(cwd) {
  for (const base of ['@{upstream}', 'origin/main']) {
    const out = git(['diff', '--name-only', '--relative', '--diff-filter=ACMR', `${base}...HEAD`], cwd);
    if (out.status === 0) return {base, names: out.stdout};
  }
  return null;
}

function main() {
  const desk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const changed = changedSince(desk);
  const files = changed ? lintTargets(changed.names) : null;
  if (files && !files.length) return 0;
  const args = files ? ['--no-warn-ignored', ...files] : ['.'];
  console.log(files ? `lint de ${files.length} arquivo(s) alterado(s) desde ${changed.base}` : 'lint inteiro: sem upstream nem origin/main para comparar');
  const eslint = path.join(desk, 'node_modules', 'eslint', 'bin', 'eslint.js');
  return spawnSync(process.execPath, [eslint, ...args], {cwd: desk, stdio: 'inherit'}).status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
