import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* Trava o tamanho dos arquivos de código do desk/ (#43 fase 2): arquivo grande
   vira leitura truncada e token gasto para o agente. Regras:
   - nenhum arquivo passa de 800 linhas, fora os da lista LEGACY_CAPS, que ainda
     passam e têm um teto próprio que só pode CAIR (ao dividir um, baixe o teto;
     ao chegar a 800 ou menos, mova-o para MEDIUM_FILES);
   - arquivo novo fica abaixo de 500 linhas: os que já tinham entre 501 e 800 na
     fase 2 (ou caíram do legado para essa faixa) estão em MEDIUM_FILES e saem da lista quando caírem a 500 ou menos.
   Fora da conta: node_modules, src/generated (artefato do núcleo), tests e
   pastas de runtime (as que começam com ponto). */
const DESK = path.resolve(import.meta.dirname, '..');
const HARD_CAP = 800;
const NEW_FILE_CAP = 500;
const CODE_EXTENSIONS = new Set(['.cjs', '.mjs', '.js', '.css', '.html']);
const SKIPPED_DIRS = new Set(['node_modules', 'tests', 'assets']);
const SPLIT_HINT = 'Divida por responsabilidade (veja docs/agents/mapa.md e o padrão dos *-host.cjs).';

/** Arquivos que ainda passam de 800 linhas, com o teto de cada um. Só cai. */
const LEGACY_CAPS = {
  'index.html': 865,
};

/** Arquivos que tinham entre 501 e 800 linhas na fase 2 da #43. Só encolhe. */
const MEDIUM_FILES = new Set([
  'src/state.mjs',
  'src/sidechat.mjs',
  'src/chat.mjs',
  'src/main.mjs',
  'sidechat.cjs',
  'main.cjs',
  'activity-store.cjs',
  'src/agents/claude-adapter.cjs',
  'src/agents/claude-turn-policy.cjs',
  'src/backup-panel.mjs',
  'src/keys.mjs',
  'src/layout-presets.mjs',
  'src/pdf-notes.mjs',
  'src/pdf.mjs',
  'src/study-data/backup-services.cjs',
  'src/study-data/git-backup.cjs',
  'src/study-data/statistics.cjs',
  'src/study-search.mjs',
]);

/**
 * Lista os arquivos de código do desk/ com o número de linhas.
 * @param {string} dir pasta absoluta a varrer
 * @returns {Array<{file: string, lines: number}>} caminho relativo ao desk/ (com /) e linhas
 * @example listCodeFiles(DESK) // [{file: 'main.cjs', lines: 420}, ...]
 */
function listCodeFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(DESK, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || rel === 'src/generated') continue;
      found.push(...listCodeFiles(full));
      continue;
    }
    if (!CODE_EXTENSIONS.has(path.extname(entry.name))) continue;
    found.push({file: rel, lines: countLines(fs.readFileSync(full, 'utf8'))});
  }
  return found;
}

/** @param {string} text @returns {number} linhas, sem contar a quebra final */
function countLines(text) {
  if (!text) return 0;
  return text.replace(/\n$/, '').split('\n').length;
}

const files = listCodeFiles(DESK);
const linesByFile = new Map(files.map(({file, lines}) => [file, lines]));

test('nenhum arquivo de código do desk/ passa de 800 linhas fora da lista de legado', () => {
  const over = files.filter(({file, lines}) => lines > HARD_CAP && !(file in LEGACY_CAPS));
  const detail = over.map(({file, lines}) => `${file}: ${lines} linhas`).join('\n');
  assert.equal(over.length, 0, `Arquivos acima de ${HARD_CAP} linhas:\n${detail}\n${SPLIT_HINT}`);
});

test('os arquivos de legado não passam do próprio teto', () => {
  for (const [file, cap] of Object.entries(LEGACY_CAPS)) {
    const lines = linesByFile.get(file);
    assert.ok(lines !== undefined, `LEGACY_CAPS cita ${file}, que não existe mais; tire-o da lista.`);
    assert.ok(lines <= cap, `${file} tem ${lines} linhas; o teto dele é ${cap} e só pode cair. ${SPLIT_HINT}`);
    assert.ok(lines > HARD_CAP, `${file} tem ${lines} linhas (até ${HARD_CAP}); mova-o de LEGACY_CAPS para MEDIUM_FILES.`);
  }
});

test('arquivo novo fica abaixo de 500 linhas', () => {
  const over = files.filter(({file, lines}) => lines > NEW_FILE_CAP && lines <= HARD_CAP && !MEDIUM_FILES.has(file));
  const detail = over.map(({file, lines}) => `${file}: ${lines} linhas`).join('\n');
  assert.equal(over.length, 0, `Arquivos novos acima de ${NEW_FILE_CAP} linhas:\n${detail}\n${SPLIT_HINT}`);
});

test('a lista de arquivos médios só encolhe', () => {
  for (const file of MEDIUM_FILES) {
    const lines = linesByFile.get(file);
    assert.ok(lines !== undefined, `MEDIUM_FILES cita ${file}, que não existe mais; tire-o da lista.`);
    assert.ok(lines > NEW_FILE_CAP, `${file} tem ${lines} linhas (até ${NEW_FILE_CAP}); tire-o de MEDIUM_FILES.`);
  }
});
