// node tests/ggb-offline-ui.mjs — GeoGebra offline (#55), na janela, com a rede fechada.
// O pacote é o falso `fixtures/fake-ggb-pack` (copiado para uma pasta temporária com o
// `pack.json` que o app confere), servido por `mesa-ggb://` como o oficial. Um servidor
// HTTP de prova conta qualquer pedido que escape: o pacote tenta fetch, XHR, <img> e
// <script> para ele e a sessão do applet precisa recusar todos. O Pi de mentira chama a
// ponte REAL da ferramenta do tutor, então a ferramenta funciona sem rede.
// Com MESA_GGB_REAL_PACK=<pasta do pacote oficial já instalado>, a mesma prova roda no
// applet verdadeiro (opcional: o pacote é um download de 32 MB que o teste não faz sozinho).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,freezeMotion,resizeWindow,pageWindow,DESK
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
const require=createRequire(import.meta.url);
const {PACK}=require('../geogebra-pack.cjs');

const REAL_PACK=process.env.MESA_GGB_REAL_PACK||'';
const hits=[];
const server=http.createServer((req,res)=>{hits.push(`${req.method} ${req.url}`);res.writeHead(200,{'content-type':'text/plain','access-control-allow-origin':'*'});res.end('vazou');});
server.on('upgrade',(req,socket)=>{hits.push(`UPGRADE ${req.url}`);socket.destroy();});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const NET=`http://127.0.0.1:${server.address().port}/`;

/** Copia o pacote falso para uma pasta temporária, com o `pack.json` e a URL de prova. */
function fakePackDir(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-ggb-pack-'));
 fs.cpSync(path.join(DESK,'tests/fixtures/fake-ggb-pack'),dir,{recursive:true});
 const web3d=path.join(dir,'GeoGebra/HTML5/5.0/web3d');
 fs.copyFileSync(path.join(DESK,'tests/fixtures/fake-ggb-applet-browser.js'),path.join(web3d,'fake-ggb-applet-browser.js'));
 fs.writeFileSync(path.join(web3d,'net.json'),JSON.stringify({url:NET}));
 fs.writeFileSync(path.join(dir,'pack.json'),JSON.stringify({version:PACK.version,sha256:PACK.sha256}));
 return dir;
}

const out=screenshotDirectory('ggb-offline');
try{
await withArtifacts('ggb-offline',async ctx=>{
 const packDir=REAL_PACK||fakePackDir();
 const runtime=ctx.runtime=newRuntime('ggb-offline');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const piLog=path.join(runtime,'pi-messages.log'),piOut=path.join(runtime,'pi-ggb.log');
 const pi=path.join(DESK,'tests/fixtures/mesa-geogebra-pi.mjs');fs.chmodSync(pi,0o755);
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,LEARNING_DESK_GGB_PACK:packDir,FAKE_PI_GGB_LOG:piLog,FAKE_PI_GGB_OUT:piOut}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});

 const win=await pageWindow(ctx.app,page);
 const inApplet=code=>win.evaluate((bw,source)=>{
  const view=bw.contentView.children.find(child=>child.webContents&&child.webContents!==bw.webContents);
  return view?view.webContents.executeJavaScript(source):null;
 },code);
 const answers=()=>{try{return fs.readFileSync(piOut,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{return [];}};
 const ask=async text=>{
  const before=answers().length;
  await page.locator('#prompt').fill(text);
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  await page.locator('#send').click();
  const list=await pollUntil(async()=>answers(),found=>found.length>before,{timeout:60000,what:`a resposta da ponte para «${text}»`});
  await page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:30000});
  return list[list.length-1].answer;
 };

 /* 1. A ferramenta do tutor abre o applet offline sozinha e roda o comando. */
 await page.locator('#prompt').fill('@geogebra');
 await page.waitForFunction(()=>document.querySelector('#mention-menu').hidden===false,undefined,{timeout:5000});
 await page.keyboard.press('Enter');
 const answer=await ask('ggb: A=(1,2)');
 assert.equal(answer.error,undefined,`a ferramenta funciona sem rede (${JSON.stringify(answer)})`);
 assert.equal(answer.ok,true,'o comando rodou no applet offline');
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});

 /* 2. A view veio do protocolo local e o applet leu o pacote por ele. */
 assert.match(String(await inApplet('location.href')),/^mesa-ggb:\/\/app\/ggb\.html/,'a view carrega o ggb.html pelo mesa-ggb://');
 assert.equal(await inApplet('typeof OFFLINE!=="undefined"&&OFFLINE'),true,'o ggb.html entrou no modo offline');
 const names=String(await inApplet('window.ggbApplet.getAllObjectNames()')).split('\n').filter(Boolean);
 assert.deepEqual(names,['A'],'o objeto do tutor está no applet');
 if(!REAL_PACK){
  const fake=await inApplet('JSON.stringify(window.__fakePack)');
  const info=JSON.parse(fake);
  assert.equal(info.codebase,'mesa-ggb://app/pack/HTML5/5.0/web3d/','o codebase aponta para o pacote local');
  assert.equal(info.offline,true,'e diz ao deployggb.js que é offline');
  assert.deepEqual(info.asset,{ok:true,from:'asset.json do pacote'},'o applet buscou um arquivo do pacote por fetch (mesma origem)');
  /* 3. Tudo que o pacote tentou mandar para fora foi recusado pela sessão do applet. */
  assert.deepEqual(info.net,{fetch:'bloqueado',xhr:'bloqueado',img:'bloqueado',script:'bloqueado'},'o pacote não consegue sair pela rede');
 }
 const live=await inApplet(`(async()=>{
  const r={};
  r.fetch=await fetch(${JSON.stringify(NET)}+'direto',{mode:'no-cors'}).then(()=>'passou',()=>'bloqueado');
  r.beacon=navigator.sendBeacon(${JSON.stringify(NET)}+'beacon','x')?'enviado?':'bloqueado';
  r.ws=await new Promise(res=>{try{const w=new WebSocket(${JSON.stringify(NET.replace('http','ws'))}+'ws');w.onopen=()=>res('passou');w.onerror=()=>res('bloqueado');}catch(e){res('bloqueado');}});
  r.geogebra=await fetch('https://www.geogebra.org/apps/deployggb.js',{mode:'no-cors'}).then(()=>'passou',()=>'bloqueado');
  return r;
 })()`);
 assert.equal(live.fetch,'bloqueado');assert.equal(live.ws,'bloqueado');assert.equal(live.geogebra,'bloqueado','nem o servidor do GeoGebra é chamado');
 await page.waitForTimeout(2000); // espera fixa: "nada passa em 2 s" — nenhuma tentativa de rede escapa
 assert.deepEqual(hits,[],`nenhum pedido chegou ao servidor de prova: ${JSON.stringify(hits)}`);

 /* 4. Ler e a captura (print) também funcionam sem rede. */
 const state=await ask('ggb-estado');
 assert.equal(state.error,undefined,'ler o estado funciona');
 assert.match(String(state.state?.objects||''),/A/,'o estado traz o objeto');
 await reviewShot(page,out,'geogebra-offline.png');
 assert.deepEqual(errors,[],'sem erro de página');
});
}finally{
 server.closeAllConnections?.();
 await new Promise(resolve=>server.close(resolve));
}
console.log(`ggb-offline-ui: PASS — o GeoGebra ${REAL_PACK?'oficial (pacote real)':'(pacote falso)'} abre pelo mesa-ggb:// e a ferramenta do tutor funciona com a rede fechada: nada chegou ao servidor de prova.`);
