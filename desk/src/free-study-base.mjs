import {$,S} from './state.mjs';

/* Aba Livre — estado mutável da aba, ponte com o host e os fatos da sessão
   (é Livre? tem PDF aberto?).
   Saiu de free-study.mjs na #43 fase 2. */

const FREE_COURSE_ID='mesa-free';
const FREE_DIALOGS=['#free-pdf-dialog','#free-promote-dialog','#tutor-pdf-dialog','#free-add-dialog'];
/* Estado mutável da aba num objeto só (#43 fase 2): os módulos da aba Livre
   o dividem sem reatribuir import. */
const freeState={
 generation:0,lastData:null,inflight:'',renaming:false,sources:[],previewFrame:0,paintFrame:0,
 /* Modelo do PDF: o painel (cartões e opções) é a fonte; a origem da escolha só
    alimenta a frase do rodapé e vira `changed` quando a pessoa troca. */
 modelPanel:null,modelSource:'default',realPreviewTimer:0,
 /* Prévia fiel (mesmo renderizador/CSS da impressão) + "Ver PDF" com bytes
    temporários. A revisão (título+conteúdo+template) invalida resultado
    assíncrono antigo; editar/fechar cancela. Salvar NUNCA reutiliza os bytes da
    prévia: o host re-renderiza e valida de novo antes de gravar. */
 previewJob:null,previewToken:0,
};
function bridge(){
 return window.deskFreeBridge&&typeof window.deskFreeBridge==='object'?window.deskFreeBridge:window.desk;
}
function api(name){
 const target=bridge();
 const fn=target&&typeof target[name]==='function'?target[name]:null;
 return fn?fn.bind(target):null;
}
function workspaceOf(data){
 return data&&typeof data==='object'&&data.workspace&&typeof data.workspace==='object'?data.workspace:null;
}
function isFreeData(data){
 const workspace=workspaceOf(data);
 if(workspace)return workspace.kind==='free';
 /* Fallback do contrato: `mesa-free` é id reservado; sem S.workspace ainda (host
    antigo), o id conhecido basta para a UI não ficar morta. */
 return !!(data&&data.courseId===FREE_COURSE_ID);
}
function extractData(result){
 if(!result||typeof result!=='object')return null;
 const data=result.data&&typeof result.data==='object'?result.data:result;
 return data&&typeof data==='object'&&(data.state||data.workspace)?data:null;
}
function mainOf(){return document.querySelector('main');}
function refsOf(){return $('#references');}
function hasOpenPdf(){return Array.isArray(S.panels)&&S.panels.some(panel=>panel&&panel.path);}
/* Mesmo fato do `paint`: o host manda. Um payload livre atrasado com matéria
   real ativa não vale como "sessão livre" para nenhuma ação. */
function isFree(){
 if(!isFreeData(freeState.lastData))return false;
 return !(S.currentCourseId&&S.currentCourseId!==FREE_COURSE_ID);
}

export {FREE_COURSE_ID,FREE_DIALOGS,freeState,api,workspaceOf,isFreeData,extractData,mainOf,refsOf,hasOpenPdf,isFree};
