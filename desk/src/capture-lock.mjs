/* Trava do Conferir Xournal++ (B6): puro, sem DOM — o chat.mjs usa e o teste
   unitário exercita o contrato do clique duplo/mudança de matéria.

   Contrato:
   - `beginCaptureLock(state)` devolve uma trava NOVA ou `null` quando já há
     captura em voo (o segundo clique da dupla clicada é engolido);
   - `captureLockValid(state, lock)` só vale se a captura ainda é a mesma E a
     matéria/sessão de destino não mudou durante a captura (a imagem nunca
     pousa na conversa de outra matéria);
   - `endCaptureLock(state, lock)` solta a trava só se for a do dono. */

export function beginCaptureLock(state){
 if(state&&state.captureLock)return null;
 const lock={courseId:String(state&&state.currentCourseId||''),session:String(state&&state.currentSession||'')};
 if(state)state.captureLock=lock;
 return lock;
}

export function captureLockValid(state,lock){
 if(!state||!lock||state.captureLock!==lock)return false;
 return String(state.currentCourseId||'')===lock.courseId&&String(state.currentSession||'')===lock.session;
}

export function endCaptureLock(state,lock){
 if(state&&lock&&state.captureLock===lock)state.captureLock=null;
}
