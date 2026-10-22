'use strict';

// One native MCP server keeps both study tools under the existing mesa name.
async function createStudyToolsServer({createMaterial,createActivity,previewActivity,viewFigure,geogebra,tutorLanguage}={}) {
 const {createSdkMcpServer}=await import('@anthropic-ai/claude-agent-sdk');
 const tools=[];
 if(typeof createMaterial==='function')tools.push(await require('./tutor-pdf.cjs').createTutorPdfTool(createMaterial,{language:tutorLanguage}));
 if(typeof createActivity==='function')tools.push(await require('./activity-tools.cjs').createActivityTool(createActivity,{language:tutorLanguage}));
 /* A prévia do quadro (#42) anda junto da ferramenta de mostrar. */
 if(typeof createActivity==='function'&&typeof previewActivity==='function')tools.push(await require('./activity-tools.cjs').createPreviewTool(previewActivity,{language:tutorLanguage}));
 /* "Ver o que desenhei" (#60): o print do SVG ou da cerca plot. */
 if(typeof viewFigure==='function')tools.push(await require('./figure-tool.cjs').createFigureTool(viewFigure,{language:tutorLanguage}));
 /* GeoGebra (#53): a mesma ferramenta do Pi, sobre o serviço do host. */
 if(geogebra&&typeof geogebra.run==='function')tools.push(await require('./geogebra-tool.cjs').createGeogebraTool(geogebra,{language:tutorLanguage}));
 return createSdkMcpServer({name:'mesa',version:'1.2.0',tools});
}
module.exports={createStudyToolsServer};
