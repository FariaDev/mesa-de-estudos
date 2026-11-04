// @ts-check
'use strict';

/* Encerramento da ÁRVORE de um processo filho (CI windows-latest).

   No Windows o Pi instalado por npm global chega como `pi.cmd`: o `spawn` com
   `shell:true` cria `cmd.exe` → `node.exe`. Matar só o `cmd.exe` deixa o
   `node.exe` neto vivo — ele continua segurando o cwd e os arquivos da sessão.
   `taskkill /T /F` desce a árvore. No POSIX o filho é o processo real (sem
   shell) e o sinal normal basta.

   `execFileSync` e `kill` entram por parâmetro: o teste usa fakes nomeados e
   não mata nada. */

const {execFileSync} = require('node:child_process');

const EXIT_TIMEOUT_MS = 5000;

/**
 * Encerra o processo e os descendentes. Nunca lança: quem chama está fechando
 * uma ponte e não pode ser derrubado por um processo que já morreu.
 * @param {{pid?: number, kill?: (signal?: string) => unknown}} child
 * @param {{platform?: NodeJS.Platform, execFile?: typeof execFileSync}} [deps]
 * @returns {boolean} `true` se o encerramento foi pedido
 * @example killProcessTree(child) // no Windows: taskkill /PID <pid> /T /F
 */
function killProcessTree(child, {platform = process.platform, execFile = execFileSync} = {}) {
  const pid = Number(child?.pid || 0);
  if (platform === 'win32' && pid > 0) {
    try {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], {stdio: 'ignore'});
      return true;
    } catch {
      /* processo já saiu ou não é nosso; o kill direto abaixo ainda tenta */
    }
  }
  if (typeof child?.kill !== 'function') return false;
  try {
    child.kill();
    return true;
  } catch {
    return false;
  }
}

/**
 * Espera o filho sair de fato. `stop()` não pode resolver antes disso: no
 * Windows o `taskkill` marca o processo como morto, mas os handles do neto só
 * são liberados quando o nó da árvore termina — apagar o temporário antes
 * disso dá `EBUSY`.
 * @param {{exitCode?: number|null, signalCode?: string|null, once?: (event: string, fn: () => void) => unknown, removeListener?: (event: string, fn: () => void) => unknown}|null} child
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<boolean>} `true` se o `exit` foi observado; `false` no prazo
 * @example await waitForExit(child) // true quando o 'exit' chegou
 */
function waitForExit(child, {timeoutMs = EXIT_TIMEOUT_MS} = {}) {
  if (!child || child.exitCode != null || child.signalCode != null) return Promise.resolve(true);
  if (typeof child.once !== 'function') return Promise.resolve(true);
  return new Promise((resolve) => {
    let timer = null;
    const done = (exited) => {
      if (timer) clearTimeout(timer);
      if (typeof child.removeListener === 'function') {
        child.removeListener('exit', onExit);
        child.removeListener('close', onExit);
      }
      resolve(exited);
    };
    const onExit = () => done(true);
    child.once('exit', onExit);
    child.once('close', onExit);
    timer = setTimeout(() => done(false), timeoutMs);
  });
}

module.exports = {EXIT_TIMEOUT_MS, killProcessTree, waitForExit};
