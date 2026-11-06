import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* Pasta temporária de teste com remoção GARANTIDA: o `mkdtemp` solto enchia o
   /tmp (2026-11-05: só `mesa-updateflow-test-*` eram 9 mil pastas) porque nada
   apagava no fim — e o corredor (run-suite.mjs) mata o processo por sinal no
   prazo, morte que não dispara o `exit`. Aqui tudo que `tempDir` cria (ou que
   `trackTempDir` registra) é varrido no `exit` E no SIGINT/SIGTERM.
   `MESA_KEEP_RUNTIME=1` mantém as pastas para investigação, como no
   `newRuntime` do helpers.mjs. */

const tracked = new Set();
let hooked = false;

function sweep() {
  if (process.env.MESA_KEEP_RUNTIME === '1') return;
  for (const dir of tracked) {
    try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* melhor esforço */ }
  }
  tracked.clear();
}

function hookSweep() {
  if (hooked) return;
  hooked = true;
  process.once('exit', sweep);
  /* Morte por sinal não dispara `exit`: limpa e re-levanta o sinal, para o
     processo morrer com o mesmo código/default de antes. */
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => {
      sweep();
      process.removeListener(signal, handler);
      process.kill(process.pid, signal);
    };
    process.on(signal, handler);
  }
}

/**
 * Registra uma pasta (qualquer origem) para remoção garantida no fim do processo.
 * @param {string} dir caminho absoluto da pasta
 * @returns {string} o mesmo `dir`, para encadear
 * @example const runtime = trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-x-')));
 */
export function trackTempDir(dir) {
  hookSweep();
  tracked.add(path.resolve(dir));
  return dir;
}

/**
 * Pasta temporária nova sob `os.tmpdir()` (respeita o `TMPDIR` do teste) com
 * remoção garantida no fim do processo, mesmo em falha ou morte por sinal.
 * @param {string} [prefix] prefixo do nome; sai `PREFIX-XXXXXX`
 * @returns {string} caminho REAL da pasta criada (symlinks do tmpdir resolvidos)
 * @example const root = tempDir('mesa-updateflow-test'); // some no exit
 */
export function tempDir(prefix = 'mesa-test') {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`)));
  return trackTempDir(dir);
}
