// @ts-check
'use strict';

/* Concessões de PDF do leitor: o que vale por pasta irmã e o que vale só por inteiro.
   `allowed` continua sendo o que o leitor mostra (`validPdf`, `save-state`,
   favoritos e retomada). A regra da pasta irmã (`resolveTutorPdf`) recebe SÓ a
   biblioteca da matéria; o que o aluno abriu um a um (`open-pdf`,
   `open-dropped-pdf` fora do Livre) ou o que voltou restaurado sem ser da
   biblioteca entra como `exact` (só ele, nunca a pasta). Um PDF malicioso não
   pode manipular o modelo para ler o vizinho: nada do que o modelo pede sai da
   autorização do aluno. */

/**
 * Chave de comparação de um caminho: NFC sempre, sem caixa no Windows.
 * @param {string} file
 * @param {string} platform
 * @returns {string}
 * @example normalizeKey('Lógica.PDF', 'win32') // 'lógica.pdf'
 */
function normalizeKey(file, platform) {
  const text = String(file).normalize('NFC');
  return platform === 'win32' ? text.toLowerCase() : text;
}

/**
 * @param {Set<string>} set
 * @param {string} file
 * @param {string} platform
 * @returns {boolean}
 */
function hasKey(set, file, platform) {
  const wanted = normalizeKey(file, platform);
  for (const entry of set) if (normalizeKey(entry, platform) === wanted) return true;
  return false;
}

/**
 * @param {Set<string>} set
 * @param {string} file
 * @param {string} platform
 */
function forgetKey(set, file, platform) {
  const wanted = normalizeKey(file, platform);
  for (const entry of set) if (normalizeKey(entry, platform) === wanted) set.delete(entry);
}

/**
 * Concessões de leitura única ao lado do `allowed` do leitor.
 * @param {{allowed?: Set<string>, platform?: string}} [options]
 *   `allowed` é o conjunto do leitor (união); este módulo decide o que dele é
 *   biblioteca (pasta irmã) e o que é só `exact`.
 * @returns {{addLibrary: (paths: Iterable<string>) => void, addSingle: (file: string) => void, reset: (libraryPaths: Iterable<string>, readerPaths: Iterable<string>) => void, libraryList: () => string[], singleList: () => string[], resolveArgs: (extraExact?: Iterable<string>) => {library: string[], exact: string[]}}}
 * @example const grants = createPdfGrants({allowed});
 * grants.addSingle('/dl/Lista.pdf');
 * resolveTutorPdf('/dl/Extrato.pdf', grants.libraryList(), {exact: grants.singleList()}); // recusa
 */
function createPdfGrants({allowed, platform = process.platform} = {}) {
  if (!(allowed instanceof Set)) throw Error(`createPdfGrants: allowed deve ser um Set, recebi ${String(allowed)}.`);
  const library = new Set();
  const singles = new Set();

  function addLibrary(paths) {
    for (const file of paths || []) {
      if (typeof file !== 'string' || !file) continue;
      forgetKey(singles, file, platform);
      if (!hasKey(library, file, platform)) library.add(file);
      allowed.add(file);
    }
  }

  function addSingle(file) {
    if (typeof file !== 'string' || !file) throw Error(`createPdfGrants: caminho inválido, recebi ${JSON.stringify(file)}. Esperado: string não vazia.`);
    if (!hasKey(library, file, platform) && !hasKey(singles, file, platform)) singles.add(file);
    allowed.add(file);
  }

  /* Reabertura do app: a biblioteca volta como biblioteca; leitor restaurado
     que não é da biblioteca volta como `exact`, nunca como pasta. */
  function reset(libraryPaths, readerPaths) {
    library.clear();
    singles.clear();
    allowed.clear();
    addLibrary(libraryPaths);
    for (const file of readerPaths || []) {
      if (typeof file !== 'string' || !file) continue;
      if (hasKey(library, file, platform)) continue;
      singles.add(file);
      allowed.add(file);
    }
  }

  function libraryList() {
    return [...library];
  }

  function singleList() {
    return [...singles];
  }

  /* Argumentos prontos para o `resolveTutorPdf`: biblioteca na regra da pasta,
     avulsos junto com os exatos extras (PDFs soltos no chat). */
  function resolveArgs(extraExact = []) {
    return {library: libraryList(), exact: [...singles, ...extraExact]};
  }

  return {addLibrary, addSingle, reset, libraryList, singleList, resolveArgs};
}

/** Concessões de leitura única (o que `createPdfGrants` devolve). @typedef {ReturnType<typeof createPdfGrants>} PdfGrants */

module.exports = {createPdfGrants, normalizeKey};
