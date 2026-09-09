import * as pdfjs from './node_modules/pdfjs-dist/build/pdf.mjs';
import {marked} from './node_modules/marked/lib/marked.esm.js';
import katex from './node_modules/katex/dist/katex.mjs';
import DOMPurify from './node_modules/dompurify/dist/purify.es.mjs';
import {calculate} from './calculator.mjs';
import {icon} from './icons.mjs';
import {displayUserText,contentParts} from './text.mjs';
import {pageTurnFromWheel} from './wheel.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./node_modules/pdfjs-dist/build/pdf.worker.mjs',import.meta.url).href;
const $=s=>document.querySelector(s);let supportsImages=true,switching=false,modelCatalog=[],library=[],panels=[],connected=false,connecting=null,busy=false,refVisible=true,saveTimer,currentSession='',captureOk=false,canConferir=false,includeRefs=true,appConfig={};
const pdfCache=new Map(),pdfInflight=new Map();
function toast(text){if(!text||text==='stopped')return;$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,9000);}
function pdfSnapshot(){return panels.map(p=>({path:p.path,page:p.page,zoom:p.zoom,scrollX:p.scrollX||0,scrollY:p.scrollY||0}));}
function calcHeightPx(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))||220;}
function layoutSnapshot(){return {draft:$('#prompt').value,pdfs:pdfSnapshot(),referenceVisible:refVisible,chatWidth:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat')),calcHeight:calcHeightPx()};}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>window.desk.save(layoutSnapshot()).catch(e=>toast(e.message)),400);}
async function cachedPdf(file){
 if(pdfCache.has(file))return pdfCache.get(file);
 if(pdfInflight.has(file))return pdfInflight.get(file);
 const job=(async()=>{
  const bytes=await window.desk.readPDF(file);
  const loading=pdfjs.getDocument({data:bytes,standardFontDataUrl:new URL('./node_modules/pdfjs-dist/standard_fonts/',import.meta.url).href,cMapUrl:new URL('./node_modules/pdfjs-dist/cmaps/',import.meta.url).href,cMapPacked:true});
  const doc=await loading.promise;
  const hit={doc,loading};
  pdfCache.set(file,hit);
  if(pdfCache.size>4){
   for(const [key,entry] of pdfCache){
    if(key===file)continue;
    try{entry.loading.destroy();}catch{}
    pdfCache.delete(key);break;
   }
  }
  return hit;
 })();
 pdfInflight.set(file,job);
 try{return await job;}finally{pdfInflight.delete(file);}
}
function markup(text){const math=[];const protectedText=text.replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\$)\$([^\n$]+)\$(?!\$)/g,(match,a,b,c,d)=>{const n=math.length;try{math.push(katex.renderToString(a??b??c??d,{displayMode:a!==undefined||b!==undefined,throwOnError:false,trust:false}));}catch{math.push(match);}return `MATHPLACEHOLDER${n}END`;});let html=marked.parse(protectedText,{breaks:true});html=html.replace(/MATHPLACEHOLDER(\d+)END/g,(_,n)=>math[n]);return DOMPurify.sanitize(html,{FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['srcset']});}
function message(role,text,images=[]){$('#welcome')?.remove();const el=document.createElement('article');el.className=`message ${role}`;const label=document.createElement('div');label.className='role';label.textContent=role==='user'?'Você':'Pi';const body=document.createElement('div');body.className='body';el.append(label,body);$('#messages').append(el);updateMessage(el,text,images);return el;}
function paintMessage(el,text,images){
 el.querySelector('.body').innerHTML=markup(displayUserText(text||''));
 for(const src of images||[]){const img=document.createElement('img');img.src=src;img.alt='Captura do Xournal++';img.className='shot';el.querySelector('.body').append(img);}
 $('#messages').scrollTop=$('#messages').scrollHeight;
}
function updateMessage(el,text,images,live){
 if(!live){clearTimeout(el._tick);el._tick=0;paintMessage(el,text,images);return;}
 el._live=text;if(el._tick)return;el._tick=setTimeout(()=>{el._tick=0;paintMessage(el,el._live);},80);
}
function fillSessions(data){
 const sel=$('#session-select');if(!sel)return;
 currentSession=data.session||currentSession;
 sel.replaceChildren();
 for(const s of data.sessions||[])sel.append(new Option(s.label||s.path,s.path));
 if(currentSession)sel.value=currentSession;
}
function wireMenu(el){
 const trigger=el.querySelector('.nav-trigger');
 if(!trigger)return;
 const set=open=>{el.classList.toggle('open',open);trigger.setAttribute('aria-expanded',String(open));};
 trigger.addEventListener('click',e=>{e.stopPropagation();set(!el.classList.contains('open'));});
 trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();set(!el.classList.contains('open'));}});
}
for(const id of ['#study-menu','#mesa-menu'])wireMenu($(id));
document.addEventListener('click',e=>{
 for(const id of ['#study-menu','#mesa-menu']){
  const el=$(id);if(el&&!el.contains(e.target)){el.classList.remove('open');el.querySelector('.nav-trigger')?.setAttribute('aria-expanded','false');}
 }
});

class PdfPanel {
 constructor(index,label){
  Object.assign(this,{index,page:1,zoom:1,scrollX:0,scrollY:0,path:null,doc:null,renderTask:null,version:0,_renderSeq:0,_wheelAccum:0,_lastTurn:0});
  this.el=document.createElement('section');this.el.className='pdf-panel';this.el.tabIndex=0;this.el.setAttribute('aria-label',label);
  this.el.innerHTML=`<div class="pdf-title"><strong>${label}</strong><select class="pdf-select" aria-label="Documento de ${label}"></select><button class="open icon-btn" title="Abrir outro PDF" aria-label="Abrir PDF em ${label}">${icon('plus')}</button><button class="find-toggle icon-btn" title="Buscar" aria-label="Buscar em ${label}" aria-pressed="false">${icon('search')}</button></div><div class="pdf-tools"><button class="prev icon-btn" aria-label="Página anterior">${icon('chevronLeft')}</button><input class="page-number" type="number" min="1" value="1" aria-label="Página de ${label}"><span class="page-total">/ —</span><button class="next icon-btn" aria-label="Próxima página">${icon('chevronRight')}</button><button class="out icon-btn" aria-label="Diminuir zoom">${icon('minus')}</button><span class="zoom-label">100%</span><button class="in icon-btn" aria-label="Aumentar zoom">${icon('plus')}</button><button class="fit icon-btn" title="Ajustar à largura" aria-label="Ajustar à largura">${icon('unfold')}</button></div><div class="pdf-stage"><div class="pdf-viewport"><div class="pdf-placeholder">Escolha um PDF da biblioteca ou abra um arquivo local.</div></div><div class="pdf-foot"></div></div><form class="pdf-find" hidden><input placeholder="Buscar neste PDF…" aria-label="Buscar em ${label}"><button>Buscar</button></form>`;
  $('#pdf-grid').append(this.el);this.q=s=>this.el.querySelector(s);this.populate();
  this.q('.pdf-select').onchange=()=>this.load(this.q('.pdf-select').value);
  this.q('.open').onclick=async()=>{const file=await window.desk.openPDF();if(file){if(!library.some(p=>p.path===file.path)){library.push(file);panels.forEach(p=>p.populate());}this.load(file.path);}};
  this.q('.find-toggle').onclick=()=>{const form=this.q('.pdf-find');const open=form.hidden;form.hidden=!open;this.q('.find-toggle').setAttribute('aria-pressed',String(open));if(open)this.q('.pdf-find input').focus();};
  this.q('.prev').onclick=()=>this.goto(this.page-1);this.q('.next').onclick=()=>this.goto(this.page+1);this.q('.page-number').onchange=()=>this.goto(Number(this.q('.page-number').value));
  this.q('.out').onclick=()=>this.nudgeZoom(-.2);this.q('.in').onclick=()=>this.nudgeZoom(.2);this.q('.fit').onclick=()=>{this.zoom=1;this._drawn=null;this.render();save();};
  const box=this.q('.pdf-viewport');
  box.addEventListener('pointerdown',()=>this.el.focus());
  box.addEventListener('scroll',()=>{this.scrollX=box.scrollLeft;this.scrollY=box.scrollTop;save();},{passive:true});
  box.addEventListener('wheel',e=>{
   if(e.ctrlKey||e.metaKey){e.preventDefault();this.nudgeZoom(e.deltaY>0?-0.2:0.2);return;}
   const slack=2;
   const atTop=box.scrollTop<=slack;
   const atBottom=box.scrollTop+box.clientHeight>=box.scrollHeight-slack;
   const fits=box.scrollHeight<=box.clientHeight+slack;
   const result=pageTurnFromWheel({deltaY:e.deltaY,atTop,atBottom,fits,accum:this._wheelAccum,now:Date.now(),lastTurn:this._lastTurn});
   this._wheelAccum=result.accum;
   if(result.turn){e.preventDefault();this._lastTurn=Date.now();this.goto(this.page+result.turn);}
  },{passive:false});
  this.q('.pdf-find').onsubmit=async e=>{e.preventDefault();if(!this.doc)return;const term=this.q('.pdf-find input').value.trim().toLocaleLowerCase();if(!term)return;const doc=this.doc;const button=this.q('.pdf-find button');button.disabled=true;button.textContent='…';try{for(let offset=1;offset<=doc.numPages;offset++){const n=((this.page-1+offset)%doc.numPages)+1;const t=await (await doc.getPage(n)).getTextContent();if(doc!==this.doc)return;if(t.items.map(i=>i.str||'').join(' ').toLocaleLowerCase().includes(term)){this.goto(n);toast(`Encontrado na página ${n}.`);return;}}toast('Texto não encontrado. PDFs digitalizados podem não ter texto pesquisável.');}catch(e){toast(e.message);}finally{button.disabled=false;button.textContent='Buscar';}};
  this.resize=new ResizeObserver(()=>{const w=box.clientWidth;if(w===this._width)return;this._width=w;this.rememberScroll();clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.render(),120);});this.resize.observe(box);
 }
 nudgeZoom(delta){this.rememberScroll();this.zoom=Math.max(.5,Math.min(4,+(this.zoom+delta).toFixed(2)));this.q('.zoom-label').textContent=`${Math.round(this.zoom*100)}%`;clearTimeout(this.zoomTimer);this.zoomTimer=setTimeout(()=>{this._drawn=null;this.render();save();},50);}
 rememberScroll(){const box=this.q('.pdf-viewport');if(!box)return;this.scrollX=box.scrollLeft;this.scrollY=box.scrollTop;}
 populate(){const selected=this.path;this.q('.pdf-select').replaceChildren();const empty=new Option('Escolha um PDF…','');this.q('.pdf-select').append(empty);for(const p of library)this.q('.pdf-select').append(new Option(p.name,p.path));if(selected)this.q('.pdf-select').value=selected;}
 async load(path,settings={}){if(!path)return;const id=++this.version;this.renderTask?.cancel();this.path=path;this.page=settings.page||1;this.zoom=settings.zoom||1;this.scrollX=settings.scrollX||0;this.scrollY=settings.scrollY||0;this._drawn=null;this.q('.pdf-select').value=path;this.q('.pdf-foot').textContent='Carregando…';try{const {doc}=await cachedPdf(path);if(id!==this.version)return;this.doc=doc;this.page=Math.max(1,Math.min(doc.numPages,this.page));await this.render();save();}catch(e){this.q('.pdf-foot').textContent='Não foi possível abrir o PDF.';toast(e.message);}}
 goto(n){if(!this.doc)return;const page=Math.max(1,Math.min(this.doc.numPages,Math.trunc(n)||1));if(page===this.page)return;this.page=page;this.scrollX=0;this.scrollY=0;this._drawn=null;this._wheelAccum=0;this.render();save();}
 async render(){if(!this.doc||!this.el.offsetWidth)return;const seq=++this._renderSeq;const doc=this.doc,pageNumber=this.page;const box=this.q('.pdf-viewport');const width=box.clientWidth;const dpr=window.devicePixelRatio||1;if(this._drawn&&this._drawn.doc===doc&&this._drawn.page===pageNumber&&this._drawn.zoom===this.zoom&&this._drawn.width===width&&this._drawn.dpr===dpr){box.scrollLeft=this.scrollX;box.scrollTop=this.scrollY;return;}this.renderTask?.cancel();try{const page=await doc.getPage(pageNumber);if(seq!==this._renderSeq||doc!==this.doc||pageNumber!==this.page)return;const base=page.getViewport({scale:1});const style=getComputedStyle(box);const scale=Math.max(.1,(width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2)/base.width)*this.zoom;const viewport=page.getViewport({scale});let output=Math.max(dpr,2);const maxPx=16777216;const need=viewport.width*output*viewport.height*output;if(need>maxPx)output=Math.sqrt(maxPx/(viewport.width*viewport.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*output);canvas.height=Math.ceil(viewport.height*output);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;const task=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:output===1?null:[output,0,0,output,0,0],intent:'display'});this.renderTask=task;await task.promise;if(this.renderTask===task)this.renderTask=null;if(seq!==this._renderSeq||doc!==this.doc||pageNumber!==this.page)return;box.replaceChildren(canvas);this.canvas=canvas;this._drawn={doc,page:pageNumber,zoom:this.zoom,width,dpr};box.scrollLeft=this.scrollX;box.scrollTop=this.scrollY;this.q('.page-number').value=this.page;this.q('.page-number').max=doc.numPages;this.q('.page-total').textContent=`/ ${doc.numPages}`;this.q('.zoom-label').textContent=`${Math.round(this.zoom*100)}%`;this.q('.pdf-foot').textContent=`Página ${this.page} · ${this.path.split(/[/\\]/).at(-1)}`;}catch(e){if(e.name!=='RenderingCancelledException')toast('Erro ao renderizar PDF: '+e.message);}}
}
function showWelcome(title){
 const welcome=document.createElement('div');welcome.id='welcome';
 if(title){const h=document.createElement('h3');h.textContent=title;welcome.append(h);}
 const button=document.createElement('button');button.id='connect';button.innerHTML=`${icon('plug')} Conectar ao Pi`;
 button.onclick=()=>connect().catch(()=>{});
 const p=document.createElement('p');p.textContent='Sessão local desta matéria.';
 welcome.append(button,p);$('#messages').replaceChildren(welcome);
}
function showHistory(messages){
 const parsed=[];
 for(const m of messages||[]){
  if(!['user','assistant'].includes(m.role))continue;
  const {text,images}=contentParts(m);
  const shown=displayUserText(text);
  if(shown||images.length)parsed.push({role:m.role,text:shown,images});
 }
 let keep=6;
 for(let i=parsed.length-1;i>=0;i--){if(!parsed[i].images.length)continue;if(keep<=0)parsed[i].images=[];else keep--;}
 $('#messages').replaceChildren();
 for(const m of parsed)message(m.role,m.text,m.images);
}
async function connect(){if(connected)return;if(connecting)return connecting;$('#course-select').disabled=true;$('#pi-label').textContent='Conectando…';connecting=(async()=>{try{const result=await window.desk.connect();connected=true;modelCatalog=result.models||[];canConferir=!!result.canConferir;if(result.captureAvailable!=null)captureOk=!!result.captureAvailable;updateSettings(result);fillSessions(result);$('#status-dot').classList.add('online');$('#pi-label').textContent=result.state?.model?.name||result.state?.model?.id||'Pi';if(result.messages?.length)showHistory(result.messages);else $('#welcome')?.remove();}catch(e){$('#pi-label').textContent='Pi';toast(e.message);throw e;}finally{connecting=null;$('#course-select').disabled=busy;}})();return connecting;}
function refs(){return includeRefs?panels.filter((p,i)=>p.path&&(i===0||refVisible)).map(p=>({path:p.path,page:p.page})):[];}
async function send(text){if(!text.trim())return;try{await connect();message('user',text);$('#prompt').value='';setBusy(true);const result=await window.desk.prompt({text,refs:refs()});if(!result?.streaming)setBusy(false);}catch(e){setBusy(false);toast(e.message);}}
async function conferir(){
 if(busy)return;
 if(!captureOk){toast('Conferir Xournal++ está disponível só no macOS.');return;}
 const note=$('#prompt').value.trim();
 try{
  await connect();
  if(!supportsImages){toast('Escolha um modelo com suporte a imagens para conferir o Xournal++.');return;}
  const shot=await window.desk.captureReady();
  const label=note&&!note.startsWith('/conferir')?`Conferir Xournal++\n${note}`:'Conferir Xournal++';
  message('user',label,[shot.dataUrl]);
  $('#prompt').value='';
  setBusy(true);
  const text='/conferir '+(note||'Confira minha resolução e indique o primeiro erro relevante.');
  const result=await window.desk.prompt({text,refs:refs()});
  if(!result?.streaming)setBusy(false);
 }catch(e){setBusy(false);toast(e.message);}
}
function conferirEnabled(){return captureOk&&!(busy||(connected&&!supportsImages));}
function setBusy(value){busy=value;$('#course-select').disabled=value||!!connecting||switching;if($('#session-select'))$('#session-select').disabled=value||!!connecting||switching;$('#model-select').disabled=value||!connected;$('#thinking-select').disabled=value||!connected;$('#stop').hidden=!value;$('#send').disabled=value;$('#check').disabled=!conferirEnabled();$('#activity').textContent=value?'Pi está trabalhando…':'';}
let assistant=null,assistantText='';
window.desk.onEvent(e=>{
 if(e.type==='agent_start'){setBusy(true);}
 if(e.type==='message_start'&&e.message?.role==='assistant'){assistant=message('assistant','');assistantText='';}
 if(e.type==='message_update'&&e.assistantMessageEvent?.type==='text_delta'){assistantText+=e.assistantMessageEvent.delta;if(!assistant)assistant=message('assistant','');updateMessage(assistant,assistantText,[],true);}
 if(e.type==='message_end'&&e.message?.role==='assistant'){const {text,images}=contentParts(e.message);if(assistant)updateMessage(assistant,text,images);else if(text||images.length)message('assistant',text,images);assistant=null;assistantText='';if(e.message.errorMessage)toast(e.message.errorMessage);}
 if(e.type==='tool_execution_start')$('#activity').textContent=`Consultando · ${e.toolName}`;
 if(e.type==='agent_end')setBusy(false);
 if(e.type==='desk_error'){connected=false;$('#status-dot').classList.remove('online');setBusy(false);toast(e.message);}
 if(e.type==='extension_ui_request'){
  if(e.method==='notify'){toast(e.message);if(e.notifyType==='error')setBusy(false);}
  else if(['select','confirm','input','editor'].includes(e.method))showDialog(e);
  else if(e.method==='set_editor_text'&&e.text)$('#prompt').value=e.text;
 }
});
const dialogQueue=[];let currentDialog=null;
function showDialog(e){dialogQueue.push(e);if(currentDialog)return;nextDialog();}
function nextDialog(){const e=dialogQueue.shift();if(!e)return;currentDialog=e;$('#dialog-title').textContent=e.title||'Pi';$('#dialog-message').textContent=e.message||'';$('#dialog-fields').replaceChildren();let field;
 if(e.method==='select'){field=document.createElement('select');for(const o of e.options||[])field.append(new Option(o,o));}
 else if(e.method==='input'||e.method==='editor'){field=document.createElement(e.method==='editor'?'textarea':'input');field.value=e.prefill||'';field.placeholder=e.placeholder||'';}
 if(field){field.id='dialog-value';$('#dialog-fields').append(field);}$('#pi-dialog').showModal();}
$('#pi-dialog').addEventListener('close',()=>{const e=currentDialog;if(!e)return;const ok=$('#pi-dialog').returnValue==='ok';window.desk.respond(ok?{id:e.id,...(e.method==='confirm'?{confirmed:true}:{value:$('#dialog-value')?.value})}:{id:e.id,cancelled:true});currentDialog=null;nextDialog();});
$('#send').onclick=()=>send($('#prompt').value);$('#prompt').onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();if(!busy)send($('#prompt').value);}};$('#check').onclick=()=>conferir();$('#connect').onclick=()=>connect().catch(()=>{});$('#stop').onclick=()=>window.desk.abort().catch(e=>toast(e.message));$('#xournal').onclick=()=>window.desk.openXournal().catch(e=>toast(e.message));
window.desk.onMenuCheck(()=>conferir());
window.desk.onMenuStop(()=>{if(busy&&!$('#pi-dialog').open)window.desk.abort().catch(e=>toast(e.message));});
$('#new-session').onclick=async()=>{if(busy){toast('Pare a resposta antes de começar outra conversa.');return;}if(!confirm('Começar uma nova conversa? A sessão atual continuará salva.'))return;try{const data=await window.desk.newSession();connected=false;$('#status-dot').classList.remove('online');fillSessions(data);$('#messages').replaceChildren();await connect();toast('Nova conversa iniciada.');}catch(e){toast(e.message);}};
$('#session-select').onchange=async()=>{const file=$('#session-select').value;if(!file||file===currentSession)return;if(busy){toast('Pare a resposta antes de trocar de conversa.');$('#session-select').value=currentSession;return;}try{const data=await window.desk.openSession(file);connected=false;$('#status-dot').classList.remove('online');fillSessions(data);$('#messages').replaceChildren();await connect();}catch(e){toast(e.message);$('#session-select').value=currentSession;}};
$('#reference-toggle').onclick=()=>{refVisible=!refVisible;if(panels[1])panels[1].el.hidden=!refVisible;$('#pdf-grid').classList.toggle('single',!refVisible);$('#reference-toggle').setAttribute('aria-pressed',String(refVisible));save();};
$('#include-refs').onclick=()=>{includeRefs=!includeRefs;$('#include-refs').setAttribute('aria-pressed',String(includeRefs));};
$('#calc-toggle').onclick=e=>{if(e.target.closest('select'))return;const closed=!$('#calc-body').hidden;$('#calc-body').hidden=closed;$('#calc-toggle').setAttribute('aria-expanded',String(!closed));$('#calculator').classList.toggle('collapsed',closed);};
$('#calc-form').onsubmit=e=>{e.preventDefault();try{const expr=$('#expression').value;const result=calculate(expr,$('#angle').value==='deg');$('#result').textContent=result;const row=document.createElement('button');row.textContent=`${expr} = ${result}`;row.onclick=()=>{$('#expression').value=expr;$('#expression').focus();};$('#calc-history').prepend(row);while($('#calc-history').children.length>8)$('#calc-history').lastChild.remove();}catch(e){$('#result').textContent='—';toast(e.message);}};
let dragging=false;$('#divider').onpointerdown=e=>{dragging=true;$('#divider').setPointerCapture(e.pointerId);};$('#divider').onpointermove=e=>{if(dragging){document.documentElement.style.setProperty('--chat',Math.max(310,Math.min(650,innerWidth-e.clientX))+'px');}};$('#divider').onpointerup=()=>{dragging=false;save();};$('#divider').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){const w=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat'));document.documentElement.style.setProperty('--chat',Math.max(310,Math.min(650,w+(e.key==='ArrowLeft'?20:-20)))+'px');save();}};
let calcDrag=false;$('#calc-divider').onpointerdown=e=>{calcDrag=true;$('#calc-divider').setPointerCapture(e.pointerId);};$('#calc-divider').onpointermove=e=>{if(!calcDrag)return;const side=$('#sidebar').getBoundingClientRect();const height=Math.max(72,Math.min(side.height*0.7,side.bottom-e.clientY));document.documentElement.style.setProperty('--calc',Math.round(height)+'px');$('#calculator').classList.remove('collapsed');$('#calc-body').hidden=false;$('#calc-toggle').setAttribute('aria-expanded','true');};$('#calc-divider').onpointerup=()=>{calcDrag=false;save();};$('#calc-divider').onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){const h=calcHeightPx();document.documentElement.style.setProperty('--calc',Math.max(72,Math.min(700,h+(e.key==='ArrowUp'?20:-20)))+'px');save();}};
function typingTarget(el){return el?.closest?.('input,textarea,select')||['INPUT','TEXTAREA','SELECT'].includes(el?.tagName);}
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  for(const id of ['#study-menu','#mesa-menu']){const el=$(id);el?.classList.remove('open');el?.querySelector('.nav-trigger')?.setAttribute('aria-expanded','false');}
  if($('#pi-dialog').open||$('#help-dialog').open||$('#settings-dialog').open||$('#about-dialog').open)return;
  if(busy){e.preventDefault();window.desk.abort().catch(err=>toast(err.message));}return;
 }
 if((e.metaKey||e.ctrlKey)&&e.key===','){e.preventDefault();openSettings();return;}
 if((e.metaKey||e.ctrlKey)&&e.key==='/'){e.preventDefault();openHelp();return;}
 if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();if(!busy)conferir();return;}
 if(typingTarget(e.target)||e.target===document.getElementById('divider')||e.target===document.getElementById('calc-divider'))return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const panel=document.activeElement?.closest?.('.pdf-panel')||panels[0]?.el;const inst=panels.find(p=>p.el===panel);if(!inst)return;e.preventDefault();inst.goto(inst.page+(e.key==='ArrowRight'?1:-1));}
});
async function loadCourse(data){
 captureOk=!!data.captureAvailable;
 appConfig=data.config||appConfig;
 fillSessions(data);
 $('#prompt').value=data.state.draft||'';
 for(const p of panels){p.version++;p.resize.disconnect();clearTimeout(p.resizeTimer);p.renderTask?.cancel();p.loadingTask?.destroy();}
 $('#pdf-grid').replaceChildren();library=data.library||[];panels=[new PdfPanel(0,'Enunciado'),new PdfPanel(1,'Formulário & apoio')];
 $('#course-select').replaceChildren(...(data.courses||[]).map(c=>new Option(c.name,c.id)));
 if(data.courseId)$('#course-select').value=data.courseId;
 document.title=data.course?`Mesa de Estudos · ${data.course}`:'Mesa de Estudos';
 $('#xournal').hidden=data.platform==='win32'&&!appConfig.xournalPath;
 const preferred=[library.find(p=>p.name.normalize('NFD').includes('Limites'))||library.find(p=>!p.name.startsWith('Formul'))||library[0],library.find(p=>p.name.startsWith('Formul'))||library[1]];
 const loads=[];
 for(let i=0;i<2;i++){const saved=data.state.pdfs?.[i];if(saved?.path&&!library.some(p=>p.path===saved.path)){library.push({path:saved.path,name:saved.path.split(/[/\\]/).at(-1)});panels[i].populate();}if(saved?.path||preferred[i]?.path)loads.push(panels[i].load(saved?.path||preferred[i].path,saved||{}));}
 await Promise.all(loads);
 document.documentElement.style.setProperty('--chat',(data.state.chatWidth||390)+'px');
 document.documentElement.style.setProperty('--calc',(data.state.calcHeight||220)+'px');
 refVisible=data.state.referenceVisible!==false;panels[1].el.hidden=!refVisible;$('#pdf-grid').classList.toggle('single',!refVisible);$('#reference-toggle').setAttribute('aria-pressed',String(refVisible));
 $('#check').disabled=!captureOk;
 if(captureOk)$('#check').title='Capturar a resolução sob demanda';
 else $('#check').title='Conferir Xournal++ está disponível só no macOS';
 save();
}
function updateSettings(result){const current=result.state?.model;supportsImages=!!current?.input?.includes('image');$('#check').disabled=!conferirEnabled();$('#check').title=captureOk?(supportsImages?'Capturar a resolução sob demanda':'Este modelo não aceita imagens'):'Conferir Xournal++ está disponível só no macOS';$('#model-select').replaceChildren(...modelCatalog.map(m=>new Option(`${m.name||m.id} · ${m.provider}`,JSON.stringify([m.provider,m.id]))));if(current)$('#model-select').value=JSON.stringify([current.provider,current.id]);const labels={off:'Desligado',minimal:'Mínimo',low:'Baixo',medium:'Médio',high:'Alto',xhigh:'Muito alto',max:'Máximo'};$('#thinking-select').replaceChildren(...(result.levels||[]).map(l=>new Option(labels[l]||l,l)));$('#thinking-select').value=result.state?.thinkingLevel||'off';$('#model-select').disabled=busy;$('#thinking-select').disabled=busy;$('#pi-label').textContent=current?.name||current?.id||'Pi';}
async function settings(change){$('#model-select').disabled=true;$('#thinking-select').disabled=true;try{updateSettings(await window.desk.settings(change));}catch(e){toast(e.message);try{updateSettings(await window.desk.settings({}));}catch{}}finally{$('#model-select').disabled=busy;$('#thinking-select').disabled=busy;}}
$('#model-select').onchange=()=>{const [provider,id]=JSON.parse($('#model-select').value);settings({model:{provider,id}});};$('#thinking-select').onchange=()=>settings({level:$('#thinking-select').value});
$('#course-select').onchange=async()=>{const id=$('#course-select').value;switching=true;$('#course-select').disabled=true;try{clearTimeout(saveTimer);await window.desk.save(layoutSnapshot());const data=await window.desk.switchCourse(id);connected=false;$('#status-dot').classList.remove('online');showWelcome(data.course);$('#pi-label').textContent='Pi';$('#model-select').replaceChildren(new Option('Conecte ao Pi',''));$('#thinking-select').replaceChildren(new Option('—',''));setBusy(false);await loadCourse(data);connect().catch(()=>{});}catch(e){toast(e.message);}finally{switching=false;$('#course-select').disabled=false;}};
function labelBtn(el,name,text){if(!el)return;el.innerHTML=`${icon(name)}${text?` <span>${text}</span>`:''}`;}
labelBtn($('#reference-toggle'),'columns','Formulário');
labelBtn($('#xournal'),'external','Xournal++');
labelBtn($('#new-session'),'plus');
labelBtn($('#check'),'scan','Conferir Xournal++');
labelBtn($('#stop'),'square','Parar');
labelBtn($('#send'),'arrowUp','Enviar');
labelBtn($('#connect'),'plug','Conectar ao Pi');
labelBtn($('#help'),'help','Como usar');
labelBtn($('#settings'),'settings','Configurações');
labelBtn($('#about'),'help','Sobre');
labelBtn($('#include-refs'),'columns','Referências');
function openHelp(){if($('#help-dialog').open)return;$('#help-dialog').showModal();}
function openAbout(){if($('#about-dialog').open)return;$('#about-dialog').showModal();}
$('#help').onclick=openHelp;
$('#about').onclick=openAbout;
window.desk.onMenuHelp(openHelp);
window.desk.onMenuAbout(openAbout);

function courseRow(course={}){
 const row=document.createElement('div');row.className='cfg-course';
 row.innerHTML=`<input class="cfg-name" placeholder="Nome" value=""><input class="cfg-path" placeholder="Pasta dos PDFs" spellcheck="false" value=""><button type="button" class="cfg-browse">Pasta</button><button type="button" class="cfg-remove icon-btn" aria-label="Remover">×</button>`;
 row.querySelector('.cfg-name').value=course.name||'';
 row.querySelector('.cfg-path').value=course.path||'';
 row.dataset.id=course.id||'';
 row.querySelector('.cfg-browse').onclick=async()=>{const folder=await window.desk.pickFolder();if(folder)row.querySelector('.cfg-path').value=folder;};
 row.querySelector('.cfg-remove').onclick=()=>row.remove();
 return row;
}
function fillSettingsForm(cfg){
 $('#cfg-vault').value=cfg.vaultPath||'';
 $('#cfg-pi').value=cfg.piPath||'';
 $('#cfg-xournal').value=cfg.xournalPath||'';
 $('#cfg-xournal-wrap').hidden=appConfig.platform==='win32'&&!cfg.xournalPath;
 const box=$('#cfg-courses');box.replaceChildren();
 const list=cfg.courses?.length?cfg.courses:[{name:'',path:''}];
 for(const c of list)box.append(courseRow(c));
}
function readSettingsForm(){
 const courses=[...$('#cfg-courses').querySelectorAll('.cfg-course')].map(row=>{
  const name=row.querySelector('.cfg-name').value.trim();
  const folder=row.querySelector('.cfg-path').value.trim();
  if(!folder)return null;
  const id=row.dataset.id||name||folder.split(/[/\\]/).filter(Boolean).at(-1);
  return {id,name:name||id,path:folder};
 }).filter(Boolean);
 return {vaultPath:$('#cfg-vault').value.trim(),runtimePath:appConfig.runtimePath||'',piPath:$('#cfg-pi').value.trim(),xournalPath:$('#cfg-xournal').value.trim(),courses};
}
async function openSettings(first){
 const info=await window.desk.getConfig();
 appConfig={...appConfig,...info.config,platform:info.platform};
 $('#settings-title').textContent=first?'Bem-vindo à Mesa de Estudos':'Configurações';
 $('#settings-lead').textContent=first?'Escolha a pasta de dados e pelo menos uma matéria (nome + pasta de PDFs). O Pi pede as credenciais na primeira conexão.':'Caminhos e nomes desta mesa. As credenciais do modelo continuam no Pi.';
 fillSettingsForm(info.config||{});
 if(!$('#settings-dialog').open)$('#settings-dialog').showModal();
}
$('#cfg-vault-browse').onclick=async()=>{const folder=await window.desk.pickFolder();if(folder)$('#cfg-vault').value=folder;};
$('#cfg-pi-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-pi').value=file;};
$('#cfg-pi-detect').onclick=async()=>{const found=await window.desk.detectPi();if(found){$('#cfg-pi').value=found;toast('Pi encontrado.'); }else toast('Pi não encontrado. Rode npm run setup.');};
$('#cfg-xournal-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-xournal').value=file;};
$('#cfg-add-course').onclick=()=>$('#cfg-courses').append(courseRow());
$('#settings').onclick=()=>openSettings(false);
window.desk.onMenuSettings(()=>openSettings(false));
$('#settings-form').addEventListener('submit',async e=>{
 if(e.submitter?.id!=='settings-save'&&e.submitter?.value!=='ok')return;
 e.preventDefault();
 try{
  const data=await window.desk.saveConfig(readSettingsForm());
  $('#settings-dialog').close();
  connected=false;$('#status-dot').classList.remove('online');
  await loadCourse(data);
  if(!data.needsSetup&&data.detectedPi)connect().catch(()=>{});
 }catch(err){toast(err.message);}
});
const calcLabel=$('#calc-toggle > span');if(calcLabel)calcLabel.innerHTML=`${icon('calculator')} Calculadora`;
$('#prompt').addEventListener('input',save);
try{
 const data=await window.desk.init();
 await loadCourse(data);
 if(data.needsSetup)await openSettings(true);
 else if(data.detectedPi)connect().catch(()=>{});
}catch(e){toast(e.message);}
