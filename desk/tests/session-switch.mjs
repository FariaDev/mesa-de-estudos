// npm run test:sessions — trocar de conversa antiga atualiza o medidor de contexto.
// Usa o Pi real da máquina (como subjects-ui): o fake-pi não muda o uso por sessão de
// forma realista o bastante para distinguir as conversas. Opt-in e rápido (~15s).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline} from './helpers.mjs';

await withArtifacts('session-switch',async ctx=>{
 const runtime=ctx.runtime=newRuntime('sesswitch');
 const course=seedCourse(runtime,'Calc');
 // sessões reais do runtime local (o Pi valida o formato); a longa tem o dobro das
 // mensagens, então o uso de contexto de cada uma é estável e diferente.
 const src=path.join(process.cwd(),'.runtime');
 // A curta é uma sessão real pequena; a longa é a mesma sessão com uma segunda sessão
 // real maior anexada — o "último request" (que define o contextUsage) fica diferente.
 const reais=fs.readdirSync(src).filter(n=>/^pi-\d+\.jsonl$/.test(n)).map(n=>path.join(src,n)).sort((a,b)=>fs.statSync(a).size-fs.statSync(b).size);
 const curtaReal=reais.find(p=>fs.statSync(p).size<=800000)||reais[0];
 const longaReal=reais.find(p=>fs.statSync(p).size>=3000000)||reais[reais.length-1];
 if(!curtaReal||!longaReal||curtaReal===longaReal){console.log('sessions: sem sessões reais distintas em .runtime; teste ignorado');process.exit(0);}
 const small=path.join(runtime,'pi-1700000000000.jsonl');
 const big=path.join(runtime,'pi-1700000001000.jsonl');
 fs.writeFileSync(small,fs.readFileSync(curtaReal,'utf8'));
 fs.writeFileSync(big,fs.readFileSync(curtaReal,'utf8')+fs.readFileSync(longaReal,'utf8'));
 writeDeskJson(runtime,{session:small,courseId:'Calc',courseStates:{Calc:{session:small,sessions:[{path:small,started:1700000000000,preview:'curta'},{path:big,started:1700000001000,preview:'longa'}]}}});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Calc',path:course}]});
 const app=ctx.app=await launchDesk({runtime,pi:false});
 const page=await app.firstWindow();
 await statusOnline(page);
 const meter=()=>page.evaluate(()=>({hidden:document.querySelector('#ctx-meter').hidden,pct:document.querySelector('#ctx-meter em').textContent,tip:document.querySelector('#ctx-meter')._tipText||'',sel:document.querySelector('#session-select').value.split('/').pop(),disabled:document.querySelector('#session-select').disabled}));
 const before=await meter();
 assert.equal(before.hidden,false,'medidor visível depois de conectar');
 assert.equal(before.sel,'pi-1700000000000.jsonl','conversa inicial é a curta');
 const bigValue=await page.evaluate(()=>{const s=document.querySelector('#session-select');return [...s.options].map(o=>o.value).find(v=>v.endsWith('pi-1700000001000.jsonl'));});
 assert.ok(bigValue,'a conversa longa aparece no seletor');
 const tokensOf=tip=>{const m=/· ([\d.,]+(?:\s(?:mil|mi))?) de /.exec(tip);return m?m[1]:'';};
 assert.ok(tokensOf(before.tip),'o tooltip inicial mostra tokens consumidos');
 await page.locator('#session-select').selectOption(bigValue);
 await page.waitForTimeout(5000);
 console.log('PROBE tips',JSON.stringify(before.tip),'->',JSON.stringify((await meter()).tip));
 await page.waitForFunction(prev=>{const m=document.querySelector('#ctx-meter');const tip=m._tipText||m.title;return tip&&tip!==prev&&/·/.test(tip);},before.tip,{timeout:30000});
 const after=await meter();
 assert.equal(after.sel,'pi-1700000001000.jsonl','a conversa longa ficou selecionada');
 assert.equal(after.disabled,false,'o seletor volta a funcionar depois da troca');
 assert.match(after.tip,/Contexto do modelo: \d+% · .+ de .+ tokens usados/,'o tooltip mostra consumido/total da conversa escolhida');
 assert.notEqual(tokensOf(after.tip),tokensOf(before.tip),'o total de tokens acompanha a conversa escolhida');
 console.log(`SESSIONS PASSED: trocar de conversa atualiza o medidor e o tooltip (${tokensOf(before.tip)} → ${tokensOf(after.tip)} tokens).`);
});
