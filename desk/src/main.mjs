import {bindPointerDrag} from './pointer-drag.mjs';
import {icon} from '../icons.mjs';
import {$,S,toast,toastFailure,conferirAppName,updateCheckButton,cancelConnect,connectionState,save,calcHeightPx,studySnapshot,pageRefs,layoutSnapshot,updateContextSummary,sessionTitleOf,applyStudy,applyTheme,applyAccent,ACCENTS,labelBtn,settings,connect,loadCourse,switchCourse,supportsCapability,relabelTutorColumn,relabelFreeCourseName} from './state.mjs';
import {conferir,conferirGeogebra,send,hideQuoteButton,doCompact} from './chat.mjs';
import {toggleReferencePanel,selectTab as selectSupportTab,supportState,setOpen as setSupportOpen} from './support.mjs';
import {initSidechat,openSavedSidechat} from './sidechat.mjs';
import {studyToolHandlers} from './study-tools.mjs';
import {initStudySearch,openStudySearch,closeStudySearch} from './study-search.mjs';
import {initPdfNotes,openPdfNotes} from './pdf-notes.mjs';
import {initStudyStats,openStudyStats} from './study-stats.mjs';
import {initBackupPanel} from './backup-panel.mjs';
import {openRef} from './nav.mjs';
import {initFreeStudy,openTutorPdfDialog} from './free-study.mjs';
import {initActivityHost} from './activity.mjs';
import {initConversationLibrary} from './conversation-library.mjs';
import {setResumeRecord} from './resume.mjs';
import {initTutorState,showTutorState} from './tutor-state.mjs';import {engineReady} from './engine-facts.mjs';
import {initConferir,closeConferirNote,paintConferirField,openConferirSettings} from './conferir.mjs';
import {initFreeModels,paintFreeSettings,confirmPaidModel} from './free-models.mjs';
import {initTriage,openTriage} from './triage.mjs';
import {initModelPicker,noteModelPicked} from './model-picker-ui.mjs';import {initEffortStrip} from './effort-strip.mjs';
import conferirCore from './generated/conferir.core.js';
import {syncFirstRun,isFirstRun} from './first-run.mjs';import {mountSetupMarkup} from './setup-markup.mjs';import {wireAccentPicker,mountAccentOptions} from './accent-picker.mjs';
import resumeCore from './generated/resume.core.js';

import {sendGgbRect,freezeGgbView,thawGgbView} from './ggb.mjs';
import {initCalculator,getCalculatorCollapsed,setCalculatorCollapsed,fitCalculator,relabelCalculator} from './calc.mjs';
import {pdfSplitValue,setPdfSplitPct} from './pdf.mjs';
import {decideEscape,collectEscapeFacts} from './escape-policy.mjs';
import {relabelGuide} from './guide.mjs';
import {initCommandPalette,openCommandPalette,closeCommandPalette} from './command-palette.mjs';
import {registerLayoutSurface,applyViewLayout,initLayoutPresetsUI,applyLayout,builtinPresets,summaryOf} from './layout-presets.mjs';
import {retranslateTree} from './view-host.mjs';
import {t,text,setUiLanguage,currentLanguage,LANGUAGE_EVENT} from './ui-text.mjs';
import {localizeFreeCourse} from './free-names.mjs';
import {initTutorHeader,closeTutorPops,syncTutorMenus} from './tutor-header.mjs';
import {initPhonePhoto,closePhonePop} from './phone-photo.mjs';
import {initSettings,prepareSettings,validateSettings,setSettingsFooter,saveBlockedNow,showSaveError} from './settings.mjs';
import {appendCourseRow,relabelCourseRows,clearEndDay,renderAboutLead,renderCourseRows,renderEndDay,renderHelpVersion} from './dialogs.mjs';
import {initToolNotices,noticesOpened} from './tool-notices.mjs';
import * as slash from './slash.mjs';
import * as mentions from './mentions.mjs';
import * as queue from './queue.mjs';
import {toggleDensity} from './density.mjs';
import {openEditor as openShortcuts} from './keys.mjs';
import {closeMenus,initNavMenus} from './nav-menus.mjs';
import {menuHandlers,renderTabsView,renderMenus,selectTab,moveTabFocus,numberedTabs,cycleToTab,getTabsCourses,setTabsCourses,refreshTabsOnReviewCount,initHeaderTabs} from './header-tabs.mjs';
import {aboutHandlers,openAbout,openHelp,paintUpdateNotice,refreshAbout,syncUpdateNotice} from './about-update.mjs';
import {closeContextPop,openContextPop,placeContextPop} from './context-pop.mjs';
import {newSession,openConversation,renderConversations} from './course-conversations.mjs';
/* Idioma (#41): o main entrega o idioma já resolvido (preload); o texto estático e o <html lang> seguem antes do primeiro desenho. */
/* A tela de passos (#64) entra antes, para ser traduzida junto. */
mountSetupMarkup();mountAccentOptions();
setUiLanguage(currentLanguage());
initNavMenus();
initHeaderTabs({openSettings:(...args)=>openSettings(...args),syncPaletteField:()=>syncPaletteField(),menu:{ToggleReference:toggleReference,OpenXournal:openXournal,OpenHelp:openHelp,OpenSettings:()=>openSettings(),OpenShortcuts:()=>openShortcuts(),OpenAbout:openAbout,OpenEndDay:openEndDay}});
function openXournal(){window.desk.openXournal().catch(e=>toast(e.message));}
/* O menu Estudar → Formulário delega à área de apoio (mesma semântica de antes:
   alterna o painel 2; se o Chat lateral está à frente, traz o Formulário). */
function toggleReference(){toggleReferencePanel();}
/* Encerrar por hoje saiu do composer e do menu Estudar: é item do Mais opções
   do tutor (o `hidden` pela flag `endDay` e o rótulo vêm do núcleo
   `tutorheader`) e comando da busca. O diálogo é o mesmo; o miolo é
   do `dialogsview` e o submit à prova de falha segue no `#end-day-form`. */
function openEndDay(){
 if(S.busy){toast(t('session.stopFirstEnd'));return;}
 $('#end-day-dialog').showModal();
}
/* Modo compacto: ⌘⇧D, a busca de comandos e o seletor das Configurações (a
   densidade em si é do `density.mjs`; o `selected` das Configurações acompanha
   pelo `sync` dele). */
function toggleDensityMode(){
 toggleDensity();
}
$('#send').onclick=()=>{queue.submit($('#prompt').value);};
/* ⏎ envia; ⇧⏎ quebra linha; ⌘/Ctrl+⏎ interrompe e envia (steer) com o Pi
   ocupado — livre, vale como ⏎. Ocupado, o ⏎ do composer vira fila: quem captura
   antes é o `queue.mjs` (com o menu `/` aberto, o slash consome na janela e passa
   na frente dos dois). Enviar à mão solta a fila segurada (`release`): o usuário
   voltou ao comando. */
$('#prompt').onkeydown=e=>{
 if(e.key!=='Enter'||e.isComposing)return;
 const steer=e.metaKey||e.ctrlKey;
 if(e.shiftKey&&!steer)return;
 e.preventDefault();
 const value=$('#prompt').value;
 if(steer){
  /* Motor sem steer: ⌘/Ctrl+⏎ com o turno aberto enfileira — a Mesa não promete
     interromper e reenviar onde o transporte não oferece. */
  if(S.busy&&!supportsCapability('steer')){queue.enqueueFromComposer();return;}
  if(value.trim()||S.attachments.length)queue.submit(value,{steer:true,release:false});
  return;
 }
 if(!S.busy)queue.submit(value);
};
$('#check').onclick=()=>conferir();$('#stop').onclick=()=>{window.dispatchEvent(new Event('desk-stop'));window.desk.abort().catch(e=>toast(e.message));};
$('#exercise-title').addEventListener('input',()=>{updateContextSummary();save();});
$('#pick-xopp').onclick=async()=>{try{const file=await window.desk.pickXopp();if(file)applyStudy({...studySnapshot(),xopp:file});save(true);}catch(e){toast(e.message);}};
/* O Encerrar por hoje mora no Mais opções do tutor (`OpenEndDay`), decidido pelo
   núcleo com a flag `endDay`. O miolo do `#end-day-dialog` vem do Bend
   (`core/dialogsview.bend`) — rótulos, textareas e ações; o `<form>` e o submit
   continuam aqui. */
renderEndDay();
/* Encerrar por hoje à prova de falha: o registro local é gravado PRIMEIRO — o
   diálogo só fecha se gravou (erro de IO mantém o texto na tela) — e só então o
   Pi é chamado. Sem conexão, sem provedor ou com o Pi recusando, o registro
   fica no disco e o "onde parei" aparece na coluna na próxima abertura. */
$('#end-day-form').addEventListener('submit',async e=>{
 if(e.submitter?.id!=='end-day-save')return;
 e.preventDefault();
 const stopped=$('#end-where').value.trim(),next=$('#end-next').value.trim();
 if(!stopped||!next)return;
 const study=studySnapshot();
 let saved;
 try{
  saved=await window.desk.endDaySave({record:{stopped,next,exercise:study.title,xopp:study.xopp,pages:pageRefs()}});
 }catch(err){
  toast(t('resume.saveFailed',{reason:err.message}));
  return;
 }
 $('#end-day-dialog').close();
 clearEndDay();
 setResumeRecord(saved,{fresh:true});
 if(!(await send(text(resumeCore.endDayDraft(stopped,next)),[])))toast(t('resume.sendFailed'));
});
window.desk.onMenuCheck(()=>conferir());
window.desk.onMenuGeogebra(()=>conferirGeogebra());
window.desk.onMenuStop(()=>{if(S.busy&&!$('#pi-dialog').open){window.dispatchEvent(new Event('desk-stop'));window.desk.abort().catch(e=>toast(e.message));}});
window.desk.onMenuChatToggle(()=>toggleChat());
$('#include-refs').onclick=()=>{S.includeRefs=!S.includeRefs;$('#include-refs').setAttribute('aria-pressed',String(S.includeRefs));updateContextSummary();};

window.addEventListener('resize',()=>placeContextPop());
$('#context-edit').onclick=()=>{
 const pop=$('#context-pop');
 if(pop&&!pop.hidden){closeContextPop({restoreFocus:true});return;}
 openContextPop();
};
document.addEventListener('click',event=>{
 const pop=$('#context-pop');if(!pop||pop.hidden)return;
 if(event.target?.closest?.('#context-pop, #context-edit'))return;
 closeContextPop();
});
/* Trocar de sessão ou recolher o tutor deixaria o popover órfão. */
window.addEventListener('desk-conversation-changed',()=>closeContextPop());
window.addEventListener('desk-conferir-note-open',()=>closeContextPop());
/* A calculadora é view do Bend (`core/calcview.bend` → `desk/src/calc.mjs`):
   colapso, ângulo, avaliação, histórico e guia saem de lá; a alça abaixo
   continua aqui (arrasto/medição são fatos de host). Ela só existe com o painel
   expandido (o CSS a esconde na linha recolhida): arrastar nunca precisa
   reabrir a calculadora. */
initCalculator();
bindPointerDrag($('#divider'),e=>{document.documentElement.style.setProperty('--chat',Math.max(310,Math.min(650,innerWidth-e.clientX))+'px');},()=>{save();thawGgbView();},freezeGgbView);
$('#divider').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){const w=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat'));document.documentElement.style.setProperty('--chat',Math.max(310,Math.min(650,w+(e.key==='ArrowLeft'?20:-20)))+'px');save();}};
bindPointerDrag($('#calc-divider'),e=>{const side=$('#sidebar').getBoundingClientRect();const height=Math.max(72,Math.min(side.height*0.7,side.bottom-e.clientY));document.documentElement.style.setProperty('--calc',Math.round(height)+'px');},save);
$('#calc-divider').onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){const h=calcHeightPx();document.documentElement.style.setProperty('--calc',Math.max(72,Math.min(700,h+(e.key==='ArrowUp'?20:-20)))+'px');save();}};
let chatCollapsed=false,lastChatToggle=0;
function setChatCollapsed(value){
 chatCollapsed=!!value;
 document.body.classList.toggle('chat-collapsed',chatCollapsed);
 $('#chat-restore').hidden=!chatCollapsed;
 /* Recolher esconde o #chat: menu ou lista abertos ficariam órfãos (e o Esc os
    consumiria sem se ver). */
 if(chatCollapsed){closeTutorPops();closeContextPop();closeConferirNote();closePhonePop();}
 syncTutorMenus();
 if(S.ggbActive)sendGgbRect();
}
function toggleChat(){const now=Date.now();if(now-lastChatToggle<150)return;lastChatToggle=now;setChatCollapsed(!chatCollapsed);}
function focusPdfFind(){(S.panels.find(p=>p.el.contains(document.activeElement))||S.panels[0])?.setFind(true);}
/* Fecha a busca do PDF da camada ativa: o formulário focado primeiro; senão o
   primeiro leitor com termo — o mesmo comportamento de antes, agora decidido
   pela política do Esc (`core/mesaqolescape.bend`). */
function closePdfSearchLayer(){
 const focusedFind=document.activeElement?.closest?.('.pdf-find');
 if(focusedFind&&!focusedFind.hidden){
  const panel=S.panels.find(p=>p.el===focusedFind.closest('.pdf-panel'));
  if(panel){panel.clearFind();panel.setFind(false);panel.el.focus();return true;}
 }
 if(S.panels.some(p=>p.findTerm)){const panel=S.panels.find(p=>p.findTerm);if(panel){panel.clearFind();panel.setFind(false);}return true;}
 return false;
}
$('#chat-restore').onclick=()=>setChatCollapsed(false);
/* Recolher é item do menu Mais opções do tutor (`#chat-collapse`), no mesmo
   caminho do atalho ⌘\; o botão de restaurar flutua com o chat recolhido. */
function typingTarget(el){return el?.closest?.('input,textarea,select')||['INPUT','TEXTAREA','SELECT'].includes(el?.tagName);}
// Os closers de document (bubble) mudam o DOM antes do handler de window.
// Congela a decisão em capture para o mesmo Esc nunca fechar e abortar.
const escapeDecisions=new WeakMap();
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!e.isComposing)escapeDecisions.set(e,decideEscape(collectEscapeFacts(document,S)));
},true);
window.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing)return;
 /* Guard de modal no topo do handler: com um diálogo aberto, nenhum atalho pode
    abrir outro (⌘, empilhava Configurações sobre a Ajuda). Esc passa: cada
    diálogo se fecha pelo cancelamento nativo/handler próprio. */
 const modal=document.querySelector('dialog[open]');
 if(modal&&e.key!=='Escape')return;
 if(e.key==='Escape'){
  /* A ordem das camadas é do núcleo (`core/mesaqolescape.bend`): a primeira
     aberta decide — modal (nativo) → paleta → menu → popover → citação →
     busca — e o turno SÓ é cancelado quando nenhuma está aberta. Fechar
     camada nunca para o tutor; o botão Parar e o menu continuam a via do
     usuário. */
  const action=escapeDecisions.get(e)??decideEscape(collectEscapeFacts(document,S));
  if(action==='modal')return;
  if(action==='palette'){e.preventDefault();closeCommandPalette();return;}
  if(action==='menu'){closeMenus({blur:true});return;}
  if(action==='popover'){
   e.preventDefault();
   closeContextPop({restoreFocus:true});closeConferirNote({restoreFocus:true});closeTutorPops({restoreFocus:true});closePhonePop({restoreFocus:true});
   return;
  }
  if(action==='citation'){e.preventDefault();hideQuoteButton();window.getSelection()?.removeAllRanges();return;}
  if(action==='search'){closePdfSearchLayer();return;}
  if(action==='tutor'){e.preventDefault();window.dispatchEvent(new Event('desk-stop'));window.desk.abort().catch(err=>toast(err.message));return;}
  /* Nada aberto e nenhuma resposta em curso: Esc cancela a chamada ao tutor
     que ainda está subindo (o mesmo efeito do Cancelar da coluna). */
  if(S.connecting){e.preventDefault();cancelConnect().catch(()=>{});return;}
  return;
 }
 if((e.metaKey||e.ctrlKey)&&e.key===','){e.preventDefault();openSettings();return;}
 if((e.metaKey||e.ctrlKey)&&e.key==='/'){e.preventDefault();openHelp();return;}
 if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();if(!S.busy)conferir();return;}
 if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='g'){e.preventDefault();conferirGeogebra();return;}
 if((e.metaKey||e.ctrlKey)&&!e.altKey){
  if(e.key==='Tab'){e.preventDefault();cycleToTab(e.shiftKey?-1:1);return;}
  if(e.key.toLowerCase()==='t'){e.preventDefault();openSettings();return;}
  if(e.shiftKey&&e.key.toLowerCase()==='i'){e.preventDefault();const panel=S.panels.find(p=>p.el.contains(document.activeElement))||S.panels[0];if(panel&&panel.doc)panel.toggleInvert();return;}
  if(e.shiftKey&&e.key.toLowerCase()==='d'){e.preventDefault();toggleDensityMode();return;}
  if(e.key.toLowerCase()==='f'){e.preventDefault();focusPdfFind();return;}
  if(e.key==='\\'){e.preventDefault();toggleChat();return;}
  if(/^[1-9]$/.test(e.key)){e.preventDefault();const tab=numberedTabs()[Number(e.key)-1];if(tab)selectTab(tab.dataset.id);return;}
 }
 if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.target?.closest?.('#course-tabs')){e.preventDefault();moveTabFocus(e.key==='ArrowRight'?1:-1);return;}
 if(typingTarget(e.target)||e.target===document.getElementById('divider')||e.target===document.getElementById('calc-divider')||e.target?.classList?.contains('pdf-divider'))return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const panel=document.activeElement?.closest?.('.pdf-panel')||S.panels[0]?.el;const inst=S.panels.find(p=>p.el===panel);if(!inst)return;e.preventDefault();inst.goto(inst.page+(e.key==='ArrowRight'?1:-1));}
});
initModelPicker({pick:async({provider,id,zenPaid})=>{
 /* Modelo pago do Zen (#44): a primeira escolha pede confirmação; voltar restaura o que estava em uso. */
 if(zenPaid&&!(await confirmPaidModel())){settings({});return;}
 await settings({model:{provider,id}});
 if(noteModelPicked(provider,id))save(true);/* recentes (#59): só entra o que o host confirmou */
},favoritesChanged:()=>save(true)/* favoritos (estrela): estado de interface, como os recentes */
});initEffortStrip({pick:level=>settings({level})});
const conversationLibrary=initConversationLibrary({resume:async row=>{
 if(S.busy||S.connecting||S.switching){toast(t('session.waitResume'));return false;}
 try{
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
  const data=await window.desk.libraryChatOpen(row.id);
  S.connected=false;$('#messages').replaceChildren();await loadCourse(data);
  await connect();return true;
 }catch(error){toastFailure(error);return false;}
}});
/* Exportar a sessão em Markdown (item de Mais opções do tutor). */
async function exportSession(){try{const r=await window.desk.exportChat();if(r?.saved)toast(t('session.exported',{file:String(r.file).split(/[/\\]/).at(-1)}));}catch(e){toast(e.message);}}
/* Ajustes do Pi: abre as Configurações no campo do caminho do Pi (o motivo da
   falha costuma estar ali). A coluna do tutor e o passo "Tutor" da primeira
   abertura (#64) usam o mesmo. */
const openPiSettings=async()=>{try{await openSettings({section:'pastas',focus:'#cfg-pi'});}catch(err){toast(err.message);}};
initTutorState({
 newSession:()=>newSession().catch(()=>{}),
 openLog:async()=>{try{await window.desk.openLog();}catch(err){toast(err.message);}},
 openPiSettings,
 /* Claude Code fora da faixa (#51): o Sobre, já na confirmação do comando que o atualiza. */
 updateClaude:()=>openAbout({ask:'claude'}).catch(err=>toast(err.message)),
 openAbout:()=>openAbout().catch(err=>toast(err.message))
});
initTutorHeader({
 newSession,exportSession,
 openEndDay:()=>openEndDay(),
 toggleTutor:()=>toggleChat(),
 renderConversations,
 openLibrary:()=>conversationLibrary.open().catch(error=>toast(error.message)),
 endDayEnabled:()=>(S.appConfig.desk||{}).endDay!==false,
 connect:()=>connect().catch(()=>{}),
 compactNow:()=>doCompact(''),
 reportProblem:()=>openTriage().catch(error=>toast(error.message))
});
initTriage();

async function openStudyResult(_destination,hit,{annotate=false}={}){
 if(S.busy||S.connecting||S.switching)throw Error(t('study.waitOpen'));
 clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
 const result=await window.desk.studySearchOpen({id:hit.id}),destination=result.destination;
 const changed=result.data.courseId!==S.currentCourseId||result.data.session!==S.currentSession;
 if(changed){S.connected=false;$('#messages').replaceChildren();await loadCourse(result.data);await connect();}
 closeStudySearch();
 if(destination.kind==='review'){selectTab('review');return true;}
 if(destination.kind==='sidechat'){selectSupportTab('chat');openSavedSidechat(result.sidechat);return true;}
 if(destination.kind==='note'){
  if(destination.unavailable)toast(t('study.noteMaterialGone'));
  else openRef(destination.name,destination.page,destination.path);
  openPdfNotes({path:destination.path,name:destination.name,page:destination.page});return true;
 }
 if(['pdf','material'].includes(destination.kind)){
  const opened=openRef(destination.name,destination.page||1,destination.path);
  if(annotate&&opened)openPdfNotes({path:destination.path,name:destination.name,page:destination.page||1});
  return opened;
 }
 return true;
}
initStudySearch({onOpenResult:openStudyResult,onAnnotate:async(_destination,hit)=>{try{await openStudyResult(null,hit,{annotate:true});}catch(error){toast(error.message);}}});
initPdfNotes();
const studyBackup=initBackupPanel(document,{
 status:()=>window.desk.backupStatus(),listar:()=>window.desk.backupList(),curso:()=>window.desk.backupActiveCourse(),
 obterConfig:async()=>(await window.desk.backupStatus()).settings,
 escolherPasta:()=>window.desk.backupPickFolder(),definirConfig:patch=>window.desk.backupConfig(patch),
 rodar:async payload=>{clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());return window.desk.backupRun(payload);},
 verificar:id=>window.desk.backupVerify(id),previaRestauracao:id=>window.desk.backupRestorePreview(id),
 aplicarRestauracao:async(id,options)=>{
  const result=await window.desk.backupRestoreApply(id,options);
  S.connected=false;connectionState('');$('#messages').replaceChildren();
  await loadCourse(result.data);
  await syncFirstRun(result.data);
  const ready=engineReady(result.data);
  if(!result.data.needsSetup&&!isFirstRun()&&ready)await connect().catch(()=>{}); // connect mostra a falha; a restauração já foi aplicada.
  return result;
 },
 cancelarRestauracao:id=>window.desk.backupRestoreCancel(id),escolherArquivo:()=>window.desk.sharePickFile(),
 exportar:(directory,options)=>window.desk.shareExportCourse({directory,...options}),
 importar:async(file,directory)=>{const result=await window.desk.shareImportCourse({file,directory});await loadCourse(result.data);await syncFirstRun(result.data);return result;},
 abrirPasta:directory=>window.desk.backupOpenFolder(directory),enviarGit:()=>window.desk.backupGitPush()
},{confirmar:text=>window.confirm(text)});
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&['f','n'].includes(event.key.toLowerCase())&&document.querySelector('dialog[open]'))event.preventDefault();},true);
Object.assign(menuHandlers,studyToolHandlers({search:()=>openStudySearch(),reviewToday:()=>{selectTab('review');document.querySelector('#review-today')?.scrollIntoView({block:'start'});},notes:()=>openPdfNotes(),stats:()=>{initStudyStats({state:S});openStudyStats();},backup:()=>studyBackup.abrirBackup(),share:()=>studyBackup.abrirCompartilhar(),tutorPdf:()=>openTutorPdfDialog()}));
/* Conferir tem duas redações no mesmo botão: a inteira e a curta. A caixa
   estreita (container query de `#composer-box`) troca uma pela outra; a oculta
   sai do nome acessível, então o leitor de tela ouve só a que está à vista. */
updateCheckButton();
initConferir();
initFreeModels();
/* Rótulos que a Mesa escreve com ícone: refeitos na troca de idioma (#41). */
function paintComposerLabels(){
 labelBtn($('#stop'),'square',t('composer.stop'));
 labelBtn($('#send'),'arrowUp',t('composer.send'));
 labelBtn($('#include-refs'),'columns',t('composer.refs'));
 labelBtn($('#attach'),'paperclip',t('composer.attach'));
 labelBtn($('#quote-btn'),'textQuote',t('quote.button'));
}
paintComposerLabels();
window.addEventListener(LANGUAGE_EVENT,paintComposerLabels);
initPhonePhoto(LANGUAGE_EVENT);
/* A lista de sessões é montada ao abrir o popover; os nomes ("Sessão de…") levam a data no idioma de quando foi montada. */
window.addEventListener(LANGUAGE_EVENT,()=>{if($('#conv-list')?.children.length)renderConversations().catch(()=>{});});
/* Caderno de revisão (pedido 5): acesso visível no cabeçalho com a contagem de
   itens — atualiza com a carga da matéria e quando a barra do caderno (núcleo)
   é redesenhada por salvar/remover. */
function updateReviewBadge(){refreshTabsOnReviewCount();}
const reviewBar=$('#review-bar');
if(reviewBar)new MutationObserver(updateReviewBadge).observe(reviewBar,{childList:true,subtree:true,characterData:true});
window.desk.onMenuHelp(openHelp);
window.desk.onMenuAbout(openAbout);
initToolNotices(aboutHandlers);
/* "Ver no Sobre" da linha nas Configurações (#52): o Sobre abre por cima, sem fechar nem descartar o que a pessoa editou. */
aboutHandlers.OpenAboutFromNotice=()=>openAbout().catch(err=>toast(err.message));
$('#update-notice').onclick=()=>openAbout();
window.desk.onUpdateAvailable?.(data=>syncUpdateNotice({status:'update',version:data?.version}));
const DESK_SETTINGS=['endDay','studyContext','calculator','xournal','conferir','refsToggle'];
/* Layout (pedido 9): o módulo é do outro agente (`src/layout-settings.mjs`).
   Import dinâmico: o resto das Configurações funciona mesmo antes do módulo
   existir, e nada do `desk` é sobrescrito sem o ler/editar dele. */
let layoutSettings=null;
const layoutSettingsReady=(async()=>{
 try{
  const module=await import('./layout-settings.mjs');
  module.mountLayoutSettings?.($('#cfg-layout'));
  layoutSettings=module;
  return module;
 }catch{
  const box=$('#cfg-layout');
  if(box)box.textContent=t('settings.layout.unavailable');
  return null;
 }
})();
async function fillSettingsForm(cfg){
 $('#cfg-title').value=cfg.desk?.title||'';
 for(const key of DESK_SETTINGS)$('#cfg-desk-'+key).checked=cfg.desk?.[key]!==false;
 $('#cfg-vault').value=cfg.vaultPath||'';
 $('#cfg-pi').value=cfg.piPath||'';
 $('#cfg-claude').value=cfg.claudePath||'';
 $('#cfg-xournal').value=cfg.xournalPath||'';
 $('#theme-mode').value=S.currentTheme;
 const language=await window.desk.languageGet();
 $('#ui-language').value=language.ui;
 $('#tutor-language').value=language.tutor;
 paintConferirField();
 paintFreeSettings().catch(()=>{});
 // campo do Xournal++ fica sempre à mostra: sem caminho no Windows é para configurar
 /* As linhas de matéria vêm do Bend (`core/dialogsview.bend`); o casco da
    seção (título, lead, "+") continua no `index.html`. */
 const layout=await layoutSettingsReady;
 if(layout?.fillLayoutSettings)layout.fillLayoutSettings(cfg.desk||{});
 renderCourseRows(cfg.courses);
}
function readSettingsForm(){
 const courses=[...$('#cfg-courses').querySelectorAll('.cfg-course')].map(row=>{
  const name=row.querySelector('.cfg-name').value.trim();
  const folder=row.querySelector('.cfg-path').value.trim();
  if(!folder)return null;
  const id=row.dataset.id||name||folder.split(/[/\\]/).filter(Boolean).at(-1);
  return {id,name:name||id,path:folder};
 }).filter(Boolean);
 let desk={...S.appConfig.desk,title:$('#cfg-title').value.trim()};
 /* O layout lê/edita o `desk` antes das flags: as flags não mexem em `panels` e
    o módulo nunca sobrescreve o que ele não edita. */
 if(layoutSettings?.readLayoutSettings)desk=layoutSettings.readLayoutSettings(desk)||desk;
 for(const key of DESK_SETTINGS)desk[key]=$('#cfg-desk-'+key).checked;
 return {vaultPath:$('#cfg-vault').value.trim(),runtimePath:S.appConfig.runtimePath||'',piPath:$('#cfg-pi').value.trim(),claudePath:$('#cfg-claude').value.trim(),xournalPath:$('#cfg-xournal').value.trim(),courses,desk};
}
/* `section`/`focus` levam o diálogo a um campo (o "Ajustes do Pi" do tutor abre
   em Pastas e programas com o campo do Pi focado); sem eles abre em Matérias. */
async function openSettings({section='',focus=''}={}){
 const info=await window.desk.getConfig();
 S.appConfig={...S.appConfig,...info.config,platform:info.platform};
 await fillSettingsForm(info.config||{});
 settingsBaseline=JSON.stringify(readSettingsForm());
 prepareSettings({section});
 setSettingsFooter({busy:!!S.busy,dirty:false});
 /* Dica do campo Claude: o caminho detectado quando o host manda um; senão o
    placeholder padrão continua. Nada de login/credencial na UI. */
 const claudeField=$('#cfg-claude');
 if(claudeField)claudeField.placeholder=info.detectedClaude||t('settings.detectAuto');
 if(!$('#settings-dialog').open){$('#settings-dialog').showModal();noticesOpened('settings');}
 if(focus){const field=$(focus);field?.scrollIntoView?.({block:'center'});field?.focus();}
}
$('#cfg-vault-browse').onclick=async()=>{const folder=await window.desk.pickFolder();if(folder)$('#cfg-vault').value=folder;};
$('#cfg-pi-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-pi').value=file;};
$('#cfg-pi-detect').onclick=async()=>{const found=await window.desk.detectPi();if(found){$('#cfg-pi').value=found;toast(t('settings.pi.found')); }else toast(t('settings.pi.missing'));};
$('#cfg-xournal-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-xournal').value=file;};
$('#cfg-claude-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-claude').value=file;};
$('#cfg-add-course').onclick=()=>appendCourseRow();
/* Cor de acento: vale na hora e fica lembrada, sem esperar o Salvar (nem some
   ao cancelar) — é estado de interface, como o tema na busca de comandos. */
wireAccentPicker($('#accent-mode'),{current:()=>S.currentAccent,choose:id=>{applyAccent(id);save(true);}});
/* Tema: vale na hora e fica lembrado, como o acento — Cancelar/Esc não o
   desfazem (é estado de interface, fora do `config.json`). */
$('#theme-mode')?.addEventListener('change',e=>{
 applyTheme(e.currentTarget.value);save(true);
});
/* Idioma da interface e do tutor (#41): valem na hora e ficam lembrados, como o
   tema — Cancelar/Esc não os desfazem (estado de interface, fora do
   `config.json`). O tutor lê o idioma ao conectar: com o tutor ocioso a Mesa o
   religa na hora; ocupado, a dica ao lado do campo segue valendo ("na próxima
   vez") e a Mesa religa quando a resposta acabar. */
let tutorLanguageWaiting=false;
function paintTutorLanguageNote(key){
 const note=$('#tutor-language-note');
 if(!note)return;
 note.dataset.i18n=key;note.textContent=t(key);
}
async function relinkTutorForLanguage(){
 if(S.connecting)await S.connecting.catch(()=>{});
 const outcome=await window.desk.languageRelink();
 tutorLanguageWaiting=!!outcome.busy;
 if(outcome.busy)return paintTutorLanguageNote('settings.tutorLanguage.note');
 if(!outcome.relinked)return;
 S.connected=false;
 paintTutorLanguageNote('settings.tutorLanguage.relinked');
 await connect().catch(()=>{});
}
async function chooseLanguage(request){
 const result=await window.desk.languageSet(request);
 setUiLanguage(result.ui);
 if(request.tutor!==undefined)await relinkTutorForLanguage();
}
window.addEventListener('desk-busy',e=>{
 if(!e.detail?.busy&&tutorLanguageWaiting)relinkTutorForLanguage().catch(err=>toast(err.message));
});
for(const [id,field] of [['#ui-language','ui'],['#tutor-language','tutor']]){
 $(id)?.addEventListener('change',e=>chooseLanguage({[field]:e.currentTarget.value}).catch(err=>toast(err.message)));
}
/* O que o `build` traduziu volta no idioma novo (`retranslateTree`); o que a Mesa
   escreve à mão (linha "Vai junto", medidor, rótulos de esforço, numeração
   impressa dos leitores) é refeito por quem o escreveu (#41). */
window.addEventListener(LANGUAGE_EVENT,()=>{
 retranslateTree(document);
 setTabsCourses(localizeFreeCourse(getTabsCourses()));relabelFreeCourseName();
 renderTabsView();renderMenus();updateReviewBadge();paintUpdateNotice();relabelCourseRows();
 relabelTutorColumn();relabelCalculator(); relabelGuide(); renderHelpVersion(S.deskVersion); renderAboutLead(S.deskVersion);
 for(const panel of S.panels)panel.paintPrinted();
});
initSettings();
$('#components-refresh').onclick=()=>refreshAbout(true);
$('#about-credits-toggle').onclick=()=>{
 const box=$('#about-credits'),open=box.hidden;
 box.hidden=!open;
 $('#about-credits-toggle').setAttribute('aria-expanded',String(open));
};
$('#about-log').onclick=()=>aboutHandlers.OpenLog();
window.desk.onMenuSettings(()=>openSettings());
/* A ação do aviso "app ausente" do Conferir e a busca de comandos abrem as
   Configurações no campo do programa de escrita (#38). */
window.addEventListener('desk-open-settings',e=>{openSettings(e.detail||{}).catch(err=>toast(err.message));});
/* Depois de salvar a configuração (Configurações ou primeira abertura): a Mesa
   adota a lista de matérias nova, recarrega e deixa o tutor desligado. Devolve
   se há motor para conectar — sem Pi configurado a Mesa não tenta conectar
   sozinha; a conversa Claude segue a mesma regra com o executável detectado (o
   host manda o caminho ou `''` — sem binário, nada de tentativa nem de toast no
   save/boot). */
async function adoptSavedConfig(data){
 S.connected=false;
 setTabsCourses(localizeFreeCourse(data.courses));
 await loadCourse(data);
 connectionState('');
 renderTabsView();renderMenus();
 /* Sem matéria (apagou todas) a folha volta; com matéria ela sai. */
 await syncFirstRun(data);
 return engineReady(data);
}
/* Primeira abertura (ticket #21): nome + pasta dos PDFs viram a primeira
   matéria. A pasta de dados confirmada é criada e gravada na configuração local
   (`vaultPath`, o "Pasta do vault / dados" das Configurações) pelo mesmo
   `save-config` das Configurações; depois a Mesa vai para a matéria nova. */
async function createFirstCourse({id,name,folder,dataFolder}){
 if(dataFolder)await window.desk.firstRunPrepare(dataFolder);
 const info=await window.desk.getConfig();
 const config={...info.config,courses:[...(info.config?.courses||[]),{id,name,path:folder}]};
 if(dataFolder)config.vaultPath=dataFolder;
 const data=await window.desk.saveConfig(config);
 const ready=await adoptSavedConfig(data);
 await switchCourse(id,{connect:ready});
 renderTabsView();
}
let settingsSaving=false;
/* Mudança pendente (#42): o formulário lido ao abrir é a base; Salvar sem
   mudança só fecha, e com o tutor respondendo e mudança pendente o Salvar
   espera o fim da resposta (o rodapé diz isso — `settings.mjs`). */
let settingsBaseline='';
function settingsDirty(){
 if(!$('#settings-dialog')?.open||!settingsBaseline)return false;
 try{return JSON.stringify(readSettingsForm())!==settingsBaseline;}catch{return true;}
}
function syncSettingsFooter(){
 if(!$('#settings-dialog')?.open)return;
 setSettingsFooter({busy:!!S.busy,dirty:settingsDirty()});
}
async function saveSettings(){
 if(settingsSaving)return;
 settingsSaving=true;
 try{
  showSaveError('');
  /* Erro de matéria impede o Salvar: o aviso fica ao lado do campo e o
     diálogo vai para a seção dele (o núcleo decide; ver `settings.mjs`). */
  if(!validateSettings())return;
  if(!settingsDirty()){$('#settings-dialog').close('ok');return;}
  syncSettingsFooter();
  if(saveBlockedNow())return;
  const data=await window.desk.saveConfig(readSettingsForm());
  $('#settings-dialog').close('ok');
  const ready=await adoptSavedConfig(data);
  if(!data.needsSetup&&!isFirstRun()&&ready)connect().catch(()=>{});
 }catch(err){
  /* Recusa do main (ex.: a resposta começou entre o clique e o pedido): o
     aviso fica dentro do diálogo, ao lado do Salvar; o diálogo segue aberto. */
  if($('#settings-dialog').open)showSaveError(err?.message||String(err));else toast(err?.message||String(err));
 }
 finally{settingsSaving=false;}
}
$('#settings-form').addEventListener('input',()=>{showSaveError('');syncSettingsFooter();});
$('#settings-form').addEventListener('change',syncSettingsFooter);
$('#settings-form').addEventListener('click',()=>queueMicrotask(syncSettingsFooter));
window.addEventListener('desk-busy',syncSettingsFooter);
/* Enter num campo salva: o `<form method="dialog">` herdado ativava o "×"
   (primeiro submit do form, `value=cancel`) e a edição era descartada. O submit
   é sempre interceptado e só o botão Salvar salva; os botões de cancelar
   fecham explicitamente. Esc segue cancelando pelo comportamento nativo. */
$('#settings-form').addEventListener('keydown',e=>{
 if(e.key!=='Enter')return;
 const field=e.target;
 if(!field?.matches?.('input,select'))return;
 e.preventDefault();
 saveSettings();
});
$('#settings-form').addEventListener('submit',e=>{
 e.preventDefault();
 if(e.submitter?.id==='settings-save'||e.submitter?.value==='ok'){saveSettings();return;}
 $('#settings-dialog').close('cancel');
});
$('#prompt').addEventListener('input',save);
slash.init();
mentions.init();
/* O tutor pediu o GeoGebra com a aba fechada (#53): abre como se o aluno clicasse; o host espera o applet. */
window.desk.onGgbOpen?.(()=>selectTab('geogebra'));
/* Chat lateral: eventos do lateral assinados uma vez (a área de apoio não tem
   barra de abas; ver `support.mjs`). */
initSidechat();
/* Aba Livre (sessão avulsa): módulo próprio que escuta `desk-workspace`/
   `desk-chrome`; montado antes do `window.desk.init()` do rodapé para pegar o
   primeiro estado sem perder evento. */
initFreeStudy();
/* Folha "Lista 0" do leitor vazio (pdf.mjs): "Pedir ao tutor" abre o pedido de
   PDF com a lista de exercícios da matéria já escrita. */
window.addEventListener('desk-reader-sheet',event=>{
 if(event.detail?.action==='tutor')openTutorPdfDialog(event.detail.seed);
});
initActivityHost({composer:()=>$('#prompt'),getScope:()=>({courseId:S.currentCourseId,conversationId:S.currentSession})});
/* Fila de mensagens + steer da Mesa (feature que veio da Conversa, aposentada na #50, sobre o núcleo
   `core/composerview.bend`): ⏎ ocupado enfileira, ⌘/Ctrl+⏎ interrompe e envia. */
queue.init();
/* O `loadCourse` avisa quando o `desk` normalizado entra: abas e menus são
   aplicados antes do carregamento dos PDFs — o chrome inteiro fica pronto no
   mesmo tick (abas parciais deixariam o #course-tabs vazio no meio do boot). */
window.addEventListener('desk-workspace',event=>{
 if(event.detail?.courseId&&event.detail.courseId!==S.currentCourseId)return;
 if(event.detail?.session&&event.detail.session!==S.currentSession)return;
 if(Array.isArray(event.detail?.courses))setTabsCourses(localizeFreeCourse(event.detail.courses));
 renderTabsView();renderMenus();updateReviewBadge();
});
window.addEventListener('desk-chrome',()=>{renderTabsView();renderMenus();updateReviewBadge();});
/* ---------------------------------------------------------------------------
   Qualidade de vida: paleta de ações (⌘K) e layouts pessoais.

   A superfície de layout é registrada ANTES do boot: o `layoutSnapshot()` do
   `state.mjs` (root) pode capturar o `viewLayout` já na primeira gravação, e o
   `applyViewLayout` do evento `desk-layout-ready` reaplica chat recolhido/
   calculadora recolhida/minimizados depois de os leitores e o apoio
   recomorem (troca de matéria/sessão ou boot).
   --------------------------------------------------------------------------- */
let layoutPresetsUi=null;
const layoutSurface={
 save:()=>save(true),
 panelCount:()=>S.panels.length,
 calculatorEnabled:()=>S.appConfig.desk?.calculator!==false,
 referenceFacts:()=>({two:!!supportState.two,tabIsForm:supportState.tab==='form',open:!!supportState.open}),
 readChatWidth:()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat'))||390,
 readCalcHeight:()=>calcHeightPx(),
 readPdfSplit:()=>pdfSplitValue(),
 readChatCollapsed:()=>chatCollapsed,
 readCalculatorCollapsed:()=>getCalculatorCollapsed(),
 readReferenceVisible:()=>supportState.tab==='form'&&supportState.open,
 readMinimized:()=>S.panels.map(p=>!!p.minimized),
 setChatWidth:px=>document.documentElement.style.setProperty('--chat',Math.round(px)+'px'),
 setCalcHeight:px=>document.documentElement.style.setProperty('--calc',Math.round(px)+'px'),
 setPdfSplit:value=>setPdfSplitPct(value),
 setChatCollapsed:value=>setChatCollapsed(value===true),
 setCalculatorCollapsed:value=>setCalculatorCollapsed(value===true),
 showReference:()=>selectSupportTab('form'),
 hideReference:()=>setSupportOpen(false),
 setMinimized:(index,value)=>S.panels[index]?.toggleMinimized(value===true),
};
registerLayoutSurface(layoutSurface);
layoutPresetsUi=initLayoutPresetsUI({});
/* O root dispara depois de leitores/apoio carregados; sem `layout` é no-op. */
window.addEventListener('desk-layout-ready',event=>{
 const layout=event?.detail?.layout;
 if(layout)applyViewLayout(layout);
 fitCalculator();
});
/* Combo exibido na paleta: o remap/plataforma do keys.mjs manda quando existe. */
function paletteKey(id,fallback=''){
 try{const keys=window.mesaKeys;if(keys){const combo=keys.format(keys.effective(id));if(combo)return combo;}}catch{}
 return fallback;
}
/* Ações da paleta — TODAS reutilizam os handlers existentes; a lista resolve
   disponibilidade (matéria/conversa) e o disable (busy, flags, captura). */
function paletteAvailableActions(){
 const busy=!!(S.busy||S.connecting||S.switching);
 const desk=S.appConfig.desk||{};
 const panelNow=()=>S.panels.find(p=>p.el.contains(document.activeElement))||S.panels[0]||null;
 const actions=[];
 const openFile=panelNow();
 const waitReply=t('palette.reason.busy');
 const conferirReason=busy?waitReply:desk.conferir===false?t('palette.reason.conferirOff'):t('palette.reason.noCapture');
 const command=(id,label,icon,extra={})=>actions.push({id,label,icon,section:'commands',...extra});
 command('pdf-open',t('palette.openPdf'),'plus',{disabled:!openFile,reason:t('palette.reason.noReader'),run:async()=>{const panel=panelNow();if(panel)await panel.openFile();}});
 command('conferir',text(conferirCore.buttonLabel(conferirAppName())),'scan',{kbd:paletteKey('check','⌘⇧C'),disabled:busy||desk.conferir===false||!S.captureOk,reason:conferirReason,run:()=>conferir()});
 command('conferir-pick',text(conferirCore.pickLabel()),'scan',{search:t('palette.search.conferirPick'),disabled:busy||desk.conferir===false||!S.captureOk,reason:conferirReason,run:()=>openConferirSettings()});
 command('study-search',t('study.search')+'…','search',{run:()=>openStudySearch()});
 command('review-today',t('study.reviewToday'),'book',{run:()=>{selectTab('review');document.querySelector('#review-today')?.scrollIntoView({block:'start'});}});
 command('notes',t('study.notes'),'textQuote',{run:()=>openPdfNotes()});
 /* Tudo que saiu da tela principal (menus Estudar e Ajustes, Caderno,
    GeoGebra, tema e densidade) se acha aqui pelo nome. Itens desligados no
    `config.json` ficam de fora, como nos menus. */
 command('study-stats',t('study.stats'),'graph',{run:()=>{initStudyStats({state:S});openStudyStats();}});
 command('study-backup',t('study.backup'),'download',{run:()=>studyBackup.abrirBackup()});
 command('study-share',t('study.share'),'upload',{run:()=>studyBackup.abrirCompartilhar()});
 command('tutor-pdf',t('study.tutorPdf'),'sparkles',{run:()=>openTutorPdfDialog()});
 const xournalOff=desk.xournal===false||(S.appConfig.platform==='win32'&&!S.appConfig.xournalPath);
 if(!xournalOff)command('xournal',t('palette.openXournal'),'external',{run:()=>openXournal()});
 if(desk.endDay!==false)command('end-day',t('palette.endDay'),'moon',{disabled:!!S.busy,reason:t('palette.reason.stopFirst'),run:()=>openEndDay()});
 const panelsCfg=Array.isArray(desk.panels)?desk.panels:[];
 if(panelsCfg.length>1){
  /* O nome do botão do painel de apoio é dado da pessoa (`config.json`), não frase da Mesa. */
  const toggleName=String(panelsCfg[1]?.toggle||'')||t('tabs.referenceToggle');
  command('reference-toggle',t(S.refVisible?'palette.refToggle.hide':'palette.refToggle.show',{name:toggleName}),'columns',{search:t('palette.refToggle.search',{name:toggleName}),run:()=>toggleReference()});
 }
 command('review-open',t('palette.reviewNotebook'),'book',{run:()=>selectTab('review')});
 command('geogebra-open','GeoGebra','graph',{disabled:busy,reason:waitReply,run:()=>selectTab('geogebra')});
 command('help',t('menu.help'),'help',{run:()=>openHelp()});
 command('shortcuts',t('menu.shortcuts'),'keyboard',{run:()=>openShortcuts()});
 command('about',t('menu.about'),'help',{run:()=>openAbout()});
 for(const theme of ['light','dark','auto']){
  const label=t(`palette.theme.${theme}`);
  command(`theme-${theme}`,label,theme==='light'?'sun':theme==='dark'?'moon':'contrast',{search:t('palette.theme.search',{label}),check:S.currentTheme===theme,run:()=>{applyTheme(theme);save(true);toast(`${label}.`);}});
 }
 for(const [accent] of ACCENTS){
  const label=t('palette.accent',{name:t(`settings.accent.${accent}`)});
  command(`accent-${accent}`,label,'contrast',{search:t('palette.accent.search',{label}),check:S.currentAccent===accent,run:()=>{applyAccent(accent);save(true);toast(`${label}.`);}});
 }
 command('density',t('palette.density'),'unfold',{kbd:paletteKey('density','⌘⇧D'),search:t('palette.density.search'),run:()=>toggleDensityMode()});
 command('settings',t('menu.settings'),'settings',{kbd:paletteKey('settings','⌘,'),run:()=>openSettings()});
 command('new-session',t('header.newSession'),'plus',{search:t('palette.newSession.search'),disabled:busy,reason:waitReply,run:()=>newSession('pi')});
 command('new-session-claude',t('palette.newSessionClaude'),'plus',{search:t('palette.newSessionClaude.search'),disabled:busy,reason:waitReply,run:()=>newSession('claude')});command('new-session-opencode',t('palette.newSessionOpenCode'),'plus',{search:t('palette.newSessionOpenCode.search'),disabled:busy,reason:waitReply,run:()=>newSession('opencode')});
 command('export-chat',t('palette.exportSession'),'download',{search:t('palette.exportSession.search'),run:()=>exportSession()});
 command('session-library',t('palette.sessionLibrary'),'search',{search:t('palette.sessionLibrary.search'),run:()=>conversationLibrary.open().catch(error=>toast(error.message))});
 command('chat-toggle',t(chatCollapsed?'palette.tutor.show':'palette.tutor.hide'),'columns',{kbd:paletteKey('chat-toggle','⌘\\'),run:()=>toggleChat()});
 actions.push({id:'layout-save',label:t('palette.layoutSave'),icon:'download',section:'layouts',disabled:!layoutPresetsUi,reason:t('palette.reason.noLayout'),run:()=>layoutPresetsUi?.open()});
 const presets=[...builtinPresets(),...(layoutPresetsUi?.list().presets||[])];
 for(const preset of presets){
  const summary=summaryOf(preset.layout);
  actions.push({id:`layout-${preset.id}`,label:t('palette.layout',{name:preset.name}),icon:'columns',section:'layouts',search:`layout ${preset.name} ${summary}`,when:summary,run:()=>applyLayout(preset.layout)});
 }
 for(const course of getTabsCourses()){
  if(!course?.id||course.id===S.currentCourseId)continue;
  actions.push({id:`course-${course.id}`,label:t('palette.course',{name:course.name||course.id}),icon:'chevronRight',section:'courses',search:String(course.name||course.id),disabled:busy,reason:waitReply,run:()=>selectTab(course.id)});
 }
 for(const session of S.sessions){
  if(!session.path||session.path===S.currentSession)continue;
  const title=sessionTitleOf(session);
  actions.push({id:`session-${session.path}`,label:t('palette.session',{title}),icon:'chevronRight',section:'sessions',search:`${title} ${session.preview||''}`,disabled:busy,reason:waitReply,run:()=>openConversation(session.path)});
 }
 return actions;
}
const paletteApi=initCommandPalette({
 actions:paletteAvailableActions,
 canOpen:()=>!document.querySelector('dialog[open]'),
 onError:error=>{if(error?.message)toast(error.message);},
});
window.mesaPalette=paletteApi;
/* Campo da barra superior: abre a mesma paleta (⌘K). O combo exibido segue o
   remap do keys.mjs. */
function syncPaletteField(){
 const field=$('#palette-field');
 if(!field)return;
 if(!field.querySelector('.icon'))field.insertAdjacentHTML('afterbegin',icon('search'));
 const kbd=$('#palette-field-kbd');
 if(kbd)kbd.textContent=paletteKey('command-palette','⌘K');
 const trigger=$('#settings-trigger');
 if(trigger&&!trigger.querySelector('.icon'))trigger.innerHTML=icon('settings');
}
{
 const field=$('#palette-field');
 if(field)field.addEventListener('click',e=>{
  e.stopPropagation();
  closeMenus({animate:false});
  if(!document.querySelector('dialog[open]'))openCommandPalette();
 });
}
syncPaletteField();
/* Menu nativo (root liga `preload.onMenuPalette`) — vale com o WebContentsView
   do GeoGebra focado, quando o keydown do renderer não chega. */
window.desk.onMenuPalette?.(()=>{if(!document.querySelector('dialog[open]'))openCommandPalette();});
try{
 const data=await window.desk.init();
 await layoutPresetsUi.refresh();
 setTabsCourses(localizeFreeCourse(data.courses));
 await loadCourse(data);
 renderTabsView();renderMenus();updateReviewBadge();
 /* Sem configuração, ou com a pasta de dados válida e nenhuma matéria, a
    pessoa cai direto no app (folha "Lista 0 — Montar a mesa"); o tutor só liga
    quando ela chama (tickets #21 e #24). */
 await syncFirstRun(data,{createCourse:createFirstCourse,openPiSettings});
 if(!isFirstRun()&&engineReady(data))connect().catch(()=>{});
 showTutorState();
}catch(e){toast(e.message);showTutorState();}
