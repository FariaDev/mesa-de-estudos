import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { fileURLToPath } from 'node:url';
import { capture, contextText, isCheckRequest, listWindows } from './core.ts';
export default function visualCheck(pi:ExtensionAPI, deps = { capture, listWindows }) {
 const helper=fileURLToPath(new URL('./windows',import.meta.url));
 let target:number|undefined;
 let busy=false;
 pi.on('session_start',()=>{target=undefined;});
 async function take(request:string,ctx:any) {
  if(busy) throw new Error('Já há uma captura em andamento. Aguarde e peça novamente.');
  busy=true;
  try {
   const shot=await deps.capture(helper,target);
   ctx.ui.notify(`Capturado: ${shot.window.app} — ${shot.window.title}`,'info');
   return {text:contextText(request,shot),image:shot.image};
  } finally {busy=false;}
 }
 pi.registerCommand('visual-janelas',{
  description:'Lista janelas disponíveis do Xournal++ sem capturar imagens',
  handler:async(_args,ctx)=>{try {
   const windows=(await deps.listWindows(helper)).filter(w=>/^xournal(?:\+\+|pp)?$/i.test(w.app));
   ctx.ui.notify(windows.map(w=>`${w.id}: ${w.title}`).join('\n') || 'Nenhuma janela do Xournal++ disponível.','info');
  } catch(e) {ctx.ui.notify((e as Error).message,'error');}}
 });
 pi.registerCommand('visual-alvo',{
  description:'Escolhe janela do Xournal++: /visual-alvo ID; auto restaura seleção automática',
  handler:async(args,ctx)=>{
   if(args.trim()==='auto'){target=undefined;ctx.ui.notify('Seleção automática do Xournal++.','info');return;}
   if(!/^\d+$/.test(args.trim())) {ctx.ui.notify('Use /visual-alvo ID ou /visual-alvo auto.','error');return;}
   const id=Number(args.trim());
   try {
    const windows=await deps.listWindows(helper);
    if(!windows.some(w=>w.id===id && /^xournal(?:\+\+|pp)?$/i.test(w.app))) throw new Error('Escolha um ID do Xournal++ listado por /visual-janelas.');
    target=id;ctx.ui.notify(`Janela ${id} selecionada para esta sessão.`,'info');
   }catch(e){ctx.ui.notify((e as Error).message,'error');}
  }
 });
 pi.registerCommand('conferir',{
  description:'Captura a resolução visível no Xournal++ e pede uma conferência; aceita pergunta adicional',
  handler:async(args,ctx)=>{try {
   const result=await take(args.trim() || 'Confira minha resolução.',ctx);
   pi.sendUserMessage([{type:'text',text:result.text},result.image],{deliverAs:'followUp'});
  }catch(e){ctx.ui.notify((e as Error).message,'error');}}
 });
 pi.on('input',async(event,ctx)=>{
  if(event.source==='extension' || event.images?.length || !isCheckRequest(event.text)) return {action:'continue'};
  try {
   const result=await take(event.text,ctx);
   return {action:'transform',text:result.text,images:[result.image]};
  }catch(e){ctx.ui.notify((e as Error).message,'error');return {action:'handled'};}
 });
}
