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
const {detectTutorEngines}=require('./tutor-default-engine.cjs');
const {visibleEngines,defaultVisibleEngine}=require('./visible-engines.cjs');
const {oldOpenCode,readOpenCodeVersionSync}=require('./src/agents/opencode-version.cjs');
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
 * Devolve piBinary, engine, isNative, openCodeBinary, claudeBinary, claudeDetector, defaultEngine,
 * newSessionPath, resumeSession, engineFacts, descriptorCache, conversationData, sessionInfo, claudeProfile,
 * prepareClaude, prepareOpenCode, prepareClaudeSide, prepareOpenCodeSide, testClaudeSdkLoader e previewFile.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, deskDir: string, TEST_MODE: boolean, FREE_ID: string}} options
 *   `live` traz config, sessão, matéria, ponte, estado e idioma do main
 * @example const {engine,prepareClaude}=createTutorEngineHost({live,runtime,deskDir,TEST_MODE,FREE_ID});
 */
function createTutorEngineHost({live,runtime,deskDir,TEST_MODE,FREE_ID}){
 function piBinary(){
  /* Em teste só vale o fake apontado por LEARNING_DESK_PI (mesma regra do
     OpenCode): o Pi real do PATH ou do Homebrew não pode decidir uma janela
     de teste nem ser executado por ela (#93). */
  if(TEST_MODE){const file=process.env.LEARNING_DESK_PI||'';try{return file&&fs.statSync(file).isFile()?file:'';}catch{return '';}}
  return resolvePi({configPath:live.config.piPath,deskDir,envPath:process.env.LEARNING_DESK_PI||''});
 }
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
  const found=findOpenCodeLauncher({envPath});
  return found&&!oldOpenCode(readOpenCodeVersionSync(found))?found:'';
 }
 /* Motor de uma conversa nova quando não há nada salvo (#93). Em teste só os
    fakes do ambiente contam; fora dele vale a preferência Pi → Claude →
    OpenCode. O Pi continua primeiro para a mesa de quem já o usa não mudar. */
 function engineFacts(){
  return detectTutorEngines({config:live.config,deskDir,env:process.env,testMode:TEST_MODE});
 }
 /* A vista deste release (#release OpenCode): só o OpenCode aparece e só ele
    recebe sessão nova. A chave de teste reabre os fakes; produção não. */
 function visible(){return visibleEngines({testMode:TEST_MODE,env:process.env});}
 /* Sem nenhum motor visível o padrão é OpenCode — o caminho do release —, e o
    erro de conexão já fala dele, nunca do Pi. */
 function defaultEngine(){return defaultVisibleEngine(engineFacts(),{testMode:TEST_MODE,env:process.env});}
 /* Modelo e esforço padrão da pessoa (estado de interface) para uma sessão
    OpenCode nova; sessão aberta mantém o modelo dela. */
 function openCodeDefault(){
  const choice=/** @type {{provider?: string, id?: string, effort?: string} | null | undefined} */ (live.state?.modelDefault);
  return choice?.provider&&choice.id?{model:`${choice.provider}/${choice.id}`,...(choice.effort?{effort:String(choice.effort)}:{})}:{};
 }
 /* Caminho de conversa nova no motor escolhido: descritor para Claude e
    OpenCode, JSONL para o Pi. `chosen` fora da vista cai no padrão (OpenCode
    neste release). */
 function newSessionPath(course,chosen=defaultEngine()){
  const pick=visible().includes(chosen)?chosen:defaultEngine();
  return isNative(pick)?conversations.createClaudeConversation({runtime,courseId:course,engine:pick,...(pick==='opencode'?openCodeDefault():{})}):path.join(runtime,`pi-${Date.now()}.jsonl`);
 }
 /* A conversa salva só volta se o motor dela aparece neste release. Pi e Claude
    antigos ficam na lista e abrem pela lista (somente leitura); o boot e a troca
    de matéria começam uma sessão OpenCode nova, sem apagar nada. */
 function resumeSession(file,course){
  if(!file)return newSessionPath(course);
  const kind=engine(file);
  if(visible().includes(kind))return isNative(kind)||piBinary()?file:newSessionPath(course);
  return newSessionPath(course);
 }
 const descriptorCache=new DescriptorCache({read:file=>conversations.readClaudeConversation(file,{runtime})});
 /* Histórico Pi em somente leitura (#93): sem Pi instalado a conversa antiga
    não some; o JSONL é lido, nunca reescrito. */
 function piHistory(file){
  try{
   const out=[];
   for(const line of fs.readFileSync(file,'utf8').slice(0,200000).split('\n')){
    if(!line.trim())continue;
    let entry;try{entry=JSON.parse(line);}catch{continue;}
    const msg=entry.message||entry;const role=msg.role||entry.role;
    const parts=typeof msg.content==='string'?[msg.content]:Array.isArray(msg.content)?msg.content.filter(p=>p&&(p.type==='text'||typeof p==='string')).map(p=>typeof p==='string'?p:p.text||''):[];
    const value=parts.join('\n').trim();
    if(value&&(role==='user'||role==='assistant'))out.push({role,content:[{type:'text',text:value}]});
   }
   return out;
  }catch{return [];}
 }
 function conversationData({messages=true}={}){
  const kind=engine();let record=null;const native=isNative(kind);
  if(native)try{record=descriptorCache.get(live.session,{messages});
   if(!live.bridge&&['accepted','transmitting'].includes(record?.delivery?.status)){conversations.recoverClaudeConversation(live.session,{runtime});
    record=descriptorCache.get(live.session,{messages});}}catch{/* registro nulo chega à tela como conversationStatus.invalid */}
  const facts=engineFacts();
  const piMessages=kind==='pi'&&messages?piHistory(live.session):[];
  return {...agentMetadata(kind,native?live.bridge?.adapter?.controlsSnapshot?.():null),conversationStatus:native?{uncertain:record?.delivery?.status==='uncertain'||!!live.bridge?.uncertain,invalid:!record}:null,detectedClaude:claudeBinary(),detectedOpenCode:openCodeBinary(),detectedOpenCodeOldVersion:facts.opencodeOld||'',visibleEngines:visible(),...(native&&messages?{messages:record?.messages||[]}:{}),...(piMessages.length?{messages:piMessages}:{}),cards:live.cardHost?live.cardHost.list(live.session):[]};
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
  /* B2: a aba Livre não tem caderno de revisão, então não oferece propor_revisao. */
  return {cwd,systemPrompt:claudePrompt({profile:claudeProfile(),transcript:record.importedTranscript||'',tools:true,review:live.courseId!==FREE_ID,tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app}),record};
 }
 /* OpenCode (#57): mesma pasta por conversa (`opencode-workspaces/<id>`), que
    vira o `location.directory` da sessão; o prompt vai no canal de instruções. */
 function prepareOpenCode(){
  const {cwd,record}=prepareNative('opencode');
  return {cwd,systemPrompt:openCodePrompt({profile:claudeProfile(),transcript:record.importedTranscript||'',review:live.courseId!==FREE_ID,tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app}),record};
 }
 /* Preparação do chat lateral Claude: workspace PRÓPRIO (record.id do descritor
    lateral), mesmo perfil de estudo e mesma recusa de matéria — nunca inicia o Pi
    como fallback. */
 function prepareSide(kind,record){
  if(!record||record.courseId!==live.courseId)throw Error(message(NATIVE_ERRORS[kind].course));
  const cwd=path.join(runtime,`${kind}-workspaces`,record.id);fs.mkdirSync(cwd,{recursive:true});
  return cwd;
 }
 function prepareClaudeSide(record){
  const cwd=prepareSide('claude',record);
  return {cwd,systemPrompt:claudePrompt({profile:claudeProfile(),tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app})};
 }
 /* O lateral OpenCode (#74): o mesmo preparo, com o prompt do OpenCode.
    `sidechat` troca as ofertas da sessão principal pelo texto lateral: o MCP
    desse chat é `pdfOnly` e só tem ler_pdf e buscar_material (A4). */
 function prepareOpenCodeSide(record){
  const cwd=prepareSide('opencode',record);
  return {cwd,systemPrompt:openCodePrompt({profile:claudeProfile(),sidechat:true,tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app})};
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
 return {piBinary,engine,isNative,openCodeBinary,claudeBinary,claudeDetector,defaultEngine,newSessionPath,resumeSession,engineFacts,visibleEngines:visible,descriptorCache,conversationData,piHistory,sessionInfo,claudeProfile,prepareClaude,prepareOpenCode,prepareClaudeSide,prepareOpenCodeSide,testClaudeSdkLoader,previewFile};
}

module.exports={createTutorEngineHost};
