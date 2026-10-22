// lib/paths.mjs — manipulação de caminho por string.
//
// O ambiente de hooks não tem Node (sem `path`, `process`, `fs`) nem DOM.
// Estas funções só usam string; servem para montar o JSON do helper e para
// exibir nomes de arquivo. Nada aqui lê ou escreve no disco.

/** Caminho absoluto POSIX (`/x`), Windows (`C:\x`, `C:/x`) ou UNC (`\\host`). */
export function isAbsolutePath(p) {
  if (typeof p !== 'string' || p.length === 0) return false
  if (p[0] === '/' || p[0] === '\\') return true
  return /^[A-Za-z]:[\\/]/.test(p)
}

function lastSeparator(p) {
  return Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
}

/** Diretório do caminho; `.` quando não há separador. */
export function dirname(p) {
  const i = lastSeparator(p)
  if (i < 0) return '.'
  if (i === 0) return p.slice(0, 1)
  const head = p.slice(0, i)
  // `C:` sozinho não é raiz; a raiz é `C:\`.
  return /^[A-Za-z]:$/.test(head) ? head + p[i] : head
}

/** Último componente do caminho. */
export function basename(p) {
  const i = lastSeparator(p)
  return i < 0 ? p : p.slice(i + 1)
}

/** Remove separadores no fim, preservando a raiz (`/`, `C:\`). */
export function stripTrailingSeparators(p) {
  const cut = p.replace(/[\\/]+$/, '')
  if (cut.length > 0) return cut
  return p.slice(0, 1)
}

/** Junta diretório e nome mantendo o estilo do diretório. */
export function joinPath(dir, name) {
  const base = stripTrailingSeparators(dir)
  const sep = base.includes('\\') && !base.includes('/') ? '\\' : '/'
  return `${base}${sep}${name}`
}
