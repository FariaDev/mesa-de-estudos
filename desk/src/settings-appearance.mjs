// @ts-check
import {$, S, save, applyTheme, applyAccent} from './state.mjs';
import {wireAccentPicker} from './accent-picker.mjs';

/* Aparência das Configurações (#9): cor de acento e tema. As escolhas valem
   na hora e ficam no `desk.json`, sem esperar o Salvar; Cancelar/Esc não as
   desfazem, porque são estado de interface. Este módulo existe para o
   `main.mjs` continuar no teto de linhas. */

/** Liga o grupo de acento e o select de tema. Idempotente: o main chama uma vez. */
export function initAppearanceSettings() {
  wireAccentPicker($('#accent-mode'), {current: () => S.currentAccent, choose: (id) => { applyAccent(id); save(true); }});
  /* Tema: vale na hora e fica lembrado, como o acento — Cancelar/Esc não o
     desfazem (é estado de interface, fora do `config.json`). */
  $('#theme-mode')?.addEventListener('change', (event) => {
    applyTheme(/** @type {HTMLSelectElement} */ (event.currentTarget).value);
    save(true);
  });
}
