'use strict';

// One native MCP server keeps every study tool under the existing mesa name.
async function createStudyToolsServer({createMaterial,createActivity,previewActivity,viewFigure,geogebra,readPdf,searchMaterial,proposeReview,listMaterials,saveNote,showCard,tutorLanguage}={}) {
 const {createSdkMcpServer}=await import('@anthropic-ai/claude-agent-sdk');
 /* As fábricas não dependem uma da outra, mas carregam em série: em paralelo,
    ESM e CJS na mesma rodada davam ERR_REQUIRE_ESM_RACE_CONDITION no Node 24
    (medidor M5). A ordem de carga é a ordem no MCP. */
 const tools=[];
 /* Calcular é local e vale em toda sessão: não depende de ponte nem de matéria. */
 tools.push(await require('./calc-tool.cjs').createCalcTool({language:tutorLanguage}));
 if(typeof createMaterial==='function')tools.push(await require('./tutor-pdf.cjs').createTutorPdfTool(createMaterial,{language:tutorLanguage}));
 if(typeof createActivity==='function')tools.push(await require('./activity-tools.cjs').createActivityTool(createActivity,{language:tutorLanguage}));
 /* A prévia do quadro (#42) anda junto da ferramenta de mostrar. */
 if(typeof createActivity==='function'&&typeof previewActivity==='function')tools.push(await require('./activity-tools.cjs').createPreviewTool(previewActivity,{language:tutorLanguage}));
 /* "Ver o que desenhei" (#60): o print do SVG ou da cerca plot. */
 if(typeof viewFigure==='function')tools.push(await require('./figure-tool.cjs').createFigureTool(viewFigure,{language:tutorLanguage}));
 /* GeoGebra (#53): a mesma ferramenta do Pi, sobre o serviço do host. */
 if(geogebra&&typeof geogebra.run==='function')tools.push(await require('./geogebra-tool.cjs').createGeogebraTool(geogebra,{language:tutorLanguage}));
 /* Ler PDF: o Read nativo pede poppler. O chat lateral passa só este callback. */
 if(typeof readPdf==='function')tools.push(await require('./pdf-read-tool.cjs').createPdfReadTool(readPdf,{language:tutorLanguage}));
 /* Buscar no material: o índice da Mesa evita varrer a aula com `ler_pdf`. */
 if(typeof searchMaterial==='function')tools.push(await require('./search-tool.cjs').createSearchTool(searchMaterial,{language:tutorLanguage}));
 /* Propor um card: o aluno confirma no diálogo que já existe. O chat lateral não passa o callback. */
 if(typeof proposeReview==='function')tools.push(await require('./review-tool.cjs').createReviewTool(proposeReview,{language:tutorLanguage}));
 /* Lista os PDFs da sessão; o host recorta a biblioteca. */
 if(typeof listMaterials==='function')tools.push(await require('./materials-tool.cjs').createMaterialsTool(listMaterials,{language:tutorLanguage}));
 /* Nota em `Notas/` (#91): só a sessão principal passa o callback. */
 if(typeof saveNote==='function')tools.push(await require('./note-tool.cjs').createNoteTool(saveNote,{language:tutorLanguage}));
 /* Cartões `quiz`/`perguntar` (#92): o host registra e a ferramenta volta. */
 if(typeof showCard==='function')tools.push(...await require('./card-tools.cjs').createCardTools(showCard,{language:tutorLanguage}));
 return createSdkMcpServer({name:'mesa',version:'1.2.0',tools});
}
module.exports={createStudyToolsServer};
