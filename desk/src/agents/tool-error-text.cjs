// @ts-check
'use strict';
/* O texto de erro que uma ferramenta do Claude devolve ao modelo (#43 fase 3).
   O host lança mensagem marcada (`message(chave,args)`), e o modelo não lê a
   marca U+E000: aqui ela vira frase na língua do tutor. Texto comum passa
   como veio. */
const {createI18n}=require('../i18n.mjs');

/** @type {Map<string, ReturnType<typeof createI18n>>} */
const translators=new Map();
/** @param {'pt-BR'|'en'} language */
function translatorFor(language){
 if(!translators.has(language)){
  const catalogs={'pt-BR':require('../../locales/pt-BR.json'),en:require('../../locales/en.json')};
  translators.set(language,createI18n({catalogs,language}));
 }
 return /** @type {ReturnType<typeof createI18n>} */(translators.get(language));
}

/**
 * O texto que vai no `content` do resultado com `isError`.
 * @param {unknown} error o que o handler lançou
 * @param {string} [language] a língua do tutor; outra cai no português
 * @param {string} [fallbackKey] a chave do catálogo quando o erro vem sem mensagem
 * @returns {string}
 * @example toolErrorText(new Error(message('err.pdf.sessionChanged')), 'en') // 'The session changed; …'
 */
function toolErrorText(error,language='pt-BR',fallbackKey='err.operation.failed'){
 const i18n=translatorFor(language==='en'?'en':'pt-BR');
 const raw=error instanceof Error?error.message:String(error??'');
 return raw?i18n.text(raw):i18n.t(fallbackKey);
}
module.exports={toolErrorText};
