/* Como o portão do núcleo roda cada passo (`npm run build:bend`, `test:proof`,
   `test:parity`) — separado de `core-gate.mjs` para poder ser testado sem rodar
   o portão inteiro.

   WINDOWS: o npm é um `.cmd`, e `.cmd` NÃO pode ser executado direto pelo
   `spawnSync` desde o Node 18.20 (é `EINVAL`, não `ENOENT`). Antes o portão
   chamava `npm` puro: no Windows ele morria com exit 1 e ZERO mensagem — o erro
   do spawn fica em `result.error`, e ninguém olhava (`result.status` é null).
   Com `shell`, a linha vai para o `cmd.exe`, que resolve `npm.cmd` pelo PATH.
   No macOS/Linux nada muda: `npm run <passo>`, sem shell.

   O teste (`tests/coregate.test.mjs`) cobre o Windows de MENTIRA (plataforma
   injetada): o Windows de verdade não roda nesta máquina, e o teste diz isso. */
import {spawnSync} from 'node:child_process';

/** O comando de um passo do `package.json`, por plataforma. */
export function npmInvocation(script, platform = process.platform) {
  return platform === 'win32'
    ? {file: 'npm.cmd', args: ['run', script], options: {shell: true}}
    : {file: 'npm', args: ['run', script], options: {}};
}

/**
 * Roda um passo herdando o terminal. Nunca é silencioso: spawn que não saiu,
 * interrupção por sinal e código de saída diferente de zero viram mensagem com
 * o comando exato. Devolve `{ok, status, signal, line}`.
 */
export function runStep({script, cwd, platform = process.platform, spawn = spawnSync, log = console, env = process.env}) {
  const plan = npmInvocation(script, platform);
  const line = `${plan.file} ${plan.args.join(' ')}`;
  const result = spawn(plan.file, plan.args, {cwd, stdio: 'inherit', env, ...plan.options});
  if (result?.error) {
    log.error(`portão do núcleo: não deu para rodar \`${line}\`: ${result.error.code || result.error.message}`);
    log.error('  o passo é um script do npm; confira se o npm está no PATH desta sessão.');
    return {ok: false, status: 1, signal: '', line, reason: 'spawn'};
  }
  if (result?.signal) log.error(`portão do núcleo: \`${line}\` foi interrompido (${result.signal}).`);
  const status = result?.status ?? 1;
  return {ok: result?.status === 0, status, signal: result?.signal || '', line};
}
