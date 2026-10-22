# Revisão final read-only — Mesa + Claude Code (snapshot C2)

**Papel/método:** revisão independente estática, somente leitura. Não editei nada; não rodei gate/Bend/build/unit/smoke/Electron, não autentiquei, não iniciei inferência nem CLI. `node --check` (sintaxe, sem executar) nos 9 arquivos C2 + `slash.mjs` → todos OK. Nada de `.runtime`, `.credentials`, pastas pessoais ou cursos. Nada aqui alega Claude funcionando de verdade.

## Snapshot congelado conferido (sha256 12)

| Arquivo | sha256 (12) |
|---|---|
| `desk/src/state.mjs` | `fea3f12fb617` |
| `desk/src/chat.mjs` | `fea026d737d1` |
| `desk/src/queue.mjs` | `e3ab61445fdb` |
| `desk/src/main.mjs` | `6f404b193f43` |
| `desk/src/review.mjs` | `84def4712e0d` |
| `desk/src/slash.mjs` | `33edc7b091f9` |
| `desk/index.html` | `f955abc84162` |
| `desk/tests/claude-ui-smoke.mjs` | `66c7918a097a` |
| `desk/tests/fixtures/claude-sdk-fake.mjs` | `8f03c4cf45e5` |
| `desk/agents/claude-adapter.cjs` (reconferência) | `6fcd8d6984c1` |
| `desk/agents/service.cjs` (reconferência) | `59027e460c40` |

## Veredito

**Nenhum bloqueador novo encontrado** nos arquivos congelados C2 nem nos guardas de host reconferidos. As resoluções pedidas (#1 smoke, #2 rótulo, #3 `detectedClaude`, #6 toast) estão de fato no snapshot, com exemplo concreto abaixo. Os pontos restantes são cosméticos, de mensagem de erro em borda, ou lacunas de prova — nenhum muda comportamento de segurança da fila/entrega. O que ainda falta é execução: **root roda smoke/full unit agora**; aceito os relatos "524 unit + Pi regressions + recovery 501" como relatados, não reexecutados.

## Reconferências pedidas (com linhas)

**#1 Smoke.** Estaticamente o arquivo fecha com o comportamento atual:
- marcadores da fixture (`[claude:image]` → `Recebi N bloco(s)`; permissões com `Read`, ferramenta permitida) — `fixtures/claude-sdk-fake.mjs:260-281` vs esperas `claude-ui-smoke.mjs:157,161,177-188`;
- dica ociosa `/⏎ envia/` e ocupada `/enfileira/` sem `interrompe` — `state.mjs:315-324` vs smoke `:139-141,232-234`;
- export `## Claude` — `agents/history.cjs:250-265` vs smoke `:290-291`;
- permissão com `Read` e diálogo real (antes `Bash` era negado antes do pedido) — `adapter:1424-1426` + `_canUseTool` 1452-1475; smoke 4a/4b exige `concedida`/`negada` (só saem se a resposta do diálogo resolver a promessa — prova real do caminho);
- "zero Pi" por trap e "CLI do Claude não executada" com factory injetada — `connect()` pula detecção quando `_injected` (`adapter:416,478`), coerente com smoke `:259`; cenário 7 (factory vazia) exercita o probe real via trap e espera `pareamento` (`claude-environment.cjs:231-235`, mensagem contém "pareamento").

**#2 Rótulo.** `paintLive` usa `S.agentLabel` (`chat.mjs:590`); `applyEngineFacts` mantém o rótulo do motor offline (`state.mjs:74`); `updateSettings` idem (`:348`). Sem "Pi está pensando" em conversa Claude.

**#3 `detectedClaude` por veracidade.** Boot `main.mjs:513` e save `:477`: `data.engine==='claude'?!!data.detectedClaude:!!data.detectedPi`. Host devolve `''` quando não há binário (`main.cjs:212-215`), e o smoke 7/8 confere "não conecta, não toasta, CLI nem executa".

**#6 Toast duplicado.** `holdQueue` só toasta na transição (`queue.mjs:27-35`, `!wasHeld`), cobrindo `desk_error` + `agent_settled` de falha.

**Guardas de fila/identidade/caps (frontend):** `mayAdvanceQueue` real no flush (`state.mjs:42`, `queue.mjs:268-274`); `force` do "Enviar agora" limpa cancelamento e tenta 1× sem auto-retry (`queue.mjs:120-133`); incerteza não repete (`queue-retry.mjs:12-14` + `core/pending.bend:87-97`); `desk-held`/`desk-failed` seguram (`queue.mjs:366-379`); persistência travada na conversa dona (`:76`) e continuação do envio não muta a fila após troca de sessão (`:287,295`); bolha id-aware stream+final (`chat.mjs:621-627,640-650`); diálogo vencido fecha sem responder pelo `_requestId` (`:720-733,849-857`); filtro por `conversationId` (`:618`); cache offline no boot/troca (`state.mjs:469-473`, `main.mjs:267,276`).

## Reconferência dos relatórios

- r1 #2/#3/#6 e r2 frontend: confirmados no snapshot.
- r2 host: N1 ajustado (comentário `native-history.cjs:1-3` e `STATUS…md` "offset após filtro interno do SDK"), N4 ajustado (`CLAUDE-TRANSPORT…md:121` com `executable`, `§9` cita `native-history`); N2 `pinnedExtensions` **continua aberto e registrado** (`STATUS…:50`) — não expandi, fora do escopo; N3 (escrita O(descritor)) segue como resíduo de desempenho registrado (`STATUS…:48`).
- Correções do root reconferidas: `MessageQueue` `return await` (`adapter:174`); correlação por `user_message_uuid`/replay e supressão de `message_start` final (`adapter:1145-1156,1274-1301`); alias `caps`+`capabilities` (`service.cjs:9`); cache recente preservado com aviso de truncamento (`service.cjs:46`, `adapter:673-687`); teto 5000/12 MiB (`conversations.cjs:51,59,353-357`); slash gated (`slash.mjs:128,153`).

## Achados menores (não bloqueadores, com linha/impacto)

1. **Cosmético — placeholder "Conecte ao Pi"** em `state.mjs:545` (`switchCourse`). No Claude o campo está escondido (caps), então não aparece; sem ação nesta rodada.
2. **Cosmético — `desk-stop` repete o aviso** (`queue.mjs:372-379`): se a fila já estava `held`, um segundo Esc toasta de novo. `holdQueue` já deduplica; alinhar ali seria 1 linha.
3. **Borda — mensagem enganosa de descritor corrompido**: `prepareClaude` lança "Conversa Claude não pertence a esta matéria." (`main.cjs:229`) mesmo quando `readClaudeConversation` devolve `null` por corrupção. A degradação do init (r1 #7) está correta e o arquivo é preservado; só o texto do erro confunde "corrompido" com "de outra matéria".
4. **Prova — lacunas do smoke** (qualidade): os roteiros `[claude:error]` e `[claude:multi]` existem na fixture mas não são exercitados no smoke; o hold de erro UI é coberto só pelo caminho sintético `{sent:false,retryable:false}` (5c), não por `agent_settled{isError}`/`desk_error` reais. A "paginação" no smoke ganha `offset>0` da segunda chamada-sonda (encerramento), não de uma segunda página cheia — a prova de paginação de verdade é `claude-host-recovery.mjs:44-54` (501 linhas), relatada como verde pelo root. Não são bloqueadores; são pedaços de evidência a citar com precisão no aceite.
5. **Latente/doc — `nativeSessionId` mutável na API** (`conversations.cjs:302-304`; teste `conversations.test.mjs:340-341` diz "o adaptador pode registrar o id devolvido"). Nenhum chamador de produção atualiza o ID; a divergência é estrita (`adapter:1127-1143`) e o ID precriado não muda em `nativeEstablished`. Imutabilidade vale na prática; a brecha é só do contrato/teste.

## Limites

Não reexecutei smoke Electron, unit completo, Bend, Electron de sessão nem recovery (proibido/custoso); não fiz probe autenticado nem inferência — a fase 4 real continua sendo do usuário. Se o root rodar smoke/full unit e o snapshot não mudar (hashes acima), os relatos anteriores seguem válidos; qualquer edição nesses arquivos reabre a reconferência dos itens #1/#2/#3/#6.
