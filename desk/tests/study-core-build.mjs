/* Build temporário dos núcleos novos de estudo (estatísticas e agenda do
   caderno) para os testes de host.

   O fluxo do repositório gera `desk/src/generated/*` com `bun core/build.mjs`
   (o pai faz a geração global). Aqui a mesma toolchain compila SOMENTE os
   módulos pedidos para um diretório em `os.tmpdir()`, com cache por conteúdo, e
   os testes apontam `MESA_STUDYSTATS_CORE` / `MESA_REVIEWSCHEDULE_CORE` para o
   artefato. Nada em `desk/src/generated` é tocado.

   Sem bun ou sem bend, o teste que precisa do núcleo aparece como PULADO com
   o motivo (`studyCoreSkipReason`) — não há fallback silencioso para uma regra
   duplicada em JS, e o `npm test` continua valendo numa máquina sem Bend. */

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {detectToolchain} from '../../core/toolchain.mjs';

const TESTS = dirname(fileURLToPath(import.meta.url));
const DESK = dirname(TESTS);
const CORE = join(DESK, '..', 'core');

export const STUDY_CORES = ['studystats', 'reviewschedule'];

const RUNNER = `import {pathToFileURL} from "node:url";
const [pluginPath, outDir, ...entries] = process.argv.slice(2);
const {default: bendPlugin} = await import(pathToFileURL(pluginPath).href);
const result = await Bun.build({
  entrypoints: entries,
  outdir: outDir,
  target: "browser",
  format: "esm",
  minify: false,
  naming: "[name].core.js",
  plugins: [bendPlugin],
});
if (!result.success) {
  for (const log of result.logs) console.error(String(log));
  process.exit(1);
}
`;

export function requireToolchain() {
  const toolchain = detectToolchain();
  if (!toolchain.bun) throw new Error('bun não encontrado (instale em ~/.bun/bin/bun ou aponte BUN_BIN)');
  if (!toolchain.plugin) throw new Error('bend não encontrado (~/.bend/current/bend2/main.ts)');
  return {bun: toolchain.bun.bin, plugin: toolchain.plugin};
}

/* Motivo do pulo quando a toolchain do Bend não está nesta máquina, ou ''.
   Os testes de host usam no `{skip: ...}` do node:test para a rodada continuar
   (e dizer por quê) em vez de reprovar por falta de bun/bend. */
export function studyCoreSkipReason() {
  const toolchain = detectToolchain();
  if (toolchain.present) return '';
  return `toolchain do Bend ausente (${toolchain.missing.join('; ')})`;
}

/* Compila os módulos pedidos (padrão: os dois novos) para um diretório com
   cache por conteúdo. Devolve os caminhos e as variáveis de ambiente que os
   hosts leem. */
export function buildStudyCores({entries = STUDY_CORES.map((name) => `${name}.bend`), cacheRoot = tmpdir()} = {}) {
  const {bun, plugin} = requireToolchain();
  /* O caminho real, não o do link: `~/.bend/current` troca de versão sem mudar
     de nome, e o cache do 2.0.27 (BigInt) servia ao 2.0.37 depois da #49. */
  const hash = createHash('sha256').update(realpathSync(plugin));
  for (const entry of entries) hash.update(readFileSync(join(CORE, entry)));
  const dir = join(cacheRoot, `mesa-study-core-v2-${hash.digest('hex').slice(0, 16)}`);
  const names = entries.map((entry) => basename(entry, '.bend'));
  const missing = names.some((name) => !existsSync(join(dir, `${name}.core.js`)));
  if (missing) {
    mkdirSync(cacheRoot, {recursive: true});
    const staging = mkdtempSync(join(cacheRoot, 'mesa-study-build-'));
    try {
      /* O artefato é ESM; o `require(...)` dos hosts CJS depende do `type`
         module no diretório (como o build global escreve). */
      writeFileSync(join(staging, 'package.json'), `${JSON.stringify({type: 'module'}, null, 2)}\n`);
      const runner = join(staging, 'build.mjs');
      writeFileSync(runner, RUNNER);
      const result = spawnSync(bun, [runner, plugin, staging, ...entries.map((entry) => join(CORE, entry))], {
        encoding: 'utf8',
        env: {...process.env, BEND_NO_TELEMETRY: '1'},
      });
      if (result.status !== 0 || names.some(name => !existsSync(join(staging, `${name}.core.js`)))) {
        throw new Error(`build do núcleo de estudo falhou: ${result.stdout || ''}${result.stderr || ''}`);
      }
      try { renameSync(staging, dir); }
      catch (error) {
        // Outro processo só pode publicar um conjunto completo. Nunca o apague.
        if (!['EEXIST', 'ENOTEMPTY'].includes(error.code) || names.some(name => !existsSync(join(dir, `${name}.core.js`)))) throw error;
      }
    } finally { rmSync(staging, {recursive: true, force: true}); }
  }
  const corePath = (name) => join(dir, `${name}.core.js`);
  return {
    dir,
    names,
    corePath,
    env: {
      MESA_STUDYSTATS_CORE: corePath('studystats'),
      MESA_REVIEWSCHEDULE_CORE: corePath('reviewschedule'),
    },
  };
}
