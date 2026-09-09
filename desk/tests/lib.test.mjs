import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {displayUserText,contentParts} from '../text.mjs';
const {placeWindow,chooseXournal,sessionStartedFromPath,formatSessionLabel,sessionPreviewFromJsonl}=createRequire(import.meta.url)('../lib.cjs');

test('placeWindow keeps saved bounds when the display is still connected',()=>{
 const displays=[{id:1,workArea:{x:0,y:0,width:1440,height:900}},{id:2,workArea:{x:1440,y:0,width:1920,height:1080}}];
 const saved={x:1500,y:40,width:1200,height:800};
 assert.deepEqual(placeWindow(displays,1,saved),saved);
});

test('placeWindow prefers the external display when saved bounds are gone',()=>{
 const displays=[{id:1,workArea:{x:0,y:0,width:1440,height:900}},{id:2,workArea:{x:1440,y:0,width:1920,height:1080}}];
 const placed=placeWindow(displays,1,{x:-4000,y:0,width:800,height:600});
 assert.equal(placed.x,1460);
 assert.equal(placed.y,20);
 assert.ok(placed.width<=1920);
});

test('placeWindow falls back to the primary display alone',()=>{
 const placed=placeWindow([{id:1,workArea:{x:0,y:0,width:1440,height:900}}],1,null);
 assert.equal(placed.x,20);
 assert.equal(placed.y,20);
});

test('chooseXournal requires a single visible Xournal window',()=>{
 const x=(id)=>({id,app:'Xournal++',bounds:{Width:1200,Height:800}});
 assert.equal(chooseXournal([{id:1,app:'Ghostty',bounds:{Width:800,Height:600}},x(2)]).id,2);
 assert.throws(()=>chooseXournal([{id:1,app:'Ghostty',bounds:{Width:800,Height:600}}]));
 assert.throws(()=>chooseXournal([x(2),x(3)]));
});

test('displayUserText hides conferir commands and reference appendices',()=>{
 assert.equal(displayUserText('/conferir Confira minha resolução e indique o primeiro erro relevante.'),'Conferir Xournal++');
 assert.equal(displayUserText('/conferir Olha o passo 3'),'Conferir Xournal++\nOlha o passo 3');
 assert.equal(displayUserText('quanto vale o limite?\n\n[Referências abertas na mesa, indicadas pelo usuário como contexto: "/tmp/a.pdf#page=1".]'),'quanto vale o limite?');
 assert.match(displayUserText('x\n\n[Conferência visual solicitada pelo usuário; captura de Xournal++]'),/Conferir Xournal\+\+/);
});

test('contentParts extracts text and image payloads',()=>{
 assert.deepEqual(contentParts({content:'oi'}),{text:'oi',images:[]});
 const parts=contentParts({content:[{type:'text',text:'foto'},{type:'image',mimeType:'image/png',data:'abc'}]});
 assert.equal(parts.text,'foto');
 assert.equal(parts.images[0],'data:image/png;base64,abc');
});

test('session labels use the jsonl timestamp and first user line',()=>{
 const path='/tmp/pi-1700000000000.jsonl';
 assert.equal(sessionStartedFromPath(path),1700000000000);
 const raw='{"type":"message","message":{"role":"user","content":[{"type":"text","text":"/conferir x"}]}}\n';
 assert.equal(sessionPreviewFromJsonl(raw),'Conferir Xournal++');
 assert.match(formatSessionLabel({path,started:1700000000000,preview:'Conferir Xournal++'}),/Conferir/);
});
