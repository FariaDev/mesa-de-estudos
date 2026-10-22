// @ts-check
/* Idioma da interface no renderer (#41): o `t()` único da janela, o texto
   estático do index.html (`data-i18n` / `data-i18n-attr`) e a troca na hora.
   Os catálogos são `desk/locales/*.json`; o corpo de `t()` e `text()` mora em
   `i18n.mjs`, que não depende do DOM. */
import ptBR from '../locales/pt-BR.json' with {type: 'json'};
import en from '../locales/en.json' with {type: 'json'};
import {createI18n, isLanguage, FALLBACK_LANGUAGE} from './i18n.mjs';

export const LANGUAGE_EVENT = 'desk-language';

/* O main resolve o idioma antes de abrir a janela e o preload o entrega: as telas
   que montam na carga do módulo já saem no idioma certo, sem piscar em outro. */
const i18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language: globalThis.window?.desk?.initialLanguage});

/** @param {string} key @param {Record<string, string | number>} [args] */
export const t = (key, args) => i18n.t(key, args);
/** Mensagem dos núcleos Bend → texto no idioma atual. @param {string} value */
export const text = (value) => i18n.text(value);
export const currentLanguage = () => i18n.getLanguage();

/** Formata números e datas no idioma da interface, nunca no do sistema.
 * @param {number} value @param {Intl.NumberFormatOptions} [options] */
export const formatNumber = (value, options) => new Intl.NumberFormat(i18n.getLanguage(), options).format(value);
/** @param {Date | number} value @param {Intl.DateTimeFormatOptions} [options] */
export const formatDate = (value, options) => new Intl.DateTimeFormat(i18n.getLanguage(), options).format(value);

/**
 * Frase que vai ao MODELO (não à tela): segue o idioma do tutor, que pode diferir do da interface.
 * @param {string} key @param {Record<string, string | number>} [args]
 * @returns {Promise<string>}
 */
export async function tutorText(key, args) {
  const chosen = await globalThis.window?.desk?.languageGet?.();
  const language = chosen && isLanguage(chosen.tutor) ? chosen.tutor : chosen?.ui;
  return createI18n({catalogs: {'pt-BR': ptBR, en}, language: isLanguage(language) ? language : i18n.getLanguage()}).t(key, args);
}

/** @type {Array<(changed: Element[]) => void>} */
const afterStaticText = [];
/** Registra o que roda depois de o texto estático ser reescrito (ex.: ⌘ → Ctrl fora do Mac), com os elementos tocados.
 * @param {(changed: Element[]) => void} listener */
export const onStaticTextApplied = (listener) => { afterStaticText.push(listener); };

/**
 * Traduz o texto estático de um trecho do DOM.
 * `data-i18n="chave"` troca o texto; `data-i18n-html="chave"` troca o conteúdo por marcação do catálogo
 * (só <strong>, <kbd>, <code>, <em>: a frase vem de `locales/`, nunca do aluno);
 * `data-i18n-attr="title=chave;aria-label=outra"` troca atributos.
 * @param {ParentNode} [root]
 */
export function applyStaticText(root = document) {
  /** @type {Element[]} */
  const changed = [];
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(/** @type {string} */ (el.getAttribute('data-i18n')));
    changed.push(el);
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(/** @type {string} */ (el.getAttribute('data-i18n-html')));
    changed.push(el);
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of String(el.getAttribute('data-i18n-attr')).split(';')) {
      const [attr, key] = pair.split('=').map((part) => part.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
    changed.push(el);
  }
  for (const listener of afterStaticText) listener(changed);
}

/**
 * Troca o idioma da interface: `<html lang>`, texto estático e o evento que
 * faz as telas dinâmicas se refazerem.
 * @param {string} language "pt-BR" ou "en"
 * @example setUiLanguage('en') // a janela inteira passa para inglês na hora
 */
export function setUiLanguage(language) {
  const next = isLanguage(language) ? language : FALLBACK_LANGUAGE;
  i18n.setLanguage(next);
  document.documentElement.lang = next;
  applyStaticText(document);
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, {detail: {language: next}}));
}
