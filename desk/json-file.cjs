'use strict';

const fs = require('fs');
const path = require('path');

/* Leitura tolerante e escrita atômica de JSON (#43 fase 2): a mesma função
   estava copiada nos pacotes, no backup, no git-backup, no chat lateral e na
   promoção Livre. Quem precisa distinguir arquivo corrompido (activity-store) ou
   limitar tamanho (search-text) segue com a sua. */

/**
 * Lê e analisa um JSON; arquivo ausente ou ilegível vira null.
 * @param {string} file caminho absoluto
 * @returns {any|null}
 * @example readJson('/runtime/desk.json') // {...} ou null
 */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Grava num temporário ao lado e renomeia, criando a pasta se faltar: quem lê
 * nunca vê o arquivo pela metade.
 * @param {string} file caminho absoluto
 * @param {string|Buffer} data conteúdo já serializado
 * @returns {void}
 * @example atomicWrite('/runtime/backup/config.json', `${JSON.stringify(config)}\n`)
 */
function atomicWrite(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

module.exports = {readJson, atomicWrite};
