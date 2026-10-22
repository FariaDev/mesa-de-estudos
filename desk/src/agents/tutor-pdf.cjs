'use strict';
const TOOL_NAME='mcp__mesa__criar_pdf';
const {toolErrorText}=require('./tool-error-text.cjs');
/* Texto, campos e resultado são os da extensão do Pi (`guide.mjs`): mudam
   juntos, e `tests/native-tool-parity.mjs` confere. */
async function createTutorPdfTool(createMaterial,{language}={}){
 const [{tool},{z},guide,fields]=await Promise.all([import('@anthropic-ai/claude-agent-sdk'),import('zod'),import('../extensions/tutor-pdf/guide.mjs'),import('../extensions/tool-fields.mjs')]);
 return tool('criar_pdf',
  guide.TOOL_DESCRIPTION,
  fields.zodShape(z,guide.FIELDS),
  async (args,extra)=>{try{const result=await createMaterial({...args,signal:extra?.signal});return {content:[{type:'text',text:guide.resultText({...result,title:result&&result.title||args&&args.title||''})}]};}catch(error){return {isError:true,content:[{type:'text',text:toolErrorText(error,language,'err.pdfbridge.failed')}]};}},
  {annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},alwaysLoad:true});
}
async function createTutorPdfServer(createMaterial){
 const {createSdkMcpServer}=await import('@anthropic-ai/claude-agent-sdk');
 return createSdkMcpServer({name:'mesa',version:'1.0.0',tools:[await createTutorPdfTool(createMaterial)]});
}
module.exports={TOOL_NAME,createTutorPdfServer,createTutorPdfTool};
