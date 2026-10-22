/* Execução de processos SEM shell: sempre lista de argumentos.
   O host nunca aceita comando/executável vindo do pedido JSON.
   Devolve resultado estável (não lança por exit≠0/timeout/ENOENT) para os
   módulos de operação mapearem o código de erro certo. */

import {execFile} from 'node:child_process';
import {PROCESS_MAX_BUFFER} from './config.mjs';
import {HostError} from './errors.mjs';

export async function runProcess(argv, {timeoutMs = 20000, maxBuffer = PROCESS_MAX_BUFFER, cwd} = {}) {
  if (!Array.isArray(argv) || argv.length === 0 || typeof argv[0] !== 'string' || argv[0] === '') {
    throw new HostError('INTERNAL', 'Comando inválido: esperada lista de argumentos com executável.');
  }
  if (argv.some((arg) => typeof arg !== 'string')) {
    throw new HostError('INTERNAL', 'Comando inválido: todos os argumentos precisam ser strings.');
  }
  return new Promise((resolve) => {
    execFile(argv[0], argv.slice(1), {
      timeout: timeoutMs,
      maxBuffer,
      encoding: 'utf8',
      shell: false, // nunca shell
      windowsHide: true,
      ...(cwd ? {cwd} : {}),
    }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ok: true, code: 0, stdout: stdout || '', stderr: stderr || '', timedOut: false, missing: false});
        return;
      }
      const missing = error.code === 'ENOENT';
      const timedOut = error.killed === true || error.signal === 'SIGTERM';
      const code = typeof error.code === 'number' ? error.code
        : typeof error.status === 'number' ? error.status : null;
      resolve({
        ok: false,
        code,
        stdout: stdout || '',
        stderr: stderr || '',
        timedOut,
        missing,
      });
    });
  });
}

/* Açúcar para os testes/consumidores que querem o mesmo shape a partir de
   uma resposta falsa. Não executa nada. */
export function fakeResult({stdout = '', stderr = '', code = 0, timedOut = false, missing = false} = {}) {
  return {ok: code === 0 && !timedOut && !missing, code, stdout, stderr, timedOut, missing};
}
