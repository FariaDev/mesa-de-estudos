import {$,S,toast,applyStudy,save} from './state.mjs';
import resumeCore from './generated/resume.core.js';
import {text} from './ui-text.mjs';
import {message} from './i18n.mjs';

/* Registro do "Encerrar por hoje" (Mesa). A árvore que o mostra mora no
   bloco de estados do tutor (`tutor-state.mjs` + `core/tutorstate.bend`): aqui
   ficam o registro, o que Retomar e Esquecer fazem com o estado da matéria e a
   IPC. O registro em si mora em `desk/resume.cjs` (`runtime/resume.json`) e
   chegou no payload do boot (`data.resume`): gravado localmente ANTES de tentar
   o Pi, ele volta na próxima abertura — onde parei e o próximo passo, com
   Retomar, Sessão nova e Esquecer.
   Retomar é o único caminho que mexe no contexto: questão, `.xopp` e as páginas
   dos PDFs voltam ao estado do dia e a mensagem é escrita no composer (nada é
   enviado sozinho). Esquecer só apaga o registro. */
let record=null;
/* Sessão nova a partir do bloco "onde parei" deixa o registro no disco (a
   pessoa pode abrir a sessão antiga), mas não o devolve à coluna enquanto for o
   mesmo registro: sem isto o bloco reapareceria na sessão que acabou de nascer
   vazia. Um Encerrar novo (`fresh`) ou outro registro o traz de volta. */
let declined='';

const keyOf=value=>value?JSON.stringify([value.exercise||'',value.stopped||'',value.next||'',value.xopp||'']):'';
function changed(){try{window.dispatchEvent(new Event('desk-resume-changed'));}catch{}}

/* O registro que a coluna mostra: o guardado, salvo se a pessoa o deixou para
   trás com Sessão nova. */
export function visibleRecord(){return record&&keyOf(record)!==declined?record:null;}

export async function resumeStudy(){
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
  prompt.value=text(resumeCore.resumeDraft(saved.stopped,saved.next));
  prompt.dispatchEvent(new Event('input'));
  prompt.focus();
 }
 save(true);
 setResumeRecord(null);
 try{await window.desk.resumeClear();}catch(e){toast(e.message);}
 toast(message('resume.restored'));
}

export async function forgetResume(){
 setResumeRecord(null);
 try{await window.desk.resumeClear();toast(message('resume.forgotten'));}catch(e){toast(e.message);}
}

/* Sessão nova a partir do bloco: o registro deixa a coluna (ver `declined`). */
export function leaveResume(){declined=keyOf(record);changed();}

/* `null` limpa o registro; um registro o (re)coloca. Idempotente: o boot, a
   troca de matéria e o próprio Encerrar chamam a mesma função. */
export function setResumeRecord(data,{fresh=false}={}){
 record=S.appConfig.desk?.endDay!==false&&data&&typeof data==='object'?data:null;
 if(fresh||!record)declined='';
 changed();
}
