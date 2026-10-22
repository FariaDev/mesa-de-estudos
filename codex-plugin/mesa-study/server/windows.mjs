/* Listagem SOMENTE LEITURA das janelas do Xournal++ via helper declarado.
   - o helper vem SÓ da configuração de inicialização (--xournal-helper /
     MESA_XOURNAL_HELPER); nenhuma chamada de ferramenta escolhe executável;
   - a listagem é validada com os mesmos predicados do host (`isXournalWindow`,
     `isValidWindowId`); janela com cara de Xournal++ e ID inválido recusa a
     listagem inteira (CAPTURE_WINDOW_INVALID);
   - `mesa_windows` usa só esta função: nunca dispara `screencapture`. */

import path from 'node:path';
import {HostError} from '../host/errors.mjs';
import {runProcess} from '../host/proc.mjs';
import {isXournalWindow, isValidWindowId} from '../host/capture.mjs';
import {CAPTURE_HELPER_TIMEOUT_MS, CAPTURE_MAX_BUFFER, CAPTURE_WINDOW_ID_MAX} from '../host/config.mjs';

export const HELPER_GUIDANCE =
  'Configure o helper na inicialização com --xournal-helper /caminho/absoluto ou MESA_XOURNAL_HELPER. A leitura de PDF continua disponível sem ele.';

export function resolveHelperPath(config) {
  const declared = config && typeof config.xournalHelper === 'string' ? config.xournalHelper : null;
  if (!declared) {
    throw new HostError(
      'CAPTURE_HELPER_MISSING',
      `Helper de janelas do Xournal++ não configurado. ${HELPER_GUIDANCE}`,
    );
  }
  if (!path.isAbsolute(declared)) {
    throw new HostError('CAPTURE_HELPER_MISSING', `O helper declarado precisa ser um caminho absoluto. ${HELPER_GUIDANCE}`);
  }
  return declared;
}

export async function listXournalWindows({
  run = runProcess,
  helperPath,
  timeoutMs = CAPTURE_HELPER_TIMEOUT_MS,
  maxBuffer = CAPTURE_MAX_BUFFER,
  permissionMessage = 'Autorize Gravação de Tela para o aplicativo que executa o servidor (Codex) em Ajustes > Privacidade e Segurança > Gravação de Tela.',
} = {}) {
  if (typeof helperPath !== 'string' || helperPath.length === 0 || !path.isAbsolute(helperPath)) {
    throw new HostError('CAPTURE_HELPER_MISSING', `Helper de janelas ausente ou não absoluto. ${HELPER_GUIDANCE}`);
  }
  let result;
  try {
    result = await run([helperPath], {timeoutMs, maxBuffer});
  } catch {
    throw new HostError('CAPTURE_HELPER_FAILED', 'Não foi possível consultar as janelas do Xournal++.');
  }
  if (!result || !result.ok) {
    if (result && result.missing) {
      throw new HostError('CAPTURE_HELPER_MISSING', 'Helper de janelas do Xournal++ não encontrado.', {helperPath});
    }
    if (result && result.timedOut) {
      throw new HostError('CAPTURE_HELPER_TIMEOUT', 'A listagem de janelas excedeu o tempo limite.');
    }
    throw new HostError('CAPTURE_HELPER_FAILED', 'Não foi possível listar as janelas do Xournal++.');
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new HostError('CAPTURE_HELPER_FAILED', 'Resposta inválida do helper de janelas.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new HostError('CAPTURE_HELPER_FAILED', 'Resposta inválida do helper de janelas.');
  }
  if (!parsed.permission) {
    throw new HostError('CAPTURE_PERMISSION', permissionMessage);
  }
  const windows = Array.isArray(parsed.windows) ? parsed.windows : [];
  for (const window of windows) {
    if (isXournalWindow(window) && !isValidWindowId(window.id)) {
      throw new HostError(
        'CAPTURE_WINDOW_INVALID',
        `O helper listou uma janela do Xournal++ com ID inválido (inteiro entre 1 e ${CAPTURE_WINDOW_ID_MAX}).`,
      );
    }
  }
  return windows.filter(isXournalWindow).map((window) => ({
    id: String(window.id),
    app: String(window.app || 'Xournal++'),
    title: String(window.title || 'Xournal++'),
    ...(Number.isInteger(window.ownerPID) ? {ownerPID: window.ownerPID} : {}),
  }));
}
