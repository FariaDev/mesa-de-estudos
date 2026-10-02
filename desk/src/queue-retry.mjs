import core from './generated/pending.core.js';

// One retry budget per queued item. Only a proven non-delivery may repeat.
export function createQueueRetry({retry,hold,waiting=()=>{},schedule=setTimeout,cancel=clearTimeout}){
 let failures=0,timer=null,generation=0;
 function reset(){generation++;if(timer!==null)cancel(timer);timer=null;failures=0;}
 return {
  get pending(){return timer!==null;},
  reset,
  fail(safe){
   if(timer!==null)return;
   if(!core.retryAllowed(!!safe,failures<Number(core.maxAutoRetries()))){
    reset();hold(safe?'As tentativas acabaram — a fila ficou guardada.':'O envio não foi confirmado — confira a conversa antes de reenviar a fila.');
    return;
   }
   const count=++failures,delay=Number(core.retryDelay(BigInt(count))),mine=generation;
   timer=schedule(()=>{if(mine!==generation)return;timer=null;retry();},delay);
   waiting(count,delay);
  }
 };
}
