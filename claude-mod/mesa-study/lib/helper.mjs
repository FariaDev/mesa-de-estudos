// lib/helper.mjs — ponte única com `host/cli.mjs` (contrato do outro agente).
//
// Chamada: `node <plugin.root>/host/cli.mjs '<json>'` — lista de argumentos,
// sem shell. Nunca montamos string de comando: argv é um array.
//
// Requisições:
//   { op: 'page', path, page, roots, cacheDir }
//   { op: 'capture', cacheDir }
// Respostas:
//   page:    { ok: true, kind: 'page', document: { path, name }, page, numPages,
//              svg (<= 131072 ou null), previewWarning?, snapshotPath,
//              mimeType: 'image/png' }
//   capture: { ok: true, kind: 'capture', snapshotPath, mimeType: 'image/png',
//              capturedAt (ISO), window: { id, app, title }, svg? }
//   erro:    { ok: false, error: { code, message } } com saída != 0.
//
// Validação de resposta (nunca confiar no helper):
// - documento e PNG precisam ser caminhos absolutos; a resposta de página tem
//   de corresponder ao MESMO path/page pedidos (o consumidor canoniza o path
//   com `$.fs.stat({ resolve: true })` antes de pedir);
// - `snapshotPath` precisa estar DENTRO do cacheDir privado (realpath
//   resolvido quando `$.fs.stat` existe), nunca um caminho arbitrário que
//   depois iria ao prompt do modelo;
// - `svg` é preservado inteiro ou recusado; nunca truncado. `previewWarning`
//   do host é preservado para a UI explicar a prévia omitida;
// - captura: `capturedAt` ISO estrito e `window.id` inteiro de janela (1..
//   0xffffffff) — sem isso a captura não vira estado enviável.
//
// Toda falha vira `{ ok: false, error: { code, message } }` legível em
// português; a UI mostra `message`. O helper nunca é reenviado sozinho.
// `$.process.run` é a única API de execução usada; sem ela (falta ou versão
// sem a API) o erro é claro e navegação/calculadora continuam locais.

import { LIMITS } from './session.mjs'
import { isAbsolutePath } from './paths.mjs'

export const SVG_LIMIT = 131_072
export const PAGE_TIMEOUT_MS = 60_000
export const CAPTURE_TIMEOUT_MS = 30_000
const OUT_PARSE_LIMIT = 2_000_000
const TEXT_LIMIT = 500
const META_LIMIT = 300
const WARNING_LIMIT = 1_000
const WINDOW_ID_MAX = 0xffffffff
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function messageOf(err) {
  const m = err && typeof err.message === 'string' ? err.message : String(err)
  return m.slice(0, 300)
}

function fail(code, message) {
  return { ok: false, error: { code: String(code), message: String(message).slice(0, TEXT_LIMIT) } }
}

function failFrom(error) {
  if (error && typeof error === 'object') {
    const code = typeof error.code === 'string' && error.code ? error.code : 'helper-erro'
    const message = typeof error.message === 'string' && error.message ? error.message : 'O helper recusou a operação.'
    return fail(code, message)
  }
  return fail('helper-erro', 'O helper recusou a operação.')
}

function parseJson(text) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > OUT_PARSE_LIMIT) return null
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function tail(text) {
  if (typeof text !== 'string' || !text.trim()) return ''
  return ` Detalhe: ${text.trim().slice(-200)}`
}

function boundedString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
}

/** Normaliza separadores para comparar caminhos POSIX/Windows por prefixo. */
function normalizeSeparators(path) {
  return String(path).replace(/\\/g, '/').replace(/\/+$/, '')
}

/** Algum segmento `.`/`..` (que o prefixo literal não resolveria) no caminho? */
function hasDotSegments(path) {
  return String(path)
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => segment === '.' || segment === '..')
}

/**
 * `candidate` estritamente dentro de `dir` (comparação lexical, sem disco).
 *
 * - os dois lados precisam ser absolutos e não vazios (`dir` vazio não confina
 *   nada e caminho relativo não é comparável por prefixo);
 * - `.`/`..` são recusados: no fallback lexical (sem `$.fs.stat`) eles
 *   escapariam do prefixo. O stat com `resolve` é quem canoniza caminhos;
 *   aqui, na dúvida, a resposta é "fora" (falso negativo seguro);
 * - a raiz POSIX (`/`) aceita qualquer caminho absoluto; a comparação não
 *   expande caixa (quem decide de verdade é o realpath/stat do sistema).
 */
export function isInsideDir(candidate, dir) {
  if (typeof candidate !== 'string' || typeof dir !== 'string') return false
  if (!isAbsolutePath(candidate) || !isAbsolutePath(dir)) return false
  if (hasDotSegments(candidate) || hasDotSegments(dir)) return false
  const cut = normalizeSeparators(dir)
  const own = normalizeSeparators(candidate)
  if (cut === '') return own.startsWith('/') // dir era a raiz POSIX
  return own.startsWith(`${cut}/`)
}

/**
 * O PNG veio do cache privado? Resolve o realpath do cacheDir quando a API
 * existe (symlink do cache, ex. `/tmp` → `/private/tmp`, não invalida o
 * caminho real devolvido pelo host) e, quando possível, o realpath do próprio
 * arquivo (symlink que escaparia do cache é recusado). Sem `$.fs.stat`, a
 * comparação literal com o cacheDir configurado é o melhor que há.
 */
async function snapshotInsideCache($, cfg, snapshotPath) {
  if (!isAbsolutePath(snapshotPath)) return false
  let root = cfg.cacheDir
  let resolvedRoot = false
  if ($ && $.fs && typeof $.fs.stat === 'function') {
    try {
      const stat = await $.fs.stat(cfg.cacheDir, { resolve: true })
      if (stat && typeof stat.realPath === 'string' && stat.realPath) {
        root = stat.realPath
        resolvedRoot = true
      }
    } catch {
      // Cache ainda não existe/ilegível: a comparação literal é o melhor que há.
    }
    if (resolvedRoot) {
      try {
        const own = await $.fs.stat(snapshotPath, { resolve: true })
        if (own && typeof own.realPath === 'string' && own.realPath) {
          return isInsideDir(own.realPath, root)
        }
      } catch {
        // Arquivo ainda não visível para o stat: a checagem lexical decide.
      }
    }
  }
  return isInsideDir(snapshotPath, root)
}

async function validatePage($, cfg, res, request) {
  if (res.kind !== 'page') return fail('page-invalida', 'O helper devolveu um tipo de resposta inesperado.')
  const doc = res.document
  if (!doc || typeof doc !== 'object') return fail('page-invalida', 'O helper não devolveu o documento da página.')
  const docPath = boundedString(doc.path, LIMITS.path)
  const docName = boundedString(doc.name, META_LIMIT)
  if (!docPath || !isAbsolutePath(docPath)) {
    return fail('page-invalida', 'O helper devolveu um documento sem caminho absoluto.')
  }
  if (!docName) return fail('page-invalida', 'O helper devolveu um documento sem nome.')
  if (docPath !== request.path) {
    return fail('page-invalida', 'A resposta do helper não corresponde ao PDF solicitado.')
  }
  if (!Number.isInteger(res.page) || res.page < 1 || res.page > LIMITS.page) {
    return fail('page-invalida', 'O helper devolveu um número de página inválido.')
  }
  if (res.page !== request.page) {
    return fail('page-invalida', 'A resposta do helper não corresponde à página solicitada.')
  }
  if (!Number.isInteger(res.numPages) || res.numPages < res.page || res.numPages > LIMITS.page) {
    return fail('page-invalida', 'O helper devolveu um total de páginas inválido.')
  }
  // `svg` pode vir null quando a prévia estoura o limite do host (o PNG é
  // preservado); string acima do teto continua contrato quebrado — nada de
  // truncar SVG.
  let svg = null
  if (res.svg !== undefined && res.svg !== null) {
    if (typeof res.svg !== 'string' || res.svg.length > SVG_LIMIT) {
      return fail('page-invalida', `A prévia SVG veio inválida ou passou de ${SVG_LIMIT} caracteres.`)
    }
    if (res.svg.length > 0) svg = res.svg
  }
  let previewWarning = null
  if (res.previewWarning !== undefined && res.previewWarning !== null) {
    if (
      typeof res.previewWarning !== 'string' ||
      res.previewWarning.length === 0 ||
      res.previewWarning.length > WARNING_LIMIT
    ) {
      return fail('page-invalida', 'O helper devolveu um aviso de prévia inválido.')
    }
    previewWarning = res.previewWarning
  }
  const snapshotPath = boundedString(res.snapshotPath, LIMITS.path)
  if (!snapshotPath) return fail('page-invalida', 'O helper não devolveu o caminho absoluto do PNG da página.')
  if (!(await snapshotInsideCache($, cfg, snapshotPath))) {
    return fail('page-invalida', 'O PNG da página precisa estar dentro do cache privado do mod.')
  }
  if (res.mimeType !== 'image/png') return fail('page-invalida', 'O helper devolveu um mimeType inesperado para a página.')
  return {
    ok: true,
    kind: 'page',
    document: { path: docPath, name: docName },
    page: res.page,
    numPages: res.numPages,
    svg,
    previewWarning,
    snapshotPath,
    mimeType: 'image/png',
  }
}

async function validateCapture($, cfg, res) {
  if (res.kind !== 'capture') return fail('captura-invalida', 'O helper devolveu um tipo de resposta inesperado.')
  const snapshotPath = boundedString(res.snapshotPath, LIMITS.path)
  if (!snapshotPath) return fail('captura-invalida', 'O helper não devolveu o caminho absoluto da captura.')
  if (!(await snapshotInsideCache($, cfg, snapshotPath))) {
    return fail('captura-invalida', 'A captura precisa estar dentro do cache privado do mod.')
  }
  if (res.mimeType !== 'image/png') return fail('captura-invalida', 'O helper devolveu um mimeType inesperado para a captura.')
  if (
    typeof res.capturedAt !== 'string' ||
    res.capturedAt.length > 40 ||
    !ISO_DATE.test(res.capturedAt) ||
    !Number.isFinite(Date.parse(res.capturedAt))
  ) {
    return fail('captura-invalida', 'O helper devolveu um instante de captura inválido.')
  }
  const win = res.window
  if (!win || typeof win !== 'object') return fail('captura-invalida', 'O helper não devolveu a janela capturada.')
  const rawId =
    typeof win.id === 'string' ? win.id : Number.isInteger(win.id) && typeof win.id === 'number' ? String(win.id) : null
  if (!rawId || !/^\d{1,10}$/.test(rawId) || Number(rawId) < 1 || Number(rawId) > WINDOW_ID_MAX) {
    return fail('captura-invalida', 'O helper devolveu um ID de janela inválido.')
  }
  const app = boundedString(win.app, META_LIMIT)
  const title = typeof win.title === 'string' ? win.title.slice(0, META_LIMIT) : null
  if (app === null || title === null) return fail('captura-invalida', 'O helper devolveu uma janela inválida.')
  const out = {
    ok: true,
    kind: 'capture',
    snapshotPath,
    mimeType: 'image/png',
    capturedAt: res.capturedAt,
    window: { id: rawId, app, title },
  }
  if (res.svg !== undefined) {
    if (typeof res.svg !== 'string' || res.svg.length > SVG_LIMIT) {
      return fail('captura-invalida', `A prévia SVG da captura passou de ${SVG_LIMIT} caracteres.`)
    }
    if (res.svg.length > 0) out.svg = res.svg
  }
  return out
}

async function call($, cfg, payload, timeoutMs) {
  if (!$ || !$.process || typeof $.process.run !== 'function') {
    return fail(
      'helper-indisponivel',
      'A execução local de processos ($.process.run) não está disponível nesta sessão. A navegação e a calculadora continuam locais; ler PDF ou capturar exige essa API.',
    )
  }
  const argv = [cfg.nodePath, `${$.plugin.root}/host/cli.mjs`, JSON.stringify(payload)]
  let result
  try {
    result = await $.process.run(argv, { timeoutMs })
  } catch (err) {
    const detail = messageOf(err)
    const timeout = /time|timed out|timedout/i.test(detail)
    return fail(
      timeout ? 'helper-timeout' : 'helper-execucao',
      timeout
        ? `O helper não respondeu em ${Math.round(timeoutMs / 1000)} s (timeout). Nada foi reenviado automaticamente.`
        : `Não foi possível executar o helper (${cfg.nodePath}): ${detail}`,
    )
  }
  if (!result || typeof result !== 'object') return fail('helper-resultado', 'O helper não devolveu um resultado.')
  const parsed = parseJson(result.stdout) || parseJson(result.stderr)
  const exitCode = typeof result.exitCode === 'number' ? result.exitCode : 1
  if (exitCode !== 0) {
    if (parsed && parsed.ok === false) return failFrom(parsed.error)
    return fail('helper-saida', `O helper terminou com código ${exitCode}.${tail(result.stderr)}`)
  }
  if (!parsed) return fail('helper-json', 'O helper não devolveu JSON válido.')
  if (parsed.ok !== true) return failFrom(parsed.error)
  return payload.op === 'page' ? validatePage($, cfg, parsed, payload) : validateCapture($, cfg, parsed)
}

export function createHelper(config) {
  const cfg = {
    nodePath: config.nodePath,
    cacheDir: config.cacheDir,
  }
  return {
    page($, { path, page, roots }) {
      return call($, cfg, { op: 'page', path, page, roots: [...roots], cacheDir: cfg.cacheDir }, PAGE_TIMEOUT_MS)
    },
    capture($) {
      return call($, cfg, { op: 'capture', cacheDir: cfg.cacheDir }, CAPTURE_TIMEOUT_MS)
    },
  }
}
