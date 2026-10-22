/* Resolve o núcleo do Desfazer (`core/undoview.bend`).
 *
 * O build global do pai gera `desk/src/generated/undoview.core.js` a partir do
 * `core/build.mjs`. Enquanto o artefato não existe, este helper compila SÓ o
 * módulo pedido para um diretório temporário (a mesma toolchain do
 * `study-core-build.mjs`), sem tocar em `desk/src/generated`. */

import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildStudyCores} from './study-core-build.mjs';

export function undoviewCorePath() {
  const artifact = fileURLToPath(new URL('../src/generated/undoview.core.js', import.meta.url));
  if (existsSync(artifact)) return artifact;
  return buildStudyCores({entries: ['undoview.bend']}).corePath('undoview');
}

export function useUndoviewCore() {
  const file = undoviewCorePath();
  process.env.MESA_UNDOVIEW_CORE = file;
  return file;
}
