# Política de liquidação do turno Claude — rodada `lifecycle-policy-r1`

5 de outubro de 2026. Subagente de implementação (OpenCode/DeepSeek). Escopo
estrito: **somente** `desk/agents/claude-turn-policy.cjs` (novo) e
`desk/tests/claude-turn-policy.test.mjs` (novo). Nenhum arquivo do adaptador,
serviço, main, UI, núcleo Bend, `chat/` ou testes existentes foi editado.
Nenhum SDK, binário, login, inferência, sessão, credencial ou material de curso
foi tocado; os testes são 100% sintéticos e não leem o runtime.

Referência de comportamento: checkout público do T3 Code em
`/tmp/mesa-t3code-research-20261005`, commit
`1604ccc9d79f5270fb8e14d60664184bf142c4cb`, inspecionado no código
(`ClaudeAdapterV2.ts`, funções `isClaudeResultForOtherTurn`,
`providerFailureFromResult`, `providerFailureFromApiRetry`, tratamento de
`rate_limit_event`/`api_retry`/`model_refusal_fallback` e `interruptTurn`).
**Nenhum código do T3 foi copiado**; não há porção literal adaptada e portanto
não há nova atribuição a preservar além da já registrada nos documentos do pai
(T3 MIT © 2026 T3 Tools Inc.). As APIs usadas são apenas as do SDK pinado
`@anthropic-ai/claude-agent-sdk@0.3.246` (`TerminalReason`, `SDKResultSuccess`,
`SDKResultError`, `SDKAPIRetryMessage`, `SDKModelRefusalFallbackMessage`,
`SDKUserMessageReplay`) — nada de SDK mais novo.

## Arquivos e hashes

| Arquivo | sha256 |
| --- | --- |
| `desk/agents/claude-turn-policy.cjs` (novo) | `7bbea22f…bdcf6a6c` |
| `desk/tests/claude-turn-policy.test.mjs` (novo) | `896650be…424b7e26` |

## API pública exata (para o pai ligar no adaptador)

Módulo CJS puro, sem I/O, sem SDK, sem timers, sem reenvio:

```js
const policy = require('./claude-turn-policy.cjs'); // de desk/agents/
```

| Chamada | Retorno |
| --- | --- |
| `policy.correlationEvidence(message, wireUuid)` | `{evidence:'match'\|'mismatch'\|'none', echoed:string[], source:'replay'\|'echo-list'\|'echo-uuid'\|null}` |
| `policy.classifyResultCorrelation({message, wireUuid, accepted, degraded, foreignSeen, outstandingTurns})` | `{evidence, action:'finalize'\|'ignore', outcome:'settled'\|'uncertain'\|null, settled:boolean, reason:string}` |
| `policy.classifyQueryEnd({accepted, taken, phase, cancelled, degraded, endKind, failure})` | `{outcome:'settled'\|'refused'\|'uncertain', cancelled:boolean, uncertain:boolean, mayHaveSent:boolean, reason:string}` |
| `policy.classifyResultFailure(message, context)` | `null` \| `{code, class, message, terminalReason, apiErrorStatus, providerRetryable:true\|null, rateLimit:object\|null, detail:{subtype, usageLimitSource, usageLimitTypes, raw}}` |
| `policy.classifyApiRetry(message)` | `null` \| `{code, class, message, retryable:true, endsTurn:false, deliveryEffect:'none', dedupeKey:string, detail:{attempt,maxRetries,retryDelayMs,errorStatus,error}}` |
| `policy.classifyRefusalNotice(message)` | `null` \| `{kind:'fallback'\|'no_fallback', code, hasNotice:boolean, notice:string\|null, eviction:'deferred'\|'none', detail:{…}}` |

Constantes exportadas: `POLICY_VERSION`, `LIMITS`, `CODES`,
`FAILURE_CLASSES`, `CORRELATION_REASONS`, `QUERY_END_REASONS`.

Contextos aceitos: `classifyResultFailure(message, {rejectedRateLimitTypes,
latestAssistantRateLimited, authenticationFailure, rateLimit})`;
`classifyQueryEnd` aceita `endKind:'query'|'close'|'timeout'` (default/`
desconhecido` = `'close'`, conservador) e `failure` só para o motivo.

## Decisões implementadas

### L1 — result sem eco

`classifyResultCorrelation` só finaliza um `result` sem eco quando **todas**
valem: turno único (`outstandingTurns === 1`), `accepted === true` (aceite
persistido; `taken` **não** entra na assinatura e não prova nada),
`degraded !== true`, `foreignSeen !== true`, sem `origin.kind` não-humano
(origem ausente ou `'human'` permitem) e `num_turns > 0` (ou ausente). UUID
estrangeiro explícito (`match`/`mismatch` de replay, `user_message_uuid` ou
`user_message_uuids`) nunca é liquidado: `mismatch` → `ignore`. Eco do próprio
UUID finaliza: `settled` com aceite íntegro, `uncertain` sem aceite ou
degradado. `user_message_uuids` tem precedência sobre o campo singular.

### L2 — fim de consulta

| Fatos | Desfecho |
| --- | --- |
| aceite + cancelamento + `endKind:'query'` + não degradado | `settled`, `cancelled:true`, `uncertain:false` (status persistido continua `settled`; sem status novo) |
| mesma coisa com `failure` (iterador encerrou com erro) | idem — cancelamento explícito domina o desfecho do turno |
| aceite + fim de consulta **sem** cancelamento | `uncertain` (completude desconhecida; espera preservada) |
| cancelamento antes do aceite, nada puxado | `refused` com `cancelled:true` |
| cancelamento antes do aceite com item puxado (`taken`) | `uncertain` |
| aceite + cancelamento mas `endKind:'close'`/`'timeout'` | `uncertain` (fim nativo não observado; host não deve liberar a fila) |
| aceite degradado | `uncertain` (`accepted-degraded-safe-hold`) |

### L3 — falhas nativas

`classifyResultFailure` nunca mexe na entrega; o chamador mantém `settled`
quando o aceite foi comprovado. Classifica: `terminal_reason:'blocking_limit'`
e `api_error_status:429` e janela rejeitada não liberada (lista
`rejectedRateLimitTypes` ou `latestAssistantRateLimited`, com as mesmas
condições de envelope do T3) → `CLAUDE_RATE_LIMITED` (`usage_limit`); `529` →
`CLAUDE_OVERLOADED`; `prompt_too_long`/`rapid_refill_breaker` →
`CLAUDE_CONTEXT_LIMIT`/`CLAUDE_CONTEXT_REFILL`; `image_error` →
`CLAUDE_IMAGE_ERROR`; `budget_exhausted`/`error_max_budget_usd` →
`CLAUDE_BUDGET_EXHAUSTED`; `error_max_turns` → `CLAUDE_MAX_TURNS`; JSON de
erro genérico preserva texto listado (fora `[ede_diagnostic]`). Só valores de
`TerminalReason` do SDK pinado entram na tabela.

### L4 — retry

`classifyApiRetry` preserva `attempt`, `maxRetries`, `retryDelayMs`,
`errorStatus` e `error` sanitizados (limites em `LIMITS`), com `dedupeKey`
estável por tentativa/status/erro. `endsTurn:false` e
`deliveryEffect:'none'`: o aviso não encerra turno nem muda a entrega. `429` →
`CLAUDE_RATE_LIMITED`; `529` → `CLAUDE_OVERLOADED`; `error_status:null` →
transporte; resto → `CLAUDE_API_RETRY`. `retryable` é do transporte e não
autoriza reenvio da Mesa (`mayRetry` do núcleo continua a única porta).

### L5 — recusa/fallback

`classifyRefusalNotice` devolve aviso limitado (`content`, até 2000 chars;
sem content → `hasNotice:false`, nunca aviso vazio) e `detail` com direção,
escopo (`session` default quando ausente), modelos, categoria, explicação,
UUID recusado e a lista de `retracted_message_uuids` limitada a 64, deduplicada
e com contagem/truncamento. `eviction:'deferred'`: **nenhuma decisão de DOM**
foi tomada aqui.

## Verificação executada

- `node --test tests/claude-turn-policy.test.mjs` → **40/40 passam** (cobre
  L1–L5, os casos sem eco `foreignSeen`/origem não-humana/pré-aceite/turno
  zero, cancelamento nativo × crash, `blocking_limit`/429/529/janela
  recuperada, metadados de retry, retração limitada e a ancoragem Bend).
- `node tests/syntax-check.mjs` → **sintaxe ok em 173 arquivos**.
- `node --test tests/agent-core.test.mjs tests/claude-turn-policy.test.mjs` →
  **44/44 passam** (o núcleo Bend gerado continua verde junto).
- Nenhum teste do T3 foi executado; os cenários foram inspecionados e
  reimplementados de forma independente com dados sintéticos.

Observação de árvore: durante a redação, `tests/claude-adapter.test.mjs`
estava vermelho por uma expectativa de `snapshot` (`thinkingLevel`) porque o
adaptador está sendo editado pelo agente de controles/transporte na mesma
árvore. O helper novo não importa o adaptador e não depende desse estado.

## Núcleo Bend

Nenhuma lei/prova nova é necessária e **nada foi editado no núcleo**. A
decisão `settled` com cancelamento após aceite é exatamente
`agentdelivery_aceite_domina` (`outcome(accepted=true, mayHaveSent=* ) ==
Accepted`): o desfecho de **entrega** é aceito; o cancelamento é metadado de
turno (`cancelled:true`), não um novo status persistido (opção B do relatório
de auditoria não foi adotada). `refused` só aparece quando
`mayHaveSent === false` (`outcome(false,false) == Refused`) e `uncertain`
mantém `mayAdvanceQueue(false,false,true,*) == false` (espera segura). A opção
por manter `uncertain` em crash **sem** cancelamento mesmo com aceite é uma
espera de **completude**, não uma dúvida de entrega — o artefato gerado
`desk/src/generated/agentdelivery.core.js` não foi tocado e o teste ancora as
três correspondências.

## Integração sugerida (o pai decide)

1. `_handleMessage`: marcar `turn.foreignSeen = true` quando
   `correlationEvidence(…) === 'mismatch'` em mensagem não-`result` (hoje só
   há `foreignWarned` local) e acumular `rejectedRateLimitTypes` por turno
   (`rejected` sem overage adiciona; `allowed` remove) para alimentar L3.
2. `_handleResult`: usar `classifyResultCorrelation`; só `action:'finalize'`
   chama `_finalizeTurn` com `corr.outcome`. Emitir erro via
   `classifyResultFailure` antes de finalizar (sem alterar `corr.outcome`).
3. `_finishQuery`: `endKind:'query'`; `close()`: `endKind:'close'` **sem**
   apagar um `uncertain` já persistido; `_timeoutTurn` continua como está
   (não deixar um fim de consulta posterior refinalizar turno já finalizado).
4. `_handleSystem`/`api_retry`: emitir warning com o resultado de
   `classifyApiRetry`, deduplicando por `dedupeKey`; nenhum efeito em busy.
5. `_handleSystem`/`model_refusal_*`: emitir warning quando `hasNotice` com
   `detail`; evicção de DOM fica para rodada própria (dados já expostos).

## Limites não resolvidos

- O CLI real 2.1.246 não foi executado: se ele ecoa `user_message_uuid` no
  `result` continua sem prova autenticada; o caminho sem eco é o fallback
  conservador implementado.
- "Fim confiável" foi definido como iteração da consulta encerrada (`'query'`,
  com ou sem erro de iterador). `close()`/timer do host seguem conservadores —
  se o pai quiser `close` pós-cancelamento também `settled`, é um ajuste de
  política (uma linha) com decisão explícita.
- O brief manda ignorar origem não-humana sem eco mesmo com turnos positivos;
  o T3, com modo de eco desconhecido, aceita esse resultado. A escolha da Mesa
  é a mais conservadora (pode deixar um turno legítimo terminar incerto).
- `num_turns` ausente não é tratado como detrito (só `<= 0`); é contagem de
  trabalho, não vínculo causal (mesma ressalva do T3).
- `usageLimitTypes`/assistant `rate_limit` dependem do adaptador alimentar o
  contexto; sem isso, `blocking_limit`/429/529 continuam classificando.
- Evicção de mensagens retratadas no DOM não foi decidida.
- `npm test` completo não foi rodado por causa das edições concorrentes no
  adaptador; a política e o núcleo foram verificados focados e verdes.
