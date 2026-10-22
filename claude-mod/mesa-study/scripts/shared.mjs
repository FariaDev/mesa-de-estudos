/* Apoio dos scripts locais do plugin (doctor e build do helper nativo).
   Import-safe: importar este módulo não executa nada.
   Nada aqui compila ou executa o helper; são só utilidades de CLI/teste. */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/* Erro estável dos scripts, no mesmo espírito do HostError do host. */
export class ScriptError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'ScriptError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

export function scriptErrorMessage(error) {
  if (error instanceof ScriptError) return `${error.code}: ${error.message}`;
  return 'Falha interna do script.';
}

export function scriptErrorPayload(error) {
  if (error instanceof ScriptError) {
    const payload = {ok: false, error: {code: error.code, message: error.message}};
    if (error.detail !== undefined) payload.error.detail = error.detail;
    return payload;
  }
  const reason = tailText(error && error.message, 300);
  const payload = {ok: false, error: {code: 'INTERNAL', message: 'Falha interna do script.'}};
  if (reason) payload.error.detail = {reason};
  return payload;
}

/* Texto de stderr/stdout limitado e sem controles, para mensagens públicas. */
export function tailText(text, max = 300) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* Raiz do plugin a partir de um módulo dentro de scripts/ (realpath quando
   possível, para o caminho não depender de symlink do checkout). */
export function pluginRootFrom(moduleUrl) {
  const here = fileURLToPath(moduleUrl);
  const root = path.resolve(path.dirname(here), '..');
  try {
    return fs.realpathSync(root);
  } catch {
    return root;
  }
}

/* Ativa o runner só quando argv[1] é ESTE arquivo (comparação por caminho
   real, igual ao host/cli.mjs): importar o módulo não executa nada. */
export function isMainEntry(entry, moduleUrl) {
  if (typeof entry !== 'string' || entry === '') return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

export function parseSemverTuple(text) {
  const match = String(text ?? '').match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match) return null;
  return match.slice(1).map((part) => Number(part));
}

export function atLeastVersion(tuple, minimum) {
  if (!Array.isArray(tuple) || tuple.length === 0 || !Array.isArray(minimum)) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    const left = tuple[index] ?? 0;
    const right = minimum[index] ?? 0;
    if (left !== right) return left > right;
  }
  return true;
}
