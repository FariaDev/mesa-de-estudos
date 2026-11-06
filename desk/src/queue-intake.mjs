import pendingCore from './generated/pending.core.js';
import {toNat} from './bend-nat.mjs';

/* Entrada da fila pelo composer (#43 fase 2: saiu de queue.mjs para caber no
   teto de linhas). ⏎/Enviar/⌘⏎ com o tutor ligado vai direto, como sempre;
   com o tutor desligado, ligando ou sem resposta, a mensagem é GUARDADA na
   fila (texto, referências e anexos do momento). A fila viva (`enqueue`) e a
   liberação (`release`) continuam em queue.mjs e entram por parâmetro; o
   envio, o estado medido e o `connect` também (dependência por parâmetro, como
   os `*-host.cjs`), para o teste falar com a entrada sem Electron. */

/**
 * Cria a entrada da fila pelo composer.
 * @param {{
 *   enqueue: (text: string) => void,
 *   release: () => void,
 *   isHeld: () => boolean,
 *   rehold: () => void,
 *   send: (text: string, images: undefined, options: {steer?: boolean}) => unknown,
 *   isComposerCommand: (text: string) => boolean,
 *   state: () => {attachments: unknown[], pdfAttachments: unknown[], connected: boolean, busy: boolean, switching: boolean},
 *   prompt: () => ({value: string, dispatchEvent: (event: Event) => void} | null),
 *   connect: () => Promise<unknown>,
 * }} deps
 * @returns {{enqueueFromComposer: () => boolean, submit: (value: unknown, options?: {release?: boolean, steer?: boolean}) => unknown}}
 * @example const {submit} = createQueueIntake({enqueue: (text) => {}, release: () => {}, ...});
 */
export function createQueueIntake({enqueue, release, isHeld, rehold, send, isComposerCommand, state, prompt, connect}) {
 function clearPrompt(el){
  el.value='';
  el.dispatchEvent(new Event('input'));
 }

 function enqueueFromComposer(){
  const el=prompt();
  if(!el)return false;
  const text=el.value.trim();
  const current=state();
  if(!text&&!current.attachments.length&&!current.pdfAttachments.length)return false;
  enqueue(text);
  clearPrompt(el);
  return true;
 }

 function submit(value,options={}){
  const text=String(value??'').trim();
  const current=state();
  const releases=options.release!==false;
  const wasHeld=releases&&isHeld();
  if(releases)release();
  const keep=pendingCore.keptWhileOff(!!current.connected,!!current.busy,isComposerCommand(text),text,toNat(current.attachments.length+current.pdfAttachments.length));
  if(!keep){
   const posted=send(value,undefined,options.steer===true?{steer:true}:{});
   if(!wasHeld)return posted;
   /* A fila solta ANTES do envio, como sempre: se o turno acabar antes do
      `send` resolver, o fim do turno já a vê livre e a esvazia. Envio incerto
      ou recusado devolve a fila ao estado segurado, senão ela ficaria com
      itens, `held=false` e sem "Enviar agora" na faixa (auditoria de máquinas
      de estado, fila #1). A regra mora em `core/pending.bend`. */
   return Promise.resolve(posted).then(accepted=>{
    if(pendingCore.reholdAfterSend(wasHeld,accepted===true))rehold();
    return accepted;
   });
  }
  enqueue(text);
  const el=prompt();
  if(el)clearPrompt(el);
  /* Troca de matéria/sessão em curso: ela mesma chama o tutor no fim. */
  if(!current.switching)connect().catch(()=>{});
  return true;
 }

 return {enqueueFromComposer,submit};
}
