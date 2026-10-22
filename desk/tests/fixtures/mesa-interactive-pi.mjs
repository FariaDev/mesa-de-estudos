#!/usr/bin/env node
// Synthetic Pi stream, real Mesa publication client and host bridge. No model.
import fs from 'node:fs';
import readline from 'node:readline';
import {createActivity, previewActivity} from '../../src/extensions/mesa-activity/client.mjs';
const args=process.argv.slice(2),session=args[args.indexOf('--session')+1];
const model={provider:'test',id:'offline',name:'Pi interativo sintético',input:['text']};
let streaming=false,seq=0;
const emit=e=>process.stdout.write(JSON.stringify(e)+'\n');
const append=message=>fs.appendFileSync(session,JSON.stringify({type:'message',message})+'\n');
const reply=(e,data)=>emit({type:'response',id:e.id,success:true,data});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const NET=process.env.FAKE_PI_NET_URL||'http://127.0.0.1:9/';
const netHtml=()=>`<p>rede</p><img src="${NET}img.png"><link rel="prefetch" href="${NET}prefetch"><audio src="${NET}audio.mp3"></audio>`;
const netCss=()=>`p{background:url("${NET}css.png")}@import url("${NET}import.css");`;
const netJs=()=>`const U=${JSON.stringify(NET)};const tries=[];const note=(n,ok)=>{tries.push(n);(ok?console.log:console.error)(n+(ok?" passou":" bloqueado"));};fetch(U+"fetch").then(()=>note("fetch",true),()=>note("fetch",false));try{const x=new XMLHttpRequest();x.open("GET",U+"xhr");x.onload=()=>note("xhr",true);x.onerror=()=>note("xhr",false);x.send();}catch(e){note("xhr",false);}try{const w=new WebSocket(U.replace("http","ws")+"ws");w.onopen=()=>note("ws",true);w.onerror=()=>note("ws",false);}catch(e){note("ws",false);}try{navigator.sendBeacon(U+"beacon","x")?note("beacon-enfileirado",false):note("beacon",false);}catch(e){note("beacon",false);}const s=document.createElement("script");s.onload=()=>note("script",true);s.onerror=()=>note("script",false);try{s.src=U+"script.js";document.head.append(s);}catch(e){note("script",false);}const i=new Image();i.onload=()=>note("img",true);i.onerror=()=>note("img",false);i.src=U+"new-image.png";try{new EventSource(U+"sse").onerror=()=>note("sse",false);}catch(e){note("sse",false);}mesa.ready();`;
/* PNG liso 320×220 (azul), gerado só para a figura de imagem da #52. */
const FIGURE_PNG='iVBORw0KGgoAAAANSUhEUgAAAUAAAADcCAIAAACOIe9xAAAB5UlEQVR42u3TAQkAAAzDsPm5tYu7xOsYBKKg0MweUCoSgIEBAwMGBgMDBgYMDBgYDAwYGDAwGBgwMGBgwMBgYMDAgIEBA4OBAQMDBgYDAwYGDAwYGAwMGBgwMGBgMDBgYMDAYGDAwICBAQODgQEDAwYGA6sABgYMDBgYDAwYGDAwYGAwMGBgwMBgYMDAgIEBA4OBAQMDBgYMDAYGDAwYGAwMGBgwMGBgMDBgYMDAgIHBwICBAQODgQEDAwYGDAwGBgwMGBgMDBgYMDBgYDAwYGDAwICBwcCAgQEDg4EBAwMGBgwMBgYMDBgYMDAYGDAwYGAwMGBgwMCAgcHAgIEBAwMGBgMDBgYMDAYGDAwYGDAwGBgwMGBgMDBgYMDAgIHBwICBAQMDBgYDAwYGDAwGBgwMGBgwMBgYMDBgYMDAYGDAwICBwcCAgQEDAwYGAwMGBgwMBlYBDAwYGDAwGBgwMGBgwMBgYMDAgIHBwICBAQMDBgYDAwYGDAwYGAwMGBgwMBgYMDBgYMDAYGDAwICBAQODgQEDAwYGAwMGBgwMGBgMDBgYMDAYGDAwYGDAwGBgwMCAgQEDg4EBAwMGBgMDBgYMDBgYDAwYGDAwYGAwMGBgwMBgYMDAgIEBA4OBAQMDBgYMDM0eawVZkonOoQQAAAAASUVORK5CYII=';
function specFor(text){
 const base={title:'Explorar o MRUV',objective:'Prever a posição em 3 s e comparar com o resultado.',alternativeMarkdown:'s(3)=6+4,5a. Com a=2 m/s², s=15 m; com a=4, s=24 m: dobrar a aceleração não dobra a posição, porque 6 m já é a posição inicial.',
 html:'<h2>Dobrar a aceleração dobra a posição em 3 s?</h2><label>1. Sua previsão para s(3) com a = 4 m/s² (m)<input id="guess" type="number" step="0.5" placeholder="ex.: 30"></label><label>2. Aceleração (m/s²)<input id="a" type="range" min="0" max="4" step="0.5" value="2"></label><p>3. Posição em 3 s: <output id="s"></output></p><button id="attempt" class="primary">Registrar previsão</button><p id="result" hidden></p>',css:'label{display:flex;margin-bottom:8px}',
 js:'const a=document.querySelector("#a"),s=document.querySelector("#s"),g=document.querySelector("#guess"),r=document.querySelector("#result");const pos=()=>6+4.5*Number(a.value);function update(){s.value=pos()+" m";mesa.state({a:Number(a.value),guess:g.value===""?null:Number(g.value)});}a.oninput=update;g.oninput=update;document.querySelector("#attempt").onclick=()=>{const previsao=g.value===""?null:Number(g.value),conclusao="Dobrar a aceleração não dobra a posição: 6 m já estavam lá.";r.hidden=false;r.textContent="Você previu "+(previsao===null?"nada":previsao+" m")+"; observado: "+pos()+" m. "+conclusao;mesa.attempt({pergunta:"Dobrar a aceleração dobra s(3)?",previsao,aceleracao:Number(a.value),posicao:pos(),conclusao});};mesa.onMessage(m=>{if(m.type==="init"&&m.state&&typeof m.state.a==="number"){a.value=m.state.a;if(typeof m.state.guess==="number")g.value=m.state.guess;update();}});update();mesa.ready();',katex:false};
 /* #42: visualização em Chart.js (tokens e paleta da Mesa) e prévia com erro. */
 /* Tela cheia de conteúdo misto: gráfico (contêiner de altura fixa, como o tutor
    costuma fazer), dois controles arrastáveis e texto. Função inventada. */
 if(text.includes('secante'))return {...base,kind:'visualizacao',charts:true,title:'Secante de f(x) = x³ − 2x',objective:'Ver a secante virar tangente quando h encolhe.',alternativeMarkdown:'Gráfico de f(x) = x³ − 2x com a secante entre x₀ e x₀ + h, controlada por dois sliders.',
  html:'<div id="box" style="position:relative;height:240px"><canvas id="chart"></canvas></div><label>h <input id="h" type="range" min="0.05" max="2" step="0.05" value="1"></label><label>x₀ <input id="x0" type="range" min="-1.5" max="1.5" step="0.1" value="0.5"></label><p id="slope">Arraste h para perto de zero e veja a inclinação da secante se aproximar da derivada.</p>',css:'label{display:flex;margin-bottom:8px}',
  js:'const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();const f=x=>x*x*x-2*x;const xs=Array.from({length:41},(_,i)=>-2+i*0.1);const h=document.querySelector("#h"),x0=document.querySelector("#x0"),out=document.querySelector("#slope");const line=()=>{const a=+x0.value,b=a+ +h.value,m=(f(b)-f(a))/(b-a);out.textContent="Inclinação da secante: "+m.toFixed(3);return xs.map(x=>f(a)+m*(x-a));};const chart=new Chart(document.querySelector("#chart"),{type:"line",data:{labels:xs.map(x=>x.toFixed(1)),datasets:[{label:"f(x)",data:xs.map(f),borderColor:css("--mesa-chart-1"),pointRadius:0},{label:"secante",data:line(),borderColor:css("--mesa-chart-2"),pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:-6,max:6}}}});const redraw=()=>{chart.data.datasets[1].data=line();chart.update("none");mesa.state({h:+h.value,x0:+x0.value});};h.addEventListener("input",redraw);x0.addEventListener("input",redraw);mesa.ready();',katex:false};
 if(text.includes('grafico'))return {...base,kind:'visualizacao',charts:true,title:'Posição no MRUV',objective:'Comparar s(t) para duas acelerações.',alternativeMarkdown:'Gráfico de s(t)=6+t²a/2 de 0 a 3 s para a=2 e a=4.',
  html:'<div class="viz"><div style="position:relative;height:220px"><canvas id="chart"></canvas></div><table id="tab"><thead><tr><th>t (s)</th><th>a=2</th><th>a=4</th></tr></thead><tbody></tbody></table></div>',css:'.viz{display:block}',
  js:'const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();const t=[0,0.5,1,1.5,2,2.5,3],s=a=>t.map(x=>6+a*x*x/2);const body=document.querySelector("#tab tbody");t.forEach((x,i)=>{const r=document.createElement("tr");r.innerHTML="<td>"+x+"</td><td>"+s(2)[i]+"</td><td>"+s(4)[i]+"</td>";body.append(r);});const chart=new Chart(document.querySelector("#chart"),{type:"line",data:{labels:t,datasets:[{label:"a = 2",data:s(2),borderColor:css("--mesa-chart-1")},{label:"a = 4",data:s(4),borderColor:css("--mesa-chart-2")}]},options:{responsive:true,maintainAspectRatio:false}});addEventListener("mesa-theme",()=>{chart.data.datasets[0].borderColor=css("--mesa-chart-1");chart.data.datasets[1].borderColor=css("--mesa-chart-2");chart.update("none");});console.log("pontos",t.length);mesa.ready();',katex:false};
 /* #52: figura sozinha com legenda, no tamanho natural (320×220), para a tela
   cheia crescer até caber. `figura imagem` usa PNG em data: (o quadro só aceita
   `img-src data:`); qualquer outra mensagem com "figura" usa o SVG. */
 if(text.includes('figura')){
  const svg='<svg width="320" height="220" viewBox="0 0 320 220" role="img" aria-label="Parábola com tangente e normal"><rect width="320" height="220" fill="#fff" stroke="#999"/><path d="M40 200 Q160 -60 280 200" fill="none" stroke="#2b6cb0" stroke-width="3"/><line x1="60" y1="150" x2="260" y2="50" stroke="#c0392b" stroke-width="2"/><line x1="130" y1="40" x2="190" y2="180" stroke="#2f855a" stroke-width="2"/></svg>';
  const png='<img width="320" height="220" alt="Figura da apostila" src="data:image/png;base64,'+FIGURE_PNG+'">';
  return {...base,kind:'visualizacao',title:'Tangente e normal',objective:'Ver a reta tangente e a normal a f(x)=x².',alternativeMarkdown:'Figura: parábola de f(x)=x² com a tangente em vermelho e a normal em verde.',
   html:'<figure>'+(text.includes('imagem')?png:svg)+'<figcaption>Exemplo da apostila</figcaption></figure>',css:'',js:'mesa.ready();',katex:false};
 }
 /* Hunt de rede (#42): o quadro tenta sair por todos os canais para um servidor local de prova. */
 if(text.includes('rede'))return {...base,kind:'visualizacao',title:'Tentativas de rede',html:netHtml(),css:netCss(),js:netJs()};
 if(text.includes('katex'))return {...base,title:'Matemática offline',html:'<div id="math"></div>',js:'katex.render("x^2+1",document.querySelector("#math"));mesa.ready();',katex:true};
 if(text.includes('loop'))return {...base,title:'Laço sintético',html:'<p>Laço isolado</p>',js:'mesa.ready();setTimeout(()=>{for(;;){}},200);'};
 return base;
}
/* Prévia (#42): o "tutor" chama a ferramenta de prévia pela ponte real e grava
   o que voltou num arquivo para o teste ler; nada aparece na conversa. */
async function preview(e){
 streaming=true;reply(e,{});
 emit({type:'agent_start'});
 const bridge=JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE);
 const wanted=e.message.includes('erro')?{html:'<p id="p">antes do erro</p>',js:'console.log("ok", 42);console.warn("cuidado");document.querySelector("#nada").textContent="x";',theme:'escuro',width:390}
  :e.message.includes('rede')?{html:netHtml(),css:netCss(),js:netJs()}
  :{...specFor('grafico'),theme:'claro'};
 let out;
 try{out=await previewActivity(bridge,wanted);}catch(error){out={error:error.message};}
 if(process.env.FAKE_PI_PREVIEW_OUT)fs.writeFileSync(process.env.FAKE_PI_PREVIEW_OUT,JSON.stringify(out));
 streaming=false;emit({type:'agent_end'});emit({type:'agent_settled'});
}
async function prompt(e){
 if(e.message.includes('previa'))return preview(e);
 streaming=true;reply(e,{});const id='integrated-call-'+(++seq),spec=specFor(e.message);
 const content=[{type:'text',text:'Antes da atividade.'},{type:'toolCall',id,name:'mesa_criar_atividade',arguments:spec},{type:'text',text:'Depois da declaração.'}];
 append({role:'user',content:[{type:'text',text:e.message}]});
 emit({type:'agent_start'});emit({type:'message_start',message:{role:'assistant',id:'integrated-message-'+seq}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',contentIndex:0,delta:content[0].text}});await pause(150);
 emit({type:'message_update',assistantMessageEvent:{type:'toolcall_end',contentIndex:1,toolCall:content[1]}});await pause(150);
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',contentIndex:2,delta:content[2].text}});
 emit({type:'message_end',message:{role:'assistant',id:'integrated-message-'+seq,content}});append({role:'assistant',content});
 emit({type:'tool_execution_start',toolCallId:id,toolName:'mesa_criar_atividade',args:spec});
 try{
  const bridge=JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE);
  const activity=await createActivity(bridge,spec,{toolCallId:id});
  const result={content:[{type:'text',text:'Atividade publicada.'}],details:{activity}};
  emit({type:'tool_execution_end',toolCallId:id,toolName:'mesa_criar_atividade',isError:false,result});
  append({role:'toolResult',toolCallId:id,toolName:'mesa_criar_atividade',isError:false,...result});
 }catch(error){emit({type:'tool_execution_end',toolCallId:id,toolName:'mesa_criar_atividade',isError:true,result:{content:[{type:'text',text:error.message}]}});}
 streaming=false;emit({type:'agent_end'});emit({type:'agent_settled'});
}
for await(const line of readline.createInterface({input:process.stdin})){
 let e;try{e=JSON.parse(line);}catch{continue;}
 if(e.type==='get_state')reply(e,{model,thinkingLevel:'off',isStreaming:streaming,pendingMessageCount:0,autoCompactionEnabled:true});
 else if(e.type==='get_messages'){let messages=[];try{messages=fs.readFileSync(session,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l).message);}catch{}reply(e,{messages});}
 else if(e.type==='get_available_models')reply(e,{models:[model]});
 else if(e.type==='get_commands')reply(e,{commands:[]});
 else if(e.type==='get_session_stats')reply(e,{contextUsage:{tokens:100,contextWindow:100000,percent:0.1}});
 else if(e.type==='prompt')prompt(e).catch(error=>{streaming=false;emit({type:'desk_error',message:error.message});});
 else if(e.type==='abort'){streaming=false;reply(e,{});emit({type:'agent_end'});emit({type:'agent_settled'});}
 else if(e.id)reply(e,{});
}
