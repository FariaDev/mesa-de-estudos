import test from 'node:test';
import {ptText} from './pt-text.mjs';
import assert from 'node:assert/strict';
import core from '../src/generated/tutorheader.core.js';

/* Contrato do artefato `tutorheader.core.js` (gerado de core/tutorheader.bend):
   os itens dos dois menus do cabeçalho do tutor. As leis fixam a forma; aqui se
   confere o que o aplicador recebe — ids, ordem, rótulos, handlers e a flag. */

const nodes=(l)=>{const out=[];for(let c=l;c&&c.$==='Con';c=c.tail)out.push(c.head);return out;};
const attrs=(node)=>{const out={};for(let a=node.attrs;a&&a.$==='Con';a=a.tail)if(!(a.head.name in out))out[a.head.name]=ptText(a.head.value);return out;};

test('mais opções: a flag endDay é o único motivo para o Encerrar por hoje sumir',()=>{
 const on=nodes(core.moreItems(true)),off=nodes(core.moreItems(false));
 assert.equal('hidden' in attrs(on[1]),false);
 assert.equal(attrs(off[1]).hidden,'');
 for(const index of [0,2,3,4,5])assert.equal('hidden' in attrs(off[index]),false,`item ${index} não some por flag`);
});

/* ---------- indicador de modelo e esforço (ticket #14) ---------- */

const label=(online,status,model,level)=>ptText(core.indicatorLabel(online,status,model,level));

test('indicador: ligado mostra o modelo e o esforço em palavras curtas',()=>{
 assert.equal(label(true,'Tutor ligado','Claude Sonnet 4.5','medium'),'Sonnet 4.5 · médio');
 assert.equal(label(true,'Tutor ligado','Pi de teste','off'),'Pi de teste · desligado');
 assert.equal(label(true,'Tutor ligado','Opus','xhigh'),'Opus · muito alto');
 assert.equal(label(true,'Tutor ligado','Sonnet','default'),'Sonnet · padrão');
});

test('indicador: só o modelo ou só o esforço aparece sem separador sobrando',()=>{
 assert.equal(label(true,'Tutor ligado','Sonnet',''),'Sonnet');
 assert.equal(label(true,'Tutor ligado','','high'),'alto');
 assert.equal(label(true,'Tutor ligado','','') ,'Tutor ligado','sem modelo conhecido, diz que está ligado');
});

test('indicador: desligado diz o estado e nunca o modelo antigo',()=>{
 assert.equal(label(false,'Tutor desligado','Sonnet','medium'),'Tutor desligado');
 assert.equal(label(false,'Chamando o tutor','Sonnet','medium'),'Chamando o tutor');
 assert.equal(label(false,'Tutor sem resposta','','') ,'Tutor sem resposta');
 assert.equal(label(false,'','','') ,'Tutor desligado','sem rótulo cai em desligado');
});

test('popover: some quando o tutor está ligado e o motor deixa escolher',()=>{
 const note=core.popNote(true,false,true,'Tutor ligado');
 assert.equal(note.tag,'div');
 assert.equal(attrs(note).id,'model-pop-note');
 assert.equal(attrs(note).hidden,'');
});

test('popover: enquanto liga, o botão de chamar some (não chama duas vezes)',()=>{
 const note=core.popNote(false,true,true,'Chamando o tutor');
 const connect=nodes(note.kids).find(k=>attrs(k).id==='model-pop-connect');
 assert.equal(attrs(connect).hidden,'');
});

/* #27 — item 6: duas sessões sem assunto não ficam com o mesmo nome. */
test('nome da sessão: assunto, ou data e hora quando não há assunto',()=>{
 assert.equal(ptText(core.sessionName('Limites laterais','10/10, 13:27')),'Limites laterais');
 assert.equal(ptText(core.sessionName('','10/10, 13:27')),'Sessão de 10/10, 13:27');
 assert.notEqual(ptText(core.sessionName('','10/10, 13:27')),ptText(core.sessionName('','10/10, 13:41')));
 assert.equal(ptText(core.sessionName('','')),'Sessão');
});
