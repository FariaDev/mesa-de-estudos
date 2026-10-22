/* Tradutores para os testes dos núcleos (#41): o Bend devolve a chave do
   catálogo (core/msg.bend) e os testes de forma comparam o texto em português
   ou em inglês, como o aplicador do DOM mostraria. */
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../locales/pt-BR.json' with {type: 'json'};
import en from '../locales/en.json' with {type: 'json'};

const catalogs = {'pt-BR': ptBR, en};
const portuguese = createI18n({catalogs, language: 'pt-BR'});
const english = createI18n({catalogs, language: 'en'});

/** Mensagem do núcleo → texto em português; texto comum passa como veio. @param {string} value */
export const ptText = (value) => portuguese.text(value);
/** Mensagem do núcleo → texto em inglês; texto comum passa como veio. @param {string} value */
export const enText = (value) => english.text(value);

/** Predicado para `assert.throws/rejects`: a mensagem do erro, em português, casa com o padrão. @param {RegExp} pattern */
export const ptMatches = (pattern) => (error) => pattern.test(portuguese.text(String(error?.message ?? error)));

/** Tradutor `(key, args) → texto em português`, no formato do `languageHost.t` que os hosts recebem por parâmetro. @param {string} key @param {Record<string, string | number>} [args] */
export const ptT = (key, args) => portuguese.t(key, args);
