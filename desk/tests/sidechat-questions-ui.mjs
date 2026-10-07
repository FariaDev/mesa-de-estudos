/* Renderer Electron real + canal controlado: validação, seleção múltipla,
   recusa, aceite tardio e cancelamento. Nenhuma chamada de provedor. */
import assert from 'node:assert/strict';
import {launchDesk,newRuntime,seedCourse,writeConfigJson,statusOnline} from './helpers.mjs';
const runtime=newRuntime('sidechat-questions');
const course=seedCourse(runtime,'Questions');
writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'Questions',name:'Questions',path:course}]});
let app;
try{
 app=await launchDesk({runtime});const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));await statusOnline(page);
 await page.evaluate(async()=>{
  const mod=await import('./src/sidechat.mjs');mod.resetSidechat();
  const fake={listeners:[],attempts:[],mode:'reject',pending:null};
  mod.setSidechatBridge({sidechatOpen:async()=>({id:'questions-side',engine:'claude',messages:[],draft:'',busy:false}),sidechatSave:async()=>({ok:true}),onSidechatEvent:fn=>fake.listeners.push(fn),sidechatRespond:async data=>{fake.attempts.push(data);if(fake.mode==='reject')throw Error('Resposta recusada pelo host');if(fake.mode==='delay')return new Promise(resolve=>fake.pending=resolve);return {ok:true};}});
  fake.emit=event=>fake.listeners.forEach(fn=>fn({id:'questions-side',event}));window.questionTest=fake;
 });
 await page.locator('#support-tab-chat').click();await page.waitForFunction(()=>document.querySelector('#sidechat-engine')?.textContent.includes('Claude'));
 const question={question:'Quais tópicos?',header:'Tópicos',multiSelect:true,options:[{label:'A',description:'Primeiro tópico'},{label:'B',description:'Segundo tópico'}]};
 await page.evaluate(question=>window.questionTest.emit({type:'extension_ui_request',id:'multi',method:'question',questions:[question]}),question);
 const card=page.locator('.sidechat-request');await card.waitFor();
 assert.deepEqual(await card.locator('.sidechat-option-input').evaluateAll(inputs=>inputs.map(input=>input.type)),['checkbox','checkbox']);
 await card.locator('.sidechat-request-submit').click();assert.equal(await card.count(),1);assert.equal(await page.evaluate(()=>window.questionTest.attempts.length),0);assert.match(await card.locator('[role="alert"]').textContent(),/ao menos uma/);
 await card.locator('.sidechat-option-input').nth(0).check();await card.locator('.sidechat-option-input').nth(1).check();
 await card.locator('.sidechat-request-submit').click();await card.locator('[role="alert"]').waitFor();assert.match(await card.locator('[role="alert"]').textContent(),/recusada/);assert.equal(await card.count(),1);
 assert.deepEqual(await page.evaluate(()=>window.questionTest.attempts[0].response.answers),{'Quais tópicos?':['A','B']});
 await card.locator('.sidechat-request-input').fill('Outro tópico');assert.equal(await card.locator('.sidechat-option-input:checked').count(),0);
 await page.evaluate(()=>window.questionTest.mode='delay');await card.locator('.sidechat-request-submit').click();assert.equal(await card.count(),1);assert.equal(await card.locator('.sidechat-request-submit').isDisabled(),true);
 assert.deepEqual(await page.evaluate(()=>window.questionTest.attempts[1].response.answers),{'Quais tópicos?':'Outro tópico'});
 await page.evaluate(()=>window.questionTest.pending({ok:true}));await card.waitFor({state:'detached'});
 await page.evaluate(()=>{window.questionTest.mode='accept';window.questionTest.emit({type:'extension_ui_request',id:'cancel',method:'question',questions:[{question:'Escolha',options:[]} ]});});
 await card.waitFor();await card.locator('[data-answer="cancel"]').click();await card.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.questionTest.attempts.at(-1).response.cancelled),true);
 await page.evaluate(()=>window.questionTest.emit({type:'extension_ui_request',id:'proto',method:'question',questions:[{question:'__proto__',options:[]}]}));await card.waitFor();await card.locator('.sidechat-request-input').fill('Resposta segura');await card.locator('.sidechat-request-submit').click();await card.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>Object.hasOwn(window.questionTest.attempts.at(-1).response.answers,'__proto__')),true);
 assert.deepEqual(errors,[]);console.log('PASS: lateral valida antes de enviar, preserva recusa, aceita múltiplas/opção livre, aguarda aceite e cancela sem resposta.');
}finally{if(app)await app.close();}
