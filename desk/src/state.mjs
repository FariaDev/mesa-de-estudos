import {icon} from '../icons.mjs';
import {showHistory,resetAttachments} from './chat.mjs';
import {PdfPanel,makePdfDivider,setPdfSplitPct,pdfSplitValue} from './pdf.mjs';
import {deactivateGeogebra} from './ggb.mjs';
import {initCalculator} from './calc.mjs';
import toastCore from './generated/toastview.core.js';
import statusCore from './generated/statusview.core.js';
import deskFlagsCore from './generated/deskflags.core.js';
import welcomeCore from './generated/welcomeview.core.js';
import {build,childrenOf,preserveFocus,renderChildren,renderInto} from './view-host.mjs';
import {footValues} from './status-foot.mjs';
import {applyHelpFlags} from './dialogs.mjs';

export function $(s){return document.querySelector(s);}
export const S={supportsImages:true,switching:false,modelCatalog:[],library:[],panels:[],pdfDivider:null,connected:false,connecting:null,busy:false,busySince:0,busyStall:0,healthFails:0,refVisible:true,saveTimer:0,currentSession:'',captureOk:false,includeRefs:true,appConfig:{},quizQueue:[],dialogPending:false,activeCourseName:'',currentTheme:'auto',ggbActive:false,currentCourseId:'',autoCompact:false,attachments:[],attachGen:0,deskVersion:''};
/* Fila de toasts e faixa de atividade desenhadas pelo núcleo provado
   (`core/toastview.bend` → `toastview.core.js`). O host mantém os elementos
   vivos e os timers: a saída é uma transição no nó que já está no DOM, e
   recriá-lo cortaria a animação e o `transitionend`. */
const toastQueue=[];

/* Attrs que o núcleo decidiu aplicados num elemento vivo (na saída só as
   classes mudam, no mesmo nó). O que o nó novo não traz sai do elemento — por
   padrão `class` e `hidden`, o que permite aplicar `#ctx-tip` sem recriá-lo.
   Controles com estado de host (`#status-dot`, `#session-select`) passam uma
   lista maior: sem ela, um `data-tip`/`disabled` velho sobreviveria ao estado
   novo. */
function applyAttrs(el,node,drop=['class','hidden']){
 const built=build(node);
 for(const attr of built.attributes)el.setAttribute(attr.name,attr.value);
 for(const name of drop)if(!built.hasAttribute(name))el.removeAttribute(name);
 return built;
}
/* Aplica os atributos de um nó de controle vivo: os filhos são do index.html
   (texto, ícone injetado e handlers), então só os attrs entram. */
function applyAttrsOn(selector,node){
 const el=$(selector);
 if(el)applyAttrs(el,node);
}
/* Aplica a árvore da faixa no contêiner fixo do index.html: attrs + filhos.
   Não troca o elemento — o mount tem id/role do HTML e o host guarda estado
   nele (o `_tipText` do medidor, o foco). */
function applyView(mount,node){
 applyAttrs(mount,node);
 preserveFocus(mount,()=>renderChildren(mount,childrenOf(node.kids)));
}
function toastNode(item){return toastCore.toastItem({$:'Toast',text:item.text,closing:item.closing});}
export function toast(text){
 if(!text||text==='stopped')return;
 const box=$('#toast');if(!box)return;
 const item={text:String(text),closing:false};
 if(toastQueue.length>=3){const old=toastQueue.shift();clearTimeout(old.timer);old.el.remove();}
 toastQueue.push(item);
 const el=item.el=build(toastNode(item));
 box.append(el);
 const remove=()=>{clearTimeout(item.timer);el.remove();const at=toastQueue.indexOf(item);if(at>=0)toastQueue.splice(at,1);};
 el.addEventListener('transitionend',remove,{once:true});
 item.timer=setTimeout(()=>{
  item.closing=true;
  applyAttrs(el,toastNode(item));
  item.timer=setTimeout(remove,600);
 },3200);
}
/* O ponto de conexão é árvore do núcleo (`core/statusview.bend` → `statusDot`):
   classe, `data-tip` e `aria-label` vêm dos fatos. O elemento do index.html
   continua o mesmo (o tooltip delega por identidade) e o `title` que o
   tooltip.mjs devolve ao sair do hover não sobrevive à troca de estado. */
function connStateOf(state){
 if(state==='connecting')return{$:'ConnConnecting'};
 if(state==='online')return{$:'ConnOnline'};
 if(state==='error')return{$:'ConnError'};
 return{$:'ConnOff'};
}
export function connectionState(state,label){
 const dot=$('#status-dot');if(!dot)return;
 applyAttrs(dot,statusCore.statusDot(connStateOf(state),String(label||'')),['class','hidden','data-tip','title']);
}
export function activity(text){const box=$('#activity');if(box)applyView(box,toastCore.activityView(String(text||'')));}
/* Passo ao vivo no lugar da linha simples: ponto pulsante + rótulo curto. */
export function activityLive(text){const box=$('#activity');if(box)applyView(box,toastCore.activityLiveView(String(text||'')));}
/* Rolagem: seguir só quando o usuário já está no fim (medido antes da mutação). */
export function atBottom(threshold=80){
 const el=$('#messages');
 if(!el)return true;
 return el.scrollHeight-el.scrollTop-el.clientHeight<=threshold;
}
export function followBottom(stick){
 if(!stick)return;
 const el=$('#messages');
 if(el)el.scrollTop=el.scrollHeight;
}
function pdfSnapshot(){return S.panels.map(p=>({path:p.path,page:p.page,zoom:p.zoom,scrollX:p.scrollX||0,scrollY:p.scrollY||0,invert:!!p.invert,minimized:!!p.minimized}));}
export function calcHeightPx(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))||220;}
export function studySnapshot(){return {title:$('#exercise-title').value.trim(),xopp:$('#pick-xopp').dataset.path||''};}
export function layoutSnapshot(){return {draft:$('#prompt').value,study:studySnapshot(),pdfs:pdfSnapshot(),pdfSplit:pdfSplitValue(),referenceVisible:S.refVisible,chatWidth:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat')),calcHeight:calcHeightPx(),theme:S.currentTheme};}
export function save(immediate=false){clearTimeout(S.saveTimer);if(immediate){window.desk.save(layoutSnapshot()).catch(e=>toast(e.message));return;}S.saveTimer=setTimeout(()=>window.desk.save(layoutSnapshot()).catch(e=>toast(e.message)),400);}
export function refs(){return S.includeRefs?S.panels.filter((p,i)=>p.path&&(i===0||S.refVisible)).map(p=>({path:p.path,page:p.page})):[];}
export function updateContextSummary(){
 const parts=[];if(S.activeCourseName)parts.push(S.activeCourseName);const study=studySnapshot();if(study.title)parts.push(study.title);if(study.xopp)parts.push(study.xopp.split(/[/\\]/).at(-1));
 const open=refs();if(open.length)parts.push(open.map(r=>`${r.path.split(/[/\\]/).at(-1)} p.${r.page}`).join(', '));
 $('#context-summary').textContent='Contexto enviado: '+(parts.length?parts.join(' · '):'nenhum');
 $('#context-summary').title=$('#context-summary').textContent;
}
export function updateWindowTitle(){document.title=[S.appConfig.desk?.title||'Mesa de Estudos',S.activeCourseName,S.panels[0]?.doc?`p. ${S.panels[0].page}`:''].filter(Boolean).join(' — ');}
function compactCount(value){
 const n=Math.max(0,Number(value)||0);
 if(n<10000)return n.toLocaleString('pt-BR');
 if(n<1000000)return `${(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil`;
 return `${(n/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mi`;
}
/* O medidor é nó vivo do index.html (a barra anima por transição de largura);
   as decisões — `hidden`, cortes warn/hot, `%` e largura — vêm do
   `statusview.ctxMeter`/`meterText`/`meterWidth`, mas o nó do medidor não é
   recriado: `hidden`/`class` entram no `#ctx-meter` e a largura/texto nos
   `i`/`em` que já estão lá (recriá-los cortaria a animação). A porcentagem
   chega ao núcleo já arredondada (contrato do statusview), então o corte
   acompanha o mostrador. O texto do balão (tokens formatados) é fato do host
   e vai pelo `#ctx-tip` da onda 4. */
function updateMeter(usage){
 const meter=$('#ctx-meter');if(!meter)return;
 const visible=!!usage&&Number.isFinite(usage.percent);
 const pct=visible?Math.round(Math.min(100,Math.max(0,Number(usage.percent)))):0;
 const nat=BigInt(pct);
 applyAttrs(meter,statusCore.ctxMeter(visible,nat));
 if(!visible){footValues({context:'',tip:''});return;}
 const bar=meter.querySelector('i');if(bar)bar.setAttribute('style',statusCore.meterWidth(nat));
 const em=meter.querySelector('em');if(em)em.textContent=statusCore.meterText(nat);
 const text=`Contexto do modelo: ${pct}% · ${compactCount(usage.tokens)} de ${compactCount(usage.contextWindow)} tokens usados · /compact compacta`;
 meter.title=text;
 setMeterTip(text);
 footValues({context:statusCore.meterText(nat),tip:text});
}
/* O balão do medidor é árvore do núcleo (`core/statusview.bend` → `ctxTip`):
   texto e `hidden` são fatos; medir, posicionar e os eventos de hover/foco (e o
   clique no rodapé) ficam aqui. O `#ctx-tip` é nó vivo do index.html: o host
   guarda o texto corrente em `_tipText` para o toggle do rodapé. */
function paintMeterTip(hidden){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 applyView(tip,statusCore.ctxTip(meter._tipText||'',!!hidden));
}
function placeMeterTip(){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 const r=meter.getBoundingClientRect();
 tip.style.left=Math.round(Math.max(8,Math.min(r.left,innerWidth-tip.offsetWidth-8)))+'px';
 tip.style.top=Math.round(r.bottom+6)+'px';
}
function setMeterTip(text){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 meter._tipText=String(text||'');
 if(tip.textContent===meter._tipText)return;
 paintMeterTip(tip.hidden);
 placeMeterTip();
}
function wireMeterTip(){
 const meter=$('#ctx-meter');if(!meter)return;
 const hide=()=>{paintMeterTip(true);};
 const show=()=>{const tip=$('#ctx-tip');if(!tip||!meter._tipText)return;paintMeterTip(false);setMeterTip(meter._tipText);};
 meter.addEventListener('mouseenter',show);
 meter.addEventListener('mouseleave',hide);
 meter.addEventListener('focusin',show);
 meter.addEventListener('focusout',hide);
}
wireMeterTip();
/* Com o balão aberto, um resize pode deixá-lo fora da janela: reposiciona com a
   mesma lógica do `setMeterTip` (mede o medidor e trava nas bordas). */
window.addEventListener('resize',()=>{const tip=$('#ctx-tip');if(tip&&!tip.hidden)placeMeterTip();});
export function toggleMeterTip(){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip||meter.hidden)return;
 if(!tip.hidden){paintMeterTip(true);return;}
 const text=meter._tipText||'';
 if(!text)return;
 paintMeterTip(false);setMeterTip(text);
}
export async function refreshMeter(){try{const data=await window.desk.health();if(data?.contextUsage)updateMeter(data.contextUsage);}catch{}}
/* O botão é árvore do núcleo (`statusview.autoCompact`): `hidden` sem conexão,
   `aria-pressed` + `.on` e o tooltip em `data-tip`. O elemento do index.html
   fica (o texto e o `onclick` são dele); o `title` estático vira o `data-tip`
   do núcleo e **sai do nó** (drop) — o `tooltip.mjs` prefere `title` e o
   `data-tip` ficaria inerte até o primeiro arm/reset. */
const AUTO_COMPACT_TIP=$('#auto-compact')?.getAttribute('title')||'';
function renderAutoCompact(piState){
 const button=$('#auto-compact');if(!button)return;
 S.autoCompact=!!piState?.autoCompactionEnabled;
 applyAttrs(button,statusCore.autoCompact(!!S.connected,S.autoCompact,AUTO_COMPACT_TIP),['class','hidden','title']);
}
$('#auto-compact').onclick=async()=>{
 const button=$('#auto-compact');
 try{
  const r=await window.desk.autoCompaction(button.getAttribute('aria-pressed')!=='true');
  renderAutoCompact({autoCompactionEnabled:r?.autoCompactionEnabled});
  updateMeter(r?.contextUsage);
  toast(`Compactação automática ${r?.autoCompactionEnabled?'ativada':'desativada'}.`);
 }catch(e){toast(e.message);}
};
/* As opções do seletor de conversa são árvore do núcleo
   (`statusview.sessionSelect`): o rótulo visível e o `selected` da conversa
   corrente saem daqui. O `disabled` é fato do turno (`setBusy`) e o render
   preserva o estado vivo — quem o escreve continua sendo o host. O elemento
   do index.html fica (o `onchange` é dele). */
function sessionChoices(sessions){
 let out={$:'Nil'};
 for(let i=(sessions||[]).length-1;i>=0;i--){
  const s=sessions[i]||{};
  out={$:'Con',head:{$:'SessionChoice',label:String(s.label||s.path||''),path:String(s.path||'')},tail:out};
 }
 return out;
}
export function fillSessions(data){
 const sel=$('#session-select');if(!sel)return;
 S.currentSession=data.session||S.currentSession;
 const node=statusCore.sessionSelect(S.currentSession,!!sel.disabled,sessionChoices(data.sessions));
 applyAttrs(sel,node);
 renderChildren(sel,childrenOf(node.kids));
 /* Caminho fora da lista: o app zera a seleção (o browser escolheria a 1ª). */
 if(S.currentSession)sel.value=S.currentSession;
}
export function applyStudy(study={}){$('#exercise-title').value=study.title||'';$('#pick-xopp').dataset.path=study.xopp||'';$('#pick-xopp').textContent=study.xopp?study.xopp.split(/[/\\]/).at(-1):'Rascunho .xopp';$('#pick-xopp').title=study.xopp||'Associar arquivo do Xournal++';updateContextSummary();}
/* O requisito de visão saiu daqui: anexar a captura não exige modelo com
   imagem — o aviso fica no `addAttachments`/envio. disabled/title do #check são
   só deste applier; o hidden é do `core/deskflags.bend` (flag conferir). */
function conferirEnabled(){return S.captureOk&&!S.busy;}
function updateCheckButton(){const el=$('#check');if(!el)return;el.disabled=!conferirEnabled();el.title=S.captureOk?'Anexar a captura do Xournal++ à mensagem':'Conferir Xournal++ indisponível neste computador';}
export function setBusy(value){S.busy=value;footValues({busy:value});if(value){if(!S.busySince)S.busySince=Date.now();}else{S.busySince=0;S.busyStall=0;}setTabsDisabled(value||!!S.connecting||S.switching);if($('#session-select'))$('#session-select').disabled=value||!!S.connecting||S.switching;$('#model-select').disabled=value||!S.connected;$('#thinking-select').disabled=value||!S.connected;$('#stop').hidden=!value;$('#attach').disabled=value;$('#send').disabled=value;updateCheckButton();if(value)activity('Pi está pensando…');else if(S.connected)activity('');}
function setTabsDisabled(value){for(const tab of document.querySelectorAll('#course-tabs button'))tab.disabled=!!value;}
function updateSettings(result){const current=result.state?.model;S.supportsImages=!!current?.input?.includes('image');updateMeter(result.contextUsage||result.state?.contextUsage);renderAutoCompact(result.state);updateCheckButton();$('#model-select').replaceChildren(...S.modelCatalog.map(m=>new Option(`${m.name||m.id} · ${m.provider}`,JSON.stringify([m.provider,m.id]))));if(current)$('#model-select').value=JSON.stringify([current.provider,current.id]);const labels={off:'Desligado',minimal:'Mínimo',low:'Baixo',medium:'Médio',high:'Alto',xhigh:'Muito alto',max:'Máximo'};$('#thinking-select').replaceChildren(...(result.levels||[]).map(l=>new Option(labels[l]||l,l)));$('#thinking-select').value=result.state?.thinkingLevel||'off';const level=result.state?.thinkingLevel||'off';const picked=current?S.modelCatalog.find(m=>m.provider===current.provider&&m.id===current.id):null;footValues({model:picked?`${picked.name||picked.id} · ${picked.provider}`:'',level:labels[level]||level});$('#model-select').disabled=S.busy;$('#thinking-select').disabled=S.busy;$('#pi-label').textContent=current?.name||current?.id||'Pi';}
export async function settings(change){$('#model-select').disabled=true;$('#thinking-select').disabled=true;try{updateSettings(await window.desk.settings(change));}catch(e){toast(e.message);try{updateSettings(await window.desk.settings({}));}catch{}}finally{$('#model-select').disabled=S.busy;$('#thinking-select').disabled=S.busy;}}
export const THEME_LABELS={auto:'Tema: auto',light:'Tema: claro',dark:'Tema: escuro'};
export function applyTheme(value){
 S.currentTheme=['light','dark'].includes(value)?value:'auto';
 if(S.currentTheme==='auto')delete document.documentElement.dataset.theme;
 else document.documentElement.dataset.theme=S.currentTheme;
 const btn=$('#theme-cycle');if(btn)btn.textContent=THEME_LABELS[S.currentTheme];
}
export function labelBtn(el,name,text){if(!el)return;el.innerHTML=`${icon(name)}${text?` <span>${text}</span>`:''}`;}
/* O vazio da conversa é árvore do núcleo (`core/welcomeview.bend`): o título é
   a matéria da troca e o clique do botão cai na tabela do view-host. O SVG do
   botão é asset do host (`icons.mjs`), como nas abas. */
export function showWelcome(title){
 const box=$('#messages');if(!box)return;
 renderInto(box,welcomeCore.welcomeView(String(title||'')),{Connect:()=>connect().catch(()=>{})});
 labelBtn($('#connect'),'plug','Conectar ao Pi');
}
export async function connect(){
 if(S.connected)return;
 if(S.connecting)return S.connecting;
 setTabsDisabled(true);$('#pi-label').textContent='Conectando…';connectionState('connecting','Conectando ao Pi');activity('Abrindo a sessão do Pi…');
 let hung=0;
 S.connecting=(async()=>{
  const timer=setTimeout(()=>{hung=1;},90000);
  try{
   const result=await window.desk.connect();
   S.connected=true;S.healthFails=0;S.modelCatalog=result.models||[];if(result.captureAvailable!=null)S.captureOk=!!result.captureAvailable;updateSettings(result);fillSessions(result);updateWindowTitle();connectionState('online','Pi conectado');activity('Pi conectado.');
   setTimeout(()=>{if(S.connected&&!S.busy&&$('#activity').textContent==='Pi conectado.')activity('');},2500);
   $('#pi-label').textContent=result.state?.model?.name||result.state?.model?.id||'Pi';
   if(result.messages?.length)showHistory(result.messages);else $('#welcome')?.remove();
  }catch(e){
   toast(hung?'A conexão do Pi demorou demais; a interface foi destravada. Tente de novo.':e.message);
   S.connected=false;$('#pi-label').textContent='Pi';connectionState('error','Falha ao conectar ao Pi');activity(hung?'A conexão do Pi demorou demais.':`Erro de conexão: ${e.message}`);
   throw e;
  }finally{
   clearTimeout(timer);
   S.connecting=null;setTabsDisabled(S.busy);
  }
 })();
 return S.connecting;
}
export function markCourseTab(id){
 for(const t of document.querySelectorAll('#course-tabs button[role="tab"]')){
  const active=t.dataset.id===id;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));
 }
 updateWindowTitle();
}
/* Fatos das abas de matéria: a árvore é do `core/tabsview.bend` (o `main.mjs`
   aplica com o view-host); aqui ficam só os fatos que o resto do host usa — o
   nome da matéria ativa (título da janela e resumo de contexto), o id (aba
   ativa) e o "desabilitado" de conexão/troca. */
function updateCourseFacts(data){
 S.activeCourseName=data.course||'';
 S.currentCourseId=data.courseId||'';
 setTabsDisabled(S.busy||!!S.connecting||S.switching);
}
function applyDesk(desk){
 const title=desk?.title||'Mesa de Estudos';
 const brand=$('.brand strong');if(brand)brand.textContent=title;
 const specs=desk?.panels?.length?desk.panels:[{label:'Enunciado'},{label:'Formulário & apoio',toggle:'Formulário'}];
 const two=specs.length>1;
 /* `#reference-toggle` (hidden e rótulo) e `#xournal` (hidden) são decididos
    pelo `core/tabsview.bend` e aplicados no `renderMenus` do `main.mjs` — o
    mesmo fato do `desk` normalizado. O `aria-pressed` do toggle continua no
    host: o clique o atualiza sem re-render. */
 const flags={refsToggle:desk?.refsToggle!==false,endDay:desk?.endDay!==false,studyContext:desk?.studyContext!==false,conferir:desk?.conferir!==false};
 if(!flags.refsToggle)S.includeRefs=true;
 /* Os controles vivos do composer/sidebar (botão de referências, Encerrar,
    contexto de estudo, Conferir e o divisor da calculadora) são view do
    `core/deskflags.bend`: a flag vira `hidden` e, sem o botão de referências,
    o `aria-pressed` fica forçado em true (as referências seguem ligadas). Só
    atributos entram — texto, ícone e handlers são do index.html. */
 const facts={$:'DeskFlags',refsToggle:flags.refsToggle,includeRefs:!!S.includeRefs,endDay:flags.endDay,studyContext:flags.studyContext,conferir:desk?.conferir!==false,calculator:desk?.calculator!==false};
 applyAttrsOn('#include-refs',deskFlagsCore.includeRefsButton(facts));
 applyAttrsOn('#end-day',deskFlagsCore.endDayButton(facts));
 applyAttrsOn('#study-context',deskFlagsCore.studyContextRow(facts));
 applyAttrsOn('#check',deskFlagsCore.conferirButton(facts));
 applyAttrsOn('#calc-divider',deskFlagsCore.calcDivider(facts));
 /* Itens do texto da ajuda: a decisão (`hidden`) vem do Bend (dialogsview). */
 applyHelpFlags(flags);
 /* A visibilidade da calculadora é decisão do `core/calcview.bend`; o render
    de boot do adaptador acontece antes do config, então re-aplicamos a view
    aqui com o fato já resolvido. */
 initCalculator();
 return {title,specs,two,flags};
}
export async function loadCourse(data){
 S.quizQueue=[];
 resetAttachments();
 S.captureOk=!!data.captureAvailable;
 S.appConfig={...(data.config||S.appConfig),platform:data.platform||S.appConfig.platform};
 S.deskVersion=data.deskVersion||S.deskVersion;
 const desk=applyDesk(S.appConfig.desk);
 fillSessions(data);
 $('#prompt').value=data.state.draft||'';
 applyTheme(data.state.theme);
 applyStudy(desk.flags.studyContext?data.state.study:{});
 for(const p of S.panels){p.version++;p.resize.disconnect();clearTimeout(p.resizeTimer);clearTimeout(p.zoomTimer);cancelAnimationFrame(p._visibleFrame);p.cancelRenders();}
 $('#pdf-grid').replaceChildren();S.library=data.library||[];
 S.panels=desk.specs.map((spec,i)=>new PdfPanel(i,spec.label));
 S.pdfDivider=desk.two?makePdfDivider():null;
 if(desk.two)S.panels[0].el.classList.add('pinned');
 /* Visibilidade do 2º painel ANTES do primeiro await: junto com o chrome
    (desk-chrome) o boot fica visível inteiro de uma vez — teste e usuário não
    leem o layout pela metade enquanto os PDFs carregam. */
 if(desk.two){
  S.refVisible=data.state.referenceVisible!==false;S.panels[1].el.hidden=!S.refVisible;if(S.pdfDivider)S.pdfDivider.hidden=!S.refVisible;$('#pdf-grid').classList.toggle('single',!S.refVisible);$('#reference-toggle').setAttribute('aria-pressed',String(S.refVisible));
  if(Number.isFinite(Number(data.state.pdfSplit)))setPdfSplitPct(Number(data.state.pdfSplit));
 }else{
  S.refVisible=false;$('#pdf-grid').classList.add('single');
 }
 updateCheckButton();
 updateCourseFacts(data);
 updateWindowTitle();
 /* O chrome da matéria (abas + menus) é do `core/tabsview.bend`, aplicado no
    `renderTabsView`/`renderMenus` do main.mjs: avisar aqui fecha o vão antes do
    carregamento dos PDFs — abas e itens de menu ficam prontos no mesmo tick que
    os controles do composer (chrome pela metade deixa o #course-tabs vazio). */
 window.dispatchEvent(new Event('desk-chrome'));
 const preferred=data.preferred||[];
 const loads=[];
 for(let i=0;i<S.panels.length;i++){
  const saved=data.state.pdfs?.[i];
  if(saved?.path&&!S.library.some(p=>p.path===saved.path)){S.library.push({path:saved.path,name:saved.path.split(/[/\\]/).at(-1)});S.panels[i].populate();}
  const path=saved?.path||preferred[i];
  if(saved?.minimized)S.panels[i].toggleMinimized(true);
  if(path)loads.push(S.panels[i].load(path,saved||{}));
 }
 await Promise.all(loads);
 updateContextSummary();
 document.documentElement.style.setProperty('--chat',(data.state.chatWidth||390)+'px');
 document.documentElement.style.setProperty('--calc',(data.state.calcHeight||220)+'px');
 save();
}
/* O Pi esperando resposta (quiz na tela ou `#pi-dialog` aberto) não é ocioso
   mesmo com o `busy` solto: trocar de matéria embora abandonaria a pergunta. */
function piPromptPending(){return !!(S.dialogPending||S.quizQueue.length);}
async function waitIdle(){for(let i=0;i<80;i++){if(!S.busy&&!S.connecting&&!piPromptPending())return true;await new Promise(r=>setTimeout(r,150));}return !S.busy&&!S.connecting&&!piPromptPending();}
export async function switchCourse(id){
 if(S.switching)return;
 /* Com o turno aberto a troca é recusada pelo host; avisar antes do `waitIdle`
    evita 12 s de silêncio no atalho (⌘2) até o toast de recusa. */
 if(S.busy){toast('Pare a resposta antes de trocar de matéria.');return;}
 if(piPromptPending()){toast('O Pi está esperando sua resposta: responda antes de trocar de matéria.');return;}
 await waitIdle();
 deactivateGeogebra();
 const tab=document.querySelector(`#course-tabs button[data-id="${CSS.escape(id)}"]`);
 if(!tab||tab.classList.contains('active'))return;
 S.switching=true;setTabsDisabled(true);
 try{
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
  const data=await window.desk.switchCourse(id);
  S.connected=false;connectionState('','Pi desconectado');showWelcome(data.course);
  /* Fatos da matéria e aba ativos antes dos PDFs montarem (o `loadCourse`
     antigo chamava `renderTabs(data); updateWindowTitle()` logo depois do IPC);
     o `loadCourse` abaixo refaz os mesmos fatos com a biblioteca pronta. */
  updateCourseFacts(data);
  markCourseTab(id);
  $('#pi-label').textContent='Pi';$('#model-select').replaceChildren(new Option('Conecte ao Pi',''));$('#thinking-select').replaceChildren(new Option('—',''));footValues({model:'',level:''});
  setBusy(false);await loadCourse(data);connect().catch(()=>{});
 }catch(e){toast(e.message);}finally{S.switching=false;setTabsDisabled(false);}
}
setInterval(async()=>{
 if(!S.connected||S.connecting||document.hidden)return;
 if(!S.busy){
  S.busyStall=0;
  try{const data=await window.desk.health();S.healthFails=0;connectionState('online','Pi conectado');if(data?.contextUsage)updateMeter(data.contextUsage);}
  catch(e){S.connected=false;connectionState('error','Pi desconectado');activity(`Conexão perdida: ${e.message}`);toast(e.message);}
  return;
 }
 let data=null;
 try{data=await window.desk.health();}catch{}
 if(!data){
  /* Ocupado: health mudo é a única evidência de ponte morta (o timeout não
     mata mais a conexão) — duas falhas seguidas (30s) destravam a UI. */
  S.healthFails=(S.healthFails||0)+1;
  if(S.healthFails>=2){
   S.healthFails=0;S.connected=false;
   connectionState('error','Pi desconectado');setBusy(false);
   activity('Conexão perdida: o Pi não respondeu.');toast('O Pi parou de responder; a interface foi destravada.');
  }
  return;
 }
 S.healthFails=0;
 if(data.contextUsage)updateMeter(data.contextUsage);
 if(data.isStreaming||data.pendingMessageCount){S.busyStall=0;return;}
 if(!S.busySince||Date.now()-S.busySince<=60000)return;
 S.busyStall++;
 if(S.busyStall>=3){S.busyStall=0;setBusy(false);toast('A resposta do Pi não estava ativa; a interface foi destravada.');}
},15000);
function deskLogError(line){try{window.desk.logError(String(line??'').slice(0,4000)).catch(()=>{});}catch{}}
window.addEventListener('error',e=>deskLogError(e?.error?.stack||e?.message||e));
window.addEventListener('unhandledrejection',e=>{const reason=e?.reason;deskLogError(reason&&(reason.stack||reason.message)||reason||'rejeição sem motivo');});
