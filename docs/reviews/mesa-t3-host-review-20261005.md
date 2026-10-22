# Revisão do host Mesa ↔ Claude (rodada `t3-host-review-r1`)

5 de outubro de 2026. Subagente de revisão (OpenCode/DeepSeek) sobre a segunda
implementação experimental da integração Claude. **Somente leitura dos arquivos
de produto**; o único arquivo escrito nesta rodada é este relatório. Sem login,
inferência autenticada, execução do Claude real, atualização de SDK/CLI,
dependência nova, `install-app`, commit, push ou release. Nenhum arquivo de
`chat/`, credencial, sessão pessoal, configuração pessoal ou material de curso
foi lido ou tocado. Testes apenas sintéticos, com runtime temporário (fora do
repositório, exceto o runtime ignorado do próprio harness e o artefato de falha
registrado em `desk/tests/artifacts/`).

Referência de comportamento: checkout público do T3 Code em
`/tmp/mesa-t3code-research-20261005`, commit
`1604ccc9d79f5270fb8e14d60664184bf142c4cb`; inspeção do código real
(`ClaudeAdapterV2.ts`, `claudeModelOptions.ts`), não apenas README. **Nenhum
código do T3 foi copiado**; o aviso MIT © 2026 T3 Tools Inc. continua sob
responsabilidade do pai.

Escopo desta revisão: `desk/main.cjs`, `desk/agents/service.cjs`,
`desk/agents/conversations.cjs`, `desk/agents/descriptor-cache.cjs`,
`desk/src/state.mjs`, `desk/agents/claude-controls.cjs` (módulo puro), testes de
serviço/conversas/controles e os harnesses Electron novos de controles e ciclo
de vida. `desk/agents/claude-adapter.cjs` e `desk/src/chat.mjs` são de outros
agentes (`native-controls-r2`, `question-ui-r1`) e foram apenas inspecionados
quando necessário para o contrato do host; não editei nem rodei a suíte ampla.

## Snapshot e concorrência

`service.cjs`, `claude-adapter.cjs` e `claude-lifecycle-integration.test.mjs`
foram editados por outro agente **durante** esta revisão (o hash do serviço
mudou de `6d5a5e71…` para `f858f972…`; o do adaptador de `b4e2528e…` para
`494fc9f3…`). As conclusões abaixo referem-se a estes hashes finais (conferidos
às 15:38Z); a reprodução do achado H1 foi reexecutada no hash final.

| Arquivo | sha256 |
| --- | --- |
| `desk/main.cjs` | `37268dc2…bb7b34d3` |
| `desk/agents/service.cjs` | `f858f972…20c2cc3c` |
| `desk/agents/conversations.cjs` | `c1e3b8e4…2dc39ae2` |
| `desk/agents/descriptor-cache.cjs` | `ce26e383…ef92e323` |
| `desk/agents/claude-controls.cjs` | `2d8c1c55…d91a8453` |
| `desk/src/state.mjs` | `b004a956…c5e754b1` |
| `desk/agents/claude-adapter.cjs` (só leitura) | `494fc9f3…cef2d72` |
| `desk/tests/agent-service.test.mjs` | `f4daceb6…75fba82b` |
| `desk/tests/conversations.test.mjs` | `a7178217…b056e13f` |
| `desk/tests/claude-controls.test.mjs` | `662dddb3…3657b69` |
| `desk/tests/claude-controls-ui.mjs` | `aeb6bf5e…ed51683` |
| `desk/tests/claude-lifecycle-ui.mjs` | `5c5e6533…b378e33b` |
| `desk/tests/claude-lifecycle-integration.test.mjs` | `833e7392…d4cea5f` |

Um ponto já corrigido pela edição concorrente e que **não** é mais achado: o
`rendererEvent` agora repassa `detail`/`fatal` de `warning`/`error`
(`service.cjs:21-22`), coberto pelo primeiro teste do `agent-service.test.mjs`.

## Resumo executivo (priorizado)

| # | Prioridade | Achado | Onde |
| --- | --- | --- | --- |
| H1 | **P1** | Incerteza **persistida** no descritor não entra no portão de controles: depois de reabrir, trocar modelo/esforço numa conversa `uncertain` é aceito (o Bend manda bloquear) | `service.cjs:27-30,46`; `main.cjs:384-388,859-884`; `claude-adapter.cjs:663,985`; `state.mjs:309,347-348` |
| H2 | **P1** (teste) | `claude-controls-ui.mjs:38` espera elemento **escondido** com o estado default "visible" do Playwright ⇒ o harness sempre morre ali e não exercita default/busy/restore/zero-Pi | `desk/tests/claude-controls-ui.mjs:38` |
| H3 | P2 | Os harnesses Electron novos (`claude-controls-ui.mjs`, `claude-lifecycle-ui.mjs`) não estão ligados a nenhum runner (`npm test`, `test:claude-ui` e `run-hunts` não os pegam) | `desk/package.json:8,24`; `desk/tests/run-hunts.mjs:40` |
| H4 | P2 | `boundMessages` re-serializa a lista inteira a cada item cortado: com imagem e teto de 12 MiB, uma gravação medida custou ~0,45 s síncronos no main | `conversations.cjs:363-367`; `service.cjs:41` |
| H5 | P3 | União de esforço fixada de novo em `main.cjs:877`, em vez de sair de `claude-controls.EFFORT_LEVELS` (risco de drift quando o pin ganhar nível novo) | `main.cjs:877` vs `claude-controls.cjs:38` |
| H6 | P3 | `pi-prompt` Claude altera a política de caminhos (`setToolPolicy`) antes do portão de envio do serviço; uma corrida perdida deixa os caminhos trocados sem rollback | `main.cjs:928-932` |

O achado do briefing "valida esforço contra o modelo ANTIGO" **não procede na
revisão auditada**: já está corrigido em `main.cjs:867-880` (quando há
`model` no patch, o nível é validado pelo `compileSelection` do adaptador contra
o catálogo do modelo NOVO, atomicamente). Evidência na seção "Verificado limpo".

## H1 (P1) — Incerteza persistida não hidrata o portão de controles

**Contrato esperado.** `canChangeControls`/`canSwitchSelection` bloqueiam troca
de modelo/esforço com entrega incerta (`core/agentdelivery.bend:71-74`;
`claude-controls.cjs:329-336`); o adaptador documenta que a incerteza de entrega
"é fato do adaptador (o Bend a usa no portão dos controles)"
(`claude-adapter.cjs:1431-1434`).

**Estado atual.** `this.uncertain` no `ClaudeService` só é ligado por
**eventos da execução corrente** (`service.cjs:30`); o construtor não aceita
incerteza inicial (`service.cjs:27`). O `main` constrói o serviço sem informar o
estado do descritor (`main.cjs:384-388`), embora já tenha lido
`record.delivery.status === 'uncertain'` em outros caminhos (`main.cjs:931`
bloqueia envio). No adaptador, `_deliveryUncertain` nasce `false`
(`claude-adapter.cjs:663`) e o portão lê esse fato (`:985`) — ou seja, os dois
portões nascem "limpos" numa reabertura. O `pi-settings` do Claude
(`main.cjs:859-884`) também não consulta o descritor: checa só
`bridge.isRunning` (`:862`). Na UI, `S.uncertain` existe
(`state.mjs:18,56`) mas os seletores só desabilitam por `S.busy`/capacidade
(`state.mjs:309,347-348,358`).

**Reprodução (sintética, sem Electron/SDK; descritor em tmp + adaptador falso,
o mesmo construtor do `main`):**

```
$ node /private/var/.../T/opencode/mesa-t3-host-review/repro-uncertain.mjs
descritor apos recuperacao: uncertain
set_controls permitido com entrega incerta? SIM -> {"model":"claude-fake","effort":"high"}
segundo set_controls com incerteza em memoria: RECUSADO -> Aguarde o turno e os pedidos pendentes antes de mudar os controles.
```

A segunda linha mostra que o portão funciona quando o fato chega por evento; a
falha é só a hidratação a partir do disco (reabertura).

**Impacto.** Invariante de aceitação violado: o usuário troca modelo/esforço numa
conversa cuja entrega anterior ficou incerta (o contrato manda "comece outra
conversa"). Não há reenvio, duplicação nem perda de dados; o impacto é de
contrato e de futura interação com um fluxo de resolução de incerteza. P1 pela
invariante explícita da rodada.

**Correção sugerida (host, não editei).**
1. `ClaudeService` aceitar `uncertain=false` no construtor e usá-lo no lugar de
   `this.uncertain` inicial; `main.cjs:384` passa
   `uncertain: record.delivery?.status==='uncertain'`.
2. Semear o adaptador também (ex.: opção `deliveryUncertain` no construtor,
   aplicada em `claude-adapter.cjs:663`), porque `_controlsGate` tem autoridade
   própria; o serviço sozinho não cobre quem chamar o adaptador direto.
3. Defesa em profundidade no `main.pi-settings` (checar o descritor antes de
   `set_controls`) e na UI (`state.mjs`: desabilitar seletores quando
   `S.uncertain`, como o `setBusy` faz).

## H2 (P1, teste) — `claude-controls-ui.mjs:38` nunca passa

**Estado atual.** O harness espera um elemento **escondido** com
`page.waitForSelector('#effort-field[hidden]')`; o estado padrão do Playwright é
`visible`, então a espera sempre estoura quando o produto está correto (campo
escondido).

```
$ node tests/claude-controls-ui.mjs
[artefatos] falha registrada em: .../desk/tests/artifacts/2026-10-05T15-34-32-559-claude-controls
page.waitForSelector: Timeout 30000ms exceeded.
  - waiting for locator('#effort-field[hidden]') to be visible
  63 × locator resolved to hidden <label hidden="" id="effort-field">…</label>
    at tests/claude-controls-ui.mjs:38:13
```

O produto fez o certo (o campo **é** escondido quando o modelo não suporta
esforço); o teste é que está errado.

**Impacto.** Todo o restante do harness — default nativo (linhas 42-46), modelo
novo + `thinking-select`/envio (47-50), portão de ocupado (51-55), reabertura
com restauração (58-62) e "zero Pi" (63) — nunca roda. É o único teste
end-to-end do contrato de controles desta rodada.

**Evidência do que passou antes do ponto de falha.** As linhas 20-37 rodaram:
inicialização de catálogo **sem prompt** (`rows().length===0`), patch combinado
`claude-fake`+`max` aceito e persistido (`record.effort==='max'`), patch
combinado `claude-lite`+`max` recusado **atomicamente** sem alterar
`model`/`effort`, e identidade nativa preservada. Ou seja, a correção do
briefing está confirmada por execução até a linha 37.

**Correção sugerida (uma linha).** Trocar por
`await page.waitForFunction(()=>document.querySelector('#effort-field')?.hidden===true)`
(ou `waitForSelector('#effort-field',{state:'attached'})` seguido de assert de
`hidden`).

## H3 (P2) — Harnesses novos não estão ligados a runner

`npm test` roda só `tests/*.test.mjs` (`package.json:8`); `test:claude-ui` roda
apenas `claude-ui-smoke.mjs` (`package.json:24`); `run-hunts.mjs` só pega
`hunt-*.mjs` (`tests/run-hunts.mjs:40`). Grep em `desk/**` não encontra nenhuma
referência a `claude-controls-ui.mjs` nem `claude-lifecycle-ui.mjs`. O
`claude-lifecycle-integration.test.mjs` **é** pego pelo glob do `npm test`.
Correção: registrar os dois `.mjs` num script próprio (ou no `test:claude-ui`),
senão os cenários de controles/ciclo de vida só rodam por invocação manual.

## H4 (P2) — `boundMessages` O(n²) com lista no teto

`conversations.boundMessages` (`conversations.cjs:363-367`) chama
`bytes(list)` (JSON.stringify da lista inteira) a cada `shift`; o
`service.cjs:41` chama isso a cada `message_end` e o
`updateClaudeConversation` chama de novo. Medição sintética (lista de 16,2 MB
com uma imagem de ~3,5 MiB, fluxo real de anexo):

```
mensagens: 123  bytes JSON: 16170125
boundMessages: 449.1 ms; restaram 87 msgs; bytes: 12481601
updateClaudeConversation(messages): 480.8 ms
```

Perto do teto de 12 MiB com mensagens grandes (imagens/textos de até 400k
caracteres), cada gravação pode custar ~0,5 s síncronos no processo principal
além dos 27–41 ms de escrita já registrados no STATUS. Sugestão: acumular
tamanho do fim para o começo (um `JSON.stringify` por mensagem nova) em vez de
reserializar a lista a cada corte. Não é bloqueador de aceitação; é o limite de
desempenho já conhecido, agora quantificado no pior caso.

## H5 (P3) — União de esforço duplicada no host

`main.cjs:877` fixa `['default','low','medium','high','xhigh','max']`. A união
nativa já é `claude-controls.EFFORT_LEVELS` (`claude-controls.cjs:38`), coberta
por teste contra o `sdk.d.ts` pinado. Se o pin ganhar um nível, o host o recusa
silenciosamente antes do adaptador. Usar a constante do módulo (ou delegar o
nível só ao compilador, como já se faz quando há troca de modelo).

## H6 (P3) — `setToolPolicy` fora do portão de envio

`main.cjs:928-932`: o caminho Claude valida a política e chama
`b.adapter.setToolPolicy(...)` antes de `b.request('prompt')`. Se a corrida for
perdida (ex.: `set_controls` em andamento), o `service.prompt` recusa por
`_configuring`, mas os `readPaths` já foram trocados e não voltam. Impacto
prático baixo (o próximo envio reescreve a política), mas a ordem "validar →
conectar → portão → trocar" seria mais fiel ao resto do desenho. P3.

## Verificado limpo (não repetir; já coberto ou corrigido)

- **Patch combinado modelo+esforço**: `main.cjs:867-880` valida o nível pelo
  catálogo nativo do modelo novo (o adaptador compila e persiste depois do
  sucesso, com rollback). Executado no harness até a linha 37 (ver H2). No T3,
  `compileClaudeModelSelection` (`claudeModelOptions.ts:28-58`) compila a
  seleção inteira de uma vez — mesma semântica de "sem meia escolha".
- **Limites de resposta a pergunta**: `main.cjs:972-981` usa exatamente 16
  chaves, 4000 caracteres por chave/resposta e 32 opções, batendo com
  `claude-questions.mjs:28-31` (`MAX_QUESTIONS`/`MAX_ANSWER_CHARS`/`MAX_OPTIONS`).
  Resposta inválida não derruba o pedido: `pi-response` lança antes de
  `pendingDialogs.delete` (`main.cjs:983-985`) e o `respond` do adaptador devolve
  `ok:false` sem fechar a entrada (`claude-adapter.cjs:1277-1311`), então o
  diálogo continua para nova tentativa. Id vencido/desconhecido é recusado; TTL
  e cancelamento emitem `permission_cancelled` e limpam `pendingDialogs`.
- **Corrida de ocupado**: os fatos são marcados antes do primeiro `await`
  (`service.cjs:46,70`) e o adaptador revalida por dentro
  (`claude-adapter.cjs:1167-1174`); `pi-settings` relê `isRunning` depois do
  `get_state` (`main.cjs:861-862`). Não encontrei janela que aplique troca com
  turno/permissão pendentes.
- **Cancelamento**: `main.cjs:964` (`pi-abort` → `clear_queue`+`abort`) e o
  caminho aceite→interrupt→fim de consulta estão cobertos pelos testes do
  adaptador (ver "Estado observado" — ainda em fiação).
- **Metadados/cache**: `DescriptorCache` invalida por
  `dev:ino:size:mtimeMs:ctimeMs` (`descriptor-cache.cjs:6-15`) e toda escrita é
  atômica com rename — o inode muda, então não há leitura velha após gravação do
  próprio app. Nada de credencial/pessoal entra no cache (allowlist de campos em
  `descriptor-cache.cjs:14`).
- **Persistência/identidade**: `updateClaudeConversation` valida antes de
  escrever e mantém o arquivo anterior byte a byte em falha
  (`conversations.cjs:299-358`); `nativeSessionId` é imutável
  (`:307-310`); `recoverClaudeConversation` converte transmitting/accepted em
  `uncertain` sem reenvio (`:430-441`). Testes: 12/12 verdes.
- **Credenciais**: `claude-environment.cjs` lê só `loggedIn`,
  `authMethod`, `apiProvider` (`:55,103-109`), lista conflitos por **nome** de
  variável (`:111-118`) e nunca ecoa stdout/stderr; o adaptador só expõe o nome
  do provedor (`claude-adapter.cjs:962-967`), e `claude-controls.cjs:82-94`
  sanitiza a conta. Nenhum e-mail/organização/token chega ao renderer ou ao
  descritor.
- **Saúde não abre consulta / conexão explícita inicializa catálogo sem
  prompt**: `get_state` só chama `adapter.connect` (`service.cjs:44`), que
  detecta binário/versão/login sem `_ensureQuery` (`claude-adapter.cjs:728-760`);
  `pi-connect` inicializa controles só em ação explícita (`main.cjs:817`).
  Testes do `agent-service` cobrem ("health and metadata do not start
  controls") e o harness confirmou `rows().length===0` após o online.
- **Escolha desejada ≠ modelo observado**: o descritor guarda o patch desejado
  (`onSelection` → `updateClaudeConversation`); o modelo observado vem do `init`
  (`snapshot().model`/`_currentModelInfo`) e nada o grava por cima. A UI usa
  `state.selection` para o seletor e o observado para o rodapé (`state.mjs:339-346`).
- **Troca de runtime/matéria/conversa**: `save-config` recusa mudar
  `runtimePath` com o app aberto (`main.cjs:802-803`); `switch-course`,
  `new-session` e `open-session` chamam `assertIdle` + `stopBridge` antes de
  trocar a sessão (`main.cjs:428-434,642,987,997`); nenhuma rota inicia Pi numa
  conversa Claude.
- **Respostas já corrigidas de limite de primeiro nível e AskUserQuestion** não
  foram reabertas; continuam cobertas pelos testes vistos (policy 40/40 e
  adaptador do agente de transporte).

## Estado observado (WIP do pai; não é achado novo)

`claude-lifecycle-integration.test.mjs` (que roda no `npm test`) está **7/9
vermelho** no snapshot final, e o `claude-adapter.cjs` mudou de hash durante a
revisão — consistente com "policy implementation pending wiring" e as
regressões de integração já conhecidas do pai. Falhas observadas: resultado sem
eco não liquida; origem não-humana/turno zero/lixo estrangeiro não seguram;
interrupt + fim de consulta fica `uncertain` em vez de `settled`;
`blocking_limit` sem código; `api_retry` sem `detail`. Não reli esses caminhos
como achados (adaptador é de `native-controls-r2`); reexecutar quando a fiação
terminar. O harness `claude-lifecycle-ui.mjs` depende dos mesmos cenários e não
foi executado para não competir com as edições concorrentes.

## Testes executados nesta revisão

| Comando | Resultado |
| --- | --- |
| `node --test tests/agent-service.test.mjs tests/conversations.test.mjs tests/claude-controls.test.mjs tests/descriptor-cache.test.mjs tests/claude-turn-policy.test.mjs` | **74/74** passam (inclui os 40 da policy e os 12 dos controles) |
| `node tests/claude-controls-ui.mjs` | morre em `:38` por bug do próprio teste (H2); linhas 20-37 passam; artefato em `desk/tests/artifacts/2026-10-05T15-34-32-559-claude-controls` (ignorado pelo git) |
| `node --test tests/claude-lifecycle-integration.test.mjs` | 2/9 passam; 7/9 falham (adaptador em fiação — ver acima) |
| `node /private/var/.../T/opencode/mesa-t3-host-review/repro-uncertain.mjs` | reproduz H1 |
| `node /private/var/.../T/opencode/mesa-t3-host-review/repro-bound.mjs` | mede H4 |

Não rodei `npm test` amplo (edição concorrente no adaptador, conforme o brief) e
não executei os testes do T3. Nada de autenticado foi executado.

## Limites não resolvidos

- Sem inferência autenticada: nada aqui prova o comportamento do CLI 2.1.246
  real (eco de UUID, setModel/applyFlagSettings ao vivo, retomada).
- O SVG "estado desejado" do adaptador foi inspecionado, não testado nesta
  rodada (arquivo de outro agente, em edição).
- H2 impede dizer por execução que default/busy/restore/zero-Pi do harness de
  controles passam; o código sugere que sim, mas fica como inspeção.
- Os hashes podem ter mudado depois de 15:38Z; se algum arquivo do escopo tiver
  hash novo, H1/H2 devem ser reconferidos (H1 é o mais sensível à edição
  concorrente).
