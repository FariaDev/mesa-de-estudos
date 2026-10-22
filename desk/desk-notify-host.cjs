// @ts-check
'use strict';
const {invalidRequest}=require('./src/error-detail.mjs');

/* Selo no ícone e notificação do sistema (#43 fase 2: saiu do main.cjs). A
   notificação só aparece com a janela fora de foco e nunca no modo de teste. */

/**
 * Cria o selo e as notificações da Mesa.
 * @param {{app: {setBadgeCount: (count: number) => boolean}, Notification: typeof import('electron').Notification,
 *   live: import('./main.cjs').DeskLive, TEST_MODE: boolean, platform?: string}} options
 * @returns {{setBadge:(value:unknown)=>void, showNotification:(body:string)=>boolean, register:(ipcMain:{handle:Function})=>void}}
 * @example const deskNotifier=createDeskNotifier({app,Notification,live,TEST_MODE});deskNotifier.register(ipcMain);
 */
function createDeskNotifier({app,Notification,live,TEST_MODE,platform=process.platform}){
 /* As notificações vivas ficam referenciadas até fechar: sem isso o GC some
    com elas antes do clique. */
 const liveNotifications=new Set();
 function setBadge(value){
  if(TEST_MODE)return;
  if(platform!=='darwin'&&platform!=='linux')return;
  try{app.setBadgeCount(Math.max(0,Math.min(99,Number(value)||0)));}catch{/* plataforma sem selo no ícone */}
 }
 function showNotification(body){
  if(TEST_MODE)return false;
  if(live.win&&!live.win.isDestroyed()&&live.win.isFocused())return false;
  if(typeof Notification.isSupported==='function'&&!Notification.isSupported())return false;
  try{
   const n=new Notification({title:'Mesa de Estudos',body,silent:true});
   liveNotifications.add(n);
   const drop=()=>liveNotifications.delete(n);
   n.on('failed',drop);n.on('close',drop);
   n.on('click',()=>{drop();const win=live.win;if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}});
   n.show();
   return true;
  }catch{return false;}
 }
 function register(ipcMain){
  ipcMain.handle('notify',(_e,payload)=>{
   if(typeof payload?.body!=='string')throw Error(invalidRequest('notify','body',payload?.body,'string(1..)'));
   const body=payload.body.replace(/\s+/g,' ').trim().slice(0,200);
   if(!body)throw Error(invalidRequest('notify','body',payload.body,'string(1..)'));
   if(TEST_MODE)return false;
   return showNotification(body);
  });
  ipcMain.handle('badge',(_e,value)=>{
   if(TEST_MODE)return;
   if(value!=null&&(typeof value!=='number'||!Number.isFinite(value)))throw Error(invalidRequest('badge','value',value,'number|null'));
   setBadge(value);
  });
 }
 return {setBadge,showNotification,register};
}

module.exports={createDeskNotifier};
