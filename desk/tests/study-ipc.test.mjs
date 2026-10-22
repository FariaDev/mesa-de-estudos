/* Busca e anotações pela IPC REAL do app (main.cjs + preload.cjs + serviços).
 *
 * O pai já ligou `src/study-data/services.cjs` aos canais `study-search*` e
 * `study-notes*`; este teste sobe o app com runtime sintético (matéria
 * `Synthetic`, PDF de verdade, sem Pi conectado) e conversa com
 * `window.desk.studySearch` / `studySearchResolve` / `studyNotesRead` /
 * `studyNotesSave` como o renderer fala.
 *
 * Nenhum material real: runtime em /tmp, config sintético e PDF montado aqui.
 */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ptText} from './pt-text.mjs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from '@playwright/test';
import {createRequire} from 'node:module';
import {testEnv} from './electron-env.mjs';
import {closeApp} from './proc-tree.mjs';

const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FAKE_PI = path.join(DESK, 'tests', 'fake-pi.mjs');
fs.chmodSync(FAKE_PI, 0o755);
const runtimes = [];
const free=createRequire(import.meta.url)('../free-workspaces.cjs');

after(() => {
  for (const dir of runtimes) {
    try {
      fs.rmSync(dir, {recursive: true, force: true});
    } catch { /* já foi */ }
  }
});

test('IPC: busca abre PDF da sessão Livre correta e resultado removido não troca a matéria',async()=>{
 const {runtime}=makeRuntime();
 const workspace=free.createWorkspace(runtime,{sessionId:'busca-livre-antiga',title:'Sessão de álgebra'});
 const source=path.join(runtime,'referencia-livre.pdf');fs.writeFileSync(source,tinyPdf('Marcadorlivre especial'));
 const imported=free.importPdf(runtime,workspace.id,{sourcePath:source,name:'Referência Livre.pdf'});
 const file=imported.material.path;
 const app=await electron.launch({args:[path.join(DESK,'main.cjs')],cwd:DESK,env:testEnv({LEARNING_DESK_RUNTIME:runtime,LEARNING_DESK_PI:FAKE_PI})});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.desk?.studySearch);
  const result=await page.evaluate(()=>window.desk.studySearch({query:'Marcadorlivre',scope:{sources:['pdf']}}));
  const hit=result.hits.find(one=>one.source==='pdf');assert.ok(hit);
  const opened=await page.evaluate(id=>window.desk.studySearchOpen({id}),hit.id);
  assert.equal(opened.data.courseId,'mesa-free');assert.equal(opened.data.workspace.sessionId,workspace.id);
  assert.equal(opened.destination.path,file);assert.ok(opened.data.library.some(item=>item.path===file));
  await page.evaluate(()=>window.desk.switchCourse('Synthetic'));
  fs.rmSync(file);
  const refused=await page.evaluate(id=>window.desk.studySearchOpen({id}).then(()=>null).catch(error=>error.message),hit.id);
  assert.match(ptText(refused),/não encontrado|biblioteca|não.*disponível|não existe/i);
  assert.equal((await page.evaluate(()=>window.desk.init())).courseId,'Synthetic');
  const libre=await page.evaluate(()=>window.desk.studySearch({query:'Sessão de álgebra',scope:{sources:['livre']}}));
  const sessionHit=libre.hits.find(one=>one.source==='livre');assert.ok(sessionHit);
  fs.rmSync(free.workspaceDir(runtime,workspace.id),{recursive:true,force:true});
  const removed=await page.evaluate(id=>window.desk.studySearchOpen({id}).then(()=>null).catch(error=>error.message),sessionHit.id);
  assert.ok(removed);assert.equal((await page.evaluate(()=>window.desk.init())).courseId,'Synthetic');
 }finally{await closeApp(app);}
});

/* PDF de uma página com texto extraível e acento (WinAnsiEncoding). */
function tinyPdf(text) {
  const content = `BT /F1 16 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[4 0 R]/Count 1>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents 5 0 R>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function makeRuntime() {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-study-ipc-'));
  runtimes.push(runtime);
  const courseDir = path.join(runtime, 'learning', 'Courses', 'Synthetic');
  fs.mkdirSync(courseDir, {recursive: true});
  const pdf = path.join(courseDir, 'Limites.pdf');
  fs.writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({
    runtimePath: runtime,
    vaultPath: runtime,
    courses: [{id: 'Synthetic', name: 'Sintética', path: courseDir}],
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(runtime, 'desk.json'), JSON.stringify({courseId: 'Synthetic', courseStates: {}, pdfs: [{path: pdf, page: 1}]}));
  return {runtime, pdf};
}

test('IPC: busca acha o PDF autorizado, resolve a página e as notas persistem', async () => {
  const {runtime, pdf} = makeRuntime();
  const app = await electron.launch({args: [path.join(DESK, 'main.cjs')], cwd: DESK, env: testEnv({LEARNING_DESK_RUNTIME: runtime, LEARNING_DESK_PI: FAKE_PI})});
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.desk?.studySearch);

    const catalog = await page.evaluate(() => window.desk.studySearchCatalog());
    assert.deepEqual(catalog.courses.map((course) => course.id), ['mesa-free', 'Synthetic']);
    assert.equal(catalog.sources.length, 7);

    const found = await page.evaluate(() => window.desk.studySearch({query: 'limites', scope: {sources: ['pdf'], courses: ['Synthetic']}}));
    const hit = found.hits.find((one) => one.source === 'pdf' && one.page === 1);
    assert.ok(hit, 'texto do PDF autorizado veio pela IPC');
    assert.equal(hit.page, 1);
    assert.equal(hit.fileName, 'Limites.pdf');

    const destination = await page.evaluate((id) => window.desk.studySearchResolve({id}), hit.id);
    assert.equal(destination.kind, 'pdf');
    assert.equal(destination.path, pdf);
    assert.equal(destination.page, 1);

    const before = await page.evaluate(() => window.desk.studyNotesRead());
    assert.deepEqual(before.items, []);

    const saved = await page.evaluate((target) => window.desk.studyNotesSave({mode: 'add', item: {
      kind: 'duvida',
      quote: 'Limites e derivadas',
      note: 'revisar a regra',
      ref: {name: 'Limites.pdf', rel: 'Limites.pdf', path: target, page: 1},
    }}), pdf);
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].ref.page, 1);
    assert.equal(saved.scope, 'Synthetic');

    const reread = await page.evaluate(() => window.desk.studyNotesRead());
    assert.equal(reread.items.length, 1);
    assert.equal(reread.items[0].note, 'revisar a regra');

    /* Caminho fora da biblioteca autorizada é recusado pelo host. */
    const refused = await page.evaluate(() => window.desk.studyNotesSave({mode: 'add', item: {quote: 'x', ref: {path: '/etc/hosts', page: 1}}}).then(() => null).catch((error) => error.message));
    assert.match(ptText(String(refused)), /biblioteca autorizada|não está/i);
  } finally {
    await closeApp(app);
  }
});
