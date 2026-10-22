// lib/session.mjs — esquema, limites e persistência da sessão de estudo.
//
// Guarda em `$.store` (chave própria, JSON pequeno): matéria, questão, notas
// opcionais, caminhos de PDF já autorizados pelo usuário e a página ativa.
// Nada de material de curso, captura ou segredo entra aqui: só metadados que o
// usuário digitou/escolheu. O schema é versionado.
//
// Regra de preservação: um store de versão incompatível, de outro formato ou
// com campos corrompidos NÃO é sobrescrito em silêncio — `inspectSession`
// classifica o que veio e `lib/mesa.mjs` bloqueia a escrita até uma ação
// explícita do usuário. Campos válidos de um store v1 são sanitizados; campos
// fora do contrato nunca são copiados para a memória.

export const SESSION_KEY = 'mesa-study.session.v1'
export const SESSION_VERSION = 1

export const LIMITS = {
  subject: 120,
  question: 240,
  notes: 2_000,
  path: 4_096,
  roots: 4,
  docs: 2,
  pdfOptions: 50,
  page: 1_000_000,
}

export function defaultSession() {
  return {
    version: SESSION_VERSION,
    subject: '',
    question: '',
    notes: '',
    pdfPath: '',
    rootsDir: '',
    roots: [],
    docs: [],
    activeDoc: 0,
    updatedAt: 0,
  }
}

function text(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function int(value, min, max) {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0
  if (n < min) return min
  if (n > max) return max
  return n
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

/** Campo presente fora do tipo do contrato; devolve o nome ou null. */
function shapeProblem(raw) {
  if (typeof raw.version !== 'number') return 'version'
  for (const key of ['subject', 'question', 'notes', 'pdfPath', 'rootsDir']) {
    if (hasOwn(raw, key) && typeof raw[key] !== 'string') return key
  }
  if (hasOwn(raw, 'roots') && (!Array.isArray(raw.roots) || raw.roots.some((root) => typeof root !== 'string'))) {
    return 'roots'
  }
  if (
    hasOwn(raw, 'docs') &&
    (!Array.isArray(raw.docs) || raw.docs.some((doc) => !isPlainObject(doc) || typeof doc.path !== 'string'))
  ) {
    return 'docs'
  }
  if (hasOwn(raw, 'activeDoc') && typeof raw.activeDoc !== 'number') return 'activeDoc'
  if (hasOwn(raw, 'updatedAt') && typeof raw.updatedAt !== 'number') return 'updatedAt'
  return null
}

/**
 * Valida/normaliza o que veio do store sem lançar. Devolve `{ session, status,
 * version, problem }`:
 * - `empty`: chave ausente; sessão padrão, escrita liberada;
 * - `ok`: v1 bem formado; campos sanitizados;
 * - `corrupted`: v1 com campo de tipo errado; sessão padrão, escrita bloqueada;
 * - `incompatible`: outro formato/versão; sessão padrão, escrita bloqueada.
 */
export function inspectSession(raw) {
  if (raw === undefined || raw === null) {
    return { session: defaultSession(), status: 'empty', version: null, problem: null }
  }
  if (!isPlainObject(raw)) {
    return { session: defaultSession(), status: 'incompatible', version: null, problem: 'formato' }
  }
  if (raw.version !== SESSION_VERSION) {
    return {
      session: defaultSession(),
      status: 'incompatible',
      version: raw.version === undefined ? null : raw.version,
      problem: 'versão',
    }
  }
  const problem = shapeProblem(raw)
  if (problem) {
    return { session: defaultSession(), status: 'corrupted', version: SESSION_VERSION, problem }
  }
  return { session: sanitizeSession(raw), status: 'ok', version: SESSION_VERSION, problem: null }
}

/**
 * Valida/normaliza o que veio do store. Qualquer campo fora do contrato vira o
 * padrão; o resultado sempre respeita LIMITS. Nunca lança.
 */
export function sanitizeSession(raw) {
  const s = defaultSession()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s
  s.subject = text(raw.subject, LIMITS.subject)
  s.question = text(raw.question, LIMITS.question)
  s.notes = text(raw.notes, LIMITS.notes)
  s.pdfPath = text(raw.pdfPath, LIMITS.path)
  s.rootsDir = text(raw.rootsDir, LIMITS.path)
  if (Array.isArray(raw.roots)) {
    for (const root of raw.roots) {
      if (typeof root !== 'string' || root.length === 0) continue
      const cut = root.slice(0, LIMITS.path)
      if (!s.roots.includes(cut)) s.roots.push(cut)
      if (s.roots.length >= LIMITS.roots) break
    }
  }
  if (Array.isArray(raw.docs)) {
    for (const doc of raw.docs) {
      if (s.docs.length >= LIMITS.docs) break
      if (!doc || typeof doc !== 'object') continue
      const path = text(doc.path, LIMITS.path)
      if (!path) continue
      s.docs.push({
        path,
        name: text(doc.name, 200) || path,
        page: int(doc.page, 1, LIMITS.page),
        numPages: int(doc.numPages, 0, LIMITS.page),
      })
    }
  }
  s.activeDoc = s.docs.length === 0 ? 0 : int(raw.activeDoc, 0, s.docs.length - 1)
  s.updatedAt = int(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  return s
}

/** Só o que vai ao store (sem prévias SVG, sem captura, sem estado de UI). */
export function toStored(session) {
  return {
    version: SESSION_VERSION,
    subject: session.subject,
    question: session.question,
    notes: session.notes,
    pdfPath: session.pdfPath,
    rootsDir: session.rootsDir,
    roots: [...session.roots],
    docs: session.docs.map((doc) => ({
      path: doc.path,
      name: doc.name,
      page: doc.page,
      numPages: doc.numPages,
    })),
    activeDoc: session.activeDoc,
    updatedAt: session.updatedAt,
  }
}

/** Snapshot serializável com o instante desta gravação. */
export function buildStored(session, now = Date.now()) {
  session.updatedAt = now
  return toStored(session)
}

export async function loadSession($) {
  const raw = await $.store.get(SESSION_KEY)
  return inspectSession(raw)
}
