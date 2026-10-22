'use strict';

/* Classe grande dividida por responsabilidade (#43 fase 2): cada arquivo
   declara uma classe só com métodos, e o dono os instala no próprio protótipo.
   Os métodos continuam não enumeráveis e com o mesmo `this`, como se tivessem
   sido escritos no corpo da classe original. */

/**
 * Copia os métodos (e getters/setters) de cada classe-mixin para o protótipo alvo.
 * Recusa nome repetido: dois arquivos definindo o mesmo método é erro de corte.
 * @param {Function} target classe que recebe os métodos
 * @param {Function[]} mixins classes cujos protótipos só têm métodos
 * @returns {void}
 * @example installPrototypeMethods(ClaudeAdapter, [ClaudeAdapterControls, ClaudeAdapterTurns]);
 */
function installPrototypeMethods(target, mixins) {
  for (const mixin of mixins) {
    for (const name of Object.getOwnPropertyNames(mixin.prototype)) {
      if (name === 'constructor') continue;
      if (Object.hasOwn(target.prototype, name)) {
        throw new Error(`método repetido ao montar ${target.name}: ${name} (vindo de ${mixin.name}); esperava um nome por arquivo`);
      }
      Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(mixin.prototype, name));
    }
  }
}

module.exports = {installPrototypeMethods};
