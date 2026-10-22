// @ts-check
'use strict';

const {message}=require('./src/i18n.mjs');

/* Guardas do main (#43 fase 2: saiu do main.cjs): a exclusão das gravações
   da aba Livre, de PDF, backup e atividades (`freeMutate`) e a da navegação
   entre matérias e conversas (`withHostNav`). O persist que chega no meio de
   uma gravação fica adiado e roda quando ela termina. */

/**
 * Cria as guardas sobre o estado vivo do main (freeMutation, navInFlight...).
 * Devolve isFree, assertNoFreeMutation, assertNoNav, beginFreeMutation,
 * endFreeMutation, freeMutate, activityMutate e withHostNav.
 * @param {{live: import('./main.cjs').DeskLive, FREE_ID: string, persist: () => void,
 *   appendLog: import('./types/host-deps').AppendLog}} options
 * @example const {freeMutate,withHostNav}=createDeskGuards({live,FREE_ID,persist,appendLog});
 */
function createDeskGuards({live,FREE_ID,persist,appendLog}){
 function isFree(){return live.courseId===FREE_ID;}
 function assertNoFreeMutation(){if(live.freeMutation)throw Error(message('err.busy.operation'));}
 function assertNoNav(){if(live.navInFlight)throw Error(message('err.busy.switch'));}
 function beginFreeMutation(label){
  if(live.freeMutation||live.navInFlight)throw Error(message('err.busy.operation'));
  live.freeMutation=true;
  live.freeMutationIdle=new Promise(resolve=>{live.releaseFreeMutation=resolve;});
  return label;
 }
 function endFreeMutation(){
  live.freeMutation=false;
  if(live.deferredPersist){live.deferredPersist=false;try{persist();}catch(error){appendLog('free',`persist adiado falhou: ${error.message}`);}}
  const release=live.releaseFreeMutation;live.releaseFreeMutation=null;release?.();
 }
 async function freeMutate(label,fn){
  beginFreeMutation(label);
  try{return await fn();}
  finally{endFreeMutation();}
 }
 /* Atividades aguardam PDF/backup/outras gravações em vez de falhar por
    concorrência. Mantém a exclusão com navegação/restauração; o host revalida
    o escopo depois da espera, antes de escrever no store. */
 async function activityMutate(label,fn){
  while(live.freeMutation)await live.freeMutationIdle;
  return freeMutate(label,fn);
 }
 async function withHostNav(fn){
  assertNoFreeMutation();
  if(live.navInFlight)throw Error(message('err.busy.switch'));
  live.navInFlight=true;
  try{return await fn();}
  finally{live.navInFlight=false;}
 }
 return {isFree,assertNoFreeMutation,assertNoNav,beginFreeMutation,endFreeMutation,freeMutate,activityMutate,withHostNav};
}

module.exports={createDeskGuards};
