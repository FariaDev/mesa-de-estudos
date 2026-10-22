/* Hunt de isolamento do runtime REAL (Electron sintético): todos os vetores de
   criação de subframe do artefato (HTML cru, srcdoc por propriedade/atributo,
   innerHTML/outerHTML/insertAdjacentHTML, document.write, DOMParser, Range,
   template, createElementNS, setHTML(Unsafe), declarative shadow DOM por
   setHTMLUnsafe/parseHTMLUnsafe/createHTMLDocument/shadowRoot, clone/import,
   execCommand, data:, about:blank) não podem criar realm filho nem emitir
   UDP/STUN; a CSP continua barrando HTTP; e DOM/SVG/canvas/shadow DOM legítimos
   seguem funcionando.

   Uso: node tests/hunt-activity-isolation.mjs */
import {_electron as electron} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(here, '..');
const MAIN = path.join(here, 'fixtures', 'activity', 'isolation-main.cjs');
let failures = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${label}`);
  } else {
    failures += 1;
    console.log(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const app = await electron.launch({args: [MAIN], cwd: DESK, env: testEnv()});
try {
  await app.firstWindow();
  const started = Date.now();
  let ready = false;
  while (Date.now() - started < 20000 && !ready) {
    ready = await app.evaluate(() => !!global.__iso).catch(() => false);
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 150)); // espera fixa: intervalo do próprio polling
  }
  check('fixture de isolamento pronta', ready);
  if (!ready) throw new Error('fixture não inicializou');
  const names = await app.evaluate(() => global.__iso.names());
  check('fixture publicou os vetores e o spec legítimo', names.length >= 20 && names.includes('legit'), String(names.length));
  const dsdClass = ['dsd-setHTMLUnsafe', 'dsd-shadowRoot-setHTMLUnsafe', 'dsd-static-parseHTMLUnsafe', 'dsd-createHTMLDocument-setHTMLUnsafe', 'dsd-setHTMLUnsafe-policy', 'dsd-closed-setHTMLUnsafe', 'dsd-clonable-setHTMLUnsafe', 'dsd-import-parseHTMLUnsafe', 'dsd-sanitizer-options', 'dsd-poisoned', 'dsd-domparker', 'dsd-contextual-fragment', 'dsd-static-parseHTML'];
  check('hunt cobre a classe DSD completa (5 originais + closed/clonable/import/options/poison)', dsdClass.every((name) => names.includes(name)), JSON.stringify(names.filter((name) => !dsdClass.includes(name))));

  for (const name of names) {
    if (name === 'legit') continue;
    const result = await app.evaluate((_electron, vector) => global.__iso.run(vector), name);
    const probes = result.probes || [];
    const childRan = probes.some((probe) => probe && probe.probe === 'childRan');
    const gathering = probes.some((probe) => probe && probe.probe === 'childGathering');
    const childFrame = (result.frames || []).filter((frame) => frame.url.startsWith('about:srcdoc'));
    const frameCount = (result.frames || []).length;
    const httpHits = Object.values(result.http || {}).reduce((total, value) => total + (Number(value) || 0), 0);
    check(`vetor ${name}: sem realm filho executando`, !childRan && !gathering && childFrame.length === 0 && frameCount <= 2, JSON.stringify({probes: probes.map((p) => p && p.probe), frames: frameCount, childFrame}));
    check(`vetor ${name}: UDP/STUN zero`, result.udp === 0, JSON.stringify(result.udpDetail));
    check(`vetor ${name}: HTTP zero`, httpHits === 0, JSON.stringify(result.http));
    check(`vetor ${name}: host responsivo`, result.hostResponsive === true);
  }

  /* Vetores específicos de escape precisam reportar o bloqueio esperado. */
  const openResult = await app.evaluate((_electron) => global.__iso.run('escape-window-open'));
  check('window.open devolve null', openResult.probes.some((p) => p && p.probe === 'windowOpen' && p.detail === 'null'), JSON.stringify(openResult.probes));
  const parentDoc = await app.evaluate((_electron) => global.__iso.run('escape-parent-document'));
  check('acesso ao documento do topo é bloqueado pela origem opaca', parentDoc.probes.some((p) => p && p.probe === 'parentDocument' && p.detail !== 'true'), JSON.stringify(parentDoc.probes));
  const evalResult = await app.evaluate((_electron) => global.__iso.run('escape-eval'));
  check('eval não executa', evalResult.probes.some((p) => p && p.probe === 'evalBlocked') && !evalResult.probes.some((p) => p && p.probe === 'evalRan'), JSON.stringify(evalResult.probes));

  /* Script inline no html do modelo é inerte: nada de htmlScriptRan. */
  const htmlScript = await app.evaluate((_electron) => global.__iso.run('html-script'));
  check('script inline no html não executa', !(htmlScript.probes || []).some((probe) => probe && probe.probe === 'htmlScriptRan'), JSON.stringify(htmlScript.probes));
  check('spec com script inline não cria filho', !(htmlScript.frames || []).some((frame) => frame.url.startsWith('about:srcdoc')), JSON.stringify(htmlScript.frames));

  /* Spec legítimo: DOM, SVG, canvas e sinks de HTML seguem funcionando. */
  const legit = await app.evaluate((_electron) => global.__iso.run('legit', 3000));
  const legitProbe = (legit.probes || []).find((probe) => probe && probe.probe === 'legit');
  check('DOM/SVG/canvas/template/insertAdjacentHTML/innerHTML/shadow legítimos funcionam', !!(legitProbe && legitProbe.detail && legitProbe.detail.dom && legitProbe.detail.svg && legitProbe.detail.canvas && legitProbe.detail.html && legitProbe.detail.template && legitProbe.detail.adjacent && legitProbe.detail.shadow && legitProbe.detail.closed), JSON.stringify(legitProbe));
  check('spec legítimo não cria subframe', !(legit.probes || []).some((probe) => probe && probe.probe === 'childRan'), JSON.stringify(legit.frames));
  const navLog = await app.evaluate(() => global.__iso.navLog());
  check('nenhuma navegação de subframe escapou', !navLog.some((entry) => /about:srcdoc|data:text\/html/.test(String(entry.url || ''))), JSON.stringify(navLog));
} finally {
  await app.evaluate(() => global.__iso.cleanup()).catch(() => {});
  await app.close().catch(() => {});
}
console.log(failures === 0 ? 'HUNT ACTIVITY ISOLATION: PASSOU' : `HUNT ACTIVITY ISOLATION: ${failures} FALHA(S)`);
if (failures > 0) process.exitCode = 1;
