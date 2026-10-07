/* Smoke de CONTRATO do menu nativo para a flag `desk.conferir`.
   Regra: `conferir:false` esconde o item "Conferir Xournal++" do menu Estudar
   (e o atalho não é registrado); `save-config` reconstrói o menu na hora, então
   ligar/desligar nas Configurações reflete sem reabrir o app. Os demais itens do
   menu Estudar não dependem da flag.

   Electron real (macOS/Linux/Windows), fake Pi, runtime temporário; o item é
   checado por presença/rótulo — não exige Xournal++ nem captura real. Não usa o
   índice de teste (`npm test` não pega este arquivo):
   `node tests/menu-conferir-ipc-smoke.mjs`. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from '@playwright/test';
import {testEnv} from './electron-env.mjs';
import {tinyPdf} from './helpers.mjs';

const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FAKE_PI = path.join(DESK, 'tests', 'fake-pi.mjs');
fs.chmodSync(FAKE_PI, 0o755);

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-menu-conferir-smoke-'));
const courseDir = path.join(runtime, 'learning', 'Courses', 'Synthetic');
fs.mkdirSync(courseDir, {recursive: true});
fs.writeFileSync(path.join(courseDir, 'Lista.pdf'), tinyPdf('Lista', 1));
fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({
  runtimePath: runtime,
  vaultPath: runtime,
  courses: [{id: 'Synthetic', name: 'Matemática sintética', path: courseDir}],
  desk: {conferir: false},
}));

const app = await electron.launch({
  args: [path.join(DESK, 'main.cjs')],
  cwd: DESK,
  env: testEnv({LEARNING_DESK_RUNTIME: runtime, LEARNING_DESK_PI: FAKE_PI}),
});
let failed = false;
const check = (name, value, predicate) => {
  const ok = predicate(value);
  console.log(`${ok ? 'ok' : 'FALHA'}  ${name}${ok ? '' : ' -> ' + JSON.stringify(value)}`);
  if (!ok) failed = true;
  return ok;
};
const studyMenu = () => app.evaluate(({Menu}) => {
  const menu = Menu.getApplicationMenu();
  const study = menu?.items?.find((item) => item.label === 'Estudar');
  return (study?.submenu?.items || []).map((item) => ({label: item.label, enabled: item.enabled}));
});
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.desk && typeof window.desk.saveConfig === 'function', undefined, {timeout: 20000});
  await page.waitForSelector('.pdf-panel', {timeout: 20000});

  const off = await studyMenu();
  check('conferir=false no config: menu nativo sem "Conferir Xournal++"', off,
    (items) => !items.some((item) => item.label === 'Conferir Xournal++'));
  check('conferir=false: demais itens do menu Estudar continuam', off,
    (items) => ['Conferir GeoGebra', 'Alternar chat', 'Parar'].every((label) => items.some((item) => item.label === label)));

  const cfg = await page.evaluate(() => window.desk.getConfig());
  const enabled = await page.evaluate((next) => window.desk.saveConfig(next), {...cfg.config, desk: {...cfg.config.desk, conferir: true}});
  check('salvar config liga conferir no main', enabled.config?.desk, (value) => value.conferir === true);
  const on = await studyMenu();
  const item = on.find((entry) => entry.label === 'Conferir Xournal++');
  check('salvar config reconstrói o menu com o item (hook buildMenu)', on,
    (items) => items.some((entry) => entry.label === 'Conferir Xournal++'));
  check('item ligado reflete captureAvailable (enabled medido, sem captura real)', item,
    (value) => value && value.enabled === cfg.captureAvailable);

  const disabled = await page.evaluate((next) => window.desk.saveConfig(next), {...cfg.config, desk: {...cfg.config.desk, conferir: false}});
  check('salvar config desliga conferir no main', disabled.config?.desk, (value) => value.conferir === false);
  const offAgain = await studyMenu();
  check('salvar config desliga o item do menu de novo', offAgain,
    (items) => !items.some((entry) => entry.label === 'Conferir Xournal++'));

  console.log(failed ? 'SMOKE_FALHOU' : 'SMOKE_OK');
} finally {
  await app.close().catch(() => {});
  fs.rmSync(runtime, {recursive: true, force: true});
}
process.exit(failed ? 1 : 0);
