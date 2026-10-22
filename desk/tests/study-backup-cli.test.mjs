import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {seedRuntime, tempDir, write, read, cleanup} from './study-backup-fixtures.mjs';

/* O CLI é a porta headless (backup com o app fechado, conferência, ensaio de
   restauração). Aqui ele roda de verdade contra um runtime sintético: o mesmo
   módulo do app, nenhum atalho. */

const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(DESK, 'scripts', 'study-backup.mjs');

function runCli(args, {expectFailure = false} = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {encoding: 'utf8', cwd: DESK});
    if (expectFailure) throw Error(`esperava falha, veio sucesso: ${args.join(' ')}`);
    return stdout;
  } catch (error) {
    if (!expectFailure) throw error;
    return `${error.stdout || ''}${error.stderr || ''}`;
  }
}

/* O CLI registra as linhas `[backup] …` no stdout e imprime o JSON no fim:
   o teste lê só o último bloco (o que um humano copia). */
function runJson(args) {
  const text = runCli(args);
  /* O CLI imprime as linhas `[backup] …` e o JSON no fim; acha o último bloco
     balanceado e o devolve. */
  const start = Math.max(text.lastIndexOf('\n{'), text.lastIndexOf('\n[')) + 1;
  const body = text.slice(start);
  const open = body[0];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < body.length; index++) {
    const ch = body[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(body.slice(0, index + 1));
    }
  }
  throw Error(`saída do CLI sem JSON: ${body.slice(0, 200)}`);
}

test('cli: backup, list, verify, restore --sim e prune num destino real', () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-cli-dest');
  try {
    const backupOut = runJson(['backup', '--runtime', fixture.runtime, '--dest', dest, '--sem-pdfs']);
    assert.ok(backupOut.snapshotId.startsWith('snap-'));
    assert.equal(fs.existsSync(backupOut.path), true);
    assert.equal(backupOut.skippedBinary >= 1, true, 'política de PDF respeitada no CLI');

    const list = runJson(['list', '--dest', dest]);
    assert.equal(list.length, 1);
    assert.equal(list[0].valid, true);

    const verify = runJson(['verify', '--dest', dest]);
    assert.equal(verify.ok, true);
    assert.equal(verify.checked, list[0].entries);

    /* Prévias: `--sim` não escreve e cancela o plano. */
    const before = read(fixture.runtime, 'review.json');
    write(fixture.runtime, 'review.json', '{"mat-1":["mudou"]}');
    const sim = runJson(['restore', '--runtime', fixture.runtime, '--dest', dest, '--id', list[0].snapshotId, '--sim']);
    assert.equal(sim.cancelled, true);
    assert.equal(read(fixture.runtime, 'review.json'), '{"mat-1":["mudou"]}', 'simulação não escreveu');

    /* Restauração de verdade: bytes de volta ao original. */
    const applied = runJson(['restore', '--runtime', fixture.runtime, '--dest', dest, '--id', list[0].snapshotId, '--sim', '--confirmar']);
    assert.equal(applied.applied, true);
    assert.equal(read(fixture.runtime, 'review.json'), before);

    /* Retenção pelo CLI. */
    const second = runJson(['backup', '--runtime', fixture.runtime, '--dest', dest, '--guardar', '1']);
    assert.ok(second.snapshotId);
    const afterPrune = runJson(['list', '--dest', dest]);
    assert.equal(afterPrune.length, 1);
    assert.equal(afterPrune[0].snapshotId, second.snapshotId);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('cli: sem --runtime o comando recusa em vez de adivinhar', () => {
  const dest = tempDir('mesa-cli-dest');
  try {
    const out = runCli(['backup', '--dest', dest], {expectFailure: true});
    assert.match(out, /informe --runtime/);
  } finally {
    cleanup(dest);
  }
});

test('cli: --dest dentro/ao redor do runtime é recusado antes de criar pasta', () => {
  const fixture = seedRuntime();
  const links = tempDir('mesa-cli-links');
  try {
    /* Caminho novo dentro do runtime: recusa e não cria nada. */
    const nested = path.join(fixture.runtime, 'backup');
    const out = runCli(['backup', '--runtime', fixture.runtime, '--dest', nested], {expectFailure: true});
    assert.match(out, /destino do backup/);
    assert.equal(fs.existsSync(nested), false, 'a pasta recusada não é criada');

    /* Destino que contém o runtime também recusa. */
    const parent = runCli(['backup', '--runtime', fixture.runtime, '--dest', path.dirname(fixture.runtime)], {expectFailure: true});
    assert.match(parent, /destino do backup/);

    /* Symlink no meio do caminho novo conta nas duas direções. */
    const link = path.join(links, 'runtime');
    fs.symlinkSync(fixture.runtime, link);
    const linked = runCli(['backup', '--runtime', fixture.runtime, '--dest', path.join(link, 'guardado')], {expectFailure: true});
    assert.match(linked, /destino do backup/);
    assert.equal(fs.existsSync(path.join(fixture.runtime, 'guardado')), false);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, links);
  }
});
