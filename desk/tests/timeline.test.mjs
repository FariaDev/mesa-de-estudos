/* Linha do tempo do turno (desk/src/timeline.mjs): segmentos com limites
   explícitos, pertencimento por ID (nunca slice(from) sem fim) e o contrato do
   slot de atividade. Módulo puro: sem DOM, sem Electron, sem rede. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ACTIVITY_TOOLS,addStep,artifactPart,beginTrack,closeAll,closeSegment,createTrack,
 isActivityTool,joinStep,openSegment,removeSegment,resetTrack,segmentCount,
 segmentEmpty,segmentOfStep,segmentSteps,
} from '../src/timeline.mjs';

test('isActivityTool reconhece só os nomes de publicação (Pi e MCP)', () => {
 assert.equal(isActivityTool('mesa_criar_atividade'),true);
 assert.equal(isActivityTool('mcp__mesa__criar_atividade'),true);
 assert.equal(isActivityTool('quiz'),false);
 assert.equal(isActivityTool('mcp__mesa__outra'),false);
 assert.equal(isActivityTool(''),false);
 assert.equal(isActivityTool(undefined),false);
 assert.deepEqual([...ACTIVITY_TOOLS],['mesa_criar_atividade','mcp__mesa__criar_atividade']);
});

test('artifactPart carrega a identidade estável do slot', () => {
 assert.deepEqual(artifactPart('t1','mesa_criar_atividade',123),{type:'artifact',toolCallId:'t1',name:'mesa_criar_atividade',at:123});
 assert.deepEqual(artifactPart(null),{type:'artifact',toolCallId:'',name:'',at:0});
});

test('segmento aberto reusa; fechar fixa to/endedAt; o próximo abre embaixo', () => {
 const track=beginTrack(createTrack());
 const first=openSegment(track,{at:0,now:100});
 assert.equal(first.created,true);
 assert.equal(first.seg.from,0);
 assert.equal(first.seg.to,0);
 assert.equal(first.seg.closed,false);
 addStep(first.seg,'pensar-1');
 const again=openSegment(track,{at:1,now:150});
 assert.equal(again.created,false);
 assert.equal(again.seg,first.seg,'enquanto aberto, reusa');
 addStep(again.seg,'t1');
 assert.equal(segmentOfStep(track,'t1'),first.seg);
 const closed=closeSegment(track,{now:200});
 assert.equal(closed,first.seg);
 assert.equal(closed.closed,true);
 assert.equal(closed.to,2,'limite superior explícito no fecho');
 assert.equal(closed.endedAt,200);
 assert.equal(closeSegment(track,{now:250}),null,'fechar de novo é no-op');
 const second=openSegment(track,{at:2,now:300});
 assert.equal(second.created,true);
 assert.notEqual(second.seg.id,first.seg.id);
 assert.equal(second.seg.from,2);
 assert.equal(segmentCount(track),2);
});

test('conteúdo por ID: resultado tardio atualiza o segmento original fechado', () => {
 const track=beginTrack(createTrack());
 const a=openSegment(track,{at:0,now:0}).seg;
 const t1={id:'t1',text:''};
 addStep(a,'t1');
 closeSegment(track,{now:10});
 const b=openSegment(track,{at:1,now:20}).seg;
 const t2={id:'t2',text:''};
 addStep(b,'t2');
 const log={steps:[t1,t2]};
 assert.deepEqual(segmentSteps(log,a).map(step=>step.id),['t1']);
 assert.deepEqual(segmentSteps(log,b).map(step=>step.id),['t2']);
 /* O evento tardio de t1 não acrescenta passo nenhum ao segmento B e o
    resultado entra no segmento A, que já estava fechado. */
 t1.text='resultado tardio';
 assert.deepEqual(segmentSteps(log,a).map(step=>step.text),['resultado tardio']);
 assert.equal(segmentOfStep(track,'t1'),a);
 assert.equal(segmentOfStep(track,'t2'),b);
 assert.equal(segmentOfStep(track,'não-existe'),null);
});

test('passos entram no segmento aberto na ordem de nascimento', () => {
 const track=beginTrack(createTrack());
 const seg=openSegment(track,{at:0,now:0}).seg;
 joinStep(track,'s1',{at:0,now:1});
 joinStep(track,'s2',{at:1,now:2});
 addStep(seg,'s3');
 assert.deepEqual(segmentSteps({steps:[{id:'s1'},{id:'s2'},{id:'s3'}]},seg).map(step=>step.id),['s1','s2','s3']);
});

test('segmento vazio é vazio por IDs (não por to-from)', () => {
 const track=beginTrack(createTrack());
 const seg=openSegment(track,{at:4,now:0}).seg;
 assert.equal(segmentEmpty(seg),true);
 assert.equal(segmentEmpty(null),true);
 addStep(seg,'x');
 assert.equal(segmentEmpty(seg),false);
 closeSegment(track,{now:5});
 assert.equal(seg.to,1);
});

test('closeAll fecha todos e preserva reason; resetTrack limpa a geração', () => {
 const track=beginTrack(createTrack());
 const a=openSegment(track,{at:0,now:0}).seg;
 addStep(a,'a1');
 closeSegment(track,{now:1});
 const b=openSegment(track,{at:1,now:2}).seg;
 addStep(b,'b1');
 const c=openSegment(track,{at:2,now:2}).seg; /* não acontece: reusa b */
 assert.equal(c,b);
 const all=closeAll(track,{now:30,reason:'stopped'});
 assert.equal(all.length,2);
 assert.deepEqual(all.map(seg=>seg.closed),[true,true]);
 assert.equal(all[0].reason,'','segmento já fechado não ganha o reason novo');
 assert.equal(all[1].reason,'stopped');
 assert.equal(all[1].endedAt,30);
 const genBefore=track.gen;
 resetTrack(track);
 assert.equal(track.gen,genBefore+1);
 assert.equal(segmentCount(track),0);
 assert.equal(removeSegment(track,a),false,'remover segmento ausente é false');
});

test('removeSegment tira o segmento da lista (rodada vazia descartada)', () => {
 const track=beginTrack(createTrack());
 const seg=openSegment(track,{at:0,now:0}).seg;
 assert.equal(removeSegment(track,seg),true);
 assert.equal(segmentCount(track),0);
});
