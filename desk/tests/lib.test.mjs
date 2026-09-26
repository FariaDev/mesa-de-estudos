import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {displayUserText,contentParts} from '../text.mjs';
const {placeWindow,chooseXournal,sessionStartedFromPath,formatSessionLabel,sessionPreviewFromJsonl,imageCandidates}=createRequire(import.meta.url)('../lib.cjs');

/* Geometria real do autor: interna 2560x1664 à direita (x=0), LG 1920x1080 à
   esquerda (x negativo). O interno é o primário. */
const INTERNA={id:1,internal:true,workArea:{x:0,y:0,width:2560,height:1664}};
const EXTERNO={id:2,internal:false,workArea:{x:-1920,y:-292,width:1920,height:1080}};

test('placeWindow manda para o externo mesmo com bounds salvos no interno',()=>{
 const saved={x:100,y:100,width:1600,height:1020};
 const placed=placeWindow([INTERNA,EXTERNO],1,saved);
 assert.equal(placed.x,-1900);
 assert.equal(placed.y,-272);
 assert.equal(placed.width,1600);
 assert.equal(placed.height,1020);
});

test('placeWindow mantém os bounds salvos quando já estão na tela alvo',()=>{
 const saved={x:-1900,y:-272,width:1500,height:900};
 assert.deepEqual(placeWindow([INTERNA,EXTERNO],1,saved),saved);
});

test('placeWindow prefere o externo quando não há bounds salvos',()=>{
 const placed=placeWindow([INTERNA,EXTERNO],1,null);
 assert.equal(placed.x,-1900);
 assert.equal(placed.y,-272);
 assert.ok(placed.width<=1920);
});

test('placeWindow respeita a marca internal (externo como primário)',()=>{
 const saved={x:100,y:100,width:1600,height:1020};
 const placed=placeWindow([INTERNA,EXTERNO],2,saved);
 assert.equal(placed.x,-1900);
 assert.equal(placed.y,-272);
});

test('placeWindow sem externo mantém os bounds salvos do interno',()=>{
 const saved={x:120,y:80,width:1600,height:1020};
 assert.deepEqual(placeWindow([INTERNA],1,saved),saved);
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
 assert.equal(displayUserText('quanto vale?\n\n[Contexto da sessão na Mesa: matéria: "Cálculo I"; exercício ativo: "Lista 2 · 7b".]\n\n[Referências abertas na mesa, indicadas pelo usuário como contexto: "/tmp/a.pdf#page=1".]'),'quanto vale?');
 /* Bloco atual (core/studycontext.bend): some inteiro, inclusive a linha da
    captura, e o texto do usuário fica. */
 assert.equal(displayUserText('confere minha resposta\n\n[Contexto da Mesa]\n- matéria: Cálculo I\n- exercício ativo: Lista 3\n- referências abertas na mesa (abertas, não lidas por você):\n  · /tmp/a.pdf#page=1\ncaptura desta mensagem: janela do Xournal++ às 14:32, do exercício Lista 3'),'confere minha resposta');
 assert.match(displayUserText('x\n\n[Conferência visual solicitada pelo usuário; captura de Xournal++]'),/Conferir Xournal\+\+/);
});

test('contentParts extracts text and image payloads',()=>{
 assert.deepEqual(contentParts({content:'oi'}),{text:'oi',images:[]});
 const parts=contentParts({content:[{type:'text',text:'foto'},{type:'image',mimeType:'image/png',data:'abc'}]});
 assert.equal(parts.text,'foto');
 assert.equal(parts.images[0],'data:image/png;base64,abc');
});

test('imageCandidates only resolves image files inside the learning root',()=>{
 const root='/vault/desk/.runtime/learning';
 const options={learningRoot:root,roots:['/vault','/vault/desk']};
 const asset=`${root}/Courses/Calculus I/Sessions/Assets/1/plot.png`;
 assert.deepEqual(imageCandidates('file:///vault/desk/.runtime/learning/Courses/Calculus%20I/Sessions/Assets/1/plot.png',options),[asset]);
 assert.deepEqual(imageCandidates('desk/.runtime/learning/Courses/Calculus I/Sessions/Assets/1/plot.png',options),[asset]);
 assert.deepEqual(imageCandidates(`<${asset}>`,options),[asset]);
 assert.deepEqual(imageCandidates(asset.replace('.png','.svg'),options),[asset.replace('.png','.svg')]);
 assert.deepEqual(imageCandidates('/etc/passwd.png',options),[]);
 assert.deepEqual(imageCandidates('/vault/desk/.runtime/learning-extra/plot.png',options),[]);
 assert.deepEqual(imageCandidates(`${root}/plot.pdf`,options),[]);
 assert.deepEqual(imageCandidates('https://example.com/plot.png',options),[]);
});

test('session labels use the jsonl timestamp and first user line',()=>{
 const path='/tmp/pi-1700000000000.jsonl';
 assert.equal(sessionStartedFromPath(path),1700000000000);
 const raw='{"type":"message","message":{"role":"user","content":[{"type":"text","text":"/conferir x"}]}}\n';
 assert.equal(sessionPreviewFromJsonl(raw),'Conferir Xournal++');
 assert.match(formatSessionLabel({path,started:1700000000000,preview:'Conferir Xournal++'}),/Conferir/);
});
