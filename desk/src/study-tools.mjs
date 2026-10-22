import {toast} from './state.mjs';
import {t} from './ui-text.mjs';

/* As ferramentas de estudo moram no menu Estudar da barra superior (a árvore é
   do `core/studytoolsview.bend`, montada com os itens do menu em main.mjs).
   Este módulo só entrega os handlers: descobre e abre; os módulos de domínio
   possuem seus diálogos e a autorização dos destinos fica no processo
   principal. */
export function studyToolHandlers({search,reviewToday,notes,stats,backup,share,tutorPdf}){
 const open=fn=>async()=>{
  if(document.querySelector('dialog[open]'))return;
  try{await fn();}catch(error){toast(error?.message||t('tools.openFail'));}
 };
 /* O botão flutuante de estatísticas some quando o menu assume o acesso. */
 document.body.classList.add('study-tools-ready');
 return {
  OpenStudySearch:open(search),OpenReviewToday:open(reviewToday),
  OpenPdfNotes:open(notes),OpenStudyStats:open(stats),
  OpenStudyBackup:open(backup),OpenStudyShare:open(share),
  OpenTutorPdf:open(tutorPdf)
 };
}
