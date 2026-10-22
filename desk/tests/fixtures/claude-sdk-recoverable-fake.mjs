// Native assistant error after a partial, before the result. The test releases
// the stream explicitly through a file in its isolated runtime; no real SDK/login.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {query as baseQuery,getSessionMessages} from './claude-sdk-fake.mjs';
export {getSessionMessages};
export function query(input){
 const native=baseQuery(input);
 const baseIterator=native[Symbol.asyncIterator].bind(native);
 native[Symbol.asyncIterator]=async function*(){
  let injected=false;
  for await(const frame of {[Symbol.asyncIterator]:baseIterator}){
   yield frame;
   if(!injected&&frame.type==='stream_event'&&frame.event?.type==='content_block_delta'){
    injected=true;
    yield {type:'assistant',session_id:frame.session_id,parent_tool_use_id:null,uuid:randomUUID(),error:'server_error',message:{id:'recoverable-error',role:'assistant',model:'claude-fake',content:[]}};
    const release=process.env.FAKE_CLAUDE_RECOVERY_RELEASE;
    const deadline=Date.now()+15000;
    while(release&&!fs.existsSync(release)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
   }
  }
 };
 return native;
}
