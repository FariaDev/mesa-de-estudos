'use strict';

const path=require('node:path');
const layoutPolicy=require('./layout-presets.cjs');
const materialModel=require('./material-model.cjs');
const {normalizeChoice:normalizeConferirChoice}=require('./conferir-host.cjs');
const {normalizeUi:normalizeUiLanguage,normalizeTutor:normalizeTutorLanguage}=require('./language-host.cjs');
const {sanitizeNotices}=require('./tool-updates.cjs');
const pdfPageCore=require('./src/generated/pdfpageview.core.js').default;
const {toNat}=require('./src/bend-nat.mjs');
const {normalizeRecents,normalizeFavorites}=require('./src/model-picker.mjs');

/* Sanitização do desk.json (#43 fase 2: saiu do main.cjs sem mudar regra). */
/* Estado lido é dado não confiável (arquivo editado à mão, versão antiga ou
   gravação interrompida). A normalização de tipos acontece ANTES de
   `initialData()`/`applyCourse()`: `init` não pode rejeitar por estado
   corrompido, e o próximo save regrava o estado sanado. Campos desconhecidos
   seguem intactos — só os que o host itera/consome viram o tipo esperado. */
const {isPlainObject}=require('./plain-object.cjs');
function asString(value){return typeof value==='string'?value:'';}
function asArray(value){return Array.isArray(value)?value:[];}
function asBounds(value){
 if(!isPlainObject(value))return undefined;
 const x=value.x,y=value.y,width=value.width,height=value.height;
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 if(!finite(x)||!finite(y)||!finite(width)||!finite(height)||width<=0||height<=0)return undefined;
 return {x,y,width,height};
}
/* Rotação do leitor (voltas do usuário de 90°): só o que o ciclo do núcleo
   aceita entra no estado; qualquer outra coisa (dado antigo, corrompido ou
   editado à mão) cai fora e o documento fica em pé. O mapa é por caminho de
   PDF — 0 não entra (ausência já é "em pé"). */
function sanitizeRotation(value){
 if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>270)return 0;
 return Number(pdfPageCore.rotationNormalize(toNat(value)));
}
function sanitizePdfRotations(value){
 const out={};
 if(!isPlainObject(value))return out;
 for(const [key,rotation] of Object.entries(value)){
  if(!key||key==='__proto__')continue;
  const r=sanitizeRotation(rotation);
  if(r)out[key]=r;
 }
 return out;
}
function sanitizeFreeSessions(value){
 const out={};
 if(!isPlainObject(value))return out;
 for(const [id,entry] of Object.entries(value)){
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id))continue;
  if(!isPlainObject(entry))continue;
  out[id]=sanitizeCourseState(entry);
 }
 return out;
}
function sanitizeFreeState(value){
 const source=isPlainObject(value)?value:{};
 const sessions=sanitizeFreeSessions(source.sessions);
 const activeId=typeof source.activeId==='string'&&sessions[source.activeId]?source.activeId:(Object.keys(sessions)[0]||'');
 return {activeId,sessions};
}
function sanitizeCourseState(value){
 const source=isPlainObject(value)?value:{};
 return {...source,
  pdfs:asArray(source.pdfs),
  sessions:asArray(source.sessions).filter(entry=>isPlainObject(entry)&&typeof entry.path==='string'&&entry.path),
  session:asString(source.session),
  sessionStudies:isPlainObject(source.sessionStudies)?source.sessionStudies:{},
  study:isPlainObject(source.study)?source.study:{},
  pdfRotations:sanitizePdfRotations(source.pdfRotations),
  ggbBase64:asString(source.ggbBase64)};
}
function sanitizeState(value){
 const source=isPlainObject(value)?value:{};
 const out={...source,
  pdfs:asArray(source.pdfs),
  session:asString(source.session),
  study:isPlainObject(source.study)?source.study:{},
  pdfRotations:sanitizePdfRotations(source.pdfRotations),
  ggbBase64:asString(source.ggbBase64),
  viewLayout:layoutPolicy.normalizeViewLayout(source.viewLayout),
  layoutPresets:layoutPolicy.normalizeStore(source.layoutPresets),
  free:sanitizeFreeState(source.free),
  conferirApp:normalizeConferirChoice(source.conferirApp),
  /* Idioma (#41): interface "" = nunca escolhido, acompanha o sistema; tutor "follow" = acompanhar as mensagens. */
  uiLanguage:normalizeUiLanguage(source.uiLanguage),
  tutorLanguage:normalizeTutorLanguage(source.tutorLanguage),
  /* Modelos grátis (#44): o id do modelo do Zen que a pessoa escolheu (a Mesa lança o Pi com ele) e se o aviso de modelo pago já foi aceito. A chave NÃO mora aqui (`opencode-key-store.cjs`). */
  opencodeModel:asString(source.opencodeModel).slice(0,120),
  opencodePaidOk:source.opencodePaidOk===true,
  toolNotices:sanitizeNotices(source.toolNotices),
  pdfModels:materialModel.sanitizeMemory(source.pdfModels),
  /* Recentes do seletor de modelo (#59): por motor, estado de interface, fora do `config.json`. */
  modelRecents:normalizeRecents(source.modelRecents),
  /* Favoritos do seletor (estrela, acabamento da #59): por motor, mesmo lugar dos recentes. */
  modelFavorites:normalizeFavorites(source.modelFavorites),
  courseStates:{}};
 const states=isPlainObject(source.courseStates)?source.courseStates:{};
 for(const [id,entry] of Object.entries(states)){if(id==='__proto__')continue;out.courseStates[id]=sanitizeCourseState(entry);}
 const bounds=asBounds(source.bounds);
 if(bounds)out.bounds=bounds;else delete out.bounds;
 return out;
}
/* Preferências pessoais por arquivo, fora dos PDFs e dos defaults do autor:
   deslocamento de página por caminho absoluto, até 2000 arquivos. */
function sanitizePdfPageOffsets(source){
 const out={};
 if(isPlainObject(source))for(const [file,offset] of Object.entries(source).slice(0,2000)){
  if(path.isAbsolute(file)&&file.length<=4096&&Number.isInteger(offset)&&Math.abs(offset)<=1000000)out[file]=offset;
 }
 return out;
}

/* Recentes que o renderer manda no save-state: o formato é o de `model-picker.mjs`; o que não for par de texto cai. */
const sanitizeModelRecents=normalizeRecents;
const sanitizeModelFavorites=normalizeFavorites;

module.exports={sanitizeModelRecents,sanitizeModelFavorites,isPlainObject,asString,asArray,asBounds,sanitizeRotation,sanitizePdfRotations,sanitizeFreeState,sanitizeCourseState,sanitizeState,sanitizePdfPageOffsets};
