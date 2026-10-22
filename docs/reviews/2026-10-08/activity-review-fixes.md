# Atividades — correções da revisão independente r4

Data: 2026-10-08. Escopo: domínio activity (runtime/store/bridge/host,
`src/activity.mjs`, ferramentas Pi/Claude, extensão `mesa-activity`, exemplos e
testes/fixtures `activity*`). Nenhum arquivo de root/chat/PDF/timeline/adapter/
`main.cjs` foi alterado; `preload.cjs` mudou só na validação do estado e
`src/main.mjs` continua apenas com a chamada `initActivityHost` do root.

Hashes (sha256): `activity-runtime.cjs d670afdc`, `activity-store.cjs 4cf5a28c`,
`activity-bridge.cjs d3f69ed8`, `activity-host.cjs a2edd4c8`,
`src/activity.mjs 8e323e8f`, `activity-call-gate.cjs cc81b9c3`,
`activity-tools.cjs 8a033d6e`, `mesa-activity/index.ts a00af900`,
`mesa-activity/client.mjs a679cfd4`, `preload.cjs 3bf372ff`.

## Evidência (Electron 44.2/macOS, sintético, sem provedor/dados)
- `node --test tests/*.test.mjs` → 1195/1195 (log `unit-tests.log`).
- `node tests/hunt-activity-isolation.mjs` → PASSOU: 28 vetores adversariais,
  122 asserts, 0 falhas (`hunt-isolation.log`).
- `node tests/hunt-activity-watchdog.mjs` → PASSOU, 12 asserts
  (`hunt-watchdog.log`).
- `node tests/hunt-activity-ui.mjs` → PASSOU, 50 asserts (`hunt-ui.log`);
  `mesa-interactive-ui.mjs`, `mesa-claude-activity-ui.mjs`,
  `native-activity-tool.mjs` e `hunt-activity-spike.mjs` (Gate A) passaram.
- `probe3-main.cjs` do revisor reexecutado: `udp:0`, só host+artefato, nenhum
  `about:srcdoc` (`probe3-udp0.json`).
- `probe2-main.cjs` do revisor reexecutado: sem `childHead`, UDP 0; com frames
  saudáveis vivos o watchdog recusa (`kill-failed` `shared-live`) e mata quando
  comprovadamente seguro (`result2.json`).
- Logs/JSON em `/private/tmp/mesa-activity-review-fixes/`.

## P1 — WebRTC escapa por `srcdoc` (realm filho)

Medido antes de decidir: o `will-frame-navigate` do Electron **não dispara** para
`srcdoc`/`about:blank` (o `frame-src 'none'` do Chromium também não o bloqueia);
o `frame-created` dispara, mas o `executeJavaScript` nele cai no realm
pré-commit e o filho nasce sem lockdown; `Page.addScriptToEvaluateOnNewDocument`
(CDP) valeria para o WebContents inteiro do app e cai quando o DevTools abre.
Decisão: a autoridade de isolamento fica no documento, sem depender de evento do
host.

- O html do modelo não é mais interpolado como markup: vira string JSON e é
  inserido pelo prelude do host via `innerHTML` (sink do sanitizador), depois do
  CSP/lockdown.
- `LOCKDOWN_SCRIPT`: `createElement`/`createElementNS` recusam
  `iframe|frame|frameset|object|embed|portal|fencedframe|applet`; TODA inserção
  (`appendChild`, `insertBefore`, `replaceChild`, `append`, `prepend`,
  `replaceChildren`, `before`, `after`, `replaceWith`, `insertAdjacentElement`,
  `Range.insertNode`, `surroundContents`) recusa subárvore com esses elementos;
  `innerHTML`/`outerHTML`/`insertAdjacentHTML` passam pelo sanitizador;
  `document.write/writeln/open/close` e `execCommand` bloqueados; `window.open`
  devolve `null`; scripts dentro do html são removidos (código vai em `js`);
  CSP `trusted-types default mesa-activity-policy` +
  `require-trusted-types-for 'script'` com default policy; MutationObserver como
  última rede. Nenhum original fica acessível ao código do modelo; tudo
  não-configurável. Os guards usam referências/accessors originais capturados
  antes do código do modelo (`Reflect.apply` capturado, getters de
  firstChild/nextSibling/parentNode/localName, `NodeList.item`), então
  envenenar protótipos depois não cega a sanitização.
- Prova: os 28 vetores incluem HTML cru, `srcdoc` por propriedade/atributo,
  `innerHTML`/`outerHTML`/`insertAdjacentHTML`, `document.write`,
  `DOMParser`+adopt, `Range.createContextualFragment`/`insertNode`, template,
  `createElementNS`, `setHTML`/`setHTMLUnsafe`, clone/import,
  `document.implementation`, `execCommand`, `about:blank`+write, `data:`, deep
  nested, fetch, `window.open`, acesso ao documento do topo e envenenamento de
  protótipos (`indexOf`/`toLowerCase`/getters de `Node`/`Element`/`NodeList.item`
  e `Reflect.apply`). Resultado: 0 UDP,
  0 HTTP, nenhum frame `about:srcdoc`, nenhum script de filho executou, host
  responsivo; DOM/SVG/canvas/template/insertAdjacentHTML legítimos continuam.
- Limites: o modelo é DOM/JS e a defesa cobre os vetores de criação de subframe
  do Chromium atual; exploração de memória do renderer está fora do modelo.
  "Offline" vale para a superfície medida neste ambiente. Efeito de contrato:
  scripts inline no html não executam (guias de ferramenta/extensão/exemplos
  atualizados; o canal é `js`).

## P1 — Watchdog com processo compartilhado

- Preservada a guarda do root: PID do SO + `creationTime` da métrica `Tab`,
  `mainPid` conhecido e diferente, nenhum frame alheio, nunca o renderer da
  janela.
- Extensão: o kill por processo compartilhado só é liberado quando **todos** os
  outros frames vivos do mesmo pid forem entradas do watchdog confirmadas
  (`misses >= 3` e `>= 2,5 s` sem ping). Timeout transitório não mata; cada tick
  tenta de novo. O caminho destacado exige 2 pings falhos + 2,5 s (antes, 1).
- Prova `hunt-activity-watchdog`: 3 atividades no mesmo OOPIF (medido), laço a
  ~12% de CPU, Parar, `kill` com `reason:shared-stalled`, pid some de
  `getAppMetrics`, host responsivo, atividade nova monta e roda. IPC do renderer
  (comparação usada pelo `trustedMainSender`) continua autorizado após o kill.
- Nota para o root: depois do SIGKILL do OOPIF compartilhado,
  `webContents.mainFrame.framesInSubtree` pode lançar "Render frame was
  disposed" (o host e o IPC seguem funcionando; o runtime captura e a próxima
  montagem carrega). Se quiser que as outras atividades travadas virem "Parar"
  antes do kill, seria preciso encaminhar `onWatchdog` ao renderer no
  `main.cjs` — não é requisito da correção.

## P2 — Reiniciar com quota cheia despejava outro card

- `mount()` agora para o PRÓPRIO frame antes de `enforceMountBudget`; reiniciar
  um card montado não conta mais como exceção sem vaga.
- Teste `hunt-activity-ui` 7e: 3 cards montados, Reiniciar no do meio, os outros
  dois mantêm o MESMO iframe (dataset de prova) e o total segue ≤ 3.

## P2 — Estado 16 KiB + tentativa 4 KiB sumia sem erro

- Contrato escolhido e alinhado em store/preload/renderer: `values` ≤ 16 KiB,
  `attempt` ≤ 4 KiB (JSON UTF-8 por campo) e envelope `{values, attempt}` ≤
  21 KiB (21504 B). O store ganhou `MAX_VALUES_BYTES`, `MAX_ATTEMPT_BYTES` e
  `MAX_STATE_ENVELOPE_BYTES` (mantendo `MAX_STATE_BYTES` = 16 KiB por compat).
- O renderer mostra erro quando algum teto estoura em vez de `dirty=false`
  silencioso; o save de um estado menor volta a funcionar.
- Testes: store aceita `values 13.000 B + attempt 3.500 B` e recusa
  `values > 16 KiB`/envelope > 21 KiB; `hunt-activity-ui` 7d persiste os dois
  campos sem erro no card; ida e volta de backup segue passando. Leitura de
  estados antigos (inclusive chaves fora do envelope) continua compatível.

## P3 — Filtro de geração do renderer

- `refreshScope` prefere o escopo confiável de `desk.activityScope()`
  (conversa + geração + `scopeRef`) e mescla o `getScope` síncrono **sem**
  atravessar conversa (se divergirem, vale o síncrono, sem geração antiga);
  `handleActivityEvent` revalida geração e `scopeRef` antes de hidratar.
  `src/main.mjs` não precisou mudar.
- Teste `hunt-activity-ui` 10b: evento da MESMA conversa com geração antiga não
  hidrata; evento de outra conversa também segue bloqueado.

## P3 — `request-state`/`stop`/`state` na documentação

- `stop` passou a ser enviado ao artefato antes de remover o frame (best-effort;
  a remoção encerra o realm). `request-state` saiu da documentação; ficou
  explícito que `init`/`theme`/`stop` são host→artefato e `state`/`attempt` são
  artefato→host. Atualizados descrição da ferramenta Claude, guia da extensão Pi
  e `exemplos.md`.

## P3 — Regeneração como revisão imutável (`activityId`)

- `pickPayload` valida `activityId` (`isSafeId`), ele participa do `paramsHash`
  e é propagado nos dois caminhos (ponte Pi e handler/serviço Claude) até o
  `activity-host` e o store, que cria uma versão nova no MESMO id e conversa.
- Escopo: id inexistente na conversa → `MISSING` (não cria item silencioso); id
  inválido → `BAD_INPUT`; limite de 200 itens respeitado também em revisão. A
  versão anterior permanece; o runtime serve as duas; nenhuma atualização de
  iframe/vínculo existente.
- Ferramentas: campo opcional `activityId` no schema Zod (Claude), no TypeBox
  (Pi) e no corpo do cliente Pi.
- Testes: store (v2 imutável, MISSING/BAD_INPUT), ponte (v1/v2, runtime com as
  duas, revisão ausente não cria item), call-gate (trocar o `activityId` após a
  reserva invalida a referência), serviço Claude (`publishFromTool`) e host
  (v2 + revisão não atravessa conversa).

## P3 — Prova de dois payloads idênticos com IDs nativos distintos

- Novo `tests/activity-dual-sdk-gate.test.mjs`: adapter real + `fakeSdk` +
  transporte MCP real; dois `tool_use_id` distintos com payload idêntico,
  auto-aprovados pelo hook, publicam dois itens com os IDs nativos corretos e
  dois documentos servíveis. `claude-activity-tools.test.mjs` (do root) fica
  intacto.

## Arquivos liberados
- Editados: `desk/activity-runtime.cjs`, `desk/activity-store.cjs`,
  `desk/activity-bridge.cjs`, `desk/activity-host.cjs`,
  `desk/src/activity.mjs`, `desk/src/agents/activity-tools.cjs`,
  `desk/src/agents/activity-call-gate.cjs` (ownership ampliado pelo root para
  revisão + prova dual), `desk/src/extensions/mesa-activity/{index.ts,
  client.mjs}`, `desk/src/activities/exemplos.md`, região de atividade do
  `desk/preload.cjs`.
- Testes/fixtures: `activity-*`/`hunt-activity-*`/`native-activity` e
  `tests/fixtures/activity/*` (inclui novos `hunt-activity-isolation.mjs`,
  `hunt-activity-watchdog.mjs`, `activity-dual-sdk-gate.test.mjs` e fixtures
  `isolation-main.cjs`/`watchdog-main.cjs`/`watchdog-preload.cjs`).
- Não tocados: chat/timeline/PDF/core/backups/`main.cjs`/adaptador Claude/
  `src/main.mjs` (só a chamada do root) e `package.json`.

## Limites
- Tudo sintético: Electron 44.2/macOS, sem provedor autenticado, app instalado,
  Windows/Linux ou dados pessoais.
- Os hunts novos entram automaticamente no `npm run hunts` (glob `hunt-*.mjs`).
- O watchdog mata o processo compartilhado com frames comprovadamente travados;
  os vizinhos ficam em erro até Reabrir/Reiniciar (host/IPC seguem, medido), e
  desmontar antes dependeria de `onWatchdog` no renderer (root).
- Nada aqui é certificação de inferência real, uso do app instalado ou de
  correção pedagógica do conteúdo gerado.
