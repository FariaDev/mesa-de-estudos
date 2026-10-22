/* Checkpoint de retomada OPT-IN (--state-file / MESA_STUDY_STATE_FILE).
   Regras do desenho:
   - só existe quando a pessoa pede: sem flag/env, nada é gravado e nenhum
     arquivo é lido além do cache do host (comportamento atual preservado);
   - o arquivo tem de ficar DENTRO do cacheDir privado configurado (filho
     direto, canônico) e terminar em .json; fora dele o startup recusa;
   - o conteúdo é pequeno e só de referências: versão, kind, updatedAt,
     page {path absoluto, page} e note. NUNCA guarda imagem, bytes de página,
     id/caminho de captura, snapshot ou histórico; campo extra desconhecido
     recusa o arquivo inteiro (tamper não injeta nada);
   - gravação atômica: arquivo temporário exclusivo 0600 no MESMO diretório,
     fsync e rename; falha de persistência nunca derruba a operação que deu
     certo (a ferramenta reporta saved:false + erro, sem mentir "salvo");
   - leitura revalida leaf regular e não-symlink, tamanho e UTF-8 (leitura
     LIMITADA de verdade: descritor + maxBytes+1, dev+ino antes/depois), e
     relê a identidade; corrompido/trocado/fora da raiz de estudo é ignorado
     com erro claro, SEM imagem de fallback;
   - retomar NUNCA é automático: o restaurável é só um resumeCandidate;
     nada entra em context.page nem devolve imagem; a retomada de verdade é
     uma nova chamada mesa_page, que refaz as checagens de raiz/arquivo;
   - um --state-file é UM espaço de estudo explícito, não uma sessão: pode ser
     compartilhado por processos do host e não tem isolamento por conversa/
     thread. Sem locks: a última gravação bem-sucedida vence (documentado em
     STATE_CONCURRENCY_NOTE); não fingimos isolamento por sessão. */

import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {HostError} from '../host/errors.mjs';
import {MAX_PATH_CHARS, MAX_PAGE} from '../host/config.mjs';
import {isInsideRoot} from '../host/paths.mjs';
import {ensureCacheDir} from '../host/output.mjs';
import {canonicalizeFrozenPath, inspectRoots} from './checks.mjs';
import {readBoundedFile} from './bounded.mjs';
import {NOTE_MAX} from './state.mjs';

export const MAX_STATE_BYTES = 64 * 1024; // teto do JSON de checkpoint
export const STATE_VERSION = 1;
export const STATE_KIND = 'mesa-study-resume';
export const STATE_EXTENSION = '.json';

export const RESUME_PROVENANCE =
  'Checkpoint de retomada: nenhuma imagem/página/captura é restaurada automaticamente. A retomada só acontece se a pessoa pedir e o modelo chamar mesa_page (que revalida raízes e arquivo de novo) ou mesa_open com filePath.';

export const STATE_CONCURRENCY_NOTE =
  'Um --state-file é UM espaço de estudo explícito, não uma sessão: pode ser compartilhado por mais de um processo do host e não tem isolamento por conversa/thread. Sem locks: a última gravação bem-sucedida vence; a leitura é sempre revalidada e nenhuma imagem/captura é restaurada automaticamente.';

const STATE_REASONS = Object.freeze({
  missing: 'não existe checkpoint ainda.',
  oversize: `o checkpoint excede o teto de ${MAX_STATE_BYTES} bytes.`,
  invalid: 'o checkpoint não tem o formato esperado (versão, campos ou tipos).',
  symlink: 'o caminho do checkpoint é um symlink; ele não é seguido.',
  'not-file': 'o caminho do checkpoint não é um arquivo regular.',
  outside: 'o checkpoint precisa ficar DENTRO do cacheDir configurado (filho direto do cache).',
  'not-json': `o checkpoint precisa terminar em ${STATE_EXTENSION}.`,
  'cache-symlink': 'o cacheDir do checkpoint é um symlink; use um diretório real e privado.',
  'cache-not-directory': 'o cacheDir do checkpoint não é um diretório.',
  io: 'não foi possível ler/gravar o checkpoint.',
  changed: 'o checkpoint mudou de identidade durante a leitura.',
  ready: 'checkpoint pronto.',
});

export function stateReason(state) {
  return STATE_REASONS[state] || `estado inesperado: ${state}.`;
}

export function stateError(state) {
  return {
    code: `STATE_${String(state).toUpperCase().replace(/-/g, '_')}`,
    message: stateReason(state),
  };
}

/* Inspeção SÍNCRONA (startup e doctor): caminho do checkpoint, extensão,
   confinamento no cache canônico e leaf regular (não-symlink). Não lê o
   conteúdo: só lstat/realpath. Estados aceitos no startup: ready/missing; o
   resto é recusa estrutural. */
export function inspectStatePathSync(stateFile, cacheDir, {io = {}} = {}) {
  const lstat = io.lstat || fs.lstatSync;
  const realpath = io.realpath || fs.realpathSync;
  const result = (state, extra = {}) => ({state, ...extra});

  if (typeof stateFile !== 'string' || stateFile === '' || typeof cacheDir !== 'string' || cacheDir === '') {
    return result('io', {canonicalState: null, canonicalCache: null});
  }
  if (path.extname(stateFile).toLowerCase() !== STATE_EXTENSION) {
    return result('not-json', {canonicalState: null, canonicalCache: null});
  }

  let leaf = null;
  try {
    leaf = lstat(cacheDir);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') return result('io', {canonicalState: null, canonicalCache: null});
  }
  if (leaf) {
    if (leaf.isSymbolicLink()) return result('cache-symlink', {canonicalState: null, canonicalCache: null});
    if (!leaf.isDirectory()) return result('cache-not-directory', {canonicalState: null, canonicalCache: null});
  }

  let stateLeaf = null;
  try {
    stateLeaf = lstat(stateFile);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') return result('io', {canonicalState: null, canonicalCache: null});
  }
  if (stateLeaf) {
    if (stateLeaf.isSymbolicLink()) return result('symlink', {canonicalState: null, canonicalCache: null});
    if (!stateLeaf.isFile()) return result('not-file', {canonicalState: null, canonicalCache: null});
  }

  let canonicalCache;
  let canonicalState;
  try {
    canonicalCache = canonicalizeFrozenPath(cacheDir);
    canonicalState = canonicalizeFrozenPath(stateFile);
  } catch {
    return result('io', {canonicalState: null, canonicalCache: null});
  }
  if (path.dirname(canonicalState) !== canonicalCache) {
    return result('outside', {canonicalState, canonicalCache});
  }
  return result(stateLeaf ? 'ready' : 'missing', {canonicalState, canonicalCache});
}

function validateCheckpoint(value) {
  const invalid = (why) => ({ok: false, reason: why});
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('o conteúdo não é um objeto JSON.');

  /* Só os campos conhecidos: qualquer extra (captura, imagem, histórico...)
     recusa o arquivo inteiro em vez de ser silenciosamente ignorado. */
  const allowed = new Set(['version', 'kind', 'updatedAt', 'page', 'note']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return invalid(`campo não permitido: ${key}.`);
  }
  if (value.version !== STATE_VERSION || value.kind !== STATE_KIND) {
    return invalid(`versão/kind inesperados (esperado ${STATE_VERSION}/${STATE_KIND}).`);
  }
  if (typeof value.updatedAt !== 'string' || value.updatedAt.length > 40 || Number.isNaN(Date.parse(value.updatedAt))) {
    return invalid('updatedAt ausente ou inválido.');
  }
  if (value.note !== null && value.note !== undefined) {
    if (typeof value.note !== 'string' || value.note.length > NOTE_MAX) return invalid('note inválida.');
  }
  let page = null;
  if (value.page !== null && value.page !== undefined) {
    const entry = value.page;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return invalid('page inválida.');
    for (const key of Object.keys(entry)) {
      if (key !== 'path' && key !== 'page') return invalid(`campo não permitido em page: ${key}.`);
    }
    if (typeof entry.path !== 'string' || !path.isAbsolute(entry.path) || entry.path.length > MAX_PATH_CHARS) {
      return invalid('page.path precisa ser caminho absoluto dentro do limite.');
    }
    if (!Number.isInteger(entry.page) || entry.page < 1 || entry.page > MAX_PAGE) {
      return invalid('page.page precisa ser um inteiro entre 1 e o teto.');
    }
    page = Object.freeze({path: entry.path, page: entry.page});
  }
  return {
    ok: true,
    checkpoint: Object.freeze({
      updatedAt: value.updatedAt,
      page,
      note: typeof value.note === 'string' ? value.note : null,
    }),
  };
}

/* Leitura revalidada. Nunca lança por conteúdo; devolve {state, checkpoint?,
   error?}. `state:'ready'` só com checkpoint íntegro. A leitura é limitada
   por descritor (maxBytes+1) e confere dev+ino na abertura e ao final; o
   canônico do arquivo precisa continuar igual ao inspecionado antes de ler. */
export async function loadCheckpoint({stateFile, cacheDir, io = {}} = {}) {
  const inspected = inspectStatePathSync(stateFile, cacheDir, {io});
  if (inspected.state !== 'ready' && inspected.state !== 'missing') {
    return {state: inspected.state, checkpoint: null, error: stateError(inspected.state)};
  }
  if (inspected.state === 'missing') return {state: 'missing', checkpoint: null};

  const bounded = await readBoundedFile(stateFile, {
    maxBytes: MAX_STATE_BYTES,
    allowCanonical:
      typeof inspected.canonicalState === 'string' && inspected.canonicalState !== ''
        ? (real) => real === inspected.canonicalState
        : null,
    io,
  });
  if (bounded.state === 'missing') return {state: 'missing', checkpoint: null};
  if (bounded.state !== 'ready') {
    return {state: bounded.state, checkpoint: null, error: stateError(bounded.state)};
  }

  let parsed = null;
  try {
    parsed = JSON.parse(bounded.buffer.toString('utf8'));
  } catch {
    return {state: 'invalid', checkpoint: null, error: stateError('invalid')};
  }
  const validated = validateCheckpoint(parsed);
  if (!validated.ok) {
    return {
      state: 'invalid',
      checkpoint: null,
      error: {code: stateError('invalid').code, message: `${stateError('invalid').message} (${validated.reason})`},
    };
  }
  return {state: 'ready', checkpoint: validated.checkpoint};
}

function boundedNote(note) {
  if (typeof note !== 'string' || note === '') return null;
  return note.slice(0, NOTE_MAX);
}

/* Gravação atômica 0600 (temp exclusivo no mesmo diretório + fsync + rename).
   Lança HostError; quem chama decide como reportar sem derrubar a operação
   principal. Cria o cacheDir 0700 no primeiro uso, como as demais escritas. */
export async function saveCheckpoint({stateFile, cacheDir, page = null, note = null, now = () => new Date()} = {}) {
  const realCache = await ensureCacheDir(cacheDir);
  const inspected = inspectStatePathSync(stateFile, realCache);
  if (inspected.state !== 'ready' && inspected.state !== 'missing') {
    throw new HostError(stateError(inspected.state).code, `Checkpoint não gravado: ${stateReason(inspected.state)}`);
  }

  let pageRef = null;
  if (page && typeof page === 'object') {
    pageRef = {
      path: typeof page.path === 'string' ? page.path.slice(0, MAX_PATH_CHARS) : null,
      page: Number.isInteger(page.page) ? page.page : null,
    };
    if (!pageRef.path || !path.isAbsolute(pageRef.path) || !pageRef.page || pageRef.page < 1 || pageRef.page > MAX_PAGE) {
      throw new HostError('STATE_INVALID', 'Checkpoint não gravado: página ativa inválida.');
    }
  }

  const payload = {
    version: STATE_VERSION,
    kind: STATE_KIND,
    updatedAt: new Date(now()).toISOString(),
    page: pageRef ? {path: pageRef.path, page: pageRef.page} : null,
    note: boundedNote(note),
  };
  const buffer = Buffer.from(`${JSON.stringify(payload)}\n`, 'utf8');
  if (buffer.length > MAX_STATE_BYTES) {
    throw new HostError('STATE_TOO_LARGE', `Checkpoint não gravado: excede ${MAX_STATE_BYTES} bytes.`);
  }

  const dir = path.dirname(stateFile);
  const tmp = path.join(dir, `.${path.basename(stateFile)}.${randomBytes(8).toString('hex')}.tmp`);
  let handle = null;
  try {
    handle = await fsp.open(tmp, 'wx', 0o600);
    await handle.writeFile(buffer);
    await handle.sync();
    await handle.close();
    handle = null;
    await fsp.rename(tmp, stateFile);
    await fsp.chmod(stateFile, 0o600).catch(() => {});
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fsp.rm(tmp, {force: true}).catch(() => {});
    if (error instanceof HostError) throw error;
    throw new HostError('STATE_WRITE_FAILED', 'Checkpoint não gravado: falha de escrita no cacheDir.');
  }
  return {ok: true, path: inspected.canonicalState, savedAt: payload.updatedAt, bytes: buffer.length};
}

/* Remoção explícita do checkpoint (action=clear). Nunca segue symlink e nunca
   toca em outro arquivo do cache. */
export async function clearCheckpoint({stateFile, cacheDir} = {}) {
  const inspected = inspectStatePathSync(stateFile, cacheDir);
  if (inspected.state === 'missing') return {ok: true, removed: false};
  if (inspected.state !== 'ready') {
    throw new HostError(stateError(inspected.state).code, `Checkpoint não removido: ${stateReason(inspected.state)}`);
  }
  try {
    await fsp.rm(stateFile, {force: true});
  } catch {
    throw new HostError('STATE_WRITE_FAILED', 'Checkpoint não removido: falha de escrita no cacheDir.');
  }
  return {ok: true, removed: true};
}

/* Avalia o checkpoint contra as raízes CONGELADAS atuais, somente leitura:
   - nenhuma imagem é lida/devolvida; só path/page/note/updatedAt;
   - o caminho é NORMALIZADO (path.resolve) e confinado lexicalmente primeiro;
     depois o realpath é resolvido e confinado de novo ANTES de qualquer
     lstat/classificação: `..` textual e symlink de diretório que escapa da
     raiz devolvem `outside-roots` sem tocar metadados de caminho externo;
   - o documento precisa ser arquivo regular não-symlink e ter .pdf; o
     `document.path/name` e a extensão saem do caminho RESOLVIDO;
   - devolve `available:false` com `reason` específico em vez de instruir uma
     retomada que mesa_page recusaria. */
export async function evaluateCandidate({
  checkpoint,
  roots,
  lstat = null,
  realpath = null,
  io = {},
} = {}) {
  const lstatFn = typeof lstat === 'function' ? lstat : io.lstat || fsp.lstat;
  const realpathFn = typeof realpath === 'function' ? realpath : io.realpath || fsp.realpath;

  if (!checkpoint || typeof checkpoint !== 'object') return null;
  const base = {
    updatedAt: checkpoint.updatedAt,
    note: checkpoint.note ?? null,
  };
  if (!checkpoint.page) {
    return {...base, available: false, reason: 'no-page', document: null, page: null, provenance: RESUME_PROVENANCE};
  }
  const declaredPath = checkpoint.page.path;
  const lexicalPath = path.resolve(declaredPath);
  const lexicalDocument = {path: lexicalPath, name: path.basename(lexicalPath)};
  const basePage = {...base, document: lexicalDocument, page: checkpoint.page.page, provenance: RESUME_PROVENANCE};

  const state = inspectRoots(roots);
  if (state.valid.length === 0) {
    let reason = 'roots-missing';
    if (state.changed.length > 0) reason = 'roots-changed';
    else if (state.notDirectory.length > 0) reason = 'roots-not-directory';
    return {...basePage, available: false, reason};
  }
  /* 1) Confinamento LEXICAL, sem IO: `..` textual nem chega ao filesystem. */
  if (!state.valid.some((root) => isInsideRoot(lexicalPath, root))) {
    return {...basePage, available: false, reason: 'outside-roots'};
  }
  /* 2) Identidade REAL: symlink no meio do caminho que escapa da raiz também
     é recusado ANTES de qualquer lstat/classificação. */
  let realPath = null;
  try {
    realPath = await realpathFn(lexicalPath);
  } catch {
    return {...basePage, available: false, reason: 'path-missing'};
  }
  const resolvedDocument = {path: realPath, name: path.basename(realPath)};
  const resolvedPage = {...base, document: resolvedDocument, page: checkpoint.page.page, provenance: RESUME_PROVENANCE};
  if (!state.valid.some((root) => isInsideRoot(realPath, root))) {
    return {...resolvedPage, available: false, reason: 'outside-roots'};
  }
  /* 3) Classificação somente do caminho já confinado. */
  let leaf = null;
  try {
    leaf = await lstatFn(realPath);
  } catch {
    return {...resolvedPage, available: false, reason: 'path-missing'};
  }
  if (leaf.isSymbolicLink() || !leaf.isFile()) {
    return {...resolvedPage, available: false, reason: 'path-invalid'};
  }
  if (path.extname(realPath).toLowerCase() !== '.pdf') {
    return {...resolvedPage, available: false, reason: 'not-pdf'};
  }
  return {...resolvedPage, available: true, reason: 'ready'};
}
