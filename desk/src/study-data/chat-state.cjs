'use strict';
const {deskLayout}=require('../../state-adapter.cjs');
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);

/* Captura só o layout/rascunho desta conversa; nunca incorpora o mapa das
   demais sessões nem estado do provider, fila ou configuração. */
function capture(state={}){
 const layout=deskLayout(state);
 /* Cópia rasa de propósito: o layout guardado não pode compartilhar array/objeto
    com o estado vivo (uma edição no leitor mudaria a conversa antiga sem save). */
 const pdfs=Array.isArray(state.pdfs)?state.pdfs.map(item=>plain(item)?{...item}:item):[];
 const rotations=plain(state.pdfRotations)?{...state.pdfRotations}:{};
 const study=plain(state.study)?{...state.study}:{};
 return {draft:layout.draft,pdfs,
  pdfRotations:rotations,study,
  referenceVisible:layout.referenceVisible,chatWidth:layout.chatWidth,calcHeight:layout.calcHeight,pdfSplit:layout.pdfSplit};
}
function restore(current,courseState,file){
 const saved=plain(courseState?.sessionLayouts?.[file])?courseState.sessionLayouts[file]:null;
 if(!saved)return {...current,draft:'',study:courseState?.sessionStudies?.[file]||{title:'',xopp:''}};
 return {...current,...capture(saved),theme:current.theme};
}
module.exports={capture,restore};
