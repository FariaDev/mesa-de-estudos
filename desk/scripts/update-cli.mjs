/* npm run update — atualiza a Mesa pelo terminal (recuperação / quem prefere
   CLI). Mesma lógica do updater por clique (desk/updater.cjs): origem
   detectada como no app — clone (`git pull --ff-only` na branch de
   DESENVOLVIMENTO), bundle (`install-source.json` → atualiza o clone e
   re-sincroniza) ou zip da tag (só a lista explícita de código; caminhos
   protegidos nunca). `npm ci` só quando o package-lock.json mudou; no macOS
   re-roda o install-app (sync + codesign); no fim a Mesa reabre sozinha.
   Falhou = rollback e a versão anterior sobe de novo, com o motivo em
   .runtime/desk.log; rollback incompleto PRESERVA o backup (caminho no log).

   Modos e --versao (C5): no modo GIT (e BUNDLE) o update segue a branch de
   desenvolvimento do clone — `--versao` NÃO seleciona versão nenhuma (a
   checagem lê a tag pública, o pull não baixa a tag; a versão final é lida do
   package.json e divergência é avisada). Só o modo ZIP baixa a tag anunciada
   e a confere no zip antes de aplicar.

   Uso: npm run update                  (checa e aplica a versão nova)
        npm run update -- --pi          (só o Pi local, em desk/.pi-local)
        npm run update -- --versao X.Y.Z (aplica uma versão específica — modo zip)
        npm run update -- --sem-reabrir  (não reabre a Mesa no fim) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const updater = require('../updater.cjs');

const desk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(desk);
const args = process.argv.slice(2);
const piOnly = args.includes('--pi');
const reopen = args.includes('--sem-reabrir') ? null
 : process.platform === 'darwin' && fs.existsSync(path.join(root, 'Mesa de Estudos.app')) && !fs.existsSync(path.join(root, '.git'))
  ? {cmd: 'open', args: [path.join(root, 'Mesa de Estudos.app')]}
  : {cmd: 'npm', args: ['start'], cwd: desk, shell: process.platform === 'win32'};

/* Mesma resolução de runtime do doctor.mjs: é lá que moram o desk.log e o
   cache do updater (nunca tocamos config.json, sessões, PDFs ou templates). */
const configDir = process.env.LEARNING_DESK_RUNTIME || (process.platform === 'win32'
 ? path.join(process.env.APPDATA || '', 'Mesa de Estudos')
 : path.join(os.homedir(), 'Library', 'Application Support', 'Mesa de Estudos'));
let runtime = process.env.LEARNING_DESK_RUNTIME || '';
try {
 const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
 runtime = runtime || String(config.runtimePath || '');
} catch {}
runtime = runtime || path.join(configDir, 'runtime');
const cacheFile = path.join(runtime, 'update.json');
const log = (line) => {updater.appendLog(path.join(runtime, 'desk.log'), line); console.log(line);};

const pkg = JSON.parse(fs.readFileSync(path.join(desk, 'package.json'), 'utf8'));
let source = null;
try {source = JSON.parse(fs.readFileSync(path.join(desk, 'install-source.json'), 'utf8'));} catch {}
const mode = source && source.path ? 'bundle' : fs.existsSync(path.join(root, '.git')) ? 'git' : 'zip';

const versionArg = args.map((a) => /^--versao=(.+)$/.exec(a)?.[1] || (/^--versao$/.test(a) ? '' : null)).find(Boolean)
 || (args.includes('--versao') ? args[args.indexOf('--versao') + 1] : '');

/* Lock de atualização (A4): o mesmo do Sobre — CLI e app não atualizam juntos.
   O `main()` devolve o código de saída; o lock é solto no finally (sem
   `process.exit` no meio, que pularia o finally e deixaria o lock preso). */
const lock = updater.acquireLock(runtime);
if (!lock.ok) {
 console.error(`Atualização já em andamento — ${lock.reason}`);
 process.exit(1);
}

process.exitCode = await main();
updater.releaseLock(lock.file);

async function main() {
 if (piOnly) {
  if (versionArg) {
   console.error('--versao não se aplica ao Pi: ele vai para a última do registry.');
   return 1;
  }
  const result = await updater.applyPiOnly({deskDir: desk, runtime, reopen});
  return result.ok ? 0 : 1;
 }

 let target = String(versionArg || '').replace(/^v/, '');
 if (!target) {
  const check = await updater.checkForUpdates({current: pkg.version, manual: true, cacheFile});
  if (check.status === 'current') {
   console.log(`Você está na última versão (v${pkg.version}).`);
   return 0;
  }
  if (check.status !== 'update') {
   console.error('Não foi possível verificar atualizações (sem rede?). Use --versao X.Y.Z para aplicar um pacote específico (modo zip).');
   return 1;
  }
  target = check.version;
  console.log(`v${target} disponível — aplicando (v${pkg.version} → v${target}).`);
 } else if (mode !== 'zip') {
  /* A3/C5: --versao só seleciona versão no modo zip. No git/bundle o update
     segue a branch de desenvolvimento — recusar com a explicação, sem
     fingir que aplicou a tag. */
  console.error(`--versao não seleciona versão no modo ${mode === 'bundle' ? 'bundle' : 'git'}: este update roda \`git pull --ff-only\` na branch de desenvolvimento do clone (a tag anunciada não é baixada). Para aplicar a tag vX.Y.Z exata, atualize a partir de um zip (sem clone git) ou rode git checkout v${target} à mão.`);
  return 1;
 } else {
  console.log(`Aplicando v${target} por pedido (--versao; instalado: v${pkg.version}).`);
 }

 const result = await updater.applyUpdate({mode, rootDir: root, deskDir: desk, runtime, announcedVersion: target, sourceInfo: source, reopen, cacheFile});
 if (!result.ok) {
  console.error(`Atualização falhou (${result.reason}) — rollback aplicado; motivo em ${path.join(runtime, 'desk.log')}`);
  if (result.incomplete) console.error(`Atenção: recuperação incompleta — backup preservado em ${result.backup}`);
  return 1;
 }
 if (result.diverged) {
  console.error(`Aviso: o modo git atualizou a branch de desenvolvimento e o package.json ficou em v${result.version} — não a v${target} anunciada.`);
 }
 log(`update: CLI aplicou (instalada: v${result.version})`);
 console.log(`Pronto: v${result.version} no lugar.${result.diverged ? ' (divergente da tag anunciada — ver acima)' : ''}${reopen ? ' A Mesa está reabrindo.' : ''}`);
 return 0;
}
