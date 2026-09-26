import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';
import {calculate} from '../calculator.mjs';
const require2=createRequire(import.meta.url);

test('calculator precedence, functions and angle units',()=>{assert.equal(calculate('2+3*4'),'14');assert.equal(calculate('(2+3)*4'),'20');assert.equal(calculate('2*(3+4*(1+1))'),'22');assert.equal(calculate('-2^2'),'-4');assert.equal(calculate('2^3^2'),'512');assert.equal(calculate('sqrt(16)+sin(pi/2)'),'5');assert.equal(calculate('sin(30)',true),'0.5');assert.equal(calculate('1,5+2'),'3.5');assert.equal(calculate('2^-2'),'0.25');});
test('calculator rejects executable syntax and undefined results',()=>{for(const x of ['process.exit()','constructor(1)','1/0','sqrt(-1)','2;3','2+','sin(1','x=3'])assert.throws(()=>calculate(x),x);});
test('calculator answers the reciprocal and the inverse functions',()=>{assert.equal(calculate('sec(0)'),'1');assert.equal(calculate('sec(60)',true),'2');assert.equal(calculate('csc(30)',true),'2');assert.equal(calculate('cot(45)',true),'1');assert.equal(calculate('cot(90)',true),'0');assert.equal(calculate('sec(pi)'),'-1');assert.equal(calculate('csc(pi/2)'),'1');assert.equal(calculate('asin(0.5)'),'0.523598775598');assert.equal(calculate('asin(0.5)',true),'30');assert.equal(calculate('acos(0.5)',true),'60');assert.equal(calculate('atan(1)',true),'45');assert.equal(calculate('atan(1)*4'),'3.14159265359');});
test('calculator is exact on exact angles and undefined at the poles',()=>{for(const [x,d,w] of [['cos(90)',true,'0'],['sin(180)',true,'0'],['tan(180)',true,'0'],['sec(180)',true,'-1'],['cot(90)',true,'0'],['cos(-90)',true,'0'],['cos(pi/2)',false,'0'],['sin(pi)',false,'0'],['tan(pi)',false,'0'],['sec(pi)',false,'-1'],['cot(pi/2)',false,'0']])assert.equal(calculate(x,d),w,x);for(const [x,d] of [['tan(90)',true],['sec(90)',true],['csc(0)',true],['cot(0)',true],['tan(pi/2)',false],['sec(pi/2)',false],['csc(pi)',false],['1/tan(90)',true],['asin(2)',false],['acos(-2)',true]])assert.throws(()=>calculate(x,d),x);});
test('calculator keeps small but legit values out of the exact-angle net',()=>{assert.equal(calculate('sin(0.0001)'),'0.0000999999998333');assert.equal(calculate('sin(1e-9)'),'1e-9');assert.equal(calculate('tan(89.9999)',true),'572957.795104');});

// Carrega o main.cjs REAL com um módulo `electron` de mentira, para exercitar os
// handlers de estado (init/save-state/switch-course → initialData/persist/applyCourse)
// em processo puro, isolado no runtime temporário.
function loadMainWithMockElectron(runtime){
 const handlers=new Map();const listeners=new Map();
 const winEvents=new Map(),wcEvents=new Map();
 const record=(map,key,fn)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(fn);};
 const emitFor=map=>(key,...args)=>{for(const fn of map.get(key)||[])fn(...args);};
 const win={
  isDestroyed:()=>true,setBackgroundColor(){},
  webContents:{on:(name,fn)=>record(wcEvents,name,fn),getURL:()=>'',send(){},setWindowOpenHandler(){}},
  contentView:{addChildView(){}},
  loadFile:async()=>{},on:(name,fn)=>record(winEvents,name,fn),getBounds:()=>({x:10,y:10,width:1200,height:800})
 };
 const app={
  setName(){},setPath(){},getVersion:()=>'0.4.0',setAboutPanelOptions(){},
  dock:{setIcon(){}},getPath:()=>path.join(runtime,'electron'),
  whenReady:()=>Promise.resolve(),requestSingleInstanceLock:()=>true,quit(){},
  on(name,cb){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(cb);}
 };
 // WebContentsView de mentira: eventos de webContents e scripts executados ficam
 // acessíveis para o teste dirigir load/reload do applet e do renderer.
 const ggbViews=[];
 class WebContentsView{
  constructor(){
   this.visible=false;this.bounds=null;this.scripts=[];
   const events=new Map();
   this.webContents={
    isDestroyed:()=>false,
    on:(name,fn)=>record(events,name,fn),
    emit:(name,...args)=>emitFor(events)(name,...args),
    loadFile:async()=>{},
    executeJavaScript:async script=>{this.scripts.push(script);return null;}
   };
   ggbViews.push(this);
  }
  setBounds(bounds){this.bounds=bounds;}
  setVisible(value){this.visible=value;}
  capturePage(){return {isEmpty:()=>true,toPNG:()=>Buffer.alloc(0)};}
 }
 const electron={
  app,
  BrowserWindow:class{constructor(){return win;}},
  ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on(){}},
  dialog:{showOpenDialog:async()=>({canceled:true,filePaths:[]}),showSaveDialog:async()=>({canceled:true})},
  shell:{openPath:async()=>'',showItemInFolder(){}},
  Menu:{buildFromTemplate:()=>({}),setApplicationMenu(){}},
  screen:{getAllDisplays:()=>[{id:1,workArea:{x:0,y:0,width:1600,height:1000}}],getPrimaryDisplay:()=>({id:1,workArea:{x:0,y:0,width:1600,height:1000}})},
  systemPreferences:{getMediaAccessStatus:()=>'granted',askForMediaAccess:async()=>{}},
  nativeImage:{createFromBuffer:()=>({isEmpty:()=>true,getSize:()=>({width:0,height:0})})},
  WebContentsView
 };
 const Module=require2('node:module');const original=Module._load;
 Module._load=function(request,parent,isMain){if(request==='electron')return electron;return original.call(Module,request,parent,isMain);};
 const previousRuntime=process.env.LEARNING_DESK_RUNTIME;
 process.env.LEARNING_DESK_RUNTIME=runtime;
 /* main.cjs é um singleton de processo: sem limpar o cache, o segundo runtime do
    arquivo de teste veria o módulo (e os handlers) do primeiro. */
 const mainPath=require2.resolve('../main.cjs');delete require2.cache[mainPath];
 try{require2('../main.cjs');}finally{Module._load=original;if(previousRuntime===undefined)delete process.env.LEARNING_DESK_RUNTIME;else process.env.LEARNING_DESK_RUNTIME=previousRuntime;}
 return {handlers,ggbViews,renderer:win.webContents,emitWin:emitFor(winEvents),emitRenderer:emitFor(wcEvents),quit:()=>{for(const cb of listeners.get('before-quit')||[])try{cb();}catch{}}};
}

test('desk.json round-trips through init/save-state/switch-course and ggbBase64 lives only in runtime/ggb',async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'desk-state-'));
 try{
  const courseA=path.join(runtime,'learning','Courses','A');const courseB=path.join(runtime,'learning','Courses','B');
  fs.mkdirSync(courseA,{recursive:true});fs.mkdirSync(courseB,{recursive:true});
  const pdfA=path.join(courseA,'lista.pdf');fs.writeFileSync(pdfA,'pdf');const pdfB=path.join(courseA,'apoio.pdf');fs.writeFileSync(pdfB,'pdf');
  const xopp=path.join(runtime,'rascunho.xopp');fs.writeFileSync(xopp,'');
  const session=path.join(runtime,'pi-1700000000000.jsonl');fs.writeFileSync(session,'');
  const b64='Q1VCbyBmYWtlIHNuYXBzaG90';
  fs.mkdirSync(path.join(runtime,'ggb'),{recursive:true});
  fs.writeFileSync(path.join(runtime,'ggb','A.b64'),b64+'\n');
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:courseA},{id:'B',name:'Matéria B',path:courseB}]}));
  fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({
   session,courseId:'A',theme:'dark',
   pdfs:[{path:pdfA,page:2,zoom:1.4,scrollX:5,scrollY:7}],
   referenceVisible:true,chatWidth:420,calcHeight:260,pdfSplit:.62,draft:'rascunho antigo',
   study:{title:'Lista 2 · 7b',xopp},
   courseStates:{A:{session,study:{title:'Lista 2 · 7b',xopp}}}
  }));
  const {handlers,quit}=loadMainWithMockElectron(runtime);
  try{
   const init=await handlers.get('init')({});
   assert.equal(init.courseId,'A');
   assert.equal(init.state.session,session,'session load path preserves the session file');
   assert.deepEqual(init.state.pdfs.map(p=>({path:p.path,page:p.page,zoom:p.zoom,scrollX:p.scrollX,scrollY:p.scrollY})),[{path:pdfA,page:2,zoom:1.4,scrollX:5,scrollY:7}],'pdf positions/zoom/scroll round-trip');
   assert.equal(init.state.pdfSplit,.62);
   assert.equal(init.state.theme,'dark');
   assert.equal(init.state.draft,'rascunho antigo');
   assert.deepEqual(init.state.study,{title:'Lista 2 · 7b',xopp},'study context is reauthorized on load');
   assert.equal(init.state.ggbBase64,b64,'boot fills ggbBase64 from runtime/ggb/<id>.b64');
   assert.ok(init.preferred[0]===pdfA||init.library.some(p=>p.path===pdfA),'library still lists the course PDFs');
   assert.equal(init.deskVersion.length>0,true,'deskVersion reaches the renderer payload');

   await handlers.get('save-state')({},{
    draft:'novo rascunho',study:{title:'Lista 3 · q8',xopp},
    pdfs:[{path:pdfA,page:3,zoom:1.2,scrollX:1,scrollY:2,invert:true,minimized:true},{path:pdfB,page:1,zoom:1,scrollX:0,scrollY:0,invert:false}],
    referenceVisible:true,chatWidth:420,calcHeight:260,pdfSplit:.62,theme:'light'
   });
   let desk=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
   assert.equal(desk.draft,'novo rascunho');
   assert.deepEqual(desk.pdfs,[
    {path:pdfA,page:3,zoom:1.2,scrollX:1,scrollY:2,invert:true,minimized:true},
    {path:pdfB,page:1,zoom:1,scrollX:0,scrollY:0,invert:false,minimized:false}
   ],'both pdfs persist with invert e minimized');
   assert.equal(desk.theme,'light');assert.equal(desk.chatWidth,420);assert.equal(desk.calcHeight,260);assert.equal(desk.pdfSplit,.62);
   assert.equal(desk.session,session);assert.equal(desk.courseId,'A');
   assert.deepEqual(desk.courseStates.A.study,{title:'Lista 3 · q8',xopp},'course state carries the live study');
   assert.deepEqual(desk.courseStates.A.sessionStudies[session],{title:'Lista 3 · q8',xopp},'per-session study round-trips');
   assert.equal('ggbBase64' in desk,false,'desk.json no longer carries ggbBase64');
   assert.equal(desk.courseStates?.A?.ggbBase64,undefined,'courseStates no longer carry ggbBase64');
   assert.equal(fs.readFileSync(path.join(runtime,'ggb','A.b64'),'utf8').trim(),b64,'the snapshot file stays untouched');

   await handlers.get('save-state')({},{
    draft:'clampes',study:{title:'Lista 4 · clamp',xopp},pdfs:[{path:'/tmp/fora-da-mesa.pdf',page:1,zoom:1,scrollX:0,scrollY:0,invert:false}],
    referenceVisible:false,chatWidth:100,calcHeight:5000,pdfSplit:.05,theme:'rouge'
   });
   desk=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
   assert.equal(desk.pdfs.length,0,'pdfs outside the allowed set are dropped');
   assert.equal(desk.chatWidth,300);assert.equal(desk.calcHeight,900);assert.equal(desk.pdfSplit,.2);
   assert.equal(desk.theme,'light','unknown theme keeps the previous one');
   assert.equal(desk.referenceVisible,false);
   assert.deepEqual(desk.courseStates.A.study,{title:'Lista 4 · clamp',xopp},'the latest study is the one persisted');

   const switched=await handlers.get('switch-course')({},'B');
   assert.equal(switched.courseId,'B');
   assert.equal(switched.state.pdfs.length,0);
   const back=await handlers.get('switch-course')({},'A');
   assert.equal(back.courseId,'A');
   assert.equal(back.state.ggbBase64,b64,'applyCourse restores ggbBase64 from runtime/ggb/A.b64');
   assert.equal(back.state.study.title,'Lista 4 · clamp','per-session study is restored with the course');
   desk=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
   assert.equal('ggbBase64' in desk,false,'switches never write ggbBase64 back into desk.json');
   assert.equal(fs.existsSync(path.join(runtime,'ggb','B.b64')),false,'no snapshot file is invented for B');
  }finally{quit();}
 }finally{fs.rmSync(runtime,{recursive:true,force:true});}
});

test('fila e bandeja guardadas: pending-save/tray-save gravam por conversa e o payload as devolve',async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'desk-pending-'));
 try{
  const courseA=path.join(runtime,'learning','Courses','A');const courseB=path.join(runtime,'learning','Courses','B');
  fs.mkdirSync(courseA,{recursive:true});fs.mkdirSync(courseB,{recursive:true});
  const pdfA=path.join(courseA,'lista.pdf');fs.writeFileSync(pdfA,'pdf');
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:courseA},{id:'B',name:'Matéria B',path:courseB}]}));
  fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({courseId:'A'}));
  const dataUrl='data:image/png;base64,QUFBQQ==';
  const {handlers,quit}=loadMainWithMockElectron(runtime);
  try{
   const init=await handlers.get('init')({});
   assert.deepEqual(init.pending,{items:[],attachments:[],held:false,live:false},'sem nada guardado o payload vem vazio e não-live');
   fs.writeFileSync(init.session,'');

   const saved=await handlers.get('pending-save')({}, {items:[{id:'fila-1',text:'pendente',refs:[{path:pdfA,page:0}],images:[]},{text:'   ',refs:[],images:[]}],held:true});
   assert.deepEqual(saved.items.map(i=>i.text),['pendente'],'item sem texto e sem anexo não é guardado');
   assert.deepEqual(saved.items[0].refs,[{path:pdfA,page:1}],'página 0 vira 1');
   assert.equal(saved.held,true);
   const store=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
   assert.ok(store[init.session],'o arquivo é chaveado pelo caminho da conversa');

   const tray=await handlers.get('tray-save')({}, {images:[{dataUrl,mimeType:'image/png',name:'captura.png'}]});
   assert.equal(tray.attachments.length,1);
   assert.deepEqual(tray.items.map(i=>i.text),['pendente'],'o save da bandeja não mexe na fila');
   assert.equal(tray.held,true,'nem na guarda dela');

   const other=await handlers.get('switch-course')({},'B');
   assert.deepEqual(other.pending.items,[],'a outra matéria tem a fila dela');
   const back=await handlers.get('switch-course')({},'A');
   assert.deepEqual(back.pending.items.map(i=>i.text),['pendente'],'voltar para a matéria devolve a fila guardada');
   assert.equal(back.pending.attachments.length,1);
   assert.equal(back.pending.live,true,'gravado por esta execução (não é recuperação)');

   const fresh=await handlers.get('new-session')({});
   assert.deepEqual(fresh.pending.items,[],'conversa nova não herda a fila da anterior');
   const reopened=await handlers.get('open-session')({},init.session);
   assert.deepEqual(reopened.pending.items.map(i=>i.text),['pendente'],'voltar para a conversa devolve a fila dela');
   assert.equal(reopened.pending.held,true);
   assert.equal(reopened.pending.live,true);

   await assert.rejects(async()=>handlers.get('pending-save')({}, {items:'nada'}),/Fila inválida/);
   await assert.rejects(async()=>handlers.get('tray-save')({}, {images:'nada'}),/Anexos inválidos/);

   /* O que era da conversa antiga continua no disco depois de trocar. */
   await handlers.get('switch-course')({},'B');
   const stored=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
   assert.equal(stored[init.session].items.length,1,'a poda não leva a conversa que ainda existe');
  }finally{quit();}
 }finally{fs.rmSync(runtime,{recursive:true,force:true});}
});

test('Encerrar por hoje: end-day-save grava local e o registro volta no init; resume-clear apaga',async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'desk-resume-'));
 try{
  const courseA=path.join(runtime,'learning','Courses','A');const courseB=path.join(runtime,'learning','Courses','B');
  fs.mkdirSync(courseA,{recursive:true});fs.mkdirSync(courseB,{recursive:true});
  const pdfA=path.join(courseA,'lista.pdf');fs.writeFileSync(pdfA,'pdf');
  const pdfB=path.join(courseB,'apoio.pdf');fs.writeFileSync(pdfB,'pdf');
  const xopp=path.join(runtime,'rascunho.xopp');fs.writeFileSync(xopp,'');
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:courseA},{id:'B',name:'Matéria B',path:courseB}]}));
  fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({courseId:'A',pdfs:[{path:pdfA,page:2}],study:{title:'Lista 2 · 7b',xopp}}));
  const {handlers,quit}=loadMainWithMockElectron(runtime);
  try{
   const init=await handlers.get('init')({});
   assert.equal(init.resume,null,'sem registro não há cartão');

   const saved=await handlers.get('end-day-save')({}, {record:{
    stopped:'  travei na 3  ',next:'  fazer a 4  ',exercise:'  Lista 2 · 7b  ',xopp,
    pages:[{path:pdfA,page:0},{path:pdfB,page:3},{path:'/tmp/fora.pdf',page:9}]
   }});
   assert.deepEqual(saved,{
    stopped:'travei na 3',next:'fazer a 4',exercise:'Lista 2 · 7b',xopp,pages:[{path:pdfA,page:1}]
   },'o núcleo apara os textos e corta as páginas: só as da biblioteca desta matéria ficam');
   const stored=JSON.parse(fs.readFileSync(path.join(runtime,'resume.json'),'utf8'));
   assert.deepEqual(Object.keys(stored),['A'],'o arquivo é chaveado pela matéria');
   assert.deepEqual(stored.A.pages,[{path:pdfA,page:1}],'o disco guarda a página já levantada');

   assert.deepEqual((await handlers.get('init')({})).resume,saved,'o boot seguinte devolve o registro');
   const other=await handlers.get('switch-course')({},'B');
   assert.equal(other.resume,null,'o registro é da matéria, não da mesa');
   assert.deepEqual((await handlers.get('switch-course')({},'A')).resume,saved);

   /* `.xopp` fora do autorizado cai; o da questão (restaurado no boot) fica. */
   const outside=await handlers.get('end-day-save')({}, {record:{stopped:'onde',next:'próximo',xopp:'/tmp/fora.xopp',pages:[]}});
   assert.equal(outside.xopp,'');
   assert.equal((await handlers.get('end-day-save')({}, {record:{stopped:'onde',next:'próximo',xopp,pages:[]}})).xopp,xopp);

   await assert.rejects(async()=>handlers.get('end-day-save')({}, {record:{stopped:'   ',next:''}}),/Preencha onde parei/);
   await assert.rejects(async()=>handlers.get('end-day-save')({}, {record:'nada'}),/Registro inválido/);
   assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'resume.json'),'utf8')).A.next,'próximo','registro recusado não sobrescreve o que estava guardado');

   assert.equal(await handlers.get('resume-clear')({}),true);
   assert.equal((await handlers.get('init')({})).resume,null,'Retomar/Dispensar tiram o registro do arquivo');
   assert.equal(await handlers.get('resume-clear')({}),false,'limpar de novo não é erro');
  }finally{quit();}
 }finally{fs.rmSync(runtime,{recursive:true,force:true});}
});

test('favoritos e caderno: a tela mostra a lista filtrada e editar/remover vai pela identidade',async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'desk-identity-'));
 try{
  const courseA=path.join(runtime,'learning','Courses','A');
  fs.mkdirSync(courseA,{recursive:true});
  const pdfA=path.join(courseA,'Limites.pdf');fs.writeFileSync(pdfA,'pdf');
  const fora=path.join(runtime,'fora','Sumiu.pdf');
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:courseA}]}));
  fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({courseId:'A'}));
  /* O item OCULTO (PDF que saiu da biblioteca) vem PRIMEIRO: na tela o visível
     é a posição 0, mas no arquivo ele é o segundo. */
  fs.writeFileSync(path.join(runtime,'bookmarks.json'),JSON.stringify({A:[
   {name:'Sumido',path:fora,page:1},
   {name:'Limites',path:pdfA,page:3}
  ]}));
  fs.writeFileSync(path.join(runtime,'review.json'),JSON.stringify({A:[
   {question:'Oculto',attempt:'',difficulty:'',ref:{name:'Sumiu.pdf',page:1,path:fora}},
   {question:'Visível',attempt:'',difficulty:'',ref:{name:'Limites.pdf',page:3,path:pdfA}}
  ]}));
  const {handlers,quit}=loadMainWithMockElectron(runtime);
  try{
   const init=await handlers.get('init')({});
   assert.deepEqual(init.bookmarks,[{name:'Limites',path:pdfA,page:3}],'favorito de PDF fora da biblioteca não chega à tela');
   assert.deepEqual(init.review.map(one=>one.question),['Visível'],'item de PDF fora da biblioteca não chega à tela');

   /* O clique foi na linha 0 da tela (Limites); o arquivo tem ele na posição 1. */
   const afterRemove=await handlers.get('bookmarks-save')({}, {mode:'remove',item:{name:'Limites',path:pdfA,page:3}});
   assert.deepEqual(afterRemove,[],'a resposta do remove é a lista filtrada, como o init');
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime,'bookmarks.json'),'utf8')).A,
    [{name:'Sumido',path:fora,page:1}],'remover o visível não toca no favorito oculto');

   const afterAdd=await handlers.get('bookmarks-save')({}, {mode:'add',item:{name:'Limites',path:pdfA,page:5}});
   assert.deepEqual(afterAdd,[{name:'Limites',path:pdfA,page:5}],'guardar devolve a lista filtrada (o oculto não reaparece na tela)');

   const edited=await handlers.get('review-save')({}, {mode:'edit',
    key:{question:'Visível',attempt:'',difficulty:'',ref:{name:'Limites.pdf',page:3,path:pdfA}},
    item:{question:'Visível (editado)',attempt:'',difficulty:'',ref:{name:'Limites.pdf',page:3,path:pdfA}}});
   assert.deepEqual(edited.map(one=>one.question),['Visível (editado)'],'editar devolve a lista filtrada');
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime,'review.json'),'utf8')).A.map(one=>one.question),
    ['Oculto','Visível (editado)'],'editar o visível não mexe no oculto (nem na posição dele)');

   const removed=await handlers.get('review-save')({}, {mode:'remove',
    key:{question:'Visível (editado)',attempt:'',difficulty:'',ref:{name:'Limites.pdf',page:3,path:pdfA}}});
   assert.deepEqual(removed,[],'remover devolve a lista filtrada');
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime,'review.json'),'utf8')).A.map(one=>one.question),
    ['Oculto'],'remover o visível não leva o oculto');

   /* Chave que a tela ainda tem e o arquivo não: nada muda (a tela envelheceu). */
   const before=fs.readFileSync(path.join(runtime,'review.json'),'utf8');
   assert.deepEqual(await handlers.get('review-save')({}, {mode:'edit',
    key:{question:'Fantasma',attempt:'',difficulty:'',ref:{name:'Sumiu.pdf',page:1,path:fora}},
    item:{question:'Outro',attempt:'',difficulty:'',ref:{name:'Limites.pdf',page:3,path:pdfA}}}),[]);
   assert.equal(fs.readFileSync(path.join(runtime,'review.json'),'utf8'),before,'chave velha não regrava o caderno');
  }finally{quit();}
 }finally{fs.rmSync(runtime,{recursive:true,force:true});}
});

test('desk.json corrompido não derruba o init: pdfs/session/bounds viram tipos seguros e o próximo save regrava sanado',async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'desk-corrupt-'));
 try{
  const courseA=path.join(runtime,'learning','Courses','A');const courseB=path.join(runtime,'learning','Courses','B');
  fs.mkdirSync(courseA,{recursive:true});fs.mkdirSync(courseB,{recursive:true});
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:courseA},{id:'B',name:'Matéria B',path:courseB}]}));
  fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({
   courseId:'A',session:123,pdfs:{a:1},bounds:'x',study:null,ggbBase64:{nope:true},
   courseStates:{A:{pdfs:{a:1},session:77,sessions:'nope',sessionStudies:'nada',study:null}}
  }));
  const {handlers,quit}=loadMainWithMockElectron(runtime);
  try{
   const init=await handlers.get('init')({});
   assert.equal(typeof init.session,'string');
   assert.ok(init.session.length>0,'a sessão efetiva é criada no lugar do número');
   assert.ok(Array.isArray(init.state.pdfs),'pdfs do topo viram array');
   assert.deepEqual(init.state.pdfs,[]);
   assert.equal(init.state.bounds,undefined,'bounds inválido é descartado antes do placeWindow');
   assert.equal(init.state.ggbBase64,'','ggbBase64 não-string vira string vazia');
   assert.ok(Array.isArray(init.state.courseStates.A.pdfs),'pdfs da matéria viram array');
   assert.deepEqual(init.state.courseStates.A.pdfs,[]);
   assert.ok(Array.isArray(init.state.courseStates.A.sessions),'sessions da matéria viram array');
   assert.equal(typeof init.state.courseStates.A.session,'string','session da matéria vira string');
   assert.deepEqual(init.state.courseStates.A.sessionStudies,{});
   assert.deepEqual(init.state.courseStates.A.study,{});
   const switched=await handlers.get('switch-course')({},'B');
   assert.equal(switched.courseId,'B');
   assert.ok(Array.isArray(switched.state.pdfs));
   await handlers.get('save-state')({}, {pdfs:[],draft:'sanado',study:{title:'',xopp:''},referenceVisible:true,chatWidth:390,calcHeight:220,pdfSplit:.5,theme:'auto'});
   const desk=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
   assert.ok(Array.isArray(desk.pdfs),'desk.json sanado: pdfs array');
   assert.equal(typeof desk.session,'string','desk.json sanado: session string');
   assert.ok(desk.session.length>0);
   assert.ok(Array.isArray(desk.courseStates.B.pdfs));
   assert.ok(Array.isArray(desk.courseStates.B.sessions));
   assert.equal(typeof desk.courseStates.B.session,'string');
   assert.equal(desk.bounds,undefined,'bounds ruim não volta ao arquivo');
  }finally{quit();}
 }finally{fs.rmSync(runtime,{recursive:true,force:true});}
});

test('ggb: reload do applet reaplica o snapshot; reload do renderer esconde a View nativa',async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'desk-ggb-'));
 const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
 try{
  const courseA=path.join(runtime,'learning','Courses','A');
  fs.mkdirSync(courseA,{recursive:true});
  const snapshot='ZmFrZSBnZ2Igc25hcHNob3Q=';
  fs.mkdirSync(path.join(runtime,'ggb'),{recursive:true});
  fs.writeFileSync(path.join(runtime,'ggb','A.b64'),snapshot+'\n');
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:courseA}]}));
  fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({courseId:'A'}));
  const {handlers,ggbViews,emitWin,emitRenderer,quit}=loadMainWithMockElectron(runtime);
  try{
   await flush();
   const init=await handlers.get('init')({});
   assert.equal(init.state.ggbBase64,snapshot,'o boot carrega o snapshot da matéria');
   await handlers.get('ggb-view')({},{visible:true,rect:{x:0,y:0,width:320,height:240}});
   const view=ggbViews[0];
   assert.ok(view,'a ativação cria a View nativa');
   assert.equal(view.visible,true);
   assert.equal(view.scripts.some(script=>script.includes('setBase64')),false,'sem documento carregado ainda não aplica o snapshot');
   view.webContents.emit('did-finish-load');
   await flush();
   const restores=view.scripts.filter(script=>script.includes('setBase64'));
   assert.equal(restores.length,1,'o load do applet aplica o snapshot uma vez');
   assert.ok(restores[0].includes(JSON.stringify(snapshot)),'o script reaplica exatamente o snapshot da matéria');
   // reload do applet (o ggb.html recarrega no resize): novo documento, novo restore
   view.webContents.emit('did-finish-load');
   await flush();
   assert.equal(view.scripts.filter(script=>script.includes('setBase64')).length,2,'cada documento novo reaplica o snapshot');
   // trabalho ainda não salvo: o resize guarda a construção viva antes do reload
   const live='bm92YSBjb25zdHJ1Y2Fv';
   view.webContents.executeJavaScript=async script=>{view.scripts.push(script);return script.includes('getBase64')?live:true;};
   emitWin('resize');
   await flush();
   view.webContents.emit('did-finish-load');
   await flush();
   const last=view.scripts.filter(script=>script.includes('setBase64')).at(-1);
   assert.ok(last.includes(JSON.stringify(live)),'o resize capturou a construção viva antes do reload do applet');
   // reload do renderer: a view (e o ggb-shot) saem de cena
   emitRenderer('did-start-navigation',{},'file:///mesa/index.html',false,false);
   assert.equal(view.visible,true,'navegação de outro frame não esconde a view');
   emitRenderer('did-start-navigation',{},'file:///mesa/index.html',false,true);
   assert.equal(view.visible,false,'o reload do renderer esconde a View nativa');
   await assert.rejects(handlers.get('ggb-shot')({}),/Abra a aba GeoGebra primeiro/,'com a view fora, o ggb-shot recusa');
  }finally{quit();}
 }finally{fs.rmSync(runtime,{recursive:true,force:true});}
});

test('atalhos: o guard de diálogo modal vem antes de Configurações/Ajuda/Conferir/GeoGebra no keydown',()=>{
 const source=fs.readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 const start=source.indexOf("window.addEventListener('keydown'");
 const end=source.indexOf("$('#model-select').onchange",start);
 assert.ok(start>0&&end>start,'handler de keydown localizado no main do renderer');
 const handler=source.slice(start,end);
 const at=needle=>{const i=handler.indexOf(needle);assert.ok(i>=0,`${needle} presente no handler`);return i;};
 const guard=at("document.querySelector('dialog[open]')");
 assert.match(handler.slice(guard,guard+72),/e\.key!==['"]Escape['"]/,'o guard de modal não engole o Esc dos diálogos');
 assert.equal(handler.indexOf("if(document.querySelector('dialog[open]'))return;"),-1,'o guard não fica depois dos atalhos');
 for(const needle of ["e.key===','","e.key==='/'","e.key.toLowerCase()==='c'","e.key.toLowerCase()==='g'"]){
  assert.ok(guard<at(needle),`o guard precede o atalho de ${needle}`);
 }
});

// Carrega o preload.cjs real com `electron` de mentira para exercitar a ponte:
// limpeza da mensagem de `invoke` e o dedupe `desk_error` × rejeição de conexão.
function loadPreloadWithMockElectron(){
 const exposed={},listeners=new Map(),state={handler:()=>Promise.resolve(null)};
 const ipcRenderer={
  invoke:(channel,...args)=>state.handler(channel,...args),
  on:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}
 };
 const contextBridge={exposeInMainWorld:(name,api)=>{exposed[name]=api;}};
 const Module=require2('node:module');const original=Module._load;
 Module._load=function(request,parent,isMain){if(request==='electron')return {contextBridge,ipcRenderer};return original.call(Module,request,parent,isMain);};
 const previousWindow=globalThis.window;
 globalThis.window={addEventListener(){}};
 const preloadPath=require2.resolve('../preload.cjs');delete require2.cache[preloadPath];
 try{require2('../preload.cjs');}finally{Module._load=original;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
 return {
  desk:exposed.desk,
  onInvoke:handler=>{state.handler=handler;},
  emit:(name,data)=>{for(const fn of listeners.get(name)||[])fn({},data);}
 };
}

test('preload: invoke perde o boilerplate do Electron e a conexão que falha gera um aviso só',async()=>{
 const {desk,onInvoke,emit}=loadPreloadWithMockElectron();
 const events=[];desk.onEvent(event=>events.push(event));
 const errors=()=>events.filter(event=>event.type==='desk_error').map(event=>event.message);
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const M='Pi encerrou (1). A conversa foi preservada; tente reconectar.';
 // mensagem original preservada, sem o embrulho do Electron
 onInvoke(()=>Promise.reject(Error(`Error invoking remote method 'pi-health': Error: ${M}`)));
 await assert.rejects(desk.health(),error=>error.message===M,'invoke devolve a mensagem original');
 // conexão em voo + desk_error com a mesma mensagem + rejeição → um único aviso
 let rejectConnect=null;
 onInvoke(channel=>channel==='pi-connect'?new Promise((_,reject)=>{rejectConnect=reject;}):Promise.resolve(null));
 const connectCall=desk.connect();
 emit('pi-event',{type:'desk_error',message:M});
 rejectConnect(Error(`Error invoking remote method 'pi-connect': Error: ${M}`));
 await assert.rejects(connectCall,error=>error.message===M);
 await sleep(300);
 assert.deepEqual(errors(),[],'desk_error coberto pela rejeição de pi-connect não é repassado');
 // evento sem rejeição equivalente segue normalmente
 emit('pi-event',{type:'desk_error',message:'Falha solta do Pi.'});
 await sleep(300);
 assert.deepEqual(errors(),['Falha solta do Pi.'],'evento sem rejeição é repassado');
 // rejeição de conexão que chega antes do evento também cobre o aviso
 onInvoke(()=>Promise.reject(Error(`Error invoking remote method 'pi-health': Error: ${M}`)));
 await assert.rejects(desk.health(),error=>error.message===M);
 emit('pi-event',{type:'desk_error',message:M});
 await sleep(300);
 assert.deepEqual(errors(),['Falha solta do Pi.'],'evento que chega depois da rejeição de conexão é coberto');
 // canal que não é de conexão não engole o evento (queda no meio de um prompt)
 onInvoke(()=>Promise.reject(Error(`Error invoking remote method 'pi-prompt': Error: ${M}`)));
 await assert.rejects(desk.prompt({text:'oi'}),error=>error.message===M);
 emit('pi-event',{type:'desk_error',message:M});
 await sleep(300);
 assert.deepEqual(errors(),['Falha solta do Pi.',M],'rejeição de pi-prompt não esconde o desk_error');
});
