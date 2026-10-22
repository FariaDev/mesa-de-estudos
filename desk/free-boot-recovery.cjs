'use strict';

const crypto=require('node:crypto');
const path=require('node:path');
const conversations=require('./src/agents/conversations.cjs');
const free=require('./free-workspaces.cjs');
const freePromotion=require('./free-promotion.cjs');

/* Diário externo da promoção Livre → matéria + promoções de store sem diário.
   Roda ANTES de ler desk.json/config.json: um crash no meio da promoção deixa
   arquivos restaurados ou concluídos aqui, e o app nasce consistente. Sessões
   com diário ainda aberto não são tocadas por esta varredura (o diário decide).
   Saiu do main.cjs na #43 fase 2. */

/**
 * Recupera as promoções Livre → matéria interrompidas e dá caminho nativo às sessões Livre sem um.
 * @param {{runtime:string, config:{courses?:Array<{id:string}>}, log:(line:string)=>void}} options
 * @returns {void} nunca lança: a falha vira linha de log
 * @example recoverFreePromotions({runtime,config,log:line=>appendLog('free',line)});
 */
function recoverFreePromotions({runtime,config,log}){
 try{
  const actions=freePromotion.recover(runtime,{store:free,patchDescriptor:(file,patch)=>conversations.updateClaudeConversation(file,patch,{runtime}),log:line=>log(line)});
  for(const action of actions)if(action.action!=='completed')log(JSON.stringify(action));
  const pending=freePromotion.sessions(runtime);
  for(const record of free.listWorkspaces(runtime)){
   if(!record.nativePath){try{free.setNativePath(runtime,record.id,path.join(free.workspaceDir(runtime,record.id),`pi-${crypto.randomUUID()}.jsonl`));}catch(error){log(`caminho nativo da sessão Livre não gravado: ${error.message}`);}}
   const plan=record.promotion;
   if(!plan||plan.status==='promoted'||pending.has(record.id))continue;
   if(plan.status==='prepared'){
    try{free.rollbackPromotion(runtime,record.id);log(`staging órfão removido: ${record.id}`);}catch(error){log(`staging órfão preservado: ${error.message}`);}
    continue;
   }
   if(plan.status==='committing'){
    try{
     const result=free.recoverPromotion(runtime,record.id);
     const known=result.promotion&&(config.courses||[]).some(c=>c.id===result.promotion.courseId);
     if(result.state==='conflict')log(`promoção em conflito preservada: ${record.id}`);
     else if(result.state!=='committed'||!known){free.rollbackPromotion(runtime,record.id);log(`promoção sem diário desfeita: ${record.id}`);}
    }catch(error){try{free.rollbackPromotion(runtime,record.id);}catch{/* o erro original é registrado logo abaixo */}log(`recuperação ${record.id}: ${error.message}`);}
   }
  }
 }catch(error){log(`recuperação de promoções falhou: ${error.message}`);}
}

module.exports={recoverFreePromotions};
