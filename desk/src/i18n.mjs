// @ts-check
/* Tradução da interface (#41). Um catálogo por idioma (`desk/src/locales/*.json`),
   uma função `t(chave, args)` e um `text(s)` que traduz as mensagens que os
   núcleos Bend devolvem (`core/msg.bend`: MARK chave SEP nome SEP valor …).
   Sem DOM e sem Electron: o renderer e o main injetam os catálogos, e o teste
   usa o mesmo código. */

export const MESSAGE_MARK = '';
export const MESSAGE_SEP = '';
export const FALLBACK_LANGUAGE = 'pt-BR';
export const LANGUAGES = /** @type {const} */ (['pt-BR', 'en']);

/** @typedef {'pt-BR' | 'en'} Language */
/** @typedef {Record<string, string>} Catalog */
/** @typedef {Record<string, string | number>} MessageArgs */

/** @param {unknown} value */
export function isLanguage(value) {
  return value === 'pt-BR' || value === 'en';
}

/**
 * Põe o separador decimal do idioma num número escrito com ponto (a saída do avaliador da
 * calculadora); texto que não é número fica como veio.
 * `localizeDecimal('0.5', 'pt-BR')` → `'0,5'`; `localizeDecimal('1e-7', 'pt-BR')` → `'1e-7'`
 * @param {string} raw @param {Language} language
 */
export function localizeDecimal(raw, language) {
  if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(raw)) return raw;
  const parts = new Intl.NumberFormat(language).formatToParts(1.1);
  return raw.replace('.', parts.find((part) => part.type === 'decimal')?.value ?? '.');
}

/**
 * Divide uma mensagem dos núcleos em chave e argumentos.
 * `parseMessage('a.bn3')` → `{key: 'a.b', args: {n: '3'}}`
 * @param {string} encoded
 * @returns {{key: string, args: Record<string, string>} | null} `null` se não for mensagem.
 */
export function parseMessage(encoded) {
  if (typeof encoded !== 'string' || !encoded.startsWith(MESSAGE_MARK)) return null;
  const [key, ...pairs] = encoded.slice(MESSAGE_MARK.length).split(MESSAGE_SEP);
  /** @type {Record<string, string>} */
  const args = {};
  for (let i = 0; i + 1 < pairs.length; i += 2) args[pairs[i]] = pairs[i + 1];
  return {key, args};
}

/**
 * Monta uma mensagem que atravessa IPC ou estado como texto e só vira frase em `text()`,
 * no idioma que a interface tiver na hora de pintar (mesmo formato do `core/msg.bend`).
 * `message('tutor.error.stopped', {code: 1})` → `'tutor.error.stoppedcode1'`
 * @param {string} key @param {MessageArgs} [args]
 */
export function message(key, args = {}) {
  if (typeof key !== 'string' || key === '' || key.includes(MESSAGE_SEP) || key.startsWith(MESSAGE_MARK)) {
    throw new Error(`i18n: chave de mensagem deveria ser texto não vazio sem marcas, veio ${JSON.stringify(key)}`);
  }
  const pairs = Object.entries(args).flatMap(([name, value]) => [name, String(value)]);
  if (pairs.some((part) => part.includes(MESSAGE_SEP))) {
    throw new Error(`i18n: argumento de "${key}" não pode conter o separador U+E001, veio ${JSON.stringify(args)}`);
  }
  return [MESSAGE_MARK + key, ...pairs].join(MESSAGE_SEP);
}

/** Os nomes `{nome}`, `{nome:number}` e `{nome:key}` de uma frase do catálogo, na ordem em que aparecem.
 * @param {string} phrase */
export function placeholderNames(phrase) {
  return [...phrase.matchAll(/\{(\w+)(?::(?:number|key))?\}/g)].map((m) => m[1]);
}

/**
 * @param {{catalogs: Record<Language, Catalog>, language?: string, onMissing?: (key: string, language: Language) => void}} options
 *   `onMissing` avisa chave ausente nos dois idiomas (o teste de paridade a torna erro).
 *   Idioma desconhecido em `language` cai no padrão (o preload pode não ter mandado um).
 */
export function createI18n({catalogs, language = FALLBACK_LANGUAGE, onMissing = () => {}}) {
  let current = /** @type {Language} */ (isLanguage(language) ? language : FALLBACK_LANGUAGE);

  /** @param {string} key */
  function phraseFor(key) {
    return catalogs[current]?.[key] ?? catalogs[FALLBACK_LANGUAGE]?.[key];
  }

  /** Plural: `chave.one` quando `count` é 1, `chave.other` nos demais; sem `count`, a chave pura.
   * @param {string} key @param {MessageArgs} args */
  function pluralKey(key, args) {
    if (args.count === undefined) return key;
    const count = Number(args.count);
    /* O CLDR põe o zero de pt-BR em "one" ("0 item"); a Mesa diz "0 itens" (#41 fase 3). */
    const category = count === 0 ? 'other' : new Intl.PluralRules(current).select(count);
    /* Uma frase sem formas (`count` só entra no texto, como em "Guardadas · {count}") fica na chave pura. */
    for (const candidate of [`${key}.${category}`, `${key}.other`]) if (phraseFor(candidate) !== undefined) return candidate;
    return key;
  }

  /** `{nome:key}` traduz o valor do argumento como outra chave do catálogo (nível de esforço,
   * tipo de aviso…); um valor que não é chave segue como veio.
   * @param {string} name @param {string | number} value @param {string} kind "", "number" ou "key" */
  function formatValue(name, value, kind) {
    if (kind === 'key') return phraseFor(String(value)) ?? String(value);
    if (kind !== 'number') return String(value);
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`i18n: argumento "${name}" deveria ser número, veio ${JSON.stringify(value)}`);
    return new Intl.NumberFormat(current).format(n);
  }

  /**
   * Traduz uma chave do catálogo.
   * `t('settings.title')` → `'Configurações'`; `t('items', {count: 2})` usa `items.other`.
   * @param {string} key @param {MessageArgs} [args]
   */
  function t(key, args = {}) {
    const resolved = pluralKey(key, args);
    const phrase = phraseFor(resolved);
    if (phrase === undefined) {
      onMissing(resolved, current);
      return resolved;
    }
    return phrase.replace(/\{(\w+)(?::(number|key))?\}/g, (_whole, name, kind = '') => {
      if (!(name in args)) throw new Error(`i18n: chave "${resolved}" pede o argumento "${name}", recebeu ${JSON.stringify(Object.keys(args))}`);
      return formatValue(name, args[name], kind);
    });
  }

  /** Mensagem dos núcleos → texto no idioma atual; texto comum passa como veio.
   * @param {string} value */
  function text(value) {
    const message = parseMessage(value);
    return message ? t(message.key, message.args) : value;
  }

  return {
    t,
    text,
    getLanguage: () => current,
    /** @param {Language} language */
    setLanguage(language) {
      if (!isLanguage(language)) throw new Error(`i18n: idioma ${JSON.stringify(language)} desconhecido; esperado "pt-BR" ou "en"`);
      current = language;
    },
  };
}
