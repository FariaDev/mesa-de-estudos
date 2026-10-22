/* A 0.5.0 aplica o zip com a lista dela (`fixtures/updater-rules-0.5.0.cjs`).
   Um arquivo novo de `desk/` fora de src/assets/templates/scripts/tests, ou na
   raiz com outra extensão, não chega na instalação sem git (#72). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {isReplaceable} = require('./fixtures/updater-rules-0.5.0.cjs');

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const ESPERADO = 'dentro de src/, assets/, templates/, scripts/ ou tests/, ou na raiz do desk com extensão .cjs/.mjs/.html/.css/.md/.json';

/* Fora da lista da 0.5.0 de propósito. Nenhum destes é carregado ao abrir. */
const EXCECOES = new Set([
  // Metadado do git. O app não faz require dele.
  'desk/.gitignore',
  // Só o typecheck (`npm run typecheck`). O runtime usa estes nomes em JSDoc, que o Node não carrega.
  'desk/types/agent.d.ts',
  'desk/types/bend-core.d.ts',
  'desk/types/claude-adapter-host.d.ts',
  'desk/types/desk-config.d.ts',
  'desk/types/desk-state.d.ts',
  'desk/types/desk-window.d.ts',
  'desk/types/host-deps.d.ts',
  'desk/types/main-hosts.d.ts',
]);

/**
 * Arquivos de `desk/` que o git rastreia, no caminho do repositório.
 * @param {string} root raiz do repositório (cwd do `git ls-files`)
 * @returns {string[]} caminhos como `desk/main.cjs`
 * @example arquivosRastreados('/repo') // ['desk/main.cjs', ...]
 */
function arquivosRastreados(root) {
  const listed = execFileSync('git', ['ls-files', 'desk'], {cwd: root, encoding: 'utf8'});
  return listed.split('\n').filter((line) => line.length > 0);
}

test('todo arquivo rastreado de desk/ é substituível pela regra da 0.5.0', () => {
  const files = arquivosRastreados(repoRoot);
  const refused = files.filter((file) => !EXCECOES.has(file) && !isReplaceable(file));
  assert.deepEqual(
    refused,
    [],
    `a regra da 0.5.0 recusou ${JSON.stringify(refused)}; esperado ${ESPERADO}`,
  );
});
