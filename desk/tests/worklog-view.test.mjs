import assert from 'node:assert/strict';
import test from 'node:test';
import core from '../src/generated/worklogview.core.js';
import {VIEW_KIND_CORE,VIEW_STATUS_CORE} from '../src/worklog-tags.mjs';
import {build,childrenOf} from '../src/view-host.mjs';

const Nil={$:'Nil'};
const list=(...xs)=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),Nil);

function attrs(node){
 const out={};
 for(let cur=node?.attrs;cur&&cur.$==='Con';cur=cur.tail)out[cur.head.name]=cur.head.value;
 return out;
}
function textOf(node){
 if(!node)return '';
 if(node.$==='ViewText')return String(node.text??'');
 return childrenOf(node.kids||Nil).map(textOf).join('');
}
function findClass(node,name){
 if(node?.$==='ViewEl'&&attrs(node).class===name)return node;
 for(const kid of childrenOf(node?.kids||Nil)){
  const hit=findClass(kid,name);
  if(hit)return hit;
 }
 return null;
}

function emptyWork(live,expanded,title='Trabalhou por 1s',meta=''){
 return {$:'WorkRow',live,expanded,title,meta,steps:Nil};
}

function thinkStep({open=false,hasDetail=true,label='Pensou por 3s',text='Vou considerar',preview=''}={}){
 return {
  $:'StepRow',id:'pensar-1',kind:{$:'Thinking'},status:{$:'Status.Done'},
  open,hasDetail,label,time:'',preview,text,links:Nil,
 };
}

test('kindName e statusName batem com data-* do DOM',()=>{
 assert.equal(core.kindName({$:'Thinking'}),'thinking');
 assert.equal(core.kindName({$:'Search'}),'search');
 assert.equal(core.statusName({$:'Status.Failed'}),'error');
 assert.equal(core.statusRunning({$:'Status.Running'}),true);
});

test('workLog ao vivo: article.work data-live/expanded e título',()=>{
 const tree=core.workLog(emptyWork(true,true,'Pensando…','2s'));
 assert.equal(tree.tag,'article');
 assert.equal(attrs(tree).class,'work');
 assert.equal(attrs(tree)['data-live'],'true');
 assert.equal(attrs(tree)['data-expanded'],'true');
 const title=findClass(tree,'work-title');
 assert.equal(textOf(title),'Pensando…');
 const meta=findClass(tree,'work-meta');
 assert.equal(textOf(meta),'2s');
 const dots=findClass(tree,'pulse work-dots');
 assert.ok(dots);
 assert.equal('hidden' in attrs(dots),false);
 const head=findClass(tree,'work-head');
 assert.equal(head.tag,'button');
 assert.equal(attrs(head)['aria-expanded'],'true');
 assert.equal(attrs(head)['on:click'],'toggleWork');
});

test('workLog recolhido: data-expanded false, dots hidden, título Trabalhou por',()=>{
 const tree=core.workLog(emptyWork(false,false,'Trabalhou por 8s · 1 busca'));
 assert.equal(attrs(tree)['data-live'],'false');
 assert.equal(attrs(tree)['data-expanded'],'false');
 assert.equal(textOf(findClass(tree,'work-title')),'Trabalhou por 8s · 1 busca');
 assert.equal(attrs(findClass(tree,'work-head'))['aria-expanded'],'false');
 assert.equal(attrs(findClass(tree,'pulse work-dots')).hidden,'');
});

test('passo de pensamento: data-kind/status/detail, label, texto e toggle',()=>{
 const row={$:'WorkRow',live:false,expanded:true,title:'Pensou por 3s',meta:'',steps:list(thinkStep({open:true}))};
 const tree=core.workLog(row);
 const step=findClass(tree,'work-step');
 assert.equal(attrs(step)['data-kind'],'thinking');
 assert.equal(attrs(step)['data-status'],'done');
 assert.equal(attrs(step)['data-detail'],'true');
 assert.equal(attrs(step).key,'pensar-1');
 assert.equal(textOf(findClass(step,'step-label')),'Pensou por 3s');
 assert.equal(textOf(findClass(step,'step-text')),'Vou considerar');
 const toggle=findClass(step,'step-toggle');
 assert.equal(attrs(toggle)['on:click'],'toggleStep');
 assert.equal(attrs(toggle)['aria-expanded'],'true');
 assert.equal('hidden' in attrs(findClass(step,'step-detail')),false);
});

test('passo sem detalhe fica data-detail=false e o detalhe hidden',()=>{
 const step=thinkStep({hasDetail:false,open:true,text:''});
 const tree=core.workStep(step);
 assert.equal(attrs(tree)['data-detail'],'false');
 assert.equal(attrs(findClass(tree,'step-toggle'))['aria-expanded'],'false');
 assert.equal('hidden' in attrs(findClass(tree,'step-detail')),true);
});

test('passo aberto esconde o preview; fechado, o preview corre',()=>{
 const open=core.workStep(thinkStep({open:true,preview:'correndo…',text:'texto completo'}));
 assert.equal('hidden' in attrs(findClass(open,'step-preview')),true,'aberto: o preview some (quem manda é o texto)');
 assert.equal(textOf(findClass(open,'step-preview')),'correndo…','o nó do preview fica no DOM (só escondido)');
 assert.equal('hidden' in attrs(findClass(open,'step-detail')),false);
 const closed=core.workStep(thinkStep({open:false,preview:'correndo…',text:'texto completo'}));
 assert.equal('hidden' in attrs(findClass(closed,'step-preview')),false,'fechado: o preview corre');
 assert.equal(attrs(findClass(closed,'step-detail')).hidden,'','fechado: o detalhe some');
});

test('passo sem detalhe mantém o preview mesmo aberto (o corpo não esvazia)',()=>{
 /* Sem detalhe não há o que expandir: o botão já diz "recolhido"
    (aria-expanded=false). Se o preview sumisse com `open` verdadeiro, o clique
    apagaria o único conteúdo do passo e nada apareceria no lugar. */
 const step=core.workStep(thinkStep({hasDetail:false,open:true,preview:'correndo…',text:''}));
 assert.equal(attrs(findClass(step,'step-toggle'))['aria-expanded'],'false');
 assert.equal('hidden' in attrs(findClass(step,'step-detail')),true,'sem detalhe, o detalhe nunca aparece');
 assert.equal('hidden' in attrs(findClass(step,'step-preview')),false,'o preview fica: é o único conteúdo do passo');
 assert.equal(textOf(findClass(step,'step-preview')),'correndo…');
});

test('busca running ganha spinner; link traz domínio',()=>{
 const step={
  $:'StepRow',id:'s1',kind:{$:'Search'},status:{$:'Status.Running'},
  open:false,hasDetail:true,label:'Procurando na web: «kojima xbox»',time:'1s',
  preview:'',text:'',
  links:list({$:'LinkRow',title:'OD',url:'https://example.com/od',domain:'example.com'}),
 };
 const tree=core.workStep(step);
 assert.equal(attrs(tree)['data-kind'],'search');
 assert.equal(attrs(tree)['data-status'],'running');
 const spin=findClass(tree,'step-spin');
 assert.ok(spin);
 assert.equal(attrs(spin)['aria-hidden'],'true');
 const link=findClass(tree,'step-link');
 assert.equal(attrs(link).href,'https://example.com/od');
 assert.equal(attrs(link).rel,'noreferrer');
 assert.equal(textOf(findClass(link,'step-domain')),'example.com');
});

test('build aplica a árvore: classes, data-*, listener e texto',()=>{
 class FakeNode{
  constructor(tag){this.tag=tag;this.children=[];this.attrs=new Map();this.dataset={};this.listeners=new Map();this.text='';this.__parent=null;}
  append(...nodes){
   for(const node of nodes){
    if(node.tag==='#frag'){this.append(...node.children);continue;}
    if(node.__parent){const at=node.__parent.children.indexOf(node);if(at>=0)node.__parent.children.splice(at,1);}
    node.__parent=this;this.children.push(node);
   }
  }
  setAttribute(name,value){this.attrs.set(name,String(value));}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(event,fn){this.listeners.set(event,fn);}
 }
 const prev=globalThis.document;
 globalThis.document={
  createElement:(tag)=>new FakeNode(tag),
  createTextNode:(text)=>Object.assign(new FakeNode('#text'),{text:String(text)}),
  createDocumentFragment:()=>new FakeNode('#frag'),
 };
 try{
  const handlers={toggleWork:()=>{}};
  const tree=core.workLog(emptyWork(false,false,'Trabalhou por 8s · 1 busca'));
  const el=build(tree,handlers);
  assert.equal(el.tag,'article');
  assert.equal(el.attrs.get('class'),'work');
  assert.equal(el.attrs.get('data-live'),'false');
  assert.equal(el.attrs.get('data-expanded'),'false');
  const head=el.children[0];
  assert.equal(head.tag,'button');
  assert.equal(head.attrs.get('class'),'work-head');
  assert.equal(head.listeners.get('click'),handlers.toggleWork);
  const title=head.children.find(n=>n.attrs.get('class')==='work-title');
  assert.equal(title.children[0].text,'Trabalhou por 8s · 1 busca');
 }finally{
  globalThis.document=prev;
 }
});

test('cabeça e toggle têm key (foco sobrevive ao tick do turno vivo)',()=>{
 const tree=core.workLog({$:'WorkRow',live:true,expanded:true,title:'Pensando…',meta:'2s',steps:list(thinkStep({open:true}))});
 assert.equal(attrs(findClass(tree,'work-head')).key,'work-head');
 assert.equal(attrs(findClass(tree,'step-toggle')).key,'step-toggle-pensar-1');
});

test('mapa de tags do host fecha com o artefato (rename não vira error silencioso)',()=>{
 for(const [kind,tag] of Object.entries(VIEW_KIND_CORE))assert.equal(core.kindName(tag),kind);
 for(const [status,tag] of Object.entries(VIEW_STATUS_CORE))assert.equal(core.statusName(tag),status);
});
