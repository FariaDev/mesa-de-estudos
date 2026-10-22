import test from 'node:test';
import assert from 'node:assert/strict';
import store from '../src/study-data/chat-state.cjs';

test('rascunho e leitores são restaurados por conversa sem mudar tema ou enviar fila',()=>{
 const first=store.capture({draft:'minha dúvida em edição',pdfs:[{path:'/materia/a.pdf',page:7}],study:{title:'Q7',xopp:''},theme:'dark',queue:['nunca deve entrar'],courseStates:{recursion:true}});
 const courseState={sessionLayouts:{chatA:first}};
 const restored=store.restore({draft:'outra conversa',theme:'light'},courseState,'chatA');
 assert.equal(restored.draft,'minha dúvida em edição');assert.equal(restored.pdfs[0].page,7);assert.equal(restored.theme,'light');assert.equal(restored.study.title,'Q7');
 assert.equal(Object.hasOwn(first,'queue'),false);assert.equal(Object.hasOwn(first,'courseStates'),false);
});
test('conversa antiga sem layout começa vazia e usa estudo legado próprio',()=>{
 const state=store.restore({draft:'não herdar',pdfs:[{path:'/materia/a.pdf'}],theme:'dark'},{sessionStudies:{old:{title:'legado',xopp:''}}},'old');
 assert.equal(state.draft,'');assert.equal(state.study.title,'legado');assert.equal(state.theme,'dark');
});
test('o layout guardado não compartilha array/objeto com o estado vivo',()=>{
 const live={draft:'x',pdfs:[{path:'/materia/a.pdf',page:2,zoom:1}],pdfRotations:{'/materia/a.pdf':90},study:{title:'Q7',xopp:''},theme:'dark'};
 const saved=store.capture(live);
 live.pdfs[0].page=9;live.pdfs.push({path:'/materia/b.pdf'});live.pdfRotations['/materia/a.pdf']=0;live.study.title='mudou';
 assert.equal(saved.pdfs.length,1);assert.equal(saved.pdfs[0].page,2);assert.equal(saved.pdfRotations['/materia/a.pdf'],90);assert.equal(saved.study.title,'Q7');
 const courseState={sessionLayouts:{chatA:saved}};
 const restored=store.restore({draft:'',theme:'light'},courseState,'chatA');
 restored.pdfs[0].page=77;restored.study.title='rascunho';
 assert.equal(courseState.sessionLayouts.chatA.pdfs[0].page,2,'editar o estado restaurado não reescreve o layout guardado');
 assert.equal(courseState.sessionLayouts.chatA.study.title,'Q7');
});
