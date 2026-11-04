import {$,S,connect,cancelConnect,applyEngineData} from './state.mjs';
import {build,preserveFocus} from './view-host.mjs';
import tutorStateCore from './generated/tutorstate.core.js';
import {reasonFacts} from './tutor-reason.mjs';
import {visibleRecord,resumeStudy,forgetResume,leaveResume} from './resume.mjs';
import {text,currentLanguage,LANGUAGE_EVENT} from './ui-text.mjs';
import {engineReady,otherEngineDetected} from './engine-facts.mjs';

/* Estados do tutor na coluna (ticket #17): desligado (com ou sem "onde parei"),
   ligando e sem resposta. A árvore sai do núcleo (`core/tutorstate.bend`); aqui
   ficam o DOM vivo (`#tutor-state`, entre as mensagens e a linha de atividade),
   os fatos (`S.link`, o registro de retomada) e as ações. O host só conecta o
   que o núcleo decidiu — o estado e o motivo vêm de `S.link`, que o `connect()`
   e a saúde alimentam. */
let host={newSession:()=>{},openPiSettings:()=>{},openLog:()=>{},openAbout:()=>{},updateClaude:()=>{},openReleaseNotes:()=>{}};
let painted='';
/* Até o boot decidir se liga o tutor, a coluna não diz "desligado": o convite
   piscaria antes do "Chamando o tutor" em toda abertura. */
let ready=false;

const handlers=()=>({
 Connect:async()=>{
  /* Sem o motor da sessão, "Chamar de novo" não repete a mesma falha: abre a
     sessão nova no motor que a Mesa encontrar agora (#93). Com o motor
     presente, continua sendo só a nova tentativa de conexão. */
  try{applyEngineData(await window.desk.getConfig());}catch{/* sem config novo, decide com o que já sabe */}
  const facts={engine:S.engine,detectedPi:S.detected?.pi,detectedClaude:S.detected?.claude,detectedOpenCode:S.detected?.opencode};
  /* Sem motor nenhum, a chamada segue e mostra o erro; trocar de sessão só
     quando há outro motor para onde ir (#93). */
  if(!engineReady(facts)&&otherEngineDetected(facts)){host.newSession();return;}
  connect().catch(()=>{});
 },
 Cancel:()=>{cancelConnect().catch(()=>{});},
 Resume:()=>{resumeStudy().catch(()=>{});},
 NewSession:()=>{leaveResume();host.newSession();},
 Forget:()=>{forgetResume().catch(()=>{});},
 OpenLog:()=>host.openLog(),
 OpenPiSettings:()=>host.openPiSettings(),
 /* OpenCode ausente: a instalação mora na janela de novidades (o mesmo caminho
    da primeira abertura), não num botão que repete a falha. */
 OpenReleaseNotes:()=>host.openReleaseNotes(),
 /* Começar sem plano pago (#44): evento, não import, para o tutor-state não depender do diálogo. */
 UseFreeModels:()=>window.dispatchEvent(new Event('desk-open-free-models')),
 /* Claude Code fora da faixa (#51): a confirmação do #45 no Sobre, ou o Sobre. */
 UpdateClaude:()=>host.updateClaude(),
 OpenAbout:()=>host.openAbout()
});

/* O campo da mensagem diz o que acontece se a pessoa escrever agora (#27). Na
   primeira abertura (#64) a caixa fica atrás da tela cheia, `inert`. */
function paintComposerHint(){
 const prompt=$('#prompt');if(!prompt)return;
 const hint=text(tutorStateCore.composerHint(String(S.link?.state||'')));
 if(prompt.placeholder!==hint)prompt.placeholder=hint;
}

export function paintTutorState(){
 const mount=$('#tutor-state');if(!mount)return;
 /* Conversa antiga: o aviso de leitura e o botão de sessão nova são o único
    caminho; o estado de tutor desligado competiria com ele (#release OpenCode). */
 if(!ready||S.legacySession){mount.hidden=true;return;}
 paintComposerHint();
 const record=visibleRecord();
 const link=S.link||{};
 const {reason,fix}=reasonFacts(link.reason);
 /* O idioma entra na chave: a troca refaz a coluna com os mesmos fatos (#41).
    A apresentação do tutor da primeira abertura mora no passo "Tutor" da tela
    cheia desde a #64 (`setup-view.mjs`), não mais nesta coluna. */
 const key=JSON.stringify([currentLanguage(),link.state||'',reason,fix,record?[record.exercise,record.stopped,record.next]:null]);
 if(key===painted)return;
 painted=key;
 const tree=tutorStateCore.stateViewFix(String(link.state||''),reason,fix,!!record,record?.exercise||'',record?.stopped||'',record?.next||'');
 const built=build(tree,handlers());
 const focused=mount.contains(document.activeElement);
 for(const name of mount.getAttributeNames())if(!built.hasAttribute(name))mount.removeAttribute(name);
 for(const attr of built.attributes)mount.setAttribute(attr.name,attr.value);
 preserveFocus(mount,()=>mount.replaceChildren(...built.childNodes));
 /* Quem estava num botão que saiu da árvore (Chamar → Cancelar) fica com o
    foco no primeiro botão do estado novo, não no corpo da página. */
 if(focused&&!mount.contains(document.activeElement))mount.querySelector('button')?.focus();
 requestAnimationFrame(revealState);
 /* O modo de rolagem da coluna (`syncChatScrollMode`) é medido depois do
    layout: uma segunda passada cobre a troca de modo logo em seguida. */
 setTimeout(revealState,300);
}

/* Altura curta ou calculadora aberta: o `#chat` vira o scroller e o composer
   fica colado embaixo (sticky), cobrindo o fim do conteúdo. O bloco de estado
   é o que a pessoa precisa para continuar (Chamar, Cancelar, Retomar): ele tem
   de ficar acima da caixa, não escondido atrás dela. */
function revealState(){
 const mount=$('#tutor-state'),chat=$('#chat');
 if(!mount||!chat||mount.hidden)return;
 if(chat.scrollHeight>chat.clientHeight+1)chat.scrollTop=chat.scrollHeight;
}

/* O boot já decidiu (ligou, ou não achou o Pi): a coluna passa a dizer o estado. */
export function showTutorState(){
 ready=true;
 paintTutorState();
}

export function initTutorState(hooks){
 host={...host,...hooks};
 window.addEventListener('desk-tutor-link',paintTutorState);
 window.addEventListener('desk-resume-changed',paintTutorState);
 window.addEventListener(LANGUAGE_EVENT,paintTutorState);
 /* Janela menor ou calculadora aberta mudam a altura da coluna sem repintar o
    bloco: o observador o mantém acima da caixa de mensagem. */
 const chat=$('#chat');
 if(chat&&typeof ResizeObserver==='function'){
  let last=0;
  new ResizeObserver(()=>{
   const height=chat.clientHeight;
   if(height===last)return;
   last=height;revealState();
  }).observe(chat);
 }
 paintTutorState();
}
