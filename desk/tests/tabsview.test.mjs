import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/generated/tabsview.core.js';

// Árvore do Bend (listas Con/Nil) sem DOM: o aplicador é testado em
// view-host.test.mjs; aqui o contrato é a forma que o smoke da UI exercita.

const Nil={$:'Nil'};
const con=(head,tail)=>({$:'Con',head,tail});
const list=(...xs)=>xs.reduceRight((tail,head)=>con(head,tail),Nil);
const nodes=(l)=>{const out=[];for(let c=l;c&&c.$==='Con';c=c.tail)out.push(c.head);return out;};
const tab=(id,name)=>({$:'Tab',id,name});
const facts=(over={})=>({$:'MenuFacts',twoPanels:true,toggle:'Formulário',refVisible:true,xournal:true,win32:false,hasXournalPath:false,theme:'auto',...over});
const attrs=(node)=>{const out={};for(let a=node.attrs;a&&a.$==='Con';a=a.tail)out[a.head.name]=a.head.value;return out;};
const texts=(node)=>nodes(node.kids).map(k=>k.text??'');
const ids=(xs)=>xs.map(n=>attrs(n).id);

test('abas: uma por matéria, separador e GeoGebra na ordem',()=>{
 const tabs=nodes(core.courseTabs(list(tab('A','Matéria A'),tab('B','Matéria B')),'A',false,false));
 assert.equal(tabs.length,4);
 assert.deepEqual(tabs.map(n=>n.tag),['button','button','span','button']);
 assert.deepEqual(attrs(tabs[0]),{type:'button',class:'active','data-id':'A',role:'tab','aria-selected':'true',tabindex:'0','on:click':'SelectCourse'});
 assert.equal(attrs(tabs[1]).class,'');
 assert.equal(attrs(tabs[1])['aria-selected'],'false');
 assert.equal(attrs(tabs[1])['data-id'],'B');
 assert.deepEqual(texts(tabs[0]),['Matéria A']);
 assert.deepEqual(texts(tabs[1]),['Matéria B']);
 assert.deepEqual(attrs(tabs[2]),{class:'tab-sep'});
 assert.deepEqual(texts(tabs[2]),[]);
});

test('abas: GeoGebra desativa a matéria e ativa a própria aba',()=>{
 const tabs=nodes(core.courseTabs(list(tab('A','Matéria A')),'A',true,false));
 assert.equal(attrs(tabs[0]).class,'');
 assert.equal(attrs(tabs[0])['aria-selected'],'false');
 assert.equal(attrs(tabs[2]).class,'active ggb-tab');
 assert.equal(attrs(tabs[2])['aria-selected'],'true');
 assert.equal(attrs(tabs[2])['data-id'],'geogebra');
 assert.equal(attrs(tabs[2]).title,'GeoGebra embutido (gráficos, geometria e CAS no applet da web)');
 assert.equal(attrs(tabs[2])['data-icon'],'graph');
 assert.ok('data-icon-tight' in attrs(tabs[2]),'o ícone do GeoGebra cola no rótulo (textContent exato)');
 assert.deepEqual(texts(tabs[2]),['GeoGebra']);
});

test('abas: disabled é fato, não texto; o "+" fica sempre ativo',()=>{
 const busy=nodes(core.courseTabs(list(tab('A','Matéria A')),'A',false,true));
 assert.equal(attrs(busy[0]).disabled,'');
 assert.equal(attrs(busy[2]).disabled,'');
 const free=nodes(core.courseTabs(list(tab('A','Matéria A')),'A',false,false));
 assert.equal('disabled' in attrs(free[0]),false);
 assert.equal('disabled' in attrs(free[2]),false);
 const plus=core.newTab();
 assert.equal(plus.tag,'button');
 assert.deepEqual(attrs(plus),{type:'button',id:'new-tab',title:'Nova matéria (abre as Configurações)','aria-label':'Nova matéria (abre as Configurações)','on:click':'NewCourse'});
 assert.deepEqual(texts(plus),['+']);
});

test('menu Estudar: rótulo do toggle, ARIA e painel único',()=>{
 const items=nodes(core.studyItems(facts()));
 assert.deepEqual(ids(items),['reference-toggle','xournal']);
 assert.deepEqual(texts(items[0]),['Formulário']);
 assert.equal(attrs(items[0])['aria-pressed'],'true');
 assert.equal(attrs(items[0]).role,'menuitem');
 assert.equal(attrs(items[0])['data-icon'],'columns');
 assert.equal('hidden' in attrs(items[0]),false);
 assert.deepEqual(texts(nodes(core.studyItems(facts({toggle:'Tabela'})))[0]),['Tabela']);
 const one=nodes(core.studyItems(facts({twoPanels:false,refVisible:false})));
 assert.equal(attrs(one[0]).hidden,'','com 1 painel o item some');
 assert.equal(attrs(one[0])['aria-pressed'],'false');
 assert.deepEqual(texts(one[1]),['Xournal++']);
});

test('menu Estudar: Xournal++ segue a flag e a plataforma',()=>{
 assert.equal(attrs(nodes(core.studyItems(facts({xournal:false})))[1]).hidden,'');
 assert.equal(attrs(nodes(core.studyItems(facts({win32:true,hasXournalPath:false})))[1]).hidden,'');
 assert.equal('hidden' in attrs(nodes(core.studyItems(facts({win32:true,hasXournalPath:true})))[1]),false);
 assert.equal('hidden' in attrs(nodes(core.studyItems(facts({win32:false,hasXournalPath:false})))[1]),false);
 assert.equal(attrs(nodes(core.studyItems(facts()))[1])['data-icon'],'external');
});

test('menu Mesa: ordem, rótulos, tema e ícones',()=>{
 const items=nodes(core.mesaItems(facts({theme:'dark'})));
 assert.deepEqual(ids(items),['help','settings','theme-cycle','about']);
 assert.deepEqual(items.map(n=>texts(n)[0]),['Como usar','Configurações','Tema: escuro','Sobre']);
 assert.ok(items.every(n=>attrs(n).role==='menuitem'));
 assert.equal(attrs(items[2])['data-icon'],'moon','o glifo do tema acompanha o estado (escuro = lua)');
 assert.equal(attrs(items[0])['data-icon'],'help');
 assert.equal(attrs(items[1])['data-icon'],'settings');
 assert.equal(attrs(items[3])['data-icon'],'help');
});

test('tema: mesmos rótulos do applyTheme e glifo por estado',()=>{
 assert.equal(core.themeLabel('auto'),'Tema: auto');
 assert.equal(core.themeLabel('light'),'Tema: claro');
 assert.equal(core.themeLabel('dark'),'Tema: escuro');
 assert.equal(core.themeLabel('rouge'),'Tema: auto');
 assert.equal(core.themeLabel(''),'Tema: auto');
 assert.equal(core.themeIcon('auto'),'contrast');
 assert.equal(core.themeIcon('light'),'sun');
 assert.equal(core.themeIcon('dark'),'moon');
 assert.equal(core.themeIcon('rouge'),'contrast');
 assert.equal(core.themeIcon(''),'contrast');
});

// Paridade com o `renderTabs` antigo (referência inline, como estava em
// state.mjs): mesma ordem, mesmos attrs visíveis no DOM (o aplicador pula
// class/id vazios e o host injeta os ícones e limpa o andaime).
const oldTabs=(courses,activeId,ggbActive,disabled)=>{
 const out=[];
 for(const c of courses){
  const active=c.id===activeId&&!ggbActive;
  out.push({tag:'button',attrs:{type:'button',class:active?'active':'','data-id':c.id,role:'tab','aria-selected':String(active),tabindex:active?'0':'-1'},disabled,text:c.name});
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
  const mine=nodes(core.courseTabs(list(...courses.map(c=>tab(c.id,c.name))),activeId,ggb,dis)).map(n=>shape(n,dis));
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
