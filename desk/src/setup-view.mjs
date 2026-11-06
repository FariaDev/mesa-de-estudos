// @ts-check
import {t,currentLanguage} from './ui-text.mjs';
import {TOUR,stepId,setupBlocked,primaryKey,hintKey,setupTrail,speechOf,activeRegion,pdfPreview} from './setup-flow.mjs';
import {lampStateOf,nameLineScale} from './setup-lamp.mjs';

/* Pintura da primeira abertura em tela cheia (#64). O HTML estático
   (`#setup` no index.html) tem os seis passos com `data-i18n`; aqui só se
   mostra o passo atual e se preenche o que depende do estado (trilha, fala,
   quadro do passeio, pasta, tutor, resumo). Sem decisão de fluxo: isso é do
   `setup-flow.mjs`. */

/**
 * @typedef {object} SetupFacts
 * @property {string} kind "setup" ou "empty"
 * @property {boolean} claudeFound
 * @property {boolean} opencodeFound
 * @property {string} opencodeBinary
 * @property {string} opencodeOldVersion
 * @property {boolean} installSupported
 * @property {string} platform
 * @property {string} dataFolder
 * @property {string[]} pdfNames
 * @property {number} elsewhere
 * @property {string[]} [visibleEngines]
 */

/** @typedef {{Connect:()=>void, UseFreeModels:()=>void, OpenPiSettings:()=>void, OpenTutorSettings:()=>void, ChangeDataFolder:()=>void, InstallOpenCode:()=>void, UpdateOpenCode:()=>void, ChooseOpenCode:()=>void, OpenOpenCodeHelp:()=>void}} SetupActions */

/** @typedef {{state:'idle'|'installing'|'done'|'error', phase?:string, percent?:number, errorCode?:string, error?:string, version?:string}} SetupInstall */

const $=(/** @type {string} */ selector)=>/** @type {HTMLElement} */(document.querySelector(selector));

/** @param {HTMLElement} el @param {string} value */
function setText(el,value){if(el&&el.textContent!==value)el.textContent=value;}

/** @param {string} tag @param {Record<string,string>} attrs @param {string} [label] */
function make(tag,attrs,label){
 const el=document.createElement(tag);
 for(const [name,value] of Object.entries(attrs))el.setAttribute(name,value);
 if(label!==undefined)el.textContent=label;
 return el;
}

/* O nome curto da matéria, para os títulos; sem nome, o exemplo. */
const shortName=(/** @type {string} */ name)=>name.trim()||t('setup.name.example1');

/** @param {import('./setup-flow.mjs').SetupState} state */
function paintTrail(state){
 const list=$('#setup-trail');
 const items=setupTrail(state).map(({id,status,mark})=>{
  const li=make('li',{'data-status':status,...(status==='current'?{'aria-current':'step'}:{})});
  li.append(make('span',{class:'setup-trail-mark','aria-hidden':'true'},mark),document.createTextNode(t(`setup.step.${id}`)));
  return li;
 });
 list.replaceChildren(...items);
}

/** @param {import('./setup-flow.mjs').SetupState} state */
function paintTour(state){
 const frame=TOUR[state.frame];
 setText($('#setup-tour-num'),String(state.frame+1));
 setText($('#setup-tour-title'),t(`setup.tour.${frame.id}.title`));
 setText($('#setup-tour-text'),t(`setup.tour.${frame.id}.body`));
 const region=activeRegion(state);
 for(const el of document.querySelectorAll('#setup [data-region]'))el.toggleAttribute('data-lit',/** @type {HTMLElement} */(el).dataset.region===region);
 [...$('#setup-dots').children].forEach((dot,i)=>{dot.toggleAttribute('data-on',i===state.frame);dot.toggleAttribute('data-seen',i<=state.frame);});
}

/** @param {import('./setup-flow.mjs').SetupState} state @param {SetupFacts} facts */
function paintFolder(state,facts){
 setText($('#setup-folder-title'),t('setup.folder.title',{name:shortName(state.name)}));
 const has=!!state.folder;
 $('#first-run-pick').toggleAttribute('data-chosen',has);
 setText($('#setup-drop-title'),t(has?'setup.drop.changeTitle':'firstrun.drop.title'));
 setText($('#setup-drop-help'),has?'':t('firstrun.drop.help'));
 $('#setup-chosen').hidden=!has;
 setText($('#setup-chosen-folder'),has?t('firstrun.chosen',{folder:state.folder}):'');
 const {shown,more}=pdfPreview(facts.pdfNames,state.pdfCount);
 const files=state.pdfCount?[...shown,...(more?[t('setup.folder.more',{count:more})]:[])].join(' · '):t('setup.folder.none');
 setText($('#setup-chosen-files'),has?files:'');
 const away=has&&facts.elsewhere>0;
 $('#setup-elsewhere').hidden=!away;
 setText($('#setup-elsewhere'),away?t('firstrun.elsewhere',{count:facts.elsewhere}):'');
}

/* O tutor de hoje (o `tutorView` da #21): qualquer motor achado — Chamar o
   tutor; nenhum — a tela oferece a instalação do OpenCode. */
/** @param {SetupFacts} facts @returns {string} */
function enginesFoundText(facts){
 const visible=facts.visibleEngines||['claude','opencode'];
 const names=[
  ...(facts.claudeFound&&visible.includes('claude')?['claude']:[]),
  ...(facts.opencodeFound&&visible.includes('opencode')?['opencode']:[]),
 ].map(name=>t(`firstrun.engine.${name}`));
 const old=facts.opencodeOldVersion?t('firstrun.tutor.opencodeOld',{version:facts.opencodeOldVersion}):'';
 if(names.length)return [t('firstrun.engines.found',{engines:names.join(', ')}),old].filter(Boolean).join(' ');
 return old||t('firstrun.tutor.noEngine');
}

/** @param {string} command */
function codeNode(command){
 const code=document.createElement('code');
 code.textContent=command;
 return code;
}

/**
 * O binário do OpenCode pronto para colar num shell. No Windows o caminho real
 * termina em `.exe`. Em macOS/Linux a pasta pessoal pode virar `~` só quando o
 * resto do caminho não tem espaço nem metacaractere — assim o comando continua
 * colável sem aspas; com espaço, vai o caminho completo entre aspas.
 * @param {string} binary caminho detectado ou instalado
 * @param {string} [platform] `win32` para o `.exe`
 * @returns {string} caminho (com aspas quando precisa)
 * @example loginBinary('/home/ana/.opencode/bin/opencode', 'linux') // '~/.opencode/bin/opencode'
 * @example loginBinary('C:\\Users\\ana\\.opencode\\bin\\opencode', 'win32') // 'C:\\Users\\ana\\.opencode\\bin\\opencode.exe'
 */
export function loginBinary(binary,platform=''){
 const raw=String(binary||'').trim();
 if(!raw)return '';
 let file=platform==='win32'&&!/\.exe$/i.test(raw)?`${raw}.exe`:raw;
 const homeAt=file.indexOf('/.opencode/bin/');
 if(platform!=='win32'&&homeAt>0&&!/\s/.test(file))file=`~${file.slice(homeAt)}`;
 return /\s/.test(file)?`"${file}"`:file;
}

/** Texto e comando de entrada no OpenCode; o comando fica copiável. @param {HTMLElement} target @param {boolean} visible @param {SetupFacts} facts */
function paintLoginHint(target,visible,facts){
 target.hidden=!visible;
 if(!visible)return;
 const binary=loginBinary(facts.opencodeBinary,facts.platform);
 target.replaceChildren(document.createTextNode(`${t('firstrun.login.lead')} `),codeNode(t('firstrun.login.command',{binary})),document.createTextNode(` ${t('firstrun.login.hint')}`));
}

/** @param {string} phase */
export function installPhaseText(phase){
 return t(`firstrun.install.phase.${phase||'prepare'}`);
}

/* O erro da instalação chega como código; a tela mostra título curto e frase
   humana, e a causa técnica fica no log do host. Código desconhecido cai no
   texto genérico, nunca em texto cru. */
const INSTALL_ERROR_KIND={network:'network',integrity:'integrity',unsupported:'unsupported',busy:'busy',permission:'permission',space:'space',symlink:'symlink',version:'version',verify:'version'};
/** @param {string} code @returns {{title:string, body:string}} */
export function installErrorText(code){
 const kind=INSTALL_ERROR_KIND[code]||'generic';
 return {title:t(`firstrun.install.error.${kind}.title`),body:t(`firstrun.install.error.${kind}.body`)};
}

/** @param {SetupInstall} install */
function installProgress(install){
 const wrap=make('div',{class:'setup-install',id:'setup-install'});
 const progress=make('progress',{class:'setup-install-progress',max:'100'});
 const percent=Number(install.percent);
 const known=Number.isFinite(percent)&&percent>=0;
 if(known)progress.setAttribute('value',String(Math.round(percent)));
 else progress.removeAttribute('value');
 const pct=make('span',{class:'setup-install-percent'},known?`${Math.round(percent)}%`:'');
 pct.setAttribute('aria-hidden','true');
 wrap.append(progress,pct,make('span',{class:'setup-install-text'},installPhaseText(install.phase)));
 return wrap;
}

/** @param {import('./setup-flow.mjs').SetupState} state @param {SetupFacts} facts @param {SetupActions} actions @param {SetupInstall} install */
function paintTutor(state,facts,actions,install){
 setText($('#setup-tutor-title'),t(state.online?'firstrun.tutor.onlineLead':'firstrun.tutor.lead'));
 setText($('#setup-tutor-text'),t(state.online?'firstrun.tutor.onlineFine':'firstrun.tutor.intro'));
 $('#setup-tutor-off').hidden=state.online;
 const visible=facts.visibleEngines||['claude','opencode'];
 const anyFound=(facts.claudeFound&&visible.includes('claude'))||(facts.opencodeFound&&visible.includes('opencode'));
 const status=$('#setup-pi');
 status.dataset.pi=anyFound?'found':'missing';
 setText(status,enginesFoundText(facts));
 paintLoginHint($('#setup-login-hint'),facts.opencodeFound&&!state.online,facts);
 const key=JSON.stringify([facts.claudeFound,facts.opencodeFound,facts.opencodeBinary,facts.opencodeOldVersion,facts.installSupported,facts.platform,visible,install.state,install.phase,install.percent,install.errorCode,install.error,currentLanguage()]);
 const box=$('#setup-tutor-actions');
 if(box.dataset.painted===key)return;
 box.dataset.painted=key;
 box.classList.toggle('setup-done',install.state==='done');
 const update=!!facts.opencodeOldVersion;
 const button=(/** @type {string} */ id,/** @type {string} */ cls,/** @type {string} */ label,/** @type {string} */ title,/** @type {()=>void} */ run)=>{
  const el=make('button',{type:'button',id,class:cls,title:t(title)},t(label));
  el.addEventListener('click',run);
  return el;
 };
 const installButton=()=>{
  const el=button('install-opencode','primary',update?'firstrun.install.update':'firstrun.install.button',update?'firstrun.install.updateTitle':'firstrun.install.buttonTitle',update?actions.UpdateOpenCode:actions.InstallOpenCode);
  return el;
 };
 const connect=button('connect','primary','tutor.connect','tutor.connectTitle',actions.Connect);
 /* Os Ajustes do tutor continuam à mão no setup; só o atalho do Pi saiu. */
 const settings=button('setup-settings','','tutor.engineSettings','tutor.engineSettingsTitle',actions.OpenTutorSettings);
 if(install.state==='installing'){
  const busy=installButton();
  busy.setAttribute('disabled','');
  busy.setAttribute('aria-busy','true');
  box.replaceChildren(busy,installProgress(install),settings);
  return;
 }
 const parts=[];
 if(anyFound&&install.state!=='error')parts.push(connect);
 if(install.state==='done')parts.push(make('p',{class:'setup-install-done',id:'setup-install-done'},t('firstrun.install.done',{version:install.version||''})));
 if(install.state==='error'){
  const copy=installErrorText(install.errorCode||'');
  const error=make('div',{class:'setup-install-error',id:'setup-install-error',role:'alert'});
  error.append(make('strong',{},copy.title),make('p',{},copy.body));
  parts.push(error);
 }
 if(!facts.opencodeFound){
  if(facts.installSupported){
   const el=installButton();
   if(install.state==='error')el.textContent=t('firstrun.install.retry');
   parts.push(el);
  }else{
   const help=make('div',{class:'setup-install-help',id:'setup-install-help'});
   help.append(make('p',{},t('firstrun.install.unsupported')));
   help.append(button('open-opencode-docs','setup-link','firstrun.install.openDocs','firstrun.install.openDocsTitle',actions.OpenOpenCodeHelp));
   parts.push(help);
  }
  /* Instalado por bun/npm fora dos caminhos fixos: o shell de login já foi
     perguntado (#102); se ainda não achou, a pessoa aponta o executável. */
  parts.push(button('pick-opencode','setup-link','firstrun.tutor.pickOpenCode','firstrun.tutor.pickOpenCodeTitle',actions.ChooseOpenCode));
 }
 parts.push(settings);
 box.replaceChildren(...parts);
}

/** @param {import('./setup-flow.mjs').SetupState} state @param {SetupFacts} facts */
function paintReady(state,facts){
 setText($('#setup-ready-title'),t('setup.ready.title',{name:shortName(state.name)}));
 const rows=[
  ['setup.summary.course',state.name.trim()],
  ['setup.summary.pdfs',t('setup.summary.pdfsValue',{folder:state.folder,count:state.pdfCount})],
  ['setup.summary.tutor',t(state.online?'setup.summary.tutorOn':'setup.summary.tutorOff')],
  ['setup.summary.language',currentLanguage()==='en'?'English':'Português'],
 ];
 $('#setup-summary').replaceChildren(...rows.flatMap(([label,value])=>[make('dt',{},t(label)),make('dd',{},value)]));
 paintLoginHint($('#setup-ready-login'),facts.opencodeFound&&!state.online,facts);
}

/** A luz da cena e a linha do nome (#101). @param {import('./setup-flow.mjs').SetupState} state @param {SetupFacts} facts @param {SetupInstall} install */
function paintLamp(state,facts,install){
 const scene=$('#setup-lamp');
 if(!scene)return;
 scene.dataset.lamp=lampStateOf(state,facts,install);
 scene.style.setProperty('--lamp-name-scale',String(nameLineScale(state.name)));
}

/** @param {import('./setup-flow.mjs').SetupState} state */
function paintFoot(state){
 const id=stepId(state);
 $('#setup-back').hidden=state.step===0;
 $('#setup-dots').hidden=id!=='tour';
 $('#setup-skip-tour').hidden=id!=='tour';
 const hint=hintKey(state);
 setText($('#setup-hint'),hint?t(hint):'');
 const next=/** @type {HTMLButtonElement} */($('#setup-next'));
 next.disabled=setupBlocked(state);
 setText(next,t(primaryKey(state)));
  /* Enquanto "Instalar o OpenCode" ou "Chamar o tutor" está na tela, ele é o
     caminho principal: o "Pular por agora" do rodapé fica secundário (um só
     botão forte por passo; auditoria rodada 5, D1). Com o tutor ligado o
     painel some (`hidden`), e o "Continuar" do rodapé volta a ser o único. */
  const mainOffered=id==='tutor'&&!state.online&&!!document.querySelector('#setup-tutor-actions #install-opencode, #setup-tutor-actions #connect');
  next.classList.toggle('primary',!mainOffered);
}

/**
 * Pinta a tela inteira para o estado de agora.
 * @param {import('./setup-flow.mjs').SetupState} state
 * @param {SetupFacts} facts
 * @param {SetupActions} actions
 * @param {SetupInstall} [install]
 */
export function paintSetup(state,facts,actions,install={state:'idle'}){
 const id=stepId(state);
 /* Só os painéis: o `#setup-card` também leva `data-step` (para o CSS) e não
    pode entrar aqui, senão some a cada troca de passo (bug da #64 pego no first-run-ui). */
 for(const step of document.querySelectorAll('#setup .setup-step[data-step]'))/** @type {HTMLElement} */(step).hidden=/** @type {HTMLElement} */(step).dataset.step!==id;
 $('#setup-card').dataset.step=id;
 $('#setup').toggleAttribute('data-dragging',state.alert&&id==='folder');
 $('#setup-card').setAttribute('aria-label',t(`setup.step.${id}`));
 const speech=speechOf(state);
 setText($('#setup-speech'),speech.key?t(speech.key,speech.args):'');
 paintTrail(state);
 /* Passeio, pasta e Pronto se pintam mesmo escondidos: trocar o idioma em
    outro passo deixava o texto antigo neles (o language-ui achou "Open the
    material" em português). O tutor monta botões e fica só no passo dele. */
 paintTour(state);
 paintFolder(state,facts);
 paintLamp(state,facts,install);
 if(id==='tutor')paintTutor(state,facts,actions,install);
 paintReady(state,facts);
 paintFoot(state);
 for(const button of document.querySelectorAll('#first-run-language [data-language]'))button.setAttribute('aria-pressed',String(/** @type {HTMLElement} */(button).dataset.language===currentLanguage()));
 for(const button of document.querySelectorAll('#setup-language [data-language]'))button.setAttribute('aria-checked',String(/** @type {HTMLElement} */(button).dataset.language===currentLanguage()));
}

/** O primeiro campo do passo para o foco (o nome; senão o botão principal). @param {import('./setup-flow.mjs').SetupState} state */
export function focusTarget(state){
 return stepId(state)==='name'?$('#first-run-name'):$('#setup-next');
}

