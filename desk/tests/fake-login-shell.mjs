#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import path from 'node:path';

/* Shell de login falso (#102): o app aberto pelo Finder chega com PATH mínimo;
   este rc põe o binário "instalado por bun" no PATH e imprime lixo antes,
   como um `.zshrc` barulhento. O teste aponta `SHELL` para cá.

   Modos (`FAKE_LOGIN_SHELL_MODE`): `ok` (padrão) roda o comando com o PATH do
   bun; `hang` trava até o prazo; `junk` só imprime lixo; `ghost` devolve no
   marcador um caminho que não existe. */

const marker = process.env.FAKE_LOGIN_SHELL_MARKER || '__MESA_OPENCODE__';
const mode = process.env.FAKE_LOGIN_SHELL_MODE || 'ok';

if (mode === 'hang') {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  process.exit(0);
}
if (mode === 'junk') {
  process.stdout.write('rc: nenhum caminho aqui\n');
  process.exit(0);
}
if (mode === 'ghost') {
  process.stdout.write(`rc\n${marker}${path.join(import.meta.dirname, 'nao-existe', 'opencode')}${marker}\n`);
  process.exit(0);
}
if (mode === 'noexec') {
  process.stdout.write(`rc\n${marker}${path.join(import.meta.dirname, 'fake-bun-bin', 'opencode-sem-exec')}${marker}\n`);
  process.exit(0);
}

const command = process.argv.at(-1) || '';
process.stdout.write('fake rc: carregando o shell de login\n');
const result = spawnSync('/bin/sh', ['-c', command], {
  encoding: 'utf8',
  env: {...process.env, PATH: `${path.join(import.meta.dirname, 'fake-bun-bin')}${path.delimiter}${process.env.PATH || ''}`},
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 0);
