# Mesa + Claude: seleção de modelo e esforço — desenho e contrato de integração

Data: 5 de outubro de 2026. Rodada 3 (controles), subagente de implementação com `opencode-go/deepseek-v4.1-flash` (variant máx.). Escopo desta rodada: **somente** `desk/agents/claude-controls.cjs`, `desk/tests/claude-controls.test.mjs` e este documento. Nada de adapter/serviço/main/frontend/núcleo foi editado; a integração abaixo é recomendação para o pai ligar.

Referência conceitual: T3 Code, commit `1604ccc9d79f5270fb8e14d60664184bf142c4cb`, `apps/server/src/claudeModelOptions.ts` e `apps/server/src/provider/ClaudeModelCatalog.ts` (MIT, 2026 T3 Tools Inc.). **Nenhum código do T3 foi copiado**; a implementação é JS novo sobre os tipos REAIS do SDK pinado. Se o pai portar trechos literais do T3, a atribuição MIT (copyright + licença) é dele.

## 1. Fonte de verdade: SDK oficial pinado 0.3.246

Tudo abaixo foi conferido no `sdk.d.ts` instalado (`desk/node_modules/@anthropic-ai/claude-agent-sdk`, versão `0.3.246`), sem executar o SDK/CLI:

|Fato nativo|Onde no pin|Uso no módulo|
|---|---|---|
|`Query.supportedModels(): Promise<ModelInfo[]>`|`sdk.d.ts:2552`|fonte preferida do catálogo vivo|
|`Query.initializationResult(): Promise<SDKControlInitializeResponse>` (cache do 1º connect)|`sdk.d.ts:2514`|fallback com `.models`|
|`SDKControlInitializeResponse.models: coreTypes.ModelInfo[]`|`sdk.d.ts:3767`|forma aceita por `sanitizeCatalog`|
|`ModelInfo.value/resolvedModel/displayName/description/...`|`sdk.d.ts:1247`|campos sanitizados, nada além|
|`ModelInfo.supportsEffort?: boolean` e `supportedEffortLevels?: ('low'\|'medium'\|'high'\|'xhigh'\|'max')[]`|`sdk.d.ts:1265-1271`|única base para ligar esforço|
|`EffortLevel = 'low'\|'medium'\|'high'\|'xhigh'\|'max'` e `Options.effort?: EffortLevel`|`sdk.d.ts:576`, `1735`|união exata de `EFFORT_LEVELS`|
|`Options.model?: string`|`sdk.d.ts:1784`|opção compilada|
|`AccountInfo.apiProvider?: 'firstParty'\|'bedrock'\|...`|`sdk.d.ts:23`|detecção first-party (só o nome do provedor)|
|`Query.setModel(model?)` / `applyFlagSettings({effortLevel})`|`sdk.d.ts:2459`, `2506`|existem no pin, mas ficam FORA desta rodada|

O teste `compatibilidade com o SDK pinado 0.3.246` lê o `sdk.d.ts` e falha se qualquer um desses pontos divergir do pin. Nada de API de SDK mais novo do T3 (o T3 declara `^0.3.276`) foi usado.

## 2. Contrato do módulo (`desk/agents/claude-controls.cjs`)

Módulo puro, CommonJS, **zero imports** (nem `node:*`): não lê arquivo, não usa timer, não abre rede, não conhece IPC/DOM e não chama `query()`. Toda a decisão é função de dados.

|Export|Assinatura|Semântica|
|---|---|---|
|`EFFORT_LEVELS`|`readonly string[]`|união exata do `EffortLevel` nativo|
|`REASONS` / `SWITCH_REASONS`|`frozen map`|códigos estáveis de recusa|
|`sanitizeCatalog(source, {account})`|`source`: `ModelInfo[]` **ou** `{models}` **ou** lixo|catálogo sanitizado `{ok, reason, models, dropped, firstParty, accountProvider, modelSelection, effort}`; ausente/vazio/desconhecido fecha (`catalog_missing`/`catalog_empty`/`catalog_invalid`); teto de 200 modelos; duplicados/ inválidos contados em `dropped`|
|`looksLikeRouterModelId(value)`|`string`|heurística estreita (`/`, `@`, `:`, prefixos bedrock/vertex/ gateway/ARN). Defesa em profundidade; a autoridade continua sendo o catálogo|
|`resolveCatalogEntry(catalog, value)`|→ entrada ou `null`|`value` exato → `resolvedModel` (id explícito persistido casa com a linha de alias que o cobre) → case-insensitive|
|`effortSupport(entry)`|→ `{supported, levels, reason}`|`supportsEffort===true` **e** lista não vazia; flag sem níveis = indisponível (regra conservadora)|
|`normalizeEffort(entry, requested)`|→ `{ok, effort, levels, reason}`|pedido sem suporte/fora da lista recusa; sem pedido devolve `effort:null` (default nativo)|
|`compileSelection(selection, catalog, {account, firstPartyOnly=true, allowUnlistedModel=false})`|`selection`: `{model?, effort?}`|coração do contrato (abaixo)|
|`selectionFromDescriptor(descriptor)`|→ `{model, effort}`|extrai só strings do descritor; não valida|
|`canSwitchSelection({uncertain, busy, hasTurn, pendingPermission})`|→ `{allowed, reason}`|incerto → ocupado → turno → permissão/pendente seguram a troca|
|`modelsForSelector(catalog, {firstPartyOnly=true})`|→ `{provider:'anthropic', id, name, description, resolvedModel}[]`|formato do seletor que a Mesa já usa no Pi|
|`selectionView(catalog, {firstPartyOnly, account})`|→ `{modelSelection, effort, models, defaultModel:null, firstParty, catalogReason}`|fatos para a UI; `defaultModel:null` = default do Claude Code|
|`effortLevelsFor(catalog, model)`|→ `string[]`|níveis nativos do modelo escolhido (vazio = controle desligado)|
|`readCatalogFromQuery(query, {account})`|`async`|lê `supportedModels()` de uma Query **já conectada**, cai para `initializationResult().models` só se o preferido não existir; falha = `catalog_unavailable`, sem retry; sem Query = `catalog_missing`|

### `compileSelection` — resultado e regras

Sucesso: `{ok:true, model, effort, options, patch, levels, entry, reason:null, detail:null}`
Recusa: `{ok:false, reason, model:null, effort:null, options:{}, patch:null, levels, entry:null, detail}`

- `options` é o que entra na `query()` do SDK: `{model}` ou `{model, effort}`. Sem seleção, `{}` — o default do CLI é preservado.
- `patch` é o que o pai persiste no descritor: `{model:'sonnet', effort:'high'}` (ou `{model:null, effort:null}` para voltar ao default nativo).
- `firstPartyOnly` (default `true`): conta conhecida ≠ first-party recusa (`account_not_first_party`); id com cara de roteador recusa (`model_router`); modelo explícito precisa estar no catálogo nativo (`model_unknown`); catálogo ruim recusa (`catalog_unavailable`, `detail` = razão do catálogo).
- Esforço: só compila com entrada do catálogo e metadado nativo; `effort_requires_model` sem modelo, `effort_unsupported` sem metadado, `effort_unknown` fora dos níveis, `effort_unverified` para modelo fora do catálogo (escape 3P). Nunca "usa o default" por adivinhação.
- `allowUnlistedModel` só vale com `firstPartyOnly:false` (experimento de gateway/custom) e continua proibindo esforço não verificado.
- Sem `model`/`effort`, `compileSelection` responde `ok` mesmo com catálogo ruim: não escolher nada é sempre o default nativo.

## 3. Integração recomendada (pai)

1. **Catálogo só em ação explícita do usuário.** Depois de uma conexão já existente (a `Query` do primeiro turno/conexão de controle), chamar `readCatalogFromQuery(query, {account})` no clique de "atualizar modelos" ou no connect explícito. Não iniciar consulta só para catálogo, não usar `pi-health`/background, não chamar `supportedModels()` periodicamente. `initializationResult()` (cache) é o fallback aceitável quando não há `supportedModels`.
2. **UI.** `get_available_models` do serviço Claude passa a devolver `selectionView(catalog)`, e o `get_state`/`levels` do renderer usam `effortLevelsFor(catalog, seleção)`. `selectionView.defaultModel` nulo mantém o rótulo atual ("Claude Code"). Campos extras do seletor vêm do catálogo; nenhum nome de modelo é fixado em código.
3. **Persistência por conversa.** O descritor `schemaVersion 1` já aceita `model`; o pai precisa acrescentar `effort` ao `validateDescriptor`/`updateClaudeConversation` (`desk/agents/conversations.cjs`) — `descriptor-cache.cjs` já copia `effort`, e o núcleo pode ganhar lei/própria para o teto. Fluxo: `selectionFromDescriptor(read)` → `compileSelection(selection, catalog, {account})`; gravar `compiled.patch`; se `ok:false`, **não** gravar meia escolha nem usar opções antigas: manter o default nativo e avisar com o `reason`/`detail`. Escolha persistida que sumiu do catálogo nativo é recusada, não restaurada silenciosamente.
4. **Opções da consulta.** Em `ClaudeAdapter._buildOptions`, espalhar `compiled.options` no objeto de opções do SDK. Sem seleção, nada é espalhado. A troca de escolha só é aplicada com `canSwitchSelection({uncertain, busy, hasTurn, pendingPermission}).allowed` — turno/permissão/entrega incerta bloqueiam (mesmo portão do `setToolPolicy`); `setModel`/`applyFlagSettings` existem no pin, mas troca a quente fica para rodada própria.
5. **Capacidades/Bend.** O pai deve substituir os fatos fixos de `core/agentcaps.bend#claudeCaps` por fatos derivados do catálogo (ex.: `modelSelection = catalog.ok && models.length>0`; `effort = metadado presente em algum modelo visível`), fechando leis/provas novas no núcleo. Invariantes sugeridos: (a) catálogo inválido nunca liga `modelSelection`; (b) `effort` só liga com `supportsEffort`+níveis; (c) troca bloqueada com motor ocupado/incerto; (d) sem seleção = opções vazias (default nativo). Esta rodada não tocou `core/`.

## 4. Evidência executada (sintética)

```sh
cd desk
node --test tests/claude-controls.test.mjs
```

`12/12` passam (`sanitize`/aliases/limites, fail-closed de catálogo, visão do seletor, default nativo preservado, resolução alias↔resolvedModel, first-party/roteador, esforço conservador, round-trip de descritor, portão de troca, leitura da Query, compatibilidade com `sdk.d.ts` 0.3.246 e pureza do módulo). `node --check` passa nos dois arquivos. Nenhum binário, credencial, sessão, runtime, `.runtime/` ou material de curso foi lido/escrito; nenhuma inferência ou login.

## 5. Limites e pendências

- A semântica REAL de `supportedModels()` (ordem, alias, catálogo por conta) não foi exercitada: só dados sintéticos + tipos do pin. A etapa autenticada continua sendo do pai.
- Sem provider real, `firstParty` é null quando a conta não é informada; o compile ainda exige catálogo e recusa roteador, mas a checagem de conta só acontece com `account`.
- O módulo não implementa fastMode/thinking/context window do T3 (`ModelInfo` do pin os expõe como metadado e eles são preservados na sanitização, mas não compilados) — ficam para outra rodada, se o pai quiser.
- A leitura do catálogo depende de uma `Query` viva; se o pai não guardar a Query do connect, precisará decidir como reusá-la (a rodada não altera o adaptador).
- Troca a quente (`setModel`/`applyFlagSettings`) não foi implementada; o contrato desta rodada é: escolha no descritor + opções da próxima consulta + bloqueio enquanto ocupado.

## 6. Arquivos desta rodada

|Arquivo|Papel|
|---|---|
|`desk/agents/claude-controls.cjs`|novo módulo puro (dono: esta rodada)|
|`desk/tests/claude-controls.test.mjs`|12 testes sintéticos (dono: esta rodada)|
|`docs/reviews/mesa-t3-controls-design-20261005.md`|este documento|

Nenhum outro arquivo foi editado. T3: nenhuma cópia; referência conceitual sob MIT.
