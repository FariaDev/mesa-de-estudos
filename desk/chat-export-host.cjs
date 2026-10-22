// @ts-check
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const conversations=require('./src/agents/conversations.cjs');
const {exportConversationMarkdown}=require('./src/agents/history.cjs');
const {readNativeHistory}=require('./src/agents/native-history.cjs');
const {message}=require('./src/i18n.mjs');

/* Exportação da conversa ativa para Markdown (#43 fase 2: saiu do main.cjs).
   Pi lê o JSONL da sessão; Claude lê o registro da conversa e, quando há
   sessão nativa, o histórico do SDK. Vai para o cofre (`vaultPath`) ou para
   `runtime/exported`; fora do runtime de teste, pergunta onde salvar. */

/**
 * Registra o handler `export-chat`.
 * Recebe o `ipcMain`, o `live` do main, o runtime (e o de teste, que salva sem diálogo),
 * o diálogo e o shell do Electron e as funções do host do tutor.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, live: import('./main.cjs').DeskLive, runtime: string, envRuntime?: string, dialog: import('./types/host-deps').Dialog,
 *   shell: typeof import('electron').shell, appendLog: import('./types/host-deps').AppendLog, engine: import('./types/main-hosts').TutorEngineHost['engine'],
 *   testClaudeSdkLoader: import('./types/main-hosts').TutorEngineHost['testClaudeSdkLoader']}} options
 * @returns {void}
 * @example registerChatExportHost({ipcMain,live,runtime,envRuntime,dialog,shell,appendLog,engine,testClaudeSdkLoader});
 */
function registerChatExportHost({ipcMain,live,runtime,envRuntime,dialog,shell,appendLog,engine,testClaudeSdkLoader}){
 /* Rótulos do arquivo exportado no idioma da interface (#41). */
 const exportLabels=()=>({
  you:live.languageHost.t('export.you'),
  imageAttached:live.languageHost.t('export.imageAttached'),
  exportedOn:(iso)=>live.languageHost.t('export.exportedOn',{date:iso}),
 });
 ipcMain.handle('export-chat',async()=>{ const courseName=live.courses.find(c=>c.id===live.courseId)?.name||live.courseId||live.languageHost.t('export.fallbackCourse');
  let records=[];
  try{
   records=fs.readFileSync(live.session,'utf8').split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);
  }catch(error){appendLog('desk',`exportação: histórico da sessão ilegível: ${error.message}`);}
  const labels=exportLabels();
  const parts=[];
  for(const record of records){
   const m=record?.message;
   if(!m||!['user','assistant'].includes(m.role))continue;
   let text='';
   for(const part of Array.isArray(m.content)?m.content:[]){
    if(part?.type==='text')text+=(text?'\n':'')+String(part.text||'');
    else if(part?.type==='image')text+=(text?'\n':'')+labels.imageAttached;
   }
   if(!text.trim())continue;
   parts.push(`## ${m.role==='user'?labels.you:'Pi'}\n\n${text.trim()}`);
  }
  let body=`# Mesa de Estudos — ${courseName}\n\n${labels.exportedOn(new Date().toISOString())}\n\n`+(parts.length?parts.join('\n\n')+'\n':'');
  const kind=engine();
  if(conversations.NATIVE_ENGINES.includes(kind)){
   const record=live.bridge?conversations.readClaudeConversation(live.session,{runtime}):conversations.recoverClaudeConversation(live.session,{runtime});
   if(!record)throw Error(message(kind==='claude'?'err.claude.recordMissingShort':'err.opencode.recordMissing'));
   let messages=record.messages||[];
   /* OpenCode (#57): o descritor já guarda as mensagens que o serviço viu. */
   if(kind==='claude'&&record.nativeEstablished){
    const dir=path.join(runtime,'claude-workspaces',record.id);
    const native=await readNativeHistory({sessionId:record.nativeSessionId,dir,sdkLoader:testClaudeSdkLoader()||(()=>import('@anthropic-ai/claude-agent-sdk'))});
    if(native.length)messages=native;
   }
   body=exportConversationMarkdown({courseName,engine:kind,messages,labels});
  }
  const safe=courseName.replace(/[\\/:*?"<>|]+/g,'-').replace(/^[\s.]+|[\s.]+$/g,'').trim()||live.languageHost.t('export.fallbackName');
  const now=new Date(),pad=n=>String(n).padStart(2,'0');
  const name=`Mesa — ${safe} — ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.md`;
  const dir=live.config.vaultPath&&fs.existsSync(live.config.vaultPath)?path.join(live.config.vaultPath,'Mesa de Estudos'):path.join(runtime,'exported');
  fs.mkdirSync(dir,{recursive:true});
  const target=path.join(dir,name);
  if(envRuntime){
   fs.writeFileSync(target,body);
   return {saved:true,file:target};
  }
  const r=await dialog.showSaveDialog(live.win,{defaultPath:target});
  if(r.canceled||!r.filePath)return {saved:false};
  fs.writeFileSync(r.filePath,body);
  shell.showItemInFolder(r.filePath);
  return {saved:true,file:r.filePath};
 });
}

module.exports={registerChatExportHost};
