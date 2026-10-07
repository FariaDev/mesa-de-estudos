import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {ClaudeService,metadata,rendererEvent}=createRequire(import.meta.url)('../src/agents/service.cjs');

test('persisted uncertainty locks controls before initialization and before native mutation',async()=>{
 let mutations=0,initializations=0;
 const adapter=new EventEmitter();
 adapter.snapshot=()=>({busy:false});adapter.connect=async()=>{};
 adapter.initializeControls=async()=>{initializations++;};adapter.setControls=async()=>{mutations++;};
 const service=new ClaudeService({adapter,uncertain:true});
 await assert.rejects(()=>service.request('initialize_controls'),/Aguarde/);
 await assert.rejects(()=>service.request('set_controls',{selection:{model:'synthetic',effort:'max'}}),/Aguarde/);
 await assert.rejects(()=>service.request('prompt',{message:'never resend'}),/incerta/);
 assert.equal(mutations,0);assert.equal(initializations,0);
});

test('native recoverable errors and retry metadata survive the renderer boundary',()=>{
 const detail={attempt:2,maxRetries:4,errorStatus:529};
 const retry=rendererEvent({type:'warning',code:'CLAUDE_OVERLOADED',message:'retry',detail});
 assert.deepEqual(retry.detail,detail);
 const error=rendererEvent({type:'error',code:'CLAUDE_CONTEXT_LIMIT',message:'context',fatal:false,detail:{terminalReason:'prompt_too_long'}});
 assert.equal(error.fatal,false);assert.equal(error.detail.terminalReason,'prompt_too_long');
 assert.equal(Object.hasOwn(rendererEvent({type:'error',message:'fatal by default'}),'fatal'),false);
});
class Fake extends EventEmitter {
 busy=false;
 snapshot(){return {busy:this.busy,model:{id:'claude',input:['text','image']}};}
 async connect(){}
 async history(){return [];}
 async send(input){this.last=input;this.busy=true;return {id:input.id,accepted:true};}
 async cancel(){this.cancelled=true;}
 respond(input){this.response=input;}
 stop(){this.stopped=true;}
}
test('Claude health does not open a native query; explicit connect and prompts initialize controls',async()=>{
 const adapter=new Fake();let initialized=0;
 adapter.initializeControls=async()=>{initialized++;};
 const svc=new ClaudeService({adapter});
 await svc.request('get_state');await svc.request('get_controls');await svc.request('get_available_models');
 assert.equal(initialized,0,'health and metadata do not start controls');
 await svc.request('initialize_controls');assert.equal(initialized,1);
 adapter.send=async input=>{assert.equal(initialized,2,'restored selection is ready before a prompt can be offered');return {id:input.id,accepted:true};};
 await svc.request('prompt',{message:'first'});
});
test('catalog controls are dynamic and changing settings blocks concurrent sending until persistence',async()=>{
 const adapter=new Fake();const selection={model:'sonnet',effort:'high'};
 adapter.controlsSnapshot=()=>({modelSelection:true,effort:true,selection,models:[{provider:'anthropic',id:'sonnet',name:'Sonnet'}],levels:['high']});
 let release,saved;
 adapter.setControls=async(next,{persistSelection})=>{await new Promise(r=>release=r);persistSelection(next);return next;};
 const svc=new ClaudeService({adapter,onSelection:patch=>saved=patch});
 const models=await svc.request('get_available_models');
 assert.equal(models.models[0].id,'','the native default remains a selectable choice');
 assert.equal(metadata('claude',adapter.controlsSnapshot()).caps.effort,true);
 const pending=svc.request('set_controls',{selection});
 await new Promise(r=>setImmediate(r));
 assert.equal(svc.isRunning(),true);
 await assert.rejects(svc.request('prompt',{message:'concurrent'}),e=>e.notSent===true);
 await assert.rejects(svc.request('set_controls',{selection}),/Aguarde/);
 release();await pending;assert.deepEqual(saved,selection);
 assert.equal(svc.isRunning(),false);assert.equal(adapter.last,undefined);
 svc.uncertain=true;
 await assert.rejects(svc.request('set_controls',{selection}),/Aguarde/);
});
test('Claude service keeps its transport, conversation and capabilities separate',async()=>{
 const adapter=new Fake(),svc=new ClaudeService({adapter});const seen=[];svc.on('event',e=>seen.push(e));
 assert.equal(metadata('claude').caps.steer,false);assert.equal(metadata('pi').caps.steer,true);
 adapter.emit('event',{type:'turn_end',conversationId:'own',runId:'run',isError:true});
 assert.deepEqual(seen,[{type:'agent_settled',conversationId:'own',runId:'run',isError:true,cancelled:false,uncertain:false}]);
 await assert.rejects(svc.request('prompt',{message:'hi',streamingBehavior:'steer'}),e=>e.notSent===true);
 assert.equal(adapter.last,undefined);
 await svc.request('prompt',{message:'image',images:[{type:'image',data:'YWJj',mimeType:'image/png'}]});
 assert.equal(adapter.last.images.length,1);assert.equal(adapter.last.text,'image');
 assert.equal((await svc.request('get_state')).isStreaming,true);
 await svc.request('abort');assert.equal(adapter.cancelled,true);assert.equal(adapter.busy,true);
 assert.deepEqual(await svc.request('get_available_models'),{models:[]});
 svc.stop();assert.equal(adapter.stopped,true);
});
test('permission revocation and errors translate without losing request identity',()=>{
 assert.equal(rendererEvent({type:'permission_cancelled',id:'p',conversationId:'own'}).id,'p');
 assert.equal(rendererEvent({type:'permission_request',id:'p',method:'confirm'}).permission,true);
 assert.equal(rendererEvent({type:'delivery',id:'d'}),null);
 const limit={status:'rejected',blocked:true,resetAt:'2026-10-05T12:00:00Z'};
 assert.deepEqual(rendererEvent({type:'warning',conversationId:'own',runId:'r',code:'CLAUDE_RATE_LIMITED',message:'waiting',rateLimit:limit}),{conversationId:'own',runId:'r',type:'desk_warn',message:'waiting',code:'CLAUDE_RATE_LIMITED',rateLimit:limit});
 const question={id:'q',method:'question',questions:[{question:'Choose',multiSelect:false,options:[]}]};
 const event=rendererEvent({type:'permission_request',...question});
 assert.equal(event.method,'question');assert.deepEqual(event.questions,question.questions);
});
test('simultaneous IPC sends cannot replace the first message before its receipt',async()=>{
 const adapter=new Fake();let release;const policies=[];
 adapter.setToolPolicy=policy=>policies.push(policy);
 adapter.send=async input=>{adapter.last=input;await new Promise(r=>release=r);adapter.emit('event',{type:'delivery',id:input.id,status:'accepted'});adapter.emit('event',{type:'message_end',message:{role:'assistant',content:[{type:'text',text:'answer'}]}});return {id:input.id,accepted:true};};
 const svc=new ClaudeService({adapter});
 const first=svc.request('prompt',{message:'first',toolPolicy:{readPaths:['first.pdf']}});
 assert.equal(svc.isRunning(),true,'pending connect/send is already busy for session switching');
 await assert.rejects(svc.request('prompt',{message:'second',toolPolicy:{readPaths:['second.pdf']}}),e=>e.notSent===true);
 await new Promise(r=>setImmediate(r));release();await first;
 assert.deepEqual(svc.messages.map(m=>m.content[0].text),['first','answer']);
 assert.deepEqual(policies,[{readPaths:['first.pdf']}],'a rejected competing send cannot mutate paths');
});
test('in-memory uncertainty keeps sending blocked even if the disk callback failed',async()=>{
 const adapter=new Fake(),svc=new ClaudeService({adapter});
 adapter.emit('event',{type:'delivery',id:'original',status:'uncertain'});
 adapter.emit('event',{type:'turn_end',uncertain:true});
 await assert.rejects(svc.request('prompt',{message:'another'}),/incerta/);
 assert.equal(adapter.last,undefined);
});
test('an incomplete native prefix cannot replace the recent cached conversation',async()=>{
 const adapter=new Fake();adapter.historyComplete=false;
 adapter.history=async()=>Array.from({length:200},()=>({role:'assistant',content:[{type:'text',text:'old'}]}));
 const recent=[{role:'assistant',content:[{type:'text',text:'recent'}]}];
 const svc=new ClaudeService({adapter,messages:recent});
 assert.deepEqual((await svc.request('get_messages')).messages,recent);
});
test('display cache retains recent messages within the persistence row limit',()=>{
 const adapter=new Fake();let saved;
 const messages=Array.from({length:5001},(_,index)=>({role:'assistant',content:[{type:'text',text:String(index)}]}));
 const svc=new ClaudeService({adapter,messages,onMessages:list=>{saved=list;}});
 adapter.emit('event',{type:'message_end',message:{role:'assistant',content:[{type:'text',text:'latest'}]}});
 assert.equal(svc.messages.length,5000);
 assert.equal(svc.messages[0].content[0].text,'2');
 assert.equal(saved.at(-1).content[0].text,'latest');
});
