Trabalho concluído neste turno. Segue o relatório de handoff consolidado.

## Status

Patches dos achados abertos entregues **exclusivamente** nos arquivos sob minha posse. `claude-adapter.cjs` **não foi tocado** — verifiquei que o fix do `MessageQueue.next()` já está aplicado no arquivo atual (`agents/claude-adapter.cjs:174` → `return await new Promise(...)`; `push` chama `onTaken`), e a integração comprova 3 turnos consecutivos.

## Arquivos (8, todos no ownership)

| Arquivo | Mudança nesta rodada |
|---|---|
| `desk/src/state.mjs` | `S.uncertain`/`S.turnCancelled`; `mayAdvanceQueue()` consumindo `generated/agentdelivery.core.js` com fatos reais (`busy`, `dialogPending`, incerteza, cancelamento); `applyEngineData` fixa/limpa os fatos por conversa; **cache do descritor renderizado no `loadCourse`** (offline/sem login continua visível); rótulo do motor quando não conectado (nunca "Pi" numa conversa Claude falha) |
| `desk/src/chat.mjs` | `desk-stop`/`agent_settled` marcam cancelamento (turno) e incerteza (conversa); `agent_start`/comando do usuário limpam cancelamento; bolha id-aware (stream+final no mesmo nó, sem duplicata) — mantido |
| `desk/src/queue.mjs` | `flushQueue` usa `mayAdvanceQueue()` (permissão/turno/incerto/cancelado vetam); "Enviar agora" é comando explícito (`force`), limpa o cancelamento e tenta 1 vez sem auto-retry; `release()` limpa o fato; listener `desk-idle` embrulhado |
| `desk/src/main.mjs` | `detectedClaude` agora por veracidade (`!!data.detectedClaude`) no boot e no save; `showHistory(data.messages)` em `new-session`/`open-session` antes do connect (cache visível se o connect falhar); `showHistory` importado |
| `desk/tests/fixtures/claude-sdk-fake.mjs` | `getSessionMessages` usa `storeDir(options)` (mesma pasta do escritor: `FAKE_CLAUDE_STORE`/`.claude-fake-sessions`) e honra `offset`/`limit` com `.slice`; `trace('history',…)` para o smoke provar a paginação |
| `desk/tests/claude-ui-smoke.mjs` | Reescrito: cenários 1–8 (ver abaixo) |
| `desk/index.html` | Sem mudança nesta rodada (r1) |
| `desk/src/review.mjs` | Sem mudança nesta rodada (r1: Claude mantém caderno manual, sem sugestão automática) |

## Achados → estado

1. **Smoke (5 pontos)**: rótulo Pi comparado à baseline e fixado em `Pi de teste`; dica ociosa agora espera `/⏎ envia/` (sem "enfileira") e a ocupada `/enfileira/` (sem "interrompe"); 1º prompt é texto comum (`fixture`) e o de imagem usa `[claude:image]` esperando `1 bloco(s)`; permissões usam `Read` (permitida, diálogo real) e o log confirma `images:1`/`marker:image`; export espera o título exato `## Claude`.
2. **paintLive** já usava `S.agentLabel` — confirmado.
3. **detectedClaude** — corrigido por veracidade nos dois caminhos (boot e save).
4. Descritor quente — host (A/principal), fora de mim.
5. Bilhete pendente — host (principal), conforme brief.
6. **Toast duplicado de fila** — já era transição (`!wasHeld`) — confirmado.
7. Descritor corrompido — host (A), conforme brief.
8. **`mayAdvanceQueue`** consumido com fatos reais; Pi preservado (fatos falsos no fluxo normal, `held`/`desk-stop` seguem iguais).
9. **Cache nativo visível offline/auth fail, sem fallback Pi** — render no `loadCourse` + `new-session`/`open-session`; smoke cenário 7 (probe da CLI falha, cache na tela, zero Pi).
10. **Smoke de fila** — permissão pendente não avança e turno confiável libera (5a); aceite com turno aberto não avança, cancelar segura (5b); incerto não repete sozinho (5c); conversa nova não leva a fila e reabrir recupera segurado (cenário 6); rollback Pi preservado com histórico (cenário 8).

## Cenários do smoke (standalone, 4 lançamentos)

1. Pi baseline (trap + fake-pi) → seletor cria Claude (descriptor JSON + `nativeSessionId`), capacidades gated, **zero processo Pi**.
2. Texto e imagem sem bolha duplicada (contagem + ocorrência única; replay não duplica), log com `images:1`.
3. Permissões permitir/negar pelo diálogo real + **fila de diálogos cancelados por `agent_request_cancelled`** + evento de outra conversa ignorado.
4. Fila: espera permissão/turno, não avança só com o aceite, cancelamento segura, incerteza não repete.
5. Rexport: reabrir com fila recuperada, **sentinel que só existe no store nativo aparece no export** + trace com `limit:200`/`offset>0` (paginou de verdade), título `## Claude`; conversa nova não vaza fila; dreno pós-settle.
6. Offline (trap falha no probe): cache visível, rótulo Claude Code, zero Pi.
7. Sem binário (`detectedClaude:''` + HOME falso): **não tenta conectar nem toasta**, cache visível, CLI nem executada; seleciona a conversa Pi original e confirma "Pitágoras" no histórico e processo Pi vivo.

## Validações executadas (sem Electron/build/gates)

- `node --check` em `state.mjs`, `chat.mjs`, `queue.mjs`, `main.mjs`, `claude-ui-smoke.mjs`, `claude-sdk-fake.mjs` → OK.
- `node tests/fixtures/claude-sdk-fake.mjs` → `FAKE SDK SELF-TEST PASSED`.
- Integração pura com o **adaptador real do repo** + fixture (script em `/private/var/folders/.../opencode/claude-c-integr.mjs`): 3 turnos consecutivos aceitos/settled, store compartilhado, `offset/limit` e **export nativo de 505 linhas** (falharia no teto se repetisse página).

## Limites conhecidos (root roda)

- **Electron não rodado** por mim (conforme instrução): `cd desk && node tests/claude-ui-smoke.mjs` fica para o root. O smoke tem ~4 lançamentos e usa HOME falso no cenário 8 (mesma técnica do `hunt-chaos`); se algo falhar, os artefatos caem em `desk/tests/artifacts/claude-ui-*`.
- `slash.mjs` (fora da minha lista) continua listando `/compact` em conversa Claude, mas o `send()` recusa com aviso explícito.
- Nada de commit/push/login/inferência/build; `.runtime`, credenciais e `Courses` intocados; `agents/`, `core/`, `main.cjs`, `preload.cjs`, `config.cjs`, package/lock e docs sem edição.

Critério de conclusão: patches + validação nodecheck/selftest entregues; a verificação real (smoke Electron, unit completo, Bend) é do root — não declaro completo antes disso.
