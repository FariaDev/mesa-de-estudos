// Quatro caminhos da mesma cerca (#seg-markup, item 7): `markupInline` em
// `extension_ui_request` (`chat-dialogs.mjs:29`), chat lateral, cartões e quiz
// usam o mesmo `markup`/`markupInline` — `for="dialog-ok"` (e `send`, `check`,
// `free-pdf-save`) não ativa controle real em nenhum deles.
// Roda: `node tests/chat-model-attrs-4paths-ui.mjs`.
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,launchDesk,statusOnline} from './helpers.mjs';

await withArtifacts('chat-model-4paths',async ctx=>{
  const runtime=ctx.runtime=newRuntime('chat-model-4paths');
  const {seedCourse,seedNativeSession,writeConfigJson,writeDeskJson}=await import('./helpers.mjs');
  const course=seedCourse(runtime,'calc');
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  const session=seedNativeSession(runtime,[
    {role:'user',content:[{type:'text',text:'oi'}]},
    {role:'assistant',content:[{type:'text',text:'oi'}]},
  ],{courseId:'calc',started:Date.now()-3600000,preview:'oi'});
  writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
  const page=await app.firstWindow();
  await statusOnline(page);
  const facts=await page.evaluate(async ()=>{
    const {markupInline}=await import(new URL('src/markdown.mjs',location.href).href);
    const {sidechatMessageCard}=await import(new URL('src/sidechat-message-view.mjs',location.href).href);
    const {cardElement}=await import(new URL('src/cards-view.mjs',location.href).href);
    const {renderPiDialog}=await import(new URL('src/dialogs.mjs',location.href).href);
    const evil='<label for="dialog-ok">CLIQUE-OK</label> <label for="send">CLIQUE-SEND</label>';
    const inline=markupInline(evil);
    const inlineHasFor=/\bfor\s*=/i.test(inline);
    const side=sidechatMessageCard({role:'assistant',text:evil},'Tutor');
    const sideFors=[...side.querySelectorAll('label')].map(l=>l.getAttribute('for'));
    const card=cardElement({id:'c1',kind:'quiz',question:evil,options:[{label:evil}],multiSelect:false,answered:false,dismissed:false},{
      answer:async()=>({}),draft:async()=>({}),dismiss:async()=>({}),conclude:async()=>({}),
    });
    const cardFors=[...card.querySelectorAll('label')].map(l=>l.getAttribute('for'));
    renderPiDialog({title:'T',message:evil,field:null},{inline:markupInline});
    const dialogFors=[...document.querySelectorAll('#dialog-message label')].map(l=>l.getAttribute('for'));
    const quizOption=markupInline(evil);
    return {inline,inlineHasFor,sideFors,cardFors,dialogFors,quizOptionHasFor:/\bfor\s*=/i.test(quizOption)};
  });
  assert.equal(facts.inlineHasFor,false,`markupInline deixou for: ${facts.inline}`);
  assert.deepEqual(facts.sideFors.filter(Boolean),[],`sidechat deixou for: ${JSON.stringify(facts.sideFors)}`);
  assert.deepEqual(facts.cardFors.filter(Boolean),[],`cartão deixou for: ${JSON.stringify(facts.cardFors)}`);
  assert.deepEqual(facts.dialogFors.filter(Boolean),[],`diálogo deixou for: ${JSON.stringify(facts.dialogFors)}`);
  assert.equal(facts.quizOptionHasFor,false,'quiz deixou for');
  await app.close();ctx.app=null;
});
console.log('chat-model-attrs-4paths-ui: ok');
