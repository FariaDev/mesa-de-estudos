import fs from 'node:fs';
import path from 'node:path';

/* No Windows o CreateProcess não executa um script com shebang (`spawn
   EFTYPE`), e o Pi/instaladores de verdade chegam como `.cmd`/`.exe`. Os fakes
   dos testes passam a ter o mesmo formato que a produção encontra: no POSIX o
   script com shebang; no Windows um `.cjs`/`.mjs` + um `.cmd` que chama o Node.
   Sem isto o teste mediria o formato do fake, não o caminho do app. */

/** Escreve um fake executável no formato da plataforma.
 * @param {string} dir pasta do fake
 * @param {string} name nome do comando (sem extensão)
 * @param {string} source corpo do script (shebang é aceito)
 * @returns {string} caminho para passar a `spawn`/`PiBridge`
 * @example const pi = writeFakeExecutable(dir, 'pi', 'console.log("oi")\n');
 */
export function writeFakeExecutable(dir, name, source) {
  if (process.platform !== 'win32') {
    const file = path.join(dir, name);
    fs.writeFileSync(file, source);
    fs.chmodSync(file, 0o755);
    return file;
  }
  fs.writeFileSync(path.join(dir, `${name}.cjs`), source);
  return cmdShim(dir, name, path.join(dir, `${name}.cjs`));
}

/** Embrulha um script já escrito num `.cmd` no Windows; no POSIX devolve o
 * próprio script. A extensão (`.cjs`, `.mjs`) é preservada para o Node não
 * trocar o modo do módulo.
 * @param {string} script caminho do script já gravado
 * @param {string} [dir] pasta do shim (padrão: a do script)
 * @returns {string} caminho executável na plataforma
 * @example const pi = fakeCommand(fileURLToPath(new URL('./fake-pi.mjs', import.meta.url)), runtime);
 */
export function fakeCommand(script, dir = path.dirname(script)) {
  if (process.platform !== 'win32') {
    fs.chmodSync(script, 0o755);
    return script;
  }
  const name = path.basename(script, path.extname(script));
  return cmdShim(dir, name, path.resolve(script));
}

function cmdShim(dir, name, target) {
  const file = path.join(dir, `${name}.cmd`);
  fs.writeFileSync(file, `@echo off\r\n"${process.execPath}" "${target}" %*\r\n`);
  return file;
}
