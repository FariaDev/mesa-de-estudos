/* Quais arquivos cada corredor roda: uma fonte só para `run-ui`, `run-hunts` e
   para o `ui-waits.test.mjs`, que conta as esperas fixas nos mesmos arquivos.

   `npm run ui`: os `*-ui.mjs` (menos `hunt-*`, que são do `npm run hunts`), os
   `*-ipc-smoke.mjs`, o `ui-smoke.mjs` e os poucos arquivos nomeados abaixo.
   Ficam de fora, por motivo declarado:
   - `claude-*` e afins: têm corredor próprio (`npm run test:claude-ui`);
   - os que usam o Pi REAL ou o app instalado (`subjects-ui`, `session-switch`,
     `app-smoke`, `watchdog-ui`, `performance-smoke`, `smoke-x3`): são opt-in,
     cada um com o seu `npm run test:*`;
   - `packaged-app-ui` (#51): monta o bundle .app numa pasta temporária (só
     macOS, ~300 MB clonados); roda com `npm run test:packaged`.
   `npm run hunts`: `hunt-*.mjs`, menos `hunt-pi.mjs`, que NÃO é caça: é o Pi de
   mentira que os outros hunts sobem como `LEARNING_DESK_PI` (sozinho espera
   prompt para sempre). */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));

const OWN_RUNNER=new Set(['claude-ui-smoke.mjs','claude-controls-ui.mjs','claude-lifecycle-ui.mjs','claude-host-recovery.mjs','claude-offline-queue-ui.mjs','sidechat-claude-recoverable-ui.mjs','mesa-claude-activity-ui.mjs','claude-executable-upgrade-ui.mjs','claude-version-range-ui.mjs']);
const OPT_IN=new Set(['packaged-app-ui.mjs','subjects-ui.mjs','watchdog-ui.mjs','app-smoke.mjs','performance-smoke.mjs','smoke-x3.mjs','session-switch.mjs','run-ui.mjs','run-claude-ui.mjs']);
const NAMED=new Set(['study-backup-e2e.mjs','sidechat-draft-reload.mjs','sidechat-ui-races.mjs','timeline-late.mjs','timeline-noid.mjs','pdf-rotation.mjs']);
const HUNT_MOCKS=new Set(['hunt-pi.mjs']);

const uiPicks=f=>!f.startsWith('hunt-')&&(/(-ui|-ipc-smoke)\.mjs$/.test(f)||f==='ui-smoke.mjs'||NAMED.has(f));
const matches=(file,match)=>match.split(',').some(m=>file.includes(m));

/** Testes de janela de `npm run ui`; `match` filtra por trecho do nome (vírgula separa). */
export function uiFiles(match=''){
 return fs.readdirSync(here).filter(f=>uiPicks(f)&&!OWN_RUNNER.has(f)&&!OPT_IN.has(f)&&matches(f,match)).sort();
}

/** Hunts de `npm run hunts`; `match` filtra como em `uiFiles`. */
export function huntFiles(match=''){
 return fs.readdirSync(here).filter(f=>/^hunt-.*\.mjs$/.test(f)&&!HUNT_MOCKS.has(f)&&matches(f,match)).sort();
}
