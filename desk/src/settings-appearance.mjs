// @ts-check
import {$, S, save, applyTheme, applyAccent} from './state.mjs';
import {wireAccentPicker} from './accent-picker.mjs';
import {applyDisplayState} from './display-preferences.mjs';

/* Aparência das Configurações (#9): cor de acento e tema. As escolhas valem
   na hora e ficam no `desk.json`, sem esperar o Salvar; Cancelar/Esc não as
   desfazem, porque são estado de interface. O tamanho e a largura da leitura e
   o tom da página escura do PDF (#106/#107) seguem a mesma regra. Este módulo
   existe para o `main.mjs` continuar no teto de linhas. */

/** Liga o grupo de acento e o select de tema. Idempotente: o main chama uma vez. */
export function initAppearanceSettings() {
  wireAccentPicker($('#accent-mode'), {current: () => S.currentAccent, choose: (id) => { applyAccent(id); save(true); }});
  /* Tema: vale na hora e fica lembrado, como o acento — Cancelar/Esc não o
     desfazem (é estado de interface, fora do `config.json`). */
  $('#theme-mode')?.addEventListener('change', (event) => {
    applyTheme(/** @type {HTMLSelectElement} */ (event.currentTarget).value);
    save(true);
  });
  /* Leitura e página escura: cada seletor aplica e grava na hora, como o tema;
     os três campos ausentes mantêm o que já estava valendo. */
  for (const [selector, key] of /** @type {const} */ ([
    ['#reading-size', 'readingSize'],
    ['#reading-width', 'readingWidth'],
    ['#pdf-dark', 'pdfDark'],
  ])) {
    $(selector)?.addEventListener('change', (event) => {
      applyDisplayState(S, {[key]: /** @type {HTMLSelectElement} */ (event.currentTarget).value});
      save(true);
    });
  }
}
