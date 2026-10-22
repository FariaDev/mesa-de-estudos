/* Validação de campos do pedido JSON. Mensagens em pt-BR; códigos estáveis. */

import path from 'node:path';
import {HostError} from './errors.mjs';
import {MAX_PATH_CHARS, MAX_ROOTS, MAX_PAGE} from './config.mjs';

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function requireString(value, field, {max = MAX_PATH_CHARS, code = 'INVALID_REQUEST'} = {}) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HostError(code, `Campo ${field} ausente ou inválido.`);
  }
  if (value.length > max) {
    throw new HostError(code, `Campo ${field} excede ${max} caracteres.`);
  }
  return value;
}

export function requireAbsolutePath(value, field, {code = 'PATH_NOT_ABSOLUTE'} = {}) {
  const text = requireString(value, field, {code});
  if (!path.isAbsolute(text)) {
    throw new HostError(code, `Campo ${field} precisa ser um caminho absoluto.`);
  }
  return text;
}

export function requirePage(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE) {
    throw new HostError('PAGE_INVALID', `Campo page precisa ser inteiro entre 1 e ${MAX_PAGE}.`);
  }
  return value;
}

export function requireRoots(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HostError('ROOTS_INVALID', 'Campo roots precisa listar ao menos um diretório autorizado.');
  }
  if (value.length > MAX_ROOTS) {
    throw new HostError('ROOTS_INVALID', `Campo roots excede ${MAX_ROOTS} diretórios.`);
  }
  return value.map((root, index) => requireAbsolutePath(root, `roots[${index}]`, {code: 'ROOTS_INVALID'}));
}
