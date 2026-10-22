# Auditoria de ciclo de vida Mesa ↔ T3 Code (rodada `lifecycle-research-r1`)

5 de outubro de 2026. Auditoria **somente leitura** do código da Mesa, comparada ao
checkout público do T3 Code em `/tmp/mesa-t3code-research-20261005`, commit
`1604ccc9d79f5270fb8e14d60664184bf142c4cb`. Nenhuma alteração de implementação,
aplicativo instalado, login, inferência autenticada, commit, push ou release.
Os testes de reprodução usam somente SDK fake, dados sintéticos e diretórios
temporários (fora do repositório). Nenhum código do T3 foi copiado; os caminhos
abaixo são referência, não atribuição.

Snapshot auditado (o pai/agentes editaram arquivos durante a auditoria; estes
hashes identificam a revisão exata das conclusões):

| Arquivo | sha256 |
| --- | --- |
| `desk/agents/claude-adapter.cjs` (v `0.3.0-experimental`) | `5fed117e…70cf9b` |
| `desk/agents/conversations.cjs` | `c1e3b8e4…d39ae2` |
| `desk/agents/descriptor-cache.cjs` | `ce26e383…f92e323` |
| `desk/agents/native-history.cjs` | `f855a45c…1f4734` |
| `desk/agents/service.cjs` | `633c1f46…b5b9b0` |
| `desk/main.cjs` | `9ccd9237…cb575f5` |
| `core/agentcaps.bend` | `543770ce…fbe443` |
| `core/agentdelivery.bend` | `cd93d85a…25d7e0` |
| `desk/tests/claude-adapter.test.mjs` | `504e8bf2…5e01ac` |

Nesta revisão, `node --test` focado (adaptador, conversas, serviço, núcleo,
cache, histórico nativo) passou **82/82**; os testes de limite de uso e de
`AskUserQuestion` do agente de transporte já estavam presentes e verdes.

Observação de concorrência: o agente de transporte continuou editando
`desk/agents/claude-adapter.cjs` durante a redação (12:10). O hash auditado é
`5fed117e…`; o último hash observado ao encerrar é `09c66681…`, ainda com os
pontos L1 (linha 1656), L2 (linha 1282) e L3 (sem `blocking_limit`) presentes.
Se o hash atual for outro, reexecutar as reproduções antes de considerar os
achados resolvidos.

## Resumo executivo (priorizado)

O agente de transporte já implementou, nesta rodada: `rate_limit_event` de
primeiro nível com janelas/overage/reset, `AskUserQuestion` estruturada com
validação/TTL/abort, códigos canônicos de erro de assistente. Nada disso é
recomendado de novo abaixo. O que **falta** e bloqueia a etapa autenticada:

| # | Prioridade | Achado | Impacto no agente de estudo restrito |
| --- | --- | --- | --- |
| L1 | **P0** | Resultado concluído **sem `user_message_uuid`** vira `uncertain` e trava a conversa (`_handleResult`, linha 1656) | Se o CLI 2.1.246 não ecoar o uuid no `result`, **todo turno bem-sucedido** pede "comece outra conversa" |
| L2 | **P0** | Cancelamento do usuário → CLI sai sem `result` → `uncertain` persistido e conversa travada (`_finishQuery`, linha 1282) | Botão Parar deixa a conversa inutilizável |
| L3 | **P0** | `terminal_reason: "blocking_limit"` com envelope `success` é liquidado em silêncio (`_handleResult`) | Usuário vê turno "concluído" sem resposta quando a assinatura bloqueia |
| L4 | P1 | `system/api_retry` perde `attempt`/`max_retries`/`error_status`; 429/529 não classificado (linha 1419) | Espera longa sem explicação; limite confundido com erro genérico |
| L5 | P2 | `system/model_refusal_fallback` ignorado; `retracted_message_uuids` do SDK 0.3.246 não chega ao host | Texto parcial recusado pode ficar ao lado da resposta do fallback |
| L6 | P3 | `resume_return` (dialog de compactação na retomada) não declarado em `onUserDialog`/`supportedDialogKinds` | Retomada sempre mantém histórico inteiro; sem oferta de compactar |
| L7 | P3 | Seleção de modelo/esforço persistida no descritor, mas o adaptador ainda não consome `model`/`effort` nem troca de consulta | Controle aparece e não muda o modelo; troca precisa fechar/reabrir com `resume` |

O que **não** deve ser portado agora (sem ferramentas de fundo): turnos de
despertar/`wake`, frames segurados por eco, `command_lifecycle`, subagentes,
steer, fork/`resumeSessionAt`, `interrupt_cancel_queued`. As referências estão
no fim para quando essas capacidades entrarem.

---

## L1 (P0) — Correlação de término sem eco no `result`

**Estado atual (Mesa).** `_handleResult` (`desk/agents/claude-adapter.cjs:1631-1663`)
só grava `settled` quando `evidence === 'match'` (eco `user_message_uuid` /
`user_message_uuids` ou replay). Sem eco, mas com aceite comprovado:

```js
// linha 1656
const settled = evidence === 'match' && turn.acceptResolved && !turn.degraded;
await this._enqueue(turn, () => this._finalizeTurn(turn, settled ? 'settled' : 'uncertain', ...));
```

**Evidência do T3.** Em 91 frames `result` reais gravados nas fixtures do commit
(`apps/server/src/orchestration-v2/testkit/fixtures/**/claude_transcript.ndjson`),
**77 não têm `user_message_uuid`** (só 14 têm). O T3 não usa
`--replay-user-messages`; ele trata o caso assim
(`ClaudeAdapterV2.ts:2428-2440`):

```ts
function isClaudeResultForOtherTurn(input): boolean {
  const echoed = claudeEchoedPromptUuids(input.message);
  if (echoed.length > 0) return !echoed.includes(input.promptUuid);
  return input.promptEchoMode !== "unknown" &&
    input.message.origin !== undefined && input.message.origin.kind !== "human";
}
```

Ou seja: sem eco e sem prova de outro turno, o resultado **é** do turno pendente
em consulta de turno único (comentário em `ClaudeAdapterV2.ts:2424-2427`).

**Evidência do SDK pinado.** `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`:
`user_message_uuid` no `SDKResultSuccess` (4695) e `SDKResultError` (4673) é
opcional; a doc diz que ele falta em turnos sintéticos/meta, sem uuid de cliente
e em produtores antigos. O primeiro `stream_event` do turno carrega
`user_message_uuid` (4522-4530) — que a Mesa já lê para aceite — mas o término
continua dependendo do `result`.

**Reprodução (confirmada na revisão 5fed).** `repro-e.mjs` (pasta temporária
`…/T/opencode/mesa-t3-audit/repro-e.mjs`): replay de aceite + `result` success
sem uuid:

```
E persisted: ["transmitting","accepted","uncertain"]
E turn_end: {"isError":false,"uncertain":true}
```

**Correção mínima recomendada (adapter, agente de transporte).**
1. Guardar no turno se alguma evidência estrangeira já foi vista
   (`turn.foreignSeen`) — já existe `foreignWarned`; basta também marcar em
   `mismatch`.
2. Em `_handleResult`: `mismatch` → estrangeiro (como hoje); `match` → settled;
   `none` → se `!turn.foreignSeen` **e** (`turn.acceptResolved` ou
   `turn.taken`), tratar como o resultado deste turno (settled/erro conforme o
   envelope); senão, continuar ignorando.
3. Rejeitar/ignorar `result` com `origin.kind` presente e diferente de `human`
   quando não houver eco — é o mesmo `isClaudeResultForOtherTurn` do T3.
4. Opcional (endurecimento): guardar `turn.zeroTurn`/`num_turns === 0` para
   não liquidar com lixo de ciclo de vida (T3 `ClaudeAdapterV2.ts:6252-6282`).

**Testes que faltam.**
- `result` success sem uuid depois do replay → `settled`, `turn_end.uncertain === false`, próximo envio aceito.
- `result` com `origin:{kind:'task-notification'}` sem uuid durante turno → ignorado sem warning fatal, turno continua.
- `result` com `num_turns: 0` (debris) → não liquida turno normal.
- `result` sem uuid **antes** de qualquer aceite/entrega → continua ignorado (não regride a recusa).
- Resultado com `user_message_uuid` estrangeiro → `CLAUDE_RESULT_FOREIGN` (já coberto).

---

## L2 (P0) — Cancelar trava a conversa (`uncertain` persistido)

**Estado atual (Mesa).** `cancel()` (749-760) só chama `interrupt()`; `busy`
continua até `result`/fim de consulta/`close`. No fim de consulta
(`_finishQuery`, 1272-1289):

```js
// linha 1282
const outcome = turn.taken || turn.acceptResolved || turn.phase !== 'transmitting' ? 'uncertain' : 'refused';
```

Como o aceite já foi comprovado, qualquer cancelamento vira `uncertain`
persistido. `main.cjs:899` recusa o próximo envio ("Abra outra conversa") e
`service.cjs:55` (`canBegin(busy, uncertain)`) bloqueia a fila.

**Evidência do T3.** Duas gravações reais mostram o CLI **encerrando sem
`result` após `query.interrupt`**:
- `fixtures/turn_interrupt/claude_transcript.ndjson`: `query.interrupt` →
  `runtime_exit` (sem `result`); a projeção esperada é um único turno com status
  `interrupted` (`turn_interrupt`/`claude_output.ts`).
- `fixtures/turn_interrupt_mid_tool`: idem; `claude_output.ts` exige
  `runStatuses: ["interrupted"]`, `providerTurns[0].status === "interrupted"` e
  `providerThreads[0].status === "idle"` — a conversa continua utilizável.

O T3 trata o cancelamento como **fim de turno**, não como dúvida de entrega
(`interruptTurn`, `ClaudeAdapterV2.ts:7291-7364`: marca o turno como
interrompido, `close()` na consulta e espera de até 10 s). O próximo turno reabre
com `resume` na mesma sessão (`fixtures/turn_interrupt_restart`:
`query.open:2` com `resume`, sem `sessionId`).

**Reprodução (confirmada na revisão 5fed).** `repro-b.mjs`: aceite + `cancel()`
+ `query.end()` (como a fixture real):

```
B persisted statuses: ["transmitting","accepted","uncertain"]
B events: [{type:"agent_settled","cancelled":true,"isError":true,"uncertain":true}]
B next prompt refused: "A entrega anterior está incerta; comece outra conversa." (notSent:true)
```

O fake local `tests/fixtures/claude-sdk-fake.mjs:305-307` **emite `result` após
o interrupt**, então o smoke atual não pega o comportamento real (o CLI grava
`runtime_exit` sem `result`).

**Correção mínima recomendada (adapter; decisão de contrato do pai).** Na
consulta, a entrega já foi comprovada (`acceptResolved`); o cancelamento é um
desfecho de **turno**, não de entrega. Opção A (mínima, sem schema novo):
- `_finishQuery`/`close`: se `turn.acceptResolved && this._cancelRequested`,
  finalizar com `outcome: 'settled'` e `{cancelled: true, isError: true,
  uncertain: false}` (persistir `settled`), liberando a fila. Mantém
  `uncertain` só para cancelamento **antes** do aceite e para quedas sem
  evidência.
- Opção B (mais explícita): novo status terminal `cancelled` no descritor +
  leis/provas (`DELIVERY_STATUSES`, `validDescriptor`,
  `recoverClaudeConversation`, `agentdelivery`). Custo maior; só vale se o pai
  quiser diferenciar "entregue e cancelado" de "entregue e concluído" no disco.

O núcleo já dá o veredito: `agentdelivery.bend:27-36`
(`outcome(accepted=true, …) == Accepted`) e a lei `agentdelivery_aceite_domina`
(`core/laws/agentdelivery.bend:21-25`) — o host é que ignora `accepted` neste
caminho. Se a opção A for adotada, nenhuma lei nova é necessária; se for a B,
`sameNativeIdentity`/`outcome` não mudam, mas `recover`/validação do descritor
precisam de lei/prova nova.

**Testes que faltam.**
- Aceite → `cancel()` → `query.end()` sem `result`: `turn_end.cancelled === true`,
  `uncertain === false`, `busy === false`, próximo envio permitido, mesma sessão
  nativa reutilizada com `resume`.
- Cancelar **antes** do aceite e consulta termina: continua `refused`
  (comprovadamente nada foi processado) — não regride.
- Cancelar, CLI emite `result` atrasado com UUID: nada duplica; desfecho único
  (já coberto parcialmente).
- Interrupt ignorado pelo CLI + `close()` explícito após `cancel()`: sem pendurar
  (o T3 fecha a consulta; avaliar fechar após interrupt).
- Smoke atualizado com a sequência real (`query.interrupt` → `runtime_exit`
  sem `result`) em vez do fake que sempre emite `result`.

---

## L3 (P0) — `blocking_limit` liquida em silêncio

**Estado atual (Mesa).** `_handleResult` calcula `isError = message.is_error === true || message.subtype !== 'success'`
(1647). Um `result` de limite usa envelope `subtype:"success"`, `is_error:false`,
`terminal_reason:"blocking_limit"` → **nenhum erro/aviso** e `settled`.
Confirmado em `repro-c.mjs` (C1):

```
C1 terminal_reason=blocking_limit -> errors: [] warnings: [] delivery: ["transmitting","accepted","settled"]
```

O SDK pinado declara `'blocking_limit'` em `TerminalReason` (`sdk.d.ts:8147`).

**Evidência do T3.** `providerFailureFromResult` (`ClaudeAdapterV2.ts:2451-2488`)
trata `terminal_reason === "blocking_limit"` (e `api_error_status === 429` /
evidência de janela rejeitada) como `class: "usage_limit"`, com mensagem
"Claude usage limit reached. Send the message again once the limit resets."
Os testes `ClaudeAdapterV2.test.ts:2798-2850` cobrem janela rejeitada
recuperada × não recuperada (`usage_limit` vs `provider_error`). O T3 ainda
acumula `rejectedRateLimitTypes` por turno (5438-5532) para classificar o
`result` mesmo sem `terminal_reason`.

**Correção mínima recomendada (adapter).**
- Classificar o `result` com: `terminal_reason === 'blocking_limit'`,
  `api_error_status === 429`, ou `turn.announcedRateLimits` com janela
  rejeitada não liberada (`allowed` posterior) → emitir `error`/`warning`
  `CLAUDE_RATE_LIMITED` (com `rateLimit` do último evento, quando houver)
  **sem** transformar em `uncertain`; a entrega continua `settled`.
- `api_error_status === 529` → `CLAUDE_OVERLOADED`; `terminal_reason` de
  contexto (`prompt_too_long`, `image_error`, `budget_exhausted`, etc.) pode
  reaproveitar `ASSISTANT_ERROR_CODES`/texto específico em vez de `resultText`
  cru. Não atualizar SDK.
- Manter `detail.terminalReason` (já existe, linha 1653) e acrescentar
  `detail.category` amigável.

**Testes que faltam.**
- `blocking_limit` sem aceite de janela anterior → erro `CLAUDE_RATE_LIMITED`,
  `uncertain === false`, próximo envio permitido.
- Janela `rejected` → `allowed` → `result api_error` → **não** rotular limite
  (equivalente ao caso `recovered:true` do T3).
- `api_error_status: 429` com `subtype:"success"`, `is_error:true` → limite.
- `529` → sobrecarga; erro do assistant `rate_limit` já vira
  `CLAUDE_RATE_LIMITED` (teste 1426 do arquivo atual do adaptador).

---

## L4 (P1) — `api_retry` sem progresso e sem 429/529

**Estado atual.** `_handleSystem` (1419-1421) emite
`CLAUDE_API_RETRY` com texto fixo. `repro-c.mjs` (C2) mostra que
`attempt`/`max_retries`/`retry_delay_ms`/`error_status` são descartados
(`sdk.d.ts` `SDKAPIRetryMessage` os fornece).

**T3.** `providerFailureFromApiRetry` (`ClaudeAdapterV2.ts:2490-2506`) classifica
`error_status === 429` como `usage_limit`, `null` como `transport_error` e o
resto `provider_error`, `retryable: true`; o item de retry guarda
`attempt/maxAttempts/retryDelayMs` e é resolvido na retomada do assistente
(teste `ClaudeAdapterV2.test.ts:3395-3466`). Para a Mesa, o mínimo útil é:
`warning` com `detail:{attempt,maxRetries,retryDelayMs,errorStatus}` e código
distinto (`CLAUDE_RATE_LIMITED` quando 429, `CLAUDE_OVERLOADED` quando 529,
senão `CLAUDE_API_RETRY`), porque o usuário fica esperando sem feedback.

**Testes que faltam.** retry 429/529 com detail; dois `api_retry` seguidos não
duplicam o aviso do mesmo attempt; resultado após retry continua `settled`.

---

## L5 (P2) — `model_refusal_fallback` (SDK 0.3.246) ignorado

**Estado atual.** `_handleSystem` trata só `model_refusal_no_fallback`
(1427-1428). O SDK pinado também declara `SDKModelRefusalFallbackMessage`
(`sdk.d.ts`, `content`, `direction`, `retracted_message_uuids`,
`refused_user_message_uuid`). `repro-d.mjs`:

```
D deltas: "PARTIAL FROM REFUSED ATTEMPT"
D warnings: []
D message_end texts: ["ANSWER FROM FALLBACK MODEL"]
D retraction signal event? false
```

O T3 emite o aviso `content` como item de sistema
(`ClaudeAdapterV2.ts:5711-5744`; teste `ClaudeAdapterV2.test.ts:2956-3013`) e
**não** trata `retracted_message_uuids` neste commit — a Mesa pinada tem o
campo, então o port mínimo é: emitir `warning`/notice com `message.content` e
propagar `detail.retractedMessageUuids` para o host evictar o parcial (ou, se
o host ainda não souber evictar, ao menos avisar que o texto anterior foi
retratado). Sem isso, o usuário pode ver duas respostas parciais concatenadas.

**Testes que faltam.** fallback com `direction:"retry"` → aviso + lista de
retração; `direction:"revert"`; `scope:"local"` (não troca o modelo da sessão);
sem `content` → não emite aviso vazio; turno continua e termina `settled`.

---

## L6 (P3) — Dialog de retomada (`resume_return`) não declarado

**Estado atual.** `_buildOptions` (1215-1231) não passa `onUserDialog` nem
`supportedDialogKinds`. O SDK pinado suporta os dois (`sdk.d.ts:1359-1367`,
`1607-1629`, `4094-4105`) e **falha fechado**: sem declaração, o fluxo usa o
comportamento sem diálogo (na retomada, mantém o histórico inteiro). T3:
`onUserDialog` em `ClaudeAdapterV2.ts:6803-6876`, com as opções
"Compact and continue" / "Keep full history" / "Don't ask again" e
`supportedDialogKinds:["resume_return"]` (7010); teste
`ClaudeAdapterV2.test.ts:1184-1398` cobre responder, cancelar por `signal`
(já abortado) e mapear `compact`/`continue`/`never`.

**Porta mínima (host + adapter).** O adapter sozinho não decide UI: precisa de
um pedido tipo pergunta (reaproveitar o caminho `method:'question'` com
`entry.method === 'dialog'` ou equivalente) e da resposta do host. Se o pai
decidir postergar, registrar explicitamente que a retomada não oferece
compactação e que o teto de contexto será atingido antes.

**Testes que faltam.** resposta "Compact and continue" → `{behavior:'completed',
result:'compact'}`; "Keep full history" → `'continue'`; "Don't ask again" →
`'never'`; `signal` abortado → `{behavior:'cancelled'}`; payload sem números →
rótulo neutro; pergunta vencida/TTL; diálogo durante turno com outra pergunta
pendente.

## L7 (P3) — Tempo de vida da seleção de modelo/esforço

**Estado atual.** O descritor já persiste `model`/`effort`
(`conversations.cjs:189,254-274,332-336`) e a UI consulta
`claudeControlCaps(catalogReady, effortSupported)` (`core/agentcaps.bend:75-83`,
com leis novas em `core/laws/agentcaps.bend:29-39`). O adaptador ainda não
recebe nem aplica `model`/`effort` (`_buildOptions` 1215-1242) — o agente de
controles está implementando a validação de catálogo; o adapter é do agente de
transporte.

**T3 (referência de tempo de vida).** `openQuery`
(`ClaudeAdapterV2.ts:6909-7011`) reutiliza a consulta só se
`selectionKey === compiledSelection.queryIdentity` e a política bater; com
seleção nova, fecha o processo e reabre com **`resume`** (`shouldResume` em
6981-6990; nunca `sessionId` + `resume` juntos). `model`/`effort` entram em
`makeClaudeQueryOptions` (863-877; tipos pinados: `sdk.d.ts:1735,1784`).
Seleção nova com trabalho de fundo rodando é recusada
(`ClaudeAdapterV2.ts:6956-6963`; teste `7610-7773`) — na Mesa não há trabalho
de fundo, então basta a troca entre turnos.

**Testes que faltam (quando os controles entrarem).**
- Dois envios na mesma conversa com modelos diferentes → 2 consultas; a segunda
  com `{resume, model}` e sem `sessionId`; `nativeSessionId` inalterado.
- `effort` só é enviado quando o catálogo permitir; ausente não muda a consulta.
- Troca pedida com turno/permissão/incerteza pendente → recusada
  (`canChangeControls`); sem novo processo.
- `init` de consulta nova atualiza o `model` do descritor; falha de persistência
  não derruba o turno.
- Fila espera o turno terminar e a troca só vale para o próximo envio.

---

## O que o agente de transporte já entregou (verificado nesta auditoria)

Não repetir; manter cobertura.

- **Limites**: `_handleRateLimit` (1518-1550) lê `rate_limit_event` de primeiro
  nível e o subtipo `system` legado; `allowed` libera; `rejected` sem overage
  pausa sem encerrar; `allowed_warning` avisa; overage em uso continua;
  dedupe por `kind:tipo:reset`; payload com janela/reset/wait/utilization.
  Testes `claude-adapter.test.mjs:1161-1313` (passaram).
- **Perguntas**: `normalizeUserQuestions`/`validateQuestionAnswers`
  (450-510), `_requestUserInput` (1785-1813), `respond({id, answers})`
  (777-791), TTL (`_expirePermission` 963-974), abort do SDK com
  `permission_cancelled.reason` (1713-1757). `AskUserQuestion` entrou em
  `SDK_TOOLS` e saiu de `DISALLOWED_TOOLS` (94-98); o hook PreToolUse deixa o
  `canUseTool` decidir (1843). Testes `:799-1034` (passaram).
- **Erros de assistente**: `ASSISTANT_ERROR_CODES` (111-122) + evento `error`
  canônico; teste novo `:1426`.
- **Recuperação/entrega/identidade**: sem regressão — `nativeEstablished`,
  `sameNativeIdentity`, `recoverClaudeConversation`, export 501 linhas e cache
  seguem cobertos (82/82 no foco).

## Referências T3 que ficam registradas (não portar agora)

- Turnos de despertar e frames segurados por eco: `ClaudeAdapterV2.ts:6459-6576`,
  `4901`, fixtures `claude_background_*`.
- `command_lifecycle`/`promptEchoMode`: `ClaudeAdapterV2.ts:2405-2422,6466-6510`.
- Subagentes/fork/steer: `ClaudeAdapterV2.ts:1626,6878-6907,7379`; fixtures
  `subagent`, `thread_fork_native*`, `message_steering`.
- Interface de interrupt com recibo: `sdk.d.ts:2425,4872-4874` — a Mesa é
  turno único; `still_queued` deve ser vazio. Opcional: logar se vier não vazio.
- Harness de replay NDJSON do T3 (`ClaudeAdapterV2.testkit.ts` + fixtures): não
  portar o mecanismo; o harness imperativo da Mesa (`claude-fixtures.mjs`)
  é suficiente. Portar **cenários**, listados em cada achado.

## Lacunas de teste por área (resumo acionável)

| Área | Cenário faltante | Onde referenciar no T3 |
| --- | --- | --- |
| Correlação | `result` sem eco após aceite liquida | `ClaudeAdapterV2.ts:2428-2440`; fixtures `simple`, `multi_turn` (77/91 results reais sem uuid) |
| Correlação | `origin` não-humano sem eco ignorado | `ClaudeAdapterV2.ts:2442-2449`; teste `5416` |
| Cancelamento | interrupt → runtime_exit sem result | fixtures `turn_interrupt`, `turn_interrupt_mid_tool`; teste `5608` |
| Cancelamento | reabertura com `resume` após interrupção | fixture `turn_interrupt_restart` |
| Limites | `blocking_limit`/429/529 | testes `2641-2751`, `2798-2850` |
| Limites | retry 429 com progresso | teste `3395-3466` |
| Recusa | fallback de segurança + retração | teste `2956-3013`; `sdk.d.ts` `retracted_message_uuids` |
| Retomada | dialog `resume_return` (compactar/continuar/nunca) | teste `1184-1398` |
| Modelo | troca fecha e reabre com `resume` | testes `1870-1897`, `7610-7773` |
| Perguntas | lote de 2+ perguntas; pergunta + confirmação simultâneas | `ClaudeAdapterV2.ts:2832-2891` |

## Núcleo Bend

- L1/L2 não exigem lei nova se o host voltar a consumir `outcome(accepted=true)`
  e reservar `uncertain` para "pode não ter chegado". A lei
  `agentdelivery_aceite_domina` já cobre; o host é que não a segue em
  `_finishQuery`.
- Se o pai optar pelo status `cancelled` no descritor (opção B do L2), aí sim:
  `DELIVERY_STATUSES` (`conversations.cjs:51`), validação/recuperação,
  `desk/src/generated/agentdelivery.core.js` e leis/provas correspondentes.
- `canChangeControls` (`agentdelivery.bend:71-74`) já bloqueia troca com
  `uncertain` — corrigir L1/L2 também destrava modelo/esforço após cancelar.
- Sem tarefa de build/import para o agente de pesquisa nesta rodada; os
  artefatos continuam com o pai (`verify:bend` não foi executado aqui).

## Licença e atribuição

Nenhum código do T3 foi copiado nesta rodada — só leitura comparativa e
referências de comportamento. Se o agente de transporte adaptar alguma porção
literal (p. ex. a normalização de `claudeUserInputQuestions` ou a tabela
`CLAUDE_USAGE_LIMIT_WINDOWS`), preservar MIT © 2026 T3 Tools Inc. no documento
de atribuição sob responsabilidade do pai. APIs usadas são apenas as do SDK
pinado `0.3.246`/CLI `2.1.246`; nada de SDK mais novo foi assumido.

## Limites não resolvidos

- Não houve inferência autenticada: não se prova se o CLI 2.1.246 ecoa
  `user_message_uuid` no `result` da consulta por AsyncIterable. Por isso L1
  recomenda o fallback do T3 (seguro nas duas hipóteses), não apenas um teste
  de integração.
- As fixtures do T3 foram gravadas com CLI `2.1.111` e SDK `^0.3.276`; são
  evidência de comportamento, não garantia de paridade com o binário pinado.
  O que foi lido do SDK pinado está citado por linha.
- Os arquivos `desk/agents/*` e testes mudaram durante a auditoria (12:04-12:09);
  as conclusões valem para os hashes da tabela. Se o agente de transporte já
  corrigiu L1/L2/L3 depois deste snapshot, as reproduções correspondentes
  devem ser reexecutadas contra o novo hash.
- `repro-*.mjs` estão em
  `/private/var/folders/fm/lz1skly97bd4xw55p7hr9ytr0000gn/T/opencode/mesa-t3-audit/`
  e podem ser apagados; nada foi escrito dentro do repositório além deste
  relatório.
- `chat/`, `desk/pi.cjs` e o caminho Pi não foram lidos nem alterados nesta
  rodada; o comportamento do Pi permanece fora do escopo desta auditoria.
