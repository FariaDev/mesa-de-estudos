import {$,S,toast,applyStudy,save} from './state.mjs';
import {build} from './view-host.mjs';
import resumeCore from './generated/resume.core.js';

/* Cartão do "Encerrar por hoje" (Mesa). A árvore vem do núcleo
   (`core/resume.bend`); aqui ficam o DOM, o estado da matéria e a IPC.
   O registro em si mora em `desk/resume.cjs` (`runtime/resume.json`) e chegou
   no payload do boot (`data.resume`): gravado localmente ANTES de tentar o Pi,
   ele volta como cartão na próxima abertura — "Continuar {matéria} — {questão}",
   onde parei, próximo passo, Retomar/Dispensar.
   Retomar é o único caminho que mexe no contexto: questão, `.xopp` e as páginas
   dos PDFs voltam ao estado do dia e a mensagem é escrita no composer (nada é
   enviado sozinho). Dispensar só apaga o registro. */
let record=null;

function cardEl(){return $('#composer')?.querySelector('.resume-card')||null;}

const handlers={
 resume:async()=>{
  if(!record)return;
  const saved=record;
  applyStudy({title:saved.exercise||'',xopp:saved.xopp||''});
  /* As páginas voltam painel a painel, na ordem em que foram registradas; o
     `load` resolve o caminho (biblioteca) e corta a página no total do PDF. */
  const pages=Array.isArray(saved.pages)?saved.pages:[];
  for(let i=0;i<pages.length&&i<S.panels.length;i++){
   const ref=pages[i];
   if(ref?.path)S.panels[i].load(ref.path,{page:ref.page});
  }
  const prompt=$('#prompt');
  if(prompt){
   prompt.value=resumeCore.resumeDraft(saved.stopped,saved.next);
   prompt.dispatchEvent(new Event('input'));
   prompt.focus();
  }
  save(true);
  renderResumeCard(null);
  try{await window.desk.resumeClear();}catch(e){toast(e.message);}
  toast('Registro retomado — a mensagem está no composer.');
 },
 dismiss:async()=>{
  renderResumeCard(null);
  try{await window.desk.resumeClear();toast('Registro dispensado.');}catch(e){toast(e.message);}
 }
};

/* `null` limpa o cartão; um registro o (re)desenha acima do resumo de contexto
   do composer. Idempotente: o boot, a troca de matéria e o próprio Encerrar
   chamam a mesma função. */
export function renderResumeCard(data){
 record=data&&typeof data==='object'?data:null;
 const composer=$('#composer');
 if(!composer)return;
 const current=cardEl();
 if(!record){current?.remove();return;}
 const tree=resumeCore.resumeCardView(
  resumeCore.resumeTitle(S.activeCourseName||'',record.exercise||''),
  record.stopped||'',
  record.next||''
 );
 const node=build(tree,handlers);
 if(current)current.replaceWith(node);
 else{
  const summary=$('#context-summary');
  if(summary)summary.before(node);
  else composer.prepend(node);
 }
}
