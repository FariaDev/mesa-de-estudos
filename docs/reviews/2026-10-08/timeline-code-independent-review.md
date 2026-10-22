# Revisão independente — linha do tempo do turno (código)

Data: 2026-10-08. Revisão READ ONLY do produto; nenhum arquivo de produto foi editado,
nenhum commit/push/release, baseline `/private/tmp/mesa-ui-20261008-baseline` preservado.

Escopo: `desk/src/chat.mjs`, `desk/src/worklog.mjs`, `desk/src/timeline.mjs`,
`desk/src/agents/{claude-adapter,service,history}.cjs` (áreas da timeline) e
`desk/tests/{timeline*.mjs,hunt-timeline.mjs,worklog.test.mjs}`. A integração da
ferramenta de atividade no mesmo adapter foi exercitada via teste integrado; os
helpers novos (`activity-call-gate.cjs`, `study-tools.cjs`) e o renderer de
atividades NÃO foram revisados.

## Método (tudo executado nesta rodada)

- Leitura de `AGENTS.md`, `docs/PLANO-UI-INTERATIVA-PDF-TIMELINE-2026-10-08.md`,
  `docs/reviews/2026-10-08/timeline-implementation.md` e do diff dos arquivos do escopo.
- `node --test tests/timeline.test.mjs tests/timeline-adapter.test.mjs tests/worklog.test.mjs tests/worklog-view.test.mjs tests/claude-adapter.test.mjs` → 102 pass / 0 fail.
- `node --test tests/agent-history.test.mjs tests/agent-service.test.mjs` → 22 pass / 0 fail.
- `node tests/hunt-timeline.mjs` → blocos `order` e `mixed` PASSED (ordem, slot estável,
  reload, concorrência, retry, quiz, Parar e adoção de conversa).
- `node tests/mesa-claude-activity-ui.mjs` → PASS; `node tests/worklog-parity.mjs` → exit 0.
- Probes sintéticos em `/private/tmp/timeline-review/` (fixture própria, app Electron real;
  o produto não foi tocado): `probe-noid.mjs` (Pi sem `message.id`), `probe-adapter-indexes.mjs`
  (índices globais do adapter Claude com SDK fake).

## Achados

### A — P1 (achado; corrigido pelo root durante a revisão; correção verificada)

**`message_end` ignorava `e.message.contentIndexes` e usava o índice local do quadro.**

- Fonte: `desk/src/chat.mjs` (pré-correção, laço do `message_end`) fazia
  `settleAssistantBlock(`${id}#${i}`)`; o adapter publica índices GLOBAIS por mensagem
  lógica em `desk/src/agents/claude-adapter.cjs:2664` (`_advanceBlockCursor`, ver
  `:2606`).
- Efeito: com dois quadros `assistant` parciais do MESMO `message.id`
  (`[texto "Antes…", tool_use]` e depois `[texto final]`), o quadro final tem índice
  local 0 e cai na chave do bloco do primeiro quadro: a fala anterior é sobrescrita e a
  final aparece duplicada (bolha do delta + bolha do final).
- Reprodução: `desk/tests/mesa-claude-activity-ui.mjs` com
  `desk/tests/fixtures/claude-sdk-activity-fake.mjs`. Antes da correção o teste falhava
  em `mesa-claude-activity-ui.mjs:26`; log do root em
  `/private/tmp/mesa-claude-activity-ui.log` com partes
  `["Explorar…","Depois…","","activity","Depois…"]` (a fala "Antes…" apagada).
- Correção do root: `const contentIndex=e.message.contentIndexes?.[i]??i;`
  (`chat.mjs:1034`) e chave dos deltas `const blockMessageId=ame.messageId??assistantId;`
  (`chat.mjs:971`).
- Verificação independente: `node tests/mesa-claude-activity-ui.mjs` PASSA nesta árvore,
  partes `["Explorar…","Antes…","","activity","Depois…"]`, uma fala de cada;
  `probe-adapter-indexes.mjs` confirma `contentIndexes [[0,1],[2,3]]` para dois quadros
  parciais do mesmo id (o mapa global do adapter está correto; o defeito era do renderer).
- Sobre a fixture: é forma VÁLIDA como teste de contrato do caminho que o próprio
  adapter declara (`_messageBlockCursor`/`contentIndexes`, coberto também em
  `timeline-adapter.test.mjs`). Ressalva de realismo: o provedor real normalmente emite
  um `message.id` novo por rodada de API; o mesmo id entre o resultado da ferramenta e a
  fala final é forma sintética de estresse — precisamente o caso que o adapter tenta
  suportar e que ficou meio implementado no renderer.

### B — P2 — Pi sem `message.id`: fallback não cria identidade e o final junta/perde falas

- Fonte: `chat.mjs:621` (nenhum id sintético por sequência de `message_start`),
  `openAssistantBlock` (`chat.mjs:678`) com chave `''` recaindo na bolha corrente e o
  laço do `message_end` (`chat.mjs:1029-1041`) liquidando todos os blocos em `''`.
- O plano (`PLANO…:73`) decidiu: "Pi pode não fornecer `message.id`; nesses casos o host
  cria identidade por sequência de `message_start`". O fallback implementado é a bolha
  corrente, que não distingue blocos no evento final.
- Reprodução (`probe-noid.mjs` + `pi-noid.mjs`):
  - texto só no `message_end` (`content` `[texto A, toolCall, texto B]`): ordem
    `[user, work, activity-slot, assistant]` e textos `['Depois sem stream.']` —
    "Antes sem stream." perdido (sobrescrito) e a fala restante depois do slot;
  - `texto → pensamento → texto` no mesmo message (deltas presentes): ordem
    `[user, assistant, work]` e texto `['Segunda fala.']` — a primeira fala é apagada na
    reconciliação; o histórico (`historyTurns`) projeta `texto, work, texto`, então ao
    vivo e ao reabrir divergem nesse caminho.
- Alcance (medido no mesmo probe): com `text_end` presente ("só ends"), a divisão fica
  correta (`[user, assistant, work, activity-slot, assistant]`, duas falas); com
  `message.id` (hunt `order`) tudo fica correto. A falha exige que o conteúdo dos blocos
  de texto chegue apenas no `message_end` — caminho de fallback. Por isso P2, não P1.
- Encaminhamento: derivar um id sintético por sequência de `message_start` quando
  `e.message.id` faltar (decisão já tomada no plano; não implementada).

### C — P2 — código morto introduzido pelo diff

- `chat.mjs:621/952` `turnGen` é escrito e nunca lido; `chat.mjs:672`
  `assistantKeyFor` nunca é chamado; `chat.mjs:743` `trackStep` nunca é chamado
  (verificado por `grep`). Sem efeito funcional; limpeza pendente.

## Pontos verificados (sem achado)

- **Pi sem `message.id`**: com deltas (texto-tool-texto) a ordem
  `[user, work, assistant, work, activity-slot, assistant]` e os textos
  `["Antes.","Depois."]` saem corretos; ressalva do achado B apenas no final sem eventos
  de bloco.
- **Claude, vários quadros `assistant` com o mesmo `message.id`**: `contentIndexes`
  globais por mensagem lógica (unit + probe do adapter) e o renderer agora os consome
  (teste integrado); sem dedupe cego (`assistantFrameKey` por conteúdo quando falta
  `uuid`).
- **Reconciliação de finais por `contentIndex`**: coberta pelo teste integrado
  (`Antes…`/`activity`/`Depois…`, uma ocorrência de cada);
  `timeline-adapter.test.mjs` cobre os finais com índices.
- **Resultados tardios concorrentes no slot original**: `hunt-timeline` bloco `mixed`
  (duas atividades, resultados fora de ordem; `duo-a` error, `duo-b` done) e
  `timeline.test.mjs` (segmento fechado por IDs).
- **Declaração antes da próxima fala**: `toolcall_end`/`content_block_start` reservam o
  passo e o slot (`chat.mjs:declareTool`); hunt `order` e teste integrado confirmam o
  slot entre as falas.
- **Reload do histórico**: `hunt-timeline` `order` recarrega a sessão sintética com a
  mesma ordem e `desk-history-rendered`/`desk-activity-slot`; unit cobre
  `historyTurns`/`normalizeHistory` (Claude com `tool_result` na posição). O caminho
  Claude ponta-a-ponta de reload não tem fixture própria (o store sintético guarda as
  mensagens da fixture-base) — verificado em unidade, não em UI.
- **Parar/troca/atrasos**: `desk-stop` recolhe na hora, `staleEvent` descarta atraso por
  `stoppedTurn`/`runId`/`turnClosed`, `settleTurn` fecha slots `pending|running` como
  `stopped|error`; hunt `mixed` (Parar e adoção de conversa) PASSA.
- **Quiz preservado**: fila própria (`S.quizQueue`), sem passo no diário, cartão e
  veredito; hunt `mixed` 2c PASSA.

## Limites desta rodada

- Sem provedor real, sem app instalado e sem `npm test` completo (falhas alheias já
  registradas no handoff); os hunts/testes focados e o integrado são a evidência.
- Não revisados: renderer de atividades, backup/exportação, núcleo Bend e agentes de
  PDF/UI fora da timeline. Nenhum achado especulativo foi incluído; os dois achados
  abertos (B e C) têm reprodução ou verificação direta no código.
