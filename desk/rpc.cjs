const {spawn}=require('node:child_process');
const {EventEmitter}=require('node:events');
const {spawnEnv,missingPiMessage}=require('./pi.cjs');
const {message}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');
const {createTurnIdentity}=require('./src/turn-identity.cjs');
const rpcstate=require('./src/generated/rpcstate.core.js').default;
const {toNat}=require('./src/bend-nat.mjs');

/* Split nativo das linhas do stdout do Pi (mesma semântica de
   `core/framing.bend`, a spec com leis; paridade em tests/framing-parity.mjs):
   overflow ⇒ descarta tudo; cada '\n' fecha uma linha; o último fragmento é o
   resto. O caminho quente é nativo (o buffer do Pi tem MBs); a spec do núcleo
   também virou tail-safe — `split`/`length` em accumulator, ver a issue
   bendlang/bend#798 (aron-intframe) — mas o host segue nativo por custo. */
function frameSplit(joined){
 if(joined.length>33554432)return {lines:[],rest:'',overflow:true};
 const parts=String(joined).split('\n');
 const rest=parts.pop()??'';
 return {lines:parts,rest,overflow:false};
}

const {PI_DESK_PROMPT:DESK_PROMPT}=require('./src/agents/desk-prompts.cjs');

/* Erro que PROVA que o pedido não chegou a ser entregue ao stdin do Pi.
   O contrato com `send.cjs` é este campo: com `notSent`, a falha é recusa (nada
   foi escrito, o bilhete volta na próxima abertura); sem ele, o pedido pode ter
   sido transmitido e a falha é dúvida. Só marque onde a escrita não aconteceu —
   timeout, processo morto no meio e stdin quebrado depois da escrita ficam sem
   a marca de propósito. */
function notSent(message){
 const err=Error(message);
 err.notSent=true;
 return err;
}

class PiBridge extends EventEmitter {
 /**
  * @param {{cwd?: string, session?: string, pi?: string, extraArgs?: string[], env?: NodeJS.ProcessEnv, promptFile?: string}} [options]
  */
 constructor({cwd,session,pi='',extraArgs=[],env,promptFile=''}={}){
  super();
  Object.assign(this,{cwd,session,pi,extraArgs,env,promptFile});
  this.pending=new Map();this.seq=0;this.stopped=false;this.runActive=false;this.settledEpoch=0;
  /* Identidade de execução (N1): o RPC do Pi não manda `runId`; a ponte deriva
     a corrida dos cercamentos (`agent_start`/`agent_settled`) e aposenta os
     ids conhecidos no fechamento — ver `src/turn-identity.cjs`. */
  this.identity=createTurnIdentity();
 }
 /* Há processo do tutor vivo? Quem só quer saber se há turno em andamento usa
    isto antes de `request`: pedir a uma ponte caída religaria o Pi à toa (#27). */
 isAlive(){return !!this.child;}
 isRunning(state={}){return rpcstate.runBusy(this.runActive,!!state?.isStreaming,!!state?.isCompacting,Number(state?.pendingMessageCount)>0);}
 facts(){return [!!this.child,this.stopped,toNat(this.pending.size),toNat(this.seq)];}
 apply(out,ctx={}){
  this.seq=Number(out.seq);
  switch(out.act.$){
   case 'ActKill':this.breakConnection(ctx.err);return;
   case 'ActExit':this.child=null;this.fail(ctx.err);return;
   case 'ActStop':{this.stopped=true;const child=this.child;this.child=null;if(child){child.removeAllListeners('exit');try{child.kill();}catch{}}this.fail(Error('stopped'));return;}
   case 'ActResolve':case 'ActRefuse':{const p=this.pending.get(ctx.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(ctx.id);
   if(out.act.$==='ActResolve'&&['prompt','steer','follow_up'].includes(p.type)){
    this.runActive=rpcstate.runAfterAcceptance(this.runActive,ctx.data?.disposition==='started',p.settledEpoch===this.settledEpoch);
   }
   out.act.$==='ActResolve'?p.resolve(ctx.data):p.reject(ctx.replyRejected&&['prompt','steer','follow_up'].includes(p.type)?notSent(ctx.error||message('err.rpc.refusedBeforeAccept')):Error(ctx.error||message('err.rpc.refused')));return;}
   default:return;
  }
 }
 start(){
  const out=rpcstate.onStart(!!this.child,!!this.pi,this.stopped,toNat(this.pending.size),toNat(this.seq));
  this.seq=Number(out.seq);
  if(out.act.$==='ActNone')return;
  this.stopped=false;
  if(out.act.$==='ActFail'){
   this.fail(Error(missingPiMessage()));
   return;
  }
  const env=this.env||spawnEnv(this.pi);
  const winShell=process.platform==='win32'&&/\.(cmd|bat)$/i.test(this.pi);
  const child=spawn(this.pi,['--mode','rpc','--session',this.session,'--approve','--append-system-prompt',this.promptFile||DESK_PROMPT,...this.extraArgs],{cwd:this.cwd,env,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:winShell});
  this.child=child;
  /* Processo NOVO neste mesmo bridge (start/reconexão depois de queda): o
     ledger do processo anterior morre com ele e a corrida aberta se encerra.
     O contador `host-run-N` continua monotônico — sem isto, um id de
     ferramenta reusado pelo provedor no processo novo sairia `stale` por uma
     corrida que já não existe. Ver `src/turn-identity.cjs#reset`. */
  this.identity.reset();
  let buffer='';this.child.stdout.setEncoding('utf8');this.child.stdout.on('data',chunk=>{const joined=buffer+chunk;const frame=frameSplit(joined);if(frame.overflow){buffer='';this.breakConnection(Error(message('err.rpc.overflow')));return;}buffer=frame.rest;for(const raw of frame.lines){if(!raw.trim())continue;let e;try{e=JSON.parse(raw);}catch{
   /* Linha torta não é erro fatal: o núcleo (`onGarbage`) manda a ponte seguir
      como está, então o host só avisa. Com `desk_error` a UI cairia para
      "offline" e destravaria o composer no meio de um turno que está vivo. */
   this.apply(rpcstate.onGarbage(!!this.child,this.stopped,toNat(this.pending.size),toNat(this.seq)));
   this.emit('event',{type:'desk_warn',message:message('err.rpc.badReply')});
   continue;
  }
   if(this.child!==child)return;
   this.runActive=rpcstate.runAfterEvent(this.runActive,['agent_start','auto_retry_start'].includes(e.type),e.type==='agent_settled');
   if(e.type==='agent_settled')this.settledEpoch++;
   if(e.type==='response'){const out=rpcstate.onReply(this.pending.has(e.id),...this.facts(),!!e.success);this.apply(out,{id:e.id,data:e.data,error:e.error,replyRejected:e.success===false});}
   /* Identidade da corrida decidida ANTES do emit: atraso sem corrida aberta
      não é reencaminhado, e evento com id aposentado sai marcado `stale`. */
   const framed=this.identity.arrive(e);
   if(framed)this.emit('event',framed);
  }});
  child.stderr.on('data',chunk=>{const text=String(chunk??'').trim();if(text){const line=text.slice(0,400);console.error('[pi stderr]',line);this.emit('stderr',line);}});
  child.stdin.on('error',e=>{this.apply(rpcstate.onError(this.child===child,...this.facts()),{err:e});});
  child.on('error',e=>{this.apply(rpcstate.onError(this.child===child,...this.facts()),{err:e});});child.on('exit',(code,signal)=>{if(this.child!==child)return;this.apply(rpcstate.onExit(true,...this.facts()),{err:Error(message('tutor.error.stopped',{code:signal||code}))});});
 }
 breakConnection(e){const child=this.child;this.child=null;if(child){child.removeAllListeners('exit');try{child.kill();}catch{}}this.fail(e);}
 fail(e){
  this.runActive=false;this.settledEpoch++;
  const err=Error(missingPiMessage(e));
  err.code=e?.code;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(err);}
  this.pending.clear();
  if(!this.stopped)this.emit('event',{type:'desk_error',message:err.message});
 }
 request(type,args={},timeoutMs=60000){
  this.start();
  const out=rpcstate.onRequest(...this.facts());
  this.seq=Number(out.seq);
  if(out.act.$==='ActReject')return Promise.reject(notSent(missingPiMessage()));
  const id=`desk-${this.seq}`;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{
    /* Recusa só este pedido e mantém a ponte viva: um turno longo pode segurar
       a resposta, e um Pi morto é detectado pelo health. */
    this.apply(rpcstate.onTimeout(this.pending.has(id),...this.facts()),{id,error:message('err.rpc.timeout')});
   },timeoutMs);
   this.pending.set(id,{resolve,reject,timer,type,settledEpoch:this.settledEpoch});
   try{this.child.stdin.write(JSON.stringify({id,type,...args})+'\n');}
   catch(e){
    /* A escrita em si falhou: este pedido não foi transmitido. O erro marcado
       vence porque a promessa é rejeitada antes de o `apply` (que fala do
       processo, não deste pedido) rejeitar de novo. */
    const entry=this.pending.get(id);
    if(entry)entry.reject(notSent(message('err.rpc.writeFail',{reason:e?.code?String(e.code):causeArg(e)||'—'})));
    this.apply(rpcstate.onError(true,...this.facts()),{err:e});
   }
  });
 }
 respond(data){
  if(rpcstate.onRespond(...this.facts()).act.$!=='ActWrite')return;
  const payload={id:data?.id,type:'extension_ui_response'};
  if(typeof data?.value==='string')payload.value=data.value;
  if(data?.confirmed===true)payload.confirmed=true;
  if(data?.cancelled===true)payload.cancelled=true;
  this.child.stdin.write(JSON.stringify(payload)+'\n');
 }
 /* `onStop` recebe três fatos (vivo, pendentes, seq), não os quatro de
    `facts()`: com o BigInt do bend 2.0.27 o booleano `stopped` entrava calado
    como `pending` e o tamanho da fila virava o `seq`, que voltava a 0 e podia
    repetir id depois de religar. O `nat_in` do 2.0.37 recusou (#49). */
 stop(){this.apply(rpcstate.onStop(!!this.child,toNat(this.pending.size),toNat(this.seq)));}
}
module.exports={PiBridge,DESK_PROMPT,frameSplit,notSent};
