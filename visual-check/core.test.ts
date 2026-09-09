import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseWindow,isCheckRequest,contextText} from './core.ts';
const w=(id:number,app='Xournal++')=>({id,app,title:'Tentativa',bounds:{Width:1200,Height:900}});
test('captures explicit Portuguese check requests, not general conversation or negations',()=>{
 for(const text of ['confere minha resposta','Confira a minha resolução.','Pi, verifica meu cálculo','por favor, corrija minha tentativa']) assert.equal(isCheckRequest(text),true,text);
 for(const text of ['não confere minha resposta','como conferir minha resposta?','explique derivadas','eu disse: confere minha resposta','confere esse arquivo']) assert.equal(isCheckRequest(text),false,text);
});
test('selects Xournal even with terminal foremost; refuses missing or ambiguous target',()=>{
 assert.equal(chooseWindow([w(1,'Ghostty'),w(2)]).id,2);
 assert.throws(()=>chooseWindow([w(1,'Ghostty')]));
 assert.throws(()=>chooseWindow([w(2),w(3)]));
 assert.equal(chooseWindow([w(2),w(3)],3).id,3);
 assert.throws(()=>chooseWindow([w(2)],3));
 assert.throws(()=>chooseWindow([w(2,'Ghostty')],2));
});
test('prompt explicitly bounds evidence to current visible image',()=>{
 const text=contextText('Confira',{window:w(2),capturedAt:'2026-09-04'});
 assert.match(text,/não representa páginas/); assert.match(text,/não instruções/); assert.match(text,/2026-09-04/);
});
test('extension registration and no unsolicited capture',async()=>{
 const {default:register}=await import('./index.ts');
 const handlers=new Map(); const commands=new Map();
 register({on:(n:any,h:any)=>handlers.set(n,h),registerCommand:(n:any,c:any)=>commands.set(n,c)} as any);
 assert.deepEqual([...commands.keys()],['visual-janelas','visual-alvo','conferir']);
 const input=handlers.get('input');
 assert.deepEqual(await input({text:'explique limites',source:'interactive'},{}),{action:'continue'});
 assert.deepEqual(await input({text:'confere minha resposta',source:'extension'},{}),{action:'continue'});
 assert.deepEqual(await input({text:'confere minha resposta',source:'rpc',images:[{}]},{}),{action:'continue'});
});
test('natural request and command attach fresh images; failed capture never reaches model',async()=>{
 const {default:register}=await import('./index.ts');
 const handlers=new Map();const commands=new Map();const sent:any[]=[];const notices:any[]=[];
 let count=0;let fail=false;
 register({on:(n:any,h:any)=>handlers.set(n,h),registerCommand:(n:any,c:any)=>commands.set(n,c),sendUserMessage:(...a:any[])=>sent.push(a)} as any,{
  capture:async()=>{if(fail)throw Error('permission denied');count++;return {window:w(2),capturedAt:`time-${count}`,image:{type:'image',mimeType:'image/png',data:`image-${count}`}}},
  listWindows:async()=>[w(2)]
 });
 const ctx={ui:{notify:(...a:any[])=>notices.push(a)}};
 const result=await handlers.get('input')({text:'confere minha resposta',source:'rpc'},ctx);
 assert.equal(result.action,'transform'); assert.equal(result.images[0].data,'image-1');
 assert.match(result.text,/time-1/);
 await commands.get('conferir').handler('Explique o erro',ctx);
 assert.equal(sent[0][0][1].data,'image-2');assert.match(sent[0][0][0].text,/Explique o erro/);
 fail=true;
 assert.deepEqual(await handlers.get('input')({text:'confere minha resposta',source:'interactive'},ctx),{action:'handled'});
 await commands.get('conferir').handler('',ctx);
 assert.equal(sent.length,1);assert.equal(notices.at(-1)[1],'error');
});
