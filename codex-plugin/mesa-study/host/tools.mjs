/* Resolução dos executáveis Poppler conhecidos.
   - Só os diretórios fixos de POPPLER_DIRS, na ordem (mesma lista do doctor):
     /opt/homebrew/bin, /usr/local/bin, /usr/bin;
   - nunca aceita caminho vindo do pedido JSON nem procura no PATH;
   - primeiro candidato executável (X_OK) vence;
   - nenhum candidato → devolve o do primeiro diretório, e a execução falha
     com TOOL_MISSING (comportamento igual ao de antes). */

import fs from 'node:fs';
import path from 'node:path';
import {POPPLER_DIRS} from './config.mjs';

export function isExecutableFile(candidate) {
  try {
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) return false;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolvePopplerTool(name, {isExecutable = isExecutableFile, dirs = POPPLER_DIRS} = {}) {
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    if (isExecutable(candidate)) return candidate;
  }
  return path.join(dirs[0], name);
}

export function resolvePopplerTools(deps = {}) {
  return {
    pdfinfo: resolvePopplerTool('pdfinfo', deps),
    pdftocairo: resolvePopplerTool('pdftocairo', deps),
  };
}
