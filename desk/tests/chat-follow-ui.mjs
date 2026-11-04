// node tests/chat-follow-ui.mjs — item 15: a conversa acompanha o fim do turno,
// inclusive quando o texto final, o recolhimento do diário ou uma figura mudam
// a altura depois do último token. Se a pessoa sobe durante o turno, não é
// puxada de volta. Tutor, Livre e lateral usam o mesmo aplicador.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,freezeMotion,resizeWindow,reviewShot,screenshotDirectory} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const out=screenshotDirectory('chat-follow');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700" viewBox="0 0 400 700"><rect width="400" height="700" fill="var(--plot-1)"/></svg>';
const scroller=page=>page.evaluate(()=>{
 const chat=document.querySelector('#chat'),messages=document.querySelector('#messages');
 const el=chat&&messages&&chat.scrollHeight>chat.clientHeight+1?chat:messages;
 return el?{top:el.scrollTop,distance:el.scrollHeight-el.scrollTop-el.clientHeight,height:el.scrollHeight,client:el.clientHeight,id:el.id}:null;
});
const follow=async(page,what)=>{
 let last;
 for(let attempt=0;attempt<40;attempt++){
  await nextFrames(page,2);
  last=await scroller(page);
  if(last&&last.distance<=2)return last;
 }
 assert.fail(`${what}: a conversa não chegou ao fim (${JSON.stringify(last)})`);
};

await withArtifacts('chat-follow',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-follow');
 const course=seedCourse(runtime,'calc');
 const figure=path.join(course,'longa.svg');fs.writeFileSync(figure,svg);
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_LONG_IMAGE:figure,FAKE_PI_LONG_HOLD_MS:'700'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);

 /* 1. Segue até o fim: texto longo + pensamento recolhido + ferramenta + figura. */
 await page.locator('#prompt').fill('resposta longa');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Parágrafo 60')),undefined,{timeout:30000});
 await page.waitForFunction(()=>{
  const work=[...document.querySelectorAll('.work')].at(-1);
  const image=document.querySelector('.message.assistant img');
  return work?.dataset.live==='false'&&image?.complete;
 },undefined,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('.work[data-live="false"]')?.dataset.expanded==='false',undefined,{timeout:10000});
 await nextFrames(page,3);
 const end=await follow(page,'turno longo');
 assert.ok(end.height>end.client*2,`a resposta precisa passar da vista (${JSON.stringify(end)})`);
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','chat-follow-fim.png')});
 await reviewShot(page,out,'chat-follow-fim.png');

 /* 2. Pessoa rola para cima durante o turno: não é puxada de volta. */
 await page.locator('#prompt').fill('resposta longa');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('.work[data-live="true"]'),undefined,{timeout:30000});
 /* O diário vivo nasce antes do texto longo: medir aqui pegava a coluna ainda
    sem overflow (height=client) e o teste falhava por corrida. Espera a
    condição que o resto do bloco usa — o scroller de fato rolável. */
 await page.waitForFunction(()=>{
  const chat=document.querySelector('#chat'),messages=document.querySelector('#messages');
  const el=chat&&messages&&chat.scrollHeight>chat.clientHeight+1?chat:messages;
  return !!el&&el.scrollHeight>el.clientHeight;
 },undefined,{timeout:30000});
 const before=await scroller(page);
 assert.ok(before&&before.height>before.client,`o turno longo abre conteúdo rolável (${JSON.stringify(before)})`);
 await page.evaluate(()=>{
  const chat=document.querySelector('#chat'),messages=document.querySelector('#messages');
  const el=chat&&messages&&chat.scrollHeight>chat.clientHeight+1?chat:messages;
  el.scrollTop=Math.max(0,el.scrollHeight-el.clientHeight-500);
  el.dispatchEvent(new Event('scroll',{bubbles:true}));
 });
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].filter(el=>el.textContent.includes('Parágrafo 60')).length>=2,undefined,{timeout:30000});
 await nextFrames(page,3);
 const held=await scroller(page);
 assert.ok(held.distance>200,`a rolagem do aluno foi respeitada (${JSON.stringify(held)})`);
 assert.ok(held.top<held.height-held.client-200,`não saltou para o fim (${JSON.stringify(held)})`);
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','chat-follow-subiu.png')});
 await reviewShot(page,out,'chat-follow-subiu.png');

 /* 3. A mesma coluna na aba Livre. */
 await page.locator('#course-tabs button[data-id="mesa-free"]').click();
 await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="mesa-free"]')?.classList.contains('active'),undefined,{timeout:15000});
 await statusOnline(page);
 await page.locator('#prompt').fill('resposta longa');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Parágrafo 60')),undefined,{timeout:30000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant img')].every(img=>img.complete),undefined,{timeout:30000});
 await nextFrames(page,3);
 const freeEnd=await follow(page,'aba Livre');
 assert.ok(freeEnd.height>freeEnd.client*2,`a Livre também passa da vista (${JSON.stringify(freeEnd)})`);
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','chat-follow-livre.png')});
 await reviewShot(page,out,'chat-follow-livre.png');

 /* 4. O chat lateral: segue o fim e respeita a rolagem para cima. */
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const box=document.querySelector('#sidechat');return box&&!box.hidden&&!document.querySelector('#sidechat-prompt')?.disabled;},undefined,{timeout:20000});
 await page.locator('#sidechat-prompt').fill('resposta longa');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-body')].some(el=>el.textContent.includes('Parágrafo 60')),undefined,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#sidechat-stop')?.hidden,undefined,{timeout:20000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages img')].every(img=>img.complete),undefined,{timeout:20000});
 await nextFrames(page,3);
 const sideDistance=()=>page.evaluate(()=>{const el=document.querySelector('#sidechat-messages');return el?el.scrollHeight-el.scrollTop-el.clientHeight:null;});
 assert.ok(await sideDistance()<=2,`o lateral chegou ao fim (${await sideDistance()})`);
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','chat-follow-lateral.png')});
 await reviewShot(page,out,'chat-follow-lateral.png');

 await page.locator('#sidechat-prompt').fill('resposta longa');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#sidechat-stop')?.hidden,undefined,{timeout:20000});
 await page.evaluate(()=>{
  const el=document.querySelector('#sidechat-messages');
  el.scrollTop=Math.max(0,el.scrollHeight-el.clientHeight-500);
  el.dispatchEvent(new Event('scroll',{bubbles:true}));
 });
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-body')].filter(el=>el.textContent.includes('Parágrafo 60')).length>=2,undefined,{timeout:30000});
 await nextFrames(page,3);
 assert.ok(await sideDistance()>200,`o lateral não puxou a pessoa de volta (${await sideDistance()})`);
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','chat-follow-lateral-subiu.png')});
 await reviewShot(page,out,'chat-follow-lateral-subiu.png');

 /* 5. Regressão do hunt-chat "diary-selection": o envio chama `revealInChat`
    com a bolha já visível (não rola), e logo depois a pessoa sobe até o topo.
    A posição em que a vista já estava não pode ser marcada como rolagem do
    código; senão o `scroll` do aluno é engolido e o texto seguinte puxa a
    conversa para o fim. */
 const ownScrollRace=await page.evaluate(async()=>{
  const {revealInChat,applyChatScroll}=await import('./src/state.mjs');
  const messages=document.querySelector('#messages');
  const filler=document.createElement('div');filler.style.height='800px';
  const anchor=document.createElement('div');anchor.style.height='10px';
  messages.prepend(anchor);messages.append(filler);
  messages.scrollTop=0;
  revealInChat(anchor);
  messages.dispatchEvent(new Event('scroll',{bubbles:true}));
  applyChatScroll('stream',null,messages.scrollHeight-messages.scrollTop-messages.clientHeight);
  const top=messages.scrollTop;
  filler.remove();anchor.remove();
  return top;
 });
 assert.ok(ownScrollRace<=1,`o envio sem rolagem não engole a subida do aluno (scrollTop ${ownScrollRace})`);
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('chat-follow-ui: ok');
