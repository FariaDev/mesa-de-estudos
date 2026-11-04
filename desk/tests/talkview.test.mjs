import assert from 'node:assert/strict';
import test from 'node:test';
import core from '../src/generated/talkview.core.js';
import {childrenOf} from '../src/view-host.mjs';
import {ptText} from './pt-text.mjs';

const Nil={$:'Nil'};
const list=(...xs)=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),Nil);
const html=(value)=>({$:'Html',html:value});
const kids=(node)=>childrenOf(node?.kids||Nil);
function attrs(node){const out={};for(let a=node?.attrs;a&&a.$==='Con';a=a.tail)out[a.head.name]=ptText(a.head.value);return out;}
function text(node){if(!node)return '';if(node.$==='ViewText')return ptText(String(node.text||''));if(node.$==='Html')return node.html;return kids(node).map(text).join('');}
function findClass(node,name){if(node?.$==='ViewEl'&&attrs(node).class===name)return node;for(const kid of kids(node)){const hit=findClass(kid,name);if(hit)return hit;}return null;}

test('bolha vem do Bend com role, body HTML opaco, imagem e ações por Bool',()=>{
 const tree=core.message(true,html('<p>Olá</p>'),list('data:image/png;base64,AA'),true,true,false);
 assert.equal(tree.tag,'article');
 assert.deepEqual(attrs(tree),{class:'message user','data-role':'user'});
 assert.equal(text(findClass(tree,'role')),'Você');
 const body=findClass(tree,'body');
 assert.equal(kids(body)[0].$,'Html','Markdown/KaTeX atravessa como nó do host');
 assert.equal(kids(body)[0].html,'<p>Olá</p>');
 const shot=findClass(tree,'shot');
 assert.equal(attrs(shot).src,'data:image/png;base64,AA');
 assert.equal(attrs(shot).alt,'Imagem enviada');
 const actions=findClass(tree,'message-actions');
 assert.equal(attrs(actions).class,'message-actions','as ações moram num grupo próprio');
 const copy=findClass(tree,'msg-copy');
 assert.equal(attrs(copy)['on:click'],'CopyMessage');
 assert.equal(attrs(copy)['aria-label'],'Copiar','a ação é só ícone, com nome acessível');
 assert.equal(attrs(copy)['data-icon'],'copy','o glifo entra pelo andaime do host');
 assert.equal(attrs(findClass(tree,'msg-quote'))['on:click'],'QuoteMessage');
});

test('assistente mantém DOM 1:1 e pode ocultar copiar/citar',()=>{
 const tree=core.message(false,html('<p>Resposta</p>'),Nil,false,false,false);
 assert.deepEqual(attrs(tree),{class:'message assistant','data-role':'assistant'});
 assert.equal(text(findClass(tree,'role')),'Pi');
 assert.equal(findClass(tree,'msg-copy'),null);
 assert.equal(findClass(tree,'msg-quote'),null);
});

const asset=(over={})=>({$:'AssetRow',src:'data:image/png;base64,AA',path:'file:///tmp/plot.png',alt:'Imagem gerada',caption:'',...over});

test('figura hidratada: img.plot com path/alt do host e legenda opcional',()=>{
 const kids0=core.assetKids(asset());
 assert.equal(kids0.$,'Con');
 assert.deepEqual(attrs(kids0.head),{class:'plot',src:'data:image/png;base64,AA','data-path':'file:///tmp/plot.png',alt:'Imagem gerada',loading:'lazy',decoding:'async'});
 assert.equal(kids0.head.tag,'img');
 assert.equal(kids0.tail.$, 'Nil','sem legenda quando o Markdown não traz uma');
 const kids1=core.assetKids(asset({caption:'curva de teste'}));
 assert.equal(kids1.tail.head.tag,'figcaption');
 assert.equal(text(kids1.tail.head),'curva de teste');
 const figure=core.assetFigure(asset({caption:'plot.png'}));
 assert.equal(figure.tag,'figure');
 assert.deepEqual(attrs(figure),{class:'asset'});
 assert.equal(kids(figure).map(node=>node.tag).join(','),'img,figcaption');
 assert.equal(text(kids(figure)[1]),'plot.png');
});

test('fallback vira code cru; bloco de código ganha moldura, cópia e rótulo',()=>{
 const fallback=core.assetFallback('file:///tmp/sem.png');
 assert.equal(fallback.tag,'code');
 assert.equal(text(fallback),'file:///tmp/sem.png');
 const block=core.codeBlock(html('<pre class="hl"><code data-lang="js">x</code></pre>'),'JS');
 assert.deepEqual(attrs(block),{class:'codeblock'});
 const parts=kids(block);
 assert.deepEqual(parts.map(node=>node.tag||node.$),['div','Html'],'faixa de cabeçalho e depois o código');
 const head=parts[0];
 assert.deepEqual(attrs(head),{class:'code-head'});
 const headParts=kids(head);
 assert.deepEqual(headParts.map(node=>node.tag),['span','button'],'linguagem à esquerda e copiar à direita');
 assert.deepEqual(attrs(headParts[0]),{class:'code-lang'});
 assert.equal(text(headParts[0]),'JS');
 assert.deepEqual(attrs(headParts[1]),{type:'button',class:'code-copy','aria-label':'Copiar código'});
 assert.equal(text(headParts[1]),'cópia');
 assert.equal(parts[1].html,'<pre class="hl"><code data-lang="js">x</code></pre>');
 const noLang=core.codeBlock(html('<pre>x</pre>'),'');
 const noLangParts=kids(noLang);
 assert.deepEqual(noLangParts.map(node=>node.tag||node.$),['div','Html'],'sem rótulo quando o fence não declara linguagem');
 assert.deepEqual(kids(noLangParts[0]).map(node=>node.tag),['button'],'sem etiqueta, o copiar fica no cabeçalho');
});
