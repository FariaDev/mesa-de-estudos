import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/generated/tabsview.core.js';
import {ptText} from './pt-text.mjs';

// Árvore do Bend (listas Con/Nil) sem DOM: o aplicador é testado em
// view-host.test.mjs; aqui o contrato é a forma que o smoke da UI exercita.

const Nil={$:'Nil'};
const con=(head,tail)=>({$:'Con',head,tail});
const list=(...xs)=>xs.reduceRight((tail,head)=>con(head,tail),Nil);
const nodes=(l)=>{const out=[];for(let c=l;c&&c.$==='Con';c=c.tail)out.push(c.head);return out;};
const tab=(id,name)=>({$:'Tab',id,name});
const facts=(over={})=>({$:'MenuFacts',twoPanels:true,toggle:'Formulário',refVisible:true,xournal:true,win32:false,hasXournalPath:false,...over});
const attrs=(node)=>{const out={};for(let a=node.attrs;a&&a.$==='Con';a=a.tail)out[a.head.name]=ptText(a.head.value);return out;};
const texts=(node)=>nodes(node.kids).map(k=>ptText(k.text??''));
const ids=(xs)=>xs.map(n=>attrs(n).id);

test('menu Estudar: ferramentas, Xournal++ e toggle, nessa ordem; o Encerrar por hoje saiu daqui',()=>{
 const items=nodes(core.studyItems(facts()));
 assert.deepEqual(ids(items),['study-search-open','study-review-today','study-notes-open','study-stats-open','study-backup-open','study-share-open','study-tutor-pdf','xournal','reference-toggle']);
 assert.ok(!ids(items).includes('end-day'),'o Encerrar por hoje mora em Mais opções do tutor');
 assert.deepEqual(items.slice(0,7).map(n=>texts(n)[0]),['Buscar estudos','Revisar hoje','Anotações','Estatísticas','Backup','Compartilhar','PDF pelo tutor']);
 assert.ok(items.every(n=>attrs(n).role==='menuitem'));
 assert.deepEqual(items.slice(0,7).map(n=>attrs(n)['on:click']),['OpenStudySearch','OpenReviewToday','OpenPdfNotes','OpenStudyStats','OpenStudyBackup','OpenStudyShare','OpenTutorPdf']);
});

test('seletor da janela estreita: uma opção por matéria, a ativa marcada',()=>{
 const opts=nodes(core.courseMenuItems(list(tab('A','Matéria A'),tab('B','Matéria B')),'B',false,false));
 assert.deepEqual(opts.map(n=>texts(n)[0]),['Matéria A','Matéria B']);
 assert.deepEqual(opts.map(n=>attrs(n)['data-id']),['A','B']);
 assert.deepEqual(opts.map(n=>attrs(n).id),['course-option-A','course-option-B']);
 assert.ok(opts.every(n=>attrs(n).role==='menuitem'&&attrs(n)['on:click']==='SelectCourse'));
 assert.equal('data-icon' in attrs(opts[0]),false);
 assert.equal(attrs(opts[1])['data-icon'],'check');
 const ggb=nodes(core.courseMenuItems(list(tab('A','Matéria A')),'A',true,false));
 assert.equal('data-icon' in attrs(ggb[0]),false,'com o GeoGebra ligado nenhuma matéria leva a marca');
 const busy=nodes(core.courseMenuItems(list(tab('A','Matéria A')),'A',false,true));
 assert.equal(attrs(busy[0]).disabled,'');
 assert.equal(attrs(busy[0]).title,'Espere a resposta terminar para trocar de matéria','a opção travada diz por quê');
});

// Paridade com o `renderTabs` antigo (referência inline, como estava em
// state.mjs): mesma ordem, mesmos attrs visíveis no DOM (o aplicador pula
// class/id vazios e o host injeta os ícones e limpa o andaime).
const oldTabs=(courses,activeId,ggbActive,disabled)=>{
 const out=[];
 for(const c of courses){
  const active=c.id===activeId&&!ggbActive;
  /* #42: a aba travada diz por quê (a dica do núcleo); a do GeoGebra fica com a sua. */
  out.push({tag:'button',attrs:{type:'button',class:active?'active':'','data-id':c.id,role:'tab','aria-selected':String(active),tabindex:active?'0':'-1',...(disabled?{title:'Espere a resposta terminar para trocar de matéria'}:{})},disabled,text:c.name});
 }
 out.push({tag:'span',attrs:{class:'tab-sep'},disabled:false,text:''});
 out.push({tag:'button',attrs:{type:'button',class:ggbActive?'active ggb-tab':'ggb-tab','data-id':'geogebra',role:'tab','aria-selected':String(ggbActive),tabindex:ggbActive?'0':'-1',title:'GeoGebra embutido (gráficos, geometria e CAS no applet da web)','data-icon':'graph','data-icon-tight':''},disabled,text:'GeoGebra'});
 return out;
};
const shape=(node,disabled)=>{
 const a=attrs(node),out={tag:node.tag,attrs:{},text:texts(node)[0]||''};
 for(const [k,v] of Object.entries(a)){
  if(k==='on:click'||k==='data-icon-tight')continue;
  if(!v&&(k==='class'||k==='id'))continue;
  out.attrs[k]=v;
 }
 if(disabled&&node.tag==='button')out.attrs.disabled='';
 return out;
};
test('paridade: árvore do Bend × renderTabs antigo (aleatório)',()=>{
 let seed=0x5eed;
 const rnd=n=>{seed=(seed*1103515245+12345)>>>0;return seed%n;};
 for(let i=0;i<600;i++){
  const courses=[];
  for(let k=0,n=1+rnd(4);k<n;k++)courses.push({id:rnd(2)?`C${k}`:'',name:['Matéria A','Cálculo I',''][rnd(3)]});
  const activeId=courses[0]?.id||'';
  const ggb=!!rnd(2),dis=!!rnd(2);
  const mine=nodes(core.courseTabs(list(...courses.map(c=>tab(c.id,c.name))),activeId,ggb,dis,'0')).filter(n=>!['new-tab','review-tab'].includes(attrs(n).id)).map(n=>shape(n,dis));
  const ref=oldTabs(courses,activeId,ggb,dis).map(({tag,attrs:raw,disabled,text})=>{
   const a={...raw};
   if(!a.class)delete a.class;
   delete a['data-icon-tight'];
   if(disabled&&tag==='button')a.disabled='';
   return {tag,attrs:a,text};
  });
  assert.deepEqual(mine,ref,`caso ${i}: ${JSON.stringify({courses,activeId,ggb,dis})}`);
 }
});
