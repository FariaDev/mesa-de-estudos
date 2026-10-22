import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* Trava a lista do `npm run typecheck` (#43 fase 3). O tsc só verifica o que
   está em `files` do `tsconfig.json`, e cada arquivo de lá começa com
   `// @ts-check` (o `checkJs` fica desligado para o JS ainda não tipado que eles
   importam não reprovar a rodada). Regras:
   - a lista só cresce: TYPECHECK_FLOOR é o tamanho dela hoje; ao tipar um
     arquivo novo, ponha-o na lista e suba o piso;
   - todo arquivo da lista tem `// @ts-check` na primeira linha;
   - todo arquivo com `// @ts-check` está na lista (senão o comentário promete
     uma verificação que ninguém roda). */
const DESK = path.resolve(import.meta.dirname, '..');
const TYPECHECK_FLOOR = 50;
const SKIPPED_DIRS = new Set(['node_modules', 'tests', 'generated']);
const TS_CHECK = '// @ts-check';

function listedFiles() {
  const config = JSON.parse(fs.readFileSync(path.join(DESK, 'tsconfig.json'), 'utf8'));
  return config.files.filter((file) => !file.endsWith('.d.ts'));
}

function sourceFiles(dir = DESK, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...sourceFiles(path.join(dir, entry.name), relative));
    else if (/\.(cjs|mjs|js)$/.test(entry.name)) out.push(relative);
  }
  return out;
}

const firstLine = (file) => fs.readFileSync(path.join(DESK, file), 'utf8').split('\n', 1)[0];

test('a lista do typecheck só cresce', () => {
  const files = listedFiles();
  assert.ok(files.length >= TYPECHECK_FLOOR,
    `tsconfig.json verifica ${files.length} arquivos; esperado pelo menos ${TYPECHECK_FLOOR}. A lista só cresce: devolva o arquivo tirado (e tipe o que quebrou).`);
});

test('todo arquivo da lista começa com // @ts-check', () => {
  const missing = listedFiles().filter((file) => firstLine(file).trim() !== TS_CHECK);
  assert.deepEqual(missing, [], `sem "${TS_CHECK}" na primeira linha: ${missing.join(', ')}`);
});

test('todo arquivo com // @ts-check está na lista do tsconfig.json', () => {
  const listed = new Set(listedFiles());
  const orphans = sourceFiles().filter((file) => firstLine(file).trim() === TS_CHECK && !listed.has(file));
  assert.deepEqual(orphans, [], `com "${TS_CHECK}" mas fora de "files" do tsconfig.json (o tsc não os vê): ${orphans.join(', ')}`);
});
