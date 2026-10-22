# Mesa — linha do tempo do turno e publicação de artefatos

Status: investigação e planejamento (esta rodada **não** escreveu código de produto).
Escopo do plano: ordem ao vivo e ao reabrir (thinking → texto → ferramenta → texto →
artefato), ferramentas concorrentes, IDs/deduplicação, eventos atrasados,
parada/erro/compactação/troca de conversa, Pi e SDK Claude, e o ponto de publicação
comum dos artefatos interativos (atividades e material PDF) na linha do turno.

Não faz parte desta rodada: template PDF/LaTeX (outro domínio), sandbox de documento
HTML, implementação. Nenhum teste foi executado nesta rodada; as referências abaixo
vêm de leitura de código, `diff` e documentação do Pi instalada. Nenhum app foi
aberto, nenhum PDF/sessão pessoal foi lido, nenhuma alteração existente do
`git status` foi tocada.

---

## 1. Método e fontes

Comparação direta (sem executar):

- `desk/src/worklog.mjs` (432 linhas) × `chat/src/worklog.mjs` (685 linhas)
- `desk/src/worklog-view.mjs` (199) × `chat/src/worklog-view.mjs` (199)
- `desk/src/chat.mjs` (1105) × `chat/src/chat.mjs` (1402)
- `core/worklog.bend` / `core/worklogview.bend` e artefatos gerados: **idênticos**
  entre os dois apps (o `diff` de `desk/src/generated/worklog.core.js` e
  `worklogview.core.js` contra os do `chat/` não tem diferença; `worklog-tags.mjs`
  também é idêntico).
- Adaptador Claude: `desk/src/agents/{service,claude-adapter,history,conversations}.cjs`.
- Documentação do Pi instalada: `docs/json.md`, `docs/session-format.md`,
  `docs/message-types.md` (contrato de `message_update.assistantMessageEvent`,
  `ToolResultMessage.details`, entradas de `compaction`).

Testes existentes mapeados (para o plano de testes, não executados):
`desk/tests/worklog.test.mjs`, `desk/tests/worklog-view.test.mjs`,
`desk/tests/worklog-parity.mjs`, `desk/tests/hunt-chat.mjs`,
`chat/tests/worklog.test.mjs`, `chat/tests/worklogview.test.mjs`,
`chat/tests/hunt-mcp.mjs`, `chat/tests/hunt-transcript.mjs`,
`chat/tests/fake-pi.mjs`, `desk/tests/hunt-pi.mjs`.

---

## 2. O que a Conversa já resolve (e a Mesa não)

O `chat/src/worklog.mjs` é um **superconjunto** do `desk/src/worklog.mjs`. As duas
metades de ponte plain↔núcleo (`toCore`/`toPlain`/`sync`) são byte a byte iguais;
o que a Mesa não tem é host puro:

| Capacidade | Onde vive no `chat/` | Efeito |
|---|---|---|
| `historyTurns` com `parts` intercalados (work/text na ordem) | `chat/src/worklog.mjs:611-685` (`openWork`/`pushStep`, `parts.push`) | Reabrir a conversa mantém pensamento/ferramenta antes da fala que os produziu |
| Rodadas ao vivo (`turnSegments`) | `chat/src/chat.mjs:661-722` (`openSegment`/`closeSegment`/`segmentLog`/`segmentEmpty`) | Cada bloco de trabalho nasce depois da fala anterior; o próximo passo abre um bloco novo embaixo |
| MCP (rótulo, menção, detalhe, fatos) | `chat/src/worklog.mjs:271-...` (`isMcpTool`, `mcpIntent`, `mcpLabel`, `mcpDetail`, `stepMention`) | "Usou apple-music · playlist" em vez de "Usou mcp"; motivo da falha visível sem expandir |
| Repetição/loop | `chat/src/worklog.mjs:...559-580` (`stepSignature`, `repeatCount`, `repeatMarker`, `loopWarning`) | "repetido ×N" e aviso de loop no rodapé |
| Guarda de turno abandonado | `chat/src/chat.mjs:651-653,731` | Parar + `settleTurn` imediato; deltas tardios não mexem na bolha/diário |
| `message_end` sem texto não fecha rodada | `chat/src/chat.mjs:748-760` | `[thinking + toolCall]` continua no mesmo bloco |
| View mais nova (root vazio + `applyTree` com troca completa de atributos; preview de MCP; ícone de plugue) | `chat/src/worklog-view.mjs:54-88,103-117,115-...` | `desk/src/worklog-view.mjs` ainda tem a versão de 2026-09-21 |

No `desk/`:

- `desk/src/chat.mjs:566-575` (`openTurnLog`): **um** `turnView.el` é anexado em
  `agent_start` e nunca sai do lugar.
- `desk/src/chat.mjs:595-604` (`settleTurn`): fecha o log único.
- `desk/src/chat.mjs:654-780` (handler): `tool_execution_start/end` só chamam
  `startTool`/`finishTool` no mesmo log; texto só fecha pensamento
  (`closeThinking`), nunca a rodada.
- `desk/src/chat.mjs:167-203` (`showHistory`): renderiza **um** `createWorkLogView`
  com `turn.steps` inteiro e **depois** uma mensagem com `turn.text` agregado.
- `desk/src/worklog.mjs:384-432` (`historyTurns`): sem `parts`; só `steps` + `text`.

Consequência prática (o critério de aceitação do plano já falha hoje na Mesa):
uma ferramenta executada depois de uma fala aparece **acima** dela, ao vivo e ao
reabrir. A Conversa passou a atender esse critério em 2026-09-23/29; a Mesa ficou
para trás na mesma base de núcleo.

Semelhanças que reduzem o risco do port: `desk/src/worklog-view.mjs` e o do
`chat/` são o mesmo arquivo em versões diferentes (mesma API `el/render/destroy`);
`desk/icons.mjs:15` já tem o ícone `plug`; `core/worklog.bend` e
`core/worklogview.bend` são compartilhados e congelados.

---

## 3. Onde a ordem se perde hoje (inventário com arquivo:linha)

### 3.1 Ao vivo, Mesa
1. `desk/src/chat.mjs:566-575` — a âncora do diário é única e anterior a toda fala
   do turno. Todo passo novo é filho dela. Fala depois dela fica sempre embaixo.
2. `desk/src/chat.mjs:670-690` — `text_delta` fecha pensamento mas não fecha
   rodada; a próxima ferramenta continua no mesmo artigo.
3. `desk/src/chat.mjs:653-654` — **não há** guarda de turno abandonado como em
   `chat/src/chat.mjs:731`; `stoppedTurn` é setado em `desk-stop`
   (`desk/src/chat.mjs:562`) mas nunca consultado. Deltas/`tool_execution_end`
   tardios depois de Parar mutam bolha e log.
4. `desk/src/chat.mjs:658` — eventos de outra conversa são descartados por
   `conversationId`; mas a troca de conversa não fecha o turno vivo
   (ver 3.5).

### 3.2 Histórico, Mesa
5. `desk/src/worklog.mjs:384-432` — `historyTurns` agrega `steps` e `text`; a
   informação de intercalação existe no JSONL (ordem das mensagens), mas é
   descartada na projeção.
6. `desk/src/chat.mjs:196-201` — `showHistory` materializa a agregação: diário
   único acima da última fala.

### 3.3 Pi: `contentIndex` ignorado
7. O Pi emite `message_update.assistantMessageEvent` com
   `thinking_start/thinking_delta/thinking_end`, `text_start/text_delta/text_end`,
   `toolcall_start/toolcall_delta/toolcall_end`, todos com `contentIndex`
   (`docs/json.md:77-93`). Os dois hosts só tratam `thinking_delta` e `text_delta`
   (`desk/src/chat.mjs:668-678`, `chat/src/chat.mjs:734-745`) e ignoram
   `*_start`, `*_end` e `contentIndex`.
   - Consequência A (dedup): `thinking_end`/`text_end` trazem o conteúdo
     autoritativo; sem eles, um re-stream (retry) **duplica** o pensamento no
     passo. O texto da bolha se auto-corrige no `message_end`; o pensamento não.
   - Consequência B (ordem): uma mensagem com bloco de ferramenta **antes** de um
     bloco de texto pode pintar texto antes da ferramenta (a ferramenta só entra
     em `tool_execution_start`, que ocorre depois de `message_end`).
8. `toolcall_end` (que já traz `toolCall` completo com `id/name/arguments`) não é
   usado; a linha da ferramenta nasce em `tool_execution_start`.

### 3.4 SDK Claude: identidade de bloco perdida
9. `desk/src/agents/claude-adapter.cjs:2450-2469` (`_handleStreamEvent`) ignora
   `event.index` de `content_block_delta` e não trata `content_block_start`;
   `messageId` até é anexado ao evento interno, mas
   `desk/src/agents/service.cjs:15` **descarta** `messageId` na tradução para o
   renderer. Sem `(messageId, contentIndex)` o renderer não consegue distinguir
   dois blocos de texto da mesma mensagem nem casar delta com `message_end`.
10. `desk/src/agents/claude-adapter.cjs:2501-2506` — `tool_start` é emitido no
    `_handleAssistant`, depois de todos os deltas da mensagem; ordem correta para
    `[thinking, text, tool_use]` (o caso comum), invertida para `[tool_use, text]`.
11. `desk/src/agents/claude-adapter.cjs:2523-2536` (`_handleUser`) — o
    `tool_result` vira só `tool_end`; **não** gera mensagem no cache local
    (`desk/src/agents/service.cjs:37-40` só guarda `message_end` de
    `user|assistant`).
12. `desk/src/agents/history.cjs:208-236` (`normalizeOne`) — `toolResult` embutido
    num `content` é **empurrado para o fim** da mensagem; e
    `desk/src/agents/claude-adapter.cjs:487-520` (`normalizeHistory`) **descarta**
    blocos `tool_result` por completo ao ler a sessão nativa.
    Consequência: no Claude, ao reabrir, as ferramentas do histórico aparecem sem
    resultado (marcadas como `stopped` por `historyTurns`) e qualquer artefato
    que dependesse de `toolResult.details` **some**.

### 3.5 Troca de conversa / compactação
13. `desk/src/main.mjs:273-280` e `:303-310` (`newSession`/`openSession`) trocam o
    transcript com `showHistory(...)`/`#messages.replaceChildren()`, mas **não**
    fecham `turnLog`/`turnView`. Se o turno antigo nunca emitir `agent_settled`,
    o próximo `openTurnLog()` vira no-op e os passos do turno novo entram na view
    destacada do antigo.
14. `compaction_start/compaction_end` e `summarization_retry_*` do Pi
    (`docs/json.md:130-180`) não são tratados por nenhum dos dois hosts. No
    histórico, a entrada `compaction` do JSONL (`docs/session-format.md:128`) é
    ignorada por `historyTurns` porque não tem `role` — ou seja, hoje não corrompe,
    mas também não há teste travando isso.
15. `desk/src/chat.mjs:692-709` — o quiz é exceção: não entra no diário; o cartão
    é anexado em `renderQuizCard` (`desk/src/chat.mjs:884-891`) quando o diálogo
    chega. Com a futura segmentação, o cartão pode acabar depois de uma rodada
    vazia se um `thinking_delta` abriu segmento antes. Precisa de teste.

---

## 4. Arquitetura proposta

### 4.1 Rodadas (segmentos): portar a decisão da Conversa

Portar `chat/src/chat.mjs:661-722` para `desk/src/chat.mjs`, mantendo a API:

- `turnSegments: [{view, from, startedAt, endedAt, reason, closed}]`;
- `segmentLog(seg)` = `{...seg, steps: turnLog.steps.slice(seg.from)}` — o passo
  vive no log único (relógio/`runningStep`), mas é renderizado no segmento que o
  viu nascer;
- `openSegment()` cria segmento novo quando o último está `closed`; idempotente
  enquanto aberto;
- `closeSegment()` recolhe o segmento (render `{live:false}`); segmento vazio é
  destruído e removido — fala sem trabalho não vira tarja;
- `settleTurn` fecha todos os segmentos, marca `endedAt/reason` e zera.

Mesa-específicos a preservar:
- `quiz` continua fora do diário (`desk/src/chat.mjs:692-709`); `openSegment`
  **não** é chamado no `tool_execution_start` de quiz. Se um segmento vazio ficou
  aberto antes do quiz, `closeSegment()` o descarta — testar.
- `paintLive` continua usando `turnLog` (não segmento) para o rótulo do rodapé e o
  relógio (`desk/src/chat.mjs:575-583`).

### 4.2 IDs e chaves

| Entidade | Chave canônica | Fonte |
|---|---|---|
| Passo de ferramenta | `toolCallId` | `tool_execution_*` (Pi e Claude); `part.id` no histórico |
| Bloco de texto/pensamento (Pi) | `(messageId, contentIndex)` | `message_start.message.id` + `assistantMessageEvent.contentIndex` |
| Bloco (Claude) | `(messageId, index)` | `message_start`/`message_delta.messageId` + `content_block_delta.index` |
| Mensagem final | `message.id` (Pi) / `uuid` (Claude) | `message_end.message` |
| Artefato | `artifactId` estável, mapeado por `(conversationId, toolCallId)` no store | tool/host (seção 4.8) |

Regras:
- **Passo de ferramenta**: `startTool` idempotente por `toolCallId` (não duplica se
  `toolcall_end` e `tool_execution_start` chegarem os dois).
- **Bolha de fala**: uma por `(messageId, contentIndex)` enquanto o stream corre;
  `message_end` casa pela mesma chave. Hoje o `chat/` reseta a bolha em todo
  `message_start` (`chat/src/chat.mjs:733`); a Mesa já faz melhor
  (`desk/src/chat.mjs:661-667`, keyed por `id`) — unificar na versão keyed.
- **Dedup de `message_end`**: manter `seenMessages` por turno; `message_end` de
  chave já finalizada é ignorado (o SDK Claude já deduplica com
  `_markCompleted`; o renderer deve ser defensivo).

### 4.3 Tabela de eventos → ação (Pi)

| Evento | Ação |
|---|---|
| `agent_start` | `stoppedTurn=false`; `openSegment()`; `setBusy(true)` |
| `message_start` assistant | `assistantKey = message.id`; não recria bolha se a chave é a mesma |
| `thinking_start` (i) | `openSegment()`; inicia/acorda o passo de pensamento da chave `(msg,i)` |
| `thinking_delta` (i) | `thinkingDelta` na chave `(msg,i)` |
| `thinking_end` (i) | `replaceThinking(log, content)` — conteúdo autoritativo, mata duplicação |
| `text_start` (i) | `closeThinking()`; `closeSegment()`; abre bolha da chave `(msg,i)` |
| `text_delta` (i) | append na bolha da chave `(msg,i)` |
| `text_end` (i) | substitui o texto da bolha pelo `content` autoritativo |
| `toolcall_end` (i) | `startTool({id, name, args})` se o id ainda não existe (fecha a inversão `[tool_use, text]` sem depender de `tool_execution_start`) |
| `tool_execution_start` | `closeThinking()`; `startTool` **idempotente** por id; `renderTurn()` |
| `tool_execution_end` | `closeThinking()`; `finishTool(id)`; se for artefato, publicar (4.8); `renderTurn()` |
| `message_end` assistant | fecha pensamento; se `shown(text\|images)` → finaliza bolha da chave e `closeSegment()`; senão não fecha rodada |
| `agent_settled` | `settleTurn({reason})`; `setBusy(false)` |

Eventos que **não** mexem no diário (no-op explícito, testado): `compaction_start`,
`compaction_end`, `summarization_retry_attempt_start/scheduled`,
`auto_retry_*`, `turn_start`, `turn_end` (o `turn_end` do Pi é por resposta, não
por turno de UI).

### 4.4 Dedup delta × evento final

- `text_end.content` e `thinking_end.content` são a **fonte**; o delta é só
  pintura. `message_end.message` substituto é o fallback externo.
- `replaceThinking(log, text)`: muta o `text` do último passo running de
  pensamento no objeto plain e deixa o próximo `sync` reconciliar — o `toCore`
  lê o plain, então a mutação é o novo estado. **Sem tocar no núcleo Bend**; se a
  rodada exigir prova formal, promover depois para uma lei `thinkingEnd` no
  `core/worklog.bend` (aditivo, com prova).
- `message_end` de mensagem só ferramenta não deve criar bolha nem substituir
  texto (`shown=false`), já é o comportamento do `chat/`.
- `tool_execution_end` sem `startTool` correspondente (evento órfão/cortado):
  `finishTool` devolve `null` e nada é pintado; opcionalmente criar o passo com
  `status:'stopped'` para visibilidade — decisão de produto, fora do MVP.

### 4.5 Eventos atrasados, Parar, erro, compactação, troca de conversa

- **Parar**: listener `desk-stop` chama `settleTurn({reason:'stopped'})` na hora
  (como `chat/src/chat.mjs:653`) e mantém a guarda de `stoppedTurn` para
  `message_start/update/end` e `tool_execution_*`. Hoje a Mesa só seta a flag.
- **Erro**: `desk_error` fatal faz `addError` + `settleTurn({reason:'error'})`;
  não fatal segue como está (`desk/src/chat.mjs:760-780`).
- **Compactação**: nada abre/fecha rodada; a faixa de atividade pode mostrar
  "Compactando…" (opcional). No histórico, a entrada `compaction` continua
  ignorada; adicionar caso de teste com JSONL sintético.
- **Troca de conversa**: `showHistory` deve começar com
  `if(turnLog) settleTurn({reason:'switched'})` (ou o listener
  `desk-conversation-changed` fazer o mesmo). Garante que `openTurnLog` do turno
  novo não vire no-op e que nenhum nó do turno antigo fique pendurado.
- **Eventos de outra conversa**: a checagem por `conversationId` de
  `desk/src/chat.mjs:658` permanece; com settle na troca, eventos tardios da
  conversa antiga caem em `turnLog=null` (guardas já existentes).

### 4.6 Ferramentas concorrentes

- Passos são criados na ordem de `start`; `finishTool` casa por id varrendo do
  fim para o começo (`desk/src/worklog.mjs:296-301`) — cada resultado cai no
  próprio passo.
- `runningStep` devolve o **último** running; com dois concorrentes o rótulo ao
  vivo mostra um deles. Aceitável no MVP; alternativa barata: quando
  `steps.filter(running).length > 1`, o rótulo vira
  `"2 ferramentas em andamento"`. Testar A/B e decidir.
- Artefato concorrente usa `toolCallId` como chave da âncora, então não depende de
  ordem de término.

### 4.7 Histórico

- Portar `historyTurns` do `chat/` (parts + `assistantImages` + `parts` no turno).
  O JSONL do Pi já preserva a ordem real: `assistant(thinking,text,toolCall)` →
  `toolResult` → `assistant(text)` → …
- `showHistory` da Mesa itera `turn.parts` como `chat/src/chat.mjs:267-278`,
  **adaptando a assinatura**: o `message()` da Mesa recebe o pai no 4º argumento
  (`desk/src/chat.mjs:53`), então `message('assistant', part.text, part.images, frag)`.
  A Mesa não passa `time` por parte (não tem separador de dia por parte como a
  Conversa); aceitável, o `userTime` já vem do turno.
- Manter a poda das últimas 6 imagens de usuário (`desk/src/chat.mjs:171-180`);
  a poda equivalente de imagens do assistente não existe na Conversa — decidir
  manter teto também no `assistantImages` (recomendado: reusar a mesma regra).
- Ferramenta sem `toolResult`: continua `stopped` (já coberto por teste).
- **Claude**: para a âncora de artefato sobreviver, o store por
  `(conversationId, toolCallId)` é a fonte (4.8). Para o resultado continuar
  visível no transcript, corrigir `normalizeHistory` para emitir os
  `tool_result` como mensagens `toolResult` na posição original (e/ou guardar no
  cache local). É mudança de main, com tetos já impostos por `history.cjs`
  (`MAX_TEXT_CHARS`, `MAX_TOOL_CHARS`).

### 4.8 Artefatos interativos: contrato de publicação no lugar do tool

Princípio: **o artefato é um nó ancorado imediatamente depois do passo de
ferramenta que o publicou, dentro da mesma sequência de mensagens**. A linha do
turno não precisa conhecer o conteúdo do artefato — só precisa garantir que o
passo exista e que a publicação feche a rodada corrente.

Fase 1 (MVP declarativo — recomendado):

1. **Ferramenta** (`desk/src/extensions/atividade/` + `desk/src/agents/atividade.cjs`,
   espelhando `tutor-pdf`/`tutor-pdf.cjs`):
   - Pi: `mesa_atividade` com `execute(toolCallId, params, signal)`; Claude:
     `mcp__mesa__atividade` no `createSdkMcpServer`.
   - `params` = `{kind:'declarativo', título, objetivo, especificação}`; a
     especificação é validada contra um schema fechado (sem HTML/JS executável):
     `gráfico` (expressão/parâmetros/eixos), `quiz` (enunciado/alternativas),
     `passos` (reveláveis), `previsão` (campo+unidades). Teto de tamanho por
     campo e total.
2. **Host/main** (`desk/activities.cjs`, espelhando `tutor-materials.cjs` +
   o padrão de store de `desk/bookmarks.cjs`):
   - valida, gera `artifactId`, grava em `.runtime/activities/<conversa>.json`
     com versão (`version`, `restarts`, `answers`), e devolve em `details` apenas
     `{kind:'activity', artifactId, version, toolCallId}` — **nunca o payload
     inteiro** (mantém o JSONL pequeno e sobrevive ao problema do Claude em 3.4).
   - emite para a janela um `activity-published` no mesmo molde de
     `materialEvent` (`desk/main.cjs:691`), com `conversationId`/`toolCallId`.
3. **Preload** (`desk/preload.cjs`): `onActivity`, `activitySave`, `activityList`.
4. **Renderer** (`desk/src/artifacts.mjs`, novo):
   - `registry: Map<toolCallId, {node, payload, version}>`;
   - `publish(ref)` cria o cartão (shell Bend + corpo do host) uma vez;
   - `anchor(containerEl, toolCallId)`: insere **depois** do `article.work` do
     segmento; o nó é o **mesmo** objeto (mover preserva simulação/iframe);
   - `restore(conversationId)`: no `showHistory`, para cada passo cujo
     `toolName` é de artefato, busca o store por `(conversationId, step.id)` e
     reancora. Isso funciona no Claude mesmo sem `details`, porque o id do
     `toolCall` está no conteúdo da mensagem do assistente.
5. **Linha do tempo**: no `tool_execution_end` de ferramenta de artefato, fazer
   `closeSegment()` → publicar/anexar o cartão **antes** do próximo segmento.
   No histórico, dividir o `part` de trabalho no índice do passo do artefato
   (determinístico, sem tocar no núcleo).
6. **Cartão**: shell é view pura nova (`core/activityview.bend` + `laws/`+`proofs/`
   + artefato gerado + `desk/src/activity-view.mjs`) com título, objetivo,
   estado, ações (ampliar/reiniciar/descrição textual) e fallback textual; o
   corpo interativo é host. Interações locais → `activitySave` (nova versão);
   nunca chamam modelo. "Enviar tentativa ao tutor" → `send()` explícito.
7. **PDF/material**: o rascunho de `tutor-material` (`desk/main.cjs:698-703`,
   `desk/src/free-study.mjs:213-222`) vira o mesmo tipo de cartão
   (`kind:'material'`) no mesmo registry/âncora; o diálogo de revisão continua.
   Fase 2.

Fase 3 (avaliação separada): documento HTML/CSS/JS isolado. Exige: `webview`
ou iframe com `sandbox="allow-scripts"` sem `allow-same-origin`, CSP própria,
protocolo de mensagens com contrato limitado (`postMessage` com schema), teto de
tamanho/tempo, persistência do documento no store e matriz de testes de
isolamento (sem `nodeIntegration`/preload/rede/arquivos). Não entra no MVP.

Pontos de integração comuns (atividades + PDF + quiz futuro):
- um **store por conversa** (`activities.cjs`), com `artifactId`/`version`;
- um **evento de publicação** por canal IPC (`activity-published`), no molde de
  `tutor-material`;
- **uma âncora**: nó depois do `article.work` cujo passo tem `id === toolCallId`;
- **um shell** de cartão com fallback textual e ações, corpo por tipo;
- nenhuma dessas camadas dispara modelo por conta própria.

---

## 5. Alternativas e julgamento

| Alternativa | A favor | Contra | Veredito |
|---|---|---|---|
| **A. Portar segmentos + `parts` da Conversa** (recomendada) | Código já provado e testado na Conversa; mesma base de núcleo; paridade verificável | Duas cópias divergem de novo se não houver teste de paridade | **Seguir** |
| B. Manter o artigo único e reordenar o DOM depois (mover falas para cima do diário) | Diff pequeno no `chat.mjs` | Re-render do diário destrói/reancora nós; título/duração agregados enganam; história continuaria exigindo `parts`; mais cola e menos prova | Rejeitada |
| C. Extrair `timeline.mjs` compartilhado pelos dois apps | Uma implementação só | Viola a separação deliberada dos apps (AGENTS.md); a Mesa não quer MCP/quiz da Conversa; força paridade de features | Rejeitada nesta fase |
| D. Colocar o artefato como filho do `StepRow` no `core/worklogview.bend` | "Lugar do tool" literal no núcleo | Corpo interativo não cabe no Bend; muda núcleo provado; re-render destruiria o estado | Rejeitada |
| E. Âncora após o segmento + split no fim do passo de artefato (4.8) | Não toca no núcleo; nó sobrevive ao re-render; ordem exata; vale para PDF e atividades | Um pouco de disciplina no `chat.mjs` (fechar segmento antes de publicar) | **Seguir** |
| F. Documento HTML livre como MVP | Expressividade máxima | Sandbox/segurança/CSP/mensagens/testes de isolamento; nada disso é pequeno | Adiar (fase 3) |

---

## 6. O que portar sem fundir apps nem reescrever o núcleo

Portar do `chat/` para o `desk/` (arquivo → ação):

1. `chat/src/worklog.mjs` → `desk/src/worklog.mjs` (manter o import
   `../text.mjs`): MCP (271-...), repetição (559-580), `stepMention`, `historyTurns`
   com `parts`/`assistantImages` (611-685). As pontes plain↔núcleo já são iguais;
   o `diff` resultante deve ser só de adições.
2. `chat/src/worklog-view.mjs` → `desk/src/worklog-view.mjs` (manter
   `../icons.mjs`/`../state.mjs`): root vazio + `applyTree` novo, `stepMention`
   no preview, `repeatMarker` no rótulo, `plug` por `isMcpTool`.
3. `chat/src/chat.mjs:661-722` → `desk/src/chat.mjs`: segmentos, mantendo o quiz
   e o `paintLive` atuais.
4. `chat/src/chat.mjs:651-653,731` → Mesa: `settle` imediato no Parar + guarda
   de `stoppedTurn`.
5. `desk/src/chat.mjs:167-203` + `desk/src/worklog.mjs` → `showHistory` por
   `parts` (adaptar `message()` com pai no 4º argumento).
6. `desk/src/agents/service.cjs:15` → preservar `messageId` (e `contentIndex`
   quando existir).
7. `desk/agents/claude-adapter.cjs:2450-2469` → traduzir
   `content_block_start` (tipo/índice) e `content_block_delta.index` para o
   renderer; opcional: `tool_start` por bloco.
8. `desk/src/agents/claude-adapter.cjs:487-520` (`normalizeHistory`) → manter
   `tool_result` na ordem, como mensagem `toolResult` própria.

**Não** tocar:
- `core/worklog.bend` e `core/worklogview.bend` (nem os artefatos gerados) nesta
  fase; a reconciliação de pensamento é host-side (4.4). Se depois quiserem lei
  formal, é aditivo + `npm run verify:bend`.
- `desk/src/queue.mjs` / `chat/src/features/queue.mjs`: a fila observa
  `desk-idle`/`desk-held`, não a linha do tempo. A segmentação não muda o contrato.
- O fluxo do quiz: continua no diálogo; o cartão só entra no registry de
  artefatos quando houver decisão de produto (fase 2), com teste dedicado.
- Defaults do autor (`desk/config.cjs`) e materiais.

---

## 7. Critérios de aceitação (verificáveis)

1. **Ordem ao vivo**: no roteiro `thinking A → texto B → tool T → texto C`, a
   ordem no DOM é `work(A) < bolha(B) < work(T) < bolha(C)`.
2. **Ordem ao reabrir**: o mesmo roteiro reaberto produz a mesma ordem
   (`turn.parts = [work, text, work, text]`).
3. **Concorrência**: `T1` e `T2` sobrepostos → duas linhas na ordem de início,
   cada resultado no próprio passo; `settle` com `T2` pendente marca `T2`
   `stopped` e um `tool_execution_end` tardio não muda nada.
4. **Dedup**: `thinking_end`/`text_end` autoritativos substituem deltas (sem
   pensamento duplicado após retry); `message_end` repetido da mesma chave não
   cria bolha órfã.
5. **Parar**: deltas e `tool_execution_end` atrasados após Parar não pintam; o
   diário recolhe com `reason:'stopped'` mesmo sem `agent_settled`.
6. **Troca de conversa**: com turno vivo, a troca fecha o log; o transcript novo
   não recebe passos do antigo; `turnLog`/`turnSegments` vazios.
7. **Compactação**: JSONL com entrada `compaction` reabre sem turno/step fantasma
   e sem perder a ordem existente.
8. **Claude e Pi**: o mesmo roteiro sintético nos dois motores produz a mesma
   ordem de DOM e os mesmos rótulos (com o fake SDK e o fake Pi).
9. **Artefato**: cartão imediatamente depois do passo do tool, ao vivo e ao
   reabrir; interação local não envia mensagem; envio é ação explícita; estado não
   atravessa conversas; alternativa textual presente; ampliar/reiniciar funcionam;
   re-render do segmento não destrói o cartão.
10. **Portão**: `cd desk && npm test` e `cd chat && npm test` verdes; hunts de
    transcript/diário verdes; sem regressão do quiz.

---

## 8. Plano de testes (não executado nesta rodada)

Unidade (rápido, sem Electron):
- `desk/tests/worklog.test.mjs`: copiar de `chat/tests/worklog.test.mjs` os blocos
  MCP, repetição e `historyTurns` com `parts`; acrescentar:
  - `toolcall_end` idempotente + `tool_execution_start` duplicado;
  - `thinking_end` substitui (sem duplicar) e um novo delta reabre rajada;
  - resultado órfão/tardio;
  - `parts` para `[thinking+tool]`, `[text+tool+text]`, ferramenta concorrente.
- `desk/tests/worklog-view.test.mjs`: preview de MCP, `repeatMarker` no rótulo,
  ícone `plug` (o `test` já cobre `kindName`/`statusName`; o mapa continua igual).
- `desk/tests/worklog-parity.mjs`: alinhar o roteiro ao do `chat/` (MCP + parts) e
  rodar `node tests/worklog-parity.mjs` nos dois apps; comparar a saída (script,
  não `*.test.mjs`).

Adaptador/Claude (main, Node puro):
- `desk/tests/agent-history.test.mjs` / `claude-adapter-usage-history.test.mjs`:
  `rendererEvent` preserva `messageId`; `normalizeHistory` mantém `tool_result`
  como mensagem própria na posição; `content_block_start/index` vira
  evento com índice.
- Fixtures **sintéticas** (JSONL/eventos montados no teste), nunca sessões reais.

E2E (Electron com runtime falso):
- Estender o fake Pi da Mesa (`desk/tests/hunt-pi.mjs`) com um cenário
  `timeline`: `thinking → text → tool → text → tool concorrente`, gravando o
  JSONL sintético — o mesmo formato que o `chat/tests/fake-pi.mjs:157-205` já usa
  (com `details` persistidos no `toolResult`).
- Novo `desk/tests/hunt-timeline.mjs` no molde de `chat/tests/hunt-mcp.mjs`
  (helper `order()`): ordem ao vivo, ordem após reload, Parar no meio, troca de
  conversa, cartão de artefato (sintético via `tool_execution_end` com
  `details` + broadcast), sem erro de console.
- Estender `desk/tests/hunt-chat.mjs` (bloco `thinking-open`) com a rodada que
  reabre depois de uma fala.

Artefato (novo):
- `desk/tests/activities.test.mjs`: validação de schema/tetos, versionamento,
  isolamento por conversa, restart.
- `desk/tests/activity-view.test.mjs`: shell Bend (título/objetivo/ações/fallback)
  sem DOM, no molde de `worklog-view.test.mjs`.
- Teste de âncora com DOM falso (mesmo padrão `FakeNode`): re-render do segmento
  preserva o nó; reabrir reancora pelo store.

Comandos (a rodar na implementação):
```
cd desk && npm test
cd chat && npm test
cd desk && node tests/run-hunts.mjs chat        # ou o nome do novo hunt
cd desk && npm run verify:bend                  # só se o núcleo for tocado
```
Registrar no doc de execução que `npm test` da Mesa recentemente reportou 1.073
testes (base de `docs/reviews/2026-10-08/busca-ui-validation.md`) e comparar.

---

## 9. Riscos e mitigação

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Port da view nova regride comportamento antigo da Mesa (`applyTree`) | Baixa | Médio | Rodar `worklog-view.test.mjs` + `hunt-chat` inteiro antes de seguir; o diff é pequeno e a versão da Conversa é mais nova |
| Quiz + segmentação: cartão depois de rodada vazia | Média | Baixo | `closeSegment` destrói segmento vazio; teste dedicado no `hunt-chat` |
| `message_end`/`message_start` duplicados (Claude) criam bolha órfã | Média | Médio | chave por `messageId` + `seenMessages`; teste de `message_end` repetido |
| Pensamento duplicado em retry (sem `thinking_end`) | Média | Baixo | `replaceThinking` por `thinking_end`; se o provedor não mandar `*_end`, o `message_end` reconstrói o pensamento do conteúdo final (opção) |
| Claude: histórico perde `tool_result` para sempre | Alta hoje | Alto (display e artefato) | store por `toolCallId` como fonte do artefato; corrigir `normalizeHistory`/cache com tetos existentes; teste de adapter |
| Artefato é conteúdo não confiável do modelo | Média | Alto (se fase 3) | MVP declarativo com schema fechado; fase 3 exige sandbox + protocolo + testes de isolamento |
| Re-render destrói estado interativo | Média | Alto | nó fora do `article.work`, registry por `toolCallId`, estado no store; teste "re-render com cartão aberto" |
| Divergência futura Mesa×Conversa | Média | Médio | manter `worklog-parity.mjs` alinhado e rodá-lo nos dois; revisar no `verify:bend` |
| Troca de conversa no meio do turno deixa log pendurado | Alta hoje | Médio | `settleTurn` no `showHistory`/`desk-conversation-changed`; teste E2E |

---

## 10. Estimativa de complexidade

Unidade: S ≈ 2-4 h de agente com testes; M ≈ 1 dia; G ≈ 2-3 dias. Inclui testes
sintéticos, não inclui revisão de outro agente.

| # | Item | Tam. |
|---|---|---|
| 1 | Port `worklog.mjs` (MCP/repetição/parts) + testes copiados | S-M |
| 2 | Port `worklog-view.mjs` + testes de view | S |
| 3 | Segmentos no `desk/src/chat.mjs` + quiz + paridade com `paintLive` | M |
| 4 | Guardas: Parar imediato, deltas tardios, `settle` na troca, dedup por chave | S |
| 5 | Pi: `*_start`/`*_end`, `contentIndex`, `toolcall_end` idempotente | M |
| 6 | Claude: `messageId` no `rendererEvent`, índices de bloco, `tool_result` no histórico/cache | M-G |
| 7 | `showHistory` por `parts` (adaptar `message()`) | S |
| 8 | Hunt novo de timeline + cenário no fake Pi | M |
| 9 | **MVP de artefato declarativo** (tool + store + IPC + registry/âncora + shell Bend + testes) | G |
| 10 | Cartão de material/PDF no mesmo registry | M-G (fase 2) |
| 11 | Documento HTML isolado | G+ (fase 3, doc próprio) |

Fase 1 (linha do tempo, itens 1-8): ~2 dias de agente. Fase 2 (artefato + PDF):
+3-4 dias. Fase 3: +3-5 dias, com desenho de segurança separado.

---

## 11. Responsabilidades de arquivos

| Arquivo | Mudança | Testes |
|---|---|---|
| `desk/src/worklog.mjs` | receber o port da Conversa: MCP, repetição, `parts`, `stepMention`, `replaceThinking` | `desk/tests/worklog.test.mjs`, `worklog-parity.mjs` |
| `desk/src/worklog-view.mjs` | receber a versão da Conversa (preview/menção/plug/applyTree) | `desk/tests/worklog-view.test.mjs`, `hunt-chat.mjs` |
| `desk/src/chat.mjs` | segmentos, guardas de Parar/dedup/troca, `showHistory` por `parts`, âncora de artefato | `hunt-chat.mjs`, `hunt-timeline.mjs` |
| `desk/src/state.mjs` | (se preciso) `settle` na troca de sessão/curso | `hunt-shell.mjs`, hunt novo |
| `desk/src/agents/service.cjs` | preservar `messageId`/`contentIndex` em `message_delta` | testes de adapter |
| `desk/src/agents/claude-adapter.cjs` | blocos com índice; `tool_result` no histórico | `agent-history.test.mjs`, `claude-adapter-usage-history.test.mjs` |
| `desk/src/agents/history.cjs` | ordem de `toolResult` (não empurrar para o fim) | `agent-history.test.mjs` |
| `desk/src/extensions/atividade/`, `desk/src/agents/atividade.cjs` | ferramenta Pi + SDK | testes do store + hunt |
| `desk/activities.cjs` (novo) | validação, persistência por conversa, versão, broadcast | `activities.test.mjs` |
| `desk/main.cjs`, `desk/preload.cjs` | evento/IPC de publicação (molde `materialEvent`) | `hunt-timeline.mjs` |
| `desk/src/artifacts.mjs` (novo) | registry, `publish`/`anchor`/`restore` | teste com DOM falso |
| `core/activityview.bend` + `laws/`+`proofs/` (novo, fase 2) | shell do cartão | `activity-view.test.mjs`, `verify:bend` |
| `desk/tests/hunt-pi.mjs`, `desk/tests/hunt-timeline.mjs` | roteiros sintéticos | — |

Fora de responsabilidade: `core/worklog.bend`, `core/worklogview.bend`,
`desk/src/queue.mjs`, `desk/config.cjs`, `desk/src/materials/*`,
`desk/material-pdf.cjs` (o template PDF é outro domínio; aqui só o ponto de
publicação do cartão de material).

---

## 12. Ordem de implementação sugerida

1. Port 1+2 (worklog/view) com testes — o menor passo com ganho imediato e sem
   mudança de fluxo.
2. `showHistory` por `parts` (7) + testes de histórico.
3. Segmentos (3) + guardas (4) + hunt de timeline (8).
4. Pi `contentIndex`/`toolcall_end` (5) e Claude `messageId`/índices (6) com
   testes de adapter.
5. MVP de artefato declarativo (9) reusando a âncora fechada no passo 3.
6. Cartão de material/PDF (10) como segunda instância do mesmo registry.

Cada passo roda `npm test` nos dois apps e o hunt correspondente; nenhum passo
altera defaults do autor, materiais, PDFs ou sessões.

---

## Anexo A — evidências pontuais

- `diff -u desk/src/worklog.mjs chat/src/worklog.mjs`: MCP (bloco novo após
  `makeToolStep`), repetição (após `countsLabel`) e `parts` em `historyTurns`.
- `diff -u desk/src/generated/worklog.core.js chat/src/generated/worklog.core.js`:
  vazio; idem `worklogview.core.js` e `worklog-tags.mjs`.
- `desk/src/chat.mjs:196-201` é o ponto exato da agregação no histórico.
- `chat/src/chat.mjs:269-278` é o laço `parts` a portar.
- `desk/src/agents/service.cjs:15` é onde `messageId` morre.
- `desk/src/agents/history.cjs:227-231` é onde o `toolResult` é empurrado para o
  fim; `desk/src/agents/claude-adapter.cjs:487-520` é onde ele é descartado.
- `docs/json.md:77-93` (Pi): `contentIndex` + conteúdo autoritativo em
  `*_end`; `docs/message-types.md:154-166`: `ToolResultMessage.details`.
- `docs/session-format.md:128`: entrada `compaction` sem `role`.

## Anexo B — perguntas em aberto para o usuário

1. O cartão de artefato deve substituir a linha do tool (mais compacto) ou ficar
   logo abaixo dela (mais rastreável)? O plano assume **abaixo**.
2. O quiz da Mesa migra para o registry de artefatos na fase 2 ou permanece
   separado? O plano assume **separado** até haver decisão.
3. O rascunho de PDF preparado deve virar cartão no transcript além do diálogo de
   revisão? O plano assume **sim, na fase 2**, com o diálogo mantido.
