// Synthetic provider stream + official local MCP transport; no inference.
import crypto from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {query as baseQuery} from './claude-sdk-fake.mjs';
export {getSessionMessages} from './claude-sdk-fake.mjs';
const spec={title:'Inclinação e movimento',objective:'Prever a posição em 2 s e comparar com o resultado.',alternativeMarkdown:'Em 2 s, s=2a. Para a=3, s=6 m.',
 html:'<h2>Qual a posição em 2 s?</h2><label>1. Sua previsão para a = 4 (m)<input id="guess" type="number"></label><label>2. a (m/s²)<input id="a" type="range" min="1" max="4" value="3"></label><p>Posição: <output id="s"></output></p><button id="check" class="primary">Conferir</button><p id="result" hidden></p>',css:'label{display:flex;margin-bottom:8px}',
 js:'const a=document.querySelector("#a"),s=document.querySelector("#s"),g=document.querySelector("#guess"),r=document.querySelector("#result");a.oninput=()=>{s.value=(2*Number(a.value))+" m";mesa.state({a:Number(a.value)});};a.oninput();document.querySelector("#check").onclick=()=>{const obs=2*Number(a.value);r.hidden=false;r.textContent="Previsto "+g.value+" m; observado "+obs+" m. Conclusão: s cresce linearmente com a.";mesa.attempt({previsao:g.value===""?null:Number(g.value),observado:obs,conclusao:"s cresce linearmente com a"});};mesa.ready();',katex:false};
export function query(args){
 const base=baseQuery(args),options=args.options;
 const frame=(type,data,session_id)=>({type,session_id,parent_tool_use_id:null,uuid:crypto.randomUUID(),...data});
 const out=(async function*(){
  for await(const original of base){
   if(original.type==='stream_event')continue;
   if(original.type!=='assistant'){yield original;continue;}
   const session=original.session_id,id='toolu_activity_local',messageId='msg_activity_local';
   const stream=event=>frame('stream_event',{event},session);
   yield stream({type:'message_start',message:{id:messageId,role:'assistant',content:[]}});
   yield stream({type:'content_block_start',index:0,content_block:{type:'text',text:''}});
   yield stream({type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Antes da atividade Claude.'}});
   yield stream({type:'content_block_stop',index:0});
   yield stream({type:'content_block_start',index:1,content_block:{type:'tool_use',id,name:'mcp__mesa__criar_atividade',input:spec}});
   yield stream({type:'content_block_stop',index:1});
   yield frame('assistant',{message:{id:messageId,role:'assistant',content:[{type:'text',text:'Antes da atividade Claude.'},{type:'tool_use',id,name:'mcp__mesa__criar_atividade',input:spec}]},user_message_uuid:original.user_message_uuid},session);
   const hook=await options.hooks.PreToolUse[0].hooks[0]({tool_name:'mcp__mesa__criar_atividade',tool_use_id:id,tool_input:spec});
   if(hook.hookSpecificOutput?.permissionDecision!=='allow')throw Error(hook.hookSpecificOutput?.permissionDecisionReason||'Hook negado.');
   const [a,b]=InMemoryTransport.createLinkedPair(),client=new Client({name:'synthetic-native-activity',version:'1'});
   await options.mcpServers.mesa.instance.connect(b);await client.connect(a);
   let result;
   try{
    /* #42: antes de mostrar, a prévia — liberada pelo hook e pelo allowedTools, real na Mesa. */
    if(process.env.FAKE_CLAUDE_PREVIEW_OUT){
     const previewHook=await options.hooks.PreToolUse[0].hooks[0]({tool_name:'mcp__mesa__previsualizar_atividade',tool_use_id:'toolu_preview_local',tool_input:{html:spec.html,css:spec.css,js:spec.js+'console.error("erro de propósito");',theme:'escuro',width:400}});
     const allowed=previewHook.continue===true&&previewHook.hookSpecificOutput?.permissionDecision!=='deny'&&(options.allowedTools||[]).includes('mcp__mesa__previsualizar_atividade');
     const preview=allowed?await client.callTool({name:'previsualizar_atividade',arguments:{html:spec.html,css:spec.css,js:spec.js+'console.error("erro de propósito");',theme:'escuro',width:400}}):{denied:true};
     (await import('node:fs')).writeFileSync(process.env.FAKE_CLAUDE_PREVIEW_OUT,JSON.stringify(preview));
    }
    result=await client.callTool({name:'criar_atividade',arguments:hook.hookSpecificOutput.updatedInput});
   }finally{await client.close();}
   yield frame('user',{message:{role:'user',content:[{type:'tool_result',tool_use_id:id,is_error:result.isError===true,content:result.content}]}},session);
   yield stream({type:'content_block_start',index:2,content_block:{type:'text',text:''}});
   yield stream({type:'content_block_delta',index:2,delta:{type:'text_delta',text:'Depois da atividade Claude.'}});
   yield stream({type:'content_block_stop',index:2});
   yield frame('assistant',{message:{id:messageId,role:'assistant',content:[{type:'text',text:'Depois da atividade Claude.'}]},user_message_uuid:original.user_message_uuid},session);
  }
 })();
 for(const name of ['initializationResult','supportedModels','supportedCommands','getSessionMessages','setPermissionMode','setModel','applyFlagSettings','interrupt','close','stop'])if(typeof base[name]==='function')out[name]=(...values)=>base[name](...values);
 return out;
}
