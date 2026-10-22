import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {createTutorPdf} from './client.mjs';
import {FIELDS,TOOL_DESCRIPTION,resultText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

export default function tutorPdf(pi:ExtensionAPI){
 let bridge;try{bridge=JSON.parse(process.env.LEARNING_DESK_MATERIAL_BRIDGE||'');}catch{return;}
 pi.registerTool({
  name:'mesa_criar_pdf',label:'Preparar PDF na Mesa',
  description:TOOL_DESCRIPTION,
  parameters:typeboxObject(Type,FIELDS),
  async execute(_id,params,signal){
   const result=await createTutorPdf(bridge,params,signal);
   return {content:[{type:'text',text:resultText(result)}],details:result};
  },
 });
}
