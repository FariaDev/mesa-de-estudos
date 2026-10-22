/* Verificações SOMENTE LEITURA do servidor:
   - prontidão do status (CONFIGURADO no startup ≠ DISPONÍVEL agora);
   - identidade das raízes congeladas antes de autorizar uma página.
   Nada aqui cria, altera, abre ou remove arquivo: só lstat/stat/realpath/
   access. O status nunca muta o cache e a autorização nunca chama o host com
   uma raiz que mudou de identidade depois do startup. */

import path from 'node:path';
import fs from 'node:fs';
import {HostError} from '../host/errors.mjs';

/* Congela um caminho no valor canônico: realpath quando existe; quando ainda
   não existe, antecipa o canônico do ancestral existente mais próximo (ex.:
   /tmp -> /private/tmp no macOS), para que a identidade congelada seja
   comparável quando o caminho existir. Um alvo NOVO com o mesmo caminho só
   vale se depois o realpath bater com o congelado; symlink criado apontando
   para outro lugar continua sendo outra identidade. */
export function canonicalizeFrozenPath(target) {
  const resolved = path.resolve(target);
  try {
    return fs.realpathSync(resolved);
  } catch {
    // não existe (ou inacessível): antecipa o canônico do ancestral existente
  }
  let current = resolved;
  const tail = [];
  for (;;) {
    const parent = path.dirname(current);
    if (parent === current) return resolved;
    tail.unshift(path.basename(current));
    current = parent;
    try {
      return path.join(fs.realpathSync(current), ...tail);
    } catch {
      // ancestral também ausente/inacessível: segue subindo
    }
  }
}

const ROOT_CHANGED_MESSAGE =
  'A raiz autorizada mudou depois da inicialização: o caminho real de agora difere do canônico congelado no startup, então o novo alvo não é autorizado. Reinicie o servidor com --root se a mudança foi intencional.';

const ROOT_NOT_DIRECTORY_MESSAGE =
  'A raiz autorizada existe, mas não é um diretório; a leitura de PDF precisa de uma pasta. Ajuste --root para a pasta correta e reinicie o servidor.';

/* Classifica cada raiz congelada em válida/ausente/trocada/não-diretório.
   - válida: realpath atual é EXATAMENTE o caminho canônico congelado e é dir;
   - ausente: não resolve (igual ao host, que pula raiz ausente);
   - trocada: resolve, mas para outro caminho (symlink novo/alvo substituído);
   - não-diretório: resolve para o mesmo caminho, mas é arquivo (ou outro). */
export function inspectRoots(roots, {realpath = fs.realpathSync, stat = fs.statSync} = {}) {
  const valid = [];
  const missing = [];
  const changed = [];
  const notDirectory = [];
  for (const frozen of Array.isArray(roots) ? roots : []) {
    let current;
    try {
      current = realpath(frozen);
    } catch {
      missing.push(frozen);
      continue;
    }
    if (current !== frozen) {
      changed.push({frozen, current});
      continue;
    }
    let info;
    try {
      info = stat(current);
    } catch {
      missing.push(frozen);
      continue;
    }
    if (!info.isDirectory()) {
      notDirectory.push(frozen);
      continue;
    }
    valid.push(frozen);
  }
  return {valid, missing, changed, notDirectory};
}

/* Raízes que a operação de página pode entregar ao host:
   - raízes válidas continuam autorizando;
   - raízes ausentes são ignoradas quando há alguma válida (mesma semântica do
     host), mas NUNCA são repassadas quando não há nenhuma: além de falhar
     ROOT_NOT_FOUND, isso fecha a janela TOCTOU em que a pasta ausente
     apareceria como symlink entre a verificação e o host;
   - raiz trocada nunca é repassada (o host reavaliaria o realpath e
     autorizaria o alvo novo); sem nenhuma válida, falha ROOT_CHANGED;
   - raiz que virou arquivo falha ROOT_NOT_DIRECTORY. */
export function rootsForPageOperation(roots, deps) {
  const state = inspectRoots(roots, deps);
  if (state.valid.length > 0) return state.valid;
  if (state.changed.length > 0) {
    throw new HostError('ROOT_CHANGED', ROOT_CHANGED_MESSAGE, {
      roots: state.changed.map((entry) => entry.frozen),
    });
  }
  if (state.notDirectory.length > 0) {
    throw new HostError('ROOT_NOT_DIRECTORY', ROOT_NOT_DIRECTORY_MESSAGE, {roots: [...state.notDirectory]});
  }
  if (state.missing.length === 0) return [];
  throw new HostError(
    'ROOT_NOT_FOUND',
    state.missing.length === 1
      ? `Diretório autorizado não existe: ${state.missing[0]}.`
      : `Nenhum diretório autorizado existe (${state.missing.length} roots ausentes).`,
    {roots: [...state.missing]},
  );
}

/* Prontidão do cacheDir sem criar nada. Espelha as regras do host
   (ensureCacheDir): leaf symlink recusado; leaf precisa ser diretório do
   próprio usuário sem escrita por grupo/outros; ausente é "criável" quando o
   ancestral existente mais próximo é um diretório gravável — o host cria
   0700 no primeiro uso. Estados: null (não configurado), 'ready',
   'absent-creatable', 'symlink', 'not-directory', 'not-owned', 'permissions',
   'io'. */
export function inspectCacheDir(
  cacheDir,
  {lstat = fs.lstatSync, stat = fs.statSync, realpath = fs.realpathSync, access = fs.accessSync,
    getuid = typeof process.getuid === 'function' ? () => process.getuid() : null} = {},
) {
  if (typeof cacheDir !== 'string' || cacheDir === '') return {available: false, state: null};
  let leaf = null;
  try {
    leaf = lstat(cacheDir);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') return {available: false, state: 'io'};
  }
  if (leaf) {
    if (leaf.isSymbolicLink()) return {available: false, state: 'symlink'};
    if (!leaf.isDirectory()) return {available: false, state: 'not-directory'};
    if (getuid && typeof leaf.uid === 'number' && leaf.uid !== getuid()) return {available: false, state: 'not-owned'};
    if ((leaf.mode & 0o022) !== 0) return {available: false, state: 'permissions'};
    try {
      realpath(cacheDir);
    } catch {
      return {available: false, state: 'io'};
    }
    return {available: true, state: 'ready'};
  }
  let current = cacheDir;
  for (;;) {
    let info = null;
    try {
      info = lstat(current);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') return {available: false, state: 'io'};
    }
    if (info) {
      let ancestor = current;
      if (info.isSymbolicLink()) {
        try {
          ancestor = realpath(current);
        } catch {
          return {available: false, state: 'io'};
        }
      }
      let ancestorStat;
      try {
        ancestorStat = stat(ancestor);
      } catch {
        return {available: false, state: 'io'};
      }
      if (!ancestorStat.isDirectory()) return {available: false, state: 'not-directory'};
      try {
        access(ancestor, fs.constants.W_OK);
      } catch {
        return {available: false, state: 'permissions'};
      }
      return {available: true, state: 'absent-creatable'};
    }
    const parent = path.dirname(current);
    if (parent === current) return {available: false, state: 'io'};
    current = parent;
  }
}
