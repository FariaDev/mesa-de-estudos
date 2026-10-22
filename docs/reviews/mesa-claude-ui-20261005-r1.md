Implementação C concluída. Segue o relatório de handoff.

## Arquivos entregues (exclusivamente os autorizados)

| Arquivo | Mudança |
|---|---|
| `desk/index.html` | Seletor `#new-session-engine` (Pi / Claude Code experimental) ao lado de Nova conversa; ids `#model-field`/`#effort-field`/`#pi-settings`; campo `#cfg-claude` + Escolher; linha de ajuda do seletor |
| `desk/src/state.mjs` | `S.engine/S.agentLabel/S.capabilities/S.conversationStatus`; `capabilities()/supportsCapability()/engineLabel()`; `applyEngineData` aceita `capabilities` **e** `caps`; gating de modelo/esforço/auto-compactação/medidor; `supportsImages` = caps.images && model.input (se conhecido); rótulo/status/hint/atividade por motor; `fillSessions` fixa o seletor no motor ativo; `settings()` recusa modelo/esforço sem capacidade; toast de entrega incerta no connect |
| `desk/src/main.mjs` | `newSession(engine)` no fluxo atual (preserva conversa antiga; confirm próprio do Claude); ⌘/Ctrl+⏎ sem steer enfileira; `claudePath` no fill/readSettings; placeholder com `detectedClaude`; auto-connect por motor no boot/save |
| `desk/src/chat.mjs` | Filtro por `event.conversationId` (Pi sem campo continua); `agent_settled` com `cancelled/isError/uncertain` não emite `desk-idle` e segura a fila (`desk-failed`/`desk-held`); `desk_error` mantém hold; `agent_request_cancelled {id}` limpa fila/diálogo sem responder pedido vencido (quiz incluso); diálogo de permissão com `data-permission`; `message_start` id-aware (sem bolha duplicada do stream+final); gating de `/compact` e `conferirGeogebra`; envio incerto não repete |
| `desk/src/queue.mjs` | `enqueueFromComposer()` (fallback do ⌘⏎ sem steer); “Enviar agora” nunca vira steer/cancel; `desk-held` segura a fila; `holdQueue` não repete toast em sinal duplo |
| `desk/src/review.mjs` | Sem `reviewDraft` (Claude), o caderno manual continua e a sugestão automática não é pedida — status explícito |
| `desk/tests/claude-ui-smoke.mjs` (novo) | Smoke Electron/Playwright: Pi baseline via trap local, seletor cria conversa Claude (descriptor JSON), imagem encaminhada, **zero processo Pi**, permissões permitir/negar/cancelar com fila de diálogos, evento de outra conversa ignorado, reabrir + exportar com rótulo `## Claude`, incerto sem retry |
| `desk/tests/fixtures/claude-sdk-fake.mjs` (novo) | Fake do Agent SDK, só via `LEARNING_DESK_CLAUDE_SDK_FACTORY` (host restringe a `tests/fixtures/` + `DESK_TEST=1`). Exporta `query()` (async iterable com `initializationResult/supportedModels/supportedCommands/getSessionMessages/setPermissionMode/setModel/interrupt/close`) e `getSessionMessages(sessionId,{dir,limit,offset})`. Emite formas oficiais: `system:init`, eco de aceite `user isReplay` com o uuid do item, `stream_event`, `assistant` (com `user_message_uuid`) e `result`. Marcadores `[claude:image|permission-allow|permission-deny|stall|error|multi]`; env `FAKE_CLAUDE_LOG/STORE/SCENARIO/DELAY_MS/TRACE`; sem rede e sem executar binário |

Não editei `main.cjs`/`preload.cjs`/`config.cjs`/`core/`/`agents/`/`package`/`lock`/`docs`/outros testes.

## Validações que rodei (sem gates/build/smoke longo)

- `node --check` nos 7 arquivos JS → OK.
- `node tests/fixtures/claude-sdk-fake.mjs` → `FAKE SDK SELF-TEST PASSED`.
- Integração local fixture↔adaptador com **cópia temporária** do adaptador em `/tmp` (sem tocar no repo): 3 turnos seguidos (texto, imagem, permissão) aceitos e `permission_request` emitido.
- Não rodei o smoke Electron (host ainda em integração, conforme instrução).

## Bloqueio encontrado (não é meu arquivo; precisa de correção do principal/A)

`desk/agents/claude-adapter.cjs`, classe `MessageQueue`, `[Symbol.asyncIterator]().next()` (~linha 174):

```js
await new Promise((resolve) => this._waiters.push(resolve));
```

`push()` resolve o waiter direto com `{value:item,done:false}`, mas `next()` **descarta o valor resolvido** e volta ao loop (a `_items` já está vazia) — o item some. O primeiro prompt da sessão funciona (fica em `_items` antes do primeiro `next()`), **do segundo em diante a conversa Claude trava ocupada** (foi o que reproduzi). Correção de uma linha: `return await new Promise((resolve) => this._waiters.push(resolve));`. Com essa cópia corrigida, meus 3 turnos passaram. Sem isso o `claude-ui-smoke` não fecha.

Observação relacionada: o adaptador emite dois `message_start` por mensagem de texto (stream + final). Eu deixei o renderer id-aware (`message.id`) para não duplicar bolha; opcionalmente o adaptador pode chavear `_streamed` por `event.message.id`.

## Notas de integração

- `agents/service.cjs` expõe `caps` (o contrato congelado diz `capabilities`). A UI aceita os dois; sugiro alias `capabilities` nos payloads para fechar o contrato.
- `src/slash.mjs` (fora da minha lista) continua listando `/compact` local em conversa Claude; o `send()` recusa com aviso explícito. Quem quiser esconder o item precisa editar `slash.mjs`.
- Comandos para o principal, depois do host pronto e da correção acima: `cd desk && node tests/claude-ui-smoke.mjs` (e `node tests/fixtures/claude-sdk-fake.mjs` isolado). O smoke é standalone, fora do glob de `npm test`.
