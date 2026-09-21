import assert from 'node:assert/strict';
import test from 'node:test';
import core from '../src/generated/talkview.core.js';
import {childrenOf} from '../src/view-host.mjs';

const Nil={$:'Nil'};
const list=(...xs)=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),Nil);
const html=(value)=>({$:'Html',html:value});
const kids=(node)=>childrenOf(node?.kids||Nil);
function attrs(node){const out={};for(let a=node?.attrs;a&&a.$==='Con';a=a.tail)out[a.head.name]=a.head.value;return out;}
function text(node){if(!node)return '';if(node.$==='ViewText')return String(node.text||'');if(node.$==='Html')return node.html;return kids(node).map(text).join('');}
function findClass(node,name){if(node?.$==='ViewEl'&&attrs(node).class===name)return node;for(const kid of kids(node)){const hit=findClass(kid,name);if(hit)return hit;}return null;}
function findHasClass(node,name){if(node?.$==='ViewEl'&&String(attrs(node).class||'').split(/\s+/).includes(name))return node;for(const kid of kids(node)){const hit=findHasClass(kid,name);if(hit)return hit;}return null;}

const option=(over={})=>({$:'QuizOptionRow',label:'$x$',index:'1',markup:html('<span class="katex">x</span>'),checked:false,disabled:false,correct:false,wrong:false,dim:false,mark:'',...over});
const quiz=(over={})=>({
 $:'QuizRow',toolId:'quiz-1',multi:false,question:html('<p>Quanto é <span class="katex">x</span>?</p>'),
 hasDetails:true,details:html('Escolha uma opção.'),options:list(option()),showSend:false,sendDisabled:false,showSkip:true,
 hasVerdict:false,verdict:'',hasNote:false,note:html(''),hasExplain:false,explain:html(''),...over,
});

test('bolha vem do Bend com role, body HTML opaco, imagem e ações por Bool',()=>{
 const tree=core.message(true,html('<p>Olá</p>'),list('data:image/png;base64,AA'),true,true);
 assert.equal(tree.tag,'article');
 assert.deepEqual(attrs(tree),{class:'message user','data-role':'user'});
 assert.equal(text(findClass(tree,'role')),'Você');
 const body=findClass(tree,'body');
 assert.equal(kids(body)[0].$,'Html','Markdown/KaTeX atravessa como nó do host');
 assert.equal(kids(body)[0].html,'<p>Olá</p>');
 const shot=findClass(tree,'shot');
 assert.equal(attrs(shot).src,'data:image/png;base64,AA');
 assert.equal(attrs(shot).alt,'Imagem enviada');
 assert.equal(attrs(findClass(tree,'msg-copy'))['on:click'],'CopyMessage');
 assert.equal(attrs(findClass(tree,'msg-quote'))['on:click'],'QuoteMessage');
});

test('assistente mantém DOM 1:1 e pode ocultar copiar/citar',()=>{
 const tree=core.message(false,html('<p>Resposta</p>'),Nil,false,false);
 assert.deepEqual(attrs(tree),{class:'message assistant','data-role':'assistant'});
 assert.equal(text(findClass(tree,'role')),'Pi');
 assert.equal(findClass(tree,'msg-copy'),null);
 assert.equal(findClass(tree,'msg-quote'),null);
});

test('citação, chips e estados vazio/digitando têm forma estável',()=>{
 assert.equal(core.citation('trecho').tag,'blockquote');
 assert.equal(attrs(core.citation('trecho')).class,'citation');
 assert.deepEqual(attrs(core.thinkingChip('Pensando')),{class:'talk-chip thinking','data-kind':'thinking'});
 assert.deepEqual(attrs(core.toolChip('Busca')),{class:'talk-chip tool','data-kind':'tool'});
 const empty=core.emptyState();
 assert.equal(attrs(empty).id,'welcome');
 assert.match(text(empty),/Conectar ao Pi.*Sessão local desta matéria\./);
 const typing=core.typingState('Pi está pensando…');
 assert.equal(attrs(typing).class,'message assistant typing');
 assert.equal(attrs(typing)['data-role'],'assistant');
 assert.match(text(typing),/Pi.*Pi está pensando…/);
});

test('quiz simples: pergunta/details HTML, radio, pular e handlers',()=>{
 const tree=core.quizCard(quiz());
 assert.deepEqual(attrs(tree),{class:'message assistant quiz','data-role':'assistant','data-tool':'quiz-1','aria-label':'Pergunta de quiz'});
 assert.equal(kids(findClass(tree,'quiz-question'))[0].$,'Html');
 assert.equal(kids(findClass(tree,'quiz-details'))[0].$,'Html');
 const button=findClass(tree,'quiz-option');
 assert.equal(attrs(button).role,'radio');
 assert.equal(attrs(button)['aria-checked'],'false');
 assert.equal(attrs(button)['on:click'],'SelectQuizOption');
 assert.equal(text(button),'1. <span class="katex">x</span>');
 assert.equal(findClass(tree,'quiz-send'),null);
 assert.equal(attrs(findClass(tree,'quiz-skip'))['on:click'],'SkipQuiz');
});

test('quiz múltiplo selecionado: checkbox, send habilitado e foco por key',()=>{
 const tree=core.quizCard(quiz({multi:true,options:list(option({checked:true})),showSend:true,showSkip:true}));
 assert.equal(attrs(tree)['aria-label'],'Quiz de múltipla escolha');
 const button=findClass(tree,'quiz-option');
 assert.equal(attrs(button).role,'checkbox');
 assert.equal(attrs(button)['aria-checked'],'true');
 assert.equal(attrs(button).key,'quiz-option-1');
 const send=findHasClass(tree,'quiz-send');
 assert.equal(attrs(send)['on:click'],'SendQuiz');
 assert.equal(attrs(send).key,'quiz-send');
 assert.equal('disabled' in attrs(send),false);
});

test('resultado do quiz fixa classes, marca, veredito, nota e explicação',()=>{
 const result=core.quizCard(quiz({
  options:list(option({disabled:true,correct:true,mark:'✓'})),showSkip:false,
  hasVerdict:true,verdict:'✓ Correta!',hasNote:true,note:html('<span class="katex">n</span>'),
  hasExplain:true,explain:html('<p class="math">explicação</p>'),
 }));
 const button=findHasClass(result,'quiz-option');
 assert.equal(attrs(button).class,'quiz-option correct');
 assert.equal(attrs(button).disabled,'');
 assert.equal(text(findClass(button,'quiz-mark')),'✓');
 assert.equal(text(findClass(result,'quiz-verdict')),'✓ Correta!');
 assert.equal(text(findClass(result,'quiz-note')),'Observação: <span class="katex">n</span>');
 assert.equal(text(findClass(result,'quiz-explain')),'<p class="math">explicação</p>');
 assert.equal(findClass(result,'quiz-actions'),null);
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
 assert.deepEqual(parts.map(node=>node.tag||node.$),['span','button','Html']);
 assert.deepEqual(attrs(parts[0]),{class:'code-lang'});
 assert.equal(text(parts[0]),'JS');
 assert.deepEqual(attrs(parts[1]),{type:'button',class:'code-copy','aria-label':'Copiar código'});
 assert.equal(text(parts[1]),'cópia');
 assert.equal(parts[2].html,'<pre class="hl"><code data-lang="js">x</code></pre>');
 const noLang=core.codeBlock(html('<pre>x</pre>'),'');
 assert.deepEqual(kids(noLang).map(node=>node.tag||node.$),['button','Html'],'sem rótulo quando o fence não declara linguagem');
});
