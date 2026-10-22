import attachments from './src/generated/attachments.core.js';
import {t as uiT} from './src/ui-text.mjs';

/* Conteúdo da mensagem (texto + imagens): núcleo Bend (core/attachments.bend).
   O displayUserText da Mesa continua local — os marcadores de contexto/
   referências/conferência são específicos daqui. */
const Nil = {$: 'Nil'};
const toList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const fromList = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const coerce = (value) => (typeof value === 'string' ? value : '');

/* Blocos que o main apensa à mensagem e que o transcript não mostra. O bloco
   atual (`[Contexto da Mesa]`, core/studycontext.bend) vai até o fim; os
   marcadores antigos ficam para as conversas já gravadas. O bilhete da Conversa
   (`[Da Conversa]`) saiu na #50, mas sessões gravadas antes dele ainda o trazem
   DEPOIS do contexto da Mesa, até o fim do texto — o padrão fica separado
   porque com `studyContext: false` não havia bloco da Mesa nenhum antes dele. */
const CONTEXT_BLOCKS=[
 /* Menção `@` (#53): cabeçalho e a linha de instruções; só esse trecho sai, o contexto vem depois. */
 /\n\n\[Ferramenta pedida na Mesa:[^\]\n]*\][^\n]*\n[^\n]*/,
 /\n\n\[Da Conversa\][\s\S]*$/,
 /\n\n\[(?:Contexto da Mesa|Desk context)\][\s\S]*$/,
 /\n\n\[Contexto da sessão na Mesa:[\s\S]*?(?=\n\n\[Referências abertas|$)/,
 /\n\n\[Referências abertas[\s\S]*$/,
 /\n\n\[Conferência visual[\s\S]*$/,
];

export function displayUserText(text){
 if(typeof text!=='string')return '';
 let t=text;
 for(const block of CONTEXT_BLOCKS)t=t.replace(block,'');
 if(/^\/conferir\b/.test(t.trim())||/Conferência visual solicitada pelo usuário/.test(text)){
  const extra=t.replace(/^\/conferir\s*/,'').replace(/^Confira minha resolução e indique o primeiro erro relevante\.?\s*/i,'').trim();
  const label=uiT('conferir.sessionLabel');
  return extra&&extra!=='Confira minha resolução.'?`${label}\n${extra}`:label;
 }
 return t;
}

export function contentParts(m){
 const content=m?.content;
 const isString=typeof content==='string';
 const out=attachments.contentParts(isString,isString?content:'',toList((Array.isArray(content)?content:[]).map(c=>({
  $:'ContentPart',
  kind:coerce(c?.type),
  text:coerce(c?.text),
  data:coerce(c?.data),
  url:coerce(c?.url),
  mimeType:coerce(c?.mimeType)
 }))));
 return {text:attachments.contentText(out),images:fromList(attachments.contentImages(out))};
}
