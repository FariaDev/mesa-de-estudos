import test from 'node:test';
import assert from 'node:assert/strict';
import {createQueueRetry} from '../src/queue-retry.mjs';
function harness(){
 let id=0;const tasks=new Map(),delays=[],holds=[];let retries=0;
 const gate=createQueueRetry({retry:()=>{retries++;},hold:s=>holds.push(s),schedule:(fn,ms)=>{delays.push(ms);tasks.set(++id,fn);return id;},cancel:id=>tasks.delete(id)});
 return {gate,delays,holds,tasks,get retries(){return retries;},tick(){const [id,fn]=tasks.entries().next().value;tasks.delete(id);fn();}};
}
test('queue retries use 2/4/8 seconds then hold without losing the item',()=>{
 const h=harness();
 for(let i=0;i<3;i++){h.gate.fail(true);assert.equal(h.gate.pending,true);h.tick();}
 h.gate.fail(true);
 assert.deepEqual(h.delays,[2000,4000,8000]);assert.equal(h.retries,3);assert.equal(h.holds.length,1);assert.equal(h.gate.pending,false);
});
test('ambiguous delivery never retries and repeated failure events share one timer',()=>{
 const h=harness();h.gate.fail(false);assert.equal(h.tasks.size,0);assert.equal(h.holds.length,1);
 h.gate.fail(true);h.gate.fail(true);assert.equal(h.tasks.size,1);assert.deepEqual(h.delays,[2000]);
});
test('stop/session change cancels even an already-dispatched callback and resets budget',()=>{
 const h=harness();h.gate.fail(true);const stale=[...h.tasks.values()][0];h.gate.reset();
 h.gate.fail(true);stale();assert.equal(h.retries,0);assert.equal(h.gate.pending,true);
 assert.deepEqual(h.delays,[2000,2000]);h.tick();assert.equal(h.retries,1);
});
