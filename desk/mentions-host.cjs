// @ts-check
'use strict';

/* Menções `@` das ferramentas (#53), no host: valida os ids que o renderer
   mandou e monta o bloco de instrução que segue a mensagem. Quem aparece, o
   teto de chips e o cabeçalho que marca o bloco são do núcleo
   (`core/toolmentions.bend`); o texto de cada instrução é do catálogo
   (`mention.<id>.instruction`) e sai no idioma do aluno: o do tutor quando o
   aluno o fixou, senão o da interface (com "acompanhar" a língua da próxima
   mensagem não existe ainda aqui, e a da tela é a melhor pista). */
/** @type {import('./types/bend-core').ToolMentionsCore} */
const core = require('./src/generated/toolmentions.core.js').default;
const {createI18n} = require('./src/i18n.mjs');
const ptBR = require('./src/locales/pt-BR.json');
const en = require('./src/locales/en.json');

const Nil = /** @type {const} */ ({$: 'Nil'});
const toList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const fromList = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};

/** Ids que o motor atual oferece, na ordem do catálogo. @param {boolean} geogebra */
const offeredIds = (geogebra) => fromList(core.offered(geogebra)).map((tool) => tool.id);

/**
 * Ids válidos da mensagem: texto conhecido do motor, sem repetir, no teto.
 * Valor fora disso é erro (o renderer só manda o que a lista ofereceu).
 * @param {unknown} raw @param {boolean} geogebra
 * @returns {string[]}
 * @example validMentions(['geogebra'], true) // ['geogebra']
 */
function validMentions(raw, geogebra) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`Menções inválidas: ${JSON.stringify(raw)}; esperado uma lista de ids de ferramenta.`);
  const offered = offeredIds(geogebra);
  /** @type {import('./types/bend-core').BendList<string>} */
  let ids = Nil;
  for (const id of raw) {
    if (typeof id !== 'string' || !offered.includes(id)) throw new Error(`Ferramenta ${JSON.stringify(id)} desconhecida; esperado um de ${offered.join(', ')}.`);
    ids = core.addId(ids, id);
  }
  return fromList(ids);
}

/**
 * Bloco apenso à mensagem: cabeçalho + uma linha de instruções no idioma do aluno.
 * @param {string[]} ids @param {'pt-BR'|'en'} language
 * @returns {string} vazio sem ids
 * @example mentionBlock(['geogebra'], 'en') // '\n\n[Ferramenta pedida na Mesa: geogebra]\nUse the geogebra tool…'
 */
function mentionBlock(ids, language) {
  if (!ids.length) return '';
  const i18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language});
  const lines = ids.map((id) => i18n.text(core.instructionMsg(id)));
  return core.instructionBlock(toList(ids), toList(lines));
}

module.exports = {validMentions, mentionBlock, offeredIds};
