import assert from 'node:assert/strict';

/* Medidas de layout compartilhadas pelos testes de janela (ticket #7 da spec de
   redesenho): o que está colado em quê, alturas de barra, recuo, largura da
   página do PDF e controles que saem da tela. `measure` lê a janela de uma vez;
   `assertLayout` cobra as regras sobre essa leitura. Vale para a matéria com
   leitores à vista (um ou dois, com ou sem chat lateral, tutor aberto ou
   recolhido); Caderno, GeoGebra e o vazio da aba Livre trocam a coluna dos
   leitores por outra coisa e não são medidos aqui. */

export const HEADER=44,BAR=40,PAD=12;
/* Barra de rolagem do sistema, quando ocupa espaço ao lado da página. */
const SCROLLBAR=17;

/* O leitor refaz o ajuste de largura com atraso (ResizeObserver + 120ms):
   espera a largura das páginas ficar igual por 6 leituras de 50 ms (300 ms,
   mais que o atraso do leitor). */
export async function settle(page){
 await page.evaluate(()=>{window.__layoutSettle=null;});
 await page.waitForFunction(()=>{
  const now=[...document.querySelectorAll('.pdf-page')].map(el=>Math.round(el.getBoundingClientRect().width)).join(',');
  const last=window.__layoutSettle;
  window.__layoutSettle=last&&last.signature===now?{signature:now,reads:last.reads+1}:{signature:now,reads:1};
  return window.__layoutSettle.reads>=6;
 },undefined,{timeout:10000,polling:50});
}

/* Tudo o que as asserções usam, medido de uma vez na janela. */
export function measure(page){
 return page.evaluate(()=>{
  const shown=el=>{
   if(!el)return false;
   const cs=getComputedStyle(el),r=el.getBoundingClientRect();
   return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';
  };
  const rect=el=>{
   if(!shown(el))return null;
   const r=el.getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
  };
  const q=(sel,root=document)=>root.querySelector(sel);
  const name=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).join('.'):'');
  const radius=el=>{const cs=getComputedStyle(el);return [cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' ');};
  const box=el=>shown(el)?{name:name(el),...rect(el),radius:radius(el),separator:el.getAttribute('role')==='separator'}:null;
  const children=el=>el?[...el.children].filter(shown).map(box):[];
  /* Um controle "sai da tela" quando passa da janela ou é cortado por um
     ancestral que não rola naquele eixo. Dentro de uma área que rola, basta
     rolar para alcançá-lo. */
  const offscreen=[];
  for(const el of document.querySelectorAll('header button,header select,header input,main button,main select,main input,main textarea,main [role=separator]')){
   if(!shown(el)||el.type==='file'||Number(getComputedStyle(el).opacity)===0)continue;
   const r=el.getBoundingClientRect();
   let scrollsX=false,scrollsY=false,why='';
   for(let node=el.parentElement;node&&node!==document.documentElement&&!why;node=node.parentElement){
    const cs=getComputedStyle(node),b=node.getBoundingClientRect();
    if(/auto|scroll/.test(cs.overflowX))scrollsX=true;
    if(/auto|scroll/.test(cs.overflowY))scrollsY=true;
    if(!scrollsX&&/hidden|clip/.test(cs.overflowX)&&(r.left<b.left-1||r.right>b.right+1))why=`cortado na horizontal por ${name(node)}`;
    if(!scrollsY&&/hidden|clip/.test(cs.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))why=`cortado na vertical por ${name(node)}`;
   }
   if(!why&&!scrollsX&&(r.left<-1||r.right>innerWidth+1))why='fora da janela na horizontal';
   if(!why&&!scrollsY&&(r.top<-1||r.bottom>innerHeight+1))why='fora da janela na vertical';
   if(why)offscreen.push(`${name(el)} "${(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,24)}": ${why}`);
  }
  const readers=[...document.querySelectorAll('#pdf-grid .pdf-panel')].filter(shown).map(panel=>{
   const viewport=q('.pdf-viewport',panel);
   return {
    panel:box(panel),title:box(q('.pdf-title',panel)),
    viewport:box(viewport),foot:box(q('.pdf-foot',panel)),
    client:viewport.clientWidth,scrollWidth:viewport.scrollWidth,
    page:rect(q('.pdf-page',panel)),canvas:rect(q('.pdf-page canvas',panel)),
    label:rect(q('.pdf-title strong',panel)),select:rect(q('.pdf-title .pdf-select',panel)),lastIcon:rect(q('.pdf-title .more svg',panel)),
    hasToolsRow:!!q('.pdf-tools',panel),
    zoom:q('.zoom-label',panel).textContent.trim()
   };
  });
  const sidechat=q('#sidechat');
  return {
   vw:innerWidth,vh:innerHeight,docScroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,
   header:box(q('header')),main:box(q('main')),
   references:box(q('#references')),divider:box(q('#divider')),sidebar:box(q('#sidebar')),
   column:children(q('#references')),grid:box(q('#pdf-grid')),row:children(q('#pdf-grid')),slot:children(q('#support-body')),
   readers,sidechat:box(sidechat),sidechatHead:box(q('.sidechat-head')),sidechatTitle:rect(q('.sidechat-head-title')),
   sidechatLastIcon:rect(q('#sidechat-close svg')),sidechatScope:rect(q('#sidechat-scope')),sidechatBox:rect(q('#sidechat-box')),
   chatHead:box(q('.chat-head')),chatScroll:q('#chat').scrollTop,tutorLabel:rect(q('.chat-head .session-title')),indicator:rect(q('#model-indicator')),indicatorRow:rect(q('#composer-box .composer-actions')),checkBtn:rect(q('#check')),sendBtn:rect(q('#send:not([hidden]),#stop:not([hidden])')),chatActions:rect(q('.chat-head-actions')),tutorLastIcon:rect(q('#chat-more svg')),
   prompt:rect(q('#prompt')),navStart:rect(q('header .header-nav')),offscreen
  };
 });
}

export const near=(a,b,tol=.6)=>Math.abs(a-b)<=tol;
/* Vizinhos numa direção: o primeiro encosta no início, cada um começa onde o
   anterior termina e o último encosta no fim. */
function assertChain(label,items,axis,start,end){
 const [a,b]=axis==='x'?['left','right']:['top','bottom'];
 assert.ok(items.length>0,`${label}: há o que medir`);
 assert.ok(near(items[0][a],start),`${label}: ${items[0].name} encosta no início (${items[0][a]} ≠ ${start})`);
 for(let i=1;i<items.length;i++)assert.ok(near(items[i][a],items[i-1][b]),`${label}: ${items[i].name} encosta em ${items[i-1].name} (folga de ${items[i][a]-items[i-1][b]}px)`);
 assert.ok(near(items.at(-1)[b],end),`${label}: ${items.at(-1).name} encosta no fim (${items.at(-1)[b]} ≠ ${end})`);
}
function assertSpan(label,items,axis,start,end){
 const [a,b]=axis==='x'?['left','right']:['top','bottom'];
 for(const item of items)assert.ok(near(item[a],start)&&near(item[b],end),`${label}: ${item.name} vai de ponta a ponta (${item[a]}..${item[b]} de ${start}..${end})`);
}
function assertPad(label,what,distance){
 assert.ok(near(distance,PAD,1),`${label}: ${what} a ${PAD}px da borda (${distance})`);
}

/* `readers`: quantos leitores têm de estar à vista (sem valor, não cobra).
   `oneLine`, que alguns chamadores ainda passam, é ignorado — a barra do leitor é
   uma linha de 40px exatos em qualquer janela (ticket #11), não um múltiplo. */
export function assertLayout(m,label,{readers}={}){
 /* Sem rolagem horizontal e nada fora da tela ou cortado. */
 assert.ok(m.docScroll<=m.vw+1&&m.bodyScroll<=m.vw+1,`${label}: sem rolagem horizontal (${m.docScroll}/${m.bodyScroll} de ${m.vw})`);
 assert.deepEqual(m.offscreen,[],`${label}: nenhum controle sai da tela`);
 assert.ok(m.grid,`${label}: leitores à vista`);
 if(readers!==undefined)assert.equal(m.readers.length,readers,`${label}: ${readers} leitor(es) à vista`);

 /* Planos colados: linhas de cima a baixo, colunas de lado a lado. */
 const rows=[m.header,m.main].filter(Boolean);
 assertChain(`${label} linhas`,rows,'y',0,m.vh);
 assertSpan(`${label} linhas`,rows,'x',0,m.vw);
 const cols=[m.references,m.divider,m.sidebar];
 assertChain(`${label} colunas`,cols,'x',0,m.vw);
 assertSpan(`${label} colunas`,cols,'y',m.main.top,m.vh);
 assertChain(`${label} coluna dos leitores`,m.column,'y',m.main.top,m.vh);
 assertSpan(`${label} coluna dos leitores`,m.column,'x',0,m.references.right);
 assertChain(`${label} leitores lado a lado`,m.row,'x',m.grid.left,m.grid.right);
 assertSpan(`${label} leitores lado a lado`,m.row,'y',m.grid.top,m.grid.bottom);
 for(const line of [m.divider,...m.row.filter(item=>item.separator)])assert.ok(line.width<=1,`${label}: ${line.name} é uma linha de 1px (${line.width})`);
 if(m.slot.length){
  const slot=m.row.at(-1);
  /* A área de apoio pode trazer a sua linha de 1px à esquerda. */
  for(const item of m.slot){
   assert.ok(item.left-slot.left<=1&&near(item.right,slot.right),`${label}: ${item.name} ocupa a área de apoio de lado a lado`);
   assert.ok(near(item.top,slot.top)&&near(item.bottom,slot.bottom),`${label}: ${item.name} ocupa a área de apoio de cima a baixo`);
  }
 }

 /* Sem raio de cartão nos painéis nem nas barras. */
 for(const item of [m.references,m.sidebar,m.sidechat,...m.column,...m.row,...m.slot,...m.readers.flatMap(r=>[r.panel,r.title,r.viewport])].filter(Boolean)){
  assert.equal(item.radius,'0px 0px 0px 0px',`${label}: ${item.name} sem raio de cartão`);
 }

 /* Alturas: 44px em cima; 40px por linha nas barras de painel. */
 assert.ok(near(m.header.height,HEADER),`${label}: barra superior com ${HEADER}px (${m.header.height})`);
 for(const bar of [m.chatHead,m.sidechatHead,...m.readers.map(r=>r.title)].filter(Boolean)){
  const lines=Math.round(bar.height/BAR);
  assert.ok(lines>=1&&near(bar.height,lines*BAR),`${label}: ${bar.name} tem ${BAR}px por linha (${bar.height})`);
 }
 /* Mesma linha: as barras dos leitores entre si, e a do tutor com a primeira
    barra da coluna dos leitores; o cabeçalho do chat lateral também fica na
    mesma linha (ticket #19). */
 const [lead]=m.readers;
 for(const r of m.readers){
  assert.ok(near(r.title.top,lead.title.top),`${label}: barras dos leitores na mesma linha`);
  assert.ok(near(r.title.height,BAR),`${label}: barra do leitor com uma linha de ${BAR}px (${r.title.height})`);
  assert.equal(r.hasToolsRow,false,`${label}: o leitor não tem segunda linha de ferramentas`);
 }
 /* Em janela baixa a coluna do tutor rola inteira: a barra é medida no repouso.
    Com o tutor recolhido não há barra para medir. */
 if(m.chatHead)assert.ok(near(m.chatHead.top+m.chatScroll,m.column[0].top),`${label}: barra do tutor na mesma linha da primeira barra da coluna dos leitores (${m.chatHead.top+m.chatScroll} ≠ ${m.column[0].top})`);

 /* Recuo interno de 12px (o último ícone de uma barra compensa a própria folga). */
 assertPad(label,'começo das matérias',m.navStart.left);
 if(m.tutorLabel)assertPad(label,'primeiro item do cabeçalho do tutor',m.tutorLabel.left-m.sidebar.left);
 if(m.tutorLastIcon)assertPad(label,'último ícone da barra do tutor',m.sidebar.right-m.tutorLastIcon.right);
 /* Indicador de modelo e esforço (#42): na fileira da caixa de mensagem, entre
    o Conferir e o Enviar/Parar, sem vazar da fileira; o título da sessão
    continua com um pedaço clicável. */
 if(m.tutorLabel)assert.ok(m.tutorLabel.width>=40,`${label}: o título da sessão segue clicável (${m.tutorLabel.width}px)`);
 if(m.indicator&&m.indicatorRow&&m.sendBtn&&m.indicator.width>0){
  if(m.checkBtn&&m.checkBtn.width>0)assert.ok(m.indicator.left>=m.checkBtn.right-.5,`${label}: o indicador começa depois do Conferir`);
  assert.ok(m.indicator.right<=m.sendBtn.left+.5,`${label}: o indicador termina antes do Enviar (${m.indicator.right} > ${m.sendBtn.left})`);
  assert.ok(m.indicator.top>=m.indicatorRow.top-.5&&m.indicator.bottom<=m.indicatorRow.bottom+.5,`${label}: o indicador fica na fileira da caixa`);
 }
 if(m.prompt){
  assertPad(label,'caixa de mensagem (esquerda)',m.prompt.left-m.sidebar.left);
  assertPad(label,'caixa de mensagem (direita)',m.sidebar.right-m.prompt.right);
 }
 if(m.sidechatTitle)assertPad(label,'título do chat lateral',m.sidechatTitle.left-m.sidechat.left);
 if(m.sidechatLastIcon)assertPad(label,'último ícone do cabeçalho do chat lateral',m.sidechat.right-m.sidechatLastIcon.right);
 if(m.sidechatHead)assert.ok(near(m.sidechatHead.top,m.column[0].top),`${label}: cabeçalho do chat lateral na mesma linha das barras vizinhas (${m.sidechatHead.top} ≠ ${m.column[0].top})`);
 if(m.sidechatBox){
  assertPad(label,'caixa de mensagem do chat lateral (esquerda)',m.sidechatBox.left-m.sidechat.left);
  assertPad(label,'caixa de mensagem do chat lateral (direita)',m.sidechat.right-m.sidechatBox.right);
  assert.ok(m.sidechatScope&&m.sidechatScope.bottom<=m.sidechatBox.top+.6,`${label}: a linha de escopo fica acima da caixa de mensagem`);
  assert.ok(m.sidechatScope.left>=m.sidechat.left-.5&&m.sidechatScope.right<=m.sidechat.right+.5,`${label}: a linha de escopo cabe no chat lateral`);
 }
 for(const r of m.readers){
  /* Num leitor de ~250px o rótulo cede (nome acessível do painel) e o material abre a barra. */
  const first=r.label||r.select;
  assertPad(label,r.label?'rótulo do leitor':'material do leitor (sem rótulo)',first.left-r.panel.left);
  assertPad(label,'último ícone da barra do leitor',r.panel.right-r.lastIcon.right);
 }

 /* Leitor: barras, palco e rodapé colados; a página preenche a largura. */
 for(const [i,r] of m.readers.entries()){
  const tag=`${label} leitor ${i+1}`,stack=[r.title,r.viewport,r.foot].filter(Boolean);
  assertChain(tag,stack,'y',r.panel.top,r.panel.bottom);
  assertSpan(tag,stack,'x',r.panel.left,r.panel.right);
  if(r.viewport)assertFill(r,tag);
 }
}
/* A página (e o papel pintado nela) vai de uma borda à outra do leitor; só a
   barra de rolagem do sistema, quando ocupa espaço, pode ficar ao lado. */
export function assertFill(r,tag){
 assert.ok(r.page,`${tag}: há página`);
 assert.ok(near(r.page.left,r.viewport.left),`${tag}: a página encosta na borda esquerda do leitor (${r.page.left-r.viewport.left}px)`);
 assert.ok(near(r.page.width,r.client,1),`${tag}: a página preenche a largura útil (${r.page.width} de ${r.client})`);
 assert.ok(r.panel.width-r.page.width<=SCROLLBAR,`${tag}: a página preenche o leitor (${r.page.width} de ${r.panel.width})`);
 assert.ok(r.scrollWidth<=r.client+1,`${tag}: sem rolagem horizontal no leitor (${r.scrollWidth} de ${r.client})`);
 if(r.canvas)assert.ok(near(r.canvas.width,r.page.width,1),`${tag}: o papel ocupa a página inteira (${r.canvas.width} de ${r.page.width})`);
}
