import fs from 'node:fs';
import path from 'node:path';

/* Fake nomeado dos instaladores do Pi e do Claude Code (`brew`, `npm`, `claude`).
   Nenhum teste da Mesa roda o `brew upgrade`, o `npm i -g` nem o `claude update`
   de verdade: estes scripts gravam os argumentos em `calls.log` (um JSON por
   linha) e, se pedido, "atualizam" a versão trocando um arquivo da pasta.

   - `install`: onde o Pi mora — 'brew' (.../Cellar/<fórmula>/...), 'npm'
     (.../node_modules/@earendil-works/pi-coding-agent), 'unknown' (um script
     solto, sem package.json por perto: a versão nem é lida) ou 'solto' (o
     pacote com package.json numa pasta que a Mesa não reconhece: a versão é
     lida, o instalador não).
   - `failBrew`/`failClaude`: o comando sai com código 1 e NÃO muda a versão.
   - `stuckVersion`: o comando termina bem, mas a versão não muda (o gerenciador
     ainda não tem a nova). */
export function installFakeTools(dir, {
  install = 'brew', formula = 'pi-coding-agent', piVersion = '1.2.0', piAfter = '1.4.0',
  claudeVersion = '2.1.296', claudeAfter = '2.1.302', failBrew = false, failClaude = false, stuckVersion = false,
} = {}) {
  const bin = path.join(dir, 'fakebin');
  fs.mkdirSync(bin, {recursive: true});
  const callsFile = path.join(dir, 'calls.log');
  fs.writeFileSync(callsFile, '');

  const pkgRoot = install === 'brew'
    ? path.join(dir, 'Cellar', formula, piVersion, 'libexec', 'lib', 'node_modules', '@earendil-works', 'pi-coding-agent')
    : install === 'solto'
      ? path.join(dir, 'opt', 'pi-solto')
      : path.join(dir, 'npm-global', 'lib', 'node_modules', '@earendil-works', 'pi-coding-agent');
  const cli = path.join(pkgRoot, 'dist', 'cli.js');
  const pkgFile = path.join(pkgRoot, 'package.json');
  fs.mkdirSync(path.dirname(cli), {recursive: true});
  fs.writeFileSync(pkgFile, JSON.stringify({name: '@earendil-works/pi-coding-agent', version: piVersion}));
  fs.writeFileSync(cli, '#!/usr/bin/env node\n');
  fs.chmodSync(cli, 0o755);
  const piPath = path.join(dir, 'prefix', 'bin', 'pi');
  fs.mkdirSync(path.dirname(piPath), {recursive: true});
  if (install === 'unknown') {
    fs.writeFileSync(piPath, '#!/usr/bin/env node\n');
    fs.chmodSync(piPath, 0o755);
  } else {
    fs.symlinkSync(cli, piPath);
  }

  const claudeVersionFile = path.join(dir, 'claude.version');
  fs.writeFileSync(claudeVersionFile, claudeVersion);

  const script = (body) => `#!${process.execPath}\nconst fs=require('node:fs');\n${body}\n`;
  const log = (tool) => `fs.appendFileSync(${JSON.stringify(callsFile)},JSON.stringify({tool:${JSON.stringify(tool)},args:process.argv.slice(2)})+'\\n');`;
  const bump = stuckVersion ? '' : `fs.writeFileSync(${JSON.stringify(pkgFile)},JSON.stringify({name:'@earendil-works/pi-coding-agent',version:${JSON.stringify(piAfter)}}));`;
  const pi = (tool, fail) => script(`${log(tool)}
console.log('==> ${tool} rodando '+process.argv.slice(2).join(' '));
${fail ? "console.error('Error: falhou de propósito');process.exit(1);" : bump}`);
  const claude = script(`${log('claude')}
const args=process.argv.slice(2);
if(args[0]==='--version'){console.log(fs.readFileSync(${JSON.stringify(claudeVersionFile)},'utf8')+' (Claude Code)');process.exit(0);}
if(args[0]==='update'){
 console.log('Checking for updates...');
 ${failClaude ? "console.error('update falhou');process.exit(1);" : stuckVersion ? '' : `fs.writeFileSync(${JSON.stringify(claudeVersionFile)},${JSON.stringify(claudeAfter)});`}
 process.exit(0);
}
process.exit(2);`);
  const write = (name, text) => {
    const file = path.join(bin, name);
    fs.writeFileSync(file, text);
    fs.chmodSync(file, 0o755);
    return file;
  };
  write('brew', pi('brew', failBrew));
  write('npm', pi('npm', failBrew));
  const claudeLauncher = write('claude', claude);

  const allCalls = () => fs.readFileSync(callsFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  /* `claude --version` roda a cada leitura de versão; `calls` só mostra o que mexe. */
  const calls = () => allCalls().filter((call) => call.args[0] !== '--version');
  return {bin, piPath, claudeLauncher, calls, allCalls, pkgFile, claudeVersionFile};
}
