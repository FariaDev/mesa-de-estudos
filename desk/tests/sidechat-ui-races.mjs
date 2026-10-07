import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline} from './helpers.mjs';

/* Chat lateral — corridas do frontend (finding R2 1–5) com bridge CONTROLADO:
   nada de IPC real aqui; o `setSidechatBridge` do módulo recebe um fake que
   cronometra ACK e eventos. Cobre:
   - aceite tardio com eventos antes do ACK (ordem user→assistant, sem duplicar);
   - rascunho B digitado durante o aceite preservado e persistido (A não
     ressuscita) + reload/hide/show não repõe A;
   - duplo clique não envia duas vezes;
   - recusa comprovada devolve o texto BRUTO sem duplicar bolha;
   - entrega incerta mantém a bolha e marca `uncertain`;
   - `streaming:true` espera o evento terminal (e `streaming:false` com
     terminado antes do ACK libera na hora, sem timer);
   - `toolResult`/papel desconhecido filtrados (não viram resposta do tutor);
   - escopo congelado: troca de conversa/matéria não cruza rascunho nem evento
     atrasado, e `Novo` (fresh) começa vazio mesmo com espelho local antigo. */

async function installFakeBridge(page){
 await page.evaluate(async()=>{
  const mod=await import('./src/sidechat.mjs');
  const stateOf=async()=>(await import('./src/state.mjs')).S;
  const fake={id:'',n:0,opens:[],prompts:[],saves:[],aborts:0,contexts:[],responds:[],listeners:[],messages:[],drafts:{},sessionOf:{},pending:null};
  const payload=async()=>{
   const S=await stateOf();
   const session=String(S.currentSession||'');
   return {id:fake.id,engine:'pi',messages:fake.messages.map(message=>JSON.parse(JSON.stringify(message))),draft:fake.drafts[session]||'',busy:false,uncertain:false,context:{mainSession:session,refs:[],study:{},at:1700000000000}};
  };
  const bridge={
   sidechatOpen:async(input)=>{
    const S=await stateOf();
    fake.opens.push(JSON.parse(JSON.stringify(input||{})));
    fake.id='sc-'+(++fake.n);
    const session=String(S.currentSession||'');
    fake.sessionOf[fake.id]=session;
    if(input?.fresh){fake.drafts[session]='';fake.messages=[];}
    return payload();
   },
   sidechatRead:async()=>payload(),
   sidechatPrompt:(input)=>{fake.prompts.push({id:input.id,text:input.text});return new Promise((resolve,reject)=>{fake.pending={resolve,reject};});},
   sidechatAbort:async()=>{fake.aborts++;return {aborted:true};},
   sidechatSave:async(input)=>{
    const session=fake.sessionOf[input.id];
    fake.saves.push({id:input.id,session,draft:input.draft});
    if(session!==undefined)fake.drafts[session]=input.draft;
    return {ok:true,draft:input.draft};
   },
   sidechatContext:async(input)=>{fake.contexts.push(JSON.parse(JSON.stringify(input)));return payload();},
   sidechatRespond:async(input)=>{fake.responds.push(input);return {ok:true};},
   onSidechatEvent:(callback)=>{fake.listeners.push(callback);},
   conversations:async()=>[]
  };
  window.__sc=fake;
  window.__sc.payloadNow=payload;
  window.__sc.resolve=(result)=>{const pending=fake.pending;fake.pending=null;pending.resolve(result);};
  window.__sc.reject=(message)=>{const pending=fake.pending;fake.pending=null;pending.reject(new Error(message));};
  window.__sc.emit=(event,id)=>{for(const callback of fake.listeners)callback({id:id||fake.id,engine:'pi',event});};
  window.__sc.state=async()=>{
   const sidechat=await import('./src/sidechat.mjs');
   const current=sidechat.sidechatState();
   return {id:current.id,busy:current.busy,sending:current.sending,draft:current.draft,uncertain:current.uncertain,scope:current.scope,messages:current.messages.map(message=>({role:message.role,text:message.text}))};
  };
  mod.setSidechatBridge(bridge);
 });
}

async function openSidechatTab(page){
 await page.locator('#support-tab-chat').click();
 await page.waitForFunction(()=>{const sc=document.querySelector('#sidechat');return sc&&!sc.hidden;},{timeout:10000});
 await page.waitForFunction(()=>{const fake=window.__sc;return fake&&fake.opens.length>0&&!document.querySelector('#sidechat-prompt').disabled;},undefined,{timeout:10000});
}

await withArtifacts('lateral-corridas',async ctx=>{
 const runtime=ctx.runtime=newRuntime('lateral-corridas'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Race'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 /* O fake entra ANTES de qualquer abertura: nenhum chat real chega a abrir. */
 await installFakeBridge(page);
 await openSidechatTab(page);

 /* ---- 1. Aceite tardio: user antes do assistant, B preservado, A não volta ---- */
 await page.locator('#sidechat-prompt').fill('A');
 await page.locator('#sidechat-send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.user')].some(el=>el.textContent.includes('A')));
 let live=await page.evaluate(()=>window.__sc.state());
 assert.equal(live.sending,true,'o envio está em voo antes do aceite');
 assert.equal(live.busy,false,'ainda não há turno até o aceite/evento');
 /* B digitado enquanto o ACK de A está pendente. */
 await page.locator('#sidechat-prompt').fill('B');
 await page.evaluate(()=>{
  window.__sc.emit({type:'agent_start'});
  window.__sc.emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Par'}});
  window.__sc.emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text:'Resposta do tutor'}]}});
  window.__sc.emit({type:'agent_settled'});
 });
 const orderDuringAck=await page.evaluate(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg')].map(el=>el.classList.contains('user')?'user':'assistant'));
 assert.deepEqual(orderDuringAck,['user','assistant'],'com o ACK pendente a ordem é user antes de assistant');
 await page.evaluate(()=>window.__sc.resolve({sent:true,id:window.__sc.id,engine:'pi',streaming:false}));
 await page.waitForFunction(()=>window.__sc.state().then(s=>!s.sending));
 live=await page.evaluate(()=>window.__sc.state());
 assert.equal(live.busy,false,'terminal antes do ACK libera o turno na hora (sem timer de 2,5s)');
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'B','o rascunho B digitado durante o aceite é preservado');
 assert.equal(live.draft,'B','o estado do rascunho é B, não vazio');
 await page.waitForTimeout(650);
 const saves=await page.evaluate(()=>window.__sc.saves.map(save=>save.draft));
 assert.equal(saves[0],'','o clique limpou o rascunho A no backend');
 assert.equal(saves.at(-1),'B','o rascunho B foi persistido (A não ressuscita)');
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.user').count(),1,'a fala A aparece uma única vez');
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.assistant').count(),1,'a resposta aparece uma única vez');
 /* Esconder/mostrar não repõe A. */
 await page.locator('#support-tab-form').click();
 await page.locator('#support-tab-chat').click();
 await page.waitForTimeout(150);
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'B','hide/show preserva o rascunho B');

 /* ---- 2. Duplo clique: um envio só ---- */
 const promptsBefore=await page.evaluate(()=>window.__sc.prompts.length);
 await page.locator('#sidechat-prompt').fill('A2');
 await page.locator('#sidechat-send').click();
 await page.locator('#sidechat-send').click();
 await page.waitForTimeout(80);
 const promptsAfter=await page.evaluate(()=>window.__sc.prompts.length);
 assert.equal(promptsAfter-promptsBefore,1,'o segundo clique não envia de novo');
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.user').count(),2,'A2 aparece uma vez');
 await page.evaluate(()=>window.__sc.resolve({sent:true,id:window.__sc.id,engine:'pi',streaming:false}));
 await page.waitForFunction(()=>window.__sc.state().then(s=>s.busy===true&&!s.sending),undefined,{timeout:5000});
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','A2 aceito limpou o campo');
 await page.evaluate(()=>window.__sc.emit({type:'agent_settled'}));
 await page.waitForFunction(()=>window.__sc.state().then(s=>!s.sending&&!s.busy));

 /* ---- 3. Recusa comprovada: texto BRUTO volta, sem bolha ---- */
 const usersBefore=await page.locator('#sidechat-messages .sidechat-msg.user').count();
 await page.locator('#sidechat-prompt').fill('  C  ');
 await page.locator('#sidechat-send').click();
 await page.evaluate(()=>window.__sc.resolve({sent:false,retryable:true,error:'recusado pelo teste'}));
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('recusado pelo teste'));
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'  C  ','a recusa devolve o texto bruto (com os espaços)');
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.user').count(),usersBefore,'a recusa não deixa bolha duplicada');
 /* Com um B já digitado, a recusa não sobrescreve B. */
 await page.locator('#sidechat-prompt').fill('D');
 await page.locator('#sidechat-send').click();
 await page.locator('#sidechat-prompt').fill('E');
 await page.evaluate(()=>window.__sc.resolve({sent:false,retryable:true,error:'recusado de novo'}));
 await page.waitForFunction(()=>window.__sc.state().then(s=>!s.sending));
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'E','a recusa não sobrescreve o texto novo do usuário');

 /* ---- 4. Entrega incerta: bolha fica e o estado marca uncertain ---- */
 await page.locator('#sidechat-prompt').fill('F');
 await page.locator('#sidechat-send').click();
 await page.evaluate(()=>window.__sc.resolve({sent:false,retryable:false,uncertain:true,error:'entrega incerta no teste'}));
 await page.waitForFunction(()=>window.__sc.state().then(s=>s.uncertain===true));
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.user').filter({hasText:'F'}).count(),1,'a bolha incerta permanece (pode ter chegado)');
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','entrega incerta não devolve o texto (evita reenvio)');

 /* ---- 5. streaming:true espera o evento terminal ---- */
 await page.locator('#sidechat-prompt').fill('G');
 await page.locator('#sidechat-send').click();
 await page.evaluate(()=>window.__sc.resolve({sent:true,id:window.__sc.id,engine:'pi',streaming:true}));
 await page.waitForFunction(()=>window.__sc.state().then(s=>s.busy===true));
 assert.equal(await page.locator('#sidechat-stop').isVisible(),true,'com streaming o Parar fica visível');
 assert.equal(await page.locator('#sidechat-send').isDisabled(),true,'com streaming o Enviar fica bloqueado');
 await page.evaluate(()=>window.__sc.emit({type:'agent_settled'}));
 await page.waitForFunction(()=>window.__sc.state().then(s=>s.busy===false&&!s.sending));
 assert.equal(await page.locator('#sidechat-send').isDisabled(),false,'o terminal libera o envio');

 /* ---- 6. toolResult não vira resposta do tutor ---- */
 const assistantsBefore=await page.locator('#sidechat-messages .sidechat-msg.assistant').count();
 await page.evaluate(()=>{
  window.__sc.emit({type:'message_end',message:{role:'toolResult',toolCallId:'t1',content:[{type:'text',text:'saida-da-ferramenta'}]}});
  window.__sc.emit({type:'message_end',message:{role:'assistant',content:[{type:'toolResult',toolCallId:'t2'}]}});
  window.__sc.emit({type:'message_end',message:{role:'tool',text:'outra-ferramenta'}});
 });
 await page.waitForTimeout(200);
 assert.equal(await page.locator('#sidechat-messages').textContent().then(text=>text.includes('saida-da-ferramenta')),false,'toolResult não aparece como resposta');
 assert.equal(await page.locator('#sidechat-messages').textContent().then(text=>text.includes('outra-ferramenta')),false,'papel tool não aparece como resposta');
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.assistant').count(),assistantsBefore,'nenhum card vazio de ferramenta foi criado');

 /* ---- 7. Evento de id obsoleto é ignorado ---- */
 await page.evaluate(()=>window.__sc.emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'NAO-DEVE-APARECER'}},'sc-antigo'));
 await page.waitForTimeout(200);
 assert.equal(await page.locator('#sidechat-messages').textContent().then(text=>text.includes('NAO-DEVE-APARECER')),false,'evento de id obsoleto é ignorado');

 /* ---- 8. Escopo congelado: troca de conversa não cruza draft/evento ---- */
 const oldSession=await page.evaluate(async()=>{const state=await import('./src/state.mjs');return state.S.currentSession;});
 await page.locator('#sidechat-prompt').fill('rascunho antigo');
 await page.waitForTimeout(600);
 const oldKey='mesa.sidechat.draft.Test.'+encodeURIComponent(oldSession);
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.currentSession='pi-outra.jsonl';window.dispatchEvent(new Event('desk-conversation-changed'));});
 await page.waitForFunction(async()=>{const state=await window.__sc.state();return !!state.id;});
 let scoped=await page.evaluate(()=>window.__sc.state());
 assert.equal(scoped.draft,'','a conversa nova começa sem o rascunho da antiga');
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','o campo nasce vazio na troca de conversa');
 const kept=await page.evaluate(key=>localStorage.getItem(key),oldKey);
 assert.equal(kept,'rascunho antigo','o espelho local do escopo antigo fica preservado na chave antiga');
 const newKey='mesa.sidechat.draft.Test.'+encodeURIComponent('pi-outra.jsonl');
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),newKey),null,'nada do rascunho antigo é gravado na chave nova');
 /* ACK atrasado do escopo antigo não muda o novo nem destrava envio errado. */
 await page.locator('#sidechat-prompt').fill('H');
 await page.locator('#sidechat-send').click();
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.currentSession='pi-terceira.jsonl';window.dispatchEvent(new Event('desk-conversation-changed'));});
 await page.waitForTimeout(150);
 await page.evaluate(()=>window.__sc.resolve({sent:true,id:'sc-antigo',engine:'pi',streaming:false}));
 await page.waitForTimeout(200);
 scoped=await page.evaluate(()=>window.__sc.state());
 assert.equal(scoped.messages.length,0,'o aceite atrasado do escopo antigo não pinta bolha no novo');
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','o campo do escopo novo segue vazio');

 /* ---- 9. Novo (fresh) começa vazio mesmo com espelho local ---- */
 await page.locator('#sidechat-prompt').fill('novo rascunho');
 await page.waitForTimeout(600);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#sidechat-new').click();
 await page.waitForFunction(()=>window.__sc.state().then(s=>s.draft===''&&s.messages.length===0));
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','fresh não ressuscita o rascunho antigo do mesmo escopo');
 const freshOpens=await page.evaluate(()=>window.__sc.opens.filter(open=>open.fresh===true).length);
 assert.ok(freshOpens>=1,'o fresh foi pedido ao backend');
 /* E um reopen comum (hide/show) também não ressuscita. */
 await page.locator('#support-tab-form').click();
 await page.locator('#support-tab-chat').click();
 await page.waitForFunction(()=>window.__sc.state().then(s=>s.draft===''&&s.messages.length===0));
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','reabrir depois do fresh segue vazio');

 assert.deepEqual(errors,[]);
 console.log('PASS: corridas do chat lateral (ACK tardio, duplo clique, recusa/incerteza, streaming, toolResult, escopo e fresh)');
});
