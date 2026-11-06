# Threads longas no tutor: pesquisa e plano (fase 1)

**Status:** pesquisa e plano. Nada aqui foi implementado.
**Base da Mesa:** `3586bae` (worktree desta pesquisa).
**T3 Code:** `pingdotgg/t3code`, commit raso `8ab024f3`, licença MIT (cabeçalho do `LICENSE`).
**Pedido:** aproveitar o que o T3 Code faz para threads longas e histórico, para a conversa com o tutor continuar leve quando fica enorme.
**Escopo:** histórico já pronto. O desenho incremental da resposta em streaming é outro trabalho; aqui só se aponta onde os dois se encostam.
**O que foi verificado:** o T3 Code foi lido no clone raso, sem instalar dependências nem executar nada. A Mesa foi lida no código desta base. Não li sessões reais, não abri a janela, não rodei `npm run ui`, `npm run hunts` nem `npm test`. As medições são de Node puro, com dados sintéticos; o que depende de layout/pintura está marcado como não medido.

## Resumo para decisão

A conversa longa da Mesa custa caro em três lugares diferentes, não num só:

1. **Remontagem dupla.** Abrir uma conversa chama `showHistory` duas vezes: uma com o cache do descritor (`loadCourse`) e outra com o `get_messages` do `pi-connect`. No sintético de 5.000 mensagens, cada montagem custa entre ~1,0 s e ~3,4 s antes do DOM (leitura 68–108 ms + `historyTurns` 39–499 ms + Markdown/KaTeX 0,9–2,8 s, conforme a carga), e o payload vai duas vezes (~3,3 MB cada).
2. **Markdown/KaTeX de tudo, sempre.** O histórico inteiro é convertido em HTML sanitizado na hora de abrir; não há janela nem renderização sob demanda. Em 5.000 mensagens, 2.500 falas com Markdown custam 0,9–2,8 s só nesse pipeline (sem DOMPurify, sem criar DOM, sem layout).
3. **Gravação O(N) no processo principal.** Cada `_saveMessages` relê, valida e reescreve o descritor inteiro. Em 5.000 mensagens isso custa 118–291 ms **síncronos no main**, e o serviço grava a cada `message_end` (`desk/src/agents/service.cjs:57-74`).

As três propostas de maior ganho, em ordem de risco:

| # | Proposta | Ganho medido/estimado | Risco |
|---|---|---|---|
| P1 | Montar o histórico uma vez só por abertura | corta 1,0–3,4 s e ~3,3 MB da segunda montagem em 5.000 | baixo |
| P2 | Casca de texto para todas + Markdown/KaTeX sob demanda | tira 0,9–2,8 s do primeiro paint em 5.000 | médio |
| P3 | Tirar a gravação do main (worker) e coalescer por turno | tira 118–291 ms de bloqueio por gravação em 5.000 | médio-alto |

O T3 Code acerta o desenho maior (snapshot + janela + virtualização + busca fora do DOM), mas a Mesa não pode copiar a virtualização que desmonta linhas: seleção de texto, leitor de tela, âncora de citação e exportação dependem do histórico inteiro. A adaptação da Mesa é manter **todas as mensagens no DOM como texto**, hidratar o rico só perto da vista e deixar busca/exportação lerem a fonte, não a tela.

## 1. O que o T3 Code faz de verdade

### 1.1 Snapshot e projeção, não reprocessar o log

O T3 não remonta a conversa a partir de todos os eventos. O estado durável é um log de eventos com `sequence`; a leitura normal é um **snapshot de projeção** em `N`, e o cliente aplica só eventos `> N` (`docs/orchestration-v2/core-graph-and-data-model.md:31-38`). O log de eventos é podado: a projeção é a fonte de verdade e o log guarda ~1 dia para reconexão (`docs/internals/overview.md:61-71`). Um cliente atrasado recebe snapshot novo em vez de replay.

Para históricos grandes, o snapshot é **limitado** (`apps/server/src/orchestration-v2/threadHistoryPaging.ts:15-20`):

```ts
export const THREAD_HISTORY_PAGE_POLICY = {
  maxUserTurns: 10, maxItems: 75, maxTurnItems: 500,
  maxEncodedBytes: 1_048_576,
} as const;
```

A janela para no orçamento de bytes e em 10 turnos do aluno (ou 75 itens, ou 500 itens de um turno muito longo). O resto vem por `historyCursor`/`hasMoreHistory` (`threadHistoryPaging.ts:314-376`; `packages/client-runtime/src/state/threads.ts:81-88`) e o botão “Load earlier turns” (`apps/web/src/components/chat/MessagesTimeline.tsx:1376-1393`). O cliente funde a página antiga preservando posição e âncora (`packages/client-runtime/src/state/threadHistoryMerge.ts:52`).

Três economias entram no mesmo pacote (`boundedThreadSnapshotHttp.ts:20-35`, `ThreadStream.ts:47-64`): `compactTurnItems` (não repete itens locais), `dedupeBodies` (corpos compartilhados viram uma referência) e `compactIds` (tabela de ids). Grupos de trabalho acima de 150 itens viram um item “deferred” com cursor (`threadHistoryPaging.ts:22,201-250`): o cliente só busca aqueles passos se abrir o grupo.

### 1.2 Renderização: lista virtualizada, linhas memoizadas, stream só na linha viva

A timeline usa `LegendList` (`apps/web/package.json:30`; `apps/web/src/components/chat/MessagesTimeline.tsx:1307-1343`), com `estimatedItemSize={90}` e “manter no fim” do próprio virtualizador. As linhas são memoizadas (`TimelineRowContent = memo(...)`, linha 1423) e a altura estimada é agrupada por tipo e faixa de tamanho (`getItemType`, linhas 1417-1420) para o virtualizador não recalcular tudo.

A derivação das linhas também é incremental: `useIncrementalTimelineRows` e `useStableRows` reaproveitam a projeção anterior quando a identidade não muda (`apps/web/src/components/chat/useTimelineRows.ts:42-80`). Durante o stream, o texto do assistente chega por um átomo só daquela mensagem (`useAssistantMessageText`, `apps/web/src/state/entities.ts:247-257`; comentário em `ThreadTimeline.tsx:18`): o delta não re-renderiza a timeline inteira.

Acessibilidade: o próprio T3 reconhece que o virtualizador desmonta linhas e mantém a primeira e a última mensagem sempre montadas para a navegação por headings do leitor de tela (`MessagesTimeline.tsx:786-805`). Busca (`Ctrl/Cmd+F`, `packages/shared/src/keybindings.ts:204`) não varre o DOM: o servidor pesquisa a thread inteira no SQLite (`apps/server/src/orchestration-v2/ThreadFind.ts:194-250,315-330`) e devolve entrada + ocorrência; a UI rola até a linha e a monta. É a prova de que virtualização e busca completa podem conviver, mas com busca fora do DOM.

### 1.3 O que fica no disco

O T3 usa SQLite para projeções e eventos; não reescreve um JSON gigante por mensagem. Anexos ficam em arquivo por thread (`apps/server/src/attachmentStore.ts`), e a mensagem guarda **id + metadados**, não base64 (`packages/contracts/src/chatAttachment.ts:140-190`). A leitura é por URL assinada de curta duração (`ATTACHMENT_UPLOAD_URL_TTL_MS`, `assets/AttachmentUpload.ts:95`; o cliente renova em `state/assets.ts:37-39,243-258`).

Limites de imagem: 10 MiB por imagem, 100 anexos e 80 MiB de imagens por turno (`chatAttachment.ts:14-17`); antes do envio, imagem maior que 2.000 px no lado maior é reduzida (`packages/client-runtime/src/imageAttachmentSize.ts:6-24`). Saídas de ferramenta: no máximo 8 imagens (`packages/shared/src/toolOutput.ts:257-275`), bytes de imagem não servidos são removidos (`apps/server/src/orchestration-v2/toolOutputImageBytes.ts:104`), detalhe de ferramenta é truncado em 32 KiB e o modo “on demand” em 256 KiB (`WireProjection.ts:26-29,215-275`). Saída de comando concluída nem vai no snapshot: vira `outputOmitted: true` (`WireProjection.ts:155-180`).

### 1.4 Compactação e streaming

Compactação é do provedor, não da lista: `/compact`, auto-compactação por tokens e compactação de thread ociosa (`docs/user/providers-claude.md:46-74`; `packages/shared/src/claudeCompaction.ts:42-43`). Isso reduz o contexto do modelo, **não** o histórico exibido; não encontrei caminho de compactação que apague mensagens da tela.

Reconexão também é limitada: replay de até 128 eventos e 1 MiB; acima disso, snapshot novo (`ThreadStream.ts:18-26,104-112`). O `snapshotSequence` é o cursor; o cliente não reaplica o que o snapshot já contém.

## 2. Caminho do histórico na Mesa

### 2.1 Processo principal: leitura, cache, IPC e gravação

| Etapa | Onde | O que faz |
|---|---|---|
| Descritor | `desk/src/agents/conversations.cjs:211-233` | `readClaudeConversation`: `stat`, `JSON.parse`, validação do schema e dos `messages`. |
| Tetos | `conversations.cjs:56-64,174-178` | 12 MiB e 5.000 mensagens; acima disso o descritor é inválido. |
| Gravação | `conversations.cjs:313-381` | `updateClaudeConversation`: relê, normaliza, valida tudo de novo, corta pelo teto e grava atômico. |
| Corte | `conversations.cjs:385-399` | `boundMessages` mantém as mais novas; serializa cada linha para contar bytes. |
| Cache | `desk/src/agents/descriptor-cache.cjs:5-19` | Cache por `stat`; metadados sempre, `messages` só quando pedido. |
| Pi antigo | `desk/tutor-engine-host.cjs:115-128` | JSONL legado lido só nos primeiros 200.000 caracteres; não reescreve. |
| Histórico Claude | `desk/src/agents/claude-adapter.cjs:530-576` | API oficial, até 200 mensagens/8 MiB/64 páginas; funde com o cache local. |
| Histórico OpenCode | `desk/src/agents/opencode-history.cjs:149-163` | Segue `cursor.next` até 200 páginas; acumula tudo em memória. |
| Serviço | `desk/src/agents/service.cjs:82-84` | `get_messages` devolve `this.messages`; pode substituir pelo histórico do adaptador. |
| Salvamento | `desk/src/agents/service.cjs:57-74,130` | `_saveMessages` a cada aceite/`message_end`; chama `onMessages` → `updateClaudeConversation`. |
| `conversationData` | `desk/tutor-engine-host.cjs:129-137` | Devolve `messages` do cache do descritor, status, cards e metadados. |
| `initialData` | `desk/course-state-host.cjs:149-167` | Inclui `...conversationData()` **com mensagens**; é o payload de abrir/trocar sessão ou matéria. |
| `get-config` | `desk/main.cjs:472` | Usa `conversationData({messages:false})`; abrir Configurações não carrega o histórico. |
| `pi-connect` | `desk/tutor-session-ipc.cjs:52-61` | Pede `get_messages` ao motor, aplica `trimMessageImages` e devolve as mensagens + metadados. |
| Imagens | `desk/prompt-images.cjs:95-105` | `trimMessageImages`: mantém as 6 últimas mensagens com imagem e **muta** a lista recebida. |
| Exportação | `desk/chat-export-host.cjs:33-66` | Lê o descritor inteiro; no Claude com sessão nativa, lê o histórico completo pelo SDK. |

`trimMessageImages` é um ponto de atenção: ela remove imagens antigas da mesma lista que o serviço guarda em memória. No próximo `_saveMessages`, o descritor pode ser gravado sem elas. Hoje isso é tratado como cache de exibição, mas qualquer proposta de imagem precisa decidir explicitamente se o corte é só de payload ou também de disco.

### 2.2 Renderer: `showHistory` e o que ele chama

`showHistory` (`desk/src/chat.mjs:49-153`) faz, em sequência:

1. `historyTurns(messages)` (`desk/src/worklog.mjs:417-495`) reconstrói turnos e pareia `toolCall`/`toolResult`; é O(N) e não tem cache entre aberturas.
2. Monta um `DocumentFragment`; para cada turno, cria bolhas com `message()` (`desk/src/chat-message-view.mjs:20-31`), diário de trabalho e slots de atividade.
3. Cada bolha chama `paintMessage` (`chat-message-view.mjs:32-48`): `markup()` (`desk/src/markdown.mjs:36-56`) faz Math→KaTeX, `marked`, realce de código e `DOMPurify.sanitize`; depois `decorateCode`, `linkifyRefs` (citação de PDF) e `hydrateAssets` (imagens locais).
4. O cache de KaTeX é por TeX+modo, com 512 entradas (`desk/src/math-cache.mjs:17-34`). Numa montagem inicial de 5.000 mensagens, as fórmulas são quase todas misses; o cache só ajuda em repintura/stream.
5. `applyChatScroll('history', …)` (`desk/src/chat-scroll-view.mjs:118`) decide se segue o fim; `syncChatScrollMode` (`desk/src/state.mjs:205-256`) liga/desliga o modo de rolagem.
6. `markLatestAnswer()` varre todas as mensagens não-usuário para achar a última resposta.

O CSS já faz uma “virtualização visual” sem desmontar: `#messages>.message:not(:last-child){content-visibility:auto;contain-intrinsic-size:auto 160px}` (`desk/src/tutor-chat.css:142`). Isso tira layout/pintura das mensagens fora da vista, mas **não** tira o custo de ler, agrupar, converter Markdown e criar DOM. A última mensagem fica de fora da regra porque é a que cresce no stream.

### 2.3 O que é refeito por inteiro, e quando

| Evento | O que acontece hoje | Refaz o histórico? |
|---|---|---|
| Abrir conversa | `openSession` devolve `initialData` com `messages`; `loadCourse` chama `showHistory`; em seguida `connect` chama `showHistory` de novo (`course-conversations.mjs:55-69`; `state.mjs:554,658`). | **Duas vezes** |
| Trocar matéria/aba | `switchCourse` recebe `initialData` com mensagens, `loadCourse` monta, `connect` monta de novo (`state.mjs:721-745`). | **Duas vezes** |
| Abrir/recolher o chat | Só classe/estado de layout; não chama `showHistory`. | Não |
| Redimensionar | `ResizeObserver` chama `syncChatScrollMode`/`followBottom`; não reparseia Markdown. | Não (só reflow) |
| Chegar mensagem nova | O evento pinta só a bolha viva a cada ~80 ms (`updateMessage`, `chat-message-view.mjs:73-77`); no fim, `_saveMessages` grava o descritor inteiro. | Não, mas o main bloqueia na gravação |
| `pi-health`/settings | `conversationData({messages:false})`; só metadados. | Não |

A montagem dupla é o maior desperdício evitável: o mesmo conteúdo é lido, agrupado, convertido e inserido duas vezes, e trafega duas vezes pelo IPC. No caminho offline ela é necessária (o cache do descritor aparece antes do connect), mas quando o connect devolve a mesma lista não há por que remontar.

### 2.4 Requisitos que o desenho atual já encosta

- **Rolagem:** `applyChatScroll` e `chatFollowDecision` dependem de distância ao fim e de `#messages`/`#chat`; um carregamento por página precisa preservar a posição e não pode chamar `showHistory` no meio de um turno.
- **Citação:** `linkifyRefs` transforma `Arquivo.pdf, p. N` em botão; se a mensagem antiga não estiver hidratada, o alvo precisa ser hidratado antes de rolar.
- **Busca na conversa:** hoje `Ctrl/Cmd+F` é a busca do **PDF** (`desk/src/keys.mjs:29`; `desk/src/pdf.mjs:485`), não há busca na conversa. Qualquer busca nova precisa varrer a fonte, não só o DOM carregado, e resolver o conflito de atalho.
- **Exportação:** `export-chat` lê o descritor inteiro/nativo (`chat-export-host.cjs:33-66`); não pode passar a exportar só a janela visível.
- **Seleção e leitor de tela:** o DOM completo é o que sustenta seleção entre mensagens e leitura fora da vista. `content-visibility` já preserva isso; desmontar linhas quebraria.
- **Composer/coluna:** o layout não depende da lista; qualquer mudança deve ficar dentro de `#messages` e não mexer em `#composer`/`#chat`.

## 3. Medição sem janela

### 3.1 Como foi medido

Dados sintéticos em `/tmp/medir-threads/dados`, gerados por script descartável (Apêndice A), sem ler sessões reais nem `desk/.runtime`. Cada conversa tem 4 mensagens por turno: pergunta do aluno (com matemática e, a cada 25, uma imagem base64 de 24 KiB), resposta com Markdown/KaTeX/código, `toolResult` (curto; a cada 50, ~18 KiB) e fechamento. O descritor é o mesmo schema de `conversations.cjs`.

Medido em Node 24, com `readClaudeConversation`, `updateClaudeConversation`, `historyTurns`, `marked` + `katex` + `highlightCode` (sem DOMPurify) e `v8.serialize` como proxy do structured clone do IPC. Mediana de 3 execuções (1 aquecimento), repetida em janelas diferentes numa máquina Debian sob carga; por isso a tabela mostra a faixa entre a execução mais leve e a mais pesada. Os números absolutos variam; a ordem de grandeza e o ponto de bloqueio não.

### 3.2 Resultados

| N | Descritor | JSON / v8 | Leitura | `JSON.parse` | `JSON.stringify` | `historyTurns` | Markdown+KaTeX | Por fala | Gravação (+1 msg) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 0,06 MB | 0,06 / 0,05 MB | 2,0–2,3 ms | 0,9–1,4 ms | 0,4–0,5 ms | 5,6–12,7 ms | 14–29 ms (50 falas) | 0,27–0,57 ms | 5–8 ms |
| 1.000 | 0,65 MB | 0,65 / 0,63 MB | 17–38 ms | 8–21 ms | 5–10 ms | 13–35 ms | 94–190 ms (500 falas) | 0,19–0,38 ms | 46–60 ms |
| 5.000 | 3,27 MB | 3,27 / 3,17 MB | 68–108 ms | 40–52 ms | 15–48 ms | 39–499 ms | 0,9–2,8 s (2.500 falas) | 0,37–1,11 ms | 118–291 ms |

“Gravação” é `updateClaudeConversation` com uma mensagem nova: inclui reler, validar, `boundMessages` e escrever o arquivo inteiro.

### 3.3 Leitura dos números

- Em 5.000 mensagens, abrir o histórico custa **~1,0–3,4 s** de trabalho antes de DOMPurify, criação de DOM, estilo e pintura (68–108 ms de leitura + 39–499 ms de `historyTurns` + 0,9–2,8 s de Markdown). Como hoje a abertura monta duas vezes, o custo antes do layout fica em **~2,0–6,8 s**, e o IPC leva **~6,5 MB**.
- O Markdown é o dominante: 0,9–2,8 s para 2.500 falas, ~0,4–1,1 ms por fala. Uma janela de 20–40 mensagens visíveis custaria dezenas de ms, não segundos.
- A gravação é O(N) e síncrona no main: **118–291 ms por `_saveMessages`** em 5.000. O serviço chama isso no aceite do envio, em cada `message_end` e no `prompt` (`service.cjs:57-74,130`); um turno com alguns blocos acumula centenas de ms a mais de bloqueio.
- As imagens do sintético são só 1,2 MB dos 3,27 MB (37%), e as saídas longas ~0,45 MB. No mundo real o teto de 12 MiB do descritor pode ser dominado por imagens; o payload é o mesmo que o descritor carrega.
- O cache de KaTeX chegou a 512 entradas no caso de 5.000; numa montagem inicial ele quase não acerta, porque cada fórmula é nova.

### 3.4 O que não dá para medir sem janela

Não medido: custo do `DOMPurify.sanitize`, criação de nós, style/layout/paint, decodificação de imagens, memória do renderer, jank de rolagem, custo exato do structured clone do Electron, tempo real de `get_messages` do Claude/OpenCode e comportamento de leitor de tela.

Como medir depois, quando a bateria de janela voltar:

- `cd desk && node tests/perf-probe.mjs --only=session --history 1000 --runs 3` e `--only=history --history 1000` já medem abertura, heap e repouso de histórico (a semente atual é JSONL Pi; para testar descritor nativo, estender `seedRuntime`/`seedSession`).
- Novo `tests/chat-long-history-ui.mjs`: semear 100/1.000/5.000 mensagens, medir `performance.now()` em volta de `openSession`/`showHistory`, `PerformanceObserver` de long tasks, `LayoutCount`/`RecalcStyleCount` via CDP, rolagem até o topo/meio, clique de citação para mensagem antiga, seleção atravessando mensagens, busca e snapshot de acessibilidade.
- `tests/chat-long-session-css.test.mjs` já guarda a regra de `content-visibility` no portão rápido.
- `MESA_GATE_CACHE=0 npm test` para os testes de unidade novos (sem janela).

## 4. Plano priorizado

Critérios para todas as propostas: nada de histórico se perde ou muda em disco sem migração; o layout do composer/coluna não muda; sem dependência nova (IntersectionObserver, `requestIdleCallback` e `worker_threads` já existem); rolagem, citação, busca, exportação, seleção e leitor de tela continuam funcionando.

### P1. Montar o histórico uma vez só por abertura (risco baixo)

**O que muda.** `showHistory` ganha uma chave de identidade barata (sessão + quantidade + último `uuid`/timestamp + versão dos cards) e ignora a chamada quando o conteúdo é o mesmo. `connect`/`loadCourse` passam a compartilhar essa chave. O `initialData` continua mandando `messages` para o caso offline; quando o `pi-connect` devolve a mesma lista, não há segunda montagem nem segundo payload de mensagens. Se o histórico nativo tiver mais mensagens que o cache, a chave muda e monta.

**Ganho.** No sintético de 5.000, evita uma das duas montagens: 1,0–3,4 s de trabalho e ~3,3 MB de IPC. No de 1.000, 0,1–0,4 s e ~0,65 MB.

**Risco.** Baixo. O perigo é pular uma montagem legítima (mensagem chegou offline, cards mudaram, histórico nativo cresceu). A chave tem de ser conservadora e o `showHistory` continua sendo o único caminho de desenho.

**Teste.** Unidade da chave (igual/ diferente / cards / sessão / histórico nativo maior); UI contando eventos `desk-history-rendered` ou medindo `openSession`; `perf-probe session` antes/depois.

### P2. Casca de texto para todas + Markdown/KaTeX sob demanda (risco médio)

**O que muda.** `showHistory` cria todas as linhas como **texto escapado** (e guarda a fonte no elemento), sem `markup`/KaTeX para quem está longe da vista. Um `IntersectionObserver` com margem (por exemplo 800 px) hidrata o rico ao aproximar; `revealInChat`, citação e busca podem hidratar o alvo na hora. `content-visibility` continua cuidando do layout fora da vista. O diário/slots de atividade também podem nascer leves e hidratar junto. A última linha (viva) nunca é adiada.

**Ganho.** Tira 0,9–2,8 s de Markdown/KaTeX do primeiro paint em 5.000; sobram leitura (68–108 ms), `historyTurns` (39–499 ms), cascas e o rico de ~20–40 mensagens visíveis (dezenas de ms). Se o agrupamento de turnos também for adiado para a janela, o `historyTurns` sai do caminho crítico. É o maior ganho de percepção.

**Risco.** Médio. A casca precisa manter o texto real (seleção, leitor de tela, busca) e a altura precisa ser estável ao hidratar, senão a rolagem salta. Fórmula em fonte TeX e imagem ainda não hidratada são degradações visíveis. Citação para mensagem antiga tem de hidratar antes de rolar. `content-visibility` só vale para filhos que não são o último; a linha viva não pode virar casca.

**Teste.** UI de 5.000: abrir, rolar até o topo/meio, selecionar texto atravessando uma linha não hidratada, clicar citação para a mais antiga, buscar termo antigo, conferir leitor de tela (snapshot de acessibilidade), medir salto de scroll ao hidratar, exportar e conferir que o arquivo tem tudo. Unidade: `hydrate` idempotente, `revealInChat` hidrata antes de medir.

### P3. Tirar a gravação do main e coalescer por turno (risco médio-alto)

**O que muda.** `updateClaudeConversation` deixa de rodar síncrono no processo principal. Um `worker_threads` (padrão já usado em `triage-worker.mjs`) recebe só a mensagem nova/o patch, lê o descritor, valida, aplica `boundMessages` e grava atômico; o main mantém a lista em memória para a tela. Gravações do mesmo turno são coalescidas (uma por turno, não uma por `message_end`), com fila e flush no quit. Numa segunda etapa, se o arquivo inteiro ainda doer, um sidecar append-only (`schemaVersion 2`) troca o rewrite por append; isso exige migração explícita, fallback de leitura e teste de recuperação.

**Ganho.** Remove 118–291 ms de bloqueio do main por gravação em 5.000 (e as múltiplas gravações de um turno). A latência total de disco não desaparece, mas deixa de travar a janela e o IPC. Em 1.000, tira 46–60 ms por gravação.

**Risco.** Médio-alto. Ordem, concorrência com envio/incerteza, flush no quit e falha no meio da escrita. O descritor tem de continuar válido byte a byte; nada de perder `delivery`/`uncertain`. O sidecar é a parte que mexe em disco: só com migração e prova de recuperação.

**Teste.** Worker com runtime temporário: ordem de duas gravações, arquivo final válido, falha no meio não corrompe, flush no quit, nenhuma mensagem perdida; teste de event loop do main (latência) com 5.000; `tests/conversations.test.mjs` existente como regressão; se sidecar, migração/rollback e leitura de descritor antigo.

### P4. Cache de projeção/HTML por mensagem (risco médio)

**O que muda.** Cache em memória (LRU com teto, por exemplo 200 mensagens/8 MB) do resultado de `historyTurns` e do HTML já sanitizado por mensagem, com chave pelo hash do texto + imagens + versão da biblioteca/links. Reabrir a mesma sessão ou voltar de outra aba reaproveita. Não é cache de disco na primeira fase; se for, arquivo separado, versionado e apagável, nunca o descritor.

**Ganho.** Reabertura de 5.000 cai de 1,0–3,4 s para perto de zero de Markdown/`historyTurns`; a primeira abertura não muda. No 1.000, economiza 94–190 ms de Markdown + 13–35 ms de turnos por reabertura.

**Risco.** Médio. Cache velho quando o texto é igual mas a imagem/link mudou; memória; e nunca guardar HTML não sanitizado. A chave precisa incluir o que `markdown`/`linkifyRefs`/`hydrateAssets` leem.

**Teste.** Acerto/erro, invalidação por mudança de texto/imagem/biblioteca, teto de memória, HTML cacheado continua sanitizado, reabrir e comparar DOM.

### P5. Imagens e saídas de ferramenta sob demanda (risco médio)

**O que muda.** O payload de `initialData`/`pi-connect` deixa de carregar base64 de imagens antigas e o texto inteiro de `toolResult` grande. Cada parte ganha um índice estável; o renderer pede os bytes ao main só quando a mensagem chega perto da vista (IPC novo, sem servidor HTTP). As 6 últimas imagens continuam como hoje. Saídas de ferramenta grandes viram resumo + “ver saída”. O descritor em disco não muda.

**Ganho.** No sintético de 5.000, imagens são ~1,2 MB dos 3,27 MB e saídas longas ~0,45 MB; no pior caso real, o teto de 12 MiB é dominado por imagens. O payload pode cair de ~12 MB para ~2–3 MB, e a decodificação de imagem sai do caminho de abertura.

**Risco.** Médio. A imagem pode piscar/tardar; exportação e offline têm de continuar usando a fonte; o índice não pode sair do lugar quando uma mensagem é cortada por `boundMessages`; e o main não pode reler 3,3 MB por imagem (usar o registro em memória do cache).

**Teste.** Tamanho do payload antes/depois, imagem visível ao rolar, imagem antiga no export, offline, descritor byte a byte igual, índice após corte.

### P6. Busca na conversa fora do DOM (risco baixo-médio)

**O que muda.** Uma busca da conversa indexa `messages` (texto, código, `toolResult`) na fonte — no main ou numa cópia de trabalho do renderer — e devolve lista de ocorrências com índice. Navegar hidrata a mensagem e rola até ela. O T3 faz isso no servidor (`ThreadFind.ts`); a Mesa pode fazer no main ou no renderer, já que 3,4 MB de texto é uma varredura barata.

**Ganho.** Busca funciona com mensagens fora da tela e sem depender de todo o DOM rico; não muda o tempo de abertura.

**Risco.** Baixo-médio. Hoje `Ctrl/Cmd+F` é a busca do PDF (`keys.mjs:29`); é preciso decisão de produto: manter o PDF e usar outro atalho para a conversa, ou tornar `Ctrl/Cmd+F` contextual (foco no chat × foco no leitor). O destaque precisa sobreviver à hidratação.

**Teste.** Achar a mensagem mais antiga de 5.000, navegar, hidratar, destacar; `Ctrl+F` no PDF continua igual; leitor de tela anuncia a ocorrência.

### O que não se aplica à Mesa

| Ideia do T3 | Por que não copiar |
|---|---|
| `LegendList`/virtualização que desmonta linhas | Nova dependência e quebra seleção/leitor de tela/âncora para mensagens fora da vista. A Mesa já tem `content-visibility`; o ganho deve vir de não converter o rico, não de remover o texto do DOM. |
| SQLite, event sourcing, `snapshotSequence`, replay | A Mesa não tem log de eventos; o descritor é o estado. O custo não está em replay, está em reler/validar/reescrever JSON e converter Markdown. |
| `dedupeBodies`/`compactIds` | Não há grafo de corpos compartilhados no descritor; mensagens são objetos simples. |
| URLs assinadas/HTTP para anexos | A Mesa é um processo Electron offline; o equivalente é IPC sob demanda, não um servidor de assets. |
| Compactação do provedor | Já existe (`/compact`, auto-compactação) e reduz contexto do modelo, não o histórico exibido. |
| Manter primeira/última linha montadas | É o remendo do T3 para o virtualizador; a Mesa mantém o texto de todas, então não precisa do remendo. |

**Atribuição.** Nenhum código do T3 Code será copiado nesta fase; as ideias acima são desenho. Se alguma trecho for reaproveitado depois, o aviso MIT de `pingdotgg/t3code` entra em `Sobre → Créditos` (que já cita o T3 pela #42) e no arquivo de licenças, junto do texto de copyright.

## 5. Sobreposição com o trabalho de streaming

O agente do stream mexe em `chat.mjs` (handler de eventos), `chat-turn.mjs`, `chat-message-view.mjs`, `markdown.mjs`, `math-cache.mjs` e na regra de `content-visibility` da última mensagem. Esta fase mexe em `showHistory`, `historyTurns`, na carga do descritor e no caminho de abertura. Os encostos concretos:

- **`showHistory` não pode virar o carregador de página.** Ele hoje faz `turnState.turnClosed=true`, zera buffers e reinicia o ledger (`chat.mjs:51-58`). Chamá-lo para “carregar anteriores” mataria um turno vivo. A página nova precisa de um `appendHistory`/`hydrateHistory` que só mexe em linhas fechadas.
- **A linha viva é a última e não pode ser adiada.** A regra `:not(:last-child)` existe para o stream crescer sem `content-visibility`; qualquer casca/placeholder tem de excluir a linha viva.
- **`mathCache` é compartilhado.** A paginação/hidratação não pode limpar o cache; o stream se beneficia dele. Se o cache for LRU por mensagem, a chave e o teto precisam valer para os dois.
- **Rolagem.** `applyChatScroll('history')` e `turnState.historyStick` são usados por `paintMessage` para não medir por mensagem (`chat-message-view.mjs:32-47`). A hidratação sob demanda precisa de um “lote” próprio, senão cada mensagem hidratada vira uma medição/rolagem.
- **Imagens.** O stream ainda acrescenta imagens novas; o corte de payload de P5 só pode valer para partes antigas e não pode mexer na bolha viva nem em `trimMessageImages` sem coordenar.

**Ordem recomendada:** primeiro o desenho do stream (linha viva, atualização por átomo/bolha, throttles), porque ele define o contrato da última linha e do cache de Markdown. Depois P1 (barato, independente), depois P2/P3. Não proponho refazer o caminho do stream; a hidratação de histórico deve ser uma camada separada que nunca chama `showHistory` nem toca em `turnState` do turno aberto.

## 6. Critérios de aceitação para qualquer proposta

| Requisito | Como fica garantido |
|---|---|
| Rolagem | Nenhuma proposta troca `applyChatScroll`; carregar/hidratar preserva `scrollTop` e testa salto. |
| Âncora de citação | Citação de mensagem antiga hidrata o alvo antes de medir/rolar; o botão de `linkifyRefs` continua existindo após a hidratação. |
| Busca na conversa | Busca lê a fonte inteira, não só o DOM; o atalho do PDF não é roubado (decisão de produto registrada). |
| Exportar conversa | `export-chat` continua lendo descritor/nativo inteiro; teste com janela e com mensagem antiga. |
| Seleção de texto | Todas as mensagens têm texto real no DOM; nada de desmontar linhas. |
| Leitores de tela | O texto de todas as mensagens permanece acessível; a linha viva continua no lugar; teste de snapshot de acessibilidade. |
| Nada se perde/muda em disco | Janela e cache são leitura; gravação mantém schema/validação; sidecar só com migração e rollback. |
| Layout do composer/coluna | Mudanças restritas a `#messages` e ao cache; `#composer`, `#chat` e as classes de layout não mudam. |
| Sem dependência nova | `IntersectionObserver`, `requestIdleCallback`, `worker_threads` e as bibliotecas atuais bastam. |

## 7. Perguntas em aberto para o Lucas

1. A busca na conversa deve dividir `Ctrl/Cmd+F` com o PDF (contextual) ou ganhar outro atalho?
2. O corte de imagens antigas é só de payload ou também do cache de exibição em disco? Hoje `trimMessageImages` já muta a lista; isso é intencional?
3. A janela inicial deve ser por quantidade (ex.: 300 mensagens), por bytes (ex.: 1 MiB, como o T3) ou por “últimos N turnos”?
4. Vale manter cache de HTML em memória só, ou o Lucas quer reabertura instantânea mesmo depois de fechar o app (cache em disco versionado)?

## Apêndice A — reprodução da medição

O script abaixo é descartável; ele não faz parte do app. Rode da raiz do repositório, com `desk/node_modules` instalado (`npm ci` em `desk/`). Ele cria tudo em `/tmp/medir-threads`.

```sh
mkdir -p /tmp/medir-threads && cat > /tmp/medir-threads/medir.mjs <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import v8 from 'node:v8';
const require=createRequire(import.meta.url), ROOT=process.cwd();
const DEPS=process.env.MESA_DEPS||path.join(ROOT,'desk/node_modules');
const {readClaudeConversation,updateClaudeConversation}=require(path.join(ROOT,'desk/src/agents/conversations.cjs'));
const {historyTurns}=await import(path.join(ROOT,'desk/src/worklog.mjs'));
const {marked}=await import(path.join(DEPS,'marked/lib/marked.esm.js'));
const katex=(await import(path.join(DEPS,'katex/dist/katex.mjs'))).default;
const {highlightCode}=await import(path.join(ROOT,'desk/highlight.mjs'));
const TMP='/tmp/medir-threads/dados',SAVE='/tmp/medir-threads/save';fs.rmSync(TMP,{recursive:true,force:true});fs.rmSync(SAVE,{recursive:true,force:true});fs.mkdirSync(path.join(TMP,'conversations'),{recursive:true});fs.mkdirSync(path.join(SAVE,'conversations'),{recursive:true});
const IMG=Buffer.alloc(24*1024,7).toString('base64'), cache=new Map();
function tex(s,d){const k=`${d?1:0}\0${s}`;if(cache.has(k))return cache.get(k);let v=null;try{v=katex.renderToString(s,{displayMode:d,throwOnError:false,trust:false});}catch{}cache.set(k,v);if(cache.size>512)cache.delete(cache.keys().next().value);return v;}
function md(t){const m=[];const s=t.replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\$)\$([^\n$]+)\$(?!\$)/g,(x,a,b,c,d)=>{const n=m.length,texs=a??b??c??d,disp=a!==undefined||b!==undefined;m.push(tex(texs,disp)??x);return `M${n}E`;});let h=marked.parse(s,{breaks:true});const c=[];h=h.replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g,(x,l,code)=>{const u=String(code).replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'",'#x27':"'"}[e]));c.push(`<pre class="hl"><code data-lang="${l||''}">${highlightCode(u,l)}</code></pre>`);return `C${c.length-1}E`;});h=h.replace(/M(\d+)E/g,(_,n)=>m[n]);return h.replace(/C(\d+)E/g,(_,n)=>c[n]||'');}
function msgs(n){const o=[];for(let i=0;i<n;i++){const k=i%4,t=Math.floor(i/4)+1;if(k===0){const c=[{type:'text',text:`Pergunta ${t}: como resolvo a questão ${t}?\n\nConsidere $f(x)=x^${t%9+1}+${t}$ e explique o passo a passo.`}];if(t%25===0)c.push({type:'image',data:IMG,mimeType:'image/png',source:`captura-${t}.png`});o.push({role:'user',content:c});}else if(k===1){const c=[{type:'text',text:`## Resposta ${t}\n\nComece pela definição. A derivada de $f(x)=x^${t%9+1}+${t}$ é $f'(x)=${t%9+1}x^${t%9}$. Depois use\n\n$$\\int_0^1 x^{${t%20+1}}\\,dx=\\frac{1}{${t%20+2}}$$\n\n\`\`\`js\nfunction passo${t}(x) {\n  // comentário ${t}\n  return x * ${t} + Math.pow(x, ${t%5+1});\n}\n\`\`\`\n\n- passo 1: escreva a expressão\n- passo 2: confira o sinal\n- passo 3: substitua os limites\n\nO resultado aproximado é ${(t*1.2345).toFixed(4)}.`}];if(t%7===0)c.push({type:'toolCall',id:`t${t}`,name:'ler_pdf',arguments:{path:`material-${t}.pdf`,page:t%300+1}});o.push({role:'assistant',content:c});}else if(k===2){const long=t%50===0;o.push({role:'toolResult',content:[{type:'text',text:long?'linha de resultado com número e texto; '.repeat(520):`ok ${t}`}],toolCallId:`t${Math.max(1,t-1)}`});}else o.push({role:'assistant',content:[{type:'text',text:`Fechando a resposta ${t}: o sinal fica positivo e a integral vale $\\frac{1}{${t%20+2}}$. Se precisar, refaça a conta com $x=${t%9+1}$.`}]});}return o;}
function med(fn,r=3){fn();const a=[];for(let i=0;i<r;i++){const t=performance.now();fn();a.push(performance.now()-t);}return a.sort((x,y)=>x-y)[Math.floor(a.length/2)];}
for(const n of [100,1000,5000]){const id=crypto.randomUUID(),f=path.join(TMP,'conversations',`claude-${id}.json`),list=msgs(n),d={schemaVersion:1,engine:'claude',id,nativeSessionId:id,nativeEstablished:true,courseId:'sintetico',started:1700000000000,preview:'sintético',messages:list};const json=JSON.stringify(d),raw=JSON.stringify(d);fs.writeFileSync(f,json);const v8mb=+(v8.serialize(list).byteLength/1048576).toFixed(2);const turns=list.filter(x=>x.role==='assistant');console.log(JSON.stringify({n,fileMB:+(fs.statSync(f).size/1048576).toFixed(2),jsonMB:+(Buffer.byteLength(json)/1048576).toFixed(2),v8MB:v8mb,read:med(()=>readClaudeConversation(f,{runtime:TMP})).toFixed(1),parse:med(()=>JSON.parse(raw)).toFixed(1),stringify:med(()=>JSON.stringify(list)).toFixed(1),turns:med(()=>historyTurns(list)).toFixed(1),markdown:med(()=>{for(const x of turns)for(const p of x.content)if(p.type==='text')md(p.text);}).toFixed(0),save:med(()=>{const copy=path.join(SAVE,'conversations',path.basename(f));fs.copyFileSync(f,copy);const r=readClaudeConversation(copy,{runtime:SAVE});updateClaudeConversation(copy,{messages:[...r.messages,{role:'assistant',content:[{type:'text',text:'nova'}]}]},{runtime:SAVE});fs.unlinkSync(copy);}).toFixed(1)}));}
JS
node /tmp/medir-threads/medir.mjs
```

O `v8MB` do script acima mede só a serialização; para a memória real do renderer, use a sonda de janela. O script de gravação usado separado (`updateClaudeConversation` com uma mensagem nova) está resumido na coluna “Gravação” da tabela.
