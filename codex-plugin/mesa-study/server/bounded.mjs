/* Leitura LIMITADA de arquivo regular com identidade revalidada.
   Regras do desenho:
   - o teto é um teto DE VERDADE: lê no máximo maxBytes+1 via descritor, então
     um arquivo que cresce depois do lstat (ou um alvo de symlink) nunca é
     carregado inteiro antes da recusa `oversize`;
   - O_NOFOLLOW no leaf quando a plataforma expõe a flag: symlink aberto na
     janela lstat→open vira `symlink` em vez de seguir o alvo;
   - dev+ino do lstat, do fstat pós-open e do lstat final precisam bater; troca
     de arquivo/caminho na janela vira `changed` sem devolver corpo (fallback
     honesto onde O_NOFOLLOW não existe);
   - o canônico (realpath) é resolvido ANTES do conteúdo; `allowCanonical`
     permite recusar um caminho que já não é a identidade congelada sem ler
     byte algum;
   - o descritor é sempre fechado e nenhuma função lança por problema do
     arquivo: devolve {state, ...} para o chamador decidir.
   O que NÃO se promete: fechar toda corrida global de filesystem em Node
   portátil (sem openat/O_NOFOLLOW relativo a descritor de diretório); as
   garantias efetivas são as acima. */

import fs from 'node:fs';
import fsp from 'node:fs/promises';

/* O_NOFOLLOW não existe no Windows; 0 mantém o open válido e a revalidação
   dev+ino continua recusando as trocas comuns. */
const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;

export const BOUNDED_STATES = Object.freeze([
  'ready',
  'missing',
  'symlink',
  'not-file',
  'oversize',
  'changed',
  'io',
]);

function isMissing(error) {
  return !!error && error.code === 'ENOENT';
}

function isSymlinkOpenError(error) {
  return !!error && (error.code === 'ELOOP' || error.code === 'EMLINK');
}

function sameIdentity(a, b) {
  return !!a && !!b && a.dev === b.dev && a.ino === b.ino;
}

function identityOf(stat) {
  return {
    dev: typeof stat.dev === 'number' ? stat.dev : null,
    ino: typeof stat.ino === 'number' ? stat.ino : null,
    size: typeof stat.size === 'number' ? stat.size : null,
    mtimeMs: typeof stat.mtimeMs === 'number' ? stat.mtimeMs : null,
  };
}

/* Leitura SÍNCRONA limitada (startup e doctor). `io` permite injetar
   lstat/realpath/open/fstat/read/close determinísticos em teste. */
export function readBoundedFileSync(filePath, {maxBytes, allowCanonical = null, io = {}} = {}) {
  if (typeof filePath !== 'string' || filePath === '' || !Number.isInteger(maxBytes) || maxBytes < 1) {
    return {state: 'io'};
  }
  const lstat = io.lstat || fs.lstatSync;
  const realpath = io.realpath || fs.realpathSync;
  const open = io.open || fs.openSync;
  const fstat = io.fstat || fs.fstatSync;
  const read = io.read || fs.readSync;
  const close = io.close || fs.closeSync;

  let before;
  try {
    before = lstat(filePath);
  } catch (error) {
    return {state: isMissing(error) ? 'missing' : 'io'};
  }
  if (!before || typeof before.isSymbolicLink !== 'function') return {state: 'io'};
  if (before.isSymbolicLink()) return {state: 'symlink'};
  if (!before.isFile()) return {state: 'not-file'};
  if (typeof before.size === 'number' && before.size > maxBytes) return {state: 'oversize'};

  let canonical;
  try {
    canonical = realpath(filePath);
  } catch (error) {
    return {state: isMissing(error) ? 'missing' : 'io'};
  }
  if (typeof allowCanonical === 'function' && !allowCanonical(canonical)) {
    return {state: 'changed', canonical};
  }

  let fd = null;
  try {
    try {
      fd = open(filePath, fs.constants.O_RDONLY | O_NOFOLLOW);
    } catch (error) {
      if (isMissing(error)) return {state: 'missing'};
      if (isSymlinkOpenError(error)) return {state: 'symlink'};
      return {state: 'io'};
    }
    const opened = fstat(fd);
    if (!opened || typeof opened.isFile !== 'function' || !opened.isFile()) return {state: 'not-file'};
    if (!sameIdentity(before, opened)) return {state: 'changed'};
    if (typeof opened.size === 'number' && opened.size > maxBytes) return {state: 'oversize'};

    const buffer = Buffer.allocUnsafe(maxBytes + 1);
    let total = 0;
    while (total < buffer.length) {
      const result = read(fd, buffer, total, buffer.length - total, total);
      const bytesRead = typeof result === 'number' ? result : (result && result.bytesRead) || 0;
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maxBytes) return {state: 'oversize'};

    const after = fstat(fd);
    if (!sameIdentity(opened, after)) return {state: 'changed'};

    /* O caminho precisa continuar sendo o MESMO arquivo aberto: leaf que virou
       symlink/outro inode durante a leitura não vira conteúdo. */
    let finalLeaf;
    try {
      finalLeaf = lstat(filePath);
    } catch {
      return {state: 'changed'};
    }
    if (!finalLeaf || finalLeaf.isSymbolicLink() || !sameIdentity(opened, finalLeaf)) {
      return {state: 'changed'};
    }
    /* O canônico também é revalidado no fim: se o caminho apontava para outro
       lugar na primeira resolução e voltou a ser o arquivo lido, a identidade
       congelada NÃO pode ser o destino intermediário da corrida. */
    let finalCanonical;
    try {
      finalCanonical = realpath(filePath);
    } catch {
      return {state: 'changed'};
    }
    if (finalCanonical !== canonical) return {state: 'changed', canonical: finalCanonical};
    return {state: 'ready', canonical, buffer: buffer.subarray(0, total), identity: identityOf(opened)};
  } catch {
    return {state: 'io'};
  } finally {
    if (fd !== null) {
      try {
        close(fd);
      } catch {
        // fechamento best-effort: o resultado já foi decidido
      }
    }
  }
}

/* Leitura ASSÍNCRONA limitada (runtime). `io.open` devolve um handle com
   stat/read/close (FileHandle real por padrão). */
export async function readBoundedFile(filePath, {maxBytes, allowCanonical = null, io = {}} = {}) {
  if (typeof filePath !== 'string' || filePath === '' || !Number.isInteger(maxBytes) || maxBytes < 1) {
    return {state: 'io'};
  }
  const lstat = io.lstat || fsp.lstat;
  const realpath = io.realpath || fsp.realpath;
  const open = io.open || fsp.open;

  let before;
  try {
    before = await lstat(filePath);
  } catch (error) {
    return {state: isMissing(error) ? 'missing' : 'io'};
  }
  if (!before || typeof before.isSymbolicLink !== 'function') return {state: 'io'};
  if (before.isSymbolicLink()) return {state: 'symlink'};
  if (!before.isFile()) return {state: 'not-file'};
  if (typeof before.size === 'number' && before.size > maxBytes) return {state: 'oversize'};

  let canonical;
  try {
    canonical = await realpath(filePath);
  } catch (error) {
    return {state: isMissing(error) ? 'missing' : 'io'};
  }
  if (typeof allowCanonical === 'function' && !allowCanonical(canonical)) {
    return {state: 'changed', canonical};
  }

  let handle = null;
  try {
    try {
      handle = await open(filePath, fs.constants.O_RDONLY | O_NOFOLLOW);
    } catch (error) {
      if (isMissing(error)) return {state: 'missing'};
      if (isSymlinkOpenError(error)) return {state: 'symlink'};
      return {state: 'io'};
    }
    const opened = await handle.stat();
    if (!opened || typeof opened.isFile !== 'function' || !opened.isFile()) return {state: 'not-file'};
    if (!sameIdentity(before, opened)) return {state: 'changed'};
    if (typeof opened.size === 'number' && opened.size > maxBytes) return {state: 'oversize'};

    const buffer = Buffer.allocUnsafe(maxBytes + 1);
    let total = 0;
    while (total < buffer.length) {
      const result = await handle.read(buffer, total, buffer.length - total, total);
      const bytesRead = result && typeof result.bytesRead === 'number' ? result.bytesRead : 0;
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maxBytes) return {state: 'oversize'};

    const after = await handle.stat();
    if (!sameIdentity(opened, after)) return {state: 'changed'};

    let finalLeaf;
    try {
      finalLeaf = await lstat(filePath);
    } catch {
      return {state: 'changed'};
    }
    if (!finalLeaf || finalLeaf.isSymbolicLink() || !sameIdentity(opened, finalLeaf)) {
      return {state: 'changed'};
    }
    let finalCanonical;
    try {
      finalCanonical = await realpath(filePath);
    } catch {
      return {state: 'changed'};
    }
    if (finalCanonical !== canonical) return {state: 'changed', canonical: finalCanonical};
    return {state: 'ready', canonical, buffer: buffer.subarray(0, total), identity: identityOf(opened)};
  } catch {
    return {state: 'io'};
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // fechamento best-effort: o resultado já foi decidido
      }
    }
  }
}
