# Revisão final (somente leitura) — integração Mesa ↔ Claude Code na rodada T3

5 de outubro de 2026. Rodada **final, somente leitura**, da integração experimental
integrada (segunda rodada inspirada no T3 Code). Nenhum arquivo de produto/teste foi
alterado nesta revisão; o único arquivo escrito é este parecer. `chat/` intocado.
Nenhum login, inferência autenticada, atualização de CLI/SDK, dependência, commit,
push ou release. Nenhum agente-filho foi delegado.

Referência pública do T3 Code inspecionada no checkout
`/tmp/mesa-t3code-research-20261005`, commit
`1604ccc9d79f5270fb8e14d60664184bf142c4cb` (implementação real, não só README).
SDK da Mesa conferido contra o pin instalado
`@anthropic-ai/claude-agent-sdk@0.3.246` (`desk/node_modules`, `sdk.d.ts` e
`sdk-tools.d.ts`).

Snapshot auditado (hashes sha256 truncados; se algum arquivo mudar, reexecutar as
reproduções antes de considerar o parecer válido):

| Arquivo | sha256 |
| --- | --- |
| `desk/agents/claude-adapter.cjs` | `e5effc3b…36e2a6` |
| `desk/agents/claude-turn-policy.cjs` | `7bbea22f…cf6a6c` |
| `desk/agents/claude-controls.cjs` | `2d8c1c55…1a8453` |
| `desk/agents/service.cjs` | `0c7a083e…2c646d` |
| `desk/agents/conversations.cjs` | `eac19495…da330e` |
| `desk/main.cjs` | `a40ed3e2…70ba0e` |
| `desk/src/state.mjs` | `a0ad732b…e0b9bc` |
| `desk/src/chat.mjs` | `11802c6a…3d6bbf` |
| `desk/src/claude-questions.mjs` | `0afbe191…5c1f78` |
| `core/agentdelivery.bend` | `cd93d85a…25d7e0` |
| `core/agentcaps.bend` | `543770ce…fbe443` |

## Veredito

**Nenhum bloqueador P0/P1 novo encontrado.** Os três P0 da auditoria anterior
(L1 resultado sem eco, L2 cancelamento aceito com saída da consulta, L3
`blocking_limit`) estão fechados **por comportamento**, com testes que passam. As
correções H1–H6 e da UI r2 conferem com o código. Não reivindiquei nenhum resultado
do pai: `npm test` completo, os quatro harnesses Electron, `verify:bend` e
`npm run check` **não foram executados por mim** e seguem pendentes da rodada do pai.

## O que eu executei (evidência)

Testes puros alvo (somente SDK/fixture sintéticos, diretórios temporários, sem
Electron, sem inferência), `node --test` direto — sem o portão `npm test`:

| Arquivo | Testes |
| --- | --- |
| `claude-adapter.test.mjs` | 57 |
| `claude-lifecycle-integration.test.mjs` | 20 |
| `claude-turn-policy.test.mjs` | 40 |
| `claude-native-controls.test.mjs` | 24 |
| `claude-controls.test.mjs` | 12 |
| `claude-questions.test.mjs` | 15 |
| `claude-environment.test.mjs` | 13 |
| `agent-core.test.mjs` | 4 |
| `agent-service.test.mjs` | 10 |
| `agent-history.test.mjs` | 12 |
| `native-history.test.mjs` | 2 |
| `conversations.test.mjs` | 13 |
| `descriptor-cache.test.mjs` | 1 |
| **Total** | **223/223 verdes** |

Duas sondas comportamentais próprias, com a fixture sintética, na pasta temporária
aprovada (`…/T/opencode/mesa-probe-1.cjs`; nada gravado no repositório):

1. **Evidência de limite entre turnos**: janela `five_hour` rejeitada no turno 1,
   `allowed` recebido no turno 2 (mesma consulta persistente) emitindo **uma**
   transição `CLAUDE_RATE_LIMIT_RESUMED` com `runId` do turno 2, `blocked:false`,
   busy preservado e nenhum `turn_end` prematuro; sequência persistida
   `transmitting,accepted,settled,transmitting,accepted,settled`.
2. **`close()` durante a persistência do aceite**: `send` resolveu
   `{accepted:true}` (persistência do aceite realmente concluída), o desfecho final
   ficou `turn_end {cancelled:true,uncertain:true,isError:true}` com eventos
   `transmitting,accepted,uncertain`, busy liberado — conservador e sem repetição.

Também rodei `node --check` em `claude-adapter.cjs`, `service.cjs`,
`claude-controls.cjs`, `claude-turn-policy.cjs`, `conversations.cjs` e `main.cjs`
(sintaxe OK). Não rodei `verify:bend`: o parecer usa os artefatos gerados
(`agentcaps.core.js`/`agentdelivery.core.js`) já carregados e exercitados pelos
testes verdes.

Os dois testes de ancoragem por regex no fonte
(`claude-questions.test.mjs:452-465` e `:467-485`) **não** foram contados como
confiança comportamental; as demais asserções dos 223 testes exercitam retorno de
função e fluxo.

## Invariantes pedidos — como confirmei

**L1 — resultado sem eco.** `claude-turn-policy.cjs:380-404` só liquida sem eco
quando turno único, aceite persistido, não degradado, sem evidência estrangeira,
sem origem não-humana e `num_turns > 0`; `claude-adapter.cjs:2363-2373` aplica o
veredito. `claude-lifecycle-integration.test.mjs:17-22` (no-echo settle exato)
verde; a fixture Electron `claude-sdk-fake.mjs:347-349` zera
`user_message_uuid` no marcador `no-echo`, e `claude-lifecycle-ui.mjs:20-21`
verifica o `settled` (harness não executado por mim).

**L2 — cancelamento aceito com saída da consulta.**
`claude-turn-policy.cjs:429-437` exige aceite + cancelamento explícito +
`endKind:'query'`; `claude-adapter.cjs:1462-1479` (close) e `:1887-1911`
(fim nativo) separam queda conservadora de cancelamento liquidado.
`claude-lifecycle-integration.test.mjs:38-53` verde (interrupt normal e falha de
iterador); `:54-61` mantém `close()` incerto.

**L3 — falha nativa `blocking_limit`/retry/fallback.**
`claude-turn-policy.cjs:133-138` e `:499-507` classificam `blocking_limit` e a
janela rejeitada; `classifyApiRetry` (`:586-622`) preserva
attempt/max/atraso/status e nunca encerra turno; `classifyRefusalNotice`
(`:631-677`) retorna retração limitada com evicção adiada.
`claude-lifecycle-integration.test.mjs:67-76` (blocking limit preserva o aceite,
`fatal:false`), `:167-193` (janela rejeitada × liberada) e `:285-295`
(retry dedupado) verdes.

**H1 — incerteza pegajosa.** Construção estrita `deliveryUncertain`
(`claude-adapter.cjs:626,698`), recusa antes de consulta/disco em
`send` (`:1216-1218`), `initializeControls` (`:831-833`), `setControls`
(via `_controlsGate`, `:927-941,1019-1042`); `service.cjs:30,46,69,104-106`;
`main.cjs:818` (pula catálogo), `:865` (settings), `:933` (prompt);
UI `state.mjs:56,349-356`. `claude-lifecycle-integration.test.mjs:80-121` verde.

**H2 — espera de campo oculto.** `helpers.mjs:68-70` (`sendEnabled`) espera o
estado real `!document.querySelector('#send').disabled` — não a presença/ocultação
do nó —, que é o gate correto para o composer. Correção restrita ao harness; não
reexecutei Electron. Os `waitForTimeout` remanescentes nos quatro harnesses são
de animação/ordenação de eco (ex.: `claude-lifecycle-ui.mjs:48`,
`claude-ui-smoke.mjs:258`), não substituem estados de envio.

**H3 — runner dos quatro harnesses.** `tests/run-claude-ui.mjs:4` encadeia
`claude-ui-smoke`, `claude-controls-ui`, `claude-lifecycle-ui`,
`claude-host-recovery`; `package.json` mapeia `test:claude-ui`. Não executado.

**H4 — poda do cache linear em UTF-8.** `conversations.cjs:363-377` conta bytes
de cada mensagem uma vez, do fim para o começo, e nunca corta
`delivery`/metadados. Teste "cache trimming keeps the newest complete
UTF-8/image suffix" verde (13 testes de conversas).

**H5 — união de esforço no host.** `main.cjs:8` importa
`EFFORT_LEVELS` de `claude-controls.cjs:38`; não há lista paralela no host
(`main.cjs:879`). `claude-controls.test.mjs`/`agent-core` verdes.

**H6 — política de caminhos dentro do lock de envio.**
`service.cjs:67-81` executa `initializeControls` e só então `setToolPolicy`,
dentro de `_sending=true`; `claude-adapter.cjs:801-810` recusa troca com turno,
permissão pendente ou busy. `agent-service.test.mjs:90-101` verde.

**UI r2.** `questionSubmitAction` (`claude-questions.mjs:172-177`) fecha o
Cancelar sem respostas e mantém o caminho exigente só para o Responder; chaves
`__proto__`/`constructor` viram propriedade própria via `defineProperty`
(`:120-122`); estado de limite por janela (`:244-262`); `fatal:false` só com o
booleano exato (`:308-310`); avisos de atividade sem mexer em busy/fila
(`:292-302`); multi-janela coberta por `limitNoticeState`. 15/15 verdes; o
fluxo Electron correspondente está em `claude-lifecycle-ui.mjs:22-50`
(não executado por mim).

**Raiz — cancelamento e avisos por conversa.**
`state.mjs:57` só limpa `S.turnCancelled` quando `data.session` é string de
conversa **diferente** (settings da mesma conversa preservam o veto — o
`pi-settings` do Claude não devolve `session`); `state.mjs:296-298` dispara
`desk-conversation-changed` também para conversa vazia; `chat.mjs:645-650`
zera faixa/toasts no evento; fila vetada por
`mayAdvanceQueue` (`state.mjs:42`, `queue.mjs:274`) e "Enviar agora" é o único
comando que zera o veto (`queue.mjs:120-133`), com o host recusando incerteza
(`main.cjs:933`). Erros nativos recuperáveis saem `fatal:false`
(`claude-adapter.cjs:2297-2302`), não desconectam nem liberam busy
(`chat.mjs:780-794`); `agent_settled` com `isError`/`uncertain` segura a fila
(`chat.mjs:734-756`); auth segue `fatal:true`.

## Achados

Nenhum P0/P1. Observações de baixa prioridade, todas com evidência estática e
potencial limitado; nenhuma exige correção para esta rodada:

- **O1 (P3) — timeout de controle não cancela a chamada nativa.**
  `claude-adapter.cjs:1090-1103` só corre um timer contra a promise; a chamada
  `query.setModel`/`query.applyFlagSettings` subjacente continua. O rollback
  (`:1123-1171`) supõe que o canal de controle do SDK aplica na ordem de envio
  (o que o transporte stdio do pin faz), e não existe leitura de volta do estado
  nativo. Mitigação já presente: rollback que falha bloqueia envios
  (`:1170-1201`) e o envio exige `_nativeSelection` igual ao desejado
  (`:1070-1075`). Os testes de timeout (`claude-native-controls.test.mjs:523-545`)
  provam o caminho do fake, não uma aplicação nativa atrasada real. Repro
  teórica: `setModel('opus')` que resolve depois do bound de 25 ms enquanto o
  rollback resolve antes. Risco residual, não bloqueador.

- **O2 (P3) — `close()`→`connect()` no MESMO adaptador deixa a promessa de
  inicialização de controles viva.** `claude-adapter.cjs:844-851` compartilha
  `_controlsInitPromise`; `close()` (`:1424-1480`) não a limpa, e operações
  nativas em voo continuam com a geração antiga. Inalcançável pelo app: cada
  troca de conversa constrói um `ClaudeAdapter` novo (`main.cjs:375-391`).
  Contrato interno apenas.

- **O3 (P3) — mapas auxiliares não zerados no `close()`.** Só
  `_rejectedWindows` é limpo (`claude-adapter.cjs:1452`); `_apiRetryNotices`
  (cap 128, `:2054-2058`), `_completed` (cap 256, `:2248-2257`) e
  `_foreignSessions` (limpo no reconnect, `:770`) têm teto explícito e não
  afetam o modelo um-adaptador-por-conversa.

- **O4 (P3, cosmético) — faixa de limite pode ficar ~1 s após o `RESUMED`.**
  `clearLimitBand` não limpa com `S.busy` (`chat.mjs:633-637`) e `paintLive`
  retorna cedo com `limitShown` (`:594`), voltando no tick de 1 s
  (`:586-588`). Autocorrige; nenhum estado de fila/busy envolvido.

- **O5 (P3) — uma mensagem única > 12 MiB descarta o sufixo inteiro do cache.**
  `conversations.cjs:363-377` para no primeiro item que estoura; como o envio
  permite até 28 MiB de imagens (`core/attachments.bend:78-85`), o descritor
  pode ficar sem cache após um envio grande. O descritor é cache de exibição; a
  sessão nativa é a origem e a exportação usa `readNativeHistory` quando
  `nativeEstablished` (`main.cjs:768-777`). Registrado como limite, não defeito.

## Limites conhecidos (não repetidos como bloqueadores)

Evicção de DOM do fallback adiada (SDK 0.3.246 só entrega
`retracted_message_uuids`); `resume_return`/compactação manual; steer; fork em
segundo plano; bilhete Conversa na conversa Claude; validação autenticada
pendente; paginação de `getSessionMessages` por offset comprovada só contra o
fake (sem CLI real); escrita do descritor inteiro em cada transição
(27–41 ms medidos); `desk.pinnedExtensions` descartado pelo schema
(pré-existente, rodada própria).

## T3: APIs e atribuição

Conferência de comportamento real (não README) no commit inspecionado:
`rate_limit_event` (`ClaudeAdapterV2.ts:5438-5520`, incluindo deleção de janela
em `allowed`/`warning` e dedupe por janela), predição de limite de uso
(`:6338-6345`), classificação de falha do result e correlação sem eco
(`:2428-2500`), `AskUserQuestion` (`:2839-2905`, `:6634-6700`), `setModel`
(`:669-672`). A Mesa implementa a mesma semântica com guardas extras, sem usar
catálogo/manifesto do T3 (que declara SDK mais novo). Todas as APIs usadas
existem no pin 0.3.246 (`sdk.d.ts:782` `getSessionMessages` com
limit/offset/dir; `:2425` `interrupt`; `:2459` `setModel`; `:2505`
`applyFlagSettings` com `effortLevel`; `:2514` `initializationResult`; `:2552`
`supportedModels`; `:4610` `SDKRateLimitEvent`; `:4689+` `SDKResultMessage`
com `user_message_uuid`/`terminal_reason`/`api_error_status`; `:3071`
`SDKAPIRetryMessage`; `:4450+` avisos de recusa). Nenhum uso de API
especulativa de SDK mais novo.

Nenhuma cópia literal de código do T3 foi identificada nos arquivos
inspecionados; há referências conceituais com atribuição MIT em
`claude-turn-policy.cjs:35-41` e `claude-controls.cjs:22-24`. O documento de
atribuição é do pai.

## Separando inspeção × execução

- **Executado por mim:** 223 testes puros alvo; 2 sondas comportamentais
  (limite entre turnos; close durante aceite); `node --check` em 6 arquivos.
- **Inspecionado por leitura (sem execução):** os quatro harnesses Electron e
  `run-claude-ui.mjs`; `claude-sdk-fake.mjs` e seus roteiros
  `retry/fallback/multiple-rate/context-error/blocking-limit/no-echo/interrupt-exit`;
  `helpers.mjs`/`sendEnabled`; fluxos de UI de perguntas/permissões/limites;
  `verify:bend`/`npm test`/`npm run check` (resultados do pai, reivindicados por
  ele).

**Conclusão:** sem bloqueadores novos; pronta para a rodada final do pai
(`npm test`, quatro harnesses, portão Bend) e, depois dela, para a etapa
autenticada já documentada.
