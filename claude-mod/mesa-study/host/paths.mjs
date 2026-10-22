/* Confinamento de caminho por realpath: o arquivo só é aceito se o caminho
   REAL (symlinks resolvidos) estiver dentro de um dos diretórios autorizados,
   também realpath. Symlink que escapa da root é recusado. */

import path from 'node:path';
import fs from 'node:fs/promises';
import {HostError} from './errors.mjs';

export function isInsideRoot(realPath, realRoot) {
  if (realPath === realRoot) return true;
  const prefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  return realPath.startsWith(prefix);
}

async function realpathOrNull(target) {
  try {
    return await fs.realpath(target);
  } catch {
    return null;
  }
}

export async function resolveAuthorizedFile({filePath, roots, extensions = ['.pdf']}) {
  const realFile = await realpathOrNull(filePath);
  if (!realFile) {
    throw new HostError('PATH_NOT_FOUND', 'Arquivo não encontrado.', {path: filePath});
  }
  /* Roots que não resolvem (pasta removida/desmontada numa lista antiga do
     consumidor) são puladas: elas não concedem acesso algum, mas também não
     derrubam as roots válidas. A autorização segue por realpath exato/prefixo
     das roots que existem; sem NENHUMA root válida, aí sim ROOT_NOT_FOUND. */
  const realRoots = [];
  const missingRoots = [];
  for (const root of roots) {
    const realRoot = await realpathOrNull(root);
    if (!realRoot) {
      missingRoots.push(root);
      continue;
    }
    realRoots.push(realRoot);
  }
  if (realRoots.length === 0) {
    throw new HostError(
      'ROOT_NOT_FOUND',
      missingRoots.length === 1
        ? `Diretório autorizado não existe: ${missingRoots[0]}.`
        : `Nenhum diretório autorizado existe (${missingRoots.length} roots ausentes).`,
      {roots: missingRoots},
    );
  }
  if (!realRoots.some((root) => isInsideRoot(realFile, root))) {
    throw new HostError('PATH_OUTSIDE_ROOTS', 'Arquivo fora dos diretórios autorizados.', {path: realFile});
  }
  let stat;
  try {
    stat = await fs.stat(realFile);
  } catch {
    throw new HostError('PATH_NOT_FOUND', 'Arquivo não encontrado.', {path: filePath});
  }
  if (!stat.isFile()) {
    throw new HostError('NOT_A_FILE', 'O caminho autorizado não é um arquivo regular.', {path: realFile});
  }
  if (extensions.length > 0) {
    const extension = path.extname(realFile).toLowerCase();
    if (!extensions.includes(extension)) {
      throw new HostError('NOT_PDF_EXTENSION', 'O arquivo autorizado precisa ter extensão .pdf.', {path: realFile});
    }
  }
  return {realPath: realFile, stat, roots: realRoots};
}

export async function readHeader(filePath, length) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const {bytesRead} = await handle.read(buffer, 0, length, 0);
    return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
