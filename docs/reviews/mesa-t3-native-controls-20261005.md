# Mesa + Claude: controles nativos (modelo/esforço) no adaptador — rodada 3

Data: 5 de outubro de 2026. Rodada 3 (controles), subagente de implementação com
`opencode-go/deepseek-v4.1-flash` (variant máx.). Escopo desta rodada:
`desk/agents/claude-adapter.cjs`, novo `desk/tests/claude-native-controls.test.mjs`
e este documento. O desenho do módulo puro e o contrato sugerido estão em
`docs/reviews/mesa-t3-controls-design-20261005.md` (rodada anterior); aqui está a
INTEGRAÇÃO no adaptador e a transição de limite liberado.

Referência conceitual: T3 Code, commit `1604ccc9d79f5270fb8e14d60664184bf142c4cb`
(`apps/server/src/claudeModelOptions.ts`, `ClaudeModelCatalog.ts` e o trecho de
`rate_limit_event` em `ClaudeAdapterV2.ts`), MIT © 2026 T3 Tools Inc. **Nenhum
código do T3 foi copiado**: a implementação abaixo é JS novo sobre as APIs REAIS
do SDK pinado `@anthropic-ai/claude-agent-sdk@0.3.246` (`sdk.d.ts` instalado).
Se o pai portar trechos literais do T3, a atribuição MIT (copyright + licença)
é dele, como já registrado no desenho da rodada anterior.

## 1. O que o adaptador passou a expor (contrato público)

```js
const a = new ClaudeAdapter({
  conversationId, cwd, sessionId, resume,
  selection: {model: 'sonnet', effort: 'high'},   // escolha DESEJADA persistida
  persistSelection: (patch) => { ... },           // opcional (default por chamada)
  controlsTimeoutMs: 15000,                       // teto das operações nativas
});
await a.connect();               // só versão/auth (inalterado; health não lê catálogo)
await a.initializeControls();    // AÇÃO EXPLÍCITA: cria/reusa a Query sem prompt,
                                 // lê o catálogo sanitizado e restaura a escolha
a.controlsSnapshot();            // seletor + estados seguros para a UI
await a.setControls({model, effort}, {persistSelection}); // só com motor ocioso
a.snapshot();                    // modelo/esforço OBSERVADOS + capacidades dinâmicas
```

### `initializeControls({timeoutMs}?)`

- Conecta (se necessário), cria/reusa a Query NATIVA **sem prompt** e lê o
  catálogo na MESMA Query com `supportedModels()` (fallback
  `initializationResult().models`). Nada entra no iterador de entrada e nenhum
  evento `turn_start` sai — sem inferência.
- Idempotente quando saudável (catálogo ok + Query viva); chamadas concorrentes
  compartilham a mesma promessa. **Sem retry automático**: cada chamada explícita
  tenta UMA vez; uma falha de catálogo vira `unavailable` e um novo chamado
  explícito tenta de novo.
- Restaura a escolha salva com as APIs do pin: `query.setModel(model)` (nunca
  `undefined` quando não há modelo) e `query.applyFlagSettings({effortLevel})`.
  A escolha passa a ser a forma NORMALIZADA (alias `resolvedModel` vira o `value`
  da linha do catálogo) — igual ao que foi aplicado e ao patch que o host persiste.
- Catálogo ausente/vazio/erro: `state: 'unavailable'`, seletores desligados
  (`modelSelection`/`effort` falsos, `models: []`), `catalogReason` preenchido;
  escolha NULA ainda pode enviar (default nativo). Escolha explícita salva
  RECUSA antes de transmitir (`CLAUDE_CONTROLS_UNAVAILABLE`/`INVALID` com
  `detail.reason`), nada é silenciosamente trocado.
- Erros de Query (fechou no meio) re-lançam `CLAUDE_CLOSED`/`CLAUDE_QUERY_STALE`
  e voltam o estado para `idle`; rollback que falhou é terminal e nunca é engolido.

### `setControls(selection, {persistSelection}?)`

- Portão: `deliveryCore.canChangeControls(busy, hasTurn, permissionPending, uncertain)`
  (artefato Bend) decide; o módulo puro só NOMEIA o motivo (`engine_busy`,
  `turn_pending`, `permission_pending`, `delivery_uncertain`, nessa ordem).
  `uncertain` é o fato interno do adaptador (última entrega incerta ainda não
  superada por um envio novo comprovado).
- Valida o catálogo vivo (`compileSelection`, inclui alias, roteador recusado,
  first-party quando a conta é conhecida e esforço só com metadado nativo).
- Aplica só os DELTAS contra o estado nativo anterior:
  `setModel(model|undefined)` e `applyFlagSettings({effortLevel: x|null})`.
- Persiste o `compiled.patch` **somente depois** do sucesso nativo. Falha nativa
  ou de persistência → restaura o estado anterior (modelo E esforço) e relança
  `CLAUDE_CONTROLS_APPLY_FAILED`/`CLAUDE_CONTROLS_PERSIST_FAILED` com
  `notSent: true`; o descritor nunca fica "meio trocado".
- Rollback que também falha → `CLAUDE_CONTROLS_ROLLBACK_FAILED`, marcador
  `failed` no snapshot, e TODO envio novo passa a recusar
  `CLAUDE_CONTROLS_BLOCKED` até um adaptador novo (mesmo `close()`+`connect()`
  não limpa o bloqueio; a conversa é recriada pelo host).
- Prazo próprio (`controlsTimeoutMs`, default 15 s, teto 120 s) em cada operação
  nativa; timeout vira falha com `detail.timedOut: true` e rollback normal.
- Uma troca por vez (`_controlsChanging`); prompt concorrente durante a troca
  recusa `CLAUDE_CONTROLS_BUSY` em vez de esperar; `close()` no meio não persiste
  e devolve `CLAUDE_CLOSED`.

### `controlsSnapshot()` (seguro para UI/IPC)

```
{ready, state, models, levels, selection, modelSelection, effort, catalogReason,
 selectionValid, selectionReason, selectionDetail, observedModel, nativeSelection,
 error, failed}
```

- `models` começa pela entrada reservada do default nativo
  `{provider:'anthropic', id:'', name:'Padrão do Claude Code', default:true}`,
  seguida do formato do seletor da Mesa; `[]` quando catálogo OU `setModel`
  não estão vivos ("sem controles se a API não existe").
- `levels` é o metadado do MODELO ESCOLHIDO (alias resolvido). Sem modelo
  explícito não há níveis — `compileSelection` exige modelo para esforço; a UI
  escolhe um modelo antes de habilitar o esforço.
- `selection` é a escolha DESEJADA; `observedModel` é o modelo que o CLI
  REALMENTE reportou (`system/init`). `nativeSelection` é o que ESTE adaptador
  aplicou. `snapshot()` devolve `model` observado (nome do catálogo quando casa)
  e `thinkingLevel` = esforço nativo aplicado (null = default do CLI).
- Nunca retém e-mail/organização/plano: a conta só vira `{apiProvider}` (nome),
  e o catálogo é sanitizado pelo módulo puro.

### Capacidades

- `CAPABILITIES` do adaptador foi alinhado ao `claudeCaps()` do núcleo Bend
  (`core/agentcaps.bend`), agora com 13 chaves
  (`commands`/`geogebra`/`quiz`/`contextUsage` incluídas).
- `snapshot().capabilities` usa `capsCore.claudeControlCaps(catalogReady, effortSupported)`
  (artefato gerado, somente leitura): `catalogReady` exige catálogo ok + Query
  viva + `setModel`; `effortSupported` exige `applyFlagSettings` + metadado
  nativo de esforço. Sem isso, capacidades BASE (controles ocultos).

## 2. Limite de uso: transição de liberação

- `rejected` sem overage marca a JANELA (por tipo) como pausada e mantém o aviso
  deduplicado `CLAUDE_RATE_LIMITED` existente. Várias janelas podem estar
  pausadas ao mesmo tempo.
- Só o `allowed` da MESMA janela emite **UMA** transição
  `CLAUDE_RATE_LIMIT_RESUMED`, com `rateLimit.blocked:false`,
  `rateLimit.status:'allowed'`, `resumed:true` e o `type`/`window` da janela
  liberada. `allowed` repetido não repete o evento; um novo `rejected` da janela
  volta a pausar e um novo `allowed` volta a emitir.
- `allowed_warning` e `rejected` com overage NÃO limpam a pausa: a UI é
  limpa quando a janela realmente vira `allowed` (contrato testado).
- Nada de busy/fila/liquidação é alterado pelo evento; o turno segue até
  `result`/fim de consulta/close. O caminho legado
  `system/rate_limit_event` usa a mesma transição.
- **Nota para a UI (já atendida):** `desk/src/claude-questions.mjs` foi atualizado
  pelo agente de UI para reconhecer `CLAUDE_RATE_LIMIT_RESUMED` e
  `rateLimit.resumed === true`, limpando o estado POR JANELA (tipo + reset) — o
  payload do adaptador casa com esse contrato. Validado pelo teste puro da UI e
  pelo smoke Electron `claude-controls-ui.mjs`; não alterei `src/`.

## 3. Sessão nativa × catálogo (sem resume indevido)

`_hasQueried` foi removido. A retomada (`resume`) agora exige
`_promptDelivered` = um item REALMENTE passou pelo yield do iterador de entrada.
Criar a Query apenas para ler o catálogo (sem prompt) não autoriza `resume` de
uma sessão que pode não existir; depois de um prompt entregue, o comportamento
antigo é preservado (testes de retomada do transporte continuam verdes).

## 4. Arquivos

| Arquivo | Papel |
|---|---|
| `desk/agents/claude-adapter.cjs` | controles nativos, snapshot seguro/dinâmico, guarda de envio, transição RESUMED, `_promptDelivered` |
| `desk/tests/claude-native-controls.test.mjs` | NOVO: 24 testes sintéticos (fake query com `supportedModels`/`setModel`/`applyFlagSettings`) |
| `desk/tests/claude-adapter.test.mjs` | edição MÍNIMA e necessária: o contrato congelado do snapshot ganhou as 4 capacidades já existentes no núcleo Bend + `thinkingLevel` |
| `docs/reviews/mesa-t3-native-controls-20261005.md` | este documento |

Nada em `chat/`, nada em `service/main/UI`, nada de credenciais/sessões/materiais
foi lido ou alterado. `claude-controls.cjs` (módulo puro) e os artefatos Bend foram
usados como dependência de leitura; o build continua do pai.

## 5. Evidência executada (sintética)

```sh
cd desk
node --test tests/claude-native-controls.test.mjs tests/claude-adapter.test.mjs \
  tests/claude-controls.test.mjs                       # 93/93 (adaptador+controles)
node --test tests/claude-questions.test.mjs            # 15/15 (contrato da UI)
node --test tests/agent-core.test.mjs tests/agent-service.test.mjs \
  tests/agent-history.test.mjs tests/conversations.test.mjs \
  tests/native-history.test.mjs tests/descriptor-cache.test.mjs  # 42/42 (no fechamento)
node tests/syntax-check.mjs                            # sintaxe ok em 174 arquivos
```

Cobrem: catálogo lido sem prompt e sem inferência; idempotência/concorrência;
alias e restauração; esforço por modelo; catálogo/API ausentes (seletores
desligados e recusa antes do envio); default nativo permitido; validações
(`effort_requires_model`, `model_unknown`, `model_router`, `effort_unsupported`);
persistência só depois do nativo; rollback de falha nativa/persistência; rollback
que falha bloqueando envios até adaptador novo; timeout; prompt e troca
concorrentes; `close` no meio; portão `canChangeControls` do Bend nas 16
combinações; `snapshot()` observado × desejado e capacidades dinâmicas; retomada
da sessão só com prompt entregue; RESUMED por janela (múltiplas janelas,
`allowed_warning`, caminho legado).

Integração real (Electron + SDK falso, runtime/matéria artificiais, zero Pi):

```sh
cd desk
node tests/claude-controls-ui.mjs   # PASSOU: catálogo sem prompt; modelo/esforço/
                                    # default; recusa de esforço e guarda de busy;
                                    # restauração; identidade nativa; zero Pi
node tests/claude-ui-smoke.mjs      # PASSOU (smoke Claude completo, sem regressão)
```

Nenhum binário Claude, credencial, sessão, login, SDK real ou material de curso
foi usado. Nenhuma inferência autenticada.

## 6. Limites e pendências

- `supportedModels()`/`setModel`/`applyFlagSettings` reais não foram exercitados
  (sem login); os testes usam a forma do `sdk.d.ts` do pin. A etapa autenticada
  continua do pai.
- `max` é session-only no SDK; o adaptador o repassa como qualquer nível do
  catálogo, mas o comportamento real do CLI com `max` não foi observado.
- O catálogo é lido UMA vez por inicialização explícita; sem leitura periódica e
  sem invalidar sozinho. Após a morte da Query, o estado volta a `idle` e o
  host precisa chamar `initializeControls` de novo antes de enviar escolha
  explícita (o serviço já faz isso no `prompt`).
- O bloqueio por `CLAUDE_CONTROLS_ROLLBACK_FAILED` é terminal para o adaptador
  por decisão conservadora; a recuperação é uma conversa/adaptador novo.
- Nenhuma lei/prova NOVA do Bend foi necessária nesta rodada: o adaptador consome
  `canChangeControls`/`claudeControlCaps` dos artefatos já gerados pelo pai. A
  guarda de envio por escolha não honrada é estado do host (não uma decisão pura
  nova); se o pai quiser uma lei `controlsApplied`, o núcleo é dele.
