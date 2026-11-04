// @ts-check
'use strict';

/* PDF solto no chat. O crivo do arquivo é o do leitor (`validateDroppedPdf`).
   Só o `attach` concede: ele recebe o `File` do arrasto (o preload converte com
   `webUtils`; o renderer não manda caminho de texto até aqui). O `authorize`, que
   o envio chama com o que o renderer guarda, só confere a lista da conversa, e
   nada que chegue por ele vira concessão: um caminho que o `pi-prompt` traz sem
   ter passado pelo drop não pode ganhar leitura. A biblioteca do curso não entra
   aqui e o arquivo não é copiado. */

const fs = require('node:fs');
const path = require('node:path');
const {validateDroppedPdf} = require('./pdf-drop-host.cjs');
const {resolveTutorPdf, MAX_BYTES} = require('./pdf-read-path.cjs');
const {normalizePdfFacts} = require('./src/chat-pdf.mjs');
const {message} = require('./src/i18n.mjs');

const MAX_PAGES = 100000;

/**
 * @param {unknown} error
 * @returns {never}
 */
function rethrowDrop(error) {
  const text = error instanceof Error ? error.message : String(error);
  if (text === message('err.drop.notPdf') || text === message('err.drop.pdfOnly')) throw Error(message('err.chatpdf.notFile'));
  throw error;
}

/**
 * Nome do arquivo, sem pasta: é o que aparece nas mensagens de erro.
 * @param {string} file
 * @returns {string}
 */
function baseName(file) {
  return path.basename(String(file)) || 'PDF';
}

/**
 * A entrada da lista que corresponde ao caminho que o renderer mandou, ou `''`.
 * A lista guarda o caminho real, e o renderer manda de volta a mesma string.
 * No macOS a string pode vir em NFD ou NFC: a comparação passa pela forma NFC,
 * e a entrada da lista (a forma em disco) é a que vai para a leitura.
 * @param {string} file
 * @param {string[]} granted
 * @returns {string}
 * @example grantedEntry('/c/Lógica.pdf', ['/c/Lógica.pdf']) // '/c/Lógica.pdf'
 */
function grantedEntry(file, granted) {
  const wanted = file.normalize('NFC');
  return granted.map(String).find((entry) => entry.normalize('NFC') === wanted) || '';
}

/**
 * @param {{pageCount: (file: string) => Promise<number>, grant: (file: string) => void, sources: () => Iterable<string>, resolve?: typeof resolveTutorPdf, stat?: (file: string) => {size: number}, onSkip?: (text: string) => void}} options
 *   `onSkip` recebe a mensagem de cada PDF que o envio deixou de fora (sumiu ou ficou ilegível).
 * @returns {{attach: (rawPath: unknown) => Promise<{name: string, path: string, pages: number}>, authorize: (raw: unknown) => Array<{name: string, path: string, pages: number}>}}
 * @example const host = createChatPdfHost({pageCount: fakePageCount, grant: file => grants.add(file), sources: () => grants, onSkip: text => log(text)});
 */
function createChatPdfHost({pageCount, grant, sources, resolve = resolveTutorPdf, stat = (file) => fs.statSync(file), onSkip = () => {}}) {
  if (typeof pageCount !== 'function') throw Error('createChatPdfHost: pageCount deve ser função.');
  if (typeof grant !== 'function') throw Error('createChatPdfHost: grant deve ser função.');
  if (typeof sources !== 'function') throw Error('createChatPdfHost: sources deve ser função.');

  function dropped(rawPath) {
    try {
      return validateDroppedPdf(rawPath);
    } catch (error) {
      rethrowDrop(error);
    }
  }

  /* `file` tira o caminho do texto do erro (o Node põe o caminho inteiro na
     mensagem de ENOENT); o nome fica. */
  function failureDetail(error, file = '') {
    const text = error instanceof Error ? error.message : String(error);
    const named = file ? text.split(file).join(baseName(file)) : text;
    return named.replace(/[\uE000\uE001]/g, ' ').slice(0, 300);
  }

  function measured(file) {
    let info;
    try {
      info = stat(file.path);
    } catch (error) {
      throw Error(message('err.chatpdf.unreadable', {name: file.name, error: failureDetail(error)}));
    }
    if (!info || typeof info.size !== 'number' || info.size > MAX_BYTES) {
      throw Error(message('err.chatpdf.tooBig', {bytes: info && typeof info.size === 'number' ? info.size : 0}));
    }
    return info;
  }

  function accept(file) {
    measured(file);
    /* O caminho entra na lista só depois do crivo do resolve, e entra o real
       (`resolve` devolve o realpath): é essa string que o renderer guarda e
       manda de volta no envio. Só o arquivo: a pasta irmã vale para a
       biblioteca, não para o que foi solto no chat. */
    const opened = resolve(file.path, [], {exact: [...sources(), file.path]});
    grant(opened);
    return {name: file.name, path: opened};
  }

  async function counted(file) {
    let pages;
    try {
      pages = Number(await pageCount(file));
    } catch (error) {
      throw Error(message('err.chatpdf.unreadable', {name: file.split(/[\\/]/).pop() || 'PDF', error: failureDetail(error)}));
    }
    if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) throw Error(message('err.chatpdf.pages', {pages: JSON.stringify(pages)}));
    return pages;
  }

  async function attach(rawPath) {
    const file = dropped(rawPath);
    measured(file);
    const pages = await counted(file.path);
    return {...accept(file), pages};
  }

  /* O envio traz os PDFs que o renderer guarda. Este passo não concede nada:
     um caminho fora da lista desta conversa recusa o envio inteiro (quem pediu
     não tem o arquivo); um PDF da lista que sumiu ou ficou ilegível sai do envio
     com `err.chatpdf.unreadable` (só o nome), e os outros seguem. */
  function authorize(raw) {
    const granted = [...sources()];
    const out = [];
    for (const fact of normalizePdfFacts(raw)) {
      const entry = grantedEntry(fact.path, granted);
      if (!entry) throw Error(message('err.chatpdf.notGranted', {name: baseName(fact.path)}));
      const item = reopened(entry, fact.pages, granted);
      if (item) out.push(item);
    }
    return out;
  }

  /* `null` quando o PDF da lista não pode mais ser lido; o motivo vai por `onSkip`. */
  function reopened(entry, pages, granted) {
    try {
      measured(dropped(entry));
      return {name: baseName(entry), path: resolve(entry, [], {exact: granted}), pages};
    } catch (error) {
      const code = error && typeof error.code === 'string' ? error.code : '';
      onSkip(message('err.chatpdf.unreadable', {name: baseName(entry), error: code || failureDetail(error, entry)}));
      return null;
    }
  }

  return {attach, authorize};
}

module.exports = {createChatPdfHost, MAX_PAGES};
