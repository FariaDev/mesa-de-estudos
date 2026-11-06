// Guarda `file:` da sessão principal (rodada 2026-11): nega por padrão e
// aceita só os arquivos estáticos do app. Mede o carregamento, sem registrar
// `onBeforeRequest` próprio (um registro posterior substituiria a guarda: o
// Electron guarda um só por evento). `video`, `audio`, `link stylesheet` e
// `object` com `file:` fora do permitido são cancelados (`requestfailed` com
// ERR_BLOCKED_BY_CLIENT); o estático carrega.
// Roda: `node tests/session-file-guard-ui.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline} from './helpers.mjs';

const OUTSIDE = '/tmp/mesa-review/outside-guard.css';
/* O /tmp é tmpfs: depois de um reboot a pasta não existe (portões de 2026-11-06). */
fs.mkdirSync('/tmp/mesa-review', {recursive: true});
fs.writeFileSync(OUTSIDE, '#guard-probe-div{color:rgb(1, 2, 3)}');
const OUTSIDE_PNG = '/tmp/mesa-review/marker.png';
if (!fs.existsSync(OUTSIDE_PNG)) {
  fs.writeFileSync(OUTSIDE_PNG, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
}

await withArtifacts('session-file-guard',async ctx=>{
  const runtime=ctx.runtime=newRuntime('session-file-guard');
  const course=seedCourse(runtime,'calc');
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  const session=seedNativeSession(runtime,[
    {role:'user',content:[{type:'text',text:'oi'}]},
    {role:'assistant',content:[{type:'text',text:'ok'}]},
  ],{courseId:'calc',started:Date.now()-3600000,preview:'oi'});
  writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
  const page=await app.firstWindow();
  const errors=[];
  page.on('pageerror',(error)=>errors.push(String(error)));
  const failed=[];
  page.on('requestfailed',(request)=>failed.push({url:request.url(),type:request.resourceType(),failure:request.failure()?.errorText||''}));
  await statusOnline(page);
  await page.waitForSelector('#messages .message.assistant',{timeout:30000});
  const facts=await page.evaluate(async ({outside, outsidePng})=>{
    const load=(element)=>new Promise((resolve)=>{
      let done=false;
      const fin=(outcome)=>{if(done)return;done=true;resolve(outcome);};
      element.addEventListener('load',()=>fin('load'));
      element.addEventListener('error',()=>fin('error'));
      setTimeout(()=>fin('timeout'),4000);
    });
    const out={};
    const imgOut=new Image();
    const imgOutP=load(imgOut,'file://'+outsidePng);
    document.body.append(imgOut);
    imgOut.src='file://'+outsidePng;
    out.imgOutside=await imgOutP;
    out.imgOutsideWidth=imgOut.naturalWidth;
    imgOut.remove();
    const video=document.createElement('video');
    const videoP=load(video);
    document.body.append(video);
    video.src='file://'+outsidePng;
    out.video=await videoP;
    out.videoReady=video.readyState;
    video.remove();
    const audio=document.createElement('audio');
    const audioP=load(audio);
    document.body.append(audio);
    audio.src='file://'+outsidePng;
    out.audio=await audioP;
    audio.remove();
    const probe=document.createElement('div');
    probe.id='guard-probe-div';
    probe.textContent='X';
    document.body.append(probe);
    const link=document.createElement('link');
    link.rel='stylesheet';
    const linkP=load(link);
    document.head.append(link);
    link.href='file://'+outside;
    out.link=await linkP;
    // espera fixa: a folha bloqueada resolve no evento error; a pausa deixa o sheet assentar
    await new Promise((resolve)=>setTimeout(resolve,600));
    /* Bloqueado, o Chromium ainda expõe um `sheet` vazio (`cssRules`
       ilegível): o sinal é o evento `error` mais zero regras. */
    out.linkSheet=!!link.sheet;
    try{out.linkRules=link.sheet?link.sheet.cssRules.length:'no-sheet';}
    catch{out.linkRules='blocked';}
    out.linkColor=getComputedStyle(probe).color;
    link.remove();
    probe.remove();
    const object=document.createElement('object');
    object.data='file://'+outsidePng;
    document.body.append(object);
    // espera fixa: o object cancelado nunca carrega; a pausa prova que nada chega
    await new Promise((resolve)=>setTimeout(resolve,1200));
    let objectDoc;
    try{objectDoc=object.contentDocument?object.contentDocument.body?.textContent?.slice(0,20):null;}catch{objectDoc='blocked';}
    out.objectDoc=objectDoc;
    object.remove();
    window.__guardProbeScript=false;
    const script=document.createElement('script');
    script.src='file://'+outsidePng;
    document.head.append(script);
    // espera fixa: o script cancelado nunca executa; a pausa prova que nada roda
    await new Promise((resolve)=>setTimeout(resolve,800));
    out.scriptLoaded=window.__guardProbeScript;
    script.remove();
    return out;
  },{outside:OUTSIDE, outsidePng:OUTSIDE_PNG});
  /* Controle honesto: o estático do app carrega na mesma janela. */
  const control=await page.evaluate(async ()=>{
    const img=new Image();
    document.body.append(img);
    const result=await new Promise((resolve)=>{
      img.addEventListener('load',()=>resolve({loaded:true,width:img.naturalWidth}));
      img.addEventListener('error',()=>resolve({loaded:false,width:0}));
      setTimeout(()=>resolve({loaded:false,timeout:true,width:img.naturalWidth}),8000);
      img.src=new URL('assets/mesa-1024.png',location.href).href;
    });
    img.remove();
    return result;
  });
  const outsideFails=failed.filter((entry)=>entry.url.includes('/tmp/mesa-review/'));
  assert.equal(facts.imgOutside,'error',`img fora do app carregou: ${JSON.stringify(facts)}`);
  assert.equal(facts.imgOutsideWidth,0,'img fora do app tem largura');
  assert.equal(facts.video,'error',`video fora do app carregou: ${JSON.stringify(facts.video)}`);
  assert.equal(facts.videoReady,0,'video fora do app avançou');
  assert.equal(facts.audio,'error',`audio fora do app carregou: ${JSON.stringify(facts.audio)}`);
  assert.equal(facts.link,'error',`stylesheet fora do app não deu error: ${JSON.stringify(facts.link)}`);
  assert.ok(facts.linkRules===0||facts.linkRules==='blocked'||facts.linkRules==='no-sheet',`stylesheet fora do app entrou: ${JSON.stringify(facts.linkRules)}`);
  assert.notEqual(facts.linkColor,'rgb(1, 2, 3)',`CSS fora do app aplicou: ${facts.linkColor}`);
  assert.ok(facts.objectDoc===null||facts.objectDoc==='blocked',`object fora do app leu: ${JSON.stringify(facts.objectDoc)}`);
  assert.equal(facts.scriptLoaded,false,'script fora do app executou');
  assert.ok(outsideFails.length>=4,`faltam cancels da guarda: ${JSON.stringify(failed)}`);
  for (const entry of outsideFails) {
    assert.match(entry.failure,/BLOCKED_BY_CLIENT/,`cancel fora da guarda (${entry.type}): ${entry.failure}`);
  }
  assert.ok(control.loaded===true&&control.width>0,`controle estático não carregou: ${JSON.stringify(control)}`);
  assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
  await app.close();ctx.app=null;
});
console.log('session-file-guard-ui: ok');
