// @ts-check
import {t,currentLanguage} from './ui-text.mjs';
import {TOUR,stepId,setupBlocked,primaryKey,hintKey,setupTrail,speechOf,activeRegion,pdfPreview} from './setup-flow.mjs';

/* Pintura da primeira abertura em tela cheia (#64). O HTML estático
   (`#setup` no index.html) tem os seis passos com `data-i18n`; aqui só se
   mostra o passo atual e se preenche o que depende do estado (trilha, fala,
   quadro do passeio, pasta, tutor, resumo). Sem decisão de fluxo: isso é do
   `setup-flow.mjs`. */

/**
 * @typedef {object} SetupFacts
 * @property {string} kind "setup" ou "empty"
 * @property {boolean} piFound
 * @property {string} dataFolder
 * @property {string[]} pdfNames
 * @property {number} elsewhere
 */

/** @typedef {{Connect:()=>void, UseFreeModels:()=>void, OpenPiSettings:()=>void, ChangeDataFolder:()=>void}} SetupActions */

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
 $('#setup-tour-extras').replaceChildren(...['extra1','extra2'].map(extra=>make('li',{},t(`setup.tour.${frame.id}.${extra}`))));
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
 setText($('#setup-drop-help'),t(has?'setup.drop.changeHelp':'firstrun.drop.help'));
 $('#setup-chosen').hidden=!has;
 setText($('#setup-chosen-folder'),has?t('firstrun.chosen',{folder:state.folder}):'');
 const {shown,more}=pdfPreview(facts.pdfNames,state.pdfCount);
 const files=state.pdfCount?[...shown,...(more?[t('setup.folder.more',{count:more})]:[])].join(' · '):t('setup.folder.none');
 setText($('#setup-chosen-files'),has?files:'');
 const away=has&&facts.elsewhere>0;
 $('#setup-elsewhere').hidden=!away;
 setText($('#setup-elsewhere'),away?t('firstrun.elsewhere',{count:facts.elsewhere}):'');
}

/* O tutor de hoje (o `tutorView` da #21): Pi achado — Chamar o tutor e
   Usar modelos grátis; sem Pi — Ajustes do Pi como principal; ligado — só
   diz que está ligado. */
/** @param {import('./setup-flow.mjs').SetupState} state @param {SetupFacts} facts @param {SetupActions} actions */
function paintTutor(state,facts,actions){
 setText($('#setup-tutor-title'),t(state.online?'firstrun.tutor.onlineLead':'firstrun.tutor.lead'));
 setText($('#setup-tutor-text'),t(state.online?'firstrun.tutor.onlineFine':'firstrun.tutor.intro'));
 $('#setup-tutor-off').hidden=state.online;
 const pi=$('#setup-pi');
 pi.dataset.pi=facts.piFound?'found':'missing';
 setText(pi,t(facts.piFound?'firstrun.pi.found':'firstrun.pi.missing'));
 const key=`${facts.piFound}:${currentLanguage()}`;
 const box=$('#setup-tutor-actions');
 if(box.dataset.painted===key)return;
 box.dataset.painted=key;
 const button=(/** @type {string} */ id,/** @type {string} */ cls,/** @type {string} */ label,/** @type {string} */ title,/** @type {()=>void} */ run)=>{
  const el=make('button',{type:'button',id,class:cls,title:t(title)},t(label));
  el.addEventListener('click',run);
  return el;
 };
 box.replaceChildren(...(facts.piFound
  ?[button('connect','primary','tutor.connect','tutor.connectTitle',actions.Connect),button('free-models','','freeModels.open','freeModels.openTitle',actions.UseFreeModels)]
  :[button('state-pi','primary','tutor.piSettings','tutor.piSettingsTitle',actions.OpenPiSettings),button('connect','','tutor.connect','tutor.connectTitle',actions.Connect)]));
}

/** @param {import('./setup-flow.mjs').SetupState} state @param {SetupFacts} facts @param {SetupActions} actions */
function paintReady(state,facts,actions){
 setText($('#setup-ready-title'),t('setup.ready.title',{name:shortName(state.name)}));
 const rows=[
  ['setup.summary.course',state.name.trim()],
  ['setup.summary.pdfs',t('setup.summary.pdfsValue',{folder:state.folder,count:state.pdfCount})],
  ['setup.summary.tutor',t(state.online?'setup.summary.tutorOn':'setup.summary.tutorOff')],
  ['setup.summary.language',currentLanguage()==='en'?'English':'Português'],
 ];
 $('#setup-summary').replaceChildren(...rows.flatMap(([label,value])=>[make('dt',{},t(label)),make('dd',{},value)]));
 /* A pasta de dados: no "empty" ela já valia e só é informada, sem Mudar (#24). */
 const known=facts.kind==='empty';
 const line=$('#setup-data');
 line.replaceChildren(t('firstrun.data.prefix'),make('code',{class:'setup-path'},facts.dataFolder),t(known?'firstrun.data.end':'firstrun.data.suffix'));
 if(known)return;
 const change=make('button',{type:'button',id:'first-run-data-change',class:'setup-link'},t('firstrun.data.change'));
 change.addEventListener('click',actions.ChangeDataFolder);
 line.append(change);
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
}

/**
 * Pinta a tela inteira para o estado de agora.
 * @param {import('./setup-flow.mjs').SetupState} state
 * @param {SetupFacts} facts
 * @param {SetupActions} actions
 */
export function paintSetup(state,facts,actions){
 const id=stepId(state);
 /* Só os painéis: o `#setup-card` também leva `data-step` (para o CSS) e não
    pode entrar aqui, senão some a cada troca de passo (bug da #64 pego no first-run-ui). */
 for(const step of document.querySelectorAll('#setup .setup-step[data-step]'))/** @type {HTMLElement} */(step).hidden=/** @type {HTMLElement} */(step).dataset.step!==id;
 $('#setup-card').dataset.step=id;
 $('#setup').toggleAttribute('data-dragging',state.alert&&id==='folder');
 $('#setup-card').setAttribute('aria-label',t(`setup.step.${id}`));
 const speech=speechOf(state);
 setText($('#setup-speech'),t(speech.key,speech.args));
 paintTrail(state);
 /* Passeio, pasta e Pronto se pintam mesmo escondidos: trocar o idioma em
    outro passo deixava o texto antigo neles (o language-ui achou "Open the
    material" em português). O tutor monta botões e fica só no passo dele. */
 paintTour(state);
 paintFolder(state,facts);
 if(id==='tutor')paintTutor(state,facts,actions);
 paintReady(state,facts,actions);
 paintFoot(state);
 for(const button of document.querySelectorAll('#first-run-language [data-language]'))button.setAttribute('aria-pressed',String(/** @type {HTMLElement} */(button).dataset.language===currentLanguage()));
 for(const button of document.querySelectorAll('#setup-language [data-language]'))button.setAttribute('aria-checked',String(/** @type {HTMLElement} */(button).dataset.language===currentLanguage()));
}

/** O primeiro campo do passo para o foco (o nome; senão o botão principal). @param {import('./setup-flow.mjs').SetupState} state */
export function focusTarget(state){
 return stepId(state)==='name'?$('#first-run-name'):$('#setup-next');
}

