# Atividades interativas — implementação do domínio

Data: 2026-10-08. Escopo: domínio exclusivo do agente de atividades
(`desk/activity-{store,runtime,bridge}.cjs`, `desk/src/activity.{mjs,css}`,
`desk/src/activities/**`, `desk/src/extensions/mesa-activity/**`,
`desk/src/agents/activity-tools.cjs`, testes `activity*`/`hunt-activity*` e
fixtures). Nada fora do domínio foi editado; root integrou main/preload/index e
o Claude. **Gate A (inline) passou** e o teste integrado do root
(`tests/mesa-interactive-ui.mjs`) passa de ponta a ponta.

## Superfície: decisão medida (não presumida)

Comando: `node tests/hunt-activity-spike.mjs` (Electron sintético isolado).

- iframe `sandbox="allow-scripts"` + esquema próprio roda em **processo OOPIF
  separado** (pid do frame != pid do host).
- CSP `default-src 'none'` / `connect-src 'none'` zerou fetch/XHR/WS/ES/beacon/
  img/ping/frame/arquivo (0 hits HTTP), mas **WebRTC/STUN escapa da CSP**
  (4 datagramas UDP medidos). O prelude do wrapper retira
  `RTCPeerConnection`/`WebTransport`/`mediaDevices` **antes de qualquer HTML do
  modelo** e zera o UDP.
- Laço: `frame.executeJavaScript` = BLOCKED, host responde e o frame é
  removível; flood: host responsivo, listener cap; `WebContentsView` também
  funciona (fallback documentado, não usado no inline).
- Reprodução: `probe-raw` (vazamento medido) vs `probe-wrapped` (zero).

Ordem do wrapper (`buildActivityDocument`): CSP → `LOCKDOWN_SCRIPT` →
`__MESA_ACTIVITY__` → `RUNTIME_SCRIPT` → CSS/HTML do modelo. O html do modelo é
inserido **depois** do prelude; `<script>` inline no html roda já bloqueado.
Teste de ordem + html malicioso em `tests/activity-runtime.test.mjs`.

## Contenção em uso (watchdog)

`attachWindow` faz ping por `frame.executeJavaScript('1')` com timeout; frame
destacado com ping falho (`misses>0`, >1,5 s) tem o processo do SO morto
(`osProcessId`, nunca o renderer da janela). Motivo medido: após Parar um laço,
o processo ficava a ~12% CPU e a PRÓXIMA atividade no mesmo processo nunca
carregava; com o watchdog, a próxima carrega (`hunt-activity-ui`). Matar OOPIF
vivo derruba a janela no harness Playwright — por isso o kill é só no caminho
destacado; loop vivo é encerrado por Parar/timeout de ready. `onWatchdog` é o
seam de teste (`watchdogLog`).

## Runtime e wrapper

- Esquema `mesa-activity` (registrar privilegiado: `standard, secure, stream`,
  `supportFetchAPI:false`, `corsEnabled:false`); `frame-src mesa-activity:` no
  `index.html` (root já fez).
- `activityArtifactUrl(id, version, theme)` → `.../index.html?theme=dark|light|system`.
  Tema entra na URL (antes da primeira pintura); `theme` via postMessage também
  aceita `system`, com `color-scheme` coerente e `@media(prefers-color-scheme:dark)`.
- Servir só o que foi publicado (`remember` por hash; protocolo nunca lê caminho
  do modelo). KaTeX é opt-in (`katex:true`) servido de lista fixa do pacote
  local (`mesa-activity://katex/...`; traversal negado).
- Navegação de subframe: só a primeira carga do artefato exato é autorizada
  (checagem sem estado pela URL atual do frame — WeakSet falhava com reuso de
  frame); qualquer navegação posterior é negada. Sessão: `webRequest` cancela
  http(s)/ws(s)/ftp com frame `mesa-activity:`.

## Protocolo host↔artefato (v1)

- Artefato → host: `{v:1, type:'ready'|'state'|'attempt'|'height'|'error',
  id, version, hash, payload}`. O host valida `event.source`, origem opaca e
  **id/version/hash exatos**; hash forjado não toca no estado.
- Caps em **bytes UTF-8**: estado ≤16 KiB, tentativa ≤4 KiB, erro ≤1200 B;
  altura clampada [140,720]; total por montagem 3000 mensagens; state 250 ms,
  height 80 ms, error 500 ms. Estado dentro da janela é **coalescido (guarda o
  último)**, nunca descartado; tentativa é ação explícita e **grava já**
  (aplicando pending), com retry limitado em falha e erro visível no card.
- Host → artefato: `init` (1x por montagem; reinit não regride estado),
  `theme`, `request-state`, `stop`.
- API do artefato: `window.mesa.{state,getState,attempt,getAttempt,height,ready,
  error,onMessage}`.

## Card/renderer (`src/activity.mjs`)

- Hidrata `div.activity-slot[data-activity-call]` via `desk-activity-slot` e
  `desk-history-rendered` (e `desk-conversation-changed`/`desk-workspace` para
  escopo). Histórico é preguiçoso (pôster + abrir); publicação ao vivo monta,
  inclusive evento pendente que chega antes do slot.
- Slot `stopped`/`error` **não automonta** por evento atrasado (só abre
  explícito) — guard de renderer, porque abortar o HTTP do Pi não cancela a
  publicação no host.
- Ampliar só cresce o MESMO iframe (sem reparenting); reiniciar = montagem nova
  (`initialized` resetado por montagem, init com `lastState`/snapshot); parar
  remove o iframe e o watchdog mata o processo travado. Quota de montagens ≤3
  com evicção controlada.
- “Levar ao tutor” só **anexa** ao rascunho existente e dispara `input`; nunca
  envia prompt.
- `scopeRef` opaco (por conversa/geração) é repassado em
  `activityRead/StateGet/StateSave`; resposta atrasada/escopo antigo é
  descartada. Falha de persistência mantém dirty e mostra erro com retry.

## Store (`activity-store.cjs`)

`<runtime>/activities/<sha256(identidade portátil)[0:24]>/` com `index.json`,
`docs/<id>-v<v>.json`, `state.json`. Identidade **relativa ao runtime** (ex.:
`rel:pi-x.jsonl`) — backup em outro runtime encontra o diretório relocacionado;
índice legado (hash do caminho absoluto, sem `portableId`) é lido e remapeado.
Versões imutáveis; dedupe `(toolCallId|callRef)+hash`; corrupção preservada e
`CORRUPT` (nunca silêncio); 200 itens/conversa; estado 16 KiB por versão com
leitura-depois-escrita (overlay em memória cobre save em voo).

## Ferramentas, ponte e correlação

- Pi: `mesa_criar_atividade` (extensão `src/extensions/mesa-activity/`,
  `execute(id)` → HTTP com `toolCallId`).
- Claude: `createActivityTool(createActivity)` devolve a `SdkMcpToolDefinition`
  (para compor `createSdkMcpServer({name:'mesa',tools:[criar_pdf,
  criar_atividade]})`); `createActivityServer` é wrapper. O handler **não**
  recebe id: o hook PreToolUse registra
  `registerCall({callRef,toolCallId,conversationId,generation,paramsHash,
  scopeRef})`, injeta `updatedInput.callRef`; handler resolve e confere hash;
  `callRef` do modelo sem registro é recusado.
- Ponte HTTP (`activity-bridge.cjs`): token efêmero por grant, escopo capturado,
  payload só com campos do contrato (sem caminho/URL), 64 KiB, retries
  idempotentes, evento `{status:'published', activity, scope}`.

## Comandos executados (resultado)

- `node tests/hunt-activity-spike.mjs` → GATE A PASSOU.
- `node --test tests/activity-*.test.mjs tests/study-activity-backup.test.mjs`
  → 31/31.
- `node tests/native-activity-tool.mjs` → PASS (SDK Pi real, sem inferência).
- `node tests/hunt-activity-ui.mjs` → PASSOU (20+ cenários sintéticos).
- `node tests/mesa-interactive-ui.mjs` (root) → PASS.
- Sem dependências novas, sem app pessoal, sem release/commit.

## Pendências/limites

- Revisão independente do domínio e da integração (root aguarda).
- Watchdog só mata processo de frame destacado; loop vivo depende de
  Parar/timeout (decisão de segurança do harness).
- KaTeX do artefato é lista fixa do pacote local; não há CDN.
- `hunt-activity-ui` usa relógios/espera limitados; é harness sintético, não
  prova uso real com provedor.
