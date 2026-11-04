// @ts-check
'use strict';

/* `spawn(x.cmd, args, {shell: true})` junta os argumentos com espaço, sem
   aspas: o caminho da sessão em `C:\Users\Lucas Faria\…`, o arquivo do prompt
   ou um `&`/`>` num argumento viravam sintaxe do cmd.exe, e o Pi do npm
   (`pi.cmd`) perdia o stdout (CI Windows do PR #86). Aqui a linha do cmd.exe
   é montada com o escape do cross-spawn (qntm.org/cmd). O `%*` do shim
   reinterpreta a linha, então os metacaracteres vão escapados duas vezes. */

const META = /([()\][%!^"`<>&|;, *?])/g;

/**
 * Um argumento entre aspas e com os metacaracteres do cmd.exe escapados.
 * @param {string} arg
 * @returns {string}
 * @example quoteCmdArgument('a b') // '^"a^ b^"' escapado duas vezes
 */
function quoteCmdArgument(arg) {
  let text = String(arg);
  if (/[\r\n]/.test(text)) throw Error(`Argumento com quebra de linha não passa pelo cmd.exe: recebi ${JSON.stringify(text.slice(0, 40))}. Esperado: uma linha só (passe texto longo por arquivo).`);
  text = text.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  text = text.replace(/(?=(\\+?)?)\1$/, '$1$1');
  return `"${text}"`.replace(META, '^$1').replace(META, '^$1');
}

/**
 * Comando e argumentos para o `spawn` rodar um `.cmd`/`.bat` sem `shell: true`.
 * @param {string} command caminho do `.cmd`
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{file: string, args: string[], options: {windowsVerbatimArguments: true}}}
 * @example cmdSpawnArgs('C:\\npm\\pi.cmd', ['--session', 'C:\\Users\\Lucas Faria\\s.jsonl'])
 */
function cmdSpawnArgs(command, args, env = process.env) {
  const line = [String(command).replace(META, '^$1'), ...args.map(quoteCmdArgument)].join(' ');
  return {file: env.comspec || env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], options: {windowsVerbatimArguments: true}};
}

/**
 * O `.cmd`/`.bat` no Windows precisa do cmd.exe; o resto roda direto.
 * @param {string} command
 * @param {string} [platform]
 * @returns {boolean}
 * @example needsCmdShell('pi.cmd', 'win32') // true
 */
function needsCmdShell(command, platform = process.platform) {
  return platform === 'win32' && /\.(cmd|bat)$/i.test(String(command));
}

/**
 * O que passar ao `spawn`/`spawnSync`: via cmd.exe para `.cmd`/`.bat` no
 * Windows, direto no resto.
 * @param {string} command
 * @param {string[]} args
 * @param {{platform?: string, env?: NodeJS.ProcessEnv}} [deps]
 * @returns {{file: string, args: string[], options: {windowsVerbatimArguments?: true}}}
 * @example const plan = spawnPlan(pi, ['--version']); spawnSync(plan.file, plan.args, {...plan.options})
 */
function spawnPlan(command, args, {platform = process.platform, env = process.env} = {}) {
  if (needsCmdShell(command, platform)) return cmdSpawnArgs(command, args, env);
  return {file: command, args, options: {}};
}

module.exports = {cmdSpawnArgs, needsCmdShell, quoteCmdArgument, spawnPlan};
