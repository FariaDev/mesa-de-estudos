import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {createTutorPdf} from './client.mjs';

export default function tutorPdf(pi:ExtensionAPI){
 let bridge;try{bridge=JSON.parse(process.env.LEARNING_DESK_MATERIAL_BRIDGE||'');}catch{return;}
 pi.registerTool({
  name:'mesa_criar_pdf',label:'Preparar PDF na Mesa',
  description:'Prepare o conteúdo do PDF quando o usuário pedir um material em PDF. Envie o título e o conteúdo completo em Markdown/LaTeX (sem cercas externas). A Mesa preenche o diálogo editável com prévia. O usuário revisa e clica em Salvar PDF e abrir para gerar o arquivo. Não peça ao usuário para copiar o texto ou montar o PDF manualmente. O resultado confirma apenas que o conteúdo está preparado para revisão; o PDF ainda não está salvo.',
  parameters:Type.Object({title:Type.String({minLength:1,maxLength:160}),markdown:Type.String({minLength:1,maxLength:262144})}),
  async execute(_id,params,signal){
   const result=await createTutorPdf(bridge,params,signal);
   return {content:[{type:'text',text:`Material “${result.title}” preparado no diálogo de PDF. O usuário pode revisar e clicar em Salvar PDF e abrir; o arquivo ainda não foi salvo.`}],details:result};
  },
 });
}
