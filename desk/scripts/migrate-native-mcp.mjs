/* Migração local e reversível: não copia servidores/segredos para o repo. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const desk = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const agentDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent');
const settingsPath = path.join(agentDir, 'settings.json');
const before = fs.readFileSync(settingsPath, 'utf8');
const settings = JSON.parse(before);
const legacy = p => (typeof p === 'string' ? p : p?.source)?.replace(/^npm:/, '').match(/^pi-mcp-adapter(?:@|$)/);
const packages = settings.packages || [];
const extensions = settings.extensions || [];
if (extensions.some(e => typeof e === 'string' && /pi-mcp-adapter/.test(e))) {
  throw Error('Adapter declarado em extensions: remova a entrada explicitamente antes de migrar.');
}
const check = spawnSync(process.env.LEARNING_DESK_PI || 'pi', ['--version'], {encoding: 'utf8'});
const version = check.stdout?.trim() || '';
const [major, minor, patch] = version.split('.').map(Number);
if (check.status !== 0 || !Number.isInteger(major) || !(major > 0 || minor > 99 || (minor === 99 && patch >= 1))) {
  throw Error('A migração exige Pi >= 0.99.1. Atualize o Pi antes de aplicar.');
}
console.log(`Pi ${version}; adapter declarado: ${packages.some(legacy) ? 'sim' : 'não'}`);
if (!process.argv.includes('--apply')) {
  console.log('Diagnóstico apenas. Use --apply para guardar backup e migrar.');
  process.exit(0);
}
const policyDir = path.join(agentDir, 'extensions', 'mcp-policy');
const sourceDir = path.join(desk, 'src', 'extensions', 'mcp-policy');
const files = ['index.ts', 'lib.mjs'];
for (const name of files) {
  const target = path.join(policyDir, name);
  if (fs.existsSync(target) && !fs.readFileSync(target).equals(fs.readFileSync(path.join(sourceDir, name)))) {
    throw Error(`Política MCP existente difere da versão proposta: ${target}. Nada alterado.`);
  }
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(agentDir, 'backups', `native-mcp-${stamp}`);
fs.mkdirSync(backup, {recursive: true, mode: 0o700});
fs.writeFileSync(path.join(backup, 'settings.json'), before, {mode: 0o600});
fs.writeFileSync(path.join(backup, 'migration.json'), JSON.stringify({
  version, settingsPath, policyDir, createdPolicyFiles: files.filter(n => !fs.existsSync(path.join(policyDir, n))),
}, null, 2), {mode: 0o600});
fs.mkdirSync(policyDir, {recursive: true});
for (const name of files) fs.copyFileSync(path.join(sourceDir, name), path.join(policyDir, name));
if (fs.readFileSync(settingsPath, 'utf8') !== before) throw Error('Settings mudaram durante a migração; backup preservado, repita após conferir.');
// Ativação explícita evita esperar TODOS os servidores terminarem o handshake
// antes de descobrir as ferramentas de quem já conectou (Pi 0.99.1).
const defaultTools = settings.defaultTools || [];
if (!Array.isArray(defaultTools)) throw Error('defaultTools deve ser uma lista; backup preservado.');
const next = {...settings, packages: packages.filter(p => !legacy(p)), defaultTools: [
  ...defaultTools.filter(t => !['codemode', '+codemode', '-codemode', 'tool_search', '+tool_search', '-tool_search'].includes(t)),
  '+codemode', '+tool_search',
]};
const temp = settingsPath + `.native-${process.pid}.tmp`;
fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', {mode: fs.statSync(settingsPath).mode & 0o777});
fs.renameSync(temp, settingsPath);
console.log(`MCP nativo configurado. Backup: ${backup}`);
console.log('Sessões já abertas continuam como estavam; uma nova conexão usa a integração nativa.');
