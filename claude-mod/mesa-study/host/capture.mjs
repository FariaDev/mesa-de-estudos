/* Operação `capture`: captura SOMENTE a janela do Xournal++ no macOS.
   - helper nativo PRÓPRIO do plugin (`native/windows`, caminho fixo; nunca
     vem do pedido), gerado só pelo script explícito
     `node scripts/build-helper.mjs` — captura nunca compila sozinha;
   - seleção exclusiva Xournal++ (ausente/ambígua/ID inválido recusam);
   - TODA listagem do helper é validada antes de qualquer `screencapture`:
     janela com cara de Xournal++ mas ID não inteiro (1..0xffffffff) vira
     CAPTURE_WINDOW_INVALID;
   - identidade da janela para revalidação = id + app + ownerPID quando os
     dois lados expõem o campo. O helper local (adaptado somente leitura de
     visual-check/windows.swift, com ownerPID) detecta o reuso do MESMO id
     por outra janela Xournal++; se um lado omitir o campo, a comparação
     degrada para id+app sem mudar o host;
   - `screencapture -x -o -lID` (janela específica; nunca a tela inteira);
   - PNG em subdiretório privado do cacheDir, arquivo 0600;
   - `svg` opcional é só uma prévia embutida e limitada; sem promessa de viewer.
   Testes injetam `run`/`helperPath`; esta operação não captura de verdade. */

import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {HostError} from './errors.mjs';
import {runProcess} from './proc.mjs';
import {ensureCacheDir, createOutputDir, removeOwnOutputDir, pruneOwnOutputs} from './output.mjs';
import {requireAbsolutePath} from './validate.mjs';
import {
  CAPTURE_HELPER_RELATIVE,
  CAPTURE_HELPER_TIMEOUT_MS,
  CAPTURE_SCREENSHOT_TIMEOUT_MS,
  CAPTURE_MAX_BUFFER,
  CAPTURE_WINDOW_ID_MAX,
  PNG_MAGIC,
  SVG_CHAR_LIMIT,
  OUTPUT_TTL_MS,
  SCREENCAPTURE_PATH,
} from './config.mjs';

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WINDOW_ID_RANGE = `1 e ${CAPTURE_WINDOW_ID_MAX}`;
const HELPER_BUILD_COMMAND = 'node scripts/build-helper.mjs';

/* Falha do helper já instalado (não executável, arquitetura errada ou saída
   inválida): código estável + dica explícita de substituição. O caminho do
   helper vem do próprio host, nunca do pedido. */
function helperFailed(helperPath, message, detail) {
  return new HostError(
    'CAPTURE_HELPER_FAILED',
    `${message} O binário em ${helperPath} pode estar sem permissão de execução ou ser de outra arquitetura; para substituí-lo, recompile com "${HELPER_BUILD_COMMAND}" (o helper nunca é compilado sozinho).`,
    {helperPath, buildCommand: HELPER_BUILD_COMMAND, ...(detail || {})},
  );
}

export function defaultHelperPath() {
  return path.resolve(HOST_DIR, ...CAPTURE_HELPER_RELATIVE);
}

export function isValidWindowId(value) {
  return Number.isInteger(value) && value >= 1 && value <= CAPTURE_WINDOW_ID_MAX;
}

export function isXournalWindow(window) {
  const app = typeof window?.app === 'string' ? window.app : '';
  const bounds = window?.bounds || {};
  const width = Number(bounds.Width ?? bounds.width ?? 0);
  const height = Number(bounds.Height ?? bounds.height ?? 0);
  return /^xournal(?:\+\+|pp)?$/i.test(app) && width > 100 && height > 100;
}

/* Filtra candidatos do Xournal++ e recusa a listagem inteira se alguma
   janela com cara de Xournal++ vier sem ID válido (nunca ignorar em
   silêncio: um ID ruim é dado anômalo do helper). */
function xournalCandidates(windows) {
  const list = Array.isArray(windows) ? windows : [];
  for (const window of list) {
    if (isXournalWindow(window) && !isValidWindowId(window.id)) {
      throw new HostError(
        'CAPTURE_WINDOW_INVALID',
        `O helper listou uma janela do Xournal++ com ID inválido (inteiro entre ${WINDOW_ID_RANGE}).`,
      );
    }
  }
  return list.filter(isXournalWindow);
}

export function selectXournalWindow(windows, windowId) {
  const candidates = xournalCandidates(windows);
  if (windowId !== undefined && windowId !== null) {
    if (!isValidWindowId(windowId)) {
      throw new HostError('CAPTURE_WINDOW_INVALID', `windowId precisa ser um inteiro entre ${WINDOW_ID_RANGE}.`);
    }
    const selected = candidates.filter((window) => window.id === windowId);
    if (selected.length !== 1) {
      throw new HostError('CAPTURE_WINDOW_INVALID', `A janela ${windowId} não está disponível no Xournal++.`, {windowId});
    }
    return selected[0];
  }
  if (candidates.length === 0) {
    throw new HostError('CAPTURE_WINDOW_ABSENT', 'Abra o Xournal++ e mantenha a janela visível no desktop atual.');
  }
  if (candidates.length > 1) {
    throw new HostError('CAPTURE_WINDOW_AMBIGUOUS', 'Há várias janelas do Xournal++. Deixe só a resolução visível ou escolha um ID.');
  }
  return candidates[0];
}

/* Identidade para revalidar sem confundir reuso de ID: mesmo id, mesmo app
   (sem diferenciar caixa) e, quando o helper expõe ownerPID nos dois lados,
   mesmo processo. Sem o campo, compara só o que o helper real oferece. */
export function sameWindowIdentity(before, after) {
  if (!before || !after) return false;
  if (before.id !== after.id) return false;
  const appBefore = String(before.app || '').trim().toLowerCase();
  const appAfter = String(after.app || '').trim().toLowerCase();
  if (appBefore !== appAfter) return false;
  const pidBefore = Number.isInteger(before.ownerPID) ? before.ownerPID : null;
  const pidAfter = Number.isInteger(after.ownerPID) ? after.ownerPID : null;
  if (pidBefore !== null && pidAfter !== null && pidBefore !== pidAfter) return false;
  return true;
}

function findCandidate(windows, windowId) {
  const candidates = xournalCandidates(windows);
  if (windowId !== undefined && windowId !== null) {
    const selected = candidates.filter((window) => window.id === windowId);
    return selected.length === 1 ? selected[0] : null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

async function listWindows(run, helperPath) {
  let result;
  try {
    result = await run([helperPath], {timeoutMs: CAPTURE_HELPER_TIMEOUT_MS, maxBuffer: CAPTURE_MAX_BUFFER});
  } catch {
    // O runner lançou ao tentar executar o helper (ex.: spawn quebrado):
    // mesma dica acionável do binário inválido.
    throw helperFailed(helperPath, 'Não foi possível executar o helper de janelas do Xournal++.');
  }
  if (!result || !result.ok) {
    if (result && result.missing) {
      throw new HostError(
        'CAPTURE_HELPER_MISSING',
        `Helper nativo de janelas não encontrado em ${helperPath}. Compile uma vez com "${HELPER_BUILD_COMMAND}" na raiz do plugin.`,
        {helperPath, buildCommand: HELPER_BUILD_COMMAND},
      );
    }
    if (result && result.timedOut) {
      throw new HostError('CAPTURE_HELPER_TIMEOUT', 'A listagem de janelas excedeu o tempo limite.');
    }
    throw helperFailed(helperPath, 'Não foi possível listar as janelas do Xournal++.', {
      exitCode: result && result.code !== undefined ? result.code : null,
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw helperFailed(helperPath, 'Resposta inválida do helper de janelas.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw helperFailed(helperPath, 'Resposta inválida do helper de janelas.');
  }
  if (!parsed.permission) {
    throw new HostError(
      'CAPTURE_PERMISSION',
      'Autorize Gravação de Tela para o aplicativo que executa o mod em Ajustes > Privacidade e Segurança > Gravação de Tela.',
    );
  }
  return Array.isArray(parsed.windows) ? parsed.windows : [];
}

async function readPng(pngPath) {
  let stat;
  try {
    stat = await fs.stat(pngPath);
  } catch {
    throw new HostError('CAPTURE_FAILED', 'A captura não produziu um arquivo.');
  }
  if (!stat.isFile() || stat.size < 100) {
    throw new HostError('CAPTURE_INVALID', 'A captura não produziu um PNG válido.');
  }
  const bytes = await fs.readFile(pngPath);
  if (bytes.length < PNG_MAGIC.length || !bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new HostError('CAPTURE_INVALID', 'A captura não produziu um PNG válido.');
  }
  return bytes;
}

export function pngSize(bytes) {
  if (bytes.length >= 24 && bytes.subarray(12, 16).toString('latin1') === 'IHDR') {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width > 0 && height > 0) return {width, height};
  }
  return null;
}

/* Prévia SVG opcional: embute o PNG só se o resultado couber no limite.
   Não é um viewer completo — é o mesmo campo Svg, limitado. */
export function svgPreviewForPng(bytes) {
  const size = pngSize(bytes);
  const width = size ? size.width : 100;
  const height = size ? size.height : 100;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}"><image x="0" y="0" width="${width}" height="${height}" xlink:href="data:image/png;base64,${Buffer.from(bytes).toString('base64')}"/></svg>`;
  return svg.length <= SVG_CHAR_LIMIT ? svg : null;
}

export async function captureOperation(request, deps = {}) {
  const run = deps.run || runProcess;
  const helperPath = deps.helperPath || defaultHelperPath();
  const screenshotTool = deps.screencapturePath || SCREENCAPTURE_PATH;
  const now = typeof deps.now === 'function' ? deps.now : () => new Date();
  const outputTtlMs = deps.outputTtlMs ?? OUTPUT_TTL_MS;

  const cacheDirInput = requireAbsolutePath(request.cacheDir, 'cacheDir', {code: 'CACHE_DIR_NOT_ABSOLUTE'});
  const windowId = request.windowId;
  if (windowId !== undefined && windowId !== null && !isValidWindowId(windowId)) {
    throw new HostError('CAPTURE_WINDOW_INVALID', `windowId precisa ser um inteiro entre ${WINDOW_ID_RANGE}.`);
  }

  const cacheDir = await ensureCacheDir(cacheDirInput);
  try {
    await pruneOwnOutputs(cacheDir, {ttlMs: outputTtlMs, now: Date.now()});
  } catch {
    // poda é best-effort
  }

  // Seleção explícita/única e revalidação ANTES de qualquer captura.
  const selected = selectXournalWindow(await listWindows(run, helperPath), windowId);
  const before = findCandidate(await listWindows(run, helperPath), windowId);
  if (!before || !sameWindowIdentity(selected, before)) {
    throw new HostError('CAPTURE_WINDOW_CHANGED', 'A janela do Xournal++ mudou antes da captura.');
  }

  const {dir: outDir} = await createOutputDir(cacheDir, 'capture');
  let keep = false;
  try {
    const snapshotPath = path.join(outDir, 'snapshot.png');
    let capture;
    try {
      capture = await run([screenshotTool, '-x', '-o', `-l${before.id}`, snapshotPath], {
        timeoutMs: CAPTURE_SCREENSHOT_TIMEOUT_MS,
        maxBuffer: CAPTURE_MAX_BUFFER,
      });
    } catch {
      throw new HostError('CAPTURE_FAILED', 'A captura da janela do Xournal++ falhou.');
    }
    if (!capture || !capture.ok) {
      if (capture && capture.missing) {
        throw new HostError('CAPTURE_FAILED', 'screencapture não encontrado.', {tool: screenshotTool});
      }
      if (capture && capture.timedOut) {
        throw new HostError('CAPTURE_TIMEOUT', 'A captura excedeu o tempo limite.');
      }
      throw new HostError('CAPTURE_FAILED', 'A captura da janela do Xournal++ falhou.');
    }

    const bytes = await readPng(snapshotPath);
    await fs.chmod(snapshotPath, 0o600);

    // Revalidação DEPOIS: a janela ainda é a mesma; senão a captura é descartada.
    const after = findCandidate(await listWindows(run, helperPath), windowId);
    if (!sameWindowIdentity(before, after)) {
      throw new HostError('CAPTURE_WINDOW_CHANGED', 'A janela do Xournal++ mudou durante a captura.');
    }

    const result = {
      ok: true,
      kind: 'capture',
      snapshotPath,
      mimeType: 'image/png',
      capturedAt: now().toISOString(),
      window: {
        id: String(before.id),
        app: String(before.app || 'Xournal++'),
        title: String(before.title || 'Xournal++'),
      },
    };
    const svg = svgPreviewForPng(bytes);
    if (svg) result.svg = svg;
    keep = true;
    return result;
  } finally {
    if (!keep) await removeOwnOutputDir(outDir);
  }
}
