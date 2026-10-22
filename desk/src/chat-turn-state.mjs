

/* Coluna do tutor — estado do turno vivo e da fala do assistente, âncoras
   das ferramentas, slots das atividades e os ledgers do que já foi recolhido.
   Saiu de chat.mjs na #43 fase 2. */

/* Estado do turno e da fala do assistente num objeto só (#43 fase 2): os
   módulos do chat o dividem sem reatribuir import. */
const turnState={
 /* Num lote de histórico a rolagem é medida uma vez (`showHistory`); durante o
    lote `paintMessage` não lê layout (o `atBottom()` por mensagem forçava um
    reflow por mensagem — com um token sem espaço de 20 KB, ~850 ms cada). */
 historyStick:null,
 assistant:null,assistantText:'',assistantId:null,assistantKey:null,assistantEnded:false,messageEnded:false,thinkingOpenKey:null,
 /* Blocos de fala por (mensagem, contentIndex): o `*_end` e o `message_end`
    atualizam o bloco certo e um texto DEPOIS de uma ferramenta não reusa a
    bolha de antes (text-tool-text na mesma mensagem). O Pi não manda
    `message.id`: o host cria a identidade por sequência de `message_start`
    (`host-msg-N`), então cada bloco final tem chave própria e o `message_end`
    reconcilia TODOS sem fundir falas; sem chave, recua para a bolha corrente,
    mas a declaração/execução de ferramenta encerra a bolha aberta. */
 assistantBlocks:new Map(),
 /* Blocos de fala SEM `contentIndex` (host legado): fila FIFO dos balões que
    nasceram por delta sem índice. O `message_end` reconcilia cada parte de
    texto com o balão certo na ORDEM em vez de duplicar a primeira fala (N2). */
 assistantLoose:[],
 assistantSeq:0,
 turnLog:null,turnTrack:null,liveTick:0,renderTimer:0,stoppedTurn:false,
 turnClosed:true,turnRunId:null,turnConversation:null,
 /* "Pedimos um turno": a resposta do host pode dizer streaming:false numa corrida
    (processo que morre logo depois do aceite) e o diário não pode perder o
    parcial. É limpo em qualquer recolhimento/erro fatal. */
 promptArmed:false,
 turnActivityCalls:new Set(),
 /* Avisos visíveis desta conversa (o adaptador avisa por `warning`→`desk_warn`;
    o serviço repassa `code`/`rateLimit`/`detail`). O limite é guardado POR
    JANELA (tipo + reset) num passo puro (`limitNoticeState`): `allowed`/
    CLAUDE_RATE_LIMIT_RESUMED limpa só a janela liberada e o aviso mais grave
    que restar volta à faixa — uma janela liberada nunca esconde outra janela
    rejeitada. A faixa fica com a mensagem nativa e o toast sai quando o aviso
    visível MUDA. Aviso nenhum marca idle/desconexão nem reenvia: o turno segue
    como o adaptador decretar. O fim do turno, erro fatal e troca de conversa
    (o `showHistory` da carga) zeram tudo. */
 limitEntries:[],
 limitShown:'',
 limitBandText:'',
 activityNotice:null,
};
/* Posição lógica das ferramentas JÁ declaradas nesta mensagem (id → {index,el}):
   um texto que só chega no `message_end` e pertence a um índice ANTERIOR nasce
   antes do passo da ferramenta — e do slot, que não se move. */
const assistantAnchors=new Map();
/* Ferramentas de turnos JÁ recolhidos: `message_end`/`tool_execution_end`
   atrasado que cite um desses ids não pinta no turno novo (N1 — a defesa do
   host já os descarta; esta é a repetição local para o renderer). O ledger é
   do ESCOPO da conversa: troca/recarga zera (a identidade nativa pode ser
   reusada legitimamente); Parar na MESMA conversa mantém a proteção. */
const retiredTurnTools=new Set();
/* Corridas JÁ recolhidas (`hostRun`/`runId`): um evento carimbado com uma
   corrida morta é atraso mesmo na janela entre o Parar e o `agent_start`
   novo. Usa SÓ a identidade que o evento carrega — nunca igualdade/sufixo de
   texto como prova de posse. */
const retiredHostRuns=new Set();
function resetRetiredLedgers(){
 retiredTurnTools.clear();
 retiredHostRuns.clear();
}
const activitySlots=new Map();

export {turnState,assistantAnchors,retiredTurnTools,retiredHostRuns,resetRetiredLedgers,activitySlots};
