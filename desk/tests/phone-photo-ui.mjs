/* Foto do celular (#36), na janela. Um cliente HTTP do teste faz o papel do
   celular contra o servidor de verdade (forçado em 127.0.0.1 pelo modo de
   teste). Nos dois temas, em 1440×900 e 900×650:
   - o botão fica logo depois do Anexar e abre o popover para cima, dentro da
     coluna do tutor, com o QR code, o endereço e "Esperando o celular…";
   - duas fotos enviadas entram na bandeja de anexos, com o aviso "Foto do
     celular anexada" e "2 fotos recebidas", e nenhuma mensagem sai (nem fala
     na sessão nem prompt no Pi falso);
   - a foto com EXIF de rotação 6 chega em pé (metade vermelha em cima) e sem
     EXIF nem GPS;
   - Esc fecha o popover e o servidor some (a conexão é recusada).
   Por fim, a página do celular numa janela de 375×812, nos dois temas: cabe
   sem rolagem lateral, botões de tocar com 44 px ou mais, e enviar pela
   galeria da própria página põe as fotos na bandeja. Nos três estados da #66,
   o personagem certo do trio (pelo contrato de `mascoteMarkup`: classe
   `mascote-<id>` e `data-humor`): ∫ normal no início, Σ pensando enviando e
   ∇ aflito sem conexão; com movimento reduzido, o personagem fica parado.
   Nenhuma violação de CSP no console do celular.
   Capturas só com MESA_REVIEW_SHOTS. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {nextFrames,pollUntil} from './waits.mjs';
import {syntheticJpeg,withExif,syntheticPng,GPS_MARK} from './phone-photo-fixtures.mjs';

const out=screenshotDirectory('phone-photo');

const post=(url,body,type)=>fetch(`${url}/photo`,{method:'POST',body,headers:{'Content-Type':type}});
const trayCount=page=>page.evaluate(()=>document.querySelectorAll('#attachments .attachment').length);
const clearTray=page=>page.evaluate(async()=>{(await import('./src/chat-attachments.mjs')).clearAttachments();});

async function openPop(page){
 await page.locator('#phone-photo').click();
 await page.waitForFunction(()=>/^http:\/\/127\.0\.0\.1:\d+\/[\w-]{24}$/.test(document.querySelector('#phone-address')?.textContent||''));
 await nextFrames(page,3);
 return page.evaluate(()=>{
  const rect=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
  const button=document.querySelector('#phone-photo');
  return {
   url:document.querySelector('#phone-address').textContent,
   state:document.querySelector('#phone-state').textContent,
   pop:rect(document.querySelector('#phone-pop')),qr:rect(document.querySelector('#phone-qr svg')),
   button:rect(button),chat:rect(document.querySelector('#chat')),vh:innerHeight,
   previous:button.previousElementSibling?.id,label:button.getAttribute('aria-label'),
   expanded:button.getAttribute('aria-expanded'),
  };
 });
}

/* A miniatura da bandeja: tamanho, cor em cima e embaixo, e se ainda há EXIF/GPS nos bytes. */
const inspectAttachment=(page,at)=>page.evaluate(async([at,mark])=>{
 const img=document.querySelectorAll('#attachments .attachment img')[at];
 await img.decode();
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const pixel=(x,y)=>[...ctx.getImageData(x,y,1,1).data].slice(0,3);
 const bytes=atob(img.src.split(',')[1]);
 return {width:img.naturalWidth,height:img.naturalHeight,top:pixel(img.naturalWidth/2,4),bottom:pixel(img.naturalWidth/2,img.naturalHeight-4),exif:bytes.includes('Exif'),gps:bytes.includes(mark),alt:img.alt};
},[at,GPS_MARK]);
const reddish=([r,g,b])=>r>150&&g<90&&b<90;

/* A página do celular (#66): o estado e quem do trio está à vista. */
const phoneView=phone=>phone.evaluate(()=>{
 const shown=[...document.querySelectorAll('.mascote')].filter(el=>el.getBoundingClientRect().width>0);
 return {
  state:document.querySelector('main').dataset.state,
  cast:shown.map(el=>({id:[...el.classList].find(c=>/^mascote-(integral|sigma|nabla)$/.test(c)),humor:el.dataset.humor,width:Math.round(el.getBoundingClientRect().width)})),
  scroll:document.documentElement.scrollWidth,vw:innerWidth,
 };
});
/* Durações dos laços do personagem à vista: piscar e o laço do humor. */
const castMotion=phone=>phone.evaluate(()=>{
 const el=[...document.querySelectorAll('.mascote')].find(m=>m.getBoundingClientRect().width>0);
 return ['.tr-lid','.mascote-jump','.tr-question'].map(sel=>getComputedStyle(el.querySelector(sel)).animationDuration);
});
async function expectCast(phone,state,cast,label){
 const view=await phoneView(phone);
 assert.equal(view.state,state,`${label}: estado`);
 assert.deepEqual(view.cast,[cast],`${label}: personagem à vista`);
 assert.ok(view.scroll<=view.vw,`${label}: sem rolagem lateral (${view.scroll} × ${view.vw})`);
 await phone.emulateMedia({reducedMotion:'reduce'});
 assert.deepEqual(await castMotion(phone),['0s','0s','0s'],`${label}: com movimento reduzido o personagem fica parado`);
 await phone.emulateMedia({reducedMotion:'no-preference'});
 assert.notEqual((await castMotion(phone))[0],'0s',`${label}: sem a preferência, ele pisca`);
}
const INTEGRAL={id:'mascote-integral',humor:'normal',width:92},SIGMA={id:'mascote-sigma',humor:'pensando',width:92},NABLA={id:'mascote-nabla',humor:'aflita',width:140};
const bluish=([r,,b])=>b>150&&r<90;

await withArtifacts('phone-photo',async ctx=>{
 const runtime=ctx.runtime=newRuntime('phone-photo');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[],study:{title:'',xopp:''}}}});
 const prompts=path.join(runtime,'prompts-recebidos.jsonl');
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PHONE_HOST:'127.0.0.1',FAKE_PI_QUEUE_LOG:prompts}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 await statusOnline(page);
 await freezeMotion(page);

 for(const [width,height] of [[1440,900],[900,650]]){
  await resizeWindow(ctx.app,page,width,height,{content:true});
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const label=`${theme} ${width}×${height}`;
   await clearTray(page);

   /* Popover: logo depois do Anexar, para cima, dentro da coluna, com QR e estado. */
   const m=await openPop(page);
   assert.equal(m.previous,'attach',`${label}: o botão vem logo depois do Anexar`);
   assert.equal(m.label,'Foto do celular',`${label}: nome acessível`);
   assert.equal(m.expanded,'true',`${label}: aria-expanded`);
   assert.equal(m.state,'Esperando o celular…',`${label}: estado inicial`);
   assert.ok(m.pop.bottom<=m.button.top+0.5,`${label}: abre para cima do botão (${m.pop.bottom} × ${m.button.top})`);
   assert.ok(m.pop.left>=m.chat.left-0.5&&m.pop.right<=m.chat.right+0.5,`${label}: dentro da coluna do tutor`);
   assert.ok(m.pop.top>=0,`${label}: não sai pelo topo da janela (${m.pop.top})`);
   assert.ok(m.qr.width>=150&&Math.abs(m.qr.width-m.qr.height)<1,`${label}: QR quadrado e legível (${m.qr.width}×${m.qr.height})`);
   await reviewShot(page,out,`popover-${theme}-${width}.png`);

   /* O "celular": duas fotos, a primeira com EXIF de rotação 6 e GPS. */
   assert.equal((await post(m.url,withExif(syntheticJpeg(),{orientation:6}),'image/jpeg')).status,201);
   assert.equal((await post(m.url,syntheticPng({w:40,h:20}),'image/png')).status,201);
   await pollUntil(()=>trayCount(page),n=>n===2,{what:`${label}: duas fotos na bandeja`});
   await page.waitForFunction(()=>document.querySelector('#phone-state').textContent==='2 fotos recebidas');
   /* Regressão (ajustes pós-41): o toast "Foto do celular anexada" cobria o popover; aberto, é o estado dele que confirma. */
   assert.equal(await page.locator('#toast .toast-item',{hasText:'Foto do celular anexada'}).count(),0,`${label}: sem toast por cima do popover aberto`);
   const rotated=await inspectAttachment(page,0);
   assert.deepEqual([rotated.width,rotated.height],[32,64],`${label}: a rotação 6 deixa a foto em pé`);
   assert.ok(reddish(rotated.top)&&bluish(rotated.bottom),`${label}: a metade esquerda (vermelha) vai para cima: ${rotated.top} / ${rotated.bottom}`);
   assert.equal(rotated.exif,false,`${label}: sem EXIF na bandeja`);
   assert.equal(rotated.gps,false,`${label}: sem GPS na bandeja`);
   assert.match(rotated.alt,/foto do celular 1/);
   await reviewShot(page,out,`bandeja-${theme}-${width}.png`);

   /* Nada foi enviado: nenhuma fala na sessão, nenhum prompt no Pi, campo intacto. */
   assert.equal(await page.locator('.message.user').count(),0,`${label}: nenhuma mensagem enviada`);
   assert.equal(fs.existsSync(prompts)?fs.readFileSync(prompts,'utf8').trim():'','',`${label}: o Pi não recebeu prompt`);

   /* Esc fecha o popover e desliga o servidor. */
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.querySelector('#phone-pop').hidden);
   await pollUntil(()=>fetch(m.url).then(()=> 'aberto',()=> 'recusado'),v=>v==='recusado',{what:`${label}: servidor desligado depois do Esc`});
   assert.equal(await trayCount(page),2,`${label}: fechar não tira as fotos da bandeja`);
  }
 }

 /* Página do celular numa janela de 375×812, nos dois temas. */
 await clearTray(page);
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 const {url}=await openPop(page);
 const opened=ctx.app.waitForEvent('window');
 await ctx.app.evaluate(({BrowserWindow},address)=>{
  const phone=new BrowserWindow({width:375,height:812,useContentSize:true,show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  phone.loadURL(address);
 },url);
 const phonePage=await opened;
 /* A CSP recusaria um atributo style do desenho: o console do celular tem de ficar limpo. Recarrega já ouvindo. */
 const cspErrors=[];phonePage.on('console',m=>{if(/Content Security Policy/i.test(m.text()))cspErrors.push(m.text());});
 await phonePage.reload();
 await phonePage.waitForSelector('#gallery',{state:'attached'});
 for(const theme of ['light','dark']){
  await phonePage.emulateMedia({colorScheme:theme});
  const view=await phonePage.evaluate(()=>({
   vw:innerWidth,vh:innerHeight,scroll:document.documentElement.scrollWidth,lang:document.documentElement.lang,
   buttons:[...document.querySelectorAll('label.button')].map(el=>({text:el.textContent.trim(),height:el.getBoundingClientRect().height,right:el.getBoundingClientRect().right})),
   capture:document.querySelector('#camera').getAttribute('capture'),bg:getComputedStyle(document.body).backgroundColor,
  }));
  assert.deepEqual([view.vw,view.vh],[375,812],'viewport de celular');
  assert.ok(view.scroll<=view.vw,`${theme}: sem rolagem lateral (${view.scroll} × ${view.vw})`);
  assert.equal(view.lang,'pt-BR');
  assert.deepEqual(view.buttons.map(b=>b.text),['Tirar foto','Escolher da galeria']);
  assert.ok(view.buttons.every(b=>b.height>=44&&b.right<=view.vw),`${theme}: botões de tocar (${JSON.stringify(view.buttons)})`);
  assert.equal(view.capture,'environment');
  await expectCast(phonePage,'start',INTEGRAL,`${theme} início`);
  await reviewShot(phonePage,out,`celular-${theme}-375.png`);
 }
 await phonePage.setInputFiles('#gallery',[
  {name:'pagina-1.jpg',mimeType:'image/jpeg',buffer:withExif(syntheticJpeg(),{orientation:8})},
  {name:'pagina-2.png',mimeType:'image/png',buffer:syntheticPng({w:20,h:40})},
 ]);
 await phonePage.waitForFunction(()=>document.querySelector('#status').textContent==='Enviado para a Mesa (2 de 2)');
 assert.equal(await phonePage.locator('#sent .thumb:not(.pending) .done').count(),2,'as duas enviadas com o ✓');
 assert.deepEqual(await phonePage.locator('label.button').evaluateAll(els=>els.map(el=>el.textContent.trim())),['Mais uma','Da galeria']);
 for(const theme of ['light','dark']){
  await phonePage.emulateMedia({colorScheme:theme});
  await expectCast(phonePage,'sending',SIGMA,`${theme} enviando`);
  await reviewShot(phonePage,out,`celular-enviando-${theme}-375.png`);
 }
 await pollUntil(()=>trayCount(page),n=>n===2,{what:'as duas fotos da página do celular na bandeja'});
 const turned=await inspectAttachment(page,0);
 assert.deepEqual([turned.width,turned.height],[32,64],'rotação 8 também fica em pé');
 assert.ok(bluish(turned.top)&&reddish(turned.bottom),`rotação 8: a metade esquerda (vermelha) vai para baixo: ${turned.top} / ${turned.bottom}`);
 await reviewShot(phonePage,out,'celular-enviado-375.png');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#phone-pop').hidden);
 assert.equal(await page.locator('.message.user').count(),0,'nenhuma mensagem enviada');

 /* Sem conexão: a Mesa desligou o servidor; a próxima foto cai no ∇ e "Tentar de novo" continua lá. */
 await phonePage.setInputFiles('#camera',[{name:'pagina-3.png',mimeType:'image/png',buffer:syntheticPng({w:20,h:40})}]);
 await phonePage.waitForFunction(()=>document.querySelector('main').dataset.state==='offline');
 assert.equal(await phonePage.locator('#offline[role=alert] strong').textContent(),'Sem conexão com a Mesa.');
 assert.equal(await phonePage.locator('#sent .thumb').count(),2,'as que chegaram continuam na grade');
 for(const theme of ['light','dark']){
  await phonePage.emulateMedia({colorScheme:theme});
  await expectCast(phonePage,'offline',NABLA,`${theme} sem conexão`);
  await reviewShot(phonePage,out,`celular-sem-conexao-${theme}-375.png`);
 }
 await phonePage.locator('#retry').click();
 await phonePage.waitForFunction(()=>document.querySelector('main').dataset.state==='offline');
 assert.deepEqual(cspErrors,[],'nenhuma violação de CSP na página do celular');
 assert.deepEqual(errors,[]);
});
console.log('phone-photo-ui: PASS — popover com QR nos dois temas e tamanhos, fotos do celular na bandeja em pé e sem EXIF, nada enviado, Esc desliga o servidor, página do celular em 375×812 com ∫, Σ e ∇ por estado.');
