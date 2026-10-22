'use strict';

/* CLI do backup/compartilhamento (equivalente headless do painel). Serve para
   rodar um backup combinado com o app fechado, conferir versões e ensaiar
   restaurações sem Electron.

   Uso (em `desk/`):
     node scripts/study-backup.mjs status   --runtime <dir> --dest <dir>
     node scripts/study-backup.mjs backup   --runtime <dir> --dest <dir> [--sem-pdfs] [--git <dir>] [--remoto <url>]
     node scripts/study-backup.mjs list     --dest <dir>
     node scripts/study-backup.mjs verify   --dest <dir> [--id <snapshotId>]
     node scripts/study-backup.mjs restore  --runtime <dir> --dest <dir> --id <snapshotId> --sim [--confirmar]
     node scripts/study-backup.mjs prune    --dest <dir> [--guardar N]

   Nada aqui autoriza caminho vindo de outro lugar: os caminhos são argumentos
   do usuário no terminal, e o script usa exatamente os mesmos módulos que o
   app (nenhuma regra paralela). */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const gitBackup = require('../src/study-data/git-backup.cjs');
const {createI18n} = require('../src/i18n.mjs');
const ptBR = require('../locales/pt-BR.json');

/* O terminal fala português, como o resto dos logs (#41): as mensagens marcadas dos módulos viram texto aqui. */
const portuguese = createI18n({catalogs: {'pt-BR': ptBR, en: ptBR}, language: 'pt-BR'}).text;

const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgv(argv) {
  const out = {_command: argv[0] || 'status', _: []};
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      out._.push(token);
      continue;
    }
    const [rawKey, inline] = token.slice(2).split('=');
    const key = rawKey.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    if (['sim', 'confirmar', 'semPdfs', 'js'].includes(key)) {
      out[key] = inline === undefined ? true : inline !== 'false';
      continue;
    }
    const value = inline === undefined ? argv[++i] : inline;
    out[key] = value;
  }
  return out;
}

function requireRuntime(args) {
  const runtime = args.runtime || process.env.LEARNING_DESK_RUNTIME || '';
  if (!runtime) {
    console.error('informe --runtime <pasta do runtime da Mesa>');
    process.exit(2);
  }
  if (!fs.existsSync(runtime)) {
    console.error(`runtime não encontrado: ${runtime}`);
    process.exit(2);
  }
  return path.resolve(runtime);
}

function requireDest(args) {
  const dest = args.dest || process.env.MESA_BACKUP_DIR || '';
  if (!dest) {
    console.error('informe --dest <pasta de backup>');
    process.exit(2);
  }
  return path.resolve(dest);
}

const log = (line) => console.log(`[backup] ${portuguese(String(line))}`);

async function main() {
  const args = parseArgv(process.argv.slice(2));
  const command = args._command;
  const dest = ['list', 'verify', 'prune'].includes(command) ? requireDest(args) : args.dest ? path.resolve(args.dest) : '';
  const runtime = ['backup', 'restore', 'status'].includes(command) ? requireRuntime(args) : args.runtime ? path.resolve(args.runtime) : '';

  if (command === 'status') {
    if (!dest) {
      console.log(JSON.stringify({available: false, reason: 'sem --dest'}, null, 2));
      return;
    }
    const settings = backup.resolveSettings(DESK, {destination: dest});
    console.log(JSON.stringify({
      destination: dest,
      status: backup.readStatus(dest),
      versions: backup.list(dest).length,
      settings: {...settings, destination: dest},
      git: fs.existsSync(path.join(dest, gitBackup.GIT_DIR)) ? gitBackup.api({root: dest, deskDir: DESK}).status() : {available: false},
    }, null, 2));
    return;
  }

  if (command === 'backup') {
    const settings = backup.resolveSettings(DESK, {destination: dest, settings: args.dest ? {destination: dest} : {}});
    const result = await backup.backupNow({
      runtime,
      root: dest,
      deskDir: DESK,
      binaries: args.semPdfs ? 'exclude' : 'include',
      reason: 'manual',
      keep: Number(args.guardar) > 0 ? Number(args.guardar) : settings.keep,
      log,
    });
    console.log(JSON.stringify(result, null, 2));
    if (args.git) {
      const git = gitBackup.api({root: path.resolve(args.git), deskDir: DESK, repoRoot: path.resolve(DESK, '..'), backupRoot: dest});
      const local = git.integrate({
        snapshotDir: result.path,
        manifest: backup.readManifest(result.path),
        remote: args.remoto || '',
        log,
      });
      // --remoto é o pedido explícito de envio na CLI. O app usa seu botão próprio.
      const committed = args.remoto ? {...local, ...git.push({remote: args.remoto, log})} : local;
      console.log(JSON.stringify(committed, null, 2));
      if (!committed.pushed && args.remoto) {
        console.error('[backup] push não concluído; o backup local continua válido');
        process.exitCode = 3;
      }
    }
    return;
  }

  if (command === 'list') {
    const versions = backup.list(dest);
    console.log(JSON.stringify(versions, null, 2));
    return;
  }

  if (command === 'verify') {
    const versions = backup.list(dest);
    const target = args.id ? versions.find((item) => item.snapshotId === args.id) : versions[0];
    if (!target) {
      console.error('nenhuma versão para conferir');
      process.exit(2);
    }
    const report = await backup.verifySnapshot(target.path, {strict: true, log});
    console.log(JSON.stringify({id: target.snapshotId, ...report, manifest: undefined}, null, 2));
    return;
  }

  if (command === 'restore') {
    if (!args.id) {
      console.error('informe --id <snapshotId>');
      process.exit(2);
    }
    const plan = await backup.prepareRestore({runtime, root: dest, snapshotId: args.id, log});
    console.log(JSON.stringify({
      planId: plan.planId,
      entries: plan.entries,
      bytes: plan.bytes,
      replaced: plan.replaced.length,
      created: plan.created.length,
      external: plan.external.length,
      excluded: plan.excluded.length,
      binariesIncluded: plan.binariesIncluded,
    }, null, 2));
    if (args.sim && !args.confirmar) {
      const cancelled = backup.cancelRestore({runtime, planId: plan.planId});
      console.log(JSON.stringify({...cancelled, note: 'simulação: nada foi escrito'}, null, 2));
      return;
    }
    const applied = await backup.applyRestore({runtime, planId: plan.planId, log});
    console.log(JSON.stringify(applied, null, 2));
    return;
  }

  if (command === 'prune') {
    const removed = backup.prune({dest, root: dest, keep: Number(args.guardar) > 0 ? Number(args.guardar) : 10, log});
    console.log(JSON.stringify({removed}, null, 2));
    return;
  }

  console.error(`comando desconhecido: ${command}`);
  process.exit(2);
}

main().catch((error) => {
  console.error(`[backup] falhou: ${portuguese(String(error.message))}`);
  process.exit(1);
});
