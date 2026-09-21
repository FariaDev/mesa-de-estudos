/* npm run update — atualiza a Mesa pelo terminal (recuperação / quem prefere
   CLI). Mesma lógica do updater por clique (desk/updater.cjs): origem
   detectada como no app — clone (`git pull --ff-only`), bundle
   (`install-source.json` → atualiza o clone e re-sincroniza) ou zip da tag
   (só a lista explícita de código; caminhos protegidos nunca).
   `npm ci` só quando o package-lock.json mudou; no macOS re-roda o install-app
   (sync + codesign); no fim a Mesa reabre sozinha. Falhou = rollback e a
   versão anterior sobe de novo, com o motivo em .runtime/desk.log.

   Uso: npm run update                  (checa e aplica a versão nova)
        npm run update -- --pi          (só o Pi local, em desk/node_modules)
        npm run update -- --versao X.Y.Z (aplica uma versão específica)
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

if (piOnly) {
 const result = await updater.applyPiOnly({deskDir: desk, runtime, reopen});
 process.exit(result.ok ? 0 : 1);
}

let target = String(versionArg || '').replace(/^v/, '');
if (!target) {
 const check = await updater.checkForUpdates({current: pkg.version, manual: true, cacheFile});
 if (check.status === 'current') {
  console.log(`Você está na última versão (v${pkg.version}).`);
  process.exit(0);
 }
 if (check.status !== 'update') {
  console.error('Não foi possível verificar atualizações (sem rede?). Use --versao X.Y.Z para aplicar um pacote específico.');
  process.exit(1);
 }
 target = check.version;
 console.log(`v${target} disponível — aplicando (v${pkg.version} → v${target}).`);
} else {
 console.log(`Aplicando v${target} por pedido (--versao; instalado: v${pkg.version}).`);
}

const result = await updater.applyUpdate({mode, rootDir: root, deskDir: desk, runtime, announcedVersion: target, sourceInfo: source, reopen});
if (!result.ok) {
 console.error(`Atualização falhou (${result.reason}) — rollback aplicado; motivo em ${path.join(runtime, 'desk.log')}`);
 process.exit(1);
}
log(`update: CLI aplicou v${target}`);
console.log(`Pronto: v${target} no lugar.${reopen ? ' A Mesa está reabrindo.' : ''}`);
