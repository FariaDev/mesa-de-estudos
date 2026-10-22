/* Perfil de estudo (tutor/learner) declarado na INICIALIZAÇÃO.
   Regras do desenho:
   - os caminhos vêm SOMENTE de --tutor-file/--learner-file (ou das envs
     MESA_STUDY_TUTOR_FILE/MESA_STUDY_LEARNER_FILE) e são congelados no
     canônico do startup; nenhuma chamada MCP escolhe arquivo de perfil;
   - diretório NÃO é varrido: o alvo tem de ser um arquivo regular;
   - symlink (leaf), não-arquivo, acima do teto e conteúdo não-UTF8 são
     recusados; no startup a recusa é STARTUP_INVALID (o processo nem abre o
     protocolo), e na leitura vira um estado de erro SEM corpo;
   - a leitura de conteúdo só acontece em mesa_context (texto+metadados) e em
     mesa_status (configurado/disponível/erro, SEM corpo); nenhum conteúdo de
     perfil entra em log;
   - a identidade congelada é revalidada a cada leitura (leaf regular e não
     symlink, realpath igual ao canônico do startup, teto de bytes e UTF-8);
     troca depois do startup vira erro claro em vez de ler outro arquivo;
   - a leitura é LIMITADA de verdade (bounded.mjs: descritor + maxBytes+1) e
     confere dev+ino antes/depois; arquivo que cresce na corrida vira
     `oversize` e troca de identidade vira `changed`, ambos SEM corpo;
   - no runtime o canônico congelado é conferido ANTES de ler o conteúdo. */

import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';
import {HostError} from '../host/errors.mjs';
import {canonicalizeFrozenPath} from './checks.mjs';
import {readBoundedFile, readBoundedFileSync} from './bounded.mjs';

export const MAX_PROFILE_BYTES = 64 * 1024; // 64 KiB por perfil (tutor/learner)
export const PROFILE_ROLES = Object.freeze(['tutor', 'learner']);

/* Estados possíveis de um arquivo de perfil. 'ready' e 'missing' são aceitos
   pelo startup; o resto é recusa estrutural. */
export const PROFILE_STATES = Object.freeze([
  'ready',
  'missing',
  'symlink',
  'not-file',
  'oversize',
  'encoding',
  'changed',
  'io',
]);

const PROFILE_REASONS = Object.freeze({
  symlink: 'o caminho é um symlink; use o arquivo regular.',
  'not-file': 'o caminho não é um arquivo regular (diretórios não são varridos).',
  oversize: `o arquivo excede o teto de ${MAX_PROFILE_BYTES} bytes.`,
  encoding: 'o conteúdo não é UTF-8 válido.',
  changed: 'a identidade do arquivo mudou depois da inicialização (realpath difere do canônico congelado).',
  io: 'não foi possível ler o arquivo.',
  missing: 'o arquivo ainda não existe.',
  ready: 'o arquivo está pronto.',
});

export function profileReason(state) {
  return PROFILE_REASONS[state] || `estado inesperado: ${state}.`;
}

export function profileError(state) {
  return {
    code: `PROFILE_${String(state).toUpperCase().replace(/-/g, '_')}`,
    message: profileReason(state),
  };
}

/* Classificação sem IO do leaf (lstat): usado no startup e na leitura. */
export function classifyProfileLeaf(leaf, {maxBytes = MAX_PROFILE_BYTES} = {}) {
  if (!leaf || typeof leaf.isSymbolicLink !== 'function') return 'io';
  if (leaf.isSymbolicLink()) return 'symlink';
  if (!leaf.isFile()) return 'not-file';
  if (typeof leaf.size === 'number' && leaf.size > maxBytes) return 'oversize';
  return 'ready';
}

function decodeProfileBuffer(buffer, {maxBytes = MAX_PROFILE_BYTES} = {}) {
  if (buffer.length > maxBytes) return {state: 'oversize'};
  try {
    return {state: 'ready', text: new TextDecoder('utf-8', {fatal: true}).decode(buffer)};
  } catch {
    return {state: 'encoding'};
  }
}

/* Validação SÍNCRONA do startup (e do doctor, que só lê). Nunca devolve
   conteúdo; devolve {state, canonical?, bytes?}. Não lança: o chamador decide
   como recusar. `io` existe para o diagnóstico injetar IO determinístico. */
export function inspectProfilePathSync(filePath, {maxBytes = MAX_PROFILE_BYTES, io = {}} = {}) {
  const bounded = readBoundedFileSync(filePath, {maxBytes, io});
  if (bounded.state === 'missing') {
    return {state: 'missing', canonical: canonicalizeFrozenPath(filePath)};
  }
  if (bounded.state !== 'ready') return {state: bounded.state, canonical: null};
  const decoded = decodeProfileBuffer(bounded.buffer, {maxBytes});
  if (decoded.state !== 'ready') return {state: decoded.state, canonical: null};
  return {state: 'ready', canonical: bounded.canonical, bytes: bounded.buffer.length};
}

/* Leitura em runtime: revalida a identidade congelada e devolve texto +
   metadados de origem, ou um estado de erro SEM corpo. Nunca lança por
   problema do arquivo (só por programação); nunca lê diretório, nunca segue
   leaf symlink fora da identidade congelada e nunca lê conteúdo de um alvo
   que já não é o canônico do startup. */
export async function readProfile({
  role,
  filePath,
  canonical = null,
  source = 'flag',
  maxBytes = MAX_PROFILE_BYTES,
  io = {},
} = {}) {
  const base = {configured: true, role, source, path: filePath};
  const frozen = typeof canonical === 'string' && canonical !== '' ? canonical : null;
  const bounded = await readBoundedFile(filePath, {
    maxBytes,
    allowCanonical: frozen ? (real) => real === frozen : null,
    io,
  });
  if (bounded.state !== 'ready') {
    /* missing/symlink/not-file/oversize/changed/io: erro claro, sem corpo. */
    return {...base, available: false, state: bounded.state, error: profileError(bounded.state)};
  }
  const decoded = decodeProfileBuffer(bounded.buffer, {maxBytes});
  if (decoded.state !== 'ready') {
    return {...base, available: false, state: decoded.state, error: profileError(decoded.state)};
  }
  return {
    ...base,
    available: true,
    state: 'ready',
    path: bounded.canonical,
    bytes: bounded.buffer.length,
    sha256: createHash('sha256').update(bounded.buffer).digest('hex'),
    updatedAt:
      bounded.identity && typeof bounded.identity.mtimeMs === 'number'
        ? new Date(bounded.identity.mtimeMs).toISOString()
        : null,
    text: decoded.text,
  };
}
