// @ts-check
/* Módulo sob demanda para o que só a interface aberta usa (#desempenho). A
   promessa é guardada: dois cliques no mesmo botão não avaliam o módulo duas
   vezes; `prepare` roda uma vez, depois do import, para o init que depende do
   DOM (ouvintes, primeira pintura). `current`/`ready` respondem sem disparar o
   import — quem só quer saber se ele já veio. */

/**
 * @param {{importModule: () => Promise<any>, prepare?: (module: any) => void}} options
 * @returns {{load: () => Promise<any>, current: () => any | null, ready: () => boolean}}
 * @example
 * const settings = createLazyModule({importModule: () => import('./settings.mjs'), prepare: (m) => m.initSettings()});
 * await settings.load(); // uma vez só
 */
export function createLazyModule({importModule, prepare = () => {}}) {
  /** @type {any | null} */
  let loaded = null;
  /** @type {Promise<any> | null} */
  let pending = null;

  function load() {
    if (loaded) return Promise.resolve(loaded);
    if (pending) return pending;
    pending = Promise.resolve()
      .then(importModule)
      .then((module) => {
        loaded = module;
        prepare(module);
        return module;
      })
      .catch((error) => {
        loaded = null;
        pending = null;
        throw error;
      });
    return pending;
  }

  return {load, current: () => loaded, ready: () => !!loaded};
}
