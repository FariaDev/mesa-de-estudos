// Pause only catalog initialization in an isolated runtime, before any prompt.
import fs from 'node:fs';
import {query as baseQuery,getSessionMessages} from './claude-sdk-fake.mjs';
export {getSessionMessages};
export function query(input){
 const native=baseQuery(input),close=native.close.bind(native);
 let closed=false;
 native.close=async()=>{closed=true;return close();};
 for(const name of ['supportedModels','initializationResult']){
  const method=native[name].bind(native);
  native[name]=async()=>{
   const gate=process.env.FAKE_CLAUDE_CONNECT_RELEASE,deadline=Date.now()+15000;
   while(gate&&!fs.existsSync(gate)&&!closed&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
   if(closed)throw Error('Consulta sintética encerrada.');
   if(gate&&!fs.existsSync(gate))throw Error('Catálogo sintético não liberado.');
   return method();
  };
 }
 return native;
}
