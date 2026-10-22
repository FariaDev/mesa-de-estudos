/* Operação `page`: lê UM PDF autorizado (somente leitura) e devolve a página
   pedida como SVG (limite do host de mods) + PNG da mesma página.

   Fluxo: validar pedido → realpath/roots/extensão/tamanho/cabeçalho →
   pdfinfo (nº de páginas) → bounds → pdftocairo -svg (1 página) →
   pdftocairo -png -singlefile (150 ppi) → validar saídas → resultado.

   Prévia acima do limite do host de mods degrada SÓ a prévia: o SVG é
   omitido (svg:null + previewWarning bounded, sem truncar) e o PNG da página
   ainda é gerado. SVG inválido ou conversão que falha continuam erro. */

import path from 'node:path';
import fs from 'node:fs/promises';
import {HostError} from './errors.mjs';
import {runProcess} from './proc.mjs';
import {resolvePopplerTools} from './tools.mjs';
import {resolveAuthorizedFile, readHeader} from './paths.mjs';
import {ensureCacheDir, createOutputDir, removeOwnOutputDir, pruneOwnOutputs} from './output.mjs';
import {requireAbsolutePath, requirePage, requireRoots} from './validate.mjs';
import {
  PDF_MAGIC,
  PNG_MAGIC,
  MAX_PDF_BYTES,
  MIN_PDF_BYTES,
  MAX_SVG_READ_BYTES,
  SVG_CHAR_LIMIT,
  PDFINFO_TIMEOUT_MS,
  PDFTOCAIRO_TIMEOUT_MS,
  PROCESS_MAX_BUFFER,
  PNG_RENDER_DPI,
  OUTPUT_TTL_MS,
} from './config.mjs';

export const PAGE_LIMITS = Object.freeze({
  maxPdfBytes: MAX_PDF_BYTES,
  minPdfBytes: MIN_PDF_BYTES,
  maxSvgReadBytes: MAX_SVG_READ_BYTES,
  svgCharLimit: SVG_CHAR_LIMIT,
  pdfinfoTimeoutMs: PDFINFO_TIMEOUT_MS,
  convertTimeoutMs: PDFTOCAIRO_TIMEOUT_MS,
  processMaxBuffer: PROCESS_MAX_BUFFER,
  pngDpi: PNG_RENDER_DPI,
  outputTtlMs: OUTPUT_TTL_MS,
});

function sanitize(text, max = 300) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function runTool(run, argv, {timeoutMs, maxBuffer, label, timeoutCode, failCode, mapFailure = null}) {
  let result;
  try {
    result = await run(argv, {timeoutMs, maxBuffer});
  } catch (error) {
    const reason = sanitize(error && error.message);
    throw new HostError(failCode, `${label} falhou.${reason ? ` ${reason}` : ''}`, {tool: argv[0]});
  }
  if (result && result.ok) return result;
  if (result && result.missing) {
    throw new HostError('TOOL_MISSING', `Ferramenta Poppler não encontrada: ${label}.`, {tool: argv[0]});
  }
  if (result && result.timedOut) {
    throw new HostError(timeoutCode, `${label} excedeu o tempo limite.`, {tool: argv[0]});
  }
  if (mapFailure) {
    const mapped = mapFailure(result);
    if (mapped) throw mapped;
  }
  const reason = sanitize(result && (result.stderr || result.stdout));
  throw new HostError(failCode, `${label} falhou.${reason ? ` ${reason}` : ''}`, {tool: argv[0]});
}

const PDF_ENCRYPTED_MESSAGE = 'O PDF está protegido por senha; não é possível renderizar a página.';

/* O pdfinfo REAL com senha de usuário NÃO sai 0: sai != 0 e escreve no stderr
   uma linha própria ("Command Line Error: Incorrect password"), sem imprimir
   Encrypted:/Pages:. Só estas linhas EXATAS viram PDF_ENCRYPTED — um caminho
   com "password" no meio de outra falha não conta (nada de regex genérica). */
const PDFINFO_PASSWORD_DIAGNOSTIC = /^Command Line Error: (?:Incorrect password|Password required)\s*$/mi;

export function isPasswordDiagnostic(stderr) {
  return PDFINFO_PASSWORD_DIAGNOSTIC.test(String(stderr || ''));
}

export function parsePdfInfo(stdout) {
  const text = String(stdout || '');
  const pagesMatch = /^Pages:\s+(\d+)\s*$/m.exec(text);
  const numPages = pagesMatch ? Number(pagesMatch[1]) : null;
  return {
    numPages: Number.isInteger(numPages) && numPages > 0 ? numPages : null,
    encrypted: /^Encrypted:\s+yes\s*$/mi.test(text),
  };
}

export function pdfInfoError(info) {
  if (info && info.numPages) return null;
  if (info && info.encrypted) {
    return new HostError('PDF_ENCRYPTED', PDF_ENCRYPTED_MESSAGE);
  }
  return new HostError('PDFINFO_PARSE', 'Não foi possível ler o número de páginas do PDF.');
}

export function previewWarningFor(limits, {length = null, bytes = null} = {}) {
  const measured = Number.isFinite(length) ? `${length} caracteres` : `${bytes} bytes`;
  return sanitize(
    `A prévia vetorial da página tem ${measured} e excede o limite de ${limits.svgCharLimit} caracteres; a prévia SVG foi omitida. O PNG da página foi gerado.`,
    300,
  );
}

/* Lê o SVG produzido pela conversão.
   - arquivo ausente/vazio → CONVERT_FAILED;
   - SVG com cabeçalho inesperado → SVG_INVALID (erro, mesmo se grande);
   - acima do limite de bytes ou de caracteres → {svg: null, warning}
     (nunca trunca e nunca inventa fidelidade);
   - dentro do limite → {svg, warning: null}. */
async function readPreviewSvg(svgPath, limits) {
  let stat;
  try {
    stat = await fs.stat(svgPath);
  } catch {
    throw new HostError('CONVERT_FAILED', 'A conversão não produziu o SVG da página.');
  }
  if (!stat.isFile() || stat.size === 0) {
    throw new HostError('CONVERT_FAILED', 'A conversão não produziu o SVG da página.');
  }
  const oversizedBytes = stat.size > limits.maxSvgReadBytes;
  let head;
  if (oversizedBytes) {
    // Lê só um prefixo bounded para validar o cabeçalho; o tamanho já excede.
    const length = Math.min(stat.size, limits.maxSvgReadBytes);
    const handle = await fs.open(svgPath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const {bytesRead} = await handle.read(buffer, 0, length, 0);
      head = buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await handle.close();
    }
  } else {
    head = await fs.readFile(svgPath, 'utf8');
  }
  if (!/^\s*<\?xml/.test(head) || !head.includes('<svg')) {
    throw new HostError('SVG_INVALID', 'A conversão produziu um SVG inesperado.');
  }
  if (oversizedBytes) return {svg: null, warning: previewWarningFor(limits, {bytes: stat.size})};
  if (head.length > limits.svgCharLimit) return {svg: null, warning: previewWarningFor(limits, {length: head.length})};
  return {svg: head, warning: null};
}

async function assertPng(pngPath) {
  let stat;
  try {
    stat = await fs.stat(pngPath);
  } catch {
    throw new HostError('CONVERT_FAILED', 'A conversão não produziu o PNG da página.');
  }
  if (!stat.isFile() || stat.size < 100) {
    throw new HostError('PNG_INVALID', 'A conversão produziu um PNG inválido.');
  }
  const handle = await fs.open(pngPath, 'r');
  try {
    const buffer = Buffer.alloc(PNG_MAGIC.length);
    const {bytesRead} = await handle.read(buffer, 0, PNG_MAGIC.length, 0);
    if (bytesRead !== PNG_MAGIC.length || !buffer.equals(PNG_MAGIC)) {
      throw new HostError('PNG_INVALID', 'A conversão produziu um PNG inválido.');
    }
  } finally {
    await handle.close();
  }
}

export async function pageOperation(request, deps = {}) {
  const run = deps.run || runProcess;
  const tools = {...resolvePopplerTools({isExecutable: deps.isExecutable}), ...(deps.tools || {})};
  const limits = {...PAGE_LIMITS, ...(deps.limits || {})};
  const now = typeof deps.now === 'function' ? deps.now : () => Date.now();

  const filePath = requireAbsolutePath(request.path, 'path');
  const page = requirePage(request.page);
  const roots = requireRoots(request.roots);
  const cacheDirInput = requireAbsolutePath(request.cacheDir, 'cacheDir', {code: 'CACHE_DIR_NOT_ABSOLUTE'});

  const {realPath, stat} = await resolveAuthorizedFile({filePath, roots, extensions: ['.pdf']});
  if (stat.size < limits.minPdfBytes) {
    throw new HostError('PDF_TOO_SMALL', 'O arquivo é pequeno demais para ser um PDF.', {size: stat.size});
  }
  if (stat.size > limits.maxPdfBytes) {
    throw new HostError('PDF_TOO_LARGE', 'O PDF excede o tamanho máximo aceito.', {
      size: stat.size,
      limit: limits.maxPdfBytes,
    });
  }
  const header = await readHeader(realPath, PDF_MAGIC.length);
  if (header.length !== PDF_MAGIC.length || header.toString('latin1') !== PDF_MAGIC) {
    throw new HostError('PDF_HEADER_INVALID', 'O arquivo não começa com o cabeçalho %PDF-.');
  }

  const cacheDir = await ensureCacheDir(cacheDirInput);
  try {
    await pruneOwnOutputs(cacheDir, {ttlMs: limits.outputTtlMs, now: now()});
  } catch {
    // poda é best-effort
  }

  const {dir: outDir} = await createOutputDir(cacheDir, 'page');
  let keep = false;
  try {
    const info = await runTool(run, [tools.pdfinfo, realPath], {
      timeoutMs: limits.pdfinfoTimeoutMs,
      maxBuffer: limits.processMaxBuffer,
      label: 'pdfinfo',
      timeoutCode: 'PDFINFO_TIMEOUT',
      failCode: 'PDFINFO_FAILED',
      mapFailure: (result) => (isPasswordDiagnostic(result && result.stderr)
        ? new HostError('PDF_ENCRYPTED', PDF_ENCRYPTED_MESSAGE)
        : null),
    });
    const parsed = parsePdfInfo(info.stdout);
    const infoError = pdfInfoError(parsed);
    if (infoError) throw infoError;
    const {numPages} = parsed;
    if (page > numPages) {
      throw new HostError('PAGE_OUT_OF_RANGE', `Página ${page} fora do intervalo (1–${numPages}).`, {page, numPages});
    }

    const svgPath = path.join(outDir, 'page.svg');
    await runTool(run, [
      tools.pdftocairo, '-svg', '-f', String(page), '-l', String(page), realPath, svgPath,
    ], {
      timeoutMs: limits.convertTimeoutMs,
      maxBuffer: limits.processMaxBuffer,
      label: 'pdftocairo (svg)',
      timeoutCode: 'CONVERT_TIMEOUT',
      failCode: 'CONVERT_FAILED',
    });
    const preview = await readPreviewSvg(svgPath, limits);
    if (preview.svg === null) {
      // SVG excedente não fica para trás; se a remoção falhar, fica 0600.
      await fs.rm(svgPath, {force: true}).catch(() => {});
    }

    const snapshotPrefix = path.join(outDir, 'snapshot');
    const snapshotPath = `${snapshotPrefix}.png`;
    await runTool(run, [
      tools.pdftocairo, '-png', '-r', String(limits.pngDpi), '-f', String(page), '-l', String(page),
      '-singlefile', realPath, snapshotPrefix,
    ], {
      timeoutMs: limits.convertTimeoutMs,
      maxBuffer: limits.processMaxBuffer,
      label: 'pdftocairo (png)',
      timeoutCode: 'CONVERT_TIMEOUT',
      failCode: 'CONVERT_FAILED',
    });
    await assertPng(snapshotPath);
    await fs.chmod(svgPath, 0o600).catch(() => {});
    await fs.chmod(snapshotPath, 0o600);

    keep = true;
    const result = {
      ok: true,
      kind: 'page',
      document: {path: realPath, name: path.basename(realPath)},
      page,
      numPages,
      svg: preview.svg,
      snapshotPath,
      mimeType: 'image/png',
    };
    if (preview.warning) result.previewWarning = preview.warning;
    return result;
  } finally {
    if (!keep) await removeOwnOutputDir(outDir);
  }
}
