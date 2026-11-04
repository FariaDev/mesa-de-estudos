// @ts-check
/* A tela cheia da primeira abertura (#64) e o núcleo `firstrun.core.js`
   (125 KiB) não entram na partida de quem já tem matéria (#desempenho). A
   regra de quando ela vale é a mesma do host de antes: falta configuração ou
   não há matéria de verdade — a aba Livre (`kind: 'free'`) não conta. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * `true` quando a primeira abertura deve aparecer para estes dados.
 * @param {{needsSetup?: boolean, courses?: Array<{kind?: string}>}} [data]
 * @returns {boolean}
 * @example wantsFirstRunScreen({needsSetup: false, courses: [{kind: 'free'}]}) // true
 */
export function wantsFirstRunScreen(data) {
  if (data?.needsSetup) return true;
  const courses = Array.isArray(data?.courses) ? data.courses : [];
  return !courses.some((course) => course?.kind === 'course');
}

/**
 * Carregador da primeira abertura: importa o módulo e monta o markup só quando
 * a tela vale; depois de carregado, toda sincronização passa pelo módulo (é
 * ele que sabe se a tela está ativa, inclusive depois de "Estudar sem
 * matéria").
 * @param {{importModule: () => Promise<any>}} options
 * @returns {{prepare: (data: any) => Promise<void>, sync: (data: any, hooks?: Record<string, unknown>) => Promise<void>, isActive: () => boolean}}
 * @example
 * const firstRun = createFirstRunBoot({importModule: () => import('./first-run.mjs')});
 * await firstRun.sync(data, hooks);
 */
export function createFirstRunBoot({importModule}) {
  const lazy = createLazyModule({importModule});
  /** @type {Record<string, unknown>} */
  let hooks = {};
  return {
    /* Adianta o import durante o `loadCourse` do boot: quando a tela entra,
       ela não chega atrasada em relação à aba Livre (a corrida que o teste
       `enterFree` via). */
    async prepare(data) {
      if (wantsFirstRunScreen(data)) await lazy.load();
    },
    async sync(data, nextHooks) {
      /* Os ganchos do boot valem mesmo quando a tela só entra depois (apagar
         tudo nas Configurações): o módulo não teria como criar a matéria. */
      hooks = {...hooks, ...(nextHooks || {})};
      if (!lazy.ready() && !wantsFirstRunScreen(data)) return;
      const module = await lazy.load();
      await module.syncFirstRun(data, hooks);
    },
    isActive() {
      const module = lazy.current();
      return module ? !!module.isFirstRun() : false;
    },
  };
}
