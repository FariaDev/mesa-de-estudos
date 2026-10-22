import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
const {createMaterialPreviewHost,assertPreviewPayload}=createRequire(import.meta.url)('../material-preview-host.cjs');
const payload={title:'Teste',markdown:'$x=2$',revision:'revision-1',requestId:'request-1'};
function fixture(){
 let scope='A';const requests=[];
 const host=createMaterialPreviewHost({captureScope:()=>scope,scopeIsCurrent:s=>s===scope,allowSender:e=>e==='trusted',
  renderPdf:args=>new Promise(resolve=>requests.push({args,resolve}))});
 const finish=i=>requests[i].resolve({buffer:Buffer.from('%PDF-test'),sha256:'hash',diagnostics:[{kind:'scaled'}]});
 return {host,requests,finish,switchScope:()=>scope='B'};
}
test('preview returns transient bytes tied to immutable revision',async()=>{
 const f=fixture(),pending=f.host.preview('trusted',payload);f.finish(0);
 const out=await pending;assert.equal(out.revision,payload.revision);assert.equal(out.requestId,payload.requestId);
 assert.equal(Buffer.from(out.pdf).toString(),'%PDF-test');assert.equal(out.diagnostics.length,1);
});
test('late render cannot cross conversations even when renderer ignores abort',async()=>{
 const f=fixture(),pending=f.host.preview('trusted',payload);f.switchScope();f.finish(0);
 await assert.rejects(pending,ptMatches(/cancelada/));
});
test('new preview and explicit cancellation invalidate pending bytes',async()=>{
 const f=fixture(),first=f.host.preview('trusted',payload);
 const second=f.host.preview('trusted',{...payload,requestId:'request-2'});
 assert.equal(f.requests[0].args.signal.aborted,true);f.finish(0);await assert.rejects(first,ptMatches(/cancelada/));
 assert.equal(f.host.cancel('request-1'),false);assert.equal(f.host.cancel('request-2'),true);
 f.finish(1);await assert.rejects(second,ptMatches(/cancelada/));
});
test('untrusted sender and invalid payload never start rendering',async()=>{
 const f=fixture();await assert.rejects(f.host.preview('generated-frame',payload),ptMatches(/recusado em material-preview/));
 await assert.rejects(f.host.preview('trusted',{...payload,revision:''}),ptMatches(/inválida/));
 assert.equal(f.requests.length,0);
});
test('modelo e opções seguem para o render junto com o contexto da matéria',async()=>{
 const requests=[];
 const host=createMaterialPreviewHost({captureScope:()=>'A',scopeIsCurrent:()=>true,allowSender:()=>true,contextName:()=>'Cálculo I',
  renderPdf:async args=>{requests.push(args);return {buffer:Buffer.from('%PDF-test'),sha256:'h',model:'lista',options:{colunas:'auto'},columns:3,columnsAuto:true,columnsLabel:'Auto · 3'};}});
 const out=await host.preview('x',{...payload,model:'lista',options:{colunas:'auto'}});
 assert.equal(requests[0].model,'lista');assert.deepEqual(requests[0].options,{colunas:'auto'});assert.equal(requests[0].context,'Cálculo I');
 assert.equal(out.model,'lista');assert.equal(out.columns,3);assert.equal(out.columnsLabel,'Auto · 3');assert.equal(out.fit,null);
 await host.preview('x',payload);
 assert.equal(requests[1].model,undefined);
 await assert.rejects(host.preview('x',{...payload,model:'cartaz'}),ptMatches(/inválida/));
 await assert.rejects(host.preview('x',{...payload,options:'x'}),ptMatches(/inválida/));
 assert.equal(requests.length,2);
});
test('prévia inválida diz o campo, o que veio e o formato esperado',()=>{
 assert.throws(()=>assertPreviewPayload({...payload,requestId:'x'.repeat(65)}),ptMatches(/^Prévia inválida: requestId recebeu string\(65\); esperado string\(1\.\.64\)\.$/));
 assert.throws(()=>assertPreviewPayload({...payload,model:'poster'}),ptMatches(/model recebeu "poster"; esperado lista\|apostila\|/));
 assert.throws(()=>assertPreviewPayload([]),ptMatches(/payload recebeu array\(0\); esperado object/));
 assert.doesNotThrow(()=>assertPreviewPayload({...payload,title:undefined,revision:' '}));
});
