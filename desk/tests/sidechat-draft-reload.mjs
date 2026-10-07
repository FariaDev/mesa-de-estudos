import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline} from './helpers.mjs';

/* Finding R4: o rascunho novo (B) era perdido no reload quando o backend já
   tinha o rascunho antigo (A). O espelho local ganhou marcador DIRTY/revisão/
   id/escopo: um input novo (mesmo VAZIO) vence o payload do host até o ACK do
   save correspondente; a restauração reagenda o save que o reload cortou.

   Cobre:
   1. IPC real + fake Pi: A persistido, B digitado e reload ANTES do debounce →
      o campo restaura B (não o A do backend) e o backend converge para B.
   2. Enviar + reload imediato continua vazio (não ressuscita o texto enviado).
   3. Espelho legado (string sem metadados) continua restaurando com host vazio
      e é migrado para o formato novo.
   4. Bridge controlado: o ACK atrasado do save de A não limpa o `dirty` do
      input B (B segue preferido); saves serializados A→B e ACK de B confirma.
   5. Escopo A/B isolado na troca de conversa e `fresh` limpa o espelho do
      escopo (hide/show segue vazio). */

function sidechatDescriptors(runtime){
 const dir=path.join(runtime,'sidechats');
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir).filter(name=>name.endsWith('.json')&&name!=='index.json').map(name=>{
  try{return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));}catch{return null;}
 }).filter(Boolean);
}
function backendDraft(runtime){
 const list=sidechatDescriptors(runtime);
 return list.length?String(list[0].draft??''):null;
}
async function waitBackendDraft(runtime,value,{timeout=10000}={}){
 const start=Date.now();
 for(;;){
  if(backendDraft(runtime)===value)return true;
  if(Date.now()-start>timeout)throw new Error(`rascunho do backend não chegou a ${JSON.stringify(value)} (atual ${JSON.stringify(backendDraft(runtime))})`);
  await new Promise(resolve=>setTimeout(resolve,50));
 }
}
async function openSidechatTab(page,{timeout=30000}={}){
 const ready=()=>{
  const sc=document.querySelector('#sidechat');
  const eng=document.querySelector('#sidechat-engine');
  return !!sc&&!sc.hidden&&!!eng&&!eng.hidden&&!document.querySelector('#sidechat-prompt')?.disabled;
 };
 if(!(await page.evaluate(ready)))await page.locator('#support-tab-chat').click();
 await page.waitForFunction(ready,undefined,{timeout});
}
function mirrors(page){
 return page.evaluate(()=>{
  const out={};
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   if(key.startsWith('mesa.sidechat.draft'))out[key]=localStorage.getItem(key);
  }
  return out;
 });
}
function mirrorOf(all,kind,session){
 const prefix=kind==='meta'?'mesa.sidechat.draftmeta.':'mesa.sidechat.draft.';
 const key=Object.keys(all).find(name=>name.startsWith(prefix)&&name.includes(encodeURIComponent(session)));
 return key?{key,value:all[key]}:null;
}

await withArtifacts('lateral-draft-reload-ipc',async ctx=>{
 const runtime=ctx.runtime=newRuntime('draft-reload'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise'));
 fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf('Support'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await page.locator('#support-tab-chat').click();
 await openSidechatTab(page);
 const session=await page.evaluate(async()=>String((await import('./src/state.mjs')).S.currentSession||''));

 /* ---- 1. A persiste; B digitado; reload ANTES do debounce ---- */
 await page.locator('#sidechat-prompt').fill('AAA-original');
 await waitBackendDraft(runtime,'AAA-original');
 const beforeTyping=await mirrors(page);
 const metaA=mirrorOf(beforeTyping,'meta',session);
 assert.ok(metaA,'o espelho local grava metadados do rascunho');
 await page.evaluate(()=>{const p=document.querySelector('#sidechat-prompt');p.value='BBB-novo';p.dispatchEvent(new Event('input',{bubbles:true}));});
 const dirty=await mirrors(page);
 assert.equal(mirrorOf(dirty,'text',session).value,'BBB-novo','o espelho local tem o B digitado');
 assert.equal(JSON.parse(mirrorOf(dirty,'meta',session).value).dirty,true,'o B digitado deixa o espelho sujo');
 await page.reload();
 await statusOnline(page,{timeout:30000});
 await openSidechatTab(page);
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'BBB-novo','o reload imediato restaura o B local (não o A do backend)');
 await waitBackendDraft(runtime,'BBB-novo');
 await page.waitForFunction(sessionText=>{
  const key=Object.keys(localStorage).find(name=>name.startsWith('mesa.sidechat.draftmeta.')&&name.includes(encodeURIComponent(sessionText)));
  return !!key&&JSON.parse(localStorage.getItem(key)).dirty===false;
 },session,{timeout:10000});
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'BBB-novo','o campo segue B depois do re-save confirmado');

 /* ---- 2. Enviar + reload imediato continua vazio ---- */
 await page.locator('#sidechat-prompt').fill('CCC-enviada');
 await waitBackendDraft(runtime,'CCC-enviada');
 await page.locator('#sidechat-send').click();
 await page.reload();
 await statusOnline(page,{timeout:30000});
 await openSidechatTab(page);
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','enviar e recarregar logo depois não ressuscita o texto enviado');
 await waitBackendDraft(runtime,'');

 /* ---- 3. Espelho legado sem metadados (migração) ---- */
 await page.evaluate(async sessionText=>{
  for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key.startsWith('mesa.sidechat.draft'))localStorage.removeItem(key);}
  localStorage.setItem('mesa.sidechat.draft.Test.'+encodeURIComponent(sessionText),'rascunho-legado');
 },session);
 await page.reload();
 await statusOnline(page,{timeout:30000});
 await openSidechatTab(page);
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'rascunho-legado','o espelho legado (sem metadados) ainda restaura com o host vazio');
 await waitBackendDraft(runtime,'rascunho-legado');
 await page.waitForFunction(sessionText=>{
  const key=Object.keys(localStorage).find(name=>name.startsWith('mesa.sidechat.draftmeta.')&&name.includes(encodeURIComponent(sessionText)));
  return !!key&&JSON.parse(localStorage.getItem(key)).dirty===false;
 },session,{timeout:10000});
 const migrated=await mirrors(page);
 assert.equal(mirrorOf(migrated,'text',session).value,'rascunho-legado','o texto legado continua na chave antiga');

 assert.deepEqual(errors,[]);
 console.log('PASS: draft lateral sobrevive ao reload imediato (A→B), enviar+reload fica vazio e legado migra');
});

await withArtifacts('lateral-draft-reload-corridas',async ctx=>{
 const runtime=ctx.runtime=newRuntime('draft-reload-corridas'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Race'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 /* Bridge controlado: `sidechatSave` fica pendente até o teste liberar cada
    ACK — é o que permite ver o save antigo de A confirmar DEPOIS do input B. */
 await page.evaluate(async()=>{
  const mod=await import('./src/sidechat.mjs');
  const stateOf=async()=>(await import('./src/state.mjs')).S;
  const fake={id:'',n:0,opens:[],saves:[],listeners:[],messages:[],drafts:{},sessionOf:{},currentBySession:{},pendingSaves:[]};
  const payload=async()=>{
   const S=await stateOf();
   const session=String(S.currentSession||'');
   return {id:fake.id,engine:'pi',messages:fake.messages.map(message=>JSON.parse(JSON.stringify(message))),draft:fake.drafts[session]||'',busy:false,uncertain:false,context:{mainSession:session,refs:[],study:{},at:1700000000000}};
  };
  const bridge={
   sidechatOpen:async input=>{
    const S=await stateOf();
    fake.opens.push(JSON.parse(JSON.stringify(input||{})));
    const session=String(S.currentSession||'');
    if(input?.fresh){
     fake.currentBySession[session]='sc-'+(++fake.n);
     fake.drafts[session]='';fake.messages=[];
    }else if(!fake.currentBySession[session]){
     fake.currentBySession[session]='sc-'+(++fake.n);
    }
    fake.id=fake.currentBySession[session];
    fake.sessionOf[fake.id]=session;
    return payload();
   },
   sidechatRead:async()=>payload(),
   sidechatPrompt:async()=>({sent:true,id:fake.id,engine:'pi',streaming:false}),
   sidechatAbort:async()=>({aborted:true}),
   sidechatSave:input=>{
    const session=fake.sessionOf[input.id];
    fake.saves.push({id:input.id,session,draft:input.draft});
    return new Promise(resolve=>{
     fake.pendingSaves.push({input,session,resolve:()=>{
      if(session!==undefined)fake.drafts[session]=input.draft;
      resolve({ok:true,draft:input.draft});
     }});
    });
   },
   sidechatContext:async()=>payload(),
   sidechatRespond:async()=>({ok:true}),
   onSidechatEvent:callback=>{fake.listeners.push(callback);},
   conversations:async()=>[]
  };
  window.__dsc={
   fake,
   resolveNext:()=>{const pending=fake.pendingSaves.shift();if(pending)pending.resolve({ok:true,draft:pending.input.draft});},
   pending:()=>fake.pendingSaves.length,
   mirrors:()=>{const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('mesa.sidechat.draft'))out[key]=localStorage.getItem(key);}return out;},
   state:async()=>{const sidechat=await import('./src/sidechat.mjs');const current=sidechat.sidechatState();return {id:current.id,draft:current.draft,scope:current.scope};}
  };
  mod.setSidechatBridge(bridge);
 });
 const drainSaves=async({rounds=30,quiet=160}={})=>{
  for(let i=0;i<rounds;i++){
   const pending=await page.evaluate(()=>window.__dsc.pending());
   if(pending)await page.evaluate(()=>window.__dsc.resolveNext());
   await page.waitForTimeout(quiet);
   if(!pending&&!await page.evaluate(()=>window.__dsc.pending()))return;
  }
 };
 await openSidechatTab(page);
 await page.waitForFunction(()=>window.__dsc.fake.opens.length>0);
 await page.waitForFunction(()=>window.__dsc.state().then(current=>!!current.id));

 /* ---- 4. ACK atrasado de A não limpa o dirty de B ---- */
 await page.locator('#sidechat-prompt').fill('A-base');
 await page.waitForFunction(()=>window.__dsc.pending()===1,undefined,{timeout:5000});
 await page.locator('#sidechat-prompt').fill('B-novo');
 await page.waitForTimeout(520); /* debounce de B dispara; save B fica atrás de A */
 const session=await page.evaluate(async()=>String((await import('./src/state.mjs')).S.currentSession||''));
 let all=await page.evaluate(()=>window.__dsc.mirrors());
 assert.ok(mirrorOf(all,'meta',session),'B gravou metadados');
 assert.equal(mirrorOf(all,'text',session).value,'B-novo');
 assert.equal(JSON.parse(mirrorOf(all,'meta',session).value).dirty,true,'B está sujo antes dos ACKs');
 await page.evaluate(()=>window.__dsc.resolveNext()); /* confirma o save de A */
 await page.waitForTimeout(220);
 all=await page.evaluate(()=>window.__dsc.mirrors());
 assert.equal(mirrorOf(all,'text',session).value,'B-novo','o texto local continua B');
 assert.equal(JSON.parse(mirrorOf(all,'meta',session).value).dirty,true,'o ACK de A NÃO limpa o dirty de B');
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'B-novo','o campo segue B depois do ACK antigo');
 const saves=await page.evaluate(()=>window.__dsc.fake.saves.map(save=>save.draft));
 assert.deepEqual(saves,['A-base','B-novo'],'os saves ficam serializados A→B');
 await page.waitForFunction(()=>window.__dsc.pending()===1,undefined,{timeout:5000}); /* save de B chamado */
 await page.evaluate(()=>window.__dsc.resolveNext());
 await page.waitForFunction(sessionText=>{
  const stored=window.__dsc.mirrors();
  const key=Object.keys(stored).find(name=>name.startsWith('mesa.sidechat.draftmeta.')&&name.includes(encodeURIComponent(sessionText)));
  return !!key&&JSON.parse(stored[key]).dirty===false;
 },session,{timeout:5000});
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'B-novo','o ACK de B confirma e o campo segue B');

 /* ---- 5. Escopo A/B isolado, CLEAR vazio e fresh limpa o espelho ---- */
 const originalSession=session;
 /* Campo limpo de propósito vira espelho DIRTY VAZIO (o host ainda tem B). */
 await page.evaluate(()=>{const p=document.querySelector('#sidechat-prompt');p.value='';p.dispatchEvent(new Event('input',{bubbles:true}));});
 all=await page.evaluate(()=>window.__dsc.mirrors());
 assert.equal(mirrorOf(all,'text',originalSession).value,'','o campo limpo grava espelho vazio');
 assert.equal(JSON.parse(mirrorOf(all,'meta',originalSession).value).dirty,true,'o espelho vazio está sujo');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.currentSession='pi-outra.jsonl';window.dispatchEvent(new Event('desk-conversation-changed'));});
 await page.waitForFunction(()=>window.__dsc.state().then(current=>current.scope?.session==='pi-outra.jsonl'),undefined,{timeout:10000});
 await page.waitForFunction(()=>window.__dsc.pending()>=1,undefined,{timeout:5000}); /* save do reset (escopo antigo) fica pendente */
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','a conversa nova começa sem o rascunho da antiga');
 await page.locator('#sidechat-prompt').fill('rascunho-outra');
 await page.waitForTimeout(520);
 assert.equal(await page.evaluate(()=>window.__dsc.pending()),1,'o save do escopo antigo segura a fila (saves serializados)');
 all=await page.evaluate(()=>window.__dsc.mirrors());
 assert.equal(mirrorOf(all,'text','pi-outra.jsonl').value,'rascunho-outra');
 assert.equal(JSON.parse(mirrorOf(all,'meta','pi-outra.jsonl').value).dirty,true);
 /* Volta sem confirmar o save antigo: o payload ainda é B e o espelho vazio
    DIRTY do escopo A tem de vencer (CLEAR conta, não é truthy). */
 await page.evaluate(async sessionText=>{const state=await import('./src/state.mjs');state.S.currentSession=sessionText;window.dispatchEvent(new Event('desk-conversation-changed'));},originalSession);
 await page.waitForFunction(sessionText=>window.__dsc.state().then(current=>current.scope?.session===sessionText),originalSession,{timeout:10000});
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','o espelho vazio DIRTY vence o B ainda no host (CLEAR conta)');
 await drainSaves();
 const drafts=await page.evaluate(()=>({...window.__dsc.fake.drafts}));
 assert.equal(drafts[originalSession],'','o backend do escopo A converge para vazio');
 assert.equal(drafts['pi-outra.jsonl'],'rascunho-outra','o backend do escopo B guarda o rascunho dele');
 all=await page.evaluate(()=>window.__dsc.mirrors());
 assert.equal(JSON.parse(mirrorOf(all,'meta',originalSession).value).dirty,false,'o espelho do escopo A confirma limpo');
 assert.equal(mirrorOf(all,'text','pi-outra.jsonl').value,'rascunho-outra');
 assert.ok(!Object.entries(all).some(([key,value])=>key.includes(encodeURIComponent('pi-outra.jsonl'))&&value==='B-novo'),'o B do escopo A não vaza para a outra conversa');
 /* fresh limpa o espelho do escopo atual (agora o escopo A) */
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#sidechat-new').click();
 await page.waitForFunction(()=>window.__dsc.state().then(current=>!!current.id&&current.draft===''),undefined,{timeout:10000});
 await drainSaves();
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','fresh começa vazio');
 all=await page.evaluate(()=>window.__dsc.mirrors());
 assert.equal(mirrorOf(all,'text',originalSession),null,'fresh limpa a chave de texto do escopo');
 assert.equal(mirrorOf(all,'meta',originalSession),null,'fresh limpa os metadados do escopo');
 await page.locator('#support-tab-form').click();
 await page.locator('#support-tab-chat').click();
 await page.waitForTimeout(180);
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','reabrir depois do fresh segue vazio');

 assert.deepEqual(errors,[]);
 console.log('PASS: ACK antigo não limpa dirty novo, saves serializados, CLEAR vazio, escopo A/B isolado e fresh limpa o espelho');
});
