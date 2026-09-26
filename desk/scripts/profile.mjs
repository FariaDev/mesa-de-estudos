/* Diagnóstico do contexto efetivo da Mesa: mede o que a sessão realmente
 * carregou e compara com o perfil declarado (desk/profiles.cjs).
 *
 * Uso:
 *   node scripts/profile.mjs              # mede e compara (não altera nada)
 *   node scripts/profile.mjs --json       # saída crua para script/relatório
 *   node scripts/profile.mjs --pinned     # mede COM o perfil fixado ligado
 *
 * O que ele prova: quais ferramentas estão ativas, de qual extensão cada uma
 * vem, e se o conjunto bate com o esperado. O que ele NÃO prova: que um turno
 * do modelo funciona — isso exige uma sessão real com o provedor.
 *
 * Meta por padrão: nada é ligado nem desligado, nenhuma sessão do usuário é
 * tocada (sessão e cwd próprios, em diretório temporário).
 */
import {existsSync, mkdtempSync, rmSync, symlinkSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';

const require = createRequire(import.meta.url);
const desk = dirname(dirname(fileURLToPath(import.meta.url)));
const {resolvePi} = require(join(desk, 'pi.cjs'));
const profile = require(join(desk, 'profiles.cjs'));
const {readConfig} = require(join(desk, 'config.cjs'));

const asJson = process.argv.includes('--json');
const pinned = process.argv.includes('--pinned');

function courseFlag() {
  const index = process.argv.indexOf('--course');
  return index === -1 ? '' : String(process.argv[index + 1] || '');
}

const config = readConfig(readConfigPath()) || {};
const pi = resolvePi({configPath: config.piPath, deskDir: desk, envPath: process.env.LEARNING_DESK_PI || ''});
if (!pi) {
  console.error('Perfil: executável do Pi não encontrado. Rode npm run setup.');
  process.exit(1);
}

function readConfigPath() {
  const dir = process.env.LEARNING_DESK_RUNTIME ??
    (process.platform === 'win32'
      ? join(process.env.APPDATA || '', 'Mesa de Estudos')
      : join(process.env.HOME || '', 'Library', 'Application Support', 'Mesa de Estudos'));
  return join(dir, 'config.json');
}

/* Réplica do workspace do curso: a Mesa roda o Pi dentro de
   `<runtime>/learning/Courses/<matéria>`, com TUTOR/LEARNER/_state/.pi ligados.
   A réplica reproduz isso sem escrever no runtime do app nem tocar na sessão
   que estiver aberta. */
function buildReplica() {
  const root = mkdtempSync(join(tmpdir(), 'mesa-profile-'));
  const vault = config.vaultPath;
  const courses = config.courses || [];
  /* Alemão liga o Anki de propósito (portão do próprio curso), então ele não
     serve de linha de base geral. `--course <id|nome>` escolhe outro. */
  const wanted = courseFlag();
  const course = wanted
    ? courses.find((entry) => [entry?.id, entry?.name].some((value) => String(value || '').toLowerCase() === wanted.toLowerCase()))
    : courses.find((entry) => !/alem/i.test(String(entry?.id || entry?.name || ''))) || courses[0];
  const courseDir = course?.path;
  /* O nome da pasta do curso importa: o portão do Anki (Alemão) e a resolução
     de matéria leem a identidade do diretório. */
  const target = join(root, 'Courses', courseDir ? basename(courseDir) : 'profile');
  if (courseDir && existsSync(courseDir)) {
    for (const name of ['_state.md', 'Sources', 'TUTOR.md', 'LEARNER.md', '.pi']) {
      const source = join(courseDir, name);
      /* Tudo por link, como o próprio `prepareCourse` faz: `Sources` costuma
         apontar para a pasta real de PDFs e copiar seria caro. */
      if (existsSync(source)) link(source, join(target, name), true);
    }
  }
  if (vault && existsSync(vault)) {
    for (const name of ['TUTOR.md', 'LEARNER.md', '.pi']) {
      const source = join(vault, name);
      if (existsSync(source)) link(source, join(root, name), true);
    }
  }
  return {root, cwd: target};
}

function link(source, dest, symbolic) {
  try {
    mkdirSync(dirname(dest), {recursive: true});
    if (symbolic) symlinkSync(source, dest);
  } catch {}
}

function runProbe({cwd, args}) {
  return new Promise((resolve, reject) => {
    const extra = pinned
      ? profile.pinnedArgs({overlayDirs: [join(cwd, '.pi')], settingsPath: join(process.env.HOME || '', '.pi', 'agent', 'settings.json')})
      : [];
    const child = spawn(pi, [
      '--mode', 'rpc',
      '--session', join(cwd, 'profile-session.jsonl'),
      '--approve',
      ...extra,
      '--extension', join(desk, 'scripts', 'probe-tools.ts'),
      ...args,
    ], {
      cwd,
      env: {...process.env, PI_LEARNING_NO_OBSIDIAN: '1', PI_OM_PASSIVE: '1'},
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(Error('A sonda não respondeu a tempo.'));
    }, 60000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = /^PROBE (.*)$/m.exec(stderr);
      if (!match) return;
      clearTimeout(timer);
      try { child.kill(); } catch {}
      try {
        resolve(JSON.parse(match[1]));
      } catch (error) {
        reject(error);
      }
    });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('exit', () => { /* a sonda sai sozinha depois de imprimir */ });
  });
}

const replica = buildReplica();
let measured;
try {
  measured = await runProbe({cwd: replica.cwd, args: []});
} catch (error) {
  console.error(`Perfil: a sonda falhou — ${error.message}`);
  if (replica.root) rmSync(replica.root, {recursive: true, force: true});
  process.exit(1);
}

const {missing, extra} = profile.compare(profile.EXPECTED_ACTIVE, measured.activeTools);
const bySource = new Map();
for (const tool of measured.tools) {
  const source = String(tool.source ?? '(sem origem)').replace(process.env.HOME || '', '~');
  if (!bySource.has(source)) bySource.set(source, []);
  bySource.get(source).push(tool.name);
}

if (asJson) {
  console.log(JSON.stringify({
    pinned,
    cwd: replica.cwd,
    registered: measured.tools.length,
    active: measured.activeTools.length,
    activeTools: measured.activeTools,
    bySource: Object.fromEntries([...bySource].map(([source, names]) => [source, names.sort()])),
    missing,
    extra,
  }, null, 2));
} else {
  console.log(`Perfil da Mesa${pinned ? ' (fixado ligado)' : ''}`);
  console.log(`  workspace medido: curso em réplica temporária`);
  console.log(`  ferramentas registradas: ${measured.tools.length} · ativas: ${measured.activeTools.length}`);
  console.log('');
  console.log('  ativas: ' + measured.activeTools.slice().sort().join(', '));
  console.log('');
  console.log('  por origem:');
  for (const [source, names] of [...bySource].sort()) {
    console.log(`    ${source}`);
    console.log(`      ${names.sort().join(', ')}`);
  }
  console.log('');
  if (missing.length === 0 && extra.length === 0) {
    console.log('  ✓ confere com o perfil declarado em desk/profiles.cjs');
  } else {
    if (missing.length) console.log(`  ✗ ausentes em relação ao perfil: ${missing.join(', ')}`);
    if (extra.length) console.log(`  ? a mais em relação ao perfil: ${extra.join(', ')}`);
    console.log('  (esperado: ferramenta a mais é drift de extensão global; ausente é capacidade perdida)');
  }
  console.log('');
  console.log('  Lembrete: isto mede o que foi carregado, não um turno do modelo.');
}

rmSync(replica.root, {recursive: true, force: true});
process.exit(missing.length ? 1 : 0);
