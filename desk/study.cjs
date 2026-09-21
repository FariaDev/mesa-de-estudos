const fs=require('node:fs');
const core=require('./src/generated/study.core.js').default;

/* Restauração do rascunho Xournal: o núcleo Bend (core/study.bend) apara o
   título (240), exige `.xopp` e só devolve o caminho se o arquivo existe; o
   `exists` é fato do host — o I/O fica aqui. */
function cleanStudy(value={}){
 const title=typeof value.title==='string'?value.title:'';
 const xopp=typeof value.xopp==='string'?value.xopp.trim():'';
 const study=core.cleanStudy(title,xopp,!!xopp&&fs.existsSync(xopp));
 return {title:study.title,xopp:study.xopp};
}

function authorizeRestoredStudy(value,allowedXopp){
 const study=cleanStudy(value);
 if(study.xopp)allowedXopp.add(study.xopp);
 return study;
}

module.exports={cleanStudy,authorizeRestoredStudy};
