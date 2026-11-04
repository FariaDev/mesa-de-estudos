// @ts-check
'use strict';

/* Instalador falso da primeira abertura (#release OpenCode). O host só o lê
   com `DESK_TEST=1` e `LEARNING_DESK_OPENCODE_INSTALL_FIXTURE`; nada toca na
   rede nem no HOME real. `LEARNING_DESK_OPENCODE_INSTALL_MODE=error` exercita
   o caminho de erro da tela. */

const fs = require('node:fs');
const path = require('node:path');

/** @param {{home: string, onProgress?: (progress: {phase: string, percent?: number}) => void}} input */
exports.install = async ({home, onProgress = () => {}}) => {
  /* O 12% depois do 40% prova que a barra não volta para trás; as fases sem
     número trocam para o indeterminado. */
  onProgress({phase: 'download', percent: 40});
  await new Promise((resolve) => setTimeout(resolve, 2000));
  onProgress({phase: 'download', percent: 12});
  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (process.env.LEARNING_DESK_OPENCODE_INSTALL_MODE === 'error') {
    throw Object.assign(Error('sem rede para baixar o OpenCode (fixture)'), {code: 'network'});
  }
  onProgress({phase: 'install'});
  const binary = path.join(home, '.opencode', 'bin', 'opencode');
  fs.mkdirSync(path.dirname(binary), {recursive: true});
  fs.writeFileSync(binary, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(binary, 0o755);
  await new Promise((resolve) => setTimeout(resolve, 6000));
  onProgress({phase: 'verify'});
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {ok: true, binary, version: '2.2.4'};
};
