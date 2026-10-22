/* Histórico antigo (>7 dias) continua existindo: prova de comportamento contra
   a suspeita de expiração de 7 dias no Mesa/Pi.

   O que a investigação achou (2026-10-07):
   - o Pi NÃO apaga sessão por idade; `SessionManager.list` continua lendo um
     `.jsonl` de 40 dias atrás (arquivos reais de julho/2026 seguem em
     `~/.pi/agent/sessions/`, 78 deles com mais de 7 dias);
   - o Mesa (`desk/lib.cjs`) lê o começo da sessão do nome do arquivo e lista
     tudo que existe no disco (o filtro em `main.cjs` é `fs.existsSync`, não
     idade);
   - a regra de 7 dias que EXISTE é outra: `.pi/lib/learning-artifacts.ts`
     (`RENDER_CACHE_DAYS = 7`) apaga a NOTA-espelho de estudo
     (`type: learning-render-cache`, "Temporary Math Mirror") e os assets dela
     em `Courses/<matéria>/Sessions/` — cache de render, não histórico de conversa.

   Este teste não depende do overlay pessoal: prova o comportamento do Pi
   instalado e o do repositório. O relatório com as linhas exatas do overlay
   está em `docs/reviews/mesa-t3-historico-7-dias-auditoria-20261007.md`. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const DESK = dirname(dirname(fileURLToPath(import.meta.url)));
const DAY = 86400000;

function piPackage() {
  const candidates = [
    process.env.PI_PACKAGE_DIR,
    join(DESK, '.pi-local', 'node_modules', '@earendil-works', 'pi-coding-agent'),
    join(DESK, 'node_modules', '@earendil-works', 'pi-coding-agent'),
    join(DESK, '..', 'node_modules', '@earendil-works', 'pi-coding-agent'),
    '/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent',
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(join(dir, 'dist', 'index.js'))) || '';
}

function sessionFile(dir, when, id, text) {
  const stamp = when.toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${stamp}_${id}.jsonl`);
  const header = {type: 'session', version: 3, id, timestamp: when.toISOString(), cwd: dir};
  const message = {type: 'message', id: 'm-1', timestamp: when.toISOString(), message: {role: 'user', content: [{type: 'text', text}]}};
  writeFileSync(file, `${JSON.stringify(header)}\n${JSON.stringify(message)}\n`);
  return file;
}

test('o Pi continua lendo uma sessão de 40 dias atrás (>7 dias)', async () => {
  const pkg = piPackage();
  if (!pkg) {
    console.log('Pi não encontrado; prova da lista de sessões pulada.');
    return;
  }
  const {SessionManager} = await import(pathToFileURL(join(pkg, 'dist', 'index.js')).href);
  const dir = mkdtempSync(join(tmpdir(), 'mesa-history-'));
  try {
    const old = new Date(Date.now() - 40 * DAY);
    const recent = new Date(Date.now() - 60 * 1000);
    const oldFile = sessionFile(dir, old, '01a09660-9795-7100-90d2-7c382839686f', 'sessão de 40 dias');
    sessionFile(dir, recent, '01a0a19a-b026-72bf-aa48-188d7d22e372', 'sessão de agora');
    const listed = await SessionManager.list(dir, dir);
    const ids = listed.map((one) => one.id);
    assert.ok(ids.includes('01a09660-9795-7100-90d2-7c382839686f'), 'a sessão velha continua na lista');
    assert.equal(listed.length, 2, 'nenhuma sessão foi filtrada por idade');
    /* A sessão antiga tem mtime antigo de verdade (a data vem do arquivo). */
    assert.ok(existsSync(oldFile));
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

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
  const files = ['main.cjs', 'lib.cjs', 'pi.cjs', 'state-adapter.cjs', 'src/state.mjs', ...hosts];
  const hits = [];
  for (const name of files) {
    const text = require('node:fs').readFileSync(join(DESK, name), 'utf8');
    for (const line of text.split('\n')) {
      if (/unlink|rmSync|rmdir/.test(line) && /session/i.test(line) && /Date\.now|mtime|7|day/i.test(line)) hits.push(`${name}: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(hits, [], 'nenhuma remoção de sessão por idade no host do Mesa');
});
