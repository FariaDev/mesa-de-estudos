/* Fake nomeado do `spawnSync` para a detecção da toolchain (`core/toolchain.mjs`).
   Não toca no bun/bend reais: responde só aos binários que o teste injeta. */
export function fakeToolchainSpawn({bunVersion = '1.4.2', bendVersion = 'bend 2.0.37', respond = true, bendSubcommand = 'version'} = {}) {
  return (file, args) => {
    if (!respond) return {error: Object.assign(new Error('ENOENT'), {code: 'ENOENT'}), status: null};
    if (file === 'bun-fake' && args[0] === '--version') return {status: 0, stdout: `${bunVersion}\n`};
    const bendArg = args[0] === bendSubcommand ? args[0] : '';
    if (file === 'bend-fake' && bendArg) return {status: 0, stdout: `${bendVersion}\n`};
    return {error: Object.assign(new Error('ENOENT'), {code: 'ENOENT'}), status: null};
  };
}
