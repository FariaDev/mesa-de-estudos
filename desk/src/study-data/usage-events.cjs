'use strict';
const crypto=require('node:crypto');
function eventId(session,event){
 const message=event.message||{};
 const identity=message.id||message.uuid||event.messageId||event.uuid||
  JSON.stringify(message.timestamp!=null?{role:message.role,content:message.content,timestamp:message.timestamp}:message);
 return 'usage-'+crypto.createHash('sha256').update(session+'\n'+String(identity)).digest('hex');
}
/* Um quadro sem métricas não antecipa a contagem de uma resposta dividida.
   Só ao terminar o turno sabemos que o provedor deixou o uso indisponível. */
function createUsageEvents({session,engine,record}){
 const missing=new Map(),reported=new Set();
 return event=>{
  if(event.type==='message_end'&&event.message?.role==='assistant'){
   const usage=event.message.usage,id=eventId(session,event);
   const payload={id,engine:engine(),model:event.message.model};
   if(usage&&typeof usage==='object'){
    missing.delete(id);reported.add(id);if(reported.size>2000)reported.delete(reported.values().next().value);
    record({...payload,input:usage.input,output:usage.output,cache:usage.cacheRead==null&&usage.cacheWrite==null?null:Number(usage.cacheRead||0)+Number(usage.cacheWrite||0)});
   }else if(!reported.has(id))missing.set(id,payload);
  }
  if(['agent_end','agent_settled'].includes(event.type)){
   for(const payload of missing.values())record(payload);
   missing.clear();
  }
 };
}
module.exports={eventId,createUsageEvents};
