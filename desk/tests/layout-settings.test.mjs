/* Editor visual de `desk.panels` (`src/layout-settings.mjs`).
 *
 * Testa a costura com o host sem navegador: um DOM falso mínimo (o mesmo
 * desenho do `pdfpageview.test.mjs`) sustenta `mountLayoutSettings` e os
 * helpers. O contrato que importa aqui é o dos campos e do read: prefer com
 * vírgula continua UM termo, o vaivém 2→1→2 preserva o não salvo só DENTRO da
 * abertura (o `fill` de reabrir reconstrói o slot 2) e o read nunca muta o
 * desk que recebeu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../src/layout-settings.mjs';

class FakeNode {
 constructor(tag){
  this.tag=tag;
  this.children=[];
  this.parent=null;
  this.attrs=new Map();
  this.listeners=new Map();
  this.textContent='';
  this.value='';
  this.checked=false;
  this.hidden=false;
 }
 append(...nodes){
  for(const node of nodes){node.parent=this;this.children.push(node);}
 }
 appendChild(node){this.append(node);return node;}
 setAttribute(name,value){this.attrs.set(name,String(value));}
 getAttribute(name){return this.attrs.has(name)?this.attrs.get(name):null;}
 replaceChildren(...nodes){
  for(const child of this.children)child.parent=null;
  this.children=[];
  this.append(...nodes);
 }
 addEventListener(event,fn){this.listeners.set(event,fn);}
 remove(){
  if(!this.parent)return;
  const at=this.parent.children.indexOf(this);
  if(at>=0)this.parent.children.splice(at,1);
  this.parent=null;
 }
 fire(event,payload={}){
  const fn=this.listeners.get(event);
  if(fn)fn(payload);
 }
}

globalThis.document={
 createElement:(tag)=>new FakeNode(tag),
 createTextNode:(value)=>Object.assign(new FakeNode('#text'),{textContent:String(value)}),
};

function findById(root,id){
 const queue=[root];
 while(queue.length){
  const node=queue.shift();
  if(node.attrs?.get('id')===id)return node;
  queue.push(...(node.children||[]));
 }
 return null;
}
function idsIn(root){
 const out=[];
 const queue=[root];
 while(queue.length){
  const node=queue.shift();
  const id=node.attrs?.get('id');
  if(id)out.push(id);
  queue.push(...(node.children||[]));
 }
 return out;
}
function tagsOf(root,tag){
 return (root.children||[]).filter((node)=>node.tag===tag);
}

function freshMount(){
 const container=new FakeNode('div');
 layout.mountLayoutSettings(container);
 return container;
}
function rootOf(container){return container.children[0];}
function chooseCount(container,n){
 const one=findById(rootOf(container),'cfg-layout-count-1');
 const two=findById(rootOf(container),'cfg-layout-count-2');
 one.checked=n===1;
 two.checked=n===2;
 (n===1?one:two).fire('change');
}
function type(container,input,value){
 input.value=value;
 container.fire('input',{target:input});
}
const twoPanelDesk=()=>({
 title:'Mesa de Estudos',
 panels:[
  {label:'Enunciado',prefer:['Limites'],toggle:''},
  {label:'Formulário & apoio',prefer:['Formul'],toggle:'Formulário'},
 ],
});

test('mountLayoutSettings monta uma vez e os ids/fieldsets/labels ficam únicos',()=>{
 const container=freshMount();
 const root=rootOf(container);
 assert.equal(root.tag,'div');
 assert.equal(root.attrs.get('class'),'cfg-layout');
 const ids=idsIn(root);
 for(const id of [
  'cfg-layout-count-1','cfg-layout-count-2',
  'cfg-layout-panel-1','cfg-layout-panel-2',
  'cfg-layout-label-1','cfg-layout-label-2',
  'cfg-layout-prefer-list-1','cfg-layout-prefer-list-2',
  'cfg-layout-prefer-add-1','cfg-layout-prefer-add-2',
  'cfg-layout-toggle-2',
  'cfg-layout-preview','cfg-layout-preview-pane-1','cfg-layout-preview-pane-2',
  'cfg-layout-preview-label-1','cfg-layout-preview-label-2',
  'cfg-layout-preview-prefer-1','cfg-layout-preview-prefer-2','cfg-layout-preview-toggle',
 ])assert.ok(ids.includes(id),`id ${id} existe`);
 assert.equal(new Set(ids).size,ids.length,'nenhum id repetido');
 for(const n of [1,2]){
  const panel=findById(root,`cfg-layout-panel-${n}`);
  assert.equal(panel.tag,'fieldset','cada leitor é um fieldset');
  assert.equal(tagsOf(panel,'legend')[0].children[0].textContent,`Leitor ${n}`);
  const label=panel.children.find((node)=>node.tag==='label'&&node.attrs.get('for')===`cfg-layout-label-${n}`);
  assert.ok(label,'o nome do leitor tem label for');
  assert.equal(findById(root,`cfg-layout-label-${n}`).tag,'input');
 }
 assert.equal(findById(root,'cfg-layout-toggle-2').attrs.get('type'),'text');
 const toggleLabel=findById(root,'cfg-layout-panel-2').children.find((node)=>node.tag==='label'&&node.attrs.get('for')==='cfg-layout-toggle-2');
 assert.ok(toggleLabel,'o toggle do 2º painel tem label for');
 assert.equal(findById(root,'cfg-layout-prefer-1-0').attrs.get('aria-label'),'Termo 1 do leitor 1');
 layout.mountLayoutSettings(container);
 assert.equal(container.children.length,1,'montar de novo no mesmo container não duplica');
});

test('fillLayoutSettings reflete o desk normalizado (2 leitores) e a prévia',()=>{
 const container=freshMount();
 const root=rootOf(container);
 layout.fillLayoutSettings(twoPanelDesk());
 assert.equal(findById(root,'cfg-layout-count-2').checked,true);
 assert.equal(findById(root,'cfg-layout-count-1').checked,false);
 assert.equal(findById(root,'cfg-layout-panel-2').hidden,false);
 assert.equal(findById(root,'cfg-layout-label-1').value,'Enunciado');
 assert.equal(findById(root,'cfg-layout-prefer-1-0').value,'Limites');
 assert.equal(findById(root,'cfg-layout-label-2').value,'Formulário & apoio');
 assert.equal(findById(root,'cfg-layout-prefer-2-0').value,'Formul');
 assert.equal(findById(root,'cfg-layout-toggle-2').value,'Formulário');
 assert.equal(findById(root,'cfg-layout-preview-label-1').textContent,'Enunciado');
 assert.equal(findById(root,'cfg-layout-preview-prefer-1').textContent,'Limites');
 assert.equal(findById(root,'cfg-layout-preview-label-2').textContent,'Formulário & apoio');
 assert.equal(findById(root,'cfg-layout-preview-prefer-2').textContent,'Formul');
 assert.equal(findById(root,'cfg-layout-preview-toggle').textContent,'Formulário');
});

test('um painel só esconde o segundo fieldset e a prévia; o slot 2 volta vazio',()=>{
 const container=freshMount();
 const root=rootOf(container);
 layout.fillLayoutSettings({title:'Mesa',panels:[
  {label:'Enunciado',prefer:['Limites'],toggle:''},
  {label:'Apoio antigo',prefer:['Tabela'],toggle:'Apoio'},
 ]});
 layout.fillLayoutSettings({title:'Mesa',panels:[{label:'Lista',prefer:['lista'],toggle:''}]});
 assert.equal(findById(root,'cfg-layout-count-1').checked,true);
 assert.equal(findById(root,'cfg-layout-count-2').checked,false);
 assert.equal(findById(root,'cfg-layout-panel-2').hidden,true);
 assert.equal(findById(root,'cfg-layout-preview-pane-2').hidden,true);
 assert.equal(findById(root,'cfg-layout-label-1').value,'Lista');
 assert.equal(findById(root,'cfg-layout-prefer-1-0').value,'lista');
 // O fieldset 2 continua montado (não é destruído), mas sem sobras da config
 // anterior: vazio + placeholder, que o normalizeDesk herda no save.
 assert.equal(findById(root,'cfg-layout-label-2').value,'','slot 2 vazio, não a sobra da config anterior');
 assert.equal(findById(root,'cfg-layout-toggle-2').value,'');
 const rows=findById(root,'cfg-layout-prefer-list-2').children;
 assert.equal(rows.length,1,'o slot 2 fica com exatamente uma linha de termo');
 assert.equal(rows[0].children[0].value,'','a linha do slot 2 fica vazia');
});

test('readLayoutSettings devolve cópia, preserva o resto e não muta a original',()=>{
 const container=freshMount();
 const root=rootOf(container);
 const original={
  title:'Mesa da Ana',
  calculator:false,
  panels:[
   {label:'Antigo',prefer:['A'],toggle:'T0',extra:'fica'},
   {label:'Apoio antigo',prefer:['B'],toggle:'B'},
  ],
 };
 const snapshot=JSON.parse(JSON.stringify(original));
 layout.fillLayoutSettings(original);
 type(container,findById(root,'cfg-layout-label-1'),'Enunciado novo');
 type(container,findById(root,'cfg-layout-label-2'),'Apoio novo');
 type(container,findById(root,'cfg-layout-toggle-2'),'Tabela');
 const out=layout.readLayoutSettings(original);
 assert.notEqual(out,original,'o retorno é uma cópia');
 assert.deepEqual(original,snapshot,'a original não muda');
 assert.equal(out.title,'Mesa da Ana');
 assert.equal(out.calculator,false);
 assert.deepEqual(out.panels[0],{label:'Enunciado novo',prefer:['A'],toggle:'T0',extra:'fica'},'o toggle/chaves extras do 1º painel ficam');
 assert.deepEqual(out.panels[1],{label:'Apoio novo',prefer:['B'],toggle:'Tabela'});
 chooseCount(container,1);
 const one=layout.readLayoutSettings(original);
 assert.equal(one.panels.length,1,'com um leitor o read ignora o segundo');
 assert.deepEqual(one.panels[0],out.panels[0]);
});

test('prefer é um termo por input: vírgula salva não é partida; add/remove preservam a ordem',()=>{
 const container=freshMount();
 const root=rootOf(container);
 const desk={panels:[{label:'Lista',prefer:['Lista, parte 1','Limites'],toggle:''}]};
 layout.fillLayoutSettings(desk);
 assert.equal(findById(root,'cfg-layout-prefer-1-0').value,'Lista, parte 1');
 assert.equal(findById(root,'cfg-layout-prefer-1-1').value,'Limites');
 assert.deepEqual(layout.readLayoutSettings(desk).panels[0].prefer,['Lista, parte 1','Limites']);
 findById(root,'cfg-layout-prefer-add-1').fire('click');
 const added=findById(root,'cfg-layout-prefer-1-2');
 assert.ok(added,'o novo termo ganha id único');
 type(container,added,'Derivadas');
 assert.deepEqual(layout.readLayoutSettings(desk).panels[0].prefer,['Lista, parte 1','Limites','Derivadas']);
 findById(root,'cfg-layout-prefer-remove-1-1').fire('click');
 assert.deepEqual(layout.readLayoutSettings(desk).panels[0].prefer,['Lista, parte 1','Derivadas']);
});

test('2→1→2 dentro da mesma abertura preserva o segundo leitor não salvo',()=>{
 const container=freshMount();
 const root=rootOf(container);
 const desk=twoPanelDesk();
 layout.fillLayoutSettings(desk);
 type(container,findById(root,'cfg-layout-label-2'),'Apoio editado');
 type(container,findById(root,'cfg-layout-prefer-2-0'),'Tabela');
 type(container,findById(root,'cfg-layout-toggle-2'),'Apoio');
 chooseCount(container,1);
 assert.equal(findById(root,'cfg-layout-panel-2').hidden,true);
 chooseCount(container,2);
 assert.equal(findById(root,'cfg-layout-panel-2').hidden,false);
 assert.equal(findById(root,'cfg-layout-label-2').value,'Apoio editado');
 assert.equal(findById(root,'cfg-layout-prefer-2-0').value,'Tabela');
 assert.equal(findById(root,'cfg-layout-toggle-2').value,'Apoio');
 const out=layout.readLayoutSettings(desk);
 assert.equal(out.panels.length,2);
 assert.equal(out.panels[1].label,'Apoio editado');
 assert.deepEqual(out.panels[1].prefer,['Tabela']);
 assert.equal(out.panels[1].toggle,'Apoio');
});

test('cancelar e reabrir: o slot 2 volta vazio, não ressuscita a edição cancelada',()=>{
 const container=freshMount();
 const root=rootOf(container);
 const saved={title:'Mesa',panels:[{label:'Lista',prefer:['lista'],toggle:''}]};
 layout.fillLayoutSettings(saved);        // abre as Configurações (1 painel salvo)
 chooseCount(container,2);
 type(container,findById(root,'cfg-layout-label-2'),'Apoio cancelado');
 type(container,findById(root,'cfg-layout-prefer-2-0'),'Cancelado');
 type(container,findById(root,'cfg-layout-toggle-2'),'Cancelado');
 // Cancelar não lê nem salva: a próxima abertura só re-chama fill(saved).
 layout.fillLayoutSettings(saved);
 assert.equal(findById(root,'cfg-layout-count-1').checked,true);
 assert.equal(findById(root,'cfg-layout-panel-2').hidden,true);
 assert.equal(findById(root,'cfg-layout-label-2').value,'','edição cancelada não fica escondida no DOM');
 assert.equal(findById(root,'cfg-layout-prefer-2-0').value,'');
 assert.equal(findById(root,'cfg-layout-toggle-2').value,'');
 chooseCount(container,2);
 assert.equal(findById(root,'cfg-layout-label-2').value,'','ligar 2 de novo não ressuscita o cancelado');
 assert.equal(findById(root,'cfg-layout-preview-label-2').textContent,'Formulário & apoio','a prévia mostra a herança');
 assert.equal(findById(root,'cfg-layout-preview-prefer-2').textContent,'padrão: Formul');
 assert.equal(findById(root,'cfg-layout-preview-toggle').textContent,'Formulário');
 const out=layout.readLayoutSettings(saved);
 assert.equal(out.panels.length,2);
 assert.deepEqual(out.panels[1],{label:'',prefer:[],toggle:''},'salvar sem editar passa vazio; o backend herda o slot');
});

test('trocar a fonte two-panel→one-panel não vaza valores; fill de novo repõe o salvo',()=>{
 const container=freshMount();
 const root=rootOf(container);
 const two={title:'Mesa',panels:[
  {label:'Enunciado',prefer:['Limites'],toggle:''},
  {label:'Apoio',prefer:['Tabela'],toggle:'Apoio'},
 ]};
 const one={title:'Mesa',panels:[{label:'Lista',prefer:['lista'],toggle:''}]};
 layout.fillLayoutSettings(two);
 assert.equal(findById(root,'cfg-layout-label-2').value,'Apoio');
 layout.fillLayoutSettings(one);
 assert.equal(findById(root,'cfg-layout-label-2').value,'','sem vazamento da config de 2 painéis');
 assert.equal(findById(root,'cfg-layout-prefer-2-0').value,'');
 assert.equal(findById(root,'cfg-layout-toggle-2').value,'');
 chooseCount(container,2);
 assert.equal(findById(root,'cfg-layout-label-2').value,'','o 2º só aparece vazio até editar');
 layout.fillLayoutSettings(two);
 assert.equal(findById(root,'cfg-layout-label-2').value,'Apoio','fill repõe o que está salvo na fonte nova');
 assert.equal(findById(root,'cfg-layout-prefer-2-0').value,'Tabela');
 assert.equal(findById(root,'cfg-layout-toggle-2').value,'Apoio');
 assert.equal(findById(root,'cfg-layout-panel-2').hidden,false,'com 2 salvos o painel já abre à mostra');
});

test('desk sem panels abre com 1 leitor e o slot 2 limpo',()=>{
 const container=freshMount();
 const root=rootOf(container);
 layout.fillLayoutSettings(twoPanelDesk());
 layout.fillLayoutSettings({title:'Mesa'});
 assert.equal(findById(root,'cfg-layout-count-1').checked,true);
 assert.equal(findById(root,'cfg-layout-panel-2').hidden,true);
 assert.equal(findById(root,'cfg-layout-label-1').value,'');
 assert.equal(findById(root,'cfg-layout-prefer-1-0').value,'');
 assert.equal(findById(root,'cfg-layout-label-2').value,'');
 assert.equal(findById(root,'cfg-layout-toggle-2').value,'');
 assert.equal(findById(root,'cfg-layout-prefer-list-2').children.length,1,'slot 2 com uma linha vazia');
});

test('campo vazio passa vazio no read (o normalizeDesk herda o default)',()=>{
 const container=freshMount();
 const root=rootOf(container);
 const desk=twoPanelDesk();
 layout.fillLayoutSettings(desk);
 type(container,findById(root,'cfg-layout-label-1'),'   ');
 type(container,findById(root,'cfg-layout-prefer-1-0'),'   ');
 type(container,findById(root,'cfg-layout-toggle-2'),'   ');
 const out=layout.readLayoutSettings(desk);
 assert.equal(out.panels[0].label,'','label vazio não vira default no read');
 assert.deepEqual(out.panels[0].prefer,[],'termo vazio sai da lista');
 assert.equal(out.panels[1].toggle,'','toggle vazio não vira default no read');
 assert.equal(out.panels[1].label,'Formulário & apoio','o que não foi tocado continua');
});

test('a prévia acompanha digitação e a troca de leitores',()=>{
 const container=freshMount();
 const root=rootOf(container);
 layout.fillLayoutSettings({panels:[{label:'Enunciado',prefer:['Limites'],toggle:''}]});
 type(container,findById(root,'cfg-layout-label-1'),'Lista');
 type(container,findById(root,'cfg-layout-prefer-1-0'),'lista');
 assert.equal(findById(root,'cfg-layout-preview-label-1').textContent,'Lista');
 assert.equal(findById(root,'cfg-layout-preview-prefer-1').textContent,'lista');
 chooseCount(container,2);
 assert.equal(findById(root,'cfg-layout-preview-pane-2').hidden,false);
 assert.equal(findById(root,'cfg-layout-preview-label-2').textContent,'Formulário & apoio','vazio na prévia mostra o default herdado');
 assert.equal(findById(root,'cfg-layout-preview-prefer-2').textContent,'padrão: Formul');
 assert.equal(findById(root,'cfg-layout-preview-toggle').textContent,'Formulário');
 chooseCount(container,1);
 assert.equal(findById(root,'cfg-layout-preview-pane-2').hidden,true);
 assert.equal(findById(root,'cfg-layout-preview-label-1').textContent,'Lista');
});
