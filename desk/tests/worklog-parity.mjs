/* Paridade do adaptador do worklog: roda um roteiro determinístico de eventos
   contra desk/src/worklog.mjs e imprime o JSON. Serve para comparar com o
   snapshot da implementação antiga (mesmo roteiro, mesma projeção), gerado na
   migração para o núcleo em `$TMPDIR/worklog-snapshot-old.json`:
     node tests/worklog-parity.mjs
   Script comum, de propósito fora do runner de *.test.mjs. Nada aqui usa
   Date.now(): todos os `now` são explícitos, então a saída é determinística. */
import {pathToFileURL} from 'node:url';

/* Projeção semântica do passo: só os campos que a API antiga prometia, com
   vazios normalizados (undefined e '' são a mesma coisa para os consumidores). */
function projectStep(step){
 return {
  id:step.id,
  kind:step.kind,
  status:step.status,
  startedAt:step.startedAt,
  endedAt:step.endedAt,
  text:step.text??'',
  toolName:step.toolName??'',
  args:step.args&&Object.keys(step.args).length?step.args:null,
  query:step.query??'',
  url:step.url??'',
  domain:step.domain??'',
  pageTitle:step.pageTitle??'',
  results:(step.results??[]).map(hit=>({title:hit.title??'',url:hit.url??''})),
  resultText:step.resultText??'',
  error:step.error??'',
 };
}

function projectLog(log){
 return {startedAt:log.startedAt,endedAt:log.endedAt,reason:log.reason,text:log.text,steps:(log.steps??[]).map(projectStep)};
}

function projectTurn(w,turn){
 return {
  startedAt:turn.startedAt,
  endedAt:turn.endedAt,
  time:turn.time,
  userTime:turn.userTime,
  userText:turn.userText,
  userImages:turn.userImages,
  text:turn.text,
  steps:turn.steps.map(projectStep),
  headLine:w.headLine(turn),
  counts:w.countsLabel(turn.steps),
 };
}

export function runScenario(w){
 const out={};

 /* ---------- classificação e formatação ---------- */
 out.toolKinds=['web_search','Buscar na web','open_reference','REFERENCE','web_fetch','reader_x','http_probe','some_url','page-turn','quiz','busca','']
  .map(name=>({name,kind:w.toolKind(name)}));
 out.toolKindUndefined=w.toolKind(undefined);
 out.durations=[0,1,499,900,4400,59999,60000,65000,119999,120000,3600000]
  .map(ms=>({ms,label:w.formatDuration(ms)}));

 /* ---------- rajadas de pensamento ---------- */
 const log=w.createLog(1000);
 out.thinking={
  runningOnEmpty:w.runningStep(log)===null,
  emptyDelta:w.thinkingDelta(log,'',1100)===null,
 };
 const d1=w.thinkingDelta(log,'Vou procurar ',1200);
 const d2=w.thinkingDelta(log,'o jogo.',1400);
 out.thinking.burst={
  ids:log.steps.map(step=>step.id),
  d1IsLast:d1===log.steps.at(-1),
  d2IsD1:d2===d1,
  status:d2.status,
  startedAt:d2.startedAt,
  endedAt:d2.endedAt,
  text:d2.text,
  live:{label:w.liveLabel(d2),preview:w.stepPreview(d2),detail:w.stepDetail(d2)},
 };
 out.thinking.closeReturn=w.closeThinking(log,4000)===undefined;
 out.thinking.afterClose={running:w.runningStep(log)===null,steps:projectLog(log).steps,label:w.stepLabel(log.steps[0])};

 /* Duas rajadas com ferramenta no meio: fechar precisa pegar as duas. */
 const t1=w.thinkingDelta(log,'segunda rajada',4100);
 w.startTool(log,{id:'m1',name:'quiz',args:{q:1},now:4200});
 const t2=w.thinkingDelta(log,'terceira',4300);
 out.thinking.multiBefore={ids:log.steps.map(step=>step.id),running:log.steps.filter(step=>step.status==='running').map(step=>step.id)};
 w.closeThinking(log,4400);
 out.thinking.multiAfter={steps:projectLog(log).steps,t1Status:t1.status,t2Status:t2.status,t1EndedAt:t1.endedAt,t2EndedAt:t2.endedAt};

 /* ---------- ferramentas ---------- */
 const tools=w.createLog(0);
 const search=w.startTool(tools,{id:'s1',name:'web_search',args:{query:'kojima xbox'},now:100});
 out.tools={
  searchLive:w.liveLabel(search),
  searchPreviewBefore:w.stepPreview(search),
  unknownFinish:w.finishTool(tools,{id:'nope',now:150})===null,
 };
 const many=[
  {title:'A',url:'https://a.dev'},{url:'https://b.dev'},{title:'C'},{title:'',url:''},null,
  {title:'D',url:'https://d.dev'},{title:'E',url:'https://e.dev'},{title:'F',url:'https://f.dev'},{title:'G',url:'https://g.dev'},
 ];
 w.finishTool(tools,{id:'s1',now:1600,isError:false,result:{
  content:[{type:'text',text:'1. [OD](https://example.com/od)'},{type:'image',url:'x'},{type:'text',text:'extra'}],
  details:{results:many},
 }});
 out.tools.searchAfter=projectStep(search);
 out.tools.searchLabel=w.stepLabel(search);
 out.tools.searchDetail=w.stepDetail(search);
 out.tools.finishAgain=w.finishTool(tools,{id:'s1',now:1700})===null;

 const fetchSource=w.startTool(tools,{id:'f1',name:'web_fetch',args:{},now:2000});
 out.tools.fetchLiveBefore=w.liveLabel(fetchSource);
 w.finishTool(tools,{id:'f1',now:2100,isError:false,result:{content:[{type:'text',text:'conteúdo'}],details:{title:'IGN',source:'https://www.ign.com/articles/x'}}});
 out.tools.fetchSource=projectStep(fetchSource);
 out.tools.fetchSourceLabel=w.stepLabel(fetchSource);
 out.tools.fetchSourceDetail=w.stepDetail(fetchSource);

 const fetchUrl=w.startTool(tools,{id:'f2',name:'web_fetch',args:{url:'https://www.ign.com/articles/y'},now:2200});
 out.tools.fetchUrlLive=w.liveLabel(fetchUrl);
 w.finishTool(tools,{id:'f2',now:2300,isError:false,result:{content:'texto cru',details:{}}});
 out.tools.fetchUrl=projectStep(fetchUrl);

 const ref=w.startTool(tools,{id:'r1',name:'open_reference',args:{query:'tetris effect'},now:2400});
 out.tools.refLive=w.liveLabel(ref);
 w.finishTool(tools,{id:'r1',now:2500,isError:false,result:{content:'referência: livro X',details:{}}});
 out.tools.refAfter=projectStep(ref);
 out.tools.refDetail=w.stepDetail(ref);

 const bad=w.startTool(tools,{id:'e1',name:'web_search',args:{query:'x'},now:2600});
 w.finishTool(tools,{id:'e1',now:2700,isError:true,result:{content:[{type:'text',text:'rede fora'}],details:{}}});
 out.tools.errorStep=projectStep(bad);
 out.tools.errorDetail=w.stepDetail(bad);

 const bad2=w.startTool(tools,{id:'e2',name:'web_search',args:{query:'y'},now:2750});
 w.finishTool(tools,{id:'e2',now:2800,isError:true,result:null});
 out.tools.errorFallback=projectStep(bad2);

 const quiz=w.startTool(tools,{id:'q1',name:'quiz',args:{question:'q?',options:['a','b']},now:2900});
 out.tools.toolLive=w.liveLabel(quiz);
 out.tools.toolDetailBefore=w.stepDetail(quiz);
 const auto=w.startTool(tools,{name:'ferramenta estranha',now:2950});
 out.tools.autoId=auto.id;
 out.tools.autoLive=w.liveLabel(auto);
 out.tools.autoLabel=w.stepLabel(auto);
 w.finishTool(tools,{id:auto.id,now:2960,isError:false,result:{content:'feito',details:{}}});
 out.tools.autoAfter=projectStep(auto);
 out.tools.autoDetail=w.stepDetail(auto);

 w.addError(tools,'Ferramenta bloqueada neste app: bash',3000);
 w.addError(tools,'   ',3050);
 out.tools.errorsAdded=tools.steps.slice(-2).map(projectStep);

 out.tools.finishReturn=w.finishLog(tools,{now:4000,reason:'stopped'})===undefined;
 out.tools.finalSteps=projectLog(tools).steps;
 out.tools.headLine=w.headLine(tools);
 out.tools.counts=w.countsLabel(tools.steps);
 out.tools.liveAfterFinish=w.runningStep(tools)===null;
 out.tools.identity={
  searchStatus:search.status,searchEndedAt:search.endedAt,
  quizStatus:quiz.status,quizEndedAt:quiz.endedAt,
  autoStatus:auto.status,autoEndedAt:auto.endedAt,
  badStatus:bad.status,badEndedAt:bad.endedAt,
 };

 /* ---------- fechos ---------- */
 const log2=w.createLog(0);
 const ret2=w.thinkingDelta(log2,'pensa',100);
 w.addError(log2,'erro qualquer',200);
 out.finishBlocked={finishReturn:w.finishLog(log2,{now:2500,reason:'blocked'})===undefined};
 out.finishBlocked.steps=projectLog(log2).steps;
 out.finishBlocked.headLine=w.headLine(log2);
 out.finishBlocked.counts=w.countsLabel(log2.steps);
 out.finishBlocked.returnedThinking={isFirst:ret2===log2.steps[0],status:ret2.status,endedAt:ret2.endedAt};

 const log3=w.createLog(5000);
 w.thinkingDelta(log3,'a',5100);
 w.finishLog(log3,{now:6000});
 out.finishQuiet={steps:projectLog(log3).steps,headLine:w.headLine(log3),counts:w.countsLabel(log3.steps)};

 const log4=w.createLog(10);
 w.finishLog(log4,{now:20});
 out.finishEmpty={steps:projectLog(log4).steps,headLine:w.headLine(log4),counts:w.countsLabel(log4.steps)};

 out.countsMixed=w.countsLabel([
  {kind:'search'},{kind:'search'},{kind:'fetch'},{kind:'tool'},{kind:'error'},{kind:'thinking'},
 ]);

 /* ---------- histórico ---------- */
 const messages=[
  {role:'user',content:[{type:'text',text:'qual o jogo?'}],timestamp:1000},
  {role:'assistant',content:[
   {type:'thinking',thinking:'Vou buscar.'},
   {type:'toolCall',id:'t1',name:'web_search',arguments:{query:'kojima xbox'}},
   {type:'text',text:'Buscando…'},
  ],timestamp:2000},
  {role:'toolResult',toolCallId:'t1',toolName:'web_search',isError:false,timestamp:3000,
   content:[{type:'text',text:'1. [OD](https://example.com/od)'}],
   details:{results:[{title:'OD',url:'https://example.com/od'}]}},
  {role:'assistant',content:[{type:'text',text:'É o OD.'}],timestamp:4000},
  {role:'user',content:[{type:'text',text:'e o preço?'},{type:'image',url:'https://img.example/x.png'}],timestamp:5000},
  {role:'assistant',content:[
   {type:'thinking',text:'via text'},
   {type:'toolCall',id:'t2',name:'web_fetch',arguments:{url:'https://x.dev/preco'}},
   {type:'toolCall',id:'t3',name:'quiz',arguments:{question:'q?'}},
  ],timestamp:6000},
  {role:'toolResult',toolCallId:'t2',toolName:'web_fetch',isError:true,timestamp:6500,
   content:[{type:'text',text:'offline'}],details:{}},
  {role:'user',content:'   ',timestamp:7000},
  {role:null,content:[{type:'text',text:'ignorar'}],timestamp:7100},
  {role:'assistant',content:[{type:'thinking',thinking:'  '},{type:'text',text:''}],timestamp:7200},
 ];
 out.history={
  turns:w.historyTurns(messages).map(turn=>projectTurn(w,turn)),
  empty:w.historyTurns([]),
  strings:w.historyTurns([
   {role:'user',content:'oi',timestamp:5},
   {role:'assistant',content:'olá',timestamp:6},
  ]).map(turn=>projectTurn(w,turn)),
 };

 return out;
}

async function main(){
 const worklog=await import('../src/worklog.mjs');
 process.stdout.write(JSON.stringify(runScenario(worklog),null,2)+'\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
