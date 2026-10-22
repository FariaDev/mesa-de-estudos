# Implementação — linha do tempo, slots de atividade e identidade de bloco

Status: implementação concluída no domínio delegado (timeline/adaptação). Nenhum
núcleo Bend foi tocado (reconciliação é host-side; nenhuma lei nova). `npm test`
completo e hunts alheios têm falhas de domínio concorrente registradas no fim.

## Arquivos

Novos:
- `desk/src/timeline.mjs` — segmentos puros (sem DOM) e nomes de atividade.
- `desk/tests/timeline.test.mjs`, `desk/tests/timeline-adapter.test.mjs`,
  `desk/tests/hunt-timeline.mjs`, `desk/tests/timeline-pi.mjs` (fixture própria).

Editados (domínio):
- `desk/src/worklog.mjs` — `startTool` idempotente por id, `findToolStep`,
  `replaceThinking`, `historyTurns` com `parts` + `artifact` + imagens.
- `desk/src/chat.mjs` — segmentos ao vivo, blocos de fala por identidade,
  declaração × execução, slots, guardas de stop/troca/atraso, `showHistory`
  por `parts`.
- `desk/src/agents/service.cjs` — `rendererEvent` preserva `messageId`,
  `contentIndex`, `pending` e `details`.
- `desk/src/agents/history.cjs` — `tool_result` na ordem, com `details` capados.
- `desk/src/agents/claude-adapter.cjs` — ver seção Claude.
- `desk/tests/worklog.test.mjs` — parts/artefato/idempotência/retry.
- `desk/tests/claude-adapter.test.mjs` — 1 asserção de `normalizeHistory`
  atualizada para o novo contrato (toolResult preservado).

## Contrato para o renderer de atividades (integração do pai)

Ordem: o slot nasce na DECLARAÇÃO da chamada, como irmão de `article.work`,
logo após o bloco de trabalho dono e ANTES da próxima fala. O slot nunca é
recriado/reparentado no repaint do diário; o texto final após a ferramenta é
inserido DEPOIS dele.

Ao vivo:
1. `toolcall_end` (Pi) / `content_block_start` de `tool_use` (Claude) com nome
   `mesa_criar_atividade` ou `mcp__mesa__criar_atividade` cria
   `div.activity-slot[data-activity-call="<toolCallId>"]`, `data-status="pending"`,
   e emite UMA vez:
   `CustomEvent('desk-activity-slot',{detail:{toolCallId,element}})` (elemento
   já conectado).
2. `tool_execution_start` do mesmo id: passo idempotente; slot → `running`.
3. `tool_execution_end`: slot permanece no lugar; `data-status` → `done|error`;
   se `result.details` tiver `artifactId`/`activityId` (+`version`), o slot ganha
   `data-activity-id`/`data-activity-version` (chave estável da revisão — a
   montagem deve ser keyada pelo artefato, não só pela posição).
4. Recolhimento (Parar/erro/troca): slots `pending|running` do turno viram
   `stopped` (ou `error`), sem mover nada.

Histórico (`showHistory`):
- `turn.parts` inclui `{type:'artifact',toolCallId,name,at}` no ponto do tool;
  o slot do histórico nasce com `data-status` derivado do passo pareado
  (`done|error|stopped`).
- Depois de o lote entrar no DOM: `desk-activity-slot` para cada slot e
  `CustomEvent('desk-history-rendered',{detail:{slots:[toolCallId…]}})`.
- Reabrir NÃO executa nada: hidratação de JS antigo é decisão do renderer.

## Segmentos e histórico

- `timeline.mjs`: `createTrack/beginTrack/resetTrack/openSegment/addStep/
  joinStep/closeSegment/closeAll/segmentOfStep/segmentSteps/segmentEmpty/
  removeSegment/segmentCount`, `ACTIVITY_TOOLS/isActivityTool/artifactPart`.
- Cada segmento tem `from`, `to` e `ids` explícitos; o conteúdo é selecionado
  por ID — resultado tardio de ferramenta concorrente atualiza o segmento
  ORIGINAL, já fechado, e não vaza para o próximo. Rodada vazia é destruída.
- `historyTurns` monta `parts` intercalados (`work`/`text`/`artifact`); falas
  consecutivas da mesma mensagem ficam num balão; imagens do assistente
  sobrevivem; ferramenta sem resultado continua `stopped`.

## Pi e Claude

- Pi sem `message.id`: identidade de bloco por chave vazia + recuo para a
  bolha corrente; `toolcall_end`/`tool_execution_start` fecham a bolha para
  `text-tool-text` não juntar falas; `thinking_end`/`text_end` autoritativos.
- Claude: `content_block_start` de `tool_use` publica `tool_start` com
  `pending:true` (uma vez por id); deltas levam `messageId`/`contentIndex`;
  quadros assistant com o MESMO `message.id` são deduplicados por `uuid` ou
  impressão digital do conteúdo (nunca pelo id sozinho) e `message_end` leva
  `contentIndexes` globais; `tool_use_result` vira `details` capado; o histórico
  nativo preserva `tool_result` como mensagem própria na posição.

## Comandos executados (resultado real)

- `node --test tests/worklog.test.mjs tests/worklog-view.test.mjs
  tests/timeline.test.mjs tests/timeline-adapter.test.mjs
  tests/agent-history.test.mjs tests/agent-service.test.mjs
  tests/claude-adapter.test.mjs tests/claude-adapter-usage-history.test.mjs`
  → **137 pass / 0 fail**.
- `node tests/hunt-timeline.mjs` → blocos `order` e `mixed` PASSED (ordem ao
  vivo, slot estável, reload pela sessão sintética, 2 ferramentas fora de
  ordem, retry, quiz, Parar e adoção de conversa).
- `node tests/worklog-parity.mjs` → exit 0 (projeção determinística).
- `HUNT=worklog-history,worklog-live,worklog-live-text,abort,diary-error,
  diary-stop,thinking-open,quiz-edge,dialog-ui,history-images,diary-touched,
  quiz-focus,markdown node tests/hunt-chat.mjs` → PASSED (em duas rodadas).
- `node tests/run-hunts.mjs queue --jobs 1` → ok (48 s).
- Diagnóstico do teste integrado do root (`tests/mesa-interactive-ui.mjs`,
  log em `/private/tmp/mesa-interactive-ui-diagnostic.log`): falha em
  `mesa-interactive-ui.mjs:39` (`reopened.waitForFunction #a==='4'`, restauração
  de estado dentro do frame), DEPOIS das asserções de timeline (linhas 30–32).
  A parte de ordem/slot passou; o que falta é domínio do renderer de atividades.

Falhas alheias/preexistentes confirmadas (não são deste diff):
- `node --test tests/*.test.mjs` (árvore final): 1170 pass / 6 fail, todos em
  `tests/core.test.mjs` que carregam `main.cjs` com Electron falso —
  `main.cjs:58` chama `protocol.registerSchemesAsPrivileged`, que o stub do
  mock não implementa (integração de protocolo da atividade, do root).
  No meu primeiro run (19:03) eram 1157 pass / 2 fail em `activity-bridge`.
- `tests/hunt-chaos.mjs` → 2 falhas de menu interceptando `#settings`/`#end-day`.
- `HUNT=scroll` (hunt-chat) e `hunt-shell tabs` → falham igualmente com o
  `chat.mjs`/`worklog.mjs` do HEAD (verificado restaurando os dois arquivos),
  portanto preexistentes da árvore local.

## Handoff para o root

- `claude-adapter.cjs` está **liberado** (nenhuma edição pendente minha). Áreas
  que toquei: `_handleStreamEvent`, `_handleAssistant`, `_handleUser`,
  `normalizeHistory`, `messageFingerprint`, helpers `capToolDetails`/
  `assistantFrameKey`/`historyPartOf`, mapas `_messageBlockCursor`/
  `_declaredTools`, `LIMITS.MAX_TOOL_DETAILS_CHARS`. `createActivity`/hook
  `callRef` (PreToolUse) não tocam esses símbolos; `service.cjs#rendererEvent`
  apenas repassa campos extras.
- `timeline-pi.mjs` tem roteiros por texto do prompt; `run-hunts` ignora
  `hunt-*.mjs` como fixture — o arquivo de caça é `hunt-timeline.mjs`.
- Sem mudanças em `core/**`, `main.cjs`, `preload.cjs`, perfis, `style.css`/
  `index.html`, `markdown.mjs`, `material-pdf.cjs`, `free-study.mjs`,
  `study-tools.cjs`/`tutor-pdf.cjs`.
