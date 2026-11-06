/* Prévia do quadro pelo tutor (#42), de ponta a ponta e sem modelo: o fake do
   OpenCode chama `previsualizar_atividade` no MCP real da Mesa e o texto que o
   tutor recebe traz a medida, o console e o `previaId` da janela offline. Prova
   que a largura pedida vale, que sem largura vale a da coluna de resposta, que
   um erro no documento volta com a linha, e que a prévia não publica nada na
   conversa nem no disco. O PNG e a altura são cobertos pela mesma ponte em
   `activity-bridge.test.mjs`/`activity-tools.test.mjs` (o print vai como imagem
   ao modelo, não no texto que a janela enxerga). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';
import {layoutStable,pollUntil} from './waits.mjs';
import {specFor} from './fixtures/activity-specs.mjs';

await withArtifacts('activity-preview-ui',async ctx=>{
 ctx.runtime=tempDir('mesa-activity-preview');
 const out=path.join(ctx.runtime,'preview.jsonl');
 /* Uma chamada MCP por prompt, na ordem: largura pedida, largura padrão e
    documento com erro. */
 const calls=[
  {name:'previsualizar_atividade',input:{...specFor('grafico'),width:390,theme:'escuro'}},
  {name:'previsualizar_atividade',input:{...specFor('grafico')}},
  {name:'previsualizar_atividade',input:{...specFor('grafico'),width:390,theme:'escuro',
    js:'document.querySelector("#nada").textContent="x";'}},
 ];
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{FAKE_OPENCODE_MCP_CALLS:JSON.stringify(calls),FAKE_OPENCODE_MCP_LOG:out}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 const columnNow=()=>page.evaluate(()=>{const m=document.querySelector('#messages'),s=getComputedStyle(m);return Math.round(m.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight));});
 const readResult=()=>{try{return JSON.parse(fs.readFileSync(out,'utf8').trim().split('\n').at(-1)).result;}catch{return '';}};
 const lineCount=()=>{try{return fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).length;}catch{return 0;}};
 const ask=async text=>{
  const before=lineCount();
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
  await pollUntil(lineCount,count=>count>before,{timeout:60000,interval:200,what:`o resultado (${text})`});
  return readResult();
 };

 /* ---- largura pedida, medida, console e previaId ---- */
 const graphic=await ask('Faça uma prévia do quadro.');
 assert.match(graphic,/Prévia em 390px \(escuro\): o conteúdo pede \d+px de altura/);
 assert.match(graphic,/previaId "prv-[a-z0-9]{8,24}"/,'a prévia devolve o id curto para publicar');
 assert.match(graphic,/\[log\] pontos 7/,'console.log volta ao tutor');
 assert.match(graphic,/Console \(\d+\):/,'o console do documento volta ao tutor');

 /* ---- sem largura pedida, vale a da coluna de resposta ---- */
 /* O turno muda a própria cena: a barra de rolagem aparece e tira 15 px, e
    o host usa a última coluna que o ResizeObserver→IPC reportou — a de
    antes (report atrasado, Mac rodada 4b) ou a de depois, já assentada.
    Mede as duas pontas e aceita a que a prévia usou; default (360) ou
    resto do turno anterior (390) não batem com nenhuma. */
 let lastColumn=-1;
 const settleColumn=()=>pollUntil(columnNow,width=>{const same=width===lastColumn;lastColumn=width;return same;},{timeout:3000,interval:100,what:'a largura da coluna assentar'});
 const columnBefore=await settleColumn();
 const plain=await ask('Prévia na largura padrão.');
 const previewed=Number(/Prévia em (\d+)px \(claro\)/.exec(plain)?.[1]);
 await layoutStable(page,'#messages .message:last-child');
 lastColumn=-1;
 const columnAfter=await settleColumn();
 const nearBefore=Math.abs(previewed-columnBefore)<4,nearAfter=Math.abs(previewed-columnAfter)<4;
 assert.ok(nearBefore||nearAfter,`a largura padrão é a do texto da resposta (antes ${columnBefore}, depois ${columnAfter}): ${plain}`);

 /* ---- documento com erro: o console devolve a exceção, com a linha ---- */
 const broken=await ask('Faça uma prévia com erro.');
 const failed=[...broken.matchAll(/- \[(error|warning|log|info)\] (.*)/g)].filter(match=>match[1]==='error');
 assert.ok(failed.length,'a exceção aparece no console devolvido');
 assert.match(broken,/Cannot set properties of null/);
 assert.match(broken,/linha \d+/,'com a linha');

 assert.equal((await page.evaluate(()=>window.desk.activityList())).items.length,0,'a prévia não publica atividade');
 assert.equal(await page.locator('.activity-slot').count(),0,'nada apareceu na conversa');
 assert.deepEqual(errors,[]);
 console.log('activity-preview-ui: PASS — prévia real devolve medida, console e log e previaId, na largura pedida ou na da coluna, com o erro e a linha, sem publicar nada.');
});
