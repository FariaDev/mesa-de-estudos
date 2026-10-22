import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {canTerminateActivityProcess,canTerminateSharedStalledProcess,collectActivityFrames}=createRequire(import.meta.url)('../activity-runtime.cjs');
const detached={entry:{pid:111,creationTime:4000},mainPid:222,metric:{pid:111,creationTime:4000,type:'Tab'},livePids:[222,333]};
test('only a detached, currently owned renderer can be terminated',()=>{
 assert.equal(canTerminateActivityProcess(detached),true);
 for(const override of [
  {mainPid:0},{mainPid:111},{livePids:[111,222]},{livePids:null},{metric:null},
  {metric:{pid:111,creationTime:5000,type:'Tab'}}, // OS PID reused
  {metric:{pid:111,creationTime:4000,type:'Browser'}},
  {metric:{pid:111,creationTime:4000,type:'Utility'}},
  {entry:{pid:7,creationTime:0}}, // Chromium's internal process ID is not an OS identity
  {entry:{pid:0,creationTime:4000}},
 ])assert.equal(canTerminateActivityProcess({...detached,...override}),false,JSON.stringify(override));
});
test('shared process only terminates when every other live frame is a confirmed stalled activity',()=>{
 const args={entry:{pid:111,creationTime:4000},mainPid:222,metric:{pid:111,creationTime:4000,type:'Tab'}};
 assert.equal(canTerminateSharedStalledProcess({...args,others:[{stalled:true},{stalled:true}]}),true);
 assert.equal(canTerminateSharedStalledProcess({...args,others:[{stalled:true},{stalled:false}]}),false,'saudável impede o kill');
 assert.equal(canTerminateSharedStalledProcess({...args,others:[{stalled:true},{}]}),false,'desconhecido impede o kill');
 assert.equal(canTerminateSharedStalledProcess({...args,others:[]}),false,'sem outros frames vale o caminho destacado, não este');
 assert.equal(canTerminateSharedStalledProcess({...args,mainPid:111,others:[{stalled:true}]}),false,'nunca o processo principal');
 assert.equal(canTerminateSharedStalledProcess({...args,metric:{pid:111,creationTime:5000,type:'Tab'},others:[{stalled:true}]}),false,'creationTime reusado nega');
});

test('collectActivityFrames: enumeração completa devolve os frames do pid',()=>{
 const a={osProcessId:111},b={osProcessId:222},c={osProcessId:111};
 const contents=(frames)=>({isDestroyed:()=>false,mainFrame:{framesInSubtree:frames}});
 const result=collectActivityFrames(111,()=>[contents([a,b]),contents([c])]);
 assert.equal(result.complete,true);
 assert.deepEqual(result.frames,[a,c]);
 /* webContents destruído é pulado sem tornar a enumeração incompleta */
 const skipped=collectActivityFrames(111,()=>[{isDestroyed:()=>true,mainFrame:null},contents([a])]);
 assert.equal(skipped.complete,true);
 assert.deepEqual(skipped.frames,[a]);
 /* frame de outro pid conhecido não nega */
 const other=collectActivityFrames(111,()=>[contents([b])]);
 assert.equal(other.complete,true);
 assert.deepEqual(other.frames,[]);
});

test('collectActivityFrames: qualquer exceção de enumeração é completa=false (nunca lista vazia)',()=>{
 const frame={osProcessId:111};
 assert.equal(collectActivityFrames(111,()=>{throw new Error('getAllWebContents');}).complete,false,'getAllWebContents lançando');
 assert.equal(collectActivityFrames(111,()=>null).complete,false,'sem lista');
 assert.equal(collectActivityFrames(111,()=>[{isDestroyed:()=>{throw new Error('gone');},mainFrame:{framesInSubtree:[frame]}}]).complete,false,'isDestroyed lançando');
 assert.equal(collectActivityFrames(111,()=>[{isDestroyed:()=>false,mainFrame:null}]).complete,false,'mainFrame nulo');
 assert.equal(collectActivityFrames(111,()=>[{isDestroyed:()=>false,mainFrame:{get framesInSubtree(){throw new Error('Render frame was disposed');}}}]).complete,false,'framesInSubtree lançando');
 const disposed=collectActivityFrames(111,()=>[{isDestroyed:()=>false,mainFrame:{framesInSubtree:[frame]}},{isDestroyed:()=>false,mainFrame:{get framesInSubtree(){throw new Error('Render frame was disposed');}}}]);
 assert.equal(disposed.complete,false,'uma árvore ilegível basta para negar');
 assert.deepEqual(disposed.frames,[frame],'frames já lidos podem voltar, mas complete=false barra o kill');
});

test('collectActivityFrames: PID de frame desconhecido (throw/0/negativo/não numérico) nega',()=>{
 const contents=(frames)=>({isDestroyed:()=>false,mainFrame:{framesInSubtree:frames}});
 const bad={get osProcessId(){throw new Error('unknown');}};
 const unknowns=[[bad,'getter lança'],[{osProcessId:0},'pid 0'],[{osProcessId:-1},'pid negativo'],[{osProcessId:'x'},'pid não numérico'],[{osProcessId:undefined},'pid ausente']];
 for(const [unknown,label] of unknowns)
  assert.equal(collectActivityFrames(111,()=>[contents([{osProcessId:111},unknown])]).complete,false,label);
});
