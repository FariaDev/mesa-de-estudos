# Revisão independente r2 — Mesa + Claude (host/transporte)

Revisor: agente independente (mesmo modelo, esforço máx.). Somente leitura; sem edições, commits, push, login, inferência, install/update ou Electron; sem `.runtime`, `.claude`/`.pi`, credenciais ou cursos. Arquivos temporários de micro-repros ficaram só em `/private/var/folders/.../T/opencode` e no tmp do sistema.

## 1. Snapshot congelado usado

O workspace andou durante a revisão (adapter/serviço/main mudaram às 01:16–01:18). Tudo abaixo foi conferido contra este snapshot:

| Arquivo | mtime | sha256 (12) |
|---|---|---|
| `desk/agents/claude-adapter.cjs` | 01:18:25 | `ed0b04b88373` |
| `desk/main.cjs` | 01:18:25 | `44b718740121` |
| `desk/agents/service.cjs` | 01:16:54 | `32373be86bd4` |
| `desk/agents/native-history.cjs` | 01:12:10 | `f3707d10a3b1` |
| `desk/agents/conversations.cjs` | 00:44:05 | `7db1ea18f1d6` |
| `desk/agents/descriptor-cache.cjs` | 01:05:43 | `b9639ddb55e0` |
| `desk/agents/history.cjs` | 00:37:52 | `1f7adba06623` |
| `desk/agents/claude-environment.cjs` | 01:01:24 | `23574055270c` |
| `desk/preload.cjs` / `desk/config.cjs` | 00:34:59 | `7e6658a43640` / `36799624e83e` |

`chat/` não tem alteração no `git status`; Xournal++/Conversa intocados; nenhuma flag `bypassPermissions`/`dangerouslySkipPermissions` em `agents/`, `main.cjs`, `preload.cjs`, `config.cjs` (grep vazio); nenhuma leitura de token/OAuth (só os *nomes* de `AUTH_CONFLICT_ENV`).

## 2. Evidência própria executada

- **Testes puros (sem gate/build/Electron):** `node --test tests/{claude-adapter,agent-service,agent-core,conversations,claude-environment,agent-history,descriptor-cache,native-history}.test.mjs` → **90/90 passam** no snapshot atual (44 adaptador + 13 ambiente + 5 serviço + 11 conversas + 12 histórico + 3 core + 1 cache + 2 native).
- **Micro-repro do pior caso de entrega:** aceite comprovado por replay, `persistDelivery` falhando em `accepted` **e** `uncertain`, depois fim de consulta e `close()`. Resultado: `turn_end {uncertain:true, isError:true}`, nenhum `delivery refused`; a recusa só é escolhida quando `turn.taken/acceptResolved/phase` indicam nada entregue. As guardas `turn.taken`/`acceptResolved` fecham o buraco teórico "aceite vira recusa" — não é achado.
- **Micro-bench do descritor cheio:** descritor de **11,9 MiB**; cada gravação de status (`transmitting/accepted/settled`) custou **27–41 ms** de leitura+validação+stringify+rename no processo principal.
- **Repro de config:** `readConfig`/`writeConfig` de `{"desk":{"pinnedExtensions":false}}` devolve o default e remove o campo.
- **Inspeção da dependência pinada:** `sdk.d.ts` e `sdk.mjs` do SDK 0.3.246 (sem executar o CLI). Verifiquei `getSessionMessages` (`Sq`/`gje`/`QC`/`ek`), `extraArgs` nulo → `--replay-user-messages`, `sessionId` → `--session-id=<id>`, `includePartialMessages` e os campos de correlação (`user_message_uuid` em assistant/stream_event/result, `isReplay` no eco).

## 3. Achados novos

### N1. [Baixo — evidência/doc] A paginação do export não é "por linhas brutas" como dizem o módulo e o STATUS
- **Linhas:** `desk/agents/native-history.cjs:1-3,12`; `desk/tests/native-history.test.mjs:6-11`; `docs/STATUS-MESA-CLAUDE-EXPERIMENTAL-2026-10-05.md:45`.
- **Fato:** no SDK pinado, `getSessionMessages` acumula as linhas cruas, **filtra** (`gje`: só `user`/`assistant`, fora `isMeta`/`isSidechain`/`system` por padrão) e **só então** aplica `offset/limit` (`ek`: `slice(offset, offset+limit)`). O comentário ("offsets count native rows, including non-display tool rows") e o teste ("counts raw tool rows") descrevem uma semântica que o SDK real não tem.
- **Impacto funcional:** nenhum — o laço avança `offset += page.length` sobre a mesma lista filtrada, então pagina certo de qualquer forma. O risco é de **prova**: o fake prova o laço do chamador, não a semântica do SDK; o texto do STATUS induz a uma conclusão errada.
- **Correção:** ajustar comentário/teste para "linhas de exibição" (ou declarar explicitamente que o fake modela o contrato do chamador, não o corte interno do SDK) e corrigir a frase do STATUS. Vale citar o `sdk.d.ts` (`GetSessionMessagesOptions`) como fonte.

### N2. [Baixo–Médio, pré-existente] `desk.pinnedExtensions` é descartado — a porta de saída documentada nunca funciona
- **Linhas:** `desk/config.cjs:56-60` (fromDesk só mapeia campos conhecidos), `:74-89` (normalize), `:91-93` (readConfig normaliza); consumidores `desk/main.cjs:394-396`, `desk/profiles.cjs:14`, `desk/scripts/doctor.mjs:74`.
- **Repro (executado):** gravar `config.json` com `desk.pinnedExtensions:false` → `readConfig` devolve o desk default (sem o campo); `writeConfig` regrava o arquivo sem o campo. Ou seja: o usuário perde a opção ao salvar Configurações e o doctor informa "perfil fixado" mesmo com a trava desligada.
- **Por que passou:** os testes escrevem config direto com `writeConfigJson` (`desk/tests/helpers.mjs:47`), pulando `normalize`.
- **Status:** pré-existente (nenhum commit jamais teve o campo em `core/config.bend`/`config.cjs`), fora do escopo Claude, mas em arquivo finalizado da r2. Correção mínima = fato/campo no núcleo `config.bend` + lei/prova + regenerar; alternativa = remover a opção e os comentários.

### N3. [Baixo — resíduo do achado 4 da r1] Escrita do descritor é documento inteiro por transição/mensagem
- **Linhas:** `desk/main.cjs:381` (`persistDelivery` → `updateClaudeConversation`), `:384` (`onMessages`); `desk/agents/service.cjs:30-36,40,58-61`; `desk/agents/conversations.cjs:294-349,353-357`.
- **Medido:** ~30–40 ms por gravação com descritor de 11,9 MiB; cada turno tem ≥3 gravações de status (`transmitting/accepted/final`) + uma gravação por `message_end` de bloco assistente, cada uma relendo/normalizando/validando/`stringify`+`rename` do arquivo inteiro. As **leituras** do achado 4 estão resolvidas (cache + `messages:false` em health/config), mas as escritas seguem O(descritor) e a `this.messages` do serviço cresce sem poda entre saves.
- **Impacto:** travadas curtas no main e IO crescente com histórico grande; sem problema de correção. Sugestão: podar `service.messages` para o necessário de exibição e/ou debounce/separar metadados de `messages`.

### N4. [Informativo — doc] Deriva de documentação
- `docs/CLAUDE-TRANSPORT-EXPERIMENTAL.md:121` mostra `init {sessionId, version, model}`; o adaptador agora também envia `executable` (`desk/agents/claude-adapter.cjs:812`), que é o que o host usa para fixar o binário (`desk/main.cjs:385`).
- `:248` (§9) ainda diz que "a exportação completa é do host" sem citar `agents/native-history.cjs` (32 MiB/10.000 linhas, recusa explícita) — o módulo novo não aparece em §2/§9.
- `:308` fala "42 + 13 = 55"; o suite atual tem 44 + 13 (e 90 nos 8 arquivos puros).
- Nenhum desses pontos altera comportamento; são critérios de conferência final.

## 4. Status dos achados da r1

| # r1 | Status no snapshot r2 | Observação |
|---|---|---|
| 1 (smoke) e 2, 3, 6 (UI) | **Fora do meu julgamento** — frontend/fixture pertencem ao C; não reexecutados/corrigidos aqui | Não tratei como bloqueador de host |
| 4 leitura/IPC | **Resolvido** | `descriptor-cache.cjs` + `conversationData({messages:false})` em health/config/`get-config`; teste puro cobre; resíduo de escrita = N3 |
| 5 bilhete pendente | **Resolvido** | `readHandoff` é espião puro (`desk/handoff.cjs:279-293`, sem claim); `main.cjs:894-896` avisa uma vez via `handoff-problem` (preload `onHandoffProblem`) |
| 7 descritor corrompido | **Resolvido no host** | `sessionInfo` degrada (`main.cjs:222-226`), `conversationStatus.invalid` (`:220`), `engine()` mantém Claude sem fallback Pi (`:206-211`); `init` não rejeita. Prova Electron é a relatada pelo principal (não reexecutada — proibido) |
| Aberto r1: `sessionId` do init não persistido | **Decisão coerente** | `nativeSessionId` continua imutável; divergência agora é estrita (evento descartado + aviso `CLAUDE_SESSION_MISMATCH`, adaptador `:1126-1141`) em vez de reconciliada em silêncio |
| Aberto r1: AskUserQuestion | **Resolvido** | negação explícita em `canUseTool` e `PreToolUse`, sem diálogo pendente (testes passam) |

## 5. Requisitos verificados (por inspeção/execução pura)

Pi como padrão (`new-session` sem engine → Pi; nenhum caminho Claude cria Pi — teste com trap é do principal); Claude isolado por SDK oficial pinado 0.3.246 + `pathToClaudeCodeExecutable` do binário real; sem proxy/Pi/token/OAuth; workspace próprio por conversa (`runtime/claude-workspaces/<id>`, `systemPrompt` explícito); descritor JSON por conversa com `nativeSessionId` precriado e imutável; entrega `transmitting→accepted→settled/refused/uncertain` persistida antes de resolver `send`/`turn_end` (A2); incerteza sticky em memória + núcleo Bend; replay/UUID e sessão estritos; `Read/Glob/Grep` com `canUseTool` + hook PreToolUse com realpath/symlink (testes passam); histórico paginado e export nativo; cancelamento; caps em Bend; rollback preserva bytes.

## 6. Limites de prova (o que **não** está provado)

- **Fake (executado por mim):** 90 testes puros e os 2 micro-repros — comportamento do adaptador/host com SDK simulado; não valida o CLI real.
- **Native estrutural (executado por mim):** leitura dos tipos/código do SDK 0.3.246 instalado (sem autenticar/executar inferência) — confirma flags, correlação e semântica de `getSessionMessages`; não confirma o que o CLI 2.1.246 emite em produção.
- **Autenticado — não executado (nem por mim nem pela rodada):** inferência real, imagem reconhecida, PDF, permissão real do CLI, `interrupt` de produção, `resume` contra sessão nativa existente, custo/limites da assinatura, e o ponto mais sensível: se o CLI honra `--session-id` e se os `result` carregam `user_message_uuid` de fato (se não carregarem, todo turno vira `uncertain` conservador — o desenho bloqueia em vez de duplicar). O probe do principal (spawn/init/replay/custo 0) cobre framing/replay, não resposta autenticada; aceito como relatado, não reexecutado.

## 7. Veredito

Nenhum **bloqueador novo** de host/transporte encontrado: a state machine de entrega resiste a dupla falha de persistência, a incerteza não reenvia, o descritor corrompido/ausente não vira Pi e o bilhete pendente avisa sem reivindicar. Recomendo para o fechamento: corrigir N1 (texto/comentário do export — a implementação já está correta), N4 (doc do `init`/native-history/contagem), e, em rodada fora do congelamento Claude, N2 (`pinnedExtensions`) — N3 fica como melhoria opcional de desempenho. A validação autenticada da fase 4 continua sendo do usuário e é o único caminho para confirmar `sessionId`/correlação reais.
