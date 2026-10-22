#!/usr/bin/env node
/* CLI do host: `node host/cli.mjs JSON_STRING`.
   - argv[2] recebe UM JSON bounded e válido;
   - stdout recebe UMA linha JSON: {ok:true,...} ou {ok:false,error:{code,message}};
   - sucesso sai 0; qualquer falha sai 1.
   Sem shell, sem leitura de stdin, sem argumentos extras. */

import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dispatch} from './operations.mjs';
import {errorPayload, HostError} from './errors.mjs';
import {MAX_REQUEST_CHARS} from './config.mjs';

export function parseRequest(argv) {
  if (!Array.isArray(argv) || argv.length !== 1) {
    throw new HostError('BAD_REQUEST', 'Uso: node cli.mjs JSON.');
  }
  const raw = argv[0];
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new HostError('BAD_REQUEST', 'JSON ausente.');
  }
  if (raw.length > MAX_REQUEST_CHARS) {
    throw new HostError('BAD_REQUEST', `JSON excede ${MAX_REQUEST_CHARS} caracteres.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HostError('BAD_REQUEST', 'JSON inválido.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HostError('BAD_REQUEST', 'JSON precisa ser um objeto.');
  }
  return parsed;
}

export async function runCli(argv, {deps = {}, stdout = (line) => process.stdout.write(line)} = {}) {
  try {
    const request = parseRequest(argv);
    const result = await dispatch(request, deps);
    stdout(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    stdout(`${JSON.stringify(errorPayload(error))}\n`);
    return 1;
  }
}

/* Só ativa o runner quando argv[1] é ESTE arquivo, comparando CAMINHOS REAIS:
   em ESM o Node resolve symlinks do próprio módulo, mas argv[1] preserva o
   caminho digitado (arquivo symlinkado ou diretório-pai symlinkado). Comparar
   a string crua faria o CLI sair 0 sem JSON quando o plugin root é symlink.
   Importado como módulo (argv[1] é outro arquivo), não roda nada. */
export function isMainEntry(entry, moduleUrl = import.meta.url) {
  if (typeof entry !== 'string' || entry === '') return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isMainEntry(process.argv[1])) {
  process.exitCode = await runCli(process.argv.slice(2));
}
