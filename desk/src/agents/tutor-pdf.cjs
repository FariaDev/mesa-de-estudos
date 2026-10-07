'use strict';
const TOOL_NAME='mcp__mesa__criar_pdf';
async function createTutorPdfServer(createMaterial){
 const [{createSdkMcpServer,tool},{z}]=await Promise.all([import('@anthropic-ai/claude-agent-sdk'),import('zod')]);
 return createSdkMcpServer({name:'mesa',version:'1.0.0',tools:[tool('criar_pdf',
  'Prepare o conteúdo do PDF quando o usuário pedir material em PDF. Envie o título e todo o conteúdo em Markdown/LaTeX. A Mesa preenche a prévia editável. O usuário revisa e clica em Salvar PDF e abrir para gerar o arquivo. Não peça para copiar a resposta. O resultado indica conteúdo preparado para revisar, e não um PDF já salvo.',
  {title:z.string().trim().min(1).max(160),markdown:z.string().min(1).max(262144)},
  async (args,extra)=>{try{const result=await createMaterial({...args,signal:extra?.signal});return {content:[{type:'text',text:JSON.stringify(result)}]};}catch(error){return {isError:true,content:[{type:'text',text:error.message||'Falha na geração do PDF.'}]};}},
  {annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},alwaysLoad:true})]});
}
module.exports={TOOL_NAME,createTutorPdfServer};
