import {displayUserText,contentParts} from '../text.mjs';
import {$,S,toast,activity,activityLive,atBottom,connectionState,followBottom,refs,save,layoutSnapshot,setBusy,refreshMeter,connect,supportsCapability,syncChatScrollMode} from './state.mjs';
import {beginCaptureLock,captureLockValid,endCaptureLock} from './capture-lock.mjs';
import {createWorkLogView} from './worklog-view.mjs';
import {build,htmlNode,preserveFocus,renderChildren} from './view-host.mjs';
import {openReviewFromMessage} from './review.mjs';
import {renderImageChrome,renderPiDialog} from './dialogs.mjs';
import {claudeActivityNotice,claudeLimitNotice,deskErrorIsFatal,limitNoticeState,MAX_ANSWER_CHARS,questionRequest,questionSubmitAction} from './claude-questions.mjs';
import talkCore from './generated/talkview.core.js';
import attachview from './generated/attachview.core.js';
import attachCore from './generated/attachments.core.js';
import refCore from './generated/pdfref.core.js';
import * as worklog from './worklog.mjs';
import {markup,markupInline,assetLocalPath,attrValue,decorateCode} from './markdown.mjs';
/* O renderer Markdown+LaTeX vive em `markdown.mjs` (compartilhado com o chat
   lateral); o realce de código e o pipeline do antigo `chat.mjs` são os mesmos.
   `markup` é reexportado pela compatibilidade dos imports antigos. */
export {markup,markupInline};
function assetFallback(source){return build(talkCore.assetFallback(source));}
/* Fronteira dos assets: `markup` continua dono do HTML do Markdown — a figura
   nasce como placeholder (`figure.asset[data-asset]`) e o `<pre>` realçado sai
   do CODEPLACEHOLDER. A **forma** hidratada (img.plot + figcaption, o `code` de
   fallback e a moldura `.codeblock`) vem do `core/talkview.bend`; ler a imagem
   (IPC `readImage`), o overlay de cópia (clipboard) e os cliques delegados em
   `#messages` ficam aqui. */
function assetRow(source,src,alt,caption){return {$:'AssetRow',src,path:source,alt,caption};}
function hydrateAssets(root){
 for(const figure of root.querySelectorAll('figure.asset[data-asset]')){
  const source=figure.dataset.asset||'',caption=figure.dataset.caption||'';
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!figure.isConnected)return;
   if(!hit){figure.replaceWith(assetFallback(source));return;}
   renderChildren(figure,talkCore.assetKids(assetRow(source,hit.dataUrl,caption||hit.name||'Imagem gerada',caption||hit.name||'')));
   const img=figure.querySelector('img.plot');
   if(img)wrapCopy(img);
  }).catch(()=>{if(figure.isConnected)figure.replaceWith(assetFallback(source));});
 }
 for(const code of root.querySelectorAll('code')){
  if(code.closest('pre'))continue;
  const source=assetLocalPath(code.textContent);
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!hit||!code.isConnected)return;
   const figure=build(talkCore.assetFigure(assetRow(source,hit.dataUrl,hit.name||'Imagem gerada',hit.name||'')));
   const img=figure.querySelector('img.plot');
   if(img)wrapCopy(img);
   code.replaceWith(figure);
  }).catch(()=>{});
 }
}
function bendList(items){let out={$:'Nil'};for(let i=items.length-1;i>=0;i--)out={$:'Con',head:items[i],tail:out};return out;}
function message(role,text,images=[],parent=null){
 $('#welcome')?.remove();
 let el;
 const handlers={
  CopyMessage:async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(el._raw||el.querySelector('.body').innerText);toast('Mensagem copiada.');}catch(err){toast(err.message);}},
  SaveForReview:()=>openReviewFromMessage(el),
 };
 el=build(talkCore.message(role==='user',htmlNode(''),bendList(images),true,false,role!=='user'),handlers);
 if(role!=='user')el.querySelector('.role').textContent=S.agentLabel;
 (parent||$('#messages')).append(el);updateMessage(el,text,images);return el;
}
/* Citação → link (pedido 5): `Limites.pdf, p. 7` — o que o "Citar" escreve e o
   que o Pi costuma repetir — vira um botão que abre a página no leitor. Nome e
   página são decididos no núcleo (`pdfref.bend`); aqui é só o DOM. Nada dentro
   de código, link, fórmula ou quiz: ali é o texto do Pi, não citação.

   O candidato pode ter ESPAÇO ("Lista 2.pdf") e vem com a frase à esquerda
   ("veja o arquivo Lista 2.pdf"): por isso a classe aceita espaço (quebras de
   linha não) e o corte da esquerda é palavra a palavra, sem teto de tentativas
   — o teto é o tamanho do candidato (`maxCandidate` do núcleo). */
const REF_HINT=/[^\s()\[\]{}<>",;:][^()\[\]{}<>",;:\n\r\t]{0,199}?\.pdf/gi;
const NO_REFS='pre,code,a,.codeblock,.katex,.quiz-actions,.quiz-verdict,.quiz-details,.step';
function bendNameList(names){let out={$:'Nil'};for(let i=names.length-1;i>=0;i--)out={$:'Con',head:names[i],tail:out};return out;}
/* O candidato do regex pode trazer palavras coladas à esquerda ("veja o
   Limites.pdf", "e o resumo está no arquivo Lista 2.pdf"): o núcleo só conhece o
   nome inteiro, então o host encurta da esquerda até casar (ou desiste quando
   não há mais espaço). O primeiro casamento é o nome MAIS LONGO — "Lista
   2.pdf" antes de "2.pdf". */
function matchName(candidate,names){
 let probe=candidate;
 for(;;){
  const known=refCore.knownName(probe,names);
  if(known.$==='Some')return {name:known.value,offset:candidate.length-probe.length};
  const cut=probe.indexOf(' ');
  if(cut<0)return null;
  probe=probe.slice(cut+1);
 }
}
function linkifyRefs(root){
 const names=(S.library||[]).map(p=>String(p.name||'')).filter(Boolean);
 if(!names.length)return;
 const list=bendNameList(names);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];
 while(walker.nextNode()){
  const node=walker.currentNode;
  if(!node.nodeValue||!node.nodeValue.includes('.pdf'))continue;
  if(node.parentElement?.closest?.(NO_REFS))continue;
  nodes.push(node);
 }
 for(const node of nodes){
  const text=node.nodeValue;
  const found=[];
  let cursor=0;
  REF_HINT.lastIndex=0;
  let hit;
  while((hit=REF_HINT.exec(text))){
   const candidate=hit[0];
   const named=matchName(candidate,list);
   if(!named)continue;
   const start=hit.index+named.offset;
   if(start<cursor)continue;
   const cue=refCore.cueFrom(text.slice(hit.index+candidate.length));
   if(cue.$!=='Some')continue;
   const page=Number(cue.value.page);
   if(!Number.isFinite(page)||page<1)continue;
   const end=hit.index+candidate.length+Number(cue.value.length);
   found.push({start,end,name:named.name,page});
   cursor=end;
  }
  if(!found.length)continue;
  const frag=document.createDocumentFragment();
  let at=0;
  for(const item of found){
   if(item.start>at)frag.append(text.slice(at,item.start));
   const page=BigInt(item.page);
   const button=document.createElement('button');
   button.type='button';
   button.className='pdf-ref';
   button.dataset.name=item.name;
   button.dataset.page=String(item.page);
   const entry=(S.library||[]).find(p=>String(p.name||'')===item.name);
   if(entry)button.dataset.path=entry.path;
   button.textContent=refCore.refLabel(item.name,page);
   button.title=refCore.refTitle(item.name,page);
   button.setAttribute('aria-label',refCore.refAria(item.name,page));
   frag.append(button);
   at=item.end;
  }
  if(at<text.length)frag.append(text.slice(at));
  node.replaceWith(frag);
 }
}
/* Num lote de histórico a rolagem é medida uma vez (`showHistory`); durante o
   lote `paintMessage` não lê layout (o `atBottom()` por mensagem forçava um
   reflow por mensagem — com um token sem espaço de 20 KB, ~850 ms cada). */
let historyStick=null;
function paintMessage(el,text,images,live){
 /* "Estava no fim?" é medido antes de mexer no DOM: só aí a rolagem segue. */
 const stick=historyStick!==null?historyStick:(el.classList.contains('user')||atBottom());
 const body=el.querySelector('.body');
 const bodyTree=talkCore.messageBody(htmlNode(markup(displayUserText(text||''),!live)),bendList(images||[]));
 renderChildren(body,bodyTree.kids);
 if(!live)hydrateAssets(body);
 decorateCode(body);
 if(!live)linkifyRefs(body);
 for(const img of body.querySelectorAll('img.shot'))wrapCopy(img);
 if(historyStick===null)followBottom(stick);
}
function updateMessage(el,text,images,live){
 if(text!=null)el._raw=text;
 if(!live){clearTimeout(el._tick);el._tick=0;paintMessage(el,text,images);return;}
 el._live=text;if(el._tick)return;el._tick=setTimeout(()=>{el._tick=0;if(selectionInsideMessages())return;paintMessage(el,el._live,[],true);},80);
}
export function showHistory(messages){
 clearNotices();
 const turns=worklog.historyTurns(messages||[]);
 /* As últimas 6 imagens ficam; as mais antigas saem (mesma regra de antes). */
 let keep=6;
 for(let i=turns.length-1;i>=0;i--){
  const images=turns[i].userImages||[];
  if(!images.length)continue;
  const kept=[];
  for(let j=images.length-1;j>=0;j--){
   if(keep>0){keep--;kept.unshift(images[j]);}
  }
  turns[i].userImages=kept;
 }
 /* "Estava no fim?" é medido uma vez, antes do lote; o histórico inteiro monta
    num DocumentFragment e entra no DOM de uma vez. O padrão antigo (medir/rolar
    por mensagem) forçava um layout síncrono por mensagem: com um token sem
    espaço a quebra de linha patológica do Blink (~850 ms por layout) multiplicava
    pelas 102 mensagens e congelava o renderer por minutos. O modo de rolagem
    (classe `chat-scroll`) é acertado ANTES da medida para o `atBottom()` olhar o
    scroller de verdade já no primeiro render. */
 syncChatScrollMode();
 const stick=atBottom();
 $('#messages').replaceChildren();
 const frag=document.createDocumentFragment();
 historyStick=stick;
 try{
  for(const turn of turns){
   if(turn.userText||turn.userImages.length)message('user',turn.userText,turn.userImages,frag);
   if(turn.steps.length){
    const view=createWorkLogView();
    frag.append(view.el);
    view.render({steps:turn.steps,startedAt:turn.startedAt,endedAt:turn.endedAt,reason:'',text:turn.text},{live:false});
   }
   if(turn.text)message('assistant',turn.text,[],frag);
  }
 }finally{historyStick=null;}
 $('#messages').append(frag);
 followBottom(stick);
}
export async function doCompact(text){
 if(!supportsCapability('compact')){toast('Compactar o contexto não está disponível neste motor.');return;}
 if(S.busy){toast('Pare a resposta antes de compactar.');return;}
 const instructions=text.replace(/^\/compact\b/i,'').trim();
 try{activity('Compactando o contexto da conversa…');const result=await window.desk.compact(instructions);
  const before=Number(result?.tokensBefore)||0;
  toast(`Contexto compactado${before?` · ${before.toLocaleString('pt-BR')} tokens resumidos`:''}.`);
  activity('');refreshMeter();
 }catch(e){activity('');toast(e.message);}
}
/* `steer` envia com o Pi ocupado (o main manda `streamingBehavior:'steer'`: o Pi
   interrompe o turno e trata a mensagem agora) — só o #prompt (⌘/Ctrl+Enter) e a
   própria fila usam isso; sem steer, ocupado é recusado e quem enfileira é o
   `queue.mjs`. Devolve true quando a bolha saiu — a fila usa isso para decidir se
   o item foi embora. `refs` (fila): manda as referências do snapshot do enqueue
   em vez das páginas abertas agora. `images` explícito pula os atalhos de texto
   (`/compact`, `/conferir`) e não mexe na bandeja. */
export async function send(text,images,options={}){
 /* Steer só existe onde o motor oferece (capabilities.steer). Sem ele, ocupado
    é recusado: quem enfileira é o `queue.mjs`/o `#prompt` do main — a Mesa
    nunca finge interromper e reenviar. */
 const steer=options.steer===true&&supportsCapability('steer');
 if(options.steer===true&&!steer&&S.busy){toast(`${S.agentLabel} não interrompe a resposta — use a fila (⏎) ou espere.`);return false;}
 if(S.busy&&!steer)return false;
 const pending=images===undefined?S.attachments.slice():images;
 if(!text.trim()&&!pending.length)return false;
 if(images===undefined&&/^\/compact\b/i.test(text.trim())){if(!supportsCapability('compact')){toast('Compactar o contexto não está disponível neste motor.');return false;}if(S.busy){toast('Pare a resposta antes de compactar.');return false;}$('#prompt').value='';await doCompact(text.trim());return false;}
 /* `/conferir` digitado na mão não vai mais para o Pi (evita a captura dupla da
    extensão visual): redireciona para o anexo e devolve a observação como rascunho. */
 if(images===undefined&&/^\/conferir\b/i.test(text.trim())){const note=text.trim().replace(/^\/conferir\b/i,'').trim();$('#prompt').value='';await conferir();if(note)$('#prompt').value=note;return false;}
 let stage='save',userMessage=null,knownNotSent=false;
 try{
  setBusy(true);
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());stage='connect';await connect();stage='prompt';
  if(pending.length&&!S.supportsImages){setBusy(false);toast('Escolha um modelo com suporte a imagens para anexar.');return false;}
  userMessage=message('user',text,pending.map(item=>item.dataUrl));
  if(images===undefined&&$('#prompt').value===text)$('#prompt').value='';
  const result=await window.desk.prompt({text,refs:options.refs||refs(),images:pending.map(item=>typeof item==='string'?item:{dataUrl:item.dataUrl,capturedAt:item.capturedAt,exercise:item.exercise}),steer});
  if(result?.sent===false){knownNotSent=result.retryable===true;throw Error(result.error||`O ${S.agentLabel} recusou a mensagem.`);}
  if(images===undefined)clearAttachments(pending);
  /* `streaming` só libera o composer quando o Pi DISSE que não está no turno.
     Estado desconhecido (a leitura falhou depois do aceite) NÃO é envio falho:
     o item sai da fila e o aviso aparece — quem fecha o turno, nesse caso, são
     os eventos do Pi (ou o erro de conexão). */
  if(result?.streaming===false)setBusy(false);
  if(result?.warning)toast(result.warning);
  return true;
 }catch(e){
  const safe=stage==='save'||stage==='connect'||knownNotSent;
  if(knownNotSent)userMessage?.remove();
  if(images===undefined&&!$('#prompt').value){$('#prompt').value=text;save();}
  options.onFailure?.(safe);
  setBusy(false);toast(e.message);return false;
 }
}
/* dataURL → File sem `fetch` (o CSP do index.html não deixa `connect-src data:`):
   o base64 é decodificado na mão. */
function dataUrlFile(dataUrl,name){
 if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/'))return null;
 const mime=/^data:([^;,]+)/.exec(dataUrl)?.[1]||'image/png';
 try{
  const bin=atob(dataUrl.slice(dataUrl.indexOf(',')+1));
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new File([bytes],name,{type:mime});
 }catch{return null;}
}
/* Conferir Xournal++ virou anexo: captura a janela do Xournal++ e entrega a
   imagem na bandeja (`addAttachments` herda re-encode, teto de bytes e o aviso
   de modelo sem visão). Nada vai para o Pi sozinho — o usuário escreve e envia
   junto; uma imagem por captura no JSONL. O requisito de visão é do envio.
   B6: clique duplo engole o segundo clique (uma captura em voo por vez) e a
   matéria/sessão de destino fica FIXADA — se ela mudou durante a captura, a
   imagem é descartada em vez de pousar na conversa de outra matéria. */
export async function conferir(){
 if(S.busy)return;
 if(S.appConfig.desk?.conferir===false)return;
 if(!S.captureOk){toast('Conferir Xournal++ indisponível neste computador.');return;}
 const lock=beginCaptureLock(S);
 if(!lock)return;
 /* O exercício anotado é o que estava ativo no momento da captura: se o usuário
    trocar de exercício antes de enviar, o contexto avisa em vez de deixar a
    captura passar por tentativa do exercício de agora. */
 const exerciseAtCapture=S.appConfig.desk?.studyContext===false?'':(layoutSnapshot().study?.title||'');
 try{
  const shot=await window.desk.captureReady();
  if(!captureLockValid(S,lock)){toast('A matéria mudou durante a captura — captura descartada.');return;}
  const file=dataUrlFile(shot?.dataUrl,'xournal.png');
  if(!file){toast('A captura não produziu uma imagem válida.');return;}
  const added=await addAttachments([file],{capturedAt:Date.now(),exercise:exerciseAtCapture});
  if(!added)return;
  toast('Captura do Xournal++ anexada — escreva e envie.');
  $('#prompt').focus();
 }catch(e){toast(e.message);}
 finally{endCaptureLock(S,lock);}
}
export async function conferirGeogebra(){
 if(S.busy||S.connecting||S.switching)return;
 /* O applet manual continua na aba GeoGebra; o que depende do agente (a
    ferramenta geogebra) só existe onde o motor oferece. */
 if(!supportsCapability('geogebra')){toast('Conferir o GeoGebra com o agente não está disponível neste motor — o applet manual continua na aba GeoGebra.');return;}
 if(!S.connected){toast(`Conecte ao ${S.agentLabel} antes de conferir o GeoGebra.`);return;}
 if(!S.supportsImages){toast('Este modelo não aceita imagens; escolha um modelo com visão.');return;}
 try{
  setBusy(true);
  const shot=await window.desk.ggbShot();
  const note=$('#prompt').value.trim();
  const label=note?`Conferir GeoGebra\n${note}`:'Conferir GeoGebra';
  message('user',label,[shot.dataUrl]);
  $('#prompt').value='';
  const text=note||'Confira o applet GeoGebra (print anexo): o gráfico/construção está coerente com o problema? Aponte o primeiro problema relevante. Use a ferramenta geogebra (state) se precisar dos detalhes.';
  const result=await window.desk.prompt({text,refs:refs()});
  if(result?.streaming===false)setBusy(false);
  if(result?.warning)toast(result.warning);
 }catch(e){setBusy(false);toast(e.message);}
}
const ATTACH_TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif']);
/* Números do núcleo (`core/attachments.bend`), não literais: MAX_ATTACH é a
   contagem por mensagem e MAX_ATTACH_BYTES é o teto de bytes crus do envio
   aplicado já ao anexar — a mesma recusa que o main faria depois, um passo
   antes. (maxImages é Nat: em JS chega como BigInt.) */
export const MAX_ATTACH=Number(attachCore.maxImages()),MAX_ATTACH_BYTES=attachCore.maxRawBytes();
const ATTACH_MAX_EDGE=1568;
async function prepareAttachment(file){
 const type=file.type||'image/png';
 if(type==='image/gif')return null;
 try{
  const bmp=await createImageBitmap(file);
  try{
   if(Math.max(bmp.width,bmp.height)<=ATTACH_MAX_EDGE)return null;
   const scale=ATTACH_MAX_EDGE/Math.max(bmp.width,bmp.height);
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bmp.width*scale));
   canvas.height=Math.max(1,Math.round(bmp.height*scale));
   const ctx=canvas.getContext('2d');
   if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
   ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
   const mime=type==='image/jpeg'?'image/jpeg':(type==='image/webp'?'image/webp':'image/png');
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime));
   return blob&&blob.size<file.size?blob:null;
  }finally{bmp.close?.();}
 }catch{return null;}
}
function imageFiles(list){return [...(list||[])].filter(file=>file&&ATTACH_TYPES.has(file.type));}
/* A lista de anexos vem de `core/attachview.bend` (a Conversa usa o mesmo
   núcleo); o host resolve os fatos (alt/rótulo/key/handler) e guarda o estado
   vivo — FileReader/compressão, remoção e o `hidden` da caixa. */
const attachmentHandlers={
 RemoveAttachment(e){
  const key=e.currentTarget?.closest?.('.attachment')?.dataset?.key||'';
  if(!key.startsWith('img-'))return;
  const item=S.attachments[Number(key.slice(4))];
  if(!item)return;
  S.attachments=S.attachments.filter(other=>other!==item);
  renderAttachments();
  persistTray();
 }
};
function attachmentFacts(){
 return bendList(S.attachments.map((item,at)=>({
  $:'AttachImage',key:`img-${at}`,dataUrl:item.dataUrl,
  alt:item.name?`Anexo: ${item.name}`:'Imagem anexada',
  removeLabel:`Remover ${item.name||'imagem'}`,removeTitle:'',handler:'RemoveAttachment',lazy:false
 })));
}
function renderAttachments(){
  const box=$('#attachments');
  renderChildren(box,attachview.imageItemViews(attachmentFacts()),attachmentHandlers);
  box.hidden=!S.attachments.length;
}
/* A bandeja sobrevive ao fechamento: as imagens pendentes são guardadas por
   conversa (`desk/pending.cjs`, núcleo `core/pending.bend`) e voltam no boot.
   Quem esvazia a bandeja (enfileirar, enviar, remover) também persiste — o
   arquivo não pode ficar com um anexo que já foi para um item da fila. */
export function persistTray(){
 window.desk.traySave({images:S.attachments}).catch(e=>toast(e.message));
}
/* Clique na miniatura abre a prévia (o × continua dono do remover): sem isso o
   clique "mudava" a bandeja quando caía no × sobreposto ao canto da imagem. */
$('#attachments').addEventListener('click',e=>{
  if(e.target.closest?.('.attachment-remove'))return;
  const img=e.target.closest?.('.attachment img');
  if(img)openImageDialog('',img.src,img.alt||'Imagem anexada');
});
/* `provenance` marca de onde o anexo veio (captura do Xournal++: horário e
   exercício do momento). O main usa isso para avisar que a captura não é do
   exercício ativo, em vez de deixá-la passar por tentativa de agora. */
export async function addAttachments(list,provenance){
 const gen=S.attachGen;let added=0;
 for(const file of imageFiles(list)){
  const name=file.name||'imagem';
  let blob=file,mime=file.type||'image/png';
  const prepared=await prepareAttachment(file);
  if(gen!==S.attachGen)return 0;
  if(prepared){blob=prepared;mime=prepared.type||mime;}
  if(blob.size>MAX_ATTACH_BYTES){toast(`Imagem grande demais (máx. ${Math.round(MAX_ATTACH_BYTES/1024/1024)} MB): ${file.name||'imagem'}.`);continue;}
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||Error('Falha ao ler a imagem.'));reader.readAsDataURL(blob);}).catch(()=>'');
  if(gen!==S.attachGen)return 0;
  if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/')){toast('Não foi possível ler a imagem.');continue;}
  if(S.attachments.length>=MAX_ATTACH){toast(`Máximo de ${MAX_ATTACH} imagens por mensagem.`);break;}
  S.attachments.push({dataUrl,mimeType:mime,name,capturedAt:provenance?.capturedAt,exercise:provenance?.exercise});added++;
 }
 if(gen!==S.attachGen)return 0;
 renderAttachments();
 persistTray();
 if(added&&S.connected&&!S.supportsImages)toast('Este modelo não aceita imagens; escolha um modelo com visão.');
 return added;
}
function clearAttachments(items){S.attachments=items?S.attachments.filter(item=>!items.includes(item)):[];renderAttachments();persistTray();}
export function resetAttachments(){S.attachGen++;S.attachments=[];renderAttachments();}
/* Anexos guardados de uma conversa (o payload `pending` do main): entram na
   bandeja depois do `resetAttachments` do boot/troca — sem regravar. */
export function restoreAttachments(pending){
 const list=(Array.isArray(pending?.attachments)?pending.attachments:[]).map(item=>({
  dataUrl:typeof item?.dataUrl==='string'?item.dataUrl:'',
  mimeType:typeof item?.mimeType==='string'?item.mimeType:'',
  name:typeof item?.name==='string'?item.name:'',
  capturedAt:item?.capturedAt,
  exercise:item?.exercise,
 })).filter(item=>item.dataUrl);
 if(!list.length)return;
 S.attachGen++;
 S.attachments=list;
 renderAttachments();
}
$('#attach').onclick=()=>$('#attach-input').click();
$('#attach-input').onchange=()=>{addAttachments($('#attach-input').files);$('#attach-input').value='';};
document.addEventListener('paste',e=>{
 if(S.busy)return;
 const files=[...(e.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
 if(files.length){e.preventDefault();addAttachments(files);}
});
document.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
const chatEl=$('#chat');
chatEl.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();if(!S.busy)chatEl.classList.add('dropping');}});
chatEl.addEventListener('dragleave',e=>{if(!chatEl.contains(e.relatedTarget))chatEl.classList.remove('dropping');});
chatEl.addEventListener('drop',e=>{chatEl.classList.remove('dropping');const files=imageFiles(e.dataTransfer?.files);if(files.length){e.preventDefault();if(!S.busy)addAttachments(files);}});
function texSource(el){return el?.getAttribute?.('data-tex')||el?.querySelector?.('[data-tex]')?.getAttribute('data-tex')||'';}
const QUOTE_BLOCKS=new Set(['P','DIV','LI','UL','OL','H1','H2','H3','H4','H5','H6','PRE','BLOCKQUOTE','FIGURE','TABLE','TR','SECTION','ARTICLE','DETAILS','SUMMARY']);
function selectionText(node){
 if(node.nodeType===3)return node.nodeValue;
 if(node.nodeType!==1&&node.nodeType!==11)return '';
 let text='';
 for(const child of node.childNodes)text+=selectionText(child);
 if(node.nodeType===11)return text;
 const tag=node.tagName;
 if(tag==='BR')return '\n';
 if(tag==='SCRIPT'||tag==='STYLE'||tag==='BUTTON')return '';
 if(QUOTE_BLOCKS.has(tag))text='\n'+text+'\n';
 return text;
}
function selectionInsideMessages(){
 const selection=window.getSelection();
 if(!selection||selection.isCollapsed||!selection.rangeCount)return false;
 const node=selection.anchorNode;
 const el=node?.nodeType===1?node:node?.parentElement;
 return !!el?.closest?.('#messages');
}
function selectionInPdf(selection){
 if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const node=selection.getRangeAt(0).commonAncestorContainer;
 const el=node?.nodeType===1?node:node?.parentElement;
 const layer=el?.closest?.('.textLayer');
 const panel=S.panels.find(p=>p.el===layer?.closest('.pdf-panel'));
 if(!panel||!panel.path)return null;
 const page=Number(layer.closest('.pdf-page')?.dataset.page)||panel.page;
 return {panel,page};
}
function enclosingTex(range){
 const wrapper=node=>{
  const el=node?.nodeType===1?node:node?.parentElement;
  return el?.closest?.('.katex-display')||el?.closest?.('.katex')||null;
 };
 const start=wrapper(range.startContainer),end=wrapper(range.endContainer);
 return start&&start===end?texSource(start):'';
}
function selectionQuote(){
 const selection=window.getSelection();
 if(!selection||selection.isCollapsed||!selection.rangeCount)return '';
 const pdf=selectionInPdf(selection);
 if(pdf){
  let text=selection.toString().replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(!text)return '';
  if(text.length>8000)text=text.slice(0,8000).trimEnd()+'…';
  return text+`\n\n(${pdf.panel.path.split(/[/\\]/).at(-1)}, p. ${pdf.page})`;
 }
 const range=selection.getRangeAt(0);
 const host=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
 if(!host?.closest?.('#messages'))return '';
 const onlyTex=enclosingTex(range);
 if(onlyTex)return onlyTex;
 const fragment=range.cloneContents();
 for(const noise of [...(fragment.querySelectorAll?.('.role,.quiz-actions,.quiz-verdict,.quiz-note,.quiz-mark,.quiz-details')||[])])noise.remove();
 for(const display of [...(fragment.querySelectorAll?.('.katex-display')||[])]){const tex=texSource(display);if(tex)display.replaceWith(document.createTextNode(`\n${tex}\n`));}
 for(const katex of [...(fragment.querySelectorAll?.('.katex')||[])]){if(katex.closest('.katex-display'))continue;const tex=texSource(katex);if(tex)katex.replaceWith(document.createTextNode(tex));}
 let text=selectionText(fragment).replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 if(!text)return '';
 if(text.length>8000)text=text.slice(0,8000).trimEnd()+'…';
 return text;
}
export function hideQuoteButton(){$('#quote-btn').hidden=true;}
let quotePending='',quoteTimer;
function updateQuoteButton(){
 clearTimeout(quoteTimer);
 quoteTimer=setTimeout(()=>{
  const text=selectionQuote();
  if(!text){hideQuoteButton();return;}
  const rect=window.getSelection().getRangeAt(0).getBoundingClientRect();
  if(!rect||(!rect.width&&!rect.height)||rect.bottom<0||rect.top>innerHeight){hideQuoteButton();return;}
  const button=$('#quote-btn');
  button.hidden=false;
  button.style.left=Math.round(Math.max(8,Math.min(rect.right-24,innerWidth-70)))+'px';
  button.style.top=Math.round(Math.min(rect.bottom+8,innerHeight-40))+'px';
 },120);
}
function insertQuote(){
 const text=quotePending||selectionQuote();
 quotePending='';
 if(!text)return;
 const prompt=$('#prompt');
 const sep=!prompt.value?'':(prompt.value.endsWith('\n\n')?'':(prompt.value.endsWith('\n')?'\n':'\n\n'));
 prompt.value=prompt.value+sep+text.split('\n').map(line=>line?`> ${line}`:'>').join('\n')+'\n\n';
 prompt.focus();
 prompt.setSelectionRange(prompt.value.length,prompt.value.length);
 save();hideQuoteButton();window.getSelection()?.removeAllRanges();
}
/* Chat lateral → principal: insere o texto no rascunho SEM enviar e SEM tocar no
   que já estava digitado (append previsível — separador só quando já há texto).
   O envio continua sendo decisão do usuário; nenhum prompt sai daqui. */
export function insertMainDraft(text){
 const prompt=$('#prompt');
 const body=String(text||'').trim();
 if(!prompt||!body)return false;
 const base=prompt.value;
 const sep=!base?'':(base.endsWith('\n\n')?'':(base.endsWith('\n')?'\n':'\n\n'));
 prompt.value=`${base}${sep}${body}\n\n`;
 prompt.focus();
 prompt.setSelectionRange(prompt.value.length,prompt.value.length);
 save();
 return true;
}
document.addEventListener('selectionchange',updateQuoteButton);
$('#messages').addEventListener('scroll',hideQuoteButton,{passive:true});
/* No modo rolagem quem rola é o #chat (o #messages cresce com o conteúdo):
   o botão de citar some do mesmo jeito quando a conversa anda. */
$('#chat')?.addEventListener('scroll',hideQuoteButton,{passive:true});
$('#quote-btn').addEventListener('mousedown',e=>{e.preventDefault();quotePending=selectionQuote();});
$('#quote-btn').addEventListener('mouseleave',()=>{quotePending='';});
$('#quote-btn').addEventListener('click',()=>insertQuote());
let assistant=null,assistantText='',assistantId=null;
let turnLog=null,turnView=null,liveTick=0,renderTimer=0,stoppedTurn=false;
/* Fatos que a fila consulta (via `mayAdvanceQueue` em state.mjs): o
   cancelamento é do turno (some no turno novo / no comando do usuário) e a
   incerteza é da conversa (o host a mantém até outra conversa). */
window.addEventListener('desk-stop',()=>{stoppedTurn=true;S.turnCancelled=true;});

/* Diário do turno: nasce no agent_start, é alimentado pelos eventos e recolhe no
   agent_end. O quiz fica fora dele — o card do quiz já é a interface da espera. */
function openTurnLog(){
 if(turnLog)return;
 turnLog=worklog.createLog(Date.now());
 turnView=createWorkLogView();
 $('#messages').append(turnView.el);
 turnView.render(turnLog,{live:true});
 clearInterval(liveTick);
 liveTick=setInterval(paintLive,1000);
}
function paintLive(){
 if(!turnLog)return;
 if(S.quizQueue&&S.quizQueue.length)return; /* o quiz manda na linha do composer */
 /* Um aviso de limite visível manda na faixa: o relógio do turno não apaga o
    motivo da pausa a cada segundo (a limpeza é do `agent_settled`/RESUMED). */
 if(limitShown)return;
 const step=worklog.runningStep(turnLog);
 const text=step?worklog.liveLabel(step):`${S.agentLabel} está pensando…`;
 activityLive(`${text} · ${worklog.formatDuration(Date.now()-turnLog.startedAt)}`);
}
function renderTurn(note=''){
 if(!turnLog||!turnView)return;
 turnView.render(turnLog,{live:true,note});
 paintLive();
}
/* Deltas de pensamento chegam em rajada: repinta no máximo a cada ~90ms. */
function scheduleTurn(){
 if(renderTimer)return;
 renderTimer=setTimeout(()=>{renderTimer=0;if(turnLog)renderTurn();},90);
}
function settleTurn({reason=''}={}){
 if(!turnLog)return;
 worklog.finishLog(turnLog,{now:Date.now(),reason});
 if(turnLog.steps.length)turnView.render(turnLog,{live:false});
 else turnView.destroy();
 turnLog=null;turnView=null;
 clearInterval(liveTick);liveTick=0;
 clearTimeout(renderTimer);renderTimer=0;
}

/* Avisos visíveis desta conversa (o adaptador avisa por `warning`→`desk_warn`;
   o serviço repassa `code`/`rateLimit`/`detail`). O limite é guardado POR
   JANELA (tipo + reset) num passo puro (`limitNoticeState`): `allowed`/
   CLAUDE_RATE_LIMIT_RESUMED limpa só a janela liberada e o aviso mais grave
   que restar volta à faixa — uma janela liberada nunca esconde outra janela
   rejeitada. A faixa fica com a mensagem nativa e o toast sai quando o aviso
   visível MUDA. Aviso nenhum marca idle/desconexão nem reenvia: o turno segue
   como o adaptador decretar. O fim do turno, erro fatal e troca de conversa
   (o `showHistory` da carga) zeram tudo. */
let limitEntries=[];
let limitShown='';
let limitBandText='';
let activityNotice=null;
function limitConversation(e){return typeof e?.conversationId==='string'?e.conversationId:(S.currentSession||'');}
function clearLimitBand(){
 const box=$('#activity');
 if(box&&limitBandText&&box.textContent===limitBandText&&!S.busy)activity('');
 limitBandText='';
}
function paintLimitNotice(visible){
 const shown=visible?`${visible.conversationId}\u0000${visible.window}\u0000${visible.key}`:'';
 if(shown===limitShown)return;
 limitShown=shown;
 if(visible){limitBandText=visible.message;activity(visible.message);toast(visible.message);}
 else clearLimitBand();
}
function clearNotices(){
 const box=$('#activity');
 if(activityNotice?.message&&box?.textContent===activityNotice.message&&!S.busy)activity('');
 limitEntries=[];limitShown='';activityNotice=null;clearLimitBand();
}
window.addEventListener('desk-conversation-changed',clearNotices);
function applyLimitNotice(notice,e){
 const state=limitNoticeState(limitEntries,notice,limitConversation(e));
 limitEntries=state.entries;
 paintLimitNotice(state.visible);
}
/* Retry/overload/recusa/fallback: faixa e toast uma vez por aviso; NÃO mexem
   em busy/conexão/fila. A remoção da bolha parcial do fallback fica para
   quando o host souber evictar com segurança (adiada de propósito). */
function applyActivityNotice(notice,e){
 const conversationId=limitConversation(e);
 if(activityNotice&&activityNotice.conversationId===conversationId&&activityNotice.key===notice.key)return;
 activityNotice={conversationId,key:notice.key,message:notice.message};
 if(!limitShown)activity(notice.message); /* bloqueio visível não é encoberto */
 toast(notice.message);
}

window.desk.onEvent(e=>{
 if(!e||typeof e!=='object')return;
 /* Identidade da conversa: evento explícito de OUTRA conversa (troca de
    matéria/conversa em andamento) é descartado por identidade — nunca pinta
    no DOM da conversa errada. Eventos sem `conversationId` (Pi atual) seguem. */
 if(typeof e.conversationId==='string'&&e.conversationId&&S.currentSession&&e.conversationId!==S.currentSession)return;
 if(['agent_start','message_start','message_update','message_end','tool_execution_start','tool_execution_end'].includes(e.type))S.busyStall=0;
 if(e.type==='agent_start'){stoppedTurn=false;S.turnCancelled=false;openTurnLog();setBusy(true);paintLive();}
 if(e.type==='message_start'&&e.message?.role==='assistant'){
  /* O mesmo bloco pode chegar em dois message_start (stream + mensagem final):
     o `id` do bloco é a identidade — não recomeça a bolha em curso. Sem id
     (Pi), vale o comportamento de sempre. */
  const id=e.message.id??null;
  if(!(assistant&&id!==null&&assistantId===id)){assistant=null;assistantText='';assistantId=id;}
 }
 if(e.type==='message_update'&&e.assistantMessageEvent?.type==='thinking_delta'){
  openTurnLog();
  worklog.thinkingDelta(turnLog,e.assistantMessageEvent.delta||'');
  scheduleTurn();
 }
 if(e.type==='message_update'&&e.assistantMessageEvent?.type==='text_delta'){
  if(turnLog)worklog.closeThinking(turnLog);
  assistantText+=e.assistantMessageEvent.delta;
  if(!assistant)assistant=message('assistant','');
  updateMessage(assistant,assistantText,[],true);
  scheduleTurn();
 }
 if(e.type==='message_end'&&e.message?.role==='assistant'){
  const {text,images}=contentParts(e.message);
  const id=e.message.id??null;
  /* Só atualiza a bolha em curso quando o bloco é o mesmo; um id novo (ou
     ausente) vira mensagem própria, como antes. */
  if(assistant&&(id===null||assistantId===null||id===assistantId))updateMessage(assistant,text,images);
  else if(text||images.length)message('assistant',text,images);
  assistant=null;assistantText='';assistantId=null;
  if(turnLog){worklog.closeThinking(turnLog);scheduleTurn();}
  if(e.message.errorMessage)toast(e.message.errorMessage);
 }
 if(e.type==='tool_execution_start'){
  if(e.toolName==='quiz'){
   S.quizQueue.push({id:e.toolCallId,args:e.args||{},card:null});
   if(S.quizQueue.length>4)S.quizQueue=S.quizQueue.slice(-4);
  }else{
   openTurnLog();
   worklog.closeThinking(turnLog);
   worklog.startTool(turnLog,{id:e.toolCallId,name:e.toolName,args:e.args,now:Date.now()});
   renderTurn();
  }
 }
 if(e.type==='tool_execution_end'){
  if(e.toolName==='quiz'){
   const item=S.quizQueue.find(entry=>entry.id===e.toolCallId);
   if(item){if(item.card)decorateQuizCard(item.card,e.result);S.quizQueue=S.quizQueue.filter(entry=>entry!==item);}
  }else if(turnLog){
   worklog.finishTool(turnLog,{id:e.toolCallId,result:e.result,isError:e.isError,now:Date.now()});
   renderTurn();
  }
 }
 if(e.type==='auto_retry_start'){
  S.busyStall=0;setBusy(true);
  activityLive(`Tentativa ${e.attempt}/${e.maxAttempts} em ${Math.ceil((e.delayMs||0)/1000)}s…`);
 }
 if(e.type==='auto_retry_end'&&e.success===false){
  stoppedTurn=true;
  window.dispatchEvent(new Event('desk-failed'));
  toast(`As tentativas do ${S.agentLabel} terminaram. Confira o erro e tente novamente quando quiser.`);
 }
 if(e.type==='agent_settled'){
  /* `cancelled`/`isError`/`uncertain` (tradução dos motores novos) NÃO são
     sucesso: sem `desk-idle`, a fila não drena; falha/incerteza também seguram
     a fila e a entrega incerta nunca é repetida sozinha. */
  clearNotices();
  const aborted=stoppedTurn;stoppedTurn=false;
  const cancelled=e.cancelled===true||aborted;
  /* Cancelamento não é falha: o `desk-stop` já segurou a fila e avisou; tratar
     `isError` do interrupt como erro geraria um segundo aviso e uma segunda
     guarda. */
  const failed=e.isError===true&&!cancelled;
  const uncertain=e.uncertain===true;
  /* Fatos para a guarda da fila: cancelamento veta o avanço até o turno novo
     (ou o comando explícito do usuário); incerteza veta até outra conversa. */
  if(cancelled)S.turnCancelled=true;
  if(uncertain)S.uncertain=true;
  settleTurn({reason:cancelled?'stopped':(failed||uncertain?'error':'')});
  setBusy(false);refreshMeter();
  if(!cancelled&&!failed&&!uncertain)window.dispatchEvent(new Event('desk-idle'));
  else if(failed||uncertain)window.dispatchEvent(new Event('desk-failed'));
  if(cancelled&&!aborted)window.dispatchEvent(new CustomEvent('desk-held',{detail:{message:'A resposta foi cancelada — a fila ficou guardada.'}}));
  if(uncertain)toast('Entrega incerta: a mensagem pode ter sido recebida. Confira a conversa antes de reenviar.');
 }
 /* Linha ilegível do Pi (`desk_warn`): a ponte segue viva e o turno também, então
    nada de estado de conexão — o log fica no desk.log (main.cjs) e o console
    guarda o rastro da Conversa (mesmo tratamento de `pi_warning`).
    Aviso NATIVO de limite de uso do Claude (`code`/`rateLimit` no evento) ganha
    também faixa de atividade e toast, por janela/reset. Avisos nativos de
    retry/overload/recusa/fallback (`claudeActivityNotice`) ganham faixa e toast
    concisos, deduplicados por aviso. É só visibilidade — nada aqui mexe em
    busy, conexão, fila nem reenvia; o console genérico (inclusive Pi) continua
    igual para o que não for reconhecido. */
 if(e.type==='desk_warn'){
  console.warn(`${S.agentLabel}:`,e.message);
  const limit=claudeLimitNotice(e);
  if(limit)applyLimitNotice(limit,e);
  else{
   const notice=claudeActivityNotice(e);
   if(notice)applyActivityNotice(notice,e);
  }
 }
 /* `fatal:false` nativo = a consulta continua utilizável (retry/result à
    frente): o erro fica visível no diário/faixa/toast, mas conexão, busy e
    fila NÃO mudam e o `desk-failed` não sai — o `agent_settled` (isError) é
    quem encerra o turno e segura a fila. Ausente/true preserva o tratamento
    fatal de sempre (Pi e falha de transporte). */
 if(e.type==='desk_error'){
  clearNotices();
  const fatal=deskErrorIsFatal(e);
  if(turnLog)worklog.addError(turnLog,`Erro do ${S.agentLabel}: ${e.message}`);
  toast(e.message);
  if(fatal){
   if(turnLog)settleTurn({reason:'error'});
   S.connected=false;connectionState('error',`${S.agentLabel} desconectado`);setBusy(false);$('#auto-compact').hidden=true;
   activity(`Erro do ${S.agentLabel}: ${e.message}`);
   /* O turno morreu sem `agent_end`: a fila tenta o que sobrou agora. */
   window.dispatchEvent(new Event('desk-failed'));
  }else{
   activity(`Erro do ${S.agentLabel}: ${e.message}`);
  }
 }
 if(e.type==='extension_ui_request'){
  if(e.method==='notify'){toast(e.message);if(e.notifyType==='error')setBusy(false);}
  else if(['select','confirm','input','editor','question'].includes(e.method))showDialog(e);
  else if(e.method==='set_editor_text'&&e.text)$('#prompt').value=e.text;
 }
 /* Pedido interativo vencido (cancelamento/perda da execução): o diálogo daquele
    id sai da fila e o aberto é fechado SEM resposta — nada de responder um pedido
    que não existe mais. */
 if(e.type==='agent_request_cancelled'){
  const id=String(e.id||'');
  let removed=false;
  for(let i=dialogQueue.length-1;i>=0;i--)if(dialogQueue[i].id===id){dialogQueue.splice(i,1);removed=true;}
  if(currentDialog&&currentDialog.id===id){
   const dialog=$('#pi-dialog');
   currentDialog=null;
   if(dialog){dialog._requestId='';dialog._questionDraft=null;if(dialog.open){ignoredDialogCloses++;dialog.returnValue='cancel';dialog.close();}}
   nextDialog();
   removed=true;
  }
  if(removed)S.dialogPending=!!currentDialog||dialogQueue.length>0;
  cancelQuiz(id);
 }
});
const dialogQueue=[];let currentDialog=null,ignoredDialogCloses=0;
function showDialog(e){dialogQueue.push(e);if(currentDialog)return;nextDialog();}
function respondDialog(data){window.desk.respond(data).catch(()=>{});currentDialog=null;nextDialog();}
function cancelQuiz(id){
 for(const entry of S.quizQueue){
  if(!entry.card||entry.card._talkQuiz?.dialogId!==id)continue;
  const state=entry.card._talkQuiz;
  state.answered=true;state.result={details:{status:'cancelled'}};
  paintQuiz(state);
 }
}
function currentQuiz(){return S.quizQueue.find(entry=>!entry.card)||null;}
function quizSelect(e){return e.method==='select'&&Array.isArray(e.options)&&(!!currentQuiz()||/^Quiz\b/i.test(e.title||''));}
function quizMulti(e){return /^Quiz \(múltipla escolha\)/.test(e.title||'')||!!currentQuiz()?.args?.multiSelect;}
function quizQuestion(e){const match=/^Quiz(?: \(múltipla escolha\))? · ([\s\S]*)$/.exec(e.title||'');return String(currentQuiz()?.args?.question||match?.[1]||'Quiz').trim();}
function quizOptionRows(state){
 const details=state.result?.details,correct=new Set(details?.correctIndices||[]),selected=new Set((details?.answers||[]).map(a=>a.index));
 return state.labels.map((label,offset)=>{
  const index=offset+1;let good=false,bad=false,dim=false,mark='';
  if(details&&details.status!=='cancelled'&&details.status!=='unavailable'){
   if(details.dontKnow){if(correct.has(index)){good=true;mark='✓';}else dim=true;}
   else if(selected.has(index)&&correct.has(index)){good=true;mark='✓';}
   else if(selected.has(index)){bad=true;mark='✗';}
   else if(correct.has(index)){good=true;mark='✓';}
   else dim=true;
  }
  return {$:'QuizOptionRow',label,index:String(index),markup:htmlNode(markupInline(label)),checked:state.chosen.has(label),disabled:state.answered,correct:good,wrong:bad,dim,mark};
 });
}
function quizVerdict(state){
 const details=state.result?.details,status=details?.status;
 if(!state.result)return '';
 if(!details||status==='cancelled'||status==='unavailable')return status==='cancelled'?'Quiz cancelado.':(details?.message||'Quiz encerrado.');
 return details.dontKnow?'Você marcou "Não sei".':details.correct?'✓ Correta!':'✗ Incorreta.';
}
function quizRow(state){
 const details=state.result?.details||{},verdict=quizVerdict(state);
 return {
  $:'QuizRow',toolId:state.toolId,multi:state.multi,
  question:htmlNode(markup(state.question)),hasDetails:!!state.details,details:htmlNode(markupInline(state.details||'')),
  options:bendList(quizOptionRows(state)),showSend:state.multi&&!state.answered,sendDisabled:state.chosen.size===0,showSkip:!state.answered,
  hasVerdict:!!verdict,verdict,hasNote:!!details.note,note:htmlNode(markupInline(details.note||'')),
  hasExplain:!!details.explanation,explain:htmlNode(markup(details.explanation||'')),
 };
}
function paintQuiz(state,{append=false}={}){
 const messages=$('#messages'),old=state.card;
 const handlers={
  SelectQuizOption(event){
   if(state.answered)return;
   const label=event.currentTarget.dataset.label||'';
   if(state.multi){if(state.chosen.has(label))state.chosen.delete(label);else state.chosen.add(label);paintQuiz(state);return;}
   state.chosen.add(label);state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,value:label});
  },
  SendQuiz(){
   if(state.answered||!state.chosen.size)return;
   state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,value:JSON.stringify([...state.chosen])});
  },
  SkipQuiz(){if(state.answered)return;state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,cancelled:true});},
 };
 let card=null;
 const render=()=>{
  card=build(talkCore.quizCard(quizRow(state)),handlers);
  card._answered=state.answered;card._talkQuiz=state;
  if(append||!old?.isConnected)messages.append(card);else old.replaceWith(card);
  state.card=card;hydrateAssets(card);
 };
 /* O restore global busca a key em #messages; as keys `quiz-option-N` repetem
    entre cards, então ele pode achar a opção (já disabled) de um card anterior
    e o `focus()` virar no-op. Depois do render, o foco é corrigido dentro do
    card que acabou de ser pintado. */
 const active=document.activeElement;
 const scopedKey=old?.isConnected&&old.contains(active)?(active.dataset?.key||active.id||''):'';
 if(old?.isConnected)preserveFocus(messages,render);else render();
 if(scopedKey&&card){
  const next=card.querySelector(`[data-key="${CSS.escape(scopedKey)}"]`)||card.querySelector(`#${CSS.escape(scopedKey)}`);
  if(next&&!next.disabled)next.focus();
 }
 return state.card;
}
function renderQuizCard(e){
 $('#welcome')?.remove();
 const quiz=currentQuiz();
 const state={dialogId:e.id,toolId:quiz?.id||'',multi:quizMulti(e),question:quizQuestion(e),details:quiz?.args?.details||'',labels:(e.options||[]).map(String),chosen:new Set(),answered:false,result:null,card:null};
 const card=paintQuiz(state,{append:true});followBottom(true);
 if(quiz)quiz.card=card;
 card.querySelector('.quiz-option')?.focus();
 activity('Quiz aguardando sua resposta…');
}
function decorateQuizCard(card,result){
 const state=card?._talkQuiz;if(!state)return;
 state.answered=true;state.result=result;paintQuiz(state);
}
function dialogOptions(options){
 let out={$:'Nil'};
 for(let i=options.length-1;i>=0;i--)out={$:'Con',head:{$:'DialogOption',label:String(options[i]),value:String(options[i])},tail:out};
 return out;
}
function dialogField(e){
 if(e.method==='select')return {$:'FieldPick',label:'',value:String(e.prefill||''),options:dialogOptions(e.options||[])};
 if(e.method==='editor')return {$:'FieldEditor',label:'',value:String(e.prefill||''),hint:String(e.placeholder||'')};
 if(e.method==='input')return {$:'FieldText',label:'',value:String(e.prefill||''),hint:String(e.placeholder||'')};
 return null;
}
/* Perguntas estruturadas (AskUserQuestion) no MESMO casco do #pi-dialog: o
   formulário vive no #dialog-fields, rótulos/descrições entram como TEXTO
   (nunca HTML) e as respostas saem por `compileQuestionAnswers` (módulo puro).
   Texto livre e opções marcadas são excludentes nos dois sentidos: digitar
   limpa as opções, marcar limpa o texto — a resposta nunca mistura os dois. */
function questionBlock(question,index){
 const block=document.createElement('section');
 block.className='cq-question';
 block.dataset.cqIndex=String(index);
 if(question.header){
  const header=document.createElement('h3');header.className='cq-header';header.textContent=question.header;block.append(header);
 }
 const text=document.createElement('p');text.className='cq-text';text.textContent=question.question;block.append(text);
 const group=document.createElement('div');
 group.className='cq-options';
 group.setAttribute('role',question.multiSelect?'group':'radiogroup');
 group.setAttribute('aria-label',question.question);
 for(const option of question.options){
  const label=document.createElement('label');label.className='cq-option';
  const input=document.createElement('input');
  input.type=question.multiSelect?'checkbox':'radio';
  input.name=`cq-${index}`;
  input.value=option.label;
  label.append(input);
  const body=document.createElement('span');body.className='cq-option-body';
  const name=document.createElement('span');name.className='cq-option-label';name.textContent=option.label;body.append(name);
  if(option.description){const desc=document.createElement('span');desc.className='cq-option-desc';desc.textContent=option.description;body.append(desc);}
  label.append(body);group.append(label);
 }
 block.append(group);
 const other=document.createElement('label');other.className='cq-other';
 const otherLabel=document.createElement('span');otherLabel.className='cq-other-label';otherLabel.textContent='Outra resposta';
 const free=document.createElement('input');
 free.type='text';free.className='cq-text-input';free.maxLength=MAX_ANSWER_CHARS;free.autocomplete='off';
 free.placeholder=question.multiSelect?'Digite outra resposta':'Digite uma resposta';
 other.append(otherLabel,free);block.append(other);
 free.addEventListener('input',()=>{
  if(free.value)for(const input of group.querySelectorAll('input'))input.checked=false;
  clearQuestionError(block);
 });
 group.addEventListener('change',()=>{
  if(free.value)free.value='';
  clearQuestionError(block);
 });
 return block;
}
function clearQuestionError(block){
 block.classList.remove('cq-invalid');
 block.querySelector('.cq-error')?.remove();
 for(const input of block.querySelectorAll('[aria-invalid]'))input.removeAttribute('aria-invalid');
}
function focusQuestionErrors(errors){
 let first=null;
 for(const error of errors){
  const block=$('#dialog-fields').querySelector(`.cq-question[data-cq-index="${error.index}"]`);
  if(!block)continue;
  block.classList.add('cq-invalid');
  let note=block.querySelector('.cq-error');
  if(!note){note=document.createElement('p');note.className='cq-error';note.setAttribute('role','alert');block.append(note);}
  note.textContent=error.message;
  if(!first)first=block.querySelector('.cq-option input,.cq-text-input');
 }
 first?.focus();
}
function collectQuestionPicks(questions){
 const box=$('#dialog-fields');
 return questions.map((question,index)=>{
  const block=box.querySelector(`.cq-question[data-cq-index="${index}"]`);
  if(!block)return {selected:[],text:''};
  return {selected:[...block.querySelectorAll('.cq-option input:checked')].map(input=>input.value),text:block.querySelector('.cq-text-input')?.value||''};
 });
}
function showQuestionDialog(e,questions){
 const dialog=$('#pi-dialog');
 dialog.dataset.permission='true';
 dialog.dataset.question='true';
 dialog._questionList=questions;
 renderPiDialog({title:e.title||`Pergunta do ${S.agentLabel}`,message:e.message||'',field:null},{inline:markupInline});
 $('#dialog-fields').replaceChildren(...questions.map(questionBlock));
 $('#dialog-ok').textContent='Responder';
 dialog._requestId=String(e.id||'');
 dialog._questionDraft=null;
 dialog.returnValue='';
 dialog.showModal();
 $('#dialog-fields').querySelector('.cq-option input,.cq-text-input')?.focus();
}
/* O submit do casco é o único caminho que fecha com `returnValue='ok'`; a
   validação mora aqui para o diálogo NÃO fechar sem resposta (o adaptador
   recusa faltantes). Só o botão Responder (`value='ok'`) exige respostas: o
   Cancelar submete pelo mesmo evento e precisa fechar SEMPRE, mesmo com o
   formulário vazio — sem botão identificado, mantém o caminho exigente. Enter
   em campo do formulário clica o `#dialog-ok` (keydown acima), então cai no
   mesmo caminho do Responder. */
$('#pi-dialog form')?.addEventListener('submit',event=>{
 if(!currentDialog||currentDialog.method!=='question')return;
 const dialog=$('#pi-dialog');
 const questions=Array.isArray(dialog._questionList)?dialog._questionList:[];
 const action=questionSubmitAction(questions,collectQuestionPicks(questions),event.submitter?event.submitter.value:null);
 if(action.action==='cancel')return;
 if(action.action==='invalid'){event.preventDefault();focusQuestionErrors(action.errors);return;}
 dialog._questionDraft={id:String(currentDialog.id||''),answers:action.answers};
});
$('#dialog-fields')?.addEventListener('keydown',event=>{
 if(!currentDialog||currentDialog.method!=='question')return;
 if(event.key!=='Enter'||event.shiftKey||event.isComposing)return;
 if(!(event.target instanceof HTMLInputElement))return;
 event.preventDefault();
 $('#dialog-ok').click();
});
function nextDialog(){const e=dialogQueue.shift();S.dialogPending=!!e;if(!e)return;currentDialog=e;
 const dialog=$('#pi-dialog');
 dialog._questionDraft=null;
 dialog._questionList=null;
 if(quizSelect(e)){renderQuizCard(e);return;}
 if(e.method==='question'){
  const request=questionRequest(e.questions);
  if(!request.ok){respondDialog({id:e.id,cancelled:true});return;}
  showQuestionDialog(e,request.questions);
  return;
 }
 delete dialog.dataset.question;
 $('#dialog-ok').textContent='Continuar';
 dialog.dataset.permission=e.permission===true?'true':'false';
 renderPiDialog({title:e.title||(e.permission===true?'Permissão':S.agentLabel),message:e.message||'',field:dialogField(e)},{inline:markupInline});
 dialog._requestId=String(e.id||'');
 dialog.returnValue='';
 dialog.showModal();}
/* O fechamento só responde ao pedido que ESTE diálogo estava mostrando: um
   `agent_request_cancelled` pode abrir o diálogo seguinte antes do evento de
   close do anterior, e a resposta não pode vazar para o pedido novo. */
$('#pi-dialog').addEventListener('close',()=>{
 // Native close events are queued. Revoking A may already have opened B on
 // this same element; A's delayed close must not read or clear B's identity.
 if(ignoredDialogCloses){ignoredDialogCloses--;return;}
 const dialog=$('#pi-dialog');
 const requestId=dialog._requestId||'';
 dialog._requestId='';
 const e=currentDialog&&currentDialog.id===requestId?currentDialog:null;
 if(!e){dialog._questionDraft=null;return;}
 const ok=dialog.returnValue==='ok';
 if(e.method==='question'){
  const draft=dialog._questionDraft;
  dialog._questionDraft=null;
  respondDialog(ok&&draft&&draft.id===e.id&&draft.answers?{id:e.id,answers:draft.answers}:{id:e.id,cancelled:true});
  return;
 }
 respondDialog(ok?{id:e.id,...(e.method==='confirm'?{confirmed:true}:{value:$('#dialog-value')?.value})}:{id:e.id,cancelled:true});
});
function dataUrlToBlob(dataUrl){
 const head=dataUrl.slice(0,dataUrl.indexOf(',')),body=dataUrl.slice(dataUrl.indexOf(',')+1);
 const bin=atob(body),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Blob([bytes],{type:head.slice(5,head.indexOf(';'))||'image/png'});
}
function toPngBlob(src){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{
   try{
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível converter a imagem.')),'image/png');
   }catch(err){reject(err);}
  };
  image.onerror=()=>reject(Error('Não foi possível ler a imagem.'));
  image.src=src;
 });
}
async function copyImageElement(img){
 const src=img?.src||'';
 if(!src)throw Error('Imagem indisponível.');
 const png=src.startsWith('data:image/png')?Promise.resolve(dataUrlToBlob(src)):toPngBlob(src);
 await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
}
function wrapCopy(img){
 if(img.closest('.img-wrap'))return img;
 const wrap=document.createElement('span');wrap.className='img-wrap';
 img.replaceWith(wrap);wrap.append(img);
 const copy=document.createElement('button');copy.type='button';copy.className='img-copy';copy.textContent='Copiar';
 copy.addEventListener('click',async e=>{e.stopPropagation();try{await copyImageElement(img);toast('Imagem copiada.');}catch(err){toast(err.message);}});
 wrap.append(copy);
 return wrap;
}
function openImageDialog(file,source,alt){
 if(!source||$('#image-dialog').open)return;
 $('#image-preview').src=source;
 $('#image-preview').alt=alt||'Imagem';
 renderImageChrome({file:file||'',hasFile:!!file},imageDialogHandlers);
 $('#image-dialog').showModal();
}
const imageDialogHandlers={
 ImageCopy:async()=>{try{await copyImageElement($('#image-preview'));toast('Imagem copiada.');}catch(e){toast(e.message);}},
 ImageOpen:()=>{const file=$('#image-dialog').dataset.path;if(!file)return;window.desk.openImage(file).catch(e=>toast(e.message));},
};
$('#messages').addEventListener('click',async e=>{const button=e.target.closest?.('.code-copy');if(!button)return;e.stopPropagation();const pre=button.parentElement?.querySelector('pre');if(!pre)return;try{await navigator.clipboard.writeText(pre.textContent);button.classList.add('ok');button.textContent='copiado';setTimeout(()=>{button.classList.remove('ok');button.textContent='cópia';},1200);}catch(err){toast(err.message);}});
$('#messages').addEventListener('click',e=>{const img=e.target.closest?.('img.plot,img.shot');if(img)openImageDialog(img.dataset.path||'',img.src,img.alt);});
$('#image-dialog').addEventListener('close',()=>{$('#image-preview').removeAttribute('src');});
