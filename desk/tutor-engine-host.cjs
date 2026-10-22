// @ts-check
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const conversations=require('./src/agents/conversations.cjs');
const {metadata:agentMetadata}=require('./src/agents/service.cjs');
const {DescriptorCache}=require('./src/agents/descriptor-cache.cjs');
const {claudePrompt,openCodePrompt}=require('./src/agents/desk-prompts.cjs');
const {findClaudeLauncher,detectClaude}=require('./src/agents/claude-environment.cjs');
const {findOpenCodeLauncher}=require('./src/agents/opencode-process.cjs');
const {sessionPreviewFromJsonl}=require('./lib.cjs');
const {resolvePi}=require('./pi.cjs');
const {message}=require('./src/i18n.mjs');

/* Motor do tutor da conversa ativa (#43 fase 2: saiu do main.cjs): Pi,
   Claude Code ou OpenCode (#57), descritores nativos, metadados para a tela e
   o preparo do Claude (perfil de estudo, workspace, prompt) do principal e do
   chat lateral. O preparo do OpenCode mora em `opencode-tutor-host.cjs`. */

const MANAGED_DESCRIPTOR_RE=/^(claude|opencode)-[0-9a-f-]{36}\.json$/;
/** @param {string} kind */
const isNative=kind=>conversations.NATIVE_ENGINES.includes(kind);

/**
 * Cria o motor do tutor sobre o estado vivo do main.
 * Devolve piBinary, engine, isNative, openCodeBinary, claudeBinary, claudeDetector, descriptorCache,
 * conversationData, sessionInfo, claudeProfile, prepareClaude, prepareOpenCode, prepareClaudeSide,
 * testClaudeSdkLoader e previewFile.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, deskDir: string, TEST_MODE: boolean, FREE_ID: string}} options
 *   `live` traz config, sessão, matéria, ponte, estado e idioma do main
 * @example const {engine,prepareClaude}=createTutorEngineHost({live,runtime,deskDir,TEST_MODE,FREE_ID});
 */
function createTutorEngineHost({live,runtime,deskDir,TEST_MODE,FREE_ID}){
 function piBinary(){return resolvePi({configPath:live.config.piPath,deskDir,envPath:process.env.LEARNING_DESK_PI||''});}
 function engine(file=live.session){
  // A missing/corrupt managed descriptor keeps its engine for display and is
  // blocked by prepareClaude/prepareOpenCode. It must never start Pi as a recovery fallback.
  const managed=MANAGED_DESCRIPTOR_RE.exec(path.basename(file||''));
  if(managed)return managed[1];
  return conversations.conversationEngine(file,{runtime});
 }
 /* Nos testes de janela a casa onde se procura o `~/.local/bin/claude` vem de
    LEARNING_DESK_CLAUDE_HOME (só com DESK_TEST): o `tests/electron-env.mjs` a
    aponta para um Claude de guarda (0.0.0, fora da faixa), para nenhum teste
    chegar ao Claude Code real — que, dentro da faixa (#51), passaria do
    `--version` ao `auth status`. */
 const testClaudeHome=()=>TEST_MODE&&process.env.LEARNING_DESK_CLAUDE_HOME?process.env.LEARNING_DESK_CLAUDE_HOME:undefined;
 function claudeBinary(){
  const home=testClaudeHome();
  return findClaudeLauncher({configuredPath:live.config.claudePath,...(home?{home}:{})});
 }
 /* A escolha do executável (sempre o Claude Code do usuário, dentro da faixa
    aceita — #51) é uma função só, `detectClaude`, chamada pelo adaptador do
    principal e do chat lateral. Fora dos testes vale a do adaptador. Com o SDK
    simulado dos testes o adaptador pula a detecção; só
    LEARNING_DESK_CLAUDE_DETECT=1 a força. */
 function claudeDetector(){
  if(!TEST_MODE)return undefined;
  if(testClaudeSdkLoader()&&process.env.LEARNING_DESK_CLAUDE_DETECT!=='1')return undefined;
  const home=testClaudeHome();
  return options=>detectClaude({...options,...(home?{home}:{})});
 }
 /* Nos testes de janela só vale o fake apontado por LEARNING_DESK_OPENCODE:
    nenhum teste sobe o OpenCode real do usuário (#57). */
 function openCodeBinary(){
  const envPath=process.env.LEARNING_DESK_OPENCODE||'';
  if(TEST_MODE)return envPath&&fs.existsSync(envPath)?envPath:'';
  return findOpenCodeLauncher({envPath});
 }
 const descriptorCache=new DescriptorCache({read:file=>conversations.readClaudeConversation(file,{runtime})});
 function conversationData({messages=true}={}){
  const kind=engine();let record=null;const native=isNative(kind);
  if(native)try{record=descriptorCache.get(live.session,{messages});
   if(!live.bridge&&['accepted','transmitting'].includes(record?.delivery?.status)){conversations.recoverClaudeConversation(live.session,{runtime});
    record=descriptorCache.get(live.session,{messages});}}catch{/* registro nulo chega à tela como conversationStatus.invalid */}
  return {...agentMetadata(kind,native?live.bridge?.adapter?.controlsSnapshot?.():null),conversationStatus:native?{uncertain:record?.delivery?.status==='uncertain'||!!live.bridge?.uncertain,invalid:!record}:null,detectedClaude:claudeBinary(),detectedOpenCode:kind==='opencode'?openCodeBinary():'',...(native&&messages?{messages:record?.messages||[]}:{})};
 }
 function sessionInfo(file){
  const kind=engine(file);
  const record=isNative(kind)?descriptorCache.get(file):null;
  return record?{engine:kind,started:record.started,preview:record.preview}:{engine:kind,...(isNative(kind)?{preview:'Sessão indisponível — arquivo preservado'}:{})};
 }
 /* Perfil de estudo do Claude selecionado explicitamente (TUTOR/LEARNER da
    matéria, do vault ou dos templates): principal e chat lateral usam o MESMO
    texto. A montagem do prompt de sistema mora em `src/agents/desk-prompts.cjs`. */
 function claudeProfile(){
  /* Livre: prompt genérico — nada de TUTOR/LEARNER da matéria nem do vault. */
  if(live.courseId===FREE_ID)return [];
  const profile=[];
  for(const name of ['TUTOR.md','LEARNER.md']){
   const selected=[live.course&&path.join(live.course,name),live.config.vaultPath&&path.join(live.config.vaultPath,name),path.join(deskDir,'templates',name)].filter(Boolean).find(p=>fs.existsSync(p));
   if(selected){const st=fs.statSync(selected);if(st.isFile()&&st.size<=65536)profile.push({name,text:fs.readFileSync(selected,'utf8')});}
  }
  return profile;
 }
 /* Mensagens de cada motor nativo: o aluno vê o nome do motor certo. */
 const NATIVE_ERRORS={claude:{missing:'err.claude.recordMissing',course:'err.claude.wrongCourse'},opencode:{missing:'err.opencode.recordMissing',course:'err.opencode.wrongCourse'}};
 /* Descritor, pasta própria da conversa e transcrição importada (uma vez) —
    o MESMO preparo para Claude e OpenCode; só o prompt muda. */
 function prepareNative(kind){
  const record=conversations.readClaudeConversation(live.session,{runtime});
  if(!record)throw Error(message(NATIVE_ERRORS[kind].missing));
  if(record.courseId!==live.courseId)throw Error(message(NATIVE_ERRORS[kind].course));
  const cwd=path.join(runtime,`${kind}-workspaces`,record.id);fs.mkdirSync(cwd,{recursive:true});
  // Context is selected explicitly; no vault symlink or inherited Pi profile.
  if(!record.importedTranscript&&!record.nativeEstablished&&record.messages?.length){
   record.importedTranscript=record.messages.filter(m=>['user','assistant'].includes(m.role)).map(m=>`${m.role}: ${(m.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n')}`).join('\n\n').slice(-50000);
   record.importedPrefixLength=record.messages.length;
   conversations.updateClaudeConversation(live.session,{importedTranscript:record.importedTranscript,importedPrefixLength:record.importedPrefixLength},{runtime});
  }
  return {cwd,record};
 }
 function prepareClaude(){
  const {cwd,record}=prepareNative('claude');
  return {cwd,systemPrompt:claudePrompt({profile:claudeProfile(),transcript:record.importedTranscript||'',tools:true,tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app}),record};
 }
 /* OpenCode (#57): mesma pasta por conversa (`opencode-workspaces/<id>`), que
    vira o `location.directory` da sessão; o prompt vai no primeiro envio. */
 function prepareOpenCode(){
  const {cwd,record}=prepareNative('opencode');
  return {cwd,systemPrompt:openCodePrompt({profile:claudeProfile(),transcript:record.importedTranscript||'',tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app}),record};
 }
 /* Preparação do chat lateral Claude: workspace PRÓPRIO (record.id do descritor
    lateral), mesmo perfil de estudo e mesma recusa de matéria — nunca inicia o Pi
    como fallback. */
 function prepareClaudeSide(record){
  if(!record||record.courseId!==live.courseId)throw Error(message('err.claude.wrongCourse'));
  const cwd=path.join(runtime,'claude-workspaces',record.id);fs.mkdirSync(cwd,{recursive:true});
  return {cwd,systemPrompt:claudePrompt({profile:claudeProfile(),tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app})};
 }
 function testClaudeSdkLoader(){
  if(!TEST_MODE||!process.env.LEARNING_DESK_CLAUDE_SDK_FACTORY)return undefined;
  const fixture=process.env.LEARNING_DESK_CLAUDE_SDK_FACTORY;
  if(!fs.realpathSync(fixture).startsWith(path.join(deskDir,'tests','fixtures')+path.sep))throw Error(`SDK simulado fora dos fixtures: ${path.basename(fixture)} não está em tests/fixtures.`);
  return ()=>import(require('node:url').pathToFileURL(fixture).href);
 }
 function previewFile(file){
  if(isNative(engine(file)))return descriptorCache.get(file)?.preview||'';
  try{return sessionPreviewFromJsonl(fs.readFileSync(file,'utf8').slice(0,200000));}catch{return '';}
 }
 return {piBinary,engine,isNative,openCodeBinary,claudeBinary,claudeDetector,descriptorCache,conversationData,sessionInfo,claudeProfile,prepareClaude,prepareOpenCode,prepareClaudeSide,testClaudeSdkLoader,previewFile};
}

module.exports={createTutorEngineHost};
