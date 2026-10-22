# Revisão independente — atividade interativa (domínio + integração root)

Data: 2026-10-08. READ ONLY: nenhum arquivo do produto ou dos testes foi
editado; probes e logs em `/private/tmp/mesa-activity-independent-probe/` e
`/private/tmp/independent-hunt-activity-ui.log`. Revisão feita nos hashes:
`activity-runtime.cjs 7dfd9621` (já com a guarda watchdog do root),
`activity-store.cjs d893c7a7`, `activity-bridge.cjs fe91b4d8`,
`activity-host.cjs 428147e5`, `src/activity.mjs 209c042b`,
`src/agents/activity-call-gate.cjs 9f2d70e4`, `main.cjs 2b007268`,
`src/main.mjs 49524141`, `src/agents/claude-adapter.cjs b893a0c6`.
Timeline e PDF não foram revisitados, conforme o handoff.

## Método (medido, não inferido)

- `node --test tests/activity-*.test.mjs tests/mesa-activity-host.test.mjs
  tests/study-activity-backup.test.mjs` → 35/35 passam.
- `node tests/hunt-activity-ui.mjs` (execução independente) → 46 PASS / 0 FAIL.
- `node tests/mesa-interactive-ui.mjs` → PASS (main/preload/ponte/runtime reais,
  Pi sintético; `/private/tmp/independent-mesa-interactive.log`).
- `node tests/mesa-claude-activity-ui.mjs` → PASS (hook nativo, transporte MCP
  real, provedor sintético).
- Três probes Electron próprios com o wrapper e o runtime reais: documento
  adversarial (`result.json`), srcdoc/processo compartilhado (`result2.json`),
  RTC no filho srcdoc (`result3.json`), mais um probe do renderer real no
  harness `ui-main.cjs` (`renderer-probe.out`). Nenhum provedor real ou
  inferência; macOS, Electron 44.2.0.

## Resoluções verificadas

1. Ordem CSP → `LOCKDOWN_SCRIPT` → API → HTML do modelo: um `<script>` no html
   cru lê `RTCPeerConnection`, `webkitRTCPeerConnection`, `WebTransport` e
   `navigator.mediaDevices` como `undefined` (descriptor não configurável);
   `eval`, `new Function` e `setTimeout('código')` não executam.
   `window.desk`/`require`/`process`/`module` = undefined.
2. Rede/arquivos/nav do iframe inline: fetch/XHR/WS/ES/img/CSS/ping/meta/form
   bloqueados; `beacon` devolve `true` mas o servidor local recebeu 0
   requisições; `file:` bloqueado; `window.open` = null; navegação do topo =
   SecurityError; navegação própria negada por `will-frame-navigate` (navLog);
   `will-download` vazio; `data:` child bloqueado por CSP
   (`ERR_BLOCKED_BY_CSP`); worker cria objeto mas a execução falha
   (`worker-src none`); serviceWorker negado. IPC de frame não principal
   recusado por `trustedMainSender`/`allowSender` (sem preload no artefato).
3. Guarda watchdog do root: o fallback `frame.processId` (id interno do
   Chromium) saiu do pid; `canTerminateActivityProcess` exige osPid>0, mainPid
   conhecido e diferente, métrica atual tipo Tab com pid+creationTime iguais e
   nenhum frame vivo (de qualquer WebContents) no mesmo pid. Laço → Parar com
   um único frame montado: kill em ~3,7 s, pid some de `getAppMetrics`, próxima
   montagem carrega em 208 ms (probe1). Com pid compartilhado por outra
   atividade viva: `kill-failed` (probe2) — comportamento pretendido.
4. Fixes anteriores reconferidos: identidade portátil e backup relocado
   (35/35); `scopeRef` recusando conversa antiga (host e integrado); hash
   forjado e excesso UTF-8 não gravam; coalescing guarda a última mudança
   (a=4/24 m persistidos no integrado); Claude por `tool_use_id` + `callRef` +
   paramsHash + runId (unitário + SDK fake).
5. Flow integrado: ampliar preserva o mesmo iframe; histórico lazy; reabrir
   restaura o estado; Parar/Abrir mantém o último estado; evento atrasado em
   slot parado não automonta; KaTeX offline; tema dark/light/system.

## Achados abertos

### P1 — WebRTC escapa do lockdown por iframe `srcdoc` (egress UDP medido)

Sequência (`probe3-main.cjs`, reproduzível): o `js` do modelo cria
`iframe.srcdoc` e, no realm do filho, `new RTCPeerConnection({iceServers:[{urls:
'stun:HOST:UDP'}]})` + `createDataChannel` + `createOffer` +
`setLocalDescription`. O filho `about:srcdoc` tem `RTCPeerConnection` e
`WebTransport` como função e `navigator.mediaDevices` objeto — o
`LOCKDOWN_SCRIPT` roda só no realm do topo; o filho herda o CSP do pai mas não o
prelude. O servidor UDP local recebeu **5 datagramas de 20 B** de 127.0.0.1
(candidato host ICE no filho). Impacto: conteúdo gerado pode emitir UDP/STUN
para host:porta arbitrário sem ação do aluno, contrariando o gate "zero saída"
e a alegação de que RTC está contido; `data:` child é bloqueado, `srcdoc` não.
O spike não pegou isso porque testou child só por URL http (barrada por
`frame-src 'none'`, que o Chromium não aplica a `srcdoc`). Direção de correção:
negar/limpar `srcdoc` e subframes do artefato no prelude, ou garantir o lockdown
no realm do filho, medindo de novo com este probe.

### P1 — Parar um laço não libera o processo quando outra atividade compartilha o PID

`probe2-main.cjs`: três frames `mesa-activity://` montados no **mesmo** OS pid
(iframes do mesmo esquema compartilham o renderer OOPIF). Laço em um deles:
CPU 12%. Remover só o frame do laço → `kill-failed` (a guarda vê os outros
frames vivos no pid) e o pid continua vivo; remover os dois restantes → kill
permitido e o pid some. No fluxo real, `mesa-interactive-ui` mantém duas
atividades montadas quando para o laço (call-1 reaberta e call-2); pela mesma
condição medida no probe2, a guarda recusa o kill ali. O processo fica a ~12% e
uma atividade publicada depois, que reutilize o processo travado, pode não
carregar. O host/chat segue responsivo e o
comportamento é seguro (não mata processo vivo), mas a promessa "encerrar só a
atividade" vale para o host, não para as demais atividades, que congelam junto.
Sugestão: permitir o kill quando **todos** os frames vivos do pid forem também
entradas do watchdog com `misses>0` (todos travados), preservando a recusa
contra pid vivo/saudável.

### P2 — Reiniciar com a quota cheia pausa outra atividade sem relação

`src/activity.mjs:428-436`: `mount()` chama `enforceMountBudget(ctl)` antes de
`stopFrame(ctl)`; com 3 cards montados, o próprio card não conta como exceção
(`src/activity.mjs:412-416`) e outro card é despejado. Repro no
`renderer-probe.mjs`: três frames montados; clicar Reiniciar no card 2 deixa o
card 1 `paused` sem iframe e o total cai para 2. O hunt passa porque só reinicia
card pausado. Correção: parar o próprio card antes de checar a quota.

### P2 — Estado + tentativa acima de 16 KiB somem sem erro

`flushState` monta `{values, attempt}` e, se `jsonSize > MAX_STATE_BYTES
(16384)`, faz `dirty=false` e retorna sem erro (`src/activity.mjs:249-252`). Os
tetos anunciados são 16 KiB para estado e 4 KiB para tentativa, mas o envelope
inteiro é comparado ao mesmo 16384. Repro (`renderer-probe.out`): estado
13.000 B + tentativa 3.500 B (ambos dentro dos tetos individuais) = 16.544 B →
nenhum save, `stateGet` sem estado, card sem erro; reabrir perde tudo. Até um
estado de exatamente 16 KiB excede o envelope. Correção: guardar a tentativa em
campo próprio no store (conceitualmente já separada) ou elevar o teto do
envelope e mostrar erro quando não salvar.

### P3 — Filtro de geração do renderer nunca é exercitado

`src/main.mjs:802` passa `getScope` só com `{courseId, conversationId}`;
`refreshScope` (`src/activity.mjs:113-124`) para no `getScope` e nunca chama
`desk.activityScope()`. Com `currentScope.generation` undefined, a comparação
de geração em `handleActivityEvent` (`src/activity.mjs:754`) é pulada; sobra o
filtro de matéria/conversa. O host revalida no publish, mas o renderer não
cumpre a guarda de geração do plano. Correção trivial: incluir
`generation`/`scopeRef` no `getScope` ou cair para `activityScope()`.

### P3 — `request-state` e `stop` são documentados, mas o host só envia `init`/`theme`

`activity-tools.cjs`, `extensions/mesa-activity/index.ts` e `exemplos.md`
anunciam `onMessage` com `init/state/theme/request-state/stop`, mas `post()` no
renderer só emite `init` e `theme` (`src/activity.mjs:370,372,825`). Artefato
que dependa de `stop` para limpar timers não é avisado no Parar (o iframe é
removido direto). Alinhar documentação ou implementar.

### P3 — Regeneração como revisão existe no store, mas nenhum caller usa `activityId`

`store.publish` aceita `activityId` e cria v2 (teste unitário), mas as
ferramentas Pi/Claude não expõem nem enviam o campo; regerar produz um segundo
item v1 (card novo), não uma revisão da mesma atividade, ao contrário do plano
("regerar cria revisão"). Decidir contrato ou registrar a diferença.

### P3 — Falta a prova exigida de dois payloads idênticos com IDs nativos distintos

O plano O2 pede teste fake SDK com duas chamadas de payload idêntico e IDs
distintos; os testes atuais fazem uma publicação com sucesso e as recusas. O
desenho suporta (registry por `callRef`, dedupe por `toolCallId`+hash), mas a
prova não existe. Idem para `stateSave` revalidar após o await: na prática
`freeMutate` bloqueia navegação durante o save, e não consegui corrida real —
fica como defesa em profundidade.

## Objeção do root (watchdog) — resposta

A preocupação era procedente no código anterior: o pid caía para
`frame.processId` (id interno do Chromium) e podia matar processo alheio por
coincidência de pid. No hash atual o fallback saiu e a guarda cobre mainPid
desconhecido, posse atual via `app.getAppMetrics` (pid+creationTime, tipo Tab) e
pid compartilhado por qualquer frame vivo da Mesa. Verifiquei por leitura +
probe: laço único é morto e a próxima montagem carrega; com pid compartilhado o
kill é recusado enquanto há frame vivo e passa a valer quando todos saem. O
efeito colateral medido é o P1 de deferimento acima; sugiro refinar a guarda
para liberar o kill quando todos os frames vivos do pid estiverem travados.

## Limites

- Cenário sintético: Electron 44.2.0/macOS, sem provedor real, app instalado,
  Windows/Linux ou dados pessoais. Os probes não substituem os testes do repo.
- O watchdog foi exercido por remoção direta de iframe (probe2) e pelo Parar
  real do hunt/integrado; não forcei reuso de pid por processo do SO alheio.
- O P1 mediu STUN/UDP local; não testei exfiltração de dados arbitrários nem
  `getUserMedia` efetivo. `data:`/`blob:` children e `WebContentsView` não
  foram exaustivamente re-sondados.
- Timeline e PDF ficaram fora, conforme instrução; não revi o visual nem o
  comportamento com provedor autenticado.
