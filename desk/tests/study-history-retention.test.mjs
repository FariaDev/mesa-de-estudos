/* Histórico antigo (>7 dias) continua existindo: prova de comportamento contra
   a suspeita de expiração de 7 dias no Mesa/Pi.

   O que a investigação achou (2026-10-07):
   - o Mesa (`desk/lib.cjs`) lê o começo da sessão do nome do arquivo e lista
     tudo que existe no disco (o filtro em `main.cjs` é `fs.existsSync`, não
     idade);
   - a regra de 7 dias que EXISTE é outra: `.pi/lib/learning-artifacts.ts`
     (`RENDER_CACHE_DAYS = 7`) apaga a NOTA-espelho de estudo
     (`type: learning-render-cache`, "Temporary Math Mirror") e os assets dela
     em `Courses/<matéria>/Sessions/` — cache de render, não histórico de conversa.

   O relatório com as linhas exatas do overlay está em
   `docs/reviews/mesa-t3-historico-7-dias-auditoria-20261007.md`. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const DESK = dirname(dirname(fileURLToPath(import.meta.url)));
const DAY = 86400000;

test('o Mesa lê a data de começo do nome do arquivo e não descarta a antiga', () => {
  const lib = require(join(DESK, 'lib.cjs'));
  const old = Date.now() - 40 * DAY;
  const file = join(tmpdir(), `pi-${old}.jsonl`);
  const started = lib.sessionStartedFromPath(file);
  assert.equal(started, old, 'o começo vem do nome do arquivo, sem corte de idade');
  const label = lib.formatSessionLabel({path: file, started, preview: 'sessão antiga'});
  assert.match(label, /sessão antiga|Anteriores|Conversa/, 'a sessão antiga tem rótulo próprio');
});

test('nenhum módulo do Mesa apaga sessão por idade', () => {
  /* A varredura é deliberadamente simples: procura remoção de arquivo perto de
     "session" no host do Mesa. O único cleanup de idade do ecossistema é o do
     cache de render no overlay do Pi (fora deste repositório) e é reportado no
     doc da auditoria. */
  /* Os hosts que saíram do main (#43 fase 2) entram na varredura junto com ele. */
  const hosts = require('node:fs').readdirSync(DESK).filter(name => /(-host|-ipc)\.cjs$/.test(name));
  const files = ['main.cjs', 'lib.cjs', 'state-adapter.cjs', 'src/state.mjs', ...hosts];
  const hits = [];
  for (const name of files) {
    const text = require('node:fs').readFileSync(join(DESK, name), 'utf8');
    for (const line of text.split('\n')) {
      if (/unlink|rmSync|rmdir/.test(line) && /session/i.test(line) && /Date\.now|mtime|7|day/i.test(line)) hits.push(`${name}: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(hits, [], 'nenhuma remoção de sessão por idade no host do Mesa');
});
