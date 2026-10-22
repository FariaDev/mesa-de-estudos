// @ts-check
'use strict';

/* Idioma da interface e do tutor (#41), no host. A decisão — o que vale como
   escolha, o padrão do sistema, "acompanhar" no tutor — é do núcleo
   (`core/language.bend`); aqui ficam o locale do sistema, a escolha salva em
   `desk.json` (fora do `config.json`), o `t()` do processo principal (menus,
   diálogos, notificação) e o canal `language-set`.

   Canais:
   - `language-get` → {ui, tutor, chosen}
   - `language-set` {ui?, tutor?} → {ui, tutor, chosen}; a interface vale na hora
     e o tutor vale na próxima conexão (o prompt é montado ao conectar).
   - `language-relink` → {relinked, busy}: derruba a ponte do tutor para o
     renderer ligar de novo já no idioma novo. Só derruba com o tutor ocioso;
     ocupado devolve {relinked: false, busy: true} e o renderer pede de novo
     quando a resposta acabar (#41, fase 2). */
/** @type {import('./types/bend-core').LanguageCore} */
const core = require('./src/generated/language.core.js').default;
const {createI18n} = require('./src/i18n.mjs');
const ptBR = require('./src/locales/pt-BR.json');
const en = require('./src/locales/en.json');

/** Valor guardado da interface → "pt-BR", "en" ou "" (nunca escolhido). */
const normalizeUi = (value) => core.storedUi(typeof value === 'string' ? value : '');
/** Valor guardado do tutor → "follow", "pt-BR" ou "en". */
const normalizeTutor = (value) => core.tutor(typeof value === 'string' ? value : '');

/**
 * @param {{ipcMain: {handle: Function}, state: () => any, patchState: (patch: object) => void,
 *   systemLocale: () => string, onChange?: (payload: object) => void,
 *   relinkTutor?: () => Promise<{relinked: boolean, busy?: boolean}>}} deps
 */
function createLanguageHost(deps) {
  const {ipcMain, state, patchState, systemLocale, onChange = () => {}, relinkTutor = async () => ({relinked: false})} = deps;
  const i18n = createI18n({catalogs: {'pt-BR': ptBR, en}});
  // O log da Mesa fica em português qualquer que seja o idioma da interface (#41).
  const logI18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'});
  // Texto que vai ao modelo (digest do chat lateral…) segue o idioma do tutor, não o da tela.
  const tutorI18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'});

  const ui = () => core.resolveUi(normalizeUi(state()?.uiLanguage), systemLocale());
  const tutor = () => normalizeTutor(state()?.tutorLanguage);
  /* "Acompanhar" no tutor vale o idioma da interface; é a língua dos textos que vão ao modelo. */
  const tutorLanguage = () => { const chosen = tutor(); return chosen === 'follow' ? ui() : chosen; };
  const tutorT = (key, args) => { tutorI18n.setLanguage(tutorLanguage()); return tutorI18n.t(key, args); };
  /* Mensagem marcada que volta ao modelo (erro da ponte de atividades) vira frase na língua dele (#43 fase 3). */
  const tutorText = (raw) => { tutorI18n.setLanguage(tutorLanguage()); return tutorI18n.text(String(raw)); };
  const payload = () => ({ui: ui(), tutor: tutor(), chosen: normalizeUi(state()?.uiLanguage) !== ''});
  const sync = () => { i18n.setLanguage(ui()); return payload(); };

  function change(request) {
    const patch = {};
    if (request?.ui !== undefined) {
      const chosen = normalizeUi(request.ui);
      if (!chosen) throw new Error(`Idioma da interface ${JSON.stringify(request.ui)} desconhecido; esperado "pt-BR" ou "en".`);
      patch.uiLanguage = chosen;
    }
    if (request?.tutor !== undefined) {
      const chosen = core.tutor(String(request.tutor));
      if (chosen !== request.tutor) throw new Error(`Idioma do tutor ${JSON.stringify(request.tutor)} desconhecido; esperado "follow", "pt-BR" ou "en".`);
      patch.tutorLanguage = chosen;
    }
    patchState(patch);
    const result = sync();
    onChange(result);
    return result;
  }

  ipcMain.handle('language-get', () => payload());
  ipcMain.handle('language-set', (_event, request) => change(request));
  ipcMain.handle('language-relink', () => relinkTutor());
  sync();

  return {t: i18n.t, text: i18n.text, logText: (value) => logI18n.text(String(value)), payload, sync, ui, tutor, tutorLanguage, tutorT, tutorText, change};
}

module.exports = {createLanguageHost, normalizeUi, normalizeTutor};
