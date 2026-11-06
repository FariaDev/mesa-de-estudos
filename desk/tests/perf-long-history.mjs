// Sonda da #118 (só mede, não implementa nada): 5.000 mensagens sintéticas
// (texto, Markdown e KaTeX, como `docs/design/threads-longas.md`) abertas na
// janela real com o fake OpenCode. Mede, por repetição: abertura boot→conversa
// estável, `historyTurns`, `showHistory` (parede), `markup` (marked+KaTeX+
// highlight+sanitize), DOMPurify sozinho no HTML final, DOM+aplicação
// (parede − markup) e rolagem até o topo. Roda direto:
// `DISPLAY=:0 node tests/perf-long-history.mjs [--reps 3]`.
import fs from 'node:fs';
import {execSync} from 'node:child_process';
import {launchDesk,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,statusOnline} from './helpers.mjs';

const REPS=Number(process.argv.find(arg=>arg.startsWith('--reps='))?.split('=')[1]||3);
const TURNS=1250;

function assistantBody(t){
  return `## Resposta ${t}\n\nComece pela definição. A derivada de $f(x)=x^${t%9+1}+${t}$ é $f'(x)=${t%9+1}x^${t%9}$. Depois use\n\n$$\\int_0^1 x^{${t%20+1}}\\,dx=\\frac{1}{${t%20+2}}$$\n\n\`\`\`js\nfunction passo${t}(x) {\n  return x * ${t} + Math.pow(x, ${t%5+1});\n}\n\`\`\`\n\n- passo 1: escreva a expressão\n- passo 2: confira o sinal\n\nO resultado aproximado é ${(t*1.2345).toFixed(4)}.`;
}

function buildMessages(){
  const out=[];
  for(let t=1;t<=TURNS;t++){
    out.push({role:'user',content:[{type:'text',text:`Pergunta ${t}: como resolvo a questão ${t}?\n\nConsidere $f(x)=x^${t%9+1}+${t}$ e explique o passo a passo.`}]});
    out.push({role:'assistant',content:[{type:'text',text:assistantBody(t)}]});
    const long=t%50===0;
    out.push({role:'toolResult',content:[{type:'text',text:long?'linha de resultado com número e texto; '.repeat(520):`ok ${t}`}],toolCallId:`t${t}`});
    out.push({role:'assistant',content:[{type:'text',text:`Fechando a resposta ${t}: o sinal fica positivo e a integral vale $\\frac{1}{${t%20+2}}$.`}]});
  }
  return out;
}

const uptime=()=>execSync('uptime').toString().trim();
const fmt=ms=>`${ms.toFixed(0)} ms`;

const runtime=newRuntime('perf-long-history');
const course=seedCourse(runtime,'calc');
writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
const session=seedNativeSession(runtime,buildMessages(),{courseId:'calc',started:Date.now()-86400000,preview:'sintético 5000'});
writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-86400000}],pdfs:[],study:{title:'',xopp:''}}}});
const bytes=fs.statSync(session).size;

console.log(`# #118 — 5.000 mensagens sintéticas na janela (${(bytes/1048576).toFixed(2)} MB no descritor)`);
const rows=[];
try{
  for(let rep=1;rep<=REPS;rep++){
    const stamp=uptime();
    const bootStarted=Date.now();
    let app=null;
    try{
      app=await launchDesk({runtime});
      const page=await app.firstWindow();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await statusOnline(page,{timeout:90000});
      /* Abertura: conversa estável com a última resposta à vista. */
      await page.waitForFunction(text=>document.querySelector('#messages')?.textContent.includes(text),`Fechando a resposta ${TURNS}`,{timeout:180000});
      await page.waitForFunction(()=>{
        const box=document.querySelector('#messages');
        if(!box)return false;
        const key=[box.scrollWidth,box.scrollHeight].join(',');
        const seen=globalThis.__perfStable??={};
        const prev=seen.key;
        seen.key=key;
        return prev===key;
      },undefined,{timeout:60000,polling:500});
      const bootMs=Date.now()-bootStarted;
      const count=await page.evaluate(()=>document.querySelectorAll('#messages .message').length);

      /* Quebra do pipeline na própria página, com os módulos do app: reagrupa
         os turnos e remonta o histórico com os contadores do caminho de
         produção (`streamPaintStats.markupMs` = marked+KaTeX+highlight+
         sanitize; o resto da parede é DOM+aplicação). */
      const breakdown=await page.evaluate(async messages=>{
        const {historyTurns}=await import('./src/worklog.mjs');
        const {showHistory}=await import('./src/chat.mjs');
        const {resetStreamPaintStats,streamPaintStats}=await import('./src/chat-stream-view.mjs');
        const {resetMarkupStats,markupStats}=await import('./src/markdown.mjs');
        let t0=performance.now();
        const turns=historyTurns(messages);
        const turnsMs=performance.now()-t0;
        resetStreamPaintStats();resetMarkupStats();
        t0=performance.now();
        showHistory(messages);
        const showMs=performance.now()-t0;
        const paint=streamPaintStats(),markup=markupStats();
        /* DOMPurify sozinho no HTML final das 5.000 (uma passada). */
        const {default:DOMPurify}=await import('./node_modules/dompurify/dist/purify.es.mjs');
        const {svgSafeConfig}=await import('./src/figures/svg-guard.mjs');
        const html=document.querySelector('#messages').innerHTML;
        t0=performance.now();
        DOMPurify.sanitize(html,svgSafeConfig(DOMPurify,{FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['srcset']}));
        const purifyMs=performance.now()-t0;
        t0=performance.now();
        const scroller=document.querySelector('#chat')?.scrollHeight>document.querySelector('#chat')?.clientHeight?document.querySelector('#chat'):document.querySelector('#messages');
        scroller.scrollTop=0;
        await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
        document.querySelector('#messages .message')?.getBoundingClientRect();
        const scrollTopMs=performance.now()-t0;
        return {bubbles:document.querySelectorAll('#messages .message').length,turns:turns.length,turnsMs,showMs,markupMs:paint.markupMs,markupCalls:markup.calls,purifyMs,scrollTopMs,domMs:showMs-paint.markupMs};
      },JSON.parse(fs.readFileSync(session,'utf8')).messages);
      rows.push({rep,uptime:stamp,bootMs,count,...breakdown,pageErrors:errors});
      console.log(`rep ${rep}: abertura ${fmt(bootMs)} (bolhas ${breakdown.bubbles}) | uptime: ${stamp}`);
    }catch(repError){
      console.log(`rep ${rep} FALHOU: ${repError.message} | uptime: ${stamp}`);
    }finally{
      if(app)await app.close().catch(()=>{});
    }
  }
}catch(error){
  console.error(`FALHA na sonda: ${error.message}`);
  process.exitCode=1;
}finally{
  fs.rmSync(runtime,{recursive:true,force:true});
}

console.log('\n| rep | abertura boot→estável | showHistory | markup (md+katex) | DOMPurify | DOM+aplicação | historyTurns | rolar ao topo | uptime |');
console.log('|---|---|---|---|---|---|---|---|---|');
for(const row of rows){
  console.log(`| ${row.rep} | ${fmt(row.bootMs)} | ${fmt(row.showMs)} | ${fmt(row.markupMs)} (${row.markupCalls} chamadas) | ${fmt(row.purifyMs)} | ${fmt(row.domMs)} | ${fmt(row.turnsMs)} | ${fmt(row.scrollTopMs)} | ${row.uptime} |`);
}
const avg=key=>rows.reduce((sum,row)=>sum+row[key],0)/Math.max(1,rows.length);
if(rows.length){
  const conversion=avg('markupMs'),first=avg('showMs');
  console.log(`\nConversão (markup) ≈ ${fmt(conversion)} de ${fmt(first)} do showHistory (${(100*conversion/Math.max(1,first)).toFixed(0)}%).`);
  console.log(`Ganho máximo de adiar a formatação ≈ tempo até a primeira tela útil menos o rico só da janela visível (dezenas de ms): ~${fmt(Math.max(0,conversion-50))} por abertura.`);
  const leaked=rows.flatMap(row=>row.pageErrors);
  if(leaked.length)console.log(`Erros de página: ${leaked.join(' | ')}`);
}
