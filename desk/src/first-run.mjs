import {$,S,toast,connect,applyAccent,save} from './state.mjs';
import {wireAccentPicker} from './accent-picker.mjs';
import {applyIcons} from './view-host.mjs';
import {icon} from '../icons.mjs';
import firstRun from './generated/firstrun.core.js';
import {t,setUiLanguage,LANGUAGE_EVENT} from './ui-text.mjs';
import {initialSetup,nextSetup,backSetup,goToStep,stepId,clearFolder} from './setup-flow.mjs';
import {paintSetup,focusTarget} from './setup-view.mjs';

/* Primeira abertura (tickets #21, #24 e #64).
   Sem configuração (`needsSetup`) — ou com a pasta de dados válida e nenhuma
   matéria — a Mesa abre uma tela cheia de passos (#64): boas-vindas, como a
   Mesa funciona, nome, PDFs, tutor (opcional) e pronto. A matéria só nasce no
   botão **Criar a matéria** do último passo (decisão do usuário na #64; antes
   nascia sozinha com nome e pasta). O núcleo `core/firstrun.bend` decide qual
   primeira abertura vale, se pode criar e o id; os passos são de
   `setup-flow.mjs` e a pintura de `setup-view.mjs`. Aqui ficam o ciclo
   (entrar, sincronizar, sair), o arrasto e a ponte.

   O estado por baixo é o do Livre (sem matéria o host abre `mesa-free`): a
   tela cobre a Mesa, que fica `inert` atrás, e "Estudar sem matéria" sai daqui
   para a aba Livre. Nada do Livre é desligado. */

let active=false;
/* Qual primeira abertura está valendo (`entry` do núcleo): "setup" ou "empty". */
let kind='setup';
/* Havia matéria na última leitura do host? Fora da tela (a pessoa foi para a
   aba Livre), só volta quando passa de ter matéria a não ter nenhuma. */
let seenCourses=null;
let state=initialSetup('setup');
let facts={kind:'setup',piFound:false,claudeFound:false,opencodeFound:false,opencodeBinary:'',opencodeOldVersion:'',installSupported:false,platform:'',dataFolder:'',pdfNames:[],elsewhere:0,visibleEngines:['pi','claude','opencode']};
let creating=false;
let wired=false;
let hooks={createCourse:async()=>{},openPiSettings:()=>{}};
let benched=[];
/** Estado vivo da instalação do OpenCode na tela (#release OpenCode). */
let install={state:'idle',phase:'',percent:-1,errorCode:'',error:'',version:''};

const announce=()=>{try{window.dispatchEvent(new Event('desk-tutor-link'));}catch{}};

export const isFirstRun=()=>active;

const actions={
 Connect:()=>{connect().catch(()=>{});},
 /* Começar sem plano pago (#44): evento, para não depender do diálogo. */
 UseFreeModels:()=>window.dispatchEvent(new Event('desk-open-free-models')),
 OpenPiSettings:()=>hooks.openPiSettings(),
 ChangeDataFolder:()=>{changeDataFolder();},
 InstallOpenCode:()=>{runInstall();},
 UpdateOpenCode:()=>{if(window.confirm(t('firstrun.tutor.opencodeOldConfirm',{version:facts.opencodeOldVersion})))runInstall();},
 OpenOpenCodeHelp:()=>{window.desk.openExternal?.('https://opencode.ai/v2/docs/').catch(()=>{});},
};

function paint(){
 if(!active)return;
 paintSetup(state,facts,actions,install);
}

/** Troca o estado e repinta; o foco vai para o campo do passo novo. */
function move(next){
 const changed=next.step!==state.step;
 state=next;
 paint();
 if(changed)focusTarget(state)?.focus();
}

/* Matéria de verdade: a aba Livre (`kind: 'free'`) não conta. */
const hasCourses=data=>(data?.courses||[]).some(course=>course?.kind==='course');

/* O host diz `needsSetup` e a lista de matérias; o núcleo diz qual primeira
   abertura vale ("setup", "empty" ou ""). */
function entryOf(data){
 return String(firstRun.entry(!!data?.needsSetup,hasCourses(data)));
}

/* ---------- ações ---------- */

/* A pasta (escolhida ou solta) passa pelo host: ele diz qual é a pasta da
   matéria, quantos PDFs tem, os primeiros nomes e o que ficou de fora. A
   escolhida chega como caminho (`firstRunResolveFolder`); a solta, como `File`
   (`firstRunResolveDrop`). */
async function takeFolder(out){
 facts={...facts,pdfNames:out.pdfNames||[],elsewhere:out.elsewhere||0};
 state={...state,folder:out.folder,pdfCount:out.pdfCount||0,alert:false};
 paint();
 if(out.elsewhere>0)toast(t('firstrun.elsewhere',{count:out.elsewhere}));
}

async function pickFolder(){
 if(creating)return;
 try{
  const chosen=await window.desk.pickFolder();
  if(chosen)await takeFolder(await window.desk.firstRunResolveFolder(chosen));
 }catch(error){toast(error?.message||t('firstrun.error.openFolder'));}
}

/* Pasta escolhida por engano (#70): sai, e com ela os nomes e o aviso. */
function removeFolder(){
 if(creating)return;
 facts={...facts,pdfNames:[],elsewhere:0};
 state=clearFolder(state);
 paint();
 $('#first-run-pick').focus();
}

async function changeDataFolder(){
 try{
  const chosen=await window.desk.pickFolder();
  if(!chosen)return;
  facts={...facts,dataFolder:chosen};
  paint();
 }catch(error){toast(error?.message||t('firstrun.error.openFolder'));}
}

async function takeDropped(files){
 if(creating||!files.length)return;
 try{await takeFolder(await window.desk.firstRunResolveDrop(files));}
 catch(error){toast(error?.message||t('firstrun.error.drop'));}
}

/* Só o botão do último passo cria; o núcleo confirma nome e pasta antes. */
async function create(){
 if(creating||!active)return;
 const typed=state.name;
 if(!firstRun.canCreate(typed,state.folder))return;
 creating=true;
 try{
  /* "empty": a pasta de dados já valia e não é pedida nem regravada. */
  await hooks.createCourse({id:firstRun.courseId(typed,state.folder),name:typed.trim(),folder:state.folder,dataFolder:String(firstRun.dataToConfirm(kind,facts.dataFolder))});
  leave();
 }catch(error){toast(error?.message||t('firstrun.error.create'));}
 finally{creating=false;}
}

function advance(){
 if(stepId(state)==='ready'){create();return;}
 move(nextSetup(state));
}

async function chooseLanguage(event){
 const language=event.target.closest?.('[data-language]')?.dataset.language;
 if(!language)return;
 try{setUiLanguage((await window.desk.languageSet({ui:language})).ui);}
 catch(error){toast(error?.message||String(error));}
}

/* ---------- a Mesa atrás ---------- */

/* Tudo que não é a tela, um diálogo ou o aviso fica `inert`: Tab não cai na
   Mesa escondida e o leitor de tela lê só os passos. */
function bench(on){
 if(!on){for(const el of benched)el.inert=false;benched=[];return;}
 for(const el of document.body.children){
  if(el.id==='setup'||el.id==='toast'||el.tagName==='DIALOG'||el.tagName==='SCRIPT'||el.inert)continue;
  el.inert=true;benched.push(el);
 }
}

function leave(){
 if(!active)return;
 active=false;
 kind='setup';
 delete document.body.dataset.firstRun;
 bench(false);
 announce();
}

/* Instalação do OpenCode: a casca do main responde com a versão conferida e
   a detecção refeita. O erro volta ao botão; nada de sair da tela. */
async function runInstall(){
 if(install.state==='installing')return;
 install={state:'installing',phase:'prepare',percent:-1,errorCode:'',error:'',version:''};
 paint();
 try{
  if(typeof window.desk.openCodeInstall!=='function')throw Error(t('firstrun.install.failed'));
  const result=await window.desk.openCodeInstall();
  if(!result?.ok){
   const failure=Error(String(result?.message||t('firstrun.install.failed')));
   failure.code=String(result?.code||'failed');
   throw failure;
  }
  let detected=result.detected||{};
  try{
   const data=await window.desk.getConfig();
   detected={...detected,detectedOpenCode:data?.detectedOpenCode||detected.detectedOpenCode,detectedOpenCodeOldVersion:data?.detectedOpenCodeOldVersion||''};
   S.detected={...(S.detected||{}),opencode:data?.detectedOpenCode||''};
  }catch{/* a detecção do retorno já basta para a tela */}
  const binary=String(detected.detectedOpenCode||result.binary||'');
  facts={...facts,opencodeFound:binary,opencodeBinary:binary,opencodeOldVersion:String(detected.detectedOpenCodeOldVersion||'')};
  install={state:'done',phase:'done',percent:100,errorCode:'',error:'',version:String(result.version||'')};
  window.dispatchEvent(new Event('desk-engine-facts'));
 }catch(error){
  /* A tela usa o código; a mensagem técnica (HTTP, hash, fs) fica no log do
     host e nunca aparece crua aqui. */
  install={state:'error',phase:'',percent:-1,errorCode:String(error?.code||'failed'),error:String(error?.message||''),version:''};
 }
 paint();
}

/* ---------- ligação ---------- */

function typing(){
 state={...state,name:$('#first-run-name').value};
 paint();
}

const hasFiles=transfer=>[...(transfer?.types||[])].includes('Files');

/* Vale soltar em qualquer ponto da tela no passo dos PDFs; nos outros, soltar
   não abre o arquivo na janela (o Electron navegaria até ele). */
function wireDrop(setup){
 const over=event=>{
  if(!active||!hasFiles(event.dataTransfer))return;
  event.preventDefault();
  const here=stepId(state)==='folder';
  if(event.dataTransfer)event.dataTransfer.dropEffect=here?'copy':'none';
  if(here&&!state.alert){state={...state,alert:true};paint();}
 };
 setup.addEventListener('dragenter',over);
 setup.addEventListener('dragover',over);
 setup.addEventListener('dragleave',event=>{
  if(setup.contains(event.relatedTarget)||!state.alert)return;
  state={...state,alert:false};paint();
 });
 setup.addEventListener('drop',event=>{
  if(!active||!hasFiles(event.dataTransfer))return;
  event.preventDefault();
  state={...state,alert:false};
  if(stepId(state)!=='folder'){paint();return;}
  takeDropped(Array.from(event.dataTransfer.files||[]));
 });
}

function wire(){
 if(wired)return;
 wired=true;
 const setup=$('#setup');
 const input=$('#first-run-name');
 input.addEventListener('input',typing);
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();advance();}});
 $('#setup-examples').addEventListener('click',event=>{
  const example=event.target.closest?.('button');
  if(!example)return;
  input.value=example.textContent.trim();
  move({...state,name:input.value});
  input.focus();
 });
 $('#first-run-pick').addEventListener('click',pickFolder);
 $('#setup-folder-remove').addEventListener('click',removeFolder);
 /* O acento vale na hora no setup (#70), como nas Configurações. */
 wireAccentPicker($('#setup-accent'),{current:()=>S.currentAccent,choose:id=>{applyAccent(id);save(true);}});
 $('#first-run-pick').addEventListener('mouseenter',()=>{if(!state.folder){state={...state,alert:true};paint();}});
 $('#first-run-pick').addEventListener('mouseleave',()=>{if(state.alert){state={...state,alert:false};paint();}});
 $('#setup-next').addEventListener('click',advance);
 $('#setup-back').addEventListener('click',()=>move(backSetup(state)));
 $('#setup-skip-tour').addEventListener('click',()=>move(goToStep(state,'name')));
 /* "Como a Mesa funciona" leva ao passeio; ⌘/ continua abrindo o Guia. */
 $('#first-run-help').addEventListener('click',()=>move(goToStep(state,'tour')));
 $('#setup-free').addEventListener('click',leave);
 $('#first-run-language').addEventListener('click',chooseLanguage);
 $('#setup-language').addEventListener('click',chooseLanguage);
 /* Enter no último passo cria, fora de um campo ou botão (que já agem sozinhos). */
 setup.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||stepId(state)!=='ready'||event.target.closest?.('button,input'))return;
  event.preventDefault();create();
 });
 wireDrop(setup);
 window.addEventListener(LANGUAGE_EVENT,paint);
 window.desk.onOpenCodeInstallProgress?.(payload=>{
  if(!active||install.state!=='installing')return;
  const phase=String(payload?.phase||install.phase||'');
  const percent=Number(payload?.percent);
  /* Percentual só existe no download e nunca volta: fases sem número têm
     barra indeterminada, sem herdar o 99% anterior. */
  const next=Number.isFinite(percent)?Math.max(0,Math.min(100,percent)):-1;
  const shown=next<0?-1:Math.max(install.percent,next);
  install={...install,phase,percent:shown};
  paint();
 });
 /* O tutor ligou (ou caiu) pelo "Chamar o tutor": o passo do tutor acompanha. */
 window.addEventListener('desk-tutor-link',()=>{
  const online=String(S.link?.state||'')==='online';
  if(active&&online!==state.online){state={...state,online};paint();}
 });
 applyIcons(setup,icon);
}

/* Entra na primeira abertura: o host já carregou o estado (Livre) e disse que
   falta configuração ou matéria. `detectedPi`, `detectedClaude`,
   `detectedOpenCode` e `detectedOpenCodeOldVersion` são o que o host achou de
   cada motor; a 1.x do OpenCode aparece com a versão e não conta como pronta.
   Sem `needsSetup` o núcleo lê "tem configuração e nenhuma matéria" e vale o
   "empty" (começa no Nome, sem **Mudar**); quem quer a abertura completa passa
   `needsSetup: true`, como o host e o first-run-ui. */
export async function enterFirstRun(data,nextHooks={}){
 hooks={...hooks,...nextHooks};
 wire();
 kind=entryOf(data)||'setup';
 seenCourses=hasCourses(data);
 active=true;
 let dataFolder;
 try{dataFolder=String((await window.desk.firstRunDefaults())?.dataFolder||'');}catch{dataFolder='';}
 let installSupported=false;
 try{installSupported=!!(await window.desk.openCodeInstallSupported?.());}catch{/* a tela oferece o link oficial */}
 install={state:'idle',phase:'',percent:-1,errorCode:'',error:'',version:''};
 facts={kind,piFound:!!data?.detectedPi,claudeFound:!!data?.detectedClaude,opencodeFound:!!data?.detectedOpenCode,opencodeBinary:String(data?.detectedOpenCode||''),opencodeOldVersion:String(data?.detectedOpenCodeOldVersion||''),installSupported,platform:String(data?.platform||''),dataFolder,pdfNames:[],elsewhere:0,visibleEngines:Array.isArray(data?.visibleEngines)&&data.visibleEngines.length?data.visibleEngines:['pi','claude','opencode']};
 state={...initialSetup(kind),online:String(S.link?.state||'')==='online'};
 $('#first-run-name').value='';
 document.body.dataset.firstRun='true';
 bench(true);
 paint();
 announce();
 const target=focusTarget(state);
 target?.focus();
 requestAnimationFrame(()=>{if(active&&!document.querySelector('dialog[open]'))focusTarget(state)?.focus();});
}

/* Reconcilia a tela com o que o host diz depois de uma leitura (abertura,
   salvar das Configurações, restaurar backup, importar matéria): com matéria a
   tela sai; sem matéria entra a que vale. A entrada espontânea só acontece no
   boot ou na passagem de "tem matéria" para "nenhuma"; quem foi de propósito
   para a aba Livre não é puxado de volta a cada salvar. */
export async function syncFirstRun(data,nextHooks={}){
 /* Os ganchos valem mesmo quando o boot teve matéria e a tela só entra depois
    (apagar tudo nas Configurações): senão ela nasceria sem saber criar. */
 hooks={...hooks,...nextHooks};
 const wanted=entryOf(data);
 const had=seenCourses;
 /* Lembrar antes de sair: a leitura que a criação da primeira matéria provoca
    também conta como "tem matéria". */
 seenCourses=hasCourses(data);
 if(creating)return;
 if(!wanted){leave();return;}
 if(active){
  if(wanted!==kind)await enterFirstRun(data,nextHooks);
  return;
 }
 if(had===null||had===true)await enterFirstRun(data,nextHooks);
}
