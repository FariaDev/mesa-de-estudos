/* Hunt de rede do quadro (#42, parte B): o quadro e a prévia são 100% offline.
   Um servidor HTTP local de prova conta cada pedido que chegar. Um documento do
   "tutor" (Pi sintético, sem modelo) tenta sair por todos os canais — fetch,
   XHR, WebSocket, sendBeacon, EventSource, <script src>, <img src>, new Image,
   <link prefetch>, <audio src>, CSS url() e @import — publicado na conversa e
   montado na prévia. Também tentamos de dentro do quadro vivo (frame.evaluate).
   Prova: o servidor não recebe NADA, e o console da prévia registra cada
   tentativa bloqueada. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,enterFree,freezeMotion} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const hits=[];
const server=http.createServer((req,res)=>{hits.push(`${req.method} ${req.url}`);res.writeHead(200,{'content-type':'text/plain','access-control-allow-origin':'*'});res.end('vazou');});
server.on('upgrade',(req,socket)=>{hits.push(`UPGRADE ${req.url}`);socket.destroy();});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const NET=`http://127.0.0.1:${server.address().port}/`;

try{
 await withArtifacts('hunt-activity-network',async ctx=>{
  ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-net-'));
  const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
  fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
  const out=path.join(ctx.runtime,'preview.json');
  ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi,FAKE_PI_PREVIEW_OUT:out,FAKE_PI_NET_URL:NET}});
  const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await enterFree(page);
  await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
  await freezeMotion(page);
  /* Sanidade: o servidor de prova responde a quem pode chegar nele (o teste). */
  await new Promise((resolve,reject)=>http.get(NET+'sanidade',res=>{res.resume();res.on('end',resolve);}).on('error',reject));
  assert.deepEqual(hits.splice(0),['GET /sanidade'],'o servidor de prova recebe pedidos');

  /* ---- quadro publicado na conversa ---- */
  await page.locator('#prompt').fill('Mostre o teste de rede.');await page.locator('#send').click();
  await page.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
  const frame=page.frames().find(f=>f.url().startsWith('mesa-activity://artifact/'));
  assert.ok(frame,'o quadro montou');
  const live=await frame.evaluate(async url=>{
   const result={};
   result.fetch=await fetch(url+'direto').then(()=>'passou',e=>'bloqueado: '+e.name);
   result.post=await fetch(url+'post',{method:'POST',body:'x'}).then(()=>'passou',e=>'bloqueado: '+e.name);
   result.img=await new Promise(r=>{const i=new Image();i.onload=()=>r('passou');i.onerror=()=>r('bloqueado');i.src=url+'img-direto.png';});
   result.script=await new Promise(r=>{const s=document.createElement('script');s.onload=()=>r('passou');s.onerror=()=>r('bloqueado');try{s.src=url+'script-direto.js';}catch(e){r('bloqueado: '+e.name+' (Trusted Types)');return;}document.head.append(s);});
   result.form=(()=>{try{const f=document.createElement('form');f.action=url+'form';f.method='post';document.body.append(f);f.submit();return 'enviado?';}catch(e){return 'bloqueado: '+e.name;}})();
   result.open=(()=>{try{return window.open(url+'janela')?'abriu':'bloqueado';}catch(e){return 'bloqueado: '+e.name;}})();
   return result;
  },NET);
  for(const [channel,status] of Object.entries(live))if(channel!=='form')assert.match(status,/^bloqueado/,`quadro vivo: ${channel} (${status})`);
  await page.waitForTimeout(2500); // espera fixa: "nada passa em 2,5 s" — nenhuma tentativa de rede escapa do quadro vivo

  /* ---- prévia ---- */
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  await page.locator('#prompt').fill('Faça uma previa de rede.');await page.locator('#send').click();
  await pollUntil(()=>fs.existsSync(out),found=>found,{timeout:30000,interval:200,what:'o arquivo da prévia de rede',onTimeout:'return'});
  const preview=JSON.parse(fs.readFileSync(out,'utf8'));
  assert.equal(preview.error,undefined,`a prévia respondeu (${preview.error})`);
  const text=preview.consoleMessages.map(m=>m.text).join('\n');
  for(const channel of ['fetch','xhr','script','img'])assert.match(text,new RegExp(`${channel} bloqueado`),`prévia: ${channel} bloqueado (${text})`);
  assert.doesNotMatch(text,/ passou/,'nenhum canal passou na prévia');
  await page.waitForTimeout(2500); // espera fixa: "nada passa em 2,5 s" — nenhuma tentativa de rede escapa da prévia

  assert.deepEqual(hits,[],`nenhum pedido chegou ao servidor de prova: ${JSON.stringify(hits)}`);
  assert.deepEqual(errors,[]);
  console.log('quadro vivo:',JSON.stringify(live));
 });
}finally{
 server.closeAllConnections?.();
 await new Promise(resolve=>server.close(resolve));
}
console.log('hunt-activity-network: PASS — quadro publicado e prévia sem nenhum pedido de rede (fetch, XHR, WebSocket, beacon, SSE, script, imagem, prefetch, áudio, CSS e @import).');
