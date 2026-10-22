# Mesa ↔ T3: integração do ciclo de vida no adaptador — rodada `lifecycle-integration-r1`

5 de outubro de 2026. Subagente de implementação (OpenCode/DeepSeek). Escopo
estrito: `desk/agents/claude-adapter.cjs`, `desk/tests/claude-lifecycle-integration.test.mjs`
e este documento; ajuste mínimo e deliberado em `desk/tests/claude-adapter.test.mjs`.
Nenhum outro arquivo foi editado; `chat/` não foi tocado. Nenhum login,
inferência autenticada, credencial, sessão pessoal, material de curso, commit,
push, release, mudança de dependência ou instalação foi feito. Todos os testes
usam somente SDK fake, dados sintéticos e o runtime do repositório.

Referência conceitual: checkout público do T3 Code em
`/tmp/mesa-t3code-research-20261005`, commit
`1604ccc9d79f5270fb8e14d60664184bf142c4cb`, com inspeção do código real
(`isClaudeResultForOtherTurn`, `providerFailureFromResult`,
`providerFailureFromApiRetry`, tratamento de `rate_limit_event`,
`model_refusal_fallback` e `interruptTurn`). **Nenhum trecho do T3 foi
copiado**; o porte é conceitual e as APIs usadas são apenas as do SDK pinado
`@anthropic-ai/claude-agent-sdk@0.3.246` / CLI `2.1.246`. Nada foi assumido de
SDK mais novo. Se alguma porção literal fosse necessária, o aviso MIT © 2026 T3
Tools Inc. seria preservado pelo pai — não foi o caso.

## Arquivos e hashes

| Arquivo | sha256 |
| --- | --- |
| `desk/agents/claude-adapter.cjs` | `e5effc3b…36e2a6` |
| `desk/tests/claude-lifecycle-integration.test.mjs` | `ea29a195…e9e3c16` |
| `desk/tests/claude-adapter.test.mjs` (ajuste mínimo) | `2c627173…f0f96697` |

## O que foi ligado (política pura → mensagens reais)

`desk/agents/claude-turn-policy.cjs` (rodada `policy-r2`, 40/40) passou a ser a
autoridade do adaptador; o adaptador só mede fatos e aplica o veredito.

1. **Correlação do `result`** — `_handleMessage`/`_handleResult` usam
   `correlationEvidence` (lista `user_message_uuids` com precedência sobre o
   singular) e `classifyResultCorrelation`:
   - eco do próprio UUID continua sendo a prova de aceite existente;
   - sem eco, só liquida turno ÚNICO com aceite persistido, não degradado, sem
     `foreignSeen`, sem `origin.kind` não-humano e sem `num_turns <= 0`;
   - `taken` **não** é aceite: resultado sem eco de turno ainda não aceito é
     ignorado até timeout/fim de consulta (nunca libera busy cedo);
   - `foreignSeen` é marcado em QUALQUER mismatch explícito, inclusive no ramo
     `result` (`CLAUDE_RESULT_FOREIGN`), e bloqueia para sempre a liquidação
     por result sem eco daquele turno.
2. **Fim de consulta** — `_finishQuery` usa `classifyQueryEnd` com
   `endKind:'query'`; `close()` usa `endKind:'close'`:
   - cancelamento explícito + aceite + fim nativo observado (inclusive com
     erro de iterador, o `runtime_exit` real) ⇒ `settled`,
     `cancelled:true`, `uncertain:false`, sem `CLAUDE_QUERY_ERROR` falso;
   - queda sem cancelamento continua `uncertain`; cancelamento antes do aceite
     com item puxado continua `uncertain`; sem item puxado vira `refused`;
   - `close()`/timeout do host continuam conservadores MESMO com aceite e
     cancelamento (`uncertain`, nada de liberar fila).
3. **Falhas nativas do result** — `classifyResultFailure` com os fatos por
   turno: `blocking_limit`, `api_error_status` 429/529, contexto
   (`prompt_too_long`/`rapid_refill_breaker`), imagem, orçamento e outros
   `terminal_reason` do SDK pinado; janela `rejected` não liberada
   (`rejectedRateLimitTypes`/`latestAssistantRateLimited`) rotula
   `CLAUDE_RATE_LIMITED`; `allowed` limpa a evidência do turno; falha de
   autenticação não é confundida com limite. O erro sai com `fatal:false` e a
   entrega aceita continua `settled` (falha e entrega são independentes).
4. **Erros de assistente** — erros nativos recuperáveis (`server_error`,
   `rate_limit`, etc.) saem com `fatal:false` e a consulta segue utilizável;
   falhas de autenticação (`CLAUDE_AUTH_FAILED`) saem com `fatal:true`; erro
   de consulta (`CLAUDE_QUERY_ERROR`) segue no tratamento fatal padrão.
5. **`api_retry`** — `classifyApiRetry` preserva `attempt`/`maxRetries`/
   `retryDelayMs`/`errorStatus`, código canônico (429 → `CLAUDE_RATE_LIMITED`,
   529 → `CLAUDE_OVERLOADED`, senão `CLAUDE_API_RETRY`), dedupe por attempt no
   turno e `endsTurn:false`/`deliveryEffect:'none'`: nenhum fim de turno,
   fila ou reenvio.
6. **Recusa/fallback** — `classifyRefusalNotice`: aviso `CLAUDE_MODEL_FALLBACK`/
   `CLAUDE_MODEL_REFUSAL` com texto limitado e `retracted_message_uuids`
   limitados/deduplicados no detalhe; **nenhuma evicção de DOM** (adiada, como
   pedido); sem `content`, não sai aviso vazio, mas a retração continua exposta
   quando existir.
7. **H1 — incerteza pegajosa** — construtor aceita `deliveryUncertain` com
   hidratação ESTRITA (`=== true`): `send`, `initializeControls` e
   `setControls` recusam antes de consulta nativa, mudança nativa ou
   persistência; `send` não zera mais o fato e `close()` não o limpa. O portão
   existente do Bend (`canChangeControls`) é quem nomeia a recusa dos
   controles (`delivery_uncertain`). O `main` já passa
   `record.delivery?.status==='uncertain'` e o `ClaudeService` já bloqueia
   envio/controles antes do init.
8. **Perguntas** — `validateQuestionAnswers` monta as respostas com
   `Object.defineProperty` (própria, enumerável), então chaves exatas como
   `__proto__`/`constructor` sobrevivem sem disparar setter de protótipo e sem
   mudar o formato nativo (string juntada com `, `).
9. **Reabertura nativa** — inalterada de propósito: depois de um interrupt-exit
   a próxima consulta usa `resume` com o ID exato (via `_promptDelivered`) e
   nunca combina `sessionId` + `resume`; coberto por teste de integração.

## Núcleo Bend

Nenhuma lei/prova nova foi necessária e nada no núcleo foi editado.
`settled` com cancelamento após aceite é exatamente
`agentdelivery_aceite_domina` (`outcome(accepted=true, *) == Accepted`);
`uncertain` mantém `mayAdvanceQueue(false,false,true,*) == false`; o status
persistido continua `settled` (sem schema novo) e o cancelamento viaja nos
flags existentes do `agent_settled`. Build/import do núcleo continuam com o pai.

## Verificação executada

| Comando | Resultado |
| --- | --- |
| `node --test tests/claude-adapter.test.mjs` | **57/57** |
| `node --test tests/claude-lifecycle-integration.test.mjs` | **20/20** |
| `node --test tests/claude-native-controls.test.mjs` | **24/24** |
| `node --test tests/claude-turn-policy.test.mjs` | **40/40** |
| 4 suítes focadas juntas | **141/141** |
| `claude-controls` + `claude-questions` + agent-core/service/history + conversations | **207/207** no conjunto |
| `node tests/syntax-check.mjs` | sintaxe ok em **175 arquivos** |
| `git diff --check` (3 arquivos) | passou |

Cobertura nova de integração (além dos 9 testes do pai): incerteza hidratada
bloqueando envio/controles sem consulta/persistência; hidratação estrita e
pegajosa após queda; result sem eco antes do aceite ignorado até o fim da
consulta; degradado que nunca liquida; janela rejeitada × liberada; fallback
com retração limitada sem evicção; erro recuperável × autenticação; reabertura
com `resume` exato após interrupt-exit; pergunta com chaves `__proto__`/
`constructor` sem poluir protótipo; falha de iterador após cancelamento
liquida sem erro fatal; close do host após cancelamento segue conservador.

## Mudanças de contrato (ajustes deliberados em testes antigos)

1. `claude-adapter.test.mjs` “cancel antes do aceite…” e “cancel com interrupt
   que falha…”: um `result` SEM eco e SEM aceite agora é ignorado (`taken` não
   é aceite); os testes passam a encerrar a consulta (`query.end()`) para
   observar o desfecho conservador real (interrupt → exit). A segurança não foi
   enfraquecida: continua `uncertain`, sem `settled` e sem reenvio.
2. `claude-adapter.test.mjs` “erro de stream do assistente…”: o frame
   `terminal_reason:'api_error'` agora tem código canônico `CLAUDE_API_ERROR`
   (antes caía no genérico `CLAUDE_RESULT_ERROR`). Erros genéricos
   (`error_during_execution` sem razão terminal, `success` com `is_error`)
   continuam `CLAUDE_RESULT_ERROR`.

## Avisos e regressões possíveis

- `claude-questions.test.mjs` prende por TEXTO os códigos
  `CLAUDE_API_RETRY`/`CLAUDE_MODEL_REFUSAL` no adaptador. Eles agora vêm da
  política pura, então o cabeçalho do adaptador documenta os códigos que ele
  emite (contrato de eventos) para a âncora continuar válida. Se o pai preferir,
  a âncora deve ser apontada para `claude-turn-policy.cjs` numa rodada de
  documentação — nenhum outro teste depende disso.
- `fatal:true` em falha de autenticação de assistente é permitido pelo brief,
  mas a consulta do adaptador só encerra com result/fim: a UI pode desconectar
  antes do `agent_settled`. Se isso incomodar no smoke autenticado, é uma linha
  no adaptador (voltar a `fatal:false`).
- `api_retry` sem turno ativo deduplica num mapa limitado do adaptador
  (128 entradas), no mesmo padrão dos avisos de limite; `close()` não limpa esse
  mapa (também não limpa os avisos de limite — comportamento pré-existente).

## Limites não resolvidos

- Sem inferência autenticada: se o CLI `2.1.246` ecoa `user_message_uuid` no
  `result` da consulta por AsyncIterable continua sem prova; o caminho sem eco
  é o fallback conservador (mesmo veredito do T3).
- Um `result` com eco pode chegar antes de a persistência assíncrona do aceite
  resolver; nesse caso a liquidação é `uncertain` (conservadora) — comportamento
  pré-existente, não alterado.
- Evicção de DOM das mensagens retratadas segue ADIADA (só o aviso e os IDs
  limitados chegam ao host).
- Retomada com diálogo de compactação (`resume_return`), modelo/esforço e
  demais itens P3 da auditoria continuam fora desta rodada.
- O smoke Electron e o `npm test` completo ficam com o pai, por instrução;
  nada de Electron foi executado aqui.
