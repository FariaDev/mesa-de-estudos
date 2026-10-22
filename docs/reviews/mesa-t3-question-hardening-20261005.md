# Endurecimento da UI de perguntas e avisos nativos — rodada `mesa-t3-question-hardening`

5 de outubro de 2026. Rodada de implementação/revisão autorizada pelo principal,
com dados sintéticos e runtime temporário. Nenhuma credencial, sessão pessoal ou
material de curso foi lido; não houve login, inferência autenticada, atualização
de CLI/SDK, mudança de dependência, install-app, commit, push ou release.
`chat/` não foi tocado. Nenhum código do T3 foi copiado (só comparação de
comportamento já registrada em `COMPARACAO-T3-CLAUDE-2026-10-05.md`); as APIs
usadas são apenas as do SDK pinado `0.3.246`/CLI `2.1.246`.

Arquivos sob posse desta rodada (snapshot):

| Arquivo | sha256 |
| --- | --- |
| `desk/src/claude-questions.mjs` | `0afbe1916a5f03a1f4e149180f8a6ddb67497bfb4b51f2c73097bcda235c1f78` |
| `desk/src/chat.mjs` | `356204e4d6c0272425611348b79ed065837e31f2f9f5f264e6fd9f9cc0b1aad7` |
| `desk/tests/claude-questions.test.mjs` | `e6c7122bb7b62e81c76a130e957df6b82baef2c6dd72d43f624500de836df5ae` |

Nenhuma edição em `service/main/adaptador/núcleo/fixtures/chat` (só leitura do
adaptador real para ancorar códigos no teste e para entender o payload).

## Correções

1. **Cancelar do diálogo de perguntas sempre cancela.** O submit do casco
   (`#pi-dialog form`) validava qualquer submit; com o formulário vazio, o
   botão Cancelar (`value="cancel"`) era bloqueado junto com o Responder. A
   decisão virou o passo puro `questionSubmitAction(questions, picks,
   submitterValue)` (`desk/src/claude-questions.mjs`): só `value="ok"` (botão
   Responder ou Enter, que clica o `#dialog-ok`) exige respostas completas;
   qualquer outro submit devolve `cancel` e o `<form method="dialog">` fecha
   com `returnValue="cancel"`. Sem submitter identificado (`requestSubmit()`
   direto) mantém o caminho exigente. O Escape e os diálogos não-pergunta (Pi)
   ficam iguais.
2. **`__proto__` como texto de pergunta não some mais.** `compileQuestionAnswers`
   montava `answers[question.question] = valor`; para o texto `__proto__` a
   atribuição caía no setter do protótipo e a resposta era perdida. Agora a
   chave é criada com `Object.defineProperty(... enumerable/writable/
   configurable ...)`: propriedade PRÓPRIA, objeto simples preservado (IPC,
   `JSON.stringify`/`parse`, testes com `deepEqual`). Coberto também para
   `constructor`, `toString`, `hasOwnProperty`.
3. **Aviso de limite por JANELA.** O estado único `limitState` deixava a
   liberação de uma janela esconder outra janela rejeitada. O passo puro
   `limitNoticeState(entries, notice, conversationId)` guarda por conversa +
   janela (tipo + reset), remove só a janela compatível (`type` igual; `reset`
   igual quando ambos existem) e devolve o aviso MAIS GRAVE restante
   (blocked > overage > warning) para a faixa. `agent_settled`, erro fatal e
   `showHistory` zeram tudo. O dedup de reset é estável: `resetsAt` numérico
   (epoch em segundos nativo) e `resetsAt`/`resetAt` ISO apontando o mesmo
   instante viram o mesmo token (`t:<ms>`). `CLAUDE_RATE_LIMIT_RESUMED`
   (`status:'allowed'`, `rateLimit.resumed:true`) é o código nomeado; o antigo
   `CLAUDE_RATE_LIMIT_CLEARED` e `status:'allowed'` continuam aceitos. Uma
   janela bloqueada visível também não é mais apagada pelo relógio do turno
   (`paintLive` respeita o aviso) nem encoberta por retry/fallback.
4. **`desk_error` com `fatal:false` não derruba a conversa.** O passo puro
   `deskErrorIsFatal(event)` (só o booleano exato `false` é não-fatal) decide no
   renderer: o erro entra no diário/faixa/toast, mas `S.connected`,
   `connectionState`, `setBusy` e `desk-failed` não mudam; `settleTurn` também
   não é chamado. Quem encerra é o `agent_settled` (isError), que já segura a
   fila. Ausente/`true`/não-booleano preserva o tratamento fatal de sempre
   (Pi e transporte).
5. **Avisos nativos de atividade com faixa/toast.** `claudeActivityNotice`
   classifica `CLAUDE_API_RETRY`, `CLAUDE_OVERLOADED`, `CLAUDE_MODEL_FALLBACK`
   e `CLAUDE_MODEL_REFUSAL` (com `detail` do host: tentativa/máximo, dedupeKey,
   fallbackModel) em um fato `{kind, code, key, message}`. O `chat.mjs` mostra
   faixa + toast uma vez por aviso, sem tocar em busy/conexão/fila; fallback com
   bloqueio de limite visível não é encoberto. A **evicção do texto parcial
   retratado no fallback fica explicitamente adiada** — nada de remover bolha
   por aqui. Aviso genérico do Pi continua só no `console.warn`.

## Evidência executada

| Verificação | Resultado |
| --- | --- |
| `node --test tests/claude-questions.test.mjs` (foco, sem `npm test`) | **15/15** (eram 10; +5 testes novos), incl. `__proto__`, cancel/Enter, por janela, ISO×epoch, activity notices, fatal |
| `node tests/syntax-check.mjs` | sintaxe ok em **175 arquivos** (exit 0) |
| Sonda Electron temporária (fora do repositório, SDK fake, runtime sintético em `…/T/opencode/mesa-question-probe-20261005/`) | **PASSED**: Cancelar com formulário vazio fechou sem exigir resposta; Enter vazio marcou os 2 erros e manteve o diálogo aberto; respostas completas por Enter fecharam e chegaram ao host (`"Qual caminho vamos seguir?":"Detalhado"`, multiSelect validado e juntado em `"Álgebra, Gráfico"` no `updatedInput`, como documenta `claude-adapter.cjs:72-73`) |
| `git diff --check` nos 3 arquivos | limpo |

A sonda foi só do diálogo de perguntas (era a reprodução pedida do Cancelar
vazio); o `claude-lifecycle-ui.mjs` continua intocado e não foi rodado nesta
rodada — a execução de integração fica com o root/pai, como combinado.

## Contrato do módulo (mudanças)

- `claudeLimitNotice` agora devolve `{kind, key, message, window, type, reset}`
  (antes `{kind, key, message}`); `kind:'cleared'` preserva `type`/`reset` para
  limpar a janela certa.
- Novos exports: `questionSubmitAction`, `limitNoticeState`,
  `claudeActivityNotice`, `deskErrorIsFatal`, `ACTIVITY_NOTICE_CODES`;
  `RATE_LIMIT_CODES` ganhou `resumed` e manteve `cleared`.
- `chat.mjs` consome os passos puros; nenhum IPC, `main.cjs`, `preload.cjs`,
  `service.cjs` ou adaptador foi alterado.

## Limites não resolvidos

- Sem inferência autenticada e sem SDK/binário reais: nada aqui prova
  comportamento de assinatura/limite real; a evidência é fake SDK + módulo puro.
- A composição de múltiplas janelas de limite foi provada no teste puro
  (`limitNoticeState`); o smoke Electron atual só tem cenário de uma janela
  (`[claude:rate-limit]`), então a combinação bloqueio+aviso em tela fica para a
  integração do root.
- Os cenários `fatal:false` e os avisos `CLAUDE_API_RETRY`/`OVERLOADED`/
  `FALLBACK` não têm cenário no SDK fake desta rodada (fixtures são do agente de
  adaptador); a cobertura deles é pura + leitura do `service.cjs`
  (`rendererEvent` já repassa `code`/`detail`/`fatal`). O root precisa encaminhar
  esses eventos e rodar a integração.
- Trocar para uma conversa vazia não chama `showHistory` (`main.cjs`), então as
  entradas antigas de aviso continuam guardadas por conversa; elas não vazam
  para a conversa nova (o estado é filtrado por `conversationId`), mas a faixa
  pode manter o texto anterior até o próximo evento/atividade. Não é regressão
  desta rodada; registro para o root.
- Nenhuma API fora do SDK pinado `0.3.246`/CLI `2.1.246` foi assumida.
