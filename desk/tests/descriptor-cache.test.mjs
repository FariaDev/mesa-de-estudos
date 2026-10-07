import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {DescriptorCache}=createRequire(import.meta.url)('../src/agents/descriptor-cache.cjs');
test('typing/health metadata omits images and does not reparse unchanged conversations',()=>{
 let reads=0,version=1;
 const cache=new DescriptorCache({read:file=>{reads++;return {id:file,preview:'hello',messages:[{image:'large'}]};},stat:()=>({size:100,mtimeMs:version,ctimeMs:version,ino:version})});
 assert.equal(cache.get('a').messages,undefined);
 for(let i=0;i<10;i++){cache.get('a');cache.get('b');}
 assert.equal(reads,2);
 assert.equal(cache.get('a',{messages:true}).messages.length,1);
 assert.equal(reads,3);cache.get('a',{messages:true});assert.equal(reads,3);
 version++;cache.get('a');assert.equal(reads,4);
 cache.get('a',{messages:true});assert.equal(reads,5);
});
