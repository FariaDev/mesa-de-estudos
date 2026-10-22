/* Biblioteca de PDFs SOMENTE LEITURA das raízes congeladas na inicialização.
   Regras do desenho:
   - varredura em FLUXO (opendir + read, entrada a entrada), limitada de
     verdade: teto de arquivos (200), teto de entradas LIDAS/examinadas (4000)
     e profundidade finita (6 diretórios abaixo da raiz), todos explícitos em
     LIBRARY_LIMITS; nada de `readdir` integral e nada de ordenar o diretório
     inteiro antes de cortar. `truncated` diz que a lista pode estar
     incompleta — nunca finge varredura completa;
   - quando há truncamento, o SUBCONJUNTO devolvido depende da ordem de
     enumeração do sistema de arquivos: a varredura NÃO promete “os N
     primeiros em ordem alfabética” (isso exigiria ler o universo inteiro,
     exatamente o que o teto evita). O que é determinístico é a ORDENAÇÃO da
     lista devolvida (nome e, no empate, caminho — comparação binária,
     independente de locale/ICU);
   - symlinks (arquivo ou diretório) são PULADOS, não seguidos;
   - cada diretório é revalidado com lstat ANTES de abrir e DEPOIS de abrir
     (identidade dev+ino), e o realpath do diretório aberto precisa cair
     DENTRO da raiz congelada;
   - cada entrada candidata a PDF é revalidada com lstat (arquivo regular, não
     symlink) + realpath DENTRO da raiz congelada ANTES de entrar em `files`;
     entrada que muda de tipo ou resolve fora é descartada com
     `truncated:true`;
   - a identidade de cada raiz é reconferida (dev+ino) ATÉ O RETORNO: se mudou
     no meio da varredura, os arquivos dessa raiz são descartados e
     `truncated:true`;
   - o fluxo de cada diretório é fechado SEMPRE: fim natural, teto ou erro;
   - entradas ocultas (nome começando com '.') e internas/pessoais por
     convenção do produto (nome começando com '_', como `_state.md`) são
     puladas;
   - só arquivos regulares com extensão .pdf (case-insensitive) entram;
   - falha de leitura de um diretório não derruba a listagem: marca
     `truncated` e segue (a lista incompleta fica explícita).

   TOCTOU residual (honesto): o Node portátil não oferece `openat`/
   `O_NOFOLLOW` relativo a um descritor de diretório, então uma troca de
   caminho DEPOIS que a entrada foi aceita pode fazer o caminho devolvido
   apontar para outro lugar. O que esta varredura garante: nenhum caminho
   listado resolvia para fora da raiz no momento da aceitação (realpath
   conferido), diretório trocado por symlink entre lstat e opendir é detectado
   pela revalidação de identidade pós-abertura, e raiz que muda no meio é
   descartada com `truncated:true`. O consumo posterior (`mesa_page`) revalida
   o realpath contra as raízes congeladas de novo.

   As raízes recebidas já são as canônicas congeladas pelo servidor; raiz não
   canônica é tratada como mudança (marca `truncated`, não lista). Nada aqui
   cria, altera ou lê o CONTEÚDO de arquivo (opendir só enumera nomes);
   nenhuma raiz vem do pedido. */

import path from 'node:path';
import fs from 'node:fs/promises';
import {isInsideRoot} from '../host/paths.mjs';

export const LIBRARY_LIMITS = Object.freeze({
  maxFiles: 200,
  maxEntries: 4000,
  maxDepth: 6,
});

export function isExcludedLibraryName(name) {
  if (typeof name !== 'string' || name === '') return true;
  return name.startsWith('.') || name.startsWith('_');
}

function compareNames(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

function compareFiles(a, b) {
  const byName = compareNames(a, b);
  if (byName !== 0) return byName;
  if (a.filePath < b.filePath) return -1;
  if (a.filePath > b.filePath) return 1;
  return 0;
}

function boundedLimit(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function entryKind(entry) {
  if (entry.isSymbolicLink()) return 'symlink';
  if (entry.isDirectory()) return 'directory';
  if (entry.isFile()) return 'file';
  return 'unknown';
}

function sameIdentity(a, b) {
  return Boolean(a) && Boolean(b) && a.dev === b.dev && a.ino === b.ino;
}

/* Varre as raízes em fluxo e devolve {files, truncated, visited}.
   - `files`: [{filePath, name}] absolutos/canônicos, ordenados, uma vez cada;
   - `truncated`: algum teto, falha de leitura, raiz pulada/mudada ou troca de
     tipo interrompeu a varredura (a lista pode estar incompleta);
   - `visited`: entradas de diretório examinadas (diagnóstico/teste).

   Ganchos de teste (todos opcionais, com o MESMO formato do IO real):
   - `openDir(dir) -> Promise<{read(), close()}>` (default `fs.opendir`);
   - `lstat(p) -> Promise<Stats>` (default `fs.lstat`);
   - `realpath(p) -> Promise<string>` (default `fs.realpath`). */
export async function listLibraryPdfs({roots, limits = {}, openDir, lstat, realpath} = {}) {
  const openDirectory = typeof openDir === 'function' ? openDir : (dir) => fs.opendir(dir);
  const statEntry = typeof lstat === 'function' ? lstat : fs.lstat;
  const resolveReal = typeof realpath === 'function' ? realpath : fs.realpath;
  const bounds = {
    maxFiles: boundedLimit(limits.maxFiles, LIBRARY_LIMITS.maxFiles),
    maxEntries: boundedLimit(limits.maxEntries, LIBRARY_LIMITS.maxEntries),
    maxDepth: boundedLimit(limits.maxDepth, LIBRARY_LIMITS.maxDepth),
  };
  const files = [];
  const seen = new Set();
  const state = {visited: 0, truncated: false, stop: false};

  async function closeStream(handle) {
    if (!handle || typeof handle.close !== 'function') return;
    try {
      await handle.close();
    } catch {
      // O fluxo já está inutilizável; o handle é liberado no GC. Nada mais a
      // fazer além de garantir que o close foi TENTADO (sempre).
    }
  }

  function dropFrom(index) {
    const dropped = files.splice(index);
    for (const file of dropped) seen.delete(file.filePath);
  }

  /* Aceitação de PDF: o nome veio como arquivo no Dirent, mas a revalidação
     lstat + realpath acontece AGORA, contra a raiz congelada. */
  async function acceptFile(root, full, name) {
    let info;
    try {
      info = await statEntry(full);
    } catch {
      state.truncated = true;
      return;
    }
    if (info.isSymbolicLink()) {
      // Era arquivo no Dirent e virou symlink antes da aceitação: troca no
      // meio da varredura (symlink estável já é pulado sem truncar).
      state.truncated = true;
      return;
    }
    if (!info.isFile()) {
      state.truncated = true;
      return;
    }
    let real;
    try {
      real = await resolveReal(full);
    } catch {
      state.truncated = true;
      return;
    }
    if (!isInsideRoot(real, root)) {
      // O caminho resolve para fora da raiz autorizada: nunca entra, e a
      // listagem fica honestamente incompleta.
      state.truncated = true;
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    files.push({filePath: real, name});
  }

  async function walk(dir, depth, root) {
    if (state.stop) return;
    let before;
    try {
      before = await statEntry(dir);
    } catch {
      state.truncated = true;
      return;
    }
    if (before.isSymbolicLink() || !before.isDirectory()) {
      state.truncated = true;
      return;
    }
    let handle = null;
    try {
      handle = await openDirectory(dir);
    } catch {
      state.truncated = true;
      return;
    }
    try {
      /* Revalidação PÓS-ABERTURA: o opendir pode ter aberto um inode diferente
         do que o lstat viu (troca por symlink/outro diretório na janela). */
      let after;
      try {
        after = await statEntry(dir);
      } catch {
        state.truncated = true;
        return;
      }
      if (after.isSymbolicLink() || !after.isDirectory() || !sameIdentity(before, after)) {
        state.truncated = true;
        return;
      }
      let realDir;
      try {
        realDir = await resolveReal(dir);
      } catch {
        state.truncated = true;
        return;
      }
      if (!isInsideRoot(realDir, root)) {
        state.truncated = true;
        return;
      }
      for (;;) {
        if (state.stop) return;
        if (state.visited >= bounds.maxEntries) {
          /* Orçamento esgotado: UMA leitura-sonda decide se este fluxo ainda
             tinha entradas; se tinha, a listagem está truncada de verdade. */
          let probe = null;
          try {
            probe = await handle.read();
          } catch {
            state.truncated = true;
            state.stop = true;
            return;
          }
          if (probe !== null && probe !== undefined) {
            state.truncated = true;
            state.stop = true;
          }
          return; // orçamento acabou: níveis acima decidem pelos próprios fluxos
        }
        let entry = null;
        try {
          entry = await handle.read();
        } catch {
          state.truncated = true;
          return;
        }
        if (entry === null || entry === undefined) return; // fim natural do diretório
        state.visited += 1;
        const {name} = entry;
        if (isExcludedLibraryName(name)) continue;
        const full = path.join(dir, name);
        let kind = entryKind(entry);
        if (kind === 'symlink') continue;
        if (kind === 'unknown') {
          // Dirent sem tipo (filesystem sem d_type): classifica com lstat.
          let info;
          try {
            info = await statEntry(full);
          } catch {
            state.truncated = true;
            continue;
          }
          if (info.isSymbolicLink()) continue;
          kind = info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other';
        }
        if (kind === 'directory') {
          if (depth >= bounds.maxDepth) {
            // Há subárvore não varrida: a listagem pode estar incompleta.
            state.truncated = true;
            continue;
          }
          await walk(full, depth + 1, root);
          continue;
        }
        if (kind !== 'file') continue;
        if (!/\.pdf$/i.test(name)) continue;
        if (files.length >= bounds.maxFiles) {
          state.truncated = true;
          state.stop = true;
          return;
        }
        await acceptFile(root, full, name);
      }
    } finally {
      await closeStream(handle);
    }
  }

  const rootList = Array.isArray(roots) ? roots : [];
  for (const root of rootList) {
    if (state.stop) break;
    if (state.visited >= bounds.maxEntries) {
      /* Restam raízes não varridas: sem abrir cada uma não dá para provar que
         estão vazias; marcamos a listagem como incompleta (conservador). */
      state.truncated = true;
      break;
    }
    let before;
    try {
      before = await statEntry(root);
    } catch {
      state.truncated = true;
      continue;
    }
    if (before.isSymbolicLink() || !before.isDirectory()) {
      state.truncated = true;
      continue;
    }
    const markBefore = files.length;
    await walk(root, 0, root);
    /* Identidade da raiz ATÉ O RETORNO: se a raiz mudou (troca por symlink,
       substituição por outro diretório/arquivo) depois da aceitação, os
       arquivos dela não representam a raiz congelada. */
    let after = null;
    try {
      after = await statEntry(root);
    } catch {
      after = null;
    }
    if (!after || after.isSymbolicLink() || !after.isDirectory() || !sameIdentity(before, after)) {
      dropFrom(markBefore);
      state.truncated = true;
    }
  }

  files.sort(compareFiles);
  return {files, truncated: state.truncated, visited: state.visited};
}
