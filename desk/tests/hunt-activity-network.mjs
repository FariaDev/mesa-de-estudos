/* Hunt de rede do quadro (#42, parte B): o quadro e a prévia são 100% offline.
   Um servidor HTTP local de prova conta cada pedido que chegar. Um documento do
   "tutor" (Pi sintético, sem modelo) tenta sair por todos os canais — fetch,
   XHR, WebSocket, sendBeacon, EventSource, <script src>, <img src>, new Image,
   <link dns-prefetch|preconnect|prefetch|modulepreload|stylesheet>, <audio src>,
   CSS url() e @import — publicado na conversa e montado na prévia. Também tentamos
   de dentro do quadro vivo (frame.evaluate). Prova: o servidor não recebe NADA,
   nenhum `link` do modelo fica no DOM, e o console da prévia registra cada
   tentativa bloqueada. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree,freezeMotion} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';
import {pollUntil} from './waits.mjs';
import {startLeakProbe} from './leak-probe-server.mjs';

const probe=await startLeakProbe();
const hits=probe.hits;
const NET=probe.url;

try{
 await withArtifacts('hunt-activity-network',async ctx=>{
  ctx.runtime=tempDir('mesa-activity-net');
  fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
  process.env.FAKE_PI_NET_URL=NET;
  const {specFor}=await import('./fixtures/activity-specs.mjs');
  const spec=specFor('rede');
  const mcpLog=path.join(ctx.runtime,'mcp-activity.log');
  const calls=[{name:'criar_atividade',id:'integrated-call-1',input:spec},{name:'previsualizar_atividade',input:spec}];
  ctx.app=await launchDesk({runtime:ctx.runtime,env:{FAKE_OPENCODE_MCP_CALLS:JSON.stringify(calls),FAKE_OPENCODE_MCP_LOG:mcpLog}});
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
  const frame=page.frames().find(f=>f.url().startsWith('mesa-activity://act-'));
  assert.ok(frame,'o quadro montou');
  const live=await frame.evaluate(async url=>{
   const result={};
   result.fetch=await fetch(url+'direto').then(()=>'passou',e=>'bloqueado: '+e.name);
   result.post=await fetch(url+'post',{method:'POST',body:'x'}).then(()=>'passou',e=>'bloqueado: '+e.name);
   result.img=await new Promise(r=>{const i=new Image();i.onload=()=>r('passou');i.onerror=()=>r('bloqueado');i.src=url+'img-direto.png';});
   result.script=await new Promise(r=>{const s=document.createElement('script');s.onload=()=>r('passou');s.onerror=()=>r('bloqueado');try{s.src=url+'script-direto.js';}catch(e){r('bloqueado: '+e.name+' (Trusted Types)');return;}document.head.append(s);});
    result.form=(()=>{try{const f=document.createElement('form');f.action=url+'form';f.method='post';document.body.append(f);f.submit();return 'enviado?';}catch(e){return 'bloqueado: '+e.name;}})();
    result.open=(()=>{try{return window.open(url+'janela')?'abriu':'bloqueado';}catch(e){return 'bloqueado: '+e.name;}})();
     result.links=document.querySelectorAll('link').length;
     /* O próprio nó-link nunca entra: a guarda vira no-op antes do observer
        (que só tiraria depois — tarde para a dica de DNS — e não vê shadow
        root). O DOMParser passa pela política default e já chega sem link; o
        isConnected prova que nada conectou. */
     result.shadowSweep=(()=>{
      const host=document.createElement('div');document.body.append(host);
      const shadow=host.attachShadow({mode:'open'});
      let inserted='sem-no';
      try{
       const parsed=new DOMParser().parseFromString('<link rel="dns-prefetch" href="'+url+'sombra">','text/html');
       const link=parsed.querySelector('link');
       if(link){const ret=shadow.appendChild(link);inserted=ret.isConnected?'conectado':'solto';}
      }catch(e){inserted='recusado: '+e.name;}
      const inDoc=document.querySelectorAll('link').length;
      let inShadows=0;
      document.querySelectorAll('*').forEach(el=>{if(el.shadowRoot)inShadows+=el.shadowRoot.querySelectorAll('link').length;});
      host.remove();
      return {inserted,inDoc,inShadows};
     })();
     return result;
    },NET);
   for(const [channel,status] of Object.entries(live))if(!['form','links','shadowSweep'].includes(channel))assert.match(status,/^bloqueado/,`quadro vivo: ${channel} (${status})`);
   assert.equal(live.links,0,`nenhum link do modelo fica no DOM do quadro vivo (achou ${live.links})`);
   assert.notEqual(live.shadowSweep.inserted,'conectado','link via DOMParser nem chega a conectar na shadow (isConnected prova)');
   assert.equal(live.shadowSweep.inDoc,0,`nenhum link no documento do quadro vivo (achou ${live.shadowSweep.inDoc})`);
   assert.equal(live.shadowSweep.inShadows,0,`nenhum link nas shadow roots do quadro vivo (achou ${live.shadowSweep.inShadows})`);
  await page.waitForTimeout(2500); // espera fixa: "nada passa em 2,5 s" — nenhuma tentativa de rede escapa do quadro vivo

  /* ---- prévia ---- */
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  await page.locator('#prompt').fill('Faça uma previa de rede.');await page.locator('#send').click();
  const previewRows=await pollUntil(()=>{try{return fs.readFileSync(mcpLog,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{return [];}},rows=>rows.length>=2,{timeout:30000,interval:200,what:'a prévia de rede'});
  const preview=previewRows.find(row=>row.name==='previsualizar_atividade');
  assert.ok(preview,`a prévia respondeu (${JSON.stringify(previewRows)})`);
  assert.doesNotMatch(preview.result,/indisponível/i,`a prévia respondeu (${preview.result})`);
  const text=preview.result;
  for(const channel of ['fetch','xhr','script','img','link-externo','link-create','link-criado-fora'])assert.match(text,new RegExp(`${channel} bloqueado`),`prévia: ${channel} bloqueado (${text})`);
  assert.doesNotMatch(text,/ passou/,'nenhum canal passou na prévia');
  await page.waitForTimeout(2500); // espera fixa: "nada passa em 2,5 s" — nenhuma tentativa de rede escapa da prévia

  assert.deepEqual(hits,[],`nenhum pedido chegou ao servidor de prova: ${JSON.stringify(hits)}`);
  assert.deepEqual(errors,[]);
  console.log('quadro vivo:',JSON.stringify(live));
 });
}finally{
 await probe.close();
}
console.log('hunt-activity-network: PASS — quadro publicado e prévia sem nenhum pedido de rede (fetch, XHR, WebSocket, beacon, SSE, script, imagem, link dns-prefetch/preconnect/prefetch/modulepreload/stylesheet, áudio, CSS e @import).');
