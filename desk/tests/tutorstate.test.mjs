import test from 'node:test';
import {ptText} from './pt-text.mjs';
import {message} from '../src/i18n.mjs';
import assert from 'node:assert/strict';
import core from '../src/generated/tutorstate.core.js';

/* Contrato do artefato `tutorstate.core.js` (gerado de core/tutorstate.bend):
   a árvore dos estados do tutor na coluna (ticket #17) — desligado (com ou sem
   retomada guardada), ligando e sem resposta. As leis fixam a forma; aqui se
   confere o que o aplicador recebe: qual estado aparece para cada fato, os
   textos, os botões, a ordem e os nomes dos handlers. */

const nodes=(l)=>{const out=[];for(let c=l;c&&c.$==='Con';c=c.tail)out.push(c.head);return out;};
const attrs=(node)=>{const out={};for(let a=node.attrs;a&&a.$==='Con';a=a.tail)if(!(a.head.name in out))out[a.head.name]=ptText(a.head.value);return out;};
const text=(node)=>node.$==='ViewText'?ptText(node.text):nodes(node.kids).map(text).join('');
const kids=(node)=>nodes(node.kids);
const classes=(list)=>list.map(n=>attrs(n).class);

const RECORD=['Lista 2 · 7b','travei na 3','seguir para a 4'];
const view=(link,reason='',has=false,[exercise,stopped,next]=has?RECORD:['','','']) =>core.stateView(link,reason,has,exercise,stopped,next);
const actions=(root)=>kids(kids(root)[1]);
const lead=(root)=>kids(kids(kids(root)[0])[0]);
const fine=(root)=>kids(kids(root)[0])[1];

test('desligado sem retomada: só o convite para chamar o tutor',()=>{
 const root=view('off');
 assert.equal(attrs(root).id,'tutor-state');
 assert.equal(attrs(root)['data-state'],'off');
 assert.equal('hidden' in attrs(root),false);
 assert.equal(text(kids(kids(root)[0])[0]),'O tutor está desligado.');
 assert.ok(text(fine(root)).length>0,'o convite explica o que fazer');
 const buttons=actions(root);
 assert.equal(buttons.length,1);
 assert.equal(attrs(buttons[0]).id,'connect');
 assert.equal(text(buttons[0]),'Chamar o tutor');
 assert.equal(attrs(buttons[0])['on:click'],'Connect');
});

test('desligado com retomada: onde parou em destaque, próximo passo embaixo, três ações',()=>{
 const root=view('off','',true);
 assert.equal(attrs(root)['data-state'],'resume');
 const parts=lead(root);
 assert.equal(text(kids(kids(root)[0])[0]),'Da última vez você parou em Lista 2 · 7b: travei na 3');
 assert.equal(parts.find(n=>n.tag==='strong')&&text(parts.find(n=>n.tag==='strong')),'Lista 2 · 7b','a questão vai em destaque');
 assert.equal(text(fine(root)),'Próximo passo: seguir para a 4');
 assert.equal(attrs(fine(root)).class,'ts-fine');
 const buttons=actions(root);
 assert.deepEqual(buttons.map(n=>attrs(n).id),['resume-go','resume-new','resume-forget']);
 assert.deepEqual(buttons.map(text),['Retomar','Sessão nova','Esquecer']);
 assert.deepEqual(buttons.map(n=>attrs(n)['on:click']),['Resume','NewSession','Forget']);
 assert.deepEqual(classes(buttons),['ts-primary','ts-secondary','ts-ghost'],'primária, secundária e discreta, nessa ordem');
});

test('retomada sem a questão não deixa o "em" solto',()=>{
 const root=core.stateView('off','',true,'','travei na 3','seguir para a 4');
 assert.equal(text(kids(kids(root)[0])[0]),'Da última vez você parou: travei na 3');
 assert.equal(lead(root).some(n=>n.tag==='strong'),false);
});

test('ligando: "Chamando o tutor" com Cancelar, mesmo com retomada guardada',()=>{
 for(const has of [false,true]){
  const root=view('connecting','',has);
  assert.equal(attrs(root)['data-state'],'connecting');
  assert.equal(attrs(root).role,'status');
  assert.equal(text(kids(kids(root)[0])[0]),'Chamando o tutor');
  const buttons=actions(root);
  assert.deepEqual(buttons.map(n=>attrs(n).id),['connect-cancel']);
  assert.deepEqual(buttons.map(text),['Cancelar']);
  assert.deepEqual(buttons.map(n=>attrs(n)['on:click']),['Cancel']);
 }
});

test('sem resposta: o motivo em uma frase e as três ações',()=>{
 const root=view('error','O tutor demorou demais para atender.');
 assert.equal(attrs(root)['data-state'],'error');
 assert.equal(text(kids(kids(root)[0])[0]),'O tutor não atendeu.');
 assert.equal(text(fine(root)),'O tutor demorou demais para atender.');
 const buttons=actions(root);
 assert.deepEqual(buttons.map(n=>attrs(n).id),['connect','state-log','state-pi']);
 assert.deepEqual(buttons.map(text),['Chamar de novo','Ver o log','Ajustes do Pi']);
 assert.deepEqual(buttons.map(n=>attrs(n)['on:click']),['Connect','OpenLog','OpenPiSettings']);
 assert.deepEqual(classes(buttons),['ts-primary','ts-secondary','ts-ghost']);
});

test('o motivo: vazio cai numa frase própria e o excesso é cortado',()=>{
 assert.equal(ptText(core.reasonLine('')),'O tutor não respondeu.');
 assert.equal(ptText(core.reasonLine('   \t ')),'O tutor não respondeu.');
 assert.equal(ptText(core.reasonLine('  motivo curto  ')),'motivo curto');
 assert.equal(ptText(core.reasonLine('x'.repeat(400))).length,160);
 const root=view('error','');
 assert.equal(text(fine(root)),'O tutor não respondeu.');
});

test('um fato desconhecido cai em desligado (nunca em bloco vazio)',()=>{
 assert.equal(attrs(view('')) ['data-state'],'off');
 assert.equal(attrs(view('qualquer')) ['data-state'],'off');
});

test('os três estados têm a mesma casca: texto e depois ações (a distância é a mesma)',()=>{
 for(const root of [view('off','',true),view('connecting'),view('error','motivo')]){
  assert.deepEqual(classes(kids(root)),['ts-text','ts-actions']);
  assert.equal(attrs(kids(root)[0]).class,'ts-text');
  assert.equal(attrs(kids(kids(root)[0])[0]).class,'ts-lead','a linha em destaque abre o texto');
 }
});

/* #27 — item 2: o mesmo "Pi não encontrado" tem a mesma ação principal na
   primeira abertura e no "sem resposta" do app normal. */
test('Pi não encontrado: Ajustes do Pi é a ação principal também no sem resposta',()=>{
 const root=view('error',message('tutor.error.piMissing'));
 const buttons=actions(root);
 assert.deepEqual(buttons.map(n=>attrs(n).id),['state-pi','connect','state-log']);
 assert.deepEqual(buttons.map(text),['Ajustes do Pi','Chamar de novo','Ver o log']);
 assert.deepEqual(classes(buttons),['ts-primary','ts-secondary','ts-ghost']);
 const other=actions(view('error','O tutor fechou.'));
 assert.deepEqual(other.map(n=>attrs(n).id),['connect','state-log','state-pi'],'outra causa mantém Chamar de novo como principal');
});
