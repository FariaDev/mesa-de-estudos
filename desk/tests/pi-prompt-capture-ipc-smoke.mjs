/* Smoke de CONTRATO do contexto de estudo no `pi-prompt` real (preload + main +
   fake Pi). Caso crítico: captura feita ANTES de `desk.studyContext` ser
   desligada. O renderer grava o nome do exercício no anexo (`capture.exercise`);
   com a flag desligada o main não pode enviar esse nome ao motor — a captura
   continua indo (imagem + horário). Ligar a flag em runtime volta a mandar o
   contexto de estudo (matéria + exercício ativo).

   Curso e PDF sintéticos no runtime temporário; fake Pi de teste; nenhum
   material/config/sessão real é tocado. Não usa o índice de teste
   (`npm test` não pega este arquivo): `node tests/pi-prompt-capture-ipc-smoke.mjs`. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from '@playwright/test';
import {testEnv} from './electron-env.mjs';
import {PLOT_PNG, tinyPdf} from './helpers.mjs';

const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FAKE_PI = path.join(DESK, 'tests', 'fake-pi.mjs');
fs.chmodSync(FAKE_PI, 0o755);

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pi-capture-smoke-'));
const courseDir = path.join(runtime, 'learning', 'Courses', 'Synthetic');
fs.mkdirSync(courseDir, {recursive: true});
fs.writeFileSync(path.join(courseDir, 'Lista.pdf'), tinyPdf('Lista', 2));
fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({
  runtimePath: runtime,
  vaultPath: runtime,
  courses: [{id: 'Synthetic', name: 'Matemática sintética', path: courseDir}],
  desk: {studyContext: false},
}));
/* Sessão principal fixa para o fake Pi registrar o que recebeu. O título salvo
   é o exercício ATIVO no momento do teste (é o que o renderer põe no anexo). */
const mainSession = path.join(runtime, 'pi-main.jsonl');
fs.writeFileSync(path.join(runtime, 'desk.json'), JSON.stringify({
  session: mainSession,
  courseId: 'Synthetic',
  study: {title: 'Questão salva', xopp: ''},
}));

const dataUrl = `data:image/png;base64,${PLOT_PNG}`;
const capturedAt = Date.now() - 5 * 60 * 1000;
/* O main formata o horário da captura com o mesmo `toLocaleTimeString('pt-BR')`;
   o processo do teste e o do Electron compartilham a máquina/fuso. */
const timeLabel = new Date(capturedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});

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
const readLastPrompt = () => {
  const lines = fs.readFileSync(mainSession, 'utf8').split('\n').filter(Boolean);
  const content = JSON.parse(lines.at(-1)).message.content;
  return {
    text: content.filter((part) => part?.type === 'text').map((part) => part.text || '').join('\n'),
    images: content.filter((part) => part?.type === 'image').length,
  };
};
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.desk && typeof window.desk.prompt === 'function', undefined, {timeout: 20000});
  await page.waitForSelector('.pdf-panel', {timeout: 20000});

  /* ---- flag desligada: captura antiga não leva o nome do exercício ---- */
  const first = await page.evaluate((payload) => window.desk.prompt(payload), {
    text: 'olha a captura',
    refs: [],
    images: [{dataUrl, capturedAt, exercise: 'Questão secreta'}],
  });
  check('prompt aceito com a flag desligada', first, (value) => value && value.sent !== false);
  const firstPrompt = readLastPrompt();
  check('imagem da captura chegou ao motor', firstPrompt, (value) => value.images === 1);
  check('horário da captura preservado no prompt', firstPrompt, (value) => value.text.includes('captura desta mensagem') && value.text.includes(timeLabel));
  check('nome do exercício do anexo NÃO vai com a flag desligada', firstPrompt, (value) => !value.text.includes('Questão secreta'));
  check('título ativo salvo também não vaza com a flag desligada', firstPrompt, (value) => !value.text.includes('Questão salva'));
  check('matéria não vaza com a flag desligada', firstPrompt, (value) => !value.text.includes('Matemática sintética') && !value.text.includes('- matéria:'));
  check('exercício ativo/rascunho não vão com a flag desligada', firstPrompt, (value) => !value.text.includes('- exercício ativo') && !value.text.includes('- rascunho'));

  /* ---- ligar a flag em runtime volta a mandar o contexto de estudo ---- */
  const cfg = await page.evaluate(() => window.desk.getConfig());
  const enabled = await page.evaluate((next) => window.desk.saveConfig(next), {...cfg.config, desk: {...cfg.config.desk, studyContext: true}});
  check('salvar config liga studyContext no main', enabled.config?.desk, (value) => value.studyContext === true);
  const second = await page.evaluate((payload) => window.desk.prompt(payload), {
    text: 'olha a captura de novo',
    refs: [],
    images: [{dataUrl, capturedAt, exercise: 'Questão salva'}],
  });
  check('prompt aceito com a flag ligada', second, (value) => value && value.sent !== false);
  const secondPrompt = readLastPrompt();
  check('flag ligada: matéria e exercício ativo voltam ao prompt', secondPrompt, (value) => value.text.includes('Matemática sintética') && value.text.includes('Questão salva'));
  check('flag ligada: captura continua com imagem e horário', secondPrompt, (value) => value.images === 1 && value.text.includes(timeLabel));
  check('flag ligada: o nome antigo do anexo não aparece', secondPrompt, (value) => !value.text.includes('Questão secreta'));

  console.log(failed ? 'SMOKE_FALHOU' : 'SMOKE_OK');
} finally {
  await app.close().catch(() => {});
  fs.rmSync(runtime, {recursive: true, force: true});
}
process.exit(failed ? 1 : 0);
