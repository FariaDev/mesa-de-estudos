// @ts-check
'use strict';
const {message: uiMsg} = require('./src/i18n.mjs');
const fs=require('node:fs');
const path=require('node:path');

// O caminho vem de um File nativo no preload, escolhido ao soltar no leitor.
// Checa o arquivo antes de ampliar a biblioteca/allowlist ou importar no Livre.
function validateDroppedPdf(file){
 if(typeof file!=='string'||!file||file.length>4096||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.pdf')throw Error(uiMsg('err.drop.notPdf'));
 const stat=fs.statSync(file);
 if(!stat.isFile())throw Error(uiMsg('err.drop.folder'));
 const header=Buffer.alloc(1024),fd=fs.openSync(file,'r');
 let count;
 try{count=fs.readSync(fd,header,0,header.length,0);}finally{fs.closeSync(fd);}
 if(!/%PDF-\d\.\d/.test(header.subarray(0,count).toString('latin1')))throw Error(uiMsg('err.drop.badHeader'));
 return {name:path.basename(file),path:file};
}
module.exports={validateDroppedPdf};
