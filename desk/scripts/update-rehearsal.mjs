/* Ensaio da atualização antes de publicar: quem aplica uma versão nova é o updater
   da versão ANTERIOR, que os testes do código novo não exercitam. A 1.0.2 não
   copiava `.pub` e a primeira publicação da 1.1.0 deixou instalações por zip sem a
   chave, com a atualização seguinte recusada.

   Uso: npm run update:rehearsal -- vX.Y.Z [--de vA.B.C] [--abrir]
   O `update:sign` roda o mesmo ensaio e recusa assinar se ele falhar. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

/* Fora do que o app carrega. A chave tem conferência própria: o arquivo pode
   faltar quando o código traz a cópia embutida. */
const NOT_LOADED_BY_APP = [/^desk\/\.gitignore$/, /^desk\/types\/.*\.d\.ts$/, /^desk\/update-signing-key\.pub$/];
const USER_FILES = {'desk/config.json': '{"ensaio":true}\n', 'desk/.runtime/ensaio.json': '{"ensaio":true}\n'};
const BOOT_WAIT_MS = 20000;

/* Roda no processo filho, com o código da versão anterior: mesma sequência do
   modo zip em `applyUpdate`. */
const APPLY_WITH_PREVIOUS = `
const fs=require('node:fs');
const [updaterFile,zipFile,rootDir,version]=process.argv.slice(1);
const updater=require(updaterFile);
const previous=updater.readManifest(rootDir);
const written=[];
updater.applyZip(fs.readFileSync(zipFile),{rootDir,announcedVersion:version,created:[],written});
updater.writeManifest(rootDir,version,written);
updater.removeOrphans(rootDir,previous,written,()=>{});
`;

/* Roda com o código recém-instalado: prova que ele carrega e lê a chave como o app. */
const READ_INSTALLED_KEY = `
const [signatureFile,keyFile]=process.argv.slice(1);
process.stdout.write(require(signatureFile).readUpdatePublicKey(keyFile));
`;

function parseSemver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareSemver(left, right) {
  const index = left.findIndex((part, at) => part !== right[at]);
  return index < 0 ? 0 : left[index] - right[index];
}

/**
 * Maior tag de versão abaixo da candidata: a versão de quem vai atualizar.
 * @param {string[]} tags nomes das tags do repositório
 * @param {string} version versão candidata, sem `v`
 * @returns {string} a tag, ou vazio se a candidata é a primeira
 * @example previousReleaseTag(['v1.0.2', 'v1.1.0', 'nota'], '1.1.0') // 'v1.0.2'
 */
export function previousReleaseTag(tags, version) {
  const candidate = parseSemver(version);
  if (!candidate) throw Error(`versão inválida: recebido ${JSON.stringify(version)}; esperado X.Y.Z`);
  const earlier = tags.filter((tag) => /^v\d/.test(tag) && parseSemver(tag) && compareSemver(parseSemver(tag), candidate) < 0);
  return earlier.sort((a, b) => compareSemver(parseSemver(b), parseSemver(a)))[0] || '';
}

function sameBytes(left, right) {
  return fs.existsSync(left) && fs.existsSync(right) && fs.readFileSync(left).equals(fs.readFileSync(right));
}

/**
 * Compara a instalação atualizada com a candidata e lista o que ficou errado.
 * @param {{installDir: string, candidateDir: string, candidateFiles: string[], version: string, installedKey: string, expectedKey: string}} input
 * @returns {string[]} problemas; vazio quando a instalação está certa
 * @example auditUpdatedInstall({installDir, candidateDir, candidateFiles: ['desk/main.cjs'], version: '1.1.0', installedKey: key, expectedKey: key}) // []
 */
export function auditUpdatedInstall({installDir, candidateDir, candidateFiles, version, installedKey, expectedKey}) {
  const problems = [];
  const installed = JSON.parse(fs.readFileSync(path.join(installDir, 'desk', 'package.json'), 'utf8')).version;
  if (installed !== version) problems.push(`versão instalada ${installed}; esperado ${version}`);
  if (!expectedKey.trim() || installedKey.trim() !== expectedKey.trim()) {
    problems.push(`a instalação atualizada lê outra chave de atualização (${installedKey.trim() ? 'diferente da commitada' : 'nenhuma'}); a atualização seguinte seria recusada`);
  }
  for (const rel of candidateFiles.filter((file) => file.startsWith('desk/'))) {
    if (NOT_LOADED_BY_APP.some((pattern) => pattern.test(rel))) continue;
    if (!sameBytes(path.join(installDir, rel), path.join(candidateDir, rel))) problems.push(`arquivo ausente ou diferente: ${rel}`);
  }
  for (const [rel, content] of Object.entries(USER_FILES)) {
    const file = path.join(installDir, rel);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) problems.push(`dado do usuário alterado: ${rel}`);
  }
  return problems;
}

function extractRef(repoRoot, ref, dir) {
  fs.mkdirSync(dir, {recursive: true});
  const tar = execFileSync('git', ['archive', '--format=tar', ref], {cwd: repoRoot, maxBuffer: 1 << 30});
  execFileSync('tar', ['-x', '-C', dir], {input: tar});
}

function seedUserFiles(installDir) {
  for (const [rel, content] of Object.entries(USER_FILES)) {
    fs.mkdirSync(path.dirname(path.join(installDir, rel)), {recursive: true});
    fs.writeFileSync(path.join(installDir, rel), content);
  }
}

function applyAndAudit({repoRoot, fromTag, ref, version, workDir}) {
  const git = (...args) => execFileSync('git', args, {cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28});
  const [previousDir, installDir, candidateDir] = ['anterior', 'instalacao', 'candidata'].map((name) => path.join(workDir, name));
  const zipFile = path.join(workDir, 'candidata.zip');
  extractRef(repoRoot, fromTag, previousDir);
  extractRef(repoRoot, fromTag, installDir);
  extractRef(repoRoot, ref, candidateDir);
  seedUserFiles(installDir);
  git('archive', '--format=zip', `--prefix=mesa-de-estudos-${version}/`, `--output=${zipFile}`, ref);
  const node = (script, ...args) => execFileSync(process.execPath, ['-e', script, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  node(APPLY_WITH_PREVIOUS, path.join(previousDir, 'desk', 'updater.cjs'), zipFile, installDir, version);
  const installedKey = node(READ_INSTALLED_KEY, path.join(installDir, 'desk', 'updater-signature.cjs'), path.join(installDir, 'desk', 'update-signing-key.pub'));
  const expectedKey = fs.readFileSync(path.join(candidateDir, 'desk', 'update-signing-key.pub'), 'utf8');
  const candidateFiles = git('ls-tree', '-r', '--name-only', ref).split('\n').filter(Boolean);
  return {installDir, problems: auditUpdatedInstall({installDir, candidateDir, candidateFiles, version, installedKey, expectedKey})};
}

/* Abre a Mesa atualizada com dados temporários; cair antes do prazo é falha. */
function bootProblem(installDir, workDir) {
  const desk = path.join(installDir, 'desk');
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], {cwd: desk, stdio: 'ignore'});
  const home = path.join(workDir, 'home');
  fs.mkdirSync(home, {recursive: true});
  const env = {...process.env, HOME: home, USERPROFILE: home, LEARNING_DESK_RUNTIME: path.join(workDir, 'runtime')};
  return new Promise((resolve) => {
    const child = spawn(path.join(desk, 'node_modules', '.bin', 'electron'), ['.'], {cwd: desk, env, stdio: 'ignore', detached: true});
    const timer = setTimeout(() => {
      child.removeAllListeners('exit');
      process.kill(-child.pid, 'SIGTERM');
      resolve('');
    }, BOOT_WAIT_MS);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(`a Mesa atualizada fechou sozinha ao abrir (código ${code})`);
    });
  });
}

/**
 * Ensaia a atualização da versão anterior para a candidata, numa pasta temporária.
 * @param {{repoRoot: string, version: string, ref?: string, fromTag?: string, open?: boolean}} input `ref` é a tag ou o commit candidato
 * @returns {Promise<{fromTag: string, problems: string[]}>}
 * @example await rehearseUpdate({repoRoot, version: '1.1.0', fromTag: 'v1.0.2'})
 */
export async function rehearseUpdate({repoRoot, version, ref = `v${version}`, fromTag = '', open = false}) {
  const from = fromTag || previousTagIn(repoRoot, version);
  if (!from) return {fromTag: '', problems: []};
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ensaio-'));
  try {
    const {installDir, problems} = applyAndAudit({repoRoot, fromTag: from, ref, version, workDir});
    if (open && !problems.length) {
      const problem = await bootProblem(installDir, workDir);
      if (problem) problems.push(problem);
    }
    return {fromTag: from, problems};
  } finally {
    fs.rmSync(workDir, {recursive: true, force: true});
  }
}

function previousTagIn(repoRoot, version) {
  const git = (...args) => execFileSync('git', args, {cwd: repoRoot, encoding: 'utf8'}).trim();
  if (git('rev-parse', '--is-shallow-repository') === 'true') {
    throw Error('clone raso não enxerga a versão anterior; rode o ensaio num clone completo');
  }
  return previousReleaseTag(git('tag', '--list').split('\n'), version);
}

function reportRehearsal({fromTag, problems}, version) {
  if (!fromTag) {
    console.log(`ensaio: nenhuma versão anterior a ${version}; nada a ensaiar.`);
    return;
  }
  if (problems.length) throw Error(`ensaio ${fromTag} → ${version} falhou:\n- ${problems.join('\n- ')}`);
  console.log(`ensaio ${fromTag} → ${version}: ok.`);
}

/**
 * Portão do `update:sign`: lança erro se a atualização ensaiada falhar.
 * @param {{repoRoot: string, version: string}} input
 * @returns {Promise<void>}
 * @example await rehearseBeforeSigning({repoRoot, version: '1.1.0'})
 */
export async function rehearseBeforeSigning({repoRoot, version}) {
  reportRehearsal(await rehearseUpdate({repoRoot, version}), version);
}

async function main(argv) {
  const version = String(argv[0] || '').replace(/^v/, '');
  if (!parseSemver(version)) throw Error(`versão inválida: recebido ${JSON.stringify(argv[0] || '')}; esperado vX.Y.Z`);
  const flagValue = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] || '' : '');
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim();
  const result = await rehearseUpdate({repoRoot, version, ref: flagValue('--ref') || `v${version}`, fromTag: flagValue('--de'), open: argv.includes('--abrir')});
  reportRehearsal(result, version);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`update-rehearsal: ${error.message}`);
    process.exitCode = 1;
  });
}
