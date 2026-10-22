import assert from 'node:assert/strict';
import {withArtifacts,launchDesk,newRuntime,closeModelPop,pickModel,modelRows,selectedModelKey,pickEffort,effortState} from './helpers.mjs';

/* O #connect é recriado pelo estado do tutor (ligando → ligado): contar e só
   então clicar deixa o clique esperando um elemento que já sumiu. Espera o
   primeiro entre "online" e "#connect à vista", clica com prazo curto e
   volta a olhar, sem nunca depender de um elemento antigo. */
async function goOnline(p,{timeout=60000}={}){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(await p.locator('#status-dot.online').count())return;
  const connect=p.locator('#connect');
  if(await connect.count())await connect.click({timeout:1500}).catch(()=>{});
  await p.waitForTimeout(200);
 }
 await p.waitForSelector('#status-dot.online',{timeout:1000,state:'attached'});
}

await withArtifacts('subjects',async ctx=>{
 // subjects-ui usa o Pi REAL (sem fake-pi) e descobre matérias pelo vault (seedConfig).
 const runtime=ctx.runtime=newRuntime('subjects');
 const app=ctx.app=await launchDesk({runtime,pi:false});
 const p=await app.firstWindow();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.waitForFunction(()=>document.querySelectorAll('.page-total').length===2&&[...document.querySelectorAll('.page-total')].every(e=>!e.textContent.includes('—')));assert.ok(await p.locator('#course-tabs button[role="tab"]:not(#review-tab)').count()>=4);
 let page3=false;
 for(let i=0;i<6&&!page3;i++){
  await p.locator('.page-number').first().fill('3');
  await p.locator('.page-number').first().blur();
  try{await p.waitForFunction(()=>document.querySelector('.pdf-foot').textContent.includes('Página 3'),{timeout:2000});page3=true;}catch{}
 }
 assert.ok(page3,'page-number change should survive the deferred re-render');
 await p.locator('#prompt').fill('rascunho de cálculo');
 await goOnline(p);
 const original=await selectedModelKey(p);const effort=(await effortState(p)).value;assert.ok(original);assert.ok((await modelRows(p)).length>1);assert.ok(effort);
 await pickModel(p,...JSON.parse(original));await pickEffort(p,effort);await p.waitForFunction(()=>document.querySelector('#effort-strip').getAttribute('aria-disabled')==='false');
 console.log('MODELS',(await modelRows(p)).length,'EFFORTS',(await effortState(p)).levels.join(','));
 await closeModelPop(p);
 await p.locator('#course-tabs button[data-id="Discrete Math"]').click();await p.waitForFunction(()=>document.title.includes('Discreta'));assert.equal(await p.locator('#prompt').inputValue(),'');
 await goOnline(p);
 assert.equal(await p.locator('.message').count(),0);
 await p.locator('#course-tabs button[data-id="Physics I"]').click();await p.waitForFunction(()=>document.title.includes('Física'));await goOnline(p);
 await p.locator('#course-tabs button[data-id="Calculus I"]').click();await p.waitForFunction(()=>document.title.includes('Cálculo'));await p.waitForFunction(()=>document.querySelectorAll('.page-number')[0].value==='3',{timeout:30000});
 assert.equal(await p.locator('.page-number').first().inputValue(),'3');assert.equal(await p.locator('#prompt').inputValue(),'rascunho de cálculo');
 await p.locator('#calc-toggle').click();await p.locator('#calc-guide summary').click();await p.locator('#expression').fill('sin(pi/2)');await p.locator('#calc-form button').click();assert.equal(await p.locator('#result').textContent(),'1');
 await p.screenshot({path:'ui-subjects.png'});assert.deepEqual(errors,[]);console.log('SUBJECTS PASSED: course libraries and drafts isolated, model/effort RPC accepted, saved page restored, calculator guide.');
 }catch(e){console.log('UI ERROR',await p.locator('#toast').textContent(),'TITLE',await p.title(),errors);throw e;}
});
