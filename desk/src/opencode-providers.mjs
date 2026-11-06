// @ts-check
import {S,connect,reconnectAfterBridgeStop,toast} from './state.mjs';
import {t,LANGUAGE_EVENT} from './ui-text.mjs';
import {providerIcon} from './provider-icons.mjs';
import {loginBinary} from './setup-view.mjs';
import {CURATED,providerLoginAction,providersResult} from './opencode-providers-state.mjs';

/* Entrada por provedor do OpenCode na janela (#login no app): a lista dos que
   já estão conectados, o botão Entrar de ChatGPT e Grok, e um "Outro provedor"
   para OAuth ou chave de API. A mesma casca serve a primeira abertura e
   Configurações → Pastas e programas; a decisão de quem pode entrar por aqui
   é de `opencode-providers-state.mjs`, e o HTTP é do host. Nenhum token chega
   ao renderer: o progresso fala em tentativa, navegador e conta. */

const POLL_MS=1500;
const SPECS=new Map(CURATED.map(spec=>[spec.id,spec]));
/** @type {Map<string, ReturnType<typeof createPanel>>} */
const panels=new Map();

/** @typedef {import('./opencode-providers-state.mjs').ProviderRow} ProviderRow */
/** @typedef {ReturnType<typeof providersResult>} ProvidersResult */
/** @typedef {{phase:'starting'|'waiting'|'complete'|'cancelled'|'failed',kind:'oauth'|'key',provider:string,methodID:string,attemptID:string,url:string,instructions:string,mode:'auto'|'code',browser:boolean,deadline:number,busy:boolean,message:string,needCode:boolean}} LoginState */

const LOGIN_MESSAGES={
 missing:'opencodeProviders.missing',
 old:'opencodeProviders.old',
 port:'opencodeProviders.port',
 server:'opencodeProviders.server',
 timeout:'opencodeProviders.timeout',
 unreachable:'opencodeProviders.unreachable',
 rejected:'opencodeProviders.keyRejected',
 expired:'opencodeProviders.expiredAttempt',
 cancelled:'opencodeProviders.cancelled',
};

/** @param {string} tag @param {string} [className] @param {string} [content] @returns {HTMLElement} */
function el(tag,className='',content=''){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(content)node.textContent=content;
 return node;
}

/** @param {string} label @param {string} action @param {Record<string,string>} [data] @param {string} [className] @returns {HTMLButtonElement} */
function actionButton(label,action,data={},className=''){
 const button=/** @type {HTMLButtonElement} */(el('button',className,label));
 button.type='button';
 button.dataset.action=action;
 for(const [key,value] of Object.entries(data))button.dataset[key]=value;
 return button;
}

/** @param {ProvidersResult} result @returns {string} */
function binaryCommand(result){
 return loginBinary(result.binary,result.platform)||(result.platform==='win32'?'opencode.exe':'opencode');
}

/** @param {ProviderRow} provider @returns {string} */
function providerName(provider){
 const spec=SPECS.get(provider.id);
 return spec?t(spec.nameKey):provider.name||provider.id;
}

/** @param {ProviderRow} provider @returns {string} */
function providerSub(provider){
 const spec=SPECS.get(provider.id);
 return spec?.subKey?t(spec.subKey):'';
}

/** @param {ProviderRow} provider @returns {string} */
function statusText(provider){
 if(provider.status==='connected')return t('opencodeProviders.connected')+(provider.environment?` · ${t('opencodeProviders.environment')}`:'');
 if(provider.status==='expired')return t('opencodeProviders.expired');
 return t('opencodeProviders.off');
}

/** @param {ProvidersResult} result @param {string} suffix @returns {HTMLElement} */
function commandBlock(result,suffix){
 const line=el('div','op-command');
 line.append(el('code','',`${binaryCommand(result)} ${suffix}`));
 const copy=actionButton(t('opencodeProviders.copy'),'copy',{copy:`${binaryCommand(result)} ${suffix}`},'set-link');
 copy.setAttribute('aria-label',t('opencodeProviders.copy'));
 line.append(copy);
 return line;
}

/** @param {HTMLElement} root @param {'setup'|'settings'} variant */
function createPanel(root,variant){
 /** @type {ProvidersResult} */
 let result={state:'loading',providers:[],others:[],binary:'',platform:'',version:''};
 /** @type {Promise<void>|null} */
 let loading=null;
 let loaded=false;
 let lastAttempt=0;
 /** @type {LoginState|null} */
 let login=null;
 let keyFor='';
 let keyHint='';
 let genericId='';
 let timer=0;

 /** @param {string} messageKey */
 const fail=(messageKey)=>{login={.../** @type {LoginState} */(login),phase:'failed',message:messageKey};clearTimer();repaint();};
 const clearTimer=()=>{if(timer)window.clearTimeout(timer);timer=0;};

 function schedule(){
  clearTimer();
  timer=window.setTimeout(tick,POLL_MS);
 }

 async function tick(){
  timer=0;
  if(!login||login.phase!=='waiting')return;
  if(Date.now()>=login.deadline){await timeoutLogin();return;}
  let next;
  try{next=await window.desk.opencodeProviderLoginStatus({attemptID:login.attemptID});}
  catch{fail('opencodeProviders.unreachable');return;}
  if(!login)return;
  if(next?.status==='pending'){schedule();return;}
  if(next?.status==='complete'){await finish(next);return;}
  if(next?.status==='expired'){fail('opencodeProviders.expiredAttempt');return;}
  fail(LOGIN_MESSAGES[String(next?.outcome||'')]||'opencodeProviders.failed');
 }

 async function timeoutLogin(){
  const attempt=login?.attemptID;
  if(attempt){try{await window.desk.opencodeProviderLoginCancel({attemptID:attempt});}catch{/* o prazo já venceu */}}
  fail('opencodeProviders.expiredAttempt');
 }

 async function finish(next){
  clearTimer();
  login={.../** @type {LoginState} */(login),phase:'complete',busy:next?.busy===true,message:''};
  repaint();
  try{
   if(next?.busy){/* a resposta em curso não é interrompida */}
   else    if(next?.relinked){await reconnectAfterBridgeStop();}
   else if(String(S.link?.state)!=='online')await connect();
  }catch{login={.../** @type {LoginState} */(login),message:'opencodeProviders.reconnectFailed'};repaint();}
  await reloadStatuses();
 }

 async function reloadStatuses(){
  if(result.state!=='ready')return;
  try{
   const next=providersResult(await window.desk.opencodeProviders());
   if(next.state==='ready'){result=next;loaded=true;repaint();}
  }catch{/* o login já deu certo; a próxima abertura confere de novo */}
 }

 async function cancelLogin({quiet=false}={}){
  const attempt=login?.attemptID;
  clearTimer();
  if(attempt){try{await window.desk.opencodeProviderLoginCancel({attemptID:attempt});}catch{/* já saiu */}}
  if(quiet){login=null;return;}
  if(login){login={...login,phase:'cancelled',message:'opencodeProviders.cancelled'};repaint();}
 }

 async function startOAuth(providerId,methodID){
  if(!methodID){fail('opencodeProviders.failed');return;}
  if(login&&login.phase!=='complete'&&login.phase!=='failed'&&login.phase!=='cancelled')await cancelLogin({quiet:true});
  keyFor='';keyHint='';login={phase:'starting',kind:'oauth',provider:providerId,methodID,attemptID:'',url:'',instructions:'',mode:'auto',browser:true,deadline:0,busy:false,message:'',needCode:false};
  repaint();
  let next;
  try{next=await window.desk.opencodeProviderLoginStart({integrationID:providerId,methodID});}
  catch{fail('opencodeProviders.unreachable');return;}
  if(!next?.ok){fail(LOGIN_MESSAGES[String(next?.outcome||'')]||'opencodeProviders.failed');return;}
  if(next.kind==='complete'){await finish(next);return;}
  if(!next.attemptID){fail('opencodeProviders.server');return;}
  login={.../** @type {LoginState} */(login),phase:'waiting',attemptID:String(next.attemptID),url:String(next.url||''),instructions:String(next.instructions||''),mode:next.mode==='code'?'code':'auto',browser:next.browser===true,deadline:Date.now()+Number(next.expiresInMs||600000)};
  repaint();
  schedule();
 }

 async function startKey(providerId,key){
  if(login&&login.phase!=='complete'&&login.phase!=='failed'&&login.phase!=='cancelled')await cancelLogin({quiet:true});
  keyFor='';keyHint='';
  login={phase:'starting',kind:'key',provider:providerId,methodID:'',attemptID:'',url:'',instructions:'',mode:'auto',browser:true,deadline:0,busy:false,message:'',needCode:false};
  repaint();
  let next;
  try{next=await window.desk.opencodeProviderLoginStart({integrationID:providerId,key});}
  catch{fail('opencodeProviders.unreachable');return;}
  if(!next?.ok){fail(LOGIN_MESSAGES[String(next?.outcome||'')]||'opencodeProviders.failed');return;}
  await finish(next);
 }

 async function submitKey(){
  const field=/** @type {HTMLInputElement|null} */(root.querySelector('[data-role="key-input"]'));
  const key=String(field?.value||'').trim();
  if(!key){keyHint='opencodeProviders.keyNeeded';repaint();/** @type {HTMLElement|null} */(root.querySelector('[data-role="key-input"]'))?.focus();return;}
  keyHint='';
  await startKey(keyFor,key);
 }

 async function submitCode(){
  if(!login)return;
  const field=/** @type {HTMLInputElement|null} */(root.querySelector('[data-role="code-input"]'));
  const code=String(field?.value||'').trim();
  if(!code){login={...login,needCode:true};repaint();/** @type {HTMLElement|null} */(root.querySelector('[data-role="code-input"]'))?.focus();return;}
  const current=login;
  let next;
  try{next=await window.desk.opencodeProviderLoginComplete({attemptID:current.attemptID,code});}
  catch{fail('opencodeProviders.unreachable');return;}
  if(!next?.ok){fail(LOGIN_MESSAGES[String(next?.outcome||'')]||'opencodeProviders.failed');return;}
  await finish(next);
 }

 async function retry(){
  const previous=login;
  if(!previous)return;
  clearTimer();
  if(previous.kind==='key'){login=null;keyFor=previous.provider;keyHint='';repaint();focusKey();return;}
  await startOAuth(previous.provider,previous.methodID);
 }

 async function reopen(){
  if(!login?.attemptID)return;
  try{const next=await window.desk.opencodeProviderLoginOpen({attemptID:login.attemptID});if(!next?.ok&&login){login={...login,browser:false};repaint();}}
  catch{/* a tentativa segue; o endereço continua na tela */}
 }

 function focusKey(){
  requestAnimationFrame(()=>/** @type {HTMLElement|null} */(root.querySelector('[data-role="key-input"]'))?.focus());
 }

 function stateBlock(){
  const box=el('div','op-state-box');
  const key=result.state==='old'?'opencodeProviders.old':result.state==='port'?'opencodeProviders.port':result.state==='server'?'opencodeProviders.server':result.state==='timeout'?'opencodeProviders.timeout':result.state==='missing'?'opencodeProviders.missing':'opencodeProviders.unreachable';
  box.append(el('p','op-state-text',result.state==='old'?t(key,{version:result.version||'?'}):t(key)));
  box.append(commandBlock(result,'auth login'));
  if(result.state!=='missing')box.append(actionButton(t('opencodeProviders.reload'),'refresh',{},'set-link'));
  return box;
 }

 function mark(provider){
  const node=el('span','op-mark');
  const spec=SPECS.get(provider.id);
  node.innerHTML=providerIcon(spec?.icon||provider.id,providerName(provider));
  node.setAttribute('aria-hidden','true');
  return node;
 }

 function loginNode(provider){
  const current=login;
  if(!current||current.provider!==provider.id)return null;
  const box=el('div','op-login');
  box.dataset.phase=current.phase;
  box.setAttribute('role','status');
  box.setAttribute('aria-live','polite');
  if(current.phase==='starting'){
   box.append(el('p','op-login-text',t(current.kind==='key'?'opencodeProviders.keySaving':'opencodeProviders.opening')));
   return box;
  }
  if(current.phase==='complete'){
   box.append(el('p','op-login-text',t(current.busy?'opencodeProviders.connectedButBusy':'opencodeProviders.connectedDone')));
   return box;
  }
  if(current.phase==='cancelled'||current.phase==='failed'){
   box.append(el('p','op-login-text',t(current.message||'opencodeProviders.failed')));
   box.append(actionButton(t('opencodeProviders.retry'),'retry',{provider:current.provider},''));
   return box;
  }
  const lines=el('div','op-login-body');
  if(!current.browser)lines.append(el('p','op-login-text',t('opencodeProviders.browserClosed')));
  else lines.append(el('p','op-login-text',t('opencodeProviders.waiting')));
  if(current.instructions)lines.append(el('p','op-instructions',t('opencodeProviders.instructions',{instructions:current.instructions})));
  if(current.url){
   const row=el('div','op-url');
   row.append(el('code','',current.url),actionButton(t('opencodeProviders.openAgain'),'open-url',{},'set-link'));
   lines.append(row);
  }
  if(current.mode==='code'){
   const form=el('div','op-code');
   const field=/** @type {HTMLInputElement} */(el('input'));
   field.type='text';field.autocomplete='off';field.spellcheck=false;field.dataset.role='code-input';
   field.id=variant==='settings'?'cfg-opencode-provider-code':'setup-opencode-provider-code';
   field.setAttribute('aria-label',t('opencodeProviders.codeField'));
   if(current.needCode)field.setAttribute('aria-invalid','true');
   form.append(field,actionButton(t('opencodeProviders.codeUse'),'code-submit',{},''));
   lines.append(form);
  }
  lines.append(actionButton(t('opencodeProviders.cancel'),'cancel',{},''));
  box.append(lines);
  return box;
 }

 function keyNode(provider){
  if(keyFor!==provider.id)return null;
  const form=el('div','op-key');
  const label=el('label','');
  label.append(el('span','',t('opencodeProviders.keyField')));
  const field=/** @type {HTMLInputElement} */(el('input'));
  field.type='password';field.autocomplete='off';field.spellcheck=false;field.dataset.role='key-input';
  field.id=variant==='settings'?'cfg-opencode-provider-key':'setup-opencode-provider-key';
  field.setAttribute('aria-label',t('opencodeProviders.keyField'));
  if(keyHint)field.setAttribute('aria-invalid','true');
  label.append(field);
  form.append(label,el('p','fine',t('opencodeProviders.keyLead')));
  const row=el('div','op-key-actions');
  row.append(actionButton(t('opencodeProviders.keyUse'),'key-submit',{},''),actionButton(t('opencodeProviders.cancel'),'key-cancel',{},''));
  form.append(row);
  if(keyHint)form.append(el('p','op-login-text',t(keyHint)));
  return form;
 }

 function rowNode(provider){
  const row=el('div','op-provider');
  row.dataset.provider=provider.id;
  row.dataset.state=provider.status;
  const body=el('div','op-body');
  const head=el('div','op-name-row');
  head.append(el('span','op-name',providerName(provider)));
  const sub=providerSub(provider);
  if(sub)head.append(el('span','op-sub',sub));
  const meta=el('span','op-state-line');
  meta.append(el('span','op-status-dot',''),el('span','op-status',statusText(provider)));
  body.append(head,meta);
  row.classList.toggle('connected',provider.status==='connected');
  row.classList.toggle('expired',provider.status==='expired');
  row.append(mark(provider),body);
  if(provider.status!=='connected'){
   const loginAction=providerLoginAction(provider.plan);
   if(loginAction){
    const label=provider.status==='expired'?'opencodeProviders.enterAgain':'opencodeProviders.enter';
    row.append(actionButton(t(label),loginAction,{provider:provider.id,method:provider.plan.methodID},''));
   }else{
    row.append(commandBlock(result,provider.command));
   }
   if(provider.plan.kind==='oauth'&&provider.methods.some(method=>method.type==='key'&&method.usable)){
    row.append(actionButton(t('opencodeProviders.keyUse'),'key',{provider:provider.id},'set-link'));
   }
  }
  const progress=loginNode(provider);
  if(progress)row.append(progress);
  const key=keyNode(provider);
  if(key)row.append(key);
  return row;
 }

 function genericBlock(){
  const details=/** @type {HTMLDetailsElement} */(el('details','op-others'));
  details.open=!!genericId;
  details.append(el('summary','',t('opencodeProviders.others')));
  details.append(el('p','fine',t('opencodeProviders.othersLead')));
  const select=/** @type {HTMLSelectElement} */(el('select','op-select'));
  select.id=variant==='settings'?'cfg-opencode-provider-select':'setup-opencode-provider-select';
  select.setAttribute('aria-label',t('opencodeProviders.chooseProvider'));
  const empty=/** @type {HTMLOptionElement} */(el('option'));
  empty.value='';empty.textContent=t('opencodeProviders.chooseProvider');
  select.append(empty);
  for(const provider of result.others){
   const option=/** @type {HTMLOptionElement} */(el('option'));
   option.value=provider.id;
   option.textContent=provider.status==='connected'?`${provider.name} · ${t('opencodeProviders.connected')}`:provider.name;
   select.append(option);
  }
  select.value=genericId;
  details.append(select);
  const chosen=result.others.find(provider=>provider.id===genericId);
  if(!chosen){if(genericId)details.append(el('p','op-login-text',t('opencodeProviders.failed')));return details;}
  const box=el('div','op-provider op-provider-generic');
  box.dataset.provider=chosen.id;
  box.dataset.state=chosen.status;
  const body=el('div','op-body');
  const meta=el('span','op-state-line');
  meta.append(el('span','op-status-dot',''),el('span','op-status',statusText(chosen)));
  body.append(el('span','op-name',chosen.name),meta);
  box.append(mark(chosen),body);
  const usable=chosen.methods.filter(method=>method.usable);
  for(const method of usable){
   if(method.type==='oauth')box.append(actionButton(method.label||t('opencodeProviders.oauthEnter'),'login',{provider:chosen.id,method:method.id},''));
   if(method.type==='key')box.append(actionButton(t('opencodeProviders.keyUse'),'key',{provider:chosen.id},'set-link'));
  }
  if(!usable.length){
   box.append(el('p','op-login-text',t('opencodeProviders.unsupported')));
   box.append(commandBlock(result,chosen.command));
  }
  const progress=loginNode(chosen);
  if(progress)box.append(progress);
  const key=keyNode(chosen);
  if(key)box.append(key);
  details.append(box);
  return details;
 }

 function repaint(){
  if(!root.isConnected)return;
  const nodes=[];
  if(variant==='settings'){
   const head=el('div','op-head');
   head.append(el('span','set-group-label',t('opencodeProviders.title')));
   head.append(actionButton(t('opencodeProviders.reload'),'refresh',{},'set-link'));
   nodes.push(head,el('p','fine',t('opencodeProviders.lead')));
  }else{
   nodes.push(el('p','op-title',t('opencodeProviders.title')));
  }
  if(result.state==='loading'||(!loaded&&!result.state))nodes.push(el('p','op-login-text',t('opencodeProviders.checking')));
  else if(result.state!=='ready')nodes.push(stateBlock());
  else{
   const list=el('div','op-list');
   list.setAttribute('role','list');
   list.append(...result.providers.map(rowNode));
   nodes.push(list,genericBlock());
  }
  root.replaceChildren(...nodes);
 }

 async function refresh({force=false}={}){
  if(login&&login.phase!=='complete'&&login.phase!=='failed'&&login.phase!=='cancelled')return;
  if(loading)return loading;
  if(!force&&loaded&&result.state==='ready'){repaint();return;}
  if(!force&&Date.now()-lastAttempt<3000){repaint();return;}
  lastAttempt=Date.now();
  result={...result,state:'loading'};
  repaint();
  loading=(async()=>{
   try{result=providersResult(await window.desk.opencodeProviders());loaded=result.state==='ready';}
   catch{result={...result,state:'unreachable'};loaded=false;}
   finally{loading=null;repaint();}
  })();
  return loading;
 }

 async function copyText(value,button){
  try{await navigator.clipboard.writeText(value);button.textContent=t('opencodeProviders.copied');setTimeout(()=>{button.textContent=t('opencodeProviders.copy');},1400);}
  catch(error){toast(String(/** @type {Error} */(error)?.message||error));}
 }

 function onClick(event){
  const target=/** @type {HTMLElement|null} */(/** @type {HTMLElement} */(event.target).closest?.('[data-action]'));
  if(!target)return;
  const action=target.dataset.action;
  if(!action)return;
  event.preventDefault();
  if(action==='refresh')refresh({force:true}).catch(()=>{});
  else if(action==='login')startOAuth(String(target.dataset.provider||''),String(target.dataset.method||'')).catch(()=>{});
  else if(action==='key'){if(login?.phase==='waiting'||login?.phase==='starting')cancelLogin({quiet:true}).catch(()=>{});login=null;keyFor=String(target.dataset.provider||'');keyHint='';repaint();focusKey();}
  else if(action==='cancel')cancelLogin().catch(()=>{});
  else if(action==='retry')retry().catch(()=>{});
  else if(action==='open-url')reopen().catch(()=>{});
  else if(action==='code-submit')submitCode().catch(()=>{});
  else if(action==='key-submit')submitKey().catch(()=>{});
  else if(action==='key-cancel'){keyFor='';keyHint='';repaint();}
  else if(action==='copy')copyText(String(target.dataset.copy||''),target).catch(()=>{});
 }

 function onKeydown(event){
  if(event.key!=='Enter')return;
  const target=/** @type {HTMLInputElement} */(event.target);
  if(target?.dataset.role==='key-input'){event.preventDefault();event.stopPropagation();submitKey().catch(()=>{});}
  else if(target?.dataset.role==='code-input'){event.preventDefault();event.stopPropagation();submitCode().catch(()=>{});}
 }

 function onChange(event){
  const target=/** @type {HTMLSelectElement} */(event.target);
  if(!target.classList.contains('op-select'))return;
  genericId=target.value;
  repaint();
 }

 root.addEventListener('click',onClick);
 root.addEventListener('keydown',onKeydown);
 root.addEventListener('change',onChange);
 return {refresh,cancel:()=>cancelLogin({quiet:true}),repaint,isActive:()=>!!login&&login.phase!=='complete'&&login.phase!=='failed'&&login.phase!=='cancelled'};
}

/**
 * Liga os dois painéis (primeira abertura e Configurações). O primeiro só é
 * atualizado quando o passo do tutor aparece, para não subir o servidor à toa.
 * @returns {void}
 */
export function initOpenCodeProviders(){
 const roots=/** @type {Array<[string,'setup'|'settings']>} */([['#setup-providers','setup'],['#cfg-opencode-providers','settings']]);
 for(const [selector,variant] of roots){
  const root=document.querySelector(selector);
  if(root)panels.set(variant,createPanel(/** @type {HTMLElement} */(root),variant));
 }
 window.addEventListener(LANGUAGE_EVENT,()=>{for(const panel of panels.values())panel.repaint();});
 document.querySelector('#settings-dialog')?.addEventListener('toggle',event=>{if(/** @type {HTMLDialogElement} */(event.target).open)refreshOpenCodeProviders('settings');});
 document.querySelector('#settings-dialog')?.addEventListener('close',()=>{for(const panel of panels.values())panel.cancel();});
}

/** @param {'setup'|'settings'|'all'} [which] @param {{force?:boolean}} [options] */
export function refreshOpenCodeProviders(which='all',options={}){
 for(const [variant,panel] of panels){
  if(which!=='all'&&which!==variant)continue;
  panel.refresh(options).catch(()=>{});
 }
}

/** @param {'setup'|'settings'} which */
export function cancelOpenCodeProviderLogin(which){
 for(const [variant,panel] of panels){
  if(variant!==which)continue;
  if(panel.isActive())panel.cancel().catch(()=>{});
 }
}
